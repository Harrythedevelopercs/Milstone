"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/lib/action-result";
import {
  calculateEmployeePartnerRevenue,
  calculateMonthExpenses,
  calculateMonthRevenue,
  calculateMonthSalariesPosted,
  EMPLOYEE_PARTNER_COMMISSION_PERCENT,
  getBonusPoolPercent,
} from "@/lib/payroll/calculations";
import {
  runPayrollSchema,
  runEpCommissionsSchema,
  runPartnerDistributionSchema,
} from "./schema";

type Checklist = {
  payrollRun?: boolean;
  epCommissionsRun?: boolean;
  partnerDistributionRun?: boolean;
};

async function readChecklist(accountingMonth: string): Promise<Checklist> {
  const monthClose = await prisma.monthClose.findUnique({ where: { accountingMonth } });
  return (monthClose?.checklist as Checklist | null) ?? {};
}

async function markChecklist(accountingMonth: string, patch: Checklist) {
  const existing = await readChecklist(accountingMonth);
  await prisma.monthClose.upsert({
    where: { accountingMonth },
    create: { accountingMonth, status: "OPEN", checklist: { ...existing, ...patch } },
    update: { checklist: { ...existing, ...patch } },
  });
}

export async function runPayroll(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = runPayrollSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  // Deliberately NOT gated by assertMonthOpen: these runs are optional and
  // often happen weeks or months after the fact, sometimes against a month
  // that's already closed -- the accountingMonth on every row it posts is
  // explicit regardless of when it's run, and the "already run" guard below
  // keeps it idempotent, so a closed month's already-distributed figures
  // can't be corrupted by running it again or running it late.
  const checklist = await readChecklist(d.accountingMonth);
  if (checklist.payrollRun) {
    return { ok: false, error: `Payroll already run for ${d.accountingMonth}.` };
  }

  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } });
  if (!bankAccount || !bankAccount.active) return { ok: false, error: "Bank account not found or inactive." };

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE", salary: { gt: 0 } },
  });
  if (employees.length === 0) {
    return { ok: false, error: "No active employees with a configured salary." };
  }

  const paymentDate = new Date(d.paymentDate);
  if (Number.isNaN(paymentDate.getTime())) return { ok: false, error: "Invalid payment date." };

  const total = employees.reduce((sum, e) => sum.plus(e.salary), new Decimal(0));

  await prisma.$transaction(async (tx) => {
    for (const employee of employees) {
      const entry = await tx.salaryLedger.create({
        data: {
          employeeId: employee.id,
          entryDate: paymentDate,
          accountingMonth: d.accountingMonth,
          amount: employee.salary,
          payPeriod: d.accountingMonth,
          sourceType: "MONTH_CLOSE",
          sourceId: d.accountingMonth,
          description: `Salary for ${d.accountingMonth}`,
          createdById: user.id,
        },
      });
      await writeAuditLog(tx, {
        entityType: "SalaryLedger",
        entityId: entry.id,
        action: "CREATE",
        performedById: user.id,
        afterSnapshot: JSON.parse(JSON.stringify(entry)),
      });
    }

    await tx.bankLedger.create({
      data: {
        bankAccountId: d.bankAccountId,
        entryDate: paymentDate,
        accountingMonth: d.accountingMonth,
        amount: total.negated().toFixed(2),
        usdValue: total.negated().toFixed(2),
        sourceType: "MANUAL",
        sourceId: d.accountingMonth,
        description: `Payroll for ${d.accountingMonth} (${employees.length} employees)`,
        createdById: user.id,
      },
    });
  });

  await markChecklist(d.accountingMonth, { payrollRun: true });
  revalidatePath("/distributions");
  revalidatePath("/cash-position");
  return { ok: true };
}

export async function runEmployeePartnerCommissions(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = runEpCommissionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  // Deliberately NOT gated by assertMonthOpen: these runs are optional and
  // often happen weeks or months after the fact, sometimes against a month
  // that's already closed -- the accountingMonth on every row it posts is
  // explicit regardless of when it's run, and the "already run" guard below
  // keeps it idempotent, so a closed month's already-distributed figures
  // can't be corrupted by running it again or running it late.
  const checklist = await readChecklist(d.accountingMonth);
  if (checklist.epCommissionsRun) {
    return { ok: false, error: `Employee partner commissions already run for ${d.accountingMonth}.` };
  }

  const employeePartners = await prisma.employee.findMany({
    where: { isEmployeePartner: true, status: "ACTIVE" },
  });

  const runDate = new Date(d.runDate);
  if (Number.isNaN(runDate.getTime())) return { ok: false, error: "Invalid date." };

  await prisma.$transaction(async (tx) => {
    for (const employee of employeePartners) {
      const revenue = await calculateEmployeePartnerRevenue(employee.id, d.accountingMonth);
      if (revenue.isZero()) continue;
      const commission = revenue.times(EMPLOYEE_PARTNER_COMMISSION_PERCENT).div(100);

      const entry = await tx.employeePartnerLedger.create({
        data: {
          employeeId: employee.id,
          entryDate: runDate,
          accountingMonth: d.accountingMonth,
          amount: commission.toFixed(2),
          sourceType: "MONTH_CLOSE",
          sourceId: d.accountingMonth,
          description: `${EMPLOYEE_PARTNER_COMMISSION_PERCENT}% of ${revenue.toFixed(2)} eligible revenue for ${d.accountingMonth}`,
          createdById: user.id,
        },
      });
      await writeAuditLog(tx, {
        entityType: "EmployeePartnerLedger",
        entityId: entry.id,
        action: "CREATE",
        performedById: user.id,
        afterSnapshot: JSON.parse(JSON.stringify(entry)),
      });
    }
  });

  await markChecklist(d.accountingMonth, { epCommissionsRun: true });
  revalidatePath("/distributions");
  revalidatePath("/employee-partner-ledger");
  return { ok: true };
}

export async function runPartnerDistribution(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = runPartnerDistributionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  // Deliberately NOT gated by assertMonthOpen: these runs are optional and
  // often happen weeks or months after the fact, sometimes against a month
  // that's already closed -- the accountingMonth on every row it posts is
  // explicit regardless of when it's run, and the "already run" guard below
  // keeps it idempotent, so a closed month's already-distributed figures
  // can't be corrupted by running it again or running it late.
  const checklist = await readChecklist(d.accountingMonth);
  if (checklist.partnerDistributionRun) {
    return { ok: false, error: `Partner distribution already run for ${d.accountingMonth}.` };
  }
  const salariedEmployeeCount = await prisma.employee.count({
    where: { status: "ACTIVE", salary: { gt: 0 } },
  });
  if (!checklist.payrollRun && salariedEmployeeCount > 0) {
    return {
      ok: false,
      error: "Run payroll for this month first so salaries are reflected in the distributable profit.",
    };
  }

  const partners = await prisma.partner.findMany({ where: { status: "ACTIVE" } });
  if (partners.length === 0) return { ok: false, error: "No active partners configured." };

  const [revenue, expenses, salaries, bonusPoolPercent] = await Promise.all([
    calculateMonthRevenue(d.accountingMonth),
    calculateMonthExpenses(d.accountingMonth),
    calculateMonthSalariesPosted(d.accountingMonth),
    getBonusPoolPercent(),
  ]);

  const distributableProfit = revenue.minus(salaries).minus(expenses);
  const runDate = new Date(d.runDate);
  if (Number.isNaN(runDate.getTime())) return { ok: false, error: "Invalid date." };

  await prisma.$transaction(async (tx) => {
    for (const partner of partners) {
      const share = distributableProfit.times(partner.profitSharePercent).div(100);
      const entry = await tx.partnerLedger.create({
        data: {
          partnerId: partner.id,
          entryDate: runDate,
          accountingMonth: d.accountingMonth,
          amount: share.toFixed(2),
          kind: "PROFIT_ENTITLEMENT",
          sourceType: "MONTH_CLOSE",
          sourceId: d.accountingMonth,
          description: `${partner.profitSharePercent.toString()}% of ${distributableProfit.toFixed(2)} distributable profit for ${d.accountingMonth}`,
          createdById: user.id,
        },
      });
      await writeAuditLog(tx, {
        entityType: "PartnerLedger",
        entityId: entry.id,
        action: "CREATE",
        performedById: user.id,
        afterSnapshot: JSON.parse(JSON.stringify(entry)),
      });
    }

    const bonusAmount = distributableProfit.times(bonusPoolPercent).div(100);
    const bonusEntry = await tx.bonusPoolLedger.create({
      data: {
        entryDate: runDate,
        accountingMonth: d.accountingMonth,
        amount: bonusAmount.toFixed(2),
        sourceType: "MONTH_CLOSE",
        sourceId: d.accountingMonth,
        description: `${bonusPoolPercent.toString()}% of ${distributableProfit.toFixed(2)} distributable profit for ${d.accountingMonth}`,
        createdById: user.id,
      },
    });
    await writeAuditLog(tx, {
      entityType: "BonusPoolLedger",
      entityId: bonusEntry.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(bonusEntry)),
    });
  });

  await markChecklist(d.accountingMonth, { partnerDistributionRun: true });
  revalidatePath("/distributions");
  revalidatePath("/partner-ledger");
  revalidatePath("/bonus-pool");
  return { ok: true };
}

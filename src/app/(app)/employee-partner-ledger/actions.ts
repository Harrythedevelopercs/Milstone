"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import type { ActionResult } from "@/lib/action-result";
import { commissionPaymentSchema } from "./schema";

// The disbursement half of the accrual: a COMMISSION entry (posted by the
// monthly run) is a liability the moment it lands; this posts a PAYMENT
// entry against it. Not capped to the current owed balance -- same as
// Partner drawings, paying more than currently owed is allowed (it just
// carries forward as a negative/advance balance) and partial payments are
// simply whatever amount is entered, with the remainder carrying forward
// automatically since the running balance is just a sum.
export async function recordCommissionPayment(employeeId: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = commissionPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [employee, bankAccount] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId } }),
    prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } }),
  ]);
  if (!employee) return { ok: false, error: "Employee not found." };
  if (!bankAccount || !bankAccount.active) return { ok: false, error: "Bank account not found or inactive." };

  const paymentDate = new Date(d.paymentDate);
  if (Number.isNaN(paymentDate.getTime())) return { ok: false, error: "Invalid date." };
  const accountingMonth = accountingMonthOf(paymentDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    const ledgerEntry = await tx.employeePartnerLedger.create({
      data: {
        employeeId,
        entryDate: paymentDate,
        accountingMonth,
        amount: `-${d.amount}`,
        kind: "PAYMENT",
        sourceType: "MANUAL",
        sourceId: employeeId,
        description: d.notes || `Commission payment to ${employee.name}`,
        createdById: user.id,
      },
    });

    await tx.bankLedger.create({
      data: {
        bankAccountId: d.bankAccountId,
        entryDate: paymentDate,
        accountingMonth,
        amount: `-${d.amount}`,
        usdValue: `-${d.amount}`,
        sourceType: "MANUAL",
        sourceId: employeeId,
        description: `Commission paid to ${employee.name}`,
        createdById: user.id,
      },
    });

    await writeAuditLog(tx, {
      entityType: "EmployeePartnerLedger",
      entityId: ledgerEntry.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(ledgerEntry)),
    });
  });

  revalidatePath(`/employee-partner-ledger/${employeeId}`);
  revalidatePath("/employee-partner-ledger");
  revalidatePath("/cash-position");
  return { ok: true };
}

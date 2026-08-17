import { addMonths } from "date-fns";
import { prisma } from "@/lib/prisma";

export type ManualChecklistKey =
  | "chargebacksReviewed"
  | "clientBalancesReviewed"
  | "expensesReviewed"
  | "partnerDrawingsReviewed"
  | "pnlReviewed";

export type Checklist = {
  payrollRun?: boolean;
  epCommissionsRun?: boolean;
  partnerDistributionRun?: boolean;
  chargebacksReviewed?: boolean;
  clientBalancesReviewed?: boolean;
  expensesReviewed?: boolean;
  partnerDrawingsReviewed?: boolean;
  pnlReviewed?: boolean;
};

export type ChecklistItem = {
  key: string;
  label: string;
  passed: boolean;
  manual: boolean;
  // Non-blocking items are shown for visibility but never stop closeMonth.
  // Payroll/EP-commissions/partner-distribution are optional runs that
  // often happen weeks or months after the fact, sometimes against an
  // already-closed month -- closing must never wait on them.
  blocking: boolean;
};

export async function readChecklist(accountingMonth: string): Promise<Checklist> {
  const monthClose = await prisma.monthClose.findUnique({ where: { accountingMonth } });
  return (monthClose?.checklist as Checklist | null) ?? {};
}

export async function computeChecklistItems(accountingMonth: string): Promise<ChecklistItem[]> {
  const checklist = await readChecklist(accountingMonth);

  const monthStart = new Date(`${accountingMonth}-01T00:00:00.000Z`);
  const monthEnd = addMonths(monthStart, 1);

  const [unsettledCount, diffBatchCount, activeBankCount, reconciledBankCount, salariedEmployeeCount] =
    await Promise.all([
      prisma.transaction.count({
        where: { accountingMonth, status: "APPROVED", settlementBatchId: null },
      }),
      prisma.settlementBatch.count({ where: { accountingMonth, status: "DIFFERENCE" } }),
      prisma.bankAccount.count({ where: { active: true } }),
      prisma.bankAccount.count({
        where: {
          active: true,
          reconciliations: { some: { asOfDate: { gte: monthStart, lt: monthEnd } } },
        },
      }),
      prisma.employee.count({ where: { status: "ACTIVE", salary: { gt: 0 } } }),
    ]);

  return [
    {
      key: "merchantRecon",
      label: `Merchant reconciliation — no unsettled transactions, no settlement differences`,
      passed: unsettledCount === 0 && diffBatchCount === 0,
      manual: false,
      blocking: true,
    },
    {
      key: "bankRecon",
      label: "Bank/USDT/cash reconciliation recorded for every active account this month",
      passed: activeBankCount === 0 || reconciledBankCount === activeBankCount,
      manual: false,
      blocking: true,
    },
    {
      key: "salariesRun",
      label: "Salaries run for the month (optional -- can be run any time, even after closing)",
      passed: salariedEmployeeCount === 0 || !!checklist.payrollRun,
      manual: false,
      blocking: false,
    },
    {
      key: "epCommissionsRun",
      label: "Employee partner commissions run for the month (optional -- can be run any time, even after closing)",
      passed: !!checklist.epCommissionsRun,
      manual: false,
      blocking: false,
    },
    {
      key: "partnerDistributionRun",
      label: "Partner profit distribution run for the month (optional -- can be run any time, even after closing)",
      passed: !!checklist.partnerDistributionRun,
      manual: false,
      blocking: false,
    },
    {
      key: "chargebacksReviewed",
      label: "Chargebacks & refunds reviewed",
      passed: !!checklist.chargebacksReviewed,
      manual: true,
      blocking: true,
    },
    {
      key: "clientBalancesReviewed",
      label: "Client balances reviewed",
      passed: !!checklist.clientBalancesReviewed,
      manual: true,
      blocking: true,
    },
    {
      key: "expensesReviewed",
      label: "Expenses reviewed",
      passed: !!checklist.expensesReviewed,
      manual: true,
      blocking: true,
    },
    {
      key: "partnerDrawingsReviewed",
      label: "Partner drawings reviewed",
      passed: !!checklist.partnerDrawingsReviewed,
      manual: true,
      blocking: true,
    },
    {
      key: "pnlReviewed",
      label: "P&L reviewed",
      passed: !!checklist.pnlReviewed,
      manual: true,
      blocking: true,
    },
  ];
}

import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";

// Revenue is recognized the moment a transaction is approved and never
// reversed by a later chargeback (brief section 5) -- so any status past
// the pre-approval stage counts, with no special-casing for what happens
// to the transaction afterward.
const REVENUE_RECOGNIZED_EXCLUDED_STATUSES = [
  "ENTERED",
  "SUBMITTED",
  "DETAILS_REQUESTED",
  "REJECTED",
] as const;

export async function calculateMonthRevenue(accountingMonth: string): Promise<Decimal> {
  const result = await prisma.transaction.aggregate({
    where: { accountingMonth, status: { notIn: [...REVENUE_RECOGNIZED_EXCLUDED_STATUSES] } },
    _sum: { fpFee: true },
  });
  return new Decimal(result._sum.fpFee ?? 0);
}

export async function calculateMonthExpenses(accountingMonth: string): Promise<Decimal> {
  const result = await prisma.expense.aggregate({
    where: { accountingMonth },
    _sum: { amount: true },
  });
  return new Decimal(result._sum.amount ?? 0);
}

export async function calculateMonthSalariesPosted(accountingMonth: string): Promise<Decimal> {
  const result = await prisma.salaryLedger.aggregate({
    where: { accountingMonth },
    _sum: { amount: true },
  });
  return new Decimal(result._sum.amount ?? 0);
}

export async function calculateEmployeePartnerRevenue(
  employeeId: string,
  accountingMonth: string
): Promise<Decimal> {
  const result = await prisma.transaction.aggregate({
    where: {
      accountingMonth,
      employeePartnerId: employeeId,
      status: { notIn: [...REVENUE_RECOGNIZED_EXCLUDED_STATUSES] },
    },
    _sum: { fpFee: true },
  });
  return new Decimal(result._sum.fpFee ?? 0);
}

export const EMPLOYEE_PARTNER_COMMISSION_PERCENT = 10;
export const DEFAULT_BONUS_POOL_PERCENT = 4;

export async function getBonusPoolPercent(): Promise<Decimal> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "bonusPoolPercent" } });
  return new Decimal(setting?.value ?? DEFAULT_BONUS_POOL_PERCENT);
}

import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { REVENUE_RECOGNIZED_EXCLUDED_STATUSES } from "@/lib/transactions/revenue-status";

export type PnlScope =
  | { level: "consolidated" }
  | { level: "company"; companyId: string }
  | { level: "businessUnit"; businessUnitId: string };

export type PnlResult = {
  // Gross FP revenue -- sum of fpFee, the combined rate charged to the
  // client (e.g. 9.5%). Drives netProfit below exactly as before; a
  // referral partner's share is not treated as a cost here, only
  // surfaced informationally via the two fields below.
  revenue: Decimal;
  // Of revenue above, how much is owed out to referral partners (e.g.
  // Kamal's 2%) vs how much is FoundaPay's own true revenue (e.g. the
  // remaining 7.5%). referralPayable + revenueNetOfReferral == revenue
  // always.
  referralPayable: Decimal;
  revenueNetOfReferral: Decimal;
  productGrossProfit: Decimal;
  expenses: Decimal;
  salaries: Decimal;
  netProfit: Decimal;
};

// Company and Business Unit are independent classification dimensions in
// this schema (Client -> Company has no direct link), so scoped P&Ls can
// only include what's actually attributable to that scope: transactions
// carry both companyId and businessUnitId directly, but salaries and
// product/service sales aren't tied to a company. Consolidated is the only
// scope where every line is included.
export async function calculatePnl(accountingMonth: string, scope: PnlScope): Promise<PnlResult> {
  const txnWhere: Record<string, unknown> = {
    accountingMonth,
    status: { notIn: [...REVENUE_RECOGNIZED_EXCLUDED_STATUSES] },
  };
  const expenseWhere: Record<string, unknown> = { accountingMonth };
  const saleWhere: Record<string, unknown> = { accountingMonth };

  if (scope.level === "company") {
    txnWhere.companyId = scope.companyId;
    expenseWhere.companyId = scope.companyId;
  } else if (scope.level === "businessUnit") {
    txnWhere.businessUnitId = scope.businessUnitId;
    expenseWhere.businessUnitId = scope.businessUnitId;
    saleWhere.businessUnitId = scope.businessUnitId;
  }

  const [revenueAgg, referralAgg, expenseAgg, salesAgg, salariesAgg] = await Promise.all([
    prisma.transaction.aggregate({ where: txnWhere, _sum: { fpFee: true } }),
    prisma.transaction.aggregate({ where: txnWhere, _sum: { referralPartnerFee: true } }),
    prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
    scope.level === "company"
      ? Promise.resolve(null)
      : prisma.productServiceSale.aggregate({
          where: saleWhere,
          _sum: { totalRevenue: true, totalCost: true },
        }),
    scope.level === "consolidated"
      ? prisma.salaryLedger.aggregate({ where: { accountingMonth }, _sum: { amount: true } })
      : Promise.resolve(null),
  ]);

  const revenue = new Decimal(revenueAgg._sum.fpFee ?? 0);
  const referralPayable = new Decimal(referralAgg._sum.referralPartnerFee ?? 0);
  const revenueNetOfReferral = revenue.minus(referralPayable);
  const expenses = new Decimal(expenseAgg._sum.amount ?? 0);
  const productGrossProfit = salesAgg
    ? new Decimal(salesAgg._sum.totalRevenue ?? 0).minus(salesAgg._sum.totalCost ?? 0)
    : new Decimal(0);
  const salaries = new Decimal(salariesAgg?._sum.amount ?? 0);

  const netProfit = revenue.plus(productGrossProfit).minus(expenses).minus(salaries);

  return { revenue, referralPayable, revenueNetOfReferral, productGrossProfit, expenses, salaries, netProfit };
}

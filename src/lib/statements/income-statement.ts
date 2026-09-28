import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { REVENUE_RECOGNIZED_EXCLUDED_STATUSES } from "@/lib/transactions/revenue-status";

export type IncomeStatementLine = { label: string; amount: Decimal };

export type IncomeStatementResult = {
  revenueLines: IncomeStatementLine[];
  revenue: Decimal;
  // Of revenue's "FP Fee Revenue" line (the combined rate charged to
  // clients, e.g. 9.5%): how much is owed out to referral partners (e.g.
  // Kamal's 2%) vs how much is FoundaPay's own true revenue (e.g. the
  // remaining 7.5%). referralPartnerCommission is also included as its own
  // COGS line below, same treatment as Employee-Partner Commission --
  // these two fields are purely for a clear side-by-side, not a separate
  // deduction.
  referralPartnerCommission: Decimal;
  revenueNetOfReferral: Decimal;
  cogsLines: IncomeStatementLine[];
  cogs: Decimal;
  grossProfit: Decimal;
  opexLines: IncomeStatementLine[];
  opex: Decimal;
  netProfit: Decimal;
};

// Standard Revenue -> COGS -> Gross Profit -> OpEx -> Net Profit presentation,
// built entirely from existing, already-posted domain data -- no new money
// math, just organized into the standard shape. A few lines are judgment
// calls given this business's specific economics (documented inline); none
// of them touch how anything actually posts.
export async function calculateIncomeStatement(accountingMonth: string): Promise<IncomeStatementResult> {
  const txnWhere = {
    accountingMonth,
    status: { notIn: [...REVENUE_RECOGNIZED_EXCLUDED_STATUSES] },
  };

  const [
    fpFeeAgg,
    referralCommissionAgg,
    productSalesAgg,
    merchantFeesFpBearsAgg,
    epCommissionAgg,
    rcvGrossAgg,
    payoutFeesFpBearsAgg,
    salariesAgg,
    expensesByCategory,
    reserveWriteOffsAgg,
  ] = await Promise.all([
    prisma.transaction.aggregate({ where: txnWhere, _sum: { fpFee: true } }),
    prisma.transaction.aggregate({ where: txnWhere, _sum: { referralPartnerFee: true } }),
    prisma.productServiceSale.aggregate({
      where: { accountingMonth },
      _sum: { totalRevenue: true, totalCost: true },
    }),
    prisma.transaction.aggregate({
      where: { ...txnWhere, feeBearer: "FOUNDAPAY" },
      _sum: { merchantFee: true },
    }),
    prisma.employeePartnerLedger.aggregate({
      where: { accountingMonth, kind: "COMMISSION" },
      _sum: { amount: true },
    }),
    prisma.refundChargebackVoid.aggregate({
      where: { accountingMonth, type: { in: ["REFUND", "CHARGEBACK"] } },
      _sum: { amount: true },
    }),
    prisma.clientPayout.aggregate({
      where: { accountingMonth, feeBearer: "FOUNDAPAY" },
      _sum: { remittanceFee: true },
    }),
    prisma.salaryLedger.aggregate({ where: { accountingMonth }, _sum: { amount: true } }),
    prisma.expense.groupBy({
      by: ["expenseCategoryId"],
      where: { accountingMonth },
      _sum: { amount: true },
    }),
    // CLIENT_HELD write-offs excluded: forgiving a liability FoundaPay owed
    // the client isn't a cost -- see the write-off action's own comment.
    prisma.reserveHoldAction.aggregate({
      where: { accountingMonth, type: "WRITE_OFF", reserveHold: { direction: { not: "CLIENT_HELD" } } },
      _sum: { amount: true },
    }),
  ]);

  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: expensesByCategory.map((e) => e.expenseCategoryId) } },
    select: { id: true, name: true },
  });
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const fpFeeRevenue = new Decimal(fpFeeAgg._sum.fpFee ?? 0);
  const referralPartnerCommission = new Decimal(referralCommissionAgg._sum.referralPartnerFee ?? 0);
  const revenueNetOfReferral = fpFeeRevenue.minus(referralPartnerCommission);
  const productGrossProfit = new Decimal(productSalesAgg._sum.totalRevenue ?? 0).minus(
    productSalesAgg._sum.totalCost ?? 0
  );
  const revenueLines: IncomeStatementLine[] = [
    { label: "FP Fee Revenue (gross, combined client rate)", amount: fpFeeRevenue },
    ...(productGrossProfit.isZero() ? [] : [{ label: "Product/Service Gross Profit", amount: productGrossProfit }]),
  ];
  const revenue = revenueLines.reduce((sum, l) => sum.plus(l.amount), new Decimal(0));

  const cogsLines: IncomeStatementLine[] = [
    { label: "Merchant Fees FP Bears", amount: new Decimal(merchantFeesFpBearsAgg._sum.merchantFee ?? 0) },
    { label: "Employee-Partner Commission", amount: new Decimal(epCommissionAgg._sum.amount ?? 0) },
    { label: "Referral Partner Commission", amount: referralPartnerCommission },
    // Gross reversed transaction value for the period -- FP's own fee stays
    // recognized as revenue per policy (refunds/chargebacks don't reverse
    // it), so this line is the client-side amount reversed, not a claim
    // that FP's revenue itself was impaired.
    { label: "Refunds/Chargebacks (gross reversed)", amount: new Decimal(rcvGrossAgg._sum.amount ?? 0) },
    { label: "Payout Remittance Fees FP Bears", amount: new Decimal(payoutFeesFpBearsAgg._sum.remittanceFee ?? 0) },
    { label: "Reserve Write-Offs", amount: new Decimal(reserveWriteOffsAgg._sum.amount ?? 0) },
  ];
  const cogs = cogsLines.reduce((sum, l) => sum.plus(l.amount), new Decimal(0));

  const grossProfit = revenue.minus(cogs);

  const opexLines: IncomeStatementLine[] = [
    { label: "Salaries", amount: new Decimal(salariesAgg._sum.amount ?? 0) },
    ...expensesByCategory.map((e) => ({
      label: categoryName.get(e.expenseCategoryId) ?? "Uncategorized",
      amount: new Decimal(e._sum.amount ?? 0),
    })),
  ];
  const opex = opexLines.reduce((sum, l) => sum.plus(l.amount), new Decimal(0));

  const netProfit = grossProfit.minus(opex);

  return {
    revenueLines,
    revenue,
    referralPartnerCommission,
    revenueNetOfReferral,
    cogsLines,
    cogs,
    grossProfit,
    opexLines,
    opex,
    netProfit,
  };
}

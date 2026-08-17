import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";

export type BalanceSheetLine = { label: string; amount: Decimal };

export type BalanceSheetResult = {
  assetLines: BalanceSheetLine[];
  assets: Decimal;
  liabilityLines: BalanceSheetLine[];
  liabilities: Decimal;
  equityLines: BalanceSheetLine[];
  equity: Decimal;
};

function sumPositive(rows: { _sum: { amount: Decimal | null } }[]): Decimal {
  return rows.reduce((sum, r) => {
    const v = new Decimal(r._sum.amount ?? 0);
    return v.greaterThan(0) ? sum.plus(v) : sum;
  }, new Decimal(0));
}

function sumNegativeAbs(rows: { _sum: { amount: Decimal | null } }[]): Decimal {
  return rows.reduce((sum, r) => {
    const v = new Decimal(r._sum.amount ?? 0);
    return v.lessThan(0) ? sum.plus(v.abs()) : sum;
  }, new Decimal(0));
}

// Assets = Liabilities + Equity, always, by construction: Equity is
// computed as the accounting-identity residual (Assets - Liabilities)
// rather than tracked separately, since the system doesn't model partner
// capital contributions apart from profit entitlement. That's standard --
// "Retained Earnings" IS Assets minus Liabilities in a business with no
// separate paid-in capital, not a plug for balancing's sake.
export async function calculateBalanceSheet(asOfDate: Date = new Date()): Promise<BalanceSheetResult> {
  const dateFilter = { entryDate: { lte: asOfDate } };

  const [
    bankAccounts,
    clientBalances,
    epBalances,
    partnerBalances,
    bonusPoolAgg,
    thirdPartyBalances,
    reserveHolds,
  ] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { active: true },
      include: { ledgerEntries: { where: dateFilter, select: { amount: true } } },
    }),
    prisma.clientLedger.groupBy({ by: ["clientId"], where: dateFilter, _sum: { amount: true } }),
    prisma.employeePartnerLedger.groupBy({ by: ["employeeId"], where: dateFilter, _sum: { amount: true } }),
    prisma.partnerLedger.groupBy({ by: ["partnerId"], where: dateFilter, _sum: { amount: true } }),
    prisma.bonusPoolLedger.aggregate({ where: dateFilter, _sum: { amount: true } }),
    prisma.thirdPartyLedger.groupBy({ by: ["settlementPartyId"], where: dateFilter, _sum: { amount: true } }),
    prisma.reserveHold.findMany({
      where: { heldSince: { lte: asOfDate } },
      include: { actions: { where: { actionDate: { lte: asOfDate } } } },
    }),
  ]);

  const cash = bankAccounts.reduce(
    (sum, a) =>
      sum.plus(
        a.ledgerEntries.reduce((s, e) => s.plus(e.amount), new Decimal(a.openingBalance))
      ),
    new Decimal(0)
  );

  // Positive client balance = FP owes the client (a payable, liability);
  // negative = the client owes FP (a receivable, asset).
  const clientReceivables = sumNegativeAbs(clientBalances);
  const clientPayables = sumPositive(clientBalances);

  const epOwed = sumPositive(epBalances);
  const partnerOwed = sumPositive(partnerBalances);
  const bonusPoolRemaining = new Decimal(bonusPoolAgg._sum.amount ?? 0);
  const thirdPartyPayables = sumPositive(thirdPartyBalances);

  // Money a processor/merchant is holding back from FP (or FP retains
  // itself) -- already excluded from client-side settlement math, so it's
  // a receivable owed TO FoundaPay until released, applied to a
  // chargeback, or written off. Never auto-reduced by a chargeback hitting
  // the underlying transaction -- only an explicit manual action changes it.
  let clientOwnedReserves = new Decimal(0);
  let fpOwnedReserves = new Decimal(0);
  for (const hold of reserveHolds) {
    const used = hold.actions.reduce((sum, a) => sum.plus(a.amount), new Decimal(0));
    const remaining = new Decimal(hold.originalAmount).minus(used);
    if (remaining.lessThanOrEqualTo(0)) continue;
    if (hold.owner === "CLIENT") clientOwnedReserves = clientOwnedReserves.plus(remaining);
    else fpOwnedReserves = fpOwnedReserves.plus(remaining);
  }

  const assetLines: BalanceSheetLine[] = [
    { label: "Cash (Banks, USDT, Cash)", amount: cash },
    { label: "Client Receivables / Advances", amount: clientReceivables },
    { label: "Reserves Receivable (Client-Owned)", amount: clientOwnedReserves },
    { label: "Reserves Receivable (FoundaPay-Owned)", amount: fpOwnedReserves },
  ];
  const assets = assetLines.reduce((sum, l) => sum.plus(l.amount), new Decimal(0));

  const liabilityLines: BalanceSheetLine[] = [
    { label: "Client Payables", amount: clientPayables },
    { label: "Employee-Partner Commission Owed", amount: epOwed },
    { label: "Partner Distribution Owed", amount: partnerOwed },
    { label: "Bonus Pool (unallocated)", amount: bonusPoolRemaining.greaterThan(0) ? bonusPoolRemaining : new Decimal(0) },
    { label: "Third-Party Payables", amount: thirdPartyPayables },
  ];
  const liabilities = liabilityLines.reduce((sum, l) => sum.plus(l.amount), new Decimal(0));

  const equityValue = assets.minus(liabilities);
  const equityLines: BalanceSheetLine[] = [
    { label: "Partner Equity (Retained Earnings)", amount: equityValue },
  ];
  const equity = equityValue;

  return { assetLines, assets, liabilityLines, liabilities, equityLines, equity };
}

import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";

// Which transaction statuses can receive a client payout. Deliberately wider
// than "already settled" -- Approved/Settled/Hold/Reserve are all included
// so a client can be paid ahead of formal settlement (advance liberty rule).
// Terminal/problem statuses (void, refunded, chargeback, disputed, rejected,
// closed) and not-yet-approved statuses stay excluded.
export const PAYABLE_TRANSACTION_STATUSES = [
  "APPROVED",
  "SETTLED",
  "CLIENT_PAYABLE",
  "PARTIALLY_PAID",
  "HOLD",
  "RESERVE",
] as const;

export type PayableTransaction = { id: string; clientId: string; remaining: string };
export type PayoutClientOption = { id: string; name: string; currentBalance: string };

export async function getPayoutFormData(): Promise<{
  clients: PayoutClientOption[];
  payableTransactions: PayableTransaction[];
}> {
  const [clients, payableTransactions, balances] = await Promise.all([
    prisma.client.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.transaction.findMany({
      where: { status: { in: [...PAYABLE_TRANSACTION_STATUSES] } },
      orderBy: { transactionDate: "asc" },
      include: { payoutAllocations: { select: { amountAllocated: true } } },
    }),
    prisma.clientLedger.groupBy({ by: ["clientId"], _sum: { amount: true } }),
  ]);

  const balanceByClientId = new Map(balances.map((b) => [b.clientId, b._sum.amount]));

  const clientsWithBalance = clients.map((c) => ({
    id: c.id,
    name: c.name,
    currentBalance: new Decimal(balanceByClientId.get(c.id) ?? 0).toFixed(2),
  }));

  const payable = payableTransactions.map((t) => {
    const alreadyPaid = t.payoutAllocations.reduce(
      (sum, a) => sum.plus(a.amountAllocated),
      new Decimal(0)
    );
    const remaining = new Decimal(t.clientNetPayable ?? 0).minus(alreadyPaid);
    return {
      id: t.id,
      clientId: t.clientId,
      remaining: remaining.toFixed(2),
    };
  });

  return { clients: clientsWithBalance, payableTransactions: payable };
}

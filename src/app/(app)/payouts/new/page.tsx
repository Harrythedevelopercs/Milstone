import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { PayoutForm } from "./payout-form";

export default async function NewPayoutPage() {
  const [clients, payoutMethods, bankAccounts, payableTransactions] = await Promise.all([
    prisma.client.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.payoutMethod.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.transaction.findMany({
      where: { status: { in: ["CLIENT_PAYABLE", "PARTIALLY_PAID"] } },
      orderBy: { transactionDate: "asc" },
      include: { payoutAllocations: { select: { amountAllocated: true } } },
    }),
  ]);

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

  return (
    <div className="mx-auto max-w-2xl">
      <PayoutForm
        clients={clients}
        payoutMethods={payoutMethods}
        bankAccounts={bankAccounts}
        payableTransactions={payable}
      />
    </div>
  );
}

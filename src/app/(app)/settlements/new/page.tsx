import { prisma } from "@/lib/prisma";
import { SettlementForm } from "./settlement-form";

export default async function NewSettlementBatchPage() {
  const [merchants, bankAccounts, unsettled] = await Promise.all([
    prisma.merchant.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.transaction.findMany({
      where: { status: "APPROVED", settlementBatchId: null },
      orderBy: { transactionDate: "asc" },
      include: {
        client: { select: { name: true } },
        paymentMethod: { select: { name: true } },
      },
    }),
  ]);

  // Direct-to-bank transactions skip straight to Settled on approval, so
  // they never appear here -- but the field is nullable at the schema
  // level, so filter defensively rather than assuming it.
  const unsettledTransactions = unsettled
    .filter((t) => t.merchantId !== null)
    .map((t) => ({
      id: t.id,
      merchantId: t.merchantId!,
      clientName: t.client.name,
      paymentMethodName: t.paymentMethod.name,
      grossAmount: t.grossAmount.toString(),
      expectedSettlement: t.expectedSettlement.toString(),
    }));

  return (
    <div className="mx-auto max-w-2xl">
      <SettlementForm
        merchants={merchants}
        bankAccounts={bankAccounts}
        unsettledTransactions={unsettledTransactions}
      />
    </div>
  );
}

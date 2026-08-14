import { prisma } from "@/lib/prisma";
import { TransactionForm } from "./transaction-form";

export default async function NewTransactionPage() {
  const [clients, merchants, bankAccounts, paymentMethods] = await Promise.all([
    prisma.client.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.merchant.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        settlementBankId: true,
        defaultReservePercent: true,
      },
    }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.paymentMethod.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const merchantOptions = merchants.map((m) => ({
    id: m.id,
    name: m.name,
    settlementBankId: m.settlementBankId,
    defaultReservePercent: m.defaultReservePercent.toString(),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <TransactionForm
        clients={clients}
        merchants={merchantOptions}
        bankAccounts={bankAccounts}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}

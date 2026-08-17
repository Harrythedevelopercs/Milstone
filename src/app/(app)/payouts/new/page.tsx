import { prisma } from "@/lib/prisma";
import { getPayoutFormData } from "@/lib/transactions/payable-data";
import { bankAccountLabel, BANK_ACCOUNT_LABEL_SELECT } from "@/lib/bank-account-label";
import { PayoutForm } from "./payout-form";

export default async function NewPayoutPage() {
  const [{ clients, payableTransactions }, payoutMethods, bankAccounts] = await Promise.all([
    getPayoutFormData(),
    prisma.payoutMethod.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: BANK_ACCOUNT_LABEL_SELECT,
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PayoutForm
        clients={clients}
        payoutMethods={payoutMethods}
        bankAccounts={bankAccounts.map((a) => ({ id: a.id, name: bankAccountLabel(a) }))}
        payableTransactions={payableTransactions}
      />
    </div>
  );
}

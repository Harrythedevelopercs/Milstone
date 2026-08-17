import { prisma } from "@/lib/prisma";
import { bankAccountLabel, BANK_ACCOUNT_LABEL_SELECT } from "@/lib/bank-account-label";
import { TransferForm } from "./transfer-form";

export default async function NewTransferPage() {
  const accounts = await prisma.bankAccount.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { ...BANK_ACCOUNT_LABEL_SELECT, currency: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <TransferForm
        accounts={accounts.map((a) => ({ id: a.id, name: bankAccountLabel(a), currency: a.currency }))}
      />
    </div>
  );
}

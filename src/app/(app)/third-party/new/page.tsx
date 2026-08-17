import { prisma } from "@/lib/prisma";
import { bankAccountLabel, BANK_ACCOUNT_LABEL_SELECT } from "@/lib/bank-account-label";
import { ThirdPartySettlementForm } from "./settlement-form";

export default async function NewThirdPartySettlementPage() {
  const [settlementParties, clients, bankAccounts] = await Promise.all([
    prisma.settlementParty.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.client.findMany({
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
      <ThirdPartySettlementForm
        settlementParties={settlementParties}
        clients={clients}
        bankAccounts={bankAccounts.map((a) => ({ id: a.id, name: bankAccountLabel(a) }))}
      />
    </div>
  );
}

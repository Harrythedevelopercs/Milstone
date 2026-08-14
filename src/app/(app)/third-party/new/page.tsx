import { prisma } from "@/lib/prisma";
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
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <ThirdPartySettlementForm
        settlementParties={settlementParties}
        clients={clients}
        bankAccounts={bankAccounts}
      />
    </div>
  );
}

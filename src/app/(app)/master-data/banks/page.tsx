import { prisma } from "@/lib/prisma";
import { BanksClient } from "./banks-client";

export default async function BanksPage() {
  const accounts = await prisma.bankAccount.findMany({ orderBy: { name: "asc" } });

  const rows = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    accountType: a.accountType,
    bankName: a.bankName,
    accountNumberMasked: a.accountNumberMasked,
    currency: a.currency,
    country: a.country,
    openingBalance: a.openingBalance.toString(),
    active: a.active,
  }));

  return <BanksClient rows={rows} />;
}

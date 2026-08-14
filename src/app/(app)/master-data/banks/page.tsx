import { prisma } from "@/lib/prisma";
import { BanksClient } from "./banks-client";

export default async function BanksPage() {
  const [accounts, companies] = await Promise.all([
    prisma.bankAccount.findMany({
      orderBy: { name: "asc" },
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.company.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

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
    companyId: a.companyId,
    status: a.status,
    company: a.company,
  }));

  return <BanksClient rows={rows} companies={companies} />;
}

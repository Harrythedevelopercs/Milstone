import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { BanksClient } from "./banks-client";

export default async function BanksPage() {
  const [accounts, companies] = await Promise.all([
    prisma.bankAccount.findMany({
      orderBy: { name: "asc" },
      include: {
        company: { select: { id: true, name: true } },
        ledgerEntries: { select: { amount: true } },
      },
    }),
    prisma.company.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows = accounts.map((a) => {
    const currentBalance = a.ledgerEntries
      .reduce((sum, e) => sum.plus(e.amount), new Decimal(a.openingBalance))
      .toFixed(2);
    return {
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      bankName: a.bankName,
      accountNumberMasked: a.accountNumberMasked,
      currency: a.currency,
      country: a.country,
      openingBalance: a.openingBalance.toString(),
      currentBalance,
      active: a.active,
      companyId: a.companyId,
      status: a.status,
      company: a.company,
    };
  });

  return <BanksClient rows={rows} companies={companies} />;
}

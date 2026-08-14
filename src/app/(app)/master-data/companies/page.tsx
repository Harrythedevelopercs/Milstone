import { prisma } from "@/lib/prisma";
import { CompaniesClient } from "./companies-client";

export default async function CompaniesPage() {
  const [companies, partners] = await Promise.all([
    prisma.company.findMany({
      orderBy: { name: "asc" },
      include: { partner: { select: { name: true } } },
    }),
    prisma.partner.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return <CompaniesClient rows={companies} partners={partners} />;
}

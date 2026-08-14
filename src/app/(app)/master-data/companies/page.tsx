import { prisma } from "@/lib/prisma";
import { CompaniesClient } from "./companies-client";

export default async function CompaniesPage() {
  const [companies, employeePartners] = await Promise.all([
    prisma.company.findMany({
      orderBy: { name: "asc" },
      include: {
        employeePartner: { select: { name: true } },
        bankAccounts: {
          orderBy: { name: "asc" },
          select: { id: true, bankName: true, name: true, status: true },
        },
      },
    }),
    prisma.employee.findMany({
      where: { isEmployeePartner: true, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return <CompaniesClient rows={companies} employeePartners={employeePartners} />;
}

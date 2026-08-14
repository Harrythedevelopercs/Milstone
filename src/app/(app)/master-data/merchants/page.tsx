import { prisma } from "@/lib/prisma";
import { MerchantsClient } from "./merchants-client";

export default async function MerchantsPage() {
  const [merchants, companies, businessUnits, bankAccounts, paymentMethods] =
    await Promise.all([
      prisma.merchant.findMany({
        orderBy: { name: "asc" },
        include: {
          company: { select: { name: true } },
          feeRules: { include: { paymentMethod: { select: { name: true } } } },
        },
      }),
      prisma.company.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.businessUnit.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.bankAccount.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, companyId: true, company: { select: { name: true } } },
      }),
      prisma.paymentMethod.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  const rows = merchants.map((m) => ({
    id: m.id,
    name: m.name,
    companyId: m.companyId,
    businessUnitId: m.businessUnitId,
    processor: m.processor,
    settlementBankId: m.settlementBankId,
    dailyLimit: m.dailyLimit?.toString() ?? null,
    monthlyLimit: m.monthlyLimit?.toString() ?? null,
    perTxnLimit: m.perTxnLimit?.toString() ?? null,
    settlementCycle: m.settlementCycle,
    defaultReservePercent: m.defaultReservePercent.toString(),
    active: m.active,
    company: m.company,
    feeRules: m.feeRules.map((f) => ({
      id: f.id,
      paymentMethodId: f.paymentMethodId,
      feePercent: f.feePercent.toString(),
      flatFee: f.flatFee.toString(),
      chargebackFee: f.chargebackFee.toString(),
      refundFee: f.refundFee.toString(),
      monthlyFee: f.monthlyFee.toString(),
      paymentMethod: f.paymentMethod,
    })),
  }));

  return (
    <MerchantsClient
      rows={rows}
      companies={companies}
      businessUnits={businessUnits}
      bankAccounts={bankAccounts}
      paymentMethods={paymentMethods}
    />
  );
}

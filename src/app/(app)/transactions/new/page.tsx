import { prisma } from "@/lib/prisma";
import { getPayoutFormData } from "@/lib/transactions/payable-data";
import { TransactionTypeForm } from "./transaction-type-form";

export default async function NewTransactionPage() {
  const [
    { clients, payableTransactions },
    merchants,
    bankAccounts,
    paymentMethods,
    payoutMethods,
    expenseCategories,
    vendors,
    subscriptions,
    companies,
    businessUnits,
    partners,
  ] = await Promise.all([
    getPayoutFormData(),
    prisma.merchant.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        settlementBankId: true,
        defaultReservePercent: true,
      },
    }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, currency: true },
    }),
    prisma.paymentMethod.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, requiresMerchant: true },
    }),
    prisma.payoutMethod.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.expenseCategory.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.vendor.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.vendorSubscription.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, vendorId: true, name: true, amount: true },
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
    prisma.partner.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const merchantOptions = merchants.map((m) => ({
    id: m.id,
    name: m.name,
    settlementBankId: m.settlementBankId,
    defaultReservePercent: m.defaultReservePercent.toString(),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <TransactionTypeForm
        clients={clients}
        merchants={merchantOptions}
        bankAccounts={bankAccounts}
        paymentMethods={paymentMethods}
        payoutMethods={payoutMethods}
        payableTransactions={payableTransactions}
        transferAccounts={bankAccounts}
        expenseCategories={expenseCategories}
        vendors={vendors}
        subscriptions={subscriptions.map((s) => ({ ...s, amount: s.amount.toString() }))}
        companies={companies}
        businessUnits={businessUnits}
        partners={partners}
      />
    </div>
  );
}

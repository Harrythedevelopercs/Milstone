import { prisma } from "@/lib/prisma";
import { getPayoutFormData } from "@/lib/transactions/payable-data";
import { bankAccountLabel, BANK_ACCOUNT_LABEL_SELECT } from "@/lib/bank-account-label";
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
        defaultReserveDirection: true,
      },
    }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { ...BANK_ACCOUNT_LABEL_SELECT, currency: true },
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
    defaultReserveDirection: m.defaultReserveDirection,
  }));
  const bankAccountOptions = bankAccounts.map((a) => ({
    id: a.id,
    name: bankAccountLabel(a),
    currency: a.currency,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <TransactionTypeForm
        clients={clients}
        merchants={merchantOptions}
        bankAccounts={bankAccountOptions}
        paymentMethods={paymentMethods}
        payoutMethods={payoutMethods}
        payableTransactions={payableTransactions}
        transferAccounts={bankAccountOptions}
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

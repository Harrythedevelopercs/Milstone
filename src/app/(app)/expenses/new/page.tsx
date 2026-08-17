import { prisma } from "@/lib/prisma";
import { bankAccountLabel, BANK_ACCOUNT_LABEL_SELECT } from "@/lib/bank-account-label";
import { ExpenseForm } from "./expense-form";

export default async function NewExpensePage() {
  const [categories, vendors, subscriptions, companies, businessUnits, bankAccounts] =
    await Promise.all([
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
      prisma.bankAccount.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: BANK_ACCOUNT_LABEL_SELECT,
      }),
    ]);

  return (
    <div className="mx-auto max-w-2xl">
      <ExpenseForm
        categories={categories}
        vendors={vendors}
        subscriptions={subscriptions.map((s) => ({ ...s, amount: s.amount.toString() }))}
        companies={companies}
        businessUnits={businessUnits}
        bankAccounts={bankAccounts.map((a) => ({ id: a.id, name: bankAccountLabel(a) }))}
      />
    </div>
  );
}

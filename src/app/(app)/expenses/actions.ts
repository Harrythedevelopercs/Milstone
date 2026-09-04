"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { postBankLedgerEntry } from "@/lib/ledger/post-bank-ledger";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import { resolveUserNames } from "@/lib/user-names";
import type { ActionResult } from "@/lib/action-result";
import { expenseSchema } from "./schema";

export async function createExpense(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [bankAccount, client] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } }),
    d.clientId ? prisma.client.findUnique({ where: { id: d.clientId } }) : Promise.resolve(null),
  ]);
  if (!bankAccount || !bankAccount.active) {
    return { ok: false, error: "Bank account not found or inactive." };
  }
  if (d.clientId && (!client || client.status !== "ACTIVE")) {
    return { ok: false, error: "Client not found or inactive." };
  }

  const expenseDate = new Date(d.expenseDate);
  if (Number.isNaN(expenseDate.getTime())) return { ok: false, error: "Invalid expense date." };
  const accountingMonth = accountingMonthOf(expenseDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const clientBears = d.feeBearer === "CLIENT";

  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        expenseCategoryId: d.expenseCategoryId,
        vendorId: d.vendorId || null,
        subscriptionId: d.subscriptionId || null,
        companyId: d.companyId || null,
        businessUnitId: d.businessUnitId || null,
        bankAccountId: d.bankAccountId,
        amount: d.amount,
        currency: bankAccount.currency,
        expenseDate,
        accountingMonth,
        description: d.description || null,
        recurring: d.recurring,
        documentUrl: d.documentUrl || null,
        feeBearer: d.feeBearer,
        clientId: d.clientId || null,
        createdById: user.id,
        approvedById: user.id,
        approvedAt: new Date(),
      },
    });

    // The cash always actually leaves this bank account either way -- who
    // "bears" it is about whose books absorb the cost, not who physically
    // paid. FoundaPay-borne: that's the end of it, a normal OpEx. Client-
    // borne: FoundaPay is fronting it, so a matching client-ledger charge
    // recovers it from the client instead of it landing on FP's own P&L.
    await postBankLedgerEntry(tx, {
      bankAccountId: d.bankAccountId,
      amount: `-${d.amount}`,
      entryDate: expenseDate,
      accountingMonth,
      sourceType: "EXPENSE",
      sourceId: expense.id,
      description: d.description || "Expense",
      createdById: user.id,
    });

    if (clientBears && client) {
      await tx.clientLedger.create({
        data: {
          clientId: client.id,
          entryDate: expenseDate,
          accountingMonth,
          amount: `-${d.amount}`,
          sourceType: "EXPENSE",
          sourceId: expense.id,
          description: d.description || "Expense (client-borne)",
          createdById: user.id,
        },
      });
    }

    if (d.subscriptionId && d.nextBillingDate) {
      await tx.vendorSubscription.update({
        where: { id: d.subscriptionId },
        data: { nextBillingDate: new Date(d.nextBillingDate) },
      });
    }

    await writeAuditLog(tx, {
      entityType: "Expense",
      entityId: expense.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(expense)),
    });
  });

  revalidatePath("/expenses");
  revalidatePath("/cash-position");
  if (d.clientId) revalidatePath(`/client-ledger/${d.clientId}`);
  return { ok: true };
}

export async function markExpenseSettled(id: string): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const expense = await prisma.expense.update({
    where: { id },
    data: { settlementStatus: "SETTLED", settledAt: new Date(), settledById: user.id },
  });
  await writeAuditLog(prisma, {
    entityType: "Expense",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(expense)),
    notes: "Marked settled",
  });
  revalidatePath("/expenses");
  return { ok: true };
}

export type ExpenseFullDetail = {
  id: string;
  categoryName: string;
  vendorName: string | null;
  companyName: string | null;
  businessUnitName: string | null;
  bankAccountName: string;
  amount: string;
  currency: string;
  expenseDate: string;
  accountingMonth: string;
  description: string | null;
  recurring: boolean;
  status: string;
  documentUrl: string | null;
  feeBearer: string;
  clientName: string | null;
  settlementStatus: string;
  settledAt: string | null;
  settledByName: string | null;
  createdByName: string;
  createdAt: string;
  approvedByName: string | null;
  approvedAt: string | null;
};

export async function getExpenseFullDetail(id: string): Promise<ExpenseFullDetail | null> {
  await requireUser();
  const e = await prisma.expense.findUnique({
    where: { id },
    include: {
      expenseCategory: { select: { name: true } },
      vendor: { select: { name: true } },
      company: { select: { name: true } },
      businessUnit: { select: { name: true } },
      bankAccount: { select: { name: true } },
      client: { select: { name: true } },
    },
  });
  if (!e) return null;
  const names = await resolveUserNames([e.createdById, e.settledById, e.approvedById]);

  return {
    id: e.id,
    categoryName: e.expenseCategory.name,
    vendorName: e.vendor?.name ?? null,
    companyName: e.company?.name ?? null,
    businessUnitName: e.businessUnit?.name ?? null,
    bankAccountName: e.bankAccount.name,
    amount: e.amount.toString(),
    currency: e.currency,
    expenseDate: e.expenseDate.toISOString(),
    accountingMonth: e.accountingMonth,
    description: e.description,
    recurring: e.recurring,
    status: e.status,
    documentUrl: e.documentUrl,
    feeBearer: e.feeBearer,
    clientName: e.client?.name ?? null,
    settlementStatus: e.settlementStatus,
    settledAt: e.settledAt?.toISOString() ?? null,
    settledByName: e.settledById ? (names.get(e.settledById) ?? null) : null,
    createdByName: names.get(e.createdById) ?? "—",
    createdAt: e.createdAt.toISOString(),
    approvedByName: e.approvedById ? (names.get(e.approvedById) ?? null) : null,
    approvedAt: e.approvedAt?.toISOString() ?? null,
  };
}

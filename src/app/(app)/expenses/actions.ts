"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { postBankLedgerEntry } from "@/lib/ledger/post-bank-ledger";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import type { ActionResult } from "@/lib/action-result";
import { expenseSchema } from "./schema";

export async function createExpense(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } });
  if (!bankAccount || !bankAccount.active) {
    return { ok: false, error: "Bank account not found or inactive." };
  }

  const expenseDate = new Date(d.expenseDate);
  if (Number.isNaN(expenseDate.getTime())) return { ok: false, error: "Invalid expense date." };
  const accountingMonth = accountingMonthOf(expenseDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

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
        createdById: user.id,
        approvedById: user.id,
        approvedAt: new Date(),
      },
    });

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
  return { ok: true };
}

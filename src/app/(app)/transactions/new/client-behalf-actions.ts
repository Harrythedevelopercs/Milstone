"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { postBankLedgerEntry } from "@/lib/ledger/post-bank-ledger";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import type { ActionResult } from "@/lib/action-result";
import { clientBehalfExpenseSchema } from "./client-behalf-schema";

// FoundaPay pays something that's really the client's cost (e.g. a tool
// subscription), then deducts it from what the client is owed instead of
// invoicing separately. Real cash leaves the bank, the client absorbs it --
// but it's a pass-through, not FoundaPay's own cost, so no Expense/P&L
// record is created. An Adjustment row anchors the pair of ledger postings
// for audit purposes.
export async function createClientBehalfExpense(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = clientBehalfExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [client, bankAccount] = await Promise.all([
    prisma.client.findUnique({ where: { id: d.clientId } }),
    prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } }),
  ]);
  if (!client || client.status !== "ACTIVE") return { ok: false, error: "Client not found or inactive." };
  if (!bankAccount || !bankAccount.active) return { ok: false, error: "Bank account not found or inactive." };

  const expenseDate = new Date(d.expenseDate);
  if (Number.isNaN(expenseDate.getTime())) return { ok: false, error: "Invalid date." };
  const accountingMonth = accountingMonthOf(expenseDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    const adjustment = await tx.adjustment.create({
      data: {
        targetType: "CLIENT",
        targetId: d.clientId,
        amount: `-${d.amount}`,
        reason: d.description,
        accountingMonth,
        adjustmentDate: expenseDate,
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
      sourceType: "ADJUSTMENT",
      sourceId: adjustment.id,
      description: `On behalf of ${client.name}: ${d.description}`,
      createdById: user.id,
    });

    await tx.clientLedger.create({
      data: {
        clientId: d.clientId,
        entryDate: expenseDate,
        accountingMonth,
        amount: `-${d.amount}`,
        sourceType: "ADJUSTMENT",
        sourceId: adjustment.id,
        description: d.description,
        createdById: user.id,
      },
    });

    await writeAuditLog(tx, {
      entityType: "Adjustment",
      entityId: adjustment.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(adjustment)),
    });
  });

  revalidatePath("/client-ledger");
  revalidatePath("/cash-position");
  return { ok: true };
}

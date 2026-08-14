"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { createTransactionCore } from "@/lib/transactions/create-transaction-core";
import { postClientLedgerForTransaction } from "@/lib/transactions/post-ledger";
import { assertMonthOpen } from "@/lib/month-close/guard";
import { transactionSchema } from "./schema";

export type CreateTransactionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

// Accountant/Owner entries are auto-approved (brief section 6: "Accountant's
// own entries auto-approve").
export async function createTransaction(input: unknown): Promise<CreateTransactionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const result = await createTransactionCore({
    transactionDate: d.transactionDate,
    clientId: d.clientId,
    clientReference: d.clientReference || null,
    merchantId: d.merchantId,
    expectedBankId: d.expectedBankId,
    paymentMethodId: d.paymentMethodId,
    grossAmount: d.grossAmount,
    feeBearer: d.feeBearer,
    merchantFeeManual: d.merchantFeeManual || null,
    merchantReservePercent: d.merchantReservePercent,
    fpReservePercent: d.fpReservePercent,
    documentUrl: d.documentUrl || null,
    notes: d.notes || null,
    customerEmail: d.customerEmail || null,
    cardLast4: d.cardLast4 || null,
    createdById: user.id,
    status: "APPROVED",
  });

  if (result.ok) revalidatePath("/transactions");
  return result;
}

export type ReviewResult = { ok: true } | { ok: false; error: string };

export async function approveTransaction(id: string): Promise<ReviewResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (!txn) return { ok: false, error: "Transaction not found." };
  if (txn.status !== "SUBMITTED" && txn.status !== "DETAILS_REQUESTED") {
    return { ok: false, error: `Cannot approve a transaction with status ${txn.status}.` };
  }
  const monthError = await assertMonthOpen(txn.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id },
      data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
    });
    await writeAuditLog(tx, {
      entityType: "Transaction",
      entityId: id,
      transactionId: id,
      action: "APPROVE",
      performedById: user.id,
      beforeSnapshot: { status: txn.status },
      afterSnapshot: { status: updated.status },
    });
    await postClientLedgerForTransaction(tx, {
      transactionId: id,
      clientId: txn.clientId,
      amount: txn.clientNetPayable ?? "0",
      entryDate: txn.transactionDate,
      accountingMonth: txn.accountingMonth,
      createdById: user.id,
    });
  });

  revalidatePath("/transactions");
  return { ok: true };
}

export async function rejectTransaction(id: string, reason: string): Promise<ReviewResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  if (!reason.trim()) return { ok: false, error: "A reason is required." };
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (!txn) return { ok: false, error: "Transaction not found." };
  if (txn.status !== "SUBMITTED" && txn.status !== "DETAILS_REQUESTED") {
    return { ok: false, error: `Cannot reject a transaction with status ${txn.status}.` };
  }
  const monthError = await assertMonthOpen(txn.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id },
      data: { status: "REJECTED", reviewNotes: reason },
    });
    await writeAuditLog(tx, {
      entityType: "Transaction",
      entityId: id,
      transactionId: id,
      action: "REJECT",
      performedById: user.id,
      beforeSnapshot: { status: txn.status },
      afterSnapshot: { status: updated.status },
      notes: reason,
    });
  });

  revalidatePath("/transactions");
  return { ok: true };
}

// Manual, per-transaction settlement marker. Independent of the SettlementBatch
// flow (settlements/actions.ts) -- that's a heavier, formal bank-deposit
// reconciliation path that sets status to CLIENT_PAYABLE. This is a lightweight
// "I know this settled on date X" marker for transactions not going through a
// batch. Does not touch ClientLedger: payout eligibility is governed separately
// by PAYABLE_TRANSACTION_STATUSES, which already includes APPROVED, so marking
// settled here is for visibility/reporting, not to unlock anything.
export async function markTransactionSettled(
  id: string,
  settlementDate: string
): Promise<ReviewResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const date = new Date(settlementDate);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid settlement date." };
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (!txn) return { ok: false, error: "Transaction not found." };
  if (txn.status !== "APPROVED") {
    return { ok: false, error: `Cannot mark settled a transaction with status ${txn.status}.` };
  }
  const monthError = await assertMonthOpen(txn.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id },
      data: { status: "SETTLED", settlementDate: date },
    });
    await writeAuditLog(tx, {
      entityType: "Transaction",
      entityId: id,
      transactionId: id,
      action: "MARK_SETTLED",
      performedById: user.id,
      beforeSnapshot: { status: txn.status },
      afterSnapshot: { status: updated.status, settlementDate: updated.settlementDate },
    });
  });

  revalidatePath("/transactions");
  return { ok: true };
}

export type BulkSettleResult = { ok: true; count: number } | { ok: false; error: string };

export async function markAllSettled(input: {
  merchantId: string | null;
  day: string | null;
  settlementDate: string;
}): Promise<BulkSettleResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  if (!input.merchantId && !input.day) {
    return { ok: false, error: "Choose a merchant and/or a day to bulk-settle." };
  }
  const date = new Date(input.settlementDate);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid settlement date." };

  const where: Prisma.TransactionWhereInput = { status: "APPROVED" };
  if (input.merchantId) where.merchantId = input.merchantId;
  if (input.day) {
    const dayStart = new Date(`${input.day}T00:00:00.000Z`);
    if (Number.isNaN(dayStart.getTime())) return { ok: false, error: "Invalid day." };
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    where.transactionDate = { gte: dayStart, lt: dayEnd };
  }

  const transactions = await prisma.transaction.findMany({ where });
  if (transactions.length === 0) {
    return { ok: false, error: "No approved transactions match that filter." };
  }

  const monthsToCheck = Array.from(new Set(transactions.map((t) => t.accountingMonth)));
  for (const month of monthsToCheck) {
    const monthError = await assertMonthOpen(month);
    if (monthError) return { ok: false, error: monthError };
  }

  await prisma.$transaction(async (tx) => {
    for (const txn of transactions) {
      const updated = await tx.transaction.update({
        where: { id: txn.id },
        data: { status: "SETTLED", settlementDate: date },
      });
      await writeAuditLog(tx, {
        entityType: "Transaction",
        entityId: txn.id,
        transactionId: txn.id,
        action: "MARK_SETTLED",
        performedById: user.id,
        beforeSnapshot: { status: txn.status },
        afterSnapshot: { status: updated.status, settlementDate: updated.settlementDate },
        notes: "Bulk mark all settled",
      });
    }
  });

  revalidatePath("/transactions");
  return { ok: true, count: transactions.length };
}

export async function requestTransactionDetails(id: string, note: string): Promise<ReviewResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  if (!note.trim()) return { ok: false, error: "A note is required." };
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (!txn) return { ok: false, error: "Transaction not found." };
  if (txn.status !== "SUBMITTED") {
    return { ok: false, error: `Cannot request details on a transaction with status ${txn.status}.` };
  }
  const monthError = await assertMonthOpen(txn.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id },
      data: { status: "DETAILS_REQUESTED", reviewNotes: note },
    });
    await writeAuditLog(tx, {
      entityType: "Transaction",
      entityId: id,
      transactionId: id,
      action: "REQUEST_DETAILS",
      performedById: user.id,
      beforeSnapshot: { status: txn.status },
      afterSnapshot: { status: updated.status },
      notes: note,
    });
  });

  revalidatePath("/transactions");
  return { ok: true };
}

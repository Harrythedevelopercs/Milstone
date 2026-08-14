"use server";

import { revalidatePath } from "next/cache";
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

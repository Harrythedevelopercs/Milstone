"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { postBankLedgerEntry } from "@/lib/ledger/post-bank-ledger";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import type { ActionResult } from "@/lib/action-result";
import { settlementBatchSchema } from "./schema";

export async function createSettlementBatch(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = settlementBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const merchant = await prisma.merchant.findUnique({ where: { id: d.merchantId } });
  if (!merchant || !merchant.active) return { ok: false, error: "Merchant not found or inactive." };

  // Silent, server-enforced: a batch always deposits into the merchant's
  // configured settlement bank, never a client-submitted one.
  const [bankAccount, transactions] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { id: merchant.settlementBankId } }),
    prisma.transaction.findMany({
      where: { id: { in: d.transactionIds } },
      select: { id: true, merchantId: true, status: true, settlementBatchId: true, expectedSettlement: true },
    }),
  ]);

  if (!bankAccount || !bankAccount.active) {
    return { ok: false, error: `${merchant.name}'s configured settlement bank is not found or inactive.` };
  }
  if (transactions.length !== d.transactionIds.length) {
    return { ok: false, error: "One or more selected transactions could not be found." };
  }
  const invalid = transactions.find(
    (t) => t.merchantId !== d.merchantId || t.status !== "APPROVED" || t.settlementBatchId !== null
  );
  if (invalid) {
    return {
      ok: false,
      error: `Transaction ${invalid.id} is not an unsettled, approved transaction for this merchant.`,
    };
  }

  const depositDate = new Date(d.depositDate);
  if (Number.isNaN(depositDate.getTime())) return { ok: false, error: "Invalid deposit date." };
  const accountingMonth = accountingMonthOf(depositDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const expectedAmount = transactions.reduce(
    (sum, t) => sum.plus(t.expectedSettlement),
    new Decimal(0)
  );
  const differenceAmount = new Decimal(d.depositAmount).minus(expectedAmount);

  await prisma.$transaction(async (tx) => {
    const batch = await tx.settlementBatch.create({
      data: {
        merchantId: d.merchantId,
        bankAccountId: merchant.settlementBankId,
        depositDate,
        accountingMonth,
        depositAmount: d.depositAmount,
        expectedAmount: expectedAmount.toFixed(2),
        differenceAmount: differenceAmount.toFixed(2),
        status: differenceAmount.isZero() ? "RECONCILED" : "DIFFERENCE",
        notes: d.notes || null,
        createdById: user.id,
      },
    });

    await tx.transaction.updateMany({
      where: { id: { in: d.transactionIds } },
      data: { settlementBatchId: batch.id, status: "CLIENT_PAYABLE" },
    });

    await postBankLedgerEntry(tx, {
      bankAccountId: merchant.settlementBankId,
      amount: d.depositAmount,
      entryDate: depositDate,
      accountingMonth,
      sourceType: "SETTLEMENT_BATCH",
      sourceId: batch.id,
      description: `Settlement deposit from ${merchant.name}`,
      createdById: user.id,
    });

    await writeAuditLog(tx, {
      entityType: "SettlementBatch",
      entityId: batch.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(batch)),
    });
  });

  revalidatePath("/settlements");
  revalidatePath("/transactions");
  revalidatePath("/transactions/received");
  return { ok: true };
}

// Transactions still exactly CLIENT_PAYABLE and pointing at this batch are
// safe to move -- nothing else has touched them since batching. Anything
// else (paid, refunded, charged back, manually edited since) is left
// alone; the caller decides whether that's a hard block or just excluded.
async function findUntouchedBatchTransactionIds(
  tx: Prisma.TransactionClient,
  batchId: string
): Promise<{ untouchedIds: string[]; touched: { id: string; status: string }[] }> {
  const current = await tx.transaction.findMany({
    where: { settlementBatchId: batchId },
    select: { id: true, status: true },
  });
  const untouchedIds = current.filter((t) => t.status === "CLIENT_PAYABLE").map((t) => t.id);
  const touched = current.filter((t) => t.status !== "CLIENT_PAYABLE");
  return { untouchedIds, touched };
}

export async function updateSettlementBatch(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = settlementBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const existing = await prisma.settlementBatch.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Settlement batch not found." };

  const monthError = await assertMonthOpen(existing.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const depositDate = new Date(d.depositDate);
  if (Number.isNaN(depositDate.getTime())) return { ok: false, error: "Invalid deposit date." };
  const accountingMonth = accountingMonthOf(depositDate);
  if (accountingMonth !== existing.accountingMonth) {
    const newMonthError = await assertMonthOpen(accountingMonth);
    if (newMonthError) return { ok: false, error: newMonthError };
  }

  // Silent, server-enforced: merchant is locked on edit, and the batch
  // always deposits into that merchant's configured settlement bank.
  const merchant = await prisma.merchant.findUnique({ where: { id: existing.merchantId } });
  if (!merchant || !merchant.active) return { ok: false, error: "Merchant not found or inactive." };
  const effectiveBankId = merchant.settlementBankId;
  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: effectiveBankId } });
  if (!bankAccount || !bankAccount.active) {
    return { ok: false, error: `${merchant.name}'s configured settlement bank is not found or inactive.` };
  }

  const result = await prisma.$transaction(async (tx) => {
    const { untouchedIds, touched } = await findUntouchedBatchTransactionIds(tx, id);
    const currentIds = new Set([...untouchedIds, ...touched.map((t) => t.id)]);
    const requestedIds = new Set(d.transactionIds);

    // Can't remove a transaction that's moved on since batching.
    const wouldRemoveTouched = touched.filter((t) => !requestedIds.has(t.id));
    if (wouldRemoveTouched.length > 0) {
      throw new Error(
        `Cannot remove ${wouldRemoveTouched.map((t) => t.id).join(", ")} -- already ${wouldRemoveTouched[0].status.toLowerCase()} since this batch was created.`
      );
    }

    const toAdd = d.transactionIds.filter((tid) => !currentIds.has(tid));
    const toRemove = untouchedIds.filter((tid) => !requestedIds.has(tid));

    if (toAdd.length > 0) {
      const addCandidates = await tx.transaction.findMany({
        where: { id: { in: toAdd } },
        select: { id: true, merchantId: true, status: true, settlementBatchId: true },
      });
      if (addCandidates.length !== toAdd.length) {
        throw new Error("One or more added transactions could not be found.");
      }
      const invalid = addCandidates.find(
        (t) => t.merchantId !== existing.merchantId || t.status !== "APPROVED" || t.settlementBatchId !== null
      );
      if (invalid) {
        throw new Error(`Transaction ${invalid.id} is not an unsettled, approved transaction for this merchant.`);
      }
      await tx.transaction.updateMany({
        where: { id: { in: toAdd } },
        data: { settlementBatchId: id, status: "CLIENT_PAYABLE" },
      });
    }

    if (toRemove.length > 0) {
      await tx.transaction.updateMany({
        where: { id: { in: toRemove } },
        data: { settlementBatchId: null, status: "APPROVED" },
      });
    }

    const finalTxns = await tx.transaction.findMany({
      where: { settlementBatchId: id },
      select: { expectedSettlement: true },
    });
    const expectedAmount = finalTxns.reduce(
      (sum, t) => sum.plus(t.expectedSettlement),
      new Decimal(0)
    );
    const differenceAmount = new Decimal(d.depositAmount).minus(expectedAmount);

    const updated = await tx.settlementBatch.update({
      where: { id },
      data: {
        bankAccountId: effectiveBankId,
        depositDate,
        accountingMonth,
        depositAmount: d.depositAmount,
        expectedAmount: expectedAmount.toFixed(2),
        differenceAmount: differenceAmount.toFixed(2),
        status: differenceAmount.isZero() ? "RECONCILED" : "DIFFERENCE",
        notes: d.notes || null,
      },
    });

    // Bank Ledger is a shared, multi-source running balance -- never
    // rewrite the existing row. Reverse it and post a fresh one whenever
    // the amount, bank, or month actually changed.
    const ledgerRelevantChange =
      !new Decimal(existing.depositAmount).equals(d.depositAmount) ||
      existing.bankAccountId !== effectiveBankId ||
      existing.accountingMonth !== accountingMonth;
    if (ledgerRelevantChange) {
      await postBankLedgerEntry(tx, {
        bankAccountId: existing.bankAccountId,
        amount: new Decimal(existing.depositAmount).negated().toFixed(2),
        entryDate: existing.depositDate,
        accountingMonth: existing.accountingMonth,
        sourceType: "SETTLEMENT_BATCH",
        sourceId: id,
        description: `Correction: edit to settlement batch ${id} (reversing prior deposit)`,
        createdById: user.id,
      });
      await postBankLedgerEntry(tx, {
        bankAccountId: effectiveBankId,
        amount: d.depositAmount,
        entryDate: depositDate,
        accountingMonth,
        sourceType: "SETTLEMENT_BATCH",
        sourceId: id,
        description: `Correction: edit to settlement batch ${id} (new deposit)`,
        createdById: user.id,
      });
    }

    await writeAuditLog(tx, {
      entityType: "SettlementBatch",
      entityId: id,
      action: "UPDATE",
      performedById: user.id,
      beforeSnapshot: { ...JSON.parse(JSON.stringify(existing)), transactionIds: Array.from(currentIds) },
      afterSnapshot: { ...JSON.parse(JSON.stringify(updated)), transactionIds: d.transactionIds },
    });

    return updated;
  }).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Failed to update settlement batch." }));

  if ("error" in result) return { ok: false, error: result.error };

  revalidatePath("/settlements");
  revalidatePath("/transactions");
  revalidatePath("/transactions/received");
  revalidatePath("/merchant-reconciliation");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteSettlementBatch(id: string): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");

  const existing = await prisma.settlementBatch.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Settlement batch not found." };

  const monthError = await assertMonthOpen(existing.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const result = await prisma.$transaction(async (tx) => {
    const { untouchedIds, touched } = await findUntouchedBatchTransactionIds(tx, id);
    if (touched.length > 0) {
      throw new Error(
        `Cannot delete -- ${touched.map((t) => `${t.id} (${t.status.toLowerCase()})`).join(", ")} already moved on since this batch was created.`
      );
    }

    await tx.transaction.updateMany({
      where: { id: { in: untouchedIds } },
      data: { settlementBatchId: null, status: "APPROVED" },
    });

    await postBankLedgerEntry(tx, {
      bankAccountId: existing.bankAccountId,
      amount: new Decimal(existing.depositAmount).negated().toFixed(2),
      entryDate: existing.depositDate,
      accountingMonth: existing.accountingMonth,
      sourceType: "SETTLEMENT_BATCH",
      sourceId: id,
      description: `Reversal: settlement batch ${id} deleted`,
      createdById: user.id,
    });

    await writeAuditLog(tx, {
      entityType: "SettlementBatch",
      entityId: id,
      action: "DELETE",
      performedById: user.id,
      beforeSnapshot: { ...JSON.parse(JSON.stringify(existing)), transactionIds: untouchedIds },
    });

    await tx.settlementBatch.delete({ where: { id } });
  }).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Failed to delete settlement batch." }));

  if (result && "error" in result) return { ok: false, error: result.error };

  revalidatePath("/settlements");
  revalidatePath("/transactions");
  revalidatePath("/transactions/received");
  revalidatePath("/merchant-reconciliation");
  revalidatePath("/");
  return { ok: true };
}

"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
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

  const [merchant, bankAccount, transactions] = await Promise.all([
    prisma.merchant.findUnique({ where: { id: d.merchantId } }),
    prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } }),
    prisma.transaction.findMany({
      where: { id: { in: d.transactionIds } },
      select: { id: true, merchantId: true, status: true, settlementBatchId: true, expectedSettlement: true },
    }),
  ]);

  if (!merchant || !merchant.active) return { ok: false, error: "Merchant not found or inactive." };
  if (!bankAccount || !bankAccount.active) return { ok: false, error: "Bank account not found or inactive." };
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
        bankAccountId: d.bankAccountId,
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
      bankAccountId: d.bankAccountId,
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
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { createTransactionCore } from "@/lib/transactions/create-transaction-core";
import { postClientLedgerForTransaction } from "@/lib/transactions/post-ledger";
import { postBankLedgerEntry } from "@/lib/ledger/post-bank-ledger";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { lookupClientRate, lookupMerchantFeeRule } from "@/lib/transactions/rate-lookup";
import {
  calculateClientNetPayable,
  calculateExpectedSettlement,
  calculateFpFee,
  calculateMerchantFeeFromRule,
  calculatePercentAmount,
  money,
} from "@/lib/transactions/money-math";
import { assertMonthOpen } from "@/lib/month-close/guard";
import { transactionSchema, rcvSchema, fulfillChargebackSchema } from "./schema";
import { holdTransactionSchema } from "../reminders/schema";

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
    merchantId: d.merchantId || null,
    expectedBankId: d.expectedBankId,
    paymentMethodId: d.paymentMethodId,
    grossAmount: d.grossAmount,
    chargeType: d.chargeType,
    fixedChargeAmount: d.fixedChargeAmount || null,
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

// Full edit, by explicit decision: Owner/Accountant can change any business
// field on any status, as long as the transaction's month (and the new
// month, if the date edit moves it) is still open -- month-close is the
// only gate. Unlike every other posting in this app, this ACTUALLY mutates
// the transaction row in place (id/createdBy/createdAt/audit history stay
// locked). To keep the append-only ledger honest anyway, we never rewrite
// an existing ClientLedger row: if clientNetPayable or the client changes
// after the transaction was ever approved, we reverse the old posting and
// post a fresh one for the new state -- same pattern as every other
// correction in this app (Refund/Chargeback/Void, Adjustment).
export async function updateTransaction(id: string, input: unknown): Promise<CreateTransactionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Transaction not found." };

  const monthError = await assertMonthOpen(existing.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const transactionDate = new Date(d.transactionDate);
  if (Number.isNaN(transactionDate.getTime())) return { ok: false, error: "Invalid transaction date." };
  const accountingMonth = accountingMonthOf(transactionDate);
  if (accountingMonth !== existing.accountingMonth) {
    const newMonthError = await assertMonthOpen(accountingMonth);
    if (newMonthError) return { ok: false, error: newMonthError };
  }

  const [client, paymentMethod, merchant] = await Promise.all([
    prisma.client.findUnique({ where: { id: d.clientId } }),
    prisma.paymentMethod.findUnique({ where: { id: d.paymentMethodId } }),
    d.merchantId
      ? prisma.merchant.findUnique({
          where: { id: d.merchantId },
          include: { company: { select: { employeePartnerId: true } } },
        })
      : null,
  ]);
  if (!client || client.status !== "ACTIVE") return { ok: false, error: "Client not found or inactive." };
  if (!paymentMethod || paymentMethod.status !== "ACTIVE") {
    return { ok: false, error: "Payment method not found or inactive." };
  }
  const isDirect = !paymentMethod.requiresMerchant;
  const wasDirect = existing.merchantId === null;
  if (isDirect && d.merchantId) {
    return { ok: false, error: `${paymentMethod.name} is a direct-to-bank method and cannot have a merchant.` };
  }
  if (!isDirect && !d.merchantId) {
    return { ok: false, error: `${paymentMethod.name} requires a merchant.` };
  }
  if (!isDirect && (!merchant || !merchant.active)) {
    return { ok: false, error: "Merchant not found or inactive." };
  }
  // A batched transaction is tied to a merchant deposit reconciliation --
  // can't detach it into a direct-to-bank payment via edit.
  if (isDirect && existing.settlementBatchId) {
    return { ok: false, error: "Cannot switch to a direct-to-bank method: this transaction is part of a settlement batch." };
  }
  // Silent, server-enforced: a merchant transaction always settles into that
  // merchant's configured bank, never a client-submitted one.
  const effectiveBankId = isDirect ? d.expectedBankId : merchant!.settlementBankId;
  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: effectiveBankId } });
  if (!bankAccount || !bankAccount.active) {
    return {
      ok: false,
      error: isDirect
        ? "Bank account not found or inactive."
        : `${merchant!.name}'s configured settlement bank is not found or inactive.`,
    };
  }

  const rate = await lookupClientRate(d.clientId, d.paymentMethodId, transactionDate);
  if (!rate) {
    return {
      ok: false,
      error: "No rate is set up for this client and payment method as of this date.",
    };
  }

  const gross = d.grossAmount;
  const feeRule = isDirect || !merchant ? null : await lookupMerchantFeeRule(merchant.id, d.paymentMethodId);
  const merchantFeeDefault = isDirect
    ? calculateMerchantFeeFromRule(0, 0, 0)
    : feeRule
      ? calculateMerchantFeeFromRule(gross, feeRule.feePercent, feeRule.flatFee)
      : calculateMerchantFeeFromRule(gross, 0, 0);
  const merchantFeeManualProvided =
    !isDirect && d.merchantFeeManual !== null && d.merchantFeeManual !== "" && d.merchantFeeManual !== undefined;
  const merchantFee = isDirect ? "0" : merchantFeeManualProvided ? d.merchantFeeManual! : merchantFeeDefault;
  const merchantFeeSource: "MANUAL" | "RULE_DEFAULT" = merchantFeeManualProvided ? "MANUAL" : "RULE_DEFAULT";
  const merchantReservePercent = isDirect ? "0" : d.merchantReservePercent;

  const fpFee = calculateFpFee(
    gross,
    merchantFee,
    rate.ratePercent,
    rate.feeBasis,
    d.chargeType,
    d.fixedChargeAmount
  );
  const merchantReserveAmount = calculatePercentAmount(gross, merchantReservePercent);
  const fpReserveAmount = calculatePercentAmount(gross, d.fpReservePercent);
  const expectedSettlement = calculateExpectedSettlement(gross, merchantFee, merchantReserveAmount);
  const clientNetPayable = calculateClientNetPayable({
    gross,
    merchantFee,
    merchantReserveAmount,
    fpFee,
    fpReserveAmount,
    feeBearer: d.feeBearer,
  });

  const oldClientNetPayable = new Decimal(existing.clientNetPayable ?? 0);
  const newClientNetPayable = new Decimal(clientNetPayable);
  const clientChanged = existing.clientId !== d.clientId;
  const amountChanged = !oldClientNetPayable.equals(newClientNetPayable);

  // A direct payment settles the instant it's approved -- if this edit
  // makes an already-approved-or-later transaction direct for the first
  // time, promote it the same way createTransactionCore/approveTransaction
  // do. Going the other way (direct -> merchant-based), drop back to
  // Approved since it now genuinely needs a real settlement step.
  const statusForDirectSwitch =
    !wasDirect && isDirect && existing.status === "APPROVED" ? "SETTLED" : null;
  const statusForMerchantSwitch = wasDirect && !isDirect && existing.status === "SETTLED" ? "APPROVED" : null;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.transaction.update({
      where: { id },
      data: {
        transactionDate,
        accountingMonth,
        clientId: d.clientId,
        clientReference: d.clientReference || null,
        companyId: isDirect ? bankAccount.companyId : merchant!.companyId,
        merchantId: d.merchantId || null,
        expectedBankId: effectiveBankId,
        employeePartnerId: isDirect ? null : merchant!.company.employeePartnerId,
        businessUnitId: isDirect ? null : merchant!.businessUnitId,
        paymentMethodId: d.paymentMethodId,
        grossAmount: gross,
        fpRatePercent: rate.ratePercent,
        feeBasis: rate.feeBasis,
        fpFee: money(fpFee),
        chargeType: d.chargeType,
        fixedChargeAmount: d.chargeType === "FIXED" ? money(d.fixedChargeAmount || 0) : null,
        merchantFeeManual: merchantFeeManualProvided ? d.merchantFeeManual! : null,
        merchantFeeDefault: money(merchantFeeDefault),
        merchantFee: money(merchantFee),
        merchantFeeSource,
        feeBearer: d.feeBearer,
        merchantReservePercent,
        merchantReserveAmount: money(merchantReserveAmount),
        fpReservePercent: d.fpReservePercent,
        fpReserveAmount: money(fpReserveAmount),
        expectedSettlement: money(expectedSettlement),
        clientNetPayable: money(clientNetPayable),
        documentUrl: d.documentUrl || null,
        notes: d.notes || null,
        customerEmail: d.customerEmail || null,
        cardLast4: d.cardLast4 || null,
        updatedById: user.id,
        ...(statusForDirectSwitch
          ? { status: statusForDirectSwitch, settlementDate: transactionDate }
          : {}),
        ...(statusForMerchantSwitch ? { status: statusForMerchantSwitch, settlementDate: null } : {}),
      },
    });

    // Bank Ledger correction for a transaction that's settled outside a
    // batch -- either a direct-to-bank receipt, or a merchant transaction
    // manually marked Settled. Only relevant once a real per-transaction
    // BankLedger entry actually exists. Never rewrite that row -- reverse it
    // and post a fresh one, same append-only pattern as Client Ledger below.
    // Skipped entirely if this transaction was already refunded/charged
    // back/voided (its bank effect, if any, was already reversed there).
    const bankLedgerEntry = await tx.bankLedger.findFirst({
      where: { sourceType: "TRANSACTION", sourceId: id },
    });
    const alreadyReversedElsewhere = (["VOID", "REFUNDED", "CHARGEBACK"] as string[]).includes(existing.status);
    const oldSettleAmount = wasDirect
      ? new Decimal(existing.grossAmount)
      : new Decimal(existing.expectedSettlement ?? 0);
    const newSettleAmount = isDirect ? new Decimal(gross) : new Decimal(expectedSettlement);
    const stillSettledSameKind =
      (wasDirect && isDirect) || (!wasDirect && !isDirect && existing.status === "SETTLED");

    if (bankLedgerEntry && !alreadyReversedElsewhere && stillSettledSameKind) {
      if (!oldSettleAmount.equals(newSettleAmount) || existing.expectedBankId !== effectiveBankId) {
        await postBankLedgerEntry(tx, {
          bankAccountId: existing.expectedBankId,
          amount: oldSettleAmount.negated().toFixed(2),
          entryDate: existing.transactionDate,
          accountingMonth: existing.accountingMonth,
          sourceType: "TRANSACTION",
          sourceId: id,
          description: `Correction: edit to ${id} (reversing prior settlement)`,
          createdById: user.id,
        });
        await postBankLedgerEntry(tx, {
          bankAccountId: effectiveBankId,
          amount: newSettleAmount.toFixed(2),
          entryDate: transactionDate,
          accountingMonth,
          sourceType: "TRANSACTION",
          sourceId: id,
          description: `Correction: edit to ${id} (new settlement)`,
          createdById: user.id,
        });
      }
    } else if (bankLedgerEntry && !alreadyReversedElsewhere && wasDirect && !isDirect) {
      // No longer a direct receipt -- the cash was never really "already in
      // the bank" the way this transaction now claims, so reverse it.
      await postBankLedgerEntry(tx, {
        bankAccountId: existing.expectedBankId,
        amount: oldSettleAmount.negated().toFixed(2),
        entryDate: existing.transactionDate,
        accountingMonth: existing.accountingMonth,
        sourceType: "TRANSACTION",
        sourceId: id,
        description: `Correction: edit to ${id} (no longer direct-to-bank)`,
        createdById: user.id,
      });
    } else if (!bankLedgerEntry && statusForDirectSwitch === "SETTLED") {
      // Newly direct and was just promoted straight to Settled -- post the
      // deposit for the first time, same as createTransactionCore.
      await postBankLedgerEntry(tx, {
        bankAccountId: effectiveBankId,
        amount: money(gross),
        entryDate: transactionDate,
        accountingMonth,
        sourceType: "TRANSACTION",
        sourceId: id,
        description: `Direct ${paymentMethod.name} received from ${client.name}`,
        createdById: user.id,
      });
    }

    // Only correct the ledger if this transaction ever actually posted
    // (i.e. was approved at some point) and either the amount or the
    // client changed. A transaction still sitting pre-approval has no
    // ledger footprint to correct.
    const hadLedgerEntry = await tx.clientLedger.findFirst({
      where: { transactionId: id, sourceType: "TRANSACTION" },
    });
    if (hadLedgerEntry && (amountChanged || clientChanged)) {
      if (!oldClientNetPayable.isZero()) {
        await tx.clientLedger.create({
          data: {
            clientId: existing.clientId,
            entryDate: transactionDate,
            accountingMonth,
            amount: oldClientNetPayable.negated().toFixed(2),
            sourceType: "TRANSACTION",
            sourceId: id,
            transactionId: id,
            description: `Correction: edit to ${id} (reversing prior amount)`,
            createdById: user.id,
          },
        });
      }
      await tx.clientLedger.create({
        data: {
          clientId: d.clientId,
          entryDate: transactionDate,
          accountingMonth,
          amount: newClientNetPayable.toFixed(2),
          sourceType: "TRANSACTION",
          sourceId: id,
          transactionId: id,
          description: `Correction: edit to ${id} (new amount)`,
          createdById: user.id,
        },
      });
    }

    // A settlement batch's expected/difference amount was computed once at
    // batch-creation time from this transaction's expectedSettlement --
    // recompute it so it doesn't go silently stale.
    if (existing.settlementBatchId) {
      const batchTxns = await tx.transaction.findMany({
        where: { settlementBatchId: existing.settlementBatchId },
        select: { expectedSettlement: true },
      });
      const newExpectedAmount = batchTxns.reduce(
        (sum, t) => sum.plus(t.expectedSettlement),
        new Decimal(0)
      );
      const batch = await tx.settlementBatch.findUnique({ where: { id: existing.settlementBatchId } });
      if (batch) {
        await tx.settlementBatch.update({
          where: { id: batch.id },
          data: {
            expectedAmount: newExpectedAmount.toFixed(2),
            differenceAmount: new Decimal(batch.depositAmount).minus(newExpectedAmount).toFixed(2),
          },
        });
      }
    }

    await writeAuditLog(tx, {
      entityType: "Transaction",
      entityId: id,
      transactionId: id,
      action: "UPDATE",
      performedById: user.id,
      beforeSnapshot: JSON.parse(JSON.stringify(existing)),
      afterSnapshot: JSON.parse(JSON.stringify(row)),
    });

    return row;
  });

  revalidatePath("/transactions");
  revalidatePath("/client-ledger");
  revalidatePath("/settlements");
  revalidatePath("/payouts");
  revalidatePath("/refunds-chargebacks-voids");
  revalidatePath("/");
  return { ok: true, id: updated.id };
}

export type ReviewResult = { ok: true } | { ok: false; error: string };

export async function approveTransaction(id: string): Promise<ReviewResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const txn = await prisma.transaction.findUnique({
    where: { id },
    include: { client: { select: { name: true } }, paymentMethod: { select: { name: true } } },
  });
  if (!txn) return { ok: false, error: "Transaction not found." };
  if (txn.status !== "SUBMITTED" && txn.status !== "DETAILS_REQUESTED") {
    return { ok: false, error: `Cannot approve a transaction with status ${txn.status}.` };
  }
  const monthError = await assertMonthOpen(txn.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  // Direct-to-bank transactions (no merchant) have their cash already in the
  // bank the moment they're approved -- same reasoning as createTransactionCore.
  const isDirect = txn.merchantId === null;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id },
      data: {
        status: isDirect ? "SETTLED" : "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        settlementDate: isDirect ? txn.transactionDate : undefined,
      },
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

    if (isDirect) {
      await postBankLedgerEntry(tx, {
        bankAccountId: txn.expectedBankId,
        amount: txn.grossAmount,
        entryDate: txn.transactionDate,
        accountingMonth: txn.accountingMonth,
        sourceType: "TRANSACTION",
        sourceId: id,
        description: `Direct ${txn.paymentMethod.name} received from ${txn.client.name}`,
        createdById: user.id,
      });
    }
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
  const txn = await prisma.transaction.findUnique({
    where: { id },
    include: { merchant: { select: { name: true } } },
  });
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
    // The merchant's own net proceeds land in the bank the moment we
    // consider this settled -- same figure the settlement-batch flow uses
    // (expectedSettlement = gross - merchantFee - merchantReserve). FP's fee
    // was never part of this number, so it's untouched by this posting.
    await postBankLedgerEntry(tx, {
      bankAccountId: txn.expectedBankId,
      amount: txn.expectedSettlement,
      entryDate: date,
      accountingMonth: txn.accountingMonth,
      sourceType: "TRANSACTION",
      sourceId: id,
      description: `Settled ${txn.merchant?.name ?? txn.id}`,
      createdById: user.id,
    });
  });

  revalidatePath("/transactions");
  revalidatePath("/master-data/banks");
  revalidatePath("/cash-position");
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

  const transactions = await prisma.transaction.findMany({
    where,
    include: { merchant: { select: { name: true } } },
  });
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
      await postBankLedgerEntry(tx, {
        bankAccountId: txn.expectedBankId,
        amount: txn.expectedSettlement,
        entryDate: date,
        accountingMonth: txn.accountingMonth,
        sourceType: "TRANSACTION",
        sourceId: txn.id,
        description: `Settled ${txn.merchant?.name ?? txn.id}`,
        createdById: user.id,
      });
    }
  });

  revalidatePath("/transactions");
  revalidatePath("/master-data/banks");
  revalidatePath("/cash-position");
  return { ok: true, count: transactions.length };
}

const HOLDABLE_STATUSES = ["APPROVED", "SETTLED", "CLIENT_PAYABLE", "PARTIALLY_PAID"] as const;

// Separate from Mark Settled -- for when a settlement everyone's expecting
// is running late. Puts the transaction on Hold and creates a Reminder that
// remembers the exact status to restore (previousStatus), so Release Hold
// is deterministic rather than guessed from the audit trail.
export async function holdTransaction(id: string, input: unknown): Promise<ReviewResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = holdTransactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (!txn) return { ok: false, error: "Transaction not found." };
  if (!(HOLDABLE_STATUSES as readonly string[]).includes(txn.status)) {
    return { ok: false, error: `Cannot hold a transaction with status ${txn.status}.` };
  }
  const monthError = await assertMonthOpen(txn.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const dueDate = new Date(d.expectedSettlementDate);
  if (Number.isNaN(dueDate.getTime())) return { ok: false, error: "Invalid expected settlement date." };

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({ where: { id }, data: { status: "HOLD" } });
    await tx.reminder.create({
      data: {
        type: "TRANSACTION",
        title: `Delayed settlement: ${id}`,
        note: d.note || null,
        dueDate,
        transactionId: id,
        previousStatus: txn.status,
        createdById: user.id,
      },
    });
    await writeAuditLog(tx, {
      entityType: "Transaction",
      entityId: id,
      transactionId: id,
      action: "HOLD",
      performedById: user.id,
      beforeSnapshot: { status: txn.status },
      afterSnapshot: { status: "HOLD", expectedSettlementDate: d.expectedSettlementDate },
    });
  });

  revalidatePath("/transactions");
  revalidatePath("/reminders");
  revalidatePath("/");
  return { ok: true };
}

export async function releaseHold(id: string): Promise<ReviewResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (!txn) return { ok: false, error: "Transaction not found." };
  if (txn.status !== "HOLD") return { ok: false, error: "This transaction is not on Hold." };

  const reminder = await prisma.reminder.findFirst({
    where: { transactionId: id, type: "TRANSACTION", previousStatus: { not: null }, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  if (!reminder || !reminder.previousStatus) {
    return { ok: false, error: "Could not find the hold record for this transaction -- cannot safely release." };
  }
  const monthError = await assertMonthOpen(txn.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({ where: { id }, data: { status: reminder.previousStatus! } });
    await tx.reminder.update({
      where: { id: reminder.id },
      data: { status: "DONE", completedAt: new Date() },
    });
    await writeAuditLog(tx, {
      entityType: "Transaction",
      entityId: id,
      transactionId: id,
      action: "RELEASE_HOLD",
      performedById: user.id,
      beforeSnapshot: { status: "HOLD" },
      afterSnapshot: { status: reminder.previousStatus },
    });
  });

  revalidatePath("/transactions");
  revalidatePath("/reminders");
  revalidatePath("/");
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

// A transaction is not yet real (pre-approval) or has already been reversed
// once -- can't refund/chargeback/void twice.
const RCV_INELIGIBLE_STATUSES = [
  "ENTERED",
  "SUBMITTED",
  "DETAILS_REQUESTED",
  "REJECTED",
  "VOID",
  "REFUNDED",
  "CHARGEBACK",
] as const;

const RCV_TRANSACTION_STATUS = {
  REFUND: "REFUNDED",
  CHARGEBACK: "CHARGEBACK",
  VOID: "VOID",
} as const;

const RCV_AUDIT_ACTION = {
  REFUND: "REFUND",
  CHARGEBACK: "CHARGEBACK",
  VOID: "VOID",
} as const;

// Refund/Chargeback/Void: full-amount only, non-destructive. The original
// transaction's financial fields (gross, fpFee, clientNetPayable) are never
// touched -- only its status changes, so the original math stays visible
// alongside the new linked RefundChargebackVoid row. FP's fee stays counted
// as revenue for Refund/Chargeback (the client bears that cost -- brief
// section 5); Void is excluded from revenue entirely via
// REVENUE_RECOGNIZED_EXCLUDED_STATUSES since it never really happened.
export async function createRcv(input: unknown): Promise<ReviewResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = rcvSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const txn = await prisma.transaction.findUnique({
    where: { id: d.transactionId },
    include: { settlementBatch: { select: { bankAccountId: true } } },
  });
  if (!txn) return { ok: false, error: "Transaction not found." };
  if ((RCV_INELIGIBLE_STATUSES as readonly string[]).includes(txn.status)) {
    return { ok: false, error: `Cannot ${d.type.toLowerCase()} a transaction with status ${txn.status}.` };
  }
  if (txn.clientNetPayable === null) {
    return { ok: false, error: "Transaction has no computed client payable amount." };
  }
  // Did this transaction's money ever actually land in a bank? Either it
  // went through a settlement batch, or it was manually marked Settled (or,
  // for a direct-to-bank payment, settled automatically on approval) --
  // both set settlementDate. If neither happened, there's nothing to
  // reverse on the bank side; the client-ledger clawback below still applies
  // regardless (the client can owe money back even if it was never banked).
  const wasSettledToBank = txn.settlementBatchId !== null || txn.settlementDate !== null;
  const settleBankId = txn.settlementBatch?.bankAccountId ?? txn.expectedBankId;
  const isDirectTxn = txn.merchantId === null;
  const settleAmount = isDirectTxn
    ? new Decimal(txn.grossAmount)
    : new Decimal(txn.expectedSettlement ?? 0);

  const eventDate = new Date(d.eventDate);
  if (Number.isNaN(eventDate.getTime())) return { ok: false, error: "Invalid event date." };
  const accountingMonth = accountingMonthOf(eventDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const clawback = new Decimal(txn.clientNetPayable).negated();
  const newStatus = RCV_TRANSACTION_STATUS[d.type];
  const typeLabel = d.type.charAt(0) + d.type.slice(1).toLowerCase();

  await prisma.$transaction(async (tx) => {
    const rcv = await tx.refundChargebackVoid.create({
      data: {
        type: d.type,
        originalTransactionId: txn.id,
        accountingMonth,
        eventDate,
        amount: txn.grossAmount,
        reasonCode: d.reasonCode || null,
        status: "OPEN",
        notes: d.notes || null,
        createdById: user.id,
      },
    });

    await tx.clientLedger.create({
      data: {
        clientId: txn.clientId,
        entryDate: eventDate,
        accountingMonth,
        amount: clawback.toFixed(2),
        sourceType: "RCV",
        sourceId: rcv.id,
        transactionId: txn.id,
        description: `${typeLabel} of ${txn.id}`,
        createdById: user.id,
      },
    });

    const updated = await tx.transaction.update({
      where: { id: txn.id },
      data: { status: newStatus },
    });

    // Mirror-image of the settle-in credit: whatever landed in the bank for
    // this transaction comes back out of the same bank, for the same
    // amount. That amount never included FP's fee (expectedSettlement is
    // gross - merchantFee - merchantReserve, computed before fpFee even
    // enters the picture), so FP's revenue and the 10% EP commission --
    // both driven off fpFee elsewhere -- are structurally untouched by this.
    if (wasSettledToBank) {
      await postBankLedgerEntry(tx, {
        bankAccountId: settleBankId,
        amount: settleAmount.negated().toFixed(2),
        entryDate: eventDate,
        accountingMonth,
        sourceType: "RCV",
        sourceId: rcv.id,
        description: `${typeLabel} reversal of ${txn.id}`,
        createdById: user.id,
      });
    }

    await writeAuditLog(tx, {
      entityType: "RefundChargebackVoid",
      entityId: rcv.id,
      transactionId: txn.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(rcv)),
      notes: d.notes || undefined,
    });
    await writeAuditLog(tx, {
      entityType: "Transaction",
      entityId: txn.id,
      transactionId: txn.id,
      action: RCV_AUDIT_ACTION[d.type],
      performedById: user.id,
      beforeSnapshot: { status: txn.status },
      afterSnapshot: { status: updated.status },
    });
  });

  revalidatePath("/transactions");
  revalidatePath("/client-ledger");
  revalidatePath("/refunds-chargebacks-voids");
  revalidatePath("/master-data/banks");
  revalidatePath("/cash-position");
  revalidatePath("/");
  return { ok: true };
}

export type TransactionHistoryEntry = {
  id: string;
  action: string;
  performedByName: string;
  performedAt: string;
  notes: string | null;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
};

// The customer paid the disputed amount back to FoundaPay directly, outside
// the card network. This does NOT undo the chargeback (that stays on the
// books as the real event it was -- deleteRcv is for "this was recorded in
// error," not this) -- it posts a fresh, separate credit for the same
// amounts the chargeback originally reversed, mirrored: the client-ledger
// clawback comes back in full, and the settle amount lands back in
// whichever bank the accountant says it actually landed in (not necessarily
// the original settlement bank -- the customer may have paid a different
// way). The RCV row flips to RESOLVED, which is what drops it out of
// "Outstanding Chargebacks" everywhere; both the original chargeback and
// its fulfillment stay fully visible in history.
export async function fulfillChargeback(rcvId: string, input: unknown): Promise<ReviewResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = fulfillChargebackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const rcv = await prisma.refundChargebackVoid.findUnique({
    where: { id: rcvId },
    include: {
      originalTransaction: {
        include: { settlementBatch: { select: { bankAccountId: true } } },
      },
    },
  });
  if (!rcv) return { ok: false, error: "Entry not found." };
  if (rcv.type !== "CHARGEBACK") return { ok: false, error: "Only chargebacks can be marked fulfilled." };
  if (rcv.fulfilledAt) return { ok: false, error: "This chargeback is already marked fulfilled." };

  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: d.fulfillmentBankAccountId } });
  if (!bankAccount || !bankAccount.active) return { ok: false, error: "Bank account not found or inactive." };

  const fulfillDate = new Date(d.fulfillmentDate);
  if (Number.isNaN(fulfillDate.getTime())) return { ok: false, error: "Invalid date." };
  const accountingMonth = accountingMonthOf(fulfillDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const txn = rcv.originalTransaction;
  const wasSettledToBank = txn.settlementBatchId !== null || txn.settlementDate !== null;
  const isDirectTxn = txn.merchantId === null;
  const settleAmount = isDirectTxn ? new Decimal(txn.grossAmount) : new Decimal(txn.expectedSettlement ?? 0);
  const clientCredit = new Decimal(txn.clientNetPayable ?? 0);

  await prisma.$transaction(async (tx) => {
    if (!clientCredit.isZero()) {
      await tx.clientLedger.create({
        data: {
          clientId: txn.clientId,
          entryDate: fulfillDate,
          accountingMonth,
          amount: clientCredit.toFixed(2),
          sourceType: "RCV",
          sourceId: rcv.id,
          transactionId: txn.id,
          description: `Chargeback fulfilled by customer: ${txn.id}`,
          createdById: user.id,
        },
      });
    }

    if (wasSettledToBank) {
      await postBankLedgerEntry(tx, {
        bankAccountId: d.fulfillmentBankAccountId,
        amount: settleAmount.toFixed(2),
        entryDate: fulfillDate,
        accountingMonth,
        sourceType: "RCV",
        sourceId: rcv.id,
        description: `Chargeback fulfillment received for ${txn.id}`,
        createdById: user.id,
      });
    }

    const updated = await tx.refundChargebackVoid.update({
      where: { id: rcvId },
      data: {
        status: "RESOLVED",
        fulfilledAt: fulfillDate,
        fulfilledById: user.id,
        fulfillmentBankAccountId: d.fulfillmentBankAccountId,
        notes: d.notes ? `${rcv.notes ? rcv.notes + " | " : ""}Fulfilled: ${d.notes}` : rcv.notes,
      },
    });

    await writeAuditLog(tx, {
      entityType: "RefundChargebackVoid",
      entityId: rcvId,
      transactionId: txn.id,
      action: "FULFILL",
      performedById: user.id,
      beforeSnapshot: { status: rcv.status, fulfilledAt: null },
      afterSnapshot: JSON.parse(JSON.stringify(updated)),
    });
  });

  revalidatePath("/refunds-chargebacks-voids");
  revalidatePath("/client-ledger");
  revalidatePath("/master-data/banks");
  revalidatePath("/cash-position");
  revalidatePath("/");
  return { ok: true };
}

// Undoes a Refund/Chargeback/Void entirely: deletes the ledger entries it
// posted (both the client-ledger clawback and, if it reversed a settled
// bank entry, that too) and restores the transaction to whatever status it
// had right before -- read off the RCV action's own audit log entry rather
// than guessed, since that's the one place the "before" status was actually
// recorded.
export async function deleteRcv(rcvId: string): Promise<ReviewResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const rcv = await prisma.refundChargebackVoid.findUnique({ where: { id: rcvId } });
  if (!rcv) return { ok: false, error: "Entry not found." };
  const monthError = await assertMonthOpen(rcv.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const auditEntry = await prisma.auditLog.findFirst({
    where: {
      transactionId: rcv.originalTransactionId,
      action: { in: ["REFUND", "CHARGEBACK", "VOID"] },
    },
    orderBy: { performedAt: "desc" },
  });
  const beforeStatus = (auditEntry?.beforeSnapshot as { status?: string } | null)?.status;
  if (!auditEntry || !beforeStatus) {
    return { ok: false, error: "Could not determine the transaction's prior status -- cannot safely undo." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.clientLedger.deleteMany({ where: { sourceType: "RCV", sourceId: rcvId } });
    await tx.bankLedger.deleteMany({ where: { sourceType: "RCV", sourceId: rcvId } });
    await tx.transaction.update({
      where: { id: rcv.originalTransactionId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- read back from a stored audit snapshot, not a fixed literal
      data: { status: beforeStatus as any },
    });

    await writeAuditLog(tx, {
      entityType: "RefundChargebackVoid",
      entityId: rcvId,
      action: "DELETE",
      performedById: user.id,
      beforeSnapshot: JSON.parse(JSON.stringify(rcv)),
    });

    await tx.refundChargebackVoid.delete({ where: { id: rcvId } });
  });

  revalidatePath("/transactions");
  revalidatePath("/client-ledger");
  revalidatePath("/refunds-chargebacks-voids");
  revalidatePath("/master-data/banks");
  revalidatePath("/cash-position");
  revalidatePath("/");
  return { ok: true };
}

// Full delete: only for a transaction with no downstream financial
// footprint that can't be safely undone. Blocked if it's already been paid
// out (a real payout allocation references it -- that's historical fact,
// use Refund/Chargeback instead) or is inside a settlement batch (remove it
// from the batch first, same guard as batch delete already uses). Any
// Refund/Chargeback/Void against it is deleted too, reversing their ledger
// effects, so the whole linked set comes down together. FP revenue and the
// 10% commission both recompute automatically -- they're live sums over
// the transactions table, so removing this row removes its contribution
// with no special-casing (same reason Void needed none).
export async function deleteTransaction(id: string): Promise<ReviewResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const txn = await prisma.transaction.findUnique({ where: { id } });
  if (!txn) return { ok: false, error: "Transaction not found." };
  const monthError = await assertMonthOpen(txn.accountingMonth);
  if (monthError) return { ok: false, error: monthError };
  if (txn.settlementBatchId) {
    return {
      ok: false,
      error: "This transaction is part of a settlement batch -- remove it from the batch first.",
    };
  }

  const [payoutAllocationCount, childCount, derivedCount] = await Promise.all([
    prisma.clientPayoutAllocation.count({ where: { transactionId: id } }),
    prisma.transaction.count({ where: { parentId: id } }),
    prisma.transaction.count({ where: { originalTxnId: id } }),
  ]);
  if (payoutAllocationCount > 0) {
    return {
      ok: false,
      error: "This transaction has already been paid out to the client -- cannot delete. Use Refund/Chargeback instead.",
    };
  }
  if (childCount > 0 || derivedCount > 0) {
    return { ok: false, error: "This transaction has linked transactions and cannot be deleted." };
  }

  await prisma.$transaction(async (tx) => {
    const rcvRows = await tx.refundChargebackVoid.findMany({ where: { originalTransactionId: id } });
    for (const rcv of rcvRows) {
      await tx.clientLedger.deleteMany({ where: { sourceType: "RCV", sourceId: rcv.id } });
      await tx.bankLedger.deleteMany({ where: { sourceType: "RCV", sourceId: rcv.id } });
    }
    await tx.refundChargebackVoid.deleteMany({ where: { originalTransactionId: id } });
    await tx.clientLedger.deleteMany({ where: { transactionId: id } });
    await tx.bankLedger.deleteMany({ where: { sourceType: "TRANSACTION", sourceId: id } });
    await tx.merchantLedger.updateMany({ where: { transactionId: id }, data: { transactionId: null } });
    await tx.employeePartnerLedger.updateMany({ where: { transactionId: id }, data: { transactionId: null } });
    await tx.adjustment.updateMany({ where: { relatedTransactionId: id }, data: { relatedTransactionId: null } });
    await tx.reminder.deleteMany({ where: { transactionId: id } });
    // Detach (don't delete) prior audit history so it survives the row
    // being gone -- exactly what "log the deletion even though the row is
    // removed" requires: the content stays, only the strict per-transaction
    // FK link is cleared.
    await tx.auditLog.updateMany({ where: { transactionId: id }, data: { transactionId: null } });

    await writeAuditLog(tx, {
      entityType: "Transaction",
      entityId: id,
      action: "DELETE",
      performedById: user.id,
      beforeSnapshot: JSON.parse(JSON.stringify(txn)),
      notes: rcvRows.length > 0 ? `Also removed ${rcvRows.length} linked refund/chargeback/void entr${rcvRows.length === 1 ? "y" : "ies"}.` : undefined,
    });

    await tx.transaction.delete({ where: { id } });
  });

  revalidatePath("/transactions");
  revalidatePath("/client-ledger");
  revalidatePath("/refunds-chargebacks-voids");
  revalidatePath("/master-data/banks");
  revalidatePath("/cash-position");
  revalidatePath("/settlements");
  revalidatePath("/reminders");
  revalidatePath("/");
  return { ok: true };
}

export async function getTransactionHistory(transactionId: string): Promise<TransactionHistoryEntry[]> {
  await requireRole("OWNER", "ACCOUNTANT");
  const logs = await prisma.auditLog.findMany({
    where: { transactionId },
    orderBy: { performedAt: "desc" },
    include: { performedBy: { select: { name: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    performedByName: l.performedBy.name,
    performedAt: l.performedAt.toISOString(),
    notes: l.notes,
    beforeSnapshot: l.beforeSnapshot,
    afterSnapshot: l.afterSnapshot,
  }));
}

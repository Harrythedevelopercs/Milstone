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
import { transactionSchema, rcvSchema } from "./schema";

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

  const [client, paymentMethod, merchant, bankAccount] = await Promise.all([
    prisma.client.findUnique({ where: { id: d.clientId } }),
    prisma.paymentMethod.findUnique({ where: { id: d.paymentMethodId } }),
    d.merchantId
      ? prisma.merchant.findUnique({
          where: { id: d.merchantId },
          include: { company: { select: { employeePartnerId: true } } },
        })
      : null,
    prisma.bankAccount.findUnique({ where: { id: d.expectedBankId } }),
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
  if (!bankAccount || !bankAccount.active) return { ok: false, error: "Bank account not found or inactive." };
  // A batched transaction is tied to a merchant deposit reconciliation --
  // can't detach it into a direct-to-bank payment via edit.
  if (isDirect && existing.settlementBatchId) {
    return { ok: false, error: "Cannot switch to a direct-to-bank method: this transaction is part of a settlement batch." };
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

  const fpFee = calculateFpFee(gross, merchantFee, rate.ratePercent, rate.feeBasis);
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
        expectedBankId: d.expectedBankId,
        employeePartnerId: isDirect ? null : merchant!.company.employeePartnerId,
        businessUnitId: isDirect ? null : merchant!.businessUnitId,
        paymentMethodId: d.paymentMethodId,
        grossAmount: gross,
        fpRatePercent: rate.ratePercent,
        feeBasis: rate.feeBasis,
        fpFee: money(fpFee),
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

    // Bank Ledger correction for direct-to-bank transactions: only relevant
    // once the transaction has actually settled (a real BankLedger entry
    // exists for it). Never rewrite that row -- reverse it and post a fresh
    // one, same append-only pattern as the Client Ledger correction below.
    const bankLedgerEntry = await tx.bankLedger.findFirst({
      where: { sourceType: "TRANSACTION", sourceId: id },
    });
    if (bankLedgerEntry && wasDirect && isDirect) {
      const oldGross = new Decimal(existing.grossAmount);
      const newGross = new Decimal(gross);
      if (!oldGross.equals(newGross) || existing.expectedBankId !== d.expectedBankId) {
        await postBankLedgerEntry(tx, {
          bankAccountId: existing.expectedBankId,
          amount: oldGross.negated().toFixed(2),
          entryDate: existing.transactionDate,
          accountingMonth: existing.accountingMonth,
          sourceType: "TRANSACTION",
          sourceId: id,
          description: `Correction: edit to ${id} (reversing prior direct deposit)`,
          createdById: user.id,
        });
        await postBankLedgerEntry(tx, {
          bankAccountId: d.expectedBankId,
          amount: newGross.toFixed(2),
          entryDate: transactionDate,
          accountingMonth,
          sourceType: "TRANSACTION",
          sourceId: id,
          description: `Correction: edit to ${id} (new direct deposit)`,
          createdById: user.id,
        });
      }
    } else if (bankLedgerEntry && wasDirect && !isDirect) {
      // No longer a direct receipt -- the cash was never really "already in
      // the bank" the way this transaction now claims, so reverse it.
      await postBankLedgerEntry(tx, {
        bankAccountId: existing.expectedBankId,
        amount: new Decimal(existing.grossAmount).negated().toFixed(2),
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
        bankAccountId: d.expectedBankId,
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

  const txn = await prisma.transaction.findUnique({ where: { id: d.transactionId } });
  if (!txn) return { ok: false, error: "Transaction not found." };
  if ((RCV_INELIGIBLE_STATUSES as readonly string[]).includes(txn.status)) {
    return { ok: false, error: `Cannot ${d.type.toLowerCase()} a transaction with status ${txn.status}.` };
  }
  if (txn.clientNetPayable === null) {
    return { ok: false, error: "Transaction has no computed client payable amount." };
  }

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

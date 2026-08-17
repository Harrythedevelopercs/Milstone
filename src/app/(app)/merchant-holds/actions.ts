"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { postBankLedgerEntry } from "@/lib/ledger/post-bank-ledger";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import type { ActionResult } from "@/lib/action-result";

async function loadReserveHold(reserveHoldId: string) {
  const hold = await prisma.reserveHold.findUnique({
    where: { id: reserveHoldId },
    include: { actions: true },
  });
  if (!hold) return null;
  const used = hold.actions.reduce((sum, a) => sum.plus(a.amount), new Decimal(0));
  const remaining = new Decimal(hold.originalAmount).minus(used);
  return { hold, remaining };
}

function revalidateReserveViews(clientId?: string | null) {
  revalidatePath("/merchant-holds");
  revalidatePath("/statements/balance-sheet");
  revalidatePath("/statements/income-statement");
  revalidatePath("/cash-position");
  if (clientId) revalidatePath(`/client-ledger/${clientId}`);
}

// A reserve is a receivable, not cash -- releasing it moves it into an
// actual bank account. It never touches the client's ledger: the client's
// entitlement to it was already excluded from clientNetPayable at
// transaction time, so paying the client (if warranted) is a separate,
// ordinary Payout, outside this action's scope.
export async function releaseReserveHold(
  reserveHoldId: string,
  input: { amount: string; bankAccountId: string; notes: string }
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const found = await loadReserveHold(reserveHoldId);
  if (!found) return { ok: false, error: "Reserve hold not found." };
  const { hold, remaining } = found;

  const amount = new Decimal(input.amount || 0);
  if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) {
    return { ok: false, error: "Enter a positive amount." };
  }
  if (amount.greaterThan(remaining)) {
    return { ok: false, error: `Only ${remaining.toFixed(2)} remains on this reserve.` };
  }

  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: input.bankAccountId } });
  if (!bankAccount || !bankAccount.active) {
    return { ok: false, error: "Bank account not found or inactive." };
  }

  const actionDate = new Date();
  const accountingMonth = accountingMonthOf(actionDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    const action = await tx.reserveHoldAction.create({
      data: {
        reserveHoldId,
        type: "RELEASE",
        amount,
        actionDate,
        accountingMonth,
        bankAccountId: input.bankAccountId,
        notes: input.notes || null,
        performedById: user.id,
      },
    });
    await postBankLedgerEntry(tx, {
      bankAccountId: input.bankAccountId,
      amount: amount.toString(),
      entryDate: actionDate,
      accountingMonth,
      sourceType: "RESERVE",
      sourceId: action.id,
      description: `Reserve released -- ${hold.transactionId}${input.notes ? `: ${input.notes}` : ""}`,
      createdById: user.id,
    });
    await writeAuditLog(tx, {
      entityType: "ReserveHold",
      entityId: reserveHoldId,
      action: "UPDATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(action)),
      notes: `Released ${amount.toFixed(2)} into ${bankAccount.name}`,
    });
  });

  revalidateReserveViews();
  return { ok: true };
}

// Client-owned: the reserve was never counted as the client's to begin
// with (it was excluded from clientNetPayable), so offsetting a chargeback
// out of it credits the client back for the clawback that chargeback
// caused. FoundaPay-owned: it's FP absorbing its own chargeback exposure --
// no ledger effect, just closes out the hold against the loss.
export async function applyReserveToChargeback(
  reserveHoldId: string,
  input: { amount: string; rcvId: string; notes: string }
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const found = await loadReserveHold(reserveHoldId);
  if (!found) return { ok: false, error: "Reserve hold not found." };
  const { hold, remaining } = found;

  const amount = new Decimal(input.amount || 0);
  if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) {
    return { ok: false, error: "Enter a positive amount." };
  }
  if (amount.greaterThan(remaining)) {
    return { ok: false, error: `Only ${remaining.toFixed(2)} remains on this reserve.` };
  }

  const rcv = await prisma.refundChargebackVoid.findUnique({ where: { id: input.rcvId } });
  if (!rcv || rcv.type !== "CHARGEBACK" || rcv.originalTransactionId !== hold.transactionId) {
    return { ok: false, error: "Pick a chargeback that belongs to this reserve's transaction." };
  }

  const transaction = await prisma.transaction.findUnique({ where: { id: hold.transactionId } });
  if (!transaction) return { ok: false, error: "Transaction not found." };

  const actionDate = new Date();
  const accountingMonth = accountingMonthOf(actionDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    const action = await tx.reserveHoldAction.create({
      data: {
        reserveHoldId,
        type: "APPLY_TO_CHARGEBACK",
        amount,
        actionDate,
        accountingMonth,
        rcvId: input.rcvId,
        notes: input.notes || null,
        performedById: user.id,
      },
    });

    if (hold.owner === "CLIENT") {
      await tx.clientLedger.create({
        data: {
          clientId: transaction.clientId,
          entryDate: actionDate,
          accountingMonth,
          amount: amount.toString(),
          sourceType: "RESERVE",
          sourceId: action.id,
          transactionId: transaction.id,
          description: `Reserve applied to chargeback -- ${transaction.id}${input.notes ? `: ${input.notes}` : ""}`,
          createdById: user.id,
        },
      });
    }

    await writeAuditLog(tx, {
      entityType: "ReserveHold",
      entityId: reserveHoldId,
      action: "UPDATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(action)),
      notes: `Applied ${amount.toFixed(2)} to chargeback ${input.rcvId}`,
    });
  });

  revalidateReserveViews(hold.owner === "CLIENT" ? transaction.clientId : null);
  return { ok: true };
}

// Records a loss -- reduces the receivable without any cash or client-ledger
// movement, since the money was never going to be collected.
export async function writeOffReserveHold(
  reserveHoldId: string,
  input: { amount: string; notes: string }
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const found = await loadReserveHold(reserveHoldId);
  if (!found) return { ok: false, error: "Reserve hold not found." };
  const { remaining } = found;

  const amount = new Decimal(input.amount || 0);
  if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) {
    return { ok: false, error: "Enter a positive amount." };
  }
  if (amount.greaterThan(remaining)) {
    return { ok: false, error: `Only ${remaining.toFixed(2)} remains on this reserve.` };
  }
  if (!input.notes.trim()) {
    return { ok: false, error: "A reason is required to write off a reserve." };
  }

  const actionDate = new Date();
  const accountingMonth = accountingMonthOf(actionDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    const action = await tx.reserveHoldAction.create({
      data: {
        reserveHoldId,
        type: "WRITE_OFF",
        amount,
        actionDate,
        accountingMonth,
        notes: input.notes,
        performedById: user.id,
      },
    });
    await writeAuditLog(tx, {
      entityType: "ReserveHold",
      entityId: reserveHoldId,
      action: "UPDATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(action)),
      notes: `Wrote off ${amount.toFixed(2)}: ${input.notes}`,
    });
  });

  revalidateReserveViews();
  return { ok: true };
}

// Keep Holding doesn't change the remaining receivable, so it writes no
// ReserveHoldAction row -- just an audit trail entry that someone reviewed
// it and chose to leave it as-is.
export async function keepHoldingReserve(
  reserveHoldId: string,
  input: { notes: string }
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const hold = await prisma.reserveHold.findUnique({ where: { id: reserveHoldId } });
  if (!hold) return { ok: false, error: "Reserve hold not found." };

  await writeAuditLog(prisma, {
    entityType: "ReserveHold",
    entityId: reserveHoldId,
    action: "UPDATE",
    performedById: user.id,
    notes: `Kept holding${input.notes ? `: ${input.notes}` : ""}`,
  });

  revalidatePath("/merchant-holds");
  return { ok: true };
}

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
    include: { actions: true, transaction: { select: { clientId: true } } },
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
  revalidatePath("/statements/cash-flow");
  revalidatePath("/cash-position");
  if (clientId) revalidatePath(`/client-ledger/${clientId}`);
}

// Release/settle a reserve, per its direction (see ReserveDirection):
//   CLIENT_HELD -- this was always the client's money, sitting somewhere
//     else. Releasing it pays the client directly: bank OUT, no ledger
//     charge either way (it was never counted in clientNetPayable, so
//     there's nothing to reverse -- if a further payout is warranted for
//     any OTHER reason, that's a separate, ordinary Payout).
//   FP_FRONTED -- FoundaPay already charged the client's ledger for this at
//     creation (a receivable). Settling means the client pays it back:
//     bank IN, and that receivable charge is credited back out (cleared).
//   FP_OWN -- FoundaPay's own reserve becoming FoundaPay's own cash: bank
//     IN, no client-ledger effect, ever.
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

  const payingClient = hold.direction === "CLIENT_HELD";
  const bankAmount = payingClient ? amount.negated() : amount;
  const verb = payingClient ? "paid to client" : hold.direction === "FP_FRONTED" ? "settled by client" : "released";

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
      amount: bankAmount.toString(),
      entryDate: actionDate,
      accountingMonth,
      sourceType: "RESERVE",
      sourceId: action.id,
      description: `Reserve ${verb} -- ${hold.transactionId}${input.notes ? `: ${input.notes}` : ""}`,
      createdById: user.id,
    });

    if (hold.direction === "FP_FRONTED") {
      await tx.clientLedger.create({
        data: {
          clientId: hold.transaction.clientId,
          entryDate: actionDate,
          accountingMonth,
          amount: amount.toString(),
          sourceType: "RESERVE",
          sourceId: action.id,
          transactionId: hold.transactionId,
          description: `Reserve settled -- ${hold.transactionId}${input.notes ? `: ${input.notes}` : ""}`,
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
      notes: `${amount.toFixed(2)} ${verb} via ${bankAccount.name}`,
    });
  });

  revalidateReserveViews(hold.direction === "FP_FRONTED" ? hold.transaction.clientId : null);
  return { ok: true };
}

// Offsets a chargeback with this reserve, full or partial. Any direction
// with client involvement (CLIENT_HELD or FP_FRONTED) credits the client's
// ledger: CLIENT_HELD had no charge to begin with, so this restores what
// the chargeback took from their balance; FP_FRONTED already charged them
// for this reserve, so this forgives that charge instead of collecting it,
// using it to absorb the chargeback loss instead. FP_OWN is FoundaPay
// absorbing its own exposure -- no ledger effect, just closes the hold.
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

  const actionDate = new Date();
  const accountingMonth = accountingMonthOf(actionDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const creditsClient = hold.direction !== "FP_OWN";

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

    if (creditsClient) {
      await tx.clientLedger.create({
        data: {
          clientId: hold.transaction.clientId,
          entryDate: actionDate,
          accountingMonth,
          amount: amount.toString(),
          sourceType: "RESERVE",
          sourceId: action.id,
          transactionId: hold.transactionId,
          description: `Reserve applied to chargeback -- ${hold.transactionId}${input.notes ? `: ${input.notes}` : ""}`,
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

  revalidateReserveViews(creditsClient ? hold.transaction.clientId : null);
  return { ok: true };
}

// Records a loss and removes the amount from the receivable/liability.
//   CLIENT_HELD -- this was a liability (money owed to the client), never
//     charged to their ledger. Forgiving it is a judgment call left neutral
//     here (no COGS impact, no client-ledger effect) rather than inventing
//     a speculative "other income" line for an edge case.
//   FP_FRONTED -- a genuine bad-debt loss: forgives the client's charge
//     (ledger credit) and counts toward the Income Statement's Reserve
//     Write-Offs line.
//   FP_OWN -- FoundaPay's own asset lost: counts toward Reserve Write-Offs,
//     no client-ledger effect.
export async function writeOffReserveHold(
  reserveHoldId: string,
  input: { amount: string; notes: string }
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
  if (!input.notes.trim()) {
    return { ok: false, error: "A reason is required to write off a reserve." };
  }

  const actionDate = new Date();
  const accountingMonth = accountingMonthOf(actionDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const forgivesClientCharge = hold.direction === "FP_FRONTED";

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

    if (forgivesClientCharge) {
      await tx.clientLedger.create({
        data: {
          clientId: hold.transaction.clientId,
          entryDate: actionDate,
          accountingMonth,
          amount: amount.toString(),
          sourceType: "RESERVE",
          sourceId: action.id,
          transactionId: hold.transactionId,
          description: `Reserve written off (forgiven) -- ${hold.transactionId}: ${input.notes}`,
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
      notes: `Wrote off ${amount.toFixed(2)}: ${input.notes}`,
    });
  });

  revalidateReserveViews(forgivesClientCharge ? hold.transaction.clientId : null);
  return { ok: true };
}

// Keep Holding doesn't change the remaining receivable/liability, so it
// writes no ReserveHoldAction row -- just an audit trail entry that someone
// reviewed it and chose to leave it as-is.
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

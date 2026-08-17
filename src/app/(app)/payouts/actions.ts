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
import { clientPayoutSchema } from "./schema";
import { PAYABLE_TRANSACTION_STATUSES } from "@/lib/transactions/payable-data";

export async function createClientPayout(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = clientPayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [client, bankAccount, transactions] = await Promise.all([
    prisma.client.findUnique({ where: { id: d.clientId } }),
    prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } }),
    prisma.transaction.findMany({
      where: { id: { in: d.allocations.map((a) => a.transactionId) } },
      include: { payoutAllocations: { select: { amountAllocated: true } } },
    }),
  ]);

  if (!client || client.status !== "ACTIVE") return { ok: false, error: "Client not found or inactive." };
  if (!bankAccount || !bankAccount.active) return { ok: false, error: "Bank account not found or inactive." };
  if (transactions.length !== d.allocations.length) {
    return { ok: false, error: "One or more selected transactions could not be found." };
  }

  for (const alloc of d.allocations) {
    const txn = transactions.find((t) => t.id === alloc.transactionId)!;
    if (txn.clientId !== d.clientId) {
      return { ok: false, error: `Transaction ${txn.id} does not belong to this client.` };
    }
    if (!(PAYABLE_TRANSACTION_STATUSES as readonly string[]).includes(txn.status)) {
      return { ok: false, error: `Transaction ${txn.id} is not payable (status ${txn.status}).` };
    }
    // No hard cap on allocation amount here -- paying more than a transaction's
    // remaining balance is allowed by design (advance liberty rule). The UI
    // warns the user before submit; this simply records what was approved.
  }

  const payoutDate = new Date(d.payoutDate);
  if (Number.isNaN(payoutDate.getTime())) return { ok: false, error: "Invalid payout date." };
  const accountingMonth = accountingMonthOf(payoutDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };
  const allocatedAmount = d.allocations.reduce((sum, a) => sum.plus(a.amount), new Decimal(0));
  const generalAmount = d.generalAmount ? new Decimal(d.generalAmount) : new Decimal(0);
  const amountPaid = allocatedAmount.plus(generalAmount);
  const remittanceFee = d.remittanceFee ? new Decimal(d.remittanceFee) : new Decimal(0);

  await prisma.$transaction(async (tx) => {
    const payout = await tx.clientPayout.create({
      data: {
        clientId: d.clientId,
        payoutDate,
        accountingMonth,
        payoutMethodId: d.payoutMethodId,
        bankAccountId: d.bankAccountId,
        amountPaid: amountPaid.toFixed(2),
        generalAmount: generalAmount.toFixed(2),
        remittanceFee: remittanceFee.toFixed(2),
        feeBearer: d.feeBearer,
        reference: d.reference || null,
        notes: d.notes || null,
        createdById: user.id,
      },
    });

    for (const alloc of d.allocations) {
      const txn = transactions.find((t) => t.id === alloc.transactionId)!;
      await tx.clientPayoutAllocation.create({
        data: {
          clientPayoutId: payout.id,
          transactionId: alloc.transactionId,
          amountAllocated: alloc.amount,
        },
      });

      const alreadyPaid = txn.payoutAllocations.reduce(
        (sum, a) => sum.plus(a.amountAllocated),
        new Decimal(0)
      );
      const newTotal = alreadyPaid.plus(alloc.amount);
      const fullyPaid = newTotal.greaterThanOrEqualTo(new Decimal(txn.clientNetPayable ?? 0).minus(0.01));
      await tx.transaction.update({
        where: { id: txn.id },
        data: { status: fullyPaid ? "PAID" : "PARTIALLY_PAID" },
      });
    }

    const description = generalAmount.greaterThan(0)
      ? d.allocations.length > 0
        ? `Payout ${payout.id} (${allocatedAmount.toFixed(2)} to transactions + ${generalAmount.toFixed(2)} general)`
        : `Payout ${payout.id} (${generalAmount.toFixed(2)} general, not tied to a transaction)`
      : `Payout ${payout.id}`;

    await tx.clientLedger.create({
      data: {
        clientId: d.clientId,
        entryDate: payoutDate,
        accountingMonth,
        amount: amountPaid.negated().toFixed(2),
        sourceType: "PAYOUT",
        sourceId: payout.id,
        clientPayoutId: payout.id,
        description,
        createdById: user.id,
      },
    });

    await postBankLedgerEntry(tx, {
      bankAccountId: d.bankAccountId,
      amount: amountPaid.negated().toFixed(2),
      entryDate: payoutDate,
      accountingMonth,
      sourceType: "PAYOUT",
      sourceId: payout.id,
      description: `Payout to ${client.name}`,
      createdById: user.id,
    });

    if (d.feeBearer === "FOUNDAPAY" && remittanceFee.greaterThan(0)) {
      await postBankLedgerEntry(tx, {
        bankAccountId: d.bankAccountId,
        amount: remittanceFee.negated().toFixed(2),
        entryDate: payoutDate,
        accountingMonth,
        sourceType: "PAYOUT",
        sourceId: payout.id,
        description: `Remittance fee (FoundaPay-borne) for payout ${payout.id}`,
        createdById: user.id,
      });
    }

    await writeAuditLog(tx, {
      entityType: "ClientPayout",
      entityId: payout.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(payout)),
    });
  });

  revalidatePath("/payouts");
  revalidatePath("/transactions");
  revalidatePath("/client-ledger");
  return { ok: true };
}

// Reverses a payout entirely: removes what it paid out of the client's
// ledger and the bank (including any FoundaPay-borne remittance fee --
// same sourceType/sourceId, one deleteMany catches both), and recomputes
// each allocated transaction's status from what it has left allocated
// *excluding this payout* -- same Paid/Partially-Paid rule createClientPayout
// itself uses. If nothing else was ever allocated to it, PAID/PARTIALLY_PAID
// overwrote whatever settlement status the transaction actually had (Settled,
// Client Payable from a batch, Approved, ...) -- that's only recoverable from
// being back in a batch (Client Payable) or from its own audit trail
// (Approve/Mark Settled), never assumed.
export async function deleteClientPayout(id: string): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const payout = await prisma.clientPayout.findUnique({
    where: { id },
    include: { allocations: true },
  });
  if (!payout) return { ok: false, error: "Payout not found." };
  const monthError = await assertMonthOpen(payout.accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    for (const alloc of payout.allocations) {
      const txn = await tx.transaction.findUnique({
        where: { id: alloc.transactionId },
        include: {
          payoutAllocations: {
            where: { clientPayoutId: { not: id } },
            select: { amountAllocated: true },
          },
        },
      });
      if (!txn) continue;
      const remaining = txn.payoutAllocations.reduce(
        (sum, a) => sum.plus(a.amountAllocated),
        new Decimal(0)
      );
      let newStatus: string;
      if (remaining.isZero()) {
        if (txn.settlementBatchId) {
          newStatus = "CLIENT_PAYABLE";
        } else {
          const auditEntry = await tx.auditLog.findFirst({
            where: { transactionId: txn.id, action: { in: ["APPROVE", "MARK_SETTLED"] } },
            orderBy: { performedAt: "desc" },
          });
          newStatus = (auditEntry?.afterSnapshot as { status?: string } | null)?.status ?? "APPROVED";
        }
      } else if (remaining.greaterThanOrEqualTo(new Decimal(txn.clientNetPayable ?? 0).minus(0.01))) {
        newStatus = "PAID";
      } else {
        newStatus = "PARTIALLY_PAID";
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- read back from settlement-batch inference or a stored audit snapshot, not a fixed literal
      await tx.transaction.update({ where: { id: txn.id }, data: { status: newStatus as any } });
    }

    await tx.clientPayoutAllocation.deleteMany({ where: { clientPayoutId: id } });
    await tx.clientLedger.deleteMany({ where: { sourceType: "PAYOUT", sourceId: id } });
    await tx.bankLedger.deleteMany({ where: { sourceType: "PAYOUT", sourceId: id } });

    await writeAuditLog(tx, {
      entityType: "ClientPayout",
      entityId: id,
      action: "DELETE",
      performedById: user.id,
      beforeSnapshot: JSON.parse(JSON.stringify(payout)),
    });

    await tx.clientPayout.delete({ where: { id } });
  });

  revalidatePath("/payouts");
  revalidatePath("/transactions");
  revalidatePath("/client-ledger");
  revalidatePath("/master-data/banks");
  revalidatePath("/cash-position");
  return { ok: true };
}

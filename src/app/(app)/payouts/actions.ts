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
    if (txn.status !== "CLIENT_PAYABLE" && txn.status !== "PARTIALLY_PAID") {
      return { ok: false, error: `Transaction ${txn.id} is not payable (status ${txn.status}).` };
    }
    const alreadyPaid = txn.payoutAllocations.reduce(
      (sum, a) => sum.plus(a.amountAllocated),
      new Decimal(0)
    );
    const remaining = new Decimal(txn.clientNetPayable ?? 0).minus(alreadyPaid);
    if (new Decimal(alloc.amount).greaterThan(remaining.plus(0.01))) {
      return {
        ok: false,
        error: `Allocation for ${txn.id} (${alloc.amount}) exceeds its remaining balance (${remaining.toFixed(2)}).`,
      };
    }
  }

  const payoutDate = new Date(d.payoutDate);
  if (Number.isNaN(payoutDate.getTime())) return { ok: false, error: "Invalid payout date." };
  const accountingMonth = accountingMonthOf(payoutDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };
  const amountPaid = d.allocations.reduce((sum, a) => sum.plus(a.amount), new Decimal(0));
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

    await tx.clientLedger.create({
      data: {
        clientId: d.clientId,
        entryDate: payoutDate,
        accountingMonth,
        amount: amountPaid.negated().toFixed(2),
        sourceType: "PAYOUT",
        sourceId: payout.id,
        clientPayoutId: payout.id,
        description: `Payout ${payout.id}`,
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

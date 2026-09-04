"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/rbac";
import { resolveUserNames } from "@/lib/user-names";
import { writeAuditLog } from "@/lib/audit-log";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import type { ActionResult } from "@/lib/action-result";
import { internalTransferSchema } from "./schema";

// No P&L impact from the transfer itself -- money just moves from one
// FoundaPay account to another. The fee (if any) is the only real cost, and
// who bears it is now a choice: FOUNDAPAY (default, deducted from the
// source account, as before) or CLIENT (the source account only moves the
// transfer amount itself; the fee instead posts as a charge on that
// client's ledger/statement).
export async function createInternalTransfer(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = internalTransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [fromAccount, toAccount, client] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { id: d.fromBankAccountId } }),
    prisma.bankAccount.findUnique({ where: { id: d.toBankAccountId } }),
    d.clientId ? prisma.client.findUnique({ where: { id: d.clientId } }) : Promise.resolve(null),
  ]);
  if (!fromAccount || !fromAccount.active) return { ok: false, error: "Source account not found or inactive." };
  if (!toAccount || !toAccount.active) return { ok: false, error: "Destination account not found or inactive." };
  if (d.clientId && (!client || client.status !== "ACTIVE")) {
    return { ok: false, error: "Client not found or inactive." };
  }

  const transferDate = new Date(d.transferDate);
  if (Number.isNaN(transferDate.getTime())) return { ok: false, error: "Invalid transfer date." };
  const accountingMonth = accountingMonthOf(transferDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const amount = new Decimal(d.amount);
  const fee = d.feeAmount ? new Decimal(d.feeAmount) : new Decimal(0);
  const usdValue = d.usdValue ? new Decimal(d.usdValue) : amount;
  const clientBearsFee = d.feeBearer === "CLIENT" && fee.greaterThan(0);

  await prisma.$transaction(async (tx) => {
    const transfer = await tx.internalTransfer.create({
      data: {
        fromBankAccountId: d.fromBankAccountId,
        toBankAccountId: d.toBankAccountId,
        amount: amount.toFixed(2),
        feeAmount: fee.toFixed(2),
        feeBearer: d.feeBearer,
        clientId: d.clientId || null,
        transferDate,
        accountingMonth,
        notes: d.notes || null,
        createdById: user.id,
      },
    });

    // FoundaPay-borne fee is deducted from the source account alongside the
    // transfer amount, exactly as before. Client-borne fee leaves the
    // source account untouched by the fee -- it's billed to the client
    // instead, below.
    const fromLegAmount = clientBearsFee ? amount : amount.plus(fee);
    const fromLegUsd = clientBearsFee ? usdValue : usdValue.plus(fee);

    await tx.bankLedger.create({
      data: {
        bankAccountId: d.fromBankAccountId,
        entryDate: transferDate,
        accountingMonth,
        amount: fromLegAmount.negated().toFixed(2),
        usdValue: fromLegUsd.negated().toFixed(2),
        sourceType: "INTERNAL_TRANSFER",
        sourceId: transfer.id,
        internalTransferId: transfer.id,
        description:
          d.notes ||
          `Transfer to ${toAccount.name}${!clientBearsFee && fee.greaterThan(0) ? ` (incl. ${fee.toFixed(2)} fee)` : ""}`,
        createdById: user.id,
      },
    });

    await tx.bankLedger.create({
      data: {
        bankAccountId: d.toBankAccountId,
        entryDate: transferDate,
        accountingMonth,
        amount: amount.toFixed(2),
        usdValue: usdValue.toFixed(2),
        sourceType: "INTERNAL_TRANSFER",
        sourceId: transfer.id,
        internalTransferId: transfer.id,
        description: d.notes || `Transfer from ${fromAccount.name}`,
        createdById: user.id,
      },
    });

    if (clientBearsFee && client) {
      await tx.clientLedger.create({
        data: {
          clientId: client.id,
          entryDate: transferDate,
          accountingMonth,
          amount: fee.negated().toFixed(2),
          sourceType: "INTERNAL_TRANSFER",
          sourceId: transfer.id,
          description: d.notes || `Transfer fee (${fromAccount.name} -> ${toAccount.name})`,
          createdById: user.id,
        },
      });
    }

    await writeAuditLog(tx, {
      entityType: "InternalTransfer",
      entityId: transfer.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(transfer)),
    });
  });

  revalidatePath("/transfers");
  revalidatePath("/cash-position");
  if (d.clientId) revalidatePath(`/client-ledger/${d.clientId}`);
  return { ok: true };
}

export async function markInternalTransferSettled(id: string): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const transfer = await prisma.internalTransfer.update({
    where: { id },
    data: { settlementStatus: "SETTLED", settledAt: new Date(), settledById: user.id },
  });
  await writeAuditLog(prisma, {
    entityType: "InternalTransfer",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(transfer)),
    notes: "Marked settled",
  });
  revalidatePath("/transfers");
  return { ok: true };
}

export type TransferFullDetail = {
  id: string;
  fromBankAccountName: string;
  toBankAccountName: string;
  amount: string;
  feeAmount: string;
  feeBearer: string | null;
  clientName: string | null;
  transferDate: string;
  accountingMonth: string;
  notes: string | null;
  settlementStatus: string;
  settledAt: string | null;
  settledByName: string | null;
  createdByName: string;
  createdAt: string;
};

export async function getTransferFullDetail(id: string): Promise<TransferFullDetail | null> {
  await requireUser();
  const t = await prisma.internalTransfer.findUnique({
    where: { id },
    include: {
      fromBankAccount: { select: { name: true } },
      toBankAccount: { select: { name: true } },
      client: { select: { name: true } },
    },
  });
  if (!t) return null;
  const names = await resolveUserNames([t.createdById, t.settledById]);

  return {
    id: t.id,
    fromBankAccountName: t.fromBankAccount.name,
    toBankAccountName: t.toBankAccount.name,
    amount: t.amount.toString(),
    feeAmount: t.feeAmount.toString(),
    feeBearer: t.feeBearer,
    clientName: t.client?.name ?? null,
    transferDate: t.transferDate.toISOString(),
    accountingMonth: t.accountingMonth,
    notes: t.notes,
    settlementStatus: t.settlementStatus,
    settledAt: t.settledAt?.toISOString() ?? null,
    settledByName: t.settledById ? (names.get(t.settledById) ?? null) : null,
    createdByName: names.get(t.createdById) ?? "—",
    createdAt: t.createdAt.toISOString(),
  };
}

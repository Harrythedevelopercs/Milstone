"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import type { ActionResult } from "@/lib/action-result";
import { internalTransferSchema } from "./schema";

// No P&L impact -- money just moves from one FoundaPay account to another.
// Only a real transfer fee (if any) is a genuine cost, always borne by
// FoundaPay since both sides of the transfer are FoundaPay's own money.
export async function createInternalTransfer(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = internalTransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [fromAccount, toAccount] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { id: d.fromBankAccountId } }),
    prisma.bankAccount.findUnique({ where: { id: d.toBankAccountId } }),
  ]);
  if (!fromAccount || !fromAccount.active) return { ok: false, error: "Source account not found or inactive." };
  if (!toAccount || !toAccount.active) return { ok: false, error: "Destination account not found or inactive." };

  const transferDate = new Date(d.transferDate);
  if (Number.isNaN(transferDate.getTime())) return { ok: false, error: "Invalid transfer date." };
  const accountingMonth = accountingMonthOf(transferDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const amount = new Decimal(d.amount);
  const fee = d.feeAmount ? new Decimal(d.feeAmount) : new Decimal(0);
  const usdValue = d.usdValue ? new Decimal(d.usdValue) : amount;

  await prisma.$transaction(async (tx) => {
    const transfer = await tx.internalTransfer.create({
      data: {
        fromBankAccountId: d.fromBankAccountId,
        toBankAccountId: d.toBankAccountId,
        amount: amount.toFixed(2),
        feeAmount: fee.toFixed(2),
        transferDate,
        accountingMonth,
        notes: d.notes || null,
        createdById: user.id,
      },
    });

    await tx.bankLedger.create({
      data: {
        bankAccountId: d.fromBankAccountId,
        entryDate: transferDate,
        accountingMonth,
        amount: amount.plus(fee).negated().toFixed(2),
        usdValue: usdValue.plus(fee).negated().toFixed(2),
        sourceType: "INTERNAL_TRANSFER",
        sourceId: transfer.id,
        internalTransferId: transfer.id,
        description: `Transfer to ${toAccount.name}${fee.greaterThan(0) ? ` (incl. ${fee.toFixed(2)} fee)` : ""}`,
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
        description: `Transfer from ${fromAccount.name}`,
        createdById: user.id,
      },
    });

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
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import { resolveUserNames } from "@/lib/user-names";
import type { ActionResult } from "@/lib/action-result";
import { drawingSchema } from "./schema";

export async function recordPartnerDrawing(partnerId: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = drawingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [partner, bankAccount] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId } }),
    prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } }),
  ]);
  if (!partner) return { ok: false, error: "Partner not found." };
  if (!bankAccount || !bankAccount.active) return { ok: false, error: "Bank account not found or inactive." };

  const drawingDate = new Date(d.drawingDate);
  if (Number.isNaN(drawingDate.getTime())) return { ok: false, error: "Invalid date." };
  const accountingMonth = accountingMonthOf(drawingDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  await prisma.$transaction(async (tx) => {
    const ledgerEntry = await tx.partnerLedger.create({
      data: {
        partnerId,
        entryDate: drawingDate,
        accountingMonth,
        amount: `-${d.amount}`,
        kind: "DRAWING",
        sourceType: "MANUAL",
        sourceId: partnerId,
        description: d.notes || `Drawing by ${partner.name}`,
        createdById: user.id,
      },
    });

    await tx.bankLedger.create({
      data: {
        bankAccountId: d.bankAccountId,
        entryDate: drawingDate,
        accountingMonth,
        amount: `-${d.amount}`,
        usdValue: `-${d.amount}`,
        sourceType: "MANUAL",
        sourceId: partnerId,
        description: `Drawing paid to ${partner.name}`,
        createdById: user.id,
      },
    });

    await writeAuditLog(tx, {
      entityType: "PartnerLedger",
      entityId: ledgerEntry.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(ledgerEntry)),
    });
  });

  revalidatePath(`/partner-ledger/${partnerId}`);
  revalidatePath("/partner-ledger");
  revalidatePath("/cash-position");
  return { ok: true };
}

export type PartnerDistributionFullDetail = {
  id: string;
  partnerName: string;
  entryDate: string;
  accountingMonth: string;
  amount: string;
  kind: string;
  sourceType: string;
  description: string | null;
  createdByName: string;
  createdAt: string;
};

export async function getPartnerDistributionFullDetail(id: string): Promise<PartnerDistributionFullDetail | null> {
  await requireUser();
  const pl = await prisma.partnerLedger.findUnique({
    where: { id },
    include: { partner: { select: { name: true } } },
  });
  if (!pl) return null;
  const names = await resolveUserNames([pl.createdById]);

  return {
    id: pl.id,
    partnerName: pl.partner.name,
    entryDate: pl.entryDate.toISOString(),
    accountingMonth: pl.accountingMonth,
    amount: pl.amount.toString(),
    kind: pl.kind,
    sourceType: pl.sourceType,
    description: pl.description,
    createdByName: names.get(pl.createdById) ?? "—",
    createdAt: pl.createdAt.toISOString(),
  };
}

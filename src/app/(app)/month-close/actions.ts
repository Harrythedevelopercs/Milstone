"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { computeChecklistItems, readChecklist, type ManualChecklistKey } from "@/lib/month-close/checklist";
import type { ActionResult } from "@/lib/action-result";

export async function toggleManualChecklistItem(
  accountingMonth: string,
  key: ManualChecklistKey,
  value: boolean
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const existing = await prisma.monthClose.findUnique({ where: { accountingMonth } });
  if (existing?.status === "CLOSED") return { ok: false, error: "This month is closed." };

  const checklist = await readChecklist(accountingMonth);
  await prisma.monthClose.upsert({
    where: { accountingMonth },
    create: { accountingMonth, status: "OPEN", checklist: { ...checklist, [key]: value } },
    update: { checklist: { ...checklist, [key]: value } },
  });

  revalidatePath("/month-close");
  return { ok: true };
}

export async function closeMonth(accountingMonth: string): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const existing = await prisma.monthClose.findUnique({ where: { accountingMonth } });
  if (existing?.status === "CLOSED") return { ok: false, error: "This month is already closed." };

  const items = await computeChecklistItems(accountingMonth);
  const incomplete = items.filter((i) => i.blocking && !i.passed);
  if (incomplete.length > 0) {
    return {
      ok: false,
      error: `Complete every checklist item first (${incomplete.length} remaining).`,
    };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.monthClose.upsert({
      where: { accountingMonth },
      create: {
        accountingMonth,
        status: "CLOSED",
        closedById: user.id,
        closedAt: new Date(),
        checklist: existing?.checklist ?? {},
      },
      update: { status: "CLOSED", closedById: user.id, closedAt: new Date() },
    });
    await writeAuditLog(tx, {
      entityType: "MonthClose",
      entityId: accountingMonth,
      action: "CLOSE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(updated)),
    });
  });

  revalidatePath("/month-close");
  return { ok: true };
}

export async function reopenMonth(accountingMonth: string, reason: string): Promise<ActionResult> {
  const user = await requireRole("OWNER");
  if (!reason.trim()) return { ok: false, error: "A reason is required." };

  const existing = await prisma.monthClose.findUnique({ where: { accountingMonth } });
  if (!existing || existing.status !== "CLOSED") {
    return { ok: false, error: "This month is not closed." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.monthClose.update({
      where: { accountingMonth },
      data: {
        status: "REOPENED",
        reopenedById: user.id,
        reopenedAt: new Date(),
        reopenReason: reason,
      },
    });
    await writeAuditLog(tx, {
      entityType: "MonthClose",
      entityId: accountingMonth,
      action: "REOPEN",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(updated)),
      notes: reason,
    });
  });

  revalidatePath("/month-close");
  return { ok: true };
}

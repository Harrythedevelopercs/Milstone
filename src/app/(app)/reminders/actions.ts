"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/lib/action-result";
import { createReminderSchema } from "./schema";

// Custom (freeform) reminder, or a follow-up reminder attached to a
// transaction that isn't a Hold -- e.g. "check on this merchant's reserve
// release." previousStatus stays null here on purpose: only the Hold action
// sets it, since only a Hold reminder is responsible for restoring a status.
export async function createReminder(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = createReminderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const dueDate = new Date(d.dueDate);
  if (Number.isNaN(dueDate.getTime())) return { ok: false, error: "Invalid due date." };

  await prisma.$transaction(async (tx) => {
    const reminder = await tx.reminder.create({
      data: {
        type: d.transactionId ? "TRANSACTION" : "CUSTOM",
        title: d.title,
        note: d.note || null,
        dueDate,
        transactionId: d.transactionId || null,
        createdById: user.id,
      },
    });
    await writeAuditLog(tx, {
      entityType: "Reminder",
      entityId: reminder.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(reminder)),
    });
  });

  revalidatePath("/reminders");
  revalidatePath("/");
  revalidatePath("/merchant-holds");
  return { ok: true };
}

export async function completeReminder(id: string): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const reminder = await prisma.reminder.findUnique({ where: { id } });
  if (!reminder) return { ok: false, error: "Reminder not found." };

  await prisma.reminder.update({
    where: { id },
    data: { status: "DONE", completedAt: new Date() },
  });
  await writeAuditLog(prisma, {
    entityType: "Reminder",
    entityId: id,
    action: "COMPLETE",
    performedById: user.id,
  });

  revalidatePath("/reminders");
  revalidatePath("/");
  revalidatePath("/merchant-holds");
  return { ok: true };
}

export async function dismissReminder(id: string): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const reminder = await prisma.reminder.findUnique({ where: { id } });
  if (!reminder) return { ok: false, error: "Reminder not found." };

  await prisma.reminder.update({
    where: { id },
    data: { status: "DISMISSED", completedAt: new Date() },
  });
  await writeAuditLog(prisma, {
    entityType: "Reminder",
    entityId: id,
    action: "DISMISS",
    performedById: user.id,
  });

  revalidatePath("/reminders");
  revalidatePath("/");
  revalidatePath("/merchant-holds");
  return { ok: true };
}

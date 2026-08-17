"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { isPrismaError, PRISMA_UNIQUE_VIOLATION, type ActionResult } from "@/lib/action-result";
import { accountSchema } from "./schema";

export async function createAccount(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    const account = await prisma.account.create({
      data: { code: d.code, name: d.name, category: d.category, description: d.description || null },
    });
    await writeAuditLog(prisma, {
      entityType: "Account",
      entityId: account.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(account)),
    });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That account code already exists." };
    }
    throw error;
  }
  revalidatePath("/master-data/chart-of-accounts");
  return { ok: true };
}

export async function updateAccount(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const before = await prisma.account.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Account not found." };

  try {
    const account = await prisma.account.update({
      where: { id },
      data: { code: d.code, name: d.name, category: d.category, description: d.description || null },
    });
    await writeAuditLog(prisma, {
      entityType: "Account",
      entityId: id,
      action: "UPDATE",
      performedById: user.id,
      beforeSnapshot: JSON.parse(JSON.stringify(before)),
      afterSnapshot: JSON.parse(JSON.stringify(account)),
    });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That account code already exists." };
    }
    throw error;
  }
  revalidatePath("/master-data/chart-of-accounts");
  return { ok: true };
}

export async function setAccountActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const account = await prisma.account.update({ where: { id }, data: { active } });
  await writeAuditLog(prisma, {
    entityType: "Account",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(account)),
    notes: active ? "Activated" : "Deactivated",
  });
  revalidatePath("/master-data/chart-of-accounts");
  return { ok: true };
}

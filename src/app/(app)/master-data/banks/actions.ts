"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/lib/action-result";
import { bankAccountSchema } from "./schema";

function toData(parsed: ReturnType<typeof bankAccountSchema.safeParse>) {
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return {
    name: parsed.data.name,
    accountType: parsed.data.accountType,
    bankName: parsed.data.bankName || null,
    accountNumberMasked: parsed.data.accountNumberMasked || null,
    currency: parsed.data.currency,
    country: parsed.data.country || null,
    openingBalance: parsed.data.openingBalance || "0",
    companyId: parsed.data.companyId || null,
    status: parsed.data.status,
  };
}

export async function createBankAccount(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const account = await prisma.bankAccount.create({ data: toData(parsed) });
  await writeAuditLog(prisma, {
    entityType: "BankAccount",
    entityId: account.id,
    action: "CREATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(account)),
  });
  revalidatePath("/master-data/banks");
  return { ok: true };
}

export async function updateBankAccount(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const before = await prisma.bankAccount.findUnique({ where: { id } });
  const account = await prisma.bankAccount.update({ where: { id }, data: toData(parsed) });
  await writeAuditLog(prisma, {
    entityType: "BankAccount",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    beforeSnapshot: before ? JSON.parse(JSON.stringify(before)) : undefined,
    afterSnapshot: JSON.parse(JSON.stringify(account)),
  });
  revalidatePath("/master-data/banks");
  return { ok: true };
}

export async function setBankAccountActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const account = await prisma.bankAccount.update({ where: { id }, data: { active } });
  await writeAuditLog(prisma, {
    entityType: "BankAccount",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(account)),
    notes: active ? "Activated" : "Deactivated",
  });
  revalidatePath("/master-data/banks");
  return { ok: true };
}

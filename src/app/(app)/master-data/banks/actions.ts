"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
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
  };
}

export async function createBankAccount(input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.bankAccount.create({ data: toData(parsed) });
  revalidatePath("/master-data/banks");
  return { ok: true };
}

export async function updateBankAccount(id: string, input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.bankAccount.update({ where: { id }, data: toData(parsed) });
  revalidatePath("/master-data/banks");
  return { ok: true };
}

export async function setBankAccountActive(id: string, active: boolean): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  await prisma.bankAccount.update({ where: { id }, data: { active } });
  revalidatePath("/master-data/banks");
  return { ok: true };
}

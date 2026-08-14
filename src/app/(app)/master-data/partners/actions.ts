"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
  type ActionResult,
} from "@/lib/action-result";
import { partnerSchema } from "./schema";

export async function createPartner(input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = partnerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.partner.create({
      data: {
        name: parsed.data.name,
        profitSharePercent: parsed.data.profitSharePercent,
        userId: parsed.data.userId || null,
      },
    });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That user is already linked to another partner." };
    }
    throw error;
  }
  revalidatePath("/master-data/partners");
  return { ok: true };
}

export async function updatePartner(id: string, input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = partnerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.partner.update({
      where: { id },
      data: {
        name: parsed.data.name,
        profitSharePercent: parsed.data.profitSharePercent,
        userId: parsed.data.userId || null,
      },
    });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That user is already linked to another partner." };
    }
    throw error;
  }
  revalidatePath("/master-data/partners");
  return { ok: true };
}

export async function setPartnerStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  await prisma.partner.update({ where: { id }, data: { status } });
  revalidatePath("/master-data/partners");
  return { ok: true };
}

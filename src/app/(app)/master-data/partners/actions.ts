"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import {
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
  type ActionResult,
} from "@/lib/action-result";
import { partnerSchema } from "./schema";

export async function createPartner(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = partnerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const partner = await prisma.partner.create({
      data: {
        name: parsed.data.name,
        profitSharePercent: parsed.data.profitSharePercent,
        userId: parsed.data.userId || null,
      },
    });
    await writeAuditLog(prisma, {
      entityType: "Partner",
      entityId: partner.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(partner)),
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
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = partnerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const before = await prisma.partner.findUnique({ where: { id } });
  try {
    const partner = await prisma.partner.update({
      where: { id },
      data: {
        name: parsed.data.name,
        profitSharePercent: parsed.data.profitSharePercent,
        userId: parsed.data.userId || null,
      },
    });
    await writeAuditLog(prisma, {
      entityType: "Partner",
      entityId: id,
      action: "UPDATE",
      performedById: user.id,
      beforeSnapshot: before ? JSON.parse(JSON.stringify(before)) : undefined,
      afterSnapshot: JSON.parse(JSON.stringify(partner)),
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
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const partner = await prisma.partner.update({ where: { id }, data: { status } });
  await writeAuditLog(prisma, {
    entityType: "Partner",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(partner)),
    notes: status === "ACTIVE" ? "Activated" : "Deactivated",
  });
  revalidatePath("/master-data/partners");
  return { ok: true };
}

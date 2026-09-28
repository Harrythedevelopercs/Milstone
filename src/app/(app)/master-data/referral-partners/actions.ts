"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/lib/action-result";
import { referralPartnerSchema } from "./schema";

export async function createReferralPartner(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = referralPartnerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const partner = await prisma.referralPartner.create({
    data: { name: parsed.data.name, notes: parsed.data.notes || null },
  });
  await writeAuditLog(prisma, {
    entityType: "ReferralPartner",
    entityId: partner.id,
    action: "CREATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(partner)),
  });
  revalidatePath("/master-data/referral-partners");
  revalidatePath("/master-data/clients");
  return { ok: true };
}

export async function updateReferralPartner(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = referralPartnerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const before = await prisma.referralPartner.findUnique({ where: { id } });
  const partner = await prisma.referralPartner.update({
    where: { id },
    data: { name: parsed.data.name, notes: parsed.data.notes || null },
  });
  await writeAuditLog(prisma, {
    entityType: "ReferralPartner",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    beforeSnapshot: before ? JSON.parse(JSON.stringify(before)) : undefined,
    afterSnapshot: JSON.parse(JSON.stringify(partner)),
  });
  revalidatePath("/master-data/referral-partners");
  revalidatePath("/master-data/clients");
  return { ok: true };
}

export async function setReferralPartnerStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const partner = await prisma.referralPartner.update({ where: { id }, data: { status } });
  await writeAuditLog(prisma, {
    entityType: "ReferralPartner",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(partner)),
    notes: status === "ACTIVE" ? "Activated" : "Deactivated",
  });
  revalidatePath("/master-data/referral-partners");
  revalidatePath("/master-data/clients");
  return { ok: true };
}

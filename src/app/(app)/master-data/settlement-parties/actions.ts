"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/lib/action-result";
import { settlementPartySchema } from "./schema";

export async function createSettlementParty(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = settlementPartySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const party = await prisma.settlementParty.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    },
  });
  await writeAuditLog(prisma, {
    entityType: "SettlementParty",
    entityId: party.id,
    action: "CREATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(party)),
  });
  revalidatePath("/master-data/settlement-parties");
  return { ok: true };
}

export async function updateSettlementParty(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = settlementPartySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const before = await prisma.settlementParty.findUnique({ where: { id } });
  const party = await prisma.settlementParty.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    },
  });
  await writeAuditLog(prisma, {
    entityType: "SettlementParty",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    beforeSnapshot: before ? JSON.parse(JSON.stringify(before)) : undefined,
    afterSnapshot: JSON.parse(JSON.stringify(party)),
  });
  revalidatePath("/master-data/settlement-parties");
  return { ok: true };
}

export async function setSettlementPartyStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const party = await prisma.settlementParty.update({ where: { id }, data: { status } });
  await writeAuditLog(prisma, {
    entityType: "SettlementParty",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(party)),
    notes: status === "ACTIVE" ? "Activated" : "Deactivated",
  });
  revalidatePath("/master-data/settlement-parties");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { format, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import {
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
  type ActionResult,
} from "@/lib/action-result";
import { clientSchema, clientRateBatchSchema } from "./schema";

export async function createClient(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const client = await prisma.client.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
        defaultReserveType: parsed.data.defaultReserveType || null,
        defaultReserveValue: parsed.data.defaultReserveValue || null,
        defaultReserveDirection: parsed.data.defaultReserveDirection || null,
        defaultFeeBasis: parsed.data.defaultFeeBasis || null,
        defaultMerchantReserveBasis: parsed.data.defaultMerchantReserveBasis || null,
      },
    });
    await writeAuditLog(prisma, {
      entityType: "Client",
      entityId: client.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(client)),
    });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That client code is already in use." };
    }
    throw error;
  }
  revalidatePath("/master-data/clients");
  return { ok: true };
}

export async function updateClient(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const before = await prisma.client.findUnique({ where: { id } });
  try {
    const client = await prisma.client.update({
      where: { id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
        defaultReserveType: parsed.data.defaultReserveType || null,
        defaultReserveValue: parsed.data.defaultReserveValue || null,
        defaultReserveDirection: parsed.data.defaultReserveDirection || null,
        defaultFeeBasis: parsed.data.defaultFeeBasis || null,
        defaultMerchantReserveBasis: parsed.data.defaultMerchantReserveBasis || null,
      },
    });
    await writeAuditLog(prisma, {
      entityType: "Client",
      entityId: id,
      action: "UPDATE",
      performedById: user.id,
      beforeSnapshot: before ? JSON.parse(JSON.stringify(before)) : undefined,
      afterSnapshot: JSON.parse(JSON.stringify(client)),
    });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That client code is already in use." };
    }
    throw error;
  }
  revalidatePath("/master-data/clients");
  return { ok: true };
}

export async function setClientStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const client = await prisma.client.update({ where: { id }, data: { status } });
  await writeAuditLog(prisma, {
    entityType: "Client",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(client)),
    notes: status === "ACTIVE" ? "Activated" : "Deactivated",
  });
  revalidatePath("/master-data/clients");
  return { ok: true };
}

// One click sets an effective-dated rate for every payment method filled in
// on the grid; blank methods are left untouched. Each method's own history
// is closed off and reopened independently, exactly as the single-method
// version did, just batched into one save.
export async function saveClientRateBatch(clientId: string, input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = clientRateBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const filled = d.entries.filter((e) => e.ratePercent.trim() !== "");
  if (filled.length === 0) {
    return { ok: false, error: "Enter a rate for at least one payment method." };
  }

  const effectiveFrom = new Date(d.effectiveFrom);
  if (Number.isNaN(effectiveFrom.getTime())) return { ok: false, error: "Invalid date." };

  const openRates = await prisma.clientRateHistory.findMany({
    where: {
      clientId,
      paymentMethodId: { in: filled.map((e) => e.paymentMethodId) },
      effectiveTo: null,
    },
    include: { paymentMethod: { select: { name: true } } },
  });
  const openByMethod = new Map(openRates.map((r) => [r.paymentMethodId, r]));

  for (const entry of filled) {
    const open = openByMethod.get(entry.paymentMethodId);
    if (open && open.effectiveFrom >= effectiveFrom) {
      return {
        ok: false,
        error: `${open.paymentMethod.name}: new rate must start after the current rate's start date (${format(open.effectiveFrom, "yyyy-MM-dd")}).`,
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of filled) {
      const open = openByMethod.get(entry.paymentMethodId);
      if (open) {
        await tx.clientRateHistory.update({
          where: { id: open.id },
          data: { effectiveTo: subDays(effectiveFrom, 1) },
        });
      }
      await tx.clientRateHistory.create({
        data: {
          clientId,
          paymentMethodId: entry.paymentMethodId,
          effectiveFrom,
          ratePercent: entry.ratePercent,
          feeBasis: entry.feeBasis,
          referralPartnerId: entry.referralPartnerId || null,
          referralPartnerRatePercent: entry.referralPartnerRatePercent || null,
          notes: d.notes || null,
        },
      });
    }
  });

  revalidatePath("/master-data/clients");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
  type ActionResult,
} from "@/lib/action-result";
import { clientSchema, clientRateSchema } from "./schema";

export async function createClient(input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.client.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
      },
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
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.client.update({
      where: { id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
      },
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
  await requireRole("OWNER", "ACCOUNTANT");
  await prisma.client.update({ where: { id }, data: { status } });
  revalidatePath("/master-data/clients");
  return { ok: true };
}

export async function addClientRate(clientId: string, input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = clientRateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const effectiveFrom = new Date(parsed.data.effectiveFrom);

  const currentOpenRate = await prisma.clientRateHistory.findFirst({
    where: { clientId, paymentMethodId: parsed.data.paymentMethodId, effectiveTo: null },
  });

  if (currentOpenRate && currentOpenRate.effectiveFrom >= effectiveFrom) {
    return {
      ok: false,
      error: "New rate must start after the current rate's start date.",
    };
  }

  await prisma.$transaction(async (tx) => {
    if (currentOpenRate) {
      await tx.clientRateHistory.update({
        where: { id: currentOpenRate.id },
        data: { effectiveTo: subDays(effectiveFrom, 1) },
      });
    }
    await tx.clientRateHistory.create({
      data: {
        clientId,
        paymentMethodId: parsed.data.paymentMethodId,
        effectiveFrom,
        ratePercent: parsed.data.ratePercent,
        feeBasis: parsed.data.feeBasis,
        notes: parsed.data.notes || null,
      },
    });
  });

  revalidatePath("/master-data/clients");
  return { ok: true };
}

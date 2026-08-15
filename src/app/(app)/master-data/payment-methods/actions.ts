"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { setSimpleLookupStatus } from "@/lib/actions/simple-lookup";
import {
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
  type ActionResult,
} from "@/lib/action-result";
import { paymentMethodSchema } from "./schema";

export async function createPaymentMethod(input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = paymentMethodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.paymentMethod.create({ data: parsed.data });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That name already exists." };
    }
    throw error;
  }
  revalidatePath("/master-data/payment-methods");
  return { ok: true };
}

export async function updatePaymentMethod(id: string, input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = paymentMethodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.paymentMethod.update({ where: { id }, data: parsed.data });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That name already exists." };
    }
    throw error;
  }
  revalidatePath("/master-data/payment-methods");
  return { ok: true };
}

export async function setPaymentMethodStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  return setSimpleLookupStatus("paymentMethod", id, status);
}

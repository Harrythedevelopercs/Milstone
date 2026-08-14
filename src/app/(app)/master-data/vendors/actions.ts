"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import type { ActionResult } from "@/lib/action-result";
import { vendorSchema, vendorSubscriptionSchema } from "./schema";

export async function createVendor(input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.vendor.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
    },
  });
  revalidatePath("/master-data/vendors");
  return { ok: true };
}

export async function updateVendor(id: string, input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.vendor.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
    },
  });
  revalidatePath("/master-data/vendors");
  return { ok: true };
}

export async function setVendorStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  await prisma.vendor.update({ where: { id }, data: { status } });
  revalidatePath("/master-data/vendors");
  return { ok: true };
}

export async function addVendorSubscription(
  vendorId: string,
  input: unknown
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = vendorSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.vendorSubscription.create({
    data: {
      vendorId,
      name: parsed.data.name,
      amount: parsed.data.amount,
      billingCycle: parsed.data.billingCycle,
      nextBillingDate: parsed.data.nextBillingDate
        ? new Date(parsed.data.nextBillingDate)
        : null,
    },
  });
  revalidatePath("/master-data/vendors");
  return { ok: true };
}

export async function setVendorSubscriptionStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  await prisma.vendorSubscription.update({ where: { id }, data: { status } });
  revalidatePath("/master-data/vendors");
  return { ok: true };
}

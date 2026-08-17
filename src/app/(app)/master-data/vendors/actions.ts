"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/lib/action-result";
import { vendorSchema, vendorSubscriptionSchema } from "./schema";

export async function createVendor(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const vendor = await prisma.vendor.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
    },
  });
  await writeAuditLog(prisma, {
    entityType: "Vendor",
    entityId: vendor.id,
    action: "CREATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(vendor)),
  });
  revalidatePath("/master-data/vendors");
  return { ok: true };
}

export async function updateVendor(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const before = await prisma.vendor.findUnique({ where: { id } });
  const vendor = await prisma.vendor.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
    },
  });
  await writeAuditLog(prisma, {
    entityType: "Vendor",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    beforeSnapshot: before ? JSON.parse(JSON.stringify(before)) : undefined,
    afterSnapshot: JSON.parse(JSON.stringify(vendor)),
  });
  revalidatePath("/master-data/vendors");
  return { ok: true };
}

export async function setVendorStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const vendor = await prisma.vendor.update({ where: { id }, data: { status } });
  await writeAuditLog(prisma, {
    entityType: "Vendor",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(vendor)),
    notes: status === "ACTIVE" ? "Activated" : "Deactivated",
  });
  revalidatePath("/master-data/vendors");
  return { ok: true };
}

export async function addVendorSubscription(
  vendorId: string,
  input: unknown
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = vendorSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const subscription = await prisma.vendorSubscription.create({
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
  await writeAuditLog(prisma, {
    entityType: "VendorSubscription",
    entityId: subscription.id,
    action: "CREATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(subscription)),
  });
  revalidatePath("/master-data/vendors");
  return { ok: true };
}

export async function setVendorSubscriptionStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const subscription = await prisma.vendorSubscription.update({ where: { id }, data: { status } });
  await writeAuditLog(prisma, {
    entityType: "VendorSubscription",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(subscription)),
    notes: status === "ACTIVE" ? "Activated" : "Deactivated",
  });
  revalidatePath("/master-data/vendors");
  return { ok: true };
}

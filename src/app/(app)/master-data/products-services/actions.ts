"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/lib/action-result";
import { productServiceSchema } from "./schema";

export async function createProductService(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = productServiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const product = await prisma.productService.create({
    data: { name: parsed.data.name, cost: parsed.data.cost, sellPrice: parsed.data.sellPrice },
  });
  await writeAuditLog(prisma, {
    entityType: "ProductService",
    entityId: product.id,
    action: "CREATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(product)),
  });
  revalidatePath("/master-data/products-services");
  return { ok: true };
}

export async function updateProductService(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = productServiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const before = await prisma.productService.findUnique({ where: { id } });
  const product = await prisma.productService.update({
    where: { id },
    data: { name: parsed.data.name, cost: parsed.data.cost, sellPrice: parsed.data.sellPrice },
  });
  await writeAuditLog(prisma, {
    entityType: "ProductService",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    beforeSnapshot: before ? JSON.parse(JSON.stringify(before)) : undefined,
    afterSnapshot: JSON.parse(JSON.stringify(product)),
  });
  revalidatePath("/master-data/products-services");
  return { ok: true };
}

export async function setProductServiceStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const product = await prisma.productService.update({ where: { id }, data: { status } });
  await writeAuditLog(prisma, {
    entityType: "ProductService",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(product)),
    notes: status === "ACTIVE" ? "Activated" : "Deactivated",
  });
  revalidatePath("/master-data/products-services");
  return { ok: true };
}

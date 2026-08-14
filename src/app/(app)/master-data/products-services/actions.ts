"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import type { ActionResult } from "@/lib/action-result";
import { productServiceSchema } from "./schema";

export async function createProductService(input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = productServiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.productService.create({
    data: { name: parsed.data.name, cost: parsed.data.cost, sellPrice: parsed.data.sellPrice },
  });
  revalidatePath("/master-data/products-services");
  return { ok: true };
}

export async function updateProductService(id: string, input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = productServiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.productService.update({
    where: { id },
    data: { name: parsed.data.name, cost: parsed.data.cost, sellPrice: parsed.data.sellPrice },
  });
  revalidatePath("/master-data/products-services");
  return { ok: true };
}

export async function setProductServiceStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  await prisma.productService.update({ where: { id }, data: { status } });
  revalidatePath("/master-data/products-services");
  return { ok: true };
}

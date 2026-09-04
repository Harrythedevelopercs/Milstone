"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
import { resolveUserNames } from "@/lib/user-names";
import type { ActionResult } from "@/lib/action-result";
import { productServiceSaleSchema } from "./schema";

export async function createProductServiceSale(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = productServiceSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.deductFromClientBalance && !d.clientId) {
    return { ok: false, error: "Select a client to deduct this sale from their balance." };
  }
  if (d.clientId) {
    const client = await prisma.client.findUnique({ where: { id: d.clientId } });
    if (!client || client.status !== "ACTIVE") return { ok: false, error: "Client not found or inactive." };
  }

  const saleDate = new Date(d.saleDate);
  if (Number.isNaN(saleDate.getTime())) return { ok: false, error: "Invalid sale date." };
  const accountingMonth = accountingMonthOf(saleDate);
  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const quantity = Number(d.quantity);
  const totalRevenue = new Decimal(d.unitSellPrice).times(quantity);
  const totalCost = new Decimal(d.unitCost).times(quantity);

  await prisma.$transaction(async (tx) => {
    const sale = await tx.productServiceSale.create({
      data: {
        productServiceId: d.productServiceId,
        clientId: d.clientId || null,
        businessUnitId: d.businessUnitId || null,
        quantity,
        unitCost: d.unitCost,
        unitSellPrice: d.unitSellPrice,
        totalRevenue: totalRevenue.toFixed(2),
        totalCost: totalCost.toFixed(2),
        saleDate,
        accountingMonth,
        deductFromClientBalance: d.deductFromClientBalance,
        notes: d.notes || null,
        createdById: user.id,
      },
    });

    if (d.deductFromClientBalance && d.clientId) {
      await tx.clientLedger.create({
        data: {
          clientId: d.clientId,
          entryDate: saleDate,
          accountingMonth,
          amount: totalRevenue.negated().toFixed(2),
          sourceType: "PRODUCT_SERVICE_SALE",
          sourceId: sale.id,
          productServiceSaleId: sale.id,
          description: `Product/service sale ${sale.id}`,
          createdById: user.id,
        },
      });
    }

    await writeAuditLog(tx, {
      entityType: "ProductServiceSale",
      entityId: sale.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(sale)),
    });
  });

  revalidatePath("/product-sales");
  revalidatePath("/client-ledger");
  return { ok: true };
}

export type ProductSaleFullDetail = {
  id: string;
  productServiceName: string;
  clientName: string | null;
  businessUnitName: string | null;
  quantity: number;
  unitCost: string;
  unitSellPrice: string;
  totalRevenue: string;
  totalCost: string;
  saleDate: string;
  accountingMonth: string;
  deductFromClientBalance: boolean;
  notes: string | null;
  createdByName: string;
  createdAt: string;
};

export async function getProductSaleFullDetail(id: string): Promise<ProductSaleFullDetail | null> {
  await requireUser();
  const ps = await prisma.productServiceSale.findUnique({
    where: { id },
    include: {
      productService: { select: { name: true } },
      client: { select: { name: true } },
      businessUnit: { select: { name: true } },
    },
  });
  if (!ps) return null;
  const names = await resolveUserNames([ps.createdById]);

  return {
    id: ps.id,
    productServiceName: ps.productService.name,
    clientName: ps.client?.name ?? null,
    businessUnitName: ps.businessUnit?.name ?? null,
    quantity: ps.quantity,
    unitCost: ps.unitCost.toString(),
    unitSellPrice: ps.unitSellPrice.toString(),
    totalRevenue: ps.totalRevenue.toString(),
    totalCost: ps.totalCost.toString(),
    saleDate: ps.saleDate.toISOString(),
    accountingMonth: ps.accountingMonth,
    deductFromClientBalance: ps.deductFromClientBalance,
    notes: ps.notes,
    createdByName: names.get(ps.createdById) ?? "—",
    createdAt: ps.createdAt.toISOString(),
  };
}

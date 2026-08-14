"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { accountingMonthOf } from "@/lib/transactions/transaction-id";
import { assertMonthOpen } from "@/lib/month-close/guard";
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

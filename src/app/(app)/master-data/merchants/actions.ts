"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/lib/action-result";
import { merchantSchema, merchantFeeRuleSchema } from "./schema";

function toData(parsed: ReturnType<typeof merchantSchema.safeParse>) {
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const d = parsed.data;
  return {
    name: d.name,
    companyId: d.companyId,
    businessUnitId: d.businessUnitId || null,
    processor: d.processor,
    settlementBankId: d.settlementBankId,
    dailyLimit: d.dailyLimit || null,
    monthlyLimit: d.monthlyLimit || null,
    perTxnLimit: d.perTxnLimit || null,
    settlementCycle: d.settlementCycle,
    defaultReservePercent: d.defaultReservePercent || "0",
  };
}

export async function createMerchant(input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = merchantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const merchant = await prisma.merchant.create({ data: toData(parsed) });
  await writeAuditLog(prisma, {
    entityType: "Merchant",
    entityId: merchant.id,
    action: "CREATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(merchant)),
  });
  revalidatePath("/master-data/merchants");
  return { ok: true };
}

export async function updateMerchant(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = merchantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const before = await prisma.merchant.findUnique({ where: { id } });
  const merchant = await prisma.merchant.update({ where: { id }, data: toData(parsed) });
  await writeAuditLog(prisma, {
    entityType: "Merchant",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    beforeSnapshot: before ? JSON.parse(JSON.stringify(before)) : undefined,
    afterSnapshot: JSON.parse(JSON.stringify(merchant)),
  });
  revalidatePath("/master-data/merchants");
  return { ok: true };
}

export async function setMerchantActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const merchant = await prisma.merchant.update({ where: { id }, data: { active } });
  await writeAuditLog(prisma, {
    entityType: "Merchant",
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(merchant)),
    notes: active ? "Activated" : "Deactivated",
  });
  revalidatePath("/master-data/merchants");
  return { ok: true };
}

export async function upsertMerchantFeeRule(
  merchantId: string,
  input: unknown
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const parsed = merchantFeeRuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const data = {
    feePercent: d.feePercent || "0",
    flatFee: d.flatFee || "0",
    chargebackFee: d.chargebackFee || "0",
    refundFee: d.refundFee || "0",
    monthlyFee: d.monthlyFee || "0",
  };

  const rule = await prisma.merchantFeeRule.upsert({
    where: {
      merchantId_paymentMethodId: { merchantId, paymentMethodId: d.paymentMethodId },
    },
    update: data,
    create: { merchantId, paymentMethodId: d.paymentMethodId, ...data },
  });
  await writeAuditLog(prisma, {
    entityType: "MerchantFeeRule",
    entityId: rule.id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(rule)),
  });

  revalidatePath("/master-data/merchants");
  return { ok: true };
}

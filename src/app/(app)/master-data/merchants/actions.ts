"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
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
    employeePartnerId: d.employeePartnerId || null,
    dailyLimit: d.dailyLimit || null,
    monthlyLimit: d.monthlyLimit || null,
    perTxnLimit: d.perTxnLimit || null,
    settlementCycle: d.settlementCycle,
    defaultReservePercent: d.defaultReservePercent || "0",
  };
}

export async function createMerchant(input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = merchantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.merchant.create({ data: toData(parsed) });
  revalidatePath("/master-data/merchants");
  return { ok: true };
}

export async function updateMerchant(id: string, input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = merchantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.merchant.update({ where: { id }, data: toData(parsed) });
  revalidatePath("/master-data/merchants");
  return { ok: true };
}

export async function setMerchantActive(id: string, active: boolean): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  await prisma.merchant.update({ where: { id }, data: { active } });
  revalidatePath("/master-data/merchants");
  return { ok: true };
}

export async function upsertMerchantFeeRule(
  merchantId: string,
  input: unknown
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
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

  await prisma.merchantFeeRule.upsert({
    where: {
      merchantId_paymentMethodId: { merchantId, paymentMethodId: d.paymentMethodId },
    },
    update: data,
    create: { merchantId, paymentMethodId: d.paymentMethodId, ...data },
  });

  revalidatePath("/master-data/merchants");
  return { ok: true };
}

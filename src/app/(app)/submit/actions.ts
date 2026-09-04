"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { createTransactionCore } from "@/lib/transactions/create-transaction-core";
import { getDefaultFeeBasis, resolveFeeBasis } from "@/lib/transactions/fee-basis";
import { getDefaultMerchantReserveBasis, resolveMerchantReserveBasis } from "@/lib/transactions/reserve-basis";
import { employeeTransactionSchema } from "./schema";

export type SubmitTransactionResult = { ok: true; id: string } | { ok: false; error: string };

// Employee entry screen: only client/date/method/gross/merchant/reference/
// notes/proof are collected (brief section 3). Everything economics-related
// (fee bearer, reserve %, manual fee override) is defaulted and stays
// invisible to the submitter -- they never see FP fee economics.
export async function submitTransaction(input: unknown): Promise<SubmitTransactionResult> {
  const user = await requireUser();
  const parsed = employeeTransactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [paymentMethod, client, systemDefaultFeeBasis, systemDefaultMerchantReserveBasis] = await Promise.all([
    prisma.paymentMethod.findUnique({ where: { id: d.paymentMethodId } }),
    prisma.client.findUnique({ where: { id: d.clientId } }),
    getDefaultFeeBasis(),
    getDefaultMerchantReserveBasis(),
  ]);
  if (!paymentMethod || paymentMethod.status !== "ACTIVE") {
    return { ok: false, error: "Payment method not found or inactive." };
  }
  const isDirect = !paymentMethod.requiresMerchant;
  // Economics stay invisible to the submitter -- resolve client default >
  // System Settings global default silently, same precedence as the
  // accountant's form minus the per-transaction override (not exposed here).
  const feeBasis = resolveFeeBasis({
    clientDefault: client?.defaultFeeBasis,
    systemDefault: systemDefaultFeeBasis,
  });
  const merchantReserveBasis = resolveMerchantReserveBasis({
    clientDefault: client?.defaultMerchantReserveBasis,
    systemDefault: systemDefaultMerchantReserveBasis,
  });

  let expectedBankId: string;
  let merchantReservePercent = "0";
  let merchantReserveDirection: "CLIENT_HELD" | "FP_FRONTED" | "FP_OWN" = "CLIENT_HELD";
  if (isDirect) {
    if (!d.bankAccountId) return { ok: false, error: "Bank account is required for a direct-to-bank method." };
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } });
    if (!bankAccount || !bankAccount.active) return { ok: false, error: "Bank account not found or inactive." };
    expectedBankId = bankAccount.id;
  } else {
    if (!d.merchantId) return { ok: false, error: "Merchant is required." };
    const merchant = await prisma.merchant.findUnique({ where: { id: d.merchantId } });
    if (!merchant || !merchant.active) {
      return { ok: false, error: "Merchant not found or inactive." };
    }
    expectedBankId = merchant.settlementBankId;
    // Economics stay invisible to the submitter -- resolve client-default >
    // merchant-default silently, same precedence as the accountant's form.
    merchantReservePercent =
      client?.defaultReserveType === "PERCENT" && client.defaultReserveValue
        ? client.defaultReserveValue.toString()
        : merchant.defaultReservePercent.toString();
    merchantReserveDirection = client?.defaultReserveDirection ?? merchant.defaultReserveDirection;
  }

  const result = await createTransactionCore({
    transactionDate: d.transactionDate,
    clientId: d.clientId,
    clientReference: d.clientReference || null,
    merchantId: isDirect ? null : d.merchantId || null,
    expectedBankId,
    paymentMethodId: d.paymentMethodId,
    grossAmount: d.grossAmount,
    feeBasis,
    feeBearer: "CLIENT",
    merchantFeeManual: null,
    merchantReservePercent,
    merchantReserveBasis,
    merchantReserveDirection,
    fpReservePercent: "0",
    documentUrl: d.documentUrl || null,
    notes: d.notes || null,
    createdById: user.id,
    status: "SUBMITTED",
  });

  if (result.ok) revalidatePath("/submit");
  return result;
}

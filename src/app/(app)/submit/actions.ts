"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { createTransactionCore } from "@/lib/transactions/create-transaction-core";
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

  const paymentMethod = await prisma.paymentMethod.findUnique({ where: { id: d.paymentMethodId } });
  if (!paymentMethod || paymentMethod.status !== "ACTIVE") {
    return { ok: false, error: "Payment method not found or inactive." };
  }
  const isDirect = !paymentMethod.requiresMerchant;

  let expectedBankId: string;
  let merchantReservePercent = "0";
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
    merchantReservePercent = merchant.defaultReservePercent.toString();
  }

  const result = await createTransactionCore({
    transactionDate: d.transactionDate,
    clientId: d.clientId,
    clientReference: d.clientReference || null,
    merchantId: isDirect ? null : d.merchantId || null,
    expectedBankId,
    paymentMethodId: d.paymentMethodId,
    grossAmount: d.grossAmount,
    feeBearer: "CLIENT",
    merchantFeeManual: null,
    merchantReservePercent,
    fpReservePercent: "0",
    documentUrl: d.documentUrl || null,
    notes: d.notes || null,
    createdById: user.id,
    status: "SUBMITTED",
  });

  if (result.ok) revalidatePath("/submit");
  return result;
}

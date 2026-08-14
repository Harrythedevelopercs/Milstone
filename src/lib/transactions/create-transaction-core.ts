import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { assertMonthOpen } from "@/lib/month-close/guard";
import { lookupClientRate, lookupMerchantFeeRule } from "./rate-lookup";
import { accountingMonthOf, nextTransactionId } from "./transaction-id";
import { postClientLedgerForTransaction } from "./post-ledger";
import {
  calculateClientNetPayable,
  calculateExpectedSettlement,
  calculateFpFee,
  calculateMerchantFeeFromRule,
  calculatePercentAmount,
  money,
} from "./money-math";

export type CoreTransactionInput = {
  transactionDate: string;
  clientId: string;
  clientReference: string | null;
  merchantId: string;
  expectedBankId: string;
  paymentMethodId: string;
  grossAmount: string;
  feeBearer: "FOUNDAPAY" | "CLIENT";
  merchantFeeManual: string | null;
  merchantReservePercent: string;
  fpReservePercent: string;
  documentUrl: string | null;
  notes: string | null;
  customerEmail?: string | null;
  cardLast4?: string | null;
  createdById: string;
  // SUBMITTED = awaiting accountant review (employee entry).
  // APPROVED = auto-approved (accountant/owner entering their own).
  status: "SUBMITTED" | "APPROVED";
};

export type CoreTransactionResult = { ok: true; id: string } | { ok: false; error: string };

export async function createTransactionCore(
  input: CoreTransactionInput
): Promise<CoreTransactionResult> {
  const [client, merchant] = await Promise.all([
    prisma.client.findUnique({ where: { id: input.clientId } }),
    prisma.merchant.findUnique({ where: { id: input.merchantId } }),
  ]);
  if (!client || client.status !== "ACTIVE") {
    return { ok: false, error: "Client not found or inactive." };
  }
  if (!merchant || !merchant.active) {
    return { ok: false, error: "Merchant not found or inactive." };
  }

  const transactionDate = new Date(input.transactionDate);
  if (Number.isNaN(transactionDate.getTime())) {
    return { ok: false, error: "Invalid transaction date." };
  }
  const accountingMonth = accountingMonthOf(transactionDate);

  const monthError = await assertMonthOpen(accountingMonth);
  if (monthError) return { ok: false, error: monthError };

  const rate = await lookupClientRate(input.clientId, input.paymentMethodId, transactionDate);
  if (!rate) {
    return {
      ok: false,
      error:
        "No rate is set up for this client and payment method as of this date. Add one under Master Data → Clients → Rates first.",
    };
  }

  const feeRule = await lookupMerchantFeeRule(input.merchantId, input.paymentMethodId);
  const gross = input.grossAmount;

  const merchantFeeDefault = feeRule
    ? calculateMerchantFeeFromRule(gross, feeRule.feePercent, feeRule.flatFee)
    : calculateMerchantFeeFromRule(gross, 0, 0);
  const merchantFeeManualProvided = input.merchantFeeManual !== null && input.merchantFeeManual !== "";
  const merchantFee = merchantFeeManualProvided ? input.merchantFeeManual! : merchantFeeDefault;
  const merchantFeeSource: "MANUAL" | "RULE_DEFAULT" = merchantFeeManualProvided
    ? "MANUAL"
    : "RULE_DEFAULT";

  const fpFee = calculateFpFee(gross, merchantFee, rate.ratePercent, rate.feeBasis);
  const merchantReserveAmount = calculatePercentAmount(gross, input.merchantReservePercent);
  const fpReserveAmount = calculatePercentAmount(gross, input.fpReservePercent);
  const expectedSettlement = calculateExpectedSettlement(gross, merchantFee, merchantReserveAmount);
  const clientNetPayable = calculateClientNetPayable({
    gross,
    merchantFee,
    merchantReserveAmount,
    fpFee,
    fpReserveAmount,
    feeBearer: input.feeBearer,
  });

  const isAutoApproved = input.status === "APPROVED";

  const created = await prisma.$transaction(async (tx) => {
    const id = await nextTransactionId(tx, accountingMonth);
    const row = await tx.transaction.create({
      data: {
        id,
        transactionDate,
        accountingMonth,
        clientId: input.clientId,
        clientReference: input.clientReference,
        companyId: merchant.companyId,
        merchantId: input.merchantId,
        expectedBankId: input.expectedBankId,
        employeePartnerId: merchant.employeePartnerId,
        businessUnitId: merchant.businessUnitId,
        paymentMethodId: input.paymentMethodId,
        grossAmount: gross,
        fpRatePercent: rate.ratePercent,
        feeBasis: rate.feeBasis,
        fpFee: money(fpFee),
        merchantFeeManual: merchantFeeManualProvided ? input.merchantFeeManual! : null,
        merchantFeeDefault: money(merchantFeeDefault),
        merchantFee: money(merchantFee),
        merchantFeeSource,
        feeBearer: input.feeBearer,
        merchantReservePercent: input.merchantReservePercent,
        merchantReserveAmount: money(merchantReserveAmount),
        fpReservePercent: input.fpReservePercent,
        fpReserveAmount: money(fpReserveAmount),
        expectedSettlement: money(expectedSettlement),
        clientNetPayable: money(clientNetPayable),
        status: input.status,
        documentUrl: input.documentUrl,
        notes: input.notes,
        customerEmail: input.customerEmail || null,
        cardLast4: input.cardLast4 || null,
        createdById: input.createdById,
        approvedById: isAutoApproved ? input.createdById : null,
        approvedAt: isAutoApproved ? new Date() : null,
      },
    });

    await writeAuditLog(tx, {
      entityType: "Transaction",
      entityId: row.id,
      transactionId: row.id,
      action: isAutoApproved ? "APPROVE" : "SUBMIT",
      performedById: input.createdById,
      afterSnapshot: JSON.parse(JSON.stringify(row)),
      notes: isAutoApproved ? "Auto-approved: entered by Accountant/Owner." : undefined,
    });

    if (isAutoApproved) {
      await postClientLedgerForTransaction(tx, {
        transactionId: row.id,
        clientId: row.clientId,
        amount: clientNetPayable,
        entryDate: row.transactionDate,
        accountingMonth: row.accountingMonth,
        createdById: input.createdById,
      });
    }

    return row;
  });

  return { ok: true, id: created.id };
}

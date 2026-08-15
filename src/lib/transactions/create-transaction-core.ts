import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { assertMonthOpen } from "@/lib/month-close/guard";
import { postBankLedgerEntry } from "@/lib/ledger/post-bank-ledger";
import { lookupClientRate, lookupMerchantFeeRule } from "./rate-lookup";
import { accountingMonthOf, nextTransactionId } from "./transaction-id";
import { postClientLedgerForTransaction } from "./post-ledger";
import {
  calculateClientNetPayable,
  calculateExpectedSettlement,
  calculateFpFee,
  calculatePercentAmount,
  calculateMerchantFeeFromRule,
  money,
} from "./money-math";

export type CoreTransactionInput = {
  transactionDate: string;
  clientId: string;
  clientReference: string | null;
  // Null for a direct-to-bank payment (payment method's requiresMerchant is
  // false) -- expectedBankId is then the bank the money actually landed in,
  // chosen directly rather than derived from a merchant's settlement bank.
  merchantId: string | null;
  // Only meaningful when merchantId is null (direct-to-bank). For a merchant
  // transaction the bank is always silently re-derived server-side from
  // merchant.settlementBankId, regardless of what's passed here -- never
  // trust the client for which bank a merchant settles into.
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
  const [client, paymentMethod, merchant] = await Promise.all([
    prisma.client.findUnique({ where: { id: input.clientId } }),
    prisma.paymentMethod.findUnique({ where: { id: input.paymentMethodId } }),
    input.merchantId
      ? prisma.merchant.findUnique({
          where: { id: input.merchantId },
          include: { company: { select: { employeePartnerId: true } } },
        })
      : null,
  ]);
  if (!client || client.status !== "ACTIVE") {
    return { ok: false, error: "Client not found or inactive." };
  }
  if (!paymentMethod || paymentMethod.status !== "ACTIVE") {
    return { ok: false, error: "Payment method not found or inactive." };
  }
  const isDirect = !paymentMethod.requiresMerchant;
  if (isDirect && input.merchantId) {
    return { ok: false, error: `${paymentMethod.name} is a direct-to-bank method and cannot have a merchant.` };
  }
  if (!isDirect && !input.merchantId) {
    return { ok: false, error: `${paymentMethod.name} requires a merchant.` };
  }
  if (!isDirect && (!merchant || !merchant.active)) {
    return { ok: false, error: "Merchant not found or inactive." };
  }

  // Silent, server-enforced: a merchant transaction always settles into that
  // merchant's configured bank, never a client-submitted one.
  const effectiveBankId = isDirect ? input.expectedBankId : merchant!.settlementBankId;
  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: effectiveBankId } });
  if (!bankAccount || !bankAccount.active) {
    return {
      ok: false,
      error: isDirect
        ? "Bank account not found or inactive."
        : `${merchant!.name}'s configured settlement bank is not found or inactive.`,
    };
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

  const gross = input.grossAmount;

  // Direct-to-bank: no merchant, so no merchant fee/reserve at all -- forced
  // to zero regardless of what was submitted, not just defaulted.
  const feeRule = isDirect || !merchant
    ? null
    : await lookupMerchantFeeRule(merchant.id, input.paymentMethodId);
  const merchantFeeDefault = isDirect
    ? calculateMerchantFeeFromRule(0, 0, 0)
    : feeRule
      ? calculateMerchantFeeFromRule(gross, feeRule.feePercent, feeRule.flatFee)
      : calculateMerchantFeeFromRule(gross, 0, 0);
  const merchantFeeManualProvided =
    !isDirect && input.merchantFeeManual !== null && input.merchantFeeManual !== "";
  const merchantFee = isDirect
    ? "0"
    : merchantFeeManualProvided
      ? input.merchantFeeManual!
      : merchantFeeDefault;
  const merchantFeeSource: "MANUAL" | "RULE_DEFAULT" = merchantFeeManualProvided
    ? "MANUAL"
    : "RULE_DEFAULT";
  const merchantReservePercent = isDirect ? "0" : input.merchantReservePercent;

  const fpFee = calculateFpFee(gross, merchantFee, rate.ratePercent, rate.feeBasis);
  const merchantReserveAmount = calculatePercentAmount(gross, merchantReservePercent);
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
  // A direct payment's cash is already in the bank the moment it's approved
  // -- there's no processor deposit to wait on, so it goes straight to
  // Settled instead of sitting at Approved awaiting a settlement batch.
  const finalStatus = isAutoApproved && isDirect ? "SETTLED" : input.status;

  const created = await prisma.$transaction(async (tx) => {
    const id = await nextTransactionId(tx, accountingMonth);
    const row = await tx.transaction.create({
      data: {
        id,
        transactionDate,
        accountingMonth,
        clientId: input.clientId,
        clientReference: input.clientReference,
        companyId: isDirect ? bankAccount.companyId : merchant!.companyId,
        merchantId: input.merchantId,
        expectedBankId: effectiveBankId,
        employeePartnerId: isDirect ? null : merchant!.company.employeePartnerId,
        businessUnitId: isDirect ? null : merchant!.businessUnitId,
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
        merchantReservePercent,
        merchantReserveAmount: money(merchantReserveAmount),
        fpReservePercent: input.fpReservePercent,
        fpReserveAmount: money(fpReserveAmount),
        expectedSettlement: money(expectedSettlement),
        clientNetPayable: money(clientNetPayable),
        status: finalStatus,
        settlementDate: isAutoApproved && isDirect ? transactionDate : null,
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

      if (isDirect) {
        await postBankLedgerEntry(tx, {
          bankAccountId: effectiveBankId,
          amount: money(gross),
          entryDate: row.transactionDate,
          accountingMonth: row.accountingMonth,
          sourceType: "TRANSACTION",
          sourceId: row.id,
          description: `Direct ${paymentMethod.name} received from ${client.name}`,
          createdById: input.createdById,
        });
      }
    }

    return row;
  });

  return { ok: true, id: created.id };
}

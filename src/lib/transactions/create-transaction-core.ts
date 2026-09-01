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
  calculateNetAmountReceived,
  calculatePercentAmount,
  calculateMerchantFeeFromRule,
  money,
  type FeeBasis,
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
  // Resolved by the caller via the three-level precedence (per-transaction
  // override > client default > System Settings global default -- see
  // src/lib/transactions/fee-basis.ts). Required rather than defaulted here
  // so every caller resolves it explicitly instead of silently falling back.
  feeBasis: FeeBasis;
  feeBearer: "FOUNDAPAY" | "CLIENT";
  merchantFeeManual: string | null;
  merchantReservePercent: string;
  // Who the merchant reserve is ultimately owed to/by -- see the
  // ReserveDirection enum comment. Defaults to CLIENT_HELD (the historical
  // behavior) so existing callers that don't pass this keep working
  // unchanged. Only meaningful when merchantReservePercent > 0; the FP
  // reserve (fpReservePercent) is always FP_OWN, no direction to pick.
  merchantReserveDirection?: "CLIENT_HELD" | "FP_FRONTED" | "FP_OWN";
  fpReservePercent: string;
  documentUrl: string | null;
  notes: string | null;
  customerEmail?: string | null;
  cardLast4?: string | null;
  createdById: string;
  // SUBMITTED = awaiting accountant review (employee entry).
  // APPROVED = auto-approved (accountant/owner entering their own).
  status: "SUBMITTED" | "APPROVED";
  // Defaults to the client's configured rate (PERCENTAGE) when omitted.
  chargeType?: "PERCENTAGE" | "FIXED" | "NONE";
  fixedChargeAmount?: string | null;
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
  const merchantReserveDirection = input.merchantReserveDirection ?? "CLIENT_HELD";

  const chargeType = input.chargeType ?? "PERCENTAGE";
  const netAmountReceived = calculateNetAmountReceived(gross, merchantFee);
  const fpFee = calculateFpFee(
    gross,
    merchantFee,
    rate.ratePercent,
    input.feeBasis,
    chargeType,
    input.fixedChargeAmount
  );
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
        feeBasis: input.feeBasis,
        netAmountReceived: money(netAmountReceived),
        fpFee: money(fpFee),
        chargeType,
        fixedChargeAmount: chargeType === "FIXED" ? money(input.fixedChargeAmount ?? 0) : null,
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

      // FP_FRONTED: FoundaPay is putting up its own money as this reserve on
      // the client's behalf, so the client owes it back -- post that as an
      // immediate receivable charge (same mechanism as a client-behalf
      // expense) so it's visible on the client's ledger/statement right
      // away, not just once the reserve is eventually settled.
      if (Number(merchantReserveAmount) > 0 && merchantReserveDirection === "FP_FRONTED") {
        await tx.clientLedger.create({
          data: {
            clientId: row.clientId,
            entryDate: row.transactionDate,
            accountingMonth: row.accountingMonth,
            amount: `-${money(merchantReserveAmount)}`,
            sourceType: "RESERVE",
            sourceId: row.id,
            transactionId: row.id,
            description: `Reserve fronted by FoundaPay -- owed back (${row.id})`,
            createdById: input.createdById,
          },
        });
      }
    }

    // A merchant reserve is money the processor is holding back out of this
    // transaction, tracked with its own append-only resolution history
    // (see ReserveDirection) rather than vanishing or being silently
    // consumed by a chargeback -- that's always a manual action on the hold.
    if (Number(merchantReserveAmount) > 0) {
      await tx.reserveHold.create({
        data: {
          transactionId: row.id,
          merchantId: input.merchantId,
          direction: merchantReserveDirection,
          originalAmount: money(merchantReserveAmount),
          heldSince: row.transactionDate,
          createdById: input.createdById,
        },
      });
    }
    if (Number(fpReserveAmount) > 0) {
      await tx.reserveHold.create({
        data: {
          transactionId: row.id,
          merchantId: input.merchantId,
          direction: "FP_OWN",
          originalAmount: money(fpReserveAmount),
          heldSince: row.transactionDate,
          createdById: input.createdById,
        },
      });
    }

    return row;
  });

  return { ok: true, id: created.id };
}

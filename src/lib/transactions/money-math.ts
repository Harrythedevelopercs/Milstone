import Decimal from "decimal.js";

export type FeeBasis = "GROSS" | "AFTER_MERCHANT_CHARGES";
export type FeeBearer = "FOUNDAPAY" | "CLIENT";
export type ChargeType = "PERCENTAGE" | "FIXED" | "NONE";

function pct(value: Decimal.Value): Decimal {
  return new Decimal(value).div(100);
}

// Gross minus the merchant's processing fee -- the base FP's fee is
// calculated on when feeBasis is AFTER_MERCHANT_CHARGES. Equals gross
// itself when feeBasis is GROSS (nothing netted out), but this function
// always returns the true net figure regardless of feeBasis, for display
// (the "Net Amount Received" field) independent of which base is chosen.
export function calculateNetAmountReceived(
  gross: Decimal.Value,
  merchantFee: Decimal.Value
): Decimal {
  return new Decimal(gross).minus(merchantFee);
}

// PERCENTAGE (default): gross * rate% if Gross; netAmountReceived * rate%
// if After Merchant Charges -- the client's configured rate, unchanged from
// before charge types existed. FIXED: the entered dollar amount, verbatim,
// independent of gross/merchantFee. NONE: no FP fee at all.
export function calculateFpFee(
  gross: Decimal.Value,
  merchantFee: Decimal.Value,
  ratePercent: Decimal.Value,
  feeBasis: FeeBasis,
  chargeType: ChargeType = "PERCENTAGE",
  fixedChargeAmount?: Decimal.Value | null
): Decimal {
  if (chargeType === "NONE") return new Decimal(0);
  if (chargeType === "FIXED") return new Decimal(fixedChargeAmount ?? 0);
  const rate = pct(ratePercent);
  const base = feeBasis === "GROSS" ? new Decimal(gross) : calculateNetAmountReceived(gross, merchantFee);
  return base.mul(rate);
}

export function calculateMerchantFeeFromRule(
  gross: Decimal.Value,
  feePercent: Decimal.Value,
  flatFee: Decimal.Value
): Decimal {
  return new Decimal(gross).mul(pct(feePercent)).plus(flatFee);
}

export function calculatePercentAmount(gross: Decimal.Value, percent: Decimal.Value): Decimal {
  return new Decimal(gross).mul(pct(percent));
}

// gross - merchantFee - merchantReserve, per the brief's explicit formula.
export function calculateExpectedSettlement(
  gross: Decimal.Value,
  merchantFee: Decimal.Value,
  merchantReserveAmount: Decimal.Value
): Decimal {
  return new Decimal(gross).minus(merchantFee).minus(merchantReserveAmount);
}

// What FoundaPay owes the client from this transaction: settlement proceeds
// minus FP's own fee and reserve. If FoundaPay bears the merchant fee, that
// fee is not deducted from the client (FP absorbs it instead).
export function calculateClientNetPayable(params: {
  gross: Decimal.Value;
  merchantFee: Decimal.Value;
  merchantReserveAmount: Decimal.Value;
  fpFee: Decimal.Value;
  fpReserveAmount: Decimal.Value;
  feeBearer: FeeBearer;
}): Decimal {
  const base = new Decimal(params.gross)
    .minus(params.merchantReserveAmount)
    .minus(params.fpFee)
    .minus(params.fpReserveAmount);
  return params.feeBearer === "CLIENT" ? base.minus(params.merchantFee) : base;
}

export function money(value: Decimal.Value): string {
  return new Decimal(value).toFixed(2);
}

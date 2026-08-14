import Decimal from "decimal.js";

export type FeeBasis = "GROSS" | "AFTER_MERCHANT_CHARGES";
export type FeeBearer = "FOUNDAPAY" | "CLIENT";

function pct(value: Decimal.Value): Decimal {
  return new Decimal(value).div(100);
}

// gross * rate% if Gross; (gross - merchantFee) * rate% if After Merchant Charges.
export function calculateFpFee(
  gross: Decimal.Value,
  merchantFee: Decimal.Value,
  ratePercent: Decimal.Value,
  feeBasis: FeeBasis
): Decimal {
  const g = new Decimal(gross);
  const rate = pct(ratePercent);
  if (feeBasis === "GROSS") return g.mul(rate);
  return g.minus(merchantFee).mul(rate);
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

// Pure, presentation-layer reconstruction of a transaction's calculation
// chain from its already-stored fields -- used by both the Breakdown button
// on the Received list and the board's transaction detail dialog, so the
// two never drift out of sync with each other.
export type BreakdownTransaction = {
  id: string;
  grossAmount: string;
  feeBasis: "GROSS" | "AFTER_MERCHANT_CHARGES";
  netAmountReceived: string;
  fpRatePercent: string;
  chargeType: "PERCENTAGE" | "FIXED" | "NONE";
  fpFee: string;
  merchantFee: string;
  feeBearer: "FOUNDAPAY" | "CLIENT";
  merchantReservePercent: string;
  merchantReserveBasis: "GROSS" | "AFTER_MERCHANT_CHARGES";
  merchantReserveAmount: string;
  fpReservePercent: string;
  fpReserveAmount: string;
  clientNetPayable: string | null;
};

export type BreakdownLine = {
  label: string;
  detail?: string;
  amount: number;
  isSubtotal?: boolean;
  runningTotal: number;
};

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function basisLabel(basis: "GROSS" | "AFTER_MERCHANT_CHARGES"): string {
  return basis === "GROSS" ? "Gross Amount" : "Net Amount Received";
}

export function buildBreakdownLines(t: BreakdownTransaction): BreakdownLine[] {
  const gross = Number(t.grossAmount);
  const merchantFee = Number(t.merchantFee);
  const netAmountReceived = Number(t.netAmountReceived);
  const fpFee = Number(t.fpFee);
  const merchantReserveAmount = Number(t.merchantReserveAmount);
  const fpReserveAmount = Number(t.fpReserveAmount);

  const lines: BreakdownLine[] = [];
  let running = gross;
  lines.push({ label: "Gross Amount", amount: gross, runningTotal: running });

  running -= merchantFee;
  lines.push({
    label: "Merchant Charges",
    detail: `Bearer: ${t.feeBearer === "CLIENT" ? "Client" : "FoundaPay"}`,
    amount: -merchantFee,
    runningTotal: running,
  });

  lines.push({
    label: "Net Amount Received",
    detail: "Gross Amount minus Merchant Charges",
    amount: netAmountReceived,
    isSubtotal: true,
    runningTotal: running,
  });

  running -= fpFee;
  const fpFeeDetail =
    t.chargeType === "NONE"
      ? "No charge"
      : t.chargeType === "FIXED"
        ? "Fixed amount"
        : `${Number(t.fpRatePercent).toFixed(2)}% of ${basisLabel(t.feeBasis)} (${money(
            t.feeBasis === "GROSS" ? gross : netAmountReceived
          )})`;
  lines.push({ label: "FP Fee", detail: fpFeeDetail, amount: -fpFee, runningTotal: running });

  running -= merchantReserveAmount;
  lines.push({
    label: "Merchant Reserve",
    detail: `${Number(t.merchantReservePercent).toFixed(2)}% of ${basisLabel(t.merchantReserveBasis)} (${money(
      t.merchantReserveBasis === "GROSS" ? gross : netAmountReceived
    )})`,
    amount: -merchantReserveAmount,
    runningTotal: running,
  });

  running -= fpReserveAmount;
  lines.push({
    label: "FP Reserve",
    detail: `${Number(t.fpReservePercent).toFixed(2)}% of Gross Amount`,
    amount: -fpReserveAmount,
    runningTotal: running,
  });

  if (t.feeBearer === "FOUNDAPAY") {
    running += merchantFee;
    lines.push({
      label: "Merchant Charges added back",
      detail: "FoundaPay absorbs this fee -- not deducted from your payout",
      amount: merchantFee,
      runningTotal: running,
    });
  }

  // The actual stored Client Net Payable is the ground truth -- what really
  // posted to the client ledger -- not this line-by-line resum, which can be
  // a cent off from it under the FINAL rounding stage (see the mismatch note
  // wherever these lines are rendered). Prefer the stored figure for the
  // headline final line.
  const storedFinal = t.clientNetPayable === null ? null : Number(t.clientNetPayable);
  lines.push({
    label: "Client Net Payable",
    amount: storedFinal ?? running,
    isSubtotal: true,
    runningTotal: storedFinal ?? running,
  });

  return lines;
}

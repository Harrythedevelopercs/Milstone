"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function basisLabel(basis: "GROSS" | "AFTER_MERCHANT_CHARGES"): string {
  return basis === "GROSS" ? "Gross Amount" : "Net Amount Received";
}

type Line = {
  label: string;
  detail?: string;
  amount: number;
  isSubtotal?: boolean;
  runningTotal: number;
};

function buildLines(t: BreakdownTransaction): Line[] {
  const gross = Number(t.grossAmount);
  const merchantFee = Number(t.merchantFee);
  const netAmountReceived = Number(t.netAmountReceived);
  const fpFee = Number(t.fpFee);
  const merchantReserveAmount = Number(t.merchantReserveAmount);
  const fpReserveAmount = Number(t.fpReserveAmount);

  const lines: Line[] = [];
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
  // a cent off from it under the FINAL rounding stage (see the note below
  // the table). Prefer the stored figure for the headline final line.
  const storedFinal = t.clientNetPayable === null ? null : Number(t.clientNetPayable);
  lines.push({
    label: "Client Net Payable",
    amount: storedFinal ?? running,
    isSubtotal: true,
    runningTotal: storedFinal ?? running,
  });

  return lines;
}

export function TransactionBreakdownAction({ transaction }: { transaction: BreakdownTransaction }) {
  const [open, setOpen] = useState(false);
  const lines = buildLines(transaction);
  // Resum of the actual delta line items as displayed (each already rounded
  // to cents) -- excludes subtotal lines (Net Amount Received, Client Net
  // Payable itself), which restate a running total rather than contribute a
  // separate amount. Compared against the stored final figure to detect the
  // FINAL-stage rounding effect (see note below).
  const computedFromLines = lines.filter((l) => !l.isSubtotal).reduce((sum, l) => sum + l.amount, 0);
  const storedFinal = transaction.clientNetPayable === null ? null : Number(transaction.clientNetPayable);
  const mismatch = storedFinal !== null && Math.abs(computedFromLines - storedFinal) >= 0.005;

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Breakdown
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Calculation breakdown — {transaction.id}</DialogTitle>
            <DialogDescription>
              Every step from Gross Amount down to Client Net Payable, in order, with the
              running total after each line -- so you can compare it line-by-line against a
              manual calculation.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border text-sm">
            <table className="w-full">
              <tbody>
                {lines.map((l, i) => (
                  <tr
                    key={i}
                    className={l.isSubtotal ? "bg-muted/50 font-medium" : "border-t"}
                  >
                    <td className="px-3 py-2 align-top">
                      <div>{l.label}</div>
                      {l.detail && (
                        <div className="text-xs font-normal text-muted-foreground">{l.detail}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top">
                      {l.isSubtotal || l.amount === 0 ? "" : l.amount > 0 ? "+" : "-"}
                      {money(Math.abs(l.amount))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top text-muted-foreground">
                      = {money(l.runningTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mismatch && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
              Summing the rounded line items above gives {money(computedFromLines)}, one cent off
              the actual Client Net Payable of {money(storedFinal!)} shown below. This is the
              Rounding Rule in effect for this transaction: FP Fee and Merchant Reserve are shown
              individually rounded to cents, but Client Net Payable was computed from their
              full-precision values before rounding once at the end -- so the rounded line items
              don&apos;t always add up to the exact rounded total. Switch the Rounding Rule
              (System Settings) to &quot;Round each component&quot; to make every future
              transaction&apos;s line items always sum exactly.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            All amounts are rounded to cents as computed and stored -- see the Rounding Rule in
            System Settings for how each step&apos;s rounding is controlled.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

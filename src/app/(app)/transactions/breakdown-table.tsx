"use client";

import { buildBreakdownLines, money, type BreakdownTransaction } from "@/lib/transactions/breakdown";

export function BreakdownTable({ transaction }: { transaction: BreakdownTransaction }) {
  const lines = buildBreakdownLines(transaction);
  // Resum of the actual delta line items as displayed (each already rounded
  // to cents) -- excludes subtotal lines (Net Amount Received, Client Net
  // Payable itself), which restate a running total rather than contribute a
  // separate amount. Compared against the stored final figure to detect the
  // FINAL-stage rounding effect (see note below).
  const computedFromLines = lines.filter((l) => !l.isSubtotal).reduce((sum, l) => sum + l.amount, 0);
  const storedFinal = transaction.clientNetPayable === null ? null : Number(transaction.clientNetPayable);
  const mismatch = storedFinal !== null && Math.abs(computedFromLines - storedFinal) >= 0.005;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border text-sm">
        <table className="w-full">
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className={l.isSubtotal ? "bg-muted/50 font-medium" : "border-t"}>
                <td className="px-3 py-2 align-top">
                  <div>{l.label}</div>
                  {l.detail && <div className="text-xs font-normal text-muted-foreground">{l.detail}</div>}
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
          Summing the rounded line items above gives {money(computedFromLines)}, one cent off the
          actual Client Net Payable of {money(storedFinal!)} shown below. This is the Rounding
          Rule in effect for this transaction: FP Fee and Merchant Reserve are shown individually
          rounded to cents, but Client Net Payable was computed from their full-precision values
          before rounding once at the end -- so the rounded line items don&apos;t always add up to
          the exact rounded total. Switch the Rounding Rule (System Settings) to &quot;Round each
          component&quot; to make every future transaction&apos;s line items always sum exactly.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        All amounts are rounded to cents as computed and stored -- see the Rounding Rule in
        System Settings for how each step&apos;s rounding is controlled.
      </p>
    </div>
  );
}

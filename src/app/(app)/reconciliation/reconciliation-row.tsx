"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToneBadge } from "@/components/ui/tone-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import { recordBankReconciliation } from "../cash-position/actions";

export function ReconciliationRow({
  bankAccountId,
  name,
  accountType,
  bookBalance,
  reconciledThisMonth,
  lastReconciledAsOf,
}: {
  bankAccountId: string;
  name: string;
  accountType: string;
  bookBalance: string;
  reconciledThisMonth: boolean;
  lastReconciledAsOf: string | null;
}) {
  const { run, isPending } = useCrudAction();
  const [actualBalance, setActualBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const difference =
    actualBalance === "" ? null : new Decimal(actualBalance || 0).minus(bookBalance);

  function submit() {
    run(
      () => recordBankReconciliation(bankAccountId, { asOfDate, actualBalance, notes }),
      {
        successMessage: "Reconciliation recorded",
        onSuccess: () => {
          setActualBalance("");
          setNotes("");
        },
      }
    );
  }

  return (
    <div className="grid grid-cols-12 items-end gap-3 border-b px-4 py-3 text-sm last:border-b-0">
      <div className="col-span-3">
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{accountType}</p>
      </div>
      <div className="col-span-2">
        <p className="text-xs text-muted-foreground">Book balance</p>
        <p className="font-medium">{bookBalance}</p>
      </div>
      <div className="col-span-2">
        <label className="text-xs text-muted-foreground">Actual (statement)</label>
        <Input
          type="number"
          step="0.01"
          value={actualBalance}
          onChange={(e) => setActualBalance(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="col-span-2">
        <p className="text-xs text-muted-foreground">Difference</p>
        <p
          className={`font-medium ${
            difference === null
              ? "text-muted-foreground"
              : difference.isZero()
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
          }`}
        >
          {difference === null ? "—" : difference.toFixed(2)}
        </p>
      </div>
      <div className="col-span-1">
        <label className="text-xs text-muted-foreground">As of</label>
        <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
      </div>
      <div className="col-span-1 flex flex-col items-end gap-1">
        <ToneBadge tone={reconciledThisMonth ? "success" : "warning"}>
          {reconciledThisMonth ? "Reconciled" : "Not yet"}
        </ToneBadge>
        {lastReconciledAsOf && (
          <p className="text-[10px] text-muted-foreground">Last: {lastReconciledAsOf}</p>
        )}
      </div>
      <div className="col-span-1 text-right">
        <Button size="sm" onClick={submit} disabled={isPending || actualBalance === ""}>
          {isPending ? "Saving..." : "Record"}
        </Button>
      </div>
    </div>
  );
}

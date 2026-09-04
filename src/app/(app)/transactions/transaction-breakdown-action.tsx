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
import { BreakdownTable } from "./breakdown-table";
import type { BreakdownTransaction } from "@/lib/transactions/breakdown";

export type { BreakdownTransaction };

export function TransactionBreakdownAction({ transaction }: { transaction: BreakdownTransaction }) {
  const [open, setOpen] = useState(false);

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
          <BreakdownTable transaction={transaction} />
        </DialogContent>
      </Dialog>
    </>
  );
}

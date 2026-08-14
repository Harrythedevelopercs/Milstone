"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCrudAction } from "@/hooks/use-crud-action";
import { markTransactionSettled } from "./actions";

export function MarkSettledAction({ id, status }: { id: string; status: string }) {
  const { run, isPending } = useCrudAction();
  const [open, setOpen] = useState(false);
  const [settlementDate, setSettlementDate] = useState(format(new Date(), "yyyy-MM-dd"));

  if (status !== "APPROVED") return null;

  function submit() {
    run(() => markTransactionSettled(id, settlementDate), {
      successMessage: "Marked settled",
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Mark as Settled
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark transaction as settled</DialogTitle>
            <DialogDescription>
              Record the actual date this transaction settled. This does not affect payout
              eligibility -- you can already remit against it.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="date"
            value={settlementDate}
            onChange={(e) => setSettlementDate(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isPending || !settlementDate}>
              {isPending ? "Saving..." : "Mark as Settled"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCrudAction } from "@/hooks/use-crud-action";
import { holdTransaction, releaseHold } from "./actions";

const HOLDABLE = new Set(["APPROVED", "SETTLED", "CLIENT_PAYABLE", "PARTIALLY_PAID"]);

export function HoldAction({ id, status }: { id: string; status: string }) {
  const { run, isPending } = useCrudAction();
  const [open, setOpen] = useState(false);
  const [expectedSettlementDate, setExpectedSettlementDate] = useState(
    format(addDays(new Date(), 7), "yyyy-MM-dd")
  );
  const [note, setNote] = useState("");

  if (status === "HOLD") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => run(() => releaseHold(id), { successMessage: "Hold released" })}
      >
        {isPending ? "Releasing..." : "Release Hold"}
      </Button>
    );
  }

  if (!HOLDABLE.has(status)) return null;

  function submit() {
    run(() => holdTransaction(id, { expectedSettlementDate, note }), {
      successMessage: "Transaction held, reminder set",
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Hold
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold this transaction</DialogTitle>
            <DialogDescription>
              For when settlement is delayed. Set the expected settlement date -- a reminder
              shows up on the Dashboard until you release the hold, which restores this
              transaction to exactly its status before ({status.charAt(0) + status.slice(1).toLowerCase()}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Expected settlement date</label>
              <Input
                type="date"
                value={expectedSettlementDate}
                onChange={(e) => setExpectedSettlementDate(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Note (optional)</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isPending || !expectedSettlementDate}>
              {isPending ? "Saving..." : "Hold Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

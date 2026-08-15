"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCrudAction } from "@/hooks/use-crud-action";
import { deleteClientPayout } from "./actions";

export function DeletePayoutAction({ id, monthOpen }: { id: string; monthOpen: boolean }) {
  const { run, isPending } = useCrudAction();
  const [open, setOpen] = useState(false);

  if (!monthOpen) {
    return (
      <Button size="sm" variant="ghost" disabled title="This payout's month is closed">
        <Trash2 className="size-4" />
      </Button>
    );
  }

  function submit() {
    run(() => deleteClientPayout(id), {
      successMessage: "Payout deleted",
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        title="Delete payout"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this payout?</DialogTitle>
            <DialogDescription>
              This removes the payout entirely and reverses its effect on the client ledger and
              bank balance (including any FoundaPay-borne remittance fee). Every transaction this
              payout was allocated to reverts to Paid, Partially Paid, or Approved based on what
              it still has allocated elsewhere. This action is logged in the audit trail and
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

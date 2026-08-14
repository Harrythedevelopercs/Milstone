"use client";

import { useState } from "react";
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
import { deleteSettlementBatch } from "./actions";

export function DeleteSettlementBatchAction({ id, monthOpen }: { id: string; monthOpen: boolean }) {
  const { run, isPending } = useCrudAction();
  const [open, setOpen] = useState(false);

  if (!monthOpen) {
    return (
      <Button size="sm" variant="ghost" disabled title="This batch's month is closed">
        Delete
      </Button>
    );
  }

  function submit() {
    run(() => deleteSettlementBatch(id), {
      successMessage: "Settlement batch deleted",
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete settlement batch?</DialogTitle>
            <DialogDescription>
              This removes the batch entirely and reverses its bank deposit with a new offsetting
              entry. Any of its transactions still exactly &quot;Client Payable&quot; revert to
              &quot;Approved&quot; and unbatch. If any transaction has already been paid,
              refunded, charged back, or edited since this batch was created, deletion is
              blocked -- nothing is silently overwritten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

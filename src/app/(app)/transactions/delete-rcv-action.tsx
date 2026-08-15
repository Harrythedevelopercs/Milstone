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
import { deleteRcv } from "./actions";

export function DeleteRcvAction({ id, monthOpen }: { id: string; monthOpen: boolean }) {
  const { run, isPending } = useCrudAction();
  const [open, setOpen] = useState(false);

  if (!monthOpen) {
    return (
      <Button size="sm" variant="ghost" disabled title="This entry's month is closed">
        <Trash2 className="size-4" />
      </Button>
    );
  }

  function submit() {
    run(() => deleteRcv(id), {
      successMessage: "Entry deleted, transaction restored",
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        title="Delete this refund/chargeback/void"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this entry?</DialogTitle>
            <DialogDescription>
              This undoes the refund, chargeback, or void: its client-ledger and bank-ledger
              entries are removed, and the original transaction returns to the status it had
              right before this entry was recorded. This action is logged in the audit trail
              and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

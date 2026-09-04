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
import { deleteTransaction } from "./actions";

export function DeleteTransactionAction({
  id,
  monthOpen,
  onSuccess,
}: {
  id: string;
  monthOpen: boolean;
  onSuccess?: () => void;
}) {
  const { run, isPending } = useCrudAction();
  const [open, setOpen] = useState(false);

  if (!monthOpen) {
    return (
      <Button size="sm" variant="ghost" disabled title="This transaction's month is closed">
        <Trash2 className="size-4" />
      </Button>
    );
  }

  function submit() {
    run(() => deleteTransaction(id), {
      successMessage: "Transaction deleted",
      onSuccess: () => {
        setOpen(false);
        onSuccess?.();
      },
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        title="Delete transaction"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this transaction?</DialogTitle>
            <DialogDescription>
              This removes the transaction entirely and recomputes all related balances -- client
              ledger, bank balance, merchant balance, and FP revenue. Any linked refund, chargeback,
              or void is removed too, reversing their ledger effects. Blocked if the transaction has
              already been paid out to the client (use Refund/Chargeback instead) or is part of a
              settlement batch (remove it from the batch first). This action is logged in the audit
              trail and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { approveTransaction, rejectTransaction, requestTransactionDetails } from "./actions";

export function ReviewActions({
  id,
  status,
  onSuccess,
}: {
  id: string;
  status: string;
  onSuccess?: () => void;
}) {
  const { run, isPending } = useCrudAction();
  const [dialog, setDialog] = useState<"reject" | "details" | null>(null);
  const [reason, setReason] = useState("");

  if (status !== "SUBMITTED" && status !== "DETAILS_REQUESTED") return null;

  function approve() {
    run(() => approveTransaction(id), { successMessage: "Approved", onSuccess });
  }

  function submitDialog() {
    if (dialog === "reject") {
      run(() => rejectTransaction(id, reason), {
        successMessage: "Rejected",
        onSuccess: () => {
          setDialog(null);
          setReason("");
          onSuccess?.();
        },
      });
    } else if (dialog === "details") {
      run(() => requestTransactionDetails(id, reason), {
        successMessage: "Details requested",
        onSuccess: () => {
          setDialog(null);
          setReason("");
          onSuccess?.();
        },
      });
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" onClick={approve} disabled={isPending}>
        Approve
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDialog("reject")}>
        Reject
      </Button>
      {status === "SUBMITTED" && (
        <Button size="sm" variant="ghost" onClick={() => setDialog("details")}>
          Request Details
        </Button>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "reject" ? "Reject transaction" : "Request details"}</DialogTitle>
            <DialogDescription>
              {dialog === "reject"
                ? "Explain why this is being rejected. The submitter will see this note."
                : "Ask the submitter for more information. The transaction stays pending."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason..."
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submitDialog} disabled={isPending || !reason.trim()}>
              {isPending ? "Saving..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

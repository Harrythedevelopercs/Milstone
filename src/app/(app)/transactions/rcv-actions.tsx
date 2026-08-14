"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCrudAction } from "@/hooks/use-crud-action";
import { createRcv } from "./actions";

const RCV_INELIGIBLE_STATUSES = new Set([
  "ENTERED",
  "SUBMITTED",
  "DETAILS_REQUESTED",
  "REJECTED",
  "VOID",
  "REFUNDED",
  "CHARGEBACK",
]);

const DIALOG_COPY: Record<"REFUND" | "CHARGEBACK" | "VOID", { title: string; description: string }> = {
  REFUND: {
    title: "Refund transaction",
    description:
      "The full amount is returned to the customer. FoundaPay's fee stays as revenue -- the client's position is reduced by what they were owed on this transaction. The original transaction is left intact and linked.",
  },
  CHARGEBACK: {
    title: "Chargeback transaction",
    description:
      "A forced reversal / dispute. FoundaPay's fee stays as revenue -- the client's position is reduced by what they were owed on this transaction. The original transaction is left intact and linked.",
  },
  VOID: {
    title: "Void transaction",
    description:
      "This transaction never settled -- it's excluded from FP revenue and commission entirely, and the client's position is reduced back to zero for it. The original transaction is left intact and linked.",
  },
};

export function RcvActions({ id, status }: { id: string; status: string }) {
  const { run, isPending } = useCrudAction();
  const [dialog, setDialog] = useState<"REFUND" | "CHARGEBACK" | "VOID" | null>(null);
  const [eventDate, setEventDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reasonCode, setReasonCode] = useState("");
  const [notes, setNotes] = useState("");

  if (RCV_INELIGIBLE_STATUSES.has(status)) return null;

  function openDialog(type: "REFUND" | "CHARGEBACK" | "VOID") {
    setDialog(type);
    setEventDate(format(new Date(), "yyyy-MM-dd"));
    setReasonCode("");
    setNotes("");
  }

  function submit() {
    if (!dialog) return;
    run(
      () =>
        createRcv({
          transactionId: id,
          type: dialog,
          eventDate,
          reasonCode,
          notes,
        }),
      {
        successMessage: `${dialog.charAt(0)}${dialog.slice(1).toLowerCase()} recorded`,
        onSuccess: () => setDialog(null),
      }
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ size: "sm", variant: "outline" })}>
          Refund / Chargeback / Void
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openDialog("REFUND")}>Refund</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog("CHARGEBACK")}>Chargeback</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => openDialog("VOID")}>
            Void
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle>{DIALOG_COPY[dialog].title}</DialogTitle>
                <DialogDescription>{DIALOG_COPY[dialog].description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="rcv-event-date">Event date</Label>
                  <Input
                    id="rcv-event-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    autoFocus
                  />
                </div>
                {dialog === "CHARGEBACK" && (
                  <div className="space-y-1">
                    <Label htmlFor="rcv-reason-code">Reason code</Label>
                    <Input
                      id="rcv-reason-code"
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value)}
                      placeholder="Optional -- e.g. dispute reason from processor"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="rcv-notes">Notes</Label>
                  <Textarea
                    id="rcv-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button
                  variant={dialog === "VOID" ? "destructive" : "default"}
                  onClick={submit}
                  disabled={isPending || !eventDate}
                >
                  {isPending ? "Saving..." : DIALOG_COPY[dialog].title}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldHint } from "@/components/ui/field-hint";
import { useCrudAction } from "@/hooks/use-crud-action";
import { fulfillChargeback } from "./actions";

export type BankOption = { id: string; name: string };

export function FulfillChargebackAction({
  rcvId,
  bankAccounts,
}: {
  rcvId: string;
  bankAccounts: BankOption[];
}) {
  const { run, isPending } = useCrudAction();
  const [open, setOpen] = useState(false);
  const [fulfillmentDate, setFulfillmentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fulfillmentBankAccountId, setFulfillmentBankAccountId] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    run(
      () => fulfillChargeback(rcvId, { fulfillmentDate, fulfillmentBankAccountId, notes }),
      { successMessage: "Chargeback marked fulfilled", onSuccess: () => setOpen(false) }
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Fulfilled by customer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chargeback fulfilled by customer</DialogTitle>
            <DialogDescription>
              The customer paid the disputed amount back directly. This posts a credit to the
              client statement and takes it off Outstanding Chargebacks, without erasing the
              original chargeback -- both stay visible in history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                Date received
                <FieldHint>The date the customer actually paid the disputed amount back.</FieldHint>
              </label>
              <Input
                type="date"
                value={fulfillmentDate}
                onChange={(e) => setFulfillmentDate(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                Deposited into
                <FieldHint>Which FoundaPay bank account received this payment.</FieldHint>
              </label>
              <Select
                value={fulfillmentBankAccountId}
                onValueChange={(v) => setFulfillmentBankAccountId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                Notes (optional)
                <FieldHint>Any context for how this was fulfilled.</FieldHint>
              </label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isPending || !fulfillmentDate || !fulfillmentBankAccountId}>
              {isPending ? "Saving..." : "Mark Fulfilled"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

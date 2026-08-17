"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  releaseReserveHold,
  applyReserveToChargeback,
  writeOffReserveHold,
  keepHoldingReserve,
} from "./actions";

type DialogKind = "RELEASE" | "APPLY" | "WRITE_OFF" | "KEEP";

const DIALOG_COPY: Record<DialogKind, { title: string; description: string }> = {
  RELEASE: {
    title: "Release reserve",
    description:
      "Moves this amount out of the receivable and into an actual bank account -- cash up, receivable down. Paying it out to the client, if warranted, is a separate Payout.",
  },
  APPLY: {
    title: "Apply reserve to chargeback",
    description:
      "Offsets a specific chargeback on this transaction with this reserve, full or partial. Independent of the reserve otherwise -- a chargeback never consumes a reserve on its own.",
  },
  WRITE_OFF: {
    title: "Write off reserve",
    description:
      "Records this amount as a loss and removes it from the receivable permanently. This cannot be undone -- a reason is required.",
  },
  KEEP: {
    title: "Keep holding",
    description: "No change to the reserve -- just logs that this was reviewed and left as-is.",
  },
};

export function ReserveHoldActions({
  reserveHoldId,
  owner,
  remaining,
  bankAccounts,
  chargebacks,
}: {
  reserveHoldId: string;
  owner: "CLIENT" | "FOUNDAPAY";
  remaining: string;
  bankAccounts: { id: string; name: string }[];
  chargebacks: { id: string; label: string }[];
}) {
  const { run, isPending } = useCrudAction();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [amount, setAmount] = useState(remaining);
  const [bankAccountId, setBankAccountId] = useState("");
  const [rcvId, setRcvId] = useState("");
  const [notes, setNotes] = useState("");

  function openDialog(kind: DialogKind) {
    setDialog(kind);
    setAmount(remaining);
    setBankAccountId("");
    setRcvId("");
    setNotes("");
  }

  function submit() {
    if (dialog === "RELEASE") {
      run(() => releaseReserveHold(reserveHoldId, { amount, bankAccountId, notes }), {
        successMessage: "Reserve released",
        onSuccess: () => setDialog(null),
      });
    } else if (dialog === "APPLY") {
      run(() => applyReserveToChargeback(reserveHoldId, { amount, rcvId, notes }), {
        successMessage: "Reserve applied to chargeback",
        onSuccess: () => setDialog(null),
      });
    } else if (dialog === "WRITE_OFF") {
      run(() => writeOffReserveHold(reserveHoldId, { amount, notes }), {
        successMessage: "Reserve written off",
        onSuccess: () => setDialog(null),
      });
    } else if (dialog === "KEEP") {
      run(() => keepHoldingReserve(reserveHoldId, { notes }), {
        successMessage: "Left holding",
        onSuccess: () => setDialog(null),
      });
    }
  }

  const canSubmit =
    dialog === "KEEP"
      ? true
      : dialog === "RELEASE"
        ? !!amount && !!bankAccountId
        : dialog === "APPLY"
          ? !!amount && !!rcvId
          : dialog === "WRITE_OFF"
            ? !!amount && notes.trim().length > 0
            : false;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ size: "sm", variant: "outline" })}>
          Actions
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openDialog("RELEASE")}>Release</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog("APPLY")} disabled={chargebacks.length === 0}>
            Apply to Chargeback
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => openDialog("WRITE_OFF")}>
            Write Off
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog("KEEP")}>Keep Holding</DropdownMenuItem>
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
                {dialog !== "KEEP" && (
                  <div className="space-y-1">
                    <Label htmlFor="reserve-amount">Amount (remaining: {remaining})</Label>
                    <Input
                      id="reserve-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}
                {dialog === "RELEASE" && (
                  <div className="space-y-1">
                    <Label>Deposit into</Label>
                    <Select
                      value={bankAccountId}
                      onValueChange={(v) => setBankAccountId(v ?? "")}
                      items={bankAccounts.map((b) => ({ value: b.id, label: b.name }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select bank account" />
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
                )}
                {dialog === "APPLY" && (
                  <div className="space-y-1">
                    <Label>Chargeback</Label>
                    <Select
                      value={rcvId}
                      onValueChange={(v) => setRcvId(v ?? "")}
                      items={chargebacks.map((c) => ({ value: c.id, label: c.label }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select chargeback" />
                      </SelectTrigger>
                      <SelectContent>
                        {chargebacks.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {owner === "CLIENT" ? (
                      <p className="text-xs text-muted-foreground">
                        Client-owned: credits the client&apos;s ledger for this amount.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        FoundaPay-owned: internal absorption, no ledger movement.
                      </p>
                    )}
                  </div>
                )}
                {dialog !== "RELEASE" && (
                  <div className="space-y-1">
                    <Label htmlFor="reserve-notes">
                      {dialog === "WRITE_OFF" ? "Reason (required)" : "Notes"}
                    </Label>
                    <Textarea
                      id="reserve-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder={dialog === "WRITE_OFF" ? "Why this is uncollectible" : "Optional"}
                    />
                  </div>
                )}
                {dialog === "RELEASE" && (
                  <div className="space-y-1">
                    <Label htmlFor="reserve-notes-release">Notes</Label>
                    <Textarea
                      id="reserve-notes-release"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button
                  variant={dialog === "WRITE_OFF" ? "destructive" : "default"}
                  onClick={submit}
                  disabled={isPending || !canSubmit}
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

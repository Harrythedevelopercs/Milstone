"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { toggleManualChecklistItem, closeMonth, reopenMonth } from "./actions";
import type { ChecklistItem } from "@/lib/month-close/checklist";

export function ChecklistPanel({
  accountingMonth,
  items,
  status,
  canReopen,
  closedInfo,
  reopenedInfo,
}: {
  accountingMonth: string;
  items: ChecklistItem[];
  status: "OPEN" | "CLOSED" | "REOPENED";
  canReopen: boolean;
  closedInfo: { by: string; at: string } | null;
  reopenedInfo: { by: string; at: string; reason: string } | null;
}) {
  const { run, isPending } = useCrudAction();
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reason, setReason] = useState("");

  const allPassed = items.every((i) => i.passed);
  const isClosed = status === "CLOSED";

  function toggle(key: string, value: boolean) {
    run(() => toggleManualChecklistItem(accountingMonth, key as never, value));
  }

  function close() {
    run(() => closeMonth(accountingMonth), { successMessage: `${accountingMonth} closed` });
  }

  function reopen() {
    run(() => reopenMonth(accountingMonth, reason), {
      successMessage: `${accountingMonth} reopened`,
      onSuccess: () => {
        setReopenDialogOpen(false);
        setReason("");
      },
    });
  }

  return (
    <div className="space-y-4">
      {isClosed && closedInfo && (
        <div className="rounded-md border bg-muted/40 p-4 text-sm">
          <p>
            Closed by <strong>{closedInfo.by}</strong> on {closedInfo.at}.
          </p>
          {canReopen && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setReopenDialogOpen(true)}
            >
              Reopen
            </Button>
          )}
        </div>
      )}

      {status === "REOPENED" && reopenedInfo && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p>
            Reopened by <strong>{reopenedInfo.by}</strong> on {reopenedInfo.at}: &quot;{reopenedInfo.reason}&quot;
          </p>
        </div>
      )}

      <div className="divide-y rounded-md border">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{item.label}</span>
            {item.manual && !isClosed ? (
              <Switch
                checked={item.passed}
                onCheckedChange={(checked) => toggle(item.key, !!checked)}
                disabled={isPending}
              />
            ) : (
              <Badge variant={item.passed ? "default" : "secondary"}>
                {item.passed ? "Done" : "Pending"}
              </Badge>
            )}
          </div>
        ))}
      </div>

      {!isClosed && (
        <Button onClick={close} disabled={isPending || !allPassed} className="w-full">
          {isPending ? "Closing..." : allPassed ? `Close ${accountingMonth}` : "Complete checklist to close"}
        </Button>
      )}

      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen {accountingMonth}</DialogTitle>
            <DialogDescription>
              This is logged permanently. Only do this if something genuinely needs correcting in
              this month.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason for reopening..."
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={reopen} disabled={isPending || !reason.trim()}>
              {isPending ? "Reopening..." : "Reopen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState } from "react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCrudAction } from "@/hooks/use-crud-action";
import { createReminder } from "../reminders/actions";

export function SetReminderButton({ transactionId, defaultTitle }: { transactionId: string; defaultTitle: string }) {
  const { run, isPending } = useCrudAction();
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));

  function submit() {
    run(
      () => createReminder({ title: defaultTitle, dueDate, transactionId }),
      { successMessage: "Reminder set", onSuccess: () => setOpen(false) }
    );
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Set Reminder
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set expected payout date</DialogTitle>
            <DialogDescription>Shows up in Reminders and on the Dashboard until you mark it done.</DialogDescription>
          </DialogHeader>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isPending || !dueDate}>
              {isPending ? "Saving..." : "Set Reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

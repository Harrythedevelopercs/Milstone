"use client";

import { Button } from "@/components/ui/button";
import { useCrudAction } from "@/hooks/use-crud-action";
import { completeReminder, dismissReminder } from "./actions";

export function ReminderActions({ id }: { id: string }) {
  const { run, isPending } = useCrudAction();

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => run(() => completeReminder(id), { successMessage: "Marked done" })}
      >
        Done
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => run(() => dismissReminder(id), { successMessage: "Dismissed" })}
      >
        Dismiss
      </Button>
    </div>
  );
}

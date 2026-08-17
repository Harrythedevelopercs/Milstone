"use client";

import { Button } from "@/components/ui/button";
import { useCrudAction } from "@/hooks/use-crud-action";
import type { ActionResult } from "@/lib/action-result";

export function MarkSettledAction({
  id,
  action,
}: {
  id: string;
  action: (id: string) => Promise<ActionResult>;
}) {
  const { run, isPending } = useCrudAction();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => run(() => action(id), { successMessage: "Marked settled" })}
    >
      {isPending ? "Saving..." : "Mark Settled"}
    </Button>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { useCrudAction } from "@/hooks/use-crud-action";
import type { ActionResult } from "@/lib/action-result";

export function MarkSettledAction({
  id,
  action,
  onSuccess,
}: {
  id: string;
  action: (id: string) => Promise<ActionResult>;
  onSuccess?: () => void;
}) {
  const { run, isPending } = useCrudAction();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => run(() => action(id), { successMessage: "Marked settled", onSuccess })}
    >
      {isPending ? "Saving..." : "Mark Settled"}
    </Button>
  );
}

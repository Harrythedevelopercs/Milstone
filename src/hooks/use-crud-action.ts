"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

export function useCrudAction() {
  const [isPending, startTransition] = useTransition();

  function run(
    action: () => Promise<ActionResult>,
    options?: { successMessage?: string; onSuccess?: () => void }
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (options?.successMessage) toast.success(options.successMessage);
        options?.onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  return { run, isPending };
}

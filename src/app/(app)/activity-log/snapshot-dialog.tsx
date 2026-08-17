"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SnapshotDialog({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  const [open, setOpen] = useState(false);
  if (!before && !after) return <span className="text-muted-foreground">—</span>;

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        View
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change Detail</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-auto sm:grid-cols-2">
            {before !== null && before !== undefined && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Before</p>
                <pre className="whitespace-pre-wrap break-all rounded-md bg-muted/40 p-2 text-xs">
                  {JSON.stringify(before, null, 2)}
                </pre>
              </div>
            )}
            {after !== null && after !== undefined && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">After</p>
                <pre className="whitespace-pre-wrap break-all rounded-md bg-muted/40 p-2 text-xs">
                  {JSON.stringify(after, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getEntityHistory, type EntityHistoryEntry } from "@/lib/entity-history";

const DIFF_IGNORE_KEYS = new Set([
  "id",
  "createdById",
  "createdAt",
  "updatedById",
  "updatedAt",
  "approvedById",
  "approvedAt",
]);

function diffSnapshots(before: unknown, after: unknown): Array<{ field: string; before: string; after: string }> {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const diffs: Array<{ field: string; before: string; after: string }> = [];
  for (const key of keys) {
    if (DIFF_IGNORE_KEYS.has(key)) continue;
    const bv = JSON.stringify(b[key]);
    const av = JSON.stringify(a[key]);
    if (bv !== av) {
      diffs.push({
        field: key,
        before: b[key] === null || b[key] === undefined ? "—" : String(b[key]),
        after: a[key] === null || a[key] === undefined ? "—" : String(a[key]),
      });
    }
  }
  return diffs;
}

// Generic counterpart to transactions/transaction-history-action.tsx, for
// any entity type that calls writeAuditLog with {entityType, entityId} --
// which is every module in this app (see src/lib/audit-log.ts callers).
export function EntityHistoryAction({
  entityType,
  entityId,
  label = "History",
}: {
  entityType: string;
  entityId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<EntityHistoryEntry[] | null>(null);

  async function openDialog() {
    setOpen(true);
    setLoading(true);
    const result = await getEntityHistory(entityType, entityId);
    setEntries(result);
    setLoading(false);
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={openDialog}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit history — {entityId}</DialogTitle>
            <DialogDescription>Every recorded change against this record.</DialogDescription>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !entries || entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit history yet.</p>
          ) : (
            <div className="space-y-4">
              {entries.map((e) => {
                const diffs = diffSnapshots(e.beforeSnapshot, e.afterSnapshot);
                return (
                  <div key={e.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{e.action}</Badge>
                        <span className="font-medium">{e.performedByName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(e.performedAt), "yyyy-MM-dd HH:mm")}
                      </span>
                    </div>
                    {e.notes && <p className="mt-1 text-muted-foreground">{e.notes}</p>}
                    {diffs.length > 0 && (
                      <table className="mt-2 w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="pr-2 font-normal">Field</th>
                            <th className="pr-2 font-normal">Before</th>
                            <th className="font-normal">After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffs.map((d) => (
                            <tr key={d.field}>
                              <td className="pr-2 font-mono">{d.field}</td>
                              <td className="pr-2 text-muted-foreground">{d.before}</td>
                              <td>{d.after}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

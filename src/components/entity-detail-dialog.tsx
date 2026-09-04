"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}

export function DetailFieldGrid({ fields }: { fields: { label: string; value: string | null }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border p-3 sm:grid-cols-3">
      {fields.map((f) => (
        <DetailField key={f.label} label={f.label} value={f.value} />
      ))}
    </dl>
  );
}

// Shared shell for every money-movement type's board detail dialog --
// header (title + optional status badge + subtitle), an actions row (each
// type's own real action components, reused as-is), then arbitrary content
// (a field grid, a breakdown table, etc.), then Close. Keeps all 10 of
// these dialogs visually and structurally consistent without duplicating
// the Dialog boilerplate in each one.
export function EntityDetailDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  statusBadge,
  loading,
  actions,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  statusBadge?: ReactNode;
  loading: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            {statusBadge}
          </DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {!loading && (
          <div className="space-y-5">
            {actions && (
              <div className="flex flex-wrap justify-end gap-2 rounded-md border bg-muted/30 p-2">{actions}</div>
            )}
            {children}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

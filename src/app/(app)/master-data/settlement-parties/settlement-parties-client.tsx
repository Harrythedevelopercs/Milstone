"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { StatusBadge } from "@/components/master-data/status-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setSettlementPartyStatus } from "./actions";
import { SettlementPartyForm } from "./settlement-party-form";
import type { SettlementPartyFormValues } from "./schema";

export type SettlementPartyRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export function SettlementPartiesClient({ rows }: { rows: SettlementPartyRow[] }) {
  const [editing, setEditing] = useState<SettlementPartyRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { run } = useCrudAction();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: SettlementPartyRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleStatus(row: SettlementPartyRow) {
    run(
      () => setSettlementPartyStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
      { successMessage: row.status === "ACTIVE" ? "Deactivated" : "Activated" }
    );
  }

  const defaultValues: SettlementPartyFormValues = editing
    ? {
        name: editing.name,
        email: editing.email ?? "",
        phone: editing.phone ?? "",
        notes: editing.notes ?? "",
      }
    : { name: "", email: "", phone: "", notes: "" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settlement Parties</h1>
        <Button onClick={openCreate}>Add Settlement Party</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No settlement parties yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
          { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleStatus(r)}>
                  {r.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
              </div>
            ),
          },
        ]}
      />

      <CrudSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? "Edit Settlement Party" : "Add Settlement Party"}
      >
        <SettlementPartyForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>
    </div>
  );
}

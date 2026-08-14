"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { StatusBadge } from "@/components/master-data/status-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setPartnerStatus } from "./actions";
import { PartnerForm, type OwnerUserOption } from "./partner-form";
import type { PartnerFormValues } from "./schema";

export type PartnerRow = {
  id: string;
  name: string;
  profitSharePercent: string;
  status: "ACTIVE" | "INACTIVE";
  userId: string | null;
  user: { name: string; email: string } | null;
};

export function PartnersClient({
  rows,
  ownerUsers,
}: {
  rows: PartnerRow[];
  ownerUsers: OwnerUserOption[];
}) {
  const [editing, setEditing] = useState<PartnerRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { run } = useCrudAction();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: PartnerRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleStatus(row: PartnerRow) {
    run(() => setPartnerStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"), {
      successMessage: row.status === "ACTIVE" ? "Deactivated" : "Activated",
    });
  }

  const defaultValues: PartnerFormValues = editing
    ? {
        name: editing.name,
        profitSharePercent: editing.profitSharePercent,
        userId: editing.userId ?? "",
      }
    : { name: "", profitSharePercent: "", userId: "" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Partners</h1>
        <Button onClick={openCreate}>Add Partner</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No partners yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          {
            key: "share",
            header: "Profit Share",
            render: (r) => `${r.profitSharePercent}%`,
          },
          {
            key: "login",
            header: "Login Account",
            render: (r) => r.user?.email ?? "—",
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
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
        title={editing ? "Edit Partner" : "Add Partner"}
      >
        <PartnerForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          ownerUsers={ownerUsers}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>
    </div>
  );
}

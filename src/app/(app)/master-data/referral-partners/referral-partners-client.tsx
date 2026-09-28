"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { StatusBadge } from "@/components/master-data/status-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setReferralPartnerStatus } from "./actions";
import { ReferralPartnerForm } from "./referral-partner-form";
import type { ReferralPartnerFormValues } from "./schema";

export type ReferralPartnerRow = {
  id: string;
  name: string;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export function ReferralPartnersClient({ rows }: { rows: ReferralPartnerRow[] }) {
  const [editing, setEditing] = useState<ReferralPartnerRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { run } = useCrudAction();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: ReferralPartnerRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleStatus(row: ReferralPartnerRow) {
    run(() => setReferralPartnerStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"), {
      successMessage: row.status === "ACTIVE" ? "Deactivated" : "Activated",
    });
  }

  const defaultValues: ReferralPartnerFormValues = editing
    ? { name: editing.name, notes: editing.notes ?? "" }
    : { name: "", notes: "" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Referral Partners</h1>
          <p className="text-sm text-muted-foreground">
            People or companies who earn a referral share of FoundaPay&apos;s fee on specific
            clients&apos; transactions -- set per client, per payment method, in Clients → Rates.
          </p>
        </div>
        <Button onClick={openCreate}>Add Referral Partner</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No referral partners yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "notes", header: "Notes", render: (r) => r.notes ?? "—" },
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
        title={editing ? "Edit Referral Partner" : "Add Referral Partner"}
      >
        <ReferralPartnerForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>
    </div>
  );
}

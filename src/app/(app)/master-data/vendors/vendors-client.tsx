"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { StatusBadge } from "@/components/master-data/status-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setVendorStatus } from "./actions";
import { VendorForm } from "./vendor-form";
import { SubscriptionsPanel, type SubscriptionRow } from "./subscriptions-panel";
import type { VendorFormValues } from "./schema";

export type VendorRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  subscriptions: SubscriptionRow[];
};

export function VendorsClient({ rows }: { rows: VendorRow[] }) {
  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [subsVendorId, setSubsVendorId] = useState<string | null>(null);
  const { run } = useCrudAction();

  const subsVendor = rows.find((r) => r.id === subsVendorId) ?? null;

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: VendorRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleStatus(row: VendorRow) {
    run(() => setVendorStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"), {
      successMessage: row.status === "ACTIVE" ? "Deactivated" : "Activated",
    });
  }

  const defaultValues: VendorFormValues = editing
    ? { name: editing.name, email: editing.email ?? "", phone: editing.phone ?? "" }
    : { name: "", email: "", phone: "" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vendors</h1>
        <Button onClick={openCreate}>Add Vendor</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No vendors yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSubsVendorId(r.id)}>
                  Subscriptions
                </Button>
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
        title={editing ? "Edit Vendor" : "Add Vendor"}
      >
        <VendorForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>

      <CrudSheet
        open={subsVendorId !== null}
        onOpenChange={(open) => !open && setSubsVendorId(null)}
        title={subsVendor ? `Subscriptions — ${subsVendor.name}` : ""}
      >
        {subsVendor && (
          <SubscriptionsPanel vendorId={subsVendor.id} subscriptions={subsVendor.subscriptions} />
        )}
      </CrudSheet>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { StatusBadge } from "@/components/master-data/status-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setPaymentMethodStatus } from "./actions";
import { PaymentMethodForm } from "./payment-method-form";
import type { PaymentMethodFormValues } from "./schema";

export type PaymentMethodRow = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  requiresMerchant: boolean;
};

export function PaymentMethodsClient({ rows }: { rows: PaymentMethodRow[] }) {
  const [editing, setEditing] = useState<PaymentMethodRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { run } = useCrudAction();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: PaymentMethodRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleActive(row: PaymentMethodRow) {
    run(() => setPaymentMethodStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"), {
      successMessage: row.status === "ACTIVE" ? "Deactivated" : "Activated",
    });
  }

  const defaultValues: PaymentMethodFormValues = editing
    ? { name: editing.name, requiresMerchant: editing.requiresMerchant }
    : { name: "", requiresMerchant: true };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Payment Methods</h1>
        <Button onClick={openCreate}>Add Payment Method</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No payment methods yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          {
            key: "kind",
            header: "Kind",
            render: (r) => (
              <Badge variant={r.requiresMerchant ? "outline" : "secondary"}>
                {r.requiresMerchant ? "Merchant-based" : "Direct-to-bank"}
              </Badge>
            ),
          },
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
                <Button variant="ghost" size="sm" onClick={() => toggleActive(r)}>
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
        title={editing ? "Edit Payment Method" : "Add Payment Method"}
      >
        <PaymentMethodForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>
    </div>
  );
}

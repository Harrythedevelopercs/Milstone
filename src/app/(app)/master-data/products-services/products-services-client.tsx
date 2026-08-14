"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { StatusBadge } from "@/components/master-data/status-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setProductServiceStatus } from "./actions";
import { ProductServiceForm } from "./product-service-form";
import type { ProductServiceFormValues } from "./schema";

export type ProductServiceRow = {
  id: string;
  name: string;
  cost: string;
  sellPrice: string;
  status: "ACTIVE" | "INACTIVE";
};

export function ProductsServicesClient({ rows }: { rows: ProductServiceRow[] }) {
  const [editing, setEditing] = useState<ProductServiceRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { run } = useCrudAction();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: ProductServiceRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleStatus(row: ProductServiceRow) {
    run(
      () => setProductServiceStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
      { successMessage: row.status === "ACTIVE" ? "Deactivated" : "Activated" }
    );
  }

  const defaultValues: ProductServiceFormValues = editing
    ? { name: editing.name, cost: editing.cost, sellPrice: editing.sellPrice }
    : { name: "", cost: "", sellPrice: "" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products & Services</h1>
        <Button onClick={openCreate}>Add Product/Service</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No products or services yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "cost", header: "Cost", render: (r) => r.cost },
          { key: "sell", header: "Sell Price", render: (r) => r.sellPrice },
          {
            key: "margin",
            header: "Gross Profit",
            render: (r) => (Number(r.sellPrice) - Number(r.cost)).toFixed(2),
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
        title={editing ? "Edit Product/Service" : "Add Product/Service"}
      >
        <ProductServiceForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>
    </div>
  );
}

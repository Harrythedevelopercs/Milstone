"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { StatusBadge } from "@/components/master-data/status-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setClientStatus } from "./actions";
import { ClientForm } from "./client-form";
import { RateHistoryPanel, type RateHistoryRow } from "./rate-history-panel";
import type { ClientFormValues } from "./schema";

export type ClientRow = {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  rateHistory: RateHistoryRow[];
  defaultReserveType: "PERCENT" | "FIXED" | null;
  defaultReserveValue: string | null;
  defaultReserveDirection: "CLIENT_HELD" | "FP_FRONTED" | "FP_OWN" | null;
  defaultFeeBasis: "GROSS" | "AFTER_MERCHANT_CHARGES" | null;
  defaultMerchantReserveBasis: "GROSS" | "AFTER_MERCHANT_CHARGES" | null;
};

export function ClientsClient({
  rows,
  paymentMethods,
  referralPartners,
}: {
  rows: ClientRow[];
  paymentMethods: { id: string; name: string }[];
  referralPartners: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rateClientId, setRateClientId] = useState<string | null>(null);
  const { run } = useCrudAction();

  // Derived (not stored) so it refreshes automatically once the add-rate
  // action revalidates the page and `rows` comes back with the new entry.
  const rateClient = rows.find((r) => r.id === rateClientId) ?? null;

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: ClientRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleStatus(row: ClientRow) {
    run(() => setClientStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"), {
      successMessage: row.status === "ACTIVE" ? "Deactivated" : "Activated",
    });
  }

  const defaultValues: ClientFormValues = editing
    ? {
        name: editing.name,
        code: editing.code ?? "",
        email: editing.email ?? "",
        phone: editing.phone ?? "",
        notes: editing.notes ?? "",
        defaultReserveType: editing.defaultReserveType ?? "",
        defaultReserveValue: editing.defaultReserveValue ?? "",
        defaultReserveDirection: editing.defaultReserveDirection ?? "",
        defaultFeeBasis: editing.defaultFeeBasis ?? "",
        defaultMerchantReserveBasis: editing.defaultMerchantReserveBasis ?? "",
      }
    : {
        name: "",
        code: "",
        email: "",
        phone: "",
        notes: "",
        defaultReserveType: "",
        defaultReserveValue: "",
        defaultReserveDirection: "",
        defaultFeeBasis: "",
        defaultMerchantReserveBasis: "",
      };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>
        <Button onClick={openCreate}>Add Client</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No clients yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "code", header: "Code", render: (r) => r.code ?? "—" },
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
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
                <Button variant="ghost" size="sm" onClick={() => setRateClientId(r.id)}>
                  Rates
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
        title={editing ? "Edit Client" : "Add Client"}
      >
        <ClientForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>

      <CrudSheet
        open={rateClientId !== null}
        onOpenChange={(open) => !open && setRateClientId(null)}
        title={rateClient ? `Rates — ${rateClient.name}` : ""}
        description="Rate changes only apply going forward; past transactions keep their original rate."
        widthClassName="sm:max-w-2xl"
      >
        {rateClient && (
          <RateHistoryPanel
            clientId={rateClient.id}
            rates={rateClient.rateHistory}
            paymentMethods={paymentMethods}
            referralPartners={referralPartners}
          />
        )}
      </CrudSheet>
    </div>
  );
}

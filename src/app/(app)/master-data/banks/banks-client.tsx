"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setBankAccountActive } from "./actions";
import { BankAccountForm } from "./bank-account-form";
import type { BankAccountFormValues } from "./schema";

export type BankAccountRow = {
  id: string;
  name: string;
  accountType: "BANK" | "USDT" | "CASH";
  bankName: string | null;
  accountNumberMasked: string | null;
  currency: string;
  country: string | null;
  openingBalance: string;
  active: boolean;
};

export function BanksClient({ rows }: { rows: BankAccountRow[] }) {
  const [editing, setEditing] = useState<BankAccountRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { run } = useCrudAction();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: BankAccountRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleActive(row: BankAccountRow) {
    run(() => setBankAccountActive(row.id, !row.active), {
      successMessage: row.active ? "Deactivated" : "Activated",
    });
  }

  const defaultValues: BankAccountFormValues = editing
    ? {
        name: editing.name,
        accountType: editing.accountType,
        bankName: editing.bankName ?? "",
        accountNumberMasked: editing.accountNumberMasked ?? "",
        currency: editing.currency,
        country: editing.country ?? "",
        openingBalance: editing.openingBalance,
      }
    : {
        name: "",
        accountType: "BANK",
        bankName: "",
        accountNumberMasked: "",
        currency: "USD",
        country: "",
        openingBalance: "0",
      };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bank Accounts</h1>
        <Button onClick={openCreate}>Add Account</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No bank accounts yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "type", header: "Type", render: (r) => <Badge variant="outline">{r.accountType}</Badge> },
          { key: "currency", header: "Currency", render: (r) => r.currency },
          { key: "opening", header: "Opening Balance", render: (r) => r.openingBalance },
          {
            key: "status",
            header: "Status",
            render: (r) => <Badge variant={r.active ? "default" : "secondary"}>{r.active ? "Active" : "Inactive"}</Badge>,
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
                <Button variant="ghost" size="sm" onClick={() => toggleActive(r)}>
                  {r.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            ),
          },
        ]}
      />

      <CrudSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? "Edit Bank Account" : "Add Bank Account"}
      >
        <BankAccountForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>
    </div>
  );
}

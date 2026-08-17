"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/ui/tone-badge";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setAccountActive } from "./actions";
import { AccountForm } from "./account-form";
import type { AccountFormValues } from "./schema";

export type AccountRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  active: boolean;
};

const CATEGORY_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  ASSET: "success",
  LIABILITY: "danger",
  EQUITY: "neutral",
  REVENUE: "success",
  COGS: "warning",
  EXPENSE: "warning",
};

const CATEGORY_LABEL: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  COGS: "COGS",
  EXPENSE: "Expense",
};

export function ChartOfAccountsClient({ rows }: { rows: AccountRow[] }) {
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { run } = useCrudAction();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: AccountRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleActive(row: AccountRow) {
    run(() => setAccountActive(row.id, !row.active), {
      successMessage: row.active ? "Deactivated" : "Activated",
    });
  }

  const defaultValues: AccountFormValues = editing
    ? {
        code: editing.code,
        name: editing.name,
        category: editing.category as AccountFormValues["category"],
        description: editing.description ?? "",
      }
    : { code: "", name: "", category: "EXPENSE", description: "" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">
            The standard categories the Income Statement and Balance Sheet are organized by.
          </p>
        </div>
        <Button onClick={openCreate}>Add Account</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No accounts yet."
        columns={[
          { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
          { key: "name", header: "Name", render: (r) => r.name },
          {
            key: "category",
            header: "Category",
            render: (r) => (
              <ToneBadge tone={CATEGORY_TONE[r.category] ?? "neutral"}>
                {CATEGORY_LABEL[r.category] ?? r.category}
              </ToneBadge>
            ),
          },
          {
            key: "description",
            header: "Description",
            render: (r) => <span className="text-sm text-muted-foreground">{r.description ?? "—"}</span>,
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <ToneBadge tone={r.active ? "success" : "neutral"}>
                {r.active ? "Active" : "Inactive"}
              </ToneBadge>
            ),
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
        title={editing ? "Edit Account" : "Add Account"}
      >
        <AccountForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { useCrudAction } from "@/hooks/use-crud-action";
import { deleteSystemSetting } from "./actions";
import { SettingForm } from "./setting-form";
import type { SystemSettingFormValues } from "./schema";

export type SettingRow = {
  key: string;
  value: string;
  description: string | null;
};

export function SettingsClient({ rows }: { rows: SettingRow[] }) {
  const [editing, setEditing] = useState<SettingRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { run } = useCrudAction();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: SettingRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function remove(row: SettingRow) {
    if (!confirm(`Delete setting "${row.key}"?`)) return;
    run(() => deleteSystemSetting(row.key), { successMessage: "Setting deleted" });
  }

  const defaultValues: SystemSettingFormValues = editing
    ? { key: editing.key, value: editing.value, description: editing.description ?? "" }
    : { key: "", value: "", description: "" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">System Settings</h1>
        <Button onClick={openCreate}>Add Setting</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.key}
        emptyMessage="No settings yet."
        columns={[
          { key: "key", header: "Key", render: (r) => <code className="text-sm">{r.key}</code> },
          { key: "value", header: "Value", render: (r) => r.value },
          { key: "desc", header: "Description", render: (r) => r.description ?? "—" },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(r)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      <CrudSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? "Edit Setting" : "Add Setting"}
      >
        <SettingForm
          key={editing?.key ?? "new"}
          defaultValues={defaultValues}
          editingKey={editing?.key ?? null}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { StatusBadge } from "@/components/master-data/status-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setEmployeeStatus } from "./actions";
import { EmployeeForm, type EmployeeUserOption } from "./employee-form";
import type { EmployeeFormValues } from "./schema";

export type EmployeeRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isEmployeePartner: boolean;
  salary: string;
  status: "ACTIVE" | "INACTIVE";
  userId: string | null;
  user: { name: string; email: string } | null;
};

export function EmployeesClient({
  rows,
  employeeUsers,
}: {
  rows: EmployeeRow[];
  employeeUsers: EmployeeUserOption[];
}) {
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { run } = useCrudAction();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: EmployeeRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleStatus(row: EmployeeRow) {
    run(() => setEmployeeStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"), {
      successMessage: row.status === "ACTIVE" ? "Deactivated" : "Activated",
    });
  }

  const defaultValues: EmployeeFormValues = editing
    ? {
        name: editing.name,
        email: editing.email ?? "",
        phone: editing.phone ?? "",
        isEmployeePartner: editing.isEmployeePartner,
        salary: editing.salary,
        userId: editing.userId ?? "",
      }
    : { name: "", email: "", phone: "", isEmployeePartner: false, salary: "0", userId: "" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employees</h1>
        <Button onClick={openCreate}>Add Employee</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No employees yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "login", header: "Login Account", render: (r) => r.user?.email ?? "—" },
          {
            key: "partner",
            header: "Employee Partner",
            render: (r) => (r.isEmployeePartner ? <Badge>Yes</Badge> : "—"),
          },
          { key: "salary", header: "Salary", render: (r) => r.salary },
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
        title={editing ? "Edit Employee" : "Add Employee"}
      >
        <EmployeeForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          employeeUsers={employeeUsers}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>
    </div>
  );
}

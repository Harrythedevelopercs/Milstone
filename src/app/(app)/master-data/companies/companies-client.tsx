"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { StatusBadge } from "@/components/master-data/status-badge";
import { BankStatusBadge } from "@/components/master-data/bank-status-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setCompanyStatus } from "./actions";
import { CompanyForm, type EmployeePartnerOption } from "./company-form";
import type { CompanyFormValues } from "./schema";

export type CompanyRow = {
  id: string;
  name: string;
  legalName: string | null;
  employeePartnerId: string | null;
  status: "ACTIVE" | "INACTIVE";
  employeePartner: { name: string } | null;
  bankAccounts: {
    id: string;
    bankName: string | null;
    name: string;
    status: "ACTIVE" | "SUSPENDED" | "NOT_APPLIED";
  }[];
};

export function CompaniesClient({
  rows,
  employeePartners,
}: {
  rows: CompanyRow[];
  employeePartners: EmployeePartnerOption[];
}) {
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { run } = useCrudAction();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: CompanyRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleStatus(row: CompanyRow) {
    run(() => setCompanyStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"), {
      successMessage: row.status === "ACTIVE" ? "Deactivated" : "Activated",
    });
  }

  const defaultValues: CompanyFormValues = editing
    ? {
        name: editing.name,
        legalName: editing.legalName ?? "",
        employeePartnerId: editing.employeePartnerId ?? "",
      }
    : { name: "", legalName: "", employeePartnerId: "" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Companies</h1>
        <Button onClick={openCreate}>Add Company</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No companies yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          {
            key: "employeePartner",
            header: "Employee Partner",
            render: (r) => r.employeePartner?.name ?? "—",
          },
          {
            key: "banks",
            header: "Banks",
            render: (r) =>
              r.bankAccounts.length === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {r.bankAccounts.map((b) => (
                    <span key={b.id} className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">{b.bankName ?? b.name}</span>
                      <BankStatusBadge status={b.status} />
                    </span>
                  ))}
                </div>
              ),
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
        title={editing ? "Edit Company" : "Add Company"}
      >
        <CompanyForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          employeePartners={employeePartners}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>
    </div>
  );
}

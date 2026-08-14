"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setBankAccountActive } from "./actions";
import { BankAccountForm, type CompanyOption } from "./bank-account-form";
import { CompanyBankGroups } from "./company-bank-groups";
import { ImportCsvDialog } from "./import-csv-dialog";
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
  companyId: string | null;
  status: "ACTIVE" | "SUSPENDED" | "NOT_APPLIED";
  company: { id: string; name: string } | null;
};

export function BanksClient({ rows, companies }: { rows: BankAccountRow[]; companies: CompanyOption[] }) {
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
        companyId: editing.companyId ?? "",
        status: editing.status,
      }
    : {
        name: "",
        accountType: "BANK",
        bankName: "",
        accountNumberMasked: "",
        currency: "USD",
        country: "",
        openingBalance: "0",
        companyId: "",
        status: "ACTIVE",
      };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bank Accounts</h1>
        <div className="flex items-center gap-2">
          <ImportCsvDialog />
          <Button onClick={openCreate}>Add Account</Button>
        </div>
      </div>

      <CompanyBankGroups rows={rows} onEdit={openEdit} onToggleActive={toggleActive} />

      <CrudSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? "Edit Bank Account" : "Add Bank Account"}
      >
        <BankAccountForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          companies={companies}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>
    </div>
  );
}

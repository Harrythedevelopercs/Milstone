"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/master-data/data-table";
import { DownloadButtons } from "@/components/exports/download-buttons";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setMerchantActive } from "./actions";
import { MerchantForm, type Option, type BankAccountOption } from "./merchant-form";
import { FeeRulesPanel, type FeeRuleRow } from "./fee-rules-panel";
import type { MerchantFormValues } from "./schema";

export type MerchantRow = {
  id: string;
  name: string;
  companyId: string;
  businessUnitId: string | null;
  processor: string;
  settlementBankId: string;
  dailyLimit: string | null;
  monthlyLimit: string | null;
  perTxnLimit: string | null;
  settlementCycle: string;
  defaultReservePercent: string;
  defaultReserveDirection: "CLIENT_HELD" | "FP_FRONTED" | "FP_OWN";
  active: boolean;
  company: { name: string };
  feeRules: FeeRuleRow[];
};

export function MerchantsClient({
  rows,
  companies,
  businessUnits,
  bankAccounts,
  paymentMethods,
}: {
  rows: MerchantRow[];
  companies: Option[];
  businessUnits: Option[];
  bankAccounts: BankAccountOption[];
  paymentMethods: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<MerchantRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feeMerchantId, setFeeMerchantId] = useState<string | null>(null);
  const { run } = useCrudAction();

  const feeMerchant = rows.find((r) => r.id === feeMerchantId) ?? null;

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(row: MerchantRow) {
    setEditing(row);
    setSheetOpen(true);
  }

  function toggleActive(row: MerchantRow) {
    run(() => setMerchantActive(row.id, !row.active), {
      successMessage: row.active ? "Deactivated" : "Activated",
    });
  }

  const defaultValues: MerchantFormValues = editing
    ? {
        name: editing.name,
        companyId: editing.companyId,
        businessUnitId: editing.businessUnitId ?? "",
        processor: editing.processor,
        settlementBankId: editing.settlementBankId,
        dailyLimit: editing.dailyLimit ?? "",
        monthlyLimit: editing.monthlyLimit ?? "",
        perTxnLimit: editing.perTxnLimit ?? "",
        settlementCycle: editing.settlementCycle,
        defaultReservePercent: editing.defaultReservePercent,
        defaultReserveDirection: editing.defaultReserveDirection,
      }
    : {
        name: "",
        companyId: "",
        businessUnitId: "",
        processor: "",
        settlementBankId: "",
        dailyLimit: "",
        monthlyLimit: "",
        perTxnLimit: "",
        settlementCycle: "",
        defaultReservePercent: "0",
        defaultReserveDirection: "CLIENT_HELD",
      };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Merchants</h1>
        <Button onClick={openCreate}>Add Merchant</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No merchants yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "company", header: "Company", render: (r) => r.company.name },
          { key: "processor", header: "Processor", render: (r) => r.processor },
          { key: "cycle", header: "Settlement Cycle", render: (r) => r.settlementCycle },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <Badge variant={r.active ? "default" : "secondary"}>
                {r.active ? "Active" : "Inactive"}
              </Badge>
            ),
          },
          {
            key: "ledger",
            header: "Ledger",
            render: (r) => <DownloadButtons reportType="merchant-ledger" params={{ id: r.id }} />,
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setFeeMerchantId(r.id)}>
                  Fee Rules
                </Button>
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
        title={editing ? "Edit Merchant" : "Add Merchant"}
      >
        <MerchantForm
          key={editing?.id ?? "new"}
          defaultValues={defaultValues}
          editingId={editing?.id ?? null}
          companies={companies}
          businessUnits={businessUnits}
          bankAccounts={bankAccounts}
          onSuccess={() => setSheetOpen(false)}
        />
      </CrudSheet>

      <CrudSheet
        open={feeMerchantId !== null}
        onOpenChange={(open) => !open && setFeeMerchantId(null)}
        title={feeMerchant ? `Fee Rules — ${feeMerchant.name}` : ""}
      >
        {feeMerchant && (
          <FeeRulesPanel
            merchantId={feeMerchant.id}
            rules={feeMerchant.feeRules}
            paymentMethods={paymentMethods}
          />
        )}
      </CrudSheet>
    </div>
  );
}

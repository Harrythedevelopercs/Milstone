"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { SettlementForm, type MerchantOption, type UnsettledTransaction } from "./new/settlement-form";
import type { SettlementBatchFormValues } from "./schema";

export type EditableSettlementBatch = {
  id: string;
  merchantId: string;
  bankAccountId: string;
  depositDate: string;
  depositAmount: string;
  notes: string | null;
  transactionIds: string[];
};

export function EditSettlementBatchAction({
  row,
  monthOpen,
  merchants,
  unsettledTransactions,
}: {
  row: EditableSettlementBatch;
  monthOpen: boolean;
  merchants: MerchantOption[];
  unsettledTransactions: UnsettledTransaction[];
}) {
  const [open, setOpen] = useState(false);

  if (!monthOpen) {
    return (
      <Button size="sm" variant="ghost" disabled title="This batch's month is closed">
        Edit
      </Button>
    );
  }

  const defaultValues: SettlementBatchFormValues = {
    merchantId: row.merchantId,
    bankAccountId: row.bankAccountId,
    depositDate: format(new Date(row.depositDate), "yyyy-MM-dd"),
    depositAmount: row.depositAmount,
    transactionIds: row.transactionIds,
    notes: row.notes ?? "",
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <CrudSheet
        open={open}
        onOpenChange={setOpen}
        title={`Edit settlement batch`}
        description="Expected/Difference/Status recompute automatically. Transactions already paid, refunded, charged back, or edited since this batch was created can't be removed."
        widthClassName="sm:max-w-2xl"
      >
        <SettlementForm
          key={row.id}
          editingId={row.id}
          defaultValues={defaultValues}
          merchants={merchants}
          unsettledTransactions={unsettledTransactions}
          onSuccess={() => setOpen(false)}
          hideChrome
        />
      </CrudSheet>
    </>
  );
}

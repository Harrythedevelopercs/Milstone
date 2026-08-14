"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import {
  TransactionForm,
  type ClientOption,
  type MerchantOption,
  type BankOption,
  type PaymentMethodOption,
} from "./new/transaction-form";
import type { TransactionFormValues } from "./schema";

export type EditableTransaction = {
  id: string;
  transactionDate: string;
  clientId: string;
  clientReference: string | null;
  merchantId: string;
  expectedBankId: string;
  paymentMethodId: string;
  grossAmount: string;
  feeBearer: "FOUNDAPAY" | "CLIENT";
  merchantFeeManual: string | null;
  merchantReservePercent: string;
  fpReservePercent: string;
  documentUrl: string | null;
  notes: string | null;
  customerEmail: string | null;
  cardLast4: string | null;
};

export function EditTransactionAction({
  row,
  monthOpen,
  clients,
  merchants,
  bankAccounts,
  paymentMethods,
}: {
  row: EditableTransaction;
  monthOpen: boolean;
  clients: ClientOption[];
  merchants: MerchantOption[];
  bankAccounts: BankOption[];
  paymentMethods: PaymentMethodOption[];
}) {
  const [open, setOpen] = useState(false);

  if (!monthOpen) {
    return (
      <Button size="sm" variant="ghost" disabled title="This transaction's month is closed">
        Edit
      </Button>
    );
  }

  const defaultValues: TransactionFormValues = {
    transactionDate: format(new Date(row.transactionDate), "yyyy-MM-dd"),
    clientId: row.clientId,
    clientReference: row.clientReference ?? "",
    merchantId: row.merchantId,
    expectedBankId: row.expectedBankId,
    paymentMethodId: row.paymentMethodId,
    grossAmount: row.grossAmount,
    feeBearer: row.feeBearer,
    merchantFeeManual: row.merchantFeeManual ?? "",
    merchantReservePercent: row.merchantReservePercent,
    fpReservePercent: row.fpReservePercent,
    documentUrl: row.documentUrl ?? "",
    notes: row.notes ?? "",
    customerEmail: row.customerEmail ?? "",
    cardLast4: row.cardLast4 ?? "",
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <CrudSheet
        open={open}
        onOpenChange={setOpen}
        title={`Edit ${row.id}`}
        description="Every change is recorded in the audit trail. Downstream numbers (client ledger, FP revenue, settlement batch totals) recompute automatically."
        widthClassName="sm:max-w-2xl"
      >
        <TransactionForm
          key={row.id}
          editingId={row.id}
          defaultValues={defaultValues}
          clients={clients}
          merchants={merchants}
          bankAccounts={bankAccounts}
          paymentMethods={paymentMethods}
          onSuccess={() => setOpen(false)}
          hideChrome
        />
      </CrudSheet>
    </>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/ui/tone-badge";
import { statusTone } from "@/lib/status-tone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BreakdownTable } from "./breakdown-table";
import { ReviewActions } from "./review-actions";
import { MarkSettledAction } from "./settlement-actions";
import { HoldAction } from "./hold-action";
import { RcvActions } from "./rcv-actions";
import { EditTransactionAction } from "./edit-transaction-action";
import { TransactionHistoryAction } from "./transaction-history-action";
import { DeleteTransactionAction } from "./delete-transaction-action";
import { getTransactionFullDetail, type TransactionDetailBundle } from "./actions";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}

function dt(iso: string | null): string {
  return iso ? format(new Date(iso), "yyyy-MM-dd HH:mm") : "—";
}

export function TransactionDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [bundle, setBundle] = useState<TransactionDetailBundle | null>(null);

  // On-demand refetch for after an action succeeds (Approve/Settle/Edit/...)
  // -- called from those components' own onSuccess, i.e. from an event
  // continuation, not from this effect below.
  const refresh = useCallback(async () => {
    if (!id) return;
    const result = await getTransactionFullDetail(id);
    if (!result) {
      // Deleted from underneath us -- nothing left to show.
      onOpenChange(false);
      return;
    }
    setBundle(result);
  }, [id, onOpenChange]);

  // Fetch once whenever this dialog is opened for a given id. The parent
  // keys this component by id (see transaction-board-body.tsx), so a
  // different transaction always gets a fresh mount -- no manual reset of
  // `bundle` needed here, which keeps this effect free of any setState call
  // before its first await.
  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const result = await getTransactionFullDetail(id);
      if (cancelled) return;
      if (!result) {
        onOpenChange(false);
        return;
      }
      setBundle(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, id, onOpenChange]);

  const t = bundle?.transaction;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t ? `Transaction ${t.id}` : "Transaction detail"}
            {t && <ToneBadge tone={statusTone.transaction(t.status)}>{t.status.replace(/_/g, " ")}</ToneBadge>}
          </DialogTitle>
          <DialogDescription>
            {t ? `${t.clientName} -- ${t.paymentMethodName} -- ${format(new Date(t.transactionDate), "yyyy-MM-dd")}` : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        {!bundle && open && <p className="text-sm text-muted-foreground">Loading...</p>}

        {t && bundle && (
          <div className="space-y-5">
            <div className="flex flex-wrap justify-end gap-2 rounded-md border bg-muted/30 p-2">
              <ReviewActions id={t.id} status={t.status} onSuccess={refresh} />
              <MarkSettledAction id={t.id} status={t.status} onSuccess={refresh} />
              <HoldAction id={t.id} status={t.status} onSuccess={refresh} />
              <RcvActions id={t.id} status={t.status} onSuccess={refresh} />
              <EditTransactionAction
                row={{
                  id: t.id,
                  transactionDate: t.transactionDate,
                  clientId: t.clientId,
                  clientReference: t.clientReference,
                  merchantId: t.merchantId,
                  expectedBankId: t.expectedBankId,
                  paymentMethodId: t.paymentMethodId,
                  grossAmount: t.grossAmount,
                  feeBasis: t.feeBasis,
                  chargeType: t.chargeType,
                  fixedChargeAmount: t.fixedChargeAmount,
                  feeBearer: t.feeBearer,
                  merchantFeeManual: t.merchantFeeManual,
                  merchantReservePercent: t.merchantReservePercent,
                  merchantReserveBasis: t.merchantReserveBasis,
                  merchantReserveDirection: t.merchantReserveDirection,
                  fpReservePercent: t.fpReservePercent,
                  documentUrl: t.documentUrl,
                  notes: t.notes,
                  customerEmail: t.customerEmail,
                  cardLast4: t.cardLast4,
                }}
                monthOpen={bundle.monthOpen}
                clients={bundle.clients}
                merchants={bundle.merchants}
                bankAccounts={bundle.bankAccounts}
                paymentMethods={bundle.paymentMethods}
                onSuccess={refresh}
              />
              <TransactionHistoryAction id={t.id} />
              <DeleteTransactionAction id={t.id} monthOpen={bundle.monthOpen} onSuccess={refresh} />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Calculation breakdown</h3>
              <BreakdownTable
                transaction={{
                  id: t.id,
                  grossAmount: t.grossAmount,
                  feeBasis: t.feeBasis,
                  netAmountReceived: t.netAmountReceived,
                  fpRatePercent: t.fpRatePercent,
                  chargeType: t.chargeType,
                  fpFee: t.fpFee,
                  merchantFee: t.merchantFee,
                  feeBearer: t.feeBearer,
                  merchantReservePercent: t.merchantReservePercent,
                  merchantReserveBasis: t.merchantReserveBasis,
                  merchantReserveAmount: t.merchantReserveAmount,
                  fpReservePercent: t.fpReservePercent,
                  fpReserveAmount: t.fpReserveAmount,
                  clientNetPayable: t.clientNetPayable,
                }}
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">All stored fields</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border p-3 sm:grid-cols-3">
                <Field label="Transaction ID" value={t.id} />
                <Field label="Accounting month" value={t.accountingMonth} />
                <Field label="Transaction date" value={format(new Date(t.transactionDate), "yyyy-MM-dd")} />
                <Field label="Client" value={t.clientName} />
                <Field label="Client reference" value={t.clientReference} />
                <Field label="Merchant" value={t.merchantName ?? "Direct (no merchant)"} />
                <Field label="Payment method" value={t.paymentMethodName} />
                <Field label="Expected bank" value={t.expectedBankName} />
                <Field label="Gross amount" value={t.grossAmount} />
                <Field label="Fee basis" value={t.feeBasis === "GROSS" ? "Gross" : "Net (after merchant charges)"} />
                <Field label="Net amount received" value={t.netAmountReceived} />
                <Field label="FP rate %" value={`${t.fpRatePercent}%`} />
                <Field label="Charge type" value={t.chargeType} />
                <Field label="Fixed charge amount" value={t.fixedChargeAmount} />
                <Field label="FP fee (total, gross revenue)" value={t.fpFee} />
                <Field label="Referral partner" value={t.referralPartnerName ? `${t.referralPartnerName} (${t.referralPartnerRatePercent}%)` : "None"} />
                <Field label="Referral partner fee (payable)" value={t.referralPartnerFee} />
                <Field label="FoundaPay pure fee (own revenue)" value={t.foundapayPureFee} />
                <Field label="Fee bearer" value={t.feeBearer === "CLIENT" ? "Client" : "FoundaPay"} />
                <Field label="Merchant fee (manual)" value={t.merchantFeeManual} />
                <Field label="Merchant fee (rule default)" value={t.merchantFeeDefault} />
                <Field label="Merchant fee (actual)" value={t.merchantFee} />
                <Field label="Merchant fee source" value={t.merchantFeeSource} />
                <Field label="Merchant reserve %" value={`${t.merchantReservePercent}%`} />
                <Field
                  label="Merchant reserve basis"
                  value={t.merchantReserveBasis === "GROSS" ? "Gross" : "Net (after merchant charges)"}
                />
                <Field label="Merchant reserve amount" value={t.merchantReserveAmount} />
                <Field label="Merchant reserve direction" value={t.merchantReserveDirection.replace(/_/g, " ")} />
                <Field label="FP reserve %" value={`${t.fpReservePercent}%`} />
                <Field label="FP reserve amount" value={t.fpReserveAmount} />
                <Field label="Expected settlement" value={t.expectedSettlement} />
                <Field label="Actual settlement" value={t.actualSettlement} />
                <Field label="Settlement batch" value={t.settlementBatchId} />
                <Field label="Client net payable" value={t.clientNetPayable} />
                <Field label="Status" value={t.status.replace(/_/g, " ")} />
                <Field label="Settlement date" value={t.settlementDate ? format(new Date(t.settlementDate), "yyyy-MM-dd") : null} />
                <Field label="Customer email" value={t.customerEmail} />
                <Field label="Card last 4" value={t.cardLast4} />
                <Field label="Document / proof link" value={t.documentUrl} />
                <Field label="Review notes" value={t.reviewNotes} />
                <Field label="Notes" value={t.notes} />
                <Field label="Created by" value={t.createdByName} />
                <Field label="Created at" value={dt(t.createdAt)} />
                <Field label="Approved by" value={t.approvedByName} />
                <Field label="Approved at" value={dt(t.approvedAt)} />
                <Field label="Last updated by" value={t.updatedByName} />
                <Field label="Last updated at" value={dt(t.updatedAt)} />
              </dl>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

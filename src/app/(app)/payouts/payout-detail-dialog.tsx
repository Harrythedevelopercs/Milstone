"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { EntityDetailDialog, DetailFieldGrid } from "@/components/entity-detail-dialog";
import { EntityHistoryAction } from "@/components/entity-history-action";
import { DeletePayoutAction } from "./delete-payout-action";
import { getPayoutFullDetail, type PayoutDetailBundle } from "./actions";

export function PayoutDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [bundle, setBundle] = useState<PayoutDetailBundle | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const result = await getPayoutFullDetail(id);
    if (!result) {
      onOpenChange(false);
      return;
    }
    setBundle(result);
  }, [id, onOpenChange]);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const result = await getPayoutFullDetail(id);
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

  const p = bundle?.payout;

  return (
    <EntityDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={p ? `Payout ${p.id}` : "Payout detail"}
      subtitle={p ? `${p.clientName} -- ${p.payoutMethodName} -- ${format(new Date(p.payoutDate), "yyyy-MM-dd")}` : undefined}
      statusBadge={p && <Badge variant="outline">{p.status}</Badge>}
      loading={!bundle}
      actions={
        p && (
          <>
            <EntityHistoryAction entityType="ClientPayout" entityId={p.id} />
            <DeletePayoutAction id={p.id} monthOpen={bundle!.monthOpen} onSuccess={refresh} />
          </>
        )
      }
    >
      {p && (
        <DetailFieldGrid
          fields={[
            { label: "Payout ID", value: p.id },
            { label: "Accounting month", value: p.accountingMonth },
            { label: "Payout date", value: format(new Date(p.payoutDate), "yyyy-MM-dd") },
            { label: "Client", value: p.clientName },
            { label: "Payout method", value: p.payoutMethodName },
            { label: "Bank account", value: p.bankAccountName },
            { label: "Amount paid", value: p.amountPaid },
            { label: "General amount (unallocated)", value: p.generalAmount },
            { label: "Remittance fee", value: p.remittanceFee },
            { label: "Fee bearer", value: p.feeBearer === "CLIENT" ? "Client" : "FoundaPay" },
            { label: "Reference", value: p.reference },
            { label: "Status", value: p.status },
            { label: "Transactions allocated", value: String(p.allocationCount) },
            { label: "Notes", value: p.notes },
            { label: "Created at", value: format(new Date(p.createdAt), "yyyy-MM-dd HH:mm") },
          ]}
        />
      )}
    </EntityDetailDialog>
  );
}

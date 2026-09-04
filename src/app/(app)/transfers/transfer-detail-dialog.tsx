"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ToneBadge } from "@/components/ui/tone-badge";
import { EntityDetailDialog, DetailFieldGrid } from "@/components/entity-detail-dialog";
import { EntityHistoryAction } from "@/components/entity-history-action";
import { MarkSettledAction } from "@/components/ui/mark-settled-action";
import { getTransferFullDetail, markInternalTransferSettled, type TransferFullDetail } from "./actions";

export function TransferDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [t, setT] = useState<TransferFullDetail | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const result = await getTransferFullDetail(id);
    if (!result) {
      onOpenChange(false);
      return;
    }
    setT(result);
  }, [id, onOpenChange]);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const result = await getTransferFullDetail(id);
      if (cancelled) return;
      if (!result) {
        onOpenChange(false);
        return;
      }
      setT(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, id, onOpenChange]);

  const pending = t?.settlementStatus === "PENDING";

  return (
    <EntityDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t ? `Transfer ${t.id}` : "Transfer detail"}
      subtitle={t ? `${t.fromBankAccountName} → ${t.toBankAccountName} -- ${format(new Date(t.transferDate), "yyyy-MM-dd")}` : undefined}
      statusBadge={t && <ToneBadge tone={pending ? "warning" : "success"}>{pending ? "Pending" : "Settled"}</ToneBadge>}
      loading={!t}
      actions={
        t && (
          <>
            {pending && (
              <MarkSettledAction id={t.id} action={markInternalTransferSettled} onSuccess={refresh} />
            )}
            <EntityHistoryAction entityType="InternalTransfer" entityId={t.id} />
          </>
        )
      }
    >
      {t && (
        <DetailFieldGrid
          fields={[
            { label: "Transfer ID", value: t.id },
            { label: "Accounting month", value: t.accountingMonth },
            { label: "Transfer date", value: format(new Date(t.transferDate), "yyyy-MM-dd") },
            { label: "From bank account", value: t.fromBankAccountName },
            { label: "To bank account", value: t.toBankAccountName },
            { label: "Amount", value: t.amount },
            { label: "Fee amount", value: t.feeAmount },
            { label: "Fee bearer", value: t.feeBearer === "CLIENT" ? `Client (${t.clientName ?? "—"})` : t.feeBearer === "FOUNDAPAY" ? "FoundaPay" : null },
            { label: "Settlement status", value: t.settlementStatus },
            { label: "Settled at", value: t.settledAt ? format(new Date(t.settledAt), "yyyy-MM-dd HH:mm") : null },
            { label: "Settled by", value: t.settledByName },
            { label: "Notes", value: t.notes },
            { label: "Created by", value: t.createdByName },
            { label: "Created at", value: format(new Date(t.createdAt), "yyyy-MM-dd HH:mm") },
          ]}
        />
      )}
    </EntityDetailDialog>
  );
}

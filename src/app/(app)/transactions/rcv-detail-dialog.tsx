"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { statusTone } from "@/lib/status-tone";
import { ToneBadge } from "@/components/ui/tone-badge";
import { EntityDetailDialog, DetailFieldGrid } from "@/components/entity-detail-dialog";
import { EntityHistoryAction } from "@/components/entity-history-action";
import { DeleteRcvAction } from "./delete-rcv-action";
import { FulfillChargebackAction } from "./fulfill-chargeback-action";
import { getRcvFullDetail, type RcvDetailBundle } from "./actions";

const TYPE_LABEL = { REFUND: "Refund", CHARGEBACK: "Chargeback", VOID: "Void" };

export function RcvDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [bundle, setBundle] = useState<RcvDetailBundle | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const result = await getRcvFullDetail(id);
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
      const result = await getRcvFullDetail(id);
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

  const r = bundle?.rcv;
  const canFulfill = r && r.type === "CHARGEBACK" && !r.fulfilledAt && (r.status === "OPEN" || r.status === "DISPUTED");

  return (
    <EntityDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={r ? `${TYPE_LABEL[r.type]} ${r.id}` : "Refund / Chargeback / Void detail"}
      subtitle={r ? `${r.clientName} -- original transaction ${r.originalTransactionId} -- ${format(new Date(r.eventDate), "yyyy-MM-dd")}` : undefined}
      statusBadge={r && <ToneBadge tone={statusTone.rcvStatus(r.status)}>{r.status}</ToneBadge>}
      loading={!bundle}
      actions={
        r && (
          <>
            {canFulfill && <FulfillChargebackAction rcvId={r.id} bankAccounts={bundle!.bankAccounts} onSuccess={refresh} />}
            <EntityHistoryAction entityType="RefundChargebackVoid" entityId={r.id} />
            <DeleteRcvAction id={r.id} monthOpen={bundle!.monthOpen} onSuccess={refresh} />
          </>
        )
      }
    >
      {r && (
        <>
          <p className="text-sm">
            Original transaction:{" "}
            <Link href="/transactions/received" className="underline">
              {r.originalTransactionId}
            </Link>
          </p>
          <DetailFieldGrid
            fields={[
              { label: "Entry ID", value: r.id },
              { label: "Type", value: TYPE_LABEL[r.type] },
              { label: "Accounting month", value: r.accountingMonth },
              { label: "Event date", value: format(new Date(r.eventDate), "yyyy-MM-dd") },
              { label: "Client", value: r.clientName },
              { label: "Amount", value: r.amount },
              { label: "Fee amount", value: r.feeAmount },
              { label: "Fee bearer", value: r.feeBearer },
              { label: "Status", value: r.status },
              { label: "Reason code", value: r.reasonCode },
              { label: "Notes", value: r.notes },
              { label: "Document / proof link", value: r.documentUrl },
              { label: "Created by", value: r.createdByName },
              { label: "Created at", value: format(new Date(r.createdAt), "yyyy-MM-dd HH:mm") },
              { label: "Approved by", value: r.approvedByName },
              { label: "Approved at", value: r.approvedAt ? format(new Date(r.approvedAt), "yyyy-MM-dd HH:mm") : null },
              { label: "Fulfilled at", value: r.fulfilledAt ? format(new Date(r.fulfilledAt), "yyyy-MM-dd HH:mm") : null },
              { label: "Fulfilled by", value: r.fulfilledByName },
              { label: "Fulfillment bank account", value: r.fulfillmentBankAccountName },
            ]}
          />
        </>
      )}
    </EntityDetailDialog>
  );
}

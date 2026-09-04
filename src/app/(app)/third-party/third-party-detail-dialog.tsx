"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { EntityDetailDialog, DetailFieldGrid } from "@/components/entity-detail-dialog";
import { EntityHistoryAction } from "@/components/entity-history-action";
import { getThirdPartySettlementFullDetail, type ThirdPartySettlementFullDetail } from "./actions";

export function ThirdPartyDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [s, setS] = useState<ThirdPartySettlementFullDetail | null>(null);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const result = await getThirdPartySettlementFullDetail(id);
      if (cancelled) return;
      if (!result) {
        onOpenChange(false);
        return;
      }
      setS(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, id, onOpenChange]);

  return (
    <EntityDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={s ? `Third-Party Settlement ${s.id}` : "Third-party settlement detail"}
      subtitle={s ? `${s.settlementPartyName} -- ${format(new Date(s.settlementDate), "yyyy-MM-dd")}` : undefined}
      loading={!s}
      actions={s && <EntityHistoryAction entityType="ThirdPartySettlement" entityId={s.id} />}
    >
      {s && (
        <DetailFieldGrid
          fields={[
            { label: "Settlement ID", value: s.id },
            { label: "Accounting month", value: s.accountingMonth },
            { label: "Settlement date", value: format(new Date(s.settlementDate), "yyyy-MM-dd") },
            { label: "Settlement party", value: s.settlementPartyName },
            { label: "Client", value: s.clientName },
            {
              label: "Direction",
              value: s.direction === "CLIENT_PAYABLE_TO_THIRD_PARTY" ? "Client → Third Party" : "FoundaPay → Third Party",
            },
            { label: "Amount", value: s.amount },
            { label: "Bank account", value: s.bankAccountName },
            { label: "Related transaction", value: s.relatedTransactionId },
            { label: "Notes", value: s.notes },
            { label: "Created by", value: s.createdByName },
            { label: "Created at", value: format(new Date(s.createdAt), "yyyy-MM-dd HH:mm") },
          ]}
        />
      )}
    </EntityDetailDialog>
  );
}

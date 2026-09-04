"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { EntityDetailDialog, DetailFieldGrid } from "@/components/entity-detail-dialog";
import { EntityHistoryAction } from "@/components/entity-history-action";
import { getPartnerDistributionFullDetail, type PartnerDistributionFullDetail } from "./actions";

export function PartnerDistributionDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pl, setPl] = useState<PartnerDistributionFullDetail | null>(null);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const result = await getPartnerDistributionFullDetail(id);
      if (cancelled) return;
      if (!result) {
        onOpenChange(false);
        return;
      }
      setPl(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, id, onOpenChange]);

  return (
    <EntityDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={pl ? `Partner Ledger Entry ${pl.id}` : "Partner distribution detail"}
      subtitle={pl ? `${pl.partnerName} -- ${format(new Date(pl.entryDate), "yyyy-MM-dd")}` : undefined}
      loading={!pl}
      actions={pl && <EntityHistoryAction entityType="PartnerLedger" entityId={pl.id} />}
    >
      {pl && (
        <DetailFieldGrid
          fields={[
            { label: "Entry ID", value: pl.id },
            { label: "Accounting month", value: pl.accountingMonth },
            { label: "Entry date", value: format(new Date(pl.entryDate), "yyyy-MM-dd") },
            { label: "Partner", value: pl.partnerName },
            { label: "Amount", value: pl.amount },
            { label: "Kind", value: pl.kind.replace(/_/g, " ") },
            { label: "Source type", value: pl.sourceType },
            { label: "Description", value: pl.description },
            { label: "Created by", value: pl.createdByName },
            { label: "Created at", value: format(new Date(pl.createdAt), "yyyy-MM-dd HH:mm") },
          ]}
        />
      )}
    </EntityDetailDialog>
  );
}

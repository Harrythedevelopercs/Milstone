"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { EntityDetailDialog, DetailFieldGrid } from "@/components/entity-detail-dialog";
import { EntityHistoryAction } from "@/components/entity-history-action";
import { getCommissionFullDetail, type CommissionFullDetail } from "./actions";

export function CommissionDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [c, setC] = useState<CommissionFullDetail | null>(null);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const result = await getCommissionFullDetail(id);
      if (cancelled) return;
      if (!result) {
        onOpenChange(false);
        return;
      }
      setC(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, id, onOpenChange]);

  return (
    <EntityDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={c ? `Employee-Partner Ledger Entry ${c.id}` : "Commission entry detail"}
      subtitle={c ? `${c.employeeName} -- ${format(new Date(c.entryDate), "yyyy-MM-dd")}` : undefined}
      loading={!c}
      actions={c && <EntityHistoryAction entityType="EmployeePartnerLedger" entityId={c.id} />}
    >
      {c && (
        <DetailFieldGrid
          fields={[
            { label: "Entry ID", value: c.id },
            { label: "Accounting month", value: c.accountingMonth },
            { label: "Entry date", value: format(new Date(c.entryDate), "yyyy-MM-dd") },
            { label: "Employee", value: c.employeeName },
            { label: "Amount", value: c.amount },
            { label: "Kind", value: c.kind },
            { label: "Source type", value: c.sourceType },
            { label: "Related transaction", value: c.transactionId },
            { label: "Description", value: c.description },
            { label: "Created by", value: c.createdByName },
            { label: "Created at", value: format(new Date(c.createdAt), "yyyy-MM-dd HH:mm") },
          ]}
        />
      )}
    </EntityDetailDialog>
  );
}

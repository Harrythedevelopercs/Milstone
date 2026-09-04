"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { EntityDetailDialog, DetailFieldGrid } from "@/components/entity-detail-dialog";
import { EntityHistoryAction } from "@/components/entity-history-action";
import { getSalaryFullDetail, type SalaryFullDetail } from "./actions";

export function SalaryDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [sl, setSl] = useState<SalaryFullDetail | null>(null);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const result = await getSalaryFullDetail(id);
      if (cancelled) return;
      if (!result) {
        onOpenChange(false);
        return;
      }
      setSl(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, id, onOpenChange]);

  return (
    <EntityDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={sl ? `Salary Disbursement ${sl.id}` : "Salary disbursement detail"}
      subtitle={sl ? `${sl.employeeName} -- ${format(new Date(sl.entryDate), "yyyy-MM-dd")}` : undefined}
      loading={!sl}
      actions={sl && <EntityHistoryAction entityType="SalaryLedger" entityId={sl.id} />}
    >
      {sl && (
        <DetailFieldGrid
          fields={[
            { label: "Entry ID", value: sl.id },
            { label: "Accounting month", value: sl.accountingMonth },
            { label: "Entry date", value: format(new Date(sl.entryDate), "yyyy-MM-dd") },
            { label: "Employee", value: sl.employeeName },
            { label: "Amount", value: sl.amount },
            { label: "Pay period", value: sl.payPeriod },
            { label: "Source type", value: sl.sourceType },
            { label: "Description", value: sl.description },
            { label: "Created by", value: sl.createdByName },
            { label: "Created at", value: format(new Date(sl.createdAt), "yyyy-MM-dd HH:mm") },
          ]}
        />
      )}
    </EntityDetailDialog>
  );
}

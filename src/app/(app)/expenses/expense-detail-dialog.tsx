"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ToneBadge } from "@/components/ui/tone-badge";
import { EntityDetailDialog, DetailFieldGrid } from "@/components/entity-detail-dialog";
import { EntityHistoryAction } from "@/components/entity-history-action";
import { MarkSettledAction } from "@/components/ui/mark-settled-action";
import { getExpenseFullDetail, markExpenseSettled, type ExpenseFullDetail } from "./actions";

export function ExpenseDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [e, setE] = useState<ExpenseFullDetail | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const result = await getExpenseFullDetail(id);
    if (!result) {
      onOpenChange(false);
      return;
    }
    setE(result);
  }, [id, onOpenChange]);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const result = await getExpenseFullDetail(id);
      if (cancelled) return;
      if (!result) {
        onOpenChange(false);
        return;
      }
      setE(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, id, onOpenChange]);

  const pending = e?.settlementStatus === "PENDING";

  return (
    <EntityDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={e ? `Expense ${e.id}` : "Expense detail"}
      subtitle={e ? `${e.categoryName} -- ${format(new Date(e.expenseDate), "yyyy-MM-dd")}` : undefined}
      statusBadge={e && <ToneBadge tone={pending ? "warning" : "success"}>{pending ? "Pending" : "Settled"}</ToneBadge>}
      loading={!e}
      actions={
        e && (
          <>
            {pending && <MarkSettledAction id={e.id} action={markExpenseSettled} onSuccess={refresh} />}
            <EntityHistoryAction entityType="Expense" entityId={e.id} />
          </>
        )
      }
    >
      {e && (
        <DetailFieldGrid
          fields={[
            { label: "Expense ID", value: e.id },
            { label: "Accounting month", value: e.accountingMonth },
            { label: "Expense date", value: format(new Date(e.expenseDate), "yyyy-MM-dd") },
            { label: "Category", value: e.categoryName },
            { label: "Vendor", value: e.vendorName },
            { label: "Company", value: e.companyName },
            { label: "Business unit", value: e.businessUnitName },
            { label: "Paid from (bank account)", value: e.bankAccountName },
            { label: "Amount", value: `${e.amount} ${e.currency}` },
            { label: "Recurring", value: e.recurring ? "Yes" : "No" },
            { label: "Fee bearer", value: e.feeBearer === "CLIENT" ? `Client (${e.clientName ?? "—"})` : "FoundaPay" },
            { label: "Record status", value: e.status },
            { label: "Settlement status", value: e.settlementStatus },
            { label: "Settled at", value: e.settledAt ? format(new Date(e.settledAt), "yyyy-MM-dd HH:mm") : null },
            { label: "Settled by", value: e.settledByName },
            { label: "Document / proof link", value: e.documentUrl },
            { label: "Description", value: e.description },
            { label: "Created by", value: e.createdByName },
            { label: "Created at", value: format(new Date(e.createdAt), "yyyy-MM-dd HH:mm") },
            { label: "Approved by", value: e.approvedByName },
            { label: "Approved at", value: e.approvedAt ? format(new Date(e.approvedAt), "yyyy-MM-dd HH:mm") : null },
          ]}
        />
      )}
    </EntityDetailDialog>
  );
}

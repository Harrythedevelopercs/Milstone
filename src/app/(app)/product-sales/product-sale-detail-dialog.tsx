"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { EntityDetailDialog, DetailFieldGrid } from "@/components/entity-detail-dialog";
import { EntityHistoryAction } from "@/components/entity-history-action";
import { getProductSaleFullDetail, type ProductSaleFullDetail } from "./actions";

export function ProductSaleDetailDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [ps, setPs] = useState<ProductSaleFullDetail | null>(null);

  useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    (async () => {
      const result = await getProductSaleFullDetail(id);
      if (cancelled) return;
      if (!result) {
        onOpenChange(false);
        return;
      }
      setPs(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, id, onOpenChange]);

  return (
    <EntityDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={ps ? `Product/Service Sale ${ps.id}` : "Product/service sale detail"}
      subtitle={ps ? `${ps.productServiceName} -- ${format(new Date(ps.saleDate), "yyyy-MM-dd")}` : undefined}
      loading={!ps}
      actions={ps && <EntityHistoryAction entityType="ProductServiceSale" entityId={ps.id} />}
    >
      {ps && (
        <DetailFieldGrid
          fields={[
            { label: "Sale ID", value: ps.id },
            { label: "Accounting month", value: ps.accountingMonth },
            { label: "Sale date", value: format(new Date(ps.saleDate), "yyyy-MM-dd") },
            { label: "Product/Service", value: ps.productServiceName },
            { label: "Client", value: ps.clientName },
            { label: "Business unit", value: ps.businessUnitName },
            { label: "Quantity", value: String(ps.quantity) },
            { label: "Unit cost", value: ps.unitCost },
            { label: "Unit sell price", value: ps.unitSellPrice },
            { label: "Total revenue", value: ps.totalRevenue },
            { label: "Total cost (COGS)", value: ps.totalCost },
            { label: "Deducted from client balance", value: ps.deductFromClientBalance ? "Yes" : "No" },
            { label: "Notes", value: ps.notes },
            { label: "Created by", value: ps.createdByName },
            { label: "Created at", value: format(new Date(ps.createdAt), "yyyy-MM-dd HH:mm") },
          ]}
        />
      )}
    </EntityDetailDialog>
  );
}

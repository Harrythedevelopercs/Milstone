"use client";

import { useState } from "react";
import { TableBody } from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";
import type { ClientMoneyMovementRow, MoneyMovementType } from "@/lib/transactions/unified-board-types";
import { TransactionBoardRow } from "./transaction-board-row";
import { TransactionDetailDialog } from "./transaction-detail-dialog";
import { RcvDetailDialog } from "./rcv-detail-dialog";
import { PayoutDetailDialog } from "../payouts/payout-detail-dialog";
import { TransferDetailDialog } from "../transfers/transfer-detail-dialog";
import { ExpenseDetailDialog } from "../expenses/expense-detail-dialog";
import { ThirdPartyDetailDialog } from "../third-party/third-party-detail-dialog";
import { SalaryDetailDialog } from "../distributions/salary-detail-dialog";
import { CommissionDetailDialog } from "../employee-partner-ledger/commission-detail-dialog";
import { PartnerDistributionDetailDialog } from "../partner-ledger/partner-distribution-detail-dialog";
import { ProductSaleDetailDialog } from "../product-sales/product-sale-detail-dialog";

type Selected = { id: string; type: MoneyMovementType } | null;

export function TransactionBoardBody({
  rows,
  emptyMessage,
}: {
  rows: ClientMoneyMovementRow[];
  emptyMessage: string;
}) {
  const [selected, setSelected] = useState<Selected>(null);
  const close = () => setSelected(null);
  const selectedId = selected?.id ?? null;
  const dialogKey = selected ? `${selected.type}-${selected.id}` : "none";

  return (
    <>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyTableRow colSpan={5} message={emptyMessage} />
        ) : (
          rows.map((r) => (
            <TransactionBoardRow
              key={`${r.type}-${r.id}`}
              row={r}
              onOpenDetail={(id, type) => setSelected({ id, type })}
            />
          ))
        )}
      </TableBody>

      {/* Each type gets its own dialog, reusing that module's real action
          components -- only the one matching the current selection is ever
          open. Keyed by id+type so switching between rows always mounts a
          fresh instance (see transaction-detail-dialog.tsx for why). */}
      <TransactionDetailDialog
        key={`RECEIVED-${dialogKey}`}
        id={selected?.type === "RECEIVED" ? selectedId : null}
        open={selected?.type === "RECEIVED"}
        onOpenChange={(open) => !open && close()}
      />
      <PayoutDetailDialog
        key={`PAYOUT-${dialogKey}`}
        id={selected?.type === "PAYOUT" ? selectedId : null}
        open={selected?.type === "PAYOUT"}
        onOpenChange={(open) => !open && close()}
      />
      <TransferDetailDialog
        key={`TRANSFER-${dialogKey}`}
        id={selected?.type === "TRANSFER" ? selectedId : null}
        open={selected?.type === "TRANSFER"}
        onOpenChange={(open) => !open && close()}
      />
      <ExpenseDetailDialog
        key={`EXPENSE-${dialogKey}`}
        id={selected?.type === "EXPENSE" ? selectedId : null}
        open={selected?.type === "EXPENSE"}
        onOpenChange={(open) => !open && close()}
      />
      <RcvDetailDialog
        key={`RCV-${dialogKey}`}
        id={
          selected?.type === "REFUND" || selected?.type === "CHARGEBACK" || selected?.type === "VOID"
            ? selectedId
            : null
        }
        open={selected?.type === "REFUND" || selected?.type === "CHARGEBACK" || selected?.type === "VOID"}
        onOpenChange={(open) => !open && close()}
      />
      <ThirdPartyDetailDialog
        key={`THIRD_PARTY-${dialogKey}`}
        id={selected?.type === "THIRD_PARTY_SETTLEMENT" ? selectedId : null}
        open={selected?.type === "THIRD_PARTY_SETTLEMENT"}
        onOpenChange={(open) => !open && close()}
      />
      <SalaryDetailDialog
        key={`SALARY-${dialogKey}`}
        id={selected?.type === "SALARY" ? selectedId : null}
        open={selected?.type === "SALARY"}
        onOpenChange={(open) => !open && close()}
      />
      <CommissionDetailDialog
        key={`COMMISSION-${dialogKey}`}
        id={selected?.type === "COMMISSION" ? selectedId : null}
        open={selected?.type === "COMMISSION"}
        onOpenChange={(open) => !open && close()}
      />
      <PartnerDistributionDetailDialog
        key={`PARTNER_DISTRIBUTION-${dialogKey}`}
        id={selected?.type === "PARTNER_DISTRIBUTION" ? selectedId : null}
        open={selected?.type === "PARTNER_DISTRIBUTION"}
        onOpenChange={(open) => !open && close()}
      />
      <ProductSaleDetailDialog
        key={`PRODUCT_SERVICE_SALE-${dialogKey}`}
        id={selected?.type === "PRODUCT_SERVICE_SALE" ? selectedId : null}
        open={selected?.type === "PRODUCT_SERVICE_SALE"}
        onOpenChange={(open) => !open && close()}
      />
    </>
  );
}

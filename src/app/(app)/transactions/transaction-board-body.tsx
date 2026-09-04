"use client";

import { useState } from "react";
import { TableBody } from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";
import type { ClientMoneyMovementRow } from "@/lib/transactions/unified-board-types";
import { TransactionBoardRow } from "./transaction-board-row";
import { TransactionDetailDialog } from "./transaction-detail-dialog";

export function TransactionBoardBody({
  rows,
  emptyMessage,
}: {
  rows: ClientMoneyMovementRow[];
  emptyMessage: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyTableRow colSpan={5} message={emptyMessage} />
        ) : (
          rows.map((r) => (
            <TransactionBoardRow key={`${r.type}-${r.id}`} row={r} onOpenDetail={setSelectedId} />
          ))
        )}
      </TableBody>
      <TransactionDetailDialog
        key={selectedId ?? "none"}
        id={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </>
  );
}

"use client";

import { format } from "date-fns";
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { ToneBadge } from "@/components/ui/tone-badge";
import { cn } from "@/lib/utils";
import { NEEDS_ATTENTION_ROW_CLASS } from "@/lib/status-tone";
import {
  MONEY_MOVEMENT_TYPE_LABEL,
  isPendingApproval,
  moneyMovementRowTone,
  type ClientMoneyMovementRow,
} from "@/lib/transactions/unified-board-types";

export function TransactionBoardRow({
  row,
  onOpenDetail,
}: {
  row: ClientMoneyMovementRow;
  onOpenDetail: (id: string, type: ClientMoneyMovementRow["type"]) => void;
}) {
  const pending = isPendingApproval(row);
  const tone = moneyMovementRowTone(row);
  const amountNum = Number(row.amount);

  return (
    <TableRow
      onClick={() => onOpenDetail(row.id, row.type)}
      title="Click for full details and actions"
      className={cn("cursor-pointer hover:bg-muted/60", pending && NEEDS_ATTENTION_ROW_CLASS)}
    >
      <TableCell>{format(row.date, "yyyy-MM-dd")}</TableCell>
      <TableCell>
        <Link href={row.href} onClick={(e) => e.stopPropagation()} className="text-sm hover:underline">
          {MONEY_MOVEMENT_TYPE_LABEL[row.type]}
        </Link>
      </TableCell>
      <TableCell className="max-w-md truncate text-sm text-muted-foreground" title={row.description}>
        {row.description}
      </TableCell>
      <TableCell
        className={cn(
          "text-right",
          amountNum > 0 && "text-emerald-600 dark:text-emerald-400",
          amountNum < 0 && "text-red-600 dark:text-red-400"
        )}
      >
        {row.amount}
      </TableCell>
      <TableCell>
        {row.status ? <ToneBadge tone={tone}>{row.status.replace(/_/g, " ")}</ToneBadge> : "—"}
      </TableCell>
    </TableRow>
  );
}

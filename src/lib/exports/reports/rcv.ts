import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, dateRangeWhere, num, parseDateRange } from "./helpers";

export async function fetchRcv(params: URLSearchParams): Promise<ExportPayload> {
  const range = parseDateRange(params);
  const type = params.get("type") || undefined;

  const rows = await prisma.refundChargebackVoid.findMany({
    where: {
      ...dateRangeWhere(range, "eventDate"),
      ...(type ? { type: type as never } : {}),
    },
    orderBy: { eventDate: "asc" },
    include: {
      originalTransaction: { select: { client: { select: { name: true } }, fpFee: true } },
    },
  });

  const table = rows.map((r) => ({
    type: r.type,
    date: format(r.eventDate, "yyyy-MM-dd"),
    month: r.accountingMonth,
    originalTxn: r.originalTransactionId,
    client: r.originalTransaction.client.name,
    amount: num(r.amount),
    originalFpFee: num(r.originalTransaction.fpFee),
    status: r.status,
    reason: r.reasonCode ?? "—",
  }));

  const totalsByType = table.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + r.amount;
    return acc;
  }, {});

  return {
    title: "Refunds, Chargebacks & Voids",
    subtitle: "Every reversal is linked to its original transaction.",
    filterRange: dateRangeLabel(range),
    summary: [
      { label: "Entry count", value: String(table.length) },
      ...Object.entries(totalsByType).map(([t, v]) => ({
        label: `${t.charAt(0)}${t.slice(1).toLowerCase()} total`,
        value: v.toFixed(2),
      })),
    ],
    table: {
      columns: [
        { key: "type", header: "Type", type: "text" },
        { key: "date", header: "Event Date", type: "date" },
        { key: "month", header: "Month", type: "text" },
        { key: "originalTxn", header: "Original Txn", type: "text" },
        { key: "client", header: "Client", type: "text" },
        { key: "amount", header: "Amount", type: "number" },
        { key: "originalFpFee", header: "Original FP Fee", type: "number" },
        { key: "status", header: "Status", type: "text" },
        { key: "reason", header: "Reason", type: "text" },
      ],
      rows: table,
    },
  };
}

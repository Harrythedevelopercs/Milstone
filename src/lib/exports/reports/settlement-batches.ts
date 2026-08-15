import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, dateRangeWhere, num, parseDateRange } from "./helpers";

export async function fetchSettlementBatches(params: URLSearchParams): Promise<ExportPayload> {
  const range = parseDateRange(params);

  const batches = await prisma.settlementBatch.findMany({
    where: dateRangeWhere(range, "depositDate"),
    orderBy: { depositDate: "asc" },
    include: {
      merchant: { select: { name: true } },
      bankAccount: { select: { name: true } },
      _count: { select: { transactions: true } },
    },
  });

  const rows = batches.map((b) => ({
    date: format(b.depositDate, "yyyy-MM-dd"),
    merchant: b.merchant.name,
    bank: b.bankAccount.name,
    txns: b._count.transactions,
    expected: num(b.expectedAmount),
    deposit: num(b.depositAmount),
    difference: num(b.differenceAmount),
    status: b.status,
  }));

  const unreconciled = rows.filter((r) => r.status !== "RECONCILED").length;

  return {
    title: "Settlement Batches",
    filterRange: dateRangeLabel(range),
    summary: [
      { label: "Batch count", value: String(rows.length) },
      { label: "Unreconciled", value: String(unreconciled) },
      { label: "Total deposits", value: rows.reduce((s, r) => s + r.deposit, 0).toFixed(2) },
    ],
    table: {
      columns: [
        { key: "date", header: "Date", type: "date" },
        { key: "merchant", header: "Merchant", type: "text" },
        { key: "bank", header: "Bank", type: "text" },
        { key: "txns", header: "Txns", type: "number" },
        { key: "expected", header: "Expected", type: "number" },
        { key: "deposit", header: "Deposit", type: "number" },
        { key: "difference", header: "Difference", type: "number" },
        { key: "status", header: "Status", type: "text" },
      ],
      rows,
    },
  };
}

import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, dateRangeWhere, num, parseDateRange } from "./helpers";

export async function fetchTransactions(params: URLSearchParams): Promise<ExportPayload> {
  const range = parseDateRange(params);
  const status = params.get("status") || undefined;

  const transactions = await prisma.transaction.findMany({
    where: {
      ...dateRangeWhere(range, "transactionDate"),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { transactionDate: "asc" },
    include: {
      client: { select: { name: true } },
      merchant: { select: { name: true } },
      paymentMethod: { select: { name: true } },
    },
  });

  const rows = transactions.map((t) => ({
    id: t.id,
    date: format(t.transactionDate, "yyyy-MM-dd"),
    client: t.client.name,
    merchant: t.merchant?.name ?? "Direct",
    method: t.paymentMethod.name,
    gross: num(t.grossAmount),
    fpFee: num(t.fpFee),
    merchantFee: num(t.merchantFee),
    expectedSettlement: num(t.expectedSettlement),
    clientNetPayable: num(t.clientNetPayable),
    status: t.status,
  }));

  const totalGross = rows.reduce((sum, r) => sum + r.gross, 0);
  const totalFpFee = rows.reduce((sum, r) => sum + r.fpFee, 0);

  return {
    title: "Transactions",
    subtitle: "All transactions, most recent scope shown as filtered.",
    filterRange: dateRangeLabel(range),
    summary: [
      { label: "Transaction count", value: String(rows.length) },
      { label: "Total gross", value: totalGross.toFixed(2) },
      { label: "Total FP fee", value: totalFpFee.toFixed(2) },
    ],
    table: {
      columns: [
        { key: "id", header: "ID", type: "text" },
        { key: "date", header: "Date", type: "date" },
        { key: "client", header: "Client", type: "text" },
        { key: "merchant", header: "Merchant", type: "text" },
        { key: "method", header: "Method", type: "text" },
        { key: "gross", header: "Gross", type: "number" },
        { key: "fpFee", header: "FP Fee", type: "number" },
        { key: "merchantFee", header: "Merchant Fee", type: "number" },
        { key: "expectedSettlement", header: "Expected Settlement", type: "number" },
        { key: "clientNetPayable", header: "Client Net Payable", type: "number" },
        { key: "status", header: "Status", type: "text" },
      ],
      rows,
    },
  };
}

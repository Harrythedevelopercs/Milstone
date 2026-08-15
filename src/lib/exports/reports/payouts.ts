import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, dateRangeWhere, num, parseDateRange } from "./helpers";

export async function fetchPayouts(params: URLSearchParams): Promise<ExportPayload> {
  const range = parseDateRange(params);

  const payouts = await prisma.clientPayout.findMany({
    where: dateRangeWhere(range, "payoutDate"),
    orderBy: { payoutDate: "asc" },
    include: {
      client: { select: { name: true } },
      payoutMethod: { select: { name: true } },
      bankAccount: { select: { name: true } },
      _count: { select: { allocations: true } },
    },
  });

  const rows = payouts.map((p) => ({
    date: format(p.payoutDate, "yyyy-MM-dd"),
    client: p.client.name,
    method: p.payoutMethod.name,
    bank: p.bankAccount.name,
    txns: p._count.allocations,
    amountPaid: num(p.amountPaid),
    remittanceFee: num(p.remittanceFee),
    feeBearer: p.feeBearer,
    reference: p.reference ?? "—",
  }));

  return {
    title: "Client Payouts",
    filterRange: dateRangeLabel(range),
    summary: [
      { label: "Payout count", value: String(rows.length) },
      { label: "Total paid out", value: rows.reduce((s, r) => s + r.amountPaid, 0).toFixed(2) },
    ],
    table: {
      columns: [
        { key: "date", header: "Date", type: "date" },
        { key: "client", header: "Client", type: "text" },
        { key: "method", header: "Method", type: "text" },
        { key: "bank", header: "Bank", type: "text" },
        { key: "txns", header: "Txns", type: "number" },
        { key: "amountPaid", header: "Amount Paid", type: "number" },
        { key: "remittanceFee", header: "Remittance Fee", type: "number" },
        { key: "feeBearer", header: "Fee Bearer", type: "text" },
        { key: "reference", header: "Reference", type: "text" },
      ],
      rows,
    },
  };
}

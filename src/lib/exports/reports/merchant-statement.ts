import { format } from "date-fns";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, dateRangeWhere, num, parseDateRange, requireId } from "./helpers";

export async function fetchMerchantStatement(params: URLSearchParams): Promise<ExportPayload> {
  const id = requireId(params);
  const range = parseDateRange(params);

  const merchant = await prisma.merchant.findUnique({ where: { id } });
  if (!merchant) throw new Error("Merchant not found.");

  const transactions = await prisma.transaction.findMany({
    where: { merchantId: id, ...dateRangeWhere(range, "transactionDate") },
    orderBy: { transactionDate: "asc" },
    include: {
      client: { select: { name: true } },
      paymentMethod: { select: { name: true } },
    },
  });

  const totals = transactions.reduce(
    (acc, t) => ({
      gross: acc.gross.plus(t.grossAmount),
      merchantFee: acc.merchantFee.plus(t.merchantFee),
      reserve: acc.reserve.plus(t.merchantReserveAmount),
      expectedSettlement: acc.expectedSettlement.plus(t.expectedSettlement),
    }),
    {
      gross: new Decimal(0),
      merchantFee: new Decimal(0),
      reserve: new Decimal(0),
      expectedSettlement: new Decimal(0),
    }
  );

  return {
    title: `${merchant.name} — Merchant Statement`,
    filterRange: dateRangeLabel(range),
    summary: [
      { label: "Gross Volume", value: totals.gross.toFixed(2) },
      { label: "Merchant Fees", value: totals.merchantFee.toFixed(2) },
      { label: "Reserves Held", value: totals.reserve.toFixed(2) },
      { label: "Expected Settlement", value: totals.expectedSettlement.toFixed(2) },
    ],
    table: {
      columns: [
        { key: "date", header: "Date", type: "date" },
        { key: "client", header: "Client", type: "text" },
        { key: "method", header: "Method", type: "text" },
        { key: "gross", header: "Gross", type: "number" },
        { key: "merchantFee", header: "Merchant Fee", type: "number" },
        { key: "reserve", header: "Reserve", type: "number" },
        { key: "expectedSettlement", header: "Expected Settlement", type: "number" },
        { key: "status", header: "Status", type: "text" },
      ],
      rows: transactions.map((t) => ({
        date: format(t.transactionDate, "yyyy-MM-dd"),
        client: t.client.name,
        method: t.paymentMethod.name,
        gross: num(t.grossAmount),
        merchantFee: num(t.merchantFee),
        reserve: num(t.merchantReserveAmount),
        expectedSettlement: num(t.expectedSettlement),
        status: t.status,
      })),
    },
  };
}

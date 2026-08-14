import { format } from "date-fns";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { currentAccountingMonthFrom } from "@/components/month-picker-header";
import type { ExportPayload } from "../types";
import { num } from "./helpers";

const SOURCE_LABEL: Record<string, string> = {
  TRANSACTION: "Transactions",
  RCV: "Refunds/Chargebacks/Voids",
  PAYOUT: "Client Payouts",
  SETTLEMENT_BATCH: "Merchant Settlements",
  EXPENSE: "Expenses",
  INTERNAL_TRANSFER: "Internal Transfers",
  THIRD_PARTY_SETTLEMENT: "Third-Party Settlements",
  ADJUSTMENT: "Adjustments",
  PRODUCT_SERVICE_SALE: "Product/Service Sales",
  MONTH_CLOSE: "Payroll / Distributions",
  MANUAL: "Manual (drawings, other)",
};

export async function fetchCashFlow(params: URLSearchParams): Promise<ExportPayload> {
  const accountingMonth = currentAccountingMonthFrom(params.get("month") ?? undefined, (d) =>
    format(d, "yyyy-MM")
  );

  const grouped = await prisma.bankLedger.groupBy({
    by: ["sourceType"],
    where: { accountingMonth },
    _sum: { usdValue: true },
  });

  const netChange = grouped.reduce((sum, g) => sum.plus(g._sum.usdValue ?? 0), new Decimal(0));

  const rows = grouped
    .slice()
    .sort((a, b) => num(b._sum.usdValue) - num(a._sum.usdValue))
    .map((g) => ({
      source: SOURCE_LABEL[g.sourceType] ?? g.sourceType,
      direction: num(g._sum.usdValue) >= 0 ? "Inflow" : "Outflow",
      amount: num(g._sum.usdValue),
    }));

  return {
    title: "Cash Flow",
    filterRange: `Month: ${accountingMonth}`,
    summary: [{ label: "Net cash change this month", value: netChange.toFixed(2) }],
    table: {
      columns: [
        { key: "source", header: "Source", type: "text" },
        { key: "direction", header: "Direction", type: "text" },
        { key: "amount", header: "Amount", type: "number" },
      ],
      rows,
    },
  };
}

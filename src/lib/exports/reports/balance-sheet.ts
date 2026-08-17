import { format } from "date-fns";
import { calculateBalanceSheet } from "@/lib/statements/balance-sheet";
import type { ExportPayload } from "../types";

export async function fetchBalanceSheet(params: URLSearchParams): Promise<ExportPayload> {
  const asOfParam = params.get("asOf");
  const asOfDate = asOfParam && !Number.isNaN(new Date(asOfParam).getTime()) ? new Date(asOfParam) : new Date();
  const bs = await calculateBalanceSheet(asOfDate);

  const rows = [
    ...bs.assetLines.map((l) => ({ section: "Assets", line: l.label, amount: l.amount.toNumber() })),
    { section: "Assets", line: "Total Assets", amount: bs.assets.toNumber() },
    ...bs.liabilityLines.map((l) => ({ section: "Liabilities", line: l.label, amount: l.amount.toNumber() })),
    { section: "Liabilities", line: "Total Liabilities", amount: bs.liabilities.toNumber() },
    ...bs.equityLines.map((l) => ({ section: "Equity", line: l.label, amount: l.amount.toNumber() })),
    { section: "Equity", line: "Total Equity", amount: bs.equity.toNumber() },
  ];

  return {
    title: "Balance Sheet",
    subtitle: "Assets = Liabilities + Equity.",
    filterRange: `As of ${format(asOfDate, "yyyy-MM-dd")}`,
    summary: [
      { label: "Total Assets", value: bs.assets.toFixed(2) },
      { label: "Total Liabilities", value: bs.liabilities.toFixed(2) },
      { label: "Total Equity", value: bs.equity.toFixed(2) },
    ],
    table: {
      columns: [
        { key: "section", header: "Section", type: "text" },
        { key: "line", header: "Line", type: "text" },
        { key: "amount", header: "Amount", type: "number" },
      ],
      rows,
    },
  };
}

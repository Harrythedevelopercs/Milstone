import { format } from "date-fns";
import { calculateIncomeStatement } from "@/lib/statements/income-statement";
import { currentAccountingMonthFrom } from "@/components/month-picker-header";
import type { ExportPayload } from "../types";

export async function fetchIncomeStatement(params: URLSearchParams): Promise<ExportPayload> {
  const accountingMonth = currentAccountingMonthFrom(params.get("month") ?? undefined, (d) =>
    format(d, "yyyy-MM")
  );
  const stmt = await calculateIncomeStatement(accountingMonth);

  const rows = [
    ...stmt.revenueLines.map((l) => ({ section: "Revenue", line: l.label, amount: l.amount.toNumber() })),
    { section: "Revenue", line: "Total Revenue", amount: stmt.revenue.toNumber() },
    ...stmt.cogsLines.map((l) => ({ section: "COGS", line: l.label, amount: l.amount.toNumber() })),
    { section: "COGS", line: "Total COGS", amount: stmt.cogs.toNumber() },
    { section: "", line: "Gross Profit", amount: stmt.grossProfit.toNumber() },
    ...stmt.opexLines.map((l) => ({ section: "OpEx", line: l.label, amount: l.amount.toNumber() })),
    { section: "OpEx", line: "Total OpEx", amount: stmt.opex.toNumber() },
    { section: "", line: "Net Profit", amount: stmt.netProfit.toNumber() },
  ];

  return {
    title: "Income Statement",
    subtitle: "Revenue - COGS = Gross Profit; Gross Profit - OpEx = Net Profit.",
    filterRange: `Month: ${accountingMonth}`,
    summary: [
      { label: "Revenue", value: stmt.revenue.toFixed(2) },
      { label: "Gross Profit", value: stmt.grossProfit.toFixed(2) },
      { label: "Net Profit", value: stmt.netProfit.toFixed(2) },
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

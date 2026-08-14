import { format } from "date-fns";
import { calculatePnl } from "@/lib/statements/pnl";
import { currentAccountingMonthFrom } from "@/components/month-picker-header";
import type { ExportPayload } from "../types";
import { fmtMoney } from "./helpers";

export async function fetchConsolidatedPnl(params: URLSearchParams): Promise<ExportPayload> {
  const accountingMonth = currentAccountingMonthFrom(params.get("month") ?? undefined, (d) =>
    format(d, "yyyy-MM")
  );
  const pnl = await calculatePnl(accountingMonth, { level: "consolidated" });

  return {
    title: "Consolidated P&L",
    filterRange: `Month: ${accountingMonth}`,
    summary: [
      { label: "FP Revenue", value: fmtMoney(pnl.revenue) },
      { label: "Product/Service Gross Profit", value: fmtMoney(pnl.productGrossProfit) },
      { label: "− Expenses", value: fmtMoney(pnl.expenses) },
      { label: "− Salaries", value: fmtMoney(pnl.salaries) },
      { label: "Net Profit", value: fmtMoney(pnl.netProfit) },
    ],
    table: { columns: [], rows: [] },
  };
}

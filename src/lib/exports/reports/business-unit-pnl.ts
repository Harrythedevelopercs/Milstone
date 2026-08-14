import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { calculatePnl } from "@/lib/statements/pnl";
import { currentAccountingMonthFrom } from "@/components/month-picker-header";
import type { ExportPayload } from "../types";
import { num } from "./helpers";

export async function fetchBusinessUnitPnl(params: URLSearchParams): Promise<ExportPayload> {
  const accountingMonth = currentAccountingMonthFrom(params.get("month") ?? undefined, (d) =>
    format(d, "yyyy-MM")
  );

  const businessUnits = await prisma.businessUnit.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    businessUnits.map(async (b) => {
      const pnl = await calculatePnl(accountingMonth, { level: "businessUnit", businessUnitId: b.id });
      return {
        businessUnit: b.name,
        revenue: num(pnl.revenue),
        productGrossProfit: num(pnl.productGrossProfit),
        expenses: num(pnl.expenses),
        net: num(pnl.netProfit),
      };
    })
  );

  return {
    title: "Business Unit P&L",
    subtitle:
      "Includes transaction revenue, product/service sales gross profit, and expenses tagged to each business unit. Salaries aren't tied to a business unit.",
    filterRange: `Month: ${accountingMonth}`,
    table: {
      columns: [
        { key: "businessUnit", header: "Business Unit", type: "text" },
        { key: "revenue", header: "Revenue", type: "number" },
        { key: "productGrossProfit", header: "Product GP", type: "number" },
        { key: "expenses", header: "Expenses", type: "number" },
        { key: "net", header: "Net", type: "number" },
      ],
      rows,
    },
  };
}

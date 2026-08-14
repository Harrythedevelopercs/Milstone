import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { calculatePnl } from "@/lib/statements/pnl";
import { currentAccountingMonthFrom } from "@/components/month-picker-header";
import type { ExportPayload } from "../types";
import { num } from "./helpers";

export async function fetchCompanyPnl(params: URLSearchParams): Promise<ExportPayload> {
  const accountingMonth = currentAccountingMonthFrom(params.get("month") ?? undefined, (d) =>
    format(d, "yyyy-MM")
  );

  const companies = await prisma.company.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    companies.map(async (c) => {
      const pnl = await calculatePnl(accountingMonth, { level: "company", companyId: c.id });
      return {
        company: c.name,
        revenue: num(pnl.revenue),
        expenses: num(pnl.expenses),
        net: num(pnl.netProfit),
      };
    })
  );

  return {
    title: "Company P&L",
    subtitle:
      "Revenue and expenses tied directly to each company's merchants; salaries and product sales aren't attributable to a single company and only appear in the consolidated view.",
    filterRange: `Month: ${accountingMonth}`,
    table: {
      columns: [
        { key: "company", header: "Company", type: "text" },
        { key: "revenue", header: "Revenue", type: "number" },
        { key: "expenses", header: "Expenses", type: "number" },
        { key: "net", header: "Net", type: "number" },
      ],
      rows,
    },
  };
}

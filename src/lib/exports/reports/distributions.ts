import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  calculateEmployeePartnerRevenue,
  calculateMonthExpenses,
  calculateMonthRevenue,
  calculateMonthSalariesPosted,
  getBonusPoolPercent,
} from "@/lib/payroll/calculations";
import type { ExportPayload } from "../types";
import { num } from "./helpers";

export async function fetchDistributions(params: URLSearchParams): Promise<ExportPayload> {
  const monthParam = params.get("month");
  const accountingMonth =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : format(new Date(), "yyyy-MM");

  const [employeePartners, revenue, expenses, salaries, bonusPoolPercent] = await Promise.all([
    prisma.employee.findMany({ where: { isEmployeePartner: true, status: "ACTIVE" } }),
    calculateMonthRevenue(accountingMonth),
    calculateMonthExpenses(accountingMonth),
    calculateMonthSalariesPosted(accountingMonth),
    getBonusPoolPercent(),
  ]);

  const distributableProfit = revenue.minus(salaries).minus(expenses);

  const epRows = (
    await Promise.all(
      employeePartners.map(async (e) => {
        const rev = await calculateEmployeePartnerRevenue(e.id, accountingMonth);
        return { name: e.name, revenue: rev, commission: rev.times(10).div(100) };
      })
    )
  )
    .filter((p) => !p.revenue.isZero())
    .map((p) => ({
      employeePartner: p.name,
      revenue: num(p.revenue),
      commission: num(p.commission),
    }));

  return {
    title: "Monthly Distributions",
    filterRange: `Month: ${accountingMonth}`,
    summary: [
      { label: "Revenue", value: revenue.toFixed(2) },
      { label: "Expenses", value: expenses.toFixed(2) },
      { label: "Salaries", value: salaries.toFixed(2) },
      { label: "Distributable Profit", value: distributableProfit.toFixed(2) },
      { label: "Bonus Pool %", value: bonusPoolPercent.toFixed(0) },
    ],
    table: {
      columns: [
        { key: "employeePartner", header: "Employee Partner", type: "text" },
        { key: "revenue", header: "Revenue", type: "number" },
        { key: "commission", header: "Commission (10%)", type: "number" },
      ],
      rows: epRows,
    },
  };
}

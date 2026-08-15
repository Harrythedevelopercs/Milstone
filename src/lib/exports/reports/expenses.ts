import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, dateRangeWhere, num, parseDateRange } from "./helpers";

export async function fetchExpenses(params: URLSearchParams): Promise<ExportPayload> {
  const range = parseDateRange(params);

  const expenses = await prisma.expense.findMany({
    where: dateRangeWhere(range, "expenseDate"),
    orderBy: { expenseDate: "asc" },
    include: {
      expenseCategory: { select: { name: true } },
      vendor: { select: { name: true } },
      bankAccount: { select: { name: true } },
    },
  });

  const rows = expenses.map((e) => ({
    date: format(e.expenseDate, "yyyy-MM-dd"),
    category: e.expenseCategory.name,
    vendor: e.vendor?.name ?? "—",
    paidFrom: e.bankAccount.name,
    amount: num(e.amount),
    recurring: e.recurring ? "Yes" : "No",
    description: e.description ?? "—",
  }));

  return {
    title: "Expenses",
    filterRange: dateRangeLabel(range),
    summary: [
      { label: "Expense count", value: String(rows.length) },
      { label: "Total spent", value: rows.reduce((s, r) => s + r.amount, 0).toFixed(2) },
    ],
    table: {
      columns: [
        { key: "date", header: "Date", type: "date" },
        { key: "category", header: "Category", type: "text" },
        { key: "vendor", header: "Vendor", type: "text" },
        { key: "paidFrom", header: "Paid From", type: "text" },
        { key: "amount", header: "Amount", type: "number" },
        { key: "recurring", header: "Recurring", type: "text" },
        { key: "description", header: "Description", type: "text" },
      ],
      rows,
    },
  };
}

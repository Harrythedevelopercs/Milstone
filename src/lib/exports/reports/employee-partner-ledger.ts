import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, num, parseDateRange, requireId } from "./helpers";

export async function fetchEmployeePartnerLedger(params: URLSearchParams): Promise<ExportPayload> {
  const id = requireId(params);
  const range = parseDateRange(params);

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw new Error("Employee not found.");

  const allEntries = await prisma.employeePartnerLedger.findMany({
    where: { employeeId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  let running = 0;
  const rows: { date: string; month: string; description: string; amount: number; runningBalance: number }[] =
    [];
  for (const e of allEntries) {
    running += num(e.amount);
    const inRange =
      (!range.from || e.entryDate >= range.from) && (!range.to || e.entryDate <= range.to);
    if (inRange) {
      rows.push({
        date: format(e.entryDate, "yyyy-MM-dd"),
        month: e.accountingMonth,
        description: e.description ?? "—",
        amount: num(e.amount),
        runningBalance: running,
      });
    }
  }

  return {
    title: `${employee.name} — Employee Partner Ledger`,
    filterRange: dateRangeLabel(range),
    summary: [{ label: "Commission balance owed", value: running.toFixed(2) }],
    table: {
      columns: [
        { key: "date", header: "Date", type: "date" },
        { key: "month", header: "Month", type: "text" },
        { key: "description", header: "Description", type: "text" },
        { key: "amount", header: "Amount", type: "number" },
        { key: "runningBalance", header: "Running Balance", type: "number" },
      ],
      rows,
    },
  };
}

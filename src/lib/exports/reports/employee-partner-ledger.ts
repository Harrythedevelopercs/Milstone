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
  let accrued = 0;
  let paid = 0;
  const rows: { date: string; month: string; kind: string; description: string; amount: number; runningBalance: number }[] =
    [];
  for (const e of allEntries) {
    const amt = num(e.amount);
    running += amt;
    if (e.kind === "COMMISSION") accrued += amt;
    if (e.kind === "PAYMENT") paid += Math.abs(amt);
    const inRange =
      (!range.from || e.entryDate >= range.from) && (!range.to || e.entryDate <= range.to);
    if (inRange) {
      rows.push({
        date: format(e.entryDate, "yyyy-MM-dd"),
        month: e.accountingMonth,
        kind: e.kind,
        description: e.description ?? "—",
        amount: amt,
        runningBalance: running,
      });
    }
  }

  return {
    title: `${employee.name} — Employee Partner Ledger`,
    filterRange: dateRangeLabel(range),
    summary: [
      { label: "Accrued (all-time)", value: accrued.toFixed(2) },
      { label: "Paid (all-time)", value: paid.toFixed(2) },
      { label: "Owed now (liability)", value: running.toFixed(2) },
    ],
    table: {
      columns: [
        { key: "date", header: "Date", type: "date" },
        { key: "month", header: "Month", type: "text" },
        { key: "kind", header: "Kind", type: "text" },
        { key: "description", header: "Description", type: "text" },
        { key: "amount", header: "Amount", type: "number" },
        { key: "runningBalance", header: "Running Balance", type: "number" },
      ],
      rows,
    },
  };
}

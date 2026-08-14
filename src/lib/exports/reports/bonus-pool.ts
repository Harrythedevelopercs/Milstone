import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, num, parseDateRange } from "./helpers";

export async function fetchBonusPool(params: URLSearchParams): Promise<ExportPayload> {
  const range = parseDateRange(params);

  const allEntries = await prisma.bonusPoolLedger.findMany({
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    include: { allocatedToEmployee: { select: { name: true } } },
  });

  let running = 0;
  const rows: {
    date: string;
    month: string;
    allocatedTo: string;
    description: string;
    amount: number;
    runningBalance: number;
  }[] = [];
  for (const e of allEntries) {
    running += num(e.amount);
    const inRange =
      (!range.from || e.entryDate >= range.from) && (!range.to || e.entryDate <= range.to);
    if (inRange) {
      rows.push({
        date: format(e.entryDate, "yyyy-MM-dd"),
        month: e.accountingMonth,
        allocatedTo: e.allocatedToEmployee?.name ?? "—",
        description: e.description ?? "—",
        amount: num(e.amount),
        runningBalance: running,
      });
    }
  }

  return {
    title: "Bonus Pool",
    filterRange: dateRangeLabel(range),
    summary: [{ label: "Available to allocate", value: running.toFixed(2) }],
    table: {
      columns: [
        { key: "date", header: "Date", type: "date" },
        { key: "month", header: "Month", type: "text" },
        { key: "allocatedTo", header: "Allocated To", type: "text" },
        { key: "description", header: "Description", type: "text" },
        { key: "amount", header: "Amount", type: "number" },
        { key: "runningBalance", header: "Running Balance", type: "number" },
      ],
      rows,
    },
  };
}

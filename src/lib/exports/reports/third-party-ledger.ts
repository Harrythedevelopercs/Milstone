import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, num, parseDateRange, requireId } from "./helpers";

export async function fetchThirdPartyLedger(params: URLSearchParams): Promise<ExportPayload> {
  const id = requireId(params);
  const range = parseDateRange(params);

  const party = await prisma.settlementParty.findUnique({ where: { id } });
  if (!party) throw new Error("Settlement party not found.");

  const entries = await prisma.thirdPartyLedger.findMany({
    where: { settlementPartyId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  let running = 0;
  const rows: { date: string; month: string; description: string; amount: number; runningBalance: number }[] = [];
  for (const e of entries) {
    running += num(e.amount);
    const inRange = (!range.from || e.entryDate >= range.from) && (!range.to || e.entryDate <= range.to);
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
    title: `${party.name} — Third-Party Ledger`,
    filterRange: dateRangeLabel(range),
    summary: [{ label: "FoundaPay owes this party", value: running.toFixed(2) }],
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

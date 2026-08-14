import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, num, parseDateRange, requireId } from "./helpers";

const KIND_LABEL: Record<string, string> = {
  PROFIT_ENTITLEMENT: "Profit Entitlement",
  DRAWING: "Drawing",
  LOAN: "Loan",
  LOAN_REPAYMENT: "Loan Repayment",
  ADJUSTMENT: "Adjustment",
};

export async function fetchPartnerLedger(params: URLSearchParams): Promise<ExportPayload> {
  const id = requireId(params);
  const range = parseDateRange(params);

  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) throw new Error("Partner not found.");

  const allEntries = await prisma.partnerLedger.findMany({
    where: { partnerId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  let running = 0;
  const rows: {
    date: string;
    month: string;
    kind: string;
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
        kind: KIND_LABEL[e.kind] ?? e.kind,
        description: e.description ?? "—",
        amount: num(e.amount),
        runningBalance: running,
      });
    }
  }

  return {
    title: `${partner.name} — Partner Ledger`,
    subtitle: `Profit share ${partner.profitSharePercent.toString()}%`,
    filterRange: dateRangeLabel(range),
    summary: [{ label: "Accumulated equity balance", value: running.toFixed(2) }],
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

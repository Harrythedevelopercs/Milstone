import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, num, parseDateRange, requireId } from "./helpers";

const SOURCE_LABEL: Record<string, string> = {
  TRANSACTION: "Transaction",
  RCV: "Refund/Chargeback/Void",
  PAYOUT: "Payout",
  SETTLEMENT_BATCH: "Settlement Batch",
  EXPENSE: "Expense",
  INTERNAL_TRANSFER: "Internal Transfer",
  THIRD_PARTY_SETTLEMENT: "Third-Party Settlement",
  ADJUSTMENT: "Adjustment",
  PRODUCT_SERVICE_SALE: "Product/Service Sale",
  MONTH_CLOSE: "Month Close",
  MANUAL: "Manual",
};

export async function fetchClientLedgerInternal(params: URLSearchParams): Promise<ExportPayload> {
  const id = requireId(params);
  const range = parseDateRange(params);

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new Error("Client not found.");

  const entries = await prisma.clientLedger.findMany({
    where: { clientId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  let running = 0;
  const rows: { date: string; month: string; source: string; description: string; amount: number; runningBalance: number }[] = [];
  for (const e of entries) {
    running += num(e.amount);
    const inRange = (!range.from || e.entryDate >= range.from) && (!range.to || e.entryDate <= range.to);
    if (inRange) {
      rows.push({
        date: format(e.entryDate, "yyyy-MM-dd"),
        month: e.accountingMonth,
        source: SOURCE_LABEL[e.sourceType] ?? e.sourceType,
        description: e.description ?? "—",
        amount: num(e.amount),
        runningBalance: running,
      });
    }
  }

  return {
    title: `${client.name} — Client Ledger`,
    filterRange: dateRangeLabel(range),
    summary: [{ label: running < 0 ? "Advanced / owed to FoundaPay" : "Current balance", value: running.toFixed(2) }],
    table: {
      columns: [
        { key: "date", header: "Date", type: "date" },
        { key: "month", header: "Month", type: "text" },
        { key: "source", header: "Source", type: "text" },
        { key: "description", header: "Description", type: "text" },
        { key: "amount", header: "Amount", type: "number" },
        { key: "runningBalance", header: "Running Balance", type: "number" },
      ],
      rows,
    },
  };
}

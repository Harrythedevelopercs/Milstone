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

// Covers bank, USDT, and cash accounts alike -- they all post through the
// same BankLedger table keyed by bankAccountId, just with a different
// BankAccount.accountType label.
export async function fetchBankLedger(params: URLSearchParams): Promise<ExportPayload> {
  const id = requireId(params);
  const range = parseDateRange(params);

  const account = await prisma.bankAccount.findUnique({ where: { id } });
  if (!account) throw new Error("Account not found.");

  const entries = await prisma.bankLedger.findMany({
    where: { bankAccountId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  let running = num(account.openingBalance);
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
    title: `${account.name} — Ledger`,
    filterRange: dateRangeLabel(range),
    summary: [{ label: "Current balance", value: running.toFixed(2) }],
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

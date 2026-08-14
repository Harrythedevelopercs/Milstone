import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { dateRangeLabel, num, parseDateRange, requireId } from "./helpers";

// Client-facing statement: no internal source types, no FP fee/rate detail,
// no links back to internal records -- just what the client is owed/owes
// and why, in plain language. Must stay in sync with the on-screen version
// at /client-ledger/[id]/external.
function clientFriendlyDescription(sourceType: string): string {
  switch (sourceType) {
    case "TRANSACTION":
      return "Transaction settlement";
    case "PAYOUT":
      return "Payout";
    case "THIRD_PARTY_SETTLEMENT":
      return "Local settlement";
    case "PRODUCT_SERVICE_SALE":
      return "Service charge";
    case "ADJUSTMENT":
      return "Adjustment";
    case "RCV":
      return "Refund/Chargeback";
    default:
      return "Account activity";
  }
}

export async function fetchClientExternalStatement(params: URLSearchParams): Promise<ExportPayload> {
  const id = requireId(params);
  const range = parseDateRange(params);

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new Error("Client not found.");

  const allEntries = await prisma.clientLedger.findMany({
    where: { clientId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  // Running balance must include everything before the range starts, so we
  // compute it over full history and only display rows inside the range.
  let running = 0;
  const rows: { date: string; description: string; amount: number; balance: number }[] = [];
  for (const e of allEntries) {
    running += num(e.amount);
    const inRange =
      (!range.from || e.entryDate >= range.from) && (!range.to || e.entryDate <= range.to);
    if (inRange) {
      rows.push({
        date: format(e.entryDate, "yyyy-MM-dd"),
        description: clientFriendlyDescription(e.sourceType),
        amount: num(e.amount),
        balance: running,
      });
    }
  }

  return {
    title: "Statement of Account",
    subtitle: client.name,
    filterRange: dateRangeLabel(range),
    restricted: true,
    summary: [
      {
        label: running >= 0 ? "Balance due to you" : "Balance you owe FoundaPay",
        value: Math.abs(running).toFixed(2),
      },
    ],
    table: {
      columns: [
        { key: "date", header: "Date", type: "date" },
        { key: "description", header: "Description", type: "text" },
        { key: "amount", header: "Amount", type: "number" },
        { key: "balance", header: "Balance", type: "number" },
      ],
      rows,
    },
  };
}

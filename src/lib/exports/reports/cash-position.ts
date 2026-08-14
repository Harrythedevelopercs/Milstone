import { format } from "date-fns";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";

const TYPE_LABEL: Record<string, string> = { BANK: "Bank", USDT: "USDT", CASH: "Cash" };

export async function fetchCashPosition(): Promise<ExportPayload> {
  const accounts = await prisma.bankAccount.findMany({
    where: { active: true },
    orderBy: [{ accountType: "asc" }, { name: "asc" }],
    include: { ledgerEntries: { select: { amount: true, usdValue: true } } },
  });

  const rows = accounts.map((a) => {
    const ledgerNative = a.ledgerEntries.reduce((sum, e) => sum.plus(e.amount), new Decimal(0));
    const ledgerUsd = a.ledgerEntries.reduce((sum, e) => sum.plus(e.usdValue), new Decimal(0));
    return {
      account: a.name,
      type: TYPE_LABEL[a.accountType] ?? a.accountType,
      currency: a.currency,
      nativeBalance: new Decimal(a.openingBalance).plus(ledgerNative).toNumber(),
      usdBalance: new Decimal(a.openingBalance).plus(ledgerUsd).toNumber(),
    };
  });

  const totalUsd = rows.reduce((sum, r) => sum + r.usdBalance, 0);

  return {
    title: "Cash Position",
    subtitle: "Actual money across every bank, USDT wallet, and cash drawer.",
    filterRange: `As of ${format(new Date(), "yyyy-MM-dd")}`,
    summary: [{ label: "Total (USD)", value: totalUsd.toFixed(2) }],
    table: {
      columns: [
        { key: "account", header: "Account", type: "text" },
        { key: "type", header: "Type", type: "text" },
        { key: "currency", header: "Currency", type: "text" },
        { key: "nativeBalance", header: "Balance (native)", type: "number" },
        { key: "usdBalance", header: "Balance (USD)", type: "number" },
      ],
      rows,
    },
  };
}

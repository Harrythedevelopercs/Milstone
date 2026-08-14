import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { ExportPayload } from "../types";
import { num } from "./helpers";

export async function fetchMerchantReconciliation(): Promise<ExportPayload> {
  const merchants = await prisma.merchant.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      settlementBatches: { orderBy: { depositDate: "desc" } },
      transactions: {
        where: { status: "APPROVED", settlementBatchId: null },
        select: { expectedSettlement: true },
      },
    },
  });

  const rows: {
    merchant: string;
    depositDate: string;
    expected: number;
    deposit: number;
    difference: number;
    status: string;
  }[] = [];

  let awaitingTotal = 0;
  let awaitingCount = 0;

  for (const m of merchants) {
    awaitingCount += m.transactions.length;
    awaitingTotal += m.transactions.reduce((sum, t) => sum + num(t.expectedSettlement), 0);
    for (const b of m.settlementBatches) {
      rows.push({
        merchant: m.name,
        depositDate: format(b.depositDate, "yyyy-MM-dd"),
        expected: num(b.expectedAmount),
        deposit: num(b.depositAmount),
        difference: num(b.differenceAmount),
        status: b.status,
      });
    }
  }

  return {
    title: "Merchant Reconciliation",
    subtitle: "Book (expected) vs actual deposits, per merchant, plus anything still awaiting settlement.",
    summary: [
      {
        label: "Approved transactions awaiting settlement",
        value: `${awaitingCount} (expected total ${awaitingTotal.toFixed(2)})`,
      },
    ],
    table: {
      columns: [
        { key: "merchant", header: "Merchant", type: "text" },
        { key: "depositDate", header: "Deposit Date", type: "date" },
        { key: "expected", header: "Expected", type: "number" },
        { key: "deposit", header: "Deposit", type: "number" },
        { key: "difference", header: "Difference", type: "number" },
        { key: "status", header: "Status", type: "text" },
      ],
      rows,
    },
  };
}

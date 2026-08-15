import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { ToneBadge } from "@/components/ui/tone-badge";
import { statusTone, NEEDS_ATTENTION_ROW_CLASS } from "@/lib/status-tone";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";
import { EditSettlementBatchAction } from "./edit-settlement-batch-action";
import { DeleteSettlementBatchAction } from "./delete-settlement-batch-action";
import { DateRangeHeader } from "@/components/exports/date-range-header";
import type { UnsettledTransaction } from "./new/settlement-form";

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; attention?: string }>;
}) {
  const { from, to, attention } = await searchParams;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const needsAttentionOnly = attention === "1";

  const [batches, merchants, unbatched, batchedTxns, closedMonths] = await Promise.all([
    prisma.settlementBatch.findMany({
      where: {
        ...(fromDate || toDate
          ? { depositDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
          : {}),
        ...(needsAttentionOnly ? { status: { not: "RECONCILED" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        merchant: { select: { name: true } },
        bankAccount: { select: { name: true } },
        _count: { select: { transactions: true } },
      },
    }),
    prisma.merchant.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, settlementBankId: true },
    }),
    prisma.transaction.findMany({
      where: { status: "APPROVED", settlementBatchId: null },
      orderBy: { transactionDate: "asc" },
      include: { client: { select: { name: true } }, paymentMethod: { select: { name: true } } },
    }),
    prisma.transaction.findMany({
      where: { settlementBatchId: { not: null } },
      include: { client: { select: { name: true } }, paymentMethod: { select: { name: true } } },
    }),
    prisma.monthClose.findMany({ where: { status: "CLOSED" }, select: { accountingMonth: true } }),
  ]);

  // Direct-to-bank transactions skip straight to Settled on approval, so
  // they never appear here -- but the field is nullable at the schema
  // level, so filter defensively rather than assuming it.
  const unbatchedOptions: UnsettledTransaction[] = unbatched
    .filter((t) => t.merchantId !== null)
    .map((t) => ({
      id: t.id,
      merchantId: t.merchantId!,
      clientName: t.client.name,
      paymentMethodName: t.paymentMethod.name,
      grossAmount: t.grossAmount.toString(),
      expectedSettlement: t.expectedSettlement.toString(),
    }));
  const batchedOptionsByBatchId = new Map<string, UnsettledTransaction[]>();
  for (const t of batchedTxns) {
    if (!t.settlementBatchId || !t.merchantId) continue;
    const locked = t.status !== "CLIENT_PAYABLE";
    const list = batchedOptionsByBatchId.get(t.settlementBatchId) ?? [];
    list.push({
      id: t.id,
      merchantId: t.merchantId,
      clientName: t.client.name,
      paymentMethodName: t.paymentMethod.name,
      grossAmount: t.grossAmount.toString(),
      expectedSettlement: t.expectedSettlement.toString(),
      locked,
      lockedReason: locked ? t.status.toLowerCase() : undefined,
    });
    batchedOptionsByBatchId.set(t.settlementBatchId, list);
  }
  const closedMonthSet = new Set(closedMonths.map((m) => m.accountingMonth));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settlement Batches</h1>
        <Link href="/settlements/new" className={buttonVariants({})}>
          New Settlement Batch
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={{
            pathname: "/settlements",
            query: { ...(from ? { from } : {}), ...(to ? { to } : {}), ...(needsAttentionOnly ? {} : { attention: "1" }) },
          }}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {needsAttentionOnly ? "Show all" : "Needs attention only (unreconciled)"}
        </Link>
      </div>

      <DateRangeHeader from={from} to={to} reportType="settlement-batches" />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead className="text-right">Txns</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Deposit</TableHead>
              <TableHead className="text-right">Difference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.length === 0 ? (
              <EmptyTableRow colSpan={9} message="No settlement batches yet." />
            ) : (
              batches.map((b) => {
                const monthOpen = !closedMonthSet.has(b.accountingMonth);
                const ownTxns = batchedOptionsByBatchId.get(b.id) ?? [];
                const unsettledForBatch = [
                  ...unbatchedOptions.filter((t) => t.merchantId === b.merchantId),
                  ...ownTxns,
                ];
                const attentionRow = b.status !== "RECONCILED";
                return (
                  <TableRow key={b.id} className={attentionRow ? NEEDS_ATTENTION_ROW_CLASS : undefined}>
                    <TableCell>{format(b.depositDate, "yyyy-MM-dd")}</TableCell>
                    <TableCell>{b.merchant.name}</TableCell>
                    <TableCell>{b.bankAccount.name}</TableCell>
                    <TableCell className="text-right">{b._count.transactions}</TableCell>
                    <TableCell className="text-right">{b.expectedAmount.toString()}</TableCell>
                    <TableCell className="text-right">{b.depositAmount.toString()}</TableCell>
                    <TableCell
                      className={`text-right ${
                        Number(b.differenceAmount) !== 0 ? "text-red-600 dark:text-red-400 font-medium" : ""
                      }`}
                    >
                      {b.differenceAmount.toString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {attentionRow && <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />}
                        <ToneBadge tone={statusTone.settlementBatch(b.status)}>{b.status}</ToneBadge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <EditSettlementBatchAction
                          row={{
                            id: b.id,
                            merchantId: b.merchantId,
                            bankAccountId: b.bankAccountId,
                            depositDate: b.depositDate.toISOString(),
                            depositAmount: b.depositAmount.toString(),
                            notes: b.notes,
                            transactionIds: ownTxns.map((t) => t.id),
                          }}
                          monthOpen={monthOpen}
                          merchants={merchants}
                          unsettledTransactions={unsettledForBatch}
                        />
                        <DeleteSettlementBatchAction id={b.id} monthOpen={monthOpen} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

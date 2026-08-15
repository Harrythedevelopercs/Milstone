import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { UnsettledTransaction } from "./new/settlement-form";

export default async function SettlementsPage() {
  const [batches, merchants, bankAccounts, unbatched, batchedTxns, closedMonths] = await Promise.all([
    prisma.settlementBatch.findMany({
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
      select: { id: true, name: true },
    }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
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
                return (
                  <TableRow key={b.id}>
                    <TableCell>{format(b.depositDate, "yyyy-MM-dd")}</TableCell>
                    <TableCell>{b.merchant.name}</TableCell>
                    <TableCell>{b.bankAccount.name}</TableCell>
                    <TableCell className="text-right">{b._count.transactions}</TableCell>
                    <TableCell className="text-right">{b.expectedAmount.toString()}</TableCell>
                    <TableCell className="text-right">{b.depositAmount.toString()}</TableCell>
                    <TableCell
                      className={`text-right ${
                        Number(b.differenceAmount) !== 0 ? "text-destructive font-medium" : ""
                      }`}
                    >
                      {b.differenceAmount.toString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.status === "RECONCILED" ? "default" : "destructive"}>
                        {b.status}
                      </Badge>
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
                          bankAccounts={bankAccounts}
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

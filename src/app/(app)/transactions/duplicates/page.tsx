import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";
import { TransactionStatusBadge } from "@/components/transactions/status-badge";

// Read-only review board: groups of existing transactions sharing the same
// merchant + gross amount + transaction date -- the same signature
// createTransactionCore warns about going forward (see
// src/lib/transactions/create-transaction-core.ts), surfaced here for
// entries that predate that check or were saved with "confirmDuplicate".
// Never auto-deletes or merges anything -- for manual review only.
export default async function DuplicateTransactionsPage() {
  const groups = await prisma.transaction.groupBy({
    by: ["merchantId", "grossAmount", "transactionDate"],
    _count: { _all: true },
  });
  const duplicateGroups = groups
    .filter((g) => g._count._all > 1)
    .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());

  const groupsWithRows = await Promise.all(
    duplicateGroups.map(async (g) => ({
      key: g,
      rows: await prisma.transaction.findMany({
        where: {
          merchantId: g.merchantId,
          grossAmount: g.grossAmount,
          transactionDate: g.transactionDate,
        },
        orderBy: { createdAt: "asc" },
        include: {
          client: { select: { name: true } },
          merchant: { select: { name: true } },
          paymentMethod: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      }),
    }))
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Possible Duplicate Transactions</h1>
        <Link href="/transactions" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          ← All Transactions
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Groups of existing transactions that share the same merchant, gross amount, and
        transaction date -- the same combination a new entry is now checked against. This is for
        your review only: nothing here is deleted or changed automatically. If a pair turns out
        to really be one duplicate entry, edit or remove the wrong one from{" "}
        <Link href="/transactions/received" className="underline">
          Received Transactions
        </Link>
        .
      </p>

      {groupsWithRows.length === 0 ? (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          No possible duplicates found.
        </div>
      ) : (
        <div className="space-y-6">
          {groupsWithRows.map(({ key, rows }) => (
            <div key={`${key.merchantId ?? "direct"}-${key.grossAmount.toString()}-${key.transactionDate.toISOString()}`} className="overflow-x-auto rounded-md border">
              <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{rows[0]?.merchant?.name ?? "Direct (no merchant)"}</span>
                  {" · "}
                  <span className="font-medium">{key.grossAmount.toString()}</span>
                  {" · "}
                  <span className="font-medium">{format(key.transactionDate, "yyyy-MM-dd")}</span>
                </span>
                <span className="text-xs text-muted-foreground">{rows.length} matching transactions</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Payment method</TableHead>
                    <TableHead>Submitted by</TableHead>
                    <TableHead>Entered</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <EmptyTableRow colSpan={7} message="No rows." />
                  ) : (
                    rows.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.id}</TableCell>
                        <TableCell>{t.client.name}</TableCell>
                        <TableCell>{t.paymentMethod.name}</TableCell>
                        <TableCell>{t.createdBy.name}</TableCell>
                        <TableCell>{format(t.createdAt, "yyyy-MM-dd HH:mm")}</TableCell>
                        <TableCell>
                          <TransactionStatusBadge status={t.status} />
                        </TableCell>
                        <TableCell className="text-right">{t.grossAmount.toString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

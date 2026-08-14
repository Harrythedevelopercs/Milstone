import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";

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

export default async function ClientLedgerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  const entries = await prisma.clientLedger.findMany({
    where: { clientId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  const rows = entries.reduce<Array<(typeof entries)[number] & { runningBalance: number }>>(
    (acc, e) => {
      const previousBalance = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0;
      acc.push({ ...e, runningBalance: previousBalance + Number(e.amount) });
      return acc;
    },
    []
  );
  const running = rows.length > 0 ? rows[rows.length - 1].runningBalance : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{client.name}</span>
            <Link href={`/client-ledger/${client.id}/external`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              External Statement
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Current balance</p>
          <p
            className={`text-2xl font-semibold ${
              running > 0 ? "text-emerald-600" : running < 0 ? "text-destructive" : ""
            }`}
          >
            {running.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Running Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <EmptyTableRow colSpan={6} message="No ledger activity yet." />
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(r.entryDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{r.accountingMonth}</TableCell>
                  <TableCell>{SOURCE_LABEL[r.sourceType] ?? r.sourceType}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.description ?? "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right ${
                      Number(r.amount) < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {Number(r.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {r.runningBalance.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

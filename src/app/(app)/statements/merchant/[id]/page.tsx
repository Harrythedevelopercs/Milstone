import { notFound } from "next/navigation";
import { format } from "date-fns";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionStatusBadge } from "@/components/transactions/status-badge";
import { DateRangeHeader } from "@/components/exports/date-range-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";

export default async function MerchantStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const merchant = await prisma.merchant.findUnique({ where: { id } });
  if (!merchant) notFound();

  const transactions = await prisma.transaction.findMany({
    where: {
      merchantId: id,
      ...(fromDate || toDate
        ? {
            transactionDate: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    orderBy: { transactionDate: "asc" },
    include: {
      client: { select: { name: true } },
      paymentMethod: { select: { name: true } },
    },
  });

  const totals = transactions.reduce(
    (acc, t) => ({
      gross: acc.gross.plus(t.grossAmount),
      merchantFee: acc.merchantFee.plus(t.merchantFee),
      reserve: acc.reserve.plus(t.merchantReserveAmount),
      expectedSettlement: acc.expectedSettlement.plus(t.expectedSettlement),
    }),
    {
      gross: new Decimal(0),
      merchantFee: new Decimal(0),
      reserve: new Decimal(0),
      expectedSettlement: new Decimal(0),
    }
  );

  return (
    <div className="space-y-4">
      <DateRangeHeader
        title="Merchant Statement"
        from={from}
        to={to}
        reportType="merchant-statement"
        exportParams={{ id }}
      />
      <Card>
        <CardHeader>
          <CardTitle>{merchant.name} — Merchant Statement</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Gross Volume</p>
            <p className="text-lg font-semibold">{totals.gross.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Merchant Fees</p>
            <p className="text-lg font-semibold">{totals.merchantFee.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Reserves Held</p>
            <p className="text-lg font-semibold">{totals.reserve.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expected Settlement</p>
            <p className="text-lg font-semibold">{totals.expectedSettlement.toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Merchant Fee</TableHead>
              <TableHead className="text-right">Reserve</TableHead>
              <TableHead className="text-right">Expected Settlement</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <EmptyTableRow colSpan={8} message="No transactions yet." />
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{format(t.transactionDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{t.client.name}</TableCell>
                  <TableCell>{t.paymentMethod.name}</TableCell>
                  <TableCell className="text-right">{t.grossAmount.toString()}</TableCell>
                  <TableCell className="text-right">{t.merchantFee.toString()}</TableCell>
                  <TableCell className="text-right">{t.merchantReserveAmount.toString()}</TableCell>
                  <TableCell className="text-right">{t.expectedSettlement.toString()}</TableCell>
                  <TableCell>
                    <TransactionStatusBadge status={t.status} />
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

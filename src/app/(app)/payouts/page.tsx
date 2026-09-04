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
import { DateRangeHeader } from "@/components/exports/date-range-header";
import { DeletePayoutAction } from "./delete-payout-action";

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const [payouts, closedMonths] = await Promise.all([
    prisma.clientPayout.findMany({
      where: {
        ...(fromDate || toDate
          ? { payoutDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true } },
        payoutMethod: { select: { name: true } },
        bankAccount: { select: { name: true } },
        _count: { select: { allocations: true } },
      },
    }),
    prisma.monthClose.findMany({ where: { status: "CLOSED" }, select: { accountingMonth: true } }),
  ]);
  const closedMonthSet = new Set(closedMonths.map((m) => m.accountingMonth));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Client Payouts</h1>
        <Link href="/payouts/new" className={buttonVariants({})}>
          + New Payout
        </Link>
      </div>

      <DateRangeHeader from={from} to={to} reportType="payouts" />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead className="text-right">Txns</TableHead>
              <TableHead className="text-right">Amount Paid</TableHead>
              <TableHead className="text-right">Remittance Fee</TableHead>
              <TableHead>Fee Bearer</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.length === 0 ? (
              <EmptyTableRow colSpan={10} message="No payouts yet." />
            ) : (
              payouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{format(p.payoutDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{p.client.name}</TableCell>
                  <TableCell>{p.payoutMethod.name}</TableCell>
                  <TableCell>{p.bankAccount.name}</TableCell>
                  <TableCell className="text-right">{p._count.allocations}</TableCell>
                  <TableCell className="text-right">{p.amountPaid.toString()}</TableCell>
                  <TableCell className="text-right">{p.remittanceFee.toString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.feeBearer}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.reference ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <DeletePayoutAction id={p.id} monthOpen={!closedMonthSet.has(p.accountingMonth)} />
                    </div>
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

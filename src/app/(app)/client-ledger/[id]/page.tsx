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
import { DateRangeHeader } from "@/components/exports/date-range-header";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  const [entries, clientHeldReserves] = await Promise.all([
    prisma.clientLedger.findMany({
      where: { clientId: id },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.reserveHold.findMany({
      where: { direction: "CLIENT_HELD", transaction: { clientId: id } },
      include: { actions: true },
      orderBy: { heldSince: "asc" },
    }),
  ]);

  // Client-held reserves are the client's own money, just not yet released
  // -- they never post to the ledger/running-balance (already excluded from
  // clientNetPayable at transaction time), so this is purely informational.
  const heldForClient = clientHeldReserves
    .map((h) => {
      const used = h.actions.reduce((sum, a) => sum + Number(a.amount), 0);
      return { transactionId: h.transactionId, remaining: Number(h.originalAmount) - used, since: h.heldSince };
    })
    .filter((h) => h.remaining > 0);
  const heldForClientTotal = heldForClient.reduce((sum, h) => sum + h.remaining, 0);

  const allRows = entries.reduce<Array<(typeof entries)[number] & { runningBalance: number }>>(
    (acc, e) => {
      const previousBalance = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0;
      acc.push({ ...e, runningBalance: previousBalance + Number(e.amount) });
      return acc;
    },
    []
  );
  const running = allRows.length > 0 ? allRows[allRows.length - 1].runningBalance : 0;
  const rows = allRows.filter(
    (r) => (!fromDate || r.entryDate >= fromDate) && (!toDate || r.entryDate <= toDate)
  );

  return (
    <div className="space-y-4">
      <DateRangeHeader
        from={from}
        to={to}
        reportType="client-ledger-internal"
        exportParams={{ id }}
      />
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
          <p className="text-sm text-muted-foreground">
            {running < 0 ? "Advanced / Owed to FoundaPay" : "Current balance"}
          </p>
          <p
            className={`text-2xl font-semibold ${
              running > 0 ? "text-emerald-600" : running < 0 ? "text-destructive" : ""
            }`}
          >
            {running < 0 ? Math.abs(running).toFixed(2) : running.toFixed(2)}
          </p>
          {running < 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              FoundaPay has fronted this client more than they&apos;re currently owed. This
              carries forward until offsetting activity brings the balance back to zero or
              positive.
            </p>
          )}
        </CardContent>
      </Card>

      {heldForClient.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Held on your behalf</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              A merchant/processor is holding this money back from this client&apos;s own funds --
              still theirs, not yet released. Not included in the balance above; released via the
              Merchant Hold/Reserve report.
            </p>
            <p className="mt-2 text-xl font-semibold">{heldForClientTotal.toFixed(2)}</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {heldForClient.map((h) => (
                <li key={h.transactionId}>
                  {h.transactionId}: {h.remaining.toFixed(2)} (held since {format(h.since, "yyyy-MM-dd")})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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

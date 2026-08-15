import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function ThirdPartyDetailPage({
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

  const party = await prisma.settlementParty.findUnique({ where: { id } });
  if (!party) notFound();

  const entries = await prisma.thirdPartyLedger.findMany({
    where: { settlementPartyId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  const allRows = entries.reduce<Array<(typeof entries)[number] & { runningBalance: number }>>(
    (acc, e) => {
      const previous = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0;
      acc.push({ ...e, runningBalance: previous + Number(e.amount) });
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
      <DateRangeHeader from={from} to={to} reportType="third-party-ledger" exportParams={{ id }} />
      <Card>
        <CardHeader>
          <CardTitle>{party.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">FoundaPay owes this party</p>
          <p className={`text-2xl font-semibold ${running > 0 ? "text-destructive" : ""}`}>
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
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Running Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <EmptyTableRow colSpan={5} message="No activity yet." />
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(r.entryDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{r.accountingMonth}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.description ?? "—"}
                  </TableCell>
                  <TableCell className={`text-right ${Number(r.amount) < 0 ? "text-emerald-600" : ""}`}>
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

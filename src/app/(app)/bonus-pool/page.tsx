import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeHeader } from "@/components/exports/date-range-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AllocatePanel } from "./allocate-panel";

export default async function BonusPoolPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const [entries, employees] = await Promise.all([
    prisma.bonusPoolLedger.findMany({
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
      include: { allocatedToEmployee: { select: { name: true } } },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const balance = entries.reduce((sum, e) => sum + Number(e.amount), 0);

  // Running balance must include everything before the range starts, so we
  // compute it over full history and only display rows inside the range.
  const rows: Array<(typeof entries)[number] & { runningBalance: number }> = [];
  let running = 0;
  for (const e of entries) {
    running += Number(e.amount);
    const inRange = (!fromDate || e.entryDate >= fromDate) && (!toDate || e.entryDate <= toDate);
    if (inRange) rows.push({ ...e, runningBalance: running });
  }

  return (
    <div className="space-y-4">
      <DateRangeHeader from={from} to={to} reportType="bonus-pool" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Bonus Pool</span>
            <AllocatePanel employees={employees} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Available to allocate</p>
          <p className="text-2xl font-semibold">{balance.toFixed(2)}</p>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Allocated To</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Running Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No activity yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(r.entryDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{r.accountingMonth}</TableCell>
                  <TableCell>{r.allocatedToEmployee?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.description ?? "—"}
                  </TableCell>
                  <TableCell className={`text-right ${Number(r.amount) < 0 ? "text-destructive" : ""}`}>
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

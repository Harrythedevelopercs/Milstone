import { notFound } from "next/navigation";
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

export default async function EmployeePartnerLedgerDetailPage({
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

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) notFound();

  const entries = await prisma.employeePartnerLedger.findMany({
    where: { employeeId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  // Running balance must include everything before the range starts, so we
  // compute it over full history and only display rows inside the range.
  const rows: Array<(typeof entries)[number] & { runningBalance: number }> = [];
  let running = 0;
  for (const e of entries) {
    running += Number(e.amount);
    const inRange = (!fromDate || e.entryDate >= fromDate) && (!toDate || e.entryDate <= toDate);
    if (inRange) rows.push({ ...e, runningBalance: running });
  }
  const balance = running;

  return (
    <div className="space-y-4">
      <DateRangeHeader
        from={from}
        to={to}
        reportType="employee-partner-ledger"
        exportParams={{ id }}
      />
      <Card>
        <CardHeader>
          <CardTitle>{employee.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Commission balance owed</p>
          <p className="text-2xl font-semibold">{balance.toFixed(2)}</p>
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
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No activity yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(r.entryDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{r.accountingMonth}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">{Number(r.amount).toFixed(2)}</TableCell>
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

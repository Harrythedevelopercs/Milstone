import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeHeader } from "@/components/exports/date-range-header";
import { bankAccountLabel } from "@/lib/bank-account-label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";
import { PaymentPanel } from "./payment-panel";

const KIND_LABEL: Record<string, string> = {
  COMMISSION: "Commission",
  PAYMENT: "Payment",
  ADJUSTMENT: "Adjustment",
};

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

  const [employee, bankAccounts, entries] = await Promise.all([
    prisma.employee.findUnique({ where: { id } }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { company: { select: { name: true } } },
    }),
    prisma.employeePartnerLedger.findMany({
      where: { employeeId: id },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  if (!employee) notFound();

  // Running balance must include everything before the range starts, so we
  // compute it over full history and only display rows inside the range.
  const rows: Array<(typeof entries)[number] & { runningBalance: number }> = [];
  let running = 0;
  let owed = 0;
  let paid = 0;
  for (const e of entries) {
    const amt = Number(e.amount);
    running += amt;
    if (e.kind === "COMMISSION") owed += amt;
    if (e.kind === "PAYMENT") paid += Math.abs(amt);
    const inRange = (!fromDate || e.entryDate >= fromDate) && (!toDate || e.entryDate <= toDate);
    if (inRange) rows.push({ ...e, runningBalance: running });
  }
  const balance = running;

  return (
    <div className="space-y-4">
      <DateRangeHeader
        title="Employee Partner Ledger"
        from={from}
        to={to}
        reportType="employee-partner-ledger"
        exportParams={{ id }}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{employee.name}</span>
            <PaymentPanel
              employeeId={id}
              owed={balance.toFixed(2)}
              bankAccounts={bankAccounts.map((a) => ({ id: a.id, name: bankAccountLabel(a) }))}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Accrued (all-time)</p>
              <p className="text-xl font-semibold">{owed.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid (all-time)</p>
              <p className="text-xl font-semibold">{paid.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Owed now (liability)</p>
              <p className={`text-xl font-semibold ${balance > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                {balance.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Running Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <EmptyTableRow colSpan={6} message="No activity yet." />
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(r.entryDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{r.accountingMonth}</TableCell>
                  <TableCell>{KIND_LABEL[r.kind] ?? r.kind}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.description ?? "—"}
                  </TableCell>
                  <TableCell className={`text-right ${Number(r.amount) < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
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

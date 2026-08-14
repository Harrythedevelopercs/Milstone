import { notFound } from "next/navigation";
import { format } from "date-fns";
import Decimal from "decimal.js";
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
import { ReconcilePanel } from "./reconcile-panel";

export default async function CashPositionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const account = await prisma.bankAccount.findUnique({ where: { id } });
  if (!account) notFound();

  const [entries, reconciliations] = await Promise.all([
    prisma.bankLedger.findMany({
      where: { bankAccountId: id },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.bankReconciliation.findMany({
      where: { bankAccountId: id },
      orderBy: { asOfDate: "desc" },
    }),
  ]);

  const rows = entries.reduce<Array<(typeof entries)[number] & { runningBalance: Decimal }>>(
    (acc, e) => {
      const previous = acc.length > 0 ? acc[acc.length - 1].runningBalance : new Decimal(account.openingBalance);
      acc.push({ ...e, runningBalance: previous.plus(e.amount) });
      return acc;
    },
    []
  );
  const bookBalance = rows.length > 0 ? rows[rows.length - 1].runningBalance : new Decimal(account.openingBalance);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{account.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Book balance</p>
          <p className="text-2xl font-semibold">{bookBalance.toFixed(2)}</p>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
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
                  <TableCell>{r.sourceType}</TableCell>
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

      <ReconcilePanel
        bankAccountId={id}
        currentBookBalance={bookBalance.toFixed(2)}
        records={reconciliations.map((r) => ({
          id: r.id,
          asOfDate: format(r.asOfDate, "yyyy-MM-dd"),
          bookBalance: r.bookBalance.toString(),
          actualBalance: r.actualBalance.toString(),
          differenceAmount: r.differenceAmount.toString(),
          notes: r.notes,
        }))}
      />
    </div>
  );
}

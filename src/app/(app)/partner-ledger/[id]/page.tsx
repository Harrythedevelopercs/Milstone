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
import { DrawingPanel } from "./drawing-panel";

const KIND_LABEL: Record<string, string> = {
  PROFIT_ENTITLEMENT: "Profit Entitlement",
  DRAWING: "Drawing",
  LOAN: "Loan",
  LOAN_REPAYMENT: "Loan Repayment",
  ADJUSTMENT: "Adjustment",
};

export default async function PartnerLedgerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [partner, bankAccounts] = await Promise.all([
    prisma.partner.findUnique({ where: { id } }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!partner) notFound();

  const entries = await prisma.partnerLedger.findMany({
    where: { partnerId: id },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  const rows = entries.reduce<Array<(typeof entries)[number] & { runningBalance: number }>>(
    (acc, e) => {
      const previous = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0;
      acc.push({ ...e, runningBalance: previous + Number(e.amount) });
      return acc;
    },
    []
  );
  const balance = rows.length > 0 ? rows[rows.length - 1].runningBalance : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {partner.name} ({partner.profitSharePercent.toString()}%)
            </span>
            <DrawingPanel partnerId={id} bankAccounts={bankAccounts} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Accumulated equity balance</p>
          <p className={`text-2xl font-semibold ${balance < 0 ? "text-destructive" : ""}`}>
            {balance.toFixed(2)}
          </p>
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
                  <TableCell>{KIND_LABEL[r.kind] ?? r.kind}</TableCell>
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

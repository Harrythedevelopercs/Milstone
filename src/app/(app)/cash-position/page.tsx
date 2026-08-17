import Link from "next/link";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DownloadButtons } from "@/components/exports/download-buttons";

const TYPE_LABEL: Record<string, string> = { BANK: "Bank", USDT: "USDT", CASH: "Cash" };

export default async function CashPositionPage() {
  const accounts = await prisma.bankAccount.findMany({
    where: { active: true },
    orderBy: [{ accountType: "asc" }, { name: "asc" }],
    include: {
      ledgerEntries: { select: { amount: true, usdValue: true } },
    },
  });

  const rows = accounts.map((a) => {
    const ledgerNative = a.ledgerEntries.reduce((sum, e) => sum.plus(e.amount), new Decimal(0));
    const ledgerUsd = a.ledgerEntries.reduce((sum, e) => sum.plus(e.usdValue), new Decimal(0));
    return {
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      currency: a.currency,
      nativeBalance: new Decimal(a.openingBalance).plus(ledgerNative),
      usdBalance: new Decimal(a.openingBalance).plus(ledgerUsd),
    };
  });

  const totalUsd = rows.reduce((sum, r) => sum.plus(r.usdBalance), new Decimal(0));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Cash Position</h1>
          <p className="text-sm text-muted-foreground">
            Actual money across every bank, USDT wallet, and cash drawer right now.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reconciliation" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Reconciliation →
          </Link>
          <DownloadButtons reportType="cash-position" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total (USD)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{totalUsd.toFixed(2)}</p>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Balance (native)</TableHead>
              <TableHead className="text-right">Balance (USD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <EmptyTableRow colSpan={5} message="No active bank accounts yet." />
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/cash-position/${r.id}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{TYPE_LABEL[r.accountType]}</Badge>
                  </TableCell>
                  <TableCell>{r.currency}</TableCell>
                  <TableCell className="text-right">{r.nativeBalance.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {r.usdBalance.toFixed(2)}
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

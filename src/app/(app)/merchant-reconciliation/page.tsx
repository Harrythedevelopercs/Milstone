import Decimal from "decimal.js";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DownloadButtons } from "@/components/exports/download-buttons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function MerchantReconciliationPage() {
  const merchants = await prisma.merchant.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      settlementBatches: { orderBy: { depositDate: "desc" } },
      transactions: {
        where: { status: "APPROVED", settlementBatchId: null },
        select: { expectedSettlement: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Merchant Reconciliation</h1>
          <p className="text-sm text-muted-foreground">
            Book (expected) vs actual deposits, per merchant, plus anything still awaiting settlement.
          </p>
        </div>
        <DownloadButtons reportType="merchant-reconciliation" />
      </div>

      {merchants.map((m) => {
        const awaitingCount = m.transactions.length;
        const awaitingTotal = m.transactions.reduce(
          (sum, t) => sum.plus(t.expectedSettlement),
          new Decimal(0)
        );
        const totalDifference = m.settlementBatches.reduce(
          (sum, b) => sum.plus(b.differenceAmount),
          new Decimal(0)
        );

        if (m.settlementBatches.length === 0 && awaitingCount === 0) return null;

        return (
          <Card key={m.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{m.name}</span>
                {!totalDifference.isZero() && (
                  <Badge variant="destructive">Net difference {totalDifference.toFixed(2)}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {awaitingCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {awaitingCount} approved transaction{awaitingCount === 1 ? "" : "s"} awaiting
                  settlement, expected total {awaitingTotal.toFixed(2)}.
                </p>
              )}
              {m.settlementBatches.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deposit Date</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Deposit</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {m.settlementBatches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{format(b.depositDate, "yyyy-MM-dd")}</TableCell>
                        <TableCell className="text-right">{b.expectedAmount.toString()}</TableCell>
                        <TableCell className="text-right">{b.depositAmount.toString()}</TableCell>
                        <TableCell
                          className={`text-right ${
                            Number(b.differenceAmount) !== 0 ? "text-destructive font-medium" : ""
                          }`}
                        >
                          {b.differenceAmount.toString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={b.status === "RECONCILED" ? "default" : "destructive"}>
                            {b.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

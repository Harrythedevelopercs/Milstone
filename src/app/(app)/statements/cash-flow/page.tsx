import { format } from "date-fns";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { MonthPickerHeader, currentAccountingMonthFrom } from "@/components/month-picker-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SOURCE_LABEL: Record<string, string> = {
  TRANSACTION: "Transactions",
  RCV: "Refunds/Chargebacks/Voids",
  PAYOUT: "Client Payouts",
  SETTLEMENT_BATCH: "Merchant Settlements",
  EXPENSE: "Expenses",
  INTERNAL_TRANSFER: "Internal Transfers",
  THIRD_PARTY_SETTLEMENT: "Third-Party Settlements",
  ADJUSTMENT: "Adjustments",
  PRODUCT_SERVICE_SALE: "Product/Service Sales",
  MONTH_CLOSE: "Payroll / Distributions",
  MANUAL: "Manual (drawings, other)",
};

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const accountingMonth = currentAccountingMonthFrom(month, (d) => format(d, "yyyy-MM"));

  const grouped = await prisma.bankLedger.groupBy({
    by: ["sourceType"],
    where: { accountingMonth },
    _sum: { usdValue: true },
  });

  const inflows = grouped.filter((g) => Number(g._sum.usdValue ?? 0) > 0);
  const outflows = grouped.filter((g) => Number(g._sum.usdValue ?? 0) < 0);
  const netChange = grouped.reduce((sum, g) => sum.plus(g._sum.usdValue ?? 0), new Decimal(0));

  return (
    <div className="space-y-4">
      <MonthPickerHeader
        title="Cash Flow"
        accountingMonth={accountingMonth}
        downloadReportType="cash-flow"
      />

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Net cash change this month</p>
          <p
            className={`text-2xl font-semibold ${
              netChange.isNegative() ? "text-destructive" : "text-emerald-600"
            }`}
          >
            {netChange.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inflows</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inflows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                    None
                  </TableCell>
                </TableRow>
              ) : (
                inflows.map((g) => (
                  <TableRow key={g.sourceType}>
                    <TableCell>{SOURCE_LABEL[g.sourceType] ?? g.sourceType}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {Number(g._sum.usdValue).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Outflows</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outflows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                    None
                  </TableCell>
                </TableRow>
              ) : (
                outflows.map((g) => (
                  <TableRow key={g.sourceType}>
                    <TableCell>{SOURCE_LABEL[g.sourceType] ?? g.sourceType}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {Number(g._sum.usdValue).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

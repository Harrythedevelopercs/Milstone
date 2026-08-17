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
  RESERVE: "Reserve Releases/Settlements",
};

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const accountingMonth = currentAccountingMonthFrom(month, (d) => format(d, "yyyy-MM"));
  const monthStart = new Date(`${accountingMonth}-01T00:00:00.000Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const [grouped, accounts] = await Promise.all([
    prisma.bankLedger.groupBy({
      by: ["sourceType"],
      where: { accountingMonth },
      _sum: { usdValue: true },
    }),
    prisma.bankAccount.findMany({
      where: { active: true },
      select: {
        openingBalance: true,
        ledgerEntries: { select: { entryDate: true, usdValue: true } },
      },
    }),
  ]);

  const inflows = grouped.filter((g) => Number(g._sum.usdValue ?? 0) > 0);
  const outflows = grouped.filter((g) => Number(g._sum.usdValue ?? 0) < 0);
  const netChange = grouped.reduce((sum, g) => sum.plus(g._sum.usdValue ?? 0), new Decimal(0));

  // Reconciles directly to Cash Position: beginning is every account's
  // opening balance plus every entry before this month; ending adds this
  // month's entries too -- the same BankLedger rows Cash Position sums.
  let beginningCash = new Decimal(0);
  let endingCash = new Decimal(0);
  for (const a of accounts) {
    let bal = new Decimal(a.openingBalance);
    for (const e of a.ledgerEntries) {
      if (e.entryDate < monthStart) bal = bal.plus(e.usdValue);
    }
    beginningCash = beginningCash.plus(bal);
    for (const e of a.ledgerEntries) {
      if (e.entryDate >= monthStart && e.entryDate < monthEnd) bal = bal.plus(e.usdValue);
    }
    endingCash = endingCash.plus(bal);
  }

  return (
    <div className="space-y-4">
      <MonthPickerHeader
        title="Cash Flow"
        accountingMonth={accountingMonth}
        downloadReportType="cash-flow"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Beginning cash</p>
            <p className="text-2xl font-semibold">{beginningCash.toFixed(2)}</p>
          </CardContent>
        </Card>
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
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Ending cash (reconciles to Cash Position)</p>
            <p className="text-2xl font-semibold">{endingCash.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

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

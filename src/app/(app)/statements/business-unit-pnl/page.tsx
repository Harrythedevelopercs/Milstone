import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { calculatePnl } from "@/lib/statements/pnl";
import { MonthPickerHeader, currentAccountingMonthFrom } from "@/components/month-picker-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function BusinessUnitPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const accountingMonth = currentAccountingMonthFrom(month, (d) => format(d, "yyyy-MM"));

  const businessUnits = await prisma.businessUnit.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    businessUnits.map(async (b) => ({
      name: b.name,
      pnl: await calculatePnl(accountingMonth, { level: "businessUnit", businessUnitId: b.id }),
    }))
  );

  return (
    <div className="space-y-4">
      <MonthPickerHeader
        title="Business Unit P&L"
        accountingMonth={accountingMonth}
        downloadReportType="business-unit-pnl"
      />
      <p className="text-sm text-muted-foreground">
        Includes transaction revenue, product/service sales gross profit, and expenses tagged to
        each business unit. Salaries aren&apos;t tied to a business unit.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business Unit</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Product GP</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No business units yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{r.pnl.revenue.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{r.pnl.productGrossProfit.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{r.pnl.expenses.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">{r.pnl.netProfit.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

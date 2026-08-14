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

export default async function CompanyPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const accountingMonth = currentAccountingMonthFrom(month, (d) => format(d, "yyyy-MM"));

  const companies = await prisma.company.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    companies.map(async (c) => ({
      name: c.name,
      pnl: await calculatePnl(accountingMonth, { level: "company", companyId: c.id }),
    }))
  );

  return (
    <div className="space-y-4">
      <MonthPickerHeader
        title="Company P&L"
        accountingMonth={accountingMonth}
        downloadReportType="company-pnl"
      />
      <p className="text-sm text-muted-foreground">
        Revenue and expenses tied directly to each company&apos;s merchants; salaries and product
        sales aren&apos;t attributable to a single company and only appear in the consolidated view.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No companies yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{r.pnl.revenue.toFixed(2)}</TableCell>
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

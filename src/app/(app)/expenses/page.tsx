import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
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
import { DateRangeHeader } from "@/components/exports/date-range-header";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const expenses = await prisma.expense.findMany({
    where: {
      ...(fromDate || toDate
        ? { expenseDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      expenseCategory: { select: { name: true } },
      vendor: { select: { name: true } },
      bankAccount: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <Link href="/expenses/new" className={buttonVariants({})}>
          New Expense
        </Link>
      </div>

      <DateRangeHeader from={from} to={to} reportType="expenses" />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Paid From</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Recurring</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <EmptyTableRow colSpan={7} message="No expenses yet." />
            ) : (
              expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{format(e.expenseDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{e.expenseCategory.name}</TableCell>
                  <TableCell>{e.vendor?.name ?? "—"}</TableCell>
                  <TableCell>{e.bankAccount.name}</TableCell>
                  <TableCell className="text-right">{e.amount.toString()}</TableCell>
                  <TableCell>{e.recurring ? <Badge variant="outline">Yes</Badge> : "—"}</TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    {e.description ?? "—"}
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

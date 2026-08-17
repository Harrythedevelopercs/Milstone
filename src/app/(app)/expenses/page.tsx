import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToneBadge } from "@/components/ui/tone-badge";
import { MarkSettledAction } from "@/components/ui/mark-settled-action";
import { NEEDS_ATTENTION_ROW_CLASS } from "@/lib/status-tone";
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
import { markExpenseSettled } from "./actions";

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
      client: { select: { name: true } },
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
              <TableHead>Bearer</TableHead>
              <TableHead>Recurring</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <EmptyTableRow colSpan={10} message="No expenses yet." />
            ) : (
              expenses.map((e) => {
                const pending = e.settlementStatus === "PENDING";
                return (
                  <TableRow key={e.id} className={pending ? NEEDS_ATTENTION_ROW_CLASS : undefined}>
                    <TableCell>{format(e.expenseDate, "yyyy-MM-dd")}</TableCell>
                    <TableCell>{e.expenseCategory.name}</TableCell>
                    <TableCell>{e.vendor?.name ?? "—"}</TableCell>
                    <TableCell>{e.bankAccount.name}</TableCell>
                    <TableCell className="text-right">{e.amount.toString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.feeBearer === "CLIENT" ? `Client (${e.client?.name ?? "—"})` : "FoundaPay"}
                    </TableCell>
                    <TableCell>{e.recurring ? <Badge variant="outline">Yes</Badge> : "—"}</TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {e.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={pending ? "warning" : "success"}>
                        {pending ? "Pending" : "Settled"}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      {pending && <MarkSettledAction id={e.id} action={markExpenseSettled} />}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

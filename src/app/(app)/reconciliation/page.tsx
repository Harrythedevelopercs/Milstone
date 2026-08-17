import Link from "next/link";
import { format } from "date-fns";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReconciliationRow } from "./reconciliation-row";

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const accountingMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), "yyyy-MM");
  const monthStart = new Date(`${accountingMonth}-01T00:00:00.000Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const accounts = await prisma.bankAccount.findMany({
    where: { active: true },
    orderBy: [{ accountType: "asc" }, { name: "asc" }],
    include: {
      ledgerEntries: { select: { amount: true } },
      reconciliations: {
        where: { asOfDate: { gte: monthStart, lt: monthEnd } },
        orderBy: { asOfDate: "desc" },
        take: 1,
      },
    },
  });

  const rows = accounts.map((a) => {
    const bookBalance = a.ledgerEntries
      .reduce((sum, e) => sum.plus(e.amount), new Decimal(a.openingBalance))
      .toFixed(2);
    const thisMonthRecon = a.reconciliations[0] ?? null;
    return {
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      bookBalance,
      reconciledThisMonth: !!thisMonthRecon,
      lastReconciledAsOf: thisMonthRecon ? format(thisMonthRecon.asOfDate, "yyyy-MM-dd") : null,
    };
  });

  const allReconciled = rows.length > 0 && rows.every((r) => r.reconciledThisMonth);
  const prevMonth = format(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1), "yyyy-MM");
  const nextMonth = format(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1), "yyyy-MM");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Bank / USDT / Cash Reconciliation</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            For each active account: check the book balance below against your real bank
            statement, USDT wallet, or cash count, enter the actual balance, and hit Record.
            Once every active account is reconciled for the month, the Month-Close checklist
            item flips to Done automatically.
          </p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="month" className="text-xs text-muted-foreground">
              Month
            </label>
            <input
              id="month"
              name="month"
              type="month"
              defaultValue={accountingMonth}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            />
          </div>
          <button type="submit" className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted">
            Go
          </button>
        </form>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <Link href={`/reconciliation?month=${prevMonth}`} className="text-muted-foreground hover:underline">
          ← {prevMonth}
        </Link>
        <span className="font-medium">{accountingMonth}</span>
        <Link href={`/reconciliation?month=${nextMonth}`} className="text-muted-foreground hover:underline">
          {nextMonth} →
        </Link>
        <Link href="/month-close" className="ml-auto text-muted-foreground hover:underline">
          View Month-Close checklist →
        </Link>
      </div>

      <Card className={allReconciled ? "border-emerald-200 dark:border-emerald-500/30" : ""}>
        <CardHeader>
          <CardTitle className="text-base">
            {allReconciled
              ? `All active accounts reconciled for ${accountingMonth}`
              : `${rows.filter((r) => r.reconciledThisMonth).length} of ${rows.length} active accounts reconciled for ${accountingMonth}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No active accounts.</p>
          ) : (
            rows.map((r) => (
              <ReconciliationRow
                key={r.id}
                bankAccountId={r.id}
                name={r.name}
                accountType={r.accountType}
                bookBalance={r.bookBalance}
                reconciledThisMonth={r.reconciledThisMonth}
                lastReconciledAsOf={r.lastReconciledAsOf}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

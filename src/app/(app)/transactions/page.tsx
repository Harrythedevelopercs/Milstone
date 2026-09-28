import Link from "next/link";
import Decimal from "decimal.js";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getUnifiedMoneyMovements,
  MONEY_MOVEMENT_TYPES,
  MONEY_MOVEMENT_TYPE_LABEL,
  type MoneyMovementType,
} from "@/lib/transactions/unified-board";
import { isPendingApproval, toClientMoneyMovementRow } from "@/lib/transactions/unified-board-types";
import { TransactionBoardBody } from "./transaction-board-body";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string; pending?: string }>;
}) {
  const { from, to, type, pending } = await searchParams;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const selectedType =
    type && (MONEY_MOVEMENT_TYPES as readonly string[]).includes(type) ? (type as MoneyMovementType) : null;
  const pendingOnly = pending === "1";

  const allRows = await getUnifiedMoneyMovements({
    from: fromDate,
    to: toDate,
    types: selectedType ? [selectedType] : undefined,
  });
  const rows = pendingOnly ? allRows.filter(isPendingApproval) : allRows;

  // Totals reflect confirmed money only -- a Submitted/awaiting-approval
  // transaction hasn't been approved yet (could still be rejected), so its
  // gross amount doesn't count as real In/Out. Pending is called out
  // separately below instead of being silently folded into (or silently
  // excluded from) the headline totals.
  const confirmedRows = rows.filter((r) => !isPendingApproval(r));
  const pendingRows = rows.filter(isPendingApproval);
  const totalIn = confirmedRows.reduce(
    (sum, r) => (r.amount.greaterThan(0) ? sum.plus(r.amount) : sum),
    new Decimal(0)
  );
  const totalOut = confirmedRows.reduce(
    (sum, r) => (r.amount.lessThan(0) ? sum.plus(r.amount.abs()) : sum),
    new Decimal(0)
  );
  const pendingTotal = pendingRows.reduce((sum, r) => sum.plus(r.amount), new Decimal(0));

  const baseQuery = {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(pendingOnly ? { pending: "1" } : {}),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Every money movement across FoundaPay -- payouts, expenses, transfers, refunds,
            chargebacks, voids, third-party settlements, disbursements, and sales -- in one place.
            Each row links back to its own module for full detail and actions.{" "}
            <Link href="/transactions/received" className="underline">
              Received Transactions (review/approve queue) →
            </Link>{" "}
            <Link href="/transactions/duplicates" className="underline">
              Possible Duplicates (review board) →
            </Link>
          </p>
        </div>
        <Link href="/transactions/new" className={buttonVariants({})}>
          + New Transaction
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex items-end gap-2">
          {selectedType && <input type="hidden" name="type" value={selectedType} />}
          {pendingOnly && <input type="hidden" name="pending" value="1" />}
          <div className="flex flex-col gap-1">
            <label htmlFor="from" className="text-xs text-muted-foreground">From</label>
            <input
              id="from" name="from" type="date" defaultValue={from}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="to" className="text-xs text-muted-foreground">To</label>
            <input
              id="to" name="to" type="date" defaultValue={to}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            />
          </div>
          <button type="submit" className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted">
            Go
          </button>
        </form>
        <div className="flex gap-3">
          <div className="rounded-md border bg-muted/30 px-4 py-2 text-right">
            <p className="text-xs text-muted-foreground" title="Approved and later statuses only -- excludes anything still awaiting approval.">
              In (confirmed)
            </p>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{totalIn.toFixed(2)}</p>
          </div>
          <div className="rounded-md border bg-muted/30 px-4 py-2 text-right">
            <p className="text-xs text-muted-foreground" title="Approved and later statuses only -- excludes anything still awaiting approval.">
              Out (confirmed)
            </p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">{totalOut.toFixed(2)}</p>
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-right">
            <p className="text-xs text-amber-700 dark:text-amber-400" title="Received transactions still Entered, Submitted, or awaiting further details -- not yet approved, not included in In/Out above.">
              Pending (awaiting approval)
            </p>
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
              {pendingRows.length === 0 ? "—" : `${pendingTotal.toFixed(2)} (${pendingRows.length})`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={{
            pathname: "/transactions",
            query: {
              ...(from ? { from } : {}),
              ...(to ? { to } : {}),
              ...(selectedType ? { type: selectedType } : {}),
              ...(pendingOnly ? {} : { pending: "1" }),
            },
          }}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium",
            pendingOnly
              ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400"
              : "border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
          )}
        >
          {pendingOnly ? "✓ Pending only" : "Pending only"}
        </Link>
        <span className="mx-1 h-4 w-px bg-border" />
        <Link
          href={{ pathname: "/transactions", query: baseQuery }}
          className={cn(
            "rounded-full border px-3 py-1 text-xs",
            !selectedType ? "border-primary bg-primary/10 font-medium" : "border-input text-muted-foreground hover:bg-muted"
          )}
        >
          All
        </Link>
        {MONEY_MOVEMENT_TYPES.map((t) => (
          <Link
            key={t}
            href={{ pathname: "/transactions", query: { ...baseQuery, type: t } }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              selectedType === t ? "border-primary bg-primary/10 font-medium" : "border-input text-muted-foreground hover:bg-muted"
            )}
          >
            {MONEY_MOVEMENT_TYPE_LABEL[t]}
          </Link>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TransactionBoardBody
            rows={rows.map(toClientMoneyMovementRow)}
            emptyMessage={
              pendingOnly
                ? "No Received transactions are awaiting approval in range."
                : "No money movements in range."
            }
          />
        </Table>
      </div>
    </div>
  );
}

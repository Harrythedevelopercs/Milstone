import Link from "next/link";
import { format } from "date-fns";
import Decimal from "decimal.js";
import { buttonVariants } from "@/components/ui/button";
import { ToneBadge } from "@/components/ui/tone-badge";
import { cn } from "@/lib/utils";
import { statusTone, type StatusTone } from "@/lib/status-tone";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";
import { NEEDS_ATTENTION_ROW_CLASS } from "@/lib/status-tone";
import {
  getUnifiedMoneyMovements,
  MONEY_MOVEMENT_TYPES,
  MONEY_MOVEMENT_TYPE_LABEL,
  type MoneyMovementRow,
  type MoneyMovementType,
} from "@/lib/transactions/unified-board";

const RCV_STATUSES = new Set(["OPEN", "RESOLVED", "DISPUTED"]);
const TRACKING_STATUSES = new Set(["PENDING", "SETTLED"]);
const TRANSACTION_STATUSES = new Set([
  "ENTERED", "SUBMITTED", "APPROVED", "PROCESSED", "SETTLED", "CLIENT_PAYABLE",
  "PARTIALLY_PAID", "PAID", "CLOSED", "HOLD", "RESERVE", "VOID", "REFUNDED",
  "CHARGEBACK", "DISPUTED", "REJECTED", "DETAILS_REQUESTED",
]);

// Awaiting-approval statuses for a Received transaction -- the same set the
// review/approve queue (transactions/received) works through. Not "on hold"
// (HOLD/RESERVE) or any other in-flight status -- those have already been
// approved at least once; this is specifically "hasn't been approved yet".
const PENDING_APPROVAL_STATUSES = new Set(["ENTERED", "SUBMITTED", "DETAILS_REQUESTED"]);

function isPendingApproval(row: MoneyMovementRow): boolean {
  return row.type === "RECEIVED" && !!row.status && PENDING_APPROVAL_STATUSES.has(row.status);
}

function rowTone(row: MoneyMovementRow): StatusTone {
  if (!row.status) return "neutral";
  if (row.type === "RECEIVED" && TRANSACTION_STATUSES.has(row.status)) return statusTone.transaction(row.status);
  if ((row.type === "REFUND" || row.type === "CHARGEBACK" || row.type === "VOID") && RCV_STATUSES.has(row.status)) {
    return statusTone.rcvStatus(row.status);
  }
  if (TRACKING_STATUSES.has(row.status)) return row.status === "PENDING" ? "warning" : "success";
  return "neutral";
}

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
          <TableBody>
            {rows.length === 0 ? (
              <EmptyTableRow
                colSpan={5}
                message={
                  pendingOnly
                    ? "No Received transactions are awaiting approval in range."
                    : "No money movements in range."
                }
              />
            ) : (
              rows.map((r) => (
                <TableRow
                  key={`${r.type}-${r.id}`}
                  className={isPendingApproval(r) ? NEEDS_ATTENTION_ROW_CLASS : undefined}
                >
                  <TableCell>{format(r.date, "yyyy-MM-dd")}</TableCell>
                  <TableCell>
                    <Link href={r.href} className="text-sm hover:underline">
                      {MONEY_MOVEMENT_TYPE_LABEL[r.type]}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm text-muted-foreground" title={r.description}>
                    {r.description}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right",
                      r.amount.greaterThan(0) && "text-emerald-600 dark:text-emerald-400",
                      r.amount.lessThan(0) && "text-red-600 dark:text-red-400"
                    )}
                  >
                    {r.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {r.status ? <ToneBadge tone={rowTone(r)}>{r.status.replace(/_/g, " ")}</ToneBadge> : "—"}
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

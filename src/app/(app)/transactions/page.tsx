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
  searchParams: Promise<{ from?: string; to?: string; type?: string }>;
}) {
  const { from, to, type } = await searchParams;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const selectedType =
    type && (MONEY_MOVEMENT_TYPES as readonly string[]).includes(type) ? (type as MoneyMovementType) : null;

  const rows = await getUnifiedMoneyMovements({
    from: fromDate,
    to: toDate,
    types: selectedType ? [selectedType] : undefined,
  });

  const totalIn = rows.reduce((sum, r) => (r.amount.greaterThan(0) ? sum.plus(r.amount) : sum), new Decimal(0));
  const totalOut = rows.reduce((sum, r) => (r.amount.lessThan(0) ? sum.plus(r.amount.abs()) : sum), new Decimal(0));

  const baseQuery = { ...(from ? { from } : {}), ...(to ? { to } : {}) };

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
            <p className="text-xs text-muted-foreground">In</p>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{totalIn.toFixed(2)}</p>
          </div>
          <div className="rounded-md border bg-muted/30 px-4 py-2 text-right">
            <p className="text-xs text-muted-foreground">Out</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">{totalOut.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
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
              <EmptyTableRow colSpan={5} message="No money movements in range." />
            ) : (
              rows.map((r) => (
                <TableRow key={`${r.type}-${r.id}`}>
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

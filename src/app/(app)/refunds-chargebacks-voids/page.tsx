import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ToneBadge } from "@/components/ui/tone-badge";
import { statusTone, NEEDS_ATTENTION_ROW_CLASS } from "@/lib/status-tone";
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
import { DeleteRcvAction } from "../transactions/delete-rcv-action";
import { FulfillChargebackAction } from "../transactions/fulfill-chargeback-action";

export default async function RefundsChargebacksVoidsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; attention?: string }>;
}) {
  const { from, to, attention } = await searchParams;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const needsAttentionOnly = attention === "1";

  const rows = await prisma.refundChargebackVoid.findMany({
    where: {
      ...(fromDate || toDate
        ? { eventDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
        : {}),
      ...(needsAttentionOnly ? { status: { in: ["OPEN", "DISPUTED"] } } : {}),
    },
    orderBy: { eventDate: "desc" },
    take: fromDate || toDate ? undefined : 200,
    include: {
      originalTransaction: {
        select: { id: true, grossAmount: true, fpFee: true, clientNetPayable: true, client: { select: { name: true, id: true } } },
      },
    },
  });

  const [creators, closedMonths, bankAccounts] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
      select: { id: true, name: true },
    }),
    prisma.monthClose.findMany({ where: { status: "CLOSED" }, select: { accountingMonth: true } }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const creatorName = new Map(creators.map((c) => [c.id, c.name]));
  const closedMonthSet = new Set(closedMonths.map((m) => m.accountingMonth));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Refunds, Chargebacks & Voids</h1>
        <p className="text-sm text-muted-foreground">
          Every reversal is linked to its original transaction, which is left untouched. Refunds
          and chargebacks keep FoundaPay&apos;s fee as revenue; voids are excluded from revenue
          entirely.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={{
            pathname: "/refunds-chargebacks-voids",
            query: { ...(from ? { from } : {}), ...(to ? { to } : {}), ...(needsAttentionOnly ? {} : { attention: "1" }) },
          }}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {needsAttentionOnly ? "Show all" : "Needs attention only (open/disputed)"}
        </Link>
      </div>

      <DateRangeHeader from={from} to={to} reportType="rcv" />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Event Date</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Original Txn</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Original FP Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <EmptyTableRow colSpan={12} message="No refunds, chargebacks, or voids yet." />
            ) : (
              rows.map((r) => {
                const attentionRow = r.status === "OPEN" || r.status === "DISPUTED";
                return (
                <TableRow key={r.id} className={attentionRow ? NEEDS_ATTENTION_ROW_CLASS : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {attentionRow && <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />}
                      <ToneBadge tone={statusTone.rcvType(r.type)}>
                        {r.type.charAt(0) + r.type.slice(1).toLowerCase()}
                      </ToneBadge>
                    </div>
                  </TableCell>
                  <TableCell>{format(r.eventDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{r.accountingMonth}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link href="/transactions" className="hover:underline">
                      {r.originalTransactionId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/client-ledger/${r.originalTransaction.client.id}`} className="hover:underline">
                      {r.originalTransaction.client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{r.amount.toString()}</TableCell>
                  <TableCell className="text-right">{r.originalTransaction.fpFee.toString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <ToneBadge tone={statusTone.rcvStatus(r.status)}>
                        {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                      </ToneBadge>
                      {r.fulfilledAt && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          Fulfilled {format(r.fulfilledAt, "yyyy-MM-dd")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.reasonCode ?? "—"}</TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">{r.notes ?? "—"}</TableCell>
                  <TableCell>{creatorName.get(r.createdById) ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.type === "CHARGEBACK" &&
                        !r.fulfilledAt &&
                        (r.status === "OPEN" || r.status === "DISPUTED") && (
                          <FulfillChargebackAction rcvId={r.id} bankAccounts={bankAccounts} />
                        )}
                      <DeleteRcvAction id={r.id} monthOpen={!closedMonthSet.has(r.accountingMonth)} />
                    </div>
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

import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";
import { TransactionStatusBadge } from "@/components/transactions/status-badge";
import { DownloadButtons } from "@/components/exports/download-buttons";
import { ReviewActions } from "../review-actions";
import { MarkSettledAction } from "../settlement-actions";
import { BulkSettleToolbar } from "../bulk-settle-toolbar";
import { RcvActions } from "../rcv-actions";
import { EditTransactionAction } from "../edit-transaction-action";
import { TransactionHistoryAction } from "../transaction-history-action";
import { TransactionBreakdownAction } from "../transaction-breakdown-action";
import { DeleteTransactionAction } from "../delete-transaction-action";
import { HoldAction } from "../hold-action";
import { bankAccountLabel, BANK_ACCOUNT_LABEL_SELECT } from "@/lib/bank-account-label";

const PAGE_SIZE = 100;

const STATUS_OPTIONS = [
  "ENTERED",
  "SUBMITTED",
  "DETAILS_REQUESTED",
  "APPROVED",
  "PROCESSED",
  "SETTLED",
  "CLIENT_PAYABLE",
  "PARTIALLY_PAID",
  "PAID",
  "CLOSED",
  "HOLD",
  "RESERVE",
  "VOID",
  "REFUNDED",
  "CHARGEBACK",
  "DISPUTED",
  "REJECTED",
] as const;

function statusLabel(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

type SearchParams = {
  from?: string;
  to?: string;
  status?: string;
  merchantId?: string;
  clientId?: string;
  paymentMethodId?: string;
  page?: string;
};

export default async function ReceivedTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { from, to, status, merchantId, clientId, paymentMethodId } = sp;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    ...(fromDate || toDate
      ? { transactionDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {}),
    ...(status ? { status: status as never } : {}),
    ...(merchantId ? { merchantId: merchantId === "DIRECT" ? null : merchantId } : {}),
    ...(clientId ? { clientId } : {}),
    ...(paymentMethodId ? { paymentMethodId } : {}),
  };

  const [transactions, totalCount, merchants, clients, bankAccounts, paymentMethods, closedMonths] =
    await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          client: { select: { name: true } },
          merchant: { select: { name: true } },
          paymentMethod: { select: { name: true } },
          createdBy: { select: { name: true } },
          reserveHolds: { select: { direction: true } },
        },
      }),
      prisma.transaction.count({ where }),
      prisma.merchant.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          settlementBankId: true,
          defaultReservePercent: true,
          defaultReserveDirection: true,
        },
      }),
      prisma.client.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.bankAccount.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: BANK_ACCOUNT_LABEL_SELECT,
      }),
      prisma.paymentMethod.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, requiresMerchant: true },
      }),
      prisma.monthClose.findMany({ where: { status: "CLOSED" }, select: { accountingMonth: true } }),
    ]);
    const bankAccountOptions = bankAccounts.map((a) => ({ id: a.id, name: bankAccountLabel(a) }));

  const merchantOptions = merchants.map((m) => ({
    id: m.id,
    name: m.name,
    settlementBankId: m.settlementBankId,
    defaultReservePercent: m.defaultReservePercent.toString(),
    defaultReserveDirection: m.defaultReserveDirection,
  }));
  const closedMonthSet = new Set(closedMonths.map((m) => m.accountingMonth));
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const exportParams = {
    from,
    to,
    status,
    merchantId,
    clientId,
    paymentMethodId,
  };

  function pageHref(p: number) {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (status) query.set("status", status);
    if (merchantId) query.set("merchantId", merchantId);
    if (clientId) query.set("clientId", clientId);
    if (paymentMethodId) query.set("paymentMethodId", paymentMethodId);
    query.set("page", String(p));
    return `/transactions/received?${query.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Received Transactions</h1>
          <Link href="/transactions" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            ← All Transactions
          </Link>
        </div>
        <div className="flex gap-2">
          <Link href="/transactions/new" className={buttonVariants({})}>
            + New Transaction
          </Link>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Client-received transactions only -- review, approve, hold, refund/chargeback, and edit
        here. For every money movement in one place, see{" "}
        <Link href="/transactions" className="underline">
          Transactions
        </Link>
        .
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border p-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="to" className="text-xs text-muted-foreground">
              To
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className="text-xs text-muted-foreground">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ""}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="merchantId" className="text-xs text-muted-foreground">
              Merchant
            </label>
            <select
              id="merchantId"
              name="merchantId"
              defaultValue={merchantId ?? ""}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">All merchants</option>
              <option value="DIRECT">Direct (no merchant)</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="clientId" className="text-xs text-muted-foreground">
              Client
            </label>
            <select
              id="clientId"
              name="clientId"
              defaultValue={clientId ?? ""}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="paymentMethodId" className="text-xs text-muted-foreground">
              Method
            </label>
            <select
              id="paymentMethodId"
              name="paymentMethodId"
              defaultValue={paymentMethodId ?? ""}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">All methods</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted">
            Filter
          </button>
          {(from || to || status || merchantId || clientId || paymentMethodId) && (
            <Link href="/transactions/received" className="h-8 px-3 text-sm text-muted-foreground underline self-center">
              Clear
            </Link>
          )}
        </form>
        <DownloadButtons reportType="transactions" params={exportParams} />
      </div>

      <BulkSettleToolbar merchants={merchantOptions} />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Submitted by</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead>Fee Basis</TableHead>
              <TableHead className="text-right">Net Amount Received</TableHead>
              <TableHead className="text-right">FP Rate</TableHead>
              <TableHead className="text-right">FP Fee</TableHead>
              <TableHead className="text-right">Merchant Fee</TableHead>
              <TableHead className="text-right">Merchant Reserve</TableHead>
              <TableHead className="text-right">FP Reserve</TableHead>
              <TableHead className="text-right">Expected Settlement</TableHead>
              <TableHead className="text-right">Client Net Payable</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Settled Date</TableHead>
              <TableHead>Review note</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <EmptyTableRow colSpan={20} message="No transactions match these filters." />
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.id}</TableCell>
                  <TableCell>{format(t.transactionDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{t.client.name}</TableCell>
                  <TableCell>{t.merchant?.name ?? "Direct"}</TableCell>
                  <TableCell>{t.paymentMethod.name}</TableCell>
                  <TableCell>{t.createdBy.name}</TableCell>
                  <TableCell className="text-right">{t.grossAmount.toString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.feeBasis === "AFTER_MERCHANT_CHARGES" ? "Net" : "Gross"}
                  </TableCell>
                  <TableCell className="text-right">{t.netAmountReceived.toString()}</TableCell>
                  <TableCell className="text-right">
                    {t.chargeType === "FIXED"
                      ? "Fixed"
                      : t.chargeType === "NONE"
                        ? "No charge"
                        : `${t.fpRatePercent.toString()}%`}
                  </TableCell>
                  <TableCell className="text-right">{t.fpFee.toString()}</TableCell>
                  <TableCell className="text-right">{t.merchantFee.toString()}</TableCell>
                  <TableCell className="text-right">{t.merchantReserveAmount.toString()}</TableCell>
                  <TableCell className="text-right">{t.fpReserveAmount.toString()}</TableCell>
                  <TableCell className="text-right">{t.expectedSettlement.toString()}</TableCell>
                  <TableCell className="text-right">
                    {t.clientNetPayable?.toString() ?? "—"}
                  </TableCell>
                  <TableCell>
                    <TransactionStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell>
                    {t.settlementDate ? format(t.settlementDate, "yyyy-MM-dd") : "—"}
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    {t.reviewNotes ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <ReviewActions id={t.id} status={t.status} />
                      <MarkSettledAction id={t.id} status={t.status} />
                      <HoldAction id={t.id} status={t.status} />
                      <RcvActions id={t.id} status={t.status} />
                      <TransactionBreakdownAction
                        transaction={{
                          id: t.id,
                          grossAmount: t.grossAmount.toString(),
                          feeBasis: t.feeBasis,
                          netAmountReceived: t.netAmountReceived.toString(),
                          fpRatePercent: t.fpRatePercent.toString(),
                          chargeType: t.chargeType,
                          fpFee: t.fpFee.toString(),
                          merchantFee: t.merchantFee.toString(),
                          feeBearer: t.feeBearer,
                          merchantReservePercent: t.merchantReservePercent.toString(),
                          merchantReserveBasis: t.merchantReserveBasis,
                          merchantReserveAmount: t.merchantReserveAmount.toString(),
                          fpReservePercent: t.fpReservePercent.toString(),
                          fpReserveAmount: t.fpReserveAmount.toString(),
                          clientNetPayable: t.clientNetPayable?.toString() ?? null,
                        }}
                      />
                      <EditTransactionAction
                        row={{
                          id: t.id,
                          transactionDate: t.transactionDate.toISOString(),
                          clientId: t.clientId,
                          clientReference: t.clientReference,
                          merchantId: t.merchantId,
                          expectedBankId: t.expectedBankId,
                          paymentMethodId: t.paymentMethodId,
                          grossAmount: t.grossAmount.toString(),
                          feeBasis: t.feeBasis,
                          chargeType: t.chargeType,
                          fixedChargeAmount: t.fixedChargeAmount?.toString() ?? null,
                          feeBearer: t.feeBearer,
                          merchantFeeManual: t.merchantFeeManual?.toString() ?? null,
                          merchantReservePercent: t.merchantReservePercent.toString(),
                          merchantReserveBasis: t.merchantReserveBasis,
                          merchantReserveDirection:
                            t.reserveHolds.find((h) => h.direction !== "FP_OWN")?.direction ?? "CLIENT_HELD",
                          fpReservePercent: t.fpReservePercent.toString(),
                          documentUrl: t.documentUrl,
                          notes: t.notes,
                          customerEmail: t.customerEmail,
                          cardLast4: t.cardLast4,
                        }}
                        monthOpen={!closedMonthSet.has(t.accountingMonth)}
                        clients={clients}
                        merchants={merchantOptions}
                        bankAccounts={bankAccountOptions}
                        paymentMethods={paymentMethods}
                      />
                      <TransactionHistoryAction id={t.id} />
                      <DeleteTransactionAction
                        id={t.id}
                        monthOpen={!closedMonthSet.has(t.accountingMonth)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalCount === 0
            ? "No transactions"
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount}`}
        </span>
        <div className="flex items-center gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="rounded-lg border border-input px-3 py-1.5 hover:bg-muted">
              Previous
            </Link>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="rounded-lg border border-input px-3 py-1.5 hover:bg-muted">
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

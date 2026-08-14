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
import { ReviewActions } from "./review-actions";
import { MarkSettledAction } from "./settlement-actions";
import { BulkSettleToolbar } from "./bulk-settle-toolbar";
import { RcvActions } from "./rcv-actions";
import { EditTransactionAction } from "./edit-transaction-action";
import { TransactionHistoryAction } from "./transaction-history-action";

export default async function TransactionsPage() {
  const [transactions, merchants, clients, bankAccounts, paymentMethods, closedMonths] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        client: { select: { name: true } },
        merchant: { select: { name: true } },
        paymentMethod: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.merchant.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, settlementBankId: true, defaultReservePercent: true },
    }),
    prisma.client.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.paymentMethod.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.monthClose.findMany({ where: { status: "CLOSED" }, select: { accountingMonth: true } }),
  ]);

  const merchantOptions = merchants.map((m) => ({
    id: m.id,
    name: m.name,
    settlementBankId: m.settlementBankId,
    defaultReservePercent: m.defaultReservePercent.toString(),
  }));
  const closedMonthSet = new Set(closedMonths.map((m) => m.accountingMonth));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <Link href="/transactions/new" className={buttonVariants({})}>
          New Transaction
        </Link>
      </div>

      <BulkSettleToolbar merchants={merchants} />

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
              <EmptyTableRow colSpan={18} message="No transactions yet." />
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.id}</TableCell>
                  <TableCell>{format(t.transactionDate, "yyyy-MM-dd")}</TableCell>
                  <TableCell>{t.client.name}</TableCell>
                  <TableCell>{t.merchant.name}</TableCell>
                  <TableCell>{t.paymentMethod.name}</TableCell>
                  <TableCell>{t.createdBy.name}</TableCell>
                  <TableCell className="text-right">{t.grossAmount.toString()}</TableCell>
                  <TableCell className="text-right">{t.fpRatePercent.toString()}%</TableCell>
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
                      <RcvActions id={t.id} status={t.status} />
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
                          feeBearer: t.feeBearer,
                          merchantFeeManual: t.merchantFeeManual?.toString() ?? null,
                          merchantReservePercent: t.merchantReservePercent.toString(),
                          fpReservePercent: t.fpReservePercent.toString(),
                          documentUrl: t.documentUrl,
                          notes: t.notes,
                          customerEmail: t.customerEmail,
                          cardLast4: t.cardLast4,
                        }}
                        monthOpen={!closedMonthSet.has(t.accountingMonth)}
                        clients={clients}
                        merchants={merchantOptions}
                        bankAccounts={bankAccounts}
                        paymentMethods={paymentMethods}
                      />
                      <TransactionHistoryAction id={t.id} />
                    </div>
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

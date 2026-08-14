import Link from "next/link";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { calculatePnl } from "@/lib/statements/pnl";
import type { TransactionStatus } from "@/generated/prisma/client";

const REVENUE_STATUSES_EXCLUDED: TransactionStatus[] = [
  "ENTERED",
  "SUBMITTED",
  "DETAILS_REQUESTED",
  "REJECTED",
];

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`text-2xl font-semibold ${
            tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export async function OwnerDashboard({ accountingMonth }: { accountingMonth: string }) {
  const [
    bankAccounts,
    grossVolumeAgg,
    pnl,
    clientBalances,
    merchantPending,
    reserveAgg,
    epLedgerAgg,
    partnerLedgerAgg,
    bonusPoolAgg,
    diffBatches,
  ] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { active: true },
      include: { ledgerEntries: { select: { usdValue: true } } },
    }),
    prisma.transaction.aggregate({
      where: { accountingMonth, status: { notIn: REVENUE_STATUSES_EXCLUDED } },
      _sum: { grossAmount: true },
    }),
    calculatePnl(accountingMonth, { level: "consolidated" }),
    prisma.clientLedger.groupBy({ by: ["clientId"], _sum: { amount: true } }),
    prisma.transaction.aggregate({
      where: { status: "APPROVED", settlementBatchId: null },
      _sum: { expectedSettlement: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { accountingMonth, status: { notIn: REVENUE_STATUSES_EXCLUDED } },
      _sum: { merchantReserveAmount: true, fpReserveAmount: true },
    }),
    prisma.employeePartnerLedger.aggregate({ _sum: { amount: true } }),
    prisma.partnerLedger.aggregate({ _sum: { amount: true } }),
    prisma.bonusPoolLedger.aggregate({ _sum: { amount: true } }),
    prisma.settlementBatch.count({ where: { status: "DIFFERENCE" } }),
  ]);

  const cashTotal = bankAccounts.reduce(
    (sum, a) =>
      sum.plus(
        a.ledgerEntries.reduce((s, e) => s.plus(e.usdValue), new Decimal(a.openingBalance))
      ),
    new Decimal(0)
  );

  const clientReceivable = clientBalances
    .filter((b) => Number(b._sum.amount ?? 0) > 0)
    .reduce((sum, b) => sum.plus(b._sum.amount ?? 0), new Decimal(0));
  const clientPayable = clientBalances
    .filter((b) => Number(b._sum.amount ?? 0) < 0)
    .reduce((sum, b) => sum.plus(b._sum.amount ?? 0), new Decimal(0))
    .abs();

  const merchantPendingCount = merchantPending._count;
  const merchantPendingTotal = new Decimal(merchantPending._sum.expectedSettlement ?? 0);

  const reserves = new Decimal(reserveAgg._sum?.merchantReserveAmount ?? 0).plus(
    reserveAgg._sum?.fpReserveAmount ?? 0
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cash Position (USD)" value={cashTotal.toFixed(2)} />
        <StatCard label="Gross Volume (this month)" value={new Decimal(grossVolumeAgg._sum?.grossAmount ?? 0).toFixed(2)} />
        <StatCard label="FP Revenue (this month)" value={pnl.revenue.toFixed(2)} />
        <StatCard
          label="Net Profit (this month)"
          value={pnl.netProfit.toFixed(2)}
          tone={pnl.netProfit.isNegative() ? "negative" : "positive"}
        />
        <StatCard label="Client Receivable (FP owes)" value={clientReceivable.toFixed(2)} tone="positive" />
        <StatCard label="Client Payable (owes FP)" value={clientPayable.toFixed(2)} tone="negative" />
        <StatCard
          label="Merchant Pending Settlement"
          value={`${merchantPendingTotal.toFixed(2)} (${merchantPendingCount})`}
        />
        <StatCard label="Reserves Held (this month)" value={reserves.toFixed(2)} />
        <StatCard label="Employee Partner Payable" value={new Decimal(epLedgerAgg._sum.amount ?? 0).toFixed(2)} />
        <StatCard label="Partner Equity (total)" value={new Decimal(partnerLedgerAgg._sum.amount ?? 0).toFixed(2)} />
        <StatCard label="Bonus Pool" value={new Decimal(bonusPoolAgg._sum.amount ?? 0).toFixed(2)} />
        <StatCard
          label="Settlement Batches w/ Difference"
          value={String(diffBatches)}
          tone={diffBatches > 0 ? "negative" : undefined}
        />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/client-ledger" className="text-muted-foreground hover:text-foreground hover:underline">
          View Client Ledger
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/partner-ledger" className="text-muted-foreground hover:text-foreground hover:underline">
          View Partner Ledger
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/cash-position" className="text-muted-foreground hover:text-foreground hover:underline">
          View Cash Position
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/merchant-reconciliation" className="text-muted-foreground hover:text-foreground hover:underline">
          View Merchant Reconciliation
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import Decimal from "decimal.js";
import { format, addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function StatCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <Card className={href ? "transition-colors hover:bg-muted/40" : undefined}>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export async function AccountantDashboard({ accountingMonth }: { accountingMonth: string }) {
  const [
    pendingApprovals,
    awaitingSettlement,
    settlementDiffs,
    negativeClientBalances,
    upcomingSubscriptions,
    monthClose,
    epLedgerAgg,
    recentReconciliations,
    outstandingRcvAgg,
  ] = await Promise.all([
    prisma.transaction.count({ where: { status: { in: ["SUBMITTED", "DETAILS_REQUESTED"] } } }),
    prisma.transaction.aggregate({
      where: { status: "APPROVED", settlementBatchId: null },
      _sum: { expectedSettlement: true },
      _count: true,
    }),
    prisma.settlementBatch.count({ where: { status: "DIFFERENCE" } }),
    prisma.clientLedger.groupBy({ by: ["clientId"], _sum: { amount: true } }),
    prisma.vendorSubscription.findMany({
      where: { status: "ACTIVE", nextBillingDate: { lte: addDays(new Date(), 14) } },
      include: { vendor: { select: { name: true } } },
      orderBy: { nextBillingDate: "asc" },
    }),
    prisma.monthClose.findUnique({ where: { accountingMonth } }),
    prisma.employeePartnerLedger.aggregate({ _sum: { amount: true } }),
    prisma.bankReconciliation.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { bankAccount: { select: { name: true } } },
    }),
    prisma.refundChargebackVoid.aggregate({
      where: { status: "OPEN" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const negativeClients = negativeClientBalances.filter((b) => Number(b._sum.amount ?? 0) < 0);
  const checklist = (monthClose?.checklist as
    | { payrollRun?: boolean; epCommissionsRun?: boolean; partnerDistributionRun?: boolean }
    | null) ?? {};
  const stepsDone = [checklist.payrollRun, checklist.epCommissionsRun, checklist.partnerDistributionRun].filter(
    Boolean
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending Approvals" value={String(pendingApprovals)} href="/transactions" />
        <StatCard
          label="Awaiting Settlement"
          value={`${new Decimal(awaitingSettlement._sum.expectedSettlement ?? 0).toFixed(2)} (${awaitingSettlement._count})`}
          href="/settlements/new"
        />
        <StatCard label="Settlement Differences" value={String(settlementDiffs)} href="/merchant-reconciliation" />
        <StatCard label="Negative Client Balances" value={String(negativeClients.length)} href="/client-ledger" />
        <StatCard label="EP Commission Payable" value={new Decimal(epLedgerAgg._sum.amount ?? 0).toFixed(2)} href="/employee-partner-ledger" />
        <StatCard
          label={`Month Close Progress (${accountingMonth})`}
          value={`${stepsDone} / 3`}
          href="/distributions"
        />
        <StatCard
          label="Chargebacks/Refunds Outstanding"
          value={`${new Decimal(outstandingRcvAgg._sum.amount ?? 0).toFixed(2)} (${outstandingRcvAgg._count})`}
          href="/refunds-chargebacks-voids"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Subscriptions (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingSubscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due soon.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {upcomingSubscriptions.map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span>
                      {s.vendor.name} — {s.name}
                    </span>
                    <span className="text-muted-foreground">
                      {s.nextBillingDate ? format(s.nextBillingDate, "yyyy-MM-dd") : "—"} · {s.amount.toString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Reconciliations</CardTitle>
          </CardHeader>
          <CardContent>
            {recentReconciliations.length === 0 ? (
              <p className="text-sm text-muted-foreground">None recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recentReconciliations.map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    <span>{r.bankAccount.name}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {format(r.asOfDate, "yyyy-MM-dd")}
                      <Badge variant={Number(r.differenceAmount) !== 0 ? "destructive" : "default"}>
                        {r.differenceAmount.toString()}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

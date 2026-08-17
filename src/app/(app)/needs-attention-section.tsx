import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function NeedsAttentionSection() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const [unreconciledSettlements, pendingApprovals, outstandingChargebacks, negativeBalances, dueReminders] =
    await Promise.all([
      prisma.settlementBatch.count({ where: { status: { not: "RECONCILED" } } }),
      prisma.transaction.count({ where: { status: { in: ["SUBMITTED", "DETAILS_REQUESTED"] } } }),
      prisma.refundChargebackVoid.count({
        where: { type: "CHARGEBACK", status: { in: ["OPEN", "DISPUTED"] } },
      }),
      prisma.clientLedger
        .groupBy({ by: ["clientId"], _sum: { amount: true } })
        .then((rows) => rows.filter((r) => Number(r._sum.amount ?? 0) < 0).length),
      prisma.reminder.count({ where: { status: "OPEN", dueDate: { lte: today } } }),
    ]);

  const items = [
    {
      label: "Unreconciled settlements",
      count: unreconciledSettlements,
      href: "/settlements?attention=1",
    },
    {
      label: "Pending approvals",
      count: pendingApprovals,
      href: "/transactions",
    },
    {
      label: "Outstanding chargebacks",
      count: outstandingChargebacks,
      href: "/refunds-chargebacks-voids?attention=1",
    },
    {
      label: "Negative client balances",
      count: negativeBalances,
      href: "/client-ledger?attention=1",
    },
    {
      label: "Reminders due/overdue",
      count: dueReminders,
      href: "/reminders",
    },
  ];

  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (total === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          Needs Attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-md border p-3 transition-colors hover:bg-muted/50 ${
                item.count > 0 ? "border-amber-200 dark:border-amber-500/30" : ""
              }`}
            >
              <p
                className={`text-2xl font-semibold ${
                  item.count > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                }`}
              >
                {item.count}
              </p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

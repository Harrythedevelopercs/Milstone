import Link from "next/link";
import { format, differenceInCalendarDays } from "date-fns";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { ToneBadge } from "@/components/ui/tone-badge";
import { SetReminderButton } from "./set-reminder-button";

// Money already reversed/never-realized never counts as "stuck."
const EXCLUDE_STATUSES = ["VOID", "REFUNDED", "CHARGEBACK", "REJECTED"];

export default async function MerchantHoldsPage() {
  const merchants = await prisma.merchant.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      transactions: {
        where: {
          OR: [
            { status: "HOLD" },
            { merchantReserveAmount: { gt: 0 }, status: { notIn: EXCLUDE_STATUSES as never[] } },
          ],
        },
        include: {
          client: { select: { name: true } },
          reminders: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { transactionDate: "asc" },
      },
    },
  });

  const today = new Date();
  const merchantRows = merchants
    .map((m) => {
      const items = m.transactions.map((t) => {
        const isHeld = t.status === "HOLD";
        const amount = isHeld ? new Decimal(t.expectedSettlement ?? 0) : new Decimal(t.merchantReserveAmount);
        return {
          transactionId: t.id,
          clientName: t.client.name,
          kind: isHeld ? ("HELD" as const) : ("RESERVED" as const),
          amount,
          since: isHeld ? t.updatedAt : t.transactionDate,
          reminder: t.reminders[0] ?? null,
        };
      });
      const total = items.reduce((sum, i) => sum.plus(i.amount), new Decimal(0));
      return { id: m.id, name: m.name, items, total };
    })
    .filter((m) => m.items.length > 0);

  const grandTotal = merchantRows.reduce((sum, m) => sum.plus(m.total), new Decimal(0));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Merchant Hold / Reserve Report</h1>
        <p className="text-sm text-muted-foreground">
          Every held or reserved amount, per merchant, with how long it&apos;s been stuck. Set a
          reminder for an expected payout date and it&apos;ll show up in Reminders and on the
          Dashboard.
        </p>
      </div>

      <div className="rounded-md border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">Total held + reserved across all merchants</p>
        <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
          {grandTotal.toFixed(2)}
        </p>
      </div>

      {merchantRows.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          Nothing held or reserved right now.
        </div>
      ) : (
        merchantRows.map((m) => (
          <div key={m.id} className="rounded-md border">
            <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
              <h2 className="font-medium">{m.name}</h2>
              <span className="text-sm font-medium">{m.total.toFixed(2)}</span>
            </div>
            <div className="divide-y">
              {m.items.map((item) => {
                const daysStuck = differenceInCalendarDays(today, item.since);
                return (
                  <div key={item.transactionId} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link href="/transactions" className="font-mono text-xs hover:underline">
                          {item.transactionId}
                        </Link>
                        <ToneBadge tone={item.kind === "HELD" ? "danger" : "warning"}>
                          {item.kind === "HELD" ? "Held" : "Reserved"}
                        </ToneBadge>
                        <span className="text-muted-foreground">{item.clientName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.amount.toFixed(2)} — stuck since {format(item.since, "yyyy-MM-dd")} ({daysStuck} day{daysStuck === 1 ? "" : "s"})
                        {item.reminder && ` — reminder set for ${format(item.reminder.dueDate, "yyyy-MM-dd")}`}
                      </p>
                    </div>
                    {!item.reminder && (
                      <SetReminderButton
                        transactionId={item.transactionId}
                        defaultTitle={`Expected payout: ${item.transactionId} (${m.name})`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

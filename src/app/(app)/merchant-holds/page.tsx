import Link from "next/link";
import { format, differenceInCalendarDays } from "date-fns";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { ToneBadge } from "@/components/ui/tone-badge";
import { bankAccountLabel, BANK_ACCOUNT_LABEL_SELECT } from "@/lib/bank-account-label";
import { SetReminderButton } from "./set-reminder-button";
import { ReserveHoldActions } from "./reserve-hold-actions";

// Money already reversed/never-realized never counts as "stuck."
const EXCLUDE_STATUSES = ["VOID", "REFUNDED", "CHARGEBACK", "REJECTED"];

export default async function MerchantHoldsPage() {
  const [merchants, reserveHolds, bankAccounts] = await Promise.all([
    prisma.merchant.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        transactions: {
          where: { status: "HOLD" },
          include: {
            client: { select: { name: true } },
            reminders: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { transactionDate: "asc" },
        },
      },
    }),
    prisma.reserveHold.findMany({
      include: {
        transaction: {
          select: {
            id: true,
            clientId: true,
            client: { select: { name: true } },
            reminders: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        merchant: { select: { id: true, name: true } },
        actions: true,
      },
      orderBy: { heldSince: "asc" },
    }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: BANK_ACCOUNT_LABEL_SELECT,
    }),
  ]);

  const today = new Date();

  // Held (status = HOLD): a separate, older lifecycle-status feature --
  // settlement is simply delayed, nothing has been withheld as a reserve.
  const merchantRows = merchants
    .map((m) => {
      const items = m.transactions.map((t) => ({
        transactionId: t.id,
        clientName: t.client.name,
        amount: new Decimal(t.expectedSettlement ?? 0),
        since: t.updatedAt,
        reminder: t.reminders[0] ?? null,
      }));
      const total = items.reduce((sum, i) => sum.plus(i.amount), new Decimal(0));
      return { id: m.id, name: m.name, items, total };
    })
    .filter((m) => m.items.length > 0);
  const heldTotal = merchantRows.reduce((sum, m) => sum.plus(m.total), new Decimal(0));

  // Reserves: money withheld by a processor/merchant (or retained by FP)
  // out of a transaction's settlement -- a tracked receivable, never
  // auto-consumed by a chargeback, resolved only via manual action.
  const reserveRows = reserveHolds
    .map((h) => {
      const used = h.actions.reduce((sum, a) => sum.plus(a.amount), new Decimal(0));
      const remaining = new Decimal(h.originalAmount).minus(used);
      return {
        id: h.id,
        transactionId: h.transactionId,
        clientId: h.transaction.clientId,
        clientName: h.transaction.client.name,
        merchantId: h.merchantId,
        merchantName: h.merchant?.name ?? "Direct / No Merchant",
        owner: h.owner,
        remaining,
        since: h.heldSince,
        reminder: h.transaction.reminders[0] ?? null,
      };
    })
    .filter((r) => r.remaining.greaterThan(0));

  const chargebacks = reserveRows.length
    ? await prisma.refundChargebackVoid.findMany({
        where: {
          type: "CHARGEBACK",
          originalTransactionId: { in: reserveRows.map((r) => r.transactionId) },
        },
        select: { id: true, originalTransactionId: true, amount: true, status: true, eventDate: true },
      })
    : [];
  const chargebacksByTxn = new Map<string, { id: string; label: string }[]>();
  for (const c of chargebacks) {
    const list = chargebacksByTxn.get(c.originalTransactionId) ?? [];
    list.push({
      id: c.id,
      label: `${format(c.eventDate, "yyyy-MM-dd")} -- ${c.amount.toString()} (${c.status.toLowerCase()})`,
    });
    chargebacksByTxn.set(c.originalTransactionId, list);
  }

  const reserveGroups = new Map<string, typeof reserveRows>();
  for (const r of reserveRows) {
    const key = r.merchantId ?? "__direct__";
    const list = reserveGroups.get(key) ?? [];
    list.push(r);
    reserveGroups.set(key, list);
  }
  const reserveTotal = reserveRows.reduce((sum, r) => sum.plus(r.remaining), new Decimal(0));
  const clientOwnedTotal = reserveRows
    .filter((r) => r.owner === "CLIENT")
    .reduce((sum, r) => sum.plus(r.remaining), new Decimal(0));
  const fpOwnedTotal = reserveRows
    .filter((r) => r.owner === "FOUNDAPAY")
    .reduce((sum, r) => sum.plus(r.remaining), new Decimal(0));

  const bankAccountOptions = bankAccounts.map((a) => ({ id: a.id, name: bankAccountLabel(a) }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Merchant Hold / Reserve Report</h1>
        <p className="text-sm text-muted-foreground">
          Everything held or reserved, per merchant, with how long it&apos;s been stuck. Set a
          reminder for an expected release/payout date and it&apos;ll show up in Reminders and on
          the Dashboard.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Held (settlement delayed)</h2>
          <div className="rounded-md border bg-muted/30 px-4 py-2 text-right">
            <p className="text-xs text-muted-foreground">Total held</p>
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{heldTotal.toFixed(2)}</p>
          </div>
        </div>
        {merchantRows.length === 0 ? (
          <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
            Nothing held right now.
          </div>
        ) : (
          merchantRows.map((m) => (
            <div key={m.id} className="rounded-md border">
              <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
                <h3 className="font-medium">{m.name}</h3>
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
                          <ToneBadge tone="danger">Held</ToneBadge>
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
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Reserves (receivable, not yet released)</h2>
          <div className="flex gap-3">
            <div className="rounded-md border bg-muted/30 px-4 py-2 text-right">
              <p className="text-xs text-muted-foreground">Client-owned</p>
              <p className="text-lg font-semibold">{clientOwnedTotal.toFixed(2)}</p>
            </div>
            <div className="rounded-md border bg-muted/30 px-4 py-2 text-right">
              <p className="text-xs text-muted-foreground">FoundaPay-owned</p>
              <p className="text-lg font-semibold">{fpOwnedTotal.toFixed(2)}</p>
            </div>
            <div className="rounded-md border bg-muted/30 px-4 py-2 text-right">
              <p className="text-xs text-muted-foreground">Total reserves</p>
              <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{reserveTotal.toFixed(2)}</p>
            </div>
          </div>
        </div>
        {reserveRows.length === 0 ? (
          <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
            Nothing reserved right now.
          </div>
        ) : (
          Array.from(reserveGroups.entries()).map(([key, rows]) => {
            const groupTotal = rows.reduce((sum, r) => sum.plus(r.remaining), new Decimal(0));
            return (
              <div key={key} className="rounded-md border">
                <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
                  <h3 className="font-medium">{rows[0].merchantName}</h3>
                  <span className="text-sm font-medium">{groupTotal.toFixed(2)}</span>
                </div>
                <div className="divide-y">
                  {rows.map((r) => {
                    const daysStuck = differenceInCalendarDays(today, r.since);
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link href="/transactions" className="font-mono text-xs hover:underline">
                              {r.transactionId}
                            </Link>
                            <ToneBadge tone="warning">Reserved</ToneBadge>
                            <ToneBadge tone={r.owner === "CLIENT" ? "success" : "neutral"}>
                              {r.owner === "CLIENT" ? "Client-owned" : "FoundaPay-owned"}
                            </ToneBadge>
                            <span className="text-muted-foreground">{r.clientName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {r.remaining.toFixed(2)} remaining — held since {format(r.since, "yyyy-MM-dd")} ({daysStuck} day{daysStuck === 1 ? "" : "s"})
                            {r.reminder && ` — reminder set for ${format(r.reminder.dueDate, "yyyy-MM-dd")}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!r.reminder && (
                            <SetReminderButton
                              transactionId={r.transactionId}
                              defaultTitle={`Expected reserve release: ${r.transactionId} (${r.merchantName})`}
                            />
                          )}
                          <ReserveHoldActions
                            reserveHoldId={r.id}
                            owner={r.owner}
                            remaining={r.remaining.toFixed(2)}
                            bankAccounts={bankAccountOptions}
                            chargebacks={chargebacksByTxn.get(r.transactionId) ?? []}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

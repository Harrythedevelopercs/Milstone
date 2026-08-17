import Link from "next/link";
import { format, differenceInCalendarDays, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { ToneBadge } from "@/components/ui/tone-badge";
import type { StatusTone } from "@/lib/status-tone";
import { NewReminderButton } from "./new-reminder-button";
import { ReminderActions } from "./reminder-actions";

function dueTone(days: number): StatusTone {
  if (days < 0) return "danger";
  if (days <= 2) return "warning";
  return "neutral";
}

function dueLabel(days: number): string {
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; status?: string }>;
}) {
  const { view = "list", month, status = "OPEN" } = await searchParams;
  const isCalendar = view === "calendar";

  const reminders = await prisma.reminder.findMany({
    where: status === "ALL" ? {} : { status: status as never },
    orderBy: { dueDate: "asc" },
    include: {
      transaction: {
        select: { id: true, client: { select: { name: true } }, grossAmount: true, status: true },
      },
    },
  });

  const today = new Date();

  if (isCalendar) {
    const monthStart = month && /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T00:00:00.000Z`) : startOfMonth(today);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(endOfMonth(monthStart));
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const remindersByDay = new Map<string, typeof reminders>();
    for (const r of reminders) {
      const key = format(r.dueDate, "yyyy-MM-dd");
      remindersByDay.set(key, [...(remindersByDay.get(key) ?? []), r]);
    }
    const prevMonth = format(addMonths(monthStart, -1), "yyyy-MM");
    const nextMonth = format(addMonths(monthStart, 1), "yyyy-MM");

    return (
      <div className="space-y-4">
        <ReminderHeader status={status} view={view} />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{format(monthStart, "MMMM yyyy")}</h2>
          <div className="flex gap-2">
            <Link href={`/reminders?view=calendar&month=${prevMonth}&status=${status}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Previous
            </Link>
            <Link href={`/reminders?view=calendar&month=${nextMonth}&status=${status}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Next
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-muted/40 px-2 py-1 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayReminders = remindersByDay.get(key) ?? [];
            return (
              <div
                key={key}
                className={`min-h-24 space-y-1 bg-background p-1.5 text-xs ${
                  !isSameMonth(day, monthStart) ? "opacity-40" : ""
                } ${isSameDay(day, today) ? "ring-1 ring-inset ring-primary" : ""}`}
              >
                <div className="text-right text-muted-foreground">{format(day, "d")}</div>
                {dayReminders.map((r) => (
                  <div key={r.id} className="truncate rounded bg-amber-100 px-1 py-0.5 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300" title={r.title}>
                    {r.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const sorted = [...reminders].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime()
  );

  return (
    <div className="space-y-4">
      <ReminderHeader status={status} view={view} />
      <div className="divide-y rounded-md border">
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No reminders.</div>
        ) : (
          sorted.map((r) => {
            const days = differenceInCalendarDays(r.dueDate, today);
            return (
              <div key={r.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.title}</span>
                    {r.status === "OPEN" ? (
                      <ToneBadge tone={dueTone(days)}>{dueLabel(days)}</ToneBadge>
                    ) : (
                      <ToneBadge tone="neutral">{r.status === "DONE" ? "Done" : "Dismissed"}</ToneBadge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(r.dueDate, "yyyy-MM-dd")}
                    {r.transaction && (
                      <>
                        {" — "}
                        <Link href="/transactions/received" className="hover:underline">
                          {r.transaction.id}
                        </Link>{" "}
                        ({r.transaction.client.name}, {r.transaction.grossAmount.toString()})
                      </>
                    )}
                    {r.note && ` — ${r.note}`}
                  </p>
                </div>
                {r.status === "OPEN" && <ReminderActions id={r.id} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ReminderHeader({ status, view }: { status: string; view: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">Reminders</h1>
        <p className="text-sm text-muted-foreground">
          Hold follow-ups and custom reminders, all in one place.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/reminders?view=list&status=${status}`}
          className={buttonVariants({ variant: view === "list" ? "default" : "outline", size: "sm" })}
        >
          List
        </Link>
        <Link
          href={`/reminders?view=calendar&status=${status}`}
          className={buttonVariants({ variant: view === "calendar" ? "default" : "outline", size: "sm" })}
        >
          Calendar
        </Link>
        <Link
          href={`/reminders?view=${view}&status=${status === "OPEN" ? "ALL" : "OPEN"}`}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {status === "OPEN" ? "Show all" : "Show open only"}
        </Link>
        <NewReminderButton />
      </div>
    </div>
  );
}

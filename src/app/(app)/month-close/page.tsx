import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { computeChecklistItems } from "@/lib/month-close/checklist";
import { MonthPickerHeader, currentAccountingMonthFrom } from "@/components/month-picker-header";
import { ChecklistPanel } from "./checklist-panel";

export default async function MonthClosePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month } = await searchParams;
  const accountingMonth = currentAccountingMonthFrom(month, (d) => format(d, "yyyy-MM"));

  const [items, monthClose] = await Promise.all([
    computeChecklistItems(accountingMonth),
    prisma.monthClose.findUnique({
      where: { accountingMonth },
      include: { closedBy: { select: { name: true } }, reopenedBy: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <MonthPickerHeader title="Month Close" accountingMonth={accountingMonth} />
      <ChecklistPanel
        accountingMonth={accountingMonth}
        items={items}
        status={monthClose?.status ?? "OPEN"}
        canReopen={user.role === "OWNER"}
        closedInfo={
          monthClose?.status === "CLOSED" && monthClose.closedBy && monthClose.closedAt
            ? { by: monthClose.closedBy.name, at: format(monthClose.closedAt, "yyyy-MM-dd HH:mm") }
            : null
        }
        reopenedInfo={
          monthClose?.status === "REOPENED" && monthClose.reopenedBy && monthClose.reopenedAt
            ? {
                by: monthClose.reopenedBy.name,
                at: format(monthClose.reopenedAt, "yyyy-MM-dd HH:mm"),
                reason: monthClose.reopenReason ?? "",
              }
            : null
        }
      />
    </div>
  );
}

import { format } from "date-fns";
import { requireUser } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnerDashboard } from "./owner-dashboard";
import { AccountantDashboard } from "./accountant-dashboard";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month } = await searchParams;
  const accountingMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), "yyyy-MM");

  if (user.role === "EMPLOYEE") {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use &quot;Submit Transaction&quot; above to enter new transactions and check on your submissions.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold">
          {user.role === "OWNER" ? "Management Dashboard" : "Accountant Dashboard"}
        </h1>
        <form method="get" className="flex items-center gap-2">
          <label htmlFor="month" className="text-sm text-muted-foreground">
            Month
          </label>
          <input
            id="month"
            name="month"
            type="month"
            defaultValue={accountingMonth}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          />
          <button type="submit" className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted">
            Go
          </button>
        </form>
      </div>

      {user.role === "OWNER" ? (
        <OwnerDashboard accountingMonth={accountingMonth} />
      ) : (
        <AccountantDashboard accountingMonth={accountingMonth} />
      )}
    </div>
  );
}

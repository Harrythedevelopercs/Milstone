import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  calculateEmployeePartnerRevenue,
  calculateMonthExpenses,
  calculateMonthRevenue,
  calculateMonthSalariesPosted,
  getBonusPoolPercent,
} from "@/lib/payroll/calculations";
import {
  RunPayrollPanel,
  RunEpCommissionsPanel,
  RunPartnerDistributionPanel,
} from "./run-panels";

export default async function DistributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const accountingMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), "yyyy-MM");

  const [monthClose, bankAccounts, employeesWithSalary, employeePartners, revenue, expenses, salaries, bonusPoolPercent] =
    await Promise.all([
      prisma.monthClose.findUnique({ where: { accountingMonth } }),
      prisma.bankAccount.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.employee.findMany({ where: { status: "ACTIVE", salary: { gt: 0 } } }),
      prisma.employee.findMany({ where: { isEmployeePartner: true, status: "ACTIVE" } }),
      calculateMonthRevenue(accountingMonth),
      calculateMonthExpenses(accountingMonth),
      calculateMonthSalariesPosted(accountingMonth),
      getBonusPoolPercent(),
    ]);

  const checklist = (monthClose?.checklist as
    | { payrollRun?: boolean; epCommissionsRun?: boolean; partnerDistributionRun?: boolean }
    | null) ?? {};

  const salariesTotal = employeesWithSalary.reduce((sum, e) => sum + Number(e.salary), 0);

  const epPreview = (
    await Promise.all(
      employeePartners.map(async (e) => {
        const rev = await calculateEmployeePartnerRevenue(e.id, accountingMonth);
        return { name: e.name, revenue: rev, commission: rev.times(10).div(100) };
      })
    )
  )
    .filter((p) => !p.revenue.isZero())
    .map((p) => ({ name: p.name, revenue: p.revenue.toFixed(2), commission: p.commission.toFixed(2) }));

  const distributableProfit = revenue.minus(salaries).minus(expenses);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Monthly Distributions</h1>
          <p className="text-sm text-muted-foreground">
            Run these in order, once per month: payroll, then employee-partner commissions, then partner profit distribution.
          </p>
        </div>
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

      <div className="grid gap-4 md:grid-cols-3">
        <RunPayrollPanel
          accountingMonth={accountingMonth}
          bankAccounts={bankAccounts}
          alreadyRun={!!checklist.payrollRun}
          totalPreview={salariesTotal.toFixed(2)}
        />
        <RunEpCommissionsPanel
          accountingMonth={accountingMonth}
          alreadyRun={!!checklist.epCommissionsRun}
          preview={epPreview}
        />
        <RunPartnerDistributionPanel
          accountingMonth={accountingMonth}
          alreadyRun={!!checklist.partnerDistributionRun}
          payrollRun={!!checklist.payrollRun || employeesWithSalary.length === 0}
          revenue={revenue.toFixed(2)}
          expenses={expenses.toFixed(2)}
          salaries={salaries.toFixed(2)}
          distributableProfit={distributableProfit.toFixed(2)}
          bonusPoolPercent={bonusPoolPercent.toFixed(0)}
        />
      </div>
    </div>
  );
}

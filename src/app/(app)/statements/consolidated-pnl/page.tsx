import { format } from "date-fns";
import { calculatePnl } from "@/lib/statements/pnl";
import { Card, CardContent } from "@/components/ui/card";
import { MonthPickerHeader, currentAccountingMonthFrom } from "@/components/month-picker-header";

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default async function ConsolidatedPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const accountingMonth = currentAccountingMonthFrom(month, (d) => format(d, "yyyy-MM"));
  const pnl = await calculatePnl(accountingMonth, { level: "consolidated" });

  return (
    <div className="space-y-4">
      <MonthPickerHeader title="Consolidated P&L" accountingMonth={accountingMonth} />
      <Card>
        <CardContent className="max-w-md divide-y pt-6">
          <Line label="FP Revenue" value={pnl.revenue.toFixed(2)} />
          <Line label="Product/Service Gross Profit" value={pnl.productGrossProfit.toFixed(2)} />
          <Line label="− Expenses" value={pnl.expenses.toFixed(2)} />
          <Line label="− Salaries" value={pnl.salaries.toFixed(2)} />
          <Line label="Net Profit" value={pnl.netProfit.toFixed(2)} bold />
        </CardContent>
      </Card>
    </div>
  );
}

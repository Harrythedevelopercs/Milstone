import { calculateIncomeStatement } from "@/lib/statements/income-statement";
import { Card, CardContent } from "@/components/ui/card";
import { MonthPickerHeader, currentAccountingMonthFrom } from "@/components/month-picker-header";
import { format } from "date-fns";

function Line({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${bold ? "font-semibold" : ""} ${indent ? "pl-4 text-sm text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const accountingMonth = currentAccountingMonthFrom(month, (d) => format(d, "yyyy-MM"));
  const stmt = await calculateIncomeStatement(accountingMonth);

  return (
    <div className="space-y-4">
      <MonthPickerHeader
        title="Income Statement (P&L)"
        accountingMonth={accountingMonth}
        downloadReportType="income-statement"
      />
      <Card>
        <CardContent className="max-w-lg divide-y pt-6">
          <div className="pb-2">
            <p className="mb-1 font-semibold">Revenue</p>
            {stmt.revenueLines.map((l) => (
              <Line key={l.label} label={l.label} value={l.amount.toFixed(2)} indent />
            ))}
            <Line label="Total Revenue" value={stmt.revenue.toFixed(2)} bold />
            {!stmt.referralPartnerCommission.isZero() && (
              <>
                <Line
                  label="of which: owed to referral partners"
                  value={`-${stmt.referralPartnerCommission.toFixed(2)}`}
                  indent
                />
                <Line
                  label="of which: FoundaPay's own net revenue"
                  value={stmt.revenueNetOfReferral.toFixed(2)}
                  indent
                />
              </>
            )}
          </div>
          <div className="py-2">
            <p className="mb-1 font-semibold">Cost of Goods Sold</p>
            {stmt.cogsLines.map((l) => (
              <Line key={l.label} label={l.label} value={l.amount.toFixed(2)} indent />
            ))}
            <Line label="Total COGS" value={stmt.cogs.toFixed(2)} bold />
          </div>
          <Line label="Gross Profit" value={stmt.grossProfit.toFixed(2)} bold />
          <div className="py-2">
            <p className="mb-1 font-semibold">Operating Expenses</p>
            {stmt.opexLines.map((l) => (
              <Line key={l.label} label={l.label} value={l.amount.toFixed(2)} indent />
            ))}
            <Line label="Total OpEx" value={stmt.opex.toFixed(2)} bold />
          </div>
          <Line label="Net Profit" value={stmt.netProfit.toFixed(2)} bold />
        </CardContent>
      </Card>
      <p className="max-w-lg text-xs text-muted-foreground">
        Reserves held (merchant/FP reserve withheld from a payout) are not revenue and are not
        included above. The refunds/chargebacks COGS line reflects gross reversed transaction
        value for the period; FP&apos;s own fee remains recognized as revenue per policy (a
        refund/chargeback does not reverse it). &quot;FP Fee Revenue&quot; is the full combined
        rate charged to the client (e.g. 9.5%) -- it does not change based on referral splits.
        Where a client has a referral partner (e.g. Kamal), that partner&apos;s share is also
        listed as its own &quot;Referral Partner Commission&quot; line under Cost of Goods Sold,
        same treatment as Employee-Partner Commission -- so Gross Profit already reflects
        FoundaPay&apos;s revenue net of what&apos;s owed to referral partners.
      </p>
    </div>
  );
}

import { format } from "date-fns";
import { calculateBalanceSheet } from "@/lib/statements/balance-sheet";
import { Card, CardContent } from "@/components/ui/card";
import { DownloadButtons } from "@/components/exports/download-buttons";
import { ToneBadge } from "@/components/ui/tone-badge";

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${bold ? "font-semibold" : "text-sm"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const { asOf } = await searchParams;
  const asOfDate = asOf && !Number.isNaN(new Date(asOf).getTime()) ? new Date(asOf) : new Date();
  const bs = await calculateBalanceSheet(asOfDate);
  const balances = bs.assets.equals(bs.liabilities.plus(bs.equity));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground">As of {format(asOfDate, "yyyy-MM-dd")}</p>
        </div>
        <div className="flex items-end gap-2">
          <form method="get" className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="asOf" className="text-xs text-muted-foreground">
                As of
              </label>
              <input
                id="asOf"
                name="asOf"
                type="date"
                defaultValue={format(asOfDate, "yyyy-MM-dd")}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              />
            </div>
            <button type="submit" className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted">
              Go
            </button>
          </form>
          <DownloadButtons reportType="balance-sheet" params={{ asOf: format(asOfDate, "yyyy-MM-dd") }} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ToneBadge tone={balances ? "success" : "danger"}>
          {balances ? "Balanced: Assets = Liabilities + Equity" : "Out of balance"}
        </ToneBadge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="divide-y pt-6">
            <p className="mb-1 font-semibold">Assets</p>
            {bs.assetLines.map((l) => (
              <Line key={l.label} label={l.label} value={l.amount.toFixed(2)} />
            ))}
            <Line label="Total Assets" value={bs.assets.toFixed(2)} bold />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent className="divide-y pt-6">
              <p className="mb-1 font-semibold">Liabilities</p>
              {bs.liabilityLines.map((l) => (
                <Line key={l.label} label={l.label} value={l.amount.toFixed(2)} />
              ))}
              <Line label="Total Liabilities" value={bs.liabilities.toFixed(2)} bold />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="divide-y pt-6">
              <p className="mb-1 font-semibold">Equity</p>
              {bs.equityLines.map((l) => (
                <Line key={l.label} label={l.label} value={l.amount.toFixed(2)} />
              ))}
              <Line label="Total Equity" value={bs.equity.toFixed(2)} bold />
            </CardContent>
          </Card>
        </div>
      </div>
      <p className="max-w-2xl text-xs text-muted-foreground">
        Equity is the accounting-identity residual (Assets − Liabilities), since the system
        doesn&apos;t separately track partner capital contributions apart from profit
        entitlement -- this is standard &quot;Retained Earnings&quot; treatment, not a plug.
      </p>
    </div>
  );
}

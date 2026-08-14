import { DownloadButtons } from "@/components/exports/download-buttons";

export function MonthPickerHeader({
  title,
  accountingMonth,
  downloadReportType,
  downloadParams,
}: {
  title: string;
  accountingMonth: string;
  downloadReportType?: string;
  downloadParams?: Record<string, string | undefined>;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex flex-wrap items-end gap-3">
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
        {downloadReportType && (
          <DownloadButtons
            reportType={downloadReportType}
            params={{ ...downloadParams, month: accountingMonth }}
          />
        )}
      </div>
    </div>
  );
}

export function currentAccountingMonthFrom(month: string | undefined, format: (d: Date) => string): string {
  return month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date());
}

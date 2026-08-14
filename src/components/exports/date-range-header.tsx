import { DownloadButtons } from "./download-buttons";

export function DateRangeHeader({
  title,
  from,
  to,
  reportType,
  exportParams,
}: {
  title?: string;
  from?: string;
  to?: string;
  reportType: string;
  exportParams?: Record<string, string | undefined>;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      {title ? <h1 className="text-xl font-semibold">{title}</h1> : <div />}
      <div className="flex flex-wrap items-end gap-3">
        <form method="get" className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="to" className="text-xs text-muted-foreground">
              To
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            />
          </div>
          <button type="submit" className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted">
            Go
          </button>
        </form>
        <DownloadButtons reportType={reportType} params={{ ...exportParams, from, to }} />
      </div>
    </div>
  );
}

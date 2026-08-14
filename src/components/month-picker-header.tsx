export function MonthPickerHeader({ title, accountingMonth }: { title: string; accountingMonth: string }) {
  return (
    <div className="flex items-end justify-between">
      <h1 className="text-xl font-semibold">{title}</h1>
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
  );
}

export function currentAccountingMonthFrom(month: string | undefined, format: (d: Date) => string): string {
  return month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date());
}

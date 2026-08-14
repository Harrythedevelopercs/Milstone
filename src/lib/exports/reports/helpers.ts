import Decimal from "decimal.js";
import { format } from "date-fns";

export function num(d: Decimal | number | string | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return Number(d);
}

export function fmtMoney(d: Decimal | number | string | null | undefined): string {
  return num(d).toFixed(2);
}

export type DateRange = { from: Date | null; to: Date | null };

export function parseDateRange(params: URLSearchParams): DateRange {
  const fromStr = params.get("from");
  const toStr = params.get("to");
  const from = fromStr ? new Date(fromStr) : null;
  const to = toStr ? new Date(toStr) : null;
  return {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  };
}

export function dateRangeLabel(range: DateRange): string | undefined {
  if (!range.from && !range.to) return "All dates";
  const from = range.from ? format(range.from, "yyyy-MM-dd") : "the beginning";
  const to = range.to ? format(range.to, "yyyy-MM-dd") : "today";
  return `${from} to ${to}`;
}

export function dateRangeWhere(range: DateRange, field = "entryDate") {
  if (!range.from && !range.to) return {};
  const clause: Record<string, Date> = {};
  if (range.from) clause.gte = range.from;
  if (range.to) clause.lte = range.to;
  return { [field]: clause };
}

export function requireId(params: URLSearchParams): string {
  const id = params.get("id");
  if (!id) throw new Error("Missing id parameter.");
  return id;
}

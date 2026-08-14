export type ExportColumnType = "text" | "number" | "date";

export type ExportColumn = {
  key: string;
  header: string;
  type: ExportColumnType;
  align?: "left" | "right";
};

export type ExportSummaryItem = { label: string; value: string };

export type ExportRow = Record<string, string | number | null>;

// A single, format-agnostic description of a report. Both the PDF and Excel
// renderers consume the same payload so every report only needs to be
// fetched/shaped once; numeric columns keep real numbers (not pre-formatted
// strings) so Excel writes actual numeric cells.
export type ExportPayload = {
  title: string;
  subtitle?: string;
  filterRange?: string;
  summary?: ExportSummaryItem[];
  table: {
    columns: ExportColumn[];
    rows: ExportRow[];
  };
  /** Set on client-external-style reports as a reminder this must never carry FP economics. */
  restricted?: boolean;
};

export type ExportFormat = "pdf" | "excel";

import { buttonVariants } from "@/components/ui/button";

// Plain <a> links so the browser handles the file download natively via the
// route's Content-Disposition header -- no client-side fetch/blob needed.
export function DownloadButtons({
  reportType,
  params,
}: {
  reportType: string;
  params?: Record<string, string | undefined>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) query.set(key, value);
  }
  const base = `/api/exports/${reportType}`;
  const pdfHref = `${base}?${query.toString()}`;
  const excelQuery = new URLSearchParams(query);
  excelQuery.set("format", "excel");
  const excelHref = `${base}?${excelQuery.toString()}`;

  const linkClass = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="flex items-center gap-2">
      <a href={pdfHref} className={linkClass}>
        Download PDF
      </a>
      <a href={excelHref} className={linkClass}>
        Download Excel
      </a>
    </div>
  );
}

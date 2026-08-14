import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { REPORT_REGISTRY } from "@/lib/exports/registry";
import { renderPdf } from "@/lib/exports/pdf";
import { renderExcel } from "@/lib/exports/excel";

// Every report on this route belongs to a route group already gated to
// OWNER/ACCOUNTANT at the page level (see each section's layout.tsx) --
// this check keeps the API route itself equally restricted.
const ALLOWED_ROLES = ["OWNER", "ACCOUNTANT"];

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportType: string }> }
) {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { reportType } = await params;
  const fetcher = REPORT_REGISTRY[reportType];
  if (!fetcher) {
    return NextResponse.json({ error: "Unknown report type." }, { status: 404 });
  }

  const searchParams = req.nextUrl.searchParams;
  const wantsExcel = searchParams.get("format") === "excel";

  let payload;
  try {
    payload = await fetcher(searchParams);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const filename = slugify(payload.title);

  if (wantsExcel) {
    const buffer = await renderExcel(payload);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  const buffer = await renderPdf(payload);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
    },
  });
}

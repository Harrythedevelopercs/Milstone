import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from "@react-pdf/renderer";
import { BRAND_NAME, BRAND_LOGO_PATH } from "./brand";
import type { ExportColumn, ExportPayload } from "./types";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: "1 solid #ddd",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  logo: { width: 20, height: 20 },
  brand: { fontSize: 13, fontWeight: 700 },
  generatedOn: { fontSize: 7, color: "#999" },
  title: { fontSize: 15, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 2 },
  filterRange: { fontSize: 8, color: "#888", marginBottom: 8 },
  summaryBlock: { marginTop: 8, marginBottom: 12, maxWidth: 320 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottom: "0.5 solid #eee",
  },
  summaryLabel: { fontSize: 9, color: "#333" },
  summaryValue: { fontSize: 9, fontWeight: 700 },
  table: { marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f2f2f2", paddingVertical: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottom: "0.5 solid #eee" },
  headerCell: { fontSize: 8, fontWeight: 700, paddingHorizontal: 4 },
  cell: { fontSize: 8, paddingHorizontal: 4 },
  emptyState: { fontSize: 9, color: "#999", marginTop: 12 },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#999",
    borderTop: "0.5 solid #eee",
    paddingTop: 4,
  },
});

function colWidthStyle(c: ExportColumn) {
  if (c.type === "date") return { width: 70 };
  if (c.type === "number") return { width: 85 };
  return { flexGrow: 1 };
}

function alignStyle(c: ExportColumn) {
  const align = c.align ?? (c.type === "number" ? "right" : "left");
  return { textAlign: align as "left" | "right" };
}

function formatCell(value: string | number | null | undefined, type: ExportColumn["type"]) {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "number") {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isNaN(n) ? String(value) : n.toFixed(2);
  }
  return String(value);
}

function ReportDocument({ payload, generatedOn }: { payload: ExportPayload; generatedOn: string }) {
  const { columns, rows } = payload.table;
  const orientation = columns.length > 6 ? "landscape" : "portrait";

  return (
    <Document title={payload.title} author={BRAND_NAME}>
      <Page size="A4" orientation={orientation} style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.brandRow}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an HTML img and has no alt prop */}
            {BRAND_LOGO_PATH && <Image src={BRAND_LOGO_PATH} style={styles.logo} />}
            <Text style={styles.brand}>{BRAND_NAME}</Text>
          </View>
          <Text style={styles.generatedOn}>Generated {generatedOn}</Text>
        </View>

        <Text style={styles.title}>{payload.title}</Text>
        {payload.subtitle && <Text style={styles.subtitle}>{payload.subtitle}</Text>}
        {payload.filterRange && <Text style={styles.filterRange}>{payload.filterRange}</Text>}

        {payload.summary && payload.summary.length > 0 && (
          <View style={styles.summaryBlock}>
            {payload.summary.map((s) => (
              <View key={s.label} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{s.label}</Text>
                <Text style={styles.summaryValue}>{s.value}</Text>
              </View>
            ))}
          </View>
        )}

        {columns.length > 0 &&
          (rows.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeaderRow} fixed>
                {columns.map((c) => (
                  <Text key={c.key} style={[styles.headerCell, colWidthStyle(c), alignStyle(c)]}>
                    {c.header}
                  </Text>
                ))}
              </View>
              {rows.map((row, i) => (
                <View key={i} style={styles.tableRow} wrap={false}>
                  {columns.map((c) => (
                    <Text key={c.key} style={[styles.cell, colWidthStyle(c), alignStyle(c)]}>
                      {formatCell(row[c.key], c.type)}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyState}>No data for this range.</Text>
          ))}

        <View style={styles.footer} fixed>
          <Text>{payload.title}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderPdf(payload: ExportPayload): Promise<Buffer> {
  const generatedOn = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
  const buffer = await renderToBuffer(<ReportDocument payload={payload} generatedOn={generatedOn} />);
  return buffer;
}

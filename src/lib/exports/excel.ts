import ExcelJS from "exceljs";
import { BRAND_NAME } from "./brand";
import { getLogoAsset } from "./logo-asset";
import type { ExportPayload } from "./types";

function safeSheetName(title: string) {
  return title.replace(/[*?:/\\[\]]/g, " ").slice(0, 31) || "Report";
}

export async function renderExcel(payload: ExportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND_NAME;
  wb.created = new Date();

  const sheet = wb.addWorksheet(safeSheetName(payload.title));
  let row = 1;

  const logo = getLogoAsset();
  if (logo) {
    const width = 150;
    const height = (width * logo.height) / logo.width;
    const imageId = wb.addImage({
      base64: logo.dataUri.slice(logo.dataUri.indexOf(",") + 1),
      extension: logo.dataUri.includes("image/jpeg") ? "jpeg" : "png",
    });
    sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width, height } });
    row = Math.max(2, Math.ceil(height / 18)) + 1;
  } else {
    sheet.getCell(row, 1).value = BRAND_NAME;
    sheet.getCell(row, 1).font = { bold: true, size: 14 };
    row++;
  }

  sheet.getCell(row, 1).value = payload.title;
  sheet.getCell(row, 1).font = { bold: true, size: 12 };
  row++;

  if (payload.subtitle) {
    sheet.getCell(row, 1).value = payload.subtitle;
    sheet.getCell(row, 1).font = { size: 10, color: { argb: "FF555555" } };
    row++;
  }

  if (payload.filterRange) {
    sheet.getCell(row, 1).value = payload.filterRange;
    sheet.getCell(row, 1).font = { italic: true, size: 9, color: { argb: "FF888888" } };
    row++;
  }

  sheet.getCell(row, 1).value = `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
  sheet.getCell(row, 1).font = { italic: true, size: 8, color: { argb: "FF999999" } };
  row += 2;

  if (payload.summary && payload.summary.length > 0) {
    for (const s of payload.summary) {
      sheet.getCell(row, 1).value = s.label;
      sheet.getCell(row, 1).font = { bold: true };
      sheet.getCell(row, 2).value = s.value;
      row++;
    }
    row++;
  }

  const columns = payload.table.columns;
  const headerRowIdx = row;
  columns.forEach((c, i) => {
    const cell = sheet.getCell(headerRowIdx, i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
  });
  row++;

  for (const r of payload.table.rows) {
    columns.forEach((c, i) => {
      const cell = sheet.getCell(row, i + 1);
      const value = r[c.key];
      if (c.type === "number") {
        cell.value = value === null || value === undefined || value === "" ? null : Number(value);
        cell.numFmt = "#,##0.00";
      } else {
        cell.value = value ?? "";
      }
    });
    row++;
  }

  columns.forEach((c, i) => {
    sheet.getColumn(i + 1).width = c.type === "text" ? 30 : 16;
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

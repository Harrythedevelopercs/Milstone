import fs from "node:fs";
import path from "node:path";
import { BRAND_LOGO_PATH } from "./brand";

let cached: { dataUri: string; width: number; height: number } | null | undefined;

// PDF/Excel are rendered server-side and can't reliably fetch their own
// public URL, so both read the logo straight off disk as a data URI.
export function getLogoAsset(): { dataUri: string; width: number; height: number } | null {
  if (cached !== undefined) return cached;
  if (!BRAND_LOGO_PATH) {
    cached = null;
    return null;
  }
  try {
    const filePath = path.join(process.cwd(), "public", BRAND_LOGO_PATH.replace(/^\//, ""));
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === "jpg" ? "jpeg" : ext;
    const dimensions = readPngDimensions(buffer);
    cached = {
      dataUri: `data:image/${mime};base64,${buffer.toString("base64")}`,
      width: dimensions?.width ?? 150,
      height: dimensions?.height ?? 30,
    };
  } catch {
    cached = null;
  }
  return cached;
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  // PNG: width/height are big-endian uint32s at bytes 16 and 20 of the IHDR chunk.
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

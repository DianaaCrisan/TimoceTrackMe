import path from "path";
import fs from "fs/promises";
import * as fontkit from "fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

/** The 150×100mm label page every generated page uses. */
const mmToPt = (mm: number) => mm * 2.83465;
export const LABEL_PAGE_WIDTH = mmToPt(150);
export const LABEL_PAGE_HEIGHT = mmToPt(100);

let cachedFontBytes: { regular: Uint8Array; bold: Uint8Array } | null = null;

/**
 * Roboto, embedded for Romanian diacritics (ș, ț, ă), which pdf-lib's
 * built-in Helvetica cannot draw. The files are read once per process.
 */
export async function embedLabelFonts(
  doc: PDFDocument,
): Promise<{ font: PDFFont; boldFont: PDFFont }> {
  if (!cachedFontBytes) {
    const [regular, bold] = await Promise.all([
      fs.readFile(path.resolve("app/backend/core/fonts/Roboto-Regular.ttf")),
      fs.readFile(path.resolve("app/backend/core/fonts/Roboto-Bold.ttf")),
    ]);
    cachedFontBytes = { regular, bold };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.registerFontkit(fontkit as any);

  return {
    font: await doc.embedFont(cachedFontBytes.regular),
    boldFont: await doc.embedFont(cachedFontBytes.bold),
  };
}

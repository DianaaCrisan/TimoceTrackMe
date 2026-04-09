import { type PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { drawRightArrowFooter } from "./drawRightArrowFooter";

const mmToPt = (mm: number) => mm * 2.83465;

const PAGE_MM = { w: 150, h: 100 };

const LEFT_X = 20;
const RIGHT_PADDING = 20;
const TITLE_Y = 255;
const START_Y = 235;
const LINE_GAP = 22;
const BOTTOM_MARGIN = 16;

const COLUMNS = 4;

export async function appendOrderNamePagesToPDF(
  master: PDFDocument,
  orderNames: string[],
): Promise<void> {
  // dedupe + sort
  const names = Array.from(new Set(orderNames.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
  if (!names.length) return;

  // built-in fonts (no custom font files)
  const font = await master.embedFont(StandardFonts.Helvetica);
  const boldFont = await master.embedFont(StandardFonts.HelveticaBold);

  const width = mmToPt(PAGE_MM.w);
  const height = mmToPt(PAGE_MM.h);

  const usableWidth = width - LEFT_X - RIGHT_PADDING;
  const colWidth = usableWidth / COLUMNS;

  const rowsPerColumn = Math.max(
    1,
    Math.floor((START_Y - BOTTOM_MARGIN) / LINE_GAP),
  );
  const perPage = rowsPerColumn * COLUMNS;

  let idx = 0;
  while (idx < names.length) {
    const page = master.addPage([width, height]);

    // title
    page.drawText("Comenzi", {
      x: LEFT_X,
      y: TITLE_Y,
      size: 13,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // 4-column grid of order names
    for (let i = 0; i < perPage && idx < names.length; i++, idx++) {
      const col = Math.floor(i / rowsPerColumn);
      const row = i % rowsPerColumn;

      const x = LEFT_X + col * colWidth;
      const y = START_Y - row * LINE_GAP;

      page.drawText(names[idx], {
        x,
        y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
    }

    // arrow on every Orders page
    drawRightArrowFooter(page);
  }
}

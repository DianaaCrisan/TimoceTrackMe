import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatOrderRanges } from "./formatOrderRanges";
import {
  embedLabelFonts,
  LABEL_PAGE_HEIGHT as PAGE_HEIGHT,
  LABEL_PAGE_WIDTH as PAGE_WIDTH,
} from "./labelFonts";

const LEFT_X = 20;
const RIGHT_PADDING = 20;
const TEXT_WIDTH = PAGE_WIDTH - LEFT_X - RIGHT_PADDING;
const BOTTOM_MARGIN = 16;

const TITLE_Y = 255;
const TITLE_FONT_SIZE = 14;

const COUNTS_START_Y = 228;
const COUNT_ROW_GAP = 24;
const COUNT_FONT_SIZE = 12;
const COUNT_VALUE_X = 220;

const ORDERS_HEADER_GAP = 6;
const ORDERS_CONTINUATION_HEADER_Y = 260;
const ORDERS_HEADER_FONT_SIZE = 11;
const ORDERS_FIRST_LINE_OFFSET = 17;
const ORDERS_LINE_GAP = 15;
export const ORDERS_FONT_SIZE = 11;

export type LabelCounts = {
  delivery: number;
  pickup: number;
  total: number;
};

/** Where everything goes on each page; produced without touching a PDF. */
export type TotalsPageLayout = {
  title?: { text: string; y: number };
  countRows: { label: string; value: string; y: number }[];
  ordersHeader?: { text: string; y: number; hasDivider: boolean };
  orderLines: { text: string; y: number }[];
};

/** Width of `text` at the order-list font size, in points. */
export type MeasureText = (text: string) => number;

/**
 * The first page of a labels PDF: how many labels it holds, then every order
 * in it as a compact list of ranges ("#1201-1206, #1209"), so the packer can
 * check the batch at a glance. A long list continues on "Comenzi (cont.)"
 * pages.
 */
export async function generateTotalsPDF(
  counts: LabelCounts,
  orderNames: string[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await embedLabelFonts(doc);

  const pages = layoutTotalsPage({
    counts,
    orderNames,
    measure: (text) => fonts.font.widthOfTextAtSize(text, ORDERS_FONT_SIZE),
  });

  for (const pageLayout of pages) {
    drawPage(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), pageLayout, fonts);
  }

  return doc.save();
}

export function layoutTotalsPage(args: {
  counts: LabelCounts;
  orderNames: string[];
  measure: MeasureText;
}): TotalsPageLayout[] {
  const { counts } = args;
  let page: TotalsPageLayout = {
    title: { text: "Total etichete", y: TITLE_Y },
    countRows: [
      ["Etichete livrare", counts.delivery],
      ["Etichete pickup", counts.pickup],
      ["Nr. total etichete", counts.total],
    ].map(([label, value], index) => ({
      label: String(label),
      value: String(value),
      y: COUNTS_START_Y - index * COUNT_ROW_GAP,
    })),
    orderLines: [],
  };
  const pages = [page];

  const ranges = formatOrderRanges(args.orderNames);
  if (ranges.length === 0) return pages;

  const orderCount = new Set(args.orderNames.filter(Boolean)).size;
  const lastCountY = page.countRows[page.countRows.length - 1].y;
  const headerY = lastCountY - COUNT_ROW_GAP - ORDERS_HEADER_GAP;
  page.ordersHeader = {
    text: `Comenzi (${orderCount})`,
    y: headerY,
    hasDivider: true,
  };

  let lineY = headerY - ORDERS_FIRST_LINE_OFFSET;
  for (const text of wrapRanges(ranges, args.measure, TEXT_WIDTH)) {
    if (lineY < BOTTOM_MARGIN) {
      page = {
        countRows: [],
        ordersHeader: {
          text: "Comenzi (cont.)",
          y: ORDERS_CONTINUATION_HEADER_Y,
          hasDivider: false,
        },
        orderLines: [],
      };
      pages.push(page);
      lineY = ORDERS_CONTINUATION_HEADER_Y - ORDERS_FIRST_LINE_OFFSET;
    }
    page.orderLines.push({ text, y: lineY });
    lineY -= ORDERS_LINE_GAP;
  }

  return pages;
}

/** "a, b, c" broken into lines no wider than `maxWidth`, never inside a range. */
export function wrapRanges(
  ranges: string[],
  measure: MeasureText,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";

  ranges.forEach((range, index) => {
    const token = index < ranges.length - 1 ? `${range},` : range;
    const candidate = line ? `${line} ${token}` : token;

    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = token;
    } else {
      line = candidate;
    }
  });

  if (line) lines.push(line);
  return lines;
}

function drawPage(
  page: PDFPage,
  layout: TotalsPageLayout,
  fonts: { font: PDFFont; boldFont: PDFFont },
): void {
  const black = rgb(0, 0, 0);

  if (layout.title) {
    page.drawText(layout.title.text, {
      x: LEFT_X,
      y: layout.title.y,
      size: TITLE_FONT_SIZE,
      font: fonts.boldFont,
      color: black,
    });
  }

  // the orders divider replaces the thin line under the last row
  const lastSeparatedRow = layout.ordersHeader?.hasDivider
    ? layout.countRows.length - 1
    : layout.countRows.length;

  layout.countRows.forEach((row, index) => {
    page.drawText(row.label, {
      x: LEFT_X,
      y: row.y,
      size: COUNT_FONT_SIZE,
      font: fonts.font,
      color: black,
    });
    page.drawText(row.value, {
      x: COUNT_VALUE_X,
      y: row.y,
      size: COUNT_FONT_SIZE,
      font: fonts.font,
      color: black,
    });
    if (index < lastSeparatedRow) {
      page.drawRectangle({
        x: LEFT_X,
        y: row.y - COUNT_ROW_GAP / 2 - 0.375,
        width: TEXT_WIDTH,
        height: 0.75,
        color: black,
      });
    }
  });

  if (layout.ordersHeader) {
    if (layout.ordersHeader.hasDivider) {
      page.drawRectangle({
        x: LEFT_X,
        y: layout.ordersHeader.y + ORDERS_HEADER_FONT_SIZE + 2,
        width: TEXT_WIDTH,
        height: 1.5,
        color: black,
      });
    }
    page.drawText(layout.ordersHeader.text, {
      x: LEFT_X,
      y: layout.ordersHeader.y,
      size: ORDERS_HEADER_FONT_SIZE,
      font: fonts.boldFont,
      color: black,
    });
  }

  for (const line of layout.orderLines) {
    page.drawText(line.text, {
      x: LEFT_X,
      y: line.y,
      size: ORDERS_FONT_SIZE,
      font: fonts.font,
      color: black,
    });
  }
}

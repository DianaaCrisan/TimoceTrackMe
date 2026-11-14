import { PDFDocument, rgb, type PDFFont, type RGB } from "pdf-lib";
import { INTL_LOCALE, type Locale } from "app/commons/i18n/Locale";
import { createTranslator, type Translate } from "app/commons/i18n/translate";
import { formatOrderIntervalScope } from "app/commons/unfulfilled-report/OrderInterval";
import {
  REPORT_SECTIONS,
  type ReportSection,
  type ReportSectionKey,
  type UnfulfilledReport,
} from "app/commons/unfulfilled-report/UnfulfilledReport";
import { resolveTimeZone } from "../exports/formatFileTimestamp";
import { embedLabelFonts } from "../print-labels/utils/labelFonts";
import { wrapRanges } from "../print-labels/utils/generateTotalsPDF";

// A4 portrait, in points
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

const MARGIN_X = 40;
const CONTENT_WIDTH = A4_WIDTH - MARGIN_X * 2;
const CONTENT_TOP = A4_HEIGHT - 48;
/** Nothing but the footer goes below this line. */
export const CONTENT_BOTTOM = 48;
const FOOTER_Y = 24;

const TITLE_SIZE = 18;
const SUBTITLE_SIZE = 10;
const TABLE_HEADER_SIZE = 10;
const ROW_SIZE = 11;
const ORDERS_HEADER_SIZE = 11;
const ORDERS_SIZE = 10;
const FOOTER_SIZE = 8;

const SECTION_SIZE_IN_BAND = 13;
const SECTION_HEADING_HEIGHT = 26;
const SECTION_GAP = 28;
const TABLE_HEADER_HEIGHT = 22;
const ROW_PADDING = 5;
const ROW_LINE_HEIGHT = 14;
const QUANTITY_COLUMN_WIDTH = 90;
const CELL_PADDING_X = 8;
const PRODUCT_COLUMN_WIDTH =
  CONTENT_WIDTH - QUANTITY_COLUMN_WIDTH - CELL_PADDING_X * 2;
const ORDERS_HEADER_HEIGHT = 20;
const ORDERS_LINE_HEIGHT = 14;

export type PdfTextOp = {
  kind: "text";
  text: string;
  /** The left edge, or the right edge for `align: "right"`. */
  x: number;
  /** The baseline. */
  y: number;
  size: number;
  bold: boolean;
  color: PdfColor;
  align: "left" | "right";
};

export type PdfRectOp = {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: PdfColor;
};

/**
 * The report's palette. Each section has its own colour, so delivery and
 * pickup tell apart at a glance: blue and orange, which stay distinct for
 * colour-blind readers and as greys on a black-and-white printer.
 * - `*Band`: the section heading's background, under white text
 * - `*Tint`: the table header and total row backgrounds
 */
export type PdfColor =
  | "text"
  | "muted"
  | "white"
  | "rule"
  | "zebra"
  | "deliveryBand"
  | "deliveryTint"
  | "pickupBand"
  | "pickupTint";

type SectionTheme = { band: PdfColor; tint: PdfColor };

const SECTION_THEMES: Record<ReportSectionKey, SectionTheme> = {
  delivery: { band: "deliveryBand", tint: "deliveryTint" },
  pickup: { band: "pickupBand", tint: "pickupTint" },
};

export type ReportPdfPage = { ops: (PdfTextOp | PdfRectOp)[] };

/** Width of `text` in points, in the regular or bold font. */
export type MeasureText = (text: string, size: number, bold: boolean) => number;

export type ReportPdfOptions = {
  locale: Locale;
  /** The user's IANA time zone, for the "Generated" time. */
  timeZone?: string | null;
};

/**
 * The unfulfilled report as an A4 PDF, in the user's language:
 * 1. title, which orders it covers and when it was generated
 * 2. per section (delivery, then pickup): product and quantity table with a
 *    total, then the section's orders as a compact list of ranges
 *
 * Tables and order lists continue on the next page, under a "(cont.)" heading
 * and the repeated table header.
 */
export async function generateUnfulfilledReportPDF(
  report: UnfulfilledReport,
  options: ReportPdfOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await embedLabelFonts(doc);
  const fontFor = (bold: boolean) => (bold ? fonts.boldFont : fonts.font);

  const pages = layoutReportPdf({
    report,
    t: createTranslator(options.locale),
    formatDate: (iso) => formatGeneratedAt(iso, options),
    measure: (text, size, bold) => fontFor(bold).widthOfTextAtSize(text, size),
  });

  for (const pageLayout of pages) {
    const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
    for (const op of pageLayout.ops) {
      if (op.kind === "rect") {
        page.drawRectangle({
          x: op.x,
          y: op.y,
          width: op.width,
          height: op.height,
          color: COLORS[op.color],
        });
        continue;
      }

      const font = fontFor(op.bold);
      page.drawText(op.text, {
        x: op.align === "right" ? op.x - widthOf(font, op.text, op.size) : op.x,
        y: op.y,
        size: op.size,
        font,
        color: COLORS[op.color],
      });
    }
  }

  return doc.save();
}

const hex = (value: string): RGB =>
  rgb(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
  );

const COLORS: Record<PdfColor, RGB> = {
  text: hex("#1a1a1a"),
  muted: hex("#666666"),
  white: hex("#ffffff"),
  rule: hex("#d5d8dd"),
  zebra: hex("#f5f6f8"),
  deliveryBand: hex("#1f5199"),
  deliveryTint: hex("#e3ecf8"),
  pickupBand: hex("#b45309"),
  pickupTint: hex("#fcebd7"),
};

function widthOf(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(text, size);
}

function formatGeneratedAt(
  iso: string,
  { locale, timeZone }: ReportPdfOptions,
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: resolveTimeZone(timeZone),
  }).format(new Date(iso));
}

const SECTION_TITLES: Record<
  ReportSectionKey,
  "report.delivery" | "report.pickup"
> = {
  delivery: "report.delivery",
  pickup: "report.pickup",
};

/** Where everything goes on each page; produced without touching a PDF. */
export function layoutReportPdf(args: {
  report: UnfulfilledReport;
  t: Translate;
  formatDate: (iso: string) => string;
  measure: MeasureText;
}): ReportPdfPage[] {
  const { report, t, measure } = args;
  const flow = new Flow();

  // 1. document header
  flow.text(t("report.heading"), {
    x: MARGIN_X,
    size: TITLE_SIZE,
    bold: true,
  });
  flow.advance(TITLE_SIZE + 4);
  flow.text(
    `${formatOrderIntervalScope(report.interval, t)} · ${t(
      "report.generatedAt",
      { date: args.formatDate(report.generatedAt) },
    )}`,
    { x: MARGIN_X, size: SUBTITLE_SIZE, color: "muted" },
  );
  flow.advance(SUBTITLE_SIZE + SECTION_GAP);

  // 2. one block per section
  REPORT_SECTIONS.forEach((key, index) => {
    if (index > 0) flow.advance(SECTION_GAP);
    layoutSection(flow, {
      title: t(SECTION_TITLES[key]),
      section: report[key],
      theme: SECTION_THEMES[key],
      t,
      measure,
    });
  });

  // 3. footer on every page, now that the page count is known
  const footerLeft = `${t("report.heading")} · ${formatOrderIntervalScope(report.interval, t)}`;
  flow.pages.forEach((page, index) => {
    page.ops.push(
      textOp(footerLeft, {
        x: MARGIN_X,
        y: FOOTER_Y,
        size: FOOTER_SIZE,
        color: "muted",
      }),
      textOp(
        t("pagination.pageOf", {
          current: index + 1,
          total: flow.pages.length,
        }),
        {
          x: A4_WIDTH - MARGIN_X,
          y: FOOTER_Y,
          size: FOOTER_SIZE,
          color: "muted",
          align: "right",
        },
      ),
    );
  });

  return flow.pages;
}

function layoutSection(
  flow: Flow,
  args: {
    title: string;
    section: ReportSection;
    theme: SectionTheme;
    t: Translate;
    measure: MeasureText;
  },
): void {
  const { title, section, theme, t, measure } = args;
  const orderCount = section.orderNames.length;
  const continuedTitle = t("report.sectionContinued", { section: title });

  // a band in the section's colour, white text on it
  const heading = (text: string) => {
    const top = flow.y;
    flow.rect({
      x: MARGIN_X,
      y: top - SECTION_HEADING_HEIGHT,
      width: CONTENT_WIDTH,
      height: SECTION_HEADING_HEIGHT,
      color: theme.band,
    });
    const baseline = top - 17.5;
    flow.textAt(text, {
      x: MARGIN_X + CELL_PADDING_X,
      y: baseline,
      size: SECTION_SIZE_IN_BAND,
      bold: true,
      color: "white",
    });
    if (orderCount > 0) {
      flow.textAt(t("report.orderCount", { count: orderCount }), {
        x: A4_WIDTH - MARGIN_X - CELL_PADDING_X,
        y: baseline,
        size: SUBTITLE_SIZE,
        color: "white",
        align: "right",
      });
    }
    flow.advance(SECTION_HEADING_HEIGHT);
  };

  const tableHeader = () => {
    flow.rect({
      x: MARGIN_X,
      y: flow.y - TABLE_HEADER_HEIGHT,
      width: CONTENT_WIDTH,
      height: TABLE_HEADER_HEIGHT,
      color: theme.tint,
    });
    const baseline = flow.y - 15;
    flow.textAt(t("report.product"), {
      x: MARGIN_X + CELL_PADDING_X,
      y: baseline,
      size: TABLE_HEADER_SIZE,
      bold: true,
      color: theme.band,
    });
    flow.textAt(t("report.quantity"), {
      x: A4_WIDTH - MARGIN_X - CELL_PADDING_X,
      y: baseline,
      size: TABLE_HEADER_SIZE,
      bold: true,
      color: theme.band,
      align: "right",
    });
    flow.advance(TABLE_HEADER_HEIGHT);
  };

  // keep the heading with the table header and the first row
  flow.ensureSpace(SECTION_HEADING_HEIGHT + TABLE_HEADER_HEIGHT + rowHeight(1));
  heading(title);

  if (section.rows.length === 0) {
    flow.advance(8);
    flow.text(t("report.noOrders"), {
      x: MARGIN_X,
      size: ROW_SIZE,
      color: "muted",
    });
    flow.advance(ROW_SIZE);
    return;
  }

  tableHeader();
  const continueTable = () => {
    heading(continuedTitle);
    tableHeader();
  };

  section.rows.forEach((row, rowIndex) => {
    const lines = wrapText(row.name, PRODUCT_COLUMN_WIDTH, (text) =>
      measure(text, ROW_SIZE, false),
    );
    const height = rowHeight(lines.length);
    if (flow.ensureSpace(height)) continueTable();

    const top = flow.y;
    // every other row shaded, so the eye stays on the line to the quantity
    if (rowIndex % 2 === 1) {
      flow.rect({
        x: MARGIN_X,
        y: top - height,
        width: CONTENT_WIDTH,
        height,
        color: "zebra",
      });
    }
    lines.forEach((line, lineIndex) => {
      flow.textAt(line, {
        x: MARGIN_X + CELL_PADDING_X,
        y: top - ROW_PADDING - 10 - lineIndex * ROW_LINE_HEIGHT,
        size: ROW_SIZE,
      });
    });
    flow.textAt(String(row.quantity), {
      x: A4_WIDTH - MARGIN_X - CELL_PADDING_X,
      y: top - ROW_PADDING - 10,
      size: ROW_SIZE,
      align: "right",
    });
    flow.rect({
      x: MARGIN_X,
      y: top - height,
      width: CONTENT_WIDTH,
      height: 0.5,
      color: "rule",
    });
    flow.advance(height);
  });

  // total row: tinted, under a rule in the section's colour
  const totalHeight = rowHeight(1);
  if (flow.ensureSpace(totalHeight)) continueTable();
  const totalTop = flow.y;
  flow.rect({
    x: MARGIN_X,
    y: totalTop - totalHeight,
    width: CONTENT_WIDTH,
    height: totalHeight,
    color: theme.tint,
  });
  flow.rect({
    x: MARGIN_X,
    y: totalTop - 1.5,
    width: CONTENT_WIDTH,
    height: 1.5,
    color: theme.band,
  });
  flow.textAt(t("report.total"), {
    x: MARGIN_X + CELL_PADDING_X,
    y: totalTop - ROW_PADDING - 10,
    size: ROW_SIZE,
    bold: true,
    color: theme.band,
  });
  flow.textAt(String(section.totalQuantity), {
    x: A4_WIDTH - MARGIN_X - CELL_PADDING_X,
    y: totalTop - ROW_PADDING - 10,
    size: ROW_SIZE,
    bold: true,
    color: theme.band,
    align: "right",
  });
  flow.advance(totalHeight + 12);

  // the section's orders, as on the labels PDF's first page
  const orderLines = wrapRanges(
    section.orderRanges,
    (text) => measure(text, ORDERS_SIZE, false),
    CONTENT_WIDTH,
  );
  if (orderLines.length === 0) return;

  const ordersHeader = (text: string) => {
    flow.text(text, {
      x: MARGIN_X,
      size: ORDERS_HEADER_SIZE,
      bold: true,
      color: theme.band,
    });
    flow.advance(ORDERS_HEADER_HEIGHT);
  };

  flow.ensureSpace(ORDERS_HEADER_HEIGHT + ORDERS_LINE_HEIGHT);
  ordersHeader(t("report.orders", { count: orderCount }));

  for (const line of orderLines) {
    if (flow.ensureSpace(ORDERS_LINE_HEIGHT)) {
      ordersHeader(t("report.ordersContinued"));
    }
    flow.text(line, { x: MARGIN_X, size: ORDERS_SIZE });
    flow.advance(ORDERS_LINE_HEIGHT);
  }
}

function rowHeight(lineCount: number): number {
  return ROW_PADDING * 2 + Math.max(1, lineCount) * ROW_LINE_HEIGHT;
}

type TextOptions = {
  x: number;
  size: number;
  bold?: boolean;
  color?: PdfColor;
  align?: "left" | "right";
};

function textOp(text: string, options: TextOptions & { y: number }): PdfTextOp {
  return {
    kind: "text",
    text,
    x: options.x,
    y: options.y,
    size: options.size,
    bold: options.bold ?? false,
    color: options.color ?? "text",
    align: options.align ?? "left",
  };
}

/**
 * Top-down page flow. `y` is the top of the free space; `text` puts a line's
 * baseline one font size below it, `advance` moves down.
 */
class Flow {
  readonly pages: ReportPdfPage[] = [];
  y = CONTENT_TOP;

  constructor() {
    this.newPage();
  }

  /** Starts a new page when `height` no longer fits; says whether it did. */
  ensureSpace(height: number): boolean {
    if (this.y - height >= CONTENT_BOTTOM) return false;
    this.newPage();
    return true;
  }

  text(text: string, options: TextOptions): void {
    this.textAt(text, { ...options, y: this.y - options.size });
  }

  textAt(text: string, options: TextOptions & { y: number }): void {
    this.current.ops.push(textOp(text, options));
  }

  rect(op: Omit<PdfRectOp, "kind">): void {
    this.current.ops.push({ kind: "rect", ...op });
  }

  advance(height: number): void {
    this.y -= height;
  }

  private get current(): ReportPdfPage {
    return this.pages[this.pages.length - 1];
  }

  private newPage(): void {
    this.pages.push({ ops: [] });
    this.y = CONTENT_TOP;
  }
}

/**
 * Breaks `text` into lines no wider than `maxWidth`, between words. A word
 * wider than a whole line is cut, so nothing runs into the next column.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);
    line = word;
    while (measure(line) > maxWidth && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && measure(line.slice(0, cut)) > maxWidth) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }

  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

import path from "path";
import fs from "fs/promises";
import * as fontkit from "fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { LineItem } from "../models/LineItem";

const mmToPt = (mm: number) => mm * 2.83465;

const PAGE_WIDTH = mmToPt(150);
const PAGE_HEIGHT = mmToPt(100);
const LEFT_X = 20;
const RIGHT_PADDING = 20;
const BOTTOM_MARGIN = 16;

const TITLE_Y = 255;
const TITLE_FONT_SIZE = 13;

const ITEMS_FIRST_PAGE_START_Y = 235;
const ITEMS_CONTINUATION_START_Y = 260;
const ITEM_LINE_GAP = 22;
const ITEM_FONT_SIZE = 12;
const ITEM_NAME_FONT_SIZE = 6;
const ITEM_QUANTITY_X = 370;
const LARGE_QUANTITY_FONT_SIZE = 22;
const MAX_ITEM_NAME_CHARS = 60;

const ORDERS_HEADER_GAP = 4;
const ORDERS_CONTINUATION_HEADER_Y = 260;
const ORDERS_HEADER_FONT_SIZE = 11;
const ORDERS_FIRST_ROW_OFFSET = 16;
const ORDER_ROW_GAP = 14;
const ORDER_FONT_SIZE = 10;
const ORDER_COLUMNS = 5;

export type ItemRow = { sku: string | null; name: string; quantity: number };

/** Where everything goes on each page; produced without touching a PDF. */
export type GroupHeaderPageLayout = {
  title?: { text: string; y: number };
  itemRows: (ItemRow & { y: number })[];
  ordersHeader?: { text: string; y: number; hasDivider: boolean };
  orderRows: { names: string[]; y: number }[];
};

/**
 * The page in front of each group of identical labels: what goes in every
 * parcel, then which orders the group covers. One 150×100mm label when it
 * fits; otherwise items continue on the next page, and orders flow onto
 * "Comenzi (cont.)" pages.
 */
export async function generateGroupHeaderPDF(
  items: LineItem[],
  labelCount: number,
  orderNames: string[],
): Promise<Uint8Array> {
  const pages = layoutGroupHeader({
    title: buildTitle(items, labelCount),
    itemRows: toItemRows(items),
    orderNames,
  });

  const doc = await PDFDocument.create();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.registerFontkit(fontkit as any);
  const fontBytes = await loadFontBytes();
  const font = await doc.embedFont(fontBytes.regular);
  const boldFont = await doc.embedFont(fontBytes.bold);

  for (const pageLayout of pages) {
    drawPage(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), pageLayout, {
      font,
      boldFont,
    });
  }

  return doc.save();
}

export function layoutGroupHeader(args: {
  title: string;
  itemRows: ItemRow[];
  orderNames: string[];
}): GroupHeaderPageLayout[] {
  const pages: GroupHeaderPageLayout[] = [];
  const newPage = (): GroupHeaderPageLayout => {
    const page: GroupHeaderPageLayout = { itemRows: [], orderRows: [] };
    pages.push(page);
    return page;
  };

  // 1. title and items, as many rows per page as the old summary page held
  let page = newPage();
  page.title = { text: args.title, y: TITLE_Y };
  let y = ITEMS_FIRST_PAGE_START_Y;
  let rowsLeftOnPage = itemRowsPerPage(ITEMS_FIRST_PAGE_START_Y);

  for (const row of args.itemRows) {
    if (rowsLeftOnPage === 0) {
      page = newPage();
      y = ITEMS_CONTINUATION_START_Y;
      rowsLeftOnPage = itemRowsPerPage(ITEMS_CONTINUATION_START_Y);
    }
    page.itemRows.push({ ...row, y });
    y -= ITEM_LINE_GAP;
    rowsLeftOnPage--;
  }

  // 2. order names, starting under the items if at least one row fits there
  const names = sortOrderNames(args.orderNames);
  if (names.length === 0) return pages;

  let headerY = y - ORDERS_HEADER_GAP;
  let hasDivider = page.itemRows.length > 0;
  if (headerY - ORDERS_FIRST_ROW_OFFSET < BOTTOM_MARGIN) {
    page = newPage();
    headerY = ORDERS_CONTINUATION_HEADER_Y;
    hasDivider = false;
  }

  page.ordersHeader = {
    text: `Comenzi (${names.length})`,
    y: headerY,
    hasDivider,
  };
  let rowY = headerY - ORDERS_FIRST_ROW_OFFSET;

  for (let index = 0; index < names.length; index += ORDER_COLUMNS) {
    if (rowY < BOTTOM_MARGIN) {
      page = newPage();
      page.ordersHeader = {
        text: "Comenzi (cont.)",
        y: ORDERS_CONTINUATION_HEADER_Y,
        hasDivider: false,
      };
      rowY = ORDERS_CONTINUATION_HEADER_Y - ORDERS_FIRST_ROW_OFFSET;
    }
    page.orderRows.push({
      names: names.slice(index, index + ORDER_COLUMNS),
      y: rowY,
    });
    rowY -= ORDER_ROW_GAP;
  }

  return pages;
}

function itemRowsPerPage(startY: number): number {
  return Math.max(1, Math.floor((startY - BOTTOM_MARGIN) / ITEM_LINE_GAP));
}

function buildTitle(items: LineItem[], labelCount: number): string {
  const itemTypeCount = toItemRows(items).length;
  const labels = `${labelCount} ${labelCount > 1 ? "Etichete" : "Eticheta"}`;
  const itemTypes = `${itemTypeCount} ${itemTypeCount > 1 ? "tipuri produse" : "tip produs"}`;
  return `${labels} -> ${itemTypes}`;
}

/** One row per variant, quantities summed, sorted by name. */
export function toItemRows(items: LineItem[]): ItemRow[] {
  const byKey = new Map<string, ItemRow>();

  for (const item of items) {
    const existing = byKey.get(item.getKey());
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      byKey.set(item.getKey(), {
        sku: item.sku ?? null,
        name: item.name,
        quantity: item.quantity,
      });
    }
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** "#1002" before "#1010", whatever their length. */
function sortOrderNames(orderNames: string[]): string[] {
  return Array.from(new Set(orderNames.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function drawPage(
  page: PDFPage,
  layout: GroupHeaderPageLayout,
  fonts: { font: PDFFont; boldFont: PDFFont },
): void {
  const black = rgb(0, 0, 0);
  const grey = rgb(100 / 255, 100 / 255, 100 / 255);
  const lineWidth = PAGE_WIDTH - LEFT_X - RIGHT_PADDING;

  if (layout.title) {
    page.drawText(layout.title.text, {
      x: LEFT_X,
      y: layout.title.y,
      size: TITLE_FONT_SIZE,
      font: fonts.boldFont,
      color: black,
    });
  }

  for (const row of layout.itemRows) {
    const prefix = row.sku?.trim() ? `${row.sku.trim()} ` : "";
    const name = ellipsize(row.name, MAX_ITEM_NAME_CHARS);

    if (prefix) {
      page.drawText(prefix, {
        x: LEFT_X,
        y: row.y,
        size: ITEM_FONT_SIZE,
        font: fonts.font,
        color: black,
      });
      page.drawText(name, {
        x: LEFT_X + fonts.font.widthOfTextAtSize(prefix, ITEM_FONT_SIZE) + 10,
        y: row.y - 1,
        size: ITEM_NAME_FONT_SIZE,
        font: fonts.font,
        color: grey,
      });
    } else {
      page.drawText(name, {
        x: LEFT_X,
        y: row.y,
        size: ITEM_FONT_SIZE,
        font: fonts.font,
        color: black,
      });
    }

    // quantities above 1 are drawn large so a packer cannot miss them
    const isLargeQuantity = row.quantity > 1;
    page.drawText(String(row.quantity), {
      x: Math.min(PAGE_WIDTH - 2, ITEM_QUANTITY_X),
      y: isLargeQuantity ? row.y - 7 : row.y,
      size: isLargeQuantity ? LARGE_QUANTITY_FONT_SIZE : ITEM_FONT_SIZE,
      font: fonts.font,
      color: black,
    });

    page.drawRectangle({
      x: LEFT_X,
      y: row.y - ITEM_LINE_GAP / 2 - 0.375,
      width: lineWidth,
      height: 0.75,
      color: black,
    });
  }

  if (layout.ordersHeader) {
    if (layout.ordersHeader.hasDivider) {
      page.drawRectangle({
        x: LEFT_X,
        y: layout.ordersHeader.y + ORDERS_HEADER_FONT_SIZE + 2,
        width: lineWidth,
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

  const columnWidth = lineWidth / ORDER_COLUMNS;
  for (const row of layout.orderRows) {
    row.names.forEach((name, column) => {
      page.drawText(name, {
        x: LEFT_X + column * columnWidth,
        y: row.y,
        size: ORDER_FONT_SIZE,
        font: fonts.font,
        color: black,
      });
    });
  }
}

function ellipsize(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 3)}...` : text;
}

let cachedFontBytes: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function loadFontBytes(): Promise<{
  regular: Uint8Array;
  bold: Uint8Array;
}> {
  if (!cachedFontBytes) {
    const [regular, bold] = await Promise.all([
      fs.readFile(path.resolve("app/backend/core/fonts/Roboto-Regular.ttf")),
      fs.readFile(path.resolve("app/backend/core/fonts/Roboto-Bold.ttf")),
    ]);
    cachedFontBytes = { regular, bold };
  }
  return cachedFontBytes;
}

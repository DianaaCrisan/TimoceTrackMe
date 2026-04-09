import { PDFDocument } from "pdf-lib";
import { drawRightArrowFooter } from "./drawRightArrowFooter";
import { LineItem } from "../models/LineItem";
import { renderTwoColumnLabel } from "./renderTwoColumnLabel";

const MAX_NAME_CHARS = 60;

type SummaryLineItem = {
  identifier: string;
  quantity: number;
  sku: string | null;
};

const ellipsize = (s: string, max = MAX_NAME_CHARS) =>
  s.length > max ? s.slice(0, max - 3) + "..." : s;

/**
 * Renders the item summary page in EXACTLY the same format as the pickup label.
 * - Items are split across the same two columns.
 * - Optionally shows a label count suffix in the title, e.g., "Items (x3 labels)".
 */
export async function generateSummaryLabelPDF(
  items: LineItem[],
  labelCount: number,
): Promise<Uint8Array> {
  const labelCountSummary = `${labelCount} ${labelCount > 1 ? "Etichete" : "Eticheta"}`;
  const itemCountSummary = `${items.length} ${items.length > 1 ? "tipuri produse" : "tip produs"}`;
  const title = `${labelCountSummary} -> ${itemCountSummary}`;

  // Aggregate & sort
  const rows = toItemRows(items); // [{ id, qty }, ...] sorted

  const firstPageLayout = {
    fontSize: 12,
    titleFontSize: 13,
    titleY: 255,
    startY: 235,
    lineGap: 22,
    bottomMargin: 16,
    rowSeparators: true,
    rightColumnOffset: 150,
  };
  const contPageLayout = {
    fontSize: 12,
    startY: 260,
    lineGap: 22,
    bottomMargin: 16,
    hideTitle: true,
    rowSeparators: true,
    rightColumnOffset: 150,
  };

  const firstCap = Math.max(
    1,
    Math.floor(
      (firstPageLayout.startY - firstPageLayout.bottomMargin) /
        firstPageLayout.lineGap,
    ),
  );
  const contCap = Math.max(
    1,
    Math.floor(
      (contPageLayout.startY - contPageLayout.bottomMargin) /
        contPageLayout.lineGap,
    ),
  );

  const master = await PDFDocument.create();

  // First page slice
  let idx = 0;
  const firstSlice = rows.slice(idx, idx + firstCap);
  idx += firstSlice.length;

  await appendPage(
    firstSlice,
    { title: title, layout: firstPageLayout },
    master,
  );

  // Continuation pages
  while (idx < rows.length) {
    const slice = rows.slice(idx, idx + contCap);
    idx += slice.length;
    await appendPage(slice, { title: "", layout: contPageLayout }, master);
  }

  return await master.save();
}

async function appendPage(
  slice: SummaryLineItem[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cfg: { title: string; layout: any },
  master: PDFDocument,
) {
  const leftLines = slice.map((r) => ({
    prefix: r.sku,
    name: ellipsize(r.identifier),
  }));
  const baseFontSize = cfg.layout?.fontSize ?? 12;
  const rightLines = slice.map((r) => ({
    text: String(r.quantity),
    fontSize: r.quantity > 1 ? baseFontSize + 10 : baseFontSize,
  }));

  const pageBytes = await renderTwoColumnLabel({
    title: cfg.title,
    leftLines,
    rightLines,
    layout: cfg.layout,
  });
  const src = await PDFDocument.load(pageBytes);
  const pages = await master.copyPages(src, src.getPageIndices());

  pages.forEach((p) => {
    const added = master.addPage(p);
    drawRightArrowFooter(added);
  });
}

function toItemRows(items: LineItem[]): SummaryLineItem[] {
  const agg = new Map<string, SummaryLineItem>();

  for (const item of items) {
    const key = item.getKey();
    const sku = item.sku ?? null;
    const identifier = item.name;

    const existing = agg.get(key);
    if (!existing) {
      agg.set(key, { identifier, quantity: item.quantity, sku });
    } else {
      existing.quantity += item.quantity;
    }
  }
  return [...agg.values()]
    .sort((a, b) => a.identifier.localeCompare(b.identifier))
    .map((record) => ({
      identifier: record.identifier,
      quantity: record.quantity,
      sku: record.sku,
    }));
}

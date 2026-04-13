import { PDFDocument, rgb } from "pdf-lib";
import path from "path";
import fs from "fs/promises";
import * as fontkit from "fontkit";

type RenderTwoColumnLabelInput = {
  title: string;
  leftLines: { prefix: string | null; name: string }[]; // prefix can be item SKU for instance
  rightLines?: Array<
    | string
    | {
        text: string;
        fontSize?: number;
      }
  >;
  pageMm?: { w: number; h: number };
  fontPaths?: { regular: string; bold: string }; // allow override in tests
  layout?: {
    fontSize?: number; // default 12
    titleFontSize?: number;
    leftX?: number;
    rightX?: number;
    startY?: number; //  where the rows begin
    titleY?: number; // where the title begins
    lineGap?: number;
    bottomMargin?: number;
    hideTitle?: boolean;
    maxRowsOverride?: number;
    rowSeparators?: boolean;
    rightAlignRightColumn?: boolean;
    rightColumnOffset?: number; // e.g. to adjust for right alignment
  };
};

// cache fonts across calls
let _fontBytes: Uint8Array | null = null;
let _boldFontBytes: Uint8Array | null = null;

export async function renderTwoColumnLabel({
  title,
  leftLines,
  rightLines = [],
  pageMm = { w: 150, h: 100 },
  fontPaths = {
    regular: "app/backend/core/fonts/Roboto-Regular.ttf",
    bold: "app/backend/core/fonts/Roboto-Bold.ttf",
  },
  layout,
}: RenderTwoColumnLabelInput): Promise<Uint8Array> {
  // load fonts once
  if (!_fontBytes || !_boldFontBytes) {
    const regularPath = path.resolve(fontPaths.regular);
    const boldPath = path.resolve(fontPaths.bold);
    _fontBytes = await fs.readFile(regularPath);
    _boldFontBytes = await fs.readFile(boldPath);
  }

  const mmToPt = (mm: number) => mm * 2.83465;
  const width = mmToPt(pageMm.w); // 150mm
  const height = mmToPt(pageMm.h); // 100mm

  const pdfDoc = await PDFDocument.create();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDoc.registerFontkit(fontkit as any);

  const font = await pdfDoc.embedFont(_fontBytes!);
  const boldFont = await pdfDoc.embedFont(_boldFontBytes!);

  const rightXBase = layout?.rightX ?? 220;

  const fontSize = layout?.fontSize ?? 12;
  const nameFontSize = 6; // usually: item name smaller when prefix is present
  const titleFontSize = layout?.titleFontSize ?? 14;
  const leftX = layout?.leftX ?? 20;
  const rightX = Math.min(
    width - 2,
    rightXBase + (layout?.rightColumnOffset ?? 0),
  );
  const titleY = layout?.titleY ?? 180;
  const startY = layout?.startY ?? 150;
  const lineGap = layout?.lineGap ?? 16;
  const bottomMargin = layout?.bottomMargin ?? 20;
  const maxRows =
    layout?.maxRowsOverride ??
    Math.max(1, Math.floor((startY - bottomMargin) / lineGap));

  const page = pdfDoc.addPage([width, height]);

  if (!layout?.hideTitle && title) {
    page.drawText(title, {
      x: leftX,
      y: titleY,
      size: titleFontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
  }

  let y = startY;

  for (
    let i = 0;
    i < Math.min(maxRows, Math.max(leftLines.length, rightLines.length));
    i++
  ) {
    const l = leftLines[i];
    const r = rightLines[i];
    const rightEntry =
      typeof r === "string"
        ? { text: r, fontSize }
        : { text: r?.text ?? "", fontSize: r?.fontSize ?? fontSize };

    if (l) {
      const prefix = (l.prefix ?? "").trim();
      const name = l.name ?? "";

      if (!prefix) {
        // No prefix: render name as before
        page.drawText(name, {
          x: leftX,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      } else {
        // prefix first (normal size)
        const prefixText = `${prefix} `;
        page.drawText(prefixText, {
          x: leftX,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });

        // Then name (smaller size) starting after SKU width
        const prefixWidth = font.widthOfTextAtSize(prefixText, fontSize);
        page.drawText(name, {
          x: leftX + prefixWidth + 10,
          y: y - 1,
          size: nameFontSize,
          font,
          color: rgb(100 / 255, 100 / 255, 100 / 255),
        });
      }
    }

    if (rightEntry.text) {
      page.drawText(rightEntry.text, {
        x: rightX,
        y: rightEntry.fontSize > fontSize ? y - 7 : y,
        size: rightEntry.fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    // horizontal line between rows
    if (layout?.rowSeparators) {
      const thickness = 0.75; // pt
      const x = leftX;
      const w = width - leftX - 20; // span almost full width
      const sepY = y - lineGap / 2 - thickness / 2;
      page.drawRectangle({
        x,
        y: sepY,
        width: w,
        height: thickness,
        color: rgb(0, 0, 0),
      });
    }
    y -= lineGap;
  }

  return await pdfDoc.save();
}

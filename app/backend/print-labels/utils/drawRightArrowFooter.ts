import { rgb, type PDFPage } from "pdf-lib";

export function drawRightArrowFooter(
  page: PDFPage,
  opts?: {
    // distance from bottom edge
    bottomPadding?: number;
    // distance from right edge for the arrow tip
    rightPadding?: number;

    // arrow geometry
    shaftLength?: number; // overall length
    headLength?: number; // how far the head protrudes left
    headHeight?: number; // half height of head

    // stroke
    thickness?: number;
  }
) {
  const {
    bottomPadding = 12,
    rightPadding = 10,
    shaftLength = 70,
    headLength = 18,
    headHeight = 10,
    thickness = 3,
  } = opts ?? {};

  const { width } = page.getSize();

  const y = bottomPadding;
  const tipX = width - rightPadding;
  const tailX = tipX - shaftLength;

  // shaft (stop before head)
  page.drawLine({
    start: { x: tailX, y },
    end: { x: tipX - headLength, y },
    thickness,
    color: rgb(0, 0, 0),
  });

  // head (two diagonals)
  page.drawLine({
    start: { x: tipX - headLength, y },
    end: { x: tipX - headLength * 2, y: y + headHeight },
    thickness,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: tipX - headLength, y },
    end: { x: tipX - headLength * 2, y: y - headHeight },
    thickness,
    color: rgb(0, 0, 0),
  });
}

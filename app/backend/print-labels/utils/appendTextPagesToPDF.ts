import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export async function appendTextPagesToPDF(
  pdfDoc: PDFDocument,
  lines: string[],
): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 14;
  const pageSize: [number, number] = [595.28, 841.89]; // A4 in points
  const lineHeight = 18;
  const margin = 50;
  const usableWidth = pageSize[0] - margin * 2;
  const usableHeight = pageSize[1] - margin * 2;

  // Step 1: Wrap all lines to fit page width
  const splitLines = lines.flatMap((line) => line.split(/\r?\n/));
  const wrappedLines = splitLines.flatMap((line) =>
    wrapText(line, font, fontSize, usableWidth),
  );

  // Step 2: Chunk lines per page
  const linesPerPage = Math.floor(usableHeight / lineHeight);
  const chunks = chunkArray(wrappedLines, linesPerPage);

  // Step 3: Draw lines onto pages
  for (const chunk of chunks) {
    const page = pdfDoc.addPage(pageSize);
    let y = pageSize[1] - margin;
    for (const line of chunk) {
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;
    }
  }
}

// Break a long line into multiple lines that fit the width
function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

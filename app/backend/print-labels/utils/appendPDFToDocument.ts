import { PDFDocument } from "pdf-lib";

/**
 * Loads a PDF buffer and appends all its pages to the target document.
 */
export async function appendPDFToDocument(
  pdfBuffer: Buffer,
  targetDoc: PDFDocument,
): Promise<void> {
  const pdfToMerge = await PDFDocument.load(pdfBuffer);
  const copiedPages = await targetDoc.copyPages(
    pdfToMerge,
    pdfToMerge.getPageIndices(),
  );
  copiedPages.forEach((page) => targetDoc.addPage(page));
}

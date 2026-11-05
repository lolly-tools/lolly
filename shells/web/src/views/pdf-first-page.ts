// SPDX-License-Identifier: MPL-2.0
/** A PDF's first page as a picture, for the approval dialog and review sheet, or null. */
export async function pdfFirstPage(blob: Blob): Promise<Blob | null> {
  const { openPdfFile } = await import('./pdf-import.ts');
  const page = await (await openPdfFile(blob)).pageToSvg(0, { warn: () => {} });
  return page?.svg && page.elementCount ? new Blob([page.svg], { type: 'image/svg+xml' }) : null;
}

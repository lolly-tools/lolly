// SPDX-License-Identifier: MPL-2.0
/** DOM-free PDF/X implementation shared with the CLI; this path stays compatible. */
export { applyPdfX, setPdfxOutputIntent, hasDeviceRgbImage, groupCsOk, shadingCsOk, usedFontsEmbedded } from '@lolly-tools/node-shell/pdfx';
export type { PdfXDocOpts, PdfXLog, PdfXExtra } from '@lolly-tools/node-shell/pdfx';

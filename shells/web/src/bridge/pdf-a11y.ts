// SPDX-License-Identifier: MPL-2.0
import type { PdfAccessibilityReport, PdfAccessibilitySummary } from '@lolly-tools/core/host-v1';
import { summarisePdfAccessibility } from '../../../../engine/src/pdf-accessibility.ts';
import { createPdfA11yKernel, type PdfA11yKernel } from '@lolly-tools/node-shell/pdf-a11y';

let pending: Promise<PdfA11yKernel> | undefined;
/** Fetch and start the PDF accessibility module the first time a PDF is checked. */
export async function loadPdfA11yKernel(): Promise<PdfA11yKernel> {
  if (pending && (await pending.catch(() => undefined))?.retired) pending = undefined;
  pending ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/pdf-a11y/pdf-a11y.wasm', import.meta.url));
    if (!response.ok) throw new Error('The PDF accessibility module could not be loaded.');
    return createPdfA11yKernel(new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}

/** Check a PDF on this device. The module loads on first use and the bytes never leave the page. */
export async function checkPdfAccessibility(bytes: Uint8Array): Promise<PdfAccessibilityReport> {
  return (await loadPdfA11yKernel()).check(bytes);
}

/** The check in Lolly's words, the shape `host.pdf.accessibility` returns. */
export async function summarisedPdfAccessibility(bytes: Uint8Array): Promise<PdfAccessibilitySummary> {
  return summarisePdfAccessibility(await checkPdfAccessibility(bytes));
}

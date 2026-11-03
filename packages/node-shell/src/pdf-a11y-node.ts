// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PdfAccessibilityReport } from '@lolly-tools/core/host-v1';
import { repoRoot } from './repo-root.ts';
import { createPdfA11yKernel, type PdfA11yKernel } from './pdf-a11y.ts';

let pending: Promise<PdfA11yKernel> | undefined;
/** Load the PDF accessibility module once per process. */
export async function loadPdfA11yKernel(): Promise<PdfA11yKernel> {
  if (pending && (await pending.catch(() => undefined))?.retired) pending = undefined;
  pending ??= readFile(new URL('../wasm/pdf-a11y/pdf-a11y.wasm', import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/wasm/pdf-a11y/pdf-a11y.wasm'));
    })
    .then(bytes => createPdfA11yKernel(new Uint8Array(bytes)))
    .catch(error => { pending = undefined; throw error; });
  return pending;
}

/** Check a PDF with the committed module. Rejects with a `PdfAccessibilityError` when the file cannot be read. */
export async function checkPdfAccessibility(bytes: Uint8Array): Promise<PdfAccessibilityReport> {
  return (await loadPdfA11yKernel()).check(bytes);
}

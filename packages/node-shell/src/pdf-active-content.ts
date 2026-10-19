// SPDX-License-Identifier: MPL-2.0
/**
 * pdf-active-content.ts - what a PDF carries that could act when opened elsewhere:
 * its scripts, launch actions and attachments, counted from the structure walk
 * Verify uses (`pdf-structure.ts`). Nothing is run or opened.
 *
 * `lolly read`, `lolly_read` (through `content-inventory.ts`) and the web shell's
 * Read and extract view all call this one function, so a PDF gets the same
 * active-content warnings on every surface. DOM-free and free of `node:*`: pdf-lib
 * is loaded lazily, with the walk, only when a PDF is read.
 */

import type { ActiveContentV1 } from '../../../engine/src/read-extract.ts';

/**
 * The scripts, launch actions and attachments a PDF carries. A file the walk
 * cannot load reports nothing here; the read itself stands on its own.
 */
export async function pdfActiveContent(bytes: Uint8Array): Promise<ActiveContentV1> {
  try {
    const [{ loadPdfDocument }, { scanPdfStructure }] = await Promise.all([import('./pdf-read.ts'), import('./pdf-structure.ts')]);
    const findings = scanPdfStructure(await loadPdfDocument(bytes));
    const leading = (label: string): number => {
      const found = findings.find((f) => f.label === label);
      if (!found) return 0;
      const n = /^(\d+)/.exec(found.detail);
      return n ? Number(n[1]) : 1;
    };
    const out: ActiveContentV1 = {};
    const scripts = leading('JavaScript');
    const launches = leading('Launch actions');
    const embedded = leading('Attachments');
    if (scripts) out.scripts = scripts;
    if (launches) out.launches = launches;
    if (embedded) out.embedded = embedded;
    return out;
  } catch {
    return {};
  }
}

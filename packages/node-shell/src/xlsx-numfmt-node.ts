// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';
import { createXlsxNumfmtKernel, type XlsxNumfmtKernel } from './xlsx-numfmt.ts';
import type { XlsxCellFormatter } from '../../../engine/src/xlsx-import.ts';

let pending: Promise<XlsxNumfmtKernel> | undefined;
/** Load the number-format module once per process. */
export function loadXlsxNumfmtKernel(): Promise<XlsxNumfmtKernel> {
  pending ??= readFile(new URL('../wasm/xlsx-numfmt/xlsx-numfmt.wasm', import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/wasm/xlsx-numfmt/xlsx-numfmt.wasm'));
    })
    .then(bytes => createXlsxNumfmtKernel(new Uint8Array(bytes)))
    .catch(error => { pending = undefined; throw error; });
  return pending;
}
/**
 * The formatter for `readXlsx({ formatCell })`, or undefined when the module cannot be
 * loaded (a packaged install without it): the import then shows cells unformatted.
 */
export async function xlsxFormatter(): Promise<XlsxCellFormatter | undefined> {
  try { return (await loadXlsxNumfmtKernel()).formatCell; } catch { return undefined; }
}

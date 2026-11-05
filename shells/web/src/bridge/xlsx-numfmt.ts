// SPDX-License-Identifier: MPL-2.0
import { createXlsxNumfmtKernel, type XlsxNumfmtKernel } from '@lolly-tools/node-shell/xlsx-numfmt';
import type { XlsxCellFormatter } from '../../../../engine/src/xlsx-import.ts';

let pending: Promise<XlsxNumfmtKernel> | undefined;
/** Fetch and start the number-format module the first time an XLSX file needs number formats. */
export function loadXlsxNumfmtKernel(): Promise<XlsxNumfmtKernel> {
  pending ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/xlsx-numfmt/xlsx-numfmt.wasm', import.meta.url));
    if (!response.ok) throw new Error('The spreadsheet number-format module could not be loaded.');
    return createXlsxNumfmtKernel(new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
/**
 * The formatter for `readXlsx({ formatCell })`, or undefined when the module cannot be
 * loaded: the import then shows cells unformatted, as it did before.
 */
export async function xlsxFormatter(): Promise<XlsxCellFormatter | undefined> {
  try { return (await loadXlsxNumfmtKernel()).formatCell; } catch { return undefined; }
}

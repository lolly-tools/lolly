// SPDX-License-Identifier: MPL-2.0
/** Shared WASM transport for Excel number formats, used by the browser and Node shells. */
import type { XlsxCellFormatRequest, XlsxCellFormatResult, XlsxCellFormatter, XlsxCellKind } from '../../../engine/src/xlsx-import.ts';

const MAX_REQUEST = 16 * 1024 * 1024;
const MAX_RESULT = 40 * 1024 * 1024;
/** The module's own per-request cell cap. */
const MODULE_BATCH = 100_000;
const OP_FORMAT_BATCH = 1;
const KINDS = new Set<string>([
  'general', 'number', 'currency', 'accounting', 'date', 'time', 'percentage',
  'fraction', 'scientific', 'text', 'special', 'custom',
]);

interface NumfmtExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  xlsx_numfmt_alloc(length: number): number;
  xlsx_numfmt_free(pointer: number): void;
  xlsx_numfmt_run(pointer: number, length: number, operation: number): number;
  xlsx_numfmt_result_ptr(): number;
  xlsx_numfmt_result_len(): number;
}
function isApi(e: WebAssembly.Exports): e is NumfmtExports {
  return e.memory instanceof WebAssembly.Memory
    && ['xlsx_numfmt_alloc', 'xlsx_numfmt_free', 'xlsx_numfmt_run', 'xlsx_numfmt_result_ptr', 'xlsx_numfmt_result_len'].every(k => typeof e[k] === 'function');
}
interface WireResult { t: string; k: string; i?: string }

export interface XlsxNumfmtKernel {
  /** Format a batch. Throws when the module refuses the batch. `nowMs` only matters to text that parses as a date without a year. */
  format(cells: XlsxCellFormatRequest[], nowMs?: number): XlsxCellFormatResult[];
  /** The same function as `format`, shaped for `readXlsx({ formatCell })`. */
  formatCell: XlsxCellFormatter;
}

export async function createXlsxNumfmtKernel(wasm: Uint8Array): Promise<XlsxNumfmtKernel> {
  const { instance } = await WebAssembly.instantiate(wasm as Uint8Array<ArrayBuffer>, {});
  if (!isApi(instance.exports)) throw new Error('The number-format module ABI is incompatible.');
  const api = instance.exports;

  function run(request: Uint8Array, operation: number): Uint8Array {
    if (!request.length || request.length > MAX_REQUEST) throw new Error('The number-format request is too large.');
    const pointer = api.xlsx_numfmt_alloc(request.length);
    if (!pointer) throw new Error('The number-format module refused the request allocation.');
    try {
      new Uint8Array(api.memory.buffer, pointer, request.length).set(request);
      const status = api.xlsx_numfmt_run(pointer, request.length, operation);
      const length = api.xlsx_numfmt_result_len(), at = api.xlsx_numfmt_result_ptr();
      if (length > MAX_RESULT || at + length > api.memory.buffer.byteLength) throw new Error('The number-format module returned an oversized response.');
      const out = new Uint8Array(api.memory.buffer, at, length).slice();
      if (status !== 0) throw new Error(new TextDecoder().decode(out));
      return out;
    } finally { api.xlsx_numfmt_free(pointer); }
  }

  function format(cells: XlsxCellFormatRequest[], nowMs?: number): XlsxCellFormatResult[] {
    const results: XlsxCellFormatResult[] = [];
    for (let start = 0; start < cells.length; start += MODULE_BATCH) {
      const slice = cells.slice(start, start + MODULE_BATCH);
      const codes = new Map<string, number>();
      const wire = slice.map(cell => {
        let f = codes.get(cell.formatCode);
        if (f === undefined) { f = codes.size; codes.set(cell.formatCode, f); }
        return { v: cell.value, f, d: cell.dateSystem };
      });
      const body: { now?: number; formats: string[]; cells: typeof wire } = { formats: [...codes.keys()], cells: wire };
      if (nowMs !== undefined && Number.isFinite(nowMs)) body.now = nowMs;
      const decoded = JSON.parse(new TextDecoder().decode(run(new TextEncoder().encode(JSON.stringify(body)), OP_FORMAT_BATCH))) as WireResult[];
      if (!Array.isArray(decoded) || decoded.length !== slice.length) throw new Error('The number-format module returned the wrong number of cells.');
      for (const r of decoded) {
        if (typeof r.t !== 'string' || !KINDS.has(r.k)) throw new Error('The number-format module returned a malformed cell.');
        results.push({ text: r.t, kind: r.k as XlsxCellKind, ...(typeof r.i === 'string' ? { iso: r.i } : {}) });
      }
    }
    return results;
  }
  return { format, formatCell: cells => format(cells) };
}

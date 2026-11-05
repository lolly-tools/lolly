// SPDX-License-Identifier: MPL-2.0
/**
 * calc.ts - the formula engine's request and answer shapes, for any shell.
 *
 * The engine stays wasm-free. A shell loads the gridcraft-calc module and hands
 * this file a `CalcRunner`, a synchronous function that sends one operation's bytes
 * to the module and returns its answer bytes (throwing the module's message when it
 * refuses). Everything else is here: the JSON the module speaks, the clock and
 * random seed it is given, the table convention, and the adapters for `host.calc`
 * and for `readXlsx({ recalc })`.
 *
 * Volatile functions read the clock and seed of the request, so a result carries
 * the clock it used. Keeping that clock with the values freezes them: asking again
 * with the same clock gives the same bytes, and the caller never has to evaluate a
 * second time at export, which would read a different moment.
 */
import type {
  CalcAPI, CalcClockV1, CalcFunctionV1, CalcRequestV1, CalcResultCellV1, CalcResultV1, CalcTableResultV1, CalcTableV1, CalcValueV1,
} from './bridge/host-v1.ts';
import type { XlsxRecalculator } from './xlsx-import.ts';

/** Sends operation `operation` with `request` to the module; returns its answer or throws its message. */
export type CalcRunner = (operation: number, request: Uint8Array) => Uint8Array;

/** The moment and seed a fresh evaluation reads, supplied by the shell. */
export type CalcClockSource = () => CalcClockV1;

export const CALC_OP_EVALUATE = 1;
export const CALC_OP_FUNCTIONS = 2;

/** Most cells a table input is evaluated over, so a pasted sheet cannot starve the page. */
export const CALC_TABLE_MAX_CELLS = 100_000;
const MAX_SEED = Number.MAX_SAFE_INTEGER;

/** A synchronous engine, the common core of `host.calc` and the XLSX recalculation. */
export interface CalcEngine {
  evaluate(request: CalcRequestV1): CalcResultV1;
  table(table: CalcTableV1, options?: { clock?: CalcClockV1 }): CalcTableResultV1;
  functions(): CalcFunctionV1[];
}

function checkClock(clock: CalcClockV1): CalcClockV1 {
  if (!clock || !Number.isFinite(clock.now) || !Number.isSafeInteger(clock.seed) || clock.seed < 0 || clock.seed > MAX_SEED) {
    throw new Error('The calculation clock needs a finite time and a whole-number seed from 0 up.');
  }
  return { now: clock.now, seed: clock.seed };
}

function isValue(v: unknown): v is CalcValueV1 {
  return v === null || typeof v === 'number' && Number.isFinite(v) || typeof v === 'string' || typeof v === 'boolean'
    || typeof v === 'object' && typeof (v as { e?: unknown }).e === 'string';
}

export function createCalcEngine(runner: CalcRunner, source: CalcClockSource): CalcEngine {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const call = (operation: number, body: unknown): unknown => {
    const answer = runner(operation, encoder.encode(JSON.stringify(body)));
    return JSON.parse(decoder.decode(answer));
  };

  function evaluate(request: CalcRequestV1): CalcResultV1 {
    if (!request || !Array.isArray(request.sheets)) throw new Error('A calculation needs a list of sheets.');
    const clock = checkClock(request.clock ?? source());
    const sheets = request.sheets.map(sheet => ({
      name: sheet.name,
      cells: sheet.cells.map(({ legacy, ...cell }) => (legacy === true ? { ...cell, l: true } : cell)),
    }));
    const wire = { now: clock.now, seed: clock.seed, date1904: request.date1904 === true, sheets };
    const answer = call(CALC_OP_EVALUATE, wire) as { sheets?: { cells?: CalcResultCellV1[] }[]; volatile?: boolean; circular?: number };
    if (!Array.isArray(answer.sheets) || answer.sheets.length !== request.sheets.length) throw new Error('The calculation module returned the wrong number of sheets.');
    for (const sheet of answer.sheets) {
      if (!Array.isArray(sheet.cells)) throw new Error('The calculation module returned a malformed sheet.');
      for (const cell of sheet.cells) {
        if (!Number.isInteger(cell.r) || !Number.isInteger(cell.c) || !isValue(cell.v)) throw new Error('The calculation module returned a malformed cell.');
      }
    }
    return { sheets: answer.sheets as { cells: CalcResultCellV1[] }[], volatile: answer.volatile === true, circular: Number(answer.circular) || 0, clock };
  }

  function table(input: CalcTableV1, options: { clock?: CalcClockV1 } = {}): CalcTableResultV1 {
    const { columns, rows } = normaliseTable(input);
    const width = Math.max(columns.length, ...rows.map(r => r.length), 0);
    if ((rows.length + 1) * Math.max(width, 1) > CALC_TABLE_MAX_CELLS) throw new Error('This table is too large to calculate.');
    const cells: { r: number; c: number; v?: CalcValueV1; f?: string }[] = [];
    for (let c = 0; c < columns.length; c++) if (columns[c] !== '') cells.push({ r: 0, c, v: columns[c]! });
    let formulaCount = 0;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]!;
      for (let c = 0; c < row.length; c++) {
        const text = row[c]!;
        if (isFormulaText(text)) { cells.push({ r: r + 1, c, f: text.slice(1) }); formulaCount++; }
        else if (text !== '') cells.push({ r: r + 1, c, v: constantOf(text) });
      }
    }
    const out = rows.map(row => row.slice());
    if (!formulaCount) {
      return { table: { columns: columns.slice(), rows: out }, values: [], errors: [], formulas: 0, volatile: false, clock: checkClock(options.clock ?? source()) };
    }
    const result = evaluate({ sheets: [{ name: 'Table', cells }], ...(options.clock ? { clock: options.clock } : {}) });
    const values: CalcTableResultV1['values'] = [];
    const errors: CalcTableResultV1['errors'] = [];
    for (const cell of result.sheets[0]!.cells) {
      const row = cell.r - 1;
      const text = valueText(cell.v);
      if (row < 0 || row >= out.length) continue;
      const line = out[row]!;
      if (cell.spill) {
        if (cell.c < width && (line[cell.c] ?? '') === '') { while (line.length <= cell.c) line.push(''); line[cell.c] = text; values.push({ row, col: cell.c, v: cell.v }); }
        continue;
      }
      while (line.length <= cell.c) line.push('');
      line[cell.c] = cell.bad !== undefined ? '#NAME?' : text;
      values.push({ row, col: cell.c, v: cell.v });
      if (cell.bad !== undefined) errors.push({ row, col: cell.c, error: '#NAME?' });
      else if (typeof cell.v === 'object' && cell.v !== null) errors.push({ row, col: cell.c, error: cell.v.e });
    }
    return { table: { columns: columns.slice(), rows: out }, values, errors, formulas: formulaCount, volatile: result.volatile, clock: result.clock };
  }

  function functions(): CalcFunctionV1[] {
    const list = call(CALC_OP_FUNCTIONS, {}) as CalcFunctionV1[];
    if (!Array.isArray(list)) throw new Error('The calculation module returned a malformed function list.');
    return list;
  }

  return { evaluate, table, functions };
}

/** The `host.calc` surface over a synchronous engine. */
export function createCalcAPI(engine: CalcEngine): CalcAPI {
  return {
    evaluate: async request => engine.evaluate(request),
    table: async (table, options) => engine.table(table, options),
    functions: async () => engine.functions(),
  };
}

/** The recalculator `readXlsx({ recalc })` takes, backed by an engine. */
export function xlsxRecalculator(engine: CalcEngine): XlsxRecalculator {
  return request => {
    const result = engine.evaluate({ sheets: request.sheets, date1904: request.date1904 });
    return { sheets: result.sheets, volatile: result.volatile };
  };
}

// ─── table convention ────────────────────────────────────────────────────────

/** A cell that is a formula: `=` followed by something. A lone `=` is text. */
export function isFormulaText(text: string): boolean {
  return typeof text === 'string' && text.length > 1 && text.charCodeAt(0) === 0x3d;
}

const PLAIN_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** A table cell as a constant: plain numbers count as numbers, everything else is text. */
function constantOf(text: string): CalcValueV1 {
  if (PLAIN_NUMBER.test(text)) {
    const n = Number(text);
    if (Number.isFinite(n)) return n;
  }
  return text;
}

/** A value as the text a cell shows: numbers to 15 significant digits, as Excel's General format does. */
export function valueText(v: CalcValueV1): string {
  if (v === null) return '';
  if (typeof v === 'number') return String(Number(v.toPrecision(15)));
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string') return v;
  return v.e;
}

function normaliseTable(input: CalcTableV1): CalcTableV1 {
  const columns = Array.isArray(input?.columns) ? input.columns.map(c => String(c ?? '')) : [];
  const rows = Array.isArray(input?.rows) ? input.rows.map(r => (Array.isArray(r) ? r : []).map(c => String(c ?? ''))) : [];
  return { columns, rows };
}

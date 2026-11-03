// SPDX-License-Identifier: MPL-2.0
/**
 * Spreadsheet formulas: the gridcraft-calc WASM module (through the Node loader), the
 * request and table conventions in engine/src/calc.ts, host.calc, and recalculation of
 * an imported XLSX against the results a spreadsheet program saved.
 *
 * Run with: node --test tests/gridcraft-calc.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CalcSheetV1 } from '@lolly-tools/core/host-v1';
import { createCalcAPI, createCalcEngine, isFormulaText, xlsxRecalculator, type CalcRunner } from '../engine/src/calc.ts';
import { readXlsx } from '../engine/src/xlsx-import.ts';
import { compileGridcraftCalc, createGridcraftCalcRunner } from '../packages/node-shell/src/gridcraft-calc.ts';
import { createNodeCalcAPI, loadCalcEngine, xlsxRecalc } from '../packages/node-shell/src/gridcraft-calc-node.ts';
import { buildXlsx, gridDifferences, type BuiltSheet } from './helpers/xlsx-build.ts';

const wasmBytes = new Uint8Array(readFileSync(new URL('../packages/node-shell/wasm/gridcraft-calc/gridcraft-calc.wasm', import.meta.url)));
const module = await compileGridcraftCalc(wasmBytes);
const runner: CalcRunner = createGridcraftCalcRunner(module);
/** 2026-11-03 12:00 UTC. */
const CLOCK = { now: Date.UTC(2026, 10, 3, 12, 0, 0), seed: 42 };
const fixed = createCalcEngine(runner, () => CLOCK);
const NOW_SERIAL = 46329.5;

// ─── the module ──────────────────────────────────────────────────────────────

test('the module imports nothing from the host and exports only its ABI', () => {
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  assert.deepEqual(WebAssembly.Module.exports(module).map(e => e.name).filter(n => n.startsWith('gridcraft_calc_')).sort(),
    ['gridcraft_calc_alloc', 'gridcraft_calc_free', 'gridcraft_calc_result_len', 'gridcraft_calc_result_ptr', 'gridcraft_calc_run']);
});

test('the function library lists the families and marks the volatile ones', () => {
  const list = fixed.functions();
  assert.ok(list.length >= 500, `expected about 500 functions, got ${list.length}`);
  const names = new Set(list.map(f => f.name));
  for (const n of ['SUM', 'VLOOKUP', 'XLOOKUP', 'IF', 'LET', 'LAMBDA', 'FILTER', 'SORT', 'PMT', 'NPV', 'TEXT', 'DATE', 'EOMONTH', 'STDEV.S', 'BIN2DEC']) assert.ok(names.has(n), `${n} is present`);
  assert.deepEqual(list.filter(f => f.volatile).map(f => f.name).sort(), ['CELL', 'INDIRECT', 'INFO', 'NOW', 'OFFSET', 'RAND', 'RANDARRAY', 'RANDBETWEEN', 'TODAY']);
  // Left out to keep the module small: the regular-expression family.
  for (const n of ['REGEXTEST', 'REGEXEXTRACT', 'REGEXREPLACE']) assert.ok(!names.has(n), `${n} is not built in`);
});

test('sheets calculate across references, with errors, booleans and text', () => {
  const r = fixed.evaluate({ sheets: [
    { name: 'Data', cells: [{ r: 0, c: 0, v: 2 }, { r: 1, c: 0, v: 3 }, { r: 2, c: 0, f: 'SUM(A1:A2)' }, { r: 3, c: 0, f: 'A1/0' }] },
    { name: 'Out', cells: [{ r: 0, c: 0, f: 'Data!A3*10' }, { r: 1, c: 0, f: 'IF(Data!A3>4,"big","small")' }, { r: 2, c: 0, f: 'AND(TRUE,Data!A3=5)' }, { r: 3, c: 0, f: 'Data!A4' }] },
  ] });
  assert.deepEqual(r.sheets[0]!.cells.map(c => c.v), [5, { e: '#DIV/0!' }]);
  assert.deepEqual(r.sheets[1]!.cells.map(c => c.v), [50, 'big', true, { e: '#DIV/0!' }]);
  assert.equal(r.volatile, false);
});

test('a dynamic array spills into the cells below it', () => {
  const r = fixed.evaluate({ sheets: [{ name: 'S', cells: [{ r: 0, c: 0, f: 'SEQUENCE(3)' }] }] });
  assert.deepEqual(r.sheets[0]!.cells.map(c => [c.r, c.v, c.spill ?? false]), [[0, 1, false], [1, 2, true], [2, 3, true]]);
});

test('a fixed clock and seed make volatile functions repeatable', () => {
  const cells = [{ r: 0, c: 0, f: 'NOW()' }, { r: 1, c: 0, f: 'TODAY()' }, { r: 2, c: 0, f: 'RAND()' }, { r: 3, c: 0, f: 'RANDBETWEEN(1,1000000)' }, { r: 4, c: 0, f: 'SUM(RANDARRAY(3))' }];
  const request = { sheets: [{ name: 'S', cells }], clock: CLOCK };
  const a = fixed.evaluate(request), b = createCalcEngine(createGridcraftCalcRunner(module), () => ({ now: 0, seed: 0 })).evaluate(request);
  assert.deepEqual(a, b, 'a second instance given the same clock gives the same answer');
  assert.equal(a.sheets[0]!.cells[0]!.v, NOW_SERIAL);
  assert.equal(a.sheets[0]!.cells[1]!.v, 46329);
  assert.equal(a.volatile, true);
  assert.deepEqual(a.clock, CLOCK);
  const other = fixed.evaluate({ sheets: request.sheets, clock: { now: CLOCK.now + 86_400_000, seed: 43 } });
  assert.equal(other.sheets[0]!.cells[0]!.v, NOW_SERIAL + 1);
  assert.notDeepEqual(other.sheets[0]!.cells.slice(2).map(c => c.v), a.sheets[0]!.cells.slice(2).map(c => c.v));
  const rand = a.sheets[0]!.cells[2]!.v as number;
  assert.ok(rand >= 0 && rand < 1);
});

test('a result carries the clock it read, so replaying it reproduces the values', () => {
  const live = createCalcEngine(runner, () => ({ now: Date.UTC(2026, 0, 2), seed: 7 }));
  const request = { sheets: [{ name: 'S', cells: [{ r: 0, c: 0, f: 'RAND()*NOW()' }] }] };
  const first = live.evaluate(request);
  const later = createCalcEngine(runner, () => ({ now: Date.UTC(2030, 0, 1), seed: 99 })).evaluate({ ...request, clock: first.clock });
  assert.deepEqual(later.sheets, first.sheets);
});

test('malformed formulas are reported on their cell and do not stop the others', () => {
  const r = fixed.evaluate({ sheets: [{ name: 'S', cells: [
    { r: 0, c: 0, f: 'SUM(1,' }, { r: 1, c: 0, f: '1+' }, { r: 2, c: 0, f: '"unterminated' }, { r: 3, c: 0, f: 'NOSUCHFUNCTION(1)' }, { r: 4, c: 0, f: '(((' }, { r: 5, c: 0, f: '2+2' },
  ] }] });
  const cells = r.sheets[0]!.cells;
  assert.deepEqual(cells.slice(0, 3).map(c => [typeof c.bad, c.v]), [['string', { e: '#NAME?' }], ['string', { e: '#NAME?' }], ['string', { e: '#NAME?' }]]);
  assert.deepEqual(cells[3]!.v, { e: '#NAME?' });
  assert.equal(cells[3]!.bad, undefined, 'an unknown function parses and evaluates to #NAME?');
  assert.equal(typeof cells[4]!.bad, 'string');
  assert.equal(cells[5]!.v, 4);
});

test('requests the module cannot accept are refused with a message', () => {
  const sheet = (name: string, cells: unknown[] = []) => ({ name, cells: cells as CalcSheetV1['cells'] });
  assert.throws(() => fixed.evaluate({ sheets: [] }), /between 1 and 64 sheets/);
  assert.throws(() => fixed.evaluate({ sheets: [sheet('a/b')] }), /sheet name/);
  assert.throws(() => fixed.evaluate({ sheets: [sheet('x'), sheet('X')] }), /share a name/);
  assert.throws(() => fixed.evaluate({ sheets: [sheet('x', [{ r: 2_000_000, c: 0, v: 1 }])] }), /outside the sheet/);
  assert.throws(() => fixed.evaluate({ sheets: [sheet('x', [{ r: 0, c: 0, v: [1] }])] }), /Invalid request|cannot be a list/);
  assert.throws(() => fixed.evaluate({ sheets: [sheet('x', [{ r: 0, c: 0, f: 'A'.repeat(9000) }])] }), /too long/);
  assert.throws(() => fixed.evaluate({ sheets: [sheet('x')], clock: { now: Number.NaN, seed: 1 } }), /clock/);
  assert.throws(() => fixed.evaluate({ sheets: [sheet('x')], clock: { now: 1, seed: -1 } }), /clock/);
  assert.throws(() => runner(99, new TextEncoder().encode('{}')), /Unknown operation/);
  assert.throws(() => runner(1, new TextEncoder().encode('not json')), /Invalid request/);
  assert.throws(() => runner(1, new Uint8Array(0)), /too large/);
  // The runner is still healthy after refusals.
  assert.equal(fixed.evaluate({ sheets: [sheet('x', [{ r: 0, c: 0, f: '1+1' }])] }).sheets[0]!.cells[0]!.v, 2);
});

test('a deeply nested or very long formula is refused or evaluated, never a trap', () => {
  const deep = '('.repeat(300) + '1' + ')'.repeat(300);
  const chain = Array.from({ length: 2000 }, () => '1').join('+');
  const r = fixed.evaluate({ sheets: [{ name: 'S', cells: [{ r: 0, c: 0, f: deep }, { r: 1, c: 0, f: chain }] }] });
  assert.equal(r.sheets[0]!.cells.length, 2);
  assert.equal(fixed.evaluate({ sheets: [{ name: 'S', cells: [{ r: 0, c: 0, f: '1+1' }] }] }).sheets[0]!.cells[0]!.v, 2);
});

test('circular references are counted, not hung on', () => {
  const r = fixed.evaluate({ sheets: [{ name: 'S', cells: [{ r: 0, c: 0, f: 'B1+1' }, { r: 0, c: 1, f: 'A1+1' }] }] });
  assert.ok(r.circular >= 1);
});

// ─── tables ──────────────────────────────────────────────────────────────────

test('a table input computes cells that start with =, numbering the heading row 1', () => {
  const out = fixed.table({ columns: ['Item', 'Qty', 'Price', 'Total'], rows: [
    ['Seats', '2', '3.5', '=B2*C2'], ['Days', '4', '1,25', '=B3*C3'], ['Sum', '', '', '=SUM(D2:D3)'], ['Text', 'a', '=', '=UPPER(B5)&"!"'],
  ] });
  assert.deepEqual(out.table.rows.map(r => r[3]), ['7', '#VALUE!', '#VALUE!', 'A!']);
  assert.equal(out.table.rows[3]![2], '=', 'a lone = is text');
  assert.equal(out.formulas, 4);
  assert.deepEqual(out.errors.map(e => [e.row, e.col, e.error]), [[1, 3, '#VALUE!'], [2, 3, '#VALUE!']]);
  assert.deepEqual(out.table.columns, ['Item', 'Qty', 'Price', 'Total']);
});

test('a table without formulas comes back unchanged and costs no evaluation', () => {
  let calls = 0;
  const counting = createCalcEngine((op, bytes) => { calls++; return runner(op, bytes); }, () => CLOCK);
  const table = { columns: ['a'], rows: [['1'], ['=']] };
  const out = counting.table(table);
  assert.deepEqual(out.table, table);
  assert.equal(calls, 0);
  assert.equal(out.volatile, false);
});

test('a table shows numbers as General does and keeps the other cells byte for byte', () => {
  const out = fixed.table({ columns: ['x'], rows: [['  07 '], ['=0.1+0.2'], ['=1/3'], ['=2^70'], ['=TRUE'], ['=""'], ['=A2']] });
  assert.deepEqual(out.table.rows.map(r => r[0]), ['  07 ', '0.3', '0.333333333333333', '1.18059162071741e+21', 'TRUE', '', '  07 ']);
});

test('a table with a volatile function reports it, and replaying the clock freezes it', () => {
  const table = { columns: ['when', 'roll'], rows: [['=NOW()', '=RANDBETWEEN(1,6)']] };
  const first = fixed.table(table);
  assert.equal(first.volatile, true);
  const replay = createCalcEngine(runner, () => ({ now: 1, seed: 1 })).table(table, { clock: first.clock });
  assert.deepEqual(replay.table, first.table);
});

test('a table too large to calculate is refused up front', () => {
  const rows = Array.from({ length: 1001 }, () => Array.from({ length: 100 }, () => '1'));
  assert.throws(() => fixed.table({ columns: ['a'], rows }), /too large/);
});

test('isFormulaText', () => {
  assert.deepEqual(['=1', '=', ' =1', 'x=1', ''].map(isFormulaText), [true, false, false, false, false]);
});

// ─── host.calc ───────────────────────────────────────────────────────────────

test('host.calc is async, complete, and rejects instead of throwing', async () => {
  const api = createCalcAPI(fixed);
  assert.deepEqual(Object.keys(api).sort(), ['evaluate', 'functions', 'table']);
  assert.equal((await api.evaluate({ sheets: [{ name: 'S', cells: [{ r: 0, c: 0, f: '6*7' }] }] })).sheets[0]!.cells[0]!.v, 42);
  assert.ok((await api.functions()).length >= 500);
  await assert.rejects(api.evaluate({ sheets: [] }), /between 1 and 64 sheets/);
  const node = createNodeCalcAPI();
  assert.equal((await node.table({ columns: ['a'], rows: [['=1+1']] })).table.rows[0]![0], '2');
});

// ─── XLSX recomputation ──────────────────────────────────────────────────────

/** What a spreadsheet program saved for a small workbook of ordinary formulas. */
function corpus(): BuiltSheet[] {
  const pmt = (r: number, n: number, pv: number): number => (r * pv) / (1 - (1 + r) ** -n);
  return [
    { name: 'Data', cells: [
      { at: 'A1', v: 10 }, { at: 'A2', v: 20 }, { at: 'A3', v: 30 }, { at: 'A4', v: 40 }, { at: 'A5', v: 50 },
      { at: 'B1', v: 'apple' }, { at: 'B2', v: 'banana' }, { at: 'B3', v: 'cherry' }, { at: 'B4', v: 'date' }, { at: 'B5', v: 'elder' },
      { at: 'C1', v: 1.5 }, { at: 'C2', v: 2.5 }, { at: 'C3', v: 3.5 }, { at: 'C4', v: 4.5 }, { at: 'C5', v: 5.5 },
      { at: 'D1', f: 'A1*2', fAttrs: 't="shared" ref="D1:D5" si="0"', v: 20 },
      { at: 'D2', fAttrs: 't="shared" si="0"', v: 40 }, { at: 'D3', fAttrs: 't="shared" si="0"', v: 60 },
      { at: 'D4', fAttrs: 't="shared" si="0"', v: 80 }, { at: 'D5', fAttrs: 't="shared" si="0"', v: 100 },
    ] },
    { name: 'Calc', cells: [
      { at: 'A1', f: 'SUM(Data!A1:A5)', v: 150 },
      { at: 'A2', f: 'AVERAGE(Data!A1:A5)', v: 30 },
      { at: 'A3', f: 'IF(A1>100,"big","small")', v: 'big' },
      { at: 'A4', f: 'VLOOKUP("banana",Data!B1:C5,2,FALSE)', v: 2.5 },
      { at: 'A5', f: 'INDEX(Data!A1:A5,MATCH(30,Data!A1:A5,0))', v: 30 },
      { at: 'A6', f: 'ROUND(PI(),4)', v: Math.round(Math.PI * 1e4) / 1e4 },
      { at: 'A7', f: 'DATE(2024,2,29)+1', v: 45352 },
      { at: 'A8', f: 'TEXT(1234.5,"#,##0.00")', v: '1,234.50' },
      { at: 'A9', f: '"x"&"y"&LEN("hello")', v: 'xy5' },
      { at: 'A10', f: '1/0', v: { e: '#DIV/0!' } },
      { at: 'A11', f: 'IFERROR(1/0,"n/a")', v: 'n/a' },
      { at: 'A12', f: 'AND(TRUE,FALSE)', v: false },
      { at: 'A13', f: 'SUMIF(Data!A1:A5,">25")', v: 120 },
      { at: 'A14', f: 'COUNTIF(Data!A1:A5,">=30")', v: 3 },
      { at: 'A15', f: 'PMT(0.05/12,360,-200000)', v: pmt(0.05 / 12, 360, 200000) },
      { at: 'A16', f: 'SUM(Data!D1:D5)', v: 300 },
      { at: 'A17', f: 'MAX(Data!C1:C5)-MIN(Data!C1:C5)', v: 4 },
      { at: 'A18', f: 'UPPER(Data!B3)', v: 'CHERRY' },
      { at: 'A19', f: 'EOMONTH(DATE(2024,1,15),1)', v: 45351 },
      { at: 'A20', f: 'MEDIAN(Data!A1:A5)', v: 30 },
      { at: 'A21', f: 'STDEV.S(Data!A1:A5)', v: Math.sqrt(250) },
      { at: 'A22', f: 'XLOOKUP(40,Data!A1:A5,Data!B1:B5)', v: 'date' },
      { at: 'A23', f: 'SUMPRODUCT(Data!A1:A5,Data!C1:C5)', v: 10 * 1.5 + 20 * 2.5 + 30 * 3.5 + 40 * 4.5 + 50 * 5.5 },
      { at: 'B1', v: 'label' },
    ] },
  ];
}

test('recomputation matches the values a spreadsheet saved', () => {
  const file = buildXlsx(corpus());
  const recalc = xlsxRecalculator(fixed);
  for (const index of [0, 1]) {
    const saved = readXlsx(file, { sheet: index });
    const fresh = readXlsx(file, { sheet: index, recalc });
    assert.deepEqual(gridDifferences(saved.rows, fresh.rows), [], `sheet ${index}`);
    assert.equal(fresh.recalc?.failed, undefined);
    assert.equal(fresh.recalc?.volatile, false);
  }
  const calc = readXlsx(file, { sheet: 'Calc', recalc });
  assert.equal(calc.recalc?.formulas, 28, 'formulas counts the whole workbook');
  assert.equal(calc.recalc?.recomputed, 23);
  assert.equal(calc.recalc?.kept, 0);
  assert.equal(readXlsx(file, { sheet: 'Data', recalc }).recalc?.recomputed, 5, 'the shared formula cells are recomputed too');
});

test('recomputation corrects stale values and fills formulas saved without one', () => {
  const file = buildXlsx([{ name: 'S', cells: [
    { at: 'A1', v: 4 }, { at: 'A2', f: 'A1*A1', v: 999 }, { at: 'A3', f: 'A2+1' }, { at: 'A4', f: 'TEXT(A3,"0.0")' },
  ] }]);
  assert.deepEqual(readXlsx(file).rows.map(r => r[0]), ['4', '999'], 'saved results alone: the stale value shows and the others are empty');
  const fresh = readXlsx(file, { recalc: xlsxRecalculator(fixed) });
  assert.deepEqual(fresh.rows.map(r => r[0]), ['4', '16', '17', '17.0']);
});

test('recomputation honours number formats on the recomputed value', () => {
  const file = buildXlsx([{ name: 'S', cells: [{ at: 'A1', v: 0.25 }, { at: 'A2', f: 'A1*2', v: 0.5 }] }]);
  const seen: unknown[] = [];
  const out = readXlsx(file, { recalc: xlsxRecalculator(fixed), formatCell: cells => { seen.push(...cells); return cells.map(c => ({ text: String(c.value), kind: 'general' as const })); } });
  assert.deepEqual(out.rows.map(r => r[0]), ['0.25', '0.5']);
  assert.ok(Array.isArray(seen));
});

test('volatile formulas take the moment of the read and are reported', () => {
  const file = buildXlsx([{ name: 'S', cells: [{ at: 'A1', f: 'NOW()', v: 1 }, { at: 'A2', f: 'A1+1', v: 2 }] }]);
  const a = readXlsx(file, { recalc: xlsxRecalculator(fixed) });
  assert.deepEqual(a.rows.map(r => r[0]), [String(NOW_SERIAL), String(NOW_SERIAL + 1)]);
  assert.equal(a.recalc?.volatile, true);
  const b = readXlsx(file, { recalc: xlsxRecalculator(createCalcEngine(runner, () => ({ now: CLOCK.now + 3_600_000, seed: 1 }))) });
  assert.notDeepEqual(b.rows, a.rows, 'a later clock gives later values');
  assert.deepEqual(readXlsx(file, { recalc: xlsxRecalculator(fixed) }).rows, a.rows, 'the same clock gives the same values');
});

test('the 1904 date system reaches the calculator', () => {
  const file = buildXlsx([{ name: 'S', cells: [{ at: 'A1', f: 'DATE(2024,1,1)', v: 43830 }] }], { date1904: true });
  assert.deepEqual(gridDifferences(readXlsx(file).rows, readXlsx(file, { recalc: xlsxRecalculator(fixed) }).rows), []);
});

test('array formulas keep their saved result and are counted', () => {
  const file = buildXlsx([{ name: 'S', cells: [
    { at: 'A1', v: 1 }, { at: 'A2', v: 2 },
    { at: 'B1', f: 'A1:A2*2', fAttrs: 't="array" ref="B1:B2"', v: 2 }, { at: 'B2', v: 4 },
    { at: 'C1', f: 'SUM(B1:B2)', v: 6 },
  ] }]);
  const out = readXlsx(file, { recalc: xlsxRecalculator(fixed) });
  assert.deepEqual(out.rows, [['1', '2', '6'], ['2', '4', '']]);
  assert.equal(out.recalc?.kept, 1);
  assert.equal(out.recalc?.recomputed, 1);
});

test('cells: formulas still returns formula text, and recalc leaves it alone', () => {
  const file = buildXlsx([{ name: 'S', cells: [{ at: 'A1', v: 2 }, { at: 'A2', f: 'A1*3', v: 6 }] }]);
  const out = readXlsx(file, { cells: 'formulas', recalc: xlsxRecalculator(fixed) });
  assert.deepEqual(out.rows.map(r => r[0]), ['2', '=A1*3']);
  assert.equal(out.recalc, undefined);
});

test('a calculator that fails keeps the saved results and says why', () => {
  const file = buildXlsx([{ name: 'S', cells: [{ at: 'A1', v: 2 }, { at: 'A2', f: 'A1*3', v: 6 }] }]);
  const throwing = readXlsx(file, { recalc: () => { throw new Error('no module'); } });
  assert.deepEqual(throwing.rows.map(r => r[0]), ['2', '6']);
  assert.equal(throwing.recalc?.failed, 'no module');
  const malformed = readXlsx(file, { recalc: () => ({ sheets: [], volatile: false }) });
  assert.deepEqual(malformed.rows.map(r => r[0]), ['2', '6']);
  assert.match(malformed.recalc?.failed ?? '', /malformed/);
  assert.equal(readXlsx(file).recalc, undefined, 'a read without recalc is unchanged');
});

test('a formula that does not parse shows #NAME? and is counted', () => {
  const file = buildXlsx([{ name: 'S', cells: [{ at: 'A1', f: 'SUM(1,', v: 3 }, { at: 'A2', f: '1+1', v: 2 }] }]);
  const out = readXlsx(file, { recalc: xlsxRecalculator(fixed) });
  assert.deepEqual(out.rows.map(r => r[0]), ['#NAME?', '2']);
  assert.equal(out.recalc?.unparsed, 1);
});

test('the Node loader gives a recalculator that works on a real read', async () => {
  const recalc = await xlsxRecalc();
  assert.ok(recalc);
  const file = buildXlsx([{ name: 'S', cells: [{ at: 'A1', f: '2^10', v: 0 }] }]);
  assert.equal(readXlsx(file, { recalc }).rows[0]![0], '1024');
  assert.ok(await loadCalcEngine());
});

test('recalcWhen missing computes only what the file saved no result for', () => {
  const file = buildXlsx([{ name: 'S', cells: [
    { at: 'A1', v: 4 },
    { at: 'A2', f: 'A1*A1', v: 999 },       // saved, stale: stands as the author saw it
    { at: 'A3', f: 'A2+1' },                 // not saved: computed from the saved 999
    { at: 'A4', f: 'NOW()', v: 1 },          // saved: not re-read at the moment of import
  ] }]);
  const out = readXlsx(file, { recalc: xlsxRecalculator(fixed), recalcWhen: 'missing' });
  assert.deepEqual(out.rows.map(r => r[0]), ['4', '999', '1000', '1']);
  assert.equal(out.recalc?.recomputed, 1);
  assert.equal(out.recalc?.kept, 2);
  assert.equal(out.recalc?.volatile, false);
  const all = readXlsx(file, { recalc: xlsxRecalculator(fixed) });
  assert.deepEqual(all.rows.map(r => r[0]), ['4', '16', '17', String(NOW_SERIAL)]);
});

test('formulas with table or workbook references keep their saved result', () => {
  const file = buildXlsx([{ name: 'S', cells: [
    { at: 'A1', f: 'SUM(Table1[Amount])', v: 10 }, { at: 'A2', f: "'[1]Other'!A1+1", v: 5 }, { at: 'A3', f: 'LEN("[brackets]")', v: 0 },
  ] }]);
  const out = readXlsx(file, { recalc: xlsxRecalculator(fixed) });
  assert.deepEqual(out.rows.map(r => r[0]), ['10', '5', '10'], 'a bracket inside text does not count as a reference');
  assert.equal(out.recalc?.kept, 2);
});

test('formulas saved without the dynamic-array mark intersect ranges as the file did', () => {
  const file = buildXlsx([{ name: 'S', cells: [
    { at: 'A1', v: 1 }, { at: 'A2', v: 2 }, { at: 'A3', v: 3 },
    { at: 'B2', f: 'A1:A3', v: 2 }, { at: 'C2', f: 'A1:A3*10', v: 20 },
  ] }]);
  const out = readXlsx(file, { recalc: xlsxRecalculator(fixed) });
  assert.deepEqual(gridDifferences(readXlsx(file).rows, out.rows), []);
  assert.deepEqual(out.rows[1], ['2', '2', '20']);
});

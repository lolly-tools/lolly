// SPDX-License-Identifier: MPL-2.0
/**
 * The `table` input type — value normalization, the single-param compact URL
 * codec, and engine-driven pagination (render.paginate).
 *
 * A table's columns AND rows are user data (unlike blocks, whose fields are
 * manifest-declared): the paste round-trip with spreadsheets is the batch-edit
 * story, so the codec must survive prose cells full of commas, tildes, percent
 * signs, and newlines without falling back to JSON.
 *
 * Run with: node --test tests/table-input.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInputModel, updateInput, normalizeTableValue,
} from '../engine/src/inputs.ts';
import type { InputSpec, TableValue } from '../engine/src/inputs.ts';
import {
  encodeTableCompact, decodeTableCompact, parseUrlState, serializeUrlState,
} from '../engine/src/url-mode.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const BATTLE: TableValue = {
  columns: ['Pain', 'Summary', 'SolutionName', 'CompetitorName', 'Strategy'],
  rows: [
    ['Assurance', 'Is it open?', 'Yes', 'Yes', 'Table stakes, compete with why'],
    ['Provenance', "Where's it made?", 'Europe', 'North America', 'Local advantage, global-qualify'],
    ['Jurisdiction', 'What laws impact it?', 'Good laws', 'Risky laws', 'Readiness play, compliance framework'],
    ['Reversibility', 'Easy to leave?', 'By design', 'Walled garden', 'Real choice means you can act'],
  ],
};

const tableInput = (extra: Partial<InputSpec> = {}): InputSpec =>
  ({ id: 'data', type: 'table', ...extra } as InputSpec);

// ── normalizeTableValue ──────────────────────────────────────────────────────

test('normalizeTableValue accepts a well-formed grid unchanged', () => {
  assert.deepEqual(normalizeTableValue(BATTLE), BATTLE);
});

test('normalizeTableValue pads and truncates ragged rows to the column count', () => {
  const v = normalizeTableValue({
    columns: ['A', 'B', 'C'],
    rows: [['1'], ['1', '2', '3', '4'], []],
  });
  assert.deepEqual(v, {
    columns: ['A', 'B', 'C'],
    rows: [['1', '', ''], ['1', '2', '3'], ['', '', '']],
  });
});

test('normalizeTableValue stringifies scalar cells and blanks non-scalars', () => {
  const v = normalizeTableValue({
    columns: ['A', 2, true],
    rows: [[1, false, { evil: 1 }], ['x', null, ['y']]],
  });
  assert.deepEqual(v, {
    columns: ['A', '2', 'true'],
    rows: [['1', 'false', ''], ['x', '', '']],
  });
});

test('normalizeTableValue rejects non-table shapes', () => {
  for (const bad of [null, undefined, 'x', 42, [], { columns: 'a', rows: [] }, { rows: [] }, { columns: [] }]) {
    assert.equal(normalizeTableValue(bad), null, JSON.stringify(bad));
  }
  // Non-array rows entries are dropped, not crashed on.
  assert.deepEqual(
    normalizeTableValue({ columns: ['A'], rows: [['1'], 'junk', null] }),
    { columns: ['A'], rows: [['1']] },
  );
});

// ── input model ──────────────────────────────────────────────────────────────

test('table input defaults to an empty grid and picks the table control', () => {
  const model = buildInputModel({ inputs: [tableInput()] });
  assert.equal(model[0]!.control, 'table');
  assert.deepEqual(model[0]!.value, { columns: [], rows: [] });
});

test('table input resolves a declared default and normalizes initial values', () => {
  const withDefault = buildInputModel({ inputs: [tableInput({ default: BATTLE })] });
  assert.deepEqual(withDefault[0]!.value, BATTLE);

  const ragged = { columns: ['A', 'B'], rows: [['1']] };
  const fromInitial = buildInputModel(
    { inputs: [tableInput({ default: BATTLE })] },
    { initial: { data: ragged } },
  );
  assert.deepEqual(fromInitial[0]!.value, { columns: ['A', 'B'], rows: [['1', '']] });
  // Garbage initial falls back to the declared default, not a blank grid.
  const fromGarbage = buildInputModel(
    { inputs: [tableInput({ default: BATTLE })] },
    { initial: { data: 'not-a-table' } },
  );
  assert.deepEqual(fromGarbage[0]!.value, BATTLE);
});

test('updateInput normalizes a table write and rejects garbage', () => {
  let model = buildInputModel({ inputs: [tableInput({ default: BATTLE })] });
  model = updateInput(model, 'data', { columns: ['A'], rows: [['x', 'overflow']] });
  assert.deepEqual(model[0]!.value, { columns: ['A'], rows: [['x']] });
  model = updateInput(model, 'data', 'garbage');
  assert.deepEqual(model[0]!.value, { columns: ['A'], rows: [['x']] }, 'garbage keeps prior value');
});

// ── compact codec ────────────────────────────────────────────────────────────

test('compact codec round-trips the battlecards fixture (commas in prose)', () => {
  const enc = encodeTableCompact(BATTLE);
  assert.deepEqual(decodeTableCompact(enc), BATTLE);
});

test('compact codec survives separator and escape characters inside cells', () => {
  const nasty: TableValue = {
    columns: ['A,B', 'C~D', 'E%F', 'G|H'],
    rows: [
      ['comma, tilde~ and 100% of it', 'line\nbreak', 'pipe|cell', 'trailing '],
      ['', '~', ',', '%'],
    ],
  };
  assert.deepEqual(decodeTableCompact(encodeTableCompact(nasty)), nasty);
});

test('decodeTableCompact degrades gracefully on hand-edited input', () => {
  // A raw comma folds overflow into the last cell instead of shifting fields.
  assert.deepEqual(decodeTableCompact('A,B~1,2,3'), {
    columns: ['A', 'B'], rows: [['1', '2,3']],
  });
  // A malformed %-escape keeps the raw text rather than aborting.
  assert.deepEqual(decodeTableCompact('A~100%'), {
    columns: ['A'], rows: [['100%']],
  });
  assert.deepEqual(decodeTableCompact(''), { columns: [], rows: [] });
});

// ── URL state round trip ─────────────────────────────────────────────────────

test('table value round-trips through serializeUrlState → parseUrlState as ONE param', () => {
  const manifest = { inputs: [tableInput()] };
  const model = updateInput(buildInputModel(manifest), 'data', BATTLE);
  const qs = serializeUrlState(model);
  assert.equal([...new URLSearchParams(qs).keys()].length, 1, 'exactly one param');
  const parsed = parseUrlState(qs, manifest);
  assert.deepEqual(parsed.values.data, BATTLE);
});

test('an empty table is omitted from the URL entirely', () => {
  const model = buildInputModel({ inputs: [tableInput()] });
  assert.equal(serializeUrlState(model), '');
});

test('parseUrlState also accepts the JSON form', () => {
  const manifest = { inputs: [tableInput()] };
  const params = new URLSearchParams();
  params.set('data', JSON.stringify(BATTLE));
  assert.deepEqual(parseUrlState(params, manifest).values.data, BATTLE);
  params.set('data', '{broken json');
  assert.deepEqual(parseUrlState(params, manifest).values.data, { columns: [], rows: [] });
});

test('table param respects urlKey aliases', () => {
  const manifest = { inputs: [tableInput({ urlKey: 't' })] };
  const parsed = parseUrlState(`t=${encodeURIComponent(encodeTableCompact(BATTLE))}`, manifest);
  assert.deepEqual(parsed.values.data, BATTLE);
});

// ── render.paginate ──────────────────────────────────────────────────────────

const PAGINATED_TOOL = {
  manifest: {
    id: 'test-battlecards',
    name: 'Test Battlecards',
    version: '1.0.0',
    engineVersion: '>=1.0.0',
    status: 'community',
    inputs: [tableInput({ default: BATTLE })],
    render: { width: 800, height: 600, formats: ['pdf'], paged: true, paginate: { source: 'data' } },
  },
  template: [
    '<article class="card">',
    '<h1>{{page.first}}</h1>',
    '<p class="pageno">{{page.number}}/{{page.count}}</p>',
    '{{#each page.fields}}<dl><dt>{{column}}</dt><dd>{{value}}</dd></dl>{{/each}}',
    '</article>',
  ].join(''),
  styles: null,
  hooks: null,
} as never;

test('render.paginate emits one [data-pdf-page] box per table row', async () => {
  const runtime = await createRuntime(PAGINATED_TOOL, baseHost());
  const html = runtime.getHydrated();
  const pages = html.match(/data-pdf-page/g) ?? [];
  assert.equal(pages.length, BATTLE.rows.length);
  assert.match(html, /<h1>Assurance<\/h1>/);
  assert.match(html, /<h1>Reversibility<\/h1>/);
  assert.match(html, /<p class="pageno">4\/4<\/p>/);
  // Column headings become the field labels; the first column never repeats
  // into the body fields.
  assert.match(html, /<dt>Strategy<\/dt><dd>Table stakes, compete with why<\/dd>/);
  assert.doesNotMatch(html, /<dt>Pain<\/dt>/);
});

test('render.paginate with zero rows still emits one page', async () => {
  const runtime = await createRuntime(PAGINATED_TOOL, baseHost());
  await runtime.setInput('data', { columns: ['A'], rows: [] });
  const html = runtime.getHydrated();
  assert.equal((html.match(/data-pdf-page/g) ?? []).length, 1);
  assert.match(html, /<p class="pageno">1\/1<\/p>/);
});

// Cells carry markdown (battlecards 1.1.0): the engine's {{markdown}} helper runs
// per cell inside the paginated hydration, so a pasted spreadsheet cell can bring
// structure — lists, emphasis, links, images — with no hook in the tool.
const MD_TOOL = {
  ...(PAGINATED_TOOL as object),
  template: '<article>{{#each page.fields}}<div class="v">{{{markdown value}}}</div>{{/each}}</article>',
} as never;

test('render.paginate: cell markdown is rendered per cell, per page', async () => {
  const runtime = await createRuntime(MD_TOOL, baseHost());
  await runtime.setInput('data', {
    columns: ['Pain', 'Detail'],
    rows: [
      ['Assurance', 'Is it **open**?'],
      ['Exit', '- leave anytime\n- [docs](https://lolly.tools/d)'],
      ['Proof', '# Heading\n![seal](/seal.svg)'],
    ],
  });
  const html = runtime.getHydrated();
  assert.equal((html.match(/data-pdf-page/g) ?? []).length, 3);
  assert.match(html, /<div class="v"><p>Is it <strong>open<\/strong>\?<\/p><\/div>/);
  assert.match(html, /<ul><li>leave anytime<\/li><li><a href="https:\/\/lolly\.tools\/d">docs<\/a><\/li><\/ul>/);
  assert.match(html, /<h1>Heading<\/h1><p><img class="md-image" src="\/seal\.svg" alt="seal"><\/p>/);
});

// Cell addressing + by-name lookup (engine 1.82.0): `col` is the ORIGINAL column
// index (stable even when the template skips columns), and page.byColumn lets a
// template pull a named column's cell with the built-in lookup helper.
const ADDR_TOOL = {
  ...(PAGINATED_TOOL as object),
  template: [
    '<article data-cell="{{page.index}}:0">',
    '{{#each page.fields}}<div data-cell="{{../page.index}}:{{col}}">{{value}}</div>{{/each}}',
    '<span class="icon">{{lookup page.byColumn "icon"}}</span>',
    '</article>',
  ].join(''),
} as never;

test('render.paginate: fields carry their original column index as col', async () => {
  const runtime = await createRuntime(ADDR_TOOL, baseHost());
  await runtime.setInput('data', {
    columns: ['Name', 'Icon', 'Detail'],
    rows: [['Alpha', 'star', 'first'], ['Beta', 'moon', 'second']],
  });
  const html = runtime.getHydrated();
  assert.match(html, /<article data-cell="0:0">/);
  assert.match(html, /<div data-cell="0:1">star<\/div><div data-cell="0:2">first<\/div>/);
  assert.match(html, /<div data-cell="1:1">moon<\/div><div data-cell="1:2">second<\/div>/);
});

test('render.paginate: page.byColumn matches column names case-insensitively', async () => {
  const runtime = await createRuntime(ADDR_TOOL, baseHost());
  await runtime.setInput('data', {
    columns: ['Name', ' ICON ', 'Detail'],
    rows: [['Alpha', 'star', 'first']],
  });
  const html = runtime.getHydrated();
  assert.match(html, /<span class="icon">star<\/span>/);
});

test('render.paginate: page.byColumn is proto-safe and absent columns read empty', async () => {
  const runtime = await createRuntime(ADDR_TOOL, baseHost());
  await runtime.setInput('data', {
    columns: ['Name', 'constructor'],
    rows: [['Alpha', 'not-a-function']],
  });
  const html = runtime.getHydrated();
  // No "icon" column → the lookup renders empty, never an inherited object.
  assert.match(html, /<span class="icon"><\/span>/);
});

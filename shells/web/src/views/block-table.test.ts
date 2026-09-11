// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildInputModel } from '../../../../engine/src/inputs.ts';
import { parseUrlState, serializeUrlState } from '../../../../engine/src/url-mode.ts';
import {
  inputTableValue,
  tableInputValue,
  inheritTableSources,
  parseInputTable,
} from './block-table.ts';
import { tableInputHtml } from './table-input-html.ts';

const manifest = JSON.parse(
  readFileSync(new URL('../../../../community/timezone/tool.json', import.meta.url), 'utf8')
);
const input = (locations?: unknown) =>
  buildInputModel(manifest, {
    initial: locations === undefined ? {} : { locations: locations as never },
  }).find((i) => i.id === 'locations')!;
const emptyRow = () => ({ _id: 'new' });

test('fixed table changes presentation while keeping legacy URLs and object field order', () => {
  const rows = [
    {
      _id: 'one',
      label: 'Studio',
      place: 'Europe/London',
      annotation: 'Main',
      spread: true,
      longitude: '0',
      latitude: '0',
    },
  ];
  const model = input(rows);
  assert.equal(model.type, 'blocks');
  assert.equal(model.control, 'table');
  assert.deepEqual(model.value, rows);
  assert.equal(model.fields?.[0]?.id, 'label');
  assert.equal(inputTableValue(model).columns[0], 'City');
  const parsed = parseUrlState(new URLSearchParams(serializeUrlState([model])), manifest);
  assert.equal((parsed.values.locations as any[])[0].place, 'Europe/London');
  const html = tableInputHtml(model);
  assert.match(html, /data-table-fixed/);
  assert.doesNotMatch(html, /data-table-add-col|data-table-del-col/);
});

test('editing, deleting and reordering preserve row identity, metadata and untouched values', () => {
  const rows = [
    {
      _id: 'first',
      place: 'London, GB',
      spread: false,
      color: { ref: '{color.semantic.primary}', value: '#123456' },
      metadata: { kept: true },
    },
    { _id: 'second', place: 'Noosa, AU', longitude: 0, latitude: 0, spread: true },
    { _id: 'third', place: 'Sofia, BG' },
  ];
  const model = input(rows),
    table = inputTableValue(model);
  const read = inheritTableSources(structuredClone(table), table);
  read.rows[0]![2] = 'New note';
  read.rows.splice(1, 1);
  read.rows.reverse();
  const result = tableInputValue(model, read, emptyRow) as any[];
  assert.equal(result[0]._id, 'third');
  assert.equal(result[1]._id, 'first');
  assert.deepEqual(result[1].metadata, { kept: true });
  assert.deepEqual(result[1].color, rows[0]!.color);
  assert.equal(result[1].spread, false);
  assert.equal(result[1].annotation, 'New note');
  assert.equal(rows[0]!.place, 'London, GB');
});

test('paste accepts city lists and spreadsheet columns without losing the first city', () => {
  const model = input();
  const list = parseInputTable('London, GB\nNuremberg, DE\nNoosa, Australia', model)!;
  // Comma-qualified names are city cells, not a two-column CSV without headers.
  assert.deepEqual(
    list.rows.map((r) => r[0]),
    ['London, GB', 'Nuremberg, DE', 'Noosa, Australia']
  );
  const sheet = parseInputTable(
    'Note\tCity\tFill region\nHost\tLondon, GB\tyes\nGuest\tNoosa, AU\tno',
    model
  )!;
  const rows = tableInputValue(model, sheet, emptyRow) as any[];
  assert.equal(rows[0].place, 'London, GB');
  assert.equal(rows[0].annotation, 'Host');
  assert.equal(rows[0].spread, true);
  assert.equal(rows[1].spread, false);
  assert.equal(rows[0]._id, 'new');
  assert.equal(parseInputTable('City\tUnknown\nLondon\tKeep me', model), null);
});

test('empty saved tables remain empty; fresh defaults have the six examples', () => {
  assert.equal(inputTableValue(input()).rows.length, 6);
  assert.deepEqual(inputTableValue(input([])).rows, []);
  assert.deepEqual(tableInputValue(input(), { columns: [], rows: [] }, emptyRow), []);
});

test('large rosters use the shared virtualized grid and ordinary tables remain editable', () => {
  const large = input(
    Array.from({ length: 1000 }, (_, i) => ({ _id: String(i), place: 'Europe/London' }))
  );
  const html = tableInputHtml(large);
  assert.match(html, /data-table-vgrid/);
  assert.doesNotMatch(html, /<textarea/);
  const ordinary = buildInputModel({
    inputs: [{ id: 'data', type: 'table', default: { columns: ['Title'], rows: [['One']] } }],
  })[0]!;
  assert.match(tableInputHtml(ordinary), /data-table-add-col/);
  assert.deepEqual(tableInputValue(ordinary, inputTableValue(ordinary), emptyRow), ordinary.value);
});

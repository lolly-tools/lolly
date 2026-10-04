// SPDX-License-Identifier: MPL-2.0
/**
 * The Design authoring contract (plan 291, W5):
 * schemas/design-authoring-v1.schema.json against the TypeScript it mirrors in
 * packages/core/src/design-authoring-v1.ts, and against what the engine's
 * expandDesignAuthoring accepts.
 *
 * Same pattern as the content inventory contract test: each exported const array
 * is compared with its $defs enum element by element. The public authoring fixture
 * validates, its expansion (plain rows) validates too, and the shapes the engine
 * refuses are refused by the schema wherever a schema can express the rule.
 *
 * Run with: node --test "tests/design-authoring-contract.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import * as authoring from '../packages/core/src/design-authoring-v1.ts';
import * as core from '../packages/core/src/index.ts';
import { expandDesignAuthoringDocument } from '../engine/src/design-authoring.ts';
import { textStylesFromBrief } from '../engine/src/design-text-style.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Json = Record<string, unknown>;
const readJson = (rel: string): Json => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Json;

const SCHEMA = readJson('schemas/design-authoring-v1.schema.json');
const DEFS = SCHEMA.$defs as Record<string, Json>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validate = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);
const ok = (doc: unknown, label: string): void => {
  assert.equal(validate(doc), true, `${label}: ${JSON.stringify(validate.errors, null, 2)}`);
};
const refused = (doc: unknown, label: string): void => {
  assert.equal(validate(doc), false, `${label} should be refused`);
};

const PINNED: Array<[string, readonly unknown[], string]> = [
  ['DESIGN_AUTHORING_ROW_KEYS', authoring.DESIGN_AUTHORING_ROW_KEYS, 'rowKey'],
  ['DESIGN_AUTHORING_PATH_KEYS', authoring.DESIGN_AUTHORING_PATH_KEYS, 'pathKey'],
  ['DESIGN_AUTHORING_PATCH_KEYS', authoring.DESIGN_AUTHORING_PATCH_KEYS, 'patchKey'],
  ['DESIGN_AUTHORING_MACROS', authoring.DESIGN_AUTHORING_MACROS, 'macroKey'],
  ['DESIGN_AUTHORING_DOCUMENT_KEYS', authoring.DESIGN_AUTHORING_DOCUMENT_KEYS, 'documentKey'],
  ['DESIGN_TEXT_STYLE_IDS', authoring.DESIGN_TEXT_STYLE_IDS, 'textStyleId'],
  ['DESIGN_TEXT_STYLE_FIELDS', authoring.DESIGN_TEXT_STYLE_FIELDS, 'textStyleField'],
  ['DESIGN_TEXT_ALIGNS', authoring.DESIGN_TEXT_ALIGNS, 'align'],
  ['DESIGN_TEXT_VALIGNS', authoring.DESIGN_TEXT_VALIGNS, 'valign'],
  ['DESIGN_PATH_CURVES', authoring.DESIGN_PATH_CURVES, 'curve'],
  ['DESIGN_STACK_AXES', authoring.DESIGN_STACK_AXES, 'stackAxis'],
  ['DESIGN_GRID_ORDERS', authoring.DESIGN_GRID_ORDERS, 'gridOrder'],
  ['DESIGN_TEMPLATE_ANCHORS', authoring.DESIGN_TEMPLATE_ANCHORS, 'anchor'],
  ['DESIGN_AUTHORING_NOTE_CODES', authoring.DESIGN_AUTHORING_NOTE_CODES, 'noteCode'],
];

test('every exported vocabulary matches its schema enum element by element', () => {
  for (const [name, values, def] of PINNED) {
    assert.ok(DEFS[def], `$defs.${def} exists for ${name}`);
    assert.deepEqual(DEFS[def]!.enum, [...values], `${name} and $defs.${def}.enum agree in order`);
  }
  const exportedArrays = Object.entries(authoring).filter(([, v]) => Array.isArray(v)).map(([k]) => k).sort();
  assert.deepEqual(exportedArrays, PINNED.map(([n]) => n).sort(), 'every exported array has a schema home in this table');
  assert.equal(DEFS.format!.const, authoring.DESIGN_AUTHORING_FORMAT);
  assert.equal(DEFS.maxRows!.const, authoring.DESIGN_AUTHORING_MAX_ROWS);
  const templateKeys = authoring.DESIGN_AUTHORING_PATCH_KEYS.filter((k) => k !== '$in');
  assert.deepEqual(DEFS.templateKey!.enum, templateKeys, 'a template takes the patch keys but $in');
  const styleProps = Object.keys((DEFS.textStyle!.properties as Json));
  assert.deepEqual(styleProps, [...authoring.DESIGN_TEXT_STYLE_FIELDS], 'the text style object lists the style fields in order');
  const rowProps = Object.keys(DEFS.authoredRow!.properties as Json);
  assert.deepEqual(rowProps, [...authoring.DESIGN_AUTHORING_ROW_KEYS], 'the authored row types every row key');
});

test('the engine and the contract agree on the style ids', () => {
  assert.deepEqual(Object.keys(textStylesFromBrief(null, { width: 1920 })), [...authoring.DESIGN_TEXT_STYLE_IDS]);
});

test('the public fixture and its expansion validate', () => {
  const input = readJson('tests/fixtures/author/input.json');
  ok(input, 'fixture input');
  const out = expandDesignAuthoringDocument(input);
  ok(out.values, 'expanded values');
  ok(out.rows, 'expanded rows as a bare array');
  ok(readJson('tests/fixtures/author/expected.json'), 'expected rows');
  ok({ values: { boxes: [], __label: 'x' }, $theme: 'dark' }, 'a saved session shape');
});

test('shapes the engine accepts validate: composite table columns and numeric strings', () => {
  const f = { id: 'f', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080 };
  const accepted: Array<[string, unknown]> = [
    ['a composite table column', [f, { id: 't', $in: 'f', $table: { pitch: 10, columns: [{ x: 0, cell: [{ slot: 'a', kind: 'text' }, { slot: 'b', kind: 'text', y: 20 }] }], rows: [[{ a: 'A', b: 'B' }]] } }]],
    ['a composite column without x', [f, { id: 't', $in: 'f', $table: { pitch: 10, columns: [{ cell: [{ slot: 'a', kind: 'text' }] }, { id: 'c{r}', kind: 'text', x: 200 }], rows: [[{ a: 'A' }, 'C']] } }]],
    ['grid columns as a numeric string', [f, { $in: 'f', $grid: { columns: '2', rows: '1', colWidth: 1, rowPitch: 1, cell: [{ id: 'c{i}', kind: 'box' }], items: [{}, {}] } }]],
  ];
  for (const [label, doc] of accepted) {
    assert.doesNotThrow(() => expandDesignAuthoringDocument(doc), `the engine accepts ${label}`);
    ok(doc, label);
  }
  const refusedToo: Array<[string, unknown]> = [
    ['a narration group on a divider', [f, { id: 'm', $in: 'f', $stack: { pitch: 10, w: 100, divider: { id: 'd{i}', group: 'narration:x' }, item: [{ slot: 't', kind: 'text' }], items: ['a', 'b'] } }]],
    ['$style on a box template', [f, { id: 'm', $in: 'f', $stack: { pitch: 10, item: [{ slot: 't', kind: 'box', $style: 'title' }], items: [{}] } }]],
    ['$style on a box row', [f, { id: 'b', $in: 'f', kind: 'box', $style: 'title' }]],
    ['a fractional grid column count', [f, { $in: 'f', $grid: { columns: '1.5', colWidth: 1, rowPitch: 1, cell: [{ id: 'c{i}', kind: 'box' }], items: [] } }]],
  ];
  for (const [label, doc] of refusedToo) {
    assert.throws(() => expandDesignAuthoringDocument(doc), Error, `the engine refuses ${label}`);
    refused(doc, label);
  }
});

test('malformed authoring is refused', () => {
  const stack = (s: Json): Json => ({ boxes: [{ id: 'm', $in: 'f', $stack: { pitch: 10, item: [{ slot: 't', kind: 'text' }], items: ['a'], ...s } }] });
  const cases: Array<[string, unknown]> = [
    ['an unknown $ key', [{ id: 'a', $foo: 1 }]],
    ['$points and $d together', [{ id: 'a', $points: [[0, 0], [1, 1]], $d: 'M0 0L1 1' }]],
    ['one point', [{ id: 'a', $points: [[0, 0]] }]],
    ['an unknown curve', [{ id: 'a', $points: [[0, 0], [1, 1]], $curve: 'wavy' }]],
    ['$artboard false', [{ id: 'a', $artboard: false }]],
    ['a style with an unknown field', [{ id: 'a', $style: { size: 3 } }]],
    ['a weight of 450', [{ id: 'a', $style: { weight: '450' } }]],
    ['two macros in one row', [{ $stack: { pitch: 1, item: [{ id: 'x' }], items: [] }, $grid: {} }]],
    ['a row field on a macro row', [{ kind: 'box', $stack: { pitch: 1, item: [{ id: 'x' }], items: [] } }]],
    ['a stack without pitch', stack({ pitch: undefined })],
    ['an empty template list', stack({ item: [] })],
    ['z in a template', stack({ item: [{ slot: 't', z: 1 }] })],
    ['role in a template', stack({ item: [{ slot: 't', role: 'title' }] })],
    ['a narration group', stack({ item: [{ slot: 't', group: 'narration:a' }] })],
    ['$in in a template', stack({ item: [{ slot: 't', $in: 'f' }] })],
    ['an unknown anchor', stack({ item: [{ slot: 't', at: 'page' }] })],
    ['a divider with a path', stack({ divider: { id: 'd{i}', $d: 'M0 0' } })],
    ['an unknown axis', stack({ axis: 'z' })],
    ['an unknown $styles field', { $styles: { a: { colour: 'red' } }, boxes: [] }],
    ['a grid with zero columns', { boxes: [{ $grid: { columns: 0, colWidth: 1, rowPitch: 1, cell: [{ id: 'c' }], items: [] } }] }],
    ['an unknown grid order', { boxes: [{ $grid: { columns: 1, colWidth: 1, rowPitch: 1, order: 'diagonal', cell: [{ id: 'c' }], items: [] } }] }],
    ['a table row object without cells', { boxes: [{ $table: { pitch: 1, columns: [{ id: 'c' }], rows: [{ label: 'x' }] } }] }],
  ];
  for (const [label, doc] of cases) refused(doc, label);
  for (const [label, doc] of cases) {
    assert.throws(() => expandDesignAuthoringDocument(doc), Error, `the engine refuses ${label} too`);
  }
});

test('the core barrel and the package exports carry the contract', () => {
  for (const [name, value] of Object.entries(authoring)) {
    assert.equal((core as Record<string, unknown>)[name], value, `@lolly-tools/core re-exports ${name}`);
  }
  const exportsMap = readJson('packages/core/package.json').exports as Record<string, string>;
  assert.equal(exportsMap['./design-authoring-v1'], './src/design-authoring-v1.ts');
  assert.equal(exportsMap['./schema/design-authoring-v1.schema.json'], './schema/design-authoring-v1.schema.json');
  assert.ok(existsSync(join(ROOT, 'packages/core/schema/design-authoring-v1.schema.json')));
});

// SPDX-License-Identifier: MPL-2.0
/**
 * The text measure contract (plan 291, W5): schemas/text-measure-v1.schema.json
 * against the TypeScript it mirrors in packages/core/src/text-measure-v1.ts.
 *
 * Same pattern as the content inventory contract test: each exported const array is
 * compared with its $defs enum element by element, a maximal sample typed as
 * TextMeasureV1 must use exactly the keys the schema declares on every object, and a
 * real measure from the Node shaper must validate.
 *
 * Run with: node --test "tests/text-measure-contract.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import * as measure from '../packages/core/src/text-measure-v1.ts';
import * as core from '../packages/core/src/index.ts';
import type { TextMeasureSpecV1, TextMeasureV1 } from '../packages/core/src/text-measure-v1.ts';
import { measureTextNode } from '../packages/node-shell/src/text-measure.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Json = Record<string, unknown>;
const readJson = (rel: string): Json => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Json;

const SCHEMA = readJson('schemas/text-measure-v1.schema.json');
const DEFS = SCHEMA.$defs as Record<string, Json>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator; addSchema: (s: unknown) => unknown };
const ajv = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false });
const validate = ajv.compile(SCHEMA);
const validateSpec = ajv.compile({ $ref: 'https://lolly.tools/schemas/text-measure-v1.schema.json#/$defs/spec' });

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const ok = (doc: unknown, label: string): void => {
  assert.equal(validate(doc), true, `${label}: ${JSON.stringify(validate.errors, null, 2)}`);
};
const refused = (doc: unknown, label: string): void => {
  assert.equal(validate(doc), false, `${label} should be refused`);
};

const FACE = { token: 'sans', family: 'Brand Sans', weight: 500, italic: false, file: '/fonts/Brand[wght].ttf', variations: { wght: 500 } };

/** Every optional field present. */
const FULL: TextMeasureV1 = {
  format: 'lolly-text-measure',
  version: 1,
  method: 'harfbuzz-css-greedy',
  font: FACE,
  faces: [FACE, { token: 'italic', family: 'Brand Sans', weight: 500, italic: true, file: '/fonts/Brand-Italic[wght].ttf' }],
  size: 72,
  weight: 500,
  lineHeight: 1.12,
  lineHeightPx: 80.625,
  pad: 0,
  tracking: 0,
  width: 900,
  availableWidth: 900,
  lines: [
    { index: 0, paragraph: 0, text: 'Every quarter we ', start: 0, end: 17, width: 600.5, slack: 299.5, break: 'space', nearEdge: false },
    { index: 1, paragraph: 0, text: 'measure', start: 17, end: 24, width: 300, slack: 600, break: 'end', nearEdge: true },
  ],
  lineCount: 2,
  height: 161.25,
  scrollHeight: 166,
  nearEdge: true,
  uncovered: ['\u65e5'],
  box: { width: 900, height: 120, clientHeight: 120 },
  overflow: { y: 46, x: false, clipped: true, hiddenLines: [1] },
  tolerance: { widthPx: 0.5, lineEndPx: 3, nearEdgePx: 3 },
  notes: ['A note.'],
};

/** The smallest measure: no text, no box. */
const MINIMAL: TextMeasureV1 = {
  ...clone(FULL),
  lines: [],
  lineCount: 0,
  height: 16,
  scrollHeight: 16,
  nearEdge: false,
  faces: [FACE],
  notes: [],
};
delete (MINIMAL as Partial<TextMeasureV1>).box;
delete (MINIMAL as Partial<TextMeasureV1>).overflow;

const PINNED: Array<[string, readonly unknown[], string]> = [
  ['TEXT_MEASURE_BREAKS', measure.TEXT_MEASURE_BREAKS, 'break'],
  ['TEXT_MEASURE_VALIGNS', measure.TEXT_MEASURE_VALIGNS, 'valign'],
];

test('every exported vocabulary matches its schema enum element by element', () => {
  for (const [name, values, def] of PINNED) {
    assert.ok(DEFS[def], `$defs.${def} exists for ${name}`);
    assert.deepEqual(DEFS[def]!.enum, [...values], `${name} and $defs.${def}.enum agree in order`);
  }
  const exportedArrays = Object.entries(measure).filter(([, v]) => Array.isArray(v)).map(([k]) => k).sort();
  assert.deepEqual(exportedArrays, PINNED.map(([n]) => n).sort(), 'every exported array has a schema home in this table');
  const props = SCHEMA.properties as Record<string, Json>;
  assert.equal(props.format!.const, measure.TEXT_MEASURE_FORMAT);
  assert.equal(props.version!.const, measure.TEXT_MEASURE_VERSION);
  assert.equal(props.method!.const, measure.TEXT_MEASURE_METHOD);
});

test('the maximal and minimal samples validate', () => {
  ok(FULL, 'maximal');
  ok(MINIMAL, 'minimal');
  for (const brk of measure.TEXT_MEASURE_BREAKS) ok({ ...clone(FULL), lines: [{ ...FULL.lines[0]!, break: brk }] }, brk);
});

test('the maximal sample and the schema declare the same keys on every object', () => {
  const props = (node: Json): string[] => Object.keys(node.properties as Json).sort();
  const keys = (value: object): string[] => Object.keys(value).sort();
  assert.deepEqual(keys(FULL), props(SCHEMA));
  assert.deepEqual(keys(FULL.font), props(DEFS.face!));
  assert.deepEqual(keys(FULL.lines[0]!), props(DEFS.line!));
  assert.deepEqual(keys(FULL.box!), props(DEFS.box!));
  assert.deepEqual(keys(FULL.overflow!), props(DEFS.overflow!));
  assert.deepEqual(keys(FULL.tolerance), props(DEFS.tolerance!));
  const spec: Required<TextMeasureSpecV1> = {
    text: 'x', font: 'sans', fonts: { brand: 'Brand Sans', mono: 'Brand Mono', display: 'Brand Display', italic: 'Brand Italic' }, weight: 500, italic: false, plain: false,
    size: 48, lineHeight: 1.12, pad: 8, tracking: 0, ligatures: true, alternates: false, width: 300, height: 100, strokeW: 0, valign: 'middle',
  };
  assert.deepEqual(keys(spec), props(DEFS.spec!));
  assert.deepEqual(keys(spec.fonts), props(DEFS.fonts!));
  assert.equal(validateSpec(spec), true, JSON.stringify(validateSpec.errors));
  assert.equal(validateSpec({ text: 'x' }), false, 'a spec needs a width');
});

test('malformed measures are refused', () => {
  const cases: Array<[string, unknown]> = [
    ['wrong format', { ...clone(FULL), format: 'lolly-measure' }],
    ['wrong version', { ...clone(FULL), version: 2 }],
    ['unknown top-level key', { ...clone(FULL), fit: {} }],
    ['an unknown break', { ...clone(FULL), lines: [{ ...FULL.lines[0]!, break: 'wrap' }] }],
    ['a line without nearEdge', { ...clone(FULL), lines: [{ ...FULL.lines[0]!, nearEdge: undefined }] }],
    ['a fractional scrollHeight', { ...clone(FULL), scrollHeight: 165.5 }],
    ['a weight off the scale', { ...clone(FULL), weight: 950 }],
    ['a face without a file', { ...clone(FULL), font: { token: 'sans', family: 'x', weight: 400, italic: false } }],
    ['no faces', { ...clone(FULL), faces: [] }],
    ['overflow without hiddenLines', { ...clone(FULL), overflow: { y: 1, x: false, clipped: true } }],
    ['a negative line count', { ...clone(FULL), lineCount: -1 }],
  ];
  for (const [label, doc] of cases) refused(doc, label);
});

test('a real measure validates', async () => {
  const m = await measureTextNode({ text: 'A synthetic **headline** with\n- a list\n- and {mono|code}', size: 40, weight: 500, width: 420, height: 90 });
  ok(m, 'measureTextNode');
  ok(await measureTextNode({ text: '', width: 10 }), 'empty text');
});

test('the core barrel and the package exports carry the contract', () => {
  for (const [name, value] of Object.entries(measure)) {
    assert.equal((core as Record<string, unknown>)[name], value, `@lolly-tools/core re-exports ${name}`);
  }
  const exportsMap = readJson('packages/core/package.json').exports as Record<string, string>;
  assert.equal(exportsMap['./text-measure-v1'], './src/text-measure-v1.ts');
  assert.equal(exportsMap['./schema/text-measure-v1.schema.json'], './schema/text-measure-v1.schema.json');
  assert.ok(existsSync(join(ROOT, 'packages/core/schema/text-measure-v1.schema.json')));
  const nodeShell = readJson('packages/node-shell/package.json').exports as Record<string, string>;
  assert.equal(nodeShell['./text-measure'], './src/text-measure.ts');
});

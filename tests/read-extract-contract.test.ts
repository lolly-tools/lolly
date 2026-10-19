// SPDX-License-Identifier: MPL-2.0
/**
 * The read-extract contract (plan 203, rank 10): schemas/read-extract-v1.schema.json
 * against the TypeScript it mirrors in packages/core/src/read-extract-v1.ts.
 *
 * The same pattern as the content inventory contract test: each exported const
 * array is compared with its $defs enum element by element, and a maximal sample
 * typed as ReadExtractV1 must use exactly the keys the schema declares on every
 * object.
 *
 * Run with: node --test "tests/read-extract-contract.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import * as extract from '../packages/core/src/read-extract-v1.ts';
import * as core from '../packages/core/src/index.ts';
import type { ExtractBlockV1, ReadExtractV1 } from '../packages/core/src/read-extract-v1.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Json = Record<string, unknown>;
const readJson = (rel: string): Json => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Json;

const SCHEMA = readJson('schemas/read-extract-v1.schema.json');
const INVENTORY = readJson('schemas/content-inventory-v1.schema.json');
const DEFS = SCHEMA.$defs as Record<string, Json>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validate = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const ok = (doc: unknown, label: string): void => {
  assert.equal(validate(doc), true, `${label}: ${JSON.stringify(validate.errors, null, 2)}`);
};
const refused = (doc: unknown, label: string): void => {
  assert.equal(validate(doc), false, `${label} should be refused`);
};

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

/** A text block with every optional field present. */
const TEXT_BLOCK: ExtractBlockV1 = {
  id: 'p2.0',
  page: 2,
  order: 0,
  kind: 'text',
  text: 'Quarterly results',
  origin: 'recognized',
  role: 'title',
  objectId: 'page2.Im0.r1',
  box: { x: 0.1, y: 0.05, width: 0.8, height: 0.1 },
  recognition: { model: 'ppocr-v5-mobile', modelVersion: 'v5-mobile', languages: ['en'], confidence: 0.93, minConfidence: 0.88, lines: 1 },
  rows: [['a']],
  chart: { type: 'bar', categories: ['x'], series: [{ name: 's', values: [1] }] },
  picture: { ref: 'user/media/x', sha256: SHA_A, mime: 'image/png', width: 10, height: 20, kind: 'photo', file: `${SHA_A}.png` },
  partial: true,
};

/** Every optional field present. */
const FULL: ReadExtractV1 = {
  version: 'lolly/read-extract-v1',
  inventory: 'lolly/content-inventory-v1',
  source: { name: 'scan.pdf', sha256: SHA_B, bytes: 4096, kind: 'pdf', pages: 3, title: 'A scan' },
  request: { pages: [2, 3], kinds: ['text', 'picture'], maxChars: 400, minConfidence: 0.5, from: 'p2.0' },
  pages: [{ number: 2, scanned: true, read: 'recognized', blocks: 1 }, { number: 3, blocks: 0 }],
  blocks: [TEXT_BLOCK],
  chars: 17,
  complete: false,
  next: 'p2.1',
  warnings: [{ code: 'budget-reached', message: 'The 400 character budget was reached; continue from block p2.1.' }],
};

/** The smallest extract: a file with no pages. */
const MINIMAL: ReadExtractV1 = {
  version: 'lolly/read-extract-v1',
  inventory: 'lolly/content-inventory-v1',
  source: { name: 'empty.pdf', sha256: SHA_B, bytes: 10, kind: 'pdf', pages: 0 },
  request: { pages: [], kinds: ['text'] },
  pages: [],
  blocks: [],
  chars: 0,
  complete: true,
  warnings: [],
};

const PINNED: Array<[string, readonly unknown[], string]> = [
  ['EXTRACT_BLOCK_KINDS', extract.EXTRACT_BLOCK_KINDS, 'blockKind'],
  ['EXTRACT_ORIGINS', extract.EXTRACT_ORIGINS, 'origin'],
  ['EXTRACT_PAGE_READS', extract.EXTRACT_PAGE_READS, 'pageRead'],
];

test('every exported vocabulary matches its schema enum element by element', () => {
  for (const [name, values, def] of PINNED) {
    assert.ok(DEFS[def], `$defs.${def} exists for ${name}`);
    assert.deepEqual(DEFS[def]!.enum, [...values], `${name} and $defs.${def}.enum agree in order`);
  }
  const exportedArrays = Object.entries(extract).filter(([, v]) => Array.isArray(v)).map(([k]) => k).sort();
  assert.deepEqual(exportedArrays, PINNED.map(([n]) => n).sort(), 'every exported array has a schema home in this table');
  assert.equal((SCHEMA.properties as Record<string, Json>).version!.const, extract.READ_EXTRACT_VERSION);
});

test('the shapes it shares with the content inventory are the inventory schema\'s own', () => {
  const inv = INVENTORY.$defs as Record<string, Json>;
  for (const name of ['sourceKind', 'textRole', 'pictureKind', 'sha256', 'count', 'pixels', 'mime', 'box', 'recognition', 'warning']) {
    assert.deepEqual(DEFS[name], inv[name], `$defs.${name} is copied from content-inventory-v1`);
  }
  assert.equal((SCHEMA.properties as Record<string, Json>).inventory!.const, (INVENTORY.properties as Record<string, Json>).version!.const);
});

test('the maximal and minimal samples validate', () => {
  ok(FULL, 'maximal');
  ok(MINIMAL, 'minimal');
});

test('the maximal sample and the schema declare the same keys on every object', () => {
  const props = (node: Json): string[] => Object.keys(node.properties as Json).sort();
  const keys = (value: object): string[] => Object.keys(value).sort();
  const top = SCHEMA.properties as Record<string, Json>;
  assert.deepEqual(keys(FULL), props(SCHEMA));
  assert.deepEqual(keys(FULL.source), props(top.source!));
  assert.deepEqual(keys(FULL.request), props(top.request!));
  assert.deepEqual(keys(FULL.pages[0]!), props(DEFS.page!));
  assert.deepEqual(keys(TEXT_BLOCK), props(DEFS.block!));
  assert.deepEqual(keys(TEXT_BLOCK.picture!), props(DEFS.picture!));
  assert.deepEqual(keys(TEXT_BLOCK.chart!), props(DEFS.chart!));
  assert.deepEqual(keys(TEXT_BLOCK.recognition!), props(DEFS.recognition!));
});

test('malformed extracts are refused', () => {
  const blockWith = (patch: (b: Json) => void): Json => {
    const block = clone(TEXT_BLOCK) as unknown as Json;
    patch(block);
    return { ...clone(FULL), blocks: [block] };
  };
  const cases: Array<[string, unknown]> = [
    ['wrong version', { ...clone(FULL), version: 'lolly/read-extract-v2' }],
    ['the wrong inventory', { ...clone(FULL), inventory: 'lolly/content-inventory-v2' }],
    ['an unknown top-level key', { ...clone(FULL), text: '' }],
    ['a docx source', { ...clone(FULL), source: { ...FULL.source, kind: 'docx' } }],
    ['page 0 requested', { ...clone(FULL), request: { ...FULL.request, pages: [0] } }],
    ['no kinds asked for', { ...clone(FULL), request: { ...FULL.request, kinds: [] } }],
    ['a budget of 0', { ...clone(FULL), request: { ...FULL.request, maxChars: 0 } }],
    ['a block id that is not p<page>.<order>', blockWith((b) => { b.id = 'block-1'; })],
    ['a next that is not a block id', { ...clone(FULL), next: 'later' }],
    ['an unknown origin', blockWith((b) => { b.origin = 'guessed'; })],
    ['an unknown kind', blockWith((b) => { b.kind = 'heading'; })],
    ['a block without text', blockWith((b) => { delete b.text; })],
    ['a confidence over 1', blockWith((b) => { (b.recognition as Json).confidence = 2; })],
    ['an unknown page read', { ...clone(FULL), pages: [{ number: 2, read: 'guessed', blocks: 0 }] }],
    ['a picture without a hash', blockWith((b) => { delete (b.picture as Json).sha256; })],
  ];
  for (const [label, doc] of cases) refused(doc, label);
});

test('the core barrel and the package exports carry the contract', () => {
  for (const [name, value] of Object.entries(extract)) {
    assert.equal((core as Record<string, unknown>)[name], value, `@lolly-tools/core re-exports ${name}`);
  }
  const exportsMap = readJson('packages/core/package.json').exports as Record<string, string>;
  assert.equal(exportsMap['./read-extract-v1'], './src/read-extract-v1.ts');
  assert.equal(exportsMap['./schema/read-extract-v1.schema.json'], './schema/read-extract-v1.schema.json');
  assert.ok(existsSync(join(ROOT, 'packages/core/schema/read-extract-v1.schema.json')));
});

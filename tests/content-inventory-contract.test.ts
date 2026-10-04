// SPDX-License-Identifier: MPL-2.0
/**
 * The content inventory contract (plan 291, W2):
 * schemas/content-inventory-v1.schema.json against the TypeScript it mirrors in
 * packages/core/src/content-inventory-v1.ts.
 *
 * Same pattern as the check report contract test: each exported const array is
 * compared with its $defs enum element by element, and a maximal sample typed as
 * ContentInventoryV1 must use exactly the keys the schema declares on every
 * object. The notes shape gets its own case, because keeping paragraphs and the
 * line breaks inside them apart is the reason the shape exists.
 *
 * Run with: node --test "tests/content-inventory-contract.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import * as inventory from '../packages/core/src/content-inventory-v1.ts';
import * as core from '../packages/core/src/index.ts';
import type { ContentInventoryV1, InventorySlideV1 } from '../packages/core/src/content-inventory-v1.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Json = Record<string, unknown>;
const readJson = (rel: string): Json => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Json;

const SCHEMA = readJson('schemas/content-inventory-v1.schema.json');
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

/** A slide with every optional field present. */
const FULL_SLIDE: InventorySlideV1 = {
  number: 1,
  id: 'slide-256',
  layoutName: 'Title and Content',
  text: [{
    objectId: 'sp-2',
    role: 'title',
    class: 'content',
    readingIndex: 0,
    box: { x: 0.05, y: 0.08, width: 0.9, height: 0.15 },
    paragraphs: [{
      lvl: 0,
      bullet: 'number',
      align: 'left',
      runs: [{ text: 'Sleep\nwell', bold: true, italic: false, color: '#30BA78', font: 'SUSE', weight: 600, size: 40 }],
    }],
    plain: 'Sleep\nwell',
    hidden: true,
  }],
  notes: {
    text: 'OPENING\nOpen with the question.\n\nSources: two studies.',
    paragraphs: [{ lines: ['OPENING', 'Open with the question.'] }, { lines: ['Sources: two studies.'] }],
  },
  pictures: [{
    objectId: 'pic-4',
    ref: 'ppt/media/image1.png',
    sha256: SHA_A,
    mime: 'image/png',
    bytes: 20480,
    width: 1920,
    height: 1080,
    box: { x: -0.1, y: 0, width: 1.2, height: 1 },
    crop: { l: 0.1, t: 0, r: 0.1, b: -0.05 },
    kind: 'photo',
    class: 'content',
    alt: 'A person asleep at a desk',
    file: `${SHA_A}.png`,
    fallbackRef: 'ppt/media/image1_fallback.png',
  }],
  tables: [{ objectId: 'tbl-5', rows: [['Year', 'Hours'], ['2024', '6.5']] }],
  charts: [{ objectId: 'chart-6', type: 'bar', categories: ['A', 'B'], series: [{ name: 'Hours', values: [6.5, 7] }] }],
  objects: [{ id: 'sp-2', kind: 'text', class: 'content', hidden: true }, { id: 'sp-9', kind: 'shape', class: 'decoration' }],
  thumbnail: { file: `${SHA_B}.png`, width: 640, height: 360 },
};

/** Every optional field present. */
const FULL: ContentInventoryV1 = {
  version: 'lolly/content-inventory-v1',
  source: { name: 'talk.pptx', sha256: SHA_B, bytes: 1048576, kind: 'pptx', slides: 2, width: 1280, height: 720, title: 'Talk' },
  slides: [
    FULL_SLIDE,
    { number: 2, id: 'slide-257', text: [], notes: null, pictures: [], tables: [], charts: [], objects: [] },
  ],
  media: [{ ref: 'ppt/media/image1.png', sha256: SHA_A, mime: 'image/png', bytes: 20480, width: 1920, height: 1080, file: `${SHA_A}.png` }],
  warnings: [{ code: 'chart-unread', message: 'One chart carried no cached values.' }],
};

/** The smallest inventory: an empty PDF. */
const MINIMAL: ContentInventoryV1 = {
  version: 'lolly/content-inventory-v1',
  source: { name: 'empty.pdf', sha256: SHA_B, bytes: 1024, kind: 'pdf', slides: 0, width: 816, height: 1056 },
  slides: [],
  media: [],
  warnings: [],
};

const PINNED: Array<[string, readonly unknown[], string]> = [
  ['INVENTORY_SOURCE_KINDS', inventory.INVENTORY_SOURCE_KINDS, 'sourceKind'],
  ['INVENTORY_TEXT_ROLES', inventory.INVENTORY_TEXT_ROLES, 'textRole'],
  ['INVENTORY_PICTURE_KINDS', inventory.INVENTORY_PICTURE_KINDS, 'pictureKind'],
  ['INVENTORY_ALIGNMENTS', inventory.INVENTORY_ALIGNMENTS, 'align'],
];

test('every exported vocabulary matches its schema enum element by element', () => {
  for (const [name, values, def] of PINNED) {
    assert.ok(DEFS[def], `$defs.${def} exists for ${name}`);
    assert.deepEqual(DEFS[def]!.enum, [...values], `${name} and $defs.${def}.enum agree in order`);
  }
  const exportedArrays = Object.entries(inventory).filter(([, v]) => Array.isArray(v)).map(([k]) => k).sort();
  assert.deepEqual(exportedArrays, PINNED.map(([n]) => n).sort(), 'every exported array has a schema home in this table');
  assert.equal((SCHEMA.properties as Record<string, Json>).version!.const, inventory.CONTENT_INVENTORY_VERSION);
});

test('the maximal and minimal samples validate', () => {
  ok(FULL, 'maximal');
  ok(MINIMAL, 'minimal');
  for (const kind of inventory.INVENTORY_SOURCE_KINDS) ok({ ...clone(MINIMAL), source: { ...MINIMAL.source, kind } }, kind);
});

test('the maximal sample and the schema declare the same keys on every object', () => {
  const props = (node: Json): string[] => Object.keys(node.properties as Json).sort();
  const keys = (value: object): string[] => Object.keys(value).sort();
  const top = SCHEMA.properties as Record<string, Json>;
  const text = FULL_SLIDE.text[0]!;
  const picture = FULL_SLIDE.pictures[0]!;
  const notesObject = (DEFS.notes!.oneOf as Json[])[1]!;
  assert.deepEqual(keys(FULL), props(SCHEMA));
  assert.deepEqual(keys(FULL.source), props(top.source!));
  assert.deepEqual(keys(FULL_SLIDE), props(DEFS.slide!));
  assert.deepEqual(keys(text), props(DEFS.text!));
  assert.deepEqual(keys(text.box), props(DEFS.box!));
  assert.deepEqual(keys(text.paragraphs[0]!), props(DEFS.paragraph!));
  assert.deepEqual(keys(text.paragraphs[0]!.runs[0]!), props(DEFS.run!));
  assert.deepEqual(keys(FULL_SLIDE.notes!), props(notesObject));
  assert.deepEqual(keys(picture), props(DEFS.picture!));
  assert.deepEqual(keys(picture.crop!), props(DEFS.crop!));
  assert.deepEqual(keys(FULL_SLIDE.tables[0]!), props(DEFS.table!));
  assert.deepEqual(keys(FULL_SLIDE.charts[0]!), props(DEFS.chart!));
  assert.deepEqual(keys(FULL_SLIDE.objects[0]!), props(DEFS.object!));
  assert.deepEqual(keys(FULL_SLIDE.thumbnail!), props(DEFS.thumbnail!));
  assert.deepEqual(keys(FULL.media[0]!), props(DEFS.media!));
  assert.deepEqual(keys(FULL.warnings[0]!), props(DEFS.warning!));
});

test('notes keep paragraphs and the line breaks inside them apart', () => {
  const notes = FULL_SLIDE.notes!;
  assert.equal(notes.paragraphs.length, 2, 'two paragraphs, not three lines merged into one');
  assert.deepEqual(notes.paragraphs[0]!.lines, ['OPENING', 'Open with the question.'], 'an a:br is a second line in the same paragraph');
  // Plan 291 M4: the authoring form, a blank line between paragraphs (an empty line inside one is a no-break space).
  assert.equal(notes.text, notes.paragraphs.map((p) => p.lines.map((l, k) => (l.trim() === '' && k > 0 && k < p.lines.length - 1 ? '\u00a0' : l)).join('\n')).join('\n\n'), 'text is lines joined with a newline and paragraphs with a blank line');
  const slide = (n: unknown): Json => ({ ...clone(FULL), slides: [{ ...clone(FULL_SLIDE), notes: n }] });
  ok(slide(null), 'a slide with no notes');
  refused(slide({ text: 'x', lines: ['x'] }), 'the flat lines shape');
  refused(slide({ text: 'x', paragraphs: [{ lines: 'x' }] }), 'lines as a string');
  const noNotesKey = clone(FULL_SLIDE) as unknown as Json;
  delete noNotesKey.notes;
  refused({ ...clone(FULL), slides: [noNotesKey] }, 'notes left out rather than null');
});

test('bullets are true, false or number', () => {
  const withBullet = (bullet: unknown): Json => {
    const slide = clone(FULL_SLIDE) as unknown as { text: Array<{ paragraphs: Array<Json> }> };
    slide.text[0]!.paragraphs[0]!.bullet = bullet;
    return { ...clone(FULL), slides: [slide] };
  };
  for (const bullet of [true, false, 'number']) ok(withBullet(bullet), `bullet ${String(bullet)}`);
  for (const bullet of ['bullet', 'none', 1]) refused(withBullet(bullet), `bullet ${String(bullet)}`);
});

test('malformed inventories are refused', () => {
  const slideWith = (patch: (s: Json) => void): Json => {
    const slide = clone(FULL_SLIDE) as unknown as Json;
    patch(slide);
    return { ...clone(FULL), slides: [slide] };
  };
  type Rows = Array<Json>;
  const cases: Array<[string, unknown]> = [
    ['wrong version', { ...clone(FULL), version: 'lolly/content-inventory-v2' }],
    ['unknown top-level key', { ...clone(FULL), thumbnails: [] }],
    ['an unknown source kind', { ...clone(FULL), source: { ...FULL.source, kind: 'docx' } }],
    ['a zero-width slide', { ...clone(FULL), source: { ...FULL.source, width: 0 } }],
    ['a short sha256', { ...clone(FULL), source: { ...FULL.source, sha256: 'abc' } }],
    ['slide number 0', slideWith((s) => { s.number = 0; })],
    ['an unknown text role', slideWith((s) => { (s.text as Rows)[0]!.role = 'heading'; })],
    ['text without plain', slideWith((s) => { delete (s.text as Rows)[0]!.plain; })],
    ['a box with negative height', slideWith((s) => { (s.text as Rows)[0]!.box = { x: 0, y: 0, width: 1, height: -0.1 }; })],
    ['a colour that is not hex', slideWith((s) => {
      ((((s.text as Rows)[0]!.paragraphs as Rows)[0]!.runs as Rows)[0]!).color = 'accent1';
    })],
    ['weight 0', slideWith((s) => {
      ((((s.text as Rows)[0]!.paragraphs as Rows)[0]!.runs as Rows)[0]!).weight = 0;
    })],
    ['an unknown alignment', slideWith((s) => { (((s.text as Rows)[0]!.paragraphs as Rows)[0]!).align = 'start'; })],
    ['an unknown picture kind', slideWith((s) => { (s.pictures as Rows)[0]!.kind = 'illustration'; })],
    ['a picture with a bad mime', slideWith((s) => { (s.pictures as Rows)[0]!.mime = 'png'; })],
    ['a picture without a hash', slideWith((s) => { delete (s.pictures as Rows)[0]!.sha256; })],
    ['a fractional pixel width', slideWith((s) => { (s.pictures as Rows)[0]!.width = 10.5; })],
    ['a crop with an unknown edge', slideWith((s) => { (s.pictures as Rows)[0]!.crop = { left: 0.1 }; })],
    ['a table row of numbers', slideWith((s) => { (s.tables as Rows)[0]!.rows = [[1, 2]]; })],
    ['a chart series without values', slideWith((s) => { (s.charts as Rows)[0]!.series = [{ name: 'x' }]; })],
    ['an object without a class', slideWith((s) => { s.objects = [{ id: 'a', kind: 'text' }]; })],
    ['hidden as a word', slideWith((s) => { (s.objects as Rows)[0]!.hidden = 'yes'; })],
    ['a thumbnail without a height', slideWith((s) => { s.thumbnail = { file: 'a.png', width: 10 }; })],
    ['a thumbnail of zero width', slideWith((s) => { s.thumbnail = { file: 'a.png', width: 0, height: 10 }; })],
    ['an empty fallback ref', slideWith((s) => { (s.pictures as Rows)[0]!.fallbackRef = ''; })],
    ['a warning without a message', { ...clone(FULL), warnings: [{ code: 'x' }] }],
    ['media without bytes', { ...clone(FULL), media: [{ ref: 'r', sha256: SHA_A, mime: 'image/png' }] }],
  ];
  for (const [label, doc] of cases) refused(doc, label);
});

test('an object partly off the slide keeps its unclipped box', () => {
  const slide = clone(FULL_SLIDE);
  slide.text[0]!.box = { x: -0.25, y: 0.9, width: 1.5, height: 0.3 };
  ok({ ...clone(FULL), slides: [slide] }, 'off-slide box');
});

test('the core barrel and the package exports carry the contract', () => {
  for (const [name, value] of Object.entries(inventory)) {
    assert.equal((core as Record<string, unknown>)[name], value, `@lolly-tools/core re-exports ${name}`);
  }
  const exportsMap = readJson('packages/core/package.json').exports as Record<string, string>;
  assert.equal(exportsMap['./content-inventory-v1'], './src/content-inventory-v1.ts');
  assert.equal(exportsMap['./schema/content-inventory-v1.schema.json'], './schema/content-inventory-v1.schema.json');
  assert.ok(existsSync(join(ROOT, 'packages/core/schema/content-inventory-v1.schema.json')));
});

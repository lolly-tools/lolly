// SPDX-License-Identifier: MPL-2.0
/**
 * The content inventory (plan 291 W2): `inventoryFromSource` in
 * engine/src/content-inventory.ts, the host half `readContentInventory` in
 * packages/node-shell/src/content-inventory.ts, and the `lolly read` verb.
 *
 * The public deck is tests/fixtures/rebrand/notes.pptx, built by
 * scripts/build-rebrand-fixtures.ts: speaker notes broken by `a:br`, an all-caps
 * eyebrow, a full-bleed picture and a source line. The Sleepwalking deck the plan
 * was written from is private; its acceptance case runs only where
 * LOLLY_SLEEPWALKING_DECK points at the .pptx (a .pdf export in the same folder, with
 * the same base name, is read too).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/content-inventory.test.ts
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { unzipSync, zipSync } from 'fflate';

import { foldLigatures, inventoryFromSource, weightOfFace, type InventoryMediaInputV1 } from '../engine/src/content-inventory.ts';
import { writePsd } from '../engine/src/psd-write.ts';
import { REBRAND_CONTRACT_VERSION, type DeckCensusV1, type ObjectClassV1, type SourceDeckV1, type SourceObjectV1 } from '../packages/core/src/rebrand-v1.ts';
import type { ContentInventoryV1 } from '../packages/core/src/content-inventory-v1.ts';
import { ContentInventoryError, mediaFileName, readContentInventory } from '../packages/node-shell/src/content-inventory.ts';
import {
  NOTES_FIXTURE_LINES, NOTES_FIXTURE_SLIDE2, NOTES_FIXTURE_SOURCE,
} from '../scripts/build-rebrand-fixtures.ts';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const LOLLY = join(REPO, 'shells', 'cli', 'bin', 'lolly.ts');
const NOTES_DECK = join(REPO, 'tests', 'fixtures', 'rebrand', 'notes.pptx');
const FLATTENED_PDF = join(REPO, 'tests', 'fixtures', 'rebrand', 'flattened.pdf');
const VECTOR_DECK = join(REPO, 'tests', 'fixtures', 'rebrand', 'vector.pptx');
const TEXT_PSD = join(REPO, 'tests', 'fixtures', 'psd', 'text.psd');

const schema = JSON.parse(readFileSync(join(REPO, 'schemas', 'content-inventory-v1.schema.json'), 'utf8')) as object;
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);

function assertValid(inventory: unknown): void {
  assert.ok(validate(inventory), `the inventory breaks its schema: ${JSON.stringify(validate.errors?.slice(0, 5))}`);
}

const scratch = (): string => mkdtempSync(join(tmpdir(), 'lolly-read-'));

// ─── the pure projection ─────────────────────────────────────────────────────

const HASH = 'a'.repeat(64);
const SHA = (c: string): string => c.repeat(64);

function obj(id: string, partial: Partial<SourceObjectV1>): SourceObjectV1 {
  return {
    id, fingerprint: id, kind: 'text', box: { x: 0, y: 0, w: 100, h: 20, rot: 0 }, origin: 'slide', fidelity: { state: 'editable' },
    ...partial,
  };
}

function deckOf(objects: SourceObjectV1[], extra: Partial<SourceDeckV1['slides'][number]> = {}): SourceDeckV1 {
  return {
    version: REBRAND_CONTRACT_VERSION,
    source: { kind: 'pptx', hash: `sha256:${HASH}`, lineageId: 'l', instanceId: 'i', name: 'unit.pptx', bytes: 1234, pageCount: 1, title: 'Unit deck' },
    slides: [{
      id: 's1', index: 0, width: 1000, height: 500, background: {}, objects,
      readingOrder: objects.map((o) => o.id).reverse(), warnings: [], origin: { kind: 'pptx', layoutName: 'Content' }, ...extra,
    }],
    fonts: [],
    theme: { majorFont: 'Heading Face', minorFont: 'Body Face' },
    warnings: [],
    reader: { name: 'unit', version: '1' },
  };
}

function censusOf(classes: Record<string, ObjectClassV1>, icons: string[] = []): DeckCensusV1 {
  return {
    version: REBRAND_CONTRACT_VERSION, sourceHash: `sha256:${HASH}`, rules: { name: 'unit', version: '1' },
    objects: Object.entries(classes).map(([id, klass]) => ({ id, slideId: 's1', origin: 'slide', hypothesis: { class: klass, confidence: 1, evidence: [] } })),
    groups: [], colors: { uses: [], contrastPairs: [] }, fonts: [],
    layouts: [{ slideId: 's1', counts: {}, imageAreaShare: 0, chartPresent: false, tablePresent: false, distinctLeftEdges: 0, equalSiblingBoxes: 0, textParagraphs: 0, textWords: 0, units: icons.map((id) => ({ id, kind: 'icon', box: { x: 0, y: 0, w: 0, h: 0 }, words: 0, maxPt: 0 })) }],
    flattenedSlideIds: [], warnings: [],
  };
}

test('text frames come in reading order with roles, runs and a normalised plain string', () => {
  const objects = [
    obj('t-title', { placeholder: 'title', text: { paras: [{ runs: [{ text: '', font: 'Arial' }] }, { runs: [{ text: 'Five  spans', bold: true, sizePt: 36, font: '+mj-lt', color: { hex: '#0C322C' } }] }, { runs: [] }] } }),
    obj('t-eyebrow', { text: { paras: [{ runs: [{ text: 'A SHORT TOUR', sizePt: 8, font: 'SUSE SemiBold' }] }] } }),
    obj('t-cased', { text: { paras: [{ runs: [{ text: 'cased by style', case: 'upper', sizePt: 12 }] }] } }),
    obj('t-step', { text: { paras: [{ runs: [{ text: '02', sizePt: 14 }] }] } }),
    obj('t-source', { text: { paras: [{ runs: [{ text: 'Source: the archive', sizePt: 14 }] }] } }),
    obj('t-small', { text: { paras: [{ runs: [{ text: 'Load tables', sizePt: 7 }] }] } }),
    obj('t-icon', { text: { paras: [{ runs: [{ text: 'east', font: 'Material Icons' }] }] } }),
    obj('t-body', { text: { paras: [{ runs: [{ text: 'Line one', font: 'SUSE ExtraLight' }, { text: '\n' }, { text: 'line two' }], bullet: 'bullet', lvl: 1, align: 'center' }, { runs: [{ text: 'Para two' }], bullet: 'number' }] } }),
    obj('t-page', { placeholder: 'sldNum', text: { paras: [{ runs: [{ text: '3' }] }] } }),
    obj('t-blank', { text: { paras: [{ runs: [{ text: '   ' }] }] } }),
  ];
  const inventory = inventoryFromSource(deckOf(objects), censusOf({ 't-title': 'body', 't-body': 'body', 't-page': 'page-number' }), { media: new Map() });
  assertValid(inventory);
  const slide = inventory.slides[0]!;
  // Reading order runs opposite to z in this deck, and a blank frame is left out of the text list.
  assert.deepEqual(slide.text.map((t) => t.objectId), ['t-page', 't-body', 't-icon', 't-small', 't-source', 't-step', 't-cased', 't-eyebrow', 't-title']);
  assert.deepEqual(slide.text.map((t) => t.readingIndex), [1, 2, 3, 4, 5, 6, 7, 8, 9], 'the blank frame keeps its place 0');
  const role = (id: string): string => slide.text.find((t) => t.objectId === id)!.role;
  assert.equal(role('t-title'), 'title', 'the placeholder wins over the census class');
  assert.equal(role('t-eyebrow'), 'label');
  assert.equal(role('t-cased'), 'label', 'capitals drawn by the run case count');
  assert.equal(role('t-step'), 'label');
  assert.equal(role('t-source'), 'caption');
  assert.equal(role('t-small'), 'caption');
  assert.equal(role('t-icon'), 'other', 'a glyph name in an icon font is not copy');
  assert.equal(role('t-body'), 'body');
  assert.equal(role('t-page'), 'page-number');
  const title = slide.text.find((t) => t.objectId === 't-title')!;
  assert.equal(title.paragraphs.length, 1, 'blank edge paragraphs are trimmed');
  assert.deepEqual(title.paragraphs[0]!.runs, [{ text: 'Five  spans', bold: true, color: '#0c322c', font: 'Heading Face', weight: 700, size: 36 }]);
  assert.equal(title.plain, 'Five spans');
  assert.equal(title.class, 'body');
  const body = slide.text.find((t) => t.objectId === 't-body')!;
  assert.deepEqual(body.paragraphs[0], { runs: [{ text: 'Line one', font: 'SUSE ExtraLight', weight: 200 }, { text: '\n' }, { text: 'line two' }], lvl: 1, bullet: true, align: 'center' });
  assert.equal(body.paragraphs[1]!.bullet, 'number');
  assert.equal(body.plain, 'Line one\nline two\nPara two', 'a break and a paragraph end both read as a line in plain');
  assert.deepEqual(body.box, { x: 0, y: 0, width: 0.1, height: 0.04 });
  assert.equal(slide.layoutName, 'Content');
  assert.equal(inventory.source.title, 'Unit deck');
  assert.equal(inventory.source.sha256, HASH, 'the hash comes from the source when the host passes none');
});

test('pictures carry hash, size, crop and a kind; the ground is a picture too', () => {
  const media = new Map<string, InventoryMediaInputV1>([
    ['m/logo', { sha256: SHA('1'), mime: 'image/png', bytes: 10, width: 900, height: 162 }],
    ['m/icon', { sha256: SHA('2'), mime: 'image/png', bytes: 11, width: 256, height: 256 }],
    ['m/photo', { sha256: SHA('3'), mime: 'image/jpeg', bytes: 12, width: 2048, height: 1366, file: '/tmp/x.jpg' }],
    ['m/ground', { sha256: SHA('4'), mime: 'image/png', bytes: 13, width: 1920, height: 1080 }],
    ['m/panel', { sha256: SHA('5'), mime: 'image/png', bytes: 14 }],
  ]);
  const objects = [
    obj('p-logo', { kind: 'pic', media: 'm/logo', mediaMime: 'image/png', box: { x: 10, y: 450, w: 100, h: 20, rot: 0 } }),
    obj('p-icon', { kind: 'pic', media: 'm/icon', mediaMime: 'image/png', box: { x: 10, y: 10, w: 200, h: 200, rot: 0 }, alt: 'a cog' }),
    obj('p-photo', { kind: 'pic', media: 'm/photo', mediaMime: 'image/jpeg', box: { x: 0, y: -2, w: 1000, h: 500, rot: 0 } }),
    obj('p-panel', { kind: 'pic', media: 'm/panel', mediaMime: 'image/png', box: { x: 0, y: 0, w: 500, h: 250, rot: 0 } }),
    obj('p-gone', { kind: 'pic', media: 'm/missing', mediaMime: 'image/png' }),
    obj('tbl', { kind: 'table', table: [['a', 'b'], ['1', '2']] }),
    obj('cht', { kind: 'chart', chartData: { type: 'bar', categories: ['x'], series: [{ name: 's', values: [1] }, { values: [2] }] } }),
  ];
  const deck = deckOf(objects, { background: { media: 'm/ground' } });
  const inventory = inventoryFromSource(deck, censusOf({ 'p-logo': 'logo-candidate', 'p-icon': 'unknown', 'p-photo': 'unknown' }, ['p-icon']), {
    media, crops: new Map([['p-photo', { t: 0.0886, b: 0.068 }]]), name: 'given.pptx', sha256: SHA('f'), bytes: 99,
  });
  assertValid(inventory);
  const slide = inventory.slides[0]!;
  const kinds = Object.fromEntries(slide.pictures.map((p) => [p.objectId, p.kind]));
  assert.deepEqual(kinds, { 's1#background': 'background', 'p-logo': 'logo', 'p-icon': 'icon', 'p-photo': 'photo', 'p-panel': 'picture' });
  const photo = slide.pictures.find((p) => p.objectId === 'p-photo')!;
  assert.deepEqual(photo.crop, { t: 0.0886, b: 0.068 });
  assert.equal(photo.file, '/tmp/x.jpg');
  assert.equal(photo.width, 2048);
  assert.equal(photo.box.y, -0.004, 'a box partly off the slide keeps its real geometry');
  assert.equal(slide.pictures.find((p) => p.objectId === 'p-icon')!.alt, 'a cog');
  assert.deepEqual(slide.tables, [{ objectId: 'tbl', rows: [['a', 'b'], ['1', '2']] }]);
  assert.deepEqual(slide.charts, [{ objectId: 'cht', type: 'bar', categories: ['x'], series: [{ name: 's', values: [1] }, { values: [2] }] }]);
  assert.equal(slide.objects.length, objects.length, 'every object is listed with its class, decoration included');
  assert.deepEqual(inventory.media.map((m) => m.sha256), [SHA('1'), SHA('2'), SHA('3'), SHA('4'), SHA('5')]);
  assert.deepEqual(inventory.warnings.map((w) => w.code), ['media-unknown'], 'a picture whose bytes were not read is reported, not dropped silently');
  assert.deepEqual([inventory.source.name, inventory.source.sha256, inventory.source.bytes], ['given.pptx', SHA('f'), 99]);
});

test('notes keep paragraphs and line breaks apart, and fall back to one paragraph from the flat string', () => {
  const notesParas = [[
    { runs: [{ text: '' }] },
    { runs: [{ text: '  OPENING' }, { text: '\n' }, { text: 'Start low' }, { text: '\n' }, { text: '\n' }, { text: 'TIMING' }] },
    { runs: [{ text: 'Sources: here  ' }] },
  ]];
  const structured = inventoryFromSource(deckOf([], { notes: 'ignored when paragraphs are given' }), censusOf({}), { media: new Map(), notesParas });
  assert.deepEqual(structured.slides[0]!.notes, {
    text: 'OPENING\nStart low\n\u00a0\nTIMING\n\nSources: here',
    paragraphs: [{ lines: ['OPENING', 'Start low', '', 'TIMING'] }, { lines: ['Sources: here'] }],
  });
  const flat = inventoryFromSource(deckOf([], { notes: 'One\nTwo' }), censusOf({}), { media: new Map() });
  assert.deepEqual(flat.slides[0]!.notes, { text: 'One\nTwo', paragraphs: [{ lines: ['One', 'Two'] }] });
  const none = inventoryFromSource(deckOf([]), censusOf({}), { media: new Map(), notesParas: [[{ runs: [{ text: '   ' }] }]] });
  assert.equal(none.slides[0]!.notes, null, 'blank notes are no notes');
  assertValid(structured);
});

test('the projection is deterministic and refuses a source kind it does not inventory', () => {
  const deck = deckOf([obj('t', { text: { paras: [{ runs: [{ text: 'Hello' }] }] } })]);
  const a = inventoryFromSource(deck, censusOf({}), { media: new Map() });
  const b = inventoryFromSource(structuredClone(deck), censusOf({}), { media: new Map() });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const image = { ...deck, source: { ...deck.source, kind: 'image' as const } };
  assert.throws(() => inventoryFromSource(image, censusOf({}), { media: new Map() }), TypeError);
});

test('a face name states its weight, and a plain name states none', () => {
  assert.deepEqual(
    ['SUSE Thin', 'SUSE ExtraLight', 'SUSE Light', 'SUSE Regular', 'SUSE Medium', 'Open Sans SemiBold', 'SUSE Bold', 'SUSE ExtraBold', 'SUSE Black', 'SUSE'].map(weightOfFace),
    [100, 200, 300, 400, 500, 600, 700, 800, 900, undefined],
  );
});

test('hidden objects stay out of text and pictures, and a PDF keeps its invisible text marked hidden', () => {
  const media = new Map<string, InventoryMediaInputV1>([['m/alt', { sha256: SHA('6'), mime: 'image/png', bytes: 20 }]]);
  const objects = [
    obj('t-shown', { text: { paras: [{ runs: [{ text: 'Shown copy' }] }] } }),
    obj('t-alternate', { hidden: true, text: { paras: [{ runs: [{ text: 'Alternate copy the designer switched off' }] }] } }),
    obj('p-alternate', { kind: 'pic', hidden: true, media: 'm/alt', mediaMime: 'image/png', box: { x: 500, y: 200, w: 300, h: 200, rot: 0 } }),
  ];
  const pptx = inventoryFromSource(deckOf(objects), censusOf({}), { media });
  assertValid(pptx);
  const slide = pptx.slides[0]!;
  assert.deepEqual(slide.text.map((t) => t.objectId), ['t-shown']);
  assert.deepEqual(slide.pictures, []);
  assert.deepEqual(slide.objects.filter((o) => o.hidden).map((o) => o.id), ['t-alternate', 'p-alternate'], 'objects still lists them, marked');
  const left = pptx.warnings.filter((w) => w.code === 'hidden-left-out');
  assert.equal(left.length, 1, 'one warning per slide');
  assert.match(left[0]!.message, /^Slide 1: 2 hidden objects are left out/);

  // On a scanned PDF the invisible text is the OCR layer: the only words the page has.
  const scan = deckOf([obj('ocr-line', { hidden: true, text: { paras: [{ runs: [{ text: 'Quarterly results' }] }] } })]);
  scan.source.kind = 'pdf';
  const pdf = inventoryFromSource(scan, censusOf({}), { media: new Map() });
  assertValid(pdf);
  assert.deepEqual(pdf.slides[0]!.text.map((t) => [t.plain, t.hidden]), [['Quarterly results', true]]);
  assert.deepEqual(pdf.warnings.map((w) => w.code), ['hidden-text-kept']);
});

test('a citation needs its mark: a headline that starts with Data, Notes or Figures stays body', () => {
  const at = (id: string, text: string, sizePt: number): SourceObjectV1 => obj(id, { text: { paras: [{ runs: [{ text, sizePt }] }] } });
  const objects = [
    at('data-headline', 'Data is how we lose the exit', 40),
    at('data-driven', 'Data-driven decisions, made slowly', 28),
    at('notes-from', 'Notes from the field', 24),
    at('figures-matter', 'Figures that matter', 24),
    at('big-source', 'Source: the archive', 40),
    at('source', 'Source: the archive', 12),
    at('figure', 'Figure 3: Revenue by region', 12),
    at('credit', 'Photo credit - Jane Doe', 12),
    at('data-colon', 'Data: company filings, 2025', 14),
  ];
  const inventory = inventoryFromSource(deckOf(objects), censusOf({}), { media: new Map() });
  const role = Object.fromEntries(inventory.slides[0]!.text.map((t) => [t.objectId, t.role]));
  assert.deepEqual(role, {
    'data-headline': 'body', 'data-driven': 'body', 'notes-from': 'body', 'figures-matter': 'body', 'big-source': 'body',
    source: 'caption', figure: 'caption', credit: 'caption', 'data-colon': 'caption',
  });
});

test('ligatures a PDF carries are folded to their letters in runs, plain text and tables', () => {
  assert.equal(foldLigatures('\uFB00 \uFB01 \uFB02 \uFB03 \uFB04 \uFB05 \uFB06 caf\u00e9 \u2460'), 'ff fi fl ffi ffl st st caf\u00e9 \u2460', 'only the ligature block changes');
  const deck = deckOf([
    obj('t', { text: { paras: [{ runs: [{ text: 'O\uFB03ce hours' }] }, { runs: [{ text: '3 Work\uFB02ows & crews' }] }] } }),
    obj('tbl', { kind: 'table', table: [['veri\uFB01ability']] }),
  ]);
  deck.source.kind = 'pdf';
  const inventory = inventoryFromSource(deck, censusOf({}), { media: new Map() });
  const text = inventory.slides[0]!.text[0]!;
  assert.equal(text.plain, 'Office hours\n3 Workflows & crews');
  assert.equal(text.paragraphs[0]!.runs[0]!.text, 'Office hours');
  assert.deepEqual(inventory.slides[0]!.tables[0]!.rows, [['verifiability']]);
});

test('a picture whose bytes were not stored is reported, and a drawing reports its SVG over the shared raster', () => {
  const media = new Map<string, InventoryMediaInputV1>([
    ['m/raster', { sha256: SHA('7'), mime: 'image/png', bytes: 1327, width: 240, height: 150 }],
    ['m/svg-a', { sha256: SHA('8'), mime: 'image/svg+xml', bytes: 1739 }],
    ['m/svg-b', { sha256: SHA('9'), mime: 'image/svg+xml', bytes: 1918 }],
  ]);
  const box = { x: 100, y: 100, w: 400, h: 200, rot: 0 };
  const objects = [
    obj('chart-a', { kind: 'vector', media: 'm/raster', mediaMime: 'image/png', box }),
    obj('chart-b', { kind: 'vector', media: 'm/raster', mediaMime: 'image/png', box }),
    obj('chart-c', { kind: 'vector', media: 'm/raster', mediaMime: 'image/png', box }),
    obj('gone', { kind: 'pic', fidelity: { state: 'unavailable', reason: 'media-missing' } }),
    obj('huge', { kind: 'pic', fidelity: { state: 'unavailable', reason: 'media-too-large' } }),
  ];
  const inventory = inventoryFromSource(deckOf(objects), censusOf({}), { media, vectors: new Map([['chart-a', 'm/svg-a'], ['chart-b', 'm/svg-b']]) });
  assertValid(inventory);
  const pictures = Object.fromEntries(inventory.slides[0]!.pictures.map((p) => [p.objectId, p]));
  assert.deepEqual([pictures['chart-a']!.ref, pictures['chart-a']!.mime, pictures['chart-a']!.fallbackRef], ['m/svg-a', 'image/svg+xml', 'm/raster']);
  assert.equal(pictures['chart-b']!.sha256, SHA('9'), 'two drawings that share a raster stay apart');
  assert.deepEqual([pictures['chart-c']!.ref, pictures['chart-c']!.fallbackRef], ['m/raster', undefined], 'with no SVG the raster is the picture');
  const unavailable = inventory.warnings.filter((w) => w.code === 'media-unavailable');
  assert.equal(unavailable.length, 2);
  assert.match(unavailable[0]!.message, /^Slide 1: the picture gone is left out: its picture part is missing from the file\.$/);
  assert.match(unavailable[1]!.message, /huge is left out: its picture is over the size the reader stores/);
});

test('a slide the source marks flattened is reported, and its page picture is content, not a ground', () => {
  const media = new Map<string, InventoryMediaInputV1>([['m/page', { sha256: SHA('c'), mime: 'image/png', bytes: 99 }]]);
  const deck = deckOf([obj('page', { kind: 'pic', media: 'm/page', mediaMime: 'image/png', box: { x: 0, y: 0, w: 1000, h: 500, rot: 0 } })], {
    origin: { kind: 'pdf', flattened: true }, ocr: { state: 'not-run' },
  });
  const inventory = inventoryFromSource(deck, censusOf({}), { media });
  assertValid(inventory);
  assert.equal(inventory.slides[0]!.pictures[0]!.kind, 'picture');
  assert.deepEqual(inventory.warnings, [{ code: 'slide-flattened', message: 'Slide 1 is one picture of its text, kept as that picture; the text was not read (OCR not run).' }]);
});

// ─── the host half, over the public notes deck ───────────────────────────────

test('notes.pptx reads with its notes structure, roles and picture, valid against the schema', async () => {
  const bytes = new Uint8Array(readFileSync(NOTES_DECK));
  const { inventory, written } = await readContentInventory({ bytes, name: 'notes.pptx' });
  assertValid(inventory);
  assert.deepEqual(written, [], 'nothing is written without a media folder');
  assert.equal(inventory.source.kind, 'pptx');
  assert.equal(inventory.source.slides, 3);
  assert.deepEqual([inventory.source.width, inventory.source.height], [1280, 720]);
  const [one, two, three] = inventory.slides;
  assert.deepEqual(one!.notes, {
    // Plan 291 M4: the authoring form, paragraphs a blank line apart and an empty line inside one a no-break space.
    text: `${NOTES_FIXTURE_LINES.map((l) => (l === '' ? '\u00a0' : l)).join('\n')}\n\n${NOTES_FIXTURE_SOURCE}`,
    paragraphs: [{ lines: [...NOTES_FIXTURE_LINES] }, { lines: [NOTES_FIXTURE_SOURCE] }],
  });
  assert.ok(one!.notes!.text.includes(`${NOTES_FIXTURE_LINES[0]}\n${NOTES_FIXTURE_LINES[1]}`), 'nothing is merged across a line break');
  assert.deepEqual(two!.notes!.paragraphs, NOTES_FIXTURE_SLIDE2.map((line) => ({ lines: [line] })));
  assert.equal(three!.notes, null);
  assert.deepEqual(one!.text.map((t) => [t.role, t.plain]), [
    ['label', 'A SHORT HISTORY OF BRIDGES'],
    ['title', 'Five spans we built before the road'],
    ['body', 'Timber, stone, iron, steel and concrete.'],
  ]);
  assert.deepEqual(three!.text.map((t) => t.role), ['title', 'caption']);
  // A PNG over the whole slide: with no pixel statistics it reads as the ground.
  assert.equal(two!.pictures.length, 1);
  assert.equal(two!.pictures[0]!.kind, 'background');
  assert.deepEqual([two!.pictures[0]!.width, two!.pictures[0]!.height], [240, 135]);
  assert.equal(inventory.media.length, 1);
  assert.equal(inventory.media[0]!.sha256, two!.pictures[0]!.sha256);
  const again = await readContentInventory({ bytes, name: 'notes.pptx' });
  assert.equal(JSON.stringify(again.inventory), JSON.stringify(inventory), 'two reads of the same bytes agree byte for byte');
});

test('media is written once by hash, reused when identical, and refused when other bytes hold the name', async () => {
  const dir = scratch();
  try {
    const bytes = new Uint8Array(readFileSync(NOTES_DECK));
    const first = await readContentInventory({ bytes, name: 'notes.pptx', mediaDir: dir });
    const entry = first.inventory.media[0]!;
    const name = mediaFileName(entry.sha256, entry.mime);
    assert.equal(name, `${entry.sha256}.png`);
    assert.deepEqual(first.written, [join(dir, name)]);
    assert.equal(entry.file, join(dir, name));
    assert.equal(first.inventory.slides[1]!.pictures[0]!.file, join(dir, name));
    assert.deepEqual(readdirSync(dir), [name], 'no temp file is left behind');

    const second = await readContentInventory({ bytes, name: 'notes.pptx', mediaDir: dir });
    assert.deepEqual([second.written, second.reused], [[], [join(dir, name)]]);

    writeFileSync(join(dir, name), 'not the picture');
    await assert.rejects(readContentInventory({ bytes, name: 'notes.pptx', mediaDir: dir }), (err: unknown) => {
      assert.ok(err instanceof ContentInventoryError);
      assert.equal(err.code, 'media.exists');
      assert.deepEqual(err.files, [join(dir, name)]);
      return true;
    });
    assert.equal(readFileSync(join(dir, name), 'utf8'), 'not the picture', 'a refusal writes nothing');

    const forced = await readContentInventory({ bytes, name: 'notes.pptx', mediaDir: dir, force: true });
    assert.deepEqual(forced.written, [join(dir, name)]);
    assert.equal(readFileSync(join(dir, name)).length, entry.bytes);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a PDF reads too, with no notes', async () => {
  const { inventory } = await readContentInventory({ bytes: new Uint8Array(readFileSync(FLATTENED_PDF)), name: 'flattened.pdf' });
  assertValid(inventory);
  assert.equal(inventory.source.kind, 'pdf');
  assert.equal(inventory.slides.length, 3);
  assert.ok(inventory.slides.every((slide) => slide.notes === null));
  assert.ok(inventory.media.length >= 1, 'each page picture is a media entry');
});

test('flattened.pdf says each page is one picture of its text and that OCR did not run', async () => {
  const { inventory } = await readContentInventory({ bytes: new Uint8Array(readFileSync(FLATTENED_PDF)), name: 'flattened.pdf' });
  const flattened = inventory.warnings.filter((w) => w.code === 'slide-flattened');
  assert.deepEqual(flattened.map((w) => w.message.slice(0, 8)), ['Slide 1 ', 'Slide 2 ', 'Slide 3 ']);
  assert.match(flattened[1]!.message, /Slide 2 is one picture of its text.*not read \(OCR not run\)/);
  for (const slide of inventory.slides) {
    assert.deepEqual(slide.text, []);
    assert.deepEqual(slide.pictures.map((p) => p.kind), ['picture']);
  }
});

test('vector.pptx reports each drawing as its own SVG and writes the SVGs under the media folder', async () => {
  const dir = scratch();
  try {
    const { inventory, media } = await readContentInventory({ bytes: new Uint8Array(readFileSync(VECTOR_DECK)), name: 'vector.pptx', mediaDir: dir });
    assertValid(inventory);
    const charts = inventory.slides.map((slide) => slide.pictures.find((p) => p.objectId === `${slide.id}.2`)!);
    assert.equal(new Set(charts.map((c) => c.sha256)).size, 3, 'three different charts, three hashes');
    assert.ok(charts.every((c) => c.mime === 'image/svg+xml' && c.fallbackRef && c.file!.endsWith('.svg')));
    assert.equal(new Set(charts.map((c) => c.fallbackRef)).size, 1, 'they share one raster stand-in');
    const logo = inventory.slides[0]!.pictures.find((p) => p.objectId.endsWith('.0'))!;
    assert.equal(logo.mime, 'image/svg+xml', 'the logo is its SVG, not the 96x24 raster');
    const svgs = readdirSync(dir).filter((f) => f.endsWith('.svg'));
    assert.equal(svgs.length, 4);
    for (const chart of charts) assert.ok(readFileSync(chart.file!, 'utf8').includes('<svg'));
    for (const chart of charts) assert.ok(media.get(chart.ref), 'the returned media map holds the SVG bytes too');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a picture whose part is missing from the package is reported, not dropped silently', async () => {
  const parts = unzipSync(new Uint8Array(readFileSync(NOTES_DECK)));
  const picture = Object.keys(parts).find((name) => /^ppt\/media\/.*\.png$/.test(name));
  assert.ok(picture, 'notes.pptx holds a PNG');
  delete parts[picture];
  const { inventory } = await readContentInventory({ bytes: zipSync(parts), name: 'missing-media.pptx' });
  assert.deepEqual(inventory.slides[1]!.pictures, []);
  const warning = inventory.warnings.find((w) => w.code === 'media-unavailable');
  assert.ok(warning, JSON.stringify(inventory.warnings));
  assert.match(warning.message, /^Slide 2: the picture .* is left out: its picture part is missing from the file\.$/);
});

/** Turn layers off in a PSD by their record index (bottom first): the layer record's flags bit 1. */
function hidePsdLayers(source: Uint8Array, hide: ReadonlySet<number>): Uint8Array {
  const bytes = new Uint8Array(source);
  const view = new DataView(bytes.buffer);
  let at = 26;
  at += 4 + view.getUint32(at); // colour mode data
  at += 4 + view.getUint32(at); // image resources
  at += 8; // layer and mask section length, then layer info length
  const count = Math.abs(view.getInt16(at));
  at += 2;
  for (let i = 0; i < count; i++) {
    at += 16;
    at += 2 + view.getUint16(at) * 6;
    at += 10; // blend signature and key, opacity, clipping
    if (hide.has(i)) bytes[at] = bytes[at]! | 0x02;
    at += 2;
    at += 4 + view.getUint32(at);
  }
  return bytes;
}

test('a Photoshop file lists only the layers it shows: hidden raster and type layers are left out with a warning', async () => {
  const solid = (w: number, h: number, v: number): Uint8Array => new Uint8Array(w * h * 4).fill(v);
  const raster = writePsd({ width: 400, height: 300, layers: [
    { name: 'Background', x: 0, y: 0, width: 400, height: 300, pixels: solid(400, 300, 240) },
    { name: 'Visible photo', x: 20, y: 20, width: 200, height: 150, pixels: solid(200, 150, 90) },
    { name: 'HIDDEN alternate', x: 200, y: 120, width: 180, height: 160, pixels: solid(180, 160, 30), visible: false },
  ] });
  const shown = (await readContentInventory({ bytes: raster, name: 'hidden.psd' })).inventory;
  assertValid(shown);
  assert.ok(!shown.slides[0]!.pictures.some((p) => p.alt === 'HIDDEN alternate'), 'the hidden layer is not a picture');
  assert.equal(shown.slides[0]!.pictures.length, 2);
  assert.ok(shown.slides[0]!.objects.some((o) => o.hidden));
  assert.equal(shown.warnings.filter((w) => w.code === 'hidden-left-out').length, 1);

  const plain = (await readContentInventory({ bytes: new Uint8Array(readFileSync(TEXT_PSD)), name: 'text.psd' })).inventory;
  const typeLayer = plain.slides[0]!.text[0]!;
  const typeIndex = Number(/layer-(\d+)$/.exec(typeLayer.objectId)![1]);
  const hidden = (await readContentInventory({ bytes: hidePsdLayers(new Uint8Array(readFileSync(TEXT_PSD)), new Set([typeIndex])), name: 'text.psd' })).inventory;
  assertValid(hidden);
  assert.deepEqual(hidden.slides[0]!.text, [], 'the hidden type layer is not copy to rebuild');
  assert.equal(hidden.slides[0]!.pictures.length, plain.slides[0]!.pictures.length, 'the shown raster stays');
  assert.deepEqual(hidden.slides[0]!.objects.filter((o) => o.hidden).map((o) => o.id), [typeLayer.objectId]);
  assert.match(hidden.warnings.find((w) => w.code === 'hidden-left-out')!.message, /one hidden object is left out/);
});

// ─── the verb ────────────────────────────────────────────────────────────────

interface Run { status: number | null; stdout: string; stderr: string }

function lolly(...args: string[]): Run {
  const out = spawnSync(process.execPath, [LOLLY, ...args], {
    cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', NO_COLOR: '1' },
  });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

interface ReadEnvelope { command: string; ok: boolean; result: ContentInventoryV1 | null; error: { kind: string; exit: number; detail?: string } | null }

const envelopeOf = (run: Run): ReadEnvelope => {
  assert.ok(run.stdout.trim().startsWith('{'), `expected a JSON envelope, got: ${run.stdout.slice(0, 200)} / ${run.stderr.slice(0, 400)}`);
  return JSON.parse(run.stdout) as ReadEnvelope;
};

test('lolly read --json writes the media and returns the inventory in the envelope', () => {
  const dir = scratch();
  try {
    const run = lolly('read', NOTES_DECK, '--json', `--media=${dir}`);
    assert.equal(run.status, 0, run.stderr);
    const env = envelopeOf(run);
    assert.equal(env.command, 'read');
    assert.equal(env.ok, true);
    assertValid(env.result);
    assert.equal(env.result!.slides[0]!.notes!.paragraphs[0]!.lines[1], NOTES_FIXTURE_LINES[1]);
    const file = env.result!.media[0]!.file!;
    assert.ok(existsSync(file) && file.startsWith(dir), `the picture was written under --media: ${file}`);

    writeFileSync(file, 'other bytes');
    const refused = lolly('read', NOTES_DECK, '--json', `--media=${dir}`);
    assert.equal(refused.status, 4, 'other bytes under a picture name are a refusal, not a failure');
    assert.equal(envelopeOf(refused).error?.kind, 'MEDIA_EXISTS');
    assert.equal(lolly('read', NOTES_DECK, '--json', `--media=${dir}`, '--force').status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lolly read prints an outline without --json, and refuses a bare --media or a missing deck', () => {
  const outline = lolly('read', NOTES_DECK);
  assert.equal(outline.status, 0, outline.stderr);
  assert.match(outline.stdout, /^Slide 1 {2}\(Content\)\n {2}\[label\] A SHORT HISTORY OF BRIDGES\n/);
  assert.match(outline.stdout, /notes \(2 paragraphs\): OPENING/);
  assert.match(outline.stderr, /Read 3 slides of notes\.pptx/);

  const bare = lolly('read', NOTES_DECK, '--media', '--json');
  assert.equal(bare.status, 2);
  assert.equal(envelopeOf(bare).error?.kind, 'MISSING_FLAG_VALUE');

  const none = lolly('read', '--json');
  assert.equal(none.status, 2);
  assert.equal(envelopeOf(none).error?.kind, 'MISSING_ARGUMENT');
  assert.equal(lolly('read', join(REPO, 'tests', 'fixtures', 'rebrand', 'no-such-deck.pptx'), '--json').status, 2);

  const empty = lolly('read', NOTES_DECK, '--media=', '--json');
  assert.equal(empty.status, 2, 'an empty --media= is refused, not read as absent');
  assert.equal(envelopeOf(empty).error?.kind, 'MISSING_FLAG_VALUE');
});

test('lolly read names a folder deck and an unusable media folder with its own kinds', () => {
  const dir = scratch();
  try {
    const folder = join(dir, 'deck.pptx');
    mkdirSync(folder);
    const deck = lolly('read', folder, '--json');
    assert.equal(deck.status, 2);
    const deckError = envelopeOf(deck).error!;
    assert.equal(deckError.kind, 'SOURCE_IS_FOLDER');
    assert.match((deckError as { message?: string }).message ?? '', /deck\.pptx is a folder; lolly read takes one deck file/);

    const file = join(dir, 'not-a-folder');
    writeFileSync(file, 'x');
    const media = lolly('read', NOTES_DECK, '--json', `--media=${file}`);
    assert.equal(media.status, 1);
    const mediaError = envelopeOf(media).error!;
    assert.equal(mediaError.kind, 'MEDIA_UNWRITABLE');
    assert.equal(mediaError.detail, 'media.unwritable');
    assert.match((mediaError as { message?: string }).message ?? '', /Cannot use .*not-a-folder as the media folder/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lolly read --thumbnails draws each slide as a PNG beside the pictures', () => {
  const dir = scratch();
  try {
    const run = lolly('read', VECTOR_DECK, '--json', `--media=${dir}`, '--thumbnails');
    assert.equal(run.status, 0, run.stderr);
    const inventory = envelopeOf(run).result!;
    assertValid(inventory);
    for (const slide of inventory.slides) {
      const thumb = slide.thumbnail;
      assert.ok(thumb, `slide ${slide.number} has a thumbnail`);
      assert.deepEqual([thumb.width, thumb.height], [640, 360]);
      const png = readFileSync(thumb.file);
      assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47], 'a PNG');
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [640, 360]);
    }
    assert.equal(new Set(inventory.slides.map((s) => s.thumbnail!.file)).size, 3);

    const bare = lolly('read', VECTOR_DECK, '--json', '--thumbnails');
    assert.equal(bare.status, 2, '--thumbnails needs --media');
    const plain = lolly('read', VECTOR_DECK, '--json');
    assert.ok(envelopeOf(plain).result!.slides.every((s) => s.thumbnail === undefined), 'no thumbnails unless asked');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── the private acceptance deck ─────────────────────────────────────────────

const SLEEPWALKING = (process.env.LOLLY_SLEEPWALKING_DECK ?? '').trim();
const sleepwalkingSkip = SLEEPWALKING && existsSync(SLEEPWALKING)
  ? false
  : 'the private Sleepwalking deck fixture is not on this machine (set LOLLY_SLEEPWALKING_DECK)';

test('the Sleepwalking deck reads as 16 slides with five notes and its pictures (plan 291 acceptance)', { skip: sleepwalkingSkip }, () => {
  const dir = scratch();
  try {
    const run = lolly('read', SLEEPWALKING, '--json', `--media=${dir}`);
    assert.equal(run.status, 0, run.stderr);
    const inventory = envelopeOf(run).result!;
    assertValid(inventory);
    assert.equal(inventory.slides.length, 16);
    assert.deepEqual(inventory.slides.filter((s) => s.notes).map((s) => s.number), [3, 4, 7, 10, 13]);
    assert.ok(inventory.slides[3]!.notes!.paragraphs[0]!.lines.length > 1, 'an a:br keeps the notes lines of one paragraph apart');
    // Thirteen files the deck draws; a drawing's SVG, reported beside its raster stand-in, is extra.
    assert.equal(inventory.media.filter((m) => m.mime !== 'image/svg+xml').length, 13);
    const kinds = new Map<string, Set<string>>();
    for (const slide of inventory.slides) for (const p of slide.pictures) (kinds.get(p.kind) ?? kinds.set(p.kind, new Set()).get(p.kind)!).add(p.sha256);
    assert.deepEqual(Object.fromEntries([...kinds].map(([k, v]) => [k, v.size])), { photo: 3, background: 1, logo: 1, icon: 8 });
    assert.equal(inventory.media.filter((m) => m.mime === 'image/jpeg').length, 3);
    assert.equal(readdirSync(dir).length, inventory.media.length);
    const pdf = SLEEPWALKING.replace(/\.pptx$/i, '.pdf');
    if (pdf !== SLEEPWALKING && existsSync(pdf)) {
      const fromPdf = lolly('read', pdf, '--json');
      assert.equal(fromPdf.status, 0, fromPdf.stderr);
      const read = envelopeOf(fromPdf).result!;
      assert.equal(read.slides.length, 16);
      const titleStart = inventory.slides[2]!.text.find((t) => t.role === 'title')!.plain.split(/\s+/).slice(0, 2).join(' ');
      assert.ok(read.slides[2]!.text.some((t) => t.plain.includes(titleStart)), 'a font whose ToUnicode map ends short still reads');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

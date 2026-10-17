// SPDX-License-Identifier: MPL-2.0
/**
 * Read and extract (plan 203, rank 10): `readExtract`, the page selection, the
 * budget and its continuation, the origin of each block, the text writers, the
 * active-content warnings (engine/src/read-extract.ts) and the quality measures
 * (engine/src/read-extract-quality.ts), over hand-built inventories.
 *
 * The labelled fixture files are read end to end in read-extract-fixtures.test.ts.
 *
 * Run with: node --test tests/read-extract.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import {
  activeContentWarnings, extractMarkdown, extractPlainText, ooxmlActiveContent, parsePageSelection, readExtract, ReadExtractError,
} from '../engine/src/read-extract.ts';
import { characterErrorRate, editDistance, scoreExtract, wordErrorRate } from '../engine/src/read-extract-quality.ts';
import type { ContentInventoryV1, InventorySlideV1, InventoryTextV1 } from '../packages/core/src/content-inventory-v1.ts';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const schema = JSON.parse(readFileSync(join(REPO, 'schemas', 'read-extract-v1.schema.json'), 'utf8')) as object;
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
const assertValid = (doc: unknown): void => {
  assert.ok(validate(doc), `the extract breaks its schema: ${JSON.stringify(validate.errors?.slice(0, 5))}`);
};

const SHA = (c: string): string => c.repeat(64);
const BOX = { x: 0.1, y: 0.1, width: 0.5, height: 0.1 };

function frame(objectId: string, plain: string, extra: Partial<InventoryTextV1> = {}): InventoryTextV1 {
  return { objectId, role: 'body', class: 'content', box: BOX, paragraphs: [{ runs: [{ text: plain }] }], plain, ...extra };
}

function slide(number: number, text: InventoryTextV1[], extra: Partial<InventorySlideV1> = {}): InventorySlideV1 {
  return { number, id: `s${number}`, text, notes: null, pictures: [], tables: [], charts: [], objects: [], ...extra };
}

function inventoryOf(slides: InventorySlideV1[]): ContentInventoryV1 {
  return {
    version: 'lolly/content-inventory-v1',
    source: { name: 'unit.pptx', sha256: SHA('a'), bytes: 1000, kind: 'pptx', slides: slides.length, width: 1280, height: 720, title: 'Unit' },
    slides,
    media: [{ ref: 'user/media/p', sha256: SHA('b'), mime: 'image/png', bytes: 10, width: 4, height: 3, file: 'out/p.png' }],
    warnings: [{ code: 'reader-note', message: 'A note from the reader.' }],
  };
}

/** Three pages: authored text, a table, a chart, a picture and notes on page 1; a scan read by recognition on page 2; a scan with a text layer on page 3. */
const DECK = inventoryOf([
  slide(1, [frame('t1', 'Title words', { role: 'title' }), frame('t2', 'Body words here')], {
    tables: [{ objectId: 'tb', rows: [['Name', 'Size'], ['A', '1']] }],
    charts: [{ objectId: 'ch', type: 'bar', categories: ['Q1', 'Q2'], series: [{ name: 'Sales', values: [3, 5] }] }],
    pictures: [{ objectId: 'pic', ref: 'user/media/p', sha256: SHA('b'), mime: 'image/png', bytes: 10, width: 4, height: 3, box: BOX, kind: 'photo', class: 'photo', alt: 'A hill' }],
    notes: { text: 'Speak slowly.', paragraphs: [{ lines: ['Speak slowly.'] }] },
  }),
  slide(2, [
    frame('r1', 'Read by a model', { recognition: { model: 'ocr-x', modelVersion: '1', languages: ['en'], confidence: 0.92, minConfidence: 0.9, lines: 1 } }),
    frame('r2', 'faint line', { recognition: { model: 'ocr-x', confidence: 0.41, minConfidence: 0.41, lines: 1 } }),
  ], { flattened: true }),
  slide(3, [frame('layer', 'Scanned words', { hidden: true, recognition: { model: 'pdf-text-layer', confidence: 1, minConfidence: 1, lines: 1 } })], { flattened: true }),
]);

// ─── the page selection ──────────────────────────────────────────────────────

test('a page selection names pages once, in order, and refuses a page outside the file', () => {
  assert.deepEqual(parsePageSelection(undefined, 4), [1, 2, 3, 4]);
  assert.deepEqual(parsePageSelection('  ', 3), [1, 2, 3]);
  assert.deepEqual(parsePageSelection('3,1-2,2', 5), [1, 2, 3]);
  assert.deepEqual(parsePageSelection('4-', 6), [4, 5, 6], 'an open range runs to the last page');
  assert.deepEqual(parsePageSelection('5-3', 6), [3, 4, 5], 'a range written backwards reads the same pages');
  assert.deepEqual(parsePageSelection([3, 1, 3], 3), [1, 3]);
  const code = (fn: () => unknown): string => {
    try { fn(); } catch (err) { assert.ok(err instanceof ReadExtractError); return err.code; }
    return 'none';
  };
  assert.equal(code(() => parsePageSelection('7', 6)), 'pages.outside');
  assert.equal(code(() => parsePageSelection('2-9', 6)), 'pages.outside');
  assert.equal(code(() => parsePageSelection('1', 0)), 'pages.outside');
  assert.equal(code(() => parsePageSelection('0', 6)), 'pages.invalid');
  assert.equal(code(() => parsePageSelection('one', 6)), 'pages.invalid');
  assert.equal(code(() => parsePageSelection('1;2', 6)), 'pages.invalid');
  assert.equal(code(() => parsePageSelection([1.5], 6)), 'pages.invalid');
});

// ─── the blocks ──────────────────────────────────────────────────────────────

test('blocks come per page in a fixed order, each naming its source object, valid against the schema', () => {
  const out = readExtract(DECK);
  assertValid(out);
  assert.equal(out.complete, true);
  assert.equal(out.next, undefined);
  assert.deepEqual(out.blocks.filter((b) => b.page === 1).map((b) => [b.id, b.kind, b.objectId ?? null]), [
    ['p1.0', 'text', 't1'], ['p1.1', 'text', 't2'], ['p1.2', 'table', 'tb'], ['p1.3', 'chart', 'ch'], ['p1.4', 'picture', 'pic'], ['p1.5', 'notes', null],
  ]);
  const table = out.blocks.find((b) => b.kind === 'table')!;
  assert.equal(table.text, 'Name\tSize\nA\t1');
  assert.deepEqual(table.rows, [['Name', 'Size'], ['A', '1']]);
  assert.equal(out.blocks.find((b) => b.kind === 'chart')!.text, 'Chart: bar\nQ1\tQ2\nSales\t3\t5');
  const picture = out.blocks.find((b) => b.kind === 'picture')!;
  assert.equal(picture.text, 'A hill');
  assert.deepEqual(picture.picture, { ref: 'user/media/p', sha256: SHA('b'), mime: 'image/png', kind: 'photo', width: 4, height: 3, file: 'out/p.png' });
  assert.deepEqual(out.source, { name: 'unit.pptx', sha256: SHA('a'), bytes: 1000, kind: 'pptx', pages: 3, title: 'Unit' });
  assert.equal(out.chars, out.blocks.reduce((n, b) => n + Array.from(b.text).length, 0));
  assert.ok(out.warnings.some((w) => w.code === 'reader-note'), 'the inventory warnings are carried');
});

test('authored, text-layer and recognised words stay apart, and a recognised block keeps its model and confidence', () => {
  const out = readExtract(DECK, { kinds: ['text'] });
  const origin = Object.fromEntries(out.blocks.map((b) => [b.objectId, b.origin]));
  assert.deepEqual(origin, { t1: 'authored', t2: 'authored', r1: 'recognized', r2: 'recognized', layer: 'text-layer' });
  assert.deepEqual(out.blocks.find((b) => b.objectId === 'r1')!.recognition, { model: 'ocr-x', modelVersion: '1', languages: ['en'], confidence: 0.92, minConfidence: 0.9, lines: 1 });
  assert.equal(out.blocks.find((b) => b.objectId === 't1')!.recognition, undefined);
  assert.deepEqual(out.pages.map((p) => [p.number, p.scanned ?? false, p.read ?? null]), [[1, false, null], [2, true, 'recognized'], [3, true, 'text-layer']]);
  // A PDF's invisible text with no record is the text layer too.
  const bare = readExtract(inventoryOf([slide(1, [frame('h', 'Invisible', { hidden: true })])]));
  assert.equal(bare.blocks[0]!.origin, 'text-layer');
});

test('a scanned page whose words were not read says so instead of reading as empty', () => {
  const out = readExtract(inventoryOf([slide(1, [], { flattened: true, pictures: [] })]));
  assert.deepEqual(out.pages, [{ number: 1, scanned: true, read: 'not-read', blocks: 0 }]);
  assert.match(out.warnings.find((w) => w.code === 'page-not-read')!.message, /^Page 1 is a picture of its text/);
});

test('the page range and the kinds bound the extract, and block ids follow the kinds asked for', () => {
  const out = readExtract(DECK, { pages: '1', kinds: ['notes', 'text'] });
  assert.deepEqual(out.request, { pages: [1], kinds: ['text', 'notes'] });
  assert.deepEqual(out.blocks.map((b) => [b.id, b.kind]), [['p1.0', 'text'], ['p1.1', 'text'], ['p1.2', 'notes']]);
  assert.deepEqual(out.pages.map((p) => p.number), [1]);
  assert.throws(() => readExtract(DECK, { kinds: ['words' as never] }), (err: unknown) => err instanceof ReadExtractError && err.code === 'kinds.invalid');
  assert.throws(() => readExtract(DECK, { kinds: [] }), (err: unknown) => err instanceof ReadExtractError && err.code === 'kinds.invalid');
  assert.throws(() => readExtract(DECK, { pages: '9' }), (err: unknown) => err instanceof ReadExtractError && err.code === 'pages.outside');
});

test('the budget takes blocks whole, names the next one, and continuing from it reads the rest exactly once', () => {
  const whole = readExtract(DECK);
  const budget = 30;
  const seen: string[] = [];
  let from: string | undefined;
  let rounds = 0;
  do {
    const part = readExtract(DECK, { maxChars: budget, ...(from ? { from } : {}) });
    assertValid(part);
    assert.ok(part.chars <= budget, `round ${rounds} stays in budget`);
    assert.ok(part.blocks.every((b) => !b.partial), 'no block here is longer than the budget, so none is cut');
    seen.push(...part.blocks.map((b) => b.id));
    if (!part.complete) {
      assert.ok(part.next);
      assert.ok(part.warnings.some((w) => w.code === 'budget-reached' && w.message.includes(part.next!)));
    }
    from = part.complete ? undefined : part.next;
    rounds++;
  } while (from && rounds < 50);
  assert.deepEqual(seen, whole.blocks.map((b) => b.id), 'every block once, in order');
  assert.ok(rounds > 1);
});

test('a first block longer than the budget is cut at a word, marked partial, and continuing goes on after it', () => {
  const inventory = inventoryOf([slide(1, [frame('long', 'One two three four five six seven'), frame('next', 'after')])]);
  const out = readExtract(inventory, { maxChars: 16 });
  assert.equal(out.blocks.length, 1);
  assert.equal(out.blocks[0]!.text, 'One two three');
  assert.equal(out.blocks[0]!.partial, true);
  assert.equal(out.complete, false);
  assert.equal(out.next, 'p1.1', 'the next call starts after the cut block, so a caller keeping the budget still ends');
  assert.ok(out.warnings.some((w) => w.code === 'block-cut-short' && w.message.startsWith('Block p1.0 is longer')));
  assert.ok(extractPlainText(out).includes('One two three\n[cut short by the budget]'));
  const rest = readExtract(inventory, { maxChars: 16, from: out.next! });
  assert.deepEqual(rest.blocks.map((b) => b.text), ['after']);
  assert.equal(rest.complete, true);
  // The last block cut short: nothing is left to continue to, and the extract still says it is not whole.
  const alone = readExtract(inventoryOf([slide(1, [frame('long', 'One two three four five six seven')])]), { maxChars: 5 });
  assert.deepEqual([alone.blocks[0]!.text, alone.complete, alone.next], ['One', false, undefined]);
  assertValid(alone);
});

test('the budget counts characters as a reader does, so a surrogate pair is one', () => {
  const inventory = inventoryOf([slide(1, [frame('a', '😀😀😀'), frame('b', '辞書')])]);
  assert.equal(readExtract(inventory, { maxChars: 5 }).blocks.length, 2);
  assert.equal(readExtract(inventory, { maxChars: 4 }).blocks.length, 1);
});

test('the confidence floor leaves out recognised blocks only, and says how many', () => {
  const out = readExtract(DECK, { kinds: ['text'], minConfidence: 0.5 });
  assert.deepEqual(out.blocks.map((b) => b.objectId), ['t1', 't2', 'r1', 'layer']);
  assert.equal(out.blocks.find((b) => b.objectId === 'r1')!.id, 'p2.0');
  assert.match(out.warnings.find((w) => w.code === 'low-confidence-left-out')!.message, /^One recognised block was under the confidence floor/);
  assert.equal(out.request.minConfidence, 0.5);
});

test('a request the extract cannot honour is refused with a stable code', () => {
  const code = (opts: Parameters<typeof readExtract>[1]): string => {
    try { readExtract(DECK, opts); } catch (err) { assert.ok(err instanceof ReadExtractError); return err.code; }
    return 'none';
  };
  assert.equal(code({ maxChars: 0 }), 'budget.invalid');
  assert.equal(code({ maxChars: 2.5 }), 'budget.invalid');
  assert.equal(code({ minConfidence: 1.5 }), 'confidence.invalid');
  assert.equal(code({ from: 'later' }), 'from.invalid');
  assert.equal(code({ pages: '1', from: 'p2.0' }), 'from.invalid');
});

test('the same inventory and options give identical bytes', () => {
  assert.equal(JSON.stringify(readExtract(DECK, { maxChars: 40 })), JSON.stringify(readExtract(DECK, { maxChars: 40 })));
});

// ─── the text forms ──────────────────────────────────────────────────────────

test('plain text keeps the words as they are and notes where recognised words came from', () => {
  const text = extractPlainText(readExtract(DECK));
  assert.ok(text.startsWith('Page 1\n\nTitle words\n\nBody words here\n\nName\tSize\nA\t1'));
  assert.ok(text.includes('Picture: A hill'));
  assert.ok(text.includes('Notes:\nSpeak slowly.'));
  assert.ok(text.includes('Read by a model\n[recognised by ocr-x, confidence 92%]'));
  assert.ok(text.includes('Scanned words\n[from the scan text layer]'));
  const stopped = extractPlainText(readExtract(DECK, { maxChars: 12 }));
  assert.ok(stopped.endsWith('[Stopped at the budget; continue from block p1.1.]\n'));
});

test('Markdown escapes what the source says, so a reader sees the file\'s own characters', () => {
  const inventory = inventoryOf([slide(1, [
    frame('t', 'Rates # and *stars*', { role: 'title' }),
    frame('b', '1. not a list\n- nor this'),
  ], { tables: [{ objectId: 'tb', rows: [['a|b', 'c'], ['d']] }], pictures: [{ objectId: 'p', ref: 'user/media/p', sha256: SHA('b'), mime: 'image/png', bytes: 10, box: BOX, kind: 'picture', class: 'content' }] })]);
  const md = extractMarkdown(readExtract(inventory));
  assert.ok(md.startsWith('# Unit\n\n## Page 1\n\n### Rates \\# and \\*stars\\*'));
  assert.ok(md.includes('1\\. not a list  \n\\- nor this'));
  assert.ok(md.includes('| a\\|b | c |\n| --- | --- |\n| d |  |'));
  assert.ok(md.includes('![](out/p.png)'), 'a picture links the file the host wrote');
  const recognised = extractMarkdown(readExtract(DECK, { pages: '2' }));
  assert.ok(recognised.includes('Read by a model\n\n*(recognised by ocr-x, confidence 92%)*'));
});

// ─── what a file carries ─────────────────────────────────────────────────────

test('an Office package\'s macros, controls and embedded objects are counted by name and reported as not run', () => {
  const content = ooxmlActiveContent([
    '[Content_Types].xml', 'ppt/presentation.xml', 'ppt/vbaProject.bin', 'ppt/activeX/activeX1.xml', 'ppt/activeX/activeX1.bin', 'ppt/embeddings/oleObject1.bin',
  ]);
  assert.deepEqual(content, { macros: ['ppt/vbaProject.bin'], controls: 2, embedded: 1 });
  const warnings = activeContentWarnings(content);
  assert.deepEqual(warnings.map((w) => w.code), ['macros-not-run', 'controls-not-run', 'embedded-not-opened']);
  assert.match(warnings[0]!.message, /They were not run/);
  assert.deepEqual(ooxmlActiveContent(['ppt/presentation.xml']), {});
  assert.deepEqual(activeContentWarnings({ scripts: 2, launches: 1 }).map((w) => w.message), ['The file carries 2 scripts and one launch action. None of them ran.']);
  assert.deepEqual(activeContentWarnings({}), []);
});

// ─── measuring ───────────────────────────────────────────────────────────────

test('the error rates count edits per labelled character and word, after NFC and white space folding', () => {
  assert.equal(editDistance([...'kitten'], [...'sitting']), 3);
  assert.equal(characterErrorRate('Qualité', 'Qualité'), 0, 'a decomposed accent is the same character after NFC');
  assert.equal(characterErrorRate('Qualité', 'Qualite'), 1 / 7, 'a dropped accent is an error');
  assert.equal(characterErrorRate('a  b', 'a b'), 0);
  assert.equal(characterErrorRate('', ''), 0);
  assert.equal(characterErrorRate('', 'x'), 1);
  assert.equal(wordErrorRate('one two three', 'one three'), 1 / 3);
});

test('the score sees reading order, recognition errors and origin, not only that text came back', () => {
  const inventory = inventoryOf([slide(1, [frame('a', 'First line'), frame('b', 'Second line'), frame('c', 'Third line')])]);
  const labels = [
    { page: 1, text: 'First line', origin: 'authored' as const },
    { page: 1, text: 'Second line', origin: 'authored' as const },
    { page: 1, text: 'Third line', origin: 'authored' as const },
  ];
  const right = scoreExtract(labels, readExtract(inventory));
  assert.deepEqual(right, { cer: 0, wer: 0, recall: 1, order: 1, origin: 1, labelled: 3, matched: 3 });

  const shuffled = inventoryOf([slide(1, [frame('c', 'Third line'), frame('a', 'First line'), frame('b', 'Second line')])]);
  const wrongOrder = scoreExtract(labels, readExtract(shuffled));
  assert.equal(wrongOrder.recall, 1);
  assert.ok(wrongOrder.order < 1, 'a page read out of order loses order');
  assert.ok(wrongOrder.cer > 0, 'and costs characters over the page');

  const misread = inventoryOf([slide(1, [frame('a', 'Flrst llne', { recognition: { model: 'm', confidence: 0.5, minConfidence: 0.5, lines: 1 } }), frame('b', 'Second line')])]);
  const score = scoreExtract(labels, readExtract(misread));
  assert.equal(score.matched, 2, 'a close misreading still matches; a missing line does not');
  assert.ok(score.cer > 0.2);
  assert.equal(score.origin, 0.5, 'the misread line is recognised where the label says authored');
});

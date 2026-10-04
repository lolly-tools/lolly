// SPDX-License-Identifier: MPL-2.0
/**
 * Fidelity edge cases (plan 291, W1): a string repeated on two slides must reach both
 * artboards, a copy on another artboard is moved rather than carried, house-style
 * edits (`&` for `and`, -ise for -ize) are edits rather than losses, declared
 * deliberate edits are excepted and never passed, and the comparison stays fast and
 * says when it stopped short.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/check-fidelity.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';

import {
  FIDELITY_MAX_SOURCE_STRINGS,
  checkFidelity,
  parseFidelityEdits,
  type CheckFidelityResult,
} from '../engine/src/check-fidelity.ts';
import type { ContentInventoryV1 } from '../packages/core/src/content-inventory-v1.ts';

const SCHEMA = JSON.parse(readFileSync(new URL('../schemas/check-report-v1.schema.json', import.meta.url), 'utf8')) as Record<string, unknown>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validateReport = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);

type Slide = ContentInventoryV1['slides'][number];
const text = (objectId: string, plain: string): Slide['text'][number] => ({
  objectId, role: 'body', class: 'body', box: { x: 0, y: 0, width: 1, height: 0.1 },
  paragraphs: plain.split('\n').map((line) => ({ runs: [{ text: line }] })), plain,
});
const slide = (number: number, lines: string[]): Slide => ({
  number, id: `s${number}`, text: lines.map((line, i) => text(`t${number}-${i}`, line)),
  notes: null, pictures: [], tables: [], charts: [], objects: [],
});
const inventory = (slides: Slide[]): ContentInventoryV1 => ({
  version: 'lolly/content-inventory-v1',
  source: { name: 'src.pptx', sha256: '0'.repeat(64), bytes: 1, kind: 'pptx', slides: slides.length, width: 1280, height: 720 },
  slides, media: [], warnings: [],
});
/** One artboard per entry, its rows stacked down the page. */
const result = (boards: Array<[string, string[]]>): Record<string, unknown>[] =>
  boards.flatMap(([id, lines], b) => [
    { id, kind: 'frame', name: id, x: b * 2000, y: 0, w: 1920, h: 1080, order: b },
    ...lines.map((line, i) => ({ id: `${id}-${i}`, kind: 'text', frame: id, x: b * 2000 + 100, y: 100 + i * 100, w: 1500, h: 80, text: line })),
  ]);

/** The fidelity family as a whole report, held to the published schema. */
function assertValid(r: CheckFidelityResult): void {
  const n = (s: string) => r.findings.filter((f) => f.severity === s).length;
  const counts = { error: n('error'), warn: n('warn'), info: n('info') };
  const zero = { error: 0, warn: 0, info: 0 };
  const report = {
    format: 'lolly-check', version: 1, input: { kind: 'design' },
    outcome: counts.warn ? 'review' : 'clean', exitCode: counts.warn ? 5 : 0, strict: false,
    families: {
      structure: { state: 'skipped', ...zero }, render: { state: 'skipped', ...zero }, brand: { state: 'skipped', ...zero },
      verify: { state: 'skipped', ...zero }, fidelity: { state: 'ran', ...counts },
    },
    summary: counts, findings: r.findings, fidelity: r.fidelity, designSystem: null,
  };
  assert.equal(validateReport(JSON.parse(JSON.stringify(report))), true, JSON.stringify(validateReport.errors, null, 2));
}

test('a title repeated on two slides must reach both artboards: a copy one slide already used is not carried twice', () => {
  const inv = inventory([
    slide(1, ['Quarterly results', 'Revenue grew in every region']),
    slide(2, ['Quarterly results', 'Hiring plan for the second half']),
  ]);
  const dropped = checkFidelity(inv, result([
    ['one', ['Quarterly results', 'Revenue grew in every region']],
    ['two', ['Hiring plan for the second half']],
  ]));
  assert.deepEqual(dropped.mapping, ['one', 'two']);
  assert.deepEqual(dropped.fidelity.missingStrings, ['Quarterly results']);
  const missing = dropped.findings.find((f) => f.code === 'fidelity.text.missing')!;
  assert.equal(missing.artboardId, 'two');
  assert.equal(missing.message, '“Quarterly results” from slide 2 is not in the result.');
  assertValid(dropped);

  const kept = checkFidelity(inv, result([
    ['one', ['Quarterly results', 'Revenue grew in every region']],
    ['two', ['Quarterly results', 'Hiring plan for the second half']],
  ]));
  assert.deepEqual(kept.findings, []);
});

test('a string carried on another artboard than its slide is moved, an info naming both artboards', () => {
  const inv = inventory([
    slide(1, ['Quarterly results', 'Revenue grew in every region']),
    slide(2, ['Hiring plan for the second half', 'Open roles by team']),
  ]);
  const r = checkFidelity(inv, result([
    ['one', ['Quarterly results', 'Revenue grew in every region', 'Open roles by team']],
    ['two', ['Hiring plan for the second half']],
  ]));
  assert.deepEqual(r.fidelity.missingStrings, []);
  const moved = r.findings.filter((f) => f.code === 'fidelity.text.moved');
  assert.equal(moved.length, 1);
  assert.equal(moved[0]!.severity, 'info');
  assert.equal(moved[0]!.artboardId, 'one');
  assert.deepEqual(moved[0]!.evidence, { slide: 2, source: 'Open roles by team', artboard: 'one', expectedArtboard: 'two' });
  assert.equal(moved[0]!.message, '“Open roles by team” from slide 2 is on artboard “one”, not on artboard “two” with the rest of slide 2.');
  assertValid(r);
});

test('“&” for “and” and -ise for -ize are edits listed for review, not missing strings', () => {
  const inv = inventory([slide(1, ['Centralized storage & backups', 'Timing & budget', 'We analyse the organisation'])]);
  const r = checkFidelity(inv, result([['s14', ['Centralised storage and backups', 'Timing and budget', 'We analyze the organization']]]));
  assert.deepEqual(r.fidelity.missingStrings, []);
  assert.deepEqual(r.fidelity.editedStrings, [
    { source: 'Centralized storage & backups', result: 'Centralised storage and backups' },
    { source: 'Timing & budget', result: 'Timing and budget' },
    { source: 'We analyse the organisation', result: 'We analyze the organization' },
  ]);
  assert.ok(r.findings.every((f) => f.code === 'fidelity.text.edited' && f.severity === 'info'));
});

test('declared deliberate edits are excepted: kept as info with the reason, listed, never passed', () => {
  const inv = inventory([slide(1, ['Quarterly results', 'Revenue grew in every region', 'Legacy footnote text', 'Our former tagline'])]);
  const boxes = result([['one', ['Quarterly update', 'Revenue grew in every single region', 'New product name']]]);
  const plain = checkFidelity(inv, boxes);
  assert.deepEqual(plain.fidelity.missingStrings, ['Quarterly results', 'Legacy footnote text', 'Our former tagline']);
  assert.equal(plain.fidelity.excepted, undefined, 'no edits given, no excepted list');

  const { edits, problems } = parseFidelityEdits({
    edits: [
      { source: 'Legacy footnote text', reason: 'Dropped: the footnote is out of date.' },
      { source: 'Quarterly results', result: 'Quarterly update', reason: 'House style for titles' },
      { source: 'Our former tagline', result: 'Not in the document', reason: 'Renamed' },
      { source: 'Revenue grew in every region', reason: 'Copy edit' },
      { source: 'A string the deck never had', reason: 'Stale' },
    ],
  });
  assert.deepEqual(problems, []);
  const r = checkFidelity(inv, boxes, { edits });
  // A declared replacement that is not in the document does not except the loss.
  assert.deepEqual(r.fidelity.missingStrings, ['Our former tagline']);
  assert.deepEqual(r.fidelity.excepted, [
    { slide: 1, source: 'Quarterly results', reason: 'House style for titles' },
    { slide: 1, source: 'Revenue grew in every region', result: 'Revenue grew in every single region', reason: 'Copy edit' },
    { slide: 1, source: 'Legacy footnote text', reason: 'Dropped: the footnote is out of date.' },
  ]);
  const footnote = r.findings.find((f) => f.evidence?.source === 'Legacy footnote text')!;
  assert.equal(footnote.code, 'fidelity.text.missing', 'the code stays: the string is still not there');
  assert.equal(footnote.severity, 'info');
  assert.equal(footnote.needs, undefined);
  assert.equal(footnote.evidence?.excepted, true);
  assert.equal(footnote.evidence?.reason, 'Dropped: the footnote is out of date.');
  assert.equal(footnote.message, '“Legacy footnote text” from slide 1 is not in the result. Recorded as a deliberate edit: Dropped: the footnote is out of date.');
  const stillMissing = r.findings.find((f) => f.evidence?.source === 'Our former tagline')!;
  assert.equal(stillMissing.severity, 'warn');
  const unused = r.findings.filter((f) => f.code === 'fidelity.edit.unmatched');
  assert.deepEqual(unused.map((f) => [f.severity, f.evidence?.source]), [['info', 'Our former tagline'], ['info', 'A string the deck never had']]);
  assertValid(r);
});

test('a speaker note changed on purpose is excepted by a declared edit of the whole note or of every paragraph it lost', () => {
  const noted = (n: number, paragraphs: string[][]): Slide => ({ ...slide(n, [`Slide ${n} heading`]), notes: { text: paragraphs.map((p) => p.join('\n')).join('\n'), paragraphs: paragraphs.map((lines) => ({ lines })) } });
  const inv = inventory([
    noted(1, [['OPENING', 'Greet the crews on the quay.'], ['Keep it under a minute.']]),
    noted(2, [['Walk through the tide table.'], ['Pause for questions from the harbour crews before the break.']]),
  ]);
  const boxes = result([['one', ['Slide 1 heading']], ['two', ['Slide 2 heading']]]).map((row) =>
    row.id === 'one' ? { ...row, notes: 'Shortened on purpose.' } : row.id === 'two' ? { ...row, notes: 'Walk through the tide table.' } : row);
  const bare = checkFidelity(inv, boxes);
  assert.deepEqual(bare.fidelity.notes, { carried: 0, missing: 2 });

  // The whole first note, with its replacement; the one paragraph the second note lost.
  const { edits } = parseFidelityEdits([
    { source: 'OPENING\nGreet the crews on the quay.\nKeep it under a minute.', result: 'Shortened on purpose.', reason: 'The client asked for shorter cover notes.' },
    { source: 'Pause for questions from the harbour crews before the break.', reason: 'No questions in this slot.' },
  ]);
  const r = checkFidelity(inv, boxes, { edits });
  assert.deepEqual(r.fidelity.notes, { carried: 0, missing: 0 });
  assert.deepEqual(r.fidelity.excepted, [
    { slide: 1, source: 'OPENING Greet the crews on the quay. Keep it under a minute.', result: 'Shortened on purpose.', reason: 'The client asked for shorter cover notes.' },
    { slide: 2, source: 'Pause for questions from the harbour crews before the break.', reason: 'No questions in this slot.' },
  ]);
  const notes = r.findings.filter((f) => f.code === 'fidelity.notes.missing');
  assert.deepEqual(notes.map((f) => [f.severity, f.evidence?.excepted, f.needs]), [['info', true, undefined], ['info', true, undefined]], 'the findings stay, excepted');
  assert.match(notes[0]!.message, /Recorded as a deliberate edit: The client asked for shorter cover notes\.$/);
  assert.equal(r.findings.filter((f) => f.code === 'fidelity.edit.unmatched').length, 0);
  assertValid(r);

  // Paragraph edits that leave a lost paragraph undeclared, or a replacement that is not there, cover nothing.
  const partial = checkFidelity(inv, boxes, { edits: parseFidelityEdits([
    { source: 'OPENING Greet the crews on the quay.', reason: 'Cut.' },
    { source: 'Pause for questions from the harbour crews before the break.', result: 'Questions at the end.', reason: 'Moved.' },
  ]).edits });
  assert.equal(partial.fidelity.notes.missing, 2);
  assert.deepEqual(partial.fidelity.excepted, []);
  assert.deepEqual(partial.findings.filter((f) => f.code === 'fidelity.notes.missing').map((f) => f.severity), ['warn', 'warn']);

  // Every lost paragraph of the first note declared on its own covers it too.
  const each = checkFidelity(inv, boxes, { edits: parseFidelityEdits([
    { source: 'OPENING Greet the crews on the quay.', reason: 'Cut.' },
    { source: 'Keep it under a minute.', reason: 'Cut.' },
  ]).edits });
  assert.equal(each.fidelity.notes.missing, 1, 'slide 2 lost a paragraph nobody declared');
  assert.deepEqual(each.fidelity.excepted?.map((e) => [e.slide, e.source]), [[1, 'OPENING Greet the crews on the quay.'], [1, 'Keep it under a minute.']]);
});

test('an edits list with a problem is refused whole, each problem listed', () => {
  assert.deepEqual(parseFidelityEdits('nope').edits, []);
  assert.equal(parseFidelityEdits('nope').problems.length, 1);
  const { problems } = parseFidelityEdits([
    { source: 'A', reason: 'ok' },
    { source: '', reason: 'empty source' },
    { source: 'B' },
    { source: 'C', reason: 'x', result: 3 },
    { source: 'D', reason: 'x', extra: true },
    'text',
  ]);
  assert.equal(problems.length, 5, problems.join(' | '));
  assert.ok(problems.some((p) => p.startsWith('Edit 2 needs "source"')));
  assert.ok(problems.some((p) => p.startsWith('Edit 3 needs "reason"')));
  assert.ok(problems.some((p) => p.includes('Edit 6 is not an object')));
});

test('fidelity stays fast on a large deck and says when it stopped short', () => {
  // About 200 KB of text: every source string is missing, so every one is searched for.
  const n = 2000;
  const lines = (tag: string, base: number) =>
    Array.from({ length: n / 20 }, (_, i) => `${tag} alpha${base + i} bravo${(base + i) * 7} charlie${(base + i) * 13} delta echo`);
  const slides = Array.from({ length: 20 }, (_, s) => slide(s + 1, lines('source', s * 1000)));
  const boards = Array.from({ length: 20 }, (_, b) => [`b${b}`, lines('result', b * 1000 + 500)] as [string, string[]]);
  const started = performance.now();
  const r = checkFidelity(inventory(slides), result(boards));
  const took = performance.now() - started;
  assert.equal(r.fidelity.missingStrings.length, n);
  assert.equal(r.complete, true);
  assert.ok(took < 3000, `took ${Math.round(took)} ms`);

  // One artboard, every line sharing words with every source string: still bounded.
  const one = checkFidelity(inventory([slide(1, lines('source', 0).concat(lines('source', 5000)))]), result([['only', lines('result', 9000).concat(lines('result', 9500))]]));
  assert.equal(one.complete, true);

  const many = Array.from({ length: FIDELITY_MAX_SOURCE_STRINGS + 5 }, (_, i) => `line number ${i} of a very long deck`);
  const capped = checkFidelity(inventory([slide(1, many)]), result([['only', ['nothing alike']]]));
  assert.equal(capped.complete, false);
  const partial = capped.findings.find((f) => f.code === 'fidelity.coverage.partial')!;
  assert.equal(partial.severity, 'warn');
  assert.equal(partial.needs, 'unknown');
  assert.equal(capped.fidelity.missingStrings.length, FIDELITY_MAX_SOURCE_STRINGS);
  assertValid(capped);
});

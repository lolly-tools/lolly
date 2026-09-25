// SPDX-License-Identifier: MPL-2.0
/**
 * Outlined labels as live text (plan 275 section 9.3), `engine/src/vector-text.ts`.
 *
 * The drawings here are built the way a chart tool that outlines its text writes
 * one: every label is one filled path of glyph outlines standing on a baseline, in
 * an axis group or loose beside the bars, with category names on the bars as
 * `data-recolor` and a source line in `<desc>`. Each glyph is a box with a counter,
 * so it has the two outlines a real "0" has. The recogniser is a stub: the pure
 * checks take readings as data, and the reading pass takes a reader that answers
 * from a queue, so the cases say what the pass does with a reading, not how well a
 * model reads.
 *
 * Run with: node --test "tests/vector-text.test.ts"
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import type { VectorItemsV1, VectorTextItemV1 } from '@lolly-tools/core';

import { glyphRunsOf, svgItemsOf, svgLabelHintsOf } from '../engine/src/svg-items.ts';
import {
  glyphRunChunks,
  glyphRunFrame,
  glyphRunKey,
  readVectorLabels,
  vectorTextOf,
  type VectorLabelReaderV1,
  type VectorLabelReadingV1,
} from '../engine/src/vector-text.ts';

const parser = new (new JSDOM('').window.DOMParser)();
const parse = (source: string) => parser.parseFromString(source, 'image/svg+xml');

/** Cap height of every glyph: a 20 px face at a 0.72 cap height. */
const CAP = 14.4;

/**
 * Outline path data for a word of `n` glyphs from the origin, standing on y = 0:
 * each glyph a box `0.6 * CAP` wide with a counter, glyphs `0.1 * CAP` apart, and
 * a word space of `0.4 * CAP` wherever `spaces` names a glyph index.
 */
function word(n: number, spaces: number[] = [], height = CAP, dy = 0): { d: string; width: number } {
  let d = '';
  let x = 0;
  const w = 0.6 * height;
  for (let i = 0; i < n; i++) {
    if (spaces.includes(i)) x += 0.4 * height;
    d += `M${x} ${dy}H${x + w}V${dy - height}H${x}Z`;
    d += `M${x + 0.2 * w} ${dy - 0.2 * height}V${dy - 0.8 * height}H${x + 0.8 * w}V${dy - 0.2 * height}Z`;
    x += w + 0.1 * height;
  }
  return { d, width: x - 0.1 * height };
}

/** One outlined label placed with its left edge at `x`, or its right edge when `end` is set. */
function label(n: number, x: number, y: number, opts: { end?: boolean; middle?: boolean; opacity?: number; spaces?: number[] } = {}): string {
  const { d, width } = word(n, opts.spaces);
  const left = opts.end ? x - width : opts.middle ? x - width / 2 : x;
  return `<path d="${d}" transform="translate(${left},${y})" fill="rgb(20, 20, 20)" opacity="${opts.opacity ?? 0.6}" stroke="none"/>`;
}

const TICKS = [100, 220, 340, 460, 580, 700];
const TICK_GLYPHS = [2, 3, 3, 3, 3, 4];
/** The category of the second bar, longer than the 64 characters an item's series keeps. */
const LONG = 'Our primary revenue stream comes from providing IT (Information Technology) products or services';

/**
 * A bar chart with outlined labels: a source line, six axis ticks under gridlines, a
 * right-aligned category axis whose second label wraps over two lines, and a data
 * label at the end of each bar.
 */
const CHART = '<svg xmlns="http://www.w3.org/2000/svg" id="d3-svg" viewBox="0 0 1280 560" width="1280" height="560">'
  + '<title>bar horizontal chart</title>'
  + '<desc>q0008 \u00b7 Select one \u00b7 216 respondents \u00b7 Source: fixture survey (CC0-1.0). bar horizontal chart uses 2 data rows.</desc>'
  + '<rect id="d3-bg" width="1280" height="560" fill="none"/>'
  + '<g id="d3-plot">'
  + label(38, 40, 70, { opacity: 0.62, spaces: [5, 6, 12, 16, 28, 34] })
  + '<g class="value-axis">'
  + TICKS.map((x, i) => `<line x1="${x}" y1="95" x2="${x}" y2="466" stroke="#141414" stroke-width="1" opacity="0.1"/>${label(TICK_GLYPHS[i]!, x, 494, { middle: true })}`).join('')
  + '</g><g class="cat-axis">'
  + label(3, 90, 180, { end: true, opacity: 0.8 })
  + label(20, 90, 280, { end: true, opacity: 0.8, spaces: [3, 11, 17] })
  + label(10, 90, 305, { end: true, opacity: 0.8, spaces: [5] })
  + '</g><g>'
  + '<rect x="100" y="150" width="500" height="60" fill="#30ba78" data-recolor="Yes"/>'
  + `<rect x="100" y="250" width="200" height="60" fill="#30ba78" data-recolor="${LONG}"/>`
  + '</g>'
  + label(3, 610, 185, { opacity: 0.75 })
  + label(3, 310, 285, { opacity: 0.75 })
  + '</g></svg>';

/** The runs of `CHART` in paint order: the source line, six ticks, three category lines, two data labels. */
const chart = (): VectorItemsV1 => svgItemsOf(CHART, parse);

/** Readings a good recogniser would give, in run order, with the slips the checks put right. */
const READINGS: Array<VectorLabelReadingV1 | null> = [
  { text: 'q0008 \u00b7 Select one \u00b7 216 respondents \u00b7 Source: fixture survey (CCO-1.0)', confidence: 0.97 },
  { text: '0%', confidence: 0.99 },
  { text: '2O%', confidence: 0.9 },
  null,
  { text: '60%', confidence: 0.98 },
  { text: '80%', confidence: 0.97 },
  { text: '100%', confidence: 0.99 },
  { text: 'Yas', confidence: 0.83 },
  { text: 'Our primary revenue strearn comes from providing IT', confidence: 0.9 },
  { text: '(lnformation Technology) products or services', confidence: 0.88 },
  { text: '71%', confidence: 0.99 },
  { text: '28%', confidence: 0.99 },
];

function texts(items: VectorItemsV1): VectorTextItemV1[] {
  return items.items.filter((i): i is VectorTextItemV1 => i.kind === 'text');
}

test('every outlined label of the chart is one run, in paint order, with its box, baseline and ink', () => {
  const items = chart();
  const runs = glyphRunsOf(items);
  assert.equal(runs.length, 12);
  assert.deepEqual(runs.map((r) => r.glyphs), [38, ...TICK_GLYPHS, 3, 20, 10, 3, 3]);
  assert.deepEqual(runs.slice(1, 7).map((r) => r.groups), Array(6).fill(['d3-plot', 'value-axis']));
  assert.equal(runs[1]!.labelGroup, true);
  assert.equal(runs[0]!.labelGroup, false, 'the source line stands loose in the plot');
  assert.equal(runs[1]!.baseline, 494);
  assert.equal(runs[1]!.ascent, CAP);
  assert.equal(runs[1]!.fill, '#141414');
  assert.equal(runs[1]!.opacity, 0.6);
  assert.equal(runs[8]!.spaces, 3);
  assert.equal(runs[8]!.words.length, 4);
  // The bars and the gridlines are not runs.
  const covered = new Set(runs.flatMap((r) => r.items));
  for (const [i, item] of items.items.entries()) {
    if (item.kind === 'path' && (item.shape === 'rect' || item.shape === 'line')) assert.equal(covered.has(i), false);
  }
});

test('a run is drawn black on white at a height a line recogniser reads, the same bytes every time', () => {
  const items = chart();
  const run = glyphRunsOf(items)[1]!;
  const frame = glyphRunFrame(items, run);
  assert.equal(frame.height, 32 + 24);
  assert.equal(frame.data.length, frame.width * frame.height * 4);
  const at = (x: number, y: number): number => frame.data[(y * frame.width + x) * 4]!;
  assert.equal(at(2, 2), 255, 'the margin is white');
  // The left edge of the first glyph is ink; its counter is paper.
  assert.equal(at(13, 30), 0);
  assert.equal(at(18, 28), 255);
  for (let i = 3; i < frame.data.length; i += 4) assert.equal(frame.data[i], 255, 'opaque');
  assert.deepEqual(glyphRunFrame(items, run).data, frame.data);
});

test('the same glyphs key alike wherever they stand, and other glyphs key apart', () => {
  const items = chart();
  const runs = glyphRunsOf(items);
  // Ticks 2 to 5 are three glyphs each, drawn alike at different places.
  assert.equal(glyphRunKey(items, runs[2]!), glyphRunKey(items, runs[3]!));
  assert.notEqual(glyphRunKey(items, runs[1]!), glyphRunKey(items, runs[2]!));
  assert.notEqual(glyphRunKey(items, runs[6]!), glyphRunKey(items, runs[2]!));
});

test('readings become text in place of the paths, checked against the names, the source line and the axis', () => {
  const items = chart();
  const runs = glyphRunsOf(items);
  const result = vectorTextOf(items, runs, READINGS, { hints: svgLabelHintsOf(CHART, parse) });
  assert.equal(result.runs, 12);
  assert.equal(result.text, 12);
  assert.equal(result.drawn, 0);
  const t = texts(result.items);
  assert.deepEqual(t.map((x) => x.text), [
    'q0008 \u00b7 Select one \u00b7 216 respondents \u00b7 Source: fixture survey (CC0-1.0)',
    '0%', '20%', '40%', '60%', '80%', '100%',
    'Yes',
    'Our primary revenue stream comes from providing IT',
    '(Information Technology) products or services',
    '71%', '28%',
  ]);
  // The wrapped category, its lines joined, is the name the bar states in full.
  assert.equal(`${t[8]!.text} ${t[9]!.text}`, LONG);
  // No path of a label is left; the bars, gridlines and paint order are kept.
  assert.equal(glyphRunsOf(result.items).length, 0);
  assert.equal(result.items.items.filter((i) => i.kind === 'path' && i.shape === 'rect').length, 2);
  assert.equal(result.items.items[0]!.kind, 'text', 'the source line paints first, as its paths did');
});

test('a text item takes its size from its glyphs, its anchor from its neighbours and its ink from its paths', () => {
  const items = chart();
  const result = vectorTextOf(items, glyphRunsOf(items), READINGS, { hints: svgLabelHintsOf(CHART, parse) });
  const t = texts(result.items);
  const tick = t[1]!;
  assert.equal(tick.anchor, 'middle', 'a tick stands centred under its gridline');
  assert.equal(tick.x, 100);
  assert.equal(tick.y, 494);
  assert.equal(tick.size, 20, 'cap height 14.4 over a 0.72 cap share');
  assert.deepEqual(tick.fill, { hex: '#141414' });
  assert.equal(tick.opacity, 0.6);
  assert.deepEqual(tick.groups, ['d3-plot', 'value-axis']);
  assert.equal(tick.font, undefined, 'no face: the compile sets the design system face');
  for (const cat of t.slice(7, 10)) {
    assert.equal(cat.anchor, 'end', 'category labels share their right edge');
    assert.equal(cat.x, 90);
  }
  assert.equal(t[0]!.anchor, undefined, 'the source line starts at its left edge');
  assert.equal(t[10]!.anchor, undefined);
  assert.equal(t[10]!.x, 610);
});

test('a reading nothing confirms needs the confidence floor and about one character per glyph', () => {
  const items = chart();
  const runs = glyphRunsOf(items);
  const low = [...READINGS];
  low[10] = { text: '71%', confidence: 0.5 };
  low[11] = { text: '2', confidence: 0.99 };
  const result = vectorTextOf(items, runs, low, { hints: svgLabelHintsOf(CHART, parse) });
  assert.equal(result.text, 10);
  assert.equal(result.drawn, 2);
  const left = glyphRunsOf(result.items);
  assert.equal(left.length, 2, 'the two data labels keep their paths');
  assert.deepEqual(left.map((r) => r.glyphs), [3, 3]);
  // A lower floor takes the first but not the one-character reading of three glyphs.
  assert.equal(vectorTextOf(items, runs, low, { hints: svgLabelHintsOf(CHART, parse), minConfidence: 0.4 }).text, 11);
});

test('an axis needs three agreeing ticks, and a category guess is not dressed as the name', () => {
  const items = chart();
  const runs = glyphRunsOf(items);
  const guess = [...READINGS];
  // Two ticks read, four not: the fit has nothing to agree with, and the unread ticks stay drawn.
  for (const i of [2, 3, 4, 5]) guess[i] = null;
  // A category read with too little confidence stays drawn even though a name is close.
  guess[7] = { text: 'Yas', confidence: 0.3 };
  const result = vectorTextOf(items, runs, guess, { hints: svgLabelHintsOf(CHART, parse) });
  const drawn = glyphRunsOf(result.items);
  assert.equal(drawn.length, 5);
  assert.deepEqual(texts(result.items).filter((x) => x.groups?.includes('value-axis')).map((x) => x.text), ['0%', '100%']);
  assert.equal(texts(result.items).some((x) => x.text === 'Yes' || x.text === 'Yas'), false);
});

test('the reading pass reads each distinct run once, a long run a piece at a time, and stops on abort', async () => {
  const items = chart();
  const runs = glyphRunsOf(items);
  // The source line is 38 glyphs across one height: too wide to read whole.
  assert.ok(glyphRunChunks(runs[0]!).length >= 2);
  assert.equal(glyphRunChunks(runs[1]!).length, 1);
  // Every glyph here is the same box, so runs of one length share their outlines: the
  // three-glyph ticks, "Yes" and both data labels are read once between them.
  const firstOfKey = new Map<string, number>();
  for (const [i, run] of runs.entries()) if (!firstOfKey.has(glyphRunKey(items, run))) firstOfKey.set(glyphRunKey(items, run), i);
  const expected = [...firstOfKey.values()].reduce((n, i) => n + glyphRunChunks(runs[i]!).length, 0);
  let calls = 0;
  let widest = 0;
  const reader: VectorLabelReaderV1 = async (frame) => {
    calls += 1;
    widest = Math.max(widest, frame.width);
    return { text: 'x', confidence: 0.1 };
  };
  const cache = new Map<string, VectorLabelReadingV1 | null>();
  const result = await readVectorLabels(items, reader, { hints: svgLabelHintsOf(CHART, parse), cache });
  assert.equal(calls, expected);
  assert.equal(cache.size, firstOfKey.size);
  assert.ok(widest <= 2400);
  assert.equal(result.runs, 12);
  assert.equal(result.text, 0, 'nothing read with confidence, nothing confirmed');
  const again = await readVectorLabels(items, async () => {
    throw new Error('a cached run is not read again');
  }, { cache });
  assert.equal(again.drawn, 12);

  const controller = new AbortController();
  controller.abort(new Error('stop'));
  await assert.rejects(readVectorLabels(items, reader, { signal: controller.signal }), /stop/);
  // A reader that fails reads nothing, and every run stays drawn.
  const failed = await readVectorLabels(items, async () => {
    throw new Error('the model fell over');
  });
  assert.equal(failed.text, 0);
  assert.equal(failed.drawn, 12);
  assert.equal(failed.items, items, 'nothing read, the same drawing');
});

test('a logo wordmark, a bar, a line of dots and a two-line path are not runs', () => {
  const logo = svgItemsOf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 20"><path d="${word(5, [], 16).d}" transform="translate(4,18)" fill="#30ba78"/></svg>`, parse);
  assert.equal(glyphRunsOf(logo).length, 0, 'lettering that fills the drawing is artwork');
  const marks = svgItemsOf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><g class="bars">${[0, 1, 2].map((i) => `<path d="M${10 + i * 20} 300H${25 + i * 20}V${200 - i * 60}H${10 + i * 20}Z" fill="#000" data-recolor="S${i}"/>`).join('')}</g></svg>`, parse);
  assert.equal(glyphRunsOf(marks).length, 0, 'a mark that names a series is data, not a letter');
  const dots = svgItemsOf('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="M10 10h4v4h-4zM30 80h4v4h-4zM50 150h4v4h-4zM70 20h4v4h-4z" fill="#000"/></svg>', parse);
  assert.equal(glyphRunsOf(dots).length, 0, 'marks on no one line are not a run');
  const lines = svgItemsOf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="${word(3).d}${word(3, [], CAP, 40).d}" transform="translate(20,100)" fill="#000"/></svg>`, parse);
  assert.equal(glyphRunsOf(lines).length, 0, 'two lines in one path are left as drawn');
});

test('letters drawn one path each join into one run', () => {
  const glyph = word(1).d;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><g class="legend">'
    + [0, 1, 2, 3].map((i) => `<path d="${glyph}" transform="translate(${20 + i * 0.7 * CAP},100)" fill="#222222"/>`).join('')
    + '</g></svg>';
  const items = svgItemsOf(svg, parse);
  const runs = glyphRunsOf(items);
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0]!.items, [0, 1, 2, 3]);
  assert.equal(runs[0]!.glyphs, 4);
  const result = vectorTextOf(items, runs, [{ text: 'Rise', confidence: 0.95 }]);
  assert.equal(result.items.items.length, 1);
  assert.equal(result.items.items[0]!.kind === 'text' && result.items.items[0]!.text, 'Rise');
});

test('a label group names its hints in full, past the 64 characters a series keeps', () => {
  const hints = svgLabelHintsOf(CHART, parse);
  assert.deepEqual(hints.names, ['Yes', LONG]);
  assert.equal(hints.title, 'bar horizontal chart');
  assert.match(hints.desc ?? '', /^q0008/);
  const items = chart();
  const long = items.items.find((i) => i.series?.startsWith('Our primary'));
  assert.equal(long?.series?.length, 64, 'the item keeps only the first 64 characters');
  assert.deepEqual(svgLabelHintsOf('not svg', parse), { names: [] });
});

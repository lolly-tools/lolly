// SPDX-License-Identifier: MPL-2.0
// The pure half of the generated text thumbnails: size buckets, the focused
// excerpt, and the model built from a real analysis. The mount (fetch, observer,
// palette) is DOM/network and belongs to a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  textThumbSize, textThumbExcerpt, textThumbModel, textThumbWashBg, textThumbFg,
  type ThumbMark,
} from './text-thumbs.ts';

test('textThumbSize: document length picks the type scale, quote to wall', () => {
  assert.equal(textThumbSize(40), 'xl');
  assert.equal(textThumbSize(200), 'lg');
  assert.equal(textThumbSize(600), 'md');
  assert.equal(textThumbSize(5000), 'sm');
});

test('excerpt with no marks: the head of the text, ellipsis only at the cut end', () => {
  const text = `${'word '.repeat(200)}end`;
  const runs = textThumbExcerpt(text, []);
  assert.notEqual(runs[0]?.text, '… ', 'no leading ellipsis at the start of a document');
  assert.equal(runs[runs.length - 1]?.text, ' …', 'a cut tail is marked');
  assert.ok(runs.every((r) => r.bucket == null));
});

test('excerpt focuses the hottest mark with context before and after', () => {
  const before = 'plain human words '.repeat(40);   // ~720 chars of preamble
  const flagged = 'FLAGGEDSPAN';
  const after = ' more ordinary words follow here '.repeat(10);
  const text = before + flagged + after;
  const marks: ThumbMark[] = [
    { index: 4, length: 5, heat: 0.3 },                       // a cool early mark
    { index: before.length, length: flagged.length, heat: 0.9 }, // the hot focus
  ];
  const runs = textThumbExcerpt(text, marks);
  assert.equal(runs[0]?.text, '… ', 'a mid-document focus opens with an ellipsis');
  const hot = runs.find((r) => r.bucket === 5);
  assert.ok(hot, 'the hot span is present and bucketed t5');
  assert.equal(hot?.text, flagged);
  const joined = runs.map((r) => r.text).join('');
  assert.ok(joined.includes('words ' + flagged), 'context before the span survives');
  assert.ok(joined.includes(flagged + ' more'), 'context after the span survives');
});

test('excerpt runs reassemble to a contiguous slice of the source', () => {
  const text = `${'alpha beta gamma '.repeat(30)}delta`;
  const marks: ThumbMark[] = [{ index: 200, length: 10, heat: 0.6 }];
  const runs = textThumbExcerpt(text, marks).filter((r) => r.text !== '… ' && r.text !== ' …');
  const joined = runs.map((r) => r.text).join('');
  assert.ok(text.includes(joined), 'no dropped or duplicated characters inside the window');
});

// A stand-in APCA: signed lightness difference scaled to Lc-ish magnitudes. The
// real polarity/curve maths lives in the host; the picker only reads |value|.
const lum = (hex: string): number => {
  const c = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16);
  return (0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5)) / 255;
};
const fakeHost = { color: { apca: (text: string, bg: string) => (lum(bg) - lum(text)) * 110 } };

test('textThumbWashBg: no ink is the bare surface; an ink tints it faintly', () => {
  assert.equal(textThumbWashBg(null, 'dark'), '#12141a');
  const washed = textThumbWashBg('#efeae2', 'dark');
  assert.notEqual(washed, '#12141a');
  assert.ok(lum(washed) < 0.3, 'a 13% tint stays near the dark surface');
});

test('textThumbFg: picks a palette colour that reads on the wash, refusing melters', () => {
  const darkGreen = '#0c322c';
  const offWhite = '#efeae2';
  const fg = textThumbFg('asset/a', [darkGreen, offWhite], null, fakeHost, 'dark');
  assert.equal(fg, offWhite, 'the near-surface dark green is refused on a dark tile');
});

test('textThumbFg: prefers a swatch other than the wash ink when one qualifies', () => {
  const pool = ['#efeae2', '#cfe8d8'];
  const fg = textThumbFg('asset/b', pool, '#efeae2', fakeHost, 'dark');
  assert.equal(fg, '#cfe8d8');
});

test('textThumbFg: a one-colour brand may reuse the wash ink; no host means no pick', () => {
  const only = '#efeae2';
  assert.equal(textThumbFg('asset/c', [only], only, fakeHost, 'dark'), only);
  assert.equal(textThumbFg('asset/c', [only], only, undefined, 'dark'), null);
  assert.equal(textThumbFg('asset/c', [], null, fakeHost, 'dark'), null);
});

test('textThumbModel: AI-flavoured text yields bucketed runs and a score; plain text stays calm', () => {
  const ai = "In today's ever-evolving landscape it's important to note that we must delve into the "
    + 'rich tapestry of modern tools. A robust and seamless approach will foster a holistic '
    + 'workflow that showcases how teams leverage comprehensive systems to garner results.';
  const m = textThumbModel(ai, ai.length);
  assert.ok(m.score >= 45, `expected notable+, got ${m.score}`);
  assert.ok(m.runs.some((r) => r.bucket != null), 'flagged spans reach the excerpt');
  const human = 'The cat sat on the mat and watched the rain.';
  const h = textThumbModel(human, human.length);
  assert.equal(h.band, 'none');
  assert.ok(h.runs.every((r) => r.bucket == null));
  assert.equal(h.size, 'xl');
});

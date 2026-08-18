// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTextSignals } from '../engine/src/text-signals.ts';

// A long, English, lexicon-heavy paragraph (>= 40 words) - the "reads as AI" case.
const LLM_PARAGRAPH =
  "In today's ever-evolving landscape it's important to note that we must delve into the " +
  'rich tapestry of modern tools. A robust and seamless approach will foster a holistic ' +
  'workflow. This underscores a pivotal shift, and it showcases how teams can leverage ' +
  'comprehensive systems to garner real results across the board every single day.';

// A long, English, plain-human paragraph with varied sentence lengths and no tells.
const HUMAN_PARAGRAPH =
  'The cat sat. Yesterday I walked to the market and bought some very ripe tomatoes for ' +
  'dinner. It rained. My neighbour waved at me from across the street while carrying a ' +
  'heavy bag of groceries up the stairs. We talked for a while about nothing much at all, ' +
  'then I went home and made soup.';

test('digital text with a zero-width character flags an invisible-char artifact', () => {
  const r = analyzeTextSignals('hello​world this is a normal looking sentence', { source: 'digital' });
  const f = r.findings.find((x) => x.kind === 'invisible-char');
  assert.ok(f, 'expected an invisible-char finding');
  assert.equal(f?.tier, 'artifact');
  assert.ok(r.band !== 'none');
});

test('Unicode tag characters read as a strong signal', () => {
  const r = analyzeTextSignals('a normal sentence with \u{E0041}\u{E0042} hidden tags', { source: 'digital' });
  assert.ok(r.findings.some((x) => x.kind === 'tag-chars'));
  assert.equal(r.band, 'strong');
});

test('a Latin/Cyrillic mixed-script word is a homoglyph tell', () => {
  // "paypal" with a Cyrillic 'а' (U+0430) in place of the Latin 'a'.
  const r = analyzeTextSignals('please sign in at pаypal to continue', { source: 'digital' });
  assert.ok(r.findings.some((x) => x.kind === 'mixed-script'));
});

test('OCR-sourced text NEVER returns an artifact finding and sets pixelSourced', () => {
  // Same zero-width character, but read from an image: the byte-level layer is gone.
  const r = analyzeTextSignals('hello​world with an invisible char', { source: 'ocr' });
  assert.equal(r.pixelSourced, true);
  assert.ok(r.findings.every((x) => x.tier !== 'artifact'), 'OCR must not surface artifact tells');
});

test('an English LLM-lexicon paragraph reaches at least notable, with a low-confidence guess', () => {
  const r = analyzeTextSignals(LLM_PARAGRAPH, { source: 'digital' });
  assert.ok(r.findings.some((x) => x.kind === 'llm-lexicon'));
  assert.ok(r.band === 'notable' || r.band === 'strong');
  assert.ok(r.styleGuess, 'expected a style guess at notable+');
  assert.equal(r.styleGuess?.confidence, 'low');
});

test('a plain human paragraph does not read as AI', () => {
  const r = analyzeTextSignals(HUMAN_PARAGRAPH, { source: 'digital' });
  assert.ok(['none', 'weak'].includes(r.band), `expected none/weak, got ${r.band}`);
  assert.equal(r.styleGuess, undefined);
});

test('BIAS GUARD: short text is never judged, even with lexicon words', () => {
  const r = analyzeTextSignals("Delve into the rich tapestry, it's important to note.", { source: 'digital' });
  assert.equal(r.band, 'none');
  assert.ok(!r.findings.some((x) => x.tier === 'heuristic'));
});

test('BIAS GUARD: long non-English text is never judged by heuristics', () => {
  const cyrillic = 'привет мир как у тебя дела сегодня всё хорошо спасибо большое за помощь и внимание '.repeat(3);
  const r = analyzeTextSignals(cyrillic, { source: 'digital' });
  assert.equal(r.band, 'none');
  assert.ok(!r.findings.some((x) => x.tier === 'heuristic'));
});

test('empty text is none with no findings', () => {
  const r = analyzeTextSignals('', { source: 'digital' });
  assert.equal(r.band, 'none');
  assert.equal(r.findings.length, 0);
  assert.equal(r.styleGuess, undefined);
});

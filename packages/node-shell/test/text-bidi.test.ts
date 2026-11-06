// SPDX-License-Identifier: MPL-2.0
/**
 * The order host.text.toPath shapes a run in (text-bidi.ts), and what comes out of real
 * HarfBuzz on both shells' text APIs. The faces are the text composition fixtures, so
 * this runs on every clone with no browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { firstStrongDirection, hasRtlText, orderedRuns, shapingSegments } from '../src/text-bidi.ts';
import { createNodeTextAPI } from '../src/text.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const ARABIC = 'tests/fixtures/text-composition/fonts/notosansarabic/NotoSansArabic[wdth,wght].ttf';
const HEBREW = 'tests/fixtures/text-composition/fonts/notosanshebrew/NotoSansHebrew[wdth,wght].ttf';
const DEVANAGARI = 'tests/fixtures/text-composition/fonts/notosansdevanagari/NotoSansDevanagari[wdth,wght].ttf';
const OUTFIT = 'shells/web/public/fonts/Outfit[wght].ttf';

test('plain left-to-right text takes the old path, untouched', () => {
  for (const text of ['Plain Latin.', 'Café déjà vu “quotes” € ©', 'Łódź Ñandú', 'Привет Ωμέγα Hello', '漢字 and かな', 'नमस्ते दुनिया।', 'สวัสดี', 'Հայաստան and Latin', 'საქართველო and Latin']) {
    assert.equal(orderedRuns(text), null, text);
    assert.equal(orderedRuns(text, 'ltr'), null, text);
    assert.equal(hasRtlText(text), false, text);
  }
});

test('right-to-left characters, or a right-to-left paragraph, split the run', () => {
  assert.equal(hasRtlText('مرحبا'), true);
  assert.equal(hasRtlText('שלום'), true);
  assert.equal(hasRtlText('اردو ہے'), true);
  assert.deepEqual(orderedRuns('Hello.', 'rtl'), [
    { start: 5, end: 6, rtl: true, script: 'Latn' },
    { start: 0, end: 5, rtl: false, script: 'Latn' },
  ], 'the full stop reads first, on the left, in a right-to-left paragraph');
});

test('a Latin word inside Arabic stays readable, and the Arabic runs around it', () => {
  const text = 'مرحبا Hello بالعالم 2024.';
  const runs = orderedRuns(text, 'rtl')!;
  assert.deepEqual(runs.map((r) => [text.slice(r.start, r.end).trim(), r.rtl]).filter(([word]) => word), [
    ['.', true],
    ['2024', false],
    ['بالعالم', true],
    ['Hello', false],
    ['مرحبا', true],
  ]);
});

test('Arabic in a left-to-right paragraph keeps the paragraph order', () => {
  const text = 'Hello مرحبا world';
  const runs = orderedRuns(text, 'ltr')!;
  assert.deepEqual(runs.map((r) => [text.slice(r.start, r.end).trim(), r.rtl]).filter(([word]) => word), [
    ['Hello', false],
    ['مرحبا', true],
    ['world', false],
  ]);
});

test('a complex script beside another script is split for its own shaping', () => {
  const text = 'Lolly का नया';
  const runs = orderedRuns(text)!;
  assert.deepEqual(runs.map((r) => r.script), ['Latn', 'Deva']);
  assert.ok(runs.every((r) => !r.rtl));
});

test('the first strong character decides, and neutrals do not count', () => {
  assert.equal(firstStrongDirection('(2024) مرحبا'), 'rtl');
  assert.equal(firstStrongDirection('(2024) Hello مرحبا'), 'ltr');
  assert.equal(firstStrongDirection('2024.'), 'ltr');
});

test('text the analysis refuses shapes as one run rather than throwing', () => {
  assert.equal(orderedRuns('م\ud83d', 'rtl'), null);
});

test('segments come back in pen order, reversed inside a right-to-left run', () => {
  const faces = (part: string) => [...part].reduce<Array<{ text: string; face: number }>>((out, ch) => {
    const face = /[a-z]/i.test(ch) ? 1 : 0;
    const last = out[out.length - 1];
    if (last && last.face === face) last.text += ch; else out.push({ text: ch, face });
    return out;
  }, []);
  assert.deepEqual(shapingSegments('Plain', undefined, faces), [{ text: 'Plain', face: 1, start: 0 }]);
  const mixed = shapingSegments('Hi مرحبا.', 'ltr', faces);
  assert.deepEqual(mixed.map((s) => [s.text, s.start, s.rtl]), [['Hi', 0, false], [' ', 2, false], ['مرحبا', 3, true], ['.', 8, false]]);
});

const api = createNodeTextAPI({ repoRoot: REPO });

test('Arabic joins, and the pen runs left to right from the end of the sentence', async () => {
  const fontUrl = ARABIC;
  const joined = await api.toPath({ text: 'مرحبا', fontUrl, fontSize: 40, clusters: true });
  assert.equal(joined.notdef, 0);
  const letters = await Promise.all([...'مرحبا'].map((c) => api.toPath({ text: c, fontUrl, fontSize: 40 })));
  const apart = letters.reduce((sum, r) => sum + r.advanceWidth, 0);
  assert.ok(joined.advanceWidth < apart, `joined letters are narrower than isolated ones: ${joined.advanceWidth} vs ${apart}`);
  const xs = joined.clusters!.map((c) => c.x);
  assert.deepEqual(xs, [...xs].sort((a, b) => b - a), 'the first letter is the rightmost');
});

test('digits and a Latin word keep their reading order inside Arabic, across two faces', async () => {
  const text = 'مرحبا Hello 2024';
  const shaped = await api.toPath({ text, fontUrl: ARABIC, fontSize: 40, fallbackFonts: [{ fontUrl: OUTFIT }], clusters: true, direction: 'rtl' });
  assert.equal(shaped.notdef, 0);
  const x = (at: number): number => shaped.clusters!.find((c) => c.start === at)!.x;
  const hello = text.indexOf('Hello'), digits = text.indexOf('2024');
  assert.ok(x(hello) < x(hello + 4), 'H is left of o');
  assert.ok(x(digits) < x(digits + 3), '2 is left of the final 4');
  assert.ok(x(hello) < x(digits), 'digits after a Latin word read with it, as the bidi algorithm says');
  assert.ok(x(0) > x(digits), 'and the opening Arabic is on the right');
});

test('the same words in a left-to-right paragraph are in the other order', async () => {
  const text = 'Hello مرحبا';
  const shaped = await api.toPath({ text, fontUrl: ARABIC, fontSize: 40, fallbackFonts: [{ fontUrl: OUTFIT }], clusters: true, direction: 'ltr' });
  const x = (at: number): number => shaped.clusters!.find((c) => c.start === at)!.x;
  assert.ok(x(0) < x(text.indexOf('م')), 'Hello is on the left');
});

test('with no direction, a run reads from its first strong character', async () => {
  const a = await api.toPath({ text: 'مرحبا Hello', fontUrl: ARABIC, fontSize: 40, fallbackFonts: [{ fontUrl: OUTFIT }] });
  const b = await api.toPath({ text: 'مرحبا Hello', fontUrl: ARABIC, fontSize: 40, fallbackFonts: [{ fontUrl: OUTFIT }], direction: 'rtl' });
  assert.equal(a.d, b.d);
});

test('a closing full stop goes to the left of a right-to-left line', async () => {
  const { clusters } = await api.toPath({ text: 'שלום.', fontUrl: HEBREW, fontSize: 40, clusters: true, direction: 'rtl' });
  const stop = clusters!.find((c) => c.start === 4)!;
  assert.ok(clusters!.every((c) => c.start === 4 || c.x > stop.x));
});

test('Devanagari after a Latin word forms its conjuncts', async () => {
  // Shaped as Latin, as it was, the virama stays a visible mark: more glyphs, a wider run.
  const alone = await api.toPath({ text: 'क्ष', fontUrl: DEVANAGARI, fontSize: 40 });
  const latin = await api.toPath({ text: 'A', fontUrl: DEVANAGARI, fontSize: 40 });
  const space = await api.toPath({ text: 'A ', fontUrl: DEVANAGARI, fontSize: 40, preserveWhitespaceAdvance: true });
  const mixed = await api.toPath({ text: 'A क्ष', fontUrl: DEVANAGARI, fontSize: 40 });
  assert.equal(mixed.notdef, 0);
  assert.ok(latin.advanceWidth > 0);
  assert.ok(Math.abs(mixed.advanceWidth - (space.advanceWidth + alone.advanceWidth)) < 0.5,
    `the conjunct has its own width after a Latin letter: ${mixed.advanceWidth} vs ${space.advanceWidth + alone.advanceWidth}`);
});

test('a missing glyph is still counted on the split path, so a caller can refuse it', async () => {
  const shaped = await api.toPath({ text: 'Hello مرحبا', fontUrl: OUTFIT, fontSize: 40 });
  assert.equal(shaped.notdef, 5);
});

test('the fixture faces are on disk where this test says', () => {
  for (const f of [ARABIC, HEBREW, DEVANAGARI, OUTFIT]) assert.ok(readFileSync(REPO + f).length > 1000, f);
});

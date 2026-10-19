// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as hb from 'harfbuzzjs';
import { inkIntercept, skipsInk, strikeGeometry, strikeMetricsFact, underlineGeometry, underlineInkGaps, underlineSpans } from '../engine/src/text-decoration.ts';
import { createNodeTextAPI, nodeStrikeMetrics } from '../packages/node-shell/src/text.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';

test('CSS strike geometry requires real ascent facts and bounded dimensions', async () => {
  for (const [upem, ascent] of [[1000, undefined], [0, 980], [1000, NaN], [1000, 0], [1000, Infinity], [1000, 3000]] as const) assert.equal(strikeMetricsFact(upem, ascent), null);
  const facts = strikeMetricsFact(1000, 980)!;
  assert.deepEqual(strikeGeometry(facts, 48, 123.45), { y: -18, height: 4, width: 123.45 });
  assert.deepEqual(strikeGeometry(facts, 5, 10), { y: -2, height: 1, width: 10 }, 'CSS HTML auto has a one-pixel minimum');
  for (const [size, width] of [[NaN, 10], [48, Infinity], [-1, 10], [48, -1]]) assert.equal(strikeGeometry(facts, size!, width!), null);
  assert.equal(await nodeStrikeMetrics('data:font/ttf;base64,AAECAwQ=', undefined, repoRoot()), null, 'malformed font bytes cannot provide an ascent');
});

test('exact variable-face instances preserve ascent and outline caches; raw MVAR strike metrics are a different paint policy', async () => {
  const text = createNodeTextAPI({ repoRoot: repoRoot() });
  for (const name of ['SUSE[wght].ttf', 'SUSE-Italic[wght].ttf', 'SUSEMono[wght].ttf']) {
    const weights = [100, 400, 700, 900, 100];
    const metrics = await Promise.all(weights.map((weight) => nodeStrikeMetrics(`/fonts/${name}`, [`wght=${weight}`], repoRoot())));
    for (const facts of metrics) assert.deepEqual(facts, { upem: 1000, ascent: 980 });
    const outlines = await Promise.all(weights.map((weight) => text.toPath({ fontUrl: `/fonts/${name}`, variations: [`wght=${weight}`], text: 'MMMM', fontSize: 48 })));
    assert.deepEqual(outlines[0], outlines[4], 'the heavy instance cannot poison cached light geometry');
    assert.notEqual(outlines[0]!.d, outlines[3]!.d, 'different resolved instances retain different glyph outlines');
    // Raw OS/2/MVAR stro varies by weight, but the native Design CSS-auto line does
    // not use those values. The native CSS policy is tested separately.
    const blob = new hb.Blob(await readFile(new URL(`../shells/web/public/fonts/${name}`, import.meta.url)));
    const face = new hb.Face(blob);
    const positions = weights.map((weight) => {
      const font = new hb.Font(face); font.setVariations([hb.Variation.fromString(`wght=${weight}`)!]);
      return font.getMetricPosition(hb.MetricsTag.STRIKEOUT_OFFSET)!;
    });
    assert.equal(positions[0], 283); assert.equal(positions[4], 283);
    assert.ok(positions[1]! > positions[0]! && positions[2]! > positions[1]! && positions[3]! > positions[2]!);
  }
});

test('CSS auto underline sits max(1, ceil(thickness / 2)) px under the baseline, snapped like the strike', () => {
  assert.deepEqual(underlineGeometry(40, 56.25), { y: 1.75, height: 4, top: 2.5, bottom: 5.5, dilation: 4 }, 'the snap puts the line on a whole page pixel');
  assert.deepEqual(underlineGeometry(15), { y: 1, height: 1, top: 1.5, bottom: 2, dilation: 1.5 }, 'thickness 1.5 paints one pixel');
  assert.deepEqual(underlineGeometry(5), { y: 1, height: 1, top: 1.5, bottom: 1.5, dilation: 1 }, 'a one-pixel minimum, and a band of no height');
  assert.equal(underlineGeometry(200)!.dilation, 13, 'the cleared reach stops at 13 px');
  assert.equal(underlineGeometry(200)!.y, 10);
  for (const [size, baseline] of [[NaN, 0], [0, 0], [-1, 0], [20000, 0], [20, Infinity]]) assert.equal(underlineGeometry(size!, baseline!), null);
});

test('skip-ink keeps the reference rule: CJK, Hangul, slashes, low lines and emoji are drawn through', () => {
  for (const ch of 'aZ9g.,é') assert.equal(skipsInk(ch.codePointAt(0)!), true, ch);
  for (const ch of ['/', '\\', '_', '中', '가', 'ア', '‰', '\u3000', '😀', '🇦']) assert.equal(skipsInk(ch.codePointAt(0)!), false, ch);
  for (const ch of ['©', '™']) assert.equal(skipsInk(ch.codePointAt(0)!), undefined, `${ch}: a pictograph the reference's emoji-sequence set may hold`);
});

test('a glyph intercept is the left and right of its ink inside the band, read as Skia reads the outline', () => {
  assert.deepEqual(inkIntercept('M1 -8H9V6H1Z', 1.5, 2.5), [1, 9], 'a stem through the band');
  assert.equal(inkIntercept('M1 -8H9V0H1Z', 1.5, 2.5), null, 'ink above the band');
  assert.equal(inkIntercept('M0 2.5L10 2.5L5 0Z', 2.5, 5.5), null, 'touching the band at one x clears nothing');
  // A quadratic bowl, y = 40t(1 - t), crosses y = 2.5 where t(1 - t) = 1/16.
  const t = (1 - Math.sqrt(0.75)) / 2;
  const quad = inkIntercept('M0,0 Q10,20 20,0 Z', 2.5, 5.5)!;
  assert.ok(Math.abs(quad[0] - 20 * t) < 1e-9 && Math.abs(quad[1] - 20 * (1 - t)) < 1e-9, `quadratic ${quad}`);
  // The same bowl as a cubic, y = 30t(1 - t), crosses where t(1 - t) = 1/12.
  const u = (1 - Math.sqrt(2 / 3)) / 2, xAt = (v: number) => 60 * v * v - 40 * v * v * v;
  const cubic = inkIntercept('M0 0C0 10 20 10 20 0Z', 2.5, 5.5)!;
  assert.ok(Math.abs(cubic[0] - xAt(u)) < 1e-9 && Math.abs(cubic[1] - xAt(1 - u)) < 1e-9, `cubic ${cubic}`);
  assert.deepEqual(inkIntercept('M0 0L4 4L8 0', 1.5, 2.5), [1.5, 6.5], 'an open contour is read as drawn');
  assert.deepEqual(inkIntercept('M0 0C2 4 8 4 10 0Z', 3.5, 4.5), [2, 8], 'control points inside the band count even where the curve stays clear');
  assert.equal(inkIntercept('', 1.5, 2.5), null);
  for (const d of ['M0 0A5 5 0 0 1 10 10', 'm0 0l10 10', 'M0 0L4', 'Z4 4']) assert.equal(inkIntercept(d, 1.5, 2.5), undefined, d);
});

test('ink gaps come from clusters: an exception is drawn through, an unreadable outline or unjudged pictograph is refused', () => {
  const band = underlineGeometry(20)!;
  const box = (x: number, bottom: number) => `M${x + 1} -8H${x + 9}V${bottom}H${x + 1}Z`;
  assert.deepEqual(underlineInkGaps('gap_x', [{ start: 0, d: box(0, 6) }, { start: 1, d: box(10, 0) }, { start: 2, d: box(20, 6) }, { start: 3, d: box(30, 6) }, { start: 4, d: box(40, 0) }], band),
    [[1, 9], [21, 29]], 'the low line crosses the band and is still drawn through');
  assert.equal(underlineInkGaps('g', undefined, band), null, 'a host without clusters cannot clear the ink');
  assert.equal(underlineInkGaps('g', [{ start: 0, d: 'M0 0A1 1 0 0 1 2 2' }], band), null);
  assert.equal(underlineInkGaps('©', [{ start: 0, d: box(0, 6) }], band), null, 'a pictograph that reaches the band cannot be judged');
  assert.deepEqual(underlineInkGaps('©', [{ start: 0, d: box(0, 0) }], band), [], 'one that stays clear needs no judgement');
});

test('underline pieces: each gap widened by the dilation and cut on whole page pixels', () => {
  assert.deepEqual(underlineSpans(18, 50, [[21, 29], [1, 9]], 2), [{ x: 11, width: 8 }, { x: 31, width: 19 }]);
  assert.deepEqual(underlineSpans(18.5, 50, [[1, 9]], 2), [{ x: 11.5, width: 38.5 }], 'the cut edge sits on a page pixel, not a run offset');
  assert.deepEqual(underlineSpans(0, 30, [[2, 6], [5, 12]], 2), [{ x: 14, width: 16 }], 'overlapping gaps merge');
  assert.deepEqual(underlineSpans(0, 30, [[26, 40]], 2), [{ x: 0, width: 24 }], 'a gap past the end trims the line');
  assert.deepEqual(underlineSpans(0, 30, [], 2), [{ x: 0, width: 30 }]);
});

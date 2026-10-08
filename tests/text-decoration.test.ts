// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as hb from 'harfbuzzjs';
import { strikeGeometry, strikeMetricsFact } from '../engine/src/text-decoration.ts';
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

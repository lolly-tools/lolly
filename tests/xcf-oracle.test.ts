// SPDX-License-Identifier: MPL-2.0
/**
 * XCF oracle: compares readXcf layers, flattened by a test-side W3C compositor, with the merged PNG that GIMP 3.2.6
 * exported for each file of photocraft-corpus `gimp/` (pinned in scripts/data/gimp-corpus.json).
 *
 * Requested run only, because it needs the downloaded corpus:
 *   pnpm run fetch:gimp-corpus && LOLLY_XCF_ORACLE=1 node --test tests/xcf-oracle.test.ts
 * Without LOLLY_XCF_ORACLE=1 the suite is one declared skip. With it, a missing corpus file fails the run.
 * The result of every file is written to plans/artifacts/342/xcf-oracle.json.
 *
 * Stated tolerance, fixed before the first run and not tuned afterwards: mean absolute error at most 2 levels of
 * 255 per channel, and at most 2% of channel samples more than 8 levels apart.
 * What this measures is the pair readXcf + the test compositor, in gamma-encoded sRGB. GIMP composites 8-bit files in
 * linear light unless the file asks for perceptual blending (the `-perceptual` files), and the engine decodes to
 * 8-bit, so deltas on the linear files are expected and recorded as KNOWN_GAPS rather than hidden.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { XcfUnsupportedError, readXcf } from '../engine/src/xcf.ts';
import { decodePng, diffRgba, flatten } from './helpers/raster-oracle.ts';

const dir = new URL('../plans/corpora/photocraft-gimp/', import.meta.url);
const recipe = JSON.parse(readFileSync(new URL('../scripts/data/gimp-corpus.json', import.meta.url), 'utf8')) as { files: { path: string }[] };
const names = recipe.files.filter(f => f.path.endsWith('.xcf')).map(f => f.path.slice(5, -4));
const TOLERANCE = { meanAbs: 2, over: 8, overFraction: 0.02 };

/** Files outside the tolerance on the recorded baseline run, with the measured reason. Filled from the first run. */
const KNOWN_GAPS: Record<string, string> = {
  'float-linear': 'readXcf refuses 32-bit float precision (XcfUnsupportedError precision).',
  'layers-8bit': 'GIMP blends this 8-bit file in linear light; the same layers saved perceptual match within 1 level, so the delta is the colour space, not the reader.',
  mask: 'Linear-light blending again: mask-perceptual matches within 1 level.',
  groups: 'Group of opacity 0.7 plus a pass-through group. readXcf reports "Child Multiply" with an empty groupPath, so group membership may be lost in the reader. Not diagnosed further; groups-perceptual fails the same way.',
  'groups-perceptual': 'See groups: the delta is not the colour space.',
  'legacy-modes': 'The reader marks Addition, Subtract, Divide, Grain merge, HSV Value, LCH Color and Linear light as lossy blend approximations, and the compositor has no exact form for them either.',
  'legacy-modes-perceptual': 'See legacy-modes: the delta is the lossy blend mapping.',
};

const requested = process.env.LOLLY_XCF_ORACLE === '1';
const report: Record<string, unknown> = {};

test('xcf oracle: GIMP merged PNGs against readXcf composites', { skip: requested ? false : 'declared skip: set LOLLY_XCF_ORACLE=1 after pnpm run fetch:gimp-corpus' }, async t => {
  for (const name of names) {
    await t.test(name, () => {
      const xcf = new Uint8Array(readFileSync(new URL(`${name}.xcf`, dir))), png = decodePng(new Uint8Array(readFileSync(new URL(`${name}.png`, dir))));
      const warnings: string[] = [];
      let doc;
      try { doc = readXcf(xcf, { inflate: (b, max) => new Uint8Array(inflateSync(b, { maxOutputLength: max })), onWarn: (code, detail) => warnings.push(detail ? `${code}: ${detail}` : code) }); }
      catch (error) {
        if (!(error instanceof XcfUnsupportedError) || !KNOWN_GAPS[name]) throw error;
        report[name] = { pass: false, knownGap: KNOWN_GAPS[name], refused: error.message };
        return;
      }
      const d = diffRgba(flatten(doc), png, TOLERANCE.over);
      const pass = d.meanAbs <= TOLERANCE.meanAbs && d.overFraction <= TOLERANCE.overFraction;
      report[name] = { pass, knownGap: KNOWN_GAPS[name] ?? null, size: `${doc.width}x${doc.height}`, depth: doc.depth, colorMode: doc.colorMode, layers: doc.layers.length, meanAbs: +d.meanAbs.toFixed(3), maxAbs: d.maxAbs, overFraction: +d.overFraction.toFixed(4), warnings };
      if (KNOWN_GAPS[name]) assert.ok(!pass, `${name} now passes: remove it from KNOWN_GAPS`);
      else assert.ok(pass, `${name}: mean ${d.meanAbs.toFixed(2)}, max ${d.maxAbs}, ${(d.overFraction * 100).toFixed(1)}% over ${TOLERANCE.over} levels`);
    });
  }
  mkdirSync(new URL('../plans/artifacts/342/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../plans/artifacts/342/xcf-oracle.json', import.meta.url), `${JSON.stringify({ pin: 'storytold/photocraft-corpus c3abfc1c', tolerance: TOLERANCE, files: report }, null, 2)}\n`);
});

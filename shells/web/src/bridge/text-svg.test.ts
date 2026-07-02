// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the pure SVG text-vectorisation helpers, plus a real
 * HarfBuzz shaping test that drives the exact production glyph-to-path code
 * (text.ts's shapeTextToPath) against a real SUSE font read from disk.
 *
 * These live next to the bridge (not the repo-root tests/ suite, which imports
 * the engine) because they cover shell-side, SUSE-specific font logic. Most of
 * this file is DOM-free math (font resolution, baseline arithmetic); the
 * shaping test below is DOM-free too — HarfBuzz's WASM module runs fine under
 * plain Node — so it needs no browser and no manual export-and-eyeball step.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  suseWeightName, suseFontFile, SUSE_FONT_DIR,
  resolveSuseFontUrl, canVectoriseText, textBaselineY,
} from './text-svg.ts';
import { loadHarfBuzz, fontEntryFromBytes, shapeTextToPath } from './text.ts';

test('suseWeightName snaps to the nearest defined weight', () => {
  assert.equal(suseWeightName(400), 'Regular');
  assert.equal(suseWeightName(700), 'Bold');
  assert.equal(suseWeightName(300), 'Light');
  assert.equal(suseWeightName(900), 'Black');
  // Off-grid values round to the nearest 100-stop.
  assert.equal(suseWeightName(690), 'Bold');    // → 700
  assert.equal(suseWeightName(350), 'Regular'); // Math.round(3.5)=4 → 400
  assert.equal(suseWeightName(250), 'Light');   // Math.round(2.5)=3 → 300
});

test('suseFontFile composes weight stem + optional Italic suffix', () => {
  assert.equal(suseFontFile(700, false), 'SUSE-Bold.ttf');
  assert.equal(suseFontFile(400, true),  'SUSE-RegularItalic.ttf');
  assert.equal(suseFontFile(300, true),  'SUSE-LightItalic.ttf');
});

test('resolveSuseFontUrl: SUSE family → TTF url, other families → null', () => {
  assert.equal(
    resolveSuseFontUrl({ fontFamily: '"SUSE", sans-serif', fontWeight: '700', fontStyle: 'normal' }),
    `${SUSE_FONT_DIR}SUSE-Bold.ttf`,
  );
  assert.equal(
    resolveSuseFontUrl({ fontFamily: 'SUSE', fontWeight: '400', fontStyle: 'italic' }),
    `${SUSE_FONT_DIR}SUSE-RegularItalic.ttf`,
  );
  assert.equal(resolveSuseFontUrl({ fontFamily: 'Arial, sans-serif', fontWeight: '400' }), null);
  assert.equal(resolveSuseFontUrl({ fontFamily: '', fontWeight: '400' }), null);
});

test('resolveSuseFontUrl defaults missing weight to Regular', () => {
  assert.equal(
    resolveSuseFontUrl({ fontFamily: 'SUSE' }),
    `${SUSE_FONT_DIR}SUSE-Regular.ttf`,
  );
});

test('canVectoriseText needs a host.text + resolvable font, and bails on letter-spacing', () => {
  const url = `${SUSE_FONT_DIR}SUSE-Regular.ttf`;
  assert.equal(canVectoriseText({ letterSpacing: 'normal' }, url, true), true);
  assert.equal(canVectoriseText({ letterSpacing: 'normal' }, url, false), false); // no host.text
  assert.equal(canVectoriseText({ letterSpacing: 'normal' }, null, true), false); // unresolved font
  assert.equal(canVectoriseText({ letterSpacing: '2px' }, url, true), false);     // letter-spacing → <text>
  assert.equal(canVectoriseText({}, url, true), true);                            // no letterSpacing key
});

test('textBaselineY splits leading evenly above/below the font box', () => {
  // line box 24px tall, font box 20px (16 asc + 4 desc) → 4px leading, 2px on top.
  assert.equal(textBaselineY(10, 24, 16, 4), 10 + 2 + 16);
  // Tight line-height (line box == font box): baseline sits at top + ascent.
  assert.equal(textBaselineY(0, 20, 16, 4), 16);
  // Negative leading (line-height < font box) pulls the baseline up slightly.
  assert.equal(textBaselineY(0, 18, 16, 4), -1 + 16);
});

// Real SUSE TTF, read straight off disk — the same file resolveSuseFontUrl
// points at in production (via SUSE_FONT_DIR), fetched there instead of read
// here. No mock, no synthetic font.
const SUSE_REGULAR_PATH = fileURLToPath(
  new URL('../../../../catalog/fonts/ttf/SUSE-Regular.ttf', import.meta.url),
);

test('shapeTextToPath: real HarfBuzz shaping of a real SUSE font emits a well-formed, deterministic SVG path', async () => {
  const hb = await loadHarfBuzz();
  const bytes = new Uint8Array(readFileSync(SUSE_REGULAR_PATH));
  const { font, upem } = fontEntryFromBytes(hb, bytes);
  // SUSE's declared units-per-em — sanity-checks the right font actually loaded.
  assert.equal(upem, 1000);

  const first = shapeTextToPath(hb, font, upem, 'Hi', 24);
  const second = shapeTextToPath(hb, font, upem, 'Hi', 24);

  // Deterministic: shaping identical input through the same font twice must
  // produce byte-identical output — no reliance on iteration order or any
  // other nondeterminism in the glyph loop.
  assert.deepEqual(first, second);

  assert.ok(first.d.startsWith('M'), `d should start with an SVG moveto, got: ${first.d.slice(0, 12)}`);
  assert.ok(first.advanceWidth > 0);
  assert.ok(first.bbox !== null);
  assert.ok(first.bbox && first.bbox.x2 > first.bbox.x1);
  assert.ok(first.bbox && first.bbox.y2 > first.bbox.y1);

  // Golden values pinned against SUSE Regular @ upem 1000, fontSize 24
  // (scale = 0.024). If this ever changes, either the vendored SUSE-Regular.ttf
  // was updated, or the shaping/transform math in text.ts regressed — both are
  // worth a human looking at, not silently absorbing.
  assert.equal(
    first.d,
    'M2.09,0L2.09,-16.8L4.15,-16.8L4.15,-9.6L13.3,-9.6L13.3,-16.8L15.34,-16.8L15.34,0L13.3,0L13.3,-7.73L4.15,-7.73L4.15,0L2.09,0Z' +
    'M20.06,0L20.06,-9.86L17.81,-9.86L17.81,-11.54L21.98,-11.54L21.98,0L20.06,0Z' +
    'M19.94,-14.09L19.94,-16.87L22.1,-16.87L22.1,-14.09L19.94,-14.09Z',
  );
  // y2 is -0 (not 0): the last glyph's bottom edge lands exactly on the
  // baseline, and the by2 computation (-(oy + yBearing + height) * scale)
  // produces negative zero here. JSON.stringify collapses -0 to "0", which is
  // how this got missed when the golden values were first transcribed from a
  // one-off run; deepStrictEqual (unlike JSON) treats -0 and 0 as distinct.
  assert.deepEqual(first.bbox, { x1: 2.088, y1: -16.872, x2: 22.104, y2: -0 });
  assert.equal(Math.round(first.advanceWidth * 1000) / 1000, 23.808);
});

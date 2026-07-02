// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the pure SVG text-vectorisation helpers.
 * Run directly:  node --test shells/web/src/bridge/text-svg.test.js
 *
 * These live next to the bridge (not the repo-root tests/ suite, which imports
 * the engine) because they cover shell-side, SUSE-specific font logic. They're
 * DOM-free, so the actual <path> emission in export.js is verified manually
 * (export an HTML tool to SVG); these lock down the math + font resolution.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  suseWeightName, suseFontFile, SUSE_FONT_DIR,
  resolveSuseFontUrl, canVectoriseText, textBaselineY,
} from './text-svg.js';

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

test('SUSE Mono resolves to SUSEMono statics, capped at ExtraBold (no Black cut)', () => {
  assert.equal(suseWeightName(900, true), 'ExtraBold');   // mono axis tops out at 800
  assert.equal(suseWeightName(900, false), 'Black');
  assert.equal(suseFontFile(500, false, true), 'SUSEMono-Medium.ttf');
  assert.equal(suseFontFile(900, true, true),  'SUSEMono-ExtraBoldItalic.ttf');
  assert.equal(
    resolveSuseFontUrl({ fontFamily: "'SUSE Mono', ui-monospace, monospace", fontWeight: '700' }),
    `${SUSE_FONT_DIR}SUSEMono-Bold.ttf`,
  );
  assert.equal(
    resolveSuseFontUrl({ fontFamily: 'SUSE Mono', fontWeight: '900', fontStyle: 'italic' }),
    `${SUSE_FONT_DIR}SUSEMono-ExtraBoldItalic.ttf`,
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

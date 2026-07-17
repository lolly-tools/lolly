// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for engine/src/brand-map.ts — the brand colour + font mapper
 * (plan track E3). Covers the intentional-output guard rails: the chroma gate
 * (neutrals stay neutral, chromatics stay chromatic), nearest-by-ΔEOK for
 * chromatic sources, the review threshold, role hints, many-to-one palette
 * collapse, the static font classification table, and suggestRebrandTheme's
 * swatch → clrScheme slot mapping.
 *
 * Run with: node --test tests/brand-map.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deltaEOk } from '../engine/src/color-tools.ts';
import {
  nearestBrandColor,
  mapPaletteToBrand,
  mapFontsToBrand,
  suggestRebrandTheme,
  type BrandSwatch,
} from '../engine/src/brand-map.ts';

// A representative brand: ink, a neutral grey, and two accents.
const SWATCHES: BrandSwatch[] = [
  { name: 'ink', hex: '#1a1a1a', role: 'ink' },
  { name: 'grey', hex: '#6b6e70', role: 'neutral' },
  { name: 'blue', hex: '#3564d4', role: 'accent' },
  { name: 'red', hex: '#e01b24', role: 'accent' },
];

// ── chroma gate: a grey maps to a brand grey, never an accent ─────────────────

test('a neutral grey source maps to a brand neutral, not the nearest accent', () => {
  const res = nearestBrandColor('#7a7d80', SWATCHES);
  assert.ok(res, 'expected a mapping');
  assert.equal(res!.hex, '#6b6e70');
  assert.equal(res!.role, 'neutral');
  assert.equal(res!.name, 'grey');
});

test('the chroma gate holds even when an accent is ΔE-competitive', () => {
  // A muted slate that a raw nearest-neighbour might pull toward the blue
  // accent; the gate must keep it on the neutral axis.
  const slateBlueAccent: BrandSwatch = { name: 'slate', hex: '#5b6b8c', role: 'accent' };
  const res = nearestBrandColor('#787c82', [SWATCHES[1]!, slateBlueAccent]);
  assert.ok(res);
  assert.equal(res!.hex, '#6b6e70', 'neutral source must land on the neutral swatch');
});

// ── chromatic source: nearest accent by ΔEOK ──────────────────────────────────

test('a saturated red maps to the nearest accent by ΔEOK', () => {
  const res = nearestBrandColor('#d81e28', SWATCHES);
  assert.ok(res);
  assert.equal(res!.hex, '#e01b24');
  assert.equal(res!.role, 'accent');
  // It genuinely is the ΔEOK-nearest chromatic swatch.
  assert.ok(deltaEOk('#d81e28', '#e01b24') < deltaEOk('#d81e28', '#3564d4'));
});

test('a chromatic source never collapses onto a brand grey', () => {
  const res = nearestBrandColor('#2f5fd0', SWATCHES);
  assert.ok(res);
  assert.equal(res!.hex, '#3564d4');
  assert.notEqual(res!.role, 'neutral');
});

// ── review threshold ──────────────────────────────────────────────────────────

test('review:false for a near-exact match, review:true when past the threshold', () => {
  const close = nearestBrandColor('#e01b25', SWATCHES);
  assert.ok(close);
  assert.equal(close!.review, false);

  // A vivid green is far from every brand swatch → flagged for review.
  const far = nearestBrandColor('#00ff88', SWATCHES);
  assert.ok(far);
  assert.equal(far!.review, true);
  assert.ok(far!.deltaE > 0.12);
});

test('a custom threshold controls the review flag', () => {
  // Tiny threshold: even a good (ΔE≈0.016) match is surfaced for review.
  const strict = nearestBrandColor('#d81e28', SWATCHES, { threshold: 0.001 });
  assert.ok(strict);
  assert.equal(strict!.review, true);
  // Loose threshold: even a poor match passes silently.
  const loose = nearestBrandColor('#00ff88', SWATCHES, { threshold: 1 });
  assert.ok(loose);
  assert.equal(loose!.review, false);
});

// ── role hints ────────────────────────────────────────────────────────────────

test('roleHint prefers a role-matching swatch over the raw ΔEOK-nearest', () => {
  const swatches: BrandSwatch[] = [
    { name: 'paper', hex: '#ffffff', role: 'bg' },
    { name: 'faint', hex: '#ededed', role: 'ink' },
  ];
  // Without a hint, the ΔEOK-nearest wins (#ededed is closer to #f4f4f4).
  const plain = nearestBrandColor('#f4f4f4', swatches);
  assert.ok(plain);
  assert.equal(plain!.hex, '#ededed');
  // With roleHint 'bg', the bg-roled swatch is preferred.
  const bg = nearestBrandColor('#f4f4f4', swatches, { roleHint: 'bg' });
  assert.ok(bg);
  assert.equal(bg!.hex, '#ffffff');
  assert.equal(bg!.role, 'bg');
});

test('roleHint falls back to the full pool when no role matches', () => {
  // No swatch has an "accent" role, so the hint is ignored (still returns).
  const swatches: BrandSwatch[] = [{ name: 'grey', hex: '#6b6e70', role: 'neutral' }];
  const res = nearestBrandColor('#707274', swatches, { roleHint: 'accent' });
  assert.ok(res);
  assert.equal(res!.hex, '#6b6e70');
});

// ── input normalisation + robustness ──────────────────────────────────────────

test('bare RRGGBB (DrawingML form) and quoted hex both normalise', () => {
  const bare = nearestBrandColor('D81E28', SWATCHES);
  assert.ok(bare);
  assert.equal(bare!.hex, '#e01b24');
  const quoted = nearestBrandColor('"#d81e28"', SWATCHES);
  assert.ok(quoted);
  assert.equal(quoted!.hex, '#e01b24');
});

test('unparseable source, empty swatches, and named/transparent inputs return null', () => {
  assert.equal(nearestBrandColor('not-a-color', SWATCHES), null);
  assert.equal(nearestBrandColor('#d81e28', []), null);
  assert.equal(nearestBrandColor('transparent', SWATCHES), null);
  // Swatches that are all unparseable → null.
  assert.equal(nearestBrandColor('#d81e28', [{ hex: 'rebeccapurple' }]), null);
});

// ── mapPaletteToBrand ─────────────────────────────────────────────────────────

test('mapPaletteToBrand collapses near-duplicate sources many-to-one', () => {
  const map = mapPaletteToBrand(['#d81e28', '#dd2029', '#7a7d80'], SWATCHES);
  assert.equal(map.get('#d81e28'), '#e01b24');
  assert.equal(map.get('#dd2029'), '#e01b24');
  // Both distinct source keys survive, but resolve to the same brand hex.
  assert.equal(map.get('#d81e28'), map.get('#dd2029'));
  assert.equal(map.get('#7a7d80'), '#6b6e70');
  assert.equal(map.size, 3);
});

test('mapPaletteToBrand skips unmappable entries and non-strings', () => {
  const map = mapPaletteToBrand(
    ['#d81e28', 'transparent', 'garbage', 123 as unknown as string],
    SWATCHES,
  );
  assert.equal(map.size, 1);
  assert.equal(map.get('#d81e28'), '#e01b24');
});

// ── mapFontsToBrand ───────────────────────────────────────────────────────────

test('mapFontsToBrand classifies sans / serif / mono / unknown', () => {
  const fonts = { brand: 'BrandSans', serif: 'BrandSerif', mono: 'BrandMono' };
  const map = mapFontsToBrand(
    [
      'Calibri',
      'Arial',
      "'Segoe UI'",
      'Times New Roman',
      'Georgia',
      'Cambria',
      'Consolas',
      'Courier New',
      'Comic Sans MS', // unknown → brand
    ],
    fonts,
  );
  assert.equal(map.get('Calibri'), 'BrandSans');
  assert.equal(map.get('Arial'), 'BrandSans');
  assert.equal(map.get("'Segoe UI'"), 'BrandSans'); // quotes trimmed for classification
  assert.equal(map.get('Times New Roman'), 'BrandSerif');
  assert.equal(map.get('Georgia'), 'BrandSerif');
  assert.equal(map.get('Cambria'), 'BrandSerif');
  assert.equal(map.get('Consolas'), 'BrandMono');
  assert.equal(map.get('Courier New'), 'BrandMono');
  assert.equal(map.get('Comic Sans MS'), 'BrandSans');
});

test('mapFontsToBrand is case-insensitive and trims a CSS stack to its first family', () => {
  const fonts = { brand: 'BrandSans', serif: 'BrandSerif', mono: 'BrandMono' };
  const map = mapFontsToBrand(['CALIBRI', 'consolas, monospace'], fonts);
  assert.equal(map.get('CALIBRI'), 'BrandSans');
  assert.equal(map.get('consolas, monospace'), 'BrandMono');
});

test('serif/mono fall back to brand when the specific slot is absent', () => {
  const map = mapFontsToBrand(['Times New Roman', 'Consolas', 'Arial'], { brand: 'OnlyBrand' });
  assert.equal(map.get('Times New Roman'), 'OnlyBrand');
  assert.equal(map.get('Consolas'), 'OnlyBrand');
  assert.equal(map.get('Arial'), 'OnlyBrand');
});

test('mapFontsToBrand omits entries with no resolvable target font', () => {
  const map = mapFontsToBrand(['Arial', 'Times New Roman'], {});
  assert.equal(map.size, 0);
});

// ── suggestRebrandTheme ───────────────────────────────────────────────────────

test('suggestRebrandTheme orders neutrals into dk1/dk2/lt1/lt2 by OKLCH lightness', () => {
  const theme = suggestRebrandTheme([
    { hex: '#dddddd' },
    { hex: '#111111' },
    { hex: '#ffffff' },
    { hex: '#333333' },
    { hex: '#3564d4', role: 'accent' },
  ]);
  // Emitted in pptx-patch's theme-write form: hash-less uppercase 6-hex.
  assert.equal(theme.dk1, '111111');
  assert.equal(theme.dk2, '333333');
  assert.equal(theme.lt1, 'FFFFFF');
  assert.equal(theme.lt2, 'DDDDDD');
});

test('suggestRebrandTheme with no neutrals falls back to darkest/lightest overall', () => {
  const theme = suggestRebrandTheme([
    { hex: '#f5e663' }, // light chromatic (L≈0.91)
    { hex: '#5c0a0a' }, // dark chromatic (L≈0.31)
  ]);
  assert.equal(theme.dk1, '5C0A0A');
  assert.equal(theme.lt1, 'F5E663');
  // No second-darkest/-lightest distinct neutral → dk2/lt2 duplicate dk1/lt1.
  assert.equal(theme.dk2, theme.dk1);
  assert.equal(theme.lt2, theme.lt1);
});

test('a two-neutral brand (ink + surface) never inverts dk2/lt2 across the midpoint', () => {
  const theme = suggestRebrandTheme([
    { hex: '#1a1a1a', role: 'ink' },
    { hex: '#fafafa', role: 'bg' },
  ]);
  assert.equal(theme.dk1, '1A1A1A');
  assert.equal(theme.lt1, 'FAFAFA');
  // The only OTHER distinct neutral sits on the wrong side of the dk1/lt1
  // lightness midpoint — taking it would put dk2 body text white-on-white.
  assert.equal(theme.dk2, theme.dk1);
  assert.equal(theme.lt2, theme.lt1);
});

test('suggestRebrandTheme duplicates a lone neutral into dk2/lt2', () => {
  const theme = suggestRebrandTheme([{ hex: '#6b6e70', role: 'neutral' }]);
  assert.equal(theme.dk1, '6B6E70');
  assert.equal(theme.dk2, '6B6E70');
  assert.equal(theme.lt1, '6B6E70');
  assert.equal(theme.lt2, '6B6E70');
});

test('accent slots: role-matched first, then input order, cycling to six', () => {
  const theme = suggestRebrandTheme([
    { hex: '#00aa55' },                     // chromatic, no role
    { hex: '#3564d4', role: 'accent' },     // role-matched → first
    { hex: '#ff8c00', role: 'primary' },    // role-matched (alias) → second
    { hex: '#7b2fbe' },                     // chromatic, no role
  ]);
  assert.equal(theme.accent1, '3564D4');
  assert.equal(theme.accent2, 'FF8C00');
  assert.equal(theme.accent3, '00AA55');
  assert.equal(theme.accent4, '7B2FBE');
  // Four distinct accents cycle to fill the remaining slots — an omitted slot
  // would keep the OLD brand colour in the deck.
  assert.equal(theme.accent5, '3564D4');
  assert.equal(theme.accent6, 'FF8C00');
  assert.equal(theme.hlink, '3564D4');
  assert.equal(theme.folHlink, '3564D4');
});

test('accent near-duplicates (ΔEOK < 0.02) collapse before slot filling', () => {
  const theme = suggestRebrandTheme([
    { hex: '#e01b24', role: 'accent' },
    { hex: '#e11c25', role: 'accent' }, // ΔEOK ≈ 0.002 from the first → dropped
    { hex: '#3564d4', role: 'accent' },
  ]);
  assert.equal(theme.accent1, 'E01B24');
  assert.equal(theme.accent2, '3564D4');
  // The survivor list has two entries, so the cycle alternates.
  assert.equal(theme.accent3, 'E01B24');
  assert.equal(theme.accent4, '3564D4');
  assert.equal(theme.accent5, 'E01B24');
  assert.equal(theme.accent6, '3564D4');
});

test('no chromatic swatches → every accent slot (and hlink) omitted', () => {
  const theme = suggestRebrandTheme([{ hex: '#111111' }, { hex: '#ffffff' }]);
  assert.equal(theme.dk1, '111111');
  assert.equal(theme.lt1, 'FFFFFF');
  assert.equal(theme.accent1, undefined);
  assert.equal(theme.accent6, undefined);
  assert.equal(theme.hlink, undefined);
  assert.equal(theme.folHlink, undefined);
});

test('fonts.brand flows into majorFont + minorFont; empty/absent stays omitted', () => {
  const withFont = suggestRebrandTheme([{ hex: '#111111' }], { brand: 'BrandSans' });
  assert.equal(withFont.majorFont, 'BrandSans');
  assert.equal(withFont.minorFont, 'BrandSans');
  const noFont = suggestRebrandTheme([{ hex: '#111111' }], { brand: '' });
  assert.equal(noFont.majorFont, undefined);
  assert.equal(noFont.minorFont, undefined);
});

test('unparseable swatches are skipped, not trusted', () => {
  const theme = suggestRebrandTheme([
    { hex: 'not-a-color' },
    { hex: 'transparent' },
    { hex: '#3564d4', role: 'accent' },
  ]);
  assert.equal(theme.accent1, '3564D4');
  // The chromatic accent also anchors dk/lt (no neutrals in the set).
  assert.equal(theme.dk1, '3564D4');
  assert.equal(theme.lt1, '3564D4');
});

test('empty or garbage-only input yields {} (fonts-only when a brand font is given)', () => {
  assert.deepEqual(suggestRebrandTheme([]), {});
  assert.deepEqual(suggestRebrandTheme([{ hex: 'garbage' }]), {});
  assert.deepEqual(suggestRebrandTheme([], { brand: 'BrandSans' }), {
    majorFont: 'BrandSans',
    minorFont: 'BrandSans',
  });
});

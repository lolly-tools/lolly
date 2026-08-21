// SPDX-License-Identifier: MPL-2.0
/*
 * APCA - the Lc side of engine/src/color-tools.ts.
 *
 * Run directly:  node --test tests/apca.test.ts
 *
 * The first test is the one that matters: APCA is a fitted algorithm with a dozen
 * magic constants, so the only real check is against the reference implementation's
 * published outputs. Everything after it pins the properties that make carrying
 * APCA *worth it* - the polarity asymmetry above all, since that is precisely what
 * WCAG 2's ratio cannot express and the reason both numbers are shown.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { apcaContrast, apcaUse, apcaVerdict, APCA_SRGB_ONLY } from '../engine/src/color-tools.ts';
import { contrastRatio } from '../engine/src/brand-derive.ts';
import { describeColor } from '../engine/src/color-describe.ts';

test('matches the reference implementation on its published values', () => {
  // APCA-W3 0.1.9. These four are the values quoted by apcacontrast.com's own
  // calculator, and they pin every constant in the file: change MAIN_TRC, any
  // exponent, either scale or either offset and at least one of these moves.
  const near = (got: number | null, want: number, what: string): void => {
    assert.ok(got != null, `${what} parsed`);
    assert.ok(Math.abs(got! - want) < 0.005, `${what}: got ${got}, want ${want}`);
  };
  near(apcaContrast('#000', '#fff'), 106.0407, 'black on white');
  near(apcaContrast('#fff', '#000'), -107.8847, 'white on black');
  near(apcaContrast('#888', '#fff'), 63.0565, 'mid grey on white');
  near(apcaContrast('#fff', '#888'), -68.5415, 'white on mid grey');
});

test('polarity is asymmetric - the whole reason this exists alongside WCAG', () => {
  // The SAME pair, swapped. WCAG 2 gives one number for both; APCA does not, and
  // the difference is not rounding - light-on-dark reads worse than the inverse.
  const bow = apcaContrast('#888', '#fff')!;   // dark text on light
  const wob = apcaContrast('#fff', '#888')!;   // light text on dark
  assert.ok(bow > 0, 'dark-on-light is positive');
  assert.ok(wob < 0, 'light-on-dark is negative');
  assert.ok(Math.abs(Math.abs(wob) - Math.abs(bow)) > 5,
    `the two polarities differ materially: ${bow} vs ${wob}`);
  // WCAG, for contrast, is exactly symmetric - so this pair is one number there.
  assert.equal(
    contrastRatio('#888888', '#ffffff').toFixed(6),
    contrastRatio('#ffffff', '#888888').toFixed(6),
    'WCAG cannot tell the two polarities apart');
});

test('the two algorithms genuinely disagree, and APCA is the stricter one here', () => {
  // A mid grey on white clears WCAG AA for body text (4.5) while APCA puts it
  // below its body-text minimum (75). This is the disagreement designers need to
  // see, and it is why showing only one number is a disservice either way.
  const ratio = contrastRatio('#767676', '#ffffff');
  assert.ok(ratio >= 4.5, `WCAG AA passes at ${ratio.toFixed(2)}:1`);
  const lc = Math.abs(apcaContrast('#767676', '#ffffff')!);
  assert.ok(lc < 75, `APCA says body-text minimum is not met: Lc ${lc.toFixed(1)}`);
  assert.equal(apcaUse(lc), 'large-text');
});

test('the reporting floor is a flat zero, not a small number', () => {
  // Below APCA's clip the fit is not valid, so it reports 0 rather than pretending
  // to precision it does not have. Two near-identical darks included, since the
  // black soft-clamp is what makes that case behave.
  assert.equal(apcaContrast('#fff', '#fff'), 0);
  assert.equal(apcaContrast('#111', '#000'), 0);
  assert.equal(apcaContrast('#7f7f7f', '#808080'), 0);
  assert.equal(apcaUse(0), 'invisible');
});

test('a wide-gamut colour has to be handed its sRGB rendering', () => {
  // APCA is fitted to sRGB and has no published extension to a wider gamut, so
  // `apcaContrast` reads hex and oklch() and NaNs on anything else. That is the
  // honest failure - better than quietly clamping a P3 value and reporting the
  // number as if it described the colour the user authored.
  assert.ok(Number.isNaN(apcaContrast('color(display-p3 1 0 0)', '#ffffff')));
  assert.equal(apcaVerdict('color(display-p3 1 0 0)', '#ffffff'), null);
  // The caller's move is to pass the fallback the page is actually PAINTING, which
  // also keeps the Lc describing the same colour the WCAG ratio describes.
  const baked = describeColor('color(display-p3 1 0 0)')!.srgbHex;
  const lc = apcaContrast(baked, '#ffffff');
  assert.ok(Number.isFinite(lc) && lc > 0, `the bake scores: ${lc}`);
  // oklch() IS read directly, so a wide OKLCH value does not NaN - it is gamut
  // mapped on the way in by the shared hex conversion. To note: the two
  // wide-gamut notations behave differently here.
  assert.ok(Number.isFinite(apcaContrast('oklch(80% 0.35 150)', '#ffffff')));
  assert.match(APCA_SRGB_ONLY, /sRGB/);
});

test('unparseable input never becomes a score', () => {
  // NaN from apcaContrast (its long-standing contract), null once interpreted.
  assert.ok(Number.isNaN(apcaContrast('not-a-colour', '#fff')));
  assert.ok(Number.isNaN(apcaContrast('#fff', 'not-a-colour')));
  assert.equal(apcaVerdict('nope', '#fff'), null);
  assert.equal(apcaUse(NaN), 'invisible');
});

test('the bands are keyed on magnitude and read as capability, not pass/fail', () => {
  // Boundaries, from both polarities - the sign must not shift a band.
  const bands: Array<[number, string]> = [
    [106, 'body-preferred'], [90, 'body-preferred'], [89.9, 'body-minimum'],
    [75, 'body-minimum'], [74.9, 'large-text'], [60, 'large-text'],
    [59.9, 'headline'], [45, 'headline'], [44.9, 'non-text'],
    [30, 'non-text'], [29.9, 'invisible'], [0, 'invisible'],
  ];
  for (const [lc, want] of bands) {
    assert.equal(apcaUse(lc), want, `Lc ${lc}`);
    assert.equal(apcaUse(-lc), want, `Lc -${lc} lands in the same band`);
  }
  const v = apcaVerdict('#fff', '#000')!;
  assert.equal(v.reversed, true, 'white on black is the reversed polarity');
  assert.equal(v.abs.toFixed(2), '107.88');
  assert.equal(v.use, 'body-preferred');
  // The label states what the pair CAN carry - no "fail" anywhere, because APCA
  // trades contrast against size and cannot fail a pair without knowing the size.
  assert.ok(v.label.length > 0);
  assert.doesNotMatch(v.label, /fail/i);
});

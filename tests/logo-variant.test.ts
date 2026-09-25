// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/logo-variant.ts - which mark goes on which background.
 *
 * The table below is lifted from the two shipping deck tools, which answer this
 * question separately today: community/deck-studio/hooks.js (bgIsDark near 183,
 * pickLogo near 167) and brands/suse/tools/deck-builder/hooks.js (near 603 and
 * 678). If a case here starts disagreeing with them, the decks have moved. The one
 * case the two tools answer differently from each other, a colour neither can read, is
 * marked in the table with the answer this module takes and why.
 *
 * Run with: node --test tests/logo-variant.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BACKGROUND_DARK_THRESHOLD,
  bgIsDark,
  contrastRatio,
  parseBackgroundRgb,
  pickLogoVariant,
} from '../engine/src/logo-variant.ts';

test('parseBackgroundRgb reads the forms the deck tools accept, then the rest of CSS', () => {
  assert.deepEqual(parseBackgroundRgb('#0c322c'), [12, 50, 44]);
  assert.deepEqual(parseBackgroundRgb('0c322c'), [12, 50, 44]);
  assert.deepEqual(parseBackgroundRgb('#fff'), [255, 255, 255]);
  assert.deepEqual(parseBackgroundRgb('#0c322cb8'), [12, 50, 44]);
  assert.deepEqual(parseBackgroundRgb('rgb(12, 50, 44)'), [12, 50, 44]);
  assert.deepEqual(parseBackgroundRgb('rgba(12,50,44,0.72)'), [12, 50, 44]);
  assert.equal(parseBackgroundRgb(''), null);
  assert.equal(parseBackgroundRgb('#12345'), null);
  assert.equal(parseBackgroundRgb('not-a-colour'), null);

  // Past the deck tools' own reader, css-color.ts answers, because a design-system
  // token hands a plain colour name straight through (tokens.ts near 533).
  assert.deepEqual(parseBackgroundRgb('rebeccapurple'), [102, 51, 153]);
  assert.deepEqual(parseBackgroundRgb('black'), [0, 0, 0]);
  assert.deepEqual(parseBackgroundRgb('rgb(12 50 44)'), [12, 50, 44]);
  assert.deepEqual(parseBackgroundRgb('hsl(0 0% 100%)'), [255, 255, 255]);
});

test('bgIsDark answers the deck cases, and names where the two tools disagree', () => {
  const cases: Array<[unknown, boolean, string]> = [
    ['#0c322c', true, 'SUSE pine, every hero background'],
    ['#01564a', true, 'pine ramp 2, the cover gradient end'],
    ['#30ba78', false, 'SUSE jungle, the green section hero'],
    ['#90ebcd', false, 'mint'],
    ['#2453ff', true, 'waterhole blue, luminance 79'],
    ['#fe7c3f', false, 'persimmon'],
    ['#efefef', false, 'fog, the card well'],
    ['#ffffff', false, 'paper'],
    ['#000000', true, 'black'],
    ['#1d1d1d', true, 'the neutral starter ink'],
    ['rgba(12,50,44,0.72)', true, 'the caption scrim, alpha ignored'],
    ['#8c8c8c', false, 'grey at luminance 140, the threshold is exclusive'],
    ['#8b8b8b', true, 'one step below the threshold'],
    ['', false, 'nothing stated is never dark'],
    // deck-studio answers false here and deck-builder answers true (its relLum reads 0
    // for a string it cannot parse). This module takes deck-studio's answer.
    ['not-a-colour', false, 'unreadable is never dark'],
    ['black', true, 'a colour NAME is read now, and this one is dark'],
    ['darkslategray', true, 'the name a token system passes through untouched'],
    ['white', false, 'and the pale ones are not'],
    [null, false, 'absent is never dark'],
    [undefined, false, 'undefined is never dark'],
    [{ grad: { stops: [{ color: '#0c322c' }, { color: '#01564a' }] } }, true, 'a gradient is judged by its first stop'],
    [{ grad: { stops: [{ color: '#eafaf8' }, { color: '#c0efde' }] } }, false, 'the pale hero gradient'],
    [{ grad: { stops: [] } }, false, 'an empty gradient states nothing'],
    [{}, false, 'an object with no gradient states nothing'],
  ];
  for (const [bg, want, why] of cases) {
    assert.equal(bgIsDark(bg as never), want, `${why}: ${JSON.stringify(bg)}`);
  }
});

test('the threshold is the deck tools 140 on raw channels, not WCAG luminance', () => {
  assert.equal(BACKGROUND_DARK_THRESHOLD, 140);
  // 0.2126*139 + 0.7152*139 + 0.0722*139 is 139, just under.
  assert.equal(bgIsDark('#8b8b8b'), true);
  // WCAG would call #8b8b8b light against black by a wide margin; the deck rule does not.
  assert.ok(contrastRatio('#8b8b8b', '#000000') > 5);
});

test('pickLogoVariant follows the deck tools fallback order', () => {
  const all = { onLight: 'light', onDark: 'dark', monoOnLight: 'mono-light', monoOnDark: 'mono-dark' };

  assert.deepEqual(pickLogoVariant({ background: '#ffffff', logos: all }), {
    variant: 'onLight', value: 'light', dark: false,
  });
  assert.deepEqual(pickLogoVariant({ background: '#0c322c', logos: all }), {
    variant: 'onDark', value: 'dark', dark: true,
  });
  assert.deepEqual(pickLogoVariant({ background: '#ffffff', logos: all, mono: true }), {
    variant: 'monoOnLight', value: 'mono-light', dark: false,
  });
  assert.deepEqual(pickLogoVariant({ background: '#0c322c', logos: all, mono: true }), {
    variant: 'monoOnDark', value: 'mono-dark', dark: true,
  });

  // Colour asked for, only the mono mark on that side: take the mono one.
  assert.deepEqual(pickLogoVariant({ background: '#ffffff', logos: { monoOnLight: 'mono-light' } }), {
    variant: 'monoOnLight', value: 'mono-light', dark: false,
  });
  // Mono asked for, only the colour mark on that side: take the colour one.
  assert.deepEqual(pickLogoVariant({ background: '#0c322c', logos: { onDark: 'dark' }, mono: true }), {
    variant: 'onDark', value: 'dark', dark: true,
  });
  // No cross-side fallback: a light-only pack puts nothing on a dark frame.
  assert.equal(pickLogoVariant({ background: '#0c322c', logos: { onLight: 'light' } }), null);
  assert.equal(pickLogoVariant({ background: '#ffffff', logos: {} }), null);

  // A gradient background picks the side from its first stop.
  assert.equal(
    pickLogoVariant({ background: { grad: { stops: [{ color: '#0c322c' }] } }, logos: all })?.variant,
    'onDark',
  );
});

test('pickLogoVariant carries asset ids of whatever type the caller holds', () => {
  const picked = pickLogoVariant<{ id: string }>({
    background: '#0c322c',
    logos: { onDark: { id: 'suse/logo/hor-neg-green' } },
  });
  assert.deepEqual(picked, { variant: 'onDark', value: { id: 'suse/logo/hor-neg-green' }, dark: true });
});

test('a stated dark settles the side without measuring the background', () => {
  const all = { onLight: 'light', onDark: 'dark' };
  // A slide master states `dark` per archetype, so a gradient stored as one stop, or a
  // background whose token has not resolved, still gets the mark its author meant.
  assert.deepEqual(pickLogoVariant({ background: '#ffffff', logos: all, dark: true }), {
    variant: 'onDark', value: 'dark', dark: true,
  });
  assert.deepEqual(pickLogoVariant({ background: '#0c322c', logos: all, dark: false }), {
    variant: 'onLight', value: 'light', dark: false,
  });
  assert.deepEqual(pickLogoVariant({ background: undefined, logos: all, dark: true }), {
    variant: 'onDark', value: 'dark', dark: true,
  });
  assert.equal(pickLogoVariant({ background: '#0c322c', logos: all })?.variant, 'onDark', 'and it is optional');
});

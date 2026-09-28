// SPDX-License-Identifier: MPL-2.0
/**
 * translateTextPath's fast route (engine/src/text-spacing.ts): a glyph outline in the
 * composer's own form is shifted without the general SVG parser, and the result must be
 * exactly the general route's output. Justified text shifts every glyph after a widened
 * space, so this route carries most of a long document's justification.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translateOutlinePath, translateParsedPath, translateTextPath } from '../engine/src/text-spacing.ts';
import { textOutlinePixels } from '../packages/node-shell/src/text-outline.ts';

/** A small deterministic generator, so any failing case can be reproduced. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const r4 = (v: number): number => Math.round(v * 10000) / 10000;

/** An outline written the way textOutlinePixels writes one. */
function outline(next: () => number): string {
  const n = (): number => r4((next() - 0.5) * (next() < 0.2 ? 20 : 2000));
  const pair = (): string => `${n()},${n()}`;
  let d = '';
  const subpaths = 1 + Math.floor(next() * 4);
  for (let s = 0; s < subpaths; s++) {
    d += `M${pair()}`;
    const segments = Math.floor(next() * 12);
    for (let i = 0; i < segments; i++) {
      const pick = next();
      d += pick < 0.35 ? `L${pair()}` : pick < 0.7 ? `Q${pair()} ${pair()}` : `C${pair()} ${pair()} ${pair()}`;
    }
    if (next() < 0.8) d += 'Z';
  }
  return d;
}

test('the fast route matches the general route on outlines in the composer form', () => {
  const next = random(20260927);
  for (let i = 0; i < 2000; i++) {
    const d = outline(next);
    const x = r4((next() - 0.5) * 300), y = next() < 0.3 ? r4((next() - 0.5) * 50) : 0;
    const fast = translateOutlinePath(d, x, y);
    assert.notEqual(fast, null, `case ${i} is in the composer form: ${d}`);
    assert.equal(fast, translateParsedPath(d, x, y), `case ${i}: ${d} by ${x},${y}`);
    assert.equal(translateTextPath(d, x, y), fast);
  }
});

test('a real shaped glyph takes the fast route', () => {
  const glyph = { path: 'M10 20Q30 40 50 60L70 80C90 100 110 120 130 140ZM1.5 -2.25L3 4Z' } as Parameters<typeof textOutlinePixels>[0];
  const d = textOutlinePixels(glyph, 12.5, -3, 0.048828125);
  assert.notEqual(translateOutlinePath(d, 4.2, 0), null);
  assert.equal(translateTextPath(d, 4.2, 0), translateParsedPath(d, 4.2, 0));
});

test('anything outside the form takes the general route, with the general answer', () => {
  for (const d of [
    'M1 2L3 4',          // space-separated pairs
    'm1,2l3,4',          // relative commands
    'M1,2 3,4',          // an implicit line after a move
    'M.5,1L2,3',         // a number with no leading digit
    'M1e3,2L3,4',        // an exponent
    'L1,2',              // no move first
    'M1,2ZZ',            // a second close with no move
    'M1,2H10',           // a shorthand command
    'M0,0A5,5 0 0 1 10,10',
    'M1,2 L3,4',         // a separator before a command
    'M1,2L3,',           // a truncated pair
  ]) {
    assert.equal(translateOutlinePath(d, 2, 3), null, d);
    assert.equal(translateTextPath(d, 2, 3), translateParsedPath(d, 2, 3), d);
  }
});

test('a path longer than the fast route handles falls back rather than diverging from the parser budgets', () => {
  const d = 'M0,0' + 'L1,1'.repeat(12_000);
  assert.equal(translateOutlinePath(d, 1, 0), null);
  assert.equal(translateTextPath(d, 1, 0), translateParsedPath(d, 1, 0));
});

test('no shift returns the path untouched', () => {
  assert.equal(translateTextPath('M1,2L3,4', 0, 0), 'M1,2L3,4');
  assert.equal(translateTextPath('', 5, 0), '');
});

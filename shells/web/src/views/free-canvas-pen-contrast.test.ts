// SPDX-License-Identifier: MPL-2.0
/**
 * Pen chrome CONTRAST (styles/parts/editor.css).
 *
 * The pen's path preview, nodes, handles and arms were all painted in a single flat
 * --primary: on a shape filled with the brand colour they disappeared outright, and the
 * arms (a 1px hairline at 60%) disappeared against almost anything. The fix is a dual
 * halo - a light casing tight around each mark, a dark edge just beyond it - so one of
 * the two always separates from the backdrop.
 *
 * This is a purely visual rule and jsdom applies no stylesheet, so there is nothing to
 * assert on a rendered node; the rule TEXT is what gets guarded, exactly as
 * tool-stage-nav.test.ts and free-canvas-rail.test.ts do for the HUD and the rail. What
 * is NOT covered here, and is checked by hand in a browser: how the halo actually looks
 * over a white artboard, a brand-filled shape, a black shape and a photograph.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/parts/editor.css', import.meta.url), 'utf8');

/** The declaration body of the LAST `<sel> { … }` block whose selector list ends in `sel`. */
function rule(sel: string): string {
  const m = css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `editor.css must declare a ${sel} rule`);
  return m![1]!;
}

test('the pen layers declare both halo tones as tokens', () => {
  const m = css.match(/\.fc-pen-layer,\s*\n\.fc-pen-chrome\s*\{([^}]*)\}/);
  assert.ok(m, 'both pen layers must share the halo tokens');
  assert.match(m![1]!, /--pen-casing:/, 'the light casing tone must be a token');
  assert.match(m![1]!, /--pen-edge:/, 'the dark edge tone must be a token');
});

test('the path preview keeps a halo, not a bare --primary stroke', () => {
  const r = rule('.fc-pen-layer');
  assert.match(r, /filter:\s*drop-shadow\(/,
    'the preview <path> is stroked in currentColor only, so its halo must come from the layer filter');
  assert.match(r, /--pen-casing/, 'the halo must include the light casing');
  assert.equal((r.match(/drop-shadow\(/g) ?? []).length, 2,
    'the halo must be a PAIR (light casing then dark edge) - one tone alone fails on the backdrop that matches it');
  // The rejected alternative. If someone reaches for it later it should be a deliberate
  // decision with the trade-offs re-argued, not a silent swap.
  assert.doesNotMatch(r, /mix-blend-mode/,
    'difference blending was rejected: it inverts the brand colour and goes muddy on antialiased edges');
});

test('nodes, handles and arms each carry the dark outer edge', () => {
  for (const sel of ['.fc-pen-node', '.fc-pen-handle', '.fc-pen-arm']) {
    assert.match(rule(sel), /box-shadow:[^;]*--pen-edge|box-shadow:[^;]*rgba\(0,\s*0,\s*0/,
      `${sel} must sit inside a contrasting outer ring`);
  }
  assert.match(rule('.fc-pen-node'), /box-shadow:\s*0 0 0 1px var\(--pen-edge\)/,
    'the node ring must be the shared edge tone, not another one-off rgba');
  assert.match(rule('.fc-pen-handle'), /box-shadow:[^;]*var\(--pen-edge\)/,
    'a handle is solid --primary, so it is invisible on a brand-filled shape without its ring');
});

test('the arms are cased on both sides and are no longer a 60% hairline', () => {
  const r = rule('.fc-pen-arm');
  assert.match(r, /box-shadow:[^;]*var\(--pen-casing\)/, 'the arm needs the light casing');
  assert.match(r, /box-shadow:[^;]*rgba\(0,\s*0,\s*0/, 'the arm needs the dark edge beyond the casing');
  assert.doesNotMatch(r, /background:\s*hsl\(var\(--primary\)\s*\/\s*0\.6\)/,
    'the arm ink must not go back to 60% - it was the least visible mark in the editor');
});

test('the continuity vocabulary survives the halo', () => {
  // Square = corner, round = smooth, ringed = symmetric, is-on = active, is-close-target =
  // the bigger first-node target. The contrast pass must not have flattened them.
  assert.match(css, /\.fc-pen-node\.is-corner\s*\{[^}]*border-radius:\s*1px/, 'corner stays square');
  assert.match(css, /\.fc-pen-node\.is-symmetric\s*\{[^}]*hsl\(var\(--primary\)/, 'symmetric keeps its --primary ring');
  assert.match(css, /\.fc-pen-node\.is-symmetric\s*\{[^}]*--pen-casing/,
    'the symmetric ring must be sandwiched between the edge and the casing, or it vanishes on brand');
  assert.match(css, /\.fc-pen-node\.is-on\s*\{[^}]*background:\s*hsl\(var\(--primary\)\)/, 'the active node stays filled');
  assert.match(css, /\.fc-pen-node\.is-close-target\s*\{[^}]*width:\s*13px/, 'the close target keeps its larger size');
});

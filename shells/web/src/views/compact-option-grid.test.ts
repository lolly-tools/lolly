// SPDX-License-Identifier: MPL-2.0
/**
 * The compact option grid's trigger rule (plans/163 section 6, C4).
 *
 * A badged single-choice list renders as a stack of full-width rows, which is
 * right for three or four options and wrong for ten: Filter's EFFECT list is most
 * of a phone screen before the chosen effect's own settings appear. Past four
 * options the list lays out two-up instead - but only while every label still
 * reads in half a sidebar, because a truncated label loses the one word the list
 * exists to show. Both halves of that rule are easy to "simplify" later into a
 * bare count check, so both are pinned here.
 *
 * A scan + one evaluated expression, for the same reason input-section-fold.test.ts
 * does it: tool-inputs.ts cannot be imported outside Vite (it resolves siblings with
 * `.js` specifiers and pulls flatpickr). The decision is one pure boolean, so the
 * test lifts that expression and runs the real truth table against it.
 *
 * Run directly:  node --test shells/web/src/views/compact-option-grid.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(import.meta.dirname, 'tool-inputs.ts'), 'utf8');

/** The real return expression of compactOptionGrid, as a callable. */
const expr = SRC.match(/export function compactOptionGrid[\s\S]*?return ([^;]+);/)?.[1];
assert.ok(expr, 'compactOptionGrid returns one expression this test can exercise');
const compact = new Function('labels', `return ${expr};`) as (labels: string[]) => boolean;

const of = (n: number, len = 6): string[] => Array.from({ length: n }, () => 'x'.repeat(len));

test('more than four options go two-up; four or fewer keep the full-width rows', () => {
  assert.equal(compact(of(5)), true, 'five short options is the first count worth splitting');
  assert.equal(compact(of(10)), true);
  assert.equal(compact(of(4)), false, 'four rows are already scannable - leave them alone');
  assert.equal(compact(of(3)), false);
  assert.equal(compact(of(1)), false);
  assert.equal(compact([]), false, 'an empty list must not claim a layout');
});

test('one long label keeps the whole list full-width', () => {
  assert.equal(compact([...of(9), 'x'.repeat(17)]), false,
    'a label that would ellipsize in half a sidebar loses the word the list exists to show');
  assert.equal(compact([...of(9), 'x'.repeat(16)]), true, '16 chars is the last length that fits');
});

test('the real lists this was built for land on the right side', () => {
  // community/filter tool.json, the `effect` input - the ten-row list from the audit.
  const filterEffect = ['Halftone', 'Scanline', 'Posterize', 'Voronoi cells', 'Colour treatment',
    'Pixel stretch', 'Imperfections', 'Dither', 'ASCII art', 'Glitch'];
  assert.equal(compact(filterEffect), true, 'Filter EFFECT: 10 options, longest label 16 chars');
  // community/gradient tool.json, the `mode` input.
  assert.equal(compact(['Blend', 'Subdivide', 'Mesh', 'Warp', 'Flow']), true, 'Gradient METHOD: 5 short options');
});

test('the markup takes its class from compactOptionGrid, and a segmented list never does', () => {
  assert.match(SRC, /const compact = !segmented && compactOptionGrid\(/,
    'the compact class is decided by the pinned rule, not re-derived inline');
  assert.match(SRC, /badge-select--compact/, 'the variant class is the one parts/tool.css styles');
  const css = readFileSync(resolve(import.meta.dirname, '../styles/parts/tool.css'), 'utf8');
  assert.match(css, /\.badge-select--compact\s*\{[^}]*grid-template-columns:\s*repeat\(2,/,
    'parts/tool.css lays the compact variant out in two columns');
});

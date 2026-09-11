// SPDX-License-Identifier: MPL-2.0
/**
 * Table-cell DRIFT GUARD - a static read of parts/tool.css.
 *
 * A table cell is markup-identical to a sidebar field (a bare `<input>` /
 * `<textarea>` inside an `.input-row`) but is NOT one: it is a cell in a grid,
 * flat and content-sized, and it must opt out of the shared field recipes. The
 * codebase already spells that opt-out `:not(.table-cell)` - but it has to be
 * repeated on every `.input-row input` / `.input-row textarea` rule, and a rule
 * that forgets it wins anyway on specificity: `.input-row textarea` is (0,1,1)
 * against `.table-cell`'s (0,1,0), so the cell's own declarations lose no matter
 * what order they appear in or how emphatically they are written.
 *
 * That is exactly how `resize: vertical` and `min-height: 80px` reached the grid:
 * one of the two textarea recipes carried the opt-out and the other didn't. The
 * visible symptom was a drag handle on every cell (dragging one left its row
 * ragged, since its neighbours stayed content-sized). No runtime test can see it
 * - nothing is wrong with the DOM, only with which rule won - so it is asserted
 * here, structurally.
 *
 * Deliberately narrow: this does not police what the field recipes CONTAIN (those
 * are design choices), only that they cannot reach a `.table-cell`.
 *
 * Run directly:  node --test shells/web/src/views/table-cell-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS_PATH = fileURLToPath(new URL('../styles/parts/tool.css', import.meta.url));

/** Every selector in the sheet, comments stripped, one per returned entry. */
function selectors(css: string): string[] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  // A selector is whatever precedes a `{` that opens a declaration block. At-rule
  // preludes (@media/@layer/@supports) start with `@` and are skipped.
  for (const m of noComments.matchAll(/([^{}();]+)\{/g)) {
    for (const sel of m[1]!.split(',')) {
      const s = sel.trim();
      if (s && !s.startsWith('@')) out.push(s);
    }
  }
  return out;
}

// A BARE `input` / `textarea` type selector - not the `input` inside `.input-row`,
// `.input-label` or `jelly-input`, which are class and custom-element names.
const BARE_TYPE = /(?<![\w.#-])(input|textarea)((?:\[[^\]]*\]|\.[\w-]+|#[\w-]+|:[\w-]+(?:\([^)]*\))?)*)/;

/**
 * Whether a selector inside `.input-row` would also match a table cell - i.e. it
 * names the bare element type, isn't narrowed to a `type=` a cell never carries
 * (a header cell is a plain `<input>` with no type; a body cell is a textarea),
 * and doesn't already opt out.
 */
function couldHitTableCell(sel: string): boolean {
  if (!sel.includes('.input-row')) return false;
  const m = BARE_TYPE.exec(sel);
  if (!m) return false;
  if (sel.includes(':not(.table-cell)')) return false;
  // Strip negations before looking for a positive `[type=…]` narrowing - 
  // `input:not([type="checkbox"])` still matches a typeless header cell.
  const positiveQuals = (m[2] ?? '').replace(/:not\([^)]*\)/g, '');
  return !positiveQuals.includes('[type=');
}

test('every .input-row textarea/input rule excludes .table-cell', () => {
  const found = selectors(readFileSync(CSS_PATH, 'utf8')).filter(couldHitTableCell);
  assert.deepEqual(found, [],
    `these .input-row field rules would also style table cells - add :not(.table-cell):\n  ${found.join('\n  ')}`);
});

test('the .table-cell recipe still states the declarations it is protecting', () => {
  // If someone deletes `resize: none` from .table-cell on the grounds that "the
  // opt-out handles it", the cell is one careless `.input-row textarea` rule away
  // from a drag handle again. Belt and braces, cheaply.
  const css = readFileSync(CSS_PATH, 'utf8');
  const block = /\.table-cell\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(block, /resize:\s*none/, '.table-cell must set resize: none');
});

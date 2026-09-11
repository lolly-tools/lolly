// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog view - mobile responsiveness guard (styles/parts/catalog.css).
 *
 * The catalog toolbars (the sticky filter pill and the floating bulk-action bar)
 * must collapse to ICONS on a phone and never push the page wider than the
 * viewport. These tests assert the MECHANISM in the stylesheet, not any pixel:
 *
 *   1. the bulk-bar's action labels collapse to VISUALLY-HIDDEN (not display:none)
 *      inside a phone @media block - the bulk buttons carry no aria-label, so their
 *      accessible name IS that label span (see lib/bulk-bar.ts) and it must survive;
 *   2. the type-filter labels collapse (they DO carry aria-label + title, so a plain
 *      display:none is fine there);
 *   3. the asset grid stays FLUID at the phone breakpoint (auto-fill/auto-fit), never
 *      a hard `repeat(N, …)` that can't shrink below N columns;
 *   4. the floating bars declare a viewport-relative width cap on mobile, so neither
 *      the sticky pill nor the bulk bar can overflow a narrow screen.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/styles/catalog-mobile.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STYLES_DIR = dirname(fileURLToPath(import.meta.url));            // src/styles/
const CSS = readFileSync(join(STYLES_DIR, 'parts', 'catalog.css'), 'utf8');

/** Drop CSS block comments while preserving byte offsets, so any interior braces in
 *  the prose can't confuse the brace matcher below. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
}

/** Extract the body of every `@media (max-width: …)` at-rule (brace-matched, so nested
 *  rule blocks are captured whole). Returns each phone block's inner CSS text AND the
 *  outer span [start,end) of the whole at-rule, so the base sheet can subtract them. */
function phoneMediaBlocks(css: string): { body: string; from: number; to: number }[] {
  const src = stripComments(css);
  const out: { body: string; from: number; to: number }[] = [];
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const width = Number(m[1]);
    if (width > 700) continue;   // only phone-class breakpoints (this file uses 560/640)
    // Match the opening brace of the @media to its close.
    let depth = 1;
    let i = re.lastIndex;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
    }
    out.push({ body: src.slice(start, i - 1), from: m.index, to: i });
  }
  return out;
}

const BLOCKS = phoneMediaBlocks(CSS);
const PHONE_TEXT = BLOCKS.map(b => b.body).join('\n');
// The sheet with every phone @media block removed - what desktop actually sees.
const BASE = (() => {
  const src = stripComments(CSS);
  let out = '';
  let cursor = 0;
  for (const b of BLOCKS) { out += src.slice(cursor, b.from); cursor = b.to; }
  return out + src.slice(cursor);
})();

test('phone media blocks are actually found (matcher is not silently empty)', () => {
  assert.ok(BLOCKS.length >= 2, `expected at least two phone @media blocks, found ${BLOCKS.length}`);
});

test('bulk-bar action labels collapse to VISUALLY-HIDDEN on phones (never display:none)', () => {
  // The rule targeting the label span inside a bulk action button, at the phone breakpoint.
  const spanRule = /\.cat-bulkbar-actions\s+\.btn\s*>?\s*span\s*\{([^}]*)\}/.exec(PHONE_TEXT);
  assert.ok(
    spanRule,
    'No phone rule hides the bulk-bar action label span. Up to seven text buttons ' +
    'overflow the pill on a phone - the labels must collapse to icons inside a ' +
    '`@media (max-width: …)` block.',
  );
  const decls = spanRule![1] ?? '';
  // Visually-hidden, not removed: the button has no aria-label, so a display:none here
  // would leave an unnamed icon button.
  assert.match(decls, /position\s*:\s*absolute/,
    'the bulk-bar label span must be VISUALLY-HIDDEN (position:absolute + clip), so the ' +
    'button keeps an accessible name');
  assert.ok(/clip-path\s*:\s*inset|clip\s*:\s*rect/.test(decls),
    'the visually-hidden bulk-bar label must be clipped (clip-path:inset / clip:rect)');
  assert.ok(!/display\s*:\s*none/.test(decls),
    'the bulk-bar label must NOT be display:none - these buttons have no aria-label, so ' +
    'removing the span from the a11y tree leaves an unnamed control');
});

test('the bulk-bar label collapse is MOBILE-ONLY (desktop keeps the text)', () => {
  // The same rule must not appear at base scope (outside any phone @media), or desktop
  // would lose its labels too.
  assert.ok(
    !/\.cat-bulkbar-actions\s+\.btn\s*>?\s*span\s*\{[^}]*position\s*:\s*absolute/.test(BASE),
    'the bulk-bar label span is visually-hidden at BASE scope - desktop would lose its ' +
    'text labels. Keep the collapse inside the phone @media block only.',
  );
});

test('the type-filter labels collapse on phones', () => {
  assert.match(
    PHONE_TEXT, /\.cat-typefilter-opt\s+\.cat-btn-label\s*\{[^}]*display\s*:\s*none/,
    'the sticky type-filter buttons must collapse to icon-only on a phone (their ' +
    'aria-label + title keep them named, so display:none of the label is fine here)',
  );
});

test('the asset grid stays FLUID at the phone breakpoint (no hard column count)', () => {
  // Every phone-scoped `.cat-grid` grid-template-columns must be auto-fill/auto-fit, so it
  // can shrink to a single column and never overflow a narrow screen.
  const gridRules = [...PHONE_TEXT.matchAll(/\.cat-grid\s*\{([^}]*)\}/g)];
  assert.ok(gridRules.length > 0, 'expected a phone-scoped .cat-grid rule');
  for (const g of gridRules) {
    const cols = /grid-template-columns\s*:\s*([^;]+)/.exec(g[1] ?? '');
    if (!cols) continue;
    const value = cols[1] ?? '';
    assert.ok(
      /auto-fill|auto-fit/.test(value),
      `phone .cat-grid uses a non-fluid column track ("${value.trim()}") - a hard ` +
      '`repeat(N, …)` can overflow a narrow phone. Keep it auto-fill/auto-fit with a ' +
      'minmax() min that fits the smallest supported viewport.',
    );
    assert.ok(
      !/repeat\(\s*\d+\s*,/.test(value),
      `phone .cat-grid pins a fixed column count ("${value.trim()}") - collapse to a ` +
      'fluid auto-fill grid so it can drop to one column.',
    );
  }
});

test('the floating bars cap their width against the viewport on phones', () => {
  // Sticky toolbar: bounded to its container (max-width) rather than a fixed px width.
  const toolbar = /\.cat-toolbar\s*\{([^}]*)\}/.exec(PHONE_TEXT);
  assert.ok(toolbar, 'expected a phone-scoped .cat-toolbar rule');
  assert.match(toolbar![1] ?? '', /max-width\s*:/,
    'the sticky toolbar must cap its width on a phone so it can never poke past the edge');

  // Bulk bar: an explicit viewport-relative cap (min()/vw/max-width), not a bare fixed width.
  const bulk = /\.cat-bulkbar\s*\{([^}]*)\}/.exec(PHONE_TEXT);
  assert.ok(bulk, 'expected a phone-scoped .cat-bulkbar rule');
  const decls = bulk![1] ?? '';
  assert.ok(
    /min\(|vw|max-width/.test(decls),
    'the bulk bar must declare a viewport-relative width cap on a phone (min()/vw/max-width) ' +
    'so a wide selection of actions can never overflow the screen',
  );
});

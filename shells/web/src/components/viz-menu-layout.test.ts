// SPDX-License-Identifier: MPL-2.0
/**
 * The visualiser options menu's box model, pinned against the one bug it has actually had:
 * a preset list that collapsed to ZERO pixels.
 *
 * The menu is a flex column - the setting pill rows (mode, brand tint, colour scheme, cycle)
 * and the actions, then the search field, then the result list last. Every row but the list
 * is sized by its content, so the list is the only child the flex algorithm can shrink, and
 * it was authored `min-height: 0`. Once the fixed rows exceeded the menu's max-height - which
 * a brand with the full six colour schemes (MAX_SCHEMES, lib/viz-schemes.ts) did back when
 * each scheme was its own full-width row - the list absorbed the entire difference and
 * rendered 0px tall. Every preset was in the DOM; none was visible, so it read as "search
 * returns nothing". (The schemes are a wrapping pill row as of 2026-07-31, so that specific
 * pressure is gone; the floor is what makes the collapse impossible rather than unlikely.)
 *
 * jsdom does no layout, so this asserts on the DECLARATIONS instead - which is where both
 * halves of the bug lived:
 *   · the list must keep a non-zero floor, or it can be shrunk away again;
 *   · `.viz-menu` must declare its height ONCE. A second, later `.viz-menu { max-height … }`
 *     block (a leftover from the pre-search flat list) silently beat the search-list rule.
 *
 * The measured behaviour itself was verified in real Chrome: with 6 scheme rows the list
 * went 0px → 112px, and the menu's own scroller keeps the actions reachable.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./viz-overlay.ts', import.meta.url), 'utf8');
const css = src.slice(src.indexOf('const CSS = `') + 13, src.indexOf('`;\n\nfunction ensureStyles'));

/** Every declaration block for an exact selector, in source order. */
function blocks(selector: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`(^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g');
  for (const m of css.matchAll(re)) out.push(m[2]!);
  return out;
}

test('the preset list keeps a non-zero height floor so it cannot be shrunk away', () => {
  const list = blocks('.viz-list');
  assert.equal(list.length, 1, 'one rule owns the list box');
  const min = /min-height:\s*([^;]+)/.exec(list[0]!)?.[1]?.trim();
  assert.ok(min, '.viz-list must declare a min-height - without one the flex column collapses it');
  assert.notEqual(min, '0', 'min-height:0 is exactly the bug: the list absorbs all overflow and hits 0px');
  const px = min!.endsWith('rem') ? parseFloat(min!) * 16 : parseFloat(min!);
  assert.ok(px >= 80, `the floor must clear a couple of rows, got ${min}`);
  assert.match(list[0]!, /overflow-y:\s*auto/, 'the list is the scroller, not the menu');
});

test('.viz-menu declares its height and scrolling exactly once', () => {
  // A duplicate block at equal specificity later in the sheet wins silently - how the
  // pre-search `max-height: min(70vh, 460px)` kept overriding the search-list geometry.
  const sized = blocks('.viz-menu').filter((b) => /max-height|overflow/.test(b));
  assert.equal(sized.length, 1, 'exactly one .viz-menu rule may set max-height/overflow');
  assert.match(sized[0]!, /display:\s*flex/, 'the menu is the flex column the list stretches inside');
  assert.match(sized[0]!, /overflow-y:\s*auto/, 'overflow the list floor cannot absorb must still be reachable');
});

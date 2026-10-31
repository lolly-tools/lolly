// SPDX-License-Identifier: MPL-2.0
/**
 * The studio bar (styles/parts/start-bar.css) against the room under the bar. A
 * browser shows these (tests/start-bar.browser.test.ts); this pins the two
 * rules that make them true, so a stylesheet edit that drops one fails without
 * a browser.
 *
 *   1. The open room's shell gives up the stacking context start.css hands every
 *      child of .start. Without that, the bar (z-index 20) is drawn over every
 *      popover a room raises (30 and up), and a tall swatch picker lost its name
 *      row under the bar.
 *   2. The room strip's scroll fade applies at every width. It used to sit in
 *      the phone block only, so a desk strip that did not fit cut its last rooms
 *      off with nothing to show more were there.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/styles/start-bar-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./parts/start-bar.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Depth of braces open at `index`: 1 is the top of the sheet's `@layer views` block. */
function depthAt(index: number): number {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
  }
  return depth;
}

/** Each place a rule for `selector` opens, with the declarations it holds. */
function rules(selector: string): Array<{ depth: number; body: string }> {
  const out: Array<{ depth: number; body: string }> = [];
  const needle = `${selector} {`;
  for (let at = css.indexOf(needle); at >= 0; at = css.indexOf(needle, at + 1)) {
    const open = at + needle.length;
    out.push({ depth: depthAt(at), body: css.slice(open, css.indexOf('}', open)) });
  }
  return out;
}

test('the open room shares the bar\'s stacking context at every width', () => {
  const shell = rules('.start.start--studio > .ds-shell');
  assert.ok(shell.some(r => r.depth === 1 && /z-index:\s*auto/.test(r.body)), 'the shell takes z-index: auto outside any media query');
});

test('the room strip fades where rooms continue, on a desk as on a phone', () => {
  const fade = rules('.ds-rooms[data-more]');
  assert.ok(fade.some(r => r.depth === 1 && /mask-image:/.test(r.body)), 'the fade is a top-level rule, not a phone-only one');
  for (const r of rules('.ds-rooms')) {
    assert.doesNotMatch(r.body, /mask-image:/, 'a strip that fits is drawn without a fade');
  }
});

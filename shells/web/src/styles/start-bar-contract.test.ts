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
 *   2. The room strip's scroll cue (a fade with a chevron, lib/scroll-cue.ts)
 *      applies at every width. A fade used to sit in the phone block only, so a
 *      desk strip that did not fit cut its last rooms off with nothing to show
 *      more were there (plan 346, change 10).
 *   3. The kicker is an h1, and base.css gives every h1 the display face; the
 *      kicker takes the bar's own face back, so a design system with a display
 *      face does not restyle a chrome label.
 *   4. The page pads its scroll by the pinned bars, so keyboard focus is never
 *      left under them (WCAG 2.4.11); the padding steps aside while focus is in
 *      the bar, and no room adds a scroll margin of its own on top.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/styles/start-bar-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sheet = (name: string): string => readFileSync(new URL(`./parts/${name}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const css = sheet('start-bar.css');

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

test('the room strip shows a cue where rooms continue, on a desk as on a phone', () => {
  const shown = css.indexOf('.ds-room-nav[data-more~="end"] > .scroll-cue--end');
  assert.ok(shown > 0 && depthAt(shown) === 1, 'the cue is a top-level rule, not a phone-only one');
  const cue = rules('.ds-room-nav > .scroll-cue');
  assert.ok(cue.some(r => r.depth === 1 && /display:\s*none/.test(r.body) && /pointer-events:\s*none/.test(r.body)), 'hidden until an end holds rooms, and never in the way of a tap');
  assert.ok(rules('.ds-room-nav > .scroll-cue--end').some(r => /linear-gradient\(to left, var\(--ds-cue-ground\)/.test(r.body)), 'the end fades into the bar\'s own surface');
  assert.ok(rules('.ds-room-nav > .scroll-cue--end svg').some(r => /rotate\(-90deg\)/.test(r.body)), 'the chevron points the way');
  for (const r of rules('.ds-rooms')) assert.doesNotMatch(r.body, /mask-image:/, 'the strip itself is never masked');
  const bar = readFileSync(new URL('../views/start/bar.ts', import.meta.url), 'utf8');
  assert.match(bar, /watchScrollCue\(list, start\.railEl\)/, 'bar.ts reuses lib/scroll-cue.ts, with the nav as the cue\'s host');
});

test('the kicker keeps the bar\'s face while it is the page\'s h1', () => {
  const kicker = rules('.ds-bar-kicker');
  assert.ok(kicker.some(r => r.depth === 1 && /font-family:\s*inherit/.test(r.body)), 'base.css would hand the h1 the display face');
});

test('the page pads its scroll by the pinned bars, except while focus is in the bar', () => {
  const pad = rules('html:has(.start.start--studio > .ds-top)');
  assert.ok(pad.some(r => r.depth === 1 && /scroll-padding-top:\s*var\(--ds-sticky-top/.test(r.body)), 'the top bar pads the page at every width');
  assert.ok(pad.some(r => r.depth === 1 && /scroll-padding-bottom:\s*var\(--ds-sticky-bottom/.test(r.body)), 'the phone room bar pads the foot of the page');
  const inBar = rules('html:has(.start.start--studio > .ds-top:focus-within)');
  assert.ok(inBar.some(r => r.depth === 1 && /scroll-padding-block:\s*0/.test(r.body)), 'focus moving within the bar never scrolls the page');
});

test('no room adds a top scroll margin on top of the page padding', () => {
  // The page's padding already clears the bar; a margin here would count the
  // bar twice. A modal with its own scroller (start-reference.css) is not a room.
  for (const name of ['start.css', 'start-bar.css', 'start-skills.css', 'start-usage.css', 'brand-studio.css']) {
    assert.doesNotMatch(sheet(name), /scroll-margin(?:-top|-block-start|-block)?\s*:/, `${name} sets no scroll margin`);
  }
});

// SPDX-License-Identifier: MPL-2.0
/**
 * The Board's frame (styles/parts/start.css and start-bar.css, plan 346): the
 * rules that make the composition, pinned so a stylesheet edit that drops one
 * fails without a browser. The shots are the evidence that it looks right; these
 * are the reasons it does.
 *
 *   1. The studio sits in one centred column of at most 1440px on a wide screen,
 *      the bar, the rooms and the open room alike.
 *   2. On a desk the Board and its live column share two columns, both at
 *      the top; the live column is sticky, in the scene's own shape and never
 *      taller than the window under the bar (100dvh minus
 *      the pinned bar). Never in two panes, where split.css lays them out.
 *   3. On a phone the live column is a short card in the scene's own shape, and
 *      the doors keep their words in less height.
 *   4. In two panes the live column is the work pane, as tall as the pane.
 *   5. The colour reveal is one cross-fade, and none under either Reduce motion.
 *   6. Nothing in the Board wears a dashed edge (dashed means "drop here").
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/styles/start-board-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sheet = (name: string): string => readFileSync(new URL(`./parts/${name}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const start = sheet('start.css');
const bar = sheet('start-bar.css');

/** The declarations of the first rule whose selector list is exactly `selector`
 *  (at the start of a rule, so `.a {` never matches inside `.b > .a {`). */
function body(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp(`(?:^|[\\n{}])\\s*${escaped} \\{`).exec(css);
  assert.ok(found, `no rule for ${selector}`);
  const open = found.index + found[0].length;
  return css.slice(open, css.indexOf('}', open));
}

test('FRAME: the studio is one centred column of at most 1440px', () => {
  assert.match(body(bar, '.start.start--studio'), /--ds-frame:\s*1440px/);
  assert.match(body(bar, '.start.start--studio > .ds-shell'), /max-width:\s*var\(--ds-frame\)[\s\S]*margin-inline:\s*auto/);
  assert.match(bar, /\.start\.start--studio > \.ds-top > \.ds-bar,\s*\.start\.start--studio > \.ds-top > \.ds-room-nav \{ max-width: var\(--ds-frame\); margin-inline: auto; \}/, 'the bar and the rooms keep to the frame on a desk');
  assert.match(body(bar, '.start.start--studio > .gallery-topright'), /right:\s*calc\(max\(var\(--ds-gutter\), \(100% - var\(--ds-frame\)\) \/ 2\)/, 'the profile button stays on the frame\'s edge');
});

test('DESK: two columns while the Board is open, the live column sticky and capped at the window', () => {
  const desk = '@media (min-width: 641px)';
  const at = start.indexOf(desk);
  assert.ok(at >= 0);
  const grid = body(start, 'html:not([data-layout="split"]) .start--studio .ds-main:has(> .ds-live:not([hidden]))');
  assert.match(grid, /display:\s*grid/);
  assert.match(grid, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, var\(--ds-live-share, 1fr\)\)/);
  const live = body(start, 'html:not([data-layout="split"]) .start--studio .ds-main > .ds-live');
  assert.match(live, /position:\s*sticky/);
  assert.match(live, /top:\s*var\(--ds-sticky-top/);
  assert.match(live, /max-height:\s*calc\(100dvh - var\(--ds-sticky-top, 0px\)/, 'never taller than the window under the bar');
  assert.doesNotMatch(live, /(?:^|[;\s])height:/, 'as tall as its content, not a window-tall slab');
  assert.match(live, /align-self:\s*start/, 'shorter than its column, so it can stick');
  const stage = body(start, 'html:not([data-layout="split"]) .start--studio .ds-main > .ds-live > .ds-live-stage');
  assert.match(stage, /aspect-ratio:\s*4 \/ 3/, 'the stage keeps the scene\'s own shape');
  assert.match(stage, /max-height:\s*100%/, 'and gives up height on a short window');
  assert.doesNotMatch(start, /\.ds-ov-(?:card|door|start-door) \{ min-height: clamp\([^)]*dvh/, 'a tall window does not stretch the Board\'s cards');
  assert.ok(start.indexOf('html:not([data-layout="split"]) .start--studio .ds-main > .ds-live') > at, 'only on a desk');
  assert.match(start, /\.start--studio \.ds-main:has\(> \.ds-live:not\(\[hidden\]\)\) > \.start-editor-wrap \{ display: none; \}/, 'the editor\'s empty wrapper takes no place in the frame');
  assert.match(body(start, '.ds-live-stage'), /container-type:\s*size/, 'the scene is sized to both sides of the stage');
  assert.match(body(start, '.ds-live-scene'), /width:\s*min\(100cqw, calc\(100cqh \* 4 \/ 3\)\)/);
});

test('PHONE: the live column is a short card, and the doors keep their words in less height', () => {
  const phone = start.slice(start.lastIndexOf('@media (max-width: 640px)'));
  assert.match(phone, /\.ds-live-stage \{ container-type: normal; aspect-ratio: 4 \/ 3; \}/);
  assert.match(phone, /\.ds-ov-start-cta \{ display: none; \}/);
  assert.match(phone, /\.ds-ov-cards \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
});

test('TWO PANES: the live column is the work pane, as tall as the pane', () => {
  assert.match(body(start, 'html[data-layout="split"] .start--studio .ds-main > .ds-live'), /align-self:\s*stretch/);
});

test('MOTION: one cross-fade for the first colour, none under either Reduce motion', () => {
  assert.match(body(start, '.ds-live-was'), /animation:\s*ds-live-reveal calc\(2 \* var\(--dur-3\)\) var\(--ease-out\) forwards/);
  assert.match(start, /@media \(prefers-reduced-motion: reduce\) \{\s*\.ds-live-was \{ display: none; \}/);
  assert.match(start, /html\[data-a11y-motion="reduce"\] \.ds-live-was \{ display: none; \}/);
  const overview = readFileSync(new URL('../lib/design-system/rooms/overview.ts', import.meta.url), 'utf8');
  assert.match(overview, /!noir && !prefersReducedMotion\(\)/, 'and the room never lays the grey picture over the new one when motion is off');
});

test('RULES: no dashed edge, and no accent outline at rest, anywhere on the Board', () => {
  const board = start.slice(start.indexOf('.ds-ov {'), start.indexOf('.start-import-modal'));
  assert.doesNotMatch(board, /dashed/, 'dashed means drop here');
  assert.doesNotMatch(board, /border(?:-[a-z]+)?:\s*[^;]*var\(--primary\)/, 'no accent border on a rounded shape');
});

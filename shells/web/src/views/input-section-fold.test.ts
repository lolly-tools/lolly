// SPDX-License-Identifier: MPL-2.0
/**
 * Input-section fold defaults - the phone sheet opens ONE section, the desktop
 * sidebar is untouched.
 *
 * `.input-section` is a real <details>, and the panel is rebuilt from a string on
 * every render, so which sections carry `open` is decided in one place:
 * `shouldOpenSection` (tool-inputs.ts). Two properties are worth pinning. A section
 * the user has opened must stay open - the panel re-renders on every keystroke, and
 * a default that outranked the live capture would fold the group being edited. And
 * the mobile default must NOT reach the desktop sidebar, whose first render folds
 * every section.
 *
 * A scan + one evaluated expression, because tool-inputs.ts cannot be imported
 * outside Vite (it resolves sibling modules with `.js` specifiers, and pulls
 * flatpickr) - the same reason block-row-id.test.ts and multi-edit-crash-guard.test.ts
 * scan rather than mount. The decision itself is a single pure boolean, so the test
 * lifts that expression out and runs the real truth table against it.
 *
 * Run directly:  node --test shells/web/src/views/input-section-fold.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(import.meta.dirname, 'tool-inputs.ts'), 'utf8');
const SHEET_SRC = readFileSync(resolve(import.meta.dirname, '../lib/mobile-sheet.ts'), 'utf8');

/** The real return expression of shouldOpenSection, as a callable. */
const expr = SRC.match(/export function shouldOpenSection[\s\S]*?return ([^;]+);/)?.[1];
assert.ok(expr, 'shouldOpenSection returns one expression this test can exercise');
const decide = new Function('index', 'wasOpen', 'firstRender', 'sheetMode', `return ${expr};`) as
  (index: number, wasOpen: boolean, firstRender: boolean, sheetMode: boolean) => boolean;

test('the phone sheet opens the first section only, and the desktop sidebar none', () => {
  assert.equal(decide(0, false, true, true), true, 'sheet, fresh mount: the first section is open');
  assert.equal(decide(1, false, true, true), false, 'every later section stays folded');
  assert.equal(decide(7, false, true, true), false);
  assert.equal(decide(0, false, true, false), false,
    'desktop is unchanged - its first render folds every section, as it always did');
});

test('a section the user opened stays open, whatever the default says', () => {
  for (const firstRender of [true, false]) {
    for (const sheetMode of [true, false]) {
      assert.equal(decide(3, true, firstRender, sheetMode), true);
    }
  }
});

test('a re-render takes the fold state from the live panel, not the default', () => {
  // firstRender false: the capture of what was open is the only input that matters,
  // so a keystroke can never re-fold the section being typed into.
  assert.equal(decide(0, false, false, true), false);
  assert.equal(decide(0, true, false, true), true);
});

test('the section markup takes its open attribute from shouldOpenSection', () => {
  assert.match(SRC, /shouldOpenSection\(\{[\s\S]{0,160}?index:\s*sectionIndex,[\s\S]{0,80}?wasOpen:\s*openSections\.has\(sec\)/,
    'the <details> builder calls the decision function');
  assert.match(SRC, /<details class="input-section\$\{dense\}"\$\{open \? ' open' : ''\}/,
    'and nothing else decides `open` on an input section');
});

test('sheet mode is the mobile-sheet breakpoint, not a second opinion', () => {
  const mq = SRC.match(/const inSheetMode[\s\S]*?matchMedia\('([^']+)'\)/)?.[1];
  assert.equal(mq, '(max-width: 640px)');
  assert.ok(SHEET_SRC.includes(`'${mq}'`),
    'the same literal lib/mobile-sheet.ts defaults to - the sheet and its fold defaults '
    + 'must appear at the same width');
});

test('scrolling to a control reveals its fold before it scrolls', () => {
  const fn = SRC.slice(SRC.indexOf('function scrollToControl'));
  const reveal = fn.indexOf(`closest('details.input-section')?.setAttribute('open', '')`);
  const scroll = fn.indexOf('scrollIntoView(');
  assert.ok(reveal > 0, 'the shared scroll seam opens the ancestor section');
  assert.ok(reveal < scroll, 'and does it BEFORE scrolling - a folded row has no position yet');
});

// SPDX-License-Identifier: MPL-2.0
/**
 * The resizable columns of `#/rebrand` (plan 275 close-out section 9.1): the two grips
 * the orchestrator places in the review grid, driven by views/rebrand/columns.ts over
 * lib/splitter.ts.
 *
 * This suite runs in jsdom over the real regions (`buildRegions`, `applyLayout`) with
 * the grid's width given by hand: which grips show on each layout and in Keep the
 * design, the keys on each edge inside its limits, the click that widens, the stage
 * floor with the other column giving way first, the widths stored and read back on the
 * next open, the reset, the names and values a screen reader hears, and the fit rule on
 * its own. The layout checks in a real Chromium are in columns.browser.test.ts.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/rebrand/columns.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { idleState, reviewState } from './shared.test-utils.ts';
import type { RbCtx } from './context.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://lolly.test/#/rebrand' });
for (const key of [
  'window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'DOMParser',
  'history', 'location', 'navigator', 'getComputedStyle', 'sessionStorage', 'localStorage',
]) {
  Object.defineProperty(globalThis, key, { value: Reflect.get(dom.window, key), configurable: true, writable: true });
}

// The orchestrator and the module read the globals above when they load.
const { applyLayout, buildRegions } = await import('../rebrand.ts');
const { COLUMNS_KEY, DECIDE_LIMITS, QUEUE_LIMITS, STAGE_MIN_PX, columnsOps, columnsTier, fitColumns, scaledLimits } = await import('./columns.ts');

// ─── jsdom ───────────────────────────────────────────────────────────────────

interface Mounted {
  rb: RbCtx;
  vars: () => { queue: string; decide: string; tier: string | undefined };
  key: (grip: HTMLElement, name: string, shift?: boolean) => void;
  dispose: () => void;
}

/** The real regions with the columns module wired, the grid `width` px wide. */
function mount(opts: { width?: number; narrow?: boolean; medium?: boolean; keep?: boolean; idle?: boolean } = {}): Mounted {
  const view = document.createElement('div');
  document.body.replaceChildren(view);
  const els = buildRegions(view);
  const rb = {} as RbCtx;
  rb.els = els;
  rb.state = opts.idle ? idleState() : reviewState(opts.keep ? { mode: 'keep-design' } : {});
  rb.narrow = opts.narrow === true;
  rb.medium = opts.medium === true;
  rb.reportOpen = false;
  rb.disposers = [];
  applyLayout(rb);
  const width = opts.width ?? 1440;
  els.body.getBoundingClientRect = () => ({ width, height: 700, x: 0, y: 0, top: 0, left: 0, right: width, bottom: 700, toJSON: () => ({}) });
  rb.columns = columnsOps(rb);
  rb.columns.wire();
  rb.columns.render();
  return {
    rb,
    vars: () => ({
      queue: els.body.style.getPropertyValue('--rb-col-queue'),
      decide: els.body.style.getPropertyValue('--rb-col-decide'),
      tier: els.body.dataset.columns,
    }),
    key: (grip, name, shift = false) => {
      grip.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey: shift, bubbles: true, cancelable: true }));
    },
    dispose: () => {
      for (const dispose of rb.disposers.splice(0)) dispose();
    },
  };
}

const now = (grip: HTMLElement): number => Number(grip.getAttribute('aria-valuenow'));

test('on the wide layout both grips show as named separators at the default widths', () => {
  localStorage.clear();
  const m = mount();
  const { queueGrip, decideGrip } = m.rb.els;
  assert.equal(queueGrip.hidden, false);
  assert.equal(decideGrip.hidden, false);
  assert.equal(queueGrip.getAttribute('role'), 'separator');
  assert.equal(queueGrip.getAttribute('aria-orientation'), 'vertical');
  assert.equal(queueGrip.getAttribute('aria-label'), 'Resize the review list');
  assert.equal(decideGrip.getAttribute('aria-label'), 'Resize the side panel');
  assert.equal(queueGrip.classList.contains('resize-grip'), true, 'the shared grip look');
  assert.equal(queueGrip.getAttribute('aria-controls'), m.rb.els.queue.id, 'each grip names the column it resizes');
  assert.equal(decideGrip.getAttribute('aria-controls'), m.rb.els.decide.id);
  assert.ok(m.rb.els.queue.id && m.rb.els.decide.id);
  assert.equal(queueGrip.getAttribute('aria-valuetext'), '272 pixels wide', 'the width in words, not a bare number');
  assert.equal(decideGrip.getAttribute('aria-valuetext'), '320 pixels wide');
  assert.match(queueGrip.title, /click to widen/u, 'the pointer ways are named on hover');
  assert.deepEqual(m.vars(), { queue: '272px', decide: '320px', tier: 'wide' });
  assert.equal(now(queueGrip), 272);
  assert.equal(queueGrip.getAttribute('aria-valuemin'), '220');
  assert.equal(queueGrip.getAttribute('aria-valuemax'), '420');
  assert.equal(now(decideGrip), 320);
  assert.equal(decideGrip.getAttribute('aria-valuemin'), '280');
  assert.equal(decideGrip.getAttribute('aria-valuemax'), '480');
  m.dispose();
});

test('the keys move each edge inside its limits, and aria-valuenow follows', () => {
  localStorage.clear();
  const m = mount();
  const { queueGrip, decideGrip } = m.rb.els;
  m.key(queueGrip, 'ArrowRight');
  assert.equal(now(queueGrip), 288);
  m.key(queueGrip, 'ArrowRight', true);
  assert.equal(now(queueGrip), 352);
  m.key(queueGrip, 'End');
  assert.equal(now(queueGrip), 420);
  m.key(queueGrip, 'ArrowRight');
  assert.equal(now(queueGrip), 420, 'held at 420');
  m.key(queueGrip, 'Home');
  assert.equal(now(queueGrip), 220);
  assert.equal(m.vars().queue, '220px');
  // The decision column is on the right of its grip, so Left widens it.
  m.key(decideGrip, 'ArrowLeft');
  assert.equal(now(decideGrip), 336);
  m.key(decideGrip, 'End');
  assert.equal(now(decideGrip), 480);
  m.key(decideGrip, 'Home');
  assert.equal(now(decideGrip), 280);
  assert.equal(m.vars().decide, '280px');
  m.dispose();
});

test('the stage never goes under 480 px: the other column gives way first, then the edge stops', () => {
  localStorage.clear();
  // 1100 px of grid leaves 620 px for the two columns.
  const m = mount({ width: 1100 });
  const { queueGrip, decideGrip } = m.rb.els;
  assert.equal(queueGrip.getAttribute('aria-valuemax'), String(1100 - STAGE_MIN_PX - DECIDE_LIMITS.min));
  m.key(queueGrip, 'End');
  assert.equal(now(queueGrip), 340, 'the queue stops where the decision column is at its minimum');
  assert.equal(now(decideGrip), 280, 'the decision column gave way to its minimum');
  assert.ok(1100 - now(queueGrip) - now(decideGrip) >= STAGE_MIN_PX);
  m.key(decideGrip, 'End');
  assert.equal(now(decideGrip), 400, 'the decision column may only take what the queue can give');
  assert.equal(now(queueGrip), 220);
  assert.equal(1100 - now(queueGrip) - now(decideGrip), STAGE_MIN_PX);
  m.dispose();
  // At 1440 by 900 there is room for both at their largest.
  localStorage.clear();
  const wide = mount({ width: 1440 });
  wide.key(wide.rb.els.queueGrip, 'End');
  wide.key(wide.rb.els.decideGrip, 'End');
  assert.equal(now(wide.rb.els.queueGrip), 420);
  assert.equal(now(wide.rb.els.decideGrip), 480);
  assert.ok(1440 - 420 - 480 >= STAGE_MIN_PX);
  wide.dispose();
});

test('the widths are stored per viewer and come back on the next open', () => {
  localStorage.clear();
  const first = mount();
  first.key(first.rb.els.queueGrip, 'ArrowRight', true);
  first.key(first.rb.els.decideGrip, 'ArrowLeft', true);
  first.key(first.rb.els.decideGrip, 'ArrowLeft', true);
  assert.deepEqual(JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? '{}'), { queue: 336, decide: 448 });
  first.dispose();
  const again = mount();
  assert.equal(now(again.rb.els.queueGrip), 336);
  assert.equal(now(again.rb.els.decideGrip), 448);
  assert.deepEqual(again.vars(), { queue: '336px', decide: '448px', tier: 'wide' });
  again.dispose();
  // A stored width outside the limits is held inside them.
  localStorage.setItem(COLUMNS_KEY, JSON.stringify({ queue: 9000, decide: 12 }));
  const odd = mount();
  assert.equal(now(odd.rb.els.queueGrip), 420);
  assert.equal(now(odd.rb.els.decideGrip), 280);
  odd.dispose();
  localStorage.clear();
});

test('a double click or Enter restores the default and forgets that column\'s width', () => {
  localStorage.clear();
  const m = mount();
  const { queueGrip, decideGrip } = m.rb.els;
  m.key(queueGrip, 'End');
  m.key(decideGrip, 'End');
  queueGrip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  assert.equal(now(queueGrip), QUEUE_LIMITS.initial);
  assert.equal(now(decideGrip), 480, 'the other column keeps its width');
  assert.deepEqual(JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? '{}'), { decide: 480 });
  m.key(decideGrip, 'Enter');
  assert.equal(now(decideGrip), DECIDE_LIMITS.initial);
  assert.equal(localStorage.getItem(COLUMNS_KEY), null);
  m.dispose();
});

test('no grip on the narrow layout, in Keep the design, or on the medium layout under a coarse pointer', () => {
  localStorage.clear();
  const narrow = mount({ width: 390, narrow: true });
  assert.equal(narrow.rb.els.queueGrip.hidden, true);
  assert.equal(narrow.rb.els.decideGrip.hidden, true);
  assert.deepEqual(narrow.vars(), { queue: '', decide: '', tier: undefined }, 'rebrand.css lays the narrow body out');
  narrow.dispose();

  const keep = mount({ keep: true });
  assert.equal(keep.rb.els.queueGrip.hidden, true);
  assert.equal(keep.rb.els.decideGrip.hidden, true);
  assert.equal(keep.vars().tier, undefined);
  keep.dispose();

  const medium = mount({ width: 1000, medium: true });
  assert.equal(medium.rb.els.queueGrip.hidden, true, 'the queue is the chip row on the medium layout');
  assert.equal(medium.rb.els.decideGrip.hidden, false);
  assert.deepEqual(medium.vars(), { queue: '', decide: '320px', tier: 'medium' });
  medium.key(medium.rb.els.decideGrip, 'End');
  assert.equal(now(medium.rb.els.decideGrip), 480, 'with no queue column, 1000 px leaves room for 480');
  medium.dispose();

  const base = { narrow: false, medium: true, state: reviewState() };
  assert.equal(columnsTier(base, true), null, 'the column is a sheet under a coarse pointer');
  assert.equal(columnsTier(base, false), 'medium');
  assert.equal(columnsTier({ ...base, medium: false }, true), 'wide', 'a wide touch screen keeps its grips');
  assert.equal(columnsTier({ ...base, narrow: true }, false), null);
  localStorage.clear();
});

test('a layout change hides the grips and hands the grid back to rebrand.css', () => {
  localStorage.clear();
  const m = mount();
  assert.equal(m.vars().tier, 'wide');
  m.rb.narrow = true;
  m.rb.columns.render();
  assert.equal(m.rb.els.queueGrip.hidden, true);
  assert.deepEqual(m.vars(), { queue: '', decide: '', tier: undefined });
  m.rb.narrow = false;
  m.rb.columns.render();
  assert.deepEqual(m.vars(), { queue: '272px', decide: '320px', tier: 'wide' });
  m.dispose();
});

test('the fit rule: the moved column wins, and with nothing moving the decision column gives way first', () => {
  const base = { tier: 'wide' as const, factor: 1, prefs: { queue: 400, decide: 460 } };
  assert.deepEqual(fitColumns({ ...base, width: 1440 }), { queue: 400, decide: 460 });
  // 1200 px leaves 720 for both.
  assert.deepEqual(fitColumns({ ...base, width: 1200 }), { queue: 400, decide: 320 });
  assert.deepEqual(fitColumns({ ...base, width: 1200, moving: { column: 'decide', want: 460 } }), { queue: 260, decide: 460 });
  assert.deepEqual(fitColumns({ ...base, width: 1000 }), { queue: 240, decide: 280 }, 'both at their floors leaves the rest to the queue');
  assert.deepEqual(fitColumns({ ...base, width: 0 }), { queue: 400, decide: 460 }, 'no stage rule before the first measure');
  assert.deepEqual(fitColumns({ tier: 'medium', width: 900, factor: 1, prefs: { queue: 400, decide: 480 } }), { queue: 0, decide: 420 });
  assert.deepEqual(scaledLimits(QUEUE_LIMITS, 1.2), { min: 264, max: 504, initial: 326 }, 'the limits follow the large-text multiplier');
  assert.deepEqual(scaledLimits(DECIDE_LIMITS, Number.NaN), DECIDE_LIMITS);
});

test('the sheet draws the grips with the shared grip recipe and never reaches Keep the design or the narrow body', () => {
  const css = readFileSync(new URL('../../styles/parts/rebrand-columns.css', import.meta.url), 'utf8');
  const tool = readFileSync(new URL('../../styles/parts/tool.css', import.meta.url), 'utf8');
  for (const decl of ['cursor: col-resize', 'touch-action: none', 'width: 4px', 'height: 44px', 'opacity: 0']) {
    assert.ok(tool.includes(decl), `tool.css .resize-grip still has ${decl}`);
    assert.ok(css.includes(decl), `the rebrand grip has ${decl}`);
  }
  // The pill sits on the column line, not centred in the strip, so it undoes the shared
  // grip's centring transform with a rule that outweighs it.
  assert.match(css, /\.rb-body > \.rb-grip::before \{[^}]*transform: none;/);
  assert.match(css, /\.rb-grip \{[^}]*--rb-grip-w: calc\(24px \* var\(--a11y-fs\)\);/, 'the strip is the 24 px target floor');
  assert.match(css, /@media \(any-pointer: coarse\) \{\s*\.rb-grip \{ --rb-grip-w: var\(--ui-size-target\);/, 'and the touch target under a coarse pointer');
  const gridRules = [...css.matchAll(/^ {2}([^\n{]*data-columns[^\n{]*)\{/gm)].map((m) => m[1] ?? '');
  assert.ok(gridRules.length >= 8);
  for (const selector of gridRules) {
    assert.ok(selector.startsWith('.rb:not([data-mode="keep-design"]):not([data-narrow="true"]) > .rb-body'), selector);
  }
  assert.match(css, /\.rb\[data-mode="keep-design"\] \.rb-grip,\n {2}\.rb\[data-narrow="true"\] \.rb-grip \{ display: none; \}/);
  assert.match(css, /html\[data-a11y-motion="reduce"\] \.rb-body > \.rb-grip::before \{ transition: none; \}/);
});

test('a click on a grip widens its column a step, and at the widest goes back to the narrowest', async () => {
  localStorage.clear();
  const m = mount();
  const { queueGrip } = m.rb.els;
  const click = (): void => {
    for (const type of ['pointerdown', 'pointerup']) {
      const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 300, button: 0, buttons: type === 'pointerdown' ? 1 : 0 });
      Object.defineProperty(ev, 'pointerId', { value: 1 });
      queueGrip.dispatchEvent(ev);
    }
  };
  const settle = () => new Promise((r) => setTimeout(r, 340));
  click();
  await settle();
  assert.equal(now(queueGrip), 336);
  assert.equal(queueGrip.getAttribute('aria-valuetext'), '336 pixels wide');
  click();
  await settle();
  click();
  await settle();
  assert.equal(now(queueGrip), 420);
  click();
  await settle();
  assert.equal(now(queueGrip), 220, 'the widest goes back to the narrowest');
  assert.deepEqual(JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? '{}'), { queue: 220, decide: 320 });
  m.dispose();
  localStorage.clear();
});

test('an arrow chord on a grip never reaches the view\'s own keys', () => {
  localStorage.clear();
  const m = mount();
  const heard: string[] = [];
  const onDoc = (e: KeyboardEvent): void => void heard.push(e.key);
  document.addEventListener('keydown', onDoc);
  try {
    m.rb.els.queueGrip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true }));
    m.key(m.rb.els.queueGrip, 'ArrowRight');
    assert.deepEqual(heard, [], 'neither Alt+Right (the slide move) nor the resize key goes on to the view');
    assert.equal(now(m.rb.els.queueGrip), 288);
  } finally {
    document.removeEventListener('keydown', onDoc);
    m.dispose();
  }
});

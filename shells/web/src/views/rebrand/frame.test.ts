// SPDX-License-Identifier: MPL-2.0
/**
 * The `#/rebrand` frame the orchestrator builds (plan 274 section 4, plan 275 close-out
 * section 2): the regions, which of them show in each phase and mode, and the order the
 * region stylesheets load in.
 *
 * Each region's own cases are in its suite: intake.test.ts, top-foot.test.ts,
 * report.test.ts, queue.test.ts, compare.test.ts, decide.test.ts, strip.test.ts,
 * keep.test.ts and theme.test.ts, over the harnesses in shared.test-utils.ts.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/rebrand/frame.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { idleState, reviewState } from './shared.test-utils.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://lolly.test/#/rebrand' });
for (const key of [
  'window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'DOMParser', 'history', 'location', 'navigator',
  'getComputedStyle', 'sessionStorage', 'localStorage',
]) {
  Object.defineProperty(globalThis, key, {
    value: Reflect.get(dom.window, key),
    configurable: true,
    writable: true,
  });
}

// The orchestrator reads the globals above when it loads, so it loads after them.
const { applyLayout, buildRegions } = await import('../rebrand.ts');

const PARTS = new URL('../../styles/parts/', import.meta.url);
const ORCHESTRATOR = new URL('../rebrand.ts', import.meta.url);

function regions() {
  const view = document.createElement('div');
  document.body.replaceChildren(view);
  return { view, els: buildRegions(view) };
}

test('the regions are five rows, with the filmstrip a row of its own under the review grid', () => {
  const { els } = regions();
  const rows = [...els.root.children].map((el) => el.className.split(' ')[0]);
  assert.deepEqual(rows, ['rb-top', 'rb-alert', 'rb-intake', 'rb-body', 'rb-strip', 'rb-foot', 'rb-scrim', 'rb-report', 'rb-status']);
  assert.equal(els.strip.parentElement, els.root, 'the filmstrip is a sibling of the review grid, not part of the work area');
  assert.equal(els.strip.tagName, 'NAV');
  assert.equal(els.strip.getAttribute('aria-label'), 'Slides');
  const body = [...els.body.children].map((el) => el.className);
  assert.deepEqual(body, ['rb-queue', 'rb-grip', 'rb-work', 'rb-grip', 'rb-decide']);
  assert.equal(els.compare.parentElement?.classList.contains('rb-work'), true);
  assert.equal(els.compare.parentElement?.children.length, 1, 'the work area holds the comparison alone');
  assert.equal(els.root.querySelector('.rb-keep'), null, 'Keep the design has no region of its own');
});

test('the two grips sit between the columns and start hidden, for the columns module to fill', () => {
  const { els } = regions();
  assert.equal(els.queueGrip.dataset.grip, 'queue');
  assert.equal(els.decideGrip.dataset.grip, 'decide');
  assert.equal(els.queueGrip.previousElementSibling, els.queue);
  assert.equal(els.queueGrip.nextElementSibling?.classList.contains('rb-work'), true);
  assert.equal(els.decideGrip.nextElementSibling, els.decide);
  assert.equal(els.queueGrip.hidden, true);
  assert.equal(els.decideGrip.hidden, true);
});

test('each phase and mode shows its regions: the review with its strip and footer, Keep the design with its strip', () => {
  const { els } = regions();
  const layout = (state: ReturnType<typeof idleState>) => {
    applyLayout({ els, state, narrow: false, medium: false, reportOpen: false });
    return {
      intake: !els.intake.hidden,
      body: !els.body.hidden,
      strip: !els.strip.hidden,
      foot: !els.foot.hidden,
      mode: els.root.dataset.mode,
    };
  };
  assert.deepEqual(layout(idleState()), { intake: true, body: false, strip: false, foot: false, mode: 'renovate' });
  assert.deepEqual(layout(reviewState()), { intake: false, body: true, strip: true, foot: true, mode: 'renovate' });
  // Keep the design draws into the comparison region, so the review grid shows once its source is read,
  // and the filmstrip picks the slide its stage shows (close-out CP10). The footer has no Keep form yet.
  assert.deepEqual(layout(reviewState({ mode: 'keep-design' })), { intake: false, body: true, strip: true, foot: false, mode: 'keep-design' });
  assert.deepEqual(layout({ ...idleState(), mode: 'keep-design' }), { intake: true, body: false, strip: false, foot: false, mode: 'keep-design' });
});

test('the orchestrator loads every rebrand sheet once, in the cascade order rebrand.css states', () => {
  const orchestrator = readFileSync(ORCHESTRATOR, 'utf8');
  const imported = [...orchestrator.matchAll(/^import '\.\.\/styles\/parts\/(rebrand[a-z-]*\.css)';$/gm)].map((m) => m[1]);
  const onDisk = readdirSync(PARTS).filter((name) => /^rebrand(?:-[a-z]+)?\.css$/.test(name)).sort();
  assert.deepEqual([...imported].sort(), onDisk, 'every rebrand sheet, and none twice');
  const grid = readFileSync(new URL('rebrand.css', PARTS), 'utf8');
  const stated = [...grid.matchAll(/^ {5}(rebrand[a-z-]*\.css) /gm)].map((m) => m[1]);
  assert.deepEqual(imported, stated, 'the imports follow the order written at the top of rebrand.css');
  assert.match(grid, /grid-template-rows: auto auto minmax\(0, 1fr\) auto auto;/, 'five rows');
  assert.match(grid, /\.rb-strip \{ grid-row: 4; \}/);
  assert.match(grid, /\.rb-foot \{ grid-row: 5; \}/);
});

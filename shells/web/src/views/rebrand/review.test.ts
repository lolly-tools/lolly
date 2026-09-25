// SPDX-License-Identifier: MPL-2.0
/**
 * The #/rebrand review surface across its regions (plan 274 section 4): what the
 * queue, the footer and Open in Design count together, and the keys that act on the
 * whole view. Each region's own cases are in its suite: queue.test.ts,
 * compare.test.ts, decide.test.ts and strip.test.ts.
 *
 * The state is the real pipeline over tests/fixtures/rebrand/adversarial.pptx, and the
 * controller a stub that records each command and answers ok (`reviewHarness` in
 * shared.test-utils.ts), so what these tests pin is which command a control sends and
 * with what, never what the controller does with it.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/rebrand/review.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { reviewHarness } from './shared.test-utils.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const key of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Element', 'Node', 'Event',
  'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'DOMParser', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
]) {
  Reflect.set(globalThis, key, Reflect.get(dom.window, key));
}

const { RUN, stateFrom, mount, settle, keydown, toReviewCount } = await reviewHarness();

test('Mod+Z undoes and Shift+Mod+Z redoes, never from a text field', async () => {
  const { rb, calls, unmount } = mount(stateFrom());
  keydown('z', { ctrlKey: true });
  await settle();
  assert.equal(calls.at(-1)?.name, 'undo');
  keydown('z', { metaKey: true, shiftKey: true });
  await settle();
  assert.equal(calls.at(-1)?.name, 'redo');
  const before = calls.length;
  const field = document.createElement('input');
  rb.els.decide.append(field);
  field.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  await settle();
  assert.equal(calls.length, before, 'a text field keeps its own undo');
  unmount();
});

test('To review, the footer and Open in Design count the same thing: a left-out slide or a locked card is not waiting', () => {
  // Every row answered but those on one slide, which is then left out.
  const plan = structuredClone(RUN.plan);
  const [kept, ...rest] = plan.slides;
  assert.ok(kept);
  for (const slide of rest) {
    for (const row of slide.objects) {
      row.decision = row.proposal;
      row.author = 'user';
      row.review = 'accepted';
    }
  }
  kept.include = false;
  delete kept.order;
  // A compile that placed every object, so the list has no Not placed card either.
  const { rb, unmount } = mount(stateFrom(plan, { preview: { deck: { ...RUN.compiled, tray: [] }, planRevision: plan.revision } }));
  assert.equal(rb.derived?.pendingIds.length, 0, 'Open in Design waits on nothing');
  assert.equal(toReviewCount(rb), 0, 'so nothing is left to review');
  assert.equal(rb.els.queue.querySelector('[data-tab="attention"] .rb-q-count')?.textContent, '0');
  assert.equal(rb.els.queue.querySelectorAll('.rb-q-item[data-item]').length, 0);
  assert.match(rb.els.queue.textContent ?? '', /Nothing to review\./);
  unmount();
});

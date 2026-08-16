// SPDX-License-Identifier: MPL-2.0
/**
 * The shell's slider (shells/web/src/components/custom-slider.ts) - the markup
 * contract, and the part that carries real risk: the two-way binding between an
 * upgraded `.field-range` input and the slider mounted beside it.
 *
 * Every chrome slider in the app is now that pair, and ~20 surfaces still talk to
 * the INPUT - reading `.value`, listening for 'input'/'change', pushing state back
 * in by assignment. So what is pinned here is that contract: the input keeps the
 * value, the events a native range would have fired still fire, and an assignment
 * from outside reaches the slider.
 *
 * jsdom, so there is no layout: the pointer path (which needs a track width) is
 * covered by driving the app in a real browser. The keyboard path needs no layout
 * and is exercised here, which reaches the same value/relay code.
 *
 * Run with: node --test tests/custom-slider.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

// The module reads `HTMLInputElement.prototype`'s value accessor at import time
// (that is how it forwards to the real setter), so the DOM globals have to exist
// before the import - hence the dynamic import below.
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const w = dom.window as unknown as Record<string, unknown> & {
  document: Document;
  KeyboardEvent: typeof KeyboardEvent;
  Event: typeof Event;
};
for (const k of ['document', 'HTMLInputElement', 'HTMLElement', 'Element', 'Event', 'CustomEvent', 'Node', 'MutationObserver', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = w[k];
}
(globalThis as Record<string, unknown>).requestAnimationFrame ??= (fn: (t: number) => void) => setTimeout(() => fn(0), 0) as unknown as number;
(globalThis as Record<string, unknown>).cancelAnimationFrame ??= (id: number) => clearTimeout(id);
(globalThis as Record<string, unknown>).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const {
  customSliderHtml, mountCustomSlider, upgradeRangeInput, upgradeRanges, SLIDER_DRAG_EVENT,
} = await import('../shells/web/src/components/custom-slider.ts');

const doc = w.document;

/** A row holding one `.field-range`, as a chrome surface would render it. */
function rangeRow(attrs = 'min="0" max="1" step="0.05" value="0.5" aria-label="Music volume"'): HTMLInputElement {
  const host = doc.createElement('div');
  host.innerHTML = `<label><span>Music</span><input type="range" class="field-range" ${attrs}></label>`;
  doc.body.appendChild(host);
  return host.querySelector('input') as HTMLInputElement;
}

// ── markup ────────────────────────────────────────────────────────────────────

test('customSliderHtml: fill/thumb and ARIA agree, and the value is clamped into range', () => {
  const el = doc.createElement('div');
  el.innerHTML = customSliderHtml({ min: 10, max: 20, step: 1, value: 99, label: 'Size', unit: 'px' });
  const cs = el.firstElementChild as HTMLElement;
  assert.equal(cs.getAttribute('aria-valuenow'), '20');          // clamped, not past the track
  assert.equal(cs.getAttribute('aria-valuetext'), '20 px');      // unit spoken
  assert.equal(cs.getAttribute('role'), 'slider');
  assert.equal(cs.querySelector<HTMLElement>('.cs-fill')!.style.width, '100%');
  assert.equal(cs.querySelector<HTMLElement>('.cs-thumb')!.style.left, '100%');
  assert.equal(cs.dataset.step, '1');
});

test('customSliderHtml: ticks appear for a countable range, never when opted out', () => {
  const ticks = (spec: Parameters<typeof customSliderHtml>[0]) => {
    const el = doc.createElement('div');
    el.innerHTML = customSliderHtml(spec);
    return el.querySelectorAll('.cs-tick').length;
  };
  assert.equal(ticks({ min: 0, max: 10, step: 1, value: 5 }), 11);       // 10 stops + both ends
  assert.equal(ticks({ min: 0, max: 1000, step: 1, value: 5 }), 0);      // too many to read as detents
  assert.equal(ticks({ min: 0, max: 10, step: 1, value: 5, ticks: false }), 0);
});

// ── the mounted control ───────────────────────────────────────────────────────

test('keyboard stepping snaps, clamps, and reports through onCommit', () => {
  const el = doc.createElement('div');
  el.innerHTML = customSliderHtml({ min: 0, max: 1, step: 0.25, value: 0.5 });
  const cs = el.firstElementChild as HTMLElement;
  doc.body.appendChild(cs);
  const commits: number[] = [];
  mountCustomSlider(cs, { onCommit: (v) => commits.push(v) });

  const key = (k: string) => cs.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  key('ArrowRight');
  key('ArrowRight');
  key('ArrowRight');                      // already at max - no third commit
  assert.deepEqual(commits, [0.75, 1]);
  assert.equal(cs.getAttribute('aria-valuenow'), '1');

  key('Home');
  assert.equal(cs.getAttribute('aria-valuenow'), '0');
  key('ArrowDown');                       // clamped at min - nothing to report
  assert.deepEqual(commits, [0.75, 1, 0]);
  key('PageUp');                          // ten steps, but max is two away
  assert.equal(cs.getAttribute('aria-valuenow'), '1');
});

// ── the upgraded `.field-range` pair ──────────────────────────────────────────

test('upgrade: a slider joins the input, which keeps the value and leaves the a11y tree', () => {
  const input = rangeRow();
  upgradeRangeInput(input);
  const cs = input.nextElementSibling as HTMLElement;
  assert.ok(cs.classList.contains('custom-slider'));
  assert.equal(cs.getAttribute('aria-label'), 'Music volume');   // the name moved with it…
  assert.equal(input.getAttribute('aria-hidden'), 'true');       // …and isn't announced twice
  assert.equal(input.tabIndex, -1);
  assert.ok(input.classList.contains('is-upgraded'));            // hidden by fields.css
  assert.equal(input.value, '0.5');                              // still the value carrier
  assert.equal(cs.querySelectorAll('.cs-tick').length, 0);       // a volume row isn't hatched

  upgradeRangeInput(input);                                      // idempotent
  assert.equal(input.parentElement!.querySelectorAll('.custom-slider').length, 1);
});

test('upgrade: a range with no usable bounds is left alone', () => {
  const input = rangeRow('min="5" max="5" value="5"');
  upgradeRangeInput(input);
  assert.equal(input.nextElementSibling, null);
  assert.equal(input.classList.contains('is-upgraded'), false);
});

test('slider → input: the input carries the value and fires what a native range would', () => {
  const input = rangeRow();
  upgradeRangeInput(input);
  const cs = input.nextElementSibling as HTMLElement;
  const seen: string[] = [];
  input.addEventListener('input', () => seen.push(`input:${input.value}`));
  input.addEventListener('change', () => seen.push(`change:${input.value}`));

  cs.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  assert.equal(input.value, '0.55');
  // Both events, once each: a keyboard step on a native range fires input then change.
  assert.deepEqual(seen, ['input:0.55', 'change:0.55']);

  cs.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  assert.equal(input.value, '1');
  assert.deepEqual(seen.slice(-2), ['input:1', 'change:1']);
});

test('input → slider: an assignment from a surface moves the slider, snapped', () => {
  const input = rangeRow();
  upgradeRangeInput(input);
  const cs = input.nextElementSibling as HTMLElement;

  input.value = '0.8';                                    // what a player restoring state does
  assert.equal(cs.getAttribute('aria-valuenow'), '0.8');
  assert.equal(cs.querySelector<HTMLElement>('.cs-fill')!.style.width, '80%');

  input.value = '5';                                      // the input clamps; the slider follows it
  assert.equal(input.value, '1');
  assert.equal(cs.getAttribute('aria-valuenow'), '1');
});

test('input → slider: a mirrored write does not echo back as an event', () => {
  const input = rangeRow();
  upgradeRangeInput(input);
  const cs = input.nextElementSibling as HTMLElement;
  let events = 0;
  input.addEventListener('input', () => { events++; });
  input.value = '0.3';                                    // a silent push-in stays silent…
  assert.equal(events, 0);
  assert.equal(cs.getAttribute('aria-valuenow'), '0.3');  // …but still lands
});

test('the drag is announced on the input, for surfaces that rebuild on input', () => {
  const input = rangeRow();
  upgradeRangeInput(input);
  const cs = input.nextElementSibling as HTMLElement;
  const drags: boolean[] = [];
  // The tool sidebar listens for exactly this to hold its panel steady mid-drag.
  input.addEventListener(SLIDER_DRAG_EVENT, (e) => drags.push((e as CustomEvent<{ dragging: boolean }>).detail.dragging));

  // jsdom has no PointerEvent and no layout; the pointer id and clientX are all
  // the handler reads, and a zero-width track makes it a no-op on the value.
  (cs as unknown as { setPointerCapture(id: number): void }).setPointerCapture = () => {};
  const pointer = (type: string) => {
    const e = new w.Event(type, { bubbles: true, cancelable: true }) as Event & { pointerId: number; clientX: number };
    e.pointerId = 1; e.clientX = 0;
    cs.dispatchEvent(e);
  };
  pointer('pointerdown');
  assert.deepEqual(drags, [true]);
  assert.equal(input.value, '0.5');                      // no layout, so no value moved
  pointer('pointerup');
  assert.deepEqual(drags, [true, false]);
});

test('upgradeRanges walks a subtree, and takes an input directly', () => {
  const host = doc.createElement('div');
  host.innerHTML = `
    <input type="range" class="field-range" min="0" max="10" value="1" aria-label="a">
    <div><input type="range" class="field-range" min="0" max="10" value="2" aria-label="b"></div>
    <input type="range" min="0" max="10" value="3" aria-label="unclaimed">`;
  doc.body.appendChild(host);
  upgradeRanges(host);
  assert.equal(host.querySelectorAll('.custom-slider').length, 2);   // only the two .field-range
  assert.equal(host.querySelectorAll('input.is-upgraded').length, 2);

  const lone = rangeRow();
  upgradeRanges(lone);
  assert.ok(lone.nextElementSibling?.classList.contains('custom-slider'));
});

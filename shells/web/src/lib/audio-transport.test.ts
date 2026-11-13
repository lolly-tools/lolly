// SPDX-License-Identifier: MPL-2.0
/**
 * formatTime is the transport's pure part, and what is worth pinning there is the
 * behaviour that caused an actual bug: a non-finite duration. The element wiring is
 * verified in a real browser, except for a position source (a generated tune, which
 * seeks by bar), whose rules are pinned here against jsdom.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { audioTransportHtml, formatTime, wireAudioTransport, type TransportSource } from './audio-transport.ts';

test('formatTime renders m:ss with a zero-padded seconds field', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(5), '0:05');
  assert.equal(formatTime(59), '0:59');
  assert.equal(formatTime(60), '1:00');
  assert.equal(formatTime(95), '1:35');
  assert.equal(formatTime(3599), '59:59');
});

test('formatTime truncates rather than rounding, so the clock never shows a time the track has not reached', () => {
  assert.equal(formatTime(9.9), '0:09');
  assert.equal(formatTime(59.99), '0:59');
});

test('a minute count past an hour keeps counting rather than wrapping', () => {
  // No h:mm:ss form on purpose - the catalog previews are loops and clips. Wrapping to
  // 0:00 at an hour would be a silent lie; 60:00 is merely unusual.
  assert.equal(formatTime(3600), '60:00');
});

test('non-finite and negative times render as unknown, never as 0:00', () => {
  // Infinity is the REAL case: a source served without range support reports it for
  // duration, and showing "0:00" there would claim a zero-length track.
  assert.equal(formatTime(Number.POSITIVE_INFINITY), '--:--');
  assert.equal(formatTime(Number.NaN), '--:--');
  assert.equal(formatTime(-1), '--:--');
});

// ── a position source: a generated tune of twenty two-second bars ─────────────────
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.document = dom.window.document;

function tuneTransport() {
  const doc = dom.window.document;
  const root = doc.createElement('div');
  root.innerHTML = audioTransportHtml();
  doc.body.appendChild(root);
  const audioEl = doc.createElement('audio');
  let at = 5;
  const seeks: number[] = [];
  const listeners = new Set<() => void>();
  const points = Array.from({ length: 20 }, (_, i) => i * 2);
  const bar = (s: number): number => Math.floor(s / 2) + 1;
  const source: TransportSource = {
    position: () => ({ seconds: at, duration: 40 }),
    seek: (s) => { seeks.push(s); at = s; },
    grid: () => ({ points, marks: [8, 24] }),
    describe: (s) => ({ label: `Bar ${bar(s)} of 20`, spoken: `Bar ${bar(s)} of 20, ${s} seconds` }),
    onChange: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
  const tp = wireAudioTransport(root, audioEl, {}, source);
  const seek = root.querySelector<HTMLElement>('[data-tp-seek]')!;
  seek.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 4, width: 200, height: 4, x: 0, y: 0, toJSON: () => ({}) });
  seek.setPointerCapture = () => {};
  seek.releasePointerCapture = () => {};
  const key = (k: string): boolean => {
    const e = new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    seek.dispatchEvent(e);
    return e.defaultPrevented;
  };
  const pointer = (type: string, clientX: number): void => {
    seek.dispatchEvent(new dom.window.MouseEvent(type, { clientX, button: 0, bubbles: true }));
  };
  const text = (sel: string): string => root.querySelector(sel)?.textContent ?? '';
  return { root, tp, seek, seeks, key, pointer, text, listeners, setAt: (s: number) => { at = s; } };
}

test('a tune shows where it is: the time, the bar and part above the bar, and a tick where each part starts', () => {
  const { root, seek, text } = tuneTransport();
  assert.equal(text('[data-tp-time]'), '0:05 / 0:40');
  assert.equal(text('[data-tp-pos]'), 'Bar 3 of 20');
  assert.equal(root.querySelector<HTMLElement>('[data-tp-pos]')!.hidden, false);
  assert.equal(seek.getAttribute('aria-valuetext'), 'Bar 3 of 20, 5 seconds', 'what a screen reader hears');
  assert.equal(seek.getAttribute('aria-disabled'), 'false');
  assert.deepEqual([...root.querySelectorAll<HTMLElement>('.cat-tp-mark')].map((m) => m.style.left), ['20%', '60%']);
  assert.equal(root.querySelector<HTMLElement>('[data-tp-fill]')!.style.width, '12.5%');
});

test('the keys step a tune a bar at a time, a part with Page Up and Page Down, and to its ends', () => {
  const { root, seeks, key, setAt } = tuneTransport();
  // The asset sheet turns pages on the arrows: a key the slider used must not reach the sheet.
  let reached = 0;
  root.addEventListener('keydown', () => { reached++; });
  assert.equal(key('ArrowRight'), true);
  assert.equal(reached, 0, 'the arrow stays with the slider');
  assert.deepEqual(seeks, [6], 'from 5 s, in the bar at 4 s, on to the next bar');
  setAt(6.5);
  key('ArrowLeft');
  assert.equal(seeks.at(-1), 4);
  key('End');
  assert.equal(seeks.at(-1), 38, 'the last bar');
  key('Home');
  assert.equal(seeks.at(-1), 0);
  key('PageUp');
  assert.equal(seeks.at(-1), 8, 'the next part');
  assert.equal(key('x'), false, 'any other key is left alone');
});

test('a drag over a tune snaps to the nearest bar and seeks once, when it lets go', () => {
  const { seeks, pointer, text } = tuneTransport();
  pointer('pointerdown', 33);    // 6.6 s: the bar at 6 s
  assert.deepEqual(seeks, [], 'nothing restarts while the pointer is down');
  assert.equal(text('[data-tp-pos]'), 'Bar 4 of 20', 'the caption shows where it will land');
  assert.equal(text('[data-tp-time]'), '0:06 / 0:40');
  pointer('pointermove', 101);   // 20.2 s
  pointer('pointerup', 101);
  assert.deepEqual(seeks, [20]);
  pointer('pointerdown', 150);
  pointer('pointercancel', 150);
  assert.deepEqual(seeks, [20], 'a cancelled drag does not seek');
});

test('the transport repaints when the tune moves by itself, and lets go of the tune when destroyed', () => {
  const { tp, text, listeners, setAt } = tuneTransport();
  setAt(31);
  for (const l of listeners) l();
  assert.equal(text('[data-tp-pos]'), 'Bar 16 of 20');
  tp.destroy();
  assert.equal(listeners.size, 0);
});

test('a recorded file keeps the element\'s own clock, with no caption and no ticks', () => {
  const doc = dom.window.document;
  const root = doc.createElement('div');
  root.innerHTML = audioTransportHtml();
  wireAudioTransport(root, doc.createElement('audio'));
  assert.equal(root.querySelector<HTMLElement>('[data-tp-pos]')!.hidden, true);
  assert.equal(root.querySelectorAll('.cat-tp-mark').length, 0);
  assert.equal(root.querySelector('[data-tp-seek]')!.getAttribute('aria-disabled'), 'true', 'no length yet, so no seeking');
});

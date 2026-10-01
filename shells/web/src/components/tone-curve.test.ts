// SPDX-License-Identifier: MPL-2.0
/**
 * tone-curve tests - the curve plot beside a `display: "curve"` text input,
 * driven through its real DOM under jsdom.
 *
 * What is pinned is the contract with the field it edits:
 *   - mounting writes nothing;
 *   - a gesture is one `input` event on the field carrying the canonical wire
 *     text, and a gesture that ends where it began is none;
 *   - typing in the field redraws the plot, and change rewrites the text in its
 *     canonical form;
 *   - the first and last of the last two points cannot be removed, and a point
 *     cannot pass its neighbours.
 *
 * jsdom reports a zero rect for every element, and the plot then maps one client
 * pixel to one SVG unit, so pointer events here are given in SVG units: the square
 * starts at (10, 10) and level (x, y) sits at client (10 + x, 10 + 255 - y).
 *
 * Run directly:  node --test shells/web/src/components/tone-curve.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const { mountToneCurve } = await import('./tone-curve.ts');

function rig(value = '') {
  const d = dom.window.document;
  const wrap = d.createElement('div');
  const slot = d.createElement('div');
  const field = d.createElement('input');
  field.value = value;
  wrap.append(slot, field);
  d.body.appendChild(wrap);
  const writes: string[] = [];
  field.addEventListener('input', () => writes.push(field.value));
  const curve = mountToneCurve(slot as unknown as HTMLElement, field as unknown as HTMLInputElement, 'RGB curve');
  const svg = slot.querySelector('svg')!;
  const at = (x: number, y: number) => ({ clientX: 10 + x, clientY: 10 + 255 - y, button: 0, bubbles: true });
  const pointer = (type: string, target: Element, x: number, y: number) =>
    target.dispatchEvent(new dom.window.MouseEvent(type, at(x, y)));
  const point = (i: number) => slot.querySelectorAll('.tone-curve-point')[i]!;
  const key = (target: Element, type: 'keydown' | 'keyup', k: string, shiftKey = false) =>
    target.dispatchEvent(new dom.window.KeyboardEvent(type, { key: k, shiftKey, bubbles: true }));
  return { curve, field, svg, slot, writes, pointer, point, key, done: () => wrap.remove() };
}

test('mounting draws the field\'s curve and writes nothing', () => {
  const r = rig('0-0_64-48_192-208_255-255');
  assert.equal(r.writes.length, 0);
  assert.equal(r.slot.querySelectorAll('.tone-curve-point').length, 4);
  assert.deepEqual(r.curve.points(), [[0, 0], [64, 48], [192, 208], [255, 255]]);
  assert.equal(r.svg.getAttribute('aria-label'), 'RGB curve');
  r.done();
});

test('an empty field is the straight line, and Reset is hidden until the curve bends', () => {
  const r = rig('');
  assert.deepEqual(r.curve.points(), [[0, 0], [255, 255]]);
  assert.equal((r.slot.querySelector('.tone-curve-reset') as HTMLButtonElement).hidden, true);
  r.done();
});

test('clicking in the square adds a point there; the release is one canonical write', () => {
  const r = rig('');
  r.pointer('pointerdown', r.svg, 128, 180);
  r.pointer('pointermove', r.svg, 130, 190);
  assert.equal(r.writes.length, 0, 'nothing while dragging');
  r.pointer('pointerup', r.svg, 130, 190);
  assert.deepEqual(r.writes, ['0-0_130-190_255-255']);
  assert.equal(r.field.value, '0-0_130-190_255-255');
  assert.equal((r.slot.querySelector('.tone-curve-reset') as HTMLButtonElement).hidden, false);
  r.done();
});

test('a point cannot pass its neighbours', () => {
  const r = rig('0-0_64-48_192-208_255-255');
  r.pointer('pointerdown', r.point(1), 64, 48);
  r.pointer('pointermove', r.svg, 230, 100);
  r.pointer('pointerup', r.svg, 230, 100);
  assert.deepEqual(r.curve.points()[1], [191, 100]);
  r.done();
});

test('dragging a point well off the square removes it; the last two points stay', () => {
  const r = rig('0-0_64-48_255-255');
  r.pointer('pointerdown', r.point(1), 64, 48);
  r.pointer('pointermove', r.svg, 64, -80);
  assert.ok(r.point(1).classList.contains('is-removing'));
  r.pointer('pointerup', r.svg, 64, -80);
  assert.deepEqual(r.writes, ['']);
  r.pointer('pointerdown', r.point(0), 0, 0);
  r.pointer('pointermove', r.svg, -90, -90);
  r.pointer('pointerup', r.svg, -90, -90);
  assert.equal(r.curve.points().length, 2, 'two points always remain');
  r.done();
});

test('a drag that ends where it began writes nothing', () => {
  const r = rig('0-0_64-48_255-255');
  r.pointer('pointerdown', r.point(1), 64, 48);
  r.pointer('pointermove', r.svg, 80, 60);
  r.pointer('pointermove', r.svg, 64, 48);
  r.pointer('pointerup', r.svg, 64, 48);
  assert.equal(r.writes.length, 0);
  r.done();
});

test('arrow keys move the focused point; a held key is one write, on keyup', () => {
  const r = rig('0-0_64-48_255-255');
  const p = r.point(1);
  r.key(p, 'keydown', 'ArrowUp');
  r.key(p, 'keydown', 'ArrowUp');
  r.key(p, 'keydown', 'ArrowRight', true);
  assert.equal(r.writes.length, 0);
  r.key(p, 'keyup', 'ArrowRight');
  assert.deepEqual(r.writes, ['0-0_74-50_255-255']);
  r.done();
});

test('Delete removes the focused point, but not one of the last two', () => {
  const r = rig('0-0_64-48_255-255');
  r.key(r.point(1), 'keydown', 'Delete');
  assert.deepEqual(r.writes, ['']);
  r.key(r.point(0), 'keydown', 'Delete');
  assert.equal(r.writes.length, 1);
  r.done();
});

test('typing redraws the plot; change rewrites the text in canonical form', () => {
  const r = rig('');
  r.field.value = '0,0 100,40 255,255';
  r.field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.deepEqual(r.curve.points(), [[0, 0], [100, 40], [255, 255]]);
  r.field.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(r.field.value, '0-0_100-40_255-255');
  assert.equal(r.writes[r.writes.length - 1], '0-0_100-40_255-255');
  r.done();
});

test('Reset returns to the straight line with one write', () => {
  const r = rig('0-0_64-48_255-255');
  (r.slot.querySelector('.tone-curve-reset') as HTMLButtonElement).click();
  assert.deepEqual(r.writes, ['']);
  assert.deepEqual(r.curve.points(), [[0, 0], [255, 255]]);
  r.done();
});

test('every point is focusable and named with its levels', () => {
  const r = rig('0-0_64-48_255-255');
  const p = r.point(1);
  assert.equal(p.getAttribute('tabindex'), '0');
  assert.match(p.getAttribute('aria-label')!, /2 of 3: input 64, output 48/);
  r.done();
});

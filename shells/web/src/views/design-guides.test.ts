// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import {
  mountDesignGuides,
  parseGuideRecords,
  serializeGuideRecords,
  guideSnapTargets,
  parseDesignGuides,
  rulerStep,
  serializeDesignGuides,
} from './design-guides.ts';
import { snapMove, snapPoint } from './free-canvas-math.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lolly.test/' });
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'SVGElement',
  'KeyboardEvent',
  'MouseEvent',
  'Event',
  'Node',
  'localStorage',
]) {
  (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[
    key
  ];
}

test('guide wire format is compact, sorted, deduplicated and backwards-compatible', () => {
  assert.deepEqual(parseDesignGuides('1|x=20,10,20;y=5.5'), { x: [10, 20], y: [5.5] });
  assert.deepEqual(parseDesignGuides('{"x":[9],"y":[4,2]}'), { x: [9], y: [2, 4] });
  assert.equal(serializeDesignGuides({ x: [20, 10, 20], y: [5.555] }), '1|x=10,20;y=5.56');
  assert.equal(serializeDesignGuides({ x: [], y: [] }), '');
});

test('ruler ticks keep a usable screen interval at any zoom', () => {
  assert.equal(rulerStep(1), 10);
  assert.equal(rulerStep(0.1), 100);
  assert.equal(rulerStep(4), 5);
  assert.ok(rulerStep(0.025) * 0.025 >= 9);
});

test('dragging from a ruler commits one document guide and the corner clears it', () => {
  document.body.replaceChildren();
  const stage = document.createElement('div');
  const canvas = document.createElement('div');
  canvas.style.width = '1000px';
  canvas.style.height = '800px';
  stage.appendChild(canvas);
  document.body.appendChild(stage);
  Object.defineProperty(stage, 'getBoundingClientRect', {
    value: () => ({
      left: 0,
      top: 0,
      right: 1200,
      bottom: 900,
      width: 1200,
      height: 900,
      x: 0,
      y: 0,
      toJSON() {},
    }),
  });
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({
      left: 100,
      top: 100,
      right: 1100,
      bottom: 900,
      width: 1000,
      height: 800,
      x: 100,
      y: 100,
      toJSON() {},
    }),
  });
  (
    dom.window.Element.prototype as unknown as { setPointerCapture(id: number): void }
  ).setPointerCapture = () => {};
  (
    dom.window.Element.prototype as unknown as { hasPointerCapture(id: number): boolean }
  ).hasPointerCapture = () => false;

  let value = '';
  const commits: string[] = [];
  const handle = mountDesignGuides({
    stageEl: stage,
    canvasEl: canvas,
    read: () => value,
    commit: (next) => {
      value = next;
      commits.push(next);
    },
  });
  const top = handle.el.querySelector<HTMLElement>('.fc-ruler-x')!;
  const pointer = (type: string, x: number, y: number): void => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { button: 0, pointerId: 7, clientX: x, clientY: y, shiftKey: false });
    top.dispatchEvent(event);
  };
  pointer('pointerdown', 300, 100);
  pointer('pointermove', 300, 220);
  pointer('pointerup', 300, 220);

  assert.equal(commits.length, 1, 'one write on pointer release, never one per move');
  assert.deepEqual(handle.snapTargets(), { x: [], y: [120] });
  assert.equal(
    handle.el.querySelector('.fc-author-guide-y')?.getAttribute('aria-label'),
    'Horizontal guide at 120 px'
  );

  (handle.el.querySelector('.fc-ruler-corner') as HTMLButtonElement).click();
  assert.equal(value, '');
  assert.equal(handle.hasGuides(), false);
  handle.destroy();
  assert.equal(handle.el.isConnected, false);
});


test('guide properties round-trip with stable ids and read legacy documents', () => {
  const old = parseGuideRecords('1|x=40;y=75');
  assert.deepEqual(old.map(g => [g.id, g.x, g.y, g.rotation, g.snap]), [
    ['x0', 40, 0, 90, true], ['y0', 0, 75, 0, true],
  ]);
  const edited = old.map(g => g.id === 'x0' ? { ...g, x: 123.45, y: 67.89, rotation: 35, color: '#e04080', snap: false } : g);
  assert.deepEqual(parseGuideRecords(serializeGuideRecords(edited)), edited);
  assert.deepEqual(guideSnapTargets(edited), { x: [], y: [75] });
  assert.deepEqual(parseGuideRecords('2|not json'), []);
  assert.deepEqual(parseGuideRecords('2|[["a",null,0,90,"",true]]'), []);
});

test('rotated guides snap points and boxes perpendicularly, and disabling snap removes the target', () => {
  const records = [{ id: 'diagonal', x: 200, y: 200, rotation: 45, color: '', snap: true }];
  const canvas = { w: 1000, h: 800 };
  const targets = guideSnapTargets(records);
  const point = snapPoint(220, 224, [], canvas, 5, targets);
  assert.ok(Math.abs(point.x - 222) < 0.001);
  assert.ok(Math.abs(point.y - 222) < 0.001);
  assert.equal(point.guides.length, 1);
  const move = snapMove({ minX: 220, minY: 224, maxX: 240, maxY: 244, w: 20, h: 20 }, [], canvas, 5, targets);
  assert.ok(Math.abs(move.dx - 2) < 0.001);
  assert.ok(Math.abs(move.dy + 2) < 0.001);
  const off = snapPoint(220, 224, [], canvas, 5, guideSnapTargets([{ ...records[0]!, snap: false }]));
  assert.deepEqual(off, { x: 220, y: 224, guides: [] });
  assert.equal(snapPoint(220, 240, [], canvas, 5, targets).guides.length, 0, 'outside tolerance');
});

function guideFixture(initial = '1|x=100;y=200') {
  document.body.replaceChildren();
  const stage = document.createElement('div');
  const canvas = document.createElement('div');
  canvas.style.width = '1000px'; canvas.style.height = '800px';
  stage.append(canvas); document.body.append(stage);
  const rect = (x: number, y: number, width: number, height: number): DOMRect =>
    ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON() {} });
  stage.getBoundingClientRect = () => rect(0, 0, 1200, 900);
  canvas.getBoundingClientRect = () => rect(100, 100, 500, 400);
  let value = initial;
  const commits: string[] = [];
  let inspections = 0;
  const handle = mountDesignGuides({ stageEl: stage, canvasEl: canvas, read: () => value,
    commit: next => { value = next; commits.push(next); }, onInspect: () => { inspections++; } });
  const pointer = (target: Element, type: string, x: number, y: number, pointerId = 1): void => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { button: 0, pointerId, clientX: x, clientY: y, shiftKey: false });
    target.dispatchEvent(event);
  };
  return { handle, stage, canvas, commits, pointer,
    value: () => value, inspections: () => inspections,
    restore: (next: string) => { value = next; handle.sync(); } };
}

test('moving an existing guide preserves its node, captures one gesture and commits document coordinates', () => {
  const f = guideFixture();
  const line = f.handle.el.querySelector<HTMLElement>('[data-guide-id="x0"]')!;
  line.focus();
  f.pointer(line, 'pointerdown', 150, 250);
  f.pointer(line, 'pointermove', 200, 250);
  assert.equal(f.handle.el.querySelector('[data-guide-id="x0"]'), line);
  assert.equal(document.activeElement, line, 'the preview does not throw focus away');
  assert.equal(f.commits.length, 0);
  f.pointer(line, 'pointerup', 200, 250);
  assert.equal(f.commits.length, 1);
  assert.equal(f.handle.selected()?.x, 200, '50 screen px is 100 document px at half zoom');
  assert.equal(f.inspections(), 1);
  assert.equal(f.handle.selected()?.id, 'x0');
  f.handle.update('x0', { color: '#ff00cc', rotation: 45, snap: false });
  assert.equal(f.handle.selected()?.rotation, 45);
  f.restore('1|x=100;y=200');
  assert.equal(f.handle.selected()?.x, 100, 'undo updates the selected guide');
  f.restore('');
  assert.equal(f.handle.selected(), null, 'undoing creation clears selection');
  f.handle.destroy();
});

test('pointer cancellation and Escape discard guide previews without deleting the original', () => {
  const f = guideFixture();
  const line = f.handle.el.querySelector<HTMLElement>('[data-guide-id="x0"]')!;
  f.pointer(line, 'pointerdown', 150, 200);
  f.pointer(line, 'pointermove', 250, 200);
  f.pointer(line, 'pointercancel', 250, 200, 2);
  assert.ok(line.classList.contains('is-dragging'), 'another pointer cannot cancel this gesture');
  f.pointer(line, 'pointercancel', 250, 200);
  assert.equal(f.value(), '1|x=100;y=200');
  const ruler = f.handle.el.querySelector('.fc-ruler-x')!;
  f.pointer(ruler, 'pointerdown', 250, 10);
  f.pointer(ruler, 'pointermove', 250, 270);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  f.pointer(ruler, 'pointerup', 250, 270);
  assert.equal(f.commits.length, 0);
  assert.equal(f.handle.el.querySelectorAll('.fc-author-guide').length, 2);
  f.handle.destroy();
});

test('selecting a fractional guide does not round its position or create an undo step', () => {
  const f = guideFixture('1|x=100.25;y=');
  const line = f.handle.el.querySelector<HTMLElement>('[data-guide-id="x0"]')!;
  f.pointer(line, 'pointerdown', 150.125, 200);
  f.pointer(line, 'pointerup', 150.125, 200);
  assert.equal(f.handle.selected()?.x, 100.25);
  assert.equal(f.commits.length, 0);
  f.handle.destroy();
});

test('keyboard editing affects only the selected guide, and updates stay bound to their id', () => {
  const f = guideFixture();
  const line = f.handle.el.querySelector<HTMLElement>('[data-guide-id="y0"]')!;
  line.focus();
  let bubbled = false;
  f.stage.addEventListener('keydown', () => { bubbled = true; });
  line.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
  assert.equal(f.handle.selected()?.y, 210);
  assert.equal(bubbled, false, 'guide keys cannot also move artwork');
  f.handle.update('x0', { x: 123 });
  assert.equal(f.handle.selected()?.id, 'y0');
  assert.deepEqual(f.handle.snapTargets(), { x: [123], y: [210] });
  line.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  assert.equal(f.handle.selected(), null);
  assert.deepEqual(f.handle.snapTargets(), { x: [123], y: [] });
  f.handle.destroy();
});

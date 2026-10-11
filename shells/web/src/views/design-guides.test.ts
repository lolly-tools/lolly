// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import {
  mountDesignGuides,
  MAX_DESIGN_GUIDE_RECORDS,
  parseGuideRecords,
  serializeGuideRecords,
  serializeGuideEdit,
  guideSnapTargets,
  parseDesignGuides,
  rulerStep,
  serializeDesignGuides,
} from './design-guides.ts';
import { snapMove, snapPoint } from './free-canvas-math.ts';
import { guideNumber } from './design-guides-shared.ts';

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
  assert.deepEqual(
    old.map((g) => [g.id, g.x, g.y, g.rotation, g.snap]),
    [
      ['x0', 40, 0, 90, true],
      ['y0', 0, 75, 0, true],
    ]
  );
  const edited = old.map((g) =>
    g.id === 'x0' ? { ...g, x: 123.45, y: 67.89, rotation: 35, color: '#e04080', snap: false } : g
  );
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
  const move = snapMove(
    { minX: 220, minY: 224, maxX: 240, maxY: 244, w: 20, h: 20 },
    [],
    canvas,
    5,
    targets
  );
  assert.ok(Math.abs(move.dx - 2) < 0.001);
  assert.ok(Math.abs(move.dy + 2) < 0.001);
  const off = snapPoint(
    220,
    224,
    [],
    canvas,
    5,
    guideSnapTargets([{ ...records[0]!, snap: false }])
  );
  assert.deepEqual(off, { x: 220, y: 224, guides: [] });
  assert.equal(snapPoint(220, 240, [], canvas, 5, targets).guides.length, 0, 'outside tolerance');
});

function guideFixture(initial = '1|x=100;y=200', canEdit?: () => boolean) {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  window.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  };
  window.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  const flush = (): void => {
    const queued = [...frames.values()];
    frames.clear();
    for (const callback of queued) callback(0);
  };
  document.body.replaceChildren();
  const stage = document.createElement('div');
  const canvas = document.createElement('div');
  canvas.style.width = '1000px';
  canvas.style.height = '800px';
  stage.append(canvas);
  document.body.append(stage);
  const rect = (x: number, y: number, width: number, height: number): DOMRect => ({
    x,
    y,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    width,
    height,
    toJSON() {},
  });
  stage.getBoundingClientRect = () => rect(0, 0, 1200, 900);
  canvas.getBoundingClientRect = () => rect(100, 100, 500, 400);
  let value = initial;
  const commits: string[] = [];
  const errors: string[] = [];
  let inspections = 0;
  const handle = mountDesignGuides({
    stageEl: stage,
    canvasEl: canvas,
    onError: message => errors.push(message),
    canEdit,
    read: () => value,
    commit: (next) => {
      value = next;
      commits.push(next);
    },
    onInspect: () => {
      inspections++;
    },
  });
  const pointer = (target: Element, type: string, x: number, y: number, pointerId = 1): void => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { button: 0, pointerId, clientX: x, clientY: y, shiftKey: false });
    target.dispatchEvent(event);
  };
  return {
    handle,
    stage,
    canvas,
    commits,
    pointer,
    flush,
    pending: () => frames.size,
    value: () => value,
    inspections: () => inspections,
    errors,
    restore: (next: string) => {
      value = next;
      handle.sync();
    },
  };
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
  f.flush();
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
  f.stage.addEventListener('keydown', () => {
    bubbled = true;
  });
  line.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true })
  );
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

test('unchanged ruler ticks survive model and guide updates, with one layout read per sync', () => {
  const f = guideFixture();
  const x = f.handle.el.querySelector('.fc-ruler-x svg')!;
  const y = f.handle.el.querySelector('.fc-ruler-y svg')!;
  const xTick = x.firstChild,
    yTick = y.firstChild;
  const stageRect = f.stage.getBoundingClientRect,
    canvasRect = f.canvas.getBoundingClientRect;
  let stageReads = 0,
    canvasReads = 0;
  f.stage.getBoundingClientRect = () => {
    stageReads++;
    return stageRect();
  };
  f.canvas.getBoundingClientRect = () => {
    canvasReads++;
    return canvasRect();
  };
  f.handle.sync();
  assert.equal(stageReads, 1);
  assert.equal(canvasReads, 1, 'painting guide lines reuses the measured viewport');
  assert.equal(x.firstChild, xTick);
  assert.equal(y.firstChild, yTick);
  f.handle.update('x0', { x: 250 });
  f.restore('1|x=300;y=200');
  assert.equal(x.firstChild, xTick, 'guide writes and undo do not change ruler coordinates');
  assert.equal(y.firstChild, yTick);
  assert.deepEqual(f.handle.snapTargets(), { x: [300], y: [200] });
  f.stage.style.setProperty('--stage-reserve-left', '100');
  f.handle.sync();
  assert.notEqual(x.firstChild, xTick, 'the horizontal ruler follows the navigator reserve');
  assert.equal(y.firstChild, yTick, 'each axis caches its own geometry');
  const nextXTick = x.firstChild;
  f.canvas.getBoundingClientRect = () => ({ ...canvasRect(), left: 200, top: 150 });
  f.handle.sync();
  assert.notEqual(x.firstChild, nextXTick, 'pan invalidates the ruler origin');
  assert.notEqual(y.firstChild, yTick);
  f.handle.setVisible(false);
  f.handle.setVisible(true);
  assert.equal(f.handle.el.hidden, false);
  f.handle.destroy();
});

test('returning a guide to a ruler removes it in one write, and abandoning a new guide writes nothing', () => {
  const f = guideFixture();
  const top = f.handle.el.querySelector<HTMLElement>('.fc-ruler-x')!;
  const left = f.handle.el.querySelector<HTMLElement>('.fc-ruler-y')!;
  const rect = (x: number, y: number, width: number, height: number): DOMRect => ({
    x,
    y,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    width,
    height,
    toJSON() {},
  });
  top.getBoundingClientRect = () => rect(22, 0, 1178, 22);
  left.getBoundingClientRect = () => rect(0, 22, 22, 878);
  const line = f.handle.el.querySelector<HTMLElement>('[data-guide-id="x0"]')!;
  f.pointer(line, 'pointerdown', 150, 250);
  f.pointer(line, 'pointermove', 10, 250);
  assert.equal(f.commits.length, 0, 'removal waits for pointer release');
  f.pointer(line, 'pointerup', 10, 250);
  assert.equal(f.commits.length, 1);
  assert.deepEqual(f.handle.snapTargets(), { x: [], y: [200] });
  assert.equal(f.handle.el.querySelector('[data-guide-id="x0"]'), null);
  assert.equal(f.inspections(), 0, 'removed guides do not open the inspector');
  f.pointer(top, 'pointerdown', 300, 10);
  f.pointer(top, 'pointermove', 300, 300);
  f.pointer(top, 'pointerup', 300, 10);
  assert.equal(f.commits.length, 1, 'a guide released back on its ruler was never authored');
  assert.deepEqual(f.handle.snapTargets(), { x: [], y: [200] });
  f.handle.destroy();
});

test('guide coordinate formatting follows modern ruler labels, including negative halves and zero', () => {
  assert.equal(guideNumber(-1.125), '-1.13');
  assert.equal(guideNumber(-0.001), '0');
  assert.equal(guideNumber(123.5), '123.5');
});

test('one queued frame measures once and updates only the active guide among 1000 guides', () => {
  const initial = serializeGuideRecords(
    Array.from({ length: 1000 }, (_, i) => ({
      id: `guide${i}`,
      x: i,
      y: 0,
      rotation: 90,
      color: '',
      snap: true,
    }))
  );
  const f = guideFixture(initial);
  const line = f.handle.el.querySelector<HTMLElement>('.fc-author-guide[data-guide-id="guide0"]')!;
  f.pointer(line, 'pointerdown', 100, 250);
  const pill = f.handle.el.querySelector('.fc-guide-pill[data-guide-id="guide0"]');
  const tick = f.handle.el.querySelector('.fc-ruler-x svg')!.firstChild;
  const stageRect = f.stage.getBoundingClientRect,
    canvasRect = f.canvas.getBoundingClientRect;
  let stageReads = 0,
    canvasReads = 0,
    notifications = 0;
  f.stage.getBoundingClientRect = () => {
    stageReads++;
    return stageRect();
  };
  f.canvas.getBoundingClientRect = () => {
    canvasReads++;
    return canvasRect();
  };
  f.handle.onChange(() => {
    notifications++;
  });
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(f.handle.el, {
    subtree: true,
    attributes: true,
    childList: true,
    characterData: true,
  });
  for (let i = 1; i <= 20; i++) f.pointer(line, 'pointermove', 100 + i, 250);
  assert.equal(f.pending(), 1);
  assert.equal(stageReads + canvasReads, 0, 'events only save the latest pointer');
  assert.equal(observer.takeRecords().length, 0);
  f.flush();
  assert.equal(stageReads, 1);
  assert.equal(canvasReads, 1);
  const records = observer.takeRecords();
  assert.ok(
    records.length > 0 && records.length < 30,
    `${records.length} mutations for one active preview`
  );
  const inactive = records.filter((record) => {
    const el = record.target instanceof Element ? record.target : record.target.parentElement;
    const id = el?.closest<HTMLElement>('[data-guide-id]')?.dataset.guideId;
    return id && id !== 'guide0';
  });
  assert.equal(inactive.length, 0);
  assert.equal(f.handle.el.querySelector('.fc-guide-pill[data-guide-id="guide0"]'), pill);
  assert.equal(f.handle.el.querySelector('.fc-ruler-x svg')!.firstChild, tick);
  assert.equal(notifications, 0, 'pointer previews do not repaint the inspector');
  assert.equal(f.commits.length, 0);
  assert.equal(pill?.textContent, '40');
  observer.disconnect();
  f.pointer(line, 'pointerup', 135, 250);
  assert.equal(f.handle.selected()?.x, 70, 'the final pointer is flushed before release');
  assert.equal(f.commits.length, 1);
  assert.equal(f.pending(), 0);
  f.handle.destroy();
});

test('a three screen pixel threshold preserves fractional clicks and abandons ruler clicks', () => {
  const f = guideFixture('1|x=100.25;y=');
  const line = f.handle.el.querySelector<HTMLElement>('.fc-author-guide')!;
  f.pointer(line, 'pointerdown', 150.125, 250);
  f.pointer(line, 'pointermove', 152.125, 250);
  f.flush();
  assert.equal(line.classList.contains('is-dragging'), false);
  f.pointer(line, 'pointerup', 152.125, 250);
  assert.equal(f.commits.length, 0);
  assert.equal(f.handle.selected()?.x, 100.25);
  f.pointer(line, 'pointerdown', 150.125, 250);
  f.pointer(line, 'pointermove', 153.125, 250);
  f.flush();
  assert.equal(line.classList.contains('is-dragging'), true);
  f.pointer(line, 'pointerup', 153.125, 250);
  assert.equal(f.handle.selected()?.x, 106);
  const ruler = f.handle.el.querySelector('.fc-ruler-x')!;
  f.pointer(ruler, 'pointerdown', 300, 10);
  f.pointer(ruler, 'pointerup', 300, 12);
  assert.equal(f.commits.length, 1, 'an unmoved ruler interaction creates no guide');
  f.handle.destroy();
});

test('coordinate pills are keyed through hover, selection, drag and ruler-return feedback', () => {
  const f = guideFixture();
  const line = f.handle.el.querySelector<HTMLElement>('.fc-author-guide[data-guide-id="x0"]')!;
  f.pointer(line, 'pointerover', 150, 250);
  const pill = f.handle.el.querySelector<HTMLElement>('.fc-guide-pill[data-guide-id="x0"]')!;
  assert.equal(pill.textContent, '100');
  f.pointer(line, 'pointerout', 150, 250);
  assert.equal(pill.hidden, true);
  f.handle.select('x0');
  assert.equal(pill.hidden, false);
  f.pointer(line, 'pointerdown', 150, 250);
  f.pointer(line, 'pointermove', 10, 250);
  f.flush();
  assert.ok(f.handle.el.classList.contains('is-guide-removing'));
  assert.equal(pill.textContent, 'Remove');
  assert.ok(pill.classList.contains('is-guide-removing'));
  assert.equal(f.commits.length, 0);
  f.pointer(line, 'pointercancel', 10, 250);
  assert.equal(f.handle.el.querySelector('.fc-guide-pill[data-guide-id="x0"]'), pill);
  assert.equal(pill.textContent, '100');
  assert.equal(f.handle.el.classList.contains('is-guide-removing'), false);
  f.handle.destroy();
});

function openGuideEditor(f: ReturnType<typeof guideFixture>, id: string): HTMLInputElement {
  f.handle.select(id);
  const pill = f.handle.el.querySelector<HTMLElement>(`.fc-guide-pill[data-guide-id="${id}"]`)!;
  pill
    .querySelector('button')!
    .dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  return pill.querySelector<HTMLInputElement>('input[data-guide-position]')!;
}

test('the exact editor is lazy, commits Enter or blur once, and cancels Escape or stale edits', () => {
  const f = guideFixture();
  assert.equal(f.handle.el.querySelector('input'), null);
  let input = openGuideEditor(f, 'x0');
  assert.equal(input.value, '100');
  assert.equal(document.activeElement, input);
  input.value = '123.45';
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  );
  input.dispatchEvent(new Event('blur'));
  assert.equal(f.commits.length, 1);
  assert.equal(f.handle.selected()?.x, 123.45);
  input = openGuideEditor(f, 'x0');
  input.value = '999';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(f.commits.length, 1);
  assert.equal(f.handle.el.querySelector('input'), null);
  input = openGuideEditor(f, 'y0');
  input.value = '222.25';
  input.dispatchEvent(new Event('blur'));
  assert.equal(f.commits.length, 2);
  assert.equal(f.handle.selected()?.y, 222.25);
  input = openGuideEditor(f, 'x0');
  input.value = '456';
  f.handle.select('y0');
  input.dispatchEvent(new Event('blur'));
  assert.equal(f.commits.length, 2, 'a disconnected editor cannot write after a selection change');
  input = openGuideEditor(f, 'x0');
  input.value = '456';
  f.restore('1|x=50;y=200');
  input.dispatchEvent(new Event('blur'));
  assert.equal(f.commits.length, 2, 'undo closes the editor before restoring records');
  assert.deepEqual(f.handle.snapTargets(), { x: [50], y: [200] });
  input = openGuideEditor(f, 'x0');
  input.value = '';
  input.dispatchEvent(new Event('blur'));
  assert.equal(f.commits.length, 2, 'an empty number is not zero');
  f.handle.destroy();
});

test('exact position editing preserves a rotated guide anchor along the line and its properties', () => {
  const guide = { id: 'diagonal', x: 200, y: 200, rotation: 45, color: '#e04080', snap: false };
  const f = guideFixture(serializeGuideRecords([guide]));
  const input = openGuideEditor(f, guide.id);
  input.value = '14.14';
  input.dispatchEvent(new Event('blur'));
  const actual = f.handle.selected()!;
  assert.ok(Math.abs(actual.x + actual.y - 400) < 0.02);
  assert.ok(Math.abs(actual.x - 190) < 0.02 && Math.abs(actual.y - 210) < 0.02);
  assert.equal(actual.rotation, 45);
  assert.equal(actual.color, '#e04080');
  assert.equal(actual.snap, false);
  assert.equal(f.commits.length, 1);
  f.handle.destroy();
});

test('every drag termination cancels queued work without a late preview or history write', () => {
  for (const termination of [
    'cancel',
    'lostcapture',
    'escape',
    'hide',
    'undo',
    'blur',
    'destroy',
  ]) {
    const f = guideFixture(),
      line = f.handle.el.querySelector('.fc-author-guide')!;
    f.pointer(line, 'pointerdown', 150, 250);
    f.pointer(line, 'pointermove', 300, 250);
    assert.equal(f.pending(), 1);
    if (termination === 'cancel') f.pointer(line, 'pointercancel', 300, 250);
    if (termination === 'lostcapture') f.pointer(line, 'lostpointercapture', 300, 250);
    if (termination === 'escape')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (termination === 'hide') f.handle.setVisible(false);
    if (termination === 'undo') f.restore('1|x=50;y=200');
    if (termination === 'blur') window.dispatchEvent(new Event('blur'));
    if (termination === 'destroy') f.handle.destroy();
    assert.equal(f.pending(), 0, termination);
    f.flush();
    assert.equal(f.commits.length, 0, termination);
    assert.equal(f.handle.el.classList.contains('is-guide-dragging'), false, termination);
    assert.deepEqual(
      f.handle.snapTargets(),
      { x: [termination === 'undo' ? 50 : 100], y: [200] },
      termination
    );
    f.handle.destroy();
  }
});

test('read-only guides reject mutations, exact editing, creation and a live permission change', () => {
  let editable = false;
  const f = guideFixture('1|x=100;y=200', () => editable);
  const line = f.handle.el.querySelector<HTMLElement>('.fc-author-guide')!;
  f.pointer(line, 'pointerdown', 150, 250);
  assert.equal(f.handle.selected()?.id, 'x0', 'observers can select an existing guide');
  f.handle.update('x0', { x: 123 });
  f.handle.remove('x0');
  f.handle.clear();
  f.handle.el.querySelector<HTMLButtonElement>('.fc-ruler-corner')!.click();
  f.pointer(line, 'pointerdown', 150, 250);
  f.pointer(line, 'pointermove', 250, 250);
  f.pointer(line, 'pointerup', 250, 250);
  const top = f.handle.el.querySelector<HTMLElement>('.fc-ruler-x')!;
  f.pointer(top, 'pointerdown', 300, 10);
  f.pointer(top, 'pointerup', 300, 250);
  top.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  line.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  line.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  const pill = f.handle.el.querySelector('.fc-guide-pill')!;
  pill.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  assert.equal(f.handle.el.querySelector('input'), null);
  assert.equal(f.pending(), 0);
  assert.equal(f.commits.length, 0);
  assert.equal(f.value(), '1|x=100;y=200');
  editable = true;
  f.pointer(line, 'pointerdown', 150, 250);
  f.pointer(line, 'pointermove', 250, 250);
  editable = false;
  f.flush();
  f.pointer(line, 'pointerup', 250, 250);
  assert.equal(f.commits.length, 0);
  assert.equal(f.pending(), 0);
  assert.deepEqual(f.handle.snapTargets(), { x: [100], y: [200] });
  f.handle.destroy();
});

test('ruler keyboard creation commits once and focuses a guide at the visible canvas center', () => {
  const f = guideFixture('');
  const top = f.handle.el.querySelector<HTMLElement>('.fc-ruler-x')!;
  assert.equal(top.tabIndex, 0);
  top.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  );
  assert.equal(f.commits.length, 1);
  assert.equal(f.handle.selected()?.y, 400);
  assert.equal(document.activeElement, f.handle.el.querySelector('.fc-author-guide'));
  const left = f.handle.el.querySelector<HTMLElement>('.fc-ruler-y')!;
  left.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  assert.equal(f.commits.length, 2);
  assert.equal(f.handle.selected()?.x, 500);
  f.handle.destroy();
});

test('selection ruler bands reuse nodes and the last layout independently of tick rendering', () => {
  const f = guideFixture();
  const tick = f.handle.el.querySelector('.fc-ruler-x svg')!.firstChild;
  const x = f.handle.el.querySelector<HTMLElement>('.fc-ruler-selection-x')!;
  const y = f.handle.el.querySelector<HTMLElement>('.fc-ruler-selection-y')!;
  const band = x.querySelector<HTMLElement>('.fc-ruler-selection-band')!;
  const min = x.querySelector<HTMLElement>('[data-selection-edge="min"]')!;
  let reads = 0;
  const stageRect = f.stage.getBoundingClientRect,
    canvasRect = f.canvas.getBoundingClientRect;
  f.stage.getBoundingClientRect = () => {
    reads++;
    return stageRect();
  };
  f.canvas.getBoundingClientRect = () => {
    reads++;
    return canvasRect();
  };
  f.handle.setSelectionBounds({ minX: 10, minY: 20, maxX: 100, maxY: 80 });
  assert.equal(reads, 0);
  assert.equal(band.style.left, '83px');
  assert.equal(band.style.width, '45px');
  assert.equal(min.textContent, '10');
  assert.equal(min.style.left, '72px');
  assert.equal(y.querySelector<HTMLElement>('.fc-ruler-selection-band')!.style.height, '30px');
  f.handle.setSelectionBounds({ minX: -0.001, minY: 0, maxX: 123.5, maxY: 80 });
  assert.equal(min.textContent, '0');
  assert.equal(x.querySelector('[data-selection-edge="max"]')!.textContent, '123.5');
  assert.equal(f.handle.el.querySelector('.fc-ruler-x svg')!.firstChild, tick);
  assert.equal(x.querySelector('.fc-ruler-selection-band'), band);
  assert.equal(reads, 0);
  f.canvas.getBoundingClientRect = () => ({ ...canvasRect(), left: 200 });
  f.handle.sync();
  assert.equal(band.style.left, '177.9995px', 'pan updates the cached selection projection');
  f.handle.setSelectionBounds(null);
  assert.equal(x.hidden, true);
  assert.equal(y.hidden, true);
  f.handle.destroy();
});

test('capture stays on the clicked line or coordinate button so native double-click keeps guide identity', () => {
  const f = guideFixture();
  const prototype = dom.window.Element.prototype as unknown as {
    setPointerCapture(id: number): void;
  };
  const previous = prototype.setPointerCapture;
  let captured: Element | null = null;
  prototype.setPointerCapture = function (): void {
    captured = this as unknown as Element;
  };
  try {
    const line = f.handle.el.querySelector<HTMLElement>('.fc-author-guide[data-guide-id="x0"]')!;
    f.pointer(line, 'pointerdown', 150, 250);
    assert.equal(captured, line);
    f.pointer(line, 'pointerup', 150, 250);
    const button = f.handle.el.querySelector<HTMLElement>(
      '.fc-guide-pill[data-guide-id="x0"] button'
    )!;
    f.pointer(button, 'pointerdown', 150, 10);
    assert.equal(captured, button);
    f.pointer(button, 'pointerup', 150, 10);
    button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    assert.ok(f.handle.el.querySelector('input[data-guide-position="x0"]'));
    assert.equal(f.commits.length, 0);
  } finally {
    prototype.setPointerCapture = previous;
    f.handle.destroy();
  }
});

test('snap targets reuse unchanged records and invalidate after local edits or restored source', () => {
  const f = guideFixture();
  const first = f.handle.snapTargets();
  assert.equal(f.handle.snapTargets(), first);
  f.handle.select('x0');
  f.handle.sync();
  f.handle.setVisible(false);
  assert.equal(
    f.handle.snapTargets(),
    first,
    'selection, viewport sync and visibility do not rebuild targets'
  );
  f.handle.update('x0', { x: 125 });
  const edited = f.handle.snapTargets();
  assert.notEqual(edited, first);
  assert.deepEqual(edited, { x: [125], y: [200] });
  assert.equal(f.handle.snapTargets(), edited);
  f.restore('1|x=60;y=70');
  const restored = f.handle.snapTargets();
  assert.notEqual(restored, edited);
  assert.deepEqual(restored, { x: [60], y: [70] });
  f.handle.update('x0', { snap: false });
  assert.deepEqual(f.handle.snapTargets(), { x: [], y: [70] });
  f.handle.destroy();
});

test('an explicit port edit or removal ends an outstanding pointer preview before its commit', () => {
  for (const removal of [false, true]) {
    const f = guideFixture(),
      line = f.handle.el.querySelector('.fc-author-guide')!;
    f.pointer(line, 'pointerdown', 150, 250);
    f.pointer(line, 'pointermove', 300, 250);
    assert.equal(f.pending(), 1);
    if (removal) f.handle.remove('x0');
    else f.handle.update('x0', { x: 123 });
    assert.equal(f.pending(), 0);
    f.flush();
    f.pointer(line, 'pointerup', 300, 250);
    assert.equal(f.commits.length, 1);
    assert.deepEqual(f.handle.snapTargets(), { x: removal ? [] : [123], y: [200] });
    assert.equal(
      f.handle.el.querySelector('.fc-author-guide[data-guide-id="x0"]') === null,
      removal
    );
    if (!removal) assert.equal(f.handle.selected()?.id, 'x0');
    f.handle.destroy();
  }
});

test('large finite guide coordinates remain finite through exact editing and both wire versions', () => {
  for (const coordinate of [1e308, -1e308, Number.MAX_VALUE]) {
    const f = guideFixture('1|x=100;y=200');
    const input = openGuideEditor(f, 'x0');
    input.value = String(coordinate);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(f.commits.length, 1);
    assert.equal(f.handle.selected()?.x, coordinate);
    assert.ok(Number.isFinite(f.handle.selected()?.x));
    assert.equal(parseGuideRecords(f.value()).find((guide) => guide.id === 'x0')?.x, coordinate);
    assert.equal(f.value().includes('null'), false);
    assert.equal(guideNumber(coordinate), String(coordinate));
    const old = serializeDesignGuides({ x: [coordinate], y: [] });
    assert.deepEqual(parseDesignGuides(old), { x: [coordinate], y: [] });
    f.restore(f.value());
    assert.equal(f.handle.selected()?.x, coordinate);
    f.handle.destroy();
  }
  assert.deepEqual(
    parseDesignGuides('1|x=-1.125,1.125;y='),
    { x: [-1.12, 1.13], y: [] },
    'ordinary wire rounding stays compatible'
  );
});

test('native-order canvas click-away accepts a valid draft before selection clears and blur runs', () => {
  const f = guideFixture();
  let input = openGuideEditor(f, 'x0');
  input.value = '123.45';
  f.pointer(f.canvas, 'pointerdown', 300, 300);
  input.dispatchEvent(new Event('blur'));
  assert.equal(f.commits.length, 1);
  assert.equal(f.handle.selected(), null);
  assert.deepEqual(f.handle.snapTargets(), { x: [123.45], y: [200] });
  input = openGuideEditor(f, 'y0');
  input.value = '222.25';
  const line = f.handle.el.querySelector('.fc-author-guide[data-guide-id="x0"]')!;
  f.pointer(line, 'pointerdown', 161.725, 250);
  f.pointer(line, 'pointerup', 161.725, 250);
  input.dispatchEvent(new Event('blur'));
  assert.equal(f.commits.length, 2, 'clicking another guide accepts the draft once');
  assert.deepEqual(f.handle.snapTargets(), { x: [123.45], y: [222.25] });
  input = openGuideEditor(f, 'x0');
  input.value = '';
  f.pointer(f.canvas, 'pointerdown', 300, 300);
  assert.equal(f.commits.length, 2, 'invalid click-away never invents a coordinate');
  f.handle.destroy();
});

test('horizontal guide exact entry is upright beside the left ruler and rotation returns when closed', () => {
  const f = guideFixture();
  const style = document.createElement('style');
  style.textContent = readFileSync(
    new URL('../styles/parts/design-guides.css', import.meta.url),
    'utf8'
  );
  document.head.append(style);
  try {
    const input = openGuideEditor(f, 'y0');
    const pill = input.closest<HTMLElement>('.fc-guide-pill')!;
    assert.ok(pill.classList.contains('is-editing'));
    assert.equal(window.getComputedStyle(pill).transform, 'none');
    assert.equal(window.getComputedStyle(input).left, '36px');
    assert.equal(window.getComputedStyle(input).width, '104px');
    f.canvas.getBoundingClientRect = () => ({
      x: 200,
      y: 100,
      left: 200,
      top: 100,
      right: 700,
      bottom: 500,
      width: 500,
      height: 400,
      toJSON() {},
    });
    f.handle.sync();
    assert.ok(
      pill.classList.contains('is-editing'),
      'viewport repaint preserves editor presentation'
    );
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(pill.classList.contains('is-editing'), false);
    assert.equal(window.getComputedStyle(pill).transform, 'rotate(-90deg)');
    const topInput = openGuideEditor(f, 'x0');
    assert.equal(
      window.getComputedStyle(topInput).top,
      '24px',
      'vertical-guide editor opens below the top ruler'
    );
    assert.equal(
      window.getComputedStyle(topInput.closest<HTMLElement>('.fc-guide-pill')!).transform,
      'none'
    );
  } finally {
    style.remove();
    f.handle.destroy();
  }
});

function guideRecordWire(count: number): string {
  return serializeGuideRecords(
    Array.from({ length: count }, (_, i) => ({
      id: `guide${i}`,
      x: i,
      y: 0,
      rotation: 90,
      color: '',
      snap: true,
    }))
  );
}

test('ruler pointer and keyboard creation at persisted capacity do not preview, measure or commit', () => {
  const initial = guideRecordWire(MAX_DESIGN_GUIDE_RECORDS),
    f = guideFixture(initial);
  let reads = 0,
    notifications = 0;
  const stageRect = f.stage.getBoundingClientRect,
    canvasRect = f.canvas.getBoundingClientRect;
  f.stage.getBoundingClientRect = () => {
    reads++;
    return stageRect();
  };
  f.canvas.getBoundingClientRect = () => {
    reads++;
    return canvasRect();
  };
  f.handle.onChange(() => {
    notifications++;
  });
  for (const axis of ['x', 'y']) {
    const ruler = f.handle.el.querySelector<HTMLElement>(`.fc-ruler-${axis}`)!;
    f.pointer(ruler, 'pointerdown', axis === 'x' ? 300 : 10, axis === 'x' ? 10 : 300);
    f.pointer(ruler, 'pointermove', 400, 400);
    f.pointer(ruler, 'pointerup', 400, 400);
    ruler.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
    ruler.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    );
  }
  assert.equal(f.pending(), 0);
  assert.equal(reads, 0);
  assert.equal(notifications, 0);
  assert.equal(f.commits.length, 0);
  assert.equal(f.value(), initial);
  assert.equal(f.handle.el.querySelectorAll('.fc-author-guide').length, MAX_DESIGN_GUIDE_RECORDS);
  assert.equal(f.handle.el.querySelector('.fc-guide-pill'), null);
  assert.equal(f.handle.selected(), null);
  f.handle.destroy();
});

test('both creation paths can author the final readable record and then stop at capacity', () => {
  for (const keyboard of [false, true]) {
    const f = guideFixture(guideRecordWire(MAX_DESIGN_GUIDE_RECORDS - 1));
    const ruler = f.handle.el.querySelector<HTMLElement>('.fc-ruler-x')!;
    if (keyboard)
      ruler.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    else {
      f.pointer(ruler, 'pointerdown', 300, 10);
      f.pointer(ruler, 'pointerup', 300, 300);
    }
    const id = f.handle.selected()!.id,
      restored = parseGuideRecords(f.value());
    assert.equal(f.commits.length, 1);
    assert.equal(restored.length, MAX_DESIGN_GUIDE_RECORDS);
    assert.ok(
      restored.some((guide) => guide.id === id),
      'the new guide remains readable after reload'
    );
    f.pointer(ruler, 'pointerdown', 300, 10);
    f.pointer(ruler, 'pointerup', 300, 400);
    ruler.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(f.commits.length, 1);
    assert.equal(f.pending(), 0);
    assert.equal(f.handle.selected()?.id, id);
    f.handle.destroy();
  }
});

test('existing guides still move and edit at capacity, and removal makes room for creation', () => {
  const f = guideFixture(guideRecordWire(MAX_DESIGN_GUIDE_RECORDS));
  const line = f.handle.el.querySelector('.fc-author-guide[data-guide-id="guide0"]')!;
  f.pointer(line, 'pointerdown', 100, 250);
  f.pointer(line, 'pointerup', 150, 250);
  assert.equal(f.handle.selected()?.x, 100);
  assert.equal(f.commits.length, 1);
  assert.equal(f.handle.el.querySelector('.fc-author-guide[data-guide-id="guide0"]'), line);
  const lastId = `guide${MAX_DESIGN_GUIDE_RECORDS - 1}`,
    input = openGuideEditor(f, lastId);
  input.value = '1001.5';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(f.commits.length, 2);
  assert.equal(f.handle.selected()?.x, 1001.5);
  const restored = parseGuideRecords(f.value());
  assert.equal(restored.length, MAX_DESIGN_GUIDE_RECORDS);
  assert.equal(restored.find((guide) => guide.id === lastId)?.x, 1001.5);
  f.handle.remove('guide0');
  const ruler = f.handle.el.querySelector<HTMLElement>('.fc-ruler-x')!;
  ruler.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(f.commits.length, 4);
  assert.equal(parseGuideRecords(f.value()).length, MAX_DESIGN_GUIDE_RECORDS);
  f.handle.destroy();
});


test('large legacy guide edits keep the complete axis set readable without increasing the v2 limit', () => {
  const source = serializeDesignGuides({ x: Array.from({ length: 1005 }, (_, i) => i * 2), y: [7, 11] });
  const guides = parseGuideRecords(source), edited = guides.map(guide => guide.id === 'x0' ? { ...guide, x: -25 } : guide);
  const wire = serializeGuideEdit(edited);
  assert.ok(wire.startsWith('1|'));
  assert.equal(parseGuideRecords(wire).length, 1007);
  assert.deepEqual(guideSnapTargets(parseGuideRecords(wire)), guideSnapTargets(edited));
  assert.equal(parseGuideRecords(serializeGuideRecords(edited)).length, MAX_DESIGN_GUIDE_RECORDS, 'v2 keeps its existing bounded reader');
  assert.throws(() => serializeGuideEdit(edited.map(guide => guide.id === 'x0' ? { ...guide, rotation: 45 } : guide)), /1,000 guides/);
  assert.throws(() => serializeGuideEdit(edited.map(guide => guide.id === 'x0' ? { ...guide, snap: false } : guide)), /1,000 guides/);
  assert.throws(() => serializeGuideEdit(edited.map(guide => guide.id === 'x0' ? { ...guide, color: '#ff00cc' } : guide)), /1,000 guides/);
});

test('drag and deletion retain every legacy guide, while rich edits explain the remaining limit', () => {
  const source = serializeDesignGuides({ x: Array.from({ length: 1002 }, (_, i) => i * 2), y: [] });
  const f = guideFixture(source);
  const line = f.handle.el.querySelector<HTMLElement>('[data-guide-id="x0"]')!;
  f.pointer(line, 'pointerdown', 100, 250); f.pointer(line, 'pointerup', 100, 250);
  assert.equal(f.commits.length, 0, 'a plain selection does not create an undo entry');
  f.pointer(line, 'pointerdown', 100, 250); f.pointer(line, 'pointermove', 103.5, 250); f.pointer(line, 'pointerup', 103.5, 250);
  assert.equal(f.commits.length, 1, 'a distinct drag preserves all legacy guides');
  assert.equal(parseGuideRecords(f.value()).length, 1002);
  f.pointer(line, 'pointerdown', 103.5, 250); f.pointer(line, 'pointermove', 110, 250); f.pointer(line, 'pointerup', 110, 250);
  assert.equal(f.commits.length, 1, 'a colliding legacy position is refused without losing a guide');
  assert.equal(f.errors.length, 1);
  f.handle.update('x0', { x: -5 });
  assert.ok(f.value().startsWith('1|')); assert.equal(parseGuideRecords(f.value()).length, 1002);
  f.handle.update('x0', { rotation: 45 });
  assert.equal(f.commits.length, 2); assert.match(f.errors.at(-1)!, /1,000 guides/); assert.equal(f.handle.selected()?.rotation, 90);
  f.handle.remove('x1');
  assert.ok(f.value().startsWith('1|')); assert.equal(parseGuideRecords(f.value()).length, 1001);
  f.handle.remove('x2');
  assert.ok(f.value().startsWith('2|')); assert.equal(parseGuideRecords(f.value()).length, 1000);
  f.handle.update('x0', { rotation: 45 });
  assert.equal(parseGuideRecords(f.value()).find(guide => guide.id === 'x0')!.rotation, 45);
  f.handle.destroy();
});

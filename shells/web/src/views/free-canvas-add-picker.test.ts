// SPDX-License-Identifier: MPL-2.0
/**
 * WHICH PICKER an add-kind opens.
 *
 * Placing a box from the Add menu opens the asset picker straight afterwards, and the kind
 * the user chose is the only thing that knows which pane and which asset type that picker
 * should start on. That mapping used to be partial: the media kinds narrowed the picker by
 * `type`, but the `tool` kind - which seeds `kind: 'image'` like the rest - fell through to
 * the generic image picker, so "add a tool" opened on the library instead of the tool grid.
 *
 * The mapping is asserted through the REAL `initFreeCanvas` on the jsdom harness
 * free-canvas-pen.test.ts established, by recording the options the editor hands
 * `host.assets.pick` - the actual boundary between the editor and picker.ts (whose end of
 * the contract is covered in picker-initial-tab.test.ts).
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-add-picker.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';
import { initFreeCanvas } from './free-canvas.ts';

// ── jsdom bootstrap (same shape as free-canvas-tools.test.ts) ──────────────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
for (const k of ['window', 'document', 'HTMLElement', 'KeyboardEvent', 'Event', 'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
const rafQueue: Array<() => void> = [];
(globalThis as Record<string, unknown>).requestAnimationFrame = (fn: FrameRequestCallback): number => {
  rafQueue.push(() => fn(0));
  return rafQueue.length;
};
(globalThis as Record<string, unknown>).cancelAnimationFrame = (): void => {};
function frames(n = 3): void {
  for (let i = 0; i < n; i++) {
    const pending = rafQueue.splice(0, rafQueue.length);
    for (const fn of pending) fn();
  }
}
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

function pointerEvent(type: string, x: number, y: number): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}

// ── fixture ───────────────────────────────────────────────────────────────────

const NATIVE = 1000;

/** Sequence Studio's canvas block: the one manifest that ships every add-kind this file
 *  is about, `tool` included. Trimmed to the fields the create path reads. */
function canvasCfg(): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', imageField: 'image', fitField: 'fit', kindField: 'kind',
    addKinds: [
      { id: 'clip', label: 'Clip', seed: { kind: 'image', lane: 'seq', fit: 'cover' } },
      { id: 'image', label: 'Image', seed: { kind: 'image', fit: 'contain' } },
      { id: 'lottie', label: 'Animation', seed: { kind: 'image', fit: 'contain' } },
      { id: 'audio', label: 'Audio', seed: { kind: 'audio' } },
      // The kind that regressed: it seeds kind:'image' too, so nothing but its id
      // distinguishes it from the plain Image kind.
      { id: 'tool', label: 'Tool', seed: { kind: 'image', fit: 'contain' } },
    ],
  };
}

interface PickOpts { type?: string; initialTab?: string; title?: string }

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  picks: PickOpts[];
  destroy(): void;
}

function mount(): Fixture {
  const viewEl = dom.window.document.createElement('div');
  const stageEl = dom.window.document.createElement('div');
  const canvasEl = dom.window.document.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  dom.window.document.body.appendChild(viewEl);
  canvasEl.style.width = NATIVE + 'px';
  canvasEl.style.height = NATIVE + 'px';
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  const model = new Map<string, unknown>([['boxes', [] as Box[]]]);
  const subs: Array<() => void> = [];
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { model.set(id, value); for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  // The recording boundary: the editor's ONLY route into the picker. Resolving null is
  // the "user cancelled" path, so nothing is written to the model.
  const picks: PickOpts[] = [];
  const host = { assets: { pick: async (o: PickOpts) => { picks.push(o); return null; } } };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: host as never,
    input: { id: 'boxes', canvas: canvasCfg() as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  frames();
  return {
    stageEl, canvasEl, picks,
    destroy() { handle.destroy(); viewEl.remove(); dom.window.document.body.innerHTML = ''; },
  };
}

const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };

/** The label the Add menu shows for each kind id in `canvasCfg()`. The menu renders one
 *  item per addKind, labelled from the manifest, so the label is how a user picks it. */
const KIND_LABEL: Record<string, string> = {
  clip: 'Clip', image: 'Image', lottie: 'Animation', audio: 'Audio', tool: 'Tool',
};

/** Arm `kindId` through the rail's Add menu, the way a user does. */
function arm(f: Fixture, kindId: string): void {
  const add = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-add');
  assert.ok(add, 'the rail has an Add button');
  click(add!);
  frames();
  const items = [...f.stageEl.querySelectorAll<HTMLButtonElement>('.fc-pop-item, .fc-pop-gitem')];
  const label = KIND_LABEL[kindId]!;
  const item = items.find(b => (b.textContent ?? '').trim() === label);
  assert.ok(item, `the Add menu offers "${label}" (saw ${items.map(b => (b.textContent ?? '').trim()).join(', ')})`);
  click(item!);
  frames();
}

/** Tap the canvas to drop the armed box; the picker opens on the next macrotask. */
async function place(f: Fixture): Promise<void> {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 500, 500));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', 500, 500));
  frames();
  await new Promise<void>(r => setTimeout(r, 0));   // pickImage is deferred by setTimeout(…, 0)
  await new Promise<void>(r => setTimeout(r, 0));
}

/** Add one box of `kindId` and return the options its picker was opened with. */
async function addKind(kindId: string): Promise<PickOpts> {
  const f = mount();
  try {
    arm(f, kindId);
    await place(f);
    assert.equal(f.picks.length, 1, `adding "${kindId}" opened exactly one picker`);
    return f.picks[0]!;
  } finally {
    f.destroy();
  }
}

// ── the tool kind opens the Tools pane ────────────────────────────────────────

test('the tool add-kind opens the picker on the Tools tab, untyped', async () => {
  const o = await addKind('tool');
  assert.equal(o.initialTab, 'tools', 'the tool grid is the pane it lands on');
  // Deliberately untyped: this pane is also the Lolly-link / saved-session route, and a
  // tool render can be a vector OR a raster.
  assert.equal(o.type, undefined, 'no asset-type constraint is imposed');
});

// ── the media kinds open the type-filtered library ─────────────────────────────

test('audio, video and animation kinds open the library already filtered to their type', async () => {
  for (const [kind, type] of [['audio', 'audio'], ['clip', 'video'], ['lottie', 'lottie']] as const) {
    const o = await addKind(kind);
    assert.equal(o.initialTab, 'library', `${kind} lands on the library`);
    assert.equal(o.type, type, `${kind} narrows the library to ${type}`);
  }
});

test('the plain image kind opens the library and stays unconstrained', async () => {
  const o = await addKind('image');
  assert.equal(o.initialTab, 'library');
  // Unchanged from before: an image box takes rasters, vectors and animated rasters, so
  // narrowing it here would REMOVE choices the user has today.
  assert.equal(o.type, undefined);
});

// ── the kinds are actually distinguished ──────────────────────────────────────

test('tool and image seed identically yet open different panes', async () => {
  const tool = await addKind('tool');
  const image = await addKind('image');
  assert.notEqual(tool.initialTab, image.initialTab,
    'the two kinds share a seed, so the id is the only thing that can tell them apart');
  assert.notEqual(tool.title, image.title, 'and the dialog says which one you asked for');
});

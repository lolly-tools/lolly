// SPDX-License-Identifier: MPL-2.0
/**
 * "Lift layers" - the SURFACE (plans/104 section 7, P3b).
 *
 * The two halves this file does NOT re-test: the engine's enumeration
 * (`engine/src/svg-layers.ts` owns "which layers, and what markup for each") and the
 * pure row synthesis (`liftRows` / `applyLift` in free-canvas-math.ts, which own the
 * depth stagger, the shared group and the paint-order distribution). What is pinned
 * here is everything BETWEEN them, i.e. everything a user actually touches:
 *
 *   • WHERE the action is offered - the right-click menu (always present on an
 *     image-capable tool, disabled off an SVG so the menu keeps its height) and the
 *     More panel (present only when it would do something);
 *   • the CONFIRM dialog - the count sentence, one row per layer, no checkboxes;
 *   • and the law that matters most: confirm writes the model exactly ONCE, so the
 *     whole lift is a single undo step.
 *
 * The real `enumerateSvgLayers` runs. The two IO edges are stubbed at the module
 * loader - the fetch+sanitise (`anim-svg-mount`) and the asset store (`picker`) - so
 * the test drives the real dialog, the real gating and the real commit without an
 * IndexedDB or a network.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-lift.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';

/** The uploads the stubbed picker received - the derived per-layer documents. */
interface FakeFile { name: string; type: string; text: string }
const uploads: FakeFile[] = [];
(globalThis as Record<string, unknown>).__liftUploads = uploads;
(globalThis as Record<string, unknown>).__liftSvg = '';
(globalThis as Record<string, unknown>).__liftFetchFails = false;

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    // The SANITISED-markup edge. The real `fetchAnimSvg` is fetch + DOMPurify + a
    // per-URL cache; none of the three is what this file is testing, and DOMPurify
    // needs a live document it would have to be handed anyway.
    if (url.endsWith('/views/anim-svg-mount.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: `export async function fetchAnimSvg(){
          if (globalThis.__liftFetchFails) throw new Error('offline');
          return globalThis.__liftSvg;
        }`,
      };
    }
    // The asset-store edge. The real `storeUserUpload` normalises, sanitises again and
    // writes IndexedDB; here it records what it was handed and answers with the ref
    // shape the model must end up carrying.
    if (url.endsWith('/views/picker.ts')) {
      return {
        format: 'module', shortCircuit: true,
        // jsdom's File has no .text(), so the source text is read back through the
        // FileReader it does implement - the stub must not need a newer DOM than the
        // real picker does.
        source: `export async function storeUserUpload(host, file){
          const text = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result));
            r.onerror = () => rej(r.error);
            r.readAsText(file);
          });
          globalThis.__liftUploads.push({ name: file.name, type: file.type, text });
          const n = globalThis.__liftUploads.length;
          return { source: 'user', id: 'user/upload/' + n + '-' + file.name, type: 'vector',
                   format: 'svg', url: 'blob:layer-' + n };
        }`,
      };
    }
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent };
for (const k of [
  'window', 'document', 'HTMLElement', 'Element', 'KeyboardEvent', 'Event', 'CustomEvent',
  'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver', 'Blob', 'File', 'FileReader',
]) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };

const { initFreeCanvas } = await import('./free-canvas.ts');

const NATIVE = 1000;
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

/** Three top-level layers: a group, a group of two circles, and a bare path. */
const ART = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
  + '<defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>'
  + '<g><rect x="0" y="0" width="50" height="50" fill="url(#g)"/></g>'
  + '<g><circle cx="70" cy="70" r="10"/><circle cx="20" cy="70" r="5"/></g>'
  + '<path d="M0 0 L10 10"/></svg>';

const svgRef = (name = 'diagram.svg') =>
  ({ source: 'library', id: 'suse/art/diagram', type: 'vector', format: 'svg', url: 'https://x.test/diagram.svg', meta: { name } });
const pngRef = () =>
  ({ source: 'user', id: 'user/upload/photo.png', type: 'raster', format: 'png', url: 'https://x.test/photo.png' });

/** Design's canvas block, narrowed to what a lift reads and writes. */
function canvasCfg(): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', gradField: 'grad', opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', groupField: 'group', clipField: 'clip', imageField: 'image', fitField: 'fit',
    shadowField: 'shadow', zField: 'z',
  };
}

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  writes(): number;
  destroy(): void;
}

function mount(seed: Box[], cfg: Record<string, unknown> = canvasCfg()): Fixture {
  const viewEl = dom.window.document.createElement('div');
  const stageEl = dom.window.document.createElement('div');
  const canvasEl = dom.window.document.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  dom.window.document.body.appendChild(viewEl);
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  const model = new Map<string, unknown>([['boxes', seed]]);
  const subs: Array<() => void> = [];
  let writes = 0;
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { writes++; model.set(id, value); for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: cfg as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    writes: () => writes,
    destroy() { handle.destroy(); viewEl.remove(); dom.window.document.body.innerHTML = ''; },
  };
}

const settle = async (): Promise<void> => { for (let i = 0; i < 16; i++) await new Promise((r) => setTimeout(r, 0)); };

/** A real pointer event: the overlay reads `pointerId` / `pointerType` / `buttons`. */
function pointerEvent(type: string, x: number, y: number): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}
const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };

/** Right-click at a point, exactly as a desktop pointer does. */
function rightClick(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
}

/** The context menu's rows, by their label text. */
function menuRows(f: Fixture): Map<string, HTMLButtonElement> {
  const out = new Map<string, HTMLButtonElement>();
  for (const b of f.stageEl.querySelectorAll<HTMLButtonElement>('.fc-context-menu button')) {
    const label = (b.textContent || '').trim();
    if (label && !out.has(label)) out.set(label, b);
  }
  return out;
}

const box = (extra: Record<string, unknown> = {}): Box =>
  ({ id: 'a', x: 100, y: 100, w: 400, h: 300, rot: 0, ...extra } as Box);

// ══ where the action is offered ═══════════════════════════════════════════════

test('the menu entry is always THERE on an image tool, and disabled off an SVG', () => {
  const f = mount([box({ image: pngRef() })]);
  try {
    rightClick(f, 200, 200);
    const rows = menuRows(f);
    const lift = rows.get('Lift layers');
    assert.ok(lift, 'a raster selection still shows the entry - a menu that changes '
      + 'height between right-clicks teaches nothing, and the entry is the discovery');
    assert.equal(lift!.disabled, true, 'but it cannot run on a photograph');
  } finally { f.destroy(); }
});

test('…and enabled on a box holding an SVG, whether a library vector or an upload', () => {
  for (const ref of [
    svgRef(),
    { source: 'user', id: 'user/upload/logo.svg', type: 'vector', format: 'svg', url: 'blob:abc' },
    // Neither `type` nor `format` recorded - the URL is the only honest signal left.
    { source: 'remote', id: 'r', type: '', format: '', url: 'https://x.test/mark.svg?v=2' },
    { source: 'user', id: 'd', type: '', format: '', url: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' },
  ]) {
    const f = mount([box({ image: ref })]);
    try {
      rightClick(f, 200, 200);
      const lift = menuRows(f).get('Lift layers');
      assert.ok(lift, 'entry present');
      assert.equal(lift!.disabled, false, `should be liftable: ${JSON.stringify(ref)}`);
    } finally { f.destroy(); }
  }
});

test('a Lottie is not liftable, and neither is a multi-selection', () => {
  const lottie = { source: 'library', id: 'l', type: 'lottie', format: 'lottie', url: 'https://x.test/a.json' };
  const f = mount([box({ image: lottie })]);
  try {
    rightClick(f, 200, 200);
    assert.equal(menuRows(f).get('Lift layers')!.disabled, true,
      'a Lottie is vector, but its layers are JSON - the enumerator would refuse it anyway');
  } finally { f.destroy(); }

  const g = mount([box({ image: svgRef() }), box({ id: 'b', x: 600, image: svgRef() })]);
  try {
    // Marquee both, then right-click one of them.
    g.canvasEl.dispatchEvent(pointerEvent('pointerdown', 50, 50));
    g.canvasEl.dispatchEvent(pointerEvent('pointermove', 950, 500));
    g.canvasEl.dispatchEvent(pointerEvent('pointerup', 950, 500));
    rightClick(g, 200, 200);
    assert.equal(menuRows(g).get('Lift layers')!.disabled, true,
      'two stacks at once has no defined ordering - one box, one lift');
  } finally { g.destroy(); }
});

test('a tool with NO image field never offers it - progressive capability, not a branch', () => {
  const cfg = canvasCfg();
  delete cfg.imageField;
  const f = mount([box()], cfg);
  try {
    rightClick(f, 200, 200);
    assert.equal(menuRows(f).has('Lift layers'), false,
      'there would be nowhere to put the derived documents');
  } finally { f.destroy(); }
});

test('the More panel carries it too - and only when this selection can be lifted', () => {
  const f = mount([box({ image: svgRef() })]);
  try {
    f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 200, 200));
    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 200, 200));
    const more = f.stageEl.querySelector<HTMLButtonElement>('[data-cx="more"]');
    assert.ok(more, 'the object bar has a More button');
    click(more!);
    assert.ok(f.stageEl.querySelector('[data-mp-lift]'),
      'a user who never right-clicks would otherwise never meet the feature');
  } finally { f.destroy(); }

  const g = mount([box({ image: pngRef() })]);
  try {
    g.canvasEl.dispatchEvent(pointerEvent('pointerdown', 200, 200));
    g.canvasEl.dispatchEvent(pointerEvent('pointerup', 200, 200));
    click(g.stageEl.querySelector<HTMLButtonElement>('[data-cx="more"]')!);
    assert.equal(g.stageEl.querySelector('[data-mp-lift]'), null,
      'a dead row among live controls reads as broken; the panel is rebuilt per open '
      + 'so it has no constant-height promise to keep');
  } finally { g.destroy(); }
});

// ══ the dialog ════════════════════════════════════════════════════════════════

/** Right-click the box, press "Lift layers", and let the enumeration land. */
async function openDialog(f: Fixture): Promise<HTMLElement> {
  rightClick(f, 200, 200);
  click(menuRows(f).get('Lift layers')!);
  await settle();
  const p = f.stageEl.querySelector<HTMLElement>('.fc-lift-panel');
  assert.ok(p, 'the confirm dialog opened');
  return p!;
}

test('the reading state is a STATE: busy while it works, one live line, focus kept inside', async () => {
  (globalThis as Record<string, unknown>).__liftSvg = ART;
  uploads.length = 0;
  const f = mount([box({ image: svgRef() })]);
  try {
    // Open it WITHOUT settling, so the reading stage is observed rather than inferred.
    rightClick(f, 200, 200);
    click(menuRows(f).get('Lift layers')!);
    const p = f.stageEl.querySelector<HTMLElement>('.fc-lift-panel')!;
    assert.ok(p, 'the panel is up immediately - the read is what takes time, not the panel');
    assert.equal(p.getAttribute('aria-busy'), 'true', 'and it says it is working');
    assert.equal(dom.window.document.activeElement, p,
      'focus goes IN on the gesture that opened it, so the dialog’s name and its '
      + 'reading sentence are what gets read - and every later move is within it');
    const msg = p.querySelector<HTMLElement>('[data-lift-msg]')!;
    assert.equal(msg.getAttribute('role'), 'status');
    assert.equal(msg.getAttribute('aria-live'), 'polite');
    assert.match(msg.textContent || '', /Reading/);

    await settle();
    assert.equal(p.getAttribute('aria-busy'), null, 'the work is over, so the state is too');
    assert.equal(p.querySelector('[data-lift-msg]'), msg,
      'the SAME node - the outcome is a change to a mounted live region, not a new '
      + 'region announced to nobody');
    assert.match(msg.textContent || '', /3 layers found/);
    assert.equal(dom.window.document.activeElement, p.querySelector('[data-lift-yes]'),
      'focus lands on the confirm button, which is inside the panel focus was already in');
  } finally { f.destroy(); }
});

test('a user who walks away while it reads keeps their focus', async () => {
  (globalThis as Record<string, unknown>).__liftSvg = ART;
  uploads.length = 0;
  const f = mount([box({ image: svgRef() })]);
  const elsewhere = dom.window.document.createElement('button');
  dom.window.document.body.appendChild(elsewhere);
  try {
    rightClick(f, 200, 200);
    click(menuRows(f).get('Lift layers')!);
    // Mid-read, the user goes somewhere else. A control that appears after an await has
    // no claim on where they went while it loaded.
    elsewhere.focus();
    await settle();
    const p = f.stageEl.querySelector<HTMLElement>('.fc-lift-panel')!;
    assert.ok(p.querySelector('[data-lift-yes]'), 'the plan rendered as usual');
    assert.equal(dom.window.document.activeElement, elsewhere,
      'and it did not yank focus out of what they had moved to');
  } finally { elsewhere.remove(); f.destroy(); }
});

test('the dialog states the count, lists every layer, and asks - it does not act', async () => {
  (globalThis as Record<string, unknown>).__liftSvg = ART;
  uploads.length = 0;
  const f = mount([box({ image: svgRef() })]);
  try {
    const before = f.writes();
    const p = await openDialog(f);
    assert.match(p.textContent || '', /Lift layers/);
    assert.match(p.textContent || '', /3 layers found/, 'the section 7 headline, verbatim');
    const rows = [...p.querySelectorAll('.fc-lift-row')];
    assert.equal(rows.length, 3, 'one row per layer');
    assert.match(rows[0]!.textContent || '', /Layer 1/, 'an INDEX, never a name out of the file');
    assert.match(rows[1]!.textContent || '', /1 shape/, 'the count is what tells layers from leaves');
    // A PREVIEW, not a control: an unticked layer would have nowhere to go, so v1 asks
    // yes-or-no to the whole plan (see askLiftLayers).
    assert.equal(p.querySelector('input[type="checkbox"]'), null);
    assert.equal(p.querySelector('img'), null, 'no thumbnails in v1');
    assert.equal(f.writes(), before, 'nothing is written until the user confirms');
    assert.equal(uploads.length, 0, 'and nothing is stored, either');
  } finally { f.destroy(); }
});

test('confirming writes the model exactly ONCE - the whole lift is one undo step', async () => {
  (globalThis as Record<string, unknown>).__liftSvg = ART;
  uploads.length = 0;
  const f = mount([box({ image: svgRef(), bg: '#ff0000', text: 'Caption' }), box({ id: 'z', x: 700 })]);
  try {
    const p = await openDialog(f);
    const before = f.writes();
    click(p.querySelector<HTMLButtonElement>('[data-lift-yes]')!);
    await settle();

    assert.equal(f.writes() - before, 1,
      'ONE commit: one ⌘Z puts the original box back, whatever N was');
    const rows = f.boxes() as Array<Record<string, unknown>>;
    assert.equal(rows.length, 4, 'three lifted rows replaced the one source, plus the untouched box');
    assert.equal(rows[3]!.id, 'z', 'and the lift kept its place in the array - array order IS z-order');

    const lifted = rows.slice(0, 3);
    // P3.2's eff-band ladder, not a fixed 40 px step: three layers get three full
    // rungs of 2 % magnification each, which is z 0 / 23.53 / 46.15 at P = 1200.
    assert.deepEqual(lifted.map((r) => r.z), [0, 23.53, 46.15], 'section 7’s auto-stagger, through liftRows');
    assert.deepEqual(lifted.map((r) => r.shadow), ['depth', 'depth', 'depth']);
    const groups = new Set(lifted.map((r) => r.group));
    assert.equal(groups.size, 1, 'one shared group, so the stack selects and moves as one');
    assert.ok([...groups][0], 'and it is a real id, not the empty string');
    assert.equal(new Set(lifted.map((r) => r.id)).size, 3, 'three distinct ids');
    // P3.2 keeps THIS box full-stage on purpose: it has a background fill and a
    // caption, which `liftRows` leaves on the bottom and top rows - and a
    // background confined to one layer's ink is not a background. `liftCanCrop`
    // says so before the documents are derived, so the documents are uncropped too
    // (asserted below: every one still carries the source's own viewBox).
    for (const r of lifted) {
      assert.equal(r.x, 100, 'same geometry - the derived documents are in ROOT coordinates');
      assert.equal(r.y, 100);
      assert.equal(r.w, 400);
      assert.equal(r.h, 300);
    }

    // The image field carries a REF, never the bare URL string: the engine resolves a
    // block's asset sub-fields by `.id` and the tool hook reads `image.url`, so a
    // string would render nothing and would not survive a reload.
    for (const r of lifted) {
      const img = r.image as { id?: string; url?: string; type?: string };
      assert.equal(typeof img, 'object');
      assert.match(String(img.id), /^user\/upload\//);
      assert.equal(img.type, 'vector');
    }

    // Every derived document went through the ONE ingest funnel, as a real SVG file.
    assert.equal(uploads.length, 3);
    for (const u of uploads) {
      assert.equal(u.type, 'image/svg+xml', 'the MIME is what makes the picker sanitise + record it as SVG');
      assert.match(u.name, /^diagram-layer-\d\.svg$/, 'named from the source, numbered by layer');
      assert.match(u.text, /^<svg /, 'a STANDALONE document per layer');
      assert.match(u.text, /viewBox="0 0 100 100"/, 'in the source’s own root coordinates');
      assert.match(u.text, /<defs>/, 'carrying the whole defs, so cross-references still resolve');
    }
  } finally { f.destroy(); }
});

test('a plain image box lifts into CONTENT-SIZED rows - the shadow follows the ink', async () => {
  (globalThis as Record<string, unknown>).__liftSvg = ART;
  uploads.length = 0;
  // No background, no caption: nothing else rides on the bottom or top row, so the
  // engine crops each document to its ink and every row is cut to match (plans/104
  // P3.2 - a full-stage row makes `shadow: depth` a full-frame gaussian, which is
  // what aborted the encoder watchdog at eleven layers).
  const f = mount([box({ image: svgRef() })]);
  try {
    const p = await openDialog(f);
    click(p.querySelector<HTMLButtonElement>('[data-lift-yes]')!);
    await settle();
    const lifted = (f.boxes() as Array<Record<string, unknown>>).slice(0, 3);

    // viewBox 0 0 100 100 inside a 400×300 box at `contain` lands 300×300 at x=150,
    // y=100. The circles group's ink is 15..80 × 60..80, padded by 1 → 14,59 67×22
    // in user units → 192,277 201×66 on the canvas.
    assert.deepEqual(
      [lifted[1]!.x, lifted[1]!.y, lifted[1]!.w, lifted[1]!.h], [192, 277, 201, 66],
      'the row is its own ink, mapped through the source box',
    );
    assert.equal(lifted[1]!.fit, 'fill', 'a cropped row stretches its crop over its rect - an identity');
    for (const r of lifted) {
      assert.ok(
        Number(r.x) >= 100 && Number(r.y) >= 100
        && Number(r.x) + Number(r.w) <= 500.001 && Number(r.y) + Number(r.h) <= 400.001,
        'and every row stays inside the box it came out of',
      );
    }
    // The document and the row are cut to the SAME rect - that is the whole
    // correctness argument, and a mismatch renders the layer blown up.
    assert.match(uploads[1]!.text, /viewBox="14 59 67 22"/, 'the document carries the crop');
    assert.match(uploads[1]!.text, /width="67" height="22"/, 'and its intrinsic size matches it');
  } finally { f.destroy(); }
});

test('cancelling changes nothing at all', async () => {
  (globalThis as Record<string, unknown>).__liftSvg = ART;
  uploads.length = 0;
  const f = mount([box({ image: svgRef() })]);
  try {
    const p = await openDialog(f);
    const before = f.writes();
    click(p.querySelector<HTMLButtonElement>('[data-lift-no]')!);
    await settle();
    assert.equal(f.writes(), before);
    assert.equal(uploads.length, 0);
    assert.equal(f.stageEl.querySelector('.fc-lift-panel'), null, 'and the dialog is gone');
  } finally { f.destroy(); }
});

test('a single-layer drawing is refused in words, with nothing to confirm', async () => {
  (globalThis as Record<string, unknown>).__liftSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
  uploads.length = 0;
  const f = mount([box({ image: svgRef() })]);
  try {
    const p = await openDialog(f);
    assert.equal(p.querySelector('[data-lift-yes]'), null, 'there is nothing to say yes to');
    assert.ok(p.querySelector('[data-lift-close]'), 'just a way out');
    assert.match(p.textContent || '', /single layer|nothing to lift/i,
      'and the reason, in words - lifting one layer adds a box and a group for no gain');
    assert.equal(uploads.length, 0);
  } finally { f.destroy(); }
});

test('artwork that cannot be read says so instead of failing silently', async () => {
  (globalThis as Record<string, unknown>).__liftFetchFails = true;
  const f = mount([box({ image: svgRef() })]);
  try {
    const p = await openDialog(f);
    assert.match(p.textContent || '', /could not be read/i);
    assert.equal(p.querySelector('[data-lift-yes]'), null);
  } finally {
    (globalThis as Record<string, unknown>).__liftFetchFails = false;
    f.destroy();
  }
});

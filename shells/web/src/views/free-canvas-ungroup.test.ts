// SPDX-License-Identifier: MPL-2.0
/**
 * Ungroup on an imported vector - the SURFACE.
 *
 * An SVG dropped into Design arrives as one image box, and to the person who drew it
 * that box is a group: it was made of parts. So Ungroup (the menu entry, ⇧⌘G) on a box
 * holding an SVG takes it apart - one box per layer of the drawing, cropped to its ink,
 * sharing a fresh group tag - and a second Ungroup dissolves that tag the way it always
 * has. What is pinned here is the wiring between the existing pieces (the engine's
 * `enumerateSvgLayers`, `liftRows` with `flat: true`, the ONE ingest funnel):
 *
 *   • WHERE the action is live - the right-click Ungroup entry enables on a lone SVG
 *     box with no group, stays disabled on a photograph;
 *   • the RESULT itself - N rows, one group, NO depth ladder and NO `shadow: depth`
 *     (that is Lift layers' business, not an ungroup's), every row carrying a real ref;
 *   • the law: the whole ungroup is ONE write, so one ⌘Z puts the picture back;
 *   • the peel repeats: Ungroup again clears the tag, in one more write;
 *   • a single-shape SVG writes nothing and says why.
 *
 * Same stubs as free-canvas-lift.test.ts - the fetch+sanitise edge and the asset store
 * are replaced at the module loader; everything else is the real editor.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-ungroup.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';

interface FakeFile { name: string; type: string; text: string }
const uploads: FakeFile[] = [];
(globalThis as Record<string, unknown>).__ungroupUploads = uploads;
(globalThis as Record<string, unknown>).__ungroupSvg = '';

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    if (url.endsWith('/views/anim-svg-mount.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: 'export async function fetchAnimSvg(){ return globalThis.__ungroupSvg; }',
      };
    }
    if (url.endsWith('/views/picker.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: `export async function storeUserUpload(host, file){
          const text = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result));
            r.onerror = () => rej(r.error);
            r.readAsText(file);
          });
          globalThis.__ungroupUploads.push({ name: file.name, type: file.type, text });
          const n = globalThis.__ungroupUploads.length;
          return { source: 'user', id: 'user/upload/' + n + '-' + file.name, type: 'vector',
                   format: 'svg', url: 'blob:part-' + n };
        }`,
      };
    }
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
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
  + '<g><rect x="0" y="0" width="50" height="50" fill="#f00"/></g>'
  + '<g><circle cx="70" cy="70" r="10"/><circle cx="20" cy="70" r="5"/></g>'
  + '<path d="M0 0 L10 10"/></svg>';
/** One shape, nothing to take apart. */
const LONE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="50" height="50"/></svg>';

const svgRef = (name = 'diagram.svg') =>
  ({ source: 'library', id: 'lolly/art/diagram', type: 'vector', format: 'svg', url: 'https://x.test/diagram.svg', meta: { name } });
const pngRef = () =>
  ({ source: 'user', id: 'user/upload/photo.png', type: 'raster', format: 'png', url: 'https://x.test/photo.png' });

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

function pointerEvent(type: string, x: number, y: number): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}
const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
function rightClick(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
}
function menuRows(f: Fixture): Map<string, HTMLButtonElement> {
  const out = new Map<string, HTMLButtonElement>();
  for (const b of f.stageEl.querySelectorAll<HTMLButtonElement>('.fc-context-menu button')) {
    const label = (b.textContent || '').trim();
    if (label && !out.has(label)) out.set(label, b);
  }
  return out;
}
/** Select by a plain click on the box, then ⇧⌘G on the window - the editor's own chord. */
function selectBox(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', x, y));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', x, y));
}
function pressUngroup(): void {
  dom.window.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'G', metaKey: true, shiftKey: true, bubbles: true, cancelable: true }));
}

const box = (extra: Record<string, unknown> = {}): Box =>
  ({ id: 'a', x: 100, y: 100, w: 400, h: 300, rot: 0, ...extra } as Box);

// ══ where the action is live ═══════════════════════════════════════════════════

test('Ungroup is live on a lone SVG box with no group, and dead on a photograph', () => {
  const f = mount([box({ image: svgRef() })]);
  try {
    rightClick(f, 200, 200);
    const ungroup = menuRows(f).get('Ungroup');
    assert.ok(ungroup, 'the entry is in the menu');
    assert.equal(ungroup!.disabled, false, 'a vector is a group in every sense but the field');
  } finally { f.destroy(); }

  const g = mount([box({ image: pngRef() })]);
  try {
    rightClick(g, 200, 200);
    assert.equal(menuRows(g).get('Ungroup')!.disabled, true, 'a photograph has no parts to separate');
  } finally { g.destroy(); }
});

// ══ the ungroup ═══════════════════════════════════════════════════════════════════

test('Ungroup on an SVG box takes it apart: N flat rows in one group, ONE write', async () => {
  (globalThis as Record<string, unknown>).__ungroupSvg = ART;
  uploads.length = 0;
  const f = mount([box({ image: svgRef(), z: 12, shadow: 'box' }), box({ id: 'z', x: 700 })]);
  try {
    const before = f.writes();
    rightClick(f, 200, 200);
    click(menuRows(f).get('Ungroup')!);
    await settle();

    assert.equal(f.writes() - before, 1, 'ONE commit: one ⌘Z puts the picture back, whatever N was');
    const rows = f.boxes() as Array<Record<string, unknown>>;
    assert.equal(rows.length, 4, 'three parts replaced the one source, plus the untouched box');
    assert.equal(rows[3]!.id, 'z', 'in place - array order IS z-order');
    const parts = rows.slice(0, 3);

    // Flat: an ungroup is not a lift. The source's own depth and shadow ride along
    // unchanged on every part - no ladder, no `depth` shadow.
    assert.deepEqual(parts.map((r) => r.z), [12, 12, 12], 'no depth ladder');
    assert.deepEqual(parts.map((r) => r.shadow), ['box', 'box', 'box'], 'the source’s own shadow');
    const groups = new Set(parts.map((r) => r.group));
    assert.equal(groups.size, 1, 'one shared group, so the parts still select and move as one');
    assert.ok([...groups][0], 'and it is a real tag, not the empty string');
    assert.equal(new Set(parts.map((r) => r.id)).size, 3, 'three distinct ids');

    // Cropped to their ink (nothing on this box forbids it): three different rects,
    // each inside the source's 400×300 at (100,100).
    const rects = new Set(parts.map((r) => `${r.x},${r.y},${r.w},${r.h}`));
    assert.equal(rects.size, 3, 'each part sits where its own ink was');
    for (const r of parts) {
      assert.ok(Number(r.x) >= 100 && Number(r.y) >= 100, `${r.id} starts inside the source`);
      assert.ok(Number(r.x) + Number(r.w) <= 500.01 && Number(r.y) + Number(r.h) <= 400.01, `${r.id} ends inside the source`);
      const img = r.image as { id?: string; type?: string };
      assert.equal(typeof img, 'object', 'a REF, never a bare URL string');
      assert.match(String(img.id), /^user\/upload\//);
      assert.equal(img.type, 'vector');
    }

    assert.equal(uploads.length, 3, 'every part went through the ONE ingest funnel');
    for (const u of uploads) {
      assert.equal(u.type, 'image/svg+xml');
      assert.match(u.name, /^diagram-part-\d\.svg$/, 'named from the source, numbered by part');
      assert.match(u.text, /^<svg /, 'a STANDALONE document per part');
    }
  } finally { f.destroy(); }
});

test('Ungroup again dissolves the tag - the peel repeats, one write each', async () => {
  (globalThis as Record<string, unknown>).__ungroupSvg = ART;
  uploads.length = 0;
  const f = mount([box({ image: svgRef() })]);
  try {
    selectBox(f, 200, 200);
    pressUngroup();
    await settle();
    assert.equal(f.writes(), 1, '⇧⌘G took the vector apart');
    const parts = f.boxes() as Array<Record<string, unknown>>;
    assert.equal(parts.length, 3);
    assert.ok(parts.every((r) => r.group === parts[0]!.group && r.group), 'all in one group');

    // The parts are the selection now; the chord again clears the tag.
    pressUngroup();
    await settle();
    assert.equal(f.writes(), 2, 'one more write');
    assert.deepEqual((f.boxes() as Array<Record<string, unknown>>).map((r) => r.group), ['', '', ''], 'loose parts');
    assert.equal(f.boxes().length, 3, 'nothing was taken apart further by that press');
  } finally { f.destroy(); }
});

test('a single-shape SVG writes nothing, and says so', async () => {
  (globalThis as Record<string, unknown>).__ungroupSvg = LONE;
  uploads.length = 0;
  const f = mount([box({ image: svgRef() })]);
  try {
    rightClick(f, 200, 200);
    click(menuRows(f).get('Ungroup')!);
    await settle();
    assert.equal(f.writes(), 0, 'one shape is not a group');
    assert.equal(uploads.length, 0, 'and nothing was stored');
    assert.match(f.stageEl.textContent || '', /single shape/, 'the flash says why');
  } finally { f.destroy(); }
});

test('a tool with no group field never takes a vector apart - nowhere to keep the parts together', async () => {
  (globalThis as Record<string, unknown>).__ungroupSvg = ART;
  uploads.length = 0;
  const cfg = canvasCfg();
  delete cfg.groupField;
  const f = mount([box({ image: svgRef() })], cfg);
  try {
    selectBox(f, 200, 200);
    pressUngroup();
    await settle();
    assert.equal(f.writes(), 0);
    assert.equal(uploads.length, 0);
  } finally { f.destroy(); }
});

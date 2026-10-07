// SPDX-License-Identifier: MPL-2.0
/**
 * A viewer of a team Design document cannot change it from the Design editor (plan 75
 * G2, review of PR-L3). The sidebar's read-only controls are only one surface: the
 * Design inspector, top bar, ports, live views, the canvas popovers and the stage all
 * write through the mounted runtime's `setInput` without asking lib/input-policy.ts.
 * views/tool/setup.ts therefore installs `guardDocumentEdits` around that `setInput`,
 * the one place every editor's write arrives, and this suite drives the real inspector
 * column through a runtime guarded the same way.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/design-viewer-edits.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';
import type { ArtboardPort, ModelPort, SelectionPort } from './design-ports.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { Event: typeof Event };
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'KeyboardEvent', 'Event', 'MouseEvent', 'Node', 'getComputedStyle', 'AbortController']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
(dom.window as unknown as { CSS: { escape(s: string): string } }).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) };
globalThis.CSS = (dom.window as unknown as { CSS: typeof globalThis.CSS }).CSS;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;
const fire = (el: EventTarget, type: string): void => { el.dispatchEvent(new W.Event(type, { bubbles: true })); };

const { initDesignInspector } = await import('./design-inspector.ts');
const { guardDocumentEdits, setDocumentReadOnly, clearDocumentReadOnly, _clearInputPoliciesForTests } = await import('../lib/input-policy.ts');

const CFG = {
  idField: 'id', kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
  fillField: 'bg', opacityField: 'opacity', textField: 'text', fontSizeField: 'fontSize', labelField: 'name', orderField: 'order',
} as unknown as BoxFieldConfig;
const FRAME = { frameField: 'frame', frameKind: 'frame', orderField: 'order', labelField: 'name' };
const BOXES: Box[] = [
  { id: 'f1', kind: 'frame', name: 'Title', x: 0, y: 0, w: 1600, h: 900, order: 0, bg: '#ffffff' },
  { id: 'b1', kind: 'box', frame: 'f1', x: 40, y: 60, w: 300, h: 200, bg: '#123456', opacity: 100 },
];
const TOOL = 'design';

/**
 * The mounted Design document: an in-memory runtime whose `setInput` carries the guard
 * exactly as views/tool/setup.ts `wrapSetInput` installs it, and the inspector's model
 * port writing through that runtime as views/free-canvas.ts's does.
 */
function mountDesign() {
  document.body.innerHTML = '<div id="stage"><div id="tool-canvas"></div></div>';
  const stageEl = document.getElementById('stage')!;
  const canvasEl = document.getElementById('tool-canvas')!;
  const values: Record<string, unknown> = { boxes: BOXES.map((b) => ({ ...b })), background: '#0b1220' };
  const subs: Array<() => void> = [];
  const emit = (): void => { for (const f of subs.slice()) f(); };
  const writes: Array<[string, unknown]> = [];
  const state = { replaying: false, refreshes: 0, refused: 0 };
  const base = async (id: string, value: unknown): Promise<void> => { writes.push([id, value]); values[id] = value; emit(); };
  const runtime = {
    setInput: guardDocumentEdits(TOOL, base, () => state.replaying, () => { state.refreshes += 1; emit(); }),
  };
  const rows = (): Box[] => values.boxes as Box[];
  const model: ModelPort = {
    blockId: 'boxes', cfg: CFG, frame: FRAME,
    getBoxes: rows,
    commit: (next) => { void runtime.setInput('boxes', next); },
    setField: (ids, field, value) => {
      const want = new Set(ids);
      void runtime.setInput('boxes', rows().map((b) => (want.has(String(b.id)) ? { ...b, [field]: value } : b)));
    },
    subscribe: (cb) => { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; },
    getInput: (id) => values[id],
    setInput: (id, value) => { void runtime.setInput(id, value); },
  };
  let selIds: string[] = [];
  const selSubs: Array<(ids: string[]) => void> = [];
  const selection: SelectionPort = {
    get: () => [...selIds],
    set: (ids) => { selIds = [...ids]; for (const f of selSubs.slice()) f([...selIds]); },
    onChange: (cb) => { selSubs.push(cb); return () => { const i = selSubs.indexOf(cb); if (i >= 0) selSubs.splice(i, 1); }; },
  };
  const artboard: ArtboardPort = { active: () => 'f1', focus: () => {}, onChange: () => () => {} };
  const handle = initDesignInspector({
    stageEl, canvasEl, model, selection, artboard,
    actions: { pickImage: () => {}, openGradient: () => {}, arrange: () => {}, openTimeline: () => {}, openStudio: () => {} },
    fields: [],
    fonts: { options: () => [['sans', 'Sans']], weights: () => [['400', 'Regular']] },
  });
  stageEl.appendChild(handle.el);
  return { handle, el: handle.el, values, writes, state, runtime, select: (ids: string[]) => selection.set(ids), rows };
}

/** Commit an Opacity value from the inspector's slider, as a release does. */
function setOpacity(d: ReturnType<typeof mountDesign>, value: string): void {
  const rng = d.el.querySelector<HTMLInputElement>('input[type="range"][data-fld="opacity"]')!;
  rng.value = value;
  fire(rng, 'input');
  fire(rng, 'change');
}

test('an inspector edit of a viewer\'s Design document is refused at the runtime, and the layer\'s owner is told', () => {
  _clearInputPoliciesForTests();
  const d = mountDesign();
  d.select(['b1']);
  // An editor's edit is applied.
  setOpacity(d, '55');
  assert.equal(d.rows().find((b) => b.id === 'b1')!.opacity, 55, 'an editable document takes the edit');

  // The document becomes view-only for this person (org/team-scope.ts sets the layer).
  setDocumentReadOnly(TOOL, 'View only', () => { d.state.refused += 1; });
  const before = d.writes.length;
  d.select(['b1']);
  setOpacity(d, '20');
  const fill = d.el.querySelector<HTMLInputElement>('[data-color-field="fc-insp-fill"] .color-input[data-color-hex]');
  if (fill) { fill.value = '#ff0000'; fire(fill, 'input'); }
  assert.equal(d.writes.length, before, 'nothing reaches the model');
  assert.equal(d.rows().find((b) => b.id === 'b1')!.opacity, 55, 'the box keeps its value');
  assert.equal(d.rows().find((b) => b.id === 'b1')!.bg, '#123456');
  assert.ok(d.state.refused >= 1, 'whoever set the layer hears of the refusal (the view-only toast)');
  assert.ok(d.state.refreshes >= 1, 'the panels are put back on the model\'s values');

  // A document-level write (the canvas background) is refused the same way.
  void d.runtime.setInput('background', '#ffffff');
  assert.equal(d.values.background, '#0b1220');

  // An undo or redo replays states the document already had: it passes.
  d.state.replaying = true;
  void d.runtime.setInput('background', '#000000');
  d.state.replaying = false;
  assert.equal(d.values.background, '#000000');

  // Lifted (the mount ended, or the person may edit now): edits land again.
  clearDocumentReadOnly(TOOL);
  setOpacity(d, '30');
  assert.equal(d.rows().find((b) => b.id === 'b1')!.opacity, 30);
  d.handle.destroy();
  _clearInputPoliciesForTests();
});

test('the guard is the mounted tool\'s setInput (views/tool/setup.ts), so every editor reaches it', () => {
  const dir = join(import.meta.dirname, 'tool');
  const setup = readFileSync(join(dir, 'setup.ts'), 'utf8');
  const wrap = setup.slice(setup.indexOf('export function wrapSetInput('));
  assert.match(wrap, /runtime\.setInput = guardDocumentEdits\(tview\.toolId, \(id: string, value: InputValue, options\?: InputWriteOptions\) => \{/,
    'the undo-recording setInput is wrapped by the guard');
  assert.match(wrap, /\}, \(\) => tview\.applyingHistory, \(\) => runtime\.refresh\(\)\);/, 'undo replays pass; a refusal refreshes');
  // Nothing else in the tool view replaces runtime.setInput after the guard does (the
  // collab plumbing wraps the setter from lib/, outside the view, and calls through).
  const others = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'setup.ts')
    .filter((f) => /runtime\.setInput\s*=(?!=)/.test(readFileSync(join(dir, f), 'utf8')));
  assert.deepEqual(others, []);
});

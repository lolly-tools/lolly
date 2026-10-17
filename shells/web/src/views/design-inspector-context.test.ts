// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system context strip in Design's Document controls (plan 286 section 5.1).
 *
 * The inspector's Style & look section shows which design system, render version and
 * theme choices the document draws with, above the Theme row the choices are made in.
 * This file pins the column half: the strip is drawn from the theme port, it says
 * whether the document chose its own theme choices, its two actions go back through
 * the port and never through the document's inputs, and it repaints when the choice
 * changes. The port itself is tested in lib/document-theme-context.test.ts.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/design-inspector-context.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initDesignInspector } from './design-inspector.ts';
import type { ArtboardPort, ModelPort, SelectionPort } from './design-ports.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';
import type { TokensSnapshot } from '@lolly-tools/core/host-v1';
import type { DocumentThemePort, DocumentTokenContext, ThemeSelection } from '../lib/document-theme.ts';

// ── jsdom bootstrap (design-inspector.test.ts's, trimmed to this column) ──────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'KeyboardEvent', 'Event', 'MouseEvent', 'Node', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
(dom.window as unknown as { CSS: { escape(s: string): string } }).CSS = {
  escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
};
globalThis.CSS = (dom.window as unknown as { CSS: typeof globalThis.CSS }).CSS;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
  dom.window.setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

// ── the document under test ───────────────────────────────────────────────────

const CFG = {
  idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h',
  fillField: 'bg', textField: 'text',
} as unknown as BoxFieldConfig;

const SNAPSHOT: TokensSnapshot = {
  document: {
    base: {}, light: {}, dark: {},
    $themes: [{ name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } }, { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } }],
  },
  system: { id: 'starter', label: 'Starter', active: true, locked: false, source: 'shipped', headId: null },
  version: 'latest',
  selection: { choices: { '': 'light' } },
};

/** A theme port over one light/dark group, recording what the strip asks of the port. */
function themePort(opts: { selection?: ThemeSelection; groups?: boolean; context?: boolean } = {}) {
  let selection = opts.selection;
  const calls: string[] = [];
  const port: DocumentThemePort = {
    groups: () => (opts.groups === false ? [] : [{
      id: '', label: 'Theme', options: [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }], active: selection?.[''] ?? 'light',
    }]),
    choose: async (group, option) => { calls.push(`choose ${option}`); selection = { [group]: option }; },
    ...(opts.context === false ? {} : {
      context: (): DocumentTokenContext => (selection ? { snapshot: SNAPSHOT, selection } : { snapshot: SNAPSHOT }),
      inspect: async () => { calls.push('inspect'); },
      follow: async () => { calls.push('follow'); selection = undefined; },
    }),
  };
  return { port, calls };
}

function mount(theme: DocumentThemePort) {
  document.body.innerHTML = '<div id="stage"><div id="tool-canvas"></div></div>';
  const stageEl = document.getElementById('stage')!;
  const canvasEl = document.getElementById('tool-canvas')!;
  canvasEl.style.width = '1600px';
  canvasEl.style.height = '900px';
  let rows: Box[] = [];
  const subs: Array<() => void> = [];
  const inputs = new Map<string, unknown>([['background', '#0b1220']]);
  const writes: string[] = [];
  const model: ModelPort = {
    blockId: 'boxes',
    cfg: CFG,
    frame: null,
    getBoxes: () => rows,
    commit: (next) => { writes.push('commit'); rows = next; subs.slice().forEach((f) => { f(); }); },
    setField: () => { writes.push('setField'); },
    subscribe: (cb) => { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; },
    getInput: (id) => inputs.get(id),
    setInput: (id, value) => { writes.push(`setInput ${id}`); inputs.set(id, value); subs.slice().forEach((f) => { f(); }); },
  };
  // Nothing selected, so the column shows the Document section.
  const selection: SelectionPort = { get: () => [], set: () => {}, onChange: () => () => {} };
  const artboard: ArtboardPort = { active: () => '', focus: () => {}, onChange: () => () => {} };
  const handle = initDesignInspector({
    stageEl, canvasEl, model, selection, artboard, theme,
    actions: { pickImage: () => {}, openGradient: () => {}, arrange: () => {}, openTimeline: () => {}, openStudio: () => {} },
  });
  const slot = document.createElement('div');
  slot.className = 'edge-dock-slot';
  stageEl.appendChild(slot);
  slot.appendChild(handle.el);
  return {
    el: handle.el,
    writes,
    strip: () => handle.el.querySelector<HTMLElement>('[data-sec="look"] [data-token-context]'),
    themeRow: () => handle.el.querySelector<HTMLElement>('.fc-seg[data-seg="lolly-doc-theme-0"]'),
    sync: () => handle.sync(),
    destroy: () => { handle.destroy(); document.body.innerHTML = ''; },
  };
}

const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

// ── tests ─────────────────────────────────────────────────────────────────────

test('Style & look shows the context strip above the Theme row, saying what the document draws with', () => {
  const h = mount(themePort().port);
  try {
    const strip = h.strip();
    assert.ok(strip, 'the strip is in Style & look');
    assert.equal(strip!.getAttribute('role'), 'group');
    assert.equal(strip!.getAttribute('aria-label'), 'Design system context');
    assert.ok(strip!.classList.contains('token-context-strip--compact'), 'the denser layout for a panel column');
    const text = strip!.textContent!;
    for (const part of ['Starter', 'Render version: Latest', 'Bundled with this app', 'Follows the design system', 'Inspect tokens', 'Source and fallbacks']) assert.match(text, new RegExp(part));
    assert.equal(strip!.querySelector('[data-token-context-follow]'), null, 'a document following the design system has nothing to follow');
    assert.ok(strip!.compareDocumentPosition(h.themeRow()!) & 4, 'the strip comes before the Theme row');
  } finally { h.destroy(); }
});

test('a document with its own choices says so, and both strip actions go to the port, never to the inputs', async () => {
  const theme = themePort({ selection: { '': 'dark' } });
  const h = mount(theme.port);
  try {
    const strip = h.strip()!;
    assert.match(strip.querySelector('[data-token-context-scope]')!.textContent!, /Chosen for this document/);
    assert.match(strip.querySelector('p')!.textContent!, /Theme: Dark/);
    strip.querySelector<HTMLButtonElement>('[data-token-context-inspect]')!.click();
    strip.querySelector<HTMLButtonElement>('[data-token-context-follow]')!.click();
    await settle();
    assert.deepEqual(theme.calls, ['inspect', 'follow']);
    assert.deepEqual(h.writes, [], 'no document input write, so no undo step and no design-system write');
  } finally { h.destroy(); }
});

test('the strip repaints when the document choice changes', async () => {
  const theme = themePort();
  const h = mount(theme.port);
  try {
    assert.match(h.strip()!.textContent!, /Follows the design system/);
    [...h.themeRow()!.querySelectorAll<HTMLButtonElement>('.fc-seg-btn')][1]!.click();
    await settle();
    assert.deepEqual(theme.calls, ['choose dark']);
    h.sync();
    assert.match(h.strip()!.textContent!, /Chosen for this document/);
    h.strip()!.querySelector<HTMLButtonElement>('[data-token-context-follow]')!.click();
    await settle();
    h.sync();
    assert.match(h.strip()!.textContent!, /Follows the design system/);
  } finally { h.destroy(); }
});

test('one theme still shows the strip; a port with no context shows only the Theme row', () => {
  const single = mount(themePort({ groups: false }).port);
  try {
    assert.ok(single.strip(), 'a design system with nothing to choose still says what the document draws with');
    assert.equal(single.themeRow(), null);
  } finally { single.destroy(); }
  const bare = mount(themePort({ context: false }).port);
  try {
    assert.equal(bare.strip(), null);
    assert.ok(bare.themeRow());
  } finally { bare.destroy(); }
});

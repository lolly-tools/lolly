// SPDX-License-Identifier: MPL-2.0
/**
 * The Design inspector's Emoji dock row (plan 252, stage B4).
 *
 * The set a document draws its emoji from belongs to the document, so it sits in the
 * Document section beside the canvas size and the background - and it is the SAME
 * control, over the same value, that the tool sidebar mounts. This file pins the dock
 * half of that: the row appears only for a host that offers the port, the shared control
 * is mounted into it in document mode with the value the port reports, a choice goes
 * back through the port, and the control is torn down with the markup that held it.
 *
 * The control itself is doubled here. It is a separate module with its own suite, and
 * this column is deliberately mounted on a bare jsdom stage against fakes.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/design-inspector-emoji.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initDesignInspector } from './design-inspector.ts';
import type { EmojiControlMount, EmojiControlValue, InspectorEmojiPort } from './design-inspector.ts';
import type { ArtboardPort, ModelPort, SelectionPort } from './design-ports.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { EmojiStyleV1 } from '@lolly-tools/core/emoji-v1';

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

const style = (version: string): EmojiStyleV1 => ({
  schemaVersion: 1,
  primary: {
    id: 'community/emoji/twemoji/color-starter',
    pin: { version },
    checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  },
  fallbacks: [],
  metricsPolicy: 'inline-em-v1',
  treatment: { mode: 'original', strengthBps: 0 },
});

interface MountRecord {
  container: HTMLElement;
  mode: string;
  value: EmojiControlValue;
  onChange(next: EmojiControlValue): void;
  destroyed: boolean;
  updates: EmojiControlValue[];
}

/** A stand-in for `mountEmojiStyleControl`, recording what it was mounted with. */
function controlDouble(): { mounts: MountRecord[]; mount: EmojiControlMount } {
  const mounts: MountRecord[] = [];
  const mount: EmojiControlMount = (container, o) => {
    const record: MountRecord = {
      container, mode: o.mode, value: o.value, onChange: o.onChange, destroyed: false, updates: [],
    };
    mounts.push(record);
    container.innerHTML = '<select class="field-select" data-test-emoji-set></select>';
    return {
      update(next) { record.updates.push(next); },
      destroy() { record.destroyed = true; container.innerHTML = ''; },
    };
  };
  return { mounts, mount };
}

interface Harness {
  el: HTMLElement;
  slot(): HTMLElement | null;
  rebuild(): void;
  destroy(): void;
}

function mount(emoji?: InspectorEmojiPort): Harness {
  document.body.innerHTML = '<div id="stage"><div id="tool-canvas"></div></div>';
  const stageEl = document.getElementById('stage')!;
  const canvasEl = document.getElementById('tool-canvas')!;
  canvasEl.style.width = '1600px';
  canvasEl.style.height = '900px';

  let rows: Box[] = [];
  const subs: Array<() => void> = [];
  const inputs = new Map<string, unknown>([['background', '#0b1220']]);
  const model: ModelPort = {
    blockId: 'boxes',
    cfg: CFG,
    // No frame primitive: this column is mounted on a bare document, not a deck.
    frame: null,
    getBoxes: () => rows,
    commit: (next) => { rows = next; subs.slice().forEach((f) => { f(); }); },
    setField: () => {},
    subscribe: (cb) => { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; },
    getInput: (id) => inputs.get(id),
    setInput: (id, value) => { inputs.set(id, value); subs.slice().forEach((f) => { f(); }); },
  };

  // Nothing selected, so the column shows the Document section - where the row lives.
  const selection: SelectionPort = { get: () => [], set: () => {}, onChange: () => () => {} };
  const artboard: ArtboardPort = { active: () => '', focus: () => {}, onChange: () => () => {} };

  const handle = initDesignInspector({
    stageEl, canvasEl, model, selection, artboard,
    actions: { pickImage: () => {}, openGradient: () => {}, arrange: () => {}, openTimeline: () => {}, openStudio: () => {} },
    ...(emoji ? { emoji } : {}),
  });
  const slot = document.createElement('div');
  slot.className = 'edge-dock-slot';
  stageEl.appendChild(slot);
  slot.appendChild(handle.el);

  return {
    el: handle.el,
    slot: () => handle.el.querySelector<HTMLElement>('[data-emoji-slot]'),
    rebuild: () => handle.sync(),
    destroy: () => { handle.destroy(); document.body.innerHTML = ''; },
  };
}

const host = {} as HostV1;

function port(value: EmojiStyleV1 | null, mount: EmojiControlMount, changes: Array<EmojiStyleV1 | null>): InspectorEmojiPort {
  let current = value;
  return {
    host,
    mount,
    value: () => current,
    onChange: (next) => { current = next; changes.push(next); },
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

test('the Document section mounts the shared control, in document mode, on the current value', () => {
  const control = controlDouble();
  const changes: Array<EmojiStyleV1 | null> = [];
  const current = style('17.0.3');
  const h = mount(port(current, control.mount, changes));
  try {
    const slot = h.slot();
    assert.ok(slot, 'the Document section left a slot for the control');
    assert.equal(h.el.querySelector('[data-sec="document"]')?.contains(slot!), true, 'and it is inside Document');
    assert.equal(slot!.getAttribute('aria-label'), 'Emoji', 'the shared control owns the visible heading');

    assert.equal(control.mounts.length, 1, 'the control was mounted once');
    const mounted = control.mounts[0]!;
    assert.equal(mounted.container, slot, 'into the slot');
    assert.equal(mounted.mode, 'document', 'as a document setting, not a device preference');
    assert.equal(mounted.value, current, 'showing the style the document carries');
    assert.ok(slot!.querySelector('[data-test-emoji-set]'), 'the control put its own markup in');
  } finally {
    h.destroy();
  }
});

test('a choice made in the dock goes back through the port', () => {
  const control = controlDouble();
  const changes: Array<EmojiStyleV1 | null> = [];
  const h = mount(port(null, control.mount, changes));
  try {
    const next = style('17.0.4');
    control.mounts[0]!.onChange(next);
    assert.deepEqual(changes, [next], 'the host is told exactly what was chosen');
  } finally {
    h.destroy();
  }
});

test('a rebuild replaces the control and re-reads the value; destroy takes it down', () => {
  const control = controlDouble();
  const changes: Array<EmojiStyleV1 | null> = [];
  const p = port(null, control.mount, changes);
  const h = mount(p);
  try {
    assert.equal(control.mounts[0]!.value, null, 'nothing chosen yet');
    // What a choice made in the SIDEBAR looks like from here: the port's value changed,
    // and the host asks the column to catch up.
    p.onChange(style('17.0.3'));
    h.rebuild();
    assert.equal(control.mounts.length, 2, 'the column mounted a fresh control');
    assert.equal(control.mounts[0]!.destroyed, true, 'and tore the old one down with its markup');
    assert.equal((control.mounts[1]!.value as EmojiStyleV1).primary.pin.version, '17.0.3', 'showing the value the port now reports');
  } finally {
    h.destroy();
  }
  assert.equal(control.mounts[1]!.destroyed, true, 'destroying the column destroys the control');
});

test('a host with no emoji port gets no row at all', () => {
  const h = mount();
  try {
    assert.equal(h.slot(), null, 'no slot');
    assert.equal(h.el.querySelector('[data-test-emoji-set]'), null, 'and nothing mounted');
  } finally {
    h.destroy();
  }
});

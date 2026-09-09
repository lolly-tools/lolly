// SPDX-License-Identifier: MPL-2.0
/**
 * The CANVAS-KEYBOARD OPT-OUT: chrome that puts focusable controls over the Design
 * canvas marks its own root `data-canvas-keys="off"`, and `initFreeCanvas`'s window-level
 * key handler ignores every event that comes from inside such a root.
 *
 * Why it exists: the editor binds its bare-key verbs (Delete, the arrows, the tool
 * letters) on `window`, so a focused <button> in the Design top bar, the right edge dock
 * column or the navigator column was a live canvas surface - Delete on the Export button
 * removed the selected box, an arrow key in a menu nudged it and pushed an undo step.
 * Each of those roots also stops its own keys on the way out, but a panel they host does
 * not, and a menu spawned outside the root is not inside it at all, so the check has to
 * exist on the receiving end too.
 *
 * Two exemptions, matching what those roots already let through by hand: app-wide chords
 * (meta/ctrl) and Escape.
 *
 * Driven through real DOM events against the real `initFreeCanvas`, on the jsdom harness
 * free-canvas-tools.test.ts established.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-chrome-keys.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';
import { initFreeCanvas } from './free-canvas.ts';

// ── jsdom bootstrap (same shape as free-canvas-flip.test.ts) ──────────────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
for (const k of ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'KeyboardEvent', 'Event', 'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'showModal', {
  configurable: true,
  value(this: HTMLDialogElement) { this.setAttribute('open', ''); },
});
Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new dom.window.Event('close'));
  },
});
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

function pointerEvent(type: string, o: { x: number; y: number }): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: o.x, clientY: o.y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}

// ── fixture ───────────────────────────────────────────────────────────────────

const NATIVE = 1000;

function canvasCfg(): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', groupField: 'group', clipField: 'clip',
    addKinds: [{ id: 'box', label: 'Box', seed: {} }],
  };
}

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  commits: () => number;
  destroy(): void;
}

function mount(initial: Box[], design = false): Fixture {
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

  const model = new Map<string, unknown>([['boxes', initial]]);
  let commits = 0;
  const subs: Array<() => void> = [];
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { model.set(id, value); commits++; for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: {
      id: 'boxes',
      canvas: canvasCfg() as never,
      fields: ['bg', 'opacity', 'shape', 'radius', 'text'].map((id) => ({ id })) as never,
    },
    nativeW: NATIVE, nativeH: NATIVE,
    ...(design ? { chrome: {} as never } : {}),
  });
  frames();
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    commits: () => commits,
    destroy() { handle.destroy(); viewEl.remove(); dom.window.document.body.innerHTML = ''; },
  };
}

const plainBox = (id: string, x: number, y: number): Box =>
  ({ kind: 'box', shape: 'rect', id, x, y, w: 120, h: 120, bg: '#ccc' } as Box);

/** Select a box the way a click does: a pointerdown+up inside its model rect. */
function selectAt(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x, y }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x, y }));
  frames();
}
const selectionCount = (f: Fixture): number => f.stageEl.querySelectorAll('.fc-chrome .fc-outline').length;

/**
 * A chrome root over the canvas with one focusable control in it, `off` deciding whether
 * it carries the opt-out. Keys are dispatched FROM the button, as a real press does.
 */
function chromeRoot(off: boolean): { root: HTMLElement; btn: HTMLButtonElement } {
  const root = dom.window.document.createElement('div');
  if (off) root.setAttribute('data-canvas-keys', 'off');
  const btn = dom.window.document.createElement('button');
  btn.type = 'button';
  root.appendChild(btn);
  dom.window.document.body.appendChild(root);
  btn.focus();
  return { root, btn };
}

function pressFrom(
  el: HTMLElement,
  k: string,
  mods: { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {},
): void {
  el.dispatchEvent(new W.KeyboardEvent('keydown', {
    key: k, bubbles: true, cancelable: true,
    metaKey: !!mods.meta, ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift, altKey: !!mods.alt,
  }));
  frames();
}

// ══ the guard ════════════════════════════════════════════════════════════════

test('Delete pressed inside a data-canvas-keys="off" root leaves the selection intact', () => {
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  assert.equal(selectionCount(f), 1, 'the box is selected to start with');
  const c0 = f.commits();

  const { root, btn } = chromeRoot(true);
  pressFrom(btn, 'Delete');

  assert.equal(f.commits(), c0, 'the press committed nothing');
  assert.equal(f.boxes().length, 1, 'the box is still there');
  assert.equal(selectionCount(f), 1, 'and it is still selected');
  root.remove();
  f.destroy();
});

test('a modal owns Escape and editing keys without changing the canvas behind it', () => {
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  const dialog = document.createElement('dialog');
  const button = document.createElement('button');
  dialog.appendChild(button);
  document.body.appendChild(dialog);
  dialog.showModal();
  button.focus();
  try {
    const before = f.commits();
    for (const key of ['Escape', 'Delete', 'ArrowRight', '/']) {
      const event = new W.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      assert.equal(button.dispatchEvent(event), true, `${key} is left to the dialog`);
    }
    assert.equal(f.commits(), before);
    assert.equal(selectionCount(f), 1);
  } finally { dialog.close(); dialog.remove(); f.destroy(); }
});

test('the same Delete from an UNMARKED chrome root does delete - the guard is the attribute', () => {
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  const { root, btn } = chromeRoot(false);
  pressFrom(btn, 'Delete');

  assert.equal(f.boxes().length, 0, 'without the attribute the canvas still owns the key');
  root.remove();
  f.destroy();
});

test('the arrows do not nudge from inside a marked root', () => {
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  const x0 = f.boxes()[0]!.x;
  const { root, btn } = chromeRoot(true);
  pressFrom(btn, 'ArrowRight');
  pressFrom(btn, 'ArrowDown');

  assert.equal(f.boxes()[0]!.x, x0, 'the box did not move');
  root.remove();
  f.destroy();
});

test('a data-canvas-keys="on" island inside a marked root keeps the canvas keys', () => {
  // The tool rail is the case: it is canvas tooling that free-canvas parks INSIDE the
  // navigator column while that column is open. Without the nearest marker winning, the
  // same Pen button answered `v` and Delete while the rail floated and went silent while
  // it was docked - one button, two meanings, decided by an unrelated panel being open.
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  const { root } = chromeRoot(true);
  const island = dom.window.document.createElement('div');
  island.setAttribute('data-canvas-keys', 'on');
  const btn = dom.window.document.createElement('button');
  btn.type = 'button';
  island.appendChild(btn);
  root.appendChild(island);
  btn.focus();
  pressFrom(btn, 'Delete');

  assert.equal(f.boxes().length, 0, 'the nearer marker decides, not the outermost one');
  root.remove();
  f.destroy();
});

// ══ the two exemptions ═══════════════════════════════════════════════════════

test('Escape still reaches the editor ladder from a marked root', () => {
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  const { root, btn } = chromeRoot(true);
  pressFrom(btn, 'Escape');

  assert.equal(selectionCount(f), 0, 'Escape backed out of the selection, as it does anywhere');
  root.remove();
  f.destroy();
});

test('an app-wide chord still travels from a marked root', () => {
  const f = mount([plainBox('a', 100, 100), plainBox('b', 700, 700)]);
  const { root, btn } = chromeRoot(true);
  assert.equal(selectionCount(f), 0, 'nothing is selected to start with');
  pressFrom(btn, 'a', { meta: true });

  assert.ok(selectionCount(f) > 0, 'select-all still reached the canvas');
  root.remove();
  f.destroy();
});

// ══ clipboard completion + discoverability ══════════════════════════════════

test('Command/Ctrl+Alt+C/V pastes appearance without touching content or geometry', () => {
  const source = { ...plainBox('source', 100, 100), bg: '#ff33aa', opacity: 0.45, radius: 18, text: 'Source' } as Box;
  const target = {
    ...plainBox('target', 700, 700), bg: '#223344', opacity: 1, radius: 2, text: 'Keep me',
    start: 3, dur: 7, frame: 'slide-2', notes: 'private', hidden: true, locked: true,
  } as Box;
  const f = mount([source, target]);
  selectAt(f, 150, 150);
  pressFrom(f.stageEl, 'c', { meta: true, alt: true });
  pressFrom(f.stageEl, 'a', { meta: true });
  const before = f.commits();
  pressFrom(f.stageEl, 'v', { meta: true, alt: true });

  assert.equal(f.commits(), before + 1, 'a multi-selection paste is one undoable model write');
  const got = f.boxes()[1]!;
  assert.equal(got.bg, '#ff33aa');
  assert.equal(got.opacity, 0.45);
  assert.equal(got.radius, 18);
  assert.equal(got.id, 'target');
  assert.equal(got.x, 700);
  assert.equal(got.y, 700);
  assert.equal(got.text, 'Keep me');
  assert.equal(got.start, 3);
  assert.equal(got.dur, 7);
  assert.equal(got.frame, 'slide-2');
  assert.equal(got.notes, 'private');
  assert.equal(got.hidden, true);
  assert.equal(got.locked, true);
  f.destroy();
});

test('native Cut writes the portable layout payload, then deletes in one commit', () => {
  const f = mount([plainBox('a', 100, 100), plainBox('b', 700, 700)]);
  selectAt(f, 150, 150);
  let mime = '';
  let payload = '';
  const event = new W.Event('cut', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { setData(type: string, value: string) { mime = type; payload = value; } },
  });
  const before = f.commits();
  document.dispatchEvent(event);

  assert.equal(event.defaultPrevented, true);
  assert.equal(mime, 'text/plain');
  assert.match(payload, /^lolly\/layout-boxes:/);
  assert.match(payload, /"id":"a"/);
  assert.equal(f.commits(), before + 1);
  assert.deepEqual(f.boxes().map((box) => box.id), ['b']);
  f.destroy();
});

test('bare ? opens the Design shortcut sheet and Done restores its opener', () => {
  const f = mount([], true);
  const opener = document.createElement('button');
  f.stageEl.appendChild(opener);
  opener.focus();
  pressFrom(opener, '?');

  const dialog = document.querySelector<HTMLDialogElement>('.fc-shortcuts-modal');
  assert.ok(dialog);
  assert.equal(dialog.getAttribute('aria-label'), 'Design keyboard shortcuts');
  assert.ok(dialog.querySelectorAll('kbd').length > 20);
  (dialog.querySelector('.fc-shortcuts-actions button') as HTMLButtonElement).click();
  assert.equal(document.querySelector('.fc-shortcuts-modal'), null);
  assert.equal(document.activeElement, opener);
  f.destroy();
});

// ══ the roots that carry the attribute ═══════════════════════════════════════

/**
 * The guard is only worth anything if every chrome root actually sets it, and each builds
 * its root in its own module - too far apart for one runtime fixture. This reads the
 * sources instead, so deleting the line fails here rather than in a bug report.
 */
test('every chrome root over the canvas marks itself', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  // the views are an orchestrator plus feature modules under a dir of the same name (2026-09-09 split)
  const featureSrc = (view: string): string => [readFileSync(join(here, `${view}.ts`), 'utf8'), ...readdirSync(join(here, view)).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(join(here, view, n), 'utf8'))].join('\n');
  const roots: Array<[string, string]> = [
    ['the Design top bar', join(here, 'design-topbar.ts')],
    ['the edge dock column', join(here, '..', 'lib', 'edge-dock.ts')],
    ['the navigator column', join(here, 'design-navigator.ts')],
    // The stage zoom pill: eight focusable buttons over the canvas. Docked in the column
    // it inherited the marker; floating (dragged out, touch, or any window under 640px
    // where the dock does not exist) it carried none, so Delete on "Zoom in" deleted the
    // selected box.
    ['the stage zoom pill', join(here, 'tool-stage-nav.ts')],
  ];
  for (const [what, path] of roots) {
    const src = readFileSync(path, 'utf8');
    assert.ok(
      /setAttribute\('data-canvas-keys', 'off'\)/.test(src),
      `${what} sets data-canvas-keys="off" on its root`,
    );
  }
  // The export sheet is written as markup rather than built, and it moves: the dock
  // re-parents this very element into the column, so the attribute on it covers the sheet
  // docked and floating in one statement.
  assert.ok(
    /class="export-popup"[^>]*data-canvas-keys="off"/.test(featureSrc('tool')),
    'the export sheet marks itself',
  );
  // …and the ONE opt-back-in: the tool rail is canvas tooling, not chrome over the canvas.
  assert.ok(
    /toolbar\.setAttribute\('data-canvas-keys', 'on'\)/.test(featureSrc('free-canvas')),
    'the tool rail keeps the canvas keys in both of its homes',
  );
});


// ── Hide chrome: / and \ (2026-09-03) ────────────────────────────────────────
import { readFileSync as readCss } from 'node:fs';

test('/ hides the panels and toolbars exactly as \\ does, Escape restores, and a text field keeps its slash', () => {
  const f = mount([]);
  try {
    // The toggle keys on the nearest .tool-view; the fixture's stage gets one here.
    const view = f.stageEl.ownerDocument.createElement('div');
    view.className = 'tool-view';
    f.stageEl.parentElement!.insertBefore(view, f.stageEl);
    view.appendChild(f.stageEl);
    let refits = 0;
    f.stageEl.querySelector('#tool-canvas, .tool-canvas, [data-canvas]')?.addEventListener('canvas-resize', () => { refits++; });
    const press = (key: string, target: Element = f.stageEl): boolean =>
      target.dispatchEvent(new W.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    press('/');
    assert.equal(view.classList.contains('is-chrome-hidden'), true, '/ hides the chrome');
    press('Escape');
    assert.equal(view.classList.contains('is-chrome-hidden'), false, 'Escape restores it');
    press('\\');
    assert.equal(view.classList.contains('is-chrome-hidden'), true, 'the Figma/Penpot key still works');
    press('/');
    assert.equal(view.classList.contains('is-chrome-hidden'), false, 'and / toggles back');
    const input = f.stageEl.ownerDocument.createElement('input');
    view.appendChild(input);
    press('/', input);
    assert.equal(view.classList.contains('is-chrome-hidden'), false, 'a slash typed into a field is a slash');
  } finally { f.destroy(); }
});

test('the hidden state takes the chrome\'s space back in CSS: reserves and dock width zeroed, dock column gone', () => {
  const css = readCss(new URL('../styles/parts/editor.css', import.meta.url), 'utf8');
  const stage = css.match(/\.tool-view\.is-chrome-hidden \.tool-stage \{([^}]+)\}/)?.[1] ?? '';
  for (const v of ['--stage-reserve-top', '--stage-reserve-left', '--stage-reserve-right', '--stage-reserve-bottom', '--ldock-rail-w']) {
    assert.match(stage, new RegExp(v + ':\\s*0px\\s*!important'), v + ' is zeroed with !important, so it beats the inline write');
  }
  const html = css.match(/html:has\(\.tool-view\.is-chrome-hidden\) \{([^}]+)\}/)?.[1] ?? '';
  for (const v of ['--dock-w', '--ldock-w', '--design-topbar-h', '--design-timeline-h']) {
    assert.match(html, new RegExp(v + ':\\s*0px\\s*!important'), v + ' is zeroed on <html>');
  }
  assert.match(css, /html:has\(\.tool-view\.is-chrome-hidden\) \.edge-dock,\s*html:has\(\.tool-view\.is-chrome-hidden\) \.edge-dock-drop \{ display: none !important; \}/,
    'the fixed dock column (outside .tool-view) hides too');
});

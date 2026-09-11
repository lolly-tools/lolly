// SPDX-License-Identifier: MPL-2.0
/**
 * The export sheet's float/dock wiring (lib/export-panel-float.ts), against the ONE
 * right sidebar (lib/edge-dock.ts).
 *
 * The claim worth pinning here is a NEGATIVE one: docking the export sheet must not
 * evict whatever is already in the sidebar. The column holds several full panels at
 * once - the Design inspector, the player, the transcript - stacked when there are two
 * of them and tabbed past that, so "open the export sheet" can never mean "throw the
 * inspector out of the sidebar". That is the bug the old two-column
 * editor had: the inspector and the export dock fought for the same edge.
 *
 * Everything else about this module is deliberately untested here (the float box, the
 * grips, maximise): it is unchanged, device-persisted geometry.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/export-panel-float.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.localStorage = dom.window.localStorage;
// Desktop: the dock column exists only above the shell's 640px breakpoint.
(globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
  matches: q.includes('max-width: 640px') ? false : true,
  media: q, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
});

const ED = await import('./edge-dock.ts');
const { wireExportPanelFloat } = await import('./export-panel-float.ts');

interface Mounted {
  popup: HTMLElement;
  head: HTMLElement;
  off: () => void;
  /** Fire the host's "the sheet just opened" signal (views/tool.ts's openExport). */
  open(): void;
  dockBtn: HTMLElement;
}

function mount(o: { freeLayout?: boolean; editorLayout?: boolean; preferEdge?: boolean } = {}): Mounted {
  const overlay = document.createElement('div');
  overlay.id = 'export-overlay';
  const popup = document.createElement('div');
  popup.className = 'export-popup';
  const head = document.createElement('div');
  head.className = 'export-popup-head';
  const close = document.createElement('button');
  close.className = 'export-popup-close';
  head.appendChild(close);
  popup.appendChild(head);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  const hooks = new Set<() => void>();
  const off = wireExportPanelFloat({
    overlay, popup, head, isMobile: () => false,
    freeLayout: !!o.freeLayout, editorLayout: !!o.editorLayout, preferEdge: !!o.preferEdge,
    onOpen: (cb) => { hooks.add(cb); return () => { hooks.delete(cb); }; },
  });
  return {
    popup, head, off,
    open: () => { for (const cb of [...hooks]) cb(); },
    dockBtn: popup.querySelector<HTMLElement>('.export-popup-dock')!,
  };
}

/** Everything this module persists, so one test cannot seed the next. */
function forget(): void {
  try { localStorage.removeItem('lolly:exportPanelFloat'); } catch { /* private mode */ }
}

/** Press the header and let go somewhere that is NOT the dock band: a deliberate undock. */
function dragOff(head: HTMLElement): void {
  for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
    head.dispatchEvent(new dom.window.MouseEvent(type, { clientX: 400, clientY: 200, bubbles: true, button: 0 }));
  }
}

/** Drag the sheet's header out to the inline-end edge, which is the dock gesture. */
function dragToEdge(head: HTMLElement): void {
  const at = (type: string, x: number): void => {
    head.dispatchEvent(new dom.window.MouseEvent(type, { clientX: x, clientY: 200, bubbles: true, button: 0 }));
  };
  at('pointerdown', 400);
  at('pointermove', window.innerWidth - 6);
  at('pointerup', window.innerWidth - 6);
}

test('docking the export sheet leaves the rest of the sidebar exactly where it was', () => {
  const inspector = document.createElement('div');
  inspector.id = 'insp';
  ED.requestDock('inspector', inspector, { label: 'Inspector' });
  const h = mount();
  try {
    dragToEdge(h.head);
    assert.equal(ED.isDocked('export'), true, 'the sheet took a slot in the column');
    assert.equal(ED.isDocked('inspector'), true, 'and the inspector kept its own');
    assert.equal(ED.dockedFullCount(), 2, 'two full panels: the stacked split, not a swap');
    assert.ok(inspector.closest('.edge-dock-slot'), 'the inspector is still mounted in a slot');
    assert.ok(h.popup.closest('.edge-dock-slot'), 'so is the sheet');
  } finally {
    h.off();
    ED.releaseDock('inspector');
    inspector.remove();
    document.getElementById('export-overlay')?.remove();
  }
});

test('a third panel makes the column tabbed, and the sheet is the tab that opened', () => {
  const inspector = document.createElement('div');
  const player = document.createElement('div');
  ED.requestDock('inspector', inspector, { label: 'Inspector' });
  ED.requestDock('neuro', player, { label: 'Player' });
  const h = mount();
  try {
    dragToEdge(h.head);
    assert.equal(ED.dockedFullCount(), 3);
    const tabs = [...document.querySelectorAll<HTMLElement>('.edge-dock-tab')];
    assert.deepEqual(tabs.map((t) => t.dataset.tab), ['neuro', 'inspector', 'export']);
    assert.equal(tabs.find((t) => t.dataset.tab === 'export')!.getAttribute('aria-selected'), 'true',
      'the panel you just opened is the one you see');
    assert.equal(document.querySelector<HTMLElement>('.edge-dock-slot[data-slot="inspector"]')!.hidden, true,
      'the inspector is behind its tab - still docked, still mounted');
  } finally {
    h.off();
    for (const id of ['inspector', 'neuro'] as const) ED.releaseDock(id);
    document.getElementById('export-overlay')?.remove();
  }
});

test('tearing the view down releases only the sheet', () => {
  const inspector = document.createElement('div');
  ED.requestDock('inspector', inspector, { label: 'Inspector' });
  const h = mount();
  dragToEdge(h.head);
  h.off();
  assert.equal(ED.isDocked('export'), false, 'the sheet is out of the column, back in its overlay');
  assert.equal(h.popup.parentElement?.id, 'export-overlay');
  assert.equal(ED.isDocked('inspector'), true, 'and the sidebar keeps the panel it had');
  ED.releaseDock('inspector');
  document.getElementById('export-overlay')?.remove();
  forget();
});

// ── "a single left sidebar and a single right sidebar" (Andy, 2026-09-02) ───────────
//
// A free layout - the Design editor, canvas and chromeless tools - has no sidebar, so
// it has no berth under one either. "Dock to the side" used to mean the berth's
// bottom-left anchor there, which painted the sheet over the navigator as a SECOND left
// panel and persisted it across reloads.

test('a free layout has no berth: Dock to the side means the one right sidebar', () => {
  forget();
  const h = mount({ freeLayout: true });
  try {
    assert.equal(h.dockBtn.hidden, false, 'offered while the sheet is out of the column');
    h.dockBtn.click();
    assert.equal(ED.isDocked('export'), true, 'the sheet took a slot in the right column');
    assert.ok(h.popup.closest('.edge-dock-slot'), 'and is mounted in it, not left over the canvas');
    assert.equal(h.dockBtn.hidden, true, 'retired: there is nowhere else to send it');
  } finally {
    h.off();
    document.getElementById('export-overlay')?.remove();
    forget();
  }
});

test('a floating sheet never comes to rest underneath the right column', () => {
  forget();
  // A box remembered from a session with nothing docked, which now sits under the
  // column the Design inspector opened - invisible, and unreachable to drag back out.
  localStorage.setItem('lolly:exportPanelFloat', JSON.stringify({
    mode: 'floating', box: { x: window.innerWidth - 120, y: 100, w: 380, h: 400 },
  }));
  const inspector = document.createElement('div');
  ED.requestDock('inspector', inspector, { label: 'Inspector' });
  const dockW = ED.edgeDockWidth();
  assert.ok(dockW > 0, 'the column reserves inline-end space');
  const h = mount({ freeLayout: true });
  try {
    const right = parseFloat(h.popup.style.left) + parseFloat(h.popup.style.width);
    assert.ok(right <= window.innerWidth - dockW,
      `the sheet ends before the column starts (${right} vs ${window.innerWidth - dockW})`);
  } finally {
    h.off();
    ED.releaseDock('inspector');
    document.getElementById('export-overlay')?.remove();
    forget();
  }
});

test('a column that opens beside a floating sheet pushes it clear, not behind it', () => {
  forget();
  const h = mount({ freeLayout: true });
  try {
    // Park the sheet against the inline-end edge, then open the inspector over it.
    for (const [type, x] of [['pointerdown', 400], ['pointermove', window.innerWidth - 120], ['pointerup', window.innerWidth - 120]] as const) {
      h.head.dispatchEvent(new dom.window.MouseEvent(type, { clientX: x, clientY: 200, bubbles: true, button: 0 }));
    }
    const inspector = document.createElement('div');
    ED.requestDock('inspector', inspector, { label: 'Inspector' });
    const right = parseFloat(h.popup.style.left) + parseFloat(h.popup.style.width);
    assert.ok(right <= window.innerWidth - ED.edgeDockWidth(),
      'the sheet moved out from under the column that just opened');
    ED.releaseDock('inspector');
  } finally {
    h.off();
    document.getElementById('export-overlay')?.remove();
    forget();
  }
});

test('the side the user keeps the sheet on survives the host closing it', () => {
  forget();
  const h = mount({ freeLayout: true });
  try {
    dragToEdge(h.head);
    assert.equal(ED.isDocked('export'), true);
    // What views/tool.ts's closeExport does: the popup HAS to be back in its overlay for
    // the `export-open` class to hide it again, so every close undocks the sheet.
    ED.releaseDock('export');
    assert.equal(ED.isDocked('export'), false, 'closed, and out of the column');
    h.open();
    assert.equal(ED.isDocked('export'), true, 'opening it again puts it back on its side');
  } finally {
    h.off();
    document.getElementById('export-overlay')?.remove();
    forget();
  }
});

test('dragging the sheet out of the column is the user changing their mind', () => {
  forget();
  const h = mount({ freeLayout: true });
  try {
    dragToEdge(h.head);
    dragOff(h.head);
    assert.equal(ED.isDocked('export'), false, 'the drag took it out');
    h.open();
    assert.equal(ED.isDocked('export'), false, 'and the next open leaves it where they put it');
  } finally {
    h.off();
    document.getElementById('export-overlay')?.remove();
    forget();
  }
});

test('the Design editor opens the sheet in the column it already has, first time', () => {
  forget();
  const h = mount({ freeLayout: true, editorLayout: true });
  try {
    assert.equal(ED.isDocked('export'), false, 'mounting does not surface a sheet nobody opened');
    h.open();
    assert.equal(ED.isDocked('export'), true, 'the first open puts it in the one right sidebar');
    assert.ok(h.popup.closest('.edge-dock-slot'));
  } finally {
    h.off();
    document.getElementById('export-overlay')?.remove();
    forget();
  }
});

test('every other free layout still opens floated - only the editor defaults to the column', () => {
  forget();
  const h = mount({ freeLayout: true });
  try {
    h.open();
    assert.equal(ED.isDocked('export'), false, 'a canvas tool keeps the floated box it always had');
    assert.ok(h.popup.classList.contains('is-floating'));
  } finally {
    h.off();
    document.getElementById('export-overlay')?.remove();
    forget();
  }
});

test('preferEdge: an ordinary canvas tool WITH a sidebar opens the sheet in the one right column too', () => {
  // Timezone / Darkroom keep a sidebar (freeLayout:false) but consolidate the right side
  // into the edge-dock column like the editor (Andy, 2026-09-07): first open docks there.
  forget();
  const h = mount({ freeLayout: false, preferEdge: true });
  try {
    assert.equal(ED.isDocked('export'), false, 'mounting does not surface a sheet nobody opened');
    h.open();
    assert.equal(ED.isDocked('export'), true, 'the first open puts it in the one right sidebar');
    assert.ok(h.popup.closest('.edge-dock-slot'));
  } finally {
    h.off();
    document.getElementById('export-overlay')?.remove();
    forget();
  }
});

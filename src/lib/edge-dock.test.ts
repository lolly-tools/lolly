// SPDX-License-Identifier: MPL-2.0
/**
 * Edge docking - the runtime half of lib/edge-dock.ts: occupancy + stacking, the
 * `--dock-w` inset, collapse, the RTL-aware drop hit-test, and the two invariants:
 *
 *   - MOBILE UNTOUCHABLE: below the 640px breakpoint the module is fully inert - no
 *     column, no `--dock-w`, no attribute, nothing moved.
 *   - BYTE-IDENTICAL IDLE: once the last panel undocks, the column, the `--dock-w`
 *     custom property and the `data-edge-dock` attribute are all gone.
 *
 * Run directly:  node --test shells/web/src/lib/edge-dock.test.ts
 *
 * jsdom with a real origin (geometry persists to localStorage). matchMedia is a
 * controllable stub so a test can pretend to be phone-width; window.innerWidth is
 * jsdom's default 1024.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

// A dragged column width, seeded BEFORE import so the read-direction of persistence is
// covered: the module loads its geometry at import time.
localStorage.setItem('lolly:edge-dock', JSON.stringify({ width: 400 }));

// Controllable breakpoint. mobile=false ⇒ desktop ⇒ docking available.
let mobile = false;
(globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
  matches: q.includes('max-width: 640px') ? mobile : !mobile,
  media: q, onchange: null, addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {}, dispatchEvent() { return false; },
});

const ED = await import('./edge-dock.ts');

function panel(id: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  return el;
}
function reset(): void {
  for (const id of ['zoom', 'neuro', 'inspector', 'export', 'transcript'] as const) ED.releaseDock(id);
  document.querySelector('.edge-dock-drop')?.remove();
  document.documentElement.dir = '';
  mobile = false;
  for (const el of [...document.querySelectorAll('#pn, #px, #pz, #pi, #pt')]) el.remove();
}
const dockW = (): string => document.documentElement.style.getPropertyValue('--dock-w');
const hasCol = (): boolean => !!document.querySelector('.edge-dock');
const collapseBtn = (): HTMLElement => document.querySelector<HTMLElement>('.edge-dock-collapse')!;
/** Collapse is column GEOMETRY: it outlives every panel leaving, and the button toggles,
 *  so a case that puts the column away asks before it opens it again. */
const expandColumn = (): void => { if (ED.edgeDockCollapsed()) collapseBtn().click(); };
const visibleSlots = (): string[] =>
  [...document.querySelectorAll<HTMLElement>('.edge-dock-slot')].filter((s) => !s.hidden).map((s) => s.dataset.slot ?? '');

test('below the mobile breakpoint docking is fully inert', () => {
  reset();
  mobile = true;
  const el = panel('pn');
  assert.equal(ED.requestDock('neuro', el), false);
  assert.equal(hasCol(), false);
  assert.equal(dockW(), '');
  assert.equal(document.documentElement.hasAttribute('data-edge-dock'), false);
  assert.equal(el.parentElement, document.body);   // never moved
});

test('docking builds the column, sets --dock-w (persisted width) and the attribute, and moves the panel', () => {
  reset();
  const el = panel('pn');
  assert.equal(ED.requestDock('neuro', el), true);
  assert.equal(hasCol(), true);
  assert.equal(dockW(), '400px');   // the width seeded in localStorage
  assert.equal(document.documentElement.getAttribute('data-edge-dock'), '');
  assert.ok(el.closest('.edge-dock-slot'), 'panel now lives in a dock slot');
  assert.equal(ED.isDocked('neuro'), true);
});

test('dock navigation uses the Lolly UI semantic surface, selection and focus roles', () => {
  reset();
  ED.requestDock('neuro', panel('pn'));
  const css = readFileSync(new URL('./edge-dock.css', import.meta.url), 'utf8');
  for (const role of [
    '--ui-color-surface-canvas', '--ui-color-surface-muted', '--ui-color-surface-raised',
    '--ui-color-selection-surface', '--ui-color-selection-border', '--ui-color-focus-ring',
    '--ui-radius-control', '--ui-radius-choice', '--ui-elevation-sheet', '--ui-elevation-control',
    '--ui-motion-navigation',
  ]) assert.ok(css.includes(role), `dock chrome reads ${role}`);
});

test('a docked data-tip is portalled above the scroll slot, not clipped inside it', async () => {
  reset();
  const el = panel('pn');
  const trigger = document.createElement('button');
  trigger.setAttribute('data-tip', 'Distribute horizontally');
  trigger.setAttribute('aria-label', 'Distribute horizontally');
  el.appendChild(trigger);
  ED.requestDock('inspector', el);
  trigger.focus();
  const tip = document.querySelector<HTMLElement>('.edge-dock-tooltip');
  assert.ok(tip, 'the dock owns one body-level tooltip');
  assert.equal(tip.textContent, 'Distribute horizontally');
  assert.equal(tip.hidden, false);
  assert.equal(trigger.dataset.dockTipManaged, '', 'the clipped pseudo-tooltip is suppressed only while portalled');
  ED.releaseDock('inspector');
  await Promise.resolve();
  assert.equal(document.querySelector('.edge-dock-tooltip'), null, 'tearing down the final dock panel removes the portal');
});

test('releasing the last panel restores it and tears down to byte-identical idle', () => {
  reset();
  const el = panel('pn');
  let released = false;
  ED.requestDock('neuro', el, { onRelease: () => { released = true; } });
  ED.releaseDock('neuro');
  assert.equal(released, true);
  assert.equal(el.parentElement, document.body);   // back home
  assert.equal(hasCol(), false);
  assert.equal(dockW(), '');
  assert.equal(document.documentElement.hasAttribute('data-edge-dock'), false);
});

test('two panels stack player-over-export with one divider between', () => {
  reset();
  const n = panel('pn'); const x = panel('px');
  ED.requestDock('export', x);   // request order should not decide stacking order
  ED.requestDock('neuro', n);
  assert.equal(ED.dockedCount(), 2);
  const slots = [...document.querySelectorAll('.edge-dock-slot')];
  assert.equal(slots.length, 2);
  assert.equal(slots[0]!.getAttribute('data-slot'), 'neuro');    // player on top
  assert.equal(slots[1]!.getAttribute('data-slot'), 'export');   // export below
  assert.equal(document.querySelectorAll('.edge-dock-divider').length, 1);
  assert.ok(slots[1]!.classList.contains('edge-dock-slot--fill'), 'bottom panel fills the remainder');
});

test('Inspector and Export use tabs even as the only two full panels', () => {
  reset();
  ED.requestDock('inspector', panel('pi'), { label: 'Inspector' });
  ED.requestDock('export', panel('px'), { label: 'Export' });
  const strip = document.querySelector<HTMLElement>('.edge-dock-tabs');
  assert.ok(strip, 'the two competing right-side workflows use a tab strip');
  assert.deepEqual(
    [...strip.querySelectorAll<HTMLElement>('.edge-dock-tab')].map((tab) => tab.dataset.tab),
    ['inspector', 'export'],
  );
  assert.equal(document.querySelectorAll('.edge-dock-divider').length, 0, 'no half-height split');
  assert.deepEqual(visibleSlots(), ['export'], 'the panel most recently requested is visible');
});

test('a compact bar docks on TOP of the panels, fixed-height, with no divider above it', () => {
  reset();
  ED.requestDock('export', panel('px'));
  ED.requestDock('neuro', panel('pn'));
  ED.requestDock('zoom', panel('pz'), { compact: true });
  const slots = [...document.querySelectorAll('.edge-dock-slot')];
  assert.equal(slots.length, 3);
  assert.equal(slots[0]!.getAttribute('data-slot'), 'zoom', 'compact bar is the top slot');
  assert.ok(slots[0]!.classList.contains('edge-dock-slot--compact'));
  assert.ok(!slots[0]!.classList.contains('edge-dock-slot--fill'), 'the compact bar never fills');
  assert.ok(slots[2]!.classList.contains('edge-dock-slot--fill'), 'the last FULL panel fills the remainder');
  // Only one resize divider - between the two full panels, none above the fixed compact bar.
  assert.equal(document.querySelectorAll('.edge-dock-divider').length, 1);
});

test('an open dock widens the drop zone to its full width, not just the edge band', () => {
  reset();
  ED.requestDock('export', panel('px'));   // opens the column at the seeded 400px width
  const vw = window.innerWidth;
  assert.equal(ED.edgeDockHitTest(vw - 300), true, '300px in is outside the 52px band but inside the open dock');
  assert.equal(ED.edgeDockHitTest(vw - 500), false, 'past the dock is not a drop');
});

test('RTL-aware hit-test tracks the inline-end edge', () => {
  reset();
  const vw = window.innerWidth;
  assert.equal(ED.edgeDockHitTest(vw - 4), true);    // LTR: inline-end is the right
  assert.equal(ED.edgeDockHitTest(10), false);
  document.documentElement.dir = 'rtl';
  assert.equal(ED.edgeDockHitTest(10), true);        // RTL: inline-end is the left
  assert.equal(ED.edgeDockHitTest(vw - 4), false);
});

test('preview shows and clears the drop affordance', () => {
  reset();
  ED.edgeDockPreview(true);
  assert.equal(document.querySelectorAll('.edge-dock-drop').length, 1);
  ED.edgeDockPreview(false);
  assert.equal(document.querySelectorAll('.edge-dock-drop').length, 0);
});

test('dropping below the breakpoint undocks everything on resize', () => {
  reset();
  ED.requestDock('neuro', panel('pn'));
  assert.equal(hasCol(), true);
  mobile = true;
  window.dispatchEvent(new dom.window.Event('resize'));
  assert.equal(ED.isDocked('neuro'), false);
  assert.equal(hasCol(), false);
  assert.equal(dockW(), '');
});

test('divider drag resizes via the existing handle (regression: it kept losing focus)', () => {
  reset();
  ED.requestDock('export', panel('px'));
  ED.requestDock('neuro', panel('pn'));
  const divider = document.querySelector('.edge-dock-divider')!;
  const top = document.querySelector<HTMLElement>('.edge-dock-slot')!;   // first slot = player
  divider.dispatchEvent(new dom.window.MouseEvent('pointerdown', { clientX: 100, clientY: 200, bubbles: true }));
  divider.dispatchEvent(new dom.window.MouseEvent('pointermove', { clientX: 100, clientY: 260, bubbles: true }));
  // The handle must survive the move (relayout used to rebuild it, detaching the drag).
  assert.equal(document.querySelectorAll('.edge-dock-divider').length, 1);
  assert.equal(document.querySelector('.edge-dock-divider'), divider, 'same divider node across the drag');
  assert.ok(top.style.height, 'top slot got an explicit height from the split');
  divider.dispatchEvent(new dom.window.MouseEvent('pointerup', { clientX: 100, clientY: 260, bubbles: true }));
});

test('collapse hides the body to the rail and persists; expand restores', () => {
  reset();
  ED.requestDock('neuro', panel('pn'));
  const btn = document.querySelector<HTMLElement>('.edge-dock-collapse')!;
  btn.click();
  assert.ok(document.querySelector('.edge-dock')!.classList.contains('is-collapsed'));
  assert.equal(dockW(), '48px');   // the rail width
  assert.equal(JSON.parse(localStorage.getItem('lolly:edge-dock')!).collapsed, true);
  btn.click();
  assert.equal(document.querySelector('.edge-dock')!.classList.contains('is-collapsed'), false);
  assert.equal(dockW(), '400px');
  assert.equal(JSON.parse(localStorage.getItem('lolly:edge-dock')!).collapsed, false);
});

// ── ONE right sidebar (2026-09-02): the inspector joined the column, and past two
//    full panels the stack becomes a tab strip. ────────────────────────────────────

test('the inspector docks between the player and the export panel, in column order', () => {
  reset();
  ED.requestDock('export', panel('px'));      // request order still decides nothing
  ED.requestDock('inspector', panel('pi'));
  ED.requestDock('neuro', panel('pn'));
  const slots = [...document.querySelectorAll('.edge-dock-slot')];
  assert.deepEqual(slots.map((s) => s.getAttribute('data-slot')), ['neuro', 'inspector', 'export']);
  assert.equal(ED.dockedFullCount(), 3);
});

test('three full panels become a tab strip - one visible slot, no divider, the newest active', () => {
  reset();
  ED.requestDock('neuro', panel('pn'), { label: 'Player' });
  ED.requestDock('export', panel('px'), { label: 'Export' });
  ED.requestDock('inspector', panel('pi'), { label: 'Inspector' });   // last requested = active
  const strip = document.querySelector<HTMLElement>('.edge-dock-tabs')!;
  assert.ok(strip, 'a tab strip is built');
  assert.equal(strip.getAttribute('role'), 'tablist');
  const tabs = [...strip.querySelectorAll<HTMLElement>('.edge-dock-tab')];
  assert.deepEqual(tabs.map((t) => t.dataset.tab), ['neuro', 'inspector', 'export'], 'tabs follow column order');
  assert.deepEqual(tabs.map((t) => t.textContent), ['Player', 'Inspector', 'Export'], 'each tab names its panel');
  assert.equal(document.querySelectorAll('.edge-dock-divider').length, 0, 'a tabbed column has no split to drag');
  const shown = [...document.querySelectorAll<HTMLElement>('.edge-dock-slot')].filter((s) => !s.hidden);
  assert.deepEqual(shown.map((s) => s.dataset.slot), ['inspector'], 'only the active panel fills the body');
  assert.ok(shown[0]!.classList.contains('edge-dock-slot--fill'));
  assert.equal(tabs.find((t) => t.dataset.tab === 'inspector')!.getAttribute('aria-selected'), 'true');
  // Every panel stays MOUNTED - a tab switch must not tear a panel's DOM down.
  assert.equal(document.querySelectorAll('.edge-dock-slot').length, 3);
  assert.ok(document.getElementById('pn')!.closest('.edge-dock-slot'));
});

test('a compact zoom bar sits above the tab strip, never in it', () => {
  reset();
  ED.requestDock('zoom', panel('pz'), { compact: true, label: 'Zoom' });
  ED.requestDock('neuro', panel('pn'));
  ED.requestDock('export', panel('px'));
  ED.requestDock('inspector', panel('pi'));
  const body = document.querySelector<HTMLElement>('.edge-dock-body')!;
  const kids = [...body.children].map((k) => k.className.split(' ')[0]);
  assert.equal(kids[0], 'edge-dock-slot', 'the compact bar is the first child');
  assert.equal((body.children[0] as HTMLElement).dataset.slot, 'zoom');
  assert.equal(kids[1], 'edge-dock-tabs', 'and the strip comes straight after it');
  assert.equal(document.querySelectorAll('.edge-dock-tab').length, 3, 'the compact bar gets no tab');
});

test('clicking a tab swaps the visible panel without rebuilding the strip', () => {
  reset();
  ED.requestDock('neuro', panel('pn'), { label: 'Player' });
  ED.requestDock('export', panel('px'), { label: 'Export' });
  ED.requestDock('inspector', panel('pi'), { label: 'Inspector' });
  const strip = document.querySelector<HTMLElement>('.edge-dock-tabs')!;
  const exportTab = strip.querySelector<HTMLElement>('.edge-dock-tab[data-tab="export"]')!;
  exportTab.click();
  assert.equal(document.querySelector('.edge-dock-tabs'), strip, 'same strip node across the switch');
  assert.equal(exportTab.getAttribute('aria-selected'), 'true');
  assert.equal(strip.querySelector('.edge-dock-tab[data-tab="inspector"]')!.getAttribute('aria-selected'), 'false');
  const shown = [...document.querySelectorAll<HTMLElement>('.edge-dock-slot')].filter((s) => !s.hidden);
  assert.deepEqual(shown.map((s) => s.dataset.slot), ['export']);
  assert.equal(JSON.parse(localStorage.getItem('lolly:edge-dock')!).tab, 'export', 'and it is remembered');
  // Arrow keys move between tabs (roving tabindex), which is the whole point of a tablist.
  exportTab.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  assert.equal(strip.querySelector('.edge-dock-tab[data-tab="inspector"]')!.getAttribute('aria-selected'), 'true');
  assert.equal(strip.querySelector<HTMLElement>('.edge-dock-tab[data-tab="inspector"]')!.tabIndex, 0);
  assert.equal(exportTab.tabIndex, -1);
});

test('dropping back to two full panels restores the stacked split', () => {
  reset();
  ED.requestDock('neuro', panel('pn'));
  ED.requestDock('export', panel('px'));
  ED.requestDock('inspector', panel('pi'));
  assert.ok(document.querySelector('.edge-dock-tabs'));
  ED.releaseDock('inspector');
  assert.equal(document.querySelector('.edge-dock-tabs'), null, 'the strip goes with the third panel');
  assert.equal(document.querySelectorAll('.edge-dock-divider').length, 1, 'and the split comes back');
  assert.equal([...document.querySelectorAll<HTMLElement>('.edge-dock-slot')].filter((s) => s.hidden).length, 0);
});

test('a panel docked while DETACHED goes back to detached, not parked on <body>', () => {
  reset();
  // The Design inspector is built with no parent: the dock IS its mount point, and the
  // host puts it back in a slot itself. Parking it on <body> left a full panel loose at
  // the end of the page.
  const el = document.createElement('div');
  el.id = 'pi';
  ED.requestDock('inspector', el);
  assert.ok(el.closest('.edge-dock-slot'));
  ED.releaseDock('inspector');
  assert.equal(el.parentElement, null, 'detached again');
  assert.equal(el.isConnected, false);
});

test('onDockChange reports every occupancy change, in column order, until unsubscribed', () => {
  reset();
  const seen: string[][] = [];
  const off = ED.onDockChange((ids) => seen.push([...ids]));
  ED.requestDock('export', panel('px'));
  ED.requestDock('neuro', panel('pn'));
  assert.deepEqual(seen, [['export'], ['neuro', 'export']]);
  ED.releaseDock('export');
  assert.deepEqual(seen[2], ['neuro']);
  // A listener may dock something itself - the stage HUD does exactly that when the
  // column opens - so a change made DURING a notification must not nest or spin.
  const zoom = panel('pz');
  const off2 = ED.onDockChange((ids) => { if (ids.includes('neuro') && !ED.isDocked('zoom')) ED.requestDock('zoom', zoom, { compact: true }); });
  ED.requestDock('inspector', panel('pi'));
  off2();
  assert.equal(ED.isDocked('zoom'), true, 'the listener got its own dock through');
  assert.equal(ED.dockedFullCount(), 2, 'and the compact bar is not counted as a panel');
  const before = seen.length;
  ED.releaseDock('zoom');
  assert.equal(seen.length, before + 1, 'the compact bar leaving is a change too');
  off();
  const after = seen.length;
  ED.releaseDock('inspector');
  assert.equal(seen.length, after, 'unsubscribed means unsubscribed');
  const off3 = ED.onDockChange(() => { throw new Error('a bad listener'); });
  ED.requestDock('neuro', panel('pn'));   // must not throw out of requestDock
  off3();
});

test('dragging the width grip inside the snap collapses the column, and back out re-expands it', () => {
  reset();
  ED.requestDock('neuro', panel('pn'));
  const col = document.querySelector<HTMLElement>('.edge-dock')!;
  const grip = document.querySelector<HTMLElement>('.edge-dock-grip')!;
  // jsdom measures nothing, so the column reports the box a 400px-wide dock would have.
  col.getBoundingClientRect = () => ({ x: 624, y: 0, left: 624, top: 0, right: 1024, bottom: 768, width: 400, height: 768, toJSON: () => ({}) }) as DOMRect;
  const move = (clientX: number): void => {
    grip.dispatchEvent(new dom.window.MouseEvent('pointermove', { clientX, clientY: 300, bubbles: true }));
  };
  grip.dispatchEvent(new dom.window.MouseEvent('pointerdown', { clientX: 624, clientY: 300, bubbles: true }));
  move(724);   // 300px wide
  assert.equal(dockW(), '300px');
  move(900);   // 124px - inside the snap, so it puts itself away
  assert.ok(col.classList.contains('is-collapsed'));
  assert.equal(dockW(), '48px');
  move(674);   // dragged back out without letting go: 350px
  assert.equal(col.classList.contains('is-collapsed'), false);
  assert.equal(dockW(), '350px');
  grip.dispatchEvent(new dom.window.MouseEvent('pointerup', { clientX: 674, clientY: 300, bubbles: true }));
  assert.equal(JSON.parse(localStorage.getItem('lolly:edge-dock')!).width, 350);
});

test('the width grip takes the keyboard: arrows resize, Enter puts the column away', () => {
  reset();
  localStorage.setItem('lolly:edge-dock', JSON.stringify({ width: 400 }));
  ED.requestDock('neuro', panel('pn'));
  const col = document.querySelector<HTMLElement>('.edge-dock')!;
  const grip = document.querySelector<HTMLElement>('.edge-dock-grip')!;
  assert.equal(grip.tabIndex, 0, 'reachable by keyboard at all');
  assert.equal(grip.getAttribute('aria-valuenow'), dockW().replace('px', ''));
  const key = (k: string): void => {
    grip.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  };
  const w0 = parseFloat(dockW());
  key('ArrowLeft');    // the grip is on the column's inline-start edge: left is wider
  assert.equal(parseFloat(dockW()) > w0, true);
  key('ArrowRight');
  assert.equal(parseFloat(dockW()), w0);
  key('Home');
  assert.equal(dockW(), '280px', 'Home is the narrowest usable column');
  key('Enter');
  assert.ok(col.classList.contains('is-collapsed'));
  key('ArrowLeft');    // widening from the rail re-opens it
  assert.equal(col.classList.contains('is-collapsed'), false);
  assert.equal(dockW(), '280px');
});

test('the narrower arrow reaches the snap: at the minimum the next press puts the column away', () => {
  // applyGripWidth re-clamps to MIN_W (280) on every pass and the snap sits at 200, a gap
  // wider than one 24px step - so the key used to stall at 280 forever and the "narrow it
  // away" half of the gesture existed only for the mouse.
  reset();
  ED.requestDock('neuro', panel('pn'));
  const col = document.querySelector<HTMLElement>('.edge-dock')!;
  const grip = document.querySelector<HTMLElement>('.edge-dock-grip')!;
  const key = (k: string): void => {
    grip.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  };
  key('Home');
  assert.equal(dockW(), '280px', 'the narrowest usable column, as before');
  key('ArrowRight');
  assert.equal(col.classList.contains('is-collapsed'), true, 'and one more press is "put it away"');
  assert.equal(dockW(), '48px');
  key('ArrowRight');
  assert.equal(col.classList.contains('is-collapsed'), true, 'narrowing an already-collapsed column is a no-op');
  key('ArrowLeft');
  assert.equal(col.classList.contains('is-collapsed'), false, 'and the way back is unchanged');
  assert.equal(dockW(), '280px');
});

// ── COLLAPSED IS A STATE PANELS ARRIVE INTO, and one the chrome outside has to hear ──
//    The body is `display: none` while the column is put away, so a panel docked into it
//    is mounted and invisible - the bug was an Inspector the bar reported as open with
//    nothing on screen.

test('docking a panel into a collapsed column opens it, rather than swallowing the panel', () => {
  reset();
  ED.requestDock('neuro', panel('pn'));
  collapseBtn().click();
  assert.equal(dockW(), '48px', 'precondition: the column is put away');
  ED.requestDock('inspector', panel('pi'));
  assert.equal(ED.edgeDockCollapsed(), false, 'asking for a panel is asking to see it');
  assert.ok(document.getElementById('pi')!.closest('.edge-dock-slot'));
  assert.notEqual(dockW(), '48px');
});

test('the compact zoom bar follows the column instead of prising it open, and is told', () => {
  reset();
  ED.requestDock('neuro', panel('pn'));
  collapseBtn().click();
  let told: boolean | null = null;
  ED.requestDock('zoom', panel('pz'), { compact: true, onCollapse: (c) => { told = c; } });
  assert.equal(ED.edgeDockCollapsed(), true, 'a bar that follows the column must not re-open it');
  assert.equal(told, true, 'and it is told the column it went into is put away');
  expandColumn();
});

test('showPanel fronts a docked panel: out from behind a tab, and out of the rail', () => {
  reset();
  ED.requestDock('neuro', panel('pn'), { label: 'Player' });
  ED.requestDock('export', panel('px'), { label: 'Export' });
  ED.requestDock('inspector', panel('pi'), { label: 'Inspector' });   // newest requested = active
  assert.deepEqual(visibleSlots(), ['inspector']);
  ED.showPanel('neuro');
  assert.deepEqual(visibleSlots(), ['neuro'], 'the panel asked for is the one on screen');
  collapseBtn().click();
  ED.showPanel('export');
  assert.equal(ED.edgeDockCollapsed(), false, 'a panel asked for is a panel on screen, not one behind a rail');
  assert.deepEqual(visibleSlots(), ['export']);
  assert.equal(ED.isDocked('inspector'), true, 'and nothing was evicted to make room');
});

test('re-requesting a panel that is already docked fronts it instead of reporting success over nothing', () => {
  reset();
  ED.requestDock('neuro', panel('pn'), { label: 'Player' });
  ED.requestDock('export', panel('px'), { label: 'Export' });
  ED.requestDock('inspector', panel('pi'), { label: 'Inspector' });
  const px = document.getElementById('px')!;
  ED.showPanel('neuro');
  collapseBtn().click();
  assert.equal(ED.requestDock('export', px, { label: 'Export' }), true);
  assert.equal(ED.edgeDockCollapsed(), false, 'the second ask opened the column');
  assert.deepEqual(visibleSlots(), ['export'], 'and brought the panel forward');
  assert.equal(ED.dockedFullCount(), 3, 'it is the same occupant, not a fourth');
});

test('collapsing is an occupancy-shaped change: it notifies, and edgeDockCollapsed reports it', () => {
  // The Design top bar drops its whole zoom cluster (and the mark, and the avatar) while
  // the compact zoom bar holds a slot. With no notification and occupancy alone to read,
  // collapsing the column left the editor with no zoom control anywhere on screen.
  reset();
  ED.requestDock('neuro', panel('pn'));
  ED.requestDock('zoom', panel('pz'), { compact: true });
  const seen: boolean[] = [];
  const off = ED.onDockChange(() => seen.push(ED.edgeDockCollapsed()));
  collapseBtn().click();
  assert.deepEqual(seen, [true], 'the bar hears that the docked bar is off the screen');
  collapseBtn().click();
  assert.deepEqual(seen, [true, false], 'and hears it come back');
  off();
});

test('expanding from a rail icon hands the keyboard on - the icon that did it is about to vanish', () => {
  reset();
  const p = panel('pn');
  const inner = document.createElement('button');
  p.appendChild(inner);
  ED.requestDock('neuro', p, { label: 'Player' });
  collapseBtn().click();
  const railBtn = document.querySelector<HTMLElement>('.edge-dock-rail-btn')!;
  railBtn.focus();
  railBtn.click();
  assert.equal(ED.edgeDockCollapsed(), false, 'the icon expands the column');
  assert.equal(document.activeElement, inner, 'and focus is inside the panel, not on <body>');

  // Tabbed: the panel the icon NAMES is the one to open, so its tab takes the keyboard.
  ED.requestDock('export', panel('px'), { label: 'Export' });
  ED.requestDock('inspector', panel('pi'), { label: 'Inspector' });
  collapseBtn().click();
  const rails = [...document.querySelectorAll<HTMLElement>('.edge-dock-rail-btn')];
  rails.find((b) => b.title === 'Export')!.click();
  assert.deepEqual(visibleSlots(), ['export']);
  assert.equal(document.activeElement, document.querySelector('.edge-dock-tab[data-tab="export"]'),
    'the tab of the panel that was asked for');
});

test('a release says WHY: the user put the panel away, or the host took it back', () => {
  // An occupant that persists an open/closed preference reads this. Without it, leaving
  // the view (or dragging the window narrow) recorded "closed" against a panel the user
  // never closed, and it never came back.
  reset();
  const p = panel('pn');
  const seen: string[] = [];
  ED.requestDock('neuro', p, { onRelease: (reason) => seen.push(reason) });
  ED.releaseDock('neuro');
  assert.deepEqual(seen, ['user'], 'a plain release is someone putting the panel away');
  ED.requestDock('neuro', p, { onRelease: (reason) => seen.push(reason) });
  mobile = true;
  window.dispatchEvent(new dom.window.Event('resize'));
  assert.deepEqual(seen, ['user', 'host'], 'the breakpoint undock is the app, not a decision');
  mobile = false;
});

test('every panel names itself through t() - the tab strip shows that label as body text', () => {
  // `label` used to feed a title and an aria-label only. The tab strip (three or more
  // panels) renders it as visible chrome copy, so a raw literal reads as English beside a
  // translated neighbour - "Transcription | Export | Player" in French.
  const here = dirname(fileURLToPath(import.meta.url));
  const sites: Array<[string, string, string]> = [
    ['the export sheet', join(here, 'export-panel-float.ts'), 'Export'],
    ['the player', join(here, 'audio-dock-singleton.ts'), 'Player'],
    ['the Design inspector', join(here, '..', 'views', 'design-inspector-float.ts'), 'Inspector'],
    ['the transcript', join(here, '..', 'views', 'transcript-panel.ts'), 'Transcript'],
    ['the compact zoom bar', join(here, '..', 'views', 'tool-stage-nav.ts'), 'Zoom'],
  ];
  for (const [what, path, word] of sites) {
    const src = readFileSync(path, 'utf8');
    assert.ok(src.includes(`label: t('${word}')`), `${what} names itself through t()`);
    assert.ok(!src.includes(`label: '${word}'`), `${what} passes no raw English label`);
  }
});


test('the column runs from the top edge down to the timeline band - never below the top bar', () => {
  reset();
  ED.requestDock('inspector', panel('pa'));
  const css = readFileSync(new URL('./edge-dock.css', import.meta.url), 'utf8');
  // Andy, 2026-09-03: a column starting under the Design top bar left a blank band above
  // itself, because the bar ends where the column begins.
  assert.match(css, /\.edge-dock \{[^}]*inset-block: 0 var\(--design-timeline-h, 0px\)/, 'the column starts at 0');
  assert.doesNotMatch(css, /inset-block: var\(--design-topbar-h/, 'nothing starts below the top bar any more');
});

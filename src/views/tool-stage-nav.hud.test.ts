// SPDX-License-Identifier: MPL-2.0
/**
 * Stage nav WITHOUT its HUD, and the absolute-zoom port the Design top bar drives it
 * through (plan 179 M1 sections 2-3).
 *
 * The editor layout retires the floating swirl pill: its top bar carries Fit / ± / NN%,
 * and two zoom controls on one stage is one too many. `hud:false` must therefore remove
 * the WIDGET and nothing else - every gesture and key is the same controller, and the
 * regression this file exists to catch is a "tidy-up" that gates a listener on the HUD
 * having been built. So: no `.stage-nav` node, no adopted theme/sound/profile controls,
 * and the keys still zoom.
 *
 * The zoom port is the second half. `actual()`/`subscribe()` speak ABSOLUTE zoom (1 ===
 * 100% of native export pixels) while `zoomBy()` is a multiplier - if those units drift
 * the bar's readout lies, so they are pinned here against a canvas whose measured width
 * tracks the transform, the way a real one does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
if (typeof dom.window.matchMedia !== 'function') {
  (dom.window as unknown as { matchMedia: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: false });
}

const { setupStageNav } = await import('./tool-stage-nav.ts');

const NATIVE_W = 800;

/** The canvas zoom the outer wrapper currently shows (1 = Fit, transform cleared). */
function scaleOf(outer: HTMLElement): number {
  const m = outer.style.transform.match(/scale\(([\d.e+-]+)\)/);
  return m ? Number(m[1]) : 1;
}

/**
 * Mount a stage whose canvas MEASURES like a real one: jsdom reports every rect as zero,
 * and absScale() divides a measured width by nativeW, so a zero-width canvas would make
 * the whole absolute-zoom port answer 0 and every assertion below a false pass. The stub
 * reports the width the current transform would actually produce.
 */
function mount(opts?: Parameters<typeof setupStageNav>[8], extras?: { theme?: HTMLElement; sound?: HTMLElement; profile?: HTMLElement }) {
  const stage = document.createElement('div');
  const outer = document.createElement('div');
  const canvas = document.createElement('div');
  outer.appendChild(canvas);
  stage.appendChild(outer);
  document.body.appendChild(stage);
  canvas.getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, right: NATIVE_W * scaleOf(outer), bottom: 600,
    width: NATIVE_W * scaleOf(outer), height: 600, toJSON: () => ({}),
  }) as DOMRect;
  const nav = setupStageNav(stage, outer, canvas, NATIVE_W, null, extras?.theme, extras?.sound, extras?.profile, opts);
  return { stage, outer, canvas, nav, teardown() { nav.destroy(); stage.remove(); } };
}

/** Dispatch a keydown on window - the channel setupStageNav listens on. */
function press(key: string, mods: Record<string, boolean> = {}): KeyboardEvent {
  const e = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods });
  dom.window.dispatchEvent(e);
  return e;
}

test('by default the HUD is still built - every other canvas tool is untouched', () => {
  const h = mount();
  try {
    assert.ok(h.stage.querySelector('.stage-nav'), 'the floating zoom pill mounts as it always has');
  } finally { h.teardown(); }
});

test('the pill opts out of the canvas keyboard, docked in the column or floating over the stage', () => {
  // Eight focusable buttons sitting on the canvas, and the editor binds Delete, the arrows
  // and the tool letters on `window`: pressing Delete on "Zoom in" deleted the selected
  // box. Docked, the pill inherited the marker from the dock column; floating it had none.
  const h = mount();
  try {
    assert.equal(h.stage.querySelector<HTMLElement>('.stage-nav')!.getAttribute('data-canvas-keys'), 'off');
  } finally { h.teardown(); }
});

test('hud:false builds no HUD node at all', () => {
  const h = mount({ hud: false });
  try {
    assert.equal(h.stage.querySelector('.stage-nav'), null, 'no zoom pill on the stage');
    assert.equal(h.stage.children.length, 1, 'the stage gained nothing but the canvas wrapper it started with');
  } finally { h.teardown(); }
});

test('hud:false does not adopt the theme / sound controls - the caller re-homes them', () => {
  const theme = document.createElement('button');
  const sound = document.createElement('button');
  const h = mount({ hud: false }, { theme, sound });
  try {
    assert.equal(theme.parentElement, null, 'the theme toggle is left where the caller had it');
    assert.equal(sound.parentElement, null, 'and so is the sound toggle');
  } finally { h.teardown(); }
});

test('hud:false leaves every keyboard zoom working - the HUD was never the mechanism', () => {
  const h = mount({ hud: false });
  try {
    const zin = press('+', { shiftKey: true });
    assert.equal(zin.defaultPrevented, true, "Shift+'+' is still the canvas's");
    assert.ok(Math.abs(scaleOf(h.outer) - 1.25) < 1e-9, 'one step in = scale 1.25');
    press('0');
    assert.equal(h.outer.style.transform, '', '0 still fits (transform cleared)');
    press('1');
    assert.ok(Math.abs(h.nav.actual() - 1) < 1e-9, '1 still jumps to true 100%');
  } finally { h.teardown(); }
});

test('destroy() is clean with no HUD - nothing to remove, nothing to throw', () => {
  const h = mount({ hud: false });
  h.nav.destroy();
  h.stage.remove();
  // A second destroy is what a doubled teardown does; it must stay silent.
  assert.doesNotThrow(() => h.nav.destroy());
});

test('zoomBy multiplies and zoomTo lands on an ABSOLUTE ratio', () => {
  const h = mount({ hud: false });
  try {
    assert.ok(Math.abs(h.nav.actual() - 1) < 1e-9, 'a fitted 800px canvas at 800 native is 100%');
    h.nav.zoomBy(2);
    assert.ok(Math.abs(h.nav.actual() - 2) < 1e-9, 'zoomBy(2) doubles the view');
    h.nav.zoomBy(0.5);
    assert.ok(Math.abs(h.nav.actual() - 1) < 1e-9, 'and halving it comes back');
    h.nav.zoomTo(0.5);
    assert.ok(Math.abs(h.nav.actual() - 0.5) < 1e-9, 'zoomTo(0.5) is 50%, not "half of whatever we were"');
    h.nav.zoomTo(4);
    assert.ok(Math.abs(h.nav.actual() - 4) < 1e-9, 'and 400% from there is still absolute');
  } finally { h.teardown(); }
});

test('subscribe reports the current view now, then on every applied change, until unsubscribed', () => {
  const h = mount({ hud: false });
  try {
    const seen: number[] = [];
    const off = h.nav.subscribe(v => seen.push(v));
    assert.deepEqual(seen, [1], 'called back immediately, so a fresh readout is never born blank');
    h.nav.zoomBy(2);
    assert.equal(seen.length, 2, 'a zoom announces itself');
    assert.ok(Math.abs(seen[1]! - 2) < 1e-9, 'in absolute units');
    press('0');   // fit, via the keyboard - not through the port at all
    assert.ok(seen.length > 2, 'a zoom from ANY path fires, because apply() is the single fire point');
    const after = seen.length;
    off();
    h.nav.zoomBy(2);
    assert.equal(seen.length, after, 'unsubscribed means unsubscribed');
  } finally { h.teardown(); }
});

// ── Editor layout: the HUD lives in the ONE right sidebar (2026-09-02) ─────────
//
// Andy: "if the right sidebar is open the lolly zoom controls theme switcher menu
// element etc go there too". So in editor layout the widget is still built - it IS the
// sidebar's compact bar - but it is only ever seen inside the column, or after the user
// has deliberately dragged it out. The top bar owns zoom the rest of the time.
const ED = await import('../lib/edge-dock.ts');
(globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
  matches: false, media: q, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
});

test('editor layout builds the HUD (even over hud:false) but keeps it out of sight while the sidebar is empty', () => {
  const h = mount({ hud: false, editorLayout: true });
  try {
    const el = h.stage.querySelector<HTMLElement>('.stage-nav');
    assert.ok(el, 'the widget exists - it is the docked bar, not a second floating pill');
    assert.equal(el!.hidden, true, 'and it is hidden while it floats: the top bar owns zoom there');
  } finally { h.teardown(); }
});

test('a panel in the right sidebar takes the zoom bar with it, and an empty sidebar gives it back', () => {
  const h = mount({ hud: false, editorLayout: true });
  const panel = document.createElement('div');
  document.body.appendChild(panel);
  try {
    ED.requestDock('inspector', panel, { label: 'Inspector' });
    const el = document.querySelector<HTMLElement>('.stage-nav')!;
    assert.equal(ED.isDocked('zoom'), true, 'the HUD followed the panel into the column');
    assert.ok(el.closest('.edge-dock-slot--compact'), 'as the fixed-height compact bar');
    assert.equal(el.hidden, false, 'and it is visible in there');
    assert.equal(el.getAttribute('data-docked'), '');
    ED.releaseDock('inspector');
    assert.equal(ED.isDocked('zoom'), false, 'it leaves when the last panel does');
    assert.equal(document.querySelector('.edge-dock'), null, 'so the column tears down completely');
    assert.equal(h.stage.querySelector<HTMLElement>('.stage-nav')!.hidden, true, 'and the pill is hidden again');
  } finally {
    ED.releaseDock('inspector');
    panel.remove();
    h.teardown();
  }
});

test('autoDockHud: an ordinary canvas tool follows the sidebar too, but keeps its floating pill visible', () => {
  // Timezone / Darkroom and every other canvas tool consolidate the HUD into the one right
  // column (Andy, 2026-09-07) - but unlike the Design editor they have no top bar to carry
  // the zoom verbs, so the floating pill must STAY VISIBLE while nothing is docked.
  const h = mount({ hud: true, autoDockHud: true });
  const panel = document.createElement('div');
  document.body.appendChild(panel);
  try {
    const el = h.stage.querySelector<HTMLElement>('.stage-nav')!;
    assert.ok(el, 'the pill exists');
    assert.equal(el.classList.contains('stage-nav--editor'), false, 'and it is a plain canvas pill, not the editor bar');
    assert.equal(el.hidden, false, 'visible over the stage while the sidebar is empty (no top bar owns zoom here)');

    ED.requestDock('export', panel, { label: 'Export' });
    assert.equal(ED.isDocked('zoom'), true, 'the HUD followed the docked panel into the column');
    assert.ok(el.closest('.edge-dock-slot--compact'), 'riding in it as the compact bar');
    assert.equal(el.hidden, false, 'and visible in there');

    ED.releaseDock('export');
    assert.equal(ED.isDocked('zoom'), false, 'it leaves when the panel does');
    assert.equal(h.stage.querySelector<HTMLElement>('.stage-nav')!.hidden, false, 'and the pill is visible again over the stage, never hidden');
  } finally {
    ED.releaseDock('export');
    panel.remove();
    h.teardown();
  }
});

test('the docked bar carries zoom, theme/sound and the avatar without a duplicate app mark', () => {
  const theme = document.createElement('button');
  const sound = document.createElement('button');
  const profile = document.createElement('a');
  profile.className = 'profile-link';
  const h = mount({ hud: false, editorLayout: true }, { theme, sound, profile });
  try {
    const el = h.stage.querySelector<HTMLElement>('.stage-nav')!;
    assert.equal(el.querySelector('.stage-nav-mark'), null, 'File menu belongs beside the document name');
    for (const nav of ['out', 'fit', 'in']) {
      assert.ok(el.querySelector(`[data-nav="${nav}"]`), `the bar still carries ${nav}`);
    }
    assert.equal(theme.parentElement, el, 'theme rides along');
    assert.equal(sound.parentElement, el, 'so does sound');
    // The avatar rides too: the right dock owns the zoom, theme and profile controls
    // while it is open, and the top bar hides its own copies meanwhile (Andy, 2026-09-03).
    assert.equal(profile.parentElement, el, 'the avatar rides along as well');
    assert.equal(el.classList.contains('is-collapsed'), false, 'and the fold is off');
  } finally { h.teardown(); }
});

test('dragging the bar out of the sidebar by hand keeps it out for the session', () => {
  const h = mount({ hud: false, editorLayout: true });
  const panel = document.createElement('div');
  document.body.appendChild(panel);
  try {
    ED.requestDock('inspector', panel);
    const el = document.querySelector<HTMLElement>('.stage-nav')!;
    assert.equal(ED.isDocked('zoom'), true);
    const grip = el.querySelector<HTMLElement>('.stage-nav-grip')!;
    const drag = (type: string, x: number): void => {
      const e = new dom.window.MouseEvent(type, { clientX: x, clientY: 300, bubbles: true, button: 0 });
      (type === 'pointerdown' ? grip : dom.window).dispatchEvent(e);
    };
    drag('pointerdown', 900);
    drag('pointermove', 400);   // past the 4px threshold: this undocks it
    drag('pointerup', 400);
    assert.equal(ED.isDocked('zoom'), false, 'the drag took it out of the column');
    assert.equal(el.hidden, false, 'a bar pulled out by hand stays on screen');
    // …and the auto-dock stands down: another panel arriving does not drag it back in.
    ED.requestDock('export', document.body.appendChild(document.createElement('div')));
    assert.equal(ED.isDocked('zoom'), false, 'still out, because the user put it there');
  } finally {
    for (const id of ['zoom', 'inspector', 'export'] as const) ED.releaseDock(id);
    panel.remove();
    h.teardown();
  }
});

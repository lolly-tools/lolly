// SPDX-License-Identifier: MPL-2.0
/**
 * The Design top bar (views/design-topbar.ts, plan 179 M1 slice A).
 *
 * The bar exists as its own module precisely so this file can exist: every
 * capability it needs is injected, so the whole surface runs on a bare jsdom stage
 * against fakes, with no tool.ts, no free-canvas overlay and no stylesheet.
 *
 * Four claims are worth pinning, and each is a way the bar can be wrong while
 * looking right:
 *   • the CONTROL SET and its `data-topbar` ids - slice B wires tool.ts to those
 *     ids and the export/live-capture bridges to `data-export-hide` /
 *     `data-live-hide`, so a renamed id is a silently dead button (or a bar that
 *     paints into somebody's PNG);
 *   • the GEOMETRY CONTRACT - the reserve write must be equality-guarded, because
 *     its own `canvas-resize` wakes the stage ResizeObserver that re-measures the
 *     bar; without the guard that is an infinite loop, and a loop is not something
 *     a screenshot shows you;
 *   • the PRESENT split rows, which are the only place four different verbs
 *     (present here, speaker view, auto-advance, kiosk loop) are told apart by
 *     nothing but their arguments - and whose two checkbox rows must report what the
 *     PORT holds after the write, not what the click asked for: both of those ports
 *     (a `?loop` URL write, a runtime `setInput`) are free to refuse or normalise;
 *   • FOCUS CONTINUITY - Escape and Tab both have to put focus back on the trigger,
 *     and a button that disables itself has to hand focus to its sibling first.
 *     Every one of those, missed, drops focus to <body>, and the next Tab then
 *     restarts at the top of the document instead of at the neighbouring control.
 *
 * What is NOT testable here, and is verified by hand in a browser: the painted
 * geometry (jsdom has no layout - offsetHeight is stubbed below), the breakpoint
 * behaviour in design-topbar.css, and the backdrop blur.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/design-topbar.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountDesignTopbar } from './design-topbar.ts';
import type { DesignTopbarOpts } from './design-topbar.ts';
import { icon } from '../lib/icons.ts';
import type { IconName } from '../lib/icons.ts';

// ── jsdom bootstrap (same shape as free-canvas-rail.test.ts) ──────────────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { KeyboardEvent: typeof KeyboardEvent; MouseEvent: typeof MouseEvent; Event: typeof Event };
for (const k of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'KeyboardEvent', 'Event', 'MouseEvent', 'Node', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
// The bar hands its ResizeObserver callback to the test through the LAST constructed
// observer, so a density test can drive a fake resize.
let lastRo: (() => void) | null = null;
(globalThis as Record<string, unknown>).ResizeObserver = class { constructor(cb: () => void) { lastRo = cb; } observe() {} disconnect() {} };
// jsdom has no layout, so every offsetHeight is 0 and the reserve would be a
// meaningless '0px'. Give the whole document one - the bar measures itself, and
// what is under test is the GUARD around that number, not the number.
const BAR_H = 48;
Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return BAR_H; } });

const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
const key = (el: Element, k: string): void => { el.dispatchEvent(new W.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); };

// ── fixture ───────────────────────────────────────────────────────────────────

interface Calls {
  present: Array<{ at?: string; speaker?: boolean } | undefined>;
  inputs: Array<[string, unknown]>;
  loop: boolean[];
  share: number;
  export: number;
  exportFormat?: string;
  markMenu: number;
  zoom: string[];
  names: string[];
  resize: number;
}

function fixture(over: Partial<DesignTopbarOpts> = {}) {
  const stageEl = dom.window.document.createElement('div');
  const canvasEl = dom.window.document.createElement('div');
  dom.window.document.body.append(stageEl, canvasEl);

  const calls: Calls = { present: [], inputs: [], loop: [], share: 0, export: 0, markMenu: 0, zoom: [], names: [], resize: 0 };
  canvasEl.addEventListener('canvas-resize', () => { calls.resize++; });

  // An in-memory model that echoes setInput back through getInput - a real
  // round-trip, so a checkbox row that writes then re-reads is actually tested.
  const model = new Map<string, unknown>();
  let loopOn = false;
  let docName = 'Quarterly deck';
  let timelineOpen = false;
  let navOpen = false;
  let inspOpen = false;
  let zoomCb: ((s: number) => void) | null = null;
  let histSync: ((u: boolean, r: boolean) => void) | null = null;
  let scale = 1;

  const opts: DesignTopbarOpts = {
    stageEl, canvasEl,
    history: {
      undo: () => { calls.zoom.push('undo'); },
      redo: () => { calls.zoom.push('redo'); },
      register: s => { histSync = s; },
    },
    name: {
      get: () => docName,
      set: v => { docName = v; calls.names.push(v); },
      placeholder: () => 'design-2026-09-02',
    },
    zoom: {
      fitAll: () => { calls.zoom.push('fitAll'); },
      fitArtboard: () => { calls.zoom.push('fitArtboard'); },
      zoomBy: f => { calls.zoom.push(`by:${f}`); },
      zoomTo: a => { calls.zoom.push(`to:${a}`); },
      actual: () => scale,
      subscribe: cb => { zoomCb = cb; return () => { zoomCb = null; }; },
    },
    timeline: { toggle: () => { timelineOpen = !timelineOpen; }, isOpen: () => timelineOpen },
    navigator: { toggle: () => { navOpen = !navOpen; }, isOpen: () => navOpen },
    inspector: { toggle: () => { inspOpen = !inspOpen; }, isOpen: () => inspOpen },
    share: () => { calls.share++; },
    present: o => { calls.present.push(o); },
    exportSheet: (o) => { calls.export++; calls.exportFormat = o?.format; },
    model: { getInput: id => model.get(id), setInput: (id, v) => { model.set(id, v); calls.inputs.push([id, v]); } },
    loop: { get: () => loopOn, set: v => { loopOn = v; calls.loop.push(v); } },
    onFileMenu: () => { calls.markMenu++; },
    hasFrames: () => true,
    activeFrameId: () => 'frame-2',
    ...over,
  };

  const bar = mountDesignTopbar(opts);
  const at = (id: string): HTMLElement => {
    const el = bar.el.querySelector<HTMLElement>(`[data-topbar="${id}"]`);
    assert.ok(el, `missing [data-topbar="${id}"]`);
    return el;
  };
  return {
    bar, opts, calls, stageEl, canvasEl, at,
    setName: (v: string) => { docName = v; },
    /** Open a panel the way the rail, the object bar or the column's own control would -
     *  i.e. without the bar hearing about it. */
    openElsewhere: (which: 'timeline' | 'navigator' | 'inspector') => {
      if (which === 'timeline') timelineOpen = true;
      else if (which === 'navigator') navOpen = true;
      else inspOpen = true;
    },
    resize: () => { canvasEl.dispatchEvent(new W.Event('canvas-resize')); },
    setScale: (v: number) => { scale = v; },
    emitZoom: (v: number) => { scale = v; zoomCb?.(v); },
    emitHistory: (u: boolean, r: boolean) => { histSync?.(u, r); },
    menu: (): HTMLElement | null => bar.el.querySelector('.dtb-menu'),
    rows: (): HTMLButtonElement[] => Array.from(bar.el.querySelectorAll<HTMLButtonElement>('.dtb-menu-item')),
  };
}

// ── structure ─────────────────────────────────────────────────────────────────

test('renders every documented control, in order, with the export/live contracts', () => {
  const f = fixture();
  const ids = Array.from(f.bar.el.querySelectorAll('[data-topbar]')).map(el => el.getAttribute('data-topbar'));
  assert.deepEqual(ids, [
    'file', 'name',
    'undo', 'redo', 'fit-all', 'fit-artboard', 'zoom-level', 'zoom-out', 'zoom-in', 'timeline', 'navigator', 'inspector',
    // The hamburger (hidden at full width) sits ahead of Share: it is where the centre
    // cluster, then Share and the Present rows, fold as the bar narrows (syncDensity).
    'more',
    'share', 'present', 'present-menu', 'export',
  ]);
  assert.equal(f.bar.el.className, 'design-topbar');
  assert.equal(f.bar.el.getAttribute('role'), 'toolbar');
  assert.ok(f.bar.el.getAttribute('aria-label'), 'the toolbar names itself');
  assert.ok(f.bar.el.hasAttribute('data-export-hide'), 'chrome must never paint into a render');
  assert.ok(f.bar.el.hasAttribute('data-live-hide'), 'nor into a live capture');
  assert.equal(f.bar.el.parentElement, f.stageEl, 'the bar mounts itself onto the stage');
  f.bar.destroy();
});

test('every control is keyboard reachable and names itself', () => {
  const f = fixture();
  for (const el of Array.from(f.bar.el.querySelectorAll<HTMLElement>('[data-topbar]'))) {
    assert.ok(el.tagName === 'BUTTON' || el.tagName === 'INPUT',
      `[data-topbar="${el.getAttribute('data-topbar')}"] is a <${el.tagName.toLowerCase()}> - not natively focusable`);
    assert.ok((el.getAttribute('aria-label') || '').length > 0,
      `[data-topbar="${el.getAttribute('data-topbar')}"] has no accessible name`);
    assert.equal(el.getAttribute('tabindex'), null, 'nothing is taken out of the tab order');
  }
  // The three menu triggers advertise themselves as such.
  for (const id of ['file', 'zoom-level', 'present-menu']) {
    assert.equal(f.at(id).getAttribute('aria-haspopup'), 'menu', `${id} must advertise its menu`);
  }
  assert.equal(f.at('timeline').getAttribute('aria-pressed'), 'false');
  assert.equal(f.at('navigator').getAttribute('aria-pressed'), 'false');
  assert.equal(f.at('inspector').getAttribute('aria-pressed'), 'false');
  // The File menu belongs to the overlay (`onFileMenu` hands the anchor over), so the
  // attribute is written by free-canvas's popover - but it has to EXIST for that code to
  // find, or the state is never reported and the trigger never restores focus.
  assert.equal(f.at('file').getAttribute('aria-expanded'), 'false');
  f.bar.destroy();
});

test('the back-pill island is inserted verbatim, so mountBackPill still finds it', () => {
  const f = fixture({ backPillHtml: '<div class="chrome-topleft"><a data-back-pill="home" href="#/">Home</a></div>' });
  const pill = f.bar.el.querySelector('[data-back-pill]');
  assert.ok(pill, 'the pill survived the insert');
  assert.ok(pill.closest('.chrome-topleft'), 'and kept its island wrapper');
  f.bar.destroy();
});

test('the outcome switch keeps a meaningful icon when density hides its label', () => {
  let intent = 'slides';
  const f = fixture({
    intent: {
      get: () => intent,
      set: value => { intent = value; },
      options: [
        { value: 'slides', label: 'Slides' },
        { value: 'carousel', label: 'LinkedIn carousel' },
      ],
    },
  });
  const button = f.at('intent');
  assert.equal(button.querySelector('.dtb-label')?.textContent, 'Slides');
  assert.ok(button.querySelector('svg.dtb-intent-kind'), 'compact state has an outcome glyph');
  assert.ok(button.querySelector('svg.dtb-intent-caret'), 'the glyph still advertises a menu');
  click(button);
  const carousel = f.rows().find(row => row.textContent?.includes('LinkedIn carousel'));
  assert.ok(carousel);
  click(carousel);
  assert.equal(intent, 'carousel');
  assert.equal(button.querySelector('.dtb-label')?.textContent, 'LinkedIn carousel');
  assert.match(button.querySelector('svg.dtb-intent-kind')?.outerHTML ?? '', /<svg/);
  assert.equal(f.at('present').querySelector('.dtb-label')?.textContent, 'Preview');
  assert.equal(f.at('present').getAttribute('aria-label'), 'Preview');
  f.bar.destroy();
});

// ── the geometry contract ─────────────────────────────────────────────────────

test('reserves its own height on the stage and dispatches canvas-resize EXACTLY once', () => {
  const f = fixture();
  assert.equal(f.stageEl.style.getPropertyValue('--stage-reserve-top'), `${BAR_H}px`);
  assert.equal(f.calls.resize, 1, 'the mount fit the canvas once');
  f.bar.sync();
  f.bar.sync();
  assert.equal(f.calls.resize, 1, 'an unchanged reserve must not re-dispatch - that is the RO feedback loop');
  f.bar.destroy();
  assert.equal(f.stageEl.style.getPropertyValue('--stage-reserve-top'), '', 'destroy hands the stage back');
  assert.equal(f.calls.resize, 2, 'and re-fits once on the way out');
});

// ── history ───────────────────────────────────────────────────────────────────

test('undo/redo follow the registered history sync, and run the right verb', () => {
  const f = fixture();
  const undo = f.at('undo') as HTMLButtonElement;
  const redo = f.at('redo') as HTMLButtonElement;
  assert.ok(undo.disabled && redo.disabled, 'a fresh mount has no history');
  f.emitHistory(true, false);
  assert.equal(undo.disabled, false);
  assert.equal(redo.disabled, true);
  f.emitHistory(true, true);
  assert.equal(redo.disabled, false);
  click(undo); click(redo);
  assert.deepEqual(f.calls.zoom, ['undo', 'redo']);
  f.emitHistory(false, false);
  assert.ok(undo.disabled && redo.disabled, 'and back off at the ends of the stack');
  f.bar.destroy();
});

test('the button that disables itself hands focus to its sibling, never to <body>', () => {
  const f = fixture();
  const undo = f.at('undo') as HTMLButtonElement;
  const redo = f.at('redo') as HTMLButtonElement;
  f.emitHistory(true, true);

  // The last undo, run from the keyboard: the focused button is about to go dead.
  undo.focus();
  assert.equal(dom.window.document.activeElement, undo);
  f.emitHistory(false, true);
  assert.equal(dom.window.document.activeElement, redo, 'focus moved to Redo BEFORE Undo disabled');
  assert.equal(undo.disabled, true);

  // ...and symmetrically on the way back up the stack.
  f.emitHistory(true, true);
  redo.focus();
  f.emitHistory(true, false);
  assert.equal(dom.window.document.activeElement, undo);

  // Nothing to hand to (an emptied stack), and nobody to take it from: a sync that
  // did not disable the focused control must never steal focus from elsewhere.
  const name = f.at('name');
  name.focus();
  f.emitHistory(false, false);
  assert.equal(dom.window.document.activeElement, name, 'an unrelated focus is left where it was');
  f.bar.destroy();
});

// ── zoom ──────────────────────────────────────────────────────────────────────

test('the readout follows zoom.subscribe, and sync() re-reads zoom.actual()', () => {
  const f = fixture();
  const label = f.at('zoom-level').querySelector('.dtb-label')!;
  assert.equal(label.textContent, '100%');
  f.emitZoom(0.375);
  assert.equal(label.textContent, '38%', 'rounded, not truncated');
  f.setScale(2.5);
  f.bar.sync();
  assert.equal(label.textContent, '250%');
  f.bar.destroy();
});

test('the zoom cluster calls the right port method', () => {
  const f = fixture();
  click(f.at('fit-all'));
  click(f.at('fit-artboard'));
  click(f.at('zoom-out'));
  click(f.at('zoom-in'));
  assert.deepEqual(f.calls.zoom, ['fitAll', 'fitArtboard', 'by:0.8', 'by:1.25']);
  f.bar.destroy();
});

test('the NN% button opens a menu of stops that zoom to an absolute ratio', () => {
  const f = fixture();
  click(f.at('zoom-level'));
  assert.equal(f.at('zoom-level').getAttribute('aria-expanded'), 'true');
  const rows = f.rows();
  assert.deepEqual(rows.map(r => r.textContent), ['50%', '100%', '200%', '400%', 'Fit all', 'Fit artboard']);
  assert.equal(f.menu()!.getAttribute('role'), 'menu');
  assert.ok(rows.every(r => r.getAttribute('role') === 'menuitem'));
  click(rows[2]!);
  assert.deepEqual(f.calls.zoom, ['to:2']);
  assert.equal(f.menu(), null, 'an action row closes the menu');
  f.bar.destroy();
});

test('the zoom stops are numerals, written identically in the menu and the readout', () => {
  const f = fixture();
  click(f.at('zoom-level'));
  const row = f.rows()[2]!;                       // the 200% stop
  assert.equal(row.textContent, '200%');
  click(row);
  f.emitZoom(2);
  assert.equal(f.at('zoom-level').querySelector('.dtb-label')!.textContent, row.textContent,
    'the same number must not be a catalog key in the menu and a bare string in the readout');
  f.bar.destroy();
});

// ── the right-edge dock ───────────────────────────────────────────────────────
//
// The compact zoom bar (components/zoom-hud.ts) can hold a slot in the app's one
// right-hand column, where it carries Fit / NN% / ± itself. Two copies of the same five
// verbs on one screen is the duplication this bar was built to retire - the floating
// swirl pill went for exactly that reason - so the bar drops its cluster while that
// compact bar is docked, and takes it back when the column gives it up.

/** A fake dock whose `docked` flag the test flips, then notifies. */
function fakeDock(): { port: NonNullable<DesignTopbarOpts['dock']>; set(v: boolean): void; subs: number } {
  const subs = new Set<() => void>();
  let docked = false;
  return {
    port: {
      zoomDocked: () => docked,
      subscribe: (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    },
    set(v: boolean) { docked = v; for (const cb of [...subs]) cb(); },
    get subs() { return subs.size; },
  };
}

test('the zoom cluster steps aside while the compact zoom bar holds the dock', () => {
  const dock = fakeDock();
  const f = fixture({ dock: dock.port });
  const group = f.bar.el.querySelector<HTMLElement>('[data-topbar-group="zoom"]');
  assert.ok(group, 'the five zoom verbs live in one group, so they hide and return together');
  assert.deepEqual(
    Array.from(group.querySelectorAll('[data-topbar]')).map(el => el.getAttribute('data-topbar')),
    ['fit-all', 'fit-artboard', 'zoom-level', 'zoom-out', 'zoom-in'],
    'exactly the zoom cluster - no other control may ride the dock into hiding',
  );
  assert.ok(group.querySelector('.dtb-sep'), 'its own rule travels with it, or a stray line is left behind');
  assert.equal(group.hidden, false, 'nothing docked: the bar carries the zoom verbs');

  dock.set(true);
  assert.equal(group.hidden, true, 'docked: the column carries them, so the bar must not');
  assert.equal(f.at('timeline').closest('[data-topbar-group]'), null, 'the panel toggles never move');
  assert.equal(f.at('undo').closest('[data-topbar-group]'), null, 'nor does history');

  dock.set(false);
  assert.equal(group.hidden, false, 'undocked: the cluster comes back');

  f.bar.destroy();
  assert.equal(dock.subs, 0, 'destroy unsubscribes - a listener on a removed bar is a leak');
});

test('File menu stays immediately before the filename when the zoom bar is docked', () => {
  const dock = fakeDock();
  const f = fixture({ dock: dock.port });
  try {
    const file = f.at('file');
    assert.equal(file.nextElementSibling, f.at('name'));
    assert.equal(file.getAttribute('aria-label'), 'File menu');
    for (const docked of [true, false]) {
      dock.set(docked);
      assert.equal(file.hidden, false);
      file.click();
    }
    assert.equal(f.calls.markMenu, 2);
  } finally { f.bar.destroy(); }
});

test('a dock that is ALREADY holding the zoom bar is read at mount, not only on a change', () => {
  // The bar is mounted mid-session (a remount, a navigation back into the editor) with the
  // column already open, and no change event is coming to tell it so.
  const f = fixture({ dock: { zoomDocked: () => true, subscribe: () => () => { /* never fires */ } } });
  assert.equal(f.bar.el.querySelector<HTMLElement>('[data-topbar-group="zoom"]')!.hidden, true);
  f.bar.destroy();
});

test('the avatar is HANDED to the docked bar, not hidden inside a hidden slot', () => {
  // The bug this pins: syncDock used to hide `.dtb-profile` with the avatar still in it,
  // and the docked compact bar had no avatar of its own - so opening the right column
  // took the profile menu off the screen entirely, with nothing anywhere to open it.
  const dock = fakeDock();
  const avatar = dom.window.document.createElement('a');
  avatar.className = 'profile-link';
  const home = dom.window.document.createElement('div');   // stands in for the docked pill
  dom.window.document.body.appendChild(home);
  const f = fixture({ profileEl: avatar, dock: dock.port, profileDock: () => home });
  const slot = (): HTMLElement => f.bar.el.querySelector<HTMLElement>('.dtb-profile')!;
  assert.equal(avatar.parentElement, slot(), 'nothing docked: the bar keeps the avatar');
  assert.equal(slot().hidden, false);

  dock.set(true);
  assert.equal(avatar.parentElement, home, 'docked: the avatar moves to the column');
  assert.equal(slot().hidden, true, 'and the bar empties its slot rather than showing a gap');

  dock.set(false);
  assert.equal(avatar.parentElement, slot(), 'undocked: the bar takes the avatar back');
  assert.equal(slot().hidden, false);
  f.bar.destroy();
  home.remove();
});

test('…and with nowhere to hand it, the bar keeps the avatar rather than losing it', () => {
  // A host with no docked bar to hand it to (or one whose pill is not built yet) must
  // still leave exactly one avatar on the page: visible here beats hidden everywhere.
  const dock = fakeDock();
  const avatar = dom.window.document.createElement('a');
  avatar.className = 'profile-link';
  const f = fixture({ profileEl: avatar, dock: dock.port, profileDock: () => null });
  dock.set(true);
  const slot = f.bar.el.querySelector<HTMLElement>('.dtb-profile')!;
  assert.equal(avatar.parentElement, slot, 'the avatar stays put');
  assert.equal(slot.hidden, false, 'and stays visible - a hidden slot is the same as no avatar');
  assert.equal(f.bar.el.querySelector<HTMLElement>('[data-topbar-group="zoom"]')!.hidden, true,
    'the zoom cluster still steps aside: only the avatar depends on a home being offered');
  f.bar.destroy();
});

test('a bar with no profileDock port at all behaves as it always did', () => {
  const dock = fakeDock();
  const avatar = dom.window.document.createElement('a');
  avatar.className = 'profile-link';
  const f = fixture({ profileEl: avatar, dock: dock.port });
  dock.set(true);
  assert.equal(avatar.parentElement, f.bar.el.querySelector('.dtb-profile'));
  assert.equal(f.bar.el.querySelector<HTMLElement>('.dtb-profile')!.hidden, false);
  f.bar.destroy();
});

test('with no dock at all the cluster is permanent', () => {
  // Every host but the design editor has no right-hand column, and must not lose its
  // zoom verbs to a port it never passed.
  const f = fixture();
  assert.equal(f.bar.el.querySelector<HTMLElement>('[data-topbar-group="zoom"]')!.hidden, false);
  f.bar.sync();
  assert.equal(f.bar.el.querySelector<HTMLElement>('[data-topbar-group="zoom"]')!.hidden, false);
  f.bar.destroy();
});

// ── panel toggles ─────────────────────────────────────────────────────────────

test('Timeline and Navigator toggle their panel and report it in aria-pressed', () => {
  const f = fixture();
  click(f.at('timeline'));
  assert.equal(f.at('timeline').getAttribute('aria-pressed'), 'true');
  assert.equal(f.at('navigator').getAttribute('aria-pressed'), 'false', 'they are independent');
  click(f.at('navigator'));
  assert.equal(f.at('navigator').getAttribute('aria-pressed'), 'true');
  click(f.at('timeline'));
  assert.equal(f.at('timeline').getAttribute('aria-pressed'), 'false');
  f.bar.destroy();
});

test('the Inspector toggle is the column\'s only outside control, and is absent without one', () => {
  const f = fixture();
  click(f.at('inspector'));
  assert.equal(f.at('inspector').getAttribute('aria-pressed'), 'true');
  click(f.at('inspector'));
  assert.equal(f.at('inspector').getAttribute('aria-pressed'), 'false', 'and it toggles back off');
  assert.equal(f.at('timeline').getAttribute('aria-pressed'), 'false', 'the three are independent');
  f.bar.destroy();

  // No column, no button: an editor with no inspector must not grow a toggle for
  // nothing. (`at()` asserts, so query directly.)
  const bare = fixture({ inspector: undefined });
  assert.equal(bare.bar.el.querySelector('[data-topbar="inspector"]'), null);
  bare.bar.destroy();
});

test('a panel opened from somewhere else still reports itself pressed', () => {
  // The timeline opens from the tool rail, from the inspector's Motion door and by a
  // document that arrives already timed; the navigator from its own collapse control;
  // the inspector from the object bar's Text / More / Stroke buttons. None of those come
  // back through the bar, and `syncToggles` used to run only from the two click
  // handlers - so the button said `aria-pressed="false"` over an open panel, and the
  // FIRST click then closed it, making the control look like it did nothing.
  const f = fixture();
  f.openElsewhere('timeline');
  f.openElsewhere('inspector');
  assert.equal(f.at('timeline').getAttribute('aria-pressed'), 'false', 'precondition: nobody has told the bar');
  // Opening either panel changes a stage reserve, and every writer of those dispatches
  // `canvas-resize` at the canvas - which is the signal the bar rides.
  f.resize();
  assert.equal(f.at('timeline').getAttribute('aria-pressed'), 'true');
  assert.equal(f.at('inspector').getAttribute('aria-pressed'), 'true');
  assert.equal(f.at('navigator').getAttribute('aria-pressed'), 'false', 'and only the ones that are open');
  f.bar.destroy();
});

test('sync() reports the columns the host mounts AFTER the bar', () => {
  // The host mounts both columns after `mountDesignTopbar` returns, and neither fires
  // `onOpenChange` at mount - so the bar's own mount-time sync() saw two null handles.
  // One sync() from the host, once they exist, is the fix; this pins that it works.
  const f = fixture();
  f.openElsewhere('navigator');
  f.bar.sync();
  assert.equal(f.at('navigator').getAttribute('aria-pressed'), 'true');
  f.bar.destroy();
});

// ── the keyboard gate ─────────────────────────────────────────────────────────

test('no key pressed in the bar reaches the canvas, and every app-wide chord still does', () => {
  // free-canvas binds its shortcuts on `window` and bails only for a typing target or
  // focus inside `.tl-panel` - a <button> in this bar is neither. So Backspace on the
  // focused Export button deleted the selected box, ArrowDown on a menu row nudged it
  // and pushed an undo step, `v`/`p`/`n` switched tools and `\` hid every piece of
  // chrome. The bar cannot edit that handler, so it stops its own keys on the way out.
  const f = fixture();
  const seen: string[] = [];
  const spy = (e: Event): void => {
    const k = e as KeyboardEvent;
    seen.push(`${k.metaKey ? 'Meta+' : ''}${k.key}`);
  };
  W.window.addEventListener('keydown', spy);
  try {
    key(f.at('export'), 'Backspace');
    key(f.at('export'), 'v');
    key(f.at('export'), '\\');
    key(f.at('inspector'), ' ');
    assert.deepEqual(seen, [], 'not one of them reached a window handler');

    // Arrow keys inside a bar MENU are the same hazard: the menu is a child of the bar
    // root, and its own handler preventDefault()s without stopping propagation.
    click(f.at('zoom-level'));
    key(f.rows()[0]!, 'ArrowDown');
    assert.deepEqual(seen, [], 'walking the zoom menu must not nudge the selection');
    key(f.rows()[1]!, 'Escape');

    // Chords are app-wide by definition: ⌘Z is the tool view's undo, ⌘S its save,
    // ⌘Return its Present - all bound on `window` too.
    f.at('export').dispatchEvent(new W.KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }));
    assert.deepEqual(seen, ['Meta+z']);
    // …and Escape belongs to the editor's own ladder wherever the focus is.
    key(f.at('export'), 'Escape');
    assert.deepEqual(seen, ['Meta+z', 'Escape']);
  } finally {
    W.window.removeEventListener('keydown', spy);
    f.bar.destroy();
  }
});

// ── the right-hand verbs ──────────────────────────────────────────────────────

test('Share, Export and the mark reach their injected verb', () => {
  const f = fixture();
  click(f.at('share'));
  click(f.at('export'));
  click(f.at('file'));
  assert.equal(f.calls.share, 1);
  assert.equal(f.calls.export, 1);
  assert.equal(f.calls.markMenu, 1);
  f.bar.destroy();
});

test('the Present split: the main half presents, each menu row calls its own verb once', () => {
  const f = fixture();
  click(f.at('present'));
  assert.deepEqual(f.calls.present, [undefined], 'the main half takes no options');

  click(f.at('present-menu'));
  let rows = f.rows();
  assert.deepEqual(rows.map(r => r.textContent), [
    'Present from this slide', 'Speaker view', 'Auto-advance slides', 'Loop the deck (kiosk)', 'Export slides as video',
  ]);
  click(rows[0]!);
  assert.deepEqual(f.calls.present[1], { at: 'frame-2' }, 'starts on the active frame');

  click(f.at('present-menu'));
  rows = f.rows();
  click(rows[1]!);
  assert.deepEqual(f.calls.present[2], { speaker: true });
  assert.equal(f.calls.present.length, 3, 'each row fires exactly once');

  // The last row leaves the podium for the export sheet, opened on mp4 (plans/184 R3).
  click(f.at('present-menu'));
  rows = f.rows();
  click(rows[rows.length - 1]!);
  assert.equal(f.calls.export, 1, 'the video row opens the export sheet once');
  assert.equal(f.calls.exportFormat, 'mp4', 'on the mp4 format');
  assert.equal(f.calls.present.length, 3, 'and presents nothing');

  // The two checkbox rows are one open: a checkbox keeps the menu up so both can be set.
  click(f.at('present-menu'));
  rows = f.rows();
  assert.equal(rows[2]!.getAttribute('role'), 'menuitemcheckbox');
  assert.equal(rows[2]!.getAttribute('aria-checked'), 'false');
  click(rows[2]!);
  assert.deepEqual(f.calls.inputs, [['autoAdvance', true]]);
  assert.equal(rows[2]!.getAttribute('aria-checked'), 'true');
  assert.ok(f.menu(), 'a checkbox row keeps the menu open');
  click(rows[3]!);
  assert.deepEqual(f.calls.loop, [true]);

  // Re-opening reads the values back out of the ports, not out of the old DOM.
  click(f.at('present-menu'));   // the trigger toggles: this shuts the still-open menu
  click(f.at('present-menu'));   // and this builds a fresh one
  rows = f.rows();
  assert.equal(rows[2]!.getAttribute('aria-checked'), 'true', 'autoAdvance round-tripped through the model');
  assert.equal(rows[3]!.getAttribute('aria-checked'), 'true', 'and the loop flag through its own port');
  click(rows[2]!);
  assert.deepEqual(f.calls.inputs, [['autoAdvance', true], ['autoAdvance', false]], 'the checkbox is a toggle');
  f.bar.destroy();
});

test('a checkbox row reports the PORT after the write, not a blind flip of its own tick', () => {
  // Both checkbox rows write through something that can say no: `loop.set()` is a
  // `?loop` URL write and `setInput()` goes through the runtime. This port refuses.
  const asked: unknown[] = [];
  const f = fixture({
    model: { getInput: () => false, setInput: (_id, v) => { asked.push(v); } },
    loop: { get: () => false, set: v => { asked.push(v); } },
  });
  click(f.at('present-menu'));
  const rows = f.rows();
  assert.equal(rows[2]!.getAttribute('aria-checked'), 'false');
  click(rows[2]!);
  assert.deepEqual(asked, [true], 'the row still asked for the change');
  assert.equal(rows[2]!.getAttribute('aria-checked'), 'false',
    'but the tick reports the port, which refused - a blind flip would read the opposite of the truth');
  click(rows[3]!);
  assert.deepEqual(asked, [true, true]);
  assert.equal(rows[3]!.getAttribute('aria-checked'), 'false', 'same for the kiosk flag');
  assert.ok(f.menu(), 'and the menu stays open, showing it, which is the whole interaction');
  f.bar.destroy();
});

// ── Narrate (plans/180 section 8) ─────────────────────────────────────────────

test('the Present menu grows a Narrate row that calls the port once, and only with a port', () => {
  // Without a speech bridge the host passes no `narrate`, and the row must not exist at
  // all: a menu entry that fails on press is worse than one that was never offered.
  const plain = fixture();
  click(plain.at('present-menu'));
  assert.deepEqual(plain.rows().map(r => r.textContent), [
    'Present from this slide', 'Speaker view', 'Auto-advance slides', 'Loop the deck (kiosk)', 'Export slides as video',
  ], 'no narration port, no row');
  plain.bar.destroy();

  const calls: string[] = [];
  const f = fixture({
    narrate: {
      narrateAll: () => { calls.push('all'); },
      narrateFrame: (id: string) => { calls.push(`one:${id}`); },
      status: () => 'pending' as const,
    },
  });
  click(f.at('present-menu'));
  const rows = f.rows();
  assert.deepEqual(rows.map(r => r.textContent), [
    'Present from this slide', 'Speaker view', 'Narrate', 'Auto-advance slides', 'Loop the deck (kiosk)', 'Export slides as video',
  ], 'Narrate sits with the other present-time verbs');
  assert.equal(rows[2]!.getAttribute('role'), 'menuitem', 'a verb, not a checkbox');
  click(rows[2]!);
  assert.deepEqual(calls, ['all'], 'the deck-wide verb, exactly once');
  assert.equal(f.menu(), null, 'and an action row closes the menu');
  f.bar.destroy();
});

test('a live outcome gate removes narration from a carousel without removing Present', () => {
  let enabled = true;
  const f = fixture({
    narrationEnabled: () => enabled,
    narrate: { narrateAll: () => {}, narrateFrame: () => {}, status: () => 'pending' as const },
  });
  click(f.at('present-menu'));
  assert.ok(f.rows().some((row) => row.textContent === 'Narrate'));
  click(f.at('present-menu')); // close before the outcome changes
  enabled = false;
  f.bar.sync();
  click(f.at('present-menu'));
  assert.equal(f.rows().some((row) => row.textContent === 'Narrate'), false);
  assert.ok(f.rows().some((row) => row.textContent === 'Present from this slide'), 'presentation itself remains available');
  f.bar.destroy();
});

test('a live outcome gate hides Timeline and disables its shortcut until playback is relevant', () => {
  let enabled = false;
  const f = fixture({ timelineEnabled: () => enabled });
  const timeline = f.at('timeline');
  assert.equal(timeline.hidden, true, 'static Design starts without motion chrome');
  click(timeline);
  assert.equal(timeline.getAttribute('aria-pressed'), 'false', 'a hidden control cannot be invoked programmatically');
  const unavailableKey = new dom.window.KeyboardEvent('keydown', {
    code: 'Digit1', altKey: true, bubbles: true, cancelable: true,
  });
  dom.window.document.body.dispatchEvent(unavailableKey);
  assert.equal(timeline.getAttribute('aria-pressed'), 'false', 'Alt+1 is inert while Timeline is unavailable');
  assert.equal(unavailableKey.defaultPrevented, false, 'an unavailable shortcut is not stolen from the host');

  enabled = true;
  f.bar.sync();
  assert.equal(timeline.hidden, false, 'switching to Video/Slides restores the existing control');
  dom.window.document.body.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
    code: 'Digit1', altKey: true, bubbles: true, cancelable: true,
  }));
  assert.equal(timeline.getAttribute('aria-pressed'), 'true');
  f.bar.destroy();
});

test('Narrate is greyed when there is nothing to narrate, and when there are no frames', () => {
  // Greyed rather than hidden: the way to get a narrated deck has to stay discoverable
  // from the menu that presents it, even on the slide before anyone typed a note. Which
  // is why it is `aria-disabled` and NOT the `disabled` property - a disabled button is
  // taken out of the arrow-key ring and never reaches a screen reader, so the one row
  // whose whole job is to be discovered was invisible to exactly those users.
  const calls: string[] = [];
  let ready = false;
  const f = fixture({
    hasFrames: () => true,
    narrate: {
      narrateAll: () => { calls.push('all'); },
      narrateFrame: () => {},
      status: () => 'none' as const,
      ready: () => ready,
      reason: () => 'No slide has speaker notes yet.',
    },
  });
  click(f.at('present-menu'));
  let rows = f.rows();
  assert.equal(rows[2]!.getAttribute('aria-disabled'), 'true', 'no slide carries notes yet');
  assert.equal(rows[2]!.disabled, false, 'and it is still focusable, so the keyboard can find it');
  assert.ok(rows[2]!.textContent?.includes('No slide has speaker notes yet.'),
    'a greyed control that gives no reason reads as broken');
  click(rows[2]!);
  // `.length`, not deepEqual against a literal: node's strict deepEqual is an assertion
  // signature, so comparing to `[]` narrows the array to never[] for the rest of the test.
  assert.equal(calls.length, 0, 'a disabled row runs nothing');

  ready = true;
  click(f.at('present-menu'));   // shut
  click(f.at('present-menu'));   // and re-read the port
  rows = f.rows();
  assert.equal(rows[2]!.getAttribute('aria-disabled'), null, 'notes exist now: the row is live');
  assert.ok(!rows[2]!.textContent?.includes('speaker notes yet'), 'and the reason goes with it');
  f.bar.destroy();

  const noFrames = fixture({
    hasFrames: () => false,
    narrate: { narrateAll: () => { calls.push('all'); }, narrateFrame: () => {}, status: () => 'none' as const },
  });
  click(noFrames.at('present-menu'));
  assert.equal(noFrames.rows()[2]!.getAttribute('aria-disabled'), 'true',
    'a frame-less document has no slide to narrate');
  noFrames.bar.destroy();
});

test('a checkbox row reports a NORMALISED write too, not the value it sent', () => {
  // The port stores something truthy that is not `true` - the row's read is
  // `=== true`, so the honest answer is "off", and the row must say so.
  const stored = new Map<string, unknown>();
  const f = fixture({
    model: { getInput: id => stored.get(id), setInput: (id) => { stored.set(id, 'yes'); } },
  });
  click(f.at('present-menu'));
  const rows = f.rows();
  click(rows[2]!);
  assert.equal(stored.get('autoAdvance'), 'yes');
  assert.equal(rows[2]!.getAttribute('aria-checked'), 'false', 'the tick re-reads rather than assuming');
  f.bar.destroy();
});

// ── frame gating ──────────────────────────────────────────────────────────────

test('a frame-less document disables Fit artboard and Present from this slide', () => {
  const f = fixture({ hasFrames: () => false });
  assert.equal((f.at('fit-artboard') as HTMLButtonElement).disabled, true);
  click(f.at('present-menu'));
  // A MENU row is greyed with aria-disabled rather than the property, so it stays in the
  // arrow-key ring and a screen reader still meets it (see the Narrate test).
  assert.equal(f.rows()[0]!.getAttribute('aria-disabled'), 'true', 'there is no "this slide" to present from');
  assert.equal(f.rows()[1]!.getAttribute('aria-disabled'), null, 'speaker view is not frame-gated');
  click(f.rows()[0]!);
  assert.deepEqual(f.calls.present, [], 'a disabled row is inert');
  f.bar.destroy();
});

test('Fit artboard comes back when frames arrive and sync() is called', () => {
  let framed = false;
  const f = fixture({ hasFrames: () => framed });
  assert.equal((f.at('fit-artboard') as HTMLButtonElement).disabled, true);
  framed = true;
  f.bar.sync();
  assert.equal((f.at('fit-artboard') as HTMLButtonElement).disabled, false);
  f.bar.destroy();
});

// ── the name field ────────────────────────────────────────────────────────────

test('the name field writes through on input and sync() re-reads it', () => {
  const f = fixture();
  const input = f.at('name') as HTMLInputElement;
  assert.equal(input.value, 'Quarterly deck');
  assert.equal(input.placeholder, 'design-2026-09-02', 'the auto-filename shows through an empty field');
  input.value = 'Kickoff';
  input.dispatchEvent(new W.Event('input', { bubbles: true }));
  assert.deepEqual(f.calls.names, ['Kickoff']);
  // A write from elsewhere (the export sheet renaming the file) reflects back...
  f.setName('Renamed in export');
  f.bar.sync();
  assert.equal(input.value, 'Renamed in export');
  // ...without echoing back out as a user edit.
  assert.deepEqual(f.calls.names, ['Kickoff'], 'sync() must not look like typing');
  f.bar.destroy();
});

test('the field survives the export sheet echoing back on every keystroke', () => {
  // The host re-syncs the bar on every `input` from the export sheet's Filename field,
  // because the sheet's OPEN event alone left a rename made in there stale for the rest
  // of the session - and the bar then wrote its own stale value back over the sheet's.
  // An unchanged value must therefore cost nothing at all: not a write, and not the
  // selection collapse that assigning `.value` can carry.
  const f = fixture();
  const input = f.at('name') as HTMLInputElement;
  input.value = 'Kickoff';
  input.dispatchEvent(new W.Event('input', { bubbles: true }));
  f.setName('Kickoff');                 // the sheet now holds what the bar typed
  input.setSelectionRange(3, 3);
  f.bar.sync();
  assert.equal(input.value, 'Kickoff');
  assert.equal(input.selectionStart, 3, 'an unchanged name is left completely alone');
  assert.deepEqual(f.calls.names, ['Kickoff'], 'and the echo is never mistaken for typing');
  f.bar.destroy();
});

test('a document with no auto-filename still shows a placeholder word', () => {
  const f = fixture({ name: { get: () => '', set: () => {}, placeholder: () => '' } });
  assert.equal((f.at('name') as HTMLInputElement).placeholder, 'Untitled');
  f.bar.destroy();
});

// ── menu keyboard ─────────────────────────────────────────────────────────────

test('menus: arrows roam, Escape closes and hands focus back to the trigger', () => {
  const f = fixture();
  const trigger = f.at('zoom-level');
  click(trigger);
  const rows = f.rows();
  assert.equal(dom.window.document.activeElement, rows[0], 'opening focuses the first row');
  assert.ok(rows.every(r => r.tabIndex === -1), 'menu rows are a roving-focus list, not tab stops');
  key(rows[0]!, 'ArrowDown');
  assert.equal(dom.window.document.activeElement, rows[1]);
  key(rows[1]!, 'ArrowUp');
  key(rows[0]!, 'ArrowUp');
  assert.equal(dom.window.document.activeElement, rows[rows.length - 1], 'it wraps');
  key(rows[rows.length - 1]!, 'Home');
  assert.equal(dom.window.document.activeElement, rows[0]);
  key(rows[0]!, 'End');
  assert.equal(dom.window.document.activeElement, rows[rows.length - 1]);
  key(rows[rows.length - 1]!, 'Escape');
  assert.equal(f.menu(), null, 'Escape closes');
  assert.equal(dom.window.document.activeElement, trigger, 'and focus returns to the trigger');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  f.bar.destroy();
});

test('menus: Tab closes and hands focus back to the trigger, leaving the default alone', () => {
  const f = fixture();
  const trigger = f.at('zoom-level');
  click(trigger);
  const rows = f.rows();
  assert.equal(dom.window.document.activeElement, rows[0]);
  const ev = new W.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  rows[0]!.dispatchEvent(ev);
  assert.equal(f.menu(), null, 'Tab closes the menu');
  assert.equal(dom.window.document.activeElement, trigger,
    'with focus on the trigger - sequential navigation then continues from there, not from <body>');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(ev.defaultPrevented, false,
    'and the browser still gets to move on to the next control - preventing it would trap the user on the trigger');
  f.bar.destroy();
});

test('menus: only one is open at a time, and a second click on the trigger closes it', () => {
  const f = fixture();
  click(f.at('zoom-level'));
  assert.equal(f.rows().length, 6);
  click(f.at('present-menu'));
  assert.equal(f.rows().length, 5, 'opening the second closed the first');
  assert.equal(f.at('zoom-level').getAttribute('aria-expanded'), 'false');
  click(f.at('present-menu'));
  assert.equal(f.menu(), null, 'the trigger is a toggle');
  f.bar.destroy();
});

test('one tooltip system: every bar control carries the app bubble below it, never a native title', () => {
  const f = fixture();
  const btns = [...f.bar.el.querySelectorAll<HTMLButtonElement>('button.dtb-btn')];
  assert.ok(btns.length > 5);
  for (const b of btns) {
    assert.equal(b.title, '', `${b.getAttribute('data-topbar')} has no native title`);
    assert.ok(b.getAttribute('data-tip'), `${b.getAttribute('data-topbar')} carries data-tip`);
    assert.equal(b.hasAttribute('data-tip-below'), true, 'the bar hugs the top, so the bubble drops below');
  }
  // The panel toggles say their key.
  assert.match(f.at('timeline').getAttribute('data-tip')!, /Timeline \((⌥|Alt\+)1\)/);
  assert.match(f.at('inspector').getAttribute('data-tip')!, /Inspector \((⌥|Alt\+)3\)/);
  f.bar.destroy();
});

test('the document name shows whole on hover once the field has cut it short', () => {
  const f = fixture();
  const name = f.bar.el.querySelector<HTMLInputElement>('input.dtb-name')!;
  // jsdom lays nothing out: scrollWidth and clientWidth are both 0, so the field is
  // never "clipped" here and the hint is the rename prompt.
  assert.equal(name.title, 'Rename this design');
  Object.defineProperty(name, 'scrollWidth', { value: 400, configurable: true });
  Object.defineProperty(name, 'clientWidth', { value: 120, configurable: true });
  f.bar.sync();
  assert.equal(name.title, 'Quarterly deck', 'the full name, once it overflows');
  f.bar.destroy();
});

test('Alt+1 / Alt+2 / Alt+3 toggle the panels from anywhere but a field, and die with the bar', () => {
  const f = fixture();
  const alt = (code: string, target: EventTarget = dom.window.document.body) =>
    target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code, altKey: true, bubbles: true, cancelable: true }));
  assert.equal(f.at('timeline').getAttribute('aria-pressed'), 'false');
  alt('Digit1');
  assert.equal(f.at('timeline').getAttribute('aria-pressed'), 'true', 'Alt+1 opens the timeline');
  alt('Digit2');
  assert.equal(f.at('navigator').getAttribute('aria-pressed'), 'true', 'Alt+2 opens the navigator');
  alt('Digit3');
  assert.equal(f.at('inspector').getAttribute('aria-pressed'), 'true', 'Alt+3 opens the inspector');
  // Typing in a field keeps its own keys.
  const field = dom.window.document.createElement('input');
  dom.window.document.body.appendChild(field);
  field.focus();
  alt('Digit1', field);
  assert.equal(f.at('timeline').getAttribute('aria-pressed'), 'true', 'no toggle while typing');
  field.remove();
  // Shift, Cmd or Ctrl alongside Alt is somebody else's chord.
  dom.window.document.body.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'Digit1', altKey: true, shiftKey: true, bubbles: true }));
  assert.equal(f.at('timeline').getAttribute('aria-pressed'), 'true', 'Alt+Shift+1 is not ours');
  f.bar.destroy();
  alt('Digit1');
  assert.equal(f.at('timeline').getAttribute('aria-pressed'), 'true', 'a destroyed bar listens to nothing');
});

test('destroy tears the bar and any open menu out of the document', () => {
  const f = fixture();
  click(f.at('zoom-level'));
  f.bar.destroy();
  assert.equal(f.bar.el.parentElement, null);
  assert.equal(dom.window.document.querySelectorAll('.dtb-menu').length, 0);
});

// ── glyph sourcing ────────────────────────────────────────────────────────────
// The bar drew its five own glyphs from a local `<svg>` template until 2026-09-02.
// That is exactly the fork component-audit rec 5 deleted seven times over, and the
// R3 guard in primitive-guards.test.ts caught it: the pictures now live in
// lib/icons.ts's PATHS and the rail can share them. These two tests are what keeps
// that true after the guard is satisfied - a guard counts `<svg viewBox>` literals,
// so re-inlining a glyph by pulling the string in from anywhere else would pass it.

/** `icon()` as the DOM re-serialises it - jsdom expands `<path/>` to `<path></path>`,
 *  so the registry string has to make the same round trip before it can be compared. */
function asMounted(html: string): string {
  const box = dom.window.document.createElement('div');
  box.innerHTML = html;
  return box.innerHTML;
}

test('every picture in the bar is a registry lookup, so the bar and the rail draw one glyph', () => {
  const f = fixture();
  const wired: Array<[string, IconName]> = [
    ['undo', 'undo'], ['redo', 'redo'],
    ['fit-all', 'fitAll'], ['fit-artboard', 'fitArtboard'], ['timeline', 'timeline'],
  ];
  for (const [id, name] of wired) {
    assert.notEqual(icon(name), '', `lib/icons.ts no longer registers '${name}'`);
    const box = f.at(id).querySelector('.dtb-ic');
    assert.ok(box, `[data-topbar="${id}"] lost its .dtb-ic glyph box`);
    assert.equal(box.innerHTML, asMounted(icon(name)),
      `[data-topbar="${id}"] draws its own glyph instead of icon('${name}') - re-forking the registry`);
  }
  f.bar.destroy();
});

test('a menu row takes the same glyph box, and its label stays text rather than markup', () => {
  const f = fixture();
  click(f.at('zoom-level'));
  const fitAll = f.rows()[4]!;                    // the "Fit all" row, after the four stops
  assert.equal(fitAll.querySelector('.dtb-menu-ic')!.innerHTML, asMounted(icon('fitAll')),
    'a menu row must reach the registry through the same box the buttons use');
  const label = fitAll.querySelector('.dtb-menu-label')!;
  assert.equal(label.innerHTML, label.textContent,
    'a row label is written with textContent - a label is copy, and copy never becomes markup');
  f.bar.destroy();
});

test('the profile avatar docks into the bar when one is handed over', () => {
  const avatar = dom.window.document.createElement('a');
  avatar.className = 'profile-link';
  const f = fixture({ profileEl: avatar });
  assert.ok(f.bar.el.contains(avatar));
  assert.equal(avatar.parentElement!.className, 'dtb-profile');
  // The avatar is the shared `.profile-link`, which pins ITSELF to a view's top-right
  // corner (position: absolute + right/top, parts/components.css). The bar is a
  // positioned element, so inside it that pin resolved against the BAR and parked the
  // avatar over the Export button. The reset lives in design-topbar.css and cannot be
  // asserted here (jsdom has no cascade) - what this pins is that the avatar sits in a
  // FLOW slot of the right group, after Export, which is the half the module owns.
  assert.equal(avatar.parentElement!.previousElementSibling?.getAttribute('data-topbar'), 'export',
    'the avatar follows Export in the flow rather than floating over it');
  f.bar.destroy();
});

test('the bar opts out of the canvas keyboard by attribute, for the handler it cannot edit', () => {
  // free-canvas binds the editor's bare-key verbs on `window` and this bar cannot edit
  // that handler, so it states the exemption where the handler can read it. The bar's own
  // stopPropagation (tested above) is the second layer under it.
  const f = fixture();
  assert.equal(f.bar.el.getAttribute('data-canvas-keys'), 'off');
  f.bar.destroy();
});

test('the bar takes the keyboard back when the inspector closes from its own header', () => {
  // The panel's close button removes the column from the page, and a removed subtree drops
  // focus to <body> - so the next Tab restarted at the top of the document. This toggle is
  // the only control that re-opens the panel, so the host hands the keyboard to it.
  const f = fixture();
  dom.window.document.body.focus();
  f.bar.focusInspectorToggle();
  assert.equal(dom.window.document.activeElement, f.at('inspector'), 'focus is on the way back in');
  f.bar.destroy();
});

test('...and at compact density it is the hamburger, which carries the Inspector row', () => {
  const f = fixture();
  const bar = f.bar.el;
  const right = bar.querySelector<HTMLElement>('.dtb-right')!;
  const rect = (r: number): DOMRect => ({ left: 0, right: r, width: r, top: 0, bottom: 44, height: 44, x: 0, y: 0, toJSON() {} } as DOMRect);
  // Same faked rects as the density ladder's own case: the right group's far edge shrinks
  // one step at a time as the clusters fold, so the ladder can actually descend.
  const widths: Record<string, number> = { full: 1200, icons: 900, compact: 600, min: 420 };
  bar.getBoundingClientRect = () => rect(700);
  right.getBoundingClientRect = () => rect(widths[bar.getAttribute('data-density') || 'full']!);
  lastRo!();
  assert.equal(bar.getAttribute('data-density'), 'compact', 'precondition: the centre cluster is folded away');
  f.bar.focusInspectorToggle();
  assert.equal(dom.window.document.activeElement, f.at('more'), 'a hidden button cannot take focus');
  f.bar.destroy();
});

test('density folds by the bar\x27s own width: labels, then icons, then the hamburger, then Share too', () => {
  const f = fixture();
  const bar = f.bar.el;
  const right = bar.querySelector<HTMLElement>('.dtb-right')!;
  const more = bar.querySelector<HTMLElement>('[data-topbar="more"]')!;
  const centre = bar.querySelector<HTMLElement>('.dtb-centre')!;
  const share = bar.querySelector<HTMLElement>('[data-topbar="share"]')!;
  // jsdom lays nothing out, so the two rects the ladder reads are faked: the bar's own
  // width, and the right group's far edge, which shrinks as the labels hide and the
  // clusters fold (one width per density step).
  let barW = 1400;
  const widths: Record<string, number> = { full: 1200, icons: 900, compact: 600, min: 420 };
  const rect = (r: number): DOMRect => ({ left: 0, right: r, width: r, top: 0, bottom: 44, height: 44, x: 0, y: 0, toJSON() {} } as DOMRect);
  bar.getBoundingClientRect = () => rect(barW);
  right.getBoundingClientRect = () => rect(widths[bar.getAttribute('data-density') || 'full']!);
  const ro = lastRo;
  assert.ok(ro, 'the bar observes its own size');
  ro!();
  assert.equal(bar.getAttribute('data-density'), 'full');
  assert.equal(more.hidden, true, 'no hamburger at full width');
  barW = 1000; ro!();
  assert.equal(bar.getAttribute('data-density'), 'icons');
  assert.equal(centre.hidden, false, 'icons keep the centre cluster');
  barW = 700; ro!();
  assert.equal(bar.getAttribute('data-density'), 'compact');
  assert.equal(centre.hidden, true, 'the centre cluster folds into the hamburger');
  assert.equal(more.hidden, false);
  assert.equal(share.hidden, false);
  barW = 500; ro!();
  assert.equal(bar.getAttribute('data-density'), 'min');
  assert.equal(share.hidden, true, 'Share folds too');
  // Room returns: the ladder climbs back up.
  barW = 1400; ro!();
  assert.equal(bar.getAttribute('data-density'), 'full');
  assert.equal(more.hidden, true);
  f.bar.destroy();
});

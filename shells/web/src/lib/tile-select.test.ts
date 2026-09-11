// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for the SHARED tile-grid multi-select gestures (lib/tile-select.ts).
 *
 * These matter more than a normal unit test: Projects and the Catalogue are required to
 * behave IDENTICALLY here, and the only thing making that true is that they both drive
 * this one module. So this suite is the uniformity guarantee - it pins the gestures once,
 * on a synthetic grid, and both views inherit whatever it asserts.
 *
 * jsdom gives us a real DOM (closest(), event capture/bubble, dispatch) but stubs
 * getBoundingClientRect to all-zeros, so each tile is handed an explicit rect - the
 * marquee hit test is pure geometry against those rects, which is exactly what we want
 * to exercise.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { wireTileSelect } from './tile-select.ts';
import type { TileSelect, TileKeyboardAdapter } from './tile-select.ts';

// Four tiles in a row, 100×100, with 10px gaps - the "gaps between cards" the user drags in.
const RECTS: Record<string, { left: number; top: number; right: number; bottom: number }> = {
  a: { left: 0,   top: 0, right: 100, bottom: 100 },
  b: { left: 110, top: 0, right: 210, bottom: 100 },
  c: { left: 220, top: 0, right: 320, bottom: 100 },
  d: { left: 330, top: 0, right: 430, bottom: 100 },
};

interface Harness {
  sel: Set<string>;
  gestures: TileSelect;
  host: HTMLElement;
  gap: HTMLElement;
  dot(ref: string): HTMLElement;
  /** A tile's `.tile-primary` open control (only present when `harness()` was given a `keyboard` adapter). */
  primary(ref: string): HTMLElement;
  /** A tile's `.tile-menu-btn` (only present with a `keyboard` adapter). */
  menuBtn(ref: string): HTMLElement;
  /** The `.tile` element itself. */
  tileEl(ref: string): HTMLElement;
  /** Click a tile's selection dot, exactly as the views' click handlers do. */
  clickDot(ref: string, shiftKey?: boolean): void;
  drag(from: [number, number], to: [number, number], opts?: { shiftKey?: boolean; on?: HTMLElement }): void;
  cleared: number;
}

function harness(opts?: { keyboard?: TileKeyboardAdapter }): Harness {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const w = dom.window;
  // The module reads these off the globals (it's written for a browser, not injected).
  (globalThis as Record<string, unknown>).window = w;
  (globalThis as Record<string, unknown>).document = w.document;
  (globalThis as Record<string, unknown>).HTMLElement = w.HTMLElement;
  // Fine pointer - the marquee is desktop-only, so without this it never wires at all.
  (w as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: true });

  const doc = w.document;
  const host = doc.createElement('div');            // stands in for viewEl (the persistent mount)
  const gap = doc.createElement('div');             // the grid container - the "gap between cards"
  gap.className = 'grid';
  host.appendChild(gap);
  doc.body.appendChild(host);

  for (const ref of Object.keys(RECTS)) {
    const tile = doc.createElement('div');
    tile.className = 'tile';
    tile.dataset.ref = ref;
    if (opts?.keyboard) {
      // The keyboard grid model's focus target - a <button> on every tile except one,
      // which wears an <a href> cover the way Projects tiles do (WP-13): focusOf()/roving
      // must treat the two identically.
      const primary = ref === 'd' ? doc.createElement('a') : doc.createElement('button');
      primary.className = 'tile-primary';
      if (ref === 'd') primary.setAttribute('href', '#x'); else primary.setAttribute('type', 'button');
      tile.appendChild(primary);
      const menuBtn = doc.createElement('button');
      menuBtn.className = 'tile-menu-btn';
      menuBtn.setAttribute('type', 'button');
      tile.appendChild(menuBtn);
    }
    const dot = doc.createElement('button');
    dot.dataset.select = ref;                       // the shared `[data-select]` dot convention
    tile.appendChild(dot);
    gap.appendChild(tile);
    (tile as unknown as { getBoundingClientRect: () => unknown }).getBoundingClientRect = () => RECTS[ref]!;
  }

  const sel = new Set<string>();
  const h = {
    sel,
    host: host as unknown as HTMLElement,
    gap: gap as unknown as HTMLElement,
    cleared: 0,
  } as Harness;

  h.gestures = wireTileSelect({
    host: host as unknown as HTMLElement,
    tiles: () => [...host.querySelectorAll('.tile')] as unknown as HTMLElement[],
    refOf: (t) => t.dataset.ref!,
    current: () => new Set(sel),
    setRefs: (refs) => { sel.clear(); for (const r of refs) sel.add(r); },
    clear: () => { sel.clear(); h.cleared++; },
    noStart: '.tile, button',
    keyboard: opts?.keyboard,
  });

  h.dot = (ref) => host.querySelector(`[data-select="${ref}"]`) as unknown as HTMLElement;
  h.primary = (ref) => host.querySelector(`.tile[data-ref="${ref}"] .tile-primary`) as unknown as HTMLElement;
  h.menuBtn = (ref) => host.querySelector(`.tile[data-ref="${ref}"] .tile-menu-btn`) as unknown as HTMLElement;
  h.tileEl = (ref) => host.querySelector(`.tile[data-ref="${ref}"]`) as unknown as HTMLElement;

  // Mirrors what both views' delegated click handlers do with a dot click.
  h.clickDot = (ref, shiftKey = false) =>
    h.gestures.onDotClick(ref, shiftKey, () => { if (sel.has(ref)) sel.delete(ref); else sel.add(ref); });

  h.drag = ([x0, y0], [x1, y1], opts = {}) => {
    const on = opts.on ?? (gap as unknown as HTMLElement);
    const mouse = (type: string, x: number, y: number, target: EventTarget): void => {
      target.dispatchEvent(new w.MouseEvent(type, {
        bubbles: true, cancelable: true, button: 0,
        clientX: x, clientY: y, shiftKey: !!opts.shiftKey,
      }));
    };
    mouse('mousedown', x0, y0, on as unknown as EventTarget);
    mouse('mousemove', x1, y1, doc as unknown as EventTarget);
    mouse('mouseup', x1, y1, doc as unknown as EventTarget);
  };

  return h;
}

const got = (h: Harness): string[] => [...h.sel].sort();

// ── marquee ───────────────────────────────────────────────────────────────────

test('marquee selects every tile the box touches', () => {
  const h = harness();
  h.drag([105, 10], [325, 50]);            // spans the b…c pair, stopping short of d
  assert.deepEqual(got(h), ['b', 'c']);
});

test('a plain marquee REPLACES the selection', () => {
  const h = harness();
  h.clickDot('d');
  assert.deepEqual(got(h), ['d']);
  h.drag([105, 10], [325, 50]);
  assert.deepEqual(got(h), ['b', 'c']);    // d is gone - a plain drag is not additive
});

test('Shift/Cmd/Ctrl makes the marquee ADD to the selection', () => {
  const h = harness();
  h.clickDot('d');
  h.drag([105, 10], [325, 50], { shiftKey: true });
  assert.deepEqual(got(h), ['b', 'c', 'd']);
});

test('a press that never travels far enough is a click, not a drag', () => {
  const h = harness();
  h.clickDot('a');
  h.drag([105, 10], [107, 12]);            // 2px - under DRAG_SLOP
  // No box was drawn, so this is a plain click on empty canvas: it clears, and does NOT
  // fall through to a hit test that would have selected nothing anyway.
  assert.equal(h.cleared, 1);
  assert.deepEqual(got(h), []);
});

test('a plain click on empty canvas clears the selection', () => {
  const h = harness();
  h.clickDot('b');
  h.drag([105, 10], [105, 10]);
  assert.equal(h.cleared, 1);
  assert.deepEqual(got(h), []);
});

test('a marquee never STARTS on a card or a control', () => {
  const h = harness();
  h.clickDot('d');
  // Press begins on tile "a" itself, not in a gap - the gesture must not engage at all,
  // so the existing selection survives untouched and nothing is cleared.
  h.drag([10, 10], [325, 50], { on: h.dot('a') });
  assert.deepEqual(got(h), ['d']);
  assert.equal(h.cleared, 0);
});

// ── Shift-range ───────────────────────────────────────────────────────────────

test('Shift-clicking a later dot selects everything in between, inclusive', () => {
  const h = harness();
  h.clickDot('a');                          // anchor
  h.clickDot('c', true);
  assert.deepEqual(got(h), ['a', 'b', 'c']);
});

test('Shift-range works backwards too', () => {
  const h = harness();
  h.clickDot('d');
  h.clickDot('b', true);
  assert.deepEqual(got(h), ['b', 'c', 'd']);
});

test('Shift-range ADDS - it never takes an existing selection away', () => {
  const h = harness();
  h.clickDot('d');                          // selected, and the anchor
  h.clickDot('a');                          // anchor moves to a; d stays selected
  h.clickDot('b', true);                    // range a→b
  assert.deepEqual(got(h), ['a', 'b', 'd']);
});

test('Shift-clicking with no anchor is just a plain toggle', () => {
  const h = harness();
  h.clickDot('c', true);
  assert.deepEqual(got(h), ['c']);
});

test('the anchor stays put, so a second Shift-click re-reaches from the same origin', () => {
  const h = harness();
  h.clickDot('a');
  h.clickDot('d', true);
  assert.deepEqual(got(h), ['a', 'b', 'c', 'd']);
  h.clickDot('b', true);                    // still anchored at a - not at d
  assert.deepEqual(got(h), ['a', 'b', 'c', 'd']);
});

// ── the two gestures compose ──────────────────────────────────────────────────

test('a marquee anchors the next Shift-click on the last tile it caught', () => {
  const h = harness();
  h.drag([105, 10], [215, 50]);             // catches b only
  assert.deepEqual(got(h), ['b']);
  h.clickDot('d', true);                    // extends on from b, the box's last tile
  assert.deepEqual(got(h), ['b', 'c', 'd']);
});

test('clearing the selection drops the anchor, so the next Shift-click cannot sweep a stale range', () => {
  const h = harness();
  h.clickDot('a');
  h.gestures.resetAnchor();                 // what both views call when they empty the selection
  h.sel.clear();
  h.clickDot('d', true);
  assert.deepEqual(got(h), ['d']);          // a plain toggle - NOT the a…d range
});

test('a marquee that catches nothing leaves no anchor behind', () => {
  const h = harness();
  h.clickDot('a');
  h.drag([440, 10], [500, 50]);             // empty space past the last tile
  assert.deepEqual(got(h), []);
  h.clickDot('c', true);                    // no anchor survived → plain toggle
  assert.deepEqual(got(h), ['c']);
});

// ── hidden tiles (a collapsed group) ──────────────────────────────────────────
// The Catalogue keeps a folded-up group's cards in the DOM under `display: none`, so they
// measure {0,0,0,0}. A zero rect at the origin passes a naive overlap test for ANY box
// dragged out to the top-left corner - which would arm a bulk Delete over cards that are
// nowhere on screen. Neither gesture may reach them.

/** Collapse a tile the way `display: none` does: a zero-area rect. */
function hide(h: Harness, ref: string): void {
  const tile = h.dot(ref).parentElement as unknown as { getBoundingClientRect: () => unknown };
  tile.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0 });
}

test('a box dragged to the viewport origin cannot sweep up hidden tiles', () => {
  const h = harness();
  hide(h, 'a');
  hide(h, 'b');
  h.drag([300, 60], [0, 0]);                // out to the top-left corner - over the zero rects
  assert.deepEqual(got(h), ['c']);          // only the genuinely on-screen tile it crossed
});

test('a Shift-range steps over hidden tiles instead of selecting them', () => {
  const h = harness();
  hide(h, 'b');                             // b is inside a collapsed group
  h.clickDot('a');
  h.clickDot('c', true);
  assert.deepEqual(got(h), ['a', 'c']);     // b is not on screen, so it is not "in between"
});

// ── teardown ──────────────────────────────────────────────────────────────────
// The router hands every route the SAME persistent #view element (it only empties it),
// so a gesture left bound to it outlives its view. These two pin the teardown that stops
// a navigation stacking a second marquee - and a dead view's store being written to.

test('Escape backs a live drag out and puts the selection back', () => {
  const h = harness();
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;
  h.clickDot('d');                          // the selection the drag must be undone back to

  h.gap.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: 105, clientY: 10 }));
  doc.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: 325, clientY: 50 }));
  assert.deepEqual(got(h), ['b', 'c']);     // the box has taken over the selection…
  assert.equal(doc.querySelectorAll('.tile-marquee').length, 1);

  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

  assert.deepEqual(got(h), ['d']);          // …and Escape hands it straight back
  assert.equal(doc.querySelectorAll('.tile-marquee').length, 0);
  assert.equal(h.host.classList.contains('is-marqueeing'), false);

  // The cancelled drag is well and truly over: its mouseup must not commit anything.
  doc.dispatchEvent(new w.MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: 325, clientY: 50 }));
  assert.deepEqual(got(h), ['d']);
  assert.equal(h.cleared, 0);
});

test('destroy() unbinds the marquee, so a re-mounted view cannot stack a second one', () => {
  const h = harness();
  h.gestures.destroy();
  h.drag([105, 10], [325, 50]);             // the gesture is gone - the drag does nothing
  assert.deepEqual(got(h), []);
  assert.equal(h.cleared, 0);               // and it must not reach the dead view's clear()
});

test('destroy() mid-drag bins the box and releases the document listeners', () => {
  const h = harness();
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;
  const down = (x: number, y: number): void => {
    h.gap.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
  };
  const move = (x: number, y: number): void => {
    doc.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
  };
  down(105, 10);
  move(325, 50);                            // a box is now live in document.body
  assert.equal(doc.querySelectorAll('.tile-marquee').length, 1);
  assert.equal(h.host.classList.contains('is-marqueeing'), true);

  h.gestures.destroy();                     // user navigates away mid-drag

  // The box lives in document.body, NOT in the view - replaceChildren() could never reach it.
  assert.equal(doc.querySelectorAll('.tile-marquee').length, 0);
  assert.equal(h.host.classList.contains('is-marqueeing'), false);

  const after = got(h);
  move(500, 90);                            // a stray mousemove must no longer be handled
  assert.deepEqual(got(h), after);
});

// ── keyboard: roving tabindex (syncRoving, plans/133 WP-13) ────────────────────

test('syncRoving() puts the roving tabIndex on the first tile, neutralises the OTHER tiles\' dots and menu buttons, and follows focus to another tile', () => {
  const h = harness({ keyboard: {} });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  h.gestures.syncRoving();
  assert.equal(h.primary('a').tabIndex, 0);
  for (const ref of ['b', 'c', 'd']) assert.equal(h.primary(ref).tabIndex, -1, ref);
  // The FOCUSED tile keeps its dot + kebab reachable by Tab (Apple keyboards have
  // no Menu key, so the kebab must stay a keyboard route to the tile menu); every
  // other tile's are skipped.
  assert.equal(h.dot('a').tabIndex, 0);
  assert.equal(h.menuBtn('a').tabIndex, 0);
  for (const ref of ['b', 'c', 'd']) {
    assert.equal(h.dot(ref).tabIndex, -1, ref);
    assert.equal(h.menuBtn(ref).tabIndex, -1, ref);
  }

  h.primary('c').dispatchEvent(new w.FocusEvent('focusin', { bubbles: true }));
  assert.equal(h.primary('c').tabIndex, 0);
  assert.equal(h.menuBtn('c').tabIndex, 0);
  assert.equal(h.menuBtn('a').tabIndex, -1);
  for (const ref of ['a', 'b', 'd']) assert.equal(h.primary(ref).tabIndex, -1, ref);
});

test('syncRoving() re-called after a focus move keeps the last-focused tile as the Tab stop', () => {
  const h = harness({ keyboard: {} });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  h.gestures.syncRoving();
  h.primary('c').dispatchEvent(new w.FocusEvent('focusin', { bubbles: true }));
  h.gestures.syncRoving();                  // simulates the resync a render() calls after rebuilding tiles

  assert.equal(h.primary('c').tabIndex, 0);
  for (const ref of ['a', 'b', 'd']) assert.equal(h.primary(ref).tabIndex, -1, ref);
});

test('syncRoving() without a keyboard adapter is a no-op', () => {
  const h = harness();                      // no `keyboard` - gestures only
  h.gestures.syncRoving();
  assert.equal(h.dot('a').hasAttribute('tabindex'), false);
});

test('arrow-key navigation and roving treat an anchor tile-primary the same as a button one', () => {
  const h = harness({ keyboard: {} });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  h.gestures.syncRoving();
  h.primary('c').focus();                   // a <button class="tile-primary">
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));

  // d's primary is an <a class="tile-primary" href="#x"> - ArrowRight moves focus to it exactly
  // as it would a button, and the roving tabIndex follows the real focus() the same way.
  assert.equal(doc.activeElement, h.primary('d'));
  assert.equal(h.primary('d').tabIndex, 0);
  assert.equal(h.primary('c').tabIndex, -1);
});

// ── keyboard: menu key / Shift+F10 ──────────────────────────────────────────────

test('the Menu key opens the focused tile context menu via keyboard.menu()', () => {
  const calls: Array<[string, HTMLElement]> = [];
  const h = harness({ keyboard: { menu: (ref, tile) => calls.push([ref, tile]) } });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  h.primary('b').focus();
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0]![0], 'b');
  assert.equal(calls[0]![1], h.tileEl('b'));
});

test('Shift+F10 on a focused tile also opens its context menu via keyboard.menu()', () => {
  const calls: string[] = [];
  const h = harness({ keyboard: { menu: (ref) => calls.push(ref) } });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  h.primary('c').focus();
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));

  assert.deepEqual(calls, ['c']);
});

// ── keyboard: Cmd/Ctrl+I (get info) ─────────────────────────────────────────────

test('Cmd/Ctrl+I calls keyboard.info() for the focused tile when nothing is selected', () => {
  const calls: string[] = [];
  const h = harness({ keyboard: { info: (ref) => calls.push(ref) } });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  h.primary('a').focus();
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'i', metaKey: true, bubbles: true, cancelable: true }));

  assert.deepEqual(calls, ['a']);
});

test('Cmd/Ctrl+I calls keyboard.info() for a single selected tile', () => {
  const calls: string[] = [];
  const h = harness({ keyboard: { info: (ref) => calls.push(ref) } });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  h.sel.add('b');
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'i', ctrlKey: true, bubbles: true, cancelable: true }));

  assert.deepEqual(calls, ['b']);
});

test('Cmd/Ctrl+I is not called with more than one tile selected', () => {
  const calls: string[] = [];
  const h = harness({ keyboard: { info: (ref) => calls.push(ref) } });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  h.sel.add('b'); h.sel.add('c');
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'i', metaKey: true, bubbles: true, cancelable: true }));

  assert.deepEqual(calls, []);
});

// ── keyboard: clipboard (Cmd/Ctrl+X/C/V, plans/133 WP-7) ────────────────────────

test('Cmd/Ctrl+X cuts the selection when one exists', () => {
  const cut: string[][] = [];
  const h = harness({ keyboard: { cut: (refs) => cut.push(refs) } });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  h.sel.add('b'); h.sel.add('c');
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'x', metaKey: true, bubbles: true, cancelable: true }));

  assert.deepEqual(cut, [['b', 'c']]);
});

test('Cmd/Ctrl+C copies the focused tile when nothing is selected', () => {
  const copy: string[][] = [];
  const h = harness({ keyboard: { copy: (refs) => copy.push(refs) } });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  h.primary('d').focus();
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }));

  assert.deepEqual(copy, [['d']]);
});

test('Cmd/Ctrl+V pastes regardless of what has focus', () => {
  let pastes = 0;
  const h = harness({ keyboard: { paste: () => { pastes++; } } });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  // Nothing inside the grid is focused at all - paste must not require it.
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'v', metaKey: true, bubbles: true, cancelable: true }));

  assert.equal(pastes, 1);
});

test('Cmd/Ctrl+V yields to a focused text input - it must not fire', () => {
  let pastes = 0;
  const h = harness({ keyboard: { paste: () => { pastes++; } } });
  const doc = h.host.ownerDocument;
  const w = doc.defaultView!;

  const input = doc.createElement('input');
  doc.body.appendChild(input);
  input.focus();
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'v', metaKey: true, bubbles: true, cancelable: true }));

  assert.equal(pastes, 0);
});

// ── Shift+mousedown text-selection guard ────────────────────────────────────────

test('Shift+mousedown on a tile itself, not just its dot, is prevented so the browser cannot drag a text selection across cards', () => {
  const h = harness();
  const w = h.host.ownerDocument.defaultView!;

  const ev = new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, shiftKey: true });
  const notPrevented = h.tileEl('a').dispatchEvent(ev);

  assert.equal(notPrevented, false);
  assert.equal(ev.defaultPrevented, true);
});

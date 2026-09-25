// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: dragging slides in the filmstrip, and the keyboard move (plan 275 section 5.2).
 *
 * A drag starts anywhere on a thumbnail's picture; there is no grip. On a fine pointer
 * it starts once the pointer travels 6 px. On touch it follows the gesture table of
 * section 5.1: a finger that travels before 180 ms pans the strip; one held still for
 * 180 ms arms the drag (the thumbnail lifts a little) and a travel after that drags; one
 * held to 420 ms opens the menu instead (`lib/context-menu.ts` times that) and the armed
 * drag lets go; a second finger cancels.
 *
 * While it runs:
 *
 * - pointer capture is on the strip's scroller, so a render that replaces a thumbnail's
 *   node cannot lose it, and the strip renders keyed (`data-dragging` on the list);
 * - a copy of the picture follows the pointer, lifted, with the slide's number (and a
 *   count for several slides); the slides being moved fade to 35% and keep their slots;
 * - one marker says where the slide will go. A single slide's faded copy moves into the
 *   slot it will take while the thumbnails between make room by one pitch, and that copy
 *   is the marker; a block, or every drag under reduced motion, keeps its slots and an
 *   insertion bar in the ink colour stands in the gap between two thumbnails;
 * - the strip scrolls itself within 48 px of either edge, faster nearer the edge, and a
 *   drop past the mounted window is placed by pitch arithmetic, never by DOM index;
 * - Escape, or losing the capture, puts it back and changes nothing;
 * - the drop settles into its slot, rings the moved thumbnail and says where it went.
 *
 * The gap index counts included slides only: a slide left out sits after them all and
 * never moves. Every horizontal measure comes from `rb.strip.x`, which counts from the
 * strip's start edge in either direction.
 *
 * The keyboard move starts from M on a focused thumbnail: Left and Right move the slide
 * by one place, Home and End to the ends, Enter or Space drops it, Escape cancels, and
 * each step is said. The bar over the strip says the same while it runs, with Done and
 * Cancel for a pointer. Nothing is written until the drop, which is one undo step. Focus
 * or a press leaving the filmstrip cancels it, so a key meant for another control does
 * that control's work.
 *
 * In Keep the design the strip only selects, so neither a drag nor the keyboard move
 * starts there.
 */
import { t, tRaw } from '../../i18n.ts';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { bindOp, type RbCtx } from './context.ts';
import { selectedSlideIds } from './shared.ts';

/** Travel that turns a press on a fine pointer into a drag, in CSS px. */
export const DRAG_SLOP_PX = 6;
/** How long a finger stays still before the drag is armed (section 5.1). */
export const TOUCH_ARM_MS = 180;
/** Distance from either edge of the strip where it scrolls itself during a drag. */
export const EDGE_PX = 48;
/** Auto-scroll speed per frame at the edge band's inner and outer ends. */
const SCROLL_MIN = 8;
const SCROLL_MAX = 24;
/** How long the ring after a drop and the settle take, in ms. */
const SETTLE_MS = 180;
const RING_MS = 300;
/** Frame costs kept for the budget check, newest last. */
const COSTS_KEPT = 240;

type Phase = 'idle' | 'pressed' | 'armed' | 'dragging';

interface KeyMove {
  ids: string[];
  /** Where the block's first slide sits now, among the slides that stay, as the keys move it. */
  to: number;
  from: number;
}

interface DragState {
  phase: Phase;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  slideId: string;
  /** The slides being moved, in deck order. */
  ids: string[];
  /** Pointer offset inside the picture when the drag started, so the copy stays under the finger. */
  grabX: number;
  grabY: number;
  /** The gap the pointer is nearest, among included slides; -1 before the first frame. */
  gap: number;
  /** How many rows the list held when the gap was last drawn. */
  mounted: number;
  armTimer: ReturnType<typeof setTimeout> | 0;
  frame: number;
  lift: HTMLElement | null;
  bar: HTMLElement | null;
  /** Set for the click that follows a drop, so it does not also select. */
  dropped: boolean;
  key: KeyMove | null;
  costs: number[];
  /** Listeners that live only while a press or a drag does. */
  off: Array<() => void>;
}

const states = new WeakMap<RbCtx, DragState>();

function stateOf(rb: RbCtx): DragState {
  let state = states.get(rb);
  if (!state) {
    state = {
      phase: 'idle', pointerId: -1, pointerType: '', startX: 0, startY: 0, lastX: 0, lastY: 0, slideId: '', ids: [],
      grabX: 0, grabY: 0, gap: -1, mounted: 0, armTimer: 0, frame: 0, lift: null, bar: null, dropped: false, key: null, costs: [], off: [],
    };
    states.set(rb, state);
  }
  return state;
}

function listEl(rb: RbCtx): HTMLElement | null {
  return rb.els.strip.querySelector<HTMLElement>('[data-list]');
}

function scrollEl(rb: RbCtx): HTMLElement | null {
  return rb.els.strip.querySelector<HTMLElement>('[data-scroll]');
}

/** The included slides in deck order: the rows a move works over. */
function includedIds(rb: RbCtx): string[] {
  return (rb.derived?.slides ?? []).filter((slide) => slide.include).map((slide) => slide.id);
}

/**
 * Where a block goes when dropped at gap `gap` (0 to n among the included slides):
 * the index its first slide takes among the slides that stay. Pure; exported for the tests.
 */
export function landingIndex(included: readonly string[], moving: ReadonlySet<string>, gap: number): number {
  const at = Math.max(0, Math.min(included.length, gap));
  let before = 0;
  for (let i = 0; i < at; i += 1) if (!moving.has(included[i] ?? '')) before += 1;
  return before;
}

/** The gap nearest a logical x, among `count` included slides of pitch `pitch`. Pure; exported for the tests. */
export function gapAt(x: number, pitch: number, count: number): number {
  if (!(pitch > 0)) return 0;
  return Math.max(0, Math.min(count, Math.round(x / pitch)));
}

/** True when a move to `to` leaves the block where it was. */
function unchanged(included: readonly string[], moving: readonly string[], to: number): boolean {
  const set = new Set(moving);
  const rest = included.filter((id) => !set.has(id));
  const next = [...rest.slice(0, to), ...moving, ...rest.slice(to)];
  return next.every((id, i) => id === included[i]);
}

// ─── the pieces drawn during a drag ──────────────────────────────────────────

function tilesById(rb: RbCtx): Map<string, HTMLElement> {
  const out = new Map<string, HTMLElement>();
  for (const el of listEl(rb)?.querySelectorAll<HTMLElement>('.rb-thumb[data-slide]') ?? []) out.set(el.dataset.slide ?? '', el);
  return out;
}

/** The copy of the picture that follows the pointer. */
function makeLift(state: DragState, source: HTMLElement): HTMLElement {
  const art = source.querySelector<HTMLElement>('.rb-thumb-art');
  const rect = (art ?? source).getBoundingClientRect();
  const lift = document.createElement('div');
  lift.className = 'rb-drag-lift';
  lift.setAttribute('aria-hidden', 'true');
  lift.style.width = `${rect.width}px`;
  lift.style.height = `${rect.height}px`;
  // Copies of the tile's own nodes, so nothing read back from the page is parsed again.
  if (art) lift.append(...[...art.childNodes].map((node) => node.cloneNode(true)));
  const badge = (className: string, text: string): HTMLSpanElement => {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
  };
  lift.append(badge('rb-thumb-num', source.querySelector('.rb-thumb-num')?.textContent ?? ''));
  if (state.ids.length > 1) {
    lift.dataset.stack = 'true';
    lift.append(badge('rb-drag-count', String(state.ids.length)));
  }
  state.grabX = state.startX - rect.left;
  state.grabY = state.startY - rect.top;
  document.body.append(lift);
  placeLift(state);
  return lift;
}

function placeLift(state: DragState): void {
  if (!state.lift) return;
  state.lift.style.transform = `translate(${state.lastX - state.grabX}px, ${state.lastY - state.grabY}px) scale(1.04)`;
}

/**
 * Mark gap `gap`. A single slide's faded copy moves to the slot it will take and the
 * slides between slide one pitch the other way, and that copy is the one marker: no bar
 * is drawn through it. A block, or every drag under reduced motion, keeps its slots and
 * the bar sits in the gap between two thumbnails.
 */
function showGap(rb: RbCtx, state: DragState, gap: number): void {
  const list = listEl(rb);
  if (!list) return;
  const included = includedIds(rb);
  const pitch = rb.strip.pitch();
  const dir = rb.strip.rtl() ? -1 : 1;
  const tiles = tilesById(rb);
  const moving = new Set(state.ids);
  const to = landingIndex(included, moving, gap);
  const reduce = prefersReducedMotion();
  if (!state.bar) {
    state.bar = document.createElement('div');
    state.bar.className = 'rb-drop-bar';
    state.bar.setAttribute('aria-hidden', 'true');
    list.append(state.bar);
  }
  const barAt = gap * pitch - (pitch - (tiles.values().next().value?.offsetWidth ?? pitch)) / 2;
  const slides = state.ids.length === 1 && !reduce;
  state.bar.hidden = slides;
  if (slides) {
    const s = included.indexOf(state.ids[0] ?? '');
    for (const [id, el] of tiles) {
      const i = included.indexOf(id);
      let shift = 0;
      if (id === state.ids[0]) shift = to - s;
      else if (i >= 0 && to > s && i > s && i <= to) shift = -1;
      else if (i >= 0 && to < s && i >= to && i < s) shift = 1;
      el.style.transform = shift === 0 ? '' : `translateX(${shift * pitch * dir}px)`;
    }
  }
  state.bar.style.insetInlineStart = `${Math.round(barAt)}px`;
  list.dataset.landing = String(to);
}

function clearGap(rb: RbCtx, state: DragState): void {
  for (const el of tilesById(rb).values()) {
    el.style.transform = '';
    delete el.dataset.dragSource;
  }
  state.bar?.remove();
  state.bar = null;
  const list = listEl(rb);
  if (list) delete list.dataset.landing;
}

/** Scroll toward whichever edge the pointer is within `EDGE_PX` of, faster nearer the edge. */
function autoScroll(rb: RbCtx, state: DragState): void {
  const scroll = scrollEl(rb);
  if (!scroll) return;
  const rect = scroll.getBoundingClientRect();
  const nearLeft = state.lastX - rect.left;
  const nearRight = rect.right - state.lastX;
  let speed = 0;
  if (nearLeft < EDGE_PX) speed = -(SCROLL_MIN + ((EDGE_PX - Math.max(0, nearLeft)) / EDGE_PX) * (SCROLL_MAX - SCROLL_MIN));
  else if (nearRight < EDGE_PX) speed = SCROLL_MIN + ((EDGE_PX - Math.max(0, nearRight)) / EDGE_PX) * (SCROLL_MAX - SCROLL_MIN);
  if (speed === 0) return;
  // Toward the right is toward the end in a left to right strip, and toward the start in a right to left one.
  const towardEnd = rb.strip.rtl() ? -speed : speed;
  rb.strip.setScrollStart(rb.strip.scrollStart() + towardEnd);
}

/** One frame of a drag: the copy, the gap, the neighbours and the edge scroll. */
function frame(rb: RbCtx, state: DragState): void {
  state.frame = 0;
  if (state.phase !== 'dragging') return;
  const began = typeof performance === 'undefined' ? 0 : performance.now();
  placeLift(state);
  autoScroll(rb, state);
  const gap = gapAt(rb.strip.x(state.lastX), rb.strip.pitch(), includedIds(rb).length);
  // A scroll that mounted new thumbnails needs their places set too.
  const mounted = listEl(rb)?.childElementCount ?? 0;
  if (gap !== state.gap || mounted !== state.mounted) {
    state.gap = gap;
    state.mounted = mounted;
    showGap(rb, state, gap);
  }
  if (typeof performance !== 'undefined') {
    state.costs.push(performance.now() - began);
    if (state.costs.length > COSTS_KEPT) state.costs.shift();
  }
  // Keep scrolling while the pointer rests in an edge band.
  state.frame = Number(requestAnimationFrame(() => frame(rb, state)));
}

// ─── the gesture ─────────────────────────────────────────────────────────────

function release(state: DragState): void {
  if (state.armTimer) clearTimeout(state.armTimer);
  state.armTimer = 0;
  if (state.frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.frame);
  state.frame = 0;
  for (const off of state.off.splice(0)) off();
}

function reset(rb: RbCtx, state: DragState): void {
  release(state);
  for (const el of listEl(rb)?.querySelectorAll<HTMLElement>('.rb-thumb[data-armed]') ?? []) delete el.dataset.armed;
  state.phase = 'idle';
  state.pointerId = -1;
  state.gap = -1;
}

function begin(rb: RbCtx, state: DragState): void {
  const list = listEl(rb);
  const scroll = scrollEl(rb);
  const tiles = tilesById(rb);
  const source = tiles.get(state.slideId);
  if (!list || !scroll || !source) {
    reset(rb, state);
    return;
  }
  const selected = selectedSlideIds(rb.sel, rb.derived?.slides ?? []);
  const block = selected.length > 1 && selected.includes(state.slideId) ? selected : [state.slideId];
  const included = new Set(includedIds(rb));
  state.ids = block.filter((id) => included.has(id));
  if (!state.ids.includes(state.slideId)) {
    reset(rb, state);
    return;
  }
  delete source.dataset.armed;
  try {
    scroll.setPointerCapture(state.pointerId);
  } catch {
    // A pointer that is gone can not be captured; the drag still runs on the window's events.
  }
  state.phase = 'dragging';
  list.dataset.dragging = 'true';
  list.dataset.motion = prefersReducedMotion() ? 'reduce' : 'full';
  for (const id of state.ids) {
    const el = tiles.get(id);
    if (el) el.dataset.dragSource = 'true';
  }
  state.lift = makeLift(state, source);
  // Only the scroller's own capture counts: a touch starts captured to the thumbnail it
  // pressed, and moving that capture here sends the thumbnail's loss up to this listener.
  const lost = (e: PointerEvent): void => {
    if (e.target === scroll && e.pointerId === state.pointerId && state.phase === 'dragging') cancelDrag(rb);
  };
  scroll.addEventListener('lostpointercapture', lost);
  state.off.push(() => scroll.removeEventListener('lostpointercapture', lost));
  state.frame = Number(requestAnimationFrame(() => frame(rb, state)));
}

/** End a drag: the copy settles into `target` (or goes away), the bar goes, the list renders plainly again. */
function finish(rb: RbCtx, state: DragState, target: DOMRect | null): void {
  const lift = state.lift;
  state.lift = null;
  const list = listEl(rb);
  if (list) {
    delete list.dataset.dragging;
    delete list.dataset.motion;
  }
  const scroll = scrollEl(rb);
  try {
    if (scroll?.hasPointerCapture?.(state.pointerId)) scroll.releasePointerCapture(state.pointerId);
  } catch {
    // Already released.
  }
  reset(rb, state);
  if (!lift) return;
  if (!target || prefersReducedMotion() || typeof lift.animate !== 'function') {
    lift.remove();
    return;
  }
  const from = lift.getBoundingClientRect();
  const dx = target.left - from.left;
  const dy = target.top - from.top;
  const start = lift.style.transform;
  const end = `${start.replace(/scale\([^)]*\)/, '')} translate(${dx}px, ${dy}px) scale(1)`;
  const anim = lift.animate([{ transform: start }, { transform: end }], { duration: SETTLE_MS, easing: 'ease-out' });
  anim.onfinish = () => lift.remove();
  anim.oncancel = () => lift.remove();
}

/** Ring the thumbnail of a slide just moved, briefly. */
function ring(rb: RbCtx, slideId: string): void {
  const tile = rb.strip.tile(slideId);
  if (!tile) return;
  tile.dataset.landed = 'true';
  setTimeout(() => {
    delete tile.dataset.landed;
  }, RING_MS);
}

async function drop(rb: RbCtx, state: DragState): Promise<void> {
  const included = includedIds(rb);
  const ids = [...state.ids];
  const to = landingIndex(included, new Set(ids), state.gap < 0 ? included.indexOf(ids[0] ?? '') : state.gap);
  const first = ids[0] ?? '';
  const sourceTile = rb.strip.tile(first);
  const landing = sourceTile?.querySelector<HTMLElement>('.rb-thumb-art')?.getBoundingClientRect() ?? null;
  state.dropped = true;
  setTimeout(() => {
    state.dropped = false;
  }, 0);
  if (unchanged(included, ids, to)) {
    clearGap(rb, state);
    finish(rb, state, landing);
    return;
  }
  // The neighbours keep their shifted places until the moved plan draws them afresh.
  state.bar?.remove();
  state.bar = null;
  finish(rb, state, landing);
  const outcome = await rb.strip.moveBlock(ids, to);
  if (!outcome?.ok) {
    clearGap(rb, state);
    return;
  }
  ring(rb, first);
}

/**
 * Put a pointer drag back where it started, or leave the keyboard move, with nothing
 * written. `refocus` false leaves focus where the person put it, outside the strip.
 */
export function cancelDrag(rb: RbCtx, refocus = true): void {
  const state = stateOf(rb);
  if (state.key) {
    state.key = null;
    rb.memo.strip = '';
    rb.strip.render();
    rb.announce(t('Move cancelled.'));
    if (refocus && rb.sel.slideId) rb.strip.focus(rb.sel.slideId);
    return;
  }
  if (state.phase !== 'dragging') {
    reset(rb, state);
    return;
  }
  const back = rb.strip.tile(state.slideId)?.querySelector<HTMLElement>('.rb-thumb-art');
  clearGap(rb, state);
  const target = back ? back.getBoundingClientRect() : null;
  finish(rb, state, target);
  rb.announce(t('Move cancelled.'));
}

function onPointerDown(rb: RbCtx, e: PointerEvent): void {
  const state = stateOf(rb);
  // A second finger cancels an armed or running drag.
  if (state.phase !== 'idle' && e.pointerId !== state.pointerId) {
    if (state.phase === 'dragging') cancelDrag(rb);
    else reset(rb, state);
    return;
  }
  if (e.button !== 0 || !e.isPrimary || state.key || rb.strip.selectionOnly()) return;
  const target = e.target as Element;
  if (target.closest('[data-more], .rb-thumb-tick, .rb-thumb-out')) return;
  const pick = target.closest<HTMLElement>('.rb-thumb-pick');
  const slideId = pick?.dataset.slide;
  if (!pick || !slideId) return;
  if (rb.derived?.slides.find((slide) => slide.id === slideId)?.include !== true) return;
  state.phase = 'pressed';
  state.pointerId = e.pointerId;
  state.pointerType = e.pointerType;
  state.startX = e.clientX;
  state.startY = e.clientY;
  state.lastX = e.clientX;
  state.lastY = e.clientY;
  state.slideId = slideId;
  state.gap = -1;
  const move = (ev: PointerEvent): void => onPointerMove(rb, ev);
  const up = (ev: PointerEvent): void => onPointerUp(rb, ev);
  const cancel = (ev: PointerEvent): void => {
    if (ev.pointerId !== state.pointerId) return;
    if (state.phase === 'dragging') cancelDrag(rb);
    else reset(rb, state);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  state.off.push(() => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
  });
  if (e.pointerType === 'touch') {
    state.armTimer = setTimeout(() => {
      state.armTimer = 0;
      if (state.phase !== 'pressed') return;
      state.phase = 'armed';
      const tile = rb.strip.tile(slideId);
      if (tile) tile.dataset.armed = 'true';
    }, TOUCH_ARM_MS);
  }
}

function onPointerMove(rb: RbCtx, e: PointerEvent): void {
  const state = stateOf(rb);
  if (e.pointerId !== state.pointerId) return;
  state.lastX = e.clientX;
  state.lastY = e.clientY;
  const travel = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
  if (state.phase === 'pressed') {
    if (travel <= DRAG_SLOP_PX) return;
    // A finger that travels before the drag is armed is panning the strip.
    if (state.pointerType === 'touch') reset(rb, state);
    else begin(rb, state);
    return;
  }
  if (state.phase === 'armed') {
    // The menu opened on the long press: the armed drag lets go.
    if (rb.strip.menuOpen()) {
      reset(rb, state);
      return;
    }
    if (travel > DRAG_SLOP_PX) begin(rb, state);
  }
}

function onPointerUp(rb: RbCtx, e: PointerEvent): void {
  const state = stateOf(rb);
  if (e.pointerId !== state.pointerId) return;
  state.lastX = e.clientX;
  state.lastY = e.clientY;
  if (state.phase === 'dragging') {
    const gap = gapAt(rb.strip.x(state.lastX), rb.strip.pitch(), includedIds(rb).length);
    state.gap = gap;
    void drop(rb, state);
    return;
  }
  reset(rb, state);
}

// ─── the keyboard move ───────────────────────────────────────────────────────

/** Start the keyboard move for a slide (and the rest of the selection when it is part of one). */
export function startMove(rb: RbCtx, slideId: string): void {
  const state = stateOf(rb);
  const included = includedIds(rb);
  if (!included.includes(slideId) || included.length < 2 || rb.strip.selectionOnly()) return;
  const selected = selectedSlideIds(rb.sel, rb.derived?.slides ?? []);
  const ids = (selected.length > 1 && selected.includes(slideId) ? selected : [slideId]).filter((id) => included.includes(id));
  const from = landingIndex(included, new Set(ids), included.indexOf(ids[0] ?? ''));
  state.key = { ids, from, to: from };
  rb.memo.strip = '';
  rb.strip.render();
  rb.strip.focus(slideId);
  const count = included.length;
  rb.announce(tRaw('Moving slide {n}, position {position} of {count}. Left and Right move it, Enter drops it, Escape cancels.', {
    n: rb.derived?.slides.find((slide) => slide.id === slideId)?.number ?? 1,
    position: from + 1,
    count,
  }));
}

/** What the bar over the strip says during a keyboard move: the slide's number and where it is. Null otherwise. */
export function keyMoveState(rb: RbCtx): { ids: string[]; n: number; position: number; count: number } | null {
  const move = stateOf(rb).key;
  if (!move) return null;
  const first = move.ids[0];
  return {
    ids: [...move.ids],
    n: rb.derived?.slides.find((slide) => slide.id === first)?.number ?? 1,
    position: move.to + 1,
    count: includedIds(rb).length,
  };
}

/**
 * Drop the keyboard move where it is now, as one undo step, and ring the slide in its
 * new place. Enter, Space and the bar's Done button all come here.
 */
export function dropMove(rb: RbCtx): void {
  const state = stateOf(rb);
  const move = state.key;
  if (!move) return;
  state.key = null;
  rb.memo.strip = '';
  const ids = move.ids;
  if (move.to === move.from) {
    rb.strip.render();
    rb.announce(t('The slide stays where it was.'));
    if (ids[0]) rb.strip.focus(ids[0]);
    return;
  }
  void rb.strip.moveBlock(ids, move.to).then(() => {
    if (ids[0]) {
      rb.strip.focus(ids[0]);
      ring(rb, ids[0]);
    }
  });
}

/** The order the strip shows during a keyboard move: included slides with the block at its new place. Null otherwise. */
export function previewOrder(rb: RbCtx): string[] | null {
  const move = stateOf(rb).key;
  if (!move) return null;
  const included = includedIds(rb);
  const set = new Set(move.ids);
  const rest = included.filter((id) => !set.has(id));
  return [...rest.slice(0, move.to), ...move.ids, ...rest.slice(move.to)];
}

/**
 * A key during the keyboard move. True when the key was the move's: arrows move by one
 * (flipped in a right to left strip), Home and End to the ends, Enter or Space drops,
 * Escape cancels.
 */
export function moveKey(rb: RbCtx, e: KeyboardEvent): boolean {
  const state = stateOf(rb);
  const move = state.key;
  if (!move) return false;
  // A key pressed with focus outside the filmstrip belongs to that control: the move
  // ends there. Focus on the body is still the strip's (a redraw drops it there).
  const target = e.target;
  if (target instanceof Node && target !== document.body && !rb.els.strip.contains(target)) {
    cancelDrag(rb, false);
    return false;
  }
  // The bar's own Done and Cancel buttons take their keys as buttons do.
  if (target instanceof Element && target.closest('[data-bar]')) return false;
  const rest = includedIds(rb).length - move.ids.length;
  const back = rb.strip.rtl() ? 'ArrowRight' : 'ArrowLeft';
  const on = rb.strip.rtl() ? 'ArrowLeft' : 'ArrowRight';
  let to = move.to;
  if (e.key === back || e.key === 'ArrowUp') to -= 1;
  else if (e.key === on || e.key === 'ArrowDown') to += 1;
  else if (e.key === 'Home') to = 0;
  else if (e.key === 'End') to = rest;
  else if (e.key === 'Enter' || e.key === ' ') {
    dropMove(rb);
    return true;
  } else if (e.key === 'Escape') {
    cancelDrag(rb);
    return true;
  } else if (e.key === 'Tab') {
    return false;
  } else {
    // Every other key is held while the move runs, so a stray letter does not act elsewhere.
    return !(e.metaKey || e.ctrlKey);
  }
  to = Math.max(0, Math.min(rest, to));
  if (to !== move.to) {
    move.to = to;
    rb.memo.strip = '';
    rb.strip.render();
    const first = move.ids[0];
    if (first) rb.strip.focus(first);
  }
  rb.announce(t('Position {position} of {count}.', { position: to + 1, count: rest + move.ids.length }));
  return true;
}

// ─── wiring ──────────────────────────────────────────────────────────────────

/** Listen for drags on the filmstrip. The strip calls this once its list exists. */
export function wireDrag(rb: RbCtx): void {
  const list = listEl(rb);
  if (!list) return;
  const down = (e: PointerEvent): void => onPointerDown(rb, e);
  // A picture's own drag (the browser's image drag) would take the gesture.
  const native = (e: DragEvent): void => e.preventDefault();
  // Once a touch drag is armed the finger's travel is the drag's, not the strip's pan.
  // The listener is on the list from the start and not passive, so the browser asks it
  // before panning; it lets every travel through until the drag is armed.
  const hold = (e: TouchEvent): void => {
    const phase = stateOf(rb).phase;
    if ((phase === 'armed' || phase === 'dragging') && e.cancelable) e.preventDefault();
  };
  // A press anywhere outside the filmstrip ends the keyboard move.
  const outside = (e: PointerEvent): void => {
    if (!stateOf(rb).key) return;
    if (e.target instanceof Node && rb.els.strip.contains(e.target)) return;
    cancelDrag(rb, false);
  };
  list.addEventListener('pointerdown', down);
  list.addEventListener('dragstart', native);
  list.addEventListener('touchmove', hold, { passive: false });
  document.addEventListener('pointerdown', outside, true);
  rb.disposers.push(() => {
    list.removeEventListener('pointerdown', down);
    list.removeEventListener('dragstart', native);
    list.removeEventListener('touchmove', hold);
    document.removeEventListener('pointerdown', outside, true);
    const state = stateOf(rb);
    release(state);
    state.lift?.remove();
    state.lift = null;
    state.key = null;
  });
}

/** True while a pointer drag runs or the keyboard move is on. */
export function dragActive(rb: RbCtx): boolean {
  const state = stateOf(rb);
  return state.phase === 'dragging' || state.key !== null;
}

/** True for the click the browser sends straight after a drop. */
export function justDropped(rb: RbCtx): boolean {
  return stateOf(rb).dropped;
}

/** Script time of the last drag frames, in ms, newest last: the budget the browser test reads. */
export function frameCosts(rb: RbCtx): number[] {
  return [...stateOf(rb).costs];
}

export function dragOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireDrag),
    startMove: bindOp(rb, startMove),
    keyMove: bindOp(rb, keyMoveState),
    dropMove: bindOp(rb, dropMove),
    cancel: bindOp(rb, cancelDrag),
    active: bindOp(rb, dragActive),
    moveKey: bindOp(rb, moveKey),
    previewOrder: bindOp(rb, previewOrder),
    justDropped: bindOp(rb, justDropped),
    frameCosts: bindOp(rb, frameCosts),
  };
}

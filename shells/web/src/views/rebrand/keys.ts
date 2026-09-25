// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: keyboard (plan 274 section 4, plan 275 decision 31, WCAG 2.2 AA).
 *
 * Undo and Redo on the platform chords (Mod+Z, Shift+Mod+Z and Mod+Y), Esc closing
 * the topmost overlay (a Replace chooser, then the narrow decision sheet, then the
 * report drawer) and returning focus to what opened it, and arrow keys within the
 * queue list. Shortcuts never fire while focus is in a text field or a select. Keeps
 * focus sensible when a queue item resolves and leaves the list: `capture` and
 * `restore` wrap a module's redraw so focus goes to the item that took the place of
 * the one that went, never on the page body.
 *
 * Flicking through the slides works anywhere in the review except a text field, a
 * select, an open menu or a control that uses the arrows itself (a tab row, a slider,
 * another list): Left and Right, Page Up and Page Down, and K and J go to the previous
 * and next slide, Home and End to the first and last. The comparison, the decision
 * column and the filmstrip follow, and the thumbnail scrolls into view; on the
 * filmstrip, focus moves with it. Shift with an arrow extends the filmstrip's
 * selection, Alt with an arrow moves the slide one place, L opens the layout chooser
 * for the selected slides, M on a thumbnail starts the keyboard move, Ctrl or Cmd
 * with A on the filmstrip selects every slide, Shift+F10 or the Menu key on a
 * thumbnail opens its menu, and the question mark lists the shortcuts. In a right to
 * left layout Left and Right swap, so Right goes toward the start. The letters are read
 * by the key's place as well as its character, so J, K, L and M work on a Cyrillic,
 * Greek or Arabic layout too. None of these keys act while the report drawer or the
 * narrow decision sheet is open over the slides. The filmstrip's keyboard move
 * (`rb.drag.moveKey`) takes the keys first while it runs.
 *
 * In Keep the design the filmstrip only selects: the flicking keys and the question
 * mark work while it shows, and nothing that selects several, moves or re-lays a slide.
 *
 * The single-character keys (J, K, L, M, the question mark) can be limited to a focused
 * filmstrip thumbnail from the shortcuts sheet (WCAG 2.1.4), for a person whose speech
 * input types a letter by accident. The choice is a chrome preference in `localStorage`
 * under `SINGLE_KEYS_KEY`, never plan or project state.
 */
import { t, tRaw } from '../../i18n.ts';
import { bindOp, type RbCtx } from './context.ts';
import { readableTitle, selectedSlideIds } from './shared.ts';

/** The chrome preference that limits the single-character keys to a focused thumbnail. */
export const SINGLE_KEYS_KEY = 'lolly-rebrand-single-keys';

/** True when the single-character keys work anywhere in the view (the default). */
export function singleKeysOn(rb: RbCtx): boolean {
  void rb;
  try {
    return localStorage.getItem(SINGLE_KEYS_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Turn the single-character keys on everywhere, or limit them to a focused thumbnail. */
export function setSingleKeys(rb: RbCtx, on: boolean): void {
  void rb;
  try {
    if (on) localStorage.removeItem(SINGLE_KEYS_KEY);
    else localStorage.setItem(SINGLE_KEYS_KEY, 'off');
  } catch {
    // Storage refused: the keys keep their default for this visit.
  }
}

/** Where focus was inside a region before a redraw: the key of the focused element and its index. */
export interface RbFocusMemo {
  key: string;
  index: number;
}

/** True when a key press belongs to the control that has focus: a text field, a select or an editable region. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(type);
}

/** A dialog of the app's own (confirm, prompt, modal) owns its keys while it is open. */
function modalOpen(): boolean {
  return Boolean(document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])'));
}

/** The identity a focusable element carries: its key, item, slide, object or tab data attribute. */
function focusKey(el: HTMLElement): string {
  const { key, item, slide, object, tab } = el.dataset;
  if (key) return `key:${key}`;
  if (item) return `item:${item}`;
  if (slide) return `slide:${slide}`;
  if (object) return `object:${object}`;
  return tab ? `tab:${tab}` : '';
}

/** The identity of one element: its `data-<attr>` value, else the generic key above. */
function identity(el: HTMLElement, attr: string): string {
  const own = el.dataset[attr];
  return own ? `${attr}:${own}` : focusKey(el);
}

/**
 * Remember which element of `selector` inside `region` has focus, by its
 * `data-<attr>` value (or its key, item, slide, object or tab when it has none) and
 * its position among the matches.
 */
export function captureFocus(rb: RbCtx, region: HTMLElement, selector: string, attr: string): RbFocusMemo | null {
  void rb;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !region.contains(active)) return null;
  const el = active.closest<HTMLElement>(selector);
  if (!el) return null;
  const all = [...region.querySelectorAll<HTMLElement>(selector)];
  return { key: identity(el, attr), index: all.indexOf(el) };
}

/**
 * Put focus back after a redraw. The same element when it is still there; else the
 * one that took its place (the next item, or the last when the list got shorter);
 * else the region's first focusable element. Nothing happens when focus was not in
 * the region before the redraw, or when it moved somewhere real during the redraw.
 */
export function restoreFocus(rb: RbCtx, region: HTMLElement, selector: string, attr: string, memo: RbFocusMemo | null): void {
  void rb;
  if (!memo) return;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && active.isConnected) return;
  const all = [...region.querySelectorAll<HTMLElement>(selector)];
  const same = all.find((el) => identity(el, attr) === memo.key);
  const next = same ?? all[Math.min(memo.index, all.length - 1)] ?? region.querySelector<HTMLElement>('button, [tabindex="0"]');
  next?.focus();
}

/**
 * Undo or redo, and say what came of it: the step's own words, captured before the
 * call because the history moves on. The top bar's buttons, the chords and the footer's
 * inline Undo share it, so each shows the same words on the footer's outcome line
 * (`rb.foot.say`, which also speaks them once) with no Undo of its own.
 */
export async function step(rb: RbCtx, direction: 'undo' | 'redo'): Promise<void> {
  const label = direction === 'undo' ? rb.state.history.undo : rb.state.history.redo;
  const outcome = direction === 'undo' ? await rb.controller.undo() : await rb.controller.redo();
  if (outcome.ok) {
    rb.foot.say(rb.top.stepDone(direction, label));
    return;
  }
  if (outcome.refusal === 'nothing-to-do') {
    rb.announce(direction === 'undo' ? t('Nothing to undo.') : t('Nothing to redo.'));
    return;
  }
  rb.decide.announceOutcome(outcome, '');
}

/** Move focus along a row of buttons by one, or to either end. */
function moveAlong(list: HTMLElement[], current: HTMLElement, key: string): HTMLElement | undefined {
  const at = list.indexOf(current);
  if (at < 0) return undefined;
  if (key === 'Home') return list[0];
  if (key === 'End') return list[list.length - 1];
  const delta = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1;
  return list[Math.max(0, Math.min(list.length - 1, at + delta))];
}

const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

/** Arrow keys within the queue list: up and down in the column, left and right in the chip row. */
function queueArrows(rb: RbCtx, e: KeyboardEvent): boolean {
  const current = (e.target as Element).closest<HTMLElement>('.rb-q-item, .rb-q-chip');
  if (!current || !rb.els.queue.contains(current)) return false;
  const chips = current.classList.contains('rb-q-chip');
  if (chips ? (e.key === 'ArrowUp' || e.key === 'ArrowDown') : (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return false;
  const list = [...rb.els.queue.querySelectorAll<HTMLElement>(chips ? '.rb-q-chip' : '.rb-q-item')];
  const next = moveAlong(list, current, e.key);
  if (!next || next === current) return true;
  next.focus();
  return true;
}

/** The focused filmstrip thumbnail, when focus is on one. */
function stripOption(rb: RbCtx, target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const option = target.closest<HTMLElement>('.rb-thumb-pick');
  return option && rb.els.strip.contains(option) ? option : null;
}

/**
 * A control that uses the arrow keys itself, or an open menu: flicking leaves it
 * alone. The filmstrip's own list is not one, and neither is a plain button.
 */
function ownsArrows(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('.rb-strip-list')) return false;
  // A column grip (role separator) takes the arrows to resize, and Alt with an arrow to
  // step further, so no review key acts while one has focus.
  if (target.closest('[role="menu"], [role="menubar"], [role="listbox"], [role="tablist"], [role="radiogroup"], [role="grid"], [role="tree"], [role="slider"], [role="spinbutton"], [role="separator"], [role="dialog"], dialog, .resize-grip')) return true;
  return target instanceof HTMLInputElement && target.type === 'range';
}

/** A menu open over the view: the project menu, the filmstrip menu, or one another module mounted. */
function menuOpen(rb: RbCtx): boolean {
  if (rb.top.menuOpen() || rb.strip.menuOpen()) return true;
  return Boolean(document.querySelector('[role="menu"]:not([hidden]) [role="menuitem"]'));
}

type Flick = 'prev' | 'next' | 'first' | 'last';

/**
 * The key a shortcut reads: a Latin letter in lower case, from the character typed, else
 * from the key's place (`KeyJ`) when the layout types another script there; every other
 * key as it is named.
 */
export function shortcutKey(e: Pick<KeyboardEvent, 'key' | 'code'>): string {
  if (e.key.length === 1 && /[a-z]/i.test(e.key)) return e.key.toLowerCase();
  const place = /^Key([A-Z])$/.exec(e.code ?? '');
  if (e.key.length === 1 && place?.[1]) return place[1].toLowerCase();
  return e.key;
}

/** Which way a key flicks, or null for a key that does not. Right to left swaps Left and Right. */
export function flickOf(key: string, rtl: boolean): Flick | null {
  switch (key) {
    case 'ArrowLeft': return rtl ? 'next' : 'prev';
    case 'ArrowRight': return rtl ? 'prev' : 'next';
    case 'PageUp':
    case 'k':
    case 'K': return 'prev';
    case 'PageDown':
    case 'j':
    case 'J': return 'next';
    case 'Home': return 'first';
    case 'End': return 'last';
    default: return null;
  }
}

/**
 * Go to the previous, next, first or last slide. `extend` grows the filmstrip's
 * selection to it (Shift). From a filmstrip thumbnail the step counts from that
 * thumbnail and focus follows; elsewhere it counts from the slide the comparison shows.
 */
function flick(rb: RbCtx, way: Flick, extend: boolean, option: HTMLElement | null): void {
  const slides = rb.derived?.slides ?? [];
  if (slides.length === 0) return;
  const onStrip = option !== null;
  const from = option?.dataset.slide ?? rb.sel.slideId;
  const at = slides.findIndex((slide) => slide.id === from);
  let to = at < 0 ? 0 : at;
  if (way === 'first') to = 0;
  else if (way === 'last') to = slides.length - 1;
  else if (at >= 0) to = Math.max(0, Math.min(slides.length - 1, at + (way === 'next' ? 1 : -1)));
  const target = slides[to];
  if (!target) return;
  if (to === at && !extend) {
    if (onStrip) rb.strip.focus(target.id);
    return;
  }
  rb.strip.pick(target.id, extend ? 'range' : 'replace');
  if (onStrip) rb.strip.focus(target.id);
  else {
    const own = readableTitle(target.title);
    // A text sink: the title goes in as it is, never as markup.
    rb.announce(own ? tRaw('Slide {n}: {title}', { n: target.number, title: own }) : tRaw('Slide {n}', { n: target.number }));
  }
}

/**
 * Alt with an arrow: the selected slides move one place, as one undo step. A slide
 * already first (or last) stays, with nothing written, and that is said.
 */
function nudge(rb: RbCtx, way: 'prev' | 'next'): void {
  const slides = rb.derived?.slides ?? [];
  const ids = selectedSlideIds(rb.sel, slides).filter((id) => slides.find((slide) => slide.id === id)?.include);
  const first = ids[0];
  if (!first) return;
  if (ids.length === 1) {
    const included = slides.filter((slide) => slide.include);
    const at = included.findIndex((slide) => slide.id === first);
    if (way === 'prev' && at <= 0) {
      rb.announce(t('This slide is already first.'));
      return;
    }
    if (way === 'next' && at >= included.length - 1) {
      rb.announce(t('This slide is already last.'));
      return;
    }
    void rb.strip.moveBy(first, way === 'next' ? 1 : -1);
    return;
  }
  const included = slides.filter((slide) => slide.include).map((slide) => slide.id);
  const set = new Set(ids);
  const rest = included.filter((id) => !set.has(id));
  const now = included.slice(0, included.indexOf(first)).filter((id) => !set.has(id)).length;
  const to = Math.max(0, Math.min(rest.length, now + (way === 'next' ? 1 : -1)));
  if (to !== now) void rb.strip.moveBlock(ids, to);
}

/**
 * The review's own keys: flicking, extending, moving, the layout chooser, select all
 * and the shortcuts. True when the key was one of them. `selectionOnly` (Keep the
 * design) leaves only the flicking keys and the shortcuts.
 */
function reviewKeys(rb: RbCtx, e: KeyboardEvent, selectionOnly = false): boolean {
  if (!rb.derived || rb.derived.slides.length === 0) return false;
  // The report drawer and the narrow sheet cover the slides: a key must not change,
  // move or re-lay a slide nobody can see. Escape still closes them (closeTopmost).
  if (rb.reportOpen || rb.decide.sheetOpen()) return false;
  const target = e.target;
  const inView = target === document.body || (target instanceof Node && rb.viewEl.contains(target));
  if (!inView || menuOpen(rb)) return false;
  const mod = e.metaKey || e.ctrlKey;
  const option = stripOption(rb, target);
  // With the single-character keys limited, a letter or the question mark acts only on
  // a focused thumbnail.
  const letters = option !== null || singleKeysOn(rb);
  // The question mark lists the shortcuts from anywhere in the view but a dialog.
  if (e.key === '?' && !mod && !e.altKey) {
    if (!letters || (target instanceof Element && target.closest('[role="dialog"], dialog'))) return false;
    rb.strip.shortcuts();
    return true;
  }
  if (ownsArrows(target)) return false;
  const key = shortcutKey(e);
  if (!letters && !mod && key.length === 1) return false;
  if (selectionOnly) {
    const way = !mod && !e.altKey && !e.shiftKey ? flickOf(key, rb.strip.rtl()) : null;
    if (!way) return false;
    flick(rb, way, false, option);
    return true;
  }
  if (mod && !e.altKey && key === 'a') {
    if (!option) return false;
    rb.strip.selectAll();
    return true;
  }
  if (mod) return false;
  // Shift+F10 and the Menu key: the slide menu, on every platform (macOS has no key of
  // its own for a context menu, and Windows fires one only for some keyboards).
  if (option && !e.altKey && ((key === 'F10' && e.shiftKey) || key === 'ContextMenu')) {
    rb.strip.openMenu(option.dataset.slide ?? '', option);
    return true;
  }
  if (option && !e.altKey && (key === 'Enter' || key === ' ')) {
    rb.strip.pick(option.dataset.slide ?? '', e.shiftKey ? 'range' : rb.strip.selecting() ? 'toggle' : 'replace');
    return true;
  }
  if (option && !e.altKey && !e.shiftKey && key === 'm') {
    rb.drag.startMove(option.dataset.slide ?? '');
    return true;
  }
  if (!e.altKey && !e.shiftKey && key === 'l') {
    const ids = selectedSlideIds(rb.sel, rb.derived.slides);
    if (ids.length === 0 || rb.strip.selectionOnly()) return false;
    // The chooser anchors on the focused thumbnail, else on whatever had focus, and gives
    // focus back to that control when it closes.
    rb.chooser.open(ids, 'menu', option ?? undefined);
    return true;
  }
  const rtl = rb.strip.rtl();
  const way = flickOf(key, rtl);
  if (!way) return false;
  // Letters and the page keys flick with no modifier; Shift and Alt go with the arrows.
  const arrow = key === 'ArrowLeft' || key === 'ArrowRight';
  if (e.altKey) {
    if (!arrow || e.shiftKey || (way !== 'prev' && way !== 'next')) return false;
    nudge(rb, way);
    return true;
  }
  if (e.shiftKey && !arrow && key !== 'Home' && key !== 'End') return false;
  flick(rb, way, e.shiftKey, option);
  return true;
}

/**
 * Esc: the topmost overlay closes, and focus goes back to what opened it. The report
 * drawer paints over everything else in the view (its dimmer covers the column the
 * chooser and the sheet live in), so it goes first; the chooser sits inside the sheet.
 */
function closeTopmost(rb: RbCtx): boolean {
  if (rb.reportOpen) {
    const back = reportOpener.get(rb);
    rb.report.close();
    if (back?.isConnected) back.focus();
    return true;
  }
  if (rb.decide.chooserOpen()) {
    rb.decide.closeChooser();
    return true;
  }
  if (rb.decide.sheetOpen()) {
    rb.decide.closeSheet();
    return true;
  }
  return false;
}

/** What had focus just before focus first moved into the report drawer, per view. */
const reportOpener = new WeakMap<RbCtx, HTMLElement>();

export function wireKeys(rb: RbCtx): void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || !rb.viewEl.isConnected) return;
    if (isTypingTarget(e.target) || modalOpen()) return;
    // The filmstrip's keyboard move holds the keys while it runs.
    if (rb.drag.moveKey(e)) {
      e.preventDefault();
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const reviewing = Boolean(rb.state.plan) && rb.state.mode === 'renovate';
    if (mod && !e.altKey && (key === 'z' || key === 'y')) {
      if (!reviewing) return;
      e.preventDefault();
      void step(rb, key === 'y' || e.shiftKey ? 'redo' : 'undo');
      return;
    }
    if (e.key === 'Escape') {
      // A drag in progress goes back where it started, and that is all this press does.
      if (rb.drag.active()) {
        rb.drag.cancel();
        e.preventDefault();
        return;
      }
      // The project menu and the filmstrip menu close themselves on Esc; one press must
      // not also close what is under them.
      if (rb.top.menuOpen() || rb.strip.menuOpen()) return;
      if (closeTopmost(rb)) e.preventDefault();
      else if (reviewing && rb.strip.clearSelection()) {
        rb.announce(t('1 slide selected.'));
        e.preventDefault();
      }
      return;
    }
    if (!mod && !e.altKey && ARROWS.has(e.key) && queueArrows(rb, e)) {
      e.preventDefault();
      return;
    }
    // Keep the design flicks through the filmstrip once it shows there.
    const keeping = rb.state.mode === 'keep-design' && !rb.els.strip.hidden;
    if ((reviewing || keeping) && reviewKeys(rb, e, keeping)) e.preventDefault();
  };
  const onFocusIn = (e: FocusEvent): void => {
    const from = e.relatedTarget;
    if (!(e.target instanceof Node) || !rb.els.report.contains(e.target)) return;
    if (from instanceof HTMLElement && !rb.els.report.contains(from)) reportOpener.set(rb, from);
  };
  document.addEventListener('keydown', onKey);
  rb.els.report.addEventListener('focusin', onFocusIn);
  rb.disposers.push(() => {
    document.removeEventListener('keydown', onKey);
    rb.els.report.removeEventListener('focusin', onFocusIn);
  });
}

export function keysOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireKeys),
    capture: bindOp(rb, captureFocus),
    restore: bindOp(rb, restoreFocus),
    step: bindOp(rb, step),
    singleKeys: bindOp(rb, singleKeysOn),
    setSingleKeys: bindOp(rb, setSingleKeys),
  };
}

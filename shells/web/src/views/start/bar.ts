// SPDX-License-Identifier: MPL-2.0
/**
 * start: bar - the studio's compact bar and its rooms (plan 336 P1, P2).
 *
 * The markup is navigation.ts's; this wires what the markup cannot do alone:
 *
 *  - the More menu. It lists the quieter whole-system actions that are showing
 *    right now and presses the real control, so each keeps its own listener and
 *    its own hidden-until-it-applies rule. On a phone "Add from…" leaves the bar
 *    for this menu, so it joins the list whenever its button is offered but not
 *    drawn. Built as DOM, never markup: every label is a control's own text.
 *  - the room strip as one Tab stop. Arrows walk it (reading direction aware),
 *    Home and End jump to its ends, and Enter or Space opens the room, the
 *    buttons' own behaviour.
 *  - the ink: the current room's tinted fill, drawn once and slid between
 *    rooms. The stylesheet stops the slide under either Reduce motion switch.
 *  - the current room kept in view when the strip scrolls (always on a phone),
 *    and a cue on each end that has rooms past it (lib/scroll-cue.ts: a fade
 *    into the bar's own surface with a chevron pointing the way), so the strip
 *    shows it scrolls on a phone and a narrow desk alike (plan 346, change 10).
 *  - emphasis by ownership (plan 346, change 1). While the system is not the
 *    person's yet, the filled action is "Make it yours", a small menu of the
 *    first moves (Find a look, Add from…, Pick a colour), and Export is drawn in
 *    outline. Once it is theirs, Make it yours steps aside, Add from… returns
 *    and Export takes the fill back.
 *
 * Every exported function takes the shared `start: StartCtx` first (see context.ts).
 */
import { mountBodyPopover, type BodyPopoverHandle } from '../../components/body-popover.ts';
import { t } from '../../i18n.ts';
import { watchScrollCue } from '../../lib/scroll-cue.ts';
import { bindOp, type StartCtx } from './context.ts';

/** One More-menu entry: the label it shows and the control it presses. */
interface OverflowItem { label: string; press: () => void }

/** The rooms a keyboard can reach, in strip order. */
const roomButtons = (start: StartCtx): HTMLButtonElement[] =>
  start.roomBtns.filter(btn => !btn.hidden);

/** The quieter actions that apply right now, in the order the menu lists them. */
export function overflowItems(start: StartCtx): OverflowItem[] {
  const items: OverflowItem[] = [];
  const { importBtn } = start;
  // Offered (not hidden) yet not drawn: the phone bar has no room for the button.
  if (importBtn && !importBtn.hidden && getComputedStyle(importBtn).display === 'none') {
    items.push({ label: importBtn.textContent?.trim() ?? '', press: () => importBtn.click() });
  }
  const holder = start.shell.querySelector<HTMLElement>('[data-ds-overflow]');
  for (const el of holder ? [...holder.children] : []) {
    if (!(el instanceof HTMLElement) || el.hidden) continue;
    items.push({ label: el.textContent?.trim() ?? '', press: () => el.click() });
  }
  return items.filter(item => item.label);
}

export function wireMoreMenu(start: StartCtx): void {
  const trigger = start.shell.querySelector<HTMLButtonElement>('[data-ds-more]');
  if (!trigger) return;
  /** Draw the rows for what applies right now into `el`; the first row, for focus. */
  const fill = (el: HTMLElement, popover: BodyPopoverHandle): HTMLElement | null => {
    el.replaceChildren();
    let first: HTMLElement | null = null;
    for (const item of overflowItems(start)) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'profile-menu-item';
      row.setAttribute('role', 'menuitem');
      row.textContent = item.label;
      // Focus goes back to More first; an action that opens a dialog or a room
      // then takes it on from there.
      row.addEventListener('click', () => { popover.close(true); item.press(); });
      el.append(row);
      first ??= row;
    }
    return first;
  };
  let drawn: HTMLElement | null = null;
  const menu = mountBodyPopover(trigger, (el, popover) => { drawn = el; return fill(el, popover); },
    { className: 'profile-menu ds-bar-menu', role: 'menu', ariaLabel: t('More actions'), menuNavigation: true });
  start.moreMenu = menu;
  // An action can come to apply while the menu is open: Restore brand settings shows
  // once the studio's checkpoints have loaded, a moment after the page settles. The open
  // menu is redrawn when an overflow action is shown or hidden, keeping the row that had
  // focus (or the first row, when that one has gone).
  const holder = start.shell.querySelector<HTMLElement>('[data-ds-overflow]');
  const watch = holder ? new MutationObserver(() => {
    if (!menu.isOpen() || !drawn?.isConnected) return;
    const focused = document.activeElement instanceof HTMLElement && drawn.contains(document.activeElement) ? document.activeElement.textContent : null;
    const first = fill(drawn, menu);
    if (focused === null) return;
    const same = [...drawn.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(row => row.textContent === focused);
    (same ?? first)?.focus();
  }) : null;
  if (holder && watch) watch.observe(holder, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  const onClick = (): void => { if (menu.isOpen()) menu.close(true); else menu.open(); };
  trigger.addEventListener('click', onClick);
  const prev = start.unsubBar;
  start.unsubBar = () => { prev?.(); watch?.disconnect(); trigger.removeEventListener('click', onClick); menu.close(); start.moreMenu = null; };
}

/** The first moves "Make it yours" offers, in the order the Board's Start here
 *  row shows them. Built at open, so every label is in the current language. */
export function makeItems(start: StartCtx): OverflowItem[] {
  return [
    { label: t('Find a look'), press: () => { void start.looks.openLooks(); } },
    { label: t('Add from…'), press: () => start.sources.openImport() },
    { label: t('Pick a colour'), press: () => { start.rooms.selectRoom('color', { focus: true, sfx: true }); start.rooms.openFocus('color', 'pick'); } },
  ];
}

export function wireMakeMenu(start: StartCtx): void {
  const trigger = start.shell.querySelector<HTMLButtonElement>('[data-start-make]');
  if (!trigger) return;
  const menu = mountBodyPopover(trigger, (el, popover) => {
    el.replaceChildren();
    let first: HTMLElement | null = null;
    for (const item of makeItems(start)) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'profile-menu-item';
      row.setAttribute('role', 'menuitem');
      row.textContent = item.label;
      row.addEventListener('click', () => { popover.close(true); item.press(); });
      el.append(row);
      first ??= row;
    }
    return first;
  }, { className: 'profile-menu ds-bar-menu', role: 'menu', ariaLabel: t('Make it yours'), menuNavigation: true });
  start.makeMenu = menu;
  const onClick = (): void => { if (menu.isOpen()) menu.close(true); else menu.open(); };
  trigger.addEventListener('click', onClick);
  const prev = start.unsubBar;
  start.unsubBar = () => { prev?.(); trigger.removeEventListener('click', onClick); menu.close(); start.makeMenu = null; };
}

/**
 * Draw the bar for whose system this is (rooms/overview.ts `boardState`):
 *
 *   blank    the Board's own doors are up, so the bar adds no first move;
 *   unowned  "Make it yours" is filled, Add from… waits in its menu, and Export
 *            (when it is offered at all) is outlined;
 *   owned    Add from… and a filled Export, as the bar has always been.
 *
 * Export's own "offered" rule (the worth-exporting latch) is untouched: this
 * only chooses how it is drawn.
 */
export function applyEmphasis(start: StartCtx): void {
  const state = start.boardState;
  const make = start.shell.querySelector<HTMLButtonElement>('[data-start-make]');
  const exportBtn = start.shell.querySelector<HTMLButtonElement>('[data-start-export]');
  const unowned = state === 'unowned';
  if (make) make.hidden = !unowned;
  if (!unowned) start.makeMenu?.close();
  if (start.importBtn) start.importBtn.hidden = state !== 'owned';
  if (exportBtn) {
    exportBtn.classList.toggle('be-cta', !unowned);
    exportBtn.classList.toggle('be-btn', unowned);
  }
  start.shell.dataset.boardState = state ?? '';
}

/** The ink element, created on first use inside the strip's own list. */
function inkOf(start: StartCtx): HTMLElement | null {
  const list = start.railEl.querySelector<HTMLElement>('.ds-rooms');
  if (!list) return null;
  let ink = list.querySelector<HTMLElement>(':scope > .ds-room-ink');
  if (!ink) {
    ink = document.createElement('li');
    ink.className = 'ds-room-ink';
    ink.setAttribute('aria-hidden', 'true');
    ink.setAttribute('role', 'presentation');
    list.prepend(ink);
    list.setAttribute('data-ink', '');
  }
  return ink;
}

/**
 * Bring the strip in line with the open room: one Tab stop on it, the ink under
 * it, and the room scrolled into the strip's view when the strip scrolls.
 * `instant` places the ink without the slide (the first paint, a resize).
 */
export function syncStrip(start: StartCtx, instant = false): void {
  const rooms = roomButtons(start);
  const current = rooms.find(btn => btn.getAttribute('aria-current') === 'page') ?? rooms[0];
  for (const btn of start.roomBtns) btn.tabIndex = btn === current ? 0 : -1;
  if (!current) return;
  const list = current.closest<HTMLElement>('.ds-rooms');
  const ink = inkOf(start);
  if (ink) {
    const li = current.parentElement;
    if (instant) ink.style.transition = 'none';
    ink.style.width = `${current.offsetWidth}px`;
    ink.style.height = `${current.offsetHeight}px`;
    ink.style.transform = `translate(${(li?.offsetLeft ?? 0) + current.offsetLeft}px, ${(li?.offsetTop ?? 0) + current.offsetTop}px)`;
    if (instant) { void ink.offsetWidth; ink.style.transition = ''; }
  }
  // Only a strip that scrolls is moved, and only along its own axis: the page
  // itself never jumps to show a room button.
  if (list && list.scrollWidth > list.clientWidth + 1) {
    const box = current.getBoundingClientRect(), view = list.getBoundingClientRect();
    if (box.left < view.left || box.right > view.right) {
      list.scrollBy({ left: box.left + box.width / 2 - (view.left + view.width / 2), behavior: instant ? 'auto' : 'smooth' });
    }
  }
}

/** Arrows, Home and End walk the strip; the room opens on Enter or Space. */
function onStripKey(start: StartCtx, e: KeyboardEvent): void {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const rooms = roomButtons(start);
  const at = rooms.indexOf(e.target as HTMLButtonElement);
  if (at < 0) return;
  const rtl = getComputedStyle(start.railEl).direction === 'rtl';
  const step = e.key === 'ArrowRight' ? (rtl ? -1 : 1) : e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0;
  let next = -1;
  if (step) next = (at + step + rooms.length) % rooms.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = rooms.length - 1;
  if (next < 0) return;
  e.preventDefault();
  for (const btn of rooms) btn.tabIndex = btn === rooms[next] ? 0 : -1;
  rooms[next]!.focus();
  rooms[next]!.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export function wireBar(start: StartCtx): void {
  wireMoreMenu(start);
  wireMakeMenu(start);
  const onKey = (e: KeyboardEvent): void => onStripKey(start, e);
  start.railEl.addEventListener('keydown', onKey);
  // The ink measures laid-out pills, so it follows anything that resizes them:
  // the window, the type size, a font arriving.
  const list = start.railEl.querySelector<HTMLElement>('.ds-rooms');
  const resize = typeof ResizeObserver === 'function' && list
    ? new ResizeObserver(() => { if (start.railEl.isConnected) syncStrip(start, true); })
    : null;
  if (resize && list) resize.observe(list);
  void document.fonts?.ready.then(() => { if (start.railEl.isConnected) syncStrip(start, true); });
  // The cue at each end with rooms past it follows a swipe, a drag, a keyed room
  // and a room joining the strip. The nav is the cue's host: it does not scroll.
  const stopCue = list ? watchScrollCue(list, start.railEl) : null;
  const prev = start.unsubBar;
  start.unsubBar = () => { prev?.(); start.railEl.removeEventListener('keydown', onKey); stopCue?.(); resize?.disconnect(); };
}

export function barOps(start: StartCtx) {
  return {
    overflowItems: bindOp(start, overflowItems),
    wireMoreMenu: bindOp(start, wireMoreMenu),
    makeItems: bindOp(start, makeItems),
    wireMakeMenu: bindOp(start, wireMakeMenu),
    applyEmphasis: bindOp(start, applyEmphasis),
    syncStrip: bindOp(start, syncStrip),
    wireBar: bindOp(start, wireBar),
  };
}

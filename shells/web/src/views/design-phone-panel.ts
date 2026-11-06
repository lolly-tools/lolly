// SPDX-License-Identifier: MPL-2.0
/**
 * Design's inputs on a phone: the tool view's drop-down panel, holding the inspector and
 * the layers list as two tabs.
 *
 * Every regular tool on a phone keeps its inputs in a panel that drops from the top in
 * three stops, peek, half and full (lib/mobile-sheet.ts, the mobile block of
 * styles/parts/tool.css). This is that panel for Design, not a copy of it: the same
 * driver, the same hooks on `.tool-layout` (`--sheet-h`, `data-sheet`, `--peek-h`,
 * `is-sheet-dragging`), the same `.sheet-grip`, the same stops and settle. A fix to one
 * is a fix to both. Two things are Design's own:
 *
 *  - Where it hangs from. Design keeps its top bar, so the panel starts under it, which
 *    is the driver's `inset`. Its peek is the head strip: the two tabs and the name of
 *    what is selected, the part a tool's header plays.
 *  - What fills the panel. The inspector's and the navigator's own live elements move in, as
 *    they move into the control pane on a fold (views/design-split.ts), and move back out
 *    when the window leaves the phone layout. Nothing is rebuilt, so a scrolled list,
 *    a focused field and its caret survive (lib/keep-place.ts).
 *
 * Which tab shows, and whether the panel is open past its peek, is what the inspector's
 * and the navigator's own open states say: views/design-panels.ts keeps the two in step,
 * so the bottom bar's Inspect and Layer/Page buttons, the top bar's menu and the X in a
 * column all go on working unchanged.
 */
import { t } from '../i18n.ts';
import { keepPlace } from '../lib/keep-place.ts';
import { setupMobileSheet, type MobileSheetHandle, type SheetState } from '../lib/mobile-sheet.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';

export type PhoneTab = 'inspect' | 'layers';

export interface DesignPhonePanelOptions {
  /** The view's `.tool-layout`: it carries the sheet's CSS hooks, as it does for a tool. */
  layout: HTMLElement;
  /** The navigator's live `<aside>`, moved in for the panel's life. The inspector comes
   *  through `host`, from its own controller (design-inspector-float.ts `enterPhone`). */
  navigatorEl: HTMLElement;
  /** The person chose a tab, or dragged or tapped the panel open or shut. */
  onChange(state: { tab: PhoneTab; open: boolean }): void;
  /** The top of the canvas band moved (see `bandTop`). */
  onBand(): void;
}

export interface DesignPhonePanelHandle {
  el: HTMLElement;
  grip: HTMLButtonElement;
  /** Put the inspector's column in the panel (it is the first of the two). */
  host(inspectorEl: HTMLElement): void;
  /** Show a tab, opening the panel to half when it is at its peek. */
  show(tab: PhoneTab, opts?: { focus?: boolean }): void;
  /** Back to the peek. */
  collapse(opts?: { focus?: boolean }): void;
  isOpen(): boolean;
  tab(): PhoneTab;
  /**
   * Where the canvas band begins, in px from the top of the viewport: the panel's edge
   * plus the grip's reach over the canvas. At full the band stays where half left it,
   * because the canvas is behind the panel there, as a tool's preview is.
   */
  bandTop(): number;
  /** Refresh the selection's name in the head strip. */
  sync(): void;
  destroy(): void;
}

const NAMES = ['inspect', 'layers'] as const;
let panels = 0;

export function mountDesignPhonePanel(opts: DesignPhonePanelOptions): DesignPhonePanelHandle {
  const { layout, navigatorEl } = opts;
  const doc = layout.ownerDocument;
  const id = `design-phone-panel-${++panels}`;

  const el = doc.createElement('section');
  el.className = 'design-phone-panel';
  el.id = id;
  el.setAttribute('aria-label', t('Editing panel'));
  el.setAttribute('data-export-hide', '');
  el.setAttribute('data-live-hide', '');
  el.setAttribute('data-canvas-keys', 'off');

  // The head strip: the peek, and the panel's wide drag handle (the driver's guard lets a
  // press on a tab through as a tap).
  const head = doc.createElement('div');
  head.className = 'dpp-head';
  const tabs = doc.createElement('div');
  tabs.className = 'lp-rail dpp-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', t('Editing panel'));
  const nameEl = doc.createElement('span');
  nameEl.className = 'dpp-name';
  head.append(tabs, nameEl);

  const body = doc.createElement('div');
  body.className = 'dpp-body';
  body.setAttribute('role', 'tabpanel');
  el.append(head, body);

  const tabBtn: Record<PhoneTab, HTMLButtonElement> = {} as Record<PhoneTab, HTMLButtonElement>;
  for (const name of NAMES) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.id = `${id}-${name}`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', id);
    b.dataset.tab = name;
    // The bottom bar's own words, so a person sees the same name for the same thing.
    b.textContent = name === 'inspect' ? t('Inspect') : t('Layer/Page');
    b.addEventListener('click', () => {
      // A tab says what the panel shows. Choosing one opens the panel when the panel is at
      // its peek; choosing the one already shown leaves the panel as it is.
      if (current === name && isOpen()) return;
      opts.onChange({ tab: name, open: true });
    });
    tabBtn[name] = b;
    tabs.append(b);
  }
  // Arrow keys move between the two tabs (the APG tab pattern), Home and End too.
  tabs.addEventListener('keydown', (e) => {
    const at = NAMES.indexOf((doc.activeElement as HTMLElement | null)?.dataset.tab as PhoneTab);
    if (at < 0) return;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (at + 1) % NAMES.length
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (at + NAMES.length - 1) % NAMES.length
        : e.key === 'Home' ? 0 : e.key === 'End' ? NAMES.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    tabBtn[NAMES[next]!].focus();
    tabBtn[NAMES[next]!].click();
  });

  // The grip: the tool view's own `.sheet-grip`, a sibling of the panel on the layout so
  // the panel's clip never crops it, with the tool view's words.
  const grip = doc.createElement('button');
  grip.type = 'button';
  grip.className = 'sheet-grip';
  grip.setAttribute('aria-label', t('Drag to resize controls, tap to expand'));
  grip.setAttribute('aria-controls', id);
  grip.setAttribute('data-export-hide', '');
  grip.setAttribute('data-live-hide', '');

  // Where the navigator came from (the stage), so it goes back there.
  const home = { parent: navigatorEl.parentElement, next: navigatorEl.nextSibling };
  keepPlace([navigatorEl], () => { body.append(navigatorEl); });
  // A still box at the sheet's origin, as tall as the half stop: the stylesheet's own
  // answer to where the panel's edge goes, read without waiting for a settle.
  const probe = doc.createElement('div');
  probe.className = 'dpp-probe';
  probe.setAttribute('aria-hidden', 'true');
  layout.append(el, grip, probe);

  let current: PhoneTab = 'inspect';
  let snap: SheetState = 'peek';
  let band = 0;
  let bandTimer = 0;
  let invoker: HTMLElement | null = null;
  let destroyed = false;
  // Set while this module moves the sheet itself, so only a person's drag or tap is
  // reported back as a change.
  let quiet = false;

  const headHeight = (): number => head.getBoundingClientRect().height;
  /** Where the stops are measured from: the top of the visible area, below the notch. */
  const origin = (): number => probe.getBoundingClientRect().top;
  /** The bar the panel hangs from, as the driver's inset: the panel's top less the origin. */
  const inset = (): number => Math.max(0, el.getBoundingClientRect().top - origin());
  const isOpen = (): boolean => snap !== 'peek';
  /** The band's top for a stop, without waiting for the settle: the panel's edge. The
   *  grip's short reach over the canvas lies inside the gutter the fit leaves anyway. */
  const bandFor = (s: SheetState): number =>
    Math.round(origin() + (s === 'peek' ? inset() + headHeight() : probe.getBoundingClientRect().height));
  // A band that shrinks moves now, so the canvas steps out of the way as the panel comes
  // down. One that grows waits for the panel to finish going up, as a tool's preview
  // waits for its peek, so the canvas never slides under a panel still on its way.
  const setBand = (next: number): void => {
    if (bandTimer) { clearTimeout(bandTimer); bandTimer = 0; }
    if (next === band) return;
    if (next > band || !band) { band = next; opts.onBand(); return; }
    bandTimer = window.setTimeout(() => { bandTimer = 0; if (!destroyed) { band = next; opts.onBand(); } }, prefersReducedMotion() ? 0 : 360);
  };

  const paintTabs = (): void => {
    for (const name of NAMES) {
      const on = name === current;
      tabBtn[name].setAttribute('aria-selected', String(on));
      tabBtn[name].tabIndex = on ? 0 : -1;
    }
    body.setAttribute('aria-labelledby', tabBtn[current].id);
    // The stylesheet shows the one element the tab names (parts/design-inspector.css).
    el.dataset.tab = current;
  };

  const sheet: MobileSheetHandle = setupMobileSheet(layout, el, grip, {
    initial: 'peek',
    names: { headerSel: '.dpp-head' },
    inset,
    onChange: (s) => {
      if (!s || destroyed) return;   // a drag move: the panel follows the finger, nothing else does
      const was = snap;
      snap = s;
      el.dataset.snap = s;
      setBand(bandFor(s === 'full' ? 'half' : s));
      if (!quiet && (was === 'peek') !== (s === 'peek')) opts.onChange({ tab: current, open: s !== 'peek' });
    },
  });
  el.dataset.snap = snap;
  paintTabs();

  // The selection's name, mirrored from the inspector's own title, which the panel's head
  // strip shows in place of the inspector's head.
  let titleEl: HTMLElement | null = null;
  const sync = (): void => {
    const name = (titleEl?.textContent ?? '').trim();
    if (nameEl.textContent !== name) nameEl.textContent = name;
    sheet.refresh();
  };
  const titleWatch = typeof MutationObserver === 'function' ? new MutationObserver(sync) : null;
  const host = (inspectorEl: HTMLElement): void => {
    if (destroyed) return;
    if (inspectorEl.parentElement !== body) keepPlace([inspectorEl], () => { body.prepend(inspectorEl); });
    const next = inspectorEl.querySelector<HTMLElement>('.fc-insp-coltitle');
    if (next !== titleEl) {
      titleWatch?.disconnect();
      titleEl = next;
      if (titleEl) titleWatch?.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
    sync();
  };

  // Escape folds the panel back to its peek, the way it closes any open panel, and hands
  // focus back. A menu, a picker or a dialog open over it is the inner surface and closes
  // first: each of those stops the key itself, and this listener steps aside while one is up.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || e.defaultPrevented || !isOpen() || destroyed) return;
    if (doc.querySelector('dialog[open], .color-popover:not([hidden]), .fc-popover, .fc-panel, .dtb-menu')) return;
    e.preventDefault();
    e.stopPropagation();
    collapse({ focus: true });
    opts.onChange({ tab: current, open: false });
  };
  doc.addEventListener('keydown', onKey);

  function show(tab: PhoneTab, o: { focus?: boolean } = {}): void {
    if (destroyed) return;
    const opening = !isOpen();
    if (tab !== current) { current = tab; paintTabs(); }
    if (opening) {
      const active = doc.activeElement as HTMLElement | null;
      invoker = active && !el.contains(active) ? active : null;
      quiet = true;
      try { sheet.setState('half'); } finally { quiet = false; }
    }
    sync();
    // Focus moves into the panel, onto the tab for what opened, so the keyboard is where
    // the panel is and Escape brings focus back.
    if (o.focus) tabBtn[current].focus({ preventScroll: true });
  }

  function collapse(o: { focus?: boolean } = {}): void {
    if (destroyed || !isOpen()) return;
    const hadFocus = el.contains(doc.activeElement);
    quiet = true;
    try { sheet.setState('peek'); } finally { quiet = false; }
    if (!o.focus && !hadFocus) return;
    // Back to what opened the panel when it is still there, otherwise to the tab, which
    // the peek keeps on screen.
    const back = invoker?.isConnected && !invoker.closest('[hidden]') ? invoker : tabBtn[current];
    invoker = null;
    back.focus({ preventScroll: true });
  }

  // The first band, once the strip has been measured.
  band = bandFor('peek');

  return {
    el, grip, host, show, collapse, isOpen,
    tab: () => current,
    bandTop: () => band,
    sync,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      if (bandTimer) clearTimeout(bandTimer);
      doc.removeEventListener('keydown', onKey);
      titleWatch?.disconnect();
      sheet.teardown();
      // The navigator goes home unless something else (a fold's control pane) has already
      // taken the list. The inspector is its controller's to place (leavePhone).
      if (navigatorEl.parentElement === body && home.parent) {
        keepPlace([navigatorEl], () => {
          try { home.parent!.insertBefore(navigatorEl, home.next && home.next.parentNode === home.parent ? home.next : null); } catch { navigatorEl.remove(); }
        });
      }
      el.remove();
      grip.remove();
      probe.remove();
    },
  };
}

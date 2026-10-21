// SPDX-License-Identifier: MPL-2.0
/**
 * The design systems strip at the top of the Settings Design system tab: one
 * small cover per design system in this browser, in registry order, so a
 * person can see them side by side and switch with one press. The covers are
 * cover.ts thumbnails (64x44, the system's own ground, logo and colours), the
 * same component the Preferences rows use at a larger size.
 *
 * The strip is a toolbar of toggle buttons (the APG toolbar pattern): one tab
 * stop, the arrow keys move between the items and Home and End go to either
 * end, while Enter, Space or a press switches. The arrows never switch. Each
 * item's name is its visible label only; the cover and the counts beside it
 * are hidden from assistive technology, and the counts are reached as the
 * item's description, so the name stays the same while aria-pressed changes.
 *
 * A switch happens in place (switch-undo.ts with noRemount), so the focus and
 * a screen reader's position survive the switch. The tab's design-system-changed
 * listener (views/dashboard/brand.ts) repaints the issue and calls refresh()
 * here, which keeps the covers already read and reads again only the two
 * systems that changed. Only a switch that moved the instance base remounts
 * the view, because the catalogue and its counts followed the base; the new
 * strip then takes the focus back once. While a switch runs, every item reads
 * as unavailable through aria-disabled, never disabled, so the focus stays.
 *
 * The strip is left out entirely when fewer than two design systems are here.
 */
import { tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { icon } from '../icons.ts';
import { prefersReducedMotion } from '../a11y-prefs.ts';
import { coverHtml, wireCoverImages, type CoverPreview } from './cover.ts';
import { readDesignSystemPreview, type DesignSystemPreview, type PreviewHost } from './preview.ts';
import type { DesignSystemRecord } from './registry.ts';
import type { SwitchHost, SwitchOptions } from './switch.ts';
import { switchWithUndo } from './switch-undo.ts';

/** What the strip reads and switches with: the registry, and assets for the covers. */
export type StripHost = SwitchHost & PreviewHost;

export interface DsStripOptions {
  /** The active system's id. */
  activeId: string;
  /** The active system's cover, drawn from what the tab already read, so the strip reads it no second time. */
  activeCover?: CoverPreview;
  /** The visible design systems, when the caller already holds them; otherwise the strip asks the registry. */
  records?: readonly DesignSystemRecord[];
  /** Injected for tests: the base write and the catalogue resync of a hosted switch (switch.ts). */
  switchOptions?: Pick<SwitchOptions, 'setBase' | 'resync'>;
}

export interface DsStrip {
  /** Redraw after a switch. The covers already read stay; the outgoing and incoming systems are read again. */
  refresh(activeId: string, activeCover?: CoverPreview, records?: readonly DesignSystemRecord[]): Promise<void>;
  /** Swap one item's cover in place (the active system's logo files arrive after first paint). */
  setCover(id: string, cover: CoverPreview): void;
  /** Settles once every cover of the latest draw has been read. */
  settled(): Promise<void>;
  teardown(): void;
}

/** Previews read at a time, as the Preferences card and the look library read them. */
const BATCH = 4;

/** The item a remounted strip focuses once: the system a switch that moved the base chose. */
let pendingFocusId: string | null = null;
/** A distinct id prefix per mounted strip, so two strips never share a label id while a view remounts. */
let mounts = 0;

const PENDING = '<span class="ds-cover ds-cover--thumb is-pending" aria-hidden="true"></span>';

const previewKey = (r: DesignSystemRecord): string => `${r.id}|${r.headId}`;
const hasLogos = (p: CoverPreview | undefined): boolean => !!p && Object.values(p.logos ?? {}).some(Boolean);

/** The counts under a name: colours, colourways when there is a choice, and Read-only. */
function subLine(r: DesignSystemRecord, cover: CoverPreview | null): string {
  const parts: string[] = [];
  if (cover) {
    const n = cover.colorCount ?? cover.colors.length;
    parts.push(n === 1 ? tRaw('{n} colour', { n }) : tRaw('{n} colours', { n }));
    const ways = cover.colourways ?? 0;
    if (ways >= 2) parts.push(tRaw('{n} colourways', { n: ways }));
  }
  if (r.locked) parts.push(tRaw('Read-only'));
  return parts.join(' · ');
}

/**
 * One item. The check is in every item and the sheet shows it on the pressed
 * one only, so a switch moves it by changing aria-pressed alone.
 */
function itemHtml(r: DesignSystemRecord, active: boolean, cover: CoverPreview | null, subId: string, busy: boolean): string {
  return `<button type="button" class="ds-strip-item" data-ds-id="${escapeText(r.id)}" aria-pressed="${active}" tabindex="${active ? 0 : -1}" aria-describedby="${subId}"${busy ? ' aria-disabled="true"' : ''}>`
    + (cover ? coverHtml(cover, 'thumb', { active }) : PENDING)
    + `<span class="ds-strip-name"><span class="ds-strip-label">${escapeText(r.label)}</span>${icon('check', { size: 14, className: 'ds-strip-check' })}</span>`
    + `<span class="ds-strip-sub" id="${subId}" aria-hidden="true">${escapeText(subLine(r, cover))}</span>`
    + '</button>';
}

/** Mount the strip into `el` (the tab's `[data-ds-strip]` slot). */
export function mountDsStrip(el: HTMLElement, host: StripHost, opts: DsStripOptions): DsStrip {
  const prefix = `ds-strip-${++mounts}`;
  const cache = new Map<string, Promise<DesignSystemPreview>>();
  /** Previews that have arrived, by `${id}|${headId}`. */
  const fresh = new Map<string, DesignSystemPreview>();
  /** The cover each item last showed, kept on screen while its system is read again. */
  const shown = new Map<string, CoverPreview>();
  const byId = new Map<string, DesignSystemRecord>();
  let activeId = opts.activeId;
  let activeCover = opts.activeCover;
  let gen = 0;
  let live = true;
  let busy = false;
  let firstDraw = true;
  let lastDraw: Promise<void> = Promise.resolve();
  let bar: HTMLElement | null = null;
  let statusEl: HTMLElement | null = null;

  const itemsOf = (): HTMLElement[] => bar ? [...bar.querySelectorAll<HTMLElement>('.ds-strip-item')] : [];
  const itemFor = (id: string): HTMLElement | undefined => itemsOf().find(item => item.dataset.dsId === id);
  const pressed = (): HTMLElement | undefined => itemsOf().find(item => item.getAttribute('aria-pressed') === 'true');
  const say = (text: string): void => { if (statusEl) statusEl.textContent = text; };

  /** One tab stop: the item that has (or last had) the focus, else the pressed one. */
  const setRoving = (target: HTMLElement | undefined): void => {
    const items = itemsOf();
    const stop = target ?? pressed() ?? items[0];
    for (const item of items) item.tabIndex = item === stop ? 0 : -1;
  };

  const focusItem = (item: HTMLElement, scroll: boolean): void => {
    setRoving(item);
    item.focus({ preventScroll: true });
    if (scroll && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };

  const setPressed = (id: string): void => {
    for (const item of itemsOf()) item.setAttribute('aria-pressed', String(item.dataset.dsId === id));
    if (!bar?.contains(document.activeElement)) setRoving(undefined);
  };

  const setBusy = (on: boolean): void => {
    busy = on;
    if (on) bar?.setAttribute('aria-busy', 'true');
    else bar?.removeAttribute('aria-busy');
    for (const item of itemsOf()) {
      if (on) item.setAttribute('aria-disabled', 'true');
      else item.removeAttribute('aria-disabled');
    }
  };

  /** Put one cover in place of the item's current one, and its counts under the name. */
  const swap = (id: string, cover: CoverPreview): void => {
    const item = itemFor(id);
    const record = byId.get(id);
    const current = item?.querySelector<HTMLElement>('.ds-cover');
    if (!item || !record || !current) return;
    current.outerHTML = coverHtml(cover, 'thumb', { active: id === activeId });
    wireCoverImages(item);
    const sub = item.querySelector<HTMLElement>('.ds-strip-sub');
    if (sub) sub.textContent = subLine(record, cover);
    shown.set(id, cover);
  };

  // ── Keyboard, press and focus (the APG toolbar) ──
  const onKey = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const items = itemsOf();
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0 || !bar) return;
    const rtl = getComputedStyle(bar).direction === 'rtl';
    let next: number;
    if (e.key === 'ArrowRight') next = rtl ? at - 1 : at + 1;
    else if (e.key === 'ArrowLeft') next = rtl ? at + 1 : at - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else return;
    e.preventDefault();
    const item = items[(next + items.length) % items.length];
    if (item) focusItem(item, true);
  };

  const onFocusIn = (event: Event): void => {
    const item = (event.target as Element | null)?.closest<HTMLElement>('.ds-strip-item');
    if (item && bar?.contains(item)) setRoving(item);
  };

  const onFocusOut = (event: Event): void => {
    const next = (event as FocusEvent).relatedTarget as Node | null;
    if (!next || !bar?.contains(next)) setRoving(undefined);
  };

  const activate = async (item: HTMLElement): Promise<void> => {
    const id = item.dataset.dsId ?? '';
    if (busy || !id || item.getAttribute('aria-pressed') === 'true') return;
    const focusWasInStrip = !!bar?.contains(document.activeElement);
    setBusy(true);
    say(tRaw('Loading design system…'));
    let failed = false;
    let chosen = id;
    try {
      const result = await switchWithUndo(host, id, { ...opts.switchOptions, noRemount: true });
      chosen = result.record.id;
      if (live) setPressed(chosen);
      if (result.baseChanged) {
        // A hosted record moved the instance base and the catalogue resynced, so
        // the Activity counts on this view are stale: remount, and the new strip
        // takes the focus back once.
        pendingFocusId = chosen;
        window.dispatchEvent(new Event('lolly:remount'));
      }
    } catch (error) {
      failed = true;
      say(error instanceof Error && error.message ? error.message : tRaw('Could not complete this action. Please try again.'));
    } finally {
      setBusy(false);
      if (!failed) {
        say('');
        if (live && el.isConnected && (focusWasInStrip || document.activeElement === document.body)) {
          const target = itemFor(chosen);
          if (target) focusItem(target, false);
        }
      }
    }
  };

  const onClick = (event: Event): void => {
    if (event.defaultPrevented) return;
    const item = (event.target as Element | null)?.closest<HTMLElement>('.ds-strip-item');
    if (item && bar?.contains(item)) void activate(item);
  };

  /** The title, the Manage link, the toolbar and the status line, built once per showing. */
  const scaffold = (): HTMLElement => {
    if (bar && el.contains(bar)) return bar;
    const title = document.createElement('p');
    title.className = 'ds-strip-title';
    title.id = `${prefix}-title`;
    title.textContent = tRaw('Design systems');
    const manage = document.createElement('a');
    manage.className = 'ds-strip-manage';
    manage.href = '#/settings?focus=design-systems-section';
    manage.textContent = tRaw('Manage');
    const toolbar = document.createElement('div');
    toolbar.className = 'ds-strip-items';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-labelledby', title.id);
    const status = document.createElement('p');
    status.className = 'visually-hidden';
    status.setAttribute('role', 'status');
    status.setAttribute('data-ds-strip-status', '');
    el.replaceChildren(title, manage, toolbar, status);
    toolbar.addEventListener('click', onClick);
    toolbar.addEventListener('keydown', onKey);
    toolbar.addEventListener('focusin', onFocusIn);
    toolbar.addEventListener('focusout', onFocusOut);
    bar = toolbar;
    statusEl = status;
    return toolbar;
  };

  const unscaffold = (): void => {
    bar?.removeEventListener('click', onClick);
    bar?.removeEventListener('keydown', onKey);
    bar?.removeEventListener('focusin', onFocusIn);
    bar?.removeEventListener('focusout', onFocusOut);
    bar = null;
    statusEl = null;
  };

  /**
   * Draw the items now, names first: a cover already read shows at once, and
   * any other item holds a plain plate of the same size until its preview
   * arrives, so nothing shifts. Resolves when every preview has settled.
   */
  const draw = (records: readonly DesignSystemRecord[]): Promise<void> => {
    const my = ++gen;
    // A remount's first draw takes the focus once, whether or not the strip shows.
    const focusOnce = firstDraw ? pendingFocusId : null;
    if (firstDraw) { firstDraw = false; pendingFocusId = null; }
    delete el.dataset.ready;
    byId.clear();
    for (const r of records) byId.set(r.id, r);
    if (records.length < 2) {
      unscaffold();
      el.replaceChildren();
      el.hidden = true;
      return Promise.resolve();
    }
    const toolbar = scaffold();
    el.hidden = false;
    const focused = toolbar.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.dsId : undefined;
    const waiting: DesignSystemRecord[] = [];
    toolbar.innerHTML = records.map((r, i) => {
      const active = r.id === activeId;
      let cover: CoverPreview | null;
      if (active) cover = activeCover ?? shown.get(r.id) ?? null;
      else {
        cover = fresh.get(previewKey(r)) ?? shown.get(r.id) ?? null;
        if (!fresh.has(previewKey(r))) waiting.push(r);
      }
      if (cover) shown.set(r.id, cover);
      return itemHtml(r, active, cover, `${prefix}-d-${i}`, busy);
    }).join('');
    wireCoverImages(toolbar);
    if (!pressed()) setRoving(undefined);
    const keep = focused ? itemFor(focused) : undefined;
    if (keep) focusItem(keep, false);
    const target = focusOnce ? itemFor(focusOnce) : undefined;
    if (target) focusItem(target, true);
    const reads = (async (): Promise<void> => {
      for (let at = 0; at < waiting.length; at += BATCH) {
        await Promise.allSettled(waiting.slice(at, at + BATCH).map(r => readDesignSystemPreview(host, r, cache).then(preview => {
          fresh.set(previewKey(r), preview);
          if (live && my === gen && r.id !== activeId) swap(r.id, preview);
        })));
        if (!live || my !== gen) return;
      }
      if (live && my === gen) el.dataset.ready = '1';
    })();
    lastDraw = reads;
    return reads;
  };

  /** Forget what was read for one system, so its next draw reads its head again. */
  const forget = (id: string): void => {
    for (const store of [cache, fresh]) {
      for (const key of [...store.keys()]) {
        if (key.startsWith(`${id}|`)) store.delete(key);
      }
    }
  };

  const listOf = async (records?: readonly DesignSystemRecord[]): Promise<readonly DesignSystemRecord[]> => {
    if (records) return records;
    try { return await host.designSystems?.visible?.() ?? []; } catch { return []; }
  };

  /** A refreshed active cover with no logo files yet keeps the logos the item already shows. */
  const withShownLogos = (id: string, cover: CoverPreview | undefined): CoverPreview | undefined => {
    const last = shown.get(id);
    if (!cover || hasLogos(cover) || !hasLogos(last)) return cover;
    return { ...cover, logos: last!.logos, monogram: last!.monogram || cover.monogram };
  };

  const refresh = (nextId: string, nextCover?: CoverPreview, records?: readonly DesignSystemRecord[]): Promise<void> => {
    if (!live) return Promise.resolve();
    forget(activeId);
    forget(nextId);
    activeId = nextId;
    activeCover = withShownLogos(nextId, nextCover);
    const my = ++gen;
    const run = (async (): Promise<void> => {
      const list = await listOf(records);
      if (live && my === gen) await draw(list);
    })();
    lastDraw = run;
    return run;
  };

  if (opts.records) void draw(opts.records);
  else {
    const my = gen;
    lastDraw = listOf().then(list => (live && my === gen ? draw(list) : undefined));
  }

  return {
    refresh,
    setCover(id: string, cover: CoverPreview): void {
      if (!live) return;
      if (id === activeId) activeCover = cover;
      shown.set(id, cover);
      swap(id, cover);
    },
    settled: () => lastDraw,
    teardown(): void {
      live = false;
      gen++;
      unscaffold();
    },
  };
}

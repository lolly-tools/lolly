// SPDX-License-Identifier: MPL-2.0
/**
 * The spotlight overlay (plans/99 M2) - grouped cross-domain search results in
 * a panel above the persistent bottom bar. Typing in the bar (or the ⌘/⌃Space
 * chord) surfaces hits from every registered provider (lib/search/registry.ts),
 * grouped in fixed presentation order; the view behind keeps live-filtering on
 * the live-adapt routes and stays untouched on the overlay-only ones (section 2a).
 *
 * Anatomy and the rules that shaped it:
 *  - BODY-MOUNTED, never a child of the footer: `.gallery-footer` has a
 *    backdrop-filter, which makes it the containing block for fixed
 *    descendants (the repo's fixed-popover trap - same reason body-popover.ts
 *    exists). Positioned above the footer from its live height plus the same
 *    --vv-bottom inset the footer itself rides (pinch-zoom pan, soft
 *    keyboard), recomputed on open and on window/visualViewport changes.
 *  - Focus STAYS in the bar's field the whole time - the panel is never
 *    focused. ARIA combobox pattern (lifted from pro/index.ts's template
 *    picker): the field carries role=combobox/aria-expanded and points its
 *    aria-activedescendant at the active row; pointerdown on the panel is
 *    preventDefault'ed so a click can't steal focus before it activates.
 *  - Hits NAVIGATE, never mutate (plans/99 principle 3). Activation goes
 *    through an injectable seam (spotlightSeams) because jsdom's
 *    location.assign throws; ⌘/Ctrl opens a new tab, matching the jelly nav
 *    handler's modifier convention. Rows carry data-sfx="navigate" so the
 *    app-wide delegated cue layer (lib/sfx.ts) sounds a click activation like
 *    any footer link.
 *  - Own-domain lead (section 2a): the current route's group is HOISTED to the top of
 *    the panel with the larger cap and BRAND-HIGHLIGHTED, so the view you're on
 *    is always discoverable in the overlay even when the panel overlaps the
 *    live-filtered cards behind it; routes with no domain show every group at
 *    the standard cap. (Was: live-adapt views omitted their own group and leaned
 *    on the cards behind - which the panel can occlude.)
 *  - Providers load LAZILY (a dynamic import in initSpotlight): the provider
 *    modules pull in per-view haystack code that has no business in the boot
 *    chunk main.ts pays for - same reason the views themselves lazy-load.
 */
import { t } from '../i18n.ts';
import { escape, safeHref } from '../utils.ts';
import { fold, tokenize } from '../lib/search/match.ts';
import {
  GROUP_ORDER, GROUP_LABELS, GROUP_SEE_ALL, GROUP_CAP, OWN_GROUP_CAP,
  MIN_QUERY_LENGTH, ROUTE_DOMAIN, searchProviders,
  type SearchGroupId, type SearchHit, type SearchProvider,
} from '../lib/search/registry.ts';
import {
  registerSpotlightHook, setSearchBarExpanded, currentSearchRoute, SPOTLIGHT_LISTBOX_ID,
  type SpotlightHook,
} from './search-bar.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { computeViewportInsets } from '../lib/viewport-insets.ts';

const LISTBOX_ID = SPOTLIGHT_LISTBOX_ID;

/**
 * Injectable seams - module-level and mutable ON PURPOSE (the registry's
 * resetProviders() convention): jsdom's location.assign throws, window.open is
 * inert there, and the provider modules land from a separate lazy chunk, so
 * spotlight.test.ts swaps all three.
 */
export const spotlightSeams = {
  /** In-app hashes set location.hash; docs pages ('/info/…') are real
   *  navigations, so they go through location.assign. */
  navigate(href: string): void {
    if (href.startsWith('/info')) location.assign(href);
    else location.hash = href;
  },
  openTab(href: string): void {
    window.open(href, '_blank', 'noopener');
  },
  /** The default provider set, loaded lazily (see the module doc). */
  loadProviders(host: unknown): Promise<void> {
    return import('../lib/search/providers/index.ts').then((m) => m.registerDefaultProviders(host));
  },
};

let inited = false;
let panelEl: HTMLElement | null = null;
let isOpen = false;
let activeIndex = -1;
// Monotonic query id - a resolution for a superseded query (or one arriving
// after close bumped the id) is discarded, so a slow provider can never paint
// stale rows over fresh ones.
let queryId = 0;
// The last raw text the bar handed us - replayed once when the lazily-loaded
// provider chunk lands, so an early query can't strand a false "No matches".
let lastRaw: string | null = null;

const listEl = (): HTMLElement | null => panelEl?.querySelector<HTMLElement>('.spotlight-list') ?? null;
const statusEl = (): HTMLElement | null => panelEl?.querySelector<HTMLElement>('.spotlight-status') ?? null;
const rowEls = (): HTMLElement[] => (panelEl ? [...panelEl.querySelectorAll<HTMLElement>('.spotlight-opt')] : []);

/** Build the panel scaffold once (DOM API - the only raw-HTML sink in this
 *  module is the result-list render below). */
function ensurePanel(): HTMLElement {
  if (panelEl) return panelEl;
  const panel = document.createElement('div');
  panel.className = 'spotlight-panel';
  panel.hidden = true;
  const list = document.createElement('div');
  list.className = 'spotlight-list';
  list.id = LISTBOX_ID;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', t('Search results'));
  const status = document.createElement('p');
  status.className = 'spotlight-status visually-hidden';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  panel.append(list, status);
  // Focus must never leave the field: cancel the focus-moving default of a
  // press inside the panel (pointer AND the compat mouse event, for browsers
  // that only honour one).
  panel.addEventListener('pointerdown', (e) => e.preventDefault());
  panel.addEventListener('mousedown', (e) => e.preventDefault());
  panel.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest?.<HTMLElement>('.spotlight-opt');
    if (!row) return;
    e.preventDefault();
    activate(row, e.metaKey || e.ctrlKey);
  });
  document.body.appendChild(panel);
  panelEl = panel;
  return panel;
}

/** Anchor the panel just above the live footer bar (bottom-up, plans/99 section 2d). */
function position(): void {
  const panel = ensurePanel();
  const footer = document.querySelector<HTMLElement>('footer.gallery-footer');
  const rect = footer && !footer.hidden ? footer.getBoundingClientRect() : null;
  const vv = window.visualViewport;
  // The panel is fixed, so its `bottom` resolves against the LAYOUT viewport -
  // which a soft keyboard (or a pinch-zoom pan) does not move. Lift it by the
  // same inset the footer rides on --vv-bottom, so the two stay one unit
  // whether the visible area's bottom edge is the layout edge or a keyboard.
  // Computed rather than read off the footer's live rect: the visualViewport
  // resize that brings us here can run before main.ts's rAF has moved the
  // footer, and then its rect is a frame stale while this number is not.
  const lift = vv ? computeViewportInsets({
    scale: vv.scale,
    innerHeight: window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    vvWidth: vv.width,
    vvHeight: vv.height,
    offsetTop: vv.offsetTop,
    offsetLeft: vv.offsetLeft,
  }).bottom : 0;
  const bottom = rect ? lift + Math.round(rect.height) + 8 : lift + 16;
  panel.style.bottom = `${bottom}px`;
  // Never taller than the space above the footer (the CSS max-height caps the
  // comfortable size; this caps the physical fit on short viewports - and the
  // visible height, not the layout one, is what a keyboard leaves).
  const headroom = (vv ? vv.height : window.innerHeight) - (rect ? rect.height : 0) - 32;
  panel.style.maxHeight = `${Math.max(160, Math.round(headroom))}px`;
}

const reposition = (): void => { if (isOpen) position(); };

/** Dismiss on any press outside the panel and outside the footer (the field,
 *  its ✕ and the nav links live there - their own handlers decide). */
function onOutsidePointerDown(e: Event): void {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (panelEl?.contains(target)) return;
  if (target.closest?.('footer.gallery-footer')) return;
  close();
}

function installWhileOpen(): void {
  document.addEventListener('pointerdown', onOutsidePointerDown, true);
  window.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('scroll', reposition);
}

function removeWhileOpen(): void {
  document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  window.removeEventListener('resize', reposition);
  window.visualViewport?.removeEventListener('resize', reposition);
  window.visualViewport?.removeEventListener('scroll', reposition);
}

function open(): void {
  const panel = ensurePanel();
  position();
  if (isOpen) return;
  isOpen = true;
  panel.hidden = false;
  // Entry motion is JS-gated on prefersReducedMotion() (OS media query OR the
  // app's a11y pref - the shared read every JS-driven animation site uses).
  panel.classList.remove('spotlight-anim');
  if (!prefersReducedMotion()) panel.classList.add('spotlight-anim');
  installWhileOpen();
  setSearchBarExpanded(true, null);
}

function close(): void {
  if (!isOpen) {
    // Never opened (or already closed) - still invalidate any in-flight query
    // so a pending resolution can't open the panel after the fact.
    queryId++;
    return;
  }
  isOpen = false;
  activeIndex = -1;
  queryId++;
  if (panelEl) panelEl.hidden = true;
  removeWhileOpen();
  setSearchBarExpanded(false, null);
}

/** Move aria-activedescendant + the active class to `index` (-1 = none). */
function setActive(index: number): void {
  activeIndex = index;
  const rows = rowEls();
  rows.forEach((el, i) => {
    el.classList.toggle('is-active', i === index);
    el.setAttribute('aria-selected', i === index ? 'true' : 'false');
  });
  const el = index >= 0 ? rows[index] : undefined;
  try { el?.scrollIntoView?.({ block: 'nearest' }); } catch { /* jsdom has no layout */ }
  setSearchBarExpanded(true, el?.id ?? null);
}

/** Arrow walk across ALL rows - hits and see-all rows alike - wrapping at both
 *  ends (plans/99 section 2d). */
function move(delta: 1 | -1): void {
  const rows = rowEls();
  if (!rows.length) return;
  const next = activeIndex < 0
    ? (delta > 0 ? 0 : rows.length - 1)
    : (activeIndex + delta + rows.length) % rows.length;
  setActive(next);
}

/** Navigate to a row's target and close. All hits navigate, none mutate. */
function activate(row: HTMLElement, newTab: boolean): void {
  const href = row.dataset.href;
  if (!href) return;
  if (newTab) {
    spotlightSeams.openTab(href);
    close();
    return;
  }
  // A same-route "See all in Projects" handoff (#/p → #/p?q=) needs no forcing:
  // the projects route signature carries ?q= (main.ts routeSignature), so the
  // hash change remounts on its own - and Back out of results mode does too.
  spotlightSeams.navigate(href);
  close();
}

/** One row of the listbox. `hit.icon` is provider-authored icon() markup (the
 *  SearchHit contract); title/subtitle are plain text, escape()d here.
 *  The href is scheme-gated by renderResults() (see navigableHits) - escape()
 *  neutralises quotes, not a `javascript:` scheme, and SearchProvider is an
 *  extension point, so the gate is at the paint boundary, not in the providers. */
function rowHtml(hit: SearchHit, n: number, gid: SearchGroupId, own: boolean): string {
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in renderResults() before this runs; a hit that fails it is dropped, never painted
  return `<div class="spotlight-opt${own ? ' spotlight-opt--own' : ''}" role="option" id="spotlight-opt-${n}" aria-selected="false" data-group="${gid}" data-href="${escape(hit.href)}" data-sfx="navigate">
    <span class="spotlight-opt-icon" aria-hidden="true">${hit.icon}</span>
    <span class="spotlight-opt-text">
      <span class="spotlight-opt-title">${escape(hit.title)}</span>${hit.subtitle ? `
      <span class="spotlight-opt-sub">${escape(hit.subtitle)}</span>` : ''}
    </span>
  </div>`;
}

function seeAllHtml(gid: SearchGroupId, href: string, n: number): string {
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in renderResults() before this runs; an unsafe see-all target drops the row
  return `<div class="spotlight-opt spotlight-see-all" role="option" id="spotlight-opt-${n}" aria-selected="false" data-href="${escape(href)}" data-sfx="navigate">
    <span class="spotlight-opt-title">${t('See all in {view}', { view: t(GROUP_LABELS[gid]) })}</span>
    <span class="spotlight-see-all-arrow" aria-hidden="true">→</span>
  </div>`;
}

/** The scheme gate for everything this module paints. A hit's href becomes a
 *  real navigation in activate() (location.assign / window.open), so a
 *  `javascript:` or `data:` target from a provider would be an XSS sink that
 *  escape() cannot see - escaping is not scheme validation (the invariant
 *  .github/opengrep/lolly-rules.yml encodes). Every shipped provider builds its
 *  href from a first-party literal prefix plus encodeURIComponent, so this drops
 *  nothing today; it holds the line for the next provider. */
function navigableHits(hits: readonly SearchHit[]): SearchHit[] {
  return hits.filter((h) => safeHref(h.href));
}

/** Paint one settled query's results and open the panel. */
function renderResults(order: readonly SearchGroupId[], hitsByGroup: ReadonlyMap<SearchGroupId, SearchHit[]>, trimmed: string, ownGroup?: SearchGroupId): void {
  ensurePanel();
  let html = '';
  let n = 0;
  let total = 0;
  for (const gid of order) {
    const hits = navigableHits(hitsByGroup.get(gid) ?? []);
    if (!hits.length) continue;
    const own = gid === ownGroup; // the current view's group - leads, brand-highlighted (section 2a)
    total += hits.length;
    html += `<div class="spotlight-group-label${own ? ' spotlight-group-label--own' : ''}" role="presentation">${t(GROUP_LABELS[gid])}</div>`;
    for (const hit of hits) html += rowHtml(hit, n++, gid, own);
    const seeAll = GROUP_SEE_ALL[gid];
    const seeAllHref = seeAll ? seeAll(trimmed) : '';
    if (seeAllHref && safeHref(seeAllHref)) html += seeAllHtml(gid, seeAllHref, n++);
  }
  if (!total) html = `<div class="spotlight-empty">${t('No matches for “{q}”', { q: trimmed })}</div>`;
  const list = listEl();
  // The module's one raw-HTML sink: every interpolation above is escape()d
  // (hrefs, titles, subtitles), a t() literal, a NUMBER (the row ids), or
  // provider-authored icon() markup per the SearchHit contract. Hrefs clear
  // safeHref() as well - escape()ing one is not scheme validation.
  if (list) list.innerHTML = html;
  const status = statusEl();
  if (status) status.textContent = total === 1 ? t('1 result') : t('{n} results', { n: total });
  activeIndex = -1;
  open();
  setSearchBarExpanded(true, null);
}

/** The debounced query path (also the chord's and a clear's entry point). */
function onQueryChanged(raw: string): void {
  lastRaw = raw;
  const trimmed = raw.trim();
  if (fold(trimmed).length < MIN_QUERY_LENGTH) {
    close();
    return;
  }
  const tokens = tokenize(trimmed);
  const own = ROUTE_DOMAIN[currentSearchRoute()];
  // section 2a: the current view's own group LEADS the panel - hoisted first with the
  // larger cap and brand-highlighted (renderResults marks it) - so its results
  // stay discoverable in the overlay even when the panel occludes the
  // live-filtered cards behind it. Applies to both tiers now; a live view still
  // filters its cards behind, an overlay one doesn't.
  let order: SearchGroupId[] = [...GROUP_ORDER];
  if (own) order = [own.group, ...order.filter((g) => g !== own.group)];
  const capFor = (gid: SearchGroupId): number =>
    own && gid === own.group ? OWN_GROUP_CAP : GROUP_CAP;
  const id = ++queryId;
  const provs = searchProviders().filter((p) => order.includes(p.id));
  const settle = async (p: SearchProvider): Promise<[SearchGroupId, SearchHit[]]> => {
    try {
      const hits = await p.search(tokens, capFor(p.id));
      // Defensive: cap and order even if a provider ignores its limit.
      return [p.id, [...hits].sort((a, b) => b.score - a.score).slice(0, capFor(p.id))];
    } catch {
      return [p.id, []];
    }
  };
  void Promise.all(provs.map(settle)).then((pairs) => {
    if (id !== queryId) return; // superseded (or closed) - discard, never paint
    renderResults(order, new Map(pairs), trimmed, own?.group);
  });
}

function onKeydown(e: KeyboardEvent): boolean {
  if (!isOpen) return false;
  if (e.key === 'ArrowDown') { move(1); return true; }
  if (e.key === 'ArrowUp') { move(-1); return true; }
  if (e.key === 'Enter') {
    const rows = rowEls();
    const row = rows[activeIndex >= 0 ? activeIndex : 0];
    if (row) activate(row, e.metaKey || e.ctrlKey);
    // Consumed even with no rows (the empty state): Enter aimed at an open
    // overlay must not leak into the view behind it.
    return true;
  }
  if (e.key === 'Escape') { close(); return true; }
  return false;
}

const hook: SpotlightHook = {
  onQueryChanged,
  onKeydown,
  onRouteChanged: () => close(),
};

/**
 * Boot the overlay: hook into the bar (replacing the boot shim's registration,
 * last-wins) and load the default provider set lazily. Reached through
 * components/spotlight-boot.ts, which owns the shim and hands back whatever the
 * user typed while this module was in flight as `pending` - re-run here so a
 * query is answered rather than swallowed, the same repair the provider race
 * below already makes.
 */
export function initSpotlight(host: unknown, pending?: string | null): void {
  if (inited) return;
  inited = true;
  registerSpotlightHook(hook, { listboxId: LISTBOX_ID });
  if (pending != null) onQueryChanged(pending);
  void Promise.resolve()
    .then(() => spotlightSeams.loadProviders(host))
    .then(() => {
      // A query typed while the provider chunk was still in flight ran against
      // an empty registry and painted a definitive "No matches". Re-run it now
      // the providers exist; onQueryChanged's id bump discards it if a newer
      // keystroke got there first, and a since-cleared field just closes again.
      if (lastRaw !== null) onQueryChanged(lastRaw);
    })
    .catch((err) => console.warn('[spotlight] providers failed to load', err));
}

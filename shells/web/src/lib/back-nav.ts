// SPDX-License-Identifier: MPL-2.0
/**
 * Previous-view tracking for back pills. A view like #/start is reached from
 * many places (a tool's "Manage fonts", the Dashboard hero CTA, the profile
 * menu, the welcome dialog), so a hardcoded "← Tools" pill both mislabels
 * where back goes and dumps the user in the gallery. This module remembers the
 * ONE view the user last left - its URL and a human name - so a back pill can
 * read "← QR Code" or "← Campaign assets" and actually return there.
 *
 * The router (main.ts navigate()) is the single writer:
 *   - noteLeavingHref() stashes the exact URL being left. hashchange hands the
 *     router its oldURL; navigateTo() (nav.ts) captures location.href before
 *     its pushState. popstate has no old URL - recordLeave() then falls back
 *     to the URL snapshotted at the outgoing view's mount.
 *   - recordLeave() commits the outgoing view as "previous" - called only on a
 *     genuine view change (the router skips same-view param navigations like
 *     #/start?tab=color → ?tab=type, and forced same-route remounts).
 *   - noteMountedView() snapshots the just-mounted view - its URL and label - 
 *     as the candidate for the NEXT recordLeave().
 *
 * Labels come from document.title (every routed view sets one, already
 * localised - e.g. the tool view's "{name} - Lolly", a Projects folder's
 * name), with the "· Lolly" / " - Lolly" suffix stripped; the gallery is
 * special-cased to t('Home') since its title is the bare product name - the same
 * word the no-previous-view fallback uses, so one destination has one name.
 *
 * sessionStorage-backed (same lifetime as the lolly:returnTo marker) so a
 * reload mid-studio keeps the pill honest; private-mode failures degrade to
 * the in-memory copy.
 */

import { t } from '../i18n.ts';

export interface PrevView {
  /** Origin-relative URL (pathname + search + hash) the pill navigates to. */
  href: string;
  /** Human name of that view, already localised - render escaped. */
  label: string;
}

const KEY = 'lolly:prevView';

let leavingHref: string | null = null;
let current: PrevView | null = null;   // the mounted view, candidate for the next record
let prev: PrevView | null = null;      // in-memory copy of what KEY holds
// Has THIS document performed a real in-app view change? Only then is there a
// history entry behind us that history.back() will land on. The persisted
// `prev` can't answer this: it survives a reload (and a reload starts a fresh
// document whose back entry is the pre-reload page, not the previous view), so
// a back pill that trusted `prev` alone would send a reloaded deep link
// somewhere it never came from. Deliberately NOT persisted.
let navigatedInDoc = false;

const toRelative = (url: string): string => {
  try {
    const u = new URL(url, window.location.href);
    return u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
};

/** Stash the exact URL a navigation is leaving (hashchange oldURL / navigateTo). */
export function noteLeavingHref(url: string): void {
  leavingHref = toRelative(url);
}

/** Consume the stash - the router takes it every navigation so a stale one
 *  can't leak into a later, unrelated record. */
export function takeLeavingHref(): string | null {
  const href = leavingHref;
  leavingHref = null;
  return href;
}

/** Commit the outgoing view as the previous one. `leftHref` (when the
 *  navigation source knew it) beats the mount-time snapshot - it carries any
 *  params the view wrote into its URL since mounting. */
export function recordLeave(leftHref?: string | null): void {
  if (!current) return; // first boot - keep whatever survived the reload
  prev = { href: leftHref || current.href, label: current.label };
  navigatedInDoc = true;
  try { sessionStorage.setItem(KEY, JSON.stringify(prev)); } catch { /* private mode */ }
}

/** True when this document has a real previous view sitting behind it in
 *  history - i.e. the user walked here through the app rather than opening the
 *  URL directly. Back pills use it to decide between history.back() (a genuine
 *  back step, which pops the entry instead of piling another one on) and a
 *  plain forward navigation to their fallback target. */
export function canGoBack(): boolean {
  return navigatedInDoc && window.history.length > 1;
}

/** Snapshot the just-mounted view. Call after the mount settles - the view has
 *  set its document.title and any URL canonicalisation (e.g. /t/<id>) is done. */
export function noteMountedView(routeName: string): void {
  current = { href: toRelative(window.location.href), label: labelFor(routeName) };
}

/** The view the user last left, or null on a fresh session. */
export function getPrevView(): PrevView | null {
  if (prev) return prev;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<PrevView>;
      if (typeof v.href === 'string' && v.href && typeof v.label === 'string' && v.label) {
        prev = { href: v.href, label: v.label };
      }
    }
  } catch { /* private mode / corrupt */ }
  return prev;
}

function labelFor(routeName: string): string {
  if (routeName === 'gallery') return t('Home');
  const stripped = document.title.replace(/\s*[-–·-]\s*Lolly$/u, '').trim();
  return stripped && stripped !== 'Lolly' ? stripped : t('Home');
}

// ── Where the reader opened the documentation from ─────────────────────────────
// A reader who opens the docs from a tool, Settings or a search wants that exact view
// back when they are done, however many doc pages they read in between. The back pill
// above shows only the view just left, so after one hop from page to page it showed the
// previous page and the way back to the work was gone. Both docs readers keep the
// origin for this tab instead (sessionStorage: same tab, same origin, never sent
// anywhere):
//   - the in-app reader (views/docs.ts) asks docsOrigin() at each mount: a non-docs
//     view just left becomes the origin, a docs page just left keeps the stored one;
//   - the static /info site cannot see the app's router, and the served pages carry
//     Referrer-Policy: no-referrer, so the app notes the view it is leaving when the
//     page goes away (rememberViewOnLeave, pagehide) and /info reads that note.

const DOCS_ORIGIN_KEY = 'lolly:docsOrigin';
/** Read by docs/build.ts's origin script on /info: keep the two names in step. */
export const LEFT_APP_KEY = 'lolly:leftApp';

/** True for the in-app docs reader's own routes (#/docs/…). */
export function isDocsHref(href: string): boolean {
  return /#\/docs(?:[/?]|$)/.test(href);
}

function readView(key: string): PrevView | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PrevView>;
    return typeof v.href === 'string' && v.href && typeof v.label === 'string' && v.label ? { href: v.href, label: v.label } : null;
  } catch { return null; }
}

/** The app view this tab opened the documentation from, or null when the docs were
 *  opened directly. Call from the docs reader's mount, after the router recorded the
 *  view it left. */
export function docsOrigin(): PrevView | null {
  const left = getPrevView();
  if (left && !isDocsHref(left.href)) {
    try { sessionStorage.setItem(DOCS_ORIGIN_KEY, JSON.stringify(left)); } catch { /* private mode */ }
    return left;
  }
  return readView(DOCS_ORIGIN_KEY);
}

let leaveMemoryInstalled = false;
/** Note the view this page shows when the tab leaves the app for another page (the
 *  static docs, most often), so /info can offer the way back to that view. Called once at
 *  boot; a note left by an earlier visit is cleared then, since this page is the app. */
export function rememberViewOnLeave(): void {
  if (leaveMemoryInstalled || typeof window === 'undefined') return;
  leaveMemoryInstalled = true;
  try { sessionStorage.removeItem(LEFT_APP_KEY); } catch { /* private mode */ }
  window.addEventListener('pagehide', () => {
    // Leaving from the docs reader: the way back is still the view the docs were
    // opened from, not the reader.
    // The live address, not the mount-time snapshot: a tool writes its state into the
    // URL as it is edited, and the way back should land on that state.
    const here = !current ? null
      : isDocsHref(current.href) ? readView(DOCS_ORIGIN_KEY)
      : { href: toRelative(window.location.href), label: current.label };
    try {
      if (here) sessionStorage.setItem(LEFT_APP_KEY, JSON.stringify(here));
      else sessionStorage.removeItem(LEFT_APP_KEY);
    } catch { /* private mode */ }
  });
}

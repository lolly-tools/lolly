// SPDX-License-Identifier: MPL-2.0
/**
 * The persistent bottom search bar - a shell-level SINGLETON (plans/99 M1).
 *
 * One footer (the shared footerNav chrome: [Pro?] [Dashboard] <search> [Verify]
 * [What?]) mounted ONCE at boot as a sibling after #view, shown on browse routes
 * (RouteSpec.footer === 'search' in main.ts's ROUTES) and hidden on editing
 * routes. Views no longer render or wire their own footer: a view CLAIMS the bar
 * on mount - placeholder, initial value, an optional live-filter tap - and
 * releases the claim from its _cleanup. Unclaimed routes (dashboard, profile)
 * get the global default placeholder; their queries go to the spotlight overlay
 * (M2), never to the view behind (plans/99 section 2a).
 *
 * The invariant that matters: THE BAR NEVER RE-RENDERS WHILE A VIEW IS MOUNTED.
 * A view re-rendering on each keystroke (projects, catalogue) leaves the input
 * untouched, so focus + caret survive with no re-focus dance - the catalogue's
 * old footer-outside-the-body trick, now the default for everyone. The footer's
 * markup is rebuilt only between views (a claim with a different placeholder)
 * or when the jelly/pro flags flip (checked per navigation in applyRoute) - 
 * property/attribute reactivity on the vendored <jelly-input> is unverified, so
 * a claim-time re-render is the safe path; mid-session writes go through the
 * documented live `.value` getter/setter only.
 *
 * The same holds across a REMOUNT of the view already showing (main.ts navigate():
 * a forced re-navigation to the same route signature, such as the gallery's redraw
 * when the full catalog replaces its slim first paint). That is one view redrawn,
 * not a leave, so prepareSearchBarNavigation(true) keeps the field exactly as the user
 * left it: the release skips its reset, the route change skips the overlay
 * dismissal, and the incoming claim adopts the live text instead of its own initial
 * value, then hears that text the way a fresh keystroke would hand it over. Text
 * typed during the first paint, its focus and its caret all survive the redraw.
 *
 * Keyboard policy lives HERE, in one place (previously three private copies):
 * Escape with text clears the field (and notifies) keeping focus; Escape when
 * empty blurs and falls through. Only a HANDLED Escape stops propagation - 
 * ordinary typing bubbles as it always did in the gallery (the typing SFX
 * layer listens at the document; projects' old stop-everything handler was
 * guarding against tool-view shortcuts that are never mounted alongside it).
 *
 * The spotlight overlay (plans/99 M2) plugs in through ONE seam: a registered
 * SpotlightHook sees the debounced query, gets first refusal on the field's
 * ArrowUp/ArrowDown/Enter/Escape (a true return = consumed, so the Escape
 * ladder becomes overlay-open → close, else text → clear, else blur), and
 * hears route changes. Registering the hook also upgrades the field to the
 * ARIA combobox pattern (lifted from pro/index.ts's template picker); the
 * overlay drives aria-expanded/aria-activedescendant via setSearchBarExpanded.
 * The summon chord (plans/99 section 2f) lives here too: ⌘Space AND ⌃Space are both
 * bound, only ⌃␣ is ever advertised (the <kbd> hint chip) - on stock macOS
 * Spotlight eats ⌘Space before the page sees it, and that inertness is by
 * design ("if the OS doesn't steal it"). The chord only acts while a search
 * route is live; it never preventDefaults a chord it isn't handling.
 */
import { footerNav, gallerySearchBox } from './footer-nav.ts';
import { t } from '../i18n.ts';
import { jellyActive } from '../lib/jelly.ts';
import { SEARCH_DEBOUNCE_MS } from '../lib/search/match.ts';

export interface SearchBarClaim {
  /** Field placeholder (t()-wrapped by the caller). */
  placeholder: string;
  /** Accessible name; defaults to the placeholder. */
  ariaLabel?: string;
  /** Initial field text (e.g. a ?q= restore). */
  value?: string;
  /** Focus the field on claim - fine pointers only (type-to-find; skipped on
   *  touch so the keyboard doesn't pop over the view). */
  autoFocus?: boolean;
  /** The live-filter tap: called with the RAW field text after the shared
   *  debounce (each view applies its own normalisation, so migrated behaviour
   *  stays byte-for-byte). Its presence is the live-adapt switch (plans/99
   *  section 2a/section 2c) - overlay-only views claim without it. */
  onQuery?: (raw: string) => void;
  /** Overlay-only views' clear tap (plans/99 M2): clearSearchBar() notifies
   *  onQuery('') when the claim live-filters, OTHERWISE this - so a view with
   *  no live tap (projects' ?q= results mode) still hears the ✕/Escape clear. */
  onClear?: () => void;
}

/** The spotlight overlay's seam into the bar (plans/99 section 2d/section 2f) - implemented
 *  by components/spotlight.ts, registered once at boot right after the bar. */
export interface SpotlightHook {
  /** The debounced field text (also fired by the chord and a clear). */
  onQueryChanged(raw: string): void;
  /** First refusal on the field's ArrowUp/ArrowDown/Enter/Escape. Return true
   *  to consume (the bar preventDefault+stopPropagation's and skips its own
   *  Escape ladder). */
  onKeydown(e: KeyboardEvent): boolean;
  /** Every route transition (applySearchBarRoute) - the overlay dismisses. */
  onRouteChanged(routeName: string, mode: 'search' | 'none'): void;
}

type FooterMode = 'search' | 'none';

let footerEl: HTMLElement | null = null;
let mode: FooterMode = 'none';
let routeName = '';
let currentClaim: SearchBarClaim | null = null;
let spotlightHook: SpotlightHook | null = null;
let spotlightListboxId = '';
// Rendered-state fingerprints - a re-render happens only when one of these
// changes, never while a view is mounted (see the module invariant above).
let renderedJelly = false;
let renderedPlaceholder = '';
let debounce: ReturnType<typeof setTimeout> | undefined;
// Set by prepareSearchBarNavigation(true) for one release → route → claim cycle of the
// route named here. `undelivered` records a keystroke whose debounce had not fired
// yet, so the incoming claim can hand that text on in its place.
let remountHold: { route: string; undelivered: boolean } | null = null;

/** Cancel the armed keystroke debounce, if any. True when one was armed. */
function cancelDebounce(): boolean {
  const armed = debounce !== undefined;
  clearTimeout(debounce);
  debounce = undefined;
  return armed;
}

const viewEl = (): HTMLElement | null => document.getElementById('view');
const inputEl = (): HTMLInputElement | null => footerEl?.querySelector<HTMLInputElement>('.gallery-search') ?? null;
const clearBtn = (): HTMLButtonElement | null => footerEl?.querySelector<HTMLButtonElement>('.gallery-search-clear') ?? null;
const kbdHintEl = (): HTMLElement | null => footerEl?.querySelector<HTMLElement>('.gallery-search-kbd') ?? null;

/** The active placeholder/aria pair - the claim's, or the global default. */
function labels(): { placeholder: string; ariaLabel: string } {
  const placeholder = currentClaim?.placeholder ?? t('Search Lolly…');
  return { placeholder, ariaLabel: currentClaim?.ariaLabel ?? placeholder };
}

/** The ✕ tracks the field's content (shown only while there's text to clear);
 *  the ⌃␣ hint chip is its complement - it yields the corner as soon as the
 *  field has text (plans/99 section 2f). */
function syncClear(): void {
  const hasText = !!inputEl()?.value;
  clearBtn()?.toggleAttribute('hidden', !hasText);
  kbdHintEl()?.toggleAttribute('hidden', hasText);
}

/** ARIA combobox upgrade (plans/99 section 2d, the pro/index.ts pattern) - applied to
 *  the `.gallery-search` element (also correct for the <jelly-input> host) once
 *  a spotlight hook exists, and re-applied on every re-render. */
function applyCombobox(): void {
  const input = inputEl();
  if (!input || !spotlightHook) return;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', spotlightListboxId);
}

/** What a re-render must carry across when the user is mid-entry. */
interface FieldState {
  value: string;
  focused: boolean;
  start: number | null;
  end: number | null;
  direction: 'forward' | 'backward' | 'none' | null;
}

function fieldState(): FieldState | null {
  const input = inputEl();
  if (!input) return null;
  // A focused <jelly-input> reports its host as the active element, so one test
  // covers both fields; only the plain input exposes its selection.
  const textual = typeof input.selectionStart === 'number';
  return {
    value: input.value ?? '',
    focused: document.activeElement === input,
    start: textual ? input.selectionStart : null,
    end: textual ? input.selectionEnd : null,
    direction: textual ? input.selectionDirection : null,
  };
}

function restoreField(state: FieldState): void {
  const input = inputEl();
  if (!input) return;
  input.value = state.value;
  syncClear();
  if (!state.focused) return;
  input.focus({ preventScroll: true });
  if (state.start === null || state.end === null || typeof input.setSelectionRange !== 'function') return;
  try { input.setSelectionRange(state.start, state.end, state.direction ?? undefined); } catch { /* not a text field */ }
}

/** (Re)build the footer markup and wire its handlers. Between views only, or during
 *  a held remount with `keepField`, which carries the live text, focus and caret
 *  into the new markup. */
function render(opts: { keepField?: boolean } = {}): void {
  const kept = opts.keepField ? fieldState() : null;
  const { placeholder, ariaLabel } = labels();
  renderedJelly = jellyActive();
  renderedPlaceholder = placeholder;
  const tpl = document.createElement('template');
  tpl.innerHTML = footerNav({
    searchHtml: gallerySearchBox({
      placeholder, ariaLabel, value: currentClaim?.value ?? '',
      // Advertise ⌃␣ ONLY - ⌘Space stays bound but silent (plans/99 section 2f, locked).
      kbdHint: { label: '⌃␣', title: t('Ctrl + Space') },
    }),
  });
  const next = tpl.content.firstElementChild as HTMLElement;
  next.hidden = mode !== 'search';
  if (footerEl) footerEl.replaceWith(next);
  else viewEl()?.after(next);
  footerEl = next;
  wire(next);
  applyCombobox();
  if (kept) restoreField(kept);
}

function wire(footer: HTMLElement): void {
  // One delegated set per render. Jelly's shadow field composes its events, so
  // they retarget to the <jelly-input> host (class .gallery-search) and bubble here.
  footer.addEventListener('input', (e) => {
    if (!(e.target as HTMLElement).closest('.gallery-search')) return;
    syncClear();
    cancelDebounce();
    debounce = setTimeout(() => {
      debounce = undefined;
      const raw = inputEl()?.value ?? '';
      currentClaim?.onQuery?.(raw);
      // The overlay rides the SAME debounce, after the local tap - one query,
      // two tiers (plans/99 section 2a: live view behind, spotlight above).
      spotlightHook?.onQueryChanged(raw);
    }, SEARCH_DEBOUNCE_MS);
  });
  footer.addEventListener('keydown', (e) => {
    if (!(e.target as HTMLElement).closest('.gallery-search')) return;
    // The overlay gets first refusal on the combobox keys (plans/99 section 2d): a
    // consumed key never reaches the Escape ladder below, and preventDefault
    // keeps ArrowUp/ArrowDown from moving the caret.
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape')
      && spotlightHook?.onKeydown(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key !== 'Escape') return;
    const input = inputEl();
    if (input?.value) {
      // A handled Escape stays private to the field; an empty-field Escape
      // blurs and falls through to whatever the view does with it.
      e.preventDefault();
      e.stopPropagation();
      clearSearchBar({ focus: true });
    } else input?.blur();
  });
  footer.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-search-clear]')) clearSearchBar({ focus: true });
  });
}

/** Mount the singleton once, at boot - hidden until the first applyRoute. */
export function initSearchBar(): void {
  if (footerEl) return;
  render();
  // The summon chord (plans/99 section 2f): ⌘Space AND ⌃Space, document-level, live
  // only while a search route shows the bar. Handling = focus the field + hand
  // the current text to the overlay (so it opens if there's already a query).
  // On stock macOS Spotlight consumes ⌘Space before the page ever sees it - 
  // that inertness is by design; ⌃␣ is the advertised chord. A chord we are
  // NOT handling (editing routes, modifier soup, mid-IME) is never
  // preventDefault'ed [no-browser-default-hijacks].
  document.addEventListener('keydown', (e) => {
    if (mode !== 'search') return;
    // Exactly ⌘Space or ⌃Space - never both together: ⌃⌘Space is macOS's own
    // Character Viewer/emoji chord, and capturing it would yank focus out of
    // whatever field the user was inserting an emoji into (principle 5).
    if (e.metaKey === e.ctrlKey || e.code !== 'Space' || e.altKey || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    const input = inputEl();
    input?.focus({ preventScroll: true });
    spotlightHook?.onQueryChanged(input?.value ?? '');
  });
}

/**
 * Route transition (main.ts navigate(), after the outgoing view's _cleanup and
 * before the incoming mount): show/hide the bar, keep #view's footer-clearance
 * class in step, remember which route owns the bar (the overlay's own-domain
 * lookup - currentSearchRoute), notify the overlay, and fold in any jelly/pro
 * flag flips since the last render.
 */
export function applySearchBarRoute(nextMode: FooterMode, nextRouteName: string): void {
  // A hold covers a remount of the same browse route only. Any other transition
  // (another route, or the bar hiding behind the WebGPU card) resets the bar as
  // the release that the hold skipped would have.
  if (remountHold && (remountHold.route !== nextRouteName || nextMode !== 'search')) {
    remountHold = null;
    cancelDebounce();
    if (footerEl && !currentClaim) render();
  }
  mode = nextMode;
  routeName = nextRouteName;
  if (remountHold) {
    // The same view claims the bar again in a moment: leave the field, any armed
    // keystroke and the overlay exactly as they are.
    if (!footerEl) return;
    if (jellyActive() !== renderedJelly) render({ keepField: true });
    footerEl.hidden = mode !== 'search';
    viewEl()?.classList.toggle('has-search-footer', mode === 'search');
    return;
  }
  // A route transition invalidates any in-flight keystroke: without this, a
  // debounce armed on the OUTGOING view fires after navigation and re-opens
  // the overlay over the new route - including over a footer:'none' editing
  // view, where the hidden bar can't even receive the Escape to dismiss it.
  cancelDebounce();
  // Unclaimed routes (dashboard/profile) have no release to reset the field,
  // so a query typed there would ride into the next view's bar. Claimed views
  // are reset by their release before this runs; mirror that here.
  if (!currentClaim) {
    const input = inputEl();
    if (input) input.value = '';
    syncClear();
  }
  spotlightHook?.onRouteChanged(nextRouteName, nextMode);
  if (!footerEl) return;
  if (jellyActive() !== renderedJelly) render();
  footerEl.hidden = mode !== 'search';
  viewEl()?.classList.toggle('has-search-footer', mode === 'search');
}

/** The route currently owning the bar - ROUTE_DOMAIN's key for the overlay's
 *  own-domain split (plans/99 section 2a). '' until the first navigation applies. */
export function currentSearchRoute(): string {
  return routeName;
}

/** The id of the overlay's listbox, so the boot shim (components/spotlight-boot.ts)
 *  can point the combobox at it without importing the overlay it names. Defined
 *  HERE - the one module both the shim and the overlay already depend on - rather
 *  than duplicated as a literal in two places that must never drift. */
export const SPOTLIGHT_LISTBOX_ID = 'spotlight-listbox';

/** Register the spotlight overlay (once, at boot, right after initSearchBar).
 *  Upgrades the field to an ARIA combobox pointing at the overlay's listbox. */
export function registerSpotlightHook(hook: SpotlightHook, opts: { listboxId: string }): void {
  spotlightHook = hook;
  spotlightListboxId = opts.listboxId;
  applyCombobox();
}

/** The overlay's write path for the combobox state: aria-expanded on the field,
 *  aria-activedescendant tracking the overlay's active row (null clears it). */
export function setSearchBarExpanded(expanded: boolean, activeDescId?: string | null): void {
  const input = inputEl();
  if (!input) return;
  input.setAttribute('aria-expanded', String(expanded));
  if (expanded && activeDescId) input.setAttribute('aria-activedescendant', activeDescId);
  else input.removeAttribute('aria-activedescendant');
}

/**
 * Called by main.ts navigate() before the outgoing view's teardown. `remount` is true
 * for a forced re-navigation to the route signature already showing: the bar is then
 * held for one release → applySearchBarRoute → claim cycle. The release leaves the
 * field alone, the route change leaves the overlay open, and the incoming claim keeps
 * the user's text, focus and caret in place of its own initial value. A different
 * route before that claim cancels the hold and resets the bar as the skipped release
 * would have. Any other navigation drops a hold left by a remount whose view never
 * claimed the bar, so an explicit new query (a #/?q= hand-off) always wins.
 */
export function prepareSearchBarNavigation(remount: boolean): void {
  if (remount) {
    const armed = cancelDebounce();
    remountHold = { route: routeName, undelivered: armed || remountHold?.undelivered === true };
    return;
  }
  if (!remountHold) return;
  remountHold = null;
  if (currentClaim) return;
  cancelDebounce();
  if (footerEl) render();
}

/** A held claim: the field already holds what the user typed, so keep it and hand
 *  that text to the remounted view. */
function adoptHeldField(claim: SearchBarClaim, armed: boolean): void {
  if (footerEl && labels().placeholder !== renderedPlaceholder) render({ keepField: true });
  syncClear();
  // No autoFocus: a redraw must not move the user's focus.
  const live = inputEl()?.value ?? '';
  if (!armed && live === (claim.value ?? '')) return;
  // Through a timer rather than a direct call: the claim runs part-way through the
  // view's mount, and the live tap may read state the mount has not set up yet. The
  // ordinary debounce never calls it that early either.
  debounce = setTimeout(() => {
    debounce = undefined;
    if (currentClaim !== claim) return;
    const raw = inputEl()?.value ?? '';
    claim.onQuery?.(raw);
    // The overlay heard every keystroke whose debounce fired before the remount;
    // only a keystroke the remount interrupted is news to the overlay.
    if (armed) spotlightHook?.onQueryChanged(raw);
  }, 0);
}

/**
 * Claim the bar for the mounting view. Returns the release fn - chain it into
 * the view's _cleanup. A stale release (called after another view claimed) is a
 * no-op, so teardown ordering can't clobber the next view's claim.
 */
export function claimSearchBar(claim: SearchBarClaim): () => void {
  currentClaim = claim;
  const held = remountHold?.route === routeName ? remountHold : null;
  remountHold = null;
  const armed = cancelDebounce();
  if (held) adoptHeldField(claim, armed || held.undelivered);
  else if (footerEl) {
    if (labels().placeholder !== renderedPlaceholder) render();
    else {
      const input = inputEl();
      if (input) input.value = claim.value ?? '';
      syncClear();
    }
    if (claim.autoFocus && window.matchMedia?.('(pointer: fine)').matches) {
      inputEl()?.focus({ preventScroll: true });
    }
  }
  return () => {
    if (currentClaim !== claim) return;
    currentClaim = null;
    // A remount of this route adopts the field as it stands (prepareSearchBarNavigation).
    if (remountHold) return;
    cancelDebounce();
    // Back to the unclaimed default (and an empty field) so a leftover query
    // can't ride into the next view's bar.
    if (footerEl) render();
  };
}

/** Set the field to a given query and notify the claim immediately (no
 *  debounce) - the write path behind in-view "search for this" affordances
 *  (e.g. a catalogue tag chip setting `tag:x`). Mirrors clearSearchBar. */
export function setSearchBarQuery(value: string, opts: { focus?: boolean } = {}): void {
  cancelDebounce();
  const input = inputEl();
  if (input) input.value = value;
  syncClear();
  currentClaim?.onQuery?.(value);
  spotlightHook?.onQueryChanged(value);
  if (opts.focus) input?.focus({ preventScroll: true });
}

/** Empty the field and notify the claim immediately (no debounce) - the shared
 *  path behind the ✕, a handled Escape, and every in-view "clear search" link
 *  ([data-search-clear] anywhere in the footer; views route their own body
 *  links here too). A live-filter claim hears onQuery(''); an overlay-only
 *  claim (no onQuery) hears onClear instead - never both. The overlay always
 *  hears the empty query, so a clear closes it. */
export function clearSearchBar(opts: { focus?: boolean } = {}): void {
  cancelDebounce();
  const input = inputEl();
  if (input) input.value = '';
  syncClear();
  if (currentClaim?.onQuery) currentClaim.onQuery('');
  else currentClaim?.onClear?.();
  spotlightHook?.onQueryChanged('');
  if (opts.focus) input?.focus({ preventScroll: true });
}

/** Write the field without notifying the claim - for views that change the
 *  query themselves and just need the bar to match (e.g. the gallery's
 *  category pills clearing an active search). */
export function setSearchBarValue(v: string): void {
  cancelDebounce();
  const input = inputEl();
  if (input) input.value = v;
  syncClear();
}

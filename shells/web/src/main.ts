// SPDX-License-Identifier: MPL-2.0
/**
 * Web shell entry.
 *
 * Responsibilities:
 *   1. Construct the capability bridge (web implementations of each API).
 *   2. Sync the tool & asset catalogs (or load from cache when offline).
 *   3. Route between gallery / tool / profile / saved views.
 *   4. Hand the engine runtime a mounted node to render into.
 */

import { recordFeaturedRoute } from './lib/featured-activity.ts';
import { mountIOSTextScale } from './lib/ios-text-scale.ts';
import { createBridge } from './bridge/index.ts';
import type { Profile } from '@lolly-tools/core/host-v1';
import { syncCatalog, syncCorePrefetch, defaultFavouriteAssetIds, toolIndexChanged, localizeToolIndex, loadSlimToolIndex } from './catalog/sync.ts';
import { mergeInstalledToolsIntoIndex } from './lib/installed-tools.ts';
import { saveFavouriteAssets } from './lib/asset-favourites.ts';
import { mountGallery } from './views/gallery.ts';
import { initTheme, applyTheme, urlThemeOverride } from './theme.ts';
import { hydrateA11yPrefs, currentA11yPrefs, setA11yPref } from './lib/a11y-prefs.ts';
import { hydrateChromeFollow } from './lib/chrome-follow.ts';
import { computeViewportInsets } from './lib/viewport-insets.ts';
import { initI18n, loadedLang } from './i18n.ts';
import { hydrateSfxMuted, hydrateSfxVolume, installGlobalSfx, playSfx } from './lib/sfx.ts';
import { hydrateFeatureFlags, flagEnabledSync, isFlagOnSync, applyPerfUi, PERFORMANCE_UI_FLAG } from './feature-flags.ts';
// The collab + nearby WIRING is installed after first paint (see installCollabWiring
// below the import block): five registration modules whose bodies do nothing until a
// human opens a Share dialog or arrives on #/join, but whose static graph - the private
// opener, the live-mount stitch, the mount seam, the LAN provider, the accept side -
// was 94.7 KB of source (~7 KB gz) on the render-blocking preload set of every visit
// (plans/155 WP-3).
import { initSearchBar, applySearchBarRoute } from './components/search-bar.ts';
import { initSpotlightBoot } from './components/spotlight-boot.ts';
import { ensureJelly, jellyEnabled } from './lib/jelly.ts';
import { applyCaptureNeutral } from './lib/capture-neutral.ts';
import { peekNeuroDemo } from './lib/neuro-demo-peek.ts';
import { syncJellyNavToggle, UTILITIES_FLAG_ID, type ViewToggleKey } from './components/view-toggle.ts';
import { installGlobalReveal } from './lib/reveal.ts';
import { maybeShowFirstRunInstanceSheet, isTauriShell } from './lib/instance-choice.ts';
// The memoised instance-base load. Boot has no wiring of its own to do here (every
// syncing entry point awaits the same promise itself) - it needs the handle only to
// hold the control-plane probe back until the base it fetches through is known.
import { initInstanceBase } from './lib/instance.ts';
// components/models-welcome.ts is NOT imported here: it is Tauri-only, yet its static
// graph (lib/offline-manager.ts + the four model-catalog modules) rode the WEB boot
// bundle - the exact regression scripts/check-bundle-budget.ts:74-76 records as fixed
// on 2026-08-10. It is one dynamic import() inside the isTauriShell() gate below now
// (plans/155 Task 3.3).
// The PROBE leaf, not org/index.ts: a deployment with no control plane - which is
// every public one - answers dormant from a negative cache or one 404 and never loads
// the 47 KB of gate/policy/injectable code behind it (plans/155 WP-3). Governance
// comes from its own registry leaf for the same reason.
import { initOrgProbeFirst } from './org/probe.ts';
import { initSyncAutoPush, maybeApplyNewerAtBoot } from './lib/sync-service.ts';
import type { BackupDeps } from './lib/sync-engine.ts';
import { initSelectPreview } from './select-preview.ts';
import { installDepthSeam } from './lib/depth-seam.ts';
import { recordTool, recordBatch, bumpMetric, recordFormat } from './metrics.ts';
import { announce } from './a11y.ts';
import { beginViewFade } from './view-fade.ts';
import { noteLeavingHref, takeLeavingHref, recordLeave, noteMountedView } from './lib/back-nav.ts';

// The collab + nearby wiring, installed once the critical load is done rather than at
// module scope. All five are REGISTRATIONS - a Share-dialog row, the opener that row
// consults, the live-mount stitch, the LAN provider and the accept side - and none of
// them can be reached without a human gesture that is many seconds away: opening a
// Share dialog, or completing a #/join ceremony. The one race that exists is the one
// lib/collab-mount.ts was built for and documents: a connection made before anyone
// registered is PARKED, and `installLiveCollabMount()` drains what it finds - which is
// exactly why registration deliberately does not drain by itself.
//
// Order matters: the nearby provider must be registered before the accept side
// listens for invites over it.
function installCollabWiring(): void {
  void import('./lib/collab-share-private.ts');
  void import('./collab/private-opener.ts');
  void import('./lib/collab-live-mount.ts').then(m => m.installLiveCollabMount());
  void import('./lib/nearby-boot.ts')
    .then(m => { m.installNearbyBoot(); return import('./collab/nearby-accept.ts'); })
    .then(m => m.installNearbyAccept());
}
onWindowLoad(installCollabWiring);
// Publish window.__lollyDepth, the seam the spatial-photo tool asks for a depth
// map through (plans/160). Progressive enhancement in both directions: with no
// seam the tool renders the flat photo, and with DEPTH_STAGED false the seam
// resolves null rather than offering a download that cannot succeed.
installDepthSeam();

/** The web capability bridge, as produced by createBridge. */
type WebHost = Awaited<ReturnType<typeof createBridge>>;

/** Route names the shell can be in. */
type RouteName = 'gallery' | 'utilities' | 'tool' | 'profile' | 'dashboard' | 'pro' | 'projects' | 'history' | 'catalog' | 'verify' | 'convert' | 'data' | 'prepare' | 'compare' | 'start' | 'multi' | 'components' | 'lab' | 'pdf' | 'script' | 'ask' | 'docs' | 'join' | 'join-reply';

/** A parsed route: a discriminated union on `name`. */
type Route =
  | { name: 'tool'; toolId: string; params: string }
  | { name: 'profile'; params: string }
  | { name: 'dashboard'; params?: string }
  | { name: 'verify'; params?: string }
  | { name: 'convert'; params?: string }
  | { name: 'prepare' }
  | { name: 'compare' }
  | { name: 'data'; params?: string }
  | { name: 'pro'; params?: string }
  | { name: 'projects'; folderId: string | null; params?: string }
  | { name: 'history'; params?: string }
  | { name: 'catalog'; params?: string }
  | { name: 'start'; params?: string }
  | { name: 'multi'; params?: string }
  | { name: 'components'; params?: string }
  | { name: 'utilities'; params?: string }
  | { name: 'lab'; params?: string }
  | { name: 'pdf'; params?: string }
  | { name: 'script'; params?: string }
  | { name: 'ask'; params?: string }
  | { name: 'docs'; slug: string; lang: string | null; params?: string }
  | { name: 'join'; params?: string }
  | { name: 'join-reply'; params?: string }
  | { name: 'gallery'; params?: string };

/** The #view container, which a mounted view may stamp a teardown fn onto. */
interface ViewElement extends HTMLElement {
  _cleanup?: () => void;
}

/** The File Handling API's launch queue: an installed PWA opened through the OS
 *  "Open with" menu receives its file handles here. Declared locally because
 *  TypeScript's DOM library has no types for it, and only the Chromium family
 *  defines it - the consumer below is installed behind a probe. */
interface LaunchQueue {
  setConsumer(consumer: (params: { files?: Array<{ getFile(): Promise<File> }> }) => void): void;
}

// A friendly hello for anyone who opens the console. Paired with the one-line
// "ready" summary emitted once the catalog lands (see boot()), these are the only
// two logs a normal production load prints: catalog/font diagnostics are dev-only
// (lib/debug.ts) and host.log('info'|'debug') is suppressed in prod
// (bridge/index.ts), so the console stays clean and orderly. Genuine warnings and
// errors are never silenced.
console.log('%c🍭 Welcome to Lolly', "font:600 13px/1.6 'SUSE',system-ui,-apple-system,sans-serif;color:#e0457b");

// Apply localStorage theme immediately - before the profile loads - so there
// is no visible flash between the inline FOUC script and full JS boot.
initTheme();
// …then let `?theme=light|dark|brand` win for THIS page load only: a shared link or
// a screenshot run pins the look without flipping the reader's stored preference.
// Stamped straight onto [data-theme] rather than through applyTheme, which would
// persist it. Re-stamped in boot() once the profile theme has been applied (the
// profile is the canonical store and would otherwise overwrite it a beat later).
const urlTheme = urlThemeOverride();
if (urlTheme) document.documentElement.dataset.theme = urlTheme;
// Make every <select> a keyboard + wheel live-preview scrubber (macOS otherwise
// opens the native popup on arrow keys instead of cycling the value).
initSelectPreview();

/**
 * Which piece of a route's sub-state its dedup signature keys on (see
 * routeSignature). Absent ⇒ the route name alone is the whole signature.
 */
type RouteSigKey = 'toolId' | 'folderId' | 'params' | 'slug';

/** Everything the router needs to know about one route, in one place. */
interface RouteSpec {
  /** Spoken name, announced to assistive tech after the view mounts. */
  label: string;
  /** The view-toggle tab this route lights up. Absent ⇒ no tab bar. */
  tab?: ViewToggleKey;
  /** Scoping classes #view carries while this route is mounted. */
  viewClasses?: readonly string[];
  /** The sub-state the dedup signature keys on. */
  sigKey?: RouteSigKey;
  /** Whether the persistent bottom search bar shows on this route (plans/99 M1):
   *  'search' on the browse views, 'none' (the default) on editing views and the
   *  utility views that keep their own chrome for now. */
  footer?: 'search' | 'none';
}

/**
 * THE route table - the single source of truth for per-route chrome. The tab a
 * route lights up, the scoping classes #view carries, the announced label and
 * the dedup signature's shape are all derived from here, so adding a view means
 * adding one row (plus its parseRoute branch and its lazy mount case) rather
 * than editing four parallel lists that silently half-work when one is missed.
 */
const ROUTES: Record<RouteName, RouteSpec> = {
  gallery: { label: 'Tools gallery', tab: 'tools', viewClasses: ['gallery-view'], footer: 'search' },
  // Utilities IS the gallery view (mountGallery in only-utility mode), so it must
  // carry the same scoping class - gallery.css's desktop saved-list grid, footer
  // padding and every other .gallery-view rule apply identically. Without it the
  // mounted markup is styled by nothing and the view renders broken/blank.
  utilities: { label: 'Utilities', tab: 'utilities', viewClasses: ['gallery-view', 'utilities-view'], footer: 'search' },
  tool: { label: 'Tool', viewClasses: ['tool-view'], sigKey: 'toolId', footer: 'none' },
  profile: { label: 'Profile', viewClasses: ['profile-view'], sigKey: 'params', footer: 'search' },
  // The dashboard keys on its query too, so a deep link that only changes a flag
  // (#/d → #/d?print, or an old #/platform?x redirect) re-mounts and re-applies
  // the open+scroll, instead of being deduped as the same 'dashboard' route.
  dashboard: { label: 'Dashboard', viewClasses: ['dashboard-view'], sigKey: 'params', footer: 'search' },
  // params-keyed so #/pro?s=slot,slot… ("Edit as sheet") and #/pro?session=… deep
  // links re-seed the grid and survive Back. Safe: /pro never rewrites its own
  // params mid-session (its only location writes navigate AWAY - see index.ts).
  pro: { label: 'Batch mode', viewClasses: ['pro-view'], sigKey: 'params', footer: 'none' },
  projects: { label: 'Projects', tab: 'projects', viewClasses: ['projects-view'], sigKey: 'folderId', footer: 'search' },
  history: { label: 'History', viewClasses: ['history-view'], sigKey: 'params', footer: 'none' },
  catalog: { label: 'Catalogue', tab: 'catalog', viewClasses: ['catalog-view'], footer: 'search' },
  // Verify/Convert/PDF/Lab keep their own chrome in v1 - the bar reaches them in
  // plans/99 M3 once proven (decision locked 2026-08-08).
  verify: { label: 'Verify', viewClasses: ['verify-view'], footer: 'none' },
  convert: { label: 'Convert', viewClasses: ['convert-view'], sigKey: 'params', footer: 'none' },
  compare: { label: 'Compare', viewClasses: ['compare-view'], footer: 'none' },
  prepare: { label: 'Prepare for sharing', viewClasses: ['prepare-view'], footer: 'none' },
  data: { label: 'Spreadsheet', viewClasses: ['data-view'], footer: 'none' },
  // The studio keys on ?tab= for the same reason - "Manage fonts" (#/start?tab=type)
  // clicked while already on #/start must switch steps, not dedupe to a no-op.
  start: { label: 'Brand setup', viewClasses: ['start-view'], sigKey: 'params', footer: 'none' },
  // Multi-edit keys on its selection (?s=slot,slot…) so editing a different
  // selection re-mounts with the new set instead of deduping.
  multi: { label: 'Multi-edit', viewClasses: ['multi-view'], sigKey: 'params', footer: 'none' },
  // Components keeps its footerNav SPECIMEN (in-flow, neutralised in components.css)
  // rather than the live bar.
  components: { label: 'Component library', footer: 'none' },
  // The Lab gets NO tab. It's a utility you open and come back from, like any tool
  // page - so it gets the back pill and no tab bar. Lighting the Utilities tab
  // here would suggest the pill is where you are rather than where you'd go,
  // and the tabs would compete with the report's own numbered sequence.
  lab: { label: 'Colour Lab', footer: 'none' },
  pdf: { label: 'Unpack', viewClasses: ['pdfx-view'], footer: 'none' },
  // Script audio is a utility view like the Lab: no tab, the back pill instead
  // (see the lab row's rationale above).
  script: { label: 'Script audio', viewClasses: ['scriptst-view'], footer: 'none' },
  // Ask Lolly (#/ask) - the in-app help surface (plans/103). A utility view like
  // the Lab: no tab, the back pill, and its OWN composer (footer: 'none') rather
  // than the shell search bar, since chat-Enter is a submit the bar has no slot
  // for. Keys on `params` so a fresh #/ask?q= from spotlight (or a Back into it)
  // re-mounts and appends the new question to the session transcript instead of
  // deduping onto the first.
  ask: { label: 'Ask Lolly', viewClasses: ['ask-view'], sigKey: 'params', footer: 'none' },
  // In-app documentation reader (#/docs/<slug>) - the /info docs rehosted into #view so
  // they inherit the ACTIVE brand (plan "this-is-a-very-sparkling-eich" M2). A utility
  // view like Ask/Lab (no tab, the back pill, its own scroll) but it KEEPS the search bar:
  // a reader mid-page needs the spotlight (docs group hoisted via ROUTE_DOMAIN) without
  // backing out to a browse route first. Unclaimed - queries go to the overlay only, never
  // reshape the page behind. Keys on the SLUG (routeSignature's 'slug' case), so moving
  // between doc pages re-mounts the reader.
  docs: { label: 'Documentation', viewClasses: ['docs-view'], sigKey: 'slug', footer: 'search' },
  // The two private-collab ceremony links (plan 100 section 6.1 skin 1, section 11.25). Both are
  // arrival points from someone ELSE's device, so they get no tab and no footer bar - 
  // and both key on `params`, because the whole meaning of the route is the invite (or
  // reply) token in the query: a second link pasted into the same tab must re-mount
  // with the new payload, never dedupe onto the first one.
  join: { label: 'Join a collab', sigKey: 'params', footer: 'none' },
  'join-reply': { label: 'Collab reply', sigKey: 'params', footer: 'none' },
};

/** Every scoping class in ROUTES → the routes that own it, in declaration order. */
const VIEW_CLASS_OWNERS: ReadonlyMap<string, ReadonlySet<RouteName>> = (() => {
  const owners = new Map<string, Set<RouteName>>();
  for (const [name, spec] of Object.entries(ROUTES) as Array<[RouteName, RouteSpec]>) {
    for (const cls of spec.viewClasses ?? []) {
      let set = owners.get(cls);
      if (!set) { set = new Set(); owners.set(cls, set); }
      set.add(name);
    }
  }
  return owners;
})();

/** Routes whose signature keys on `params`, so re-navigating WITHIN them isn't a leave. */
const PARAM_KEYED_ROUTES: ReadonlySet<RouteName> = new Set(
  (Object.entries(ROUTES) as Array<[RouteName, RouteSpec]>)
    .filter(([, spec]) => spec.sigKey === 'params')
    .map(([name]) => name),
);

let _lastRouteName: RouteName | null = null;
// Signature of the route currently mounted - used to drop a redundant re-navigate to the
// SAME route (a single tool open fires hashchange AND popstate → two navigates). See navigate().
let mountedRouteSig = '';

// Announce client-side route changes (the view swaps via innerHTML, which
// assistive tech wouldn't otherwise notice).
function announceRoute(name: RouteName): void {
  announce(`${ROUTES[name]?.label ?? 'Page'} loaded`);
}

/** The view-toggle tab a route lights up - null for routes without the tab bar. */
function navKeyForRoute(name: RouteName): ViewToggleKey | null {
  return ROUTES[name]?.tab ?? null;
}

/**
 * The dedup signature for a parsed route: its name plus whatever sub-state
 * ROUTES says changes what's mounted. See navigate() for the rationale.
 */
function routeSignature(route: Route): string {
  const key = ROUTES[route.name]?.sigKey;
  if (!key) return route.name;
  const sub = route as { toolId?: string; folderId?: string | null; params?: string; slug?: string; lang?: string | null };
  if (key === 'toolId') return `${route.name}:${sub.toolId ?? ''}`;
  // The docs reader mounts a specific page, so its signature is the slug (+ any
  // explicit route lang) - navigating between doc pages must re-mount, not dedupe.
  if (key === 'slug') return `${route.name}:${sub.lang ?? ''}/${sub.slug ?? ''}`;
  if (key === 'folderId') {
    // The ?q= results-mode param is mount state too (plans/99 section 2a): entering or
    // leaving projects results mode must remount in BOTH directions - the
    // overlay's "See all in Projects" handoff forward AND the browser's Back - 
    // so the signature carries it alongside the folder. Other params stay out:
    // they don't change what's mounted.
    const q = new URLSearchParams(sub.params ?? '').get('q');
    return `${route.name}:${sub.folderId ?? ''}${q ? `?q=${q}` : ''}`;
  }
  return `${route.name}:${sub.params ?? ''}`;
}

async function navigate(host: WebHost, opts: { force?: boolean } = {}): Promise<void> {
  const route = parseRoute();
  // A single tool open sets a hash while on a History-API /t/<id> URL, which fires BOTH
  // hashchange AND popstate - in separate macrotasks, with variable timing (the 2nd can
  // land after the 1st mount's replaceState). That mounted the tool TWICE per open,
  // re-running loadTool + createRuntime + hydrate for nothing (~2× the open cost; the tool
  // view even documents the quirk, reading its resume markers read-only to survive it).
  // Skip a navigate that resolves to the route already mounted - timing-independent, since
  // parseRoute maps both #/tool/<id> and /t/<id> to the same `tool:<id>` signature. The
  // signature must capture EVERYTHING that changes what's mounted, or it over-collapses:
  // keyed on `route.name` alone, opening a Projects folder (#/p/<id>) from the Projects
  // root both read 'projects' and the folder never opens. So each route keys on its full
  // sub-state (folderId / params). ONLY the tool route strips params - its two burst
  // events repack the query mid-mount, and same-tool param edits apply in place
  // (runtime.setInput), never by re-mount; every other route's sub-state is stable across
  // a burst. Explicit refreshes - boot, the gallery's post-sync re-render - force past this.
  // Which sub-state each route keys on is declared in ROUTES (sigKey) above.
  const routeSig = routeSignature(route);
  // The URL this navigation left (hashchange oldURL / navigateTo's capture) - 
  // consumed on EVERY navigate, even a deduped one, so a stale stash can't
  // leak into a later record. popstate leaves no stash; recordLeave() then
  // falls back to the outgoing view's mount-time URL.
  const leftHref = takeLeavingHref();
  if (!opts.force && routeSig === mountedRouteSig) return;
  const prevSig = mountedRouteSig;
  mountedRouteSig = routeSig;
  if (routeSig !== prevSig) recordFeaturedRoute(route);

  // Remember the view being left so the next view's back pill can name it and
  // return there (lib/back-nav.ts). Only on a genuine view change: the routes
  // whose signature keys on params (start/dashboard/profile/multi) re-navigate
  // within themselves (#/start?tab=color → ?tab=type), and a forced same-sig
  // remount (lolly:remount) isn't a leave at all.
  const viewIdent = (sig: string): string => {
    const colon = sig.indexOf(':');
    if (colon < 0) return sig;
    const name = sig.slice(0, colon);
    return PARAM_KEYED_ROUTES.has(name as RouteName) ? name : sig;
  };
  if (prevSig && viewIdent(routeSig) !== viewIdent(prevSig)) recordLeave(leftHref);

  const view = document.getElementById('view') as ViewElement;
  // NEVER let an outgoing view's teardown block the navigation: if _cleanup throws, the
  // whole render below is skipped and the view "doesn't change" - a user gets trapped.
  // This bit the scanner on iOS, where a live-camera teardown step threw, so tapping
  // Home/back reacted but never swapped the view. Log and carry on; the incoming view
  // still mounts. (Individual teardown steps are also hardened in tool.ts's cleanup.)
  try { view._cleanup?.(); } catch (e) { console.error('[nav] outgoing view cleanup threw:', e); }
  delete view._cleanup;

  // The Projects "+ New tool" / resume flow arms one-shot sessionStorage markers
  // (lolly:fileInto, lolly:returnTo) that the tool view READS on mount (it can't
  // remove them - a single hash navigation may mount the tool twice, and the second
  // mount owns the live Save button). Clear them the moment we land on any NON-tool
  // view so a marker can't leak into the next, unrelated tool a user opens.
  if (route.name !== 'tool') {
    try { sessionStorage.removeItem('lolly:fileInto'); sessionStorage.removeItem('lolly:returnTo'); } catch { /* private mode */ }
  }

  document.querySelectorAll<HTMLElement>('.nav-btn[data-route]').forEach(btn => {
    btn.classList.toggle('nav-btn--active', btn.dataset.route === route.name);
  });

  // Track returns from tool → gallery so card-in animation doesn't replay.
  const prevRouteName = _lastRouteName;
  // Leaving an editing session - a sweet "yum-yum" cheer as you step away from a tool
  // (any tool → non-tool move; not tool → tool, which stays in editing).
  if (prevRouteName === 'tool' && route.name !== 'tool') playSfx('leaveSession');
  const returning = _lastRouteName === 'tool' && route.name === 'gallery';
  _lastRouteName = route.name;

  // Cross-view fade: snapshot the OUTGOING view now - before its scoping class
  // flips (below) or its markup is torn down (the clear/incoming mount below) - so
  // the blank frame while the next view mounts is hidden behind the old pixels,
  // which fade out once the new view has painted underneath. Only on a genuine
  // view-NAME change (never a same-view refresh, e.g. the gallery's post-sync
  // re-render), and not on the tool→gallery "return" (that path keeps its own
  // instant feel). beginViewFade MOVES #view's nodes into the overlay, so the
  // clear/mount below fill an already-empty container; it returns null under
  // reduced motion or on first boot, collapsing to today's instant swap. commit()
  // (after the mount, or in the catch) starts the fade - or drops the snapshot if
  // superseded by a newer navigation.
  const fade = (prevRouteName && route.name !== prevRouteName && !returning)
    ? beginViewFade(view)
    : null;

  // Scoping classes, from ROUTES: every class any route declares is toggled on
  // EVERY navigation, so the outgoing view's class comes off as the incoming
  // view's goes on. (A route with no viewClasses, e.g. the Lab, scopes itself.)
  for (const [cls, owners] of VIEW_CLASS_OWNERS) view.classList.toggle(cls, owners.has(route.name));
  view.classList.toggle('is-returning', returning);

  // The persistent search bar (plans/99 M1): shown on browse routes, hidden on
  // editing ones. After the outgoing view's _cleanup (its claim is released) and
  // before the incoming mount (which claims it) - and before the try, so a mount
  // failure still leaves the bar consistent with the route.
  applySearchBarRoute(ROUTES[route.name].footer ?? 'none', route.name);

  // When the route NAME changes, the view-scoping class above changes with it
  // (e.g. .profile-view → .gallery-view). But the outgoing view's markup is still
  // in `view` and won't be replaced until the incoming mount writes its innerHTML
  // - which happens AFTER that mount's first await (gallery reads IndexedDB before
  // it paints). In that gap the old markup is styled by a class it no longer has,
  // so it flashes UNSTYLED (e.g. a bare profile form). Drop the stale markup now so
  // that flash can't show; the incoming mount fills the empty container. Same-name
  // updates (the gallery's post-sync refresh) keep their content so they never
  // blank, and first boot keeps the "Loading…" skeleton until the gallery lands.
  if (prevRouteName && route.name !== prevRouteName) view.replaceChildren();

  // The dashboard leans on SUSE Mono (device readouts, hex/CMYK rows, code). It
  // isn't preloaded globally - that would tax the mono-light gallery cold-load - 
  // so warm it here, before the view chunk imports and paints, to head off a
  // post-paint reflow when the woff2 lands late. Idempotent.
  if (route.name === 'dashboard') ensureMonoPreload();

  // Any failure mounting the route must NOT leave the (already-cleared) view blank:
  // a stale lazy chunk reloads onto the fresh shell; any other mount error shows a
  // Reload card. See recoverFromStaleShell / showReloadCard below.
  try {
  switch (route.name) {
    case 'tool': {
      recordTool(route.toolId); // local usage metric (profile page)
      // Lazy-load the tool view (the largest) so it stays out of the cold-load
      // bundle every gallery/catalog visitor pays for before first paint. Same
      // dynamic-import pattern as the other views; idle-prefetched below so the
      // first tap into a tool still opens instantly.
      const { mountTool } = await import('./views/tool.ts');
      await mountTool(view, host as unknown as Parameters<typeof mountTool>[1], route.toolId, route.params);
      break;
    }
    // Profile / Platform / Capabilities pull in their own (sometimes heavy, e.g.
    // fflate) deps; lazy-load them so they stay out of the cold-load bundle that
    // every gallery visitor pays for. Same dynamic-import pattern as /pro below.
    case 'profile': {
      const { mountProfile } = await import('./views/profile.ts');
      await mountProfile(view, host as unknown as Parameters<typeof mountProfile>[1], route.params);
      break;
    }
    case 'dashboard': {
      const { mountDashboard } = await import('./views/dashboard.ts');
      await mountDashboard(view, host, route.params);
      break;
    }
    // /verify - on-device Content Credentials check (aliases /valid, /v). Same
    // engine verifier the CLI `validate` command uses; the view module is named
    // for what it checks (validity), lazy-loaded like the other dashboards.
    case 'verify': {
      const { mountValid } = await import('./views/valid.ts');
      await mountValid(view, host, route.params);
      break;
    }
    // /convert - on-device file converter (fonts, SVG⇄SVGZ, raster⇄raster), a
    // verify-like drop→pick→download surface. Lazy-loaded like the other dashboards.
    case 'convert': {
      const { mountConvert } = await import('./views/convert.ts');
      await mountConvert(view, host, route.params);
      break;
    }
    // /data - on-device spreadsheet viewer/editor (xlsx/csv/tsv/json → virtualized
    // grid → edit → download-as). Lazy-loaded like the other dashboards.
    case 'compare': {
      const { mountCompare } = await import('./views/compare.ts');
      mountCompare(view, host);
      break;
    }
    case 'prepare': {
      const { mountPrepare } = await import('./views/prepare.ts');
      mountPrepare(view, host);
      break;
    }
    case 'data': {
      const { mountDataView } = await import('./views/data.ts');
      await mountDataView(view, host, route.params);
      break;
    }
    // --- Multi-edit: 2–8 saved sessions edited side by side (grid of live
    // canvases + one combined sidebar). Reached from the Projects bulk bar. ---
    case 'multi': {
      const { mountMultiEdit } = await import('./views/multi-edit.ts');
      await mountMultiEdit(view, host as unknown as Parameters<typeof mountMultiEdit>[1], route.params ?? '');
      break;
    }
    // --- /pro batch mode: isolated, lazy-loaded feature. Safe to remove by
    // deleting src/pro/ and this case + the parseRoute branch below. ---
    case 'pro': {
      const { mountPro } = await import('./pro/index.ts');
      // The folder overlay is pro-free; inject it (like onBatchRendered) so /pro
      // keeps its "imports only engine/host/siblings" isolation intact.
      const { openFolderOverlay } = await import('./folder-overlay.ts');
      const q = new URLSearchParams(route.params || '');
      const sessionSlot = q.get('session');
      // "Bulk from rows" from a tool view: #/batch?tool=<id> starts the batch on that
      // template instead of the empty template search (views/tool.ts). A plain tool id,
      // so URLSearchParams decoding is all it needs.
      const seedToolId = q.get('tool') || '';
      // Projects "Edit as sheet": #/pro?s=slot,slot… seeds one grid row per
      // selected session (mirrors #/multi?s=…). Read the refs from the RAW query,
      // NOT via URLSearchParams: a ref is `__batch__:<label>` and a label may hold
      // ',' or '%', which encodeURIComponent wrote as %2C/%25. URLSearchParams.get
      // would decode ONCE - turning an encoded %2C back into a delimiter comma, and
      // leaving a bare '%' that a second decode chokes on. So split the encoded
      // value on the literal commas that only ever separate refs, then decode each
      // piece exactly once (guarded, so a hand-typed malformed ?s= can't throw the
      // whole mount).
      const rawS = (route.params || '').split('&').find(p => p.startsWith('s='))?.slice(2) ?? '';
      const safeDecode = (s: string): string => { try { return decodeURIComponent(s); } catch { return s; } };
      const seedRefs = rawS ? rawS.split(',').map(safeDecode).filter(Boolean) : [];
      // Inject a metrics hook rather than letting /pro import metrics.js - keeps
      // the folder's "imports only engine/host/siblings" isolation intact.
      const onBatchRendered = (files: Array<{ name: unknown }>) => {
        recordBatch(files.length);
        bumpMetric('filesRendered', files.length);
        for (const f of files) recordFormat(String(f.name).split('.').pop());
      };
      // Save-a-batch-to-a-project (Andy, 2026-08-26): the Projects Batch button /
      // "Edit as sheet" carry `?from=<folderId>` as the batch's origin. folders.ts is
      // a shell-side sibling /pro must not import, so the shell injects a tiny folder
      // API (mirrors openFolderOverlay); a memoised store keeps it off the mount path.
      const originFolderId = q.get('from') || null;
      let folderStore: ReturnType<Awaited<typeof import('./folders.ts')>['createFolderStore']> | null = null;
      const withStore = async () => {
        if (!folderStore) {
          const { createFolderStore } = await import('./folders.ts');
          folderStore = createFolderStore(host as unknown as Parameters<typeof createFolderStore>[0]);
        }
        return folderStore;
      };
      const folderApi = {
        async list() {
          const s = await withStore();
          const folders = await s.list();
          const byId = new Map(folders.map(f => [f.id, f]));
          const depthOf = (f: { parentId?: string | null }): number => {
            let d = 0; let p = f.parentId ?? null;
            while (p && d < 32) { d++; p = byId.get(p)?.parentId ?? null; }
            return d;
          };
          // Path-ordered so a child follows its parent (a flat alpha sort scatters the tree).
          const pathOf = (f: { id: string; name: string; parentId?: string | null }): string => {
            const parts: string[] = []; let cur: typeof f | undefined = f;
            while (cur) { parts.unshift(cur.name.toLowerCase()); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
            return parts.join('/');
          };
          return [...folders]
            .sort((a, b) => pathOf(a).localeCompare(pathOf(b)))
            .map(f => ({ id: f.id, name: f.name, depth: depthOf(f) }));
        },
        async create(name: string, parentId: string | null) {
          const f = await (await withStore()).create(name, parentId);
          return { id: f.id, name: f.name };
        },
        async file(slot: string, folderId: string | null) {
          await (await withStore()).moveItem(slot, folderId, 'session');
        },
      };
      await mountPro(view, host as unknown as Parameters<typeof mountPro>[1], { sessionSlot, seedToolId, seedRefs, onBatchRendered, openFolderOverlay, originFolderId, folderApi } as unknown as Parameters<typeof mountPro>[2]);
      break;
    }
    // --- Projects: a gallery-style view of folders of saved sessions. Shares the
    // pro-free folder store + folder-export (gated import); safe to keep even if /pro
    // is removed. ---
    case 'history': {
      const { mountHistory } = await import('./views/history.ts');
      await mountHistory(view, host, route.params);
      break;
    }
    case 'projects': {
      const { mountProjects } = await import('./views/projects.ts');
      const onBatchRendered = (files: Array<{ name: unknown }>) => {
        recordBatch(files.length);
        bumpMetric('filesRendered', files.length);
        for (const f of files) recordFormat(String(f.name).split('.').pop());
      };
      await mountProjects(view, host, route.folderId, { onBatchRendered, params: route.params });
      break;
    }
    // --- Catalog: a gallery-style view of every asset (catalog + user), plus swatches
    // and downloadable fonts. Lazy-loaded like the other non-gallery views. ---
    case 'catalog': {
      const { mountCatalog } = await import('./views/catalog.ts');
      await mountCatalog(view, host, route.params);
      break;
    }
    // --- /start: the brand studio (set, save, import or export your brand
    // primitives - step tabs, ?tab=<key> deep-links one). Lazy-loaded - it
    // statically pulls the engine's derive/token modules, which the gallery
    // cold-load must not pay for. ---
    case 'start': {
      const { mountStart } = await import('./views/start.ts');
      await mountStart(view, host as unknown as Parameters<typeof mountStart>[1], route.params ?? '');
      break;
    }
    case 'lab': {
      // Colour Lab (#/lab) - a scrolling single-colour report. Lazy: it pulls the
      // gamut solid and the slice charts, which no other view on a cold path needs.
      const { mountColorLab } = await import('./views/color-lab.ts');
      await mountColorLab(view, host as unknown as Parameters<typeof mountColorLab>[1], route.params ?? '');
      break;
    }
    case 'pdf': {
      // Unpack (#/pdf). Lazy: it pulls the PDF interpreter and pdf-lib,
      // which nothing on the landing path needs.
      const { mountPdfExtract } = await import('./views/pdf-extract.ts');
      await mountPdfExtract(view, host as unknown as Parameters<typeof mountPdfExtract>[1], route.params);
      break;
    }
    case 'script': {
      // Script audio (#/script) - the writing surface over host.speech. Lazy:
      // nothing on the landing path needs the speech plumbing.
      const { mountScriptStudio } = await import('./views/script-studio.ts');
      await mountScriptStudio(view, host as unknown as Parameters<typeof mountScriptStudio>[1], route.params);
      break;
    }
    case 'ask': {
      // Ask Lolly (#/ask) - in-app help over the docs + spotlight providers. Lazy:
      // it pulls the ask pipeline (retrieval, md extraction) that no other route needs.
      const { mountAsk } = await import('./views/ask.ts');
      await mountAsk(view, host as unknown as Parameters<typeof mountAsk>[1], route.params ?? '');
      break;
    }
    case 'docs': {
      // In-app docs reader (#/docs/<slug>) - fetches the built /info page and rehosts its
      // `.docs-content` fragment into #view. Lazy: it pulls no heavy deps, but stays off
      // the cold-load bundle like every other non-gallery view.
      const { mountDocs } = await import('./views/docs.ts');
      await mountDocs(view, host as unknown as Parameters<typeof mountDocs>[1], route.slug, route.lang, route.params ?? '');
      break;
    }
    // --- The private-collab ceremony links (plan 100 section 6.1, section 11.25). One lazy chunk
    // for both, shared with the Share dialog's "Start a collab" opener: WebRTC, the QR
    // encoder and the ceremony dialog have no business on any other route. ---
    case 'join': {
      const { mountJoinRoute } = await import('./collab/join-route.ts');
      await mountJoinRoute(view, host as unknown as Parameters<typeof mountJoinRoute>[1], route.params ?? '');
      break;
    }
    case 'join-reply': {
      // No host: this tab hands a payload to the tab that owns the ceremony and gets
      // out of the way - it opens no connection and reads no profile of its own.
      const { mountJoinReplyRoute } = await import('./collab/join-route.ts');
      await mountJoinReplyRoute(view, route.params ?? '');
      break;
    }
    case 'components': {
      // The browsable component library (#/components). Lazy - it's a dev/design
      // surface, off every hot path. Its back pill is the shared one - it names
      // and returns to the view you came from, or the gallery on a cold deep link.
      const { mountComponents } = await import('./views/components.ts');
      await mountComponents(view, host as unknown as Parameters<typeof mountComponents>[1], route.params);
      break;
    }
    case 'utilities':
      // The gallery in only-utilities mode: same view, same wiring, filtered to
      // the on-device utility tools (compress-pdf, strip-data, countdown-timer…).
      // The 'Offline Utilities' flag governs the WHOLE view now - off means no
      // tab and no route (a deep link lands on the main gallery).
      if (!flagEnabledSync(UTILITIES_FLAG_ID)) { window.location.replace('#'); return; }
      await mountGallery(view, host as unknown as Parameters<typeof mountGallery>[1], { only: 'utility', params: route.params });
      break;
    case 'gallery':
      await mountGallery(view, host as unknown as Parameters<typeof mountGallery>[1], { params: route.params });
      break;
    default:
      await mountGallery(view, host as unknown as Parameters<typeof mountGallery>[1]);
  }
  } catch (err) {
    console.error('View mount failed:', err);
    // Fade the outgoing snapshot out either way, so it can't linger over the
    // reload card (or the fresh shell after a stale-chunk reload).
    fade?.commit();
    if (import.meta.env.PROD && looksLikeChunkError(err)) { recoverFromStaleShell(); return; }
    showReloadCard('This view didn’t finish loading. Reload to try again.');
    return;
  }

  // The mount settled: its document.title is set and any URL canonicalisation
  // (the tool view's /t/<id> rewrite) is done - snapshot it as the candidate
  // "previous view" for the next navigation's back pill.
  noteMountedView(route.name);

  // Reconcile the persistent jelly tab pill (view-toggle.ts): listing views
  // show it (the pill slides to the active tab), everything else hides it.
  syncJellyNavToggle(navKeyForRoute(route.name));

  // After the view swaps, tell assistive tech and move focus into the new view
  // so keyboard/SR users aren't stranded on the now-removed element. (Within a
  // view, state changes use replaceState - no navigate - so focus isn't stolen.)
  // BUT if the view's own mount already placed focus on something meaningful
  // (e.g. /pro focuses its template search, which lives in a body-mounted
  // popover), don't yank it back to the container.
  // Land a newly-entered view at the top. A route-NAME change swaps the whole
  // view via innerHTML, so inheriting the previous page's scroll offset would
  // drop you mid-content (e.g. a scrolled gallery → capabilities). Skip the
  // tool→gallery "return" so that path keeps its current feel, and skip same-name
  // updates (those go through replaceState, not navigate, so they never reach here).
  if (route.name !== prevRouteName && !returning) {
    window.scrollTo(0, 0);
    view.scrollTop = 0;
  }

  // The incoming view is mounted and scrolled to top - fade the outgoing snapshot
  // out over it. A no-op when there was no fade (same-view refresh, reduced motion).
  fade?.commit();

  announceRoute(route.name);
  const af = document.activeElement;
  if (!af || af === document.body || af === view) {
    view.setAttribute('tabindex', '-1');
    view.focus({ preventScroll: true });
  }
}

// Route-scoped font preload for the mono-heavy dashboards (see navigate). Added
// once; the browser dedupes against the @font-face request that follows.
// index.html preloads this same face for everyone now, so on a SUSE build this is
// a no-op duplicate - it is still needed on any OTHER brand, where
// brandChrome() strips the static /fonts/SUSE preloads from index.html but SUSE
// Mono remains the shell-served platform mono.
function ensureMonoPreload(): void {
  if (document.getElementById('preload-suse-mono')) return;
  const l = document.createElement('link');
  l.id = 'preload-suse-mono';
  l.rel = 'preload';
  l.as = 'font';
  l.type = 'font/woff2';
  l.crossOrigin = 'anonymous';
  // Shell-served (fonts.css) - profile-independent. Spell the URL the way the
  // stylesheet THIS build ships spells it, or the preload matches nothing and
  // just fetches the 34.5 KB face a second time: vite runs public-file css urls
  // through encodeURI, so the built fonts.css asks for `%5Bwght%5D`, while the
  // dev server serves the literal brackets untouched. Same trap as the static
  // preloads in index.html - see fontPreloadUrls() in vite.config.js.
  const href = '/fonts/SUSEMono[wght].woff2';
  l.href = import.meta.env.PROD ? encodeURI(href) : href;
  document.head.appendChild(l);
}

// Update a dashboard's "N tools" stat in place after a cold fast-path paint, once
// the synced catalog carries a (newer) count. Patching beats re-navigating, which
// would replay the whole entrance cascade just to change a number. The view marks
// the stat with [data-tool-count] and hides it while the count is unknown.
function patchDashboardToolCount(): void {
  const n = window.__toolIndex?.tools?.length;
  if (n == null) return;
  document.querySelectorAll<HTMLElement>('[data-tool-count]').forEach((el) => {
    const strong = el.querySelector('strong');
    if (strong) strong.textContent = String(n);
    el.hidden = false;
  });
}

// Publish the visual viewport's offset (how far the zoomed/panned visible area
// sits from the layout viewport) as CSS vars. position:fixed pins to the LAYOUT
// viewport, so without this the mobile controls sheet drifts off-screen while
// the page is pinch-zoomed; the mobile sheet rules add --vv-top/--vv-left back.
// The other case that moves the visible area without moving the layout viewport
// is the soft keyboard, which --vv-bottom lifts bottom-pinned chrome clear of.
// Fixed-cost, polite (rAF-throttled), and a no-op when neither applies (0).
// The branch itself lives in lib/viewport-insets.ts, where it is testable.
function trackVisualViewport(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let raf = 0;
  // Last values written, to skip redundant setProperty calls. The common case - 
  // ordinary momentum scroll at scale 1, where the mobile URL bar fires
  // visualViewport scroll/resize - recomputes the same `0px` every frame;
  // re-writing inherited root custom props each time invalidates style document-
  // wide and shows up as micro-stutter on long pages. Memoising makes it a no-op.
  let lastTop: number | undefined, lastLeft: number | undefined, lastRight: number | undefined, lastBottom: number | undefined;
  const apply = () => {
    raf = 0;
    const { top, left, right, bottom } = computeViewportInsets({
      scale: vv.scale,
      innerHeight: window.innerHeight,
      clientWidth: root.clientWidth,
      clientHeight: root.clientHeight,
      vvWidth: vv.width,
      vvHeight: vv.height,
      offsetTop: vv.offsetTop,
      offsetLeft: vv.offsetLeft,
    });
    if (top === lastTop && left === lastLeft && right === lastRight && bottom === lastBottom) return;
    lastTop = top; lastLeft = left; lastRight = right; lastBottom = bottom;
    root.style.setProperty('--vv-top', `${top}px`);
    root.style.setProperty('--vv-left', `${left}px`);
    root.style.setProperty('--vv-right', `${right}px`);
    root.style.setProperty('--vv-bottom', `${bottom}px`);
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  apply();
}

/**
 * Mobile-app platform fit (plans/132, device-verified fixes 2026-08-22).
 * Tauri MOBILE webviews only - the browser PWA and the desktop shells are
 * untouched. Three corrections, each earned on a real phone:
 *
 * 1) Page pinch-zoom is disabled (Andy: it breaks the fixed chrome; zooming
 *    belongs to the surfaces that own it - the catalog preview and the canvas
 *    gestures). WKWebView honours user-scalable=no; Safari-the-browser ignores
 *    it for accessibility, but this is an app, whose text-size story is (3).
 * 2) env(safe-area-inset-*) fallback: the iOS 27 beta's WKWebView resolves the
 *    envs to 0 while drawing full-bleed, which put the back pill on top of the
 *    status clock. Probe env() through a live element; when it reads 0 on a
 *    notched iPhone, feed tokens.css's --safe-*-fb from the screen class
 *    (erring a few px generous - chrome sits a hair lower, never under glass).
 * 3) OS text size: iOS Dynamic Type does not reach web content, so probe the
 *    `-apple-system-body` font continuously and feed its full ratio (smaller
 *    and larger settings) into the existing --a11y-fs type/icon/control tokens.
 *    The in-app Large text preference composes with that live OS value.
 */
function initMobilePlatformFit(): void {
  if (!('__TAURI_INTERNALS__' in window)) return;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // iPad can have a fine primary pointer when a trackpad is attached.
  if (!ios && !matchMedia('(pointer: coarse)').matches) return;
  const root = document.documentElement;

  document.querySelector('meta[name="viewport"]')?.setAttribute(
    'content',
    'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no',
  );

  if (!ios) return;

  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;'
    + 'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);'
    + 'font:-apple-system-body';
  probe.textContent = 'x';
  root.appendChild(probe);
  const cs = getComputedStyle(probe);
  const envTop = parseFloat(cs.paddingTop) || 0;
  probe.remove();

  // The fallback classes are IPHONE-ONLY. An iPad has no notch: fullscreen
  // reports its real inset via env(), and a windowed app (Stage Manager)
  // truthfully has NO top inset - but its long edge (1366pt on the 13") falls
  // in the Dynamic-Island bucket below, which shoved the whole top chrome 62px
  // down over view controls like the catalog filters (Andy, 2026-08-23). So
  // when env() says 0 on an iPad, believe it.
  const iphone = /iP(hone|od)/.test(navigator.userAgent);
  if (envTop === 0 && iphone) {
    // Logical long-edge → top inset class: Dynamic Island (~59-62pt), notch
    // (~47-50pt), home-button classics (20pt status bar). Bottom: the home
    // indicator (34pt) on everything without a home button.
    const long = Math.max(screen.height, screen.width);
    const top = long >= 874 ? 62 : long >= 812 ? 50 : 20;
    const bottom = long >= 812 ? 34 : 0;
    root.style.setProperty('--safe-top-fb', `${top}px`);
    root.style.setProperty('--safe-bottom-fb', `${bottom}px`);
  } else if (envTop === 0) {
    // Windowed iPad (Stage Manager / Split View report no inset): the window's
    // traffic-light cluster and grab region overlay the top ~28pt of content,
    // and the scroll-edge blur forms in the same band - tool chrome (the Home
    // pill, sidebar header buttons) sat under them at 0. A modest constant
    // clears that band without the 62px iPhone-class shove that buried view
    // controls like the catalog filters (both found on-device 2026-08-23).
    // Fullscreen iPad never reaches this branch: env() reports its real status bar.
    root.style.setProperty('--safe-top-fb', '28px');
  }

  mountIOSTextScale(root);
}

/** Run `fn` once the critical load has finished. A client-side re-entry (or a
 *  late boot) is already 'complete', so run it straight away. */
function onWindowLoad(fn: () => void): void {
  if (document.readyState === 'complete') fn();
  else window.addEventListener('load', fn, { once: true });
}

/** …and then on the next idle slot: the components/featured-row.ts pattern, for
 *  work that is pure warming (correctness-neutral, no user waiting on it) and so
 *  must never compete with first paint for bandwidth or main thread. */
function afterLoadIdle(fn: () => void): void {
  onWindowLoad(() => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(fn);
    else setTimeout(fn, 200);
  });
}

async function boot(): Promise<void> {
  const host = await createBridge();
  // The optional deployment control plane's probe (src/org/) is up to a 1,500 ms
  // time-boxed fetch that no other boot step feeds - not i18n, not the catalog - so it
  // is started as early as it can correctly go and awaited at the gate far below
  // (plans/155 Task 3.4); awaiting it there used to serialise the probe after every
  // other boot step instead of alongside them. The gate semantics are unchanged: the
  // resolved value is what decides whether a `gated` deployment stops boot.
  //
  // "As early as it can CORRECTLY go" is the whole subtlety. The probe has exactly one
  // dependency, and it is not visible in its signature: every request it makes goes
  // through instancePath()/instanceFetch(), and both its negative cache and its cached
  // org-config are keyed by getInstanceBase() (org/index.ts). Fire it before the base
  // has loaded and a shell pointed at a remote deployment probes its OWN origin and
  // files the answer under the wrong key - a shell configured for an instance would
  // silently boot as if that instance had no control plane. So the probe hangs off
  // initInstanceBase(), which is memoised (catalog/sync.ts awaits the same promise, so
  // this costs one shared IndexedDB read, not two) and never throws.
  //
  // On a Tauri shell the base has a SECOND source: the first-run instance sheet below,
  // whose whole job is to set it, and which cannot be known until the user answers. So
  // there the probe waits for that sheet - i.e. keeps the position it always had -
  // and starting initInstanceBase early is itself skipped, since its read would race
  // the sheet's setInstanceBase() write. Web/PWA never shows the sheet, and is where
  // the overlap was worth having.
  let releaseOrgProbe!: () => void;
  const orgPromise = new Promise<void>(resolve => { releaseOrgProbe = resolve; }).then(() => initOrgProbeFirst());
  if (!isTauriShell()) void initInstanceBase().then(releaseOrgProbe, releaseOrgProbe);
  trackVisualViewport();
  initMobilePlatformFit();
  // Native app menus (Tauri shells): the iPadOS menu bar / macOS menu drive
  // the tiny window.__lollyMenu surface this registers. The web build never
  // loads the module, and boot never waits on it.
  if ('__TAURI_INTERNALS__' in window) {
    void import('./lib/app-menu.ts').then(m =>
      m.initAppMenu(host as unknown as Parameters<typeof m.initAppMenu>[0]));
    // The desktop integration poll loop (lolly:// links, double-clicked .lolly
    // files, tray/search activations) is installed further down, after the first
    // navigate has resolved - see the drop-router block there.
    // Tauri shells never send a Referer: the app origin (http://tauri.localhost)
    // is worthless to any external host and trips anti-localhost hotlink rules -
    // SomaFM's icecast 403s media requests carrying it, which silently killed
    // radio on Android (device-verified 2026-08-24). The DOCUMENT policy is the
    // only lever that works there: Android WebView ignores the per-element
    // referrerPolicy attribute for media loads but honours this meta. Web/PWA
    // deploys keep their normal referer behaviour.
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
  }

  // The global async-job progress toast (plans/124 WP-F). Mounted on document.body
  // OUTSIDE main#view, so it survives every router view teardown - a video/retouch
  // job keeps showing progress after the user leaves the catalog. Idempotent; owns
  // nothing until startJob() is first called.
  //
  // After the critical load, not during it (plans/155 WP-3): a job is always
  // downstream of a user gesture that is many seconds away, and mountJobToast's own
  // last line is `render(jobsSnapshot())` - so a job somehow started first is picked
  // up by the mount rather than missed by it.
  onWindowLoad(() => { void import('./lib/job-toast.ts').then(m => m.mountJobToast()); });

  // Installing the PWA re-arms the one-time offline nudge (views/offline-nudge.ts):
  // an install puts an icon on the device while precaching only the shell, so a
  // user who installs reasonably believes "I have the app now" - and must hear
  // "not all of it, yet" once more, in the installed app's sharper copy, even if
  // they dismissed the browser-tab nudge earlier. One profile write, best-effort.
  window.addEventListener('appinstalled', () => {
    void (async () => {
      try {
        // The web bridge's profile setter - not on the tool-facing ProfileAPI,
        // same structural slice the a11y prefs and the nudges themselves use.
        const profileApi = host.profile as { get(): Promise<Profile>; set?(p: Profile): Promise<void> };
        const current = await profileApi.get();
        if (!current.offlineNudgeDismissed) return;   // nudge is still armed anyway
        await profileApi.set?.({ ...current, offlineNudgeDismissed: false });
      } catch { /* best-effort - worst case the nudge simply doesn't reappear */ }
    })();
  });

  // Loopback-only tooling hook: the docs-screenshot pipeline (scripts/
  // build-docs-shots.ts) prints an app page to PDF in its Chromium, then asks the
  // app itself to convert that print into a self-contained true-vector SVG
  // (lib/pdf-vector-shot.ts - the same interpreter the design-import path ships,
  // plus in-page font outlining/inlining only the app can do). Registered HERE,
  // after the host (with its text shaper) exists, and closing over it, so text
  // outlines to <path>. Gated to loopback so it never becomes deployed surface;
  // lazy import, so a normal session pays nothing for it.
  if (/^(?:127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname)) {
    // `opts` (today: cropCssPx - the region the caller will keep, so the interpreter
    // can drop nodes that provably can't paint there before decoding rasters and
    // shaping text) is optional and passed straight through, so an older harness
    // calling with one argument against a newer dist keeps working.
    (window as unknown as { __lollyVectorShot?: (b64: string, opts?: unknown) => Promise<unknown> }).__lollyVectorShot =
      (b64: string, opts?: unknown) => import('./lib/pdf-vector-shot.ts').then((m) => m.pdfToVectorSvg(
        b64,
        host as unknown as Parameters<typeof m.pdfToVectorSvg>[1],
        (opts ?? {}) as Parameters<typeof m.pdfToVectorSvg>[2],
      ));

    // Sibling loopback hook, same gate: run the DIRECT HTML→SVG walker (the export
    // bridge's renderSvgFromHtml - the path every tool export takes) over an
    // arbitrary page subtree, with NO print-to-PDF in between. Built for the
    // vector-render audit (plans/69-svg-snapshot-without-print.md), and since the
    // walker migration it is ALSO how the docs pipeline captures a `walker=1`
    // recipe - `scripts/build-docs-shots.ts` calls this, not __lollyVectorShot.
    (window as unknown as { __lollyWalkerShot?: (sel?: string) => Promise<unknown> }).__lollyWalkerShot =
      async (sel = 'body', o: Record<string, unknown> = {}) => {
        const node = document.querySelector(sel);
        if (!node) throw new Error(`__lollyWalkerShot: no element matches ${sel}`);
        const t0 = performance.now();
        // convertPaths / rasterFallback are web-bridge ExportOpts, wider than the
        // portable HostV1 ExportOpts this call is typed against - hence the cast.
        // elementScopedRaster: a page snapshot must degrade LOCALLY. Without it one
        // conic-gradient or backdrop-filter on a top-level container rasterises the
        // whole page (measured: 100% raster coverage on two audit fixtures).
        // stackingOrder: a page snapshot must paint in CSS stacking-context order
        // (Appendix E section E.2), not DOM order. Lolly's own gallery has 99 non-auto
        // z-indexes, 22 of them negative, so DOM order puts scrims over content
        // and cards in reverse. Off for tool exports - see ExportOpts.
        // layerIds: this is the production caller plans/104 section 7 was written for - 
        // "Lolly screenshots become semantically explodable … url-shot output then
        // lifts along real UI boundaries (nav/hero/cards)". The passthrough is inert
        // unless the walked element already carries `data-box-id`, so it changes
        // nothing on a page without a canvas; where it does, the resulting SVG lifts
        // along the boxes the canvas knows about instead of along whatever the markup
        // happened to group, and `enumerateSvgLayers` hands each id back as
        // `layer.boxId` for the lift dialog to name the row with. A caller that wants
        // the old bytes passes `{ layerIds: false }` - `o` is spread last.
        const blob = await host.export.render(node, 'svg', { convertPaths: true, elementScopedRaster: true, stackingOrder: true, backdropBlur: true, layerIds: true, ...o } as Parameters<typeof host.export.render>[2]);
        return { svg: await blob.text(), ms: Math.round(performance.now() - t0) };
      };

    // Third loopback hook, same gate: install a DTCG tokens document as the
    // user's brand through the #/start wizard's own chokepoint (installUserTokens)
    // and repaint the chrome from it, so a capture harness can pose the app in
    // any design system. scripts/build-covers.ts poses the landing's Cover Flow
    // with it - one derived brand per cover, a hue apart. Lazy imports, so a
    // normal session pays nothing; the brand lock still applies (a locked pack
    // refuses the install exactly as it refuses the wizard).
    (window as unknown as { __lollyInstallBrand?: (doc: unknown, label?: string) => Promise<void> }).__lollyInstallBrand =
      async (doc: unknown, label = 'Posed brand') => {
        const [{ installUserTokens }, { applyChromeBrandVars }] = await Promise.all([
          import('./bridge/tokens.ts'),
          import('./brand-vars.ts'),
        ]);
        await installUserTokens(host as unknown as Parameters<typeof installUserTokens>[0], doc, { label });
        await applyChromeBrandVars(host);
      };
  }

  // Chrome follows the brand: override the theme accent triples from the active
  // brand's semantic primary (a doc with no semantic slots - SUSE's - leaves the
  // hardcoded chrome). Fire-and-forget; the accents refine in place once tokens land.
  // User fonts first: --font-brand may name a locally-stored Google Font, so its
  // FontFaces should be in document.fonts by the time the stack applies (both are
  // async and best-effort - worst case the face pops in a beat later).
  // register-user-fonts + load-user-fonts (and its font-utils/font-asset-handler chain)
  // are dynamic-imported off the boot path - this was already fire-and-forget, so a
  // locally-stored --font-brand face applying a beat later is the same tolerated swap.
  void import('./lib/register-user-fonts.ts')
    .then(async ({ registerUserFonts }) => {
      await registerUserFonts(host as unknown as Parameters<typeof registerUserFonts>[0]);
      const { loadUserFonts } = await import('./lib/load-user-fonts.ts');
      await loadUserFonts(host);
    })
    .finally(() => {
      // brand-vars.ts is 3.6 KB gz of colour maths (it reaches engine tokens +
      // brand-derive) for an effect that was ALREADY unordered: it refines the
      // chrome accents in place whenever it resolves. Static-importing it only to
      // call it from inside a dynamic import's .finally() put those bytes on the
      // preload set for every visitor and bought nothing (plans/155 WP-3).
      void import('./brand-vars.ts').then(m => m.applyChromeBrandVars(host));
    });

  // Profile is the canonical theme store. Apply it now so the theme is correct
  // before the first view renders. Also keeps localStorage in sync for FOUC.
  const profile = await host.profile.get();
  const profileTheme = (profile as { theme?: string }).theme;
  if (profileTheme) applyTheme(profileTheme, false);
  // …unless the URL asked for a theme: a `?theme=` override outranks the stored
  // preference for this page load, and is still never written back anywhere.
  if (urlTheme) document.documentElement.dataset.theme = urlTheme;

  // Accessibility prefs ride the profile the same way (localStorage is only
  // their FOUC mirror, applied by the index.html inline script) - reconcile.
  hydrateA11yPrefs(profile.a11y);
  // Same for "Interface follows the design system" (plans/182 section 5.6). The
  // chrome accent above is applied off the device mirror, unordered with this
  // read; a profile that disagrees repaints once, through the same painter.
  if (hydrateChromeFollow((profile as { appearance?: { followDesignSystem?: boolean } }).appearance?.followDesignSystem)) {
    void import('./brand-vars.ts').then(m => m.applyChromeBrandVars(host));
  }
  // One-time migration: "Hide previews" used to be a device-local gallery toggle
  // (localStorage 'lolly-hide-previews'); it is now the hidePreviews a11y pref.
  // Carry an ON choice into the profile once, then retire the old key.
  try {
    if (localStorage.getItem('lolly-hide-previews') === '1' && !currentA11yPrefs().hidePreviews) {
      await setA11yPref(host, 'hidePreviews', true);
    }
    localStorage.removeItem('lolly-hide-previews');
  } catch { /* storage off - nothing to migrate */ }

  // Language - same precedence chain as the theme, plus a session-only `lang`
  // URL override (never written back to the profile - see i18n.ts). NOT awaited
  // before the first navigate() any more (plans/155 Task 3.7): every language but
  // English loads a 108-205 KB gz locale chunk, and blocking here put that whole
  // download in front of first paint for the majority of the world. English IS the
  // key - an unresolved catalog renders every t() as its English source string - so
  // boot paints English and the continuation below re-renders once the chunk arrives,
  // exactly the way the catalog sync's own late arrival is handled. The pre-paint
  // script in index.html has already stamped <html lang>/dir from the localStorage
  // mirror, so a right-to-left locale still starts out in the right direction.
  const i18nReady = initI18n({ urlLang: peekUrlLang(), profileLang: (profile as { lang?: string }).lang })
    // Boot used to die on the error card if this threw (the bare localStorage read
    // inside initI18n raises in a storage-blocked browser). Now that no paint waits
    // on it, a failed language resolve must not cost the user their app: log, stay
    // in English. Attached HERE, not at the continuation below, so the rejection is
    // never momentarily unhandled.
    .catch((err: unknown) => { console.error('Language init failed - staying in English:', err); });

  // Interface sounds: the profile is the canonical mute store (like the theme). Reconcile
  // the sfx layer's localStorage-derived flag with the profile's value once it has loaded,
  // then install the one set of app-wide, delegated cue listeners (idempotent).
  hydrateSfxMuted((profile as { sfxMuted?: boolean }).sfxMuted);
  hydrateSfxVolume((profile as { sfxVolume?: number }).sfxVolume);
  installGlobalSfx();
  installGlobalReveal();
  // Jelly effects are opt-in (JELLY_FLAG.default is false, feature-flags.ts), so
  // the mirror below bakes the OFF default and a user's toggle is the only thing
  // that arms the bundle. There is no brand-lock reconcile any more.
  // Mirror the profile's feature flags to localStorage so surfaces that render before
  // (or without) the profile - the Sound control's Neurospicy player in popovers - can
  // gate synchronously.
  hydrateFeatureFlags(profile as Parameters<typeof hydrateFeatureFlags>[0]);
  // Reflect the Performance UI flag onto <html> from first paint (the index.html
  // pre-paint script already did this from the mirror; this reconciles it against the
  // just-hydrated profile). Opt-in, so default OFF ⇒ attribute absent ⇒ full chrome.
  applyPerfUi(isFlagOnSync(PERFORMANCE_UI_FLAG));
  // The persistent bottom search bar (plans/99 M1) - one instance for the whole
  // session, mounted after #view. Needs the flag mirror (hydrateFeatureFlags above,
  // for the Pro link); hidden until the first navigate() below applies the route's
  // footer mode. Its copy renders in whatever language t() has resolved by now -
  // English while a locale chunk is still in flight (Task 3.7) - and claimSearchBar
  // re-renders the bar when the placeholder changes, so the post-locale re-navigate
  // repaints it without a second init.
  initSearchBar();
  // The spotlight overlay (plans/99 M2): hooks into the bar synchronously (the
  // chord + combobox semantics from first paint) and lazy-loads BOTH the overlay
  // and its provider set off the boot path - see components/spotlight-boot.ts for
  // why that is a shim rather than a deferral. Must follow the bar init above - it
  // registers into it.
  initSpotlightBoot(host);
  // An automated screenshot run pins neutral chrome: effect flags off, a11y prefs
  // clear. It has to land HERE - after the line above rewrites the flag mirror from
  // the profile (which discards anything seeded earlier), and before the two reads
  // just below act on it. Inert for everyone else. See lib/capture-neutral.ts.
  const captureNeutral = applyCaptureNeutral();
  if (captureNeutral) console.info('[lolly] neutral capture state pinned');
  // Neurospicy Mode + Atmosphere beds - reconcile the saved focus-loop / bed state,
  // then (only if enabled and left on) arm a one-shot gesture to resume, since audio
  // can't autoplay before a gesture. Both modules (lib/neurospicy.ts + lib/atmosphere.ts,
  // which statically couple through neuroAudioContext) are DEFERRED off the boot path:
  // they default OFF, and even for a flag-on user nothing here is needed before first
  // paint - arm only installs a gesture listener, hydrate is pure state. The import is
  // kicked here (after hydrateFeatureFlags + applyCaptureNeutral have settled the flag
  // mirror) so the listener installs ahead of the user's first pointerdown; a first
  // gesture landing in the ~ms import window would miss a one-time resume, which affects
  // only the flag-on minority. The ?neuro docs deep-link runs INSIDE the .then, AFTER the
  // hydrates (they'd overwrite its in-memory demo state) and after applyCaptureNeutral.
  //
  // Deferred is not the same as free: two chunks were still fetched at boot for EVERY
  // user, and the flag is opt-OUT (on by default), so gating on it changed nothing.
  // What actually decides whether there is anything to do here is whether the profile
  // carries state for either mode - both are profile-canonical (the localStorage copy
  // is only a mirror, written alongside the profile), so "no state" means the user has
  // never turned one on: nothing to hydrate, no arm that isn't an early return, and no
  // dock. Those users pay nothing at boot now and load the modules on first use, from
  // the Sound control's own imports (plans/155 Task 3.3).
  const neuroDemo = peekNeuroDemo();
  const neuroState = (profile as { neurospicy?: unknown }).neurospicy !== undefined
    || (profile as { atmosphere?: unknown }).atmosphere !== undefined;
  if (neuroState || neuroDemo) {
    void Promise.all([import('./lib/neurospicy.ts'), import('./lib/atmosphere.ts')]).then(([neuro, atmo]) => {
      neuro.hydrateNeurospicy((profile as { neurospicy?: unknown }).neurospicy);
      atmo.hydrateAtmosphere((profile as { atmosphere?: unknown }).atmosphere);
      if (neuroDemo) void import('./lib/neuro-demo.ts').then(d => d.applyNeuroDemo(host as unknown as Parameters<typeof d.applyNeuroDemo>[0], neuroDemo));
      if (flagEnabledSync('neurospicy')) {
        neuro.armNeurospicy(host as unknown as Parameters<typeof neuro.armNeurospicy>[0]);
        atmo.armAtmosphere(host as unknown as Parameters<typeof atmo.armAtmosphere>[0]);
        // Show the bottom-right dock if the mode was left on. The dock (and the music
        // player inside it) is dynamic-imported and only when the mode is actually enabled.
        if (neuro.getNeurospicy().enabled) {
          void import('./components/neuro-dock.ts')
            .then(m => m.syncNeuroDock(host as unknown as Parameters<typeof m.syncNeuroDock>[0]));
        }
      }
    });
  }
  // Jelly effects - start the lazy bundle load now, racing the rest of boot
  // (catalog sync + first view mount) rather than blocking or idle-deferring:
  // surfaces check the synchronous jellyActive() gate at paint, and a
  // same-origin ~52 KB chunk usually wins that race (always, once the service
  // worker has it). If it loses, that first render shows the plain controls - 
  // and the .then() below retrofits the persistent nav pill for the view that
  // already mounted. Flag-off users never fetch the chunk. Named, because the
  // brand-lock reconcile below can turn the flag on after this line has run and
  // must arm jelly the same way (ensureJelly is idempotent - one shared promise).
  const armJelly = (): void => {
    if (jellyEnabled()) void ensureJelly().then(ok => { if (ok) syncJellyNavToggle(navKeyForRoute(parseRoute().name)); });
  };
  armJelly();
  // Sliders. Deferred off the boot path (no native range paints on the gallery's
  // first frame; the upgrader is a MutationObserver + one initial document sweep, so a
  // late install still catches every range already mounted). Idle-scheduled after the
  // flag hydration above, because the egg-trail is flag-gated and a slider reads that
  // once, when it mounts. Not gated itself: `.custom-slider` is the app's slider in
  // both modes, and the chrome's plain ranges become one wherever they mount.
  const upgradeSliders = (): void => { void import('./components/custom-slider.ts').then(m => m.installRangeUpgrader()); };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(upgradeSliders); else setTimeout(upgradeSliders, 200);
  // EVERY user-asset delete funnels through the bridge, which announces it here - 
  // an audio delete must also leave the music player (stopping it, or advancing,
  // if it was the sounding track), no matter which surface deleted it (catalog,
  // picker, the saved-sessions folder overlay, Projects). Not gated on the feature
  // flag: purging dead cache entries is correct even while the player is hidden.
  document.addEventListener('lolly:user-asset-deleted', (e) => {
    const d = (e as CustomEvent<{ id?: string; type?: string }>).detail;
    const id = d?.id;
    if (d?.type === 'audio' && id) {
      void import('./lib/neurospicy.ts').then(m => m.dropNeurospicyTracks(host as unknown as Parameters<typeof m.dropNeurospicyTracks>[0], [id]));
    }
  });

  // Prime the in-memory tool index from the last cached copy so the gallery can
  // paint immediately, before the network catalog sync resolves. syncCatalog
  // overwrites window.__toolIndex with fresh data when it lands. (Mirrors the
  // 'sbt-tool-index' fallback key written by catalog/sync.js.) localizeToolIndex
  // overlays the active language's names/descriptions - a no-op while the locale
  // catalog is still in flight (Task 3.7 stopped awaiting it), which is why the
  // continuation after the first navigate re-runs it once the locale resolves.
  if (!window.__toolIndex) {
    try {
      const cached = localStorage.getItem('sbt-tool-index');
      if (cached) {
        const primed = JSON.parse(cached);
        localizeToolIndex(primed);
        window.__toolIndex = primed;
      }
    } catch { /* ignore corrupt/oversized cache */ }
  }

  // No cached index = a genuinely cold visit, and the ONE case where the first
  // gallery paint has nothing to draw until the network answers. The slim index
  // (plans/155 Task 3.8) is ~19 KB gz against the full index's 168, already in flight
  // from index.html's preload, and the race below paints from whichever of the two
  // answers first. Skipped entirely for everyone who has a cache, so no repeat visitor
  // pays for a fetch they won't read.
  //
  // WHEN it starts follows the same rule as the org probe above, and for the same
  // reason: loadSlimToolIndex awaits initInstanceBase(), so starting it here on a
  // Tauri shell would fire that memoised IndexedDB read against the first-run sheet's
  // setInstanceBase() write - a race whose loser decides both which deployment's
  // catalog this cold paint comes from and, if the read resolves late, what base every
  // later caller sees. On web/PWA the sheet never shows, the base has exactly one
  // source, and the overlap with the sheet + probe is the whole point of the slim
  // index, so it starts here; on Tauri it starts below, once the sheet has settled
  // the base for good. Correctness costs Tauri nothing measurable - the sheet is one
  // fast IndexedDB read on every boot after the first.
  const coldGallery = !window.__toolIndex;
  let slimIndexReady = coldGallery && !isTauriShell() ? loadSlimToolIndex() : null;

  // First-run instance choice (Tauri shells only, once): gate BEFORE the first
  // catalog sync so a chosen instance is honoured immediately instead of a
  // bundled sync followed by a second one. A no-op (one fast IndexedDB read,
  // no dialog) on every later boot and on every non-Tauri shell - see
  // components/instance-sheet.ts's own header for the two callers (this gate,
  // and the profile "Change" button later).
  await maybeShowFirstRunInstanceSheet(host);
  // The instance base is now settled for good - the sheet above is its only other
  // source - so release the control-plane probe on the shells that were waiting for
  // it (see the orgPromise block at the top of boot). A no-op on web, where the base
  // resolved long ago and the promise is already released; on Tauri this is the first
  // initInstanceBase() call, made AFTER the sheet so it cannot race the sheet's write.
  void initInstanceBase().then(releaseOrgProbe, releaseOrgProbe);
  // ...and for the same reason, this is where a Tauri shell's cold-visit slim index
  // starts: after the sheet, so it reads the base the user just chose rather than
  // racing it. Web already started it above and this is a no-op there.
  if (coldGallery && isTauriShell()) slimIndexReady = loadSlimToolIndex();

  // First-run desktop models sheet (Tauri shells only, once): offer to pre-download
  // the heavy on-device AI image models from the model host (VITE_MODELS_BASE) so
  // background removal / upscaling work instantly and offline. Non-blocking - it
  // floats over the gallery as it paints, and is a fast no-op on web, CLI, and
  // every later boot. See components/models-welcome.ts. The gate is HERE (not only
  // inside the sheet, which re-checks it) so the module - and lib/offline-manager.ts
  // + the model-catalog chain behind it - is imported on Tauri alone and never joins
  // the web shell's boot graph (plans/155 Task 3.3).
  if (isTauriShell()) {
    void import('./components/models-welcome.ts').then(m => m.maybeShowModelsWelcome());
  }

  // Sideloaded tools (installed from a .lolly) are spliced into the tool index the moment
  // the catalog lands, so they appear in the galleries/pickers and pass the tool view's
  // existence check. Part of catalogReady so the first gallery paint already includes them.
  const catalogReady = syncCatalog(host as unknown as Parameters<typeof syncCatalog>[0])
    .then(async () => { try { await mergeInstalledToolsIntoIndex(); } catch { /* no installed tools / no index yet */ } });
  // Core-asset warming: 32 fetches / ~787 KB, fire-and-forget, and nothing on screen
  // waits for any of it. Firing at catalog-land put it in direct competition with the
  // first viewport's preview art, so it waits for load + idle now (plans/155 Task 3.6,
  // the components/featured-row.ts pattern) - same work, after the paint that matters.
  catalogReady.then(() => afterLoadIdle(() => { void syncCorePrefetch(host as unknown as Parameters<typeof syncCorePrefetch>[0]); }));
  // Hosted design systems (plans/186 section 3.6): once a day, and when the tab
  // comes back to the front after a day away, ask each host whether its design
  // system moved. Idle-scheduled and best-effort - a host that is away, or a
  // browser build whose CSP cannot reach it, answers "unreachable" and nothing
  // else changes. A change while a system is ACTIVE repaints through the switch.
  const checkHosted = (): void => {
    void import('./lib/design-system/hosted.ts').then(async m => {
      const outcomes = await m.checkHostedDesignSystems(host as unknown as Parameters<typeof m.checkHostedDesignSystems>[0]);
      const activeId = await (host as unknown as { designSystems?: { activeId(): Promise<string> } }).designSystems?.activeId();
      if (activeId && outcomes[activeId] === 'updated') {
        const { switchDesignSystem } = await import('./lib/design-system/switch.ts');
        await switchDesignSystem(host as unknown as Parameters<typeof switchDesignSystem>[0], activeId, { route: parseRoute().name });
      }
    }).catch(() => { /* no registry on this host */ });
  };
  catalogReady.then(() => afterLoadIdle(checkHosted));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkHosted(); });
  // The Neurospicy dock mounts ABOVE, before this sync starts - on a cold install its
  // track list would be built from a not-yet-synced catalog. Rebuild it once assets land.
  // Same `neuroState` gate as that mount (Task 3.3): with the module never loaded there
  // is no stale track list to invalidate and no persisted selection to heal - it loads
  // on first use, against the synced catalog. Without the gate this line pulled the
  // chunk back onto every boot, since the flag is ON by default for everyone.
  catalogReady.then(async () => {
    if (!neuroState || !flagEnabledSync('neurospicy')) return;
    const m = await import('./lib/neurospicy.ts');
    m.invalidateNeurospicyTracks();
    // Now that the real track list has landed, heal a persisted selection pointing at an
    // asset we've since retired from the catalog (it would otherwise sit enabled-but-silent).
    await m.reconcileNeurospicySelection(host as unknown as Parameters<typeof m.reconcileNeurospicySelection>[0]);
  }).catch(() => { /* offline boot - cache-skip above already re-queries */ });

  // First-run seed: give a brand-new user the catalog's curated default asset favourites
  // (see catalog/assets/index.json → defaultFavourites) so those headshots are pinned in
  // the "Favourites" section at the top of every picker on their first visit. One-time and
  // best-effort - only when the user has NEVER set asset favourites (an explicit choice,
  // including clearing them all, leaves favouriteAssets defined and always wins). Runs after
  // the asset sync so the id list is populated; the profile write is a single idempotent put.
  catalogReady.then(async () => {
    if (profile.favouriteAssets !== undefined) return;
    const ids = defaultFavouriteAssetIds();
    if (ids.length) await saveFavouriteAssets(host as unknown as Parameters<typeof saveFavouriteAssets>[0], profile, new Set(ids));
  }).catch(() => { /* seeding is best-effort; a failed write just means no pins this run */ });

  // The console's one informative "ready" line, printed once the catalog lands.
  // With the low-level diagnostics gone (dev-only / prod-suppressed), a normal
  // load reads cleanly: the greeting above, then this. Purely cosmetic, wrapped
  // so it can never surface as an error.
  catalogReady.then(() => {
    const tools = window.__toolIndex?.tools?.length;
    console.log(
      `%cLolly ready%c  ${tools ?? '-'} tools · works offline · lolly.tools/docs`,
      "font:600 12px 'SUSE Mono',ui-monospace,monospace;color:#e0457b",
      "font:400 12px 'SUSE Mono',ui-monospace,monospace;color:#8a94a0",
    );
  }).catch(() => { /* the summary is cosmetic; never surface as a failure */ });

  // The gallery can paint instantly from a CACHED index, then silently refresh
  // when the network sync lands. But a brand-new user has no cache, and painting
  // { tools: [] } would flash the gallery's *failure* empty-state ("couldn't
  // load the tools - check your connection") during a sync that's actually
  // succeeding. So only take the fast path when we already have an index;
  // otherwise wait for the sync (it resolves even offline, falling back to cache)
  // so the first paint is real data, not a false error. Deep links to a
  // tool/profile/etc. need the synced catalog (asset metadata) before their first
  // render, so those keep the original "sync, then navigate" ordering.
  // Paint instantly from cache instead of blocking on the full catalog network
  // sync, then reconcile when it lands. The gallery and the dashboard need a
  // CACHED index (gallery would otherwise flash its load-failure empty state
  // mid-sync; the dashboard would briefly show "none loaded" for its catalogue
  // breakdown) - but the dashboard still fast-paths without one, since its one
  // urgent live value is a tool count that's gracefully hidden when absent and
  // patched in place once synced. Deep-linked /tool and /profile keep the
  // sync-then-navigate ordering: they genuinely need synced asset metadata first.
  // Optional deployment control plane (src/org/): dormant + byte-identical to
  // today when a deployment provides no org-config endpoint (the public case) - 
  // one tolerant, time-boxed probe, remembered so later boots skip even that. A
  // `gated` deployment with no signed-in member renders its own sign-in gate in
  // place of the app and returns `gate: true`; stop boot before any view mounts.
  // Built-in cloud send targets used to be registered right here, ahead of initOrg.
  // They aren't registered at boot at all any more (plans/155 Task 3.3): eight OAuth
  // cloud drivers, ~59 KB (nextcloud-send alone is 25 KB), for a capability that first
  // matters when an export panel opens - and on most builds never, since each is
  // dormant without its own config. lib/send-targets-builtin.ts is loaded ON DEMAND by
  // the export panel now (views/tool-actions.ts, ensureBuiltinSendTargets), which is
  // both the first surface to consult the registry and the only one that can tell the
  // user their destinations arrived late. A boot-time idle slot was tried first and is
  // NOT the answer: the panel reads the registry once, at mount, with no change
  // notification, so anyone opening a tool before that callback fired got no Send
  // section at all.
  const org = await orgPromise;
  if (org?.gate) return;

  const routeName = parseRoute().name;
  // A cold gallery visit gets ONE extra chance before it falls back to waiting on the
  // whole catalog sync: whichever of the slim index and the full sync resolves first
  // (plans/155 Task 3.8). Racing them is what makes this safe to add - the slim fetch
  // has no retry and no timeout of its own, so awaiting it alone could hold boot
  // longer than today; against catalogReady (which resolves even offline, falling back
  // to cache) this can only ever be faster. When the full sync wins, slimPainted stays
  // false and the fastPath decision below is byte-identical to what it always was, so
  // we don't register a re-render for data that was already in hand at paint time.
  const haveFullIndex = !!window.__toolIndex;
  let slimPainted = false;
  if (routeName === 'gallery' && !haveFullIndex && slimIndexReady) {
    slimPainted = !!(await Promise.race([slimIndexReady, catalogReady.then(() => null)]));
  }
  const fastPath =
    ((routeName === 'gallery') && (haveFullIndex || slimPainted)) ||
    routeName === 'dashboard';

  // The one re-render path for everything that arrives AFTER the first paint - the
  // catalog sync, and (Task 3.7) the locale catalog. Both go through here so two
  // arrivals can't run navigate() concurrently: each would tear down the view the
  // other was mounting. Collapsed within a tick, serialised across ticks.
  let refreshQueued = false;
  let refreshing: Promise<void> = Promise.resolve();
  const refreshMountedView = (): void => {
    if (refreshQueued) return;
    refreshQueued = true;
    refreshing = refreshing.then(() => {
      refreshQueued = false;
      return navigate(host, { force: true });
    }).catch(console.error);
  };

  // Which language the first paint actually rendered in - loadedLang(), the language
  // whose catalog t() was answering from, NOT currentLang(). initI18n set the REQUESTED
  // language synchronously hundreds of lines above, so currentLang() already reads 'es'
  // for a Spanish visitor whose chunk is still in flight and whose paint is therefore
  // English: sampled here it would equal itself at the comparison below and the
  // re-render would never fire (i18n.ts's loadedLang carries the same warning). Read as
  // late as possible - the else-branch below waits on the whole catalog sync first,
  // which is long enough for the locale chunk to land before the paint, and
  // re-rendering then would be pure churn.
  let paintedLang = loadedLang();
  const firstNavigate = async (): Promise<void> => {
    paintedLang = loadedLang();
    await navigate(host, { force: true });
  };

  if (fastPath) {
    await firstNavigate();
    catalogReady.then(() => {
      const now = parseRoute().name;
      // A slim first paint ALWAYS has an upgrade waiting for it - descriptions,
      // example strips, templates, translations - so it re-renders whatever the
      // content compare says. (toolIndexChanged() can't stand in for that: it is
      // false whenever localStorage is unreadable, which is exactly a session that
      // had no cache to paint from either.)
      if (!slimPainted && !toolIndexChanged()) return; // no-op sync - data is byte-identical to the cached copy
      if (now === 'gallery') {
        // Re-render from fresh data - the gallery's cascade only replays because
        // the data actually changed (guarded above), not on every sync. force: the
        // route is unchanged (gallery→gallery), so the dedup would otherwise skip it.
        refreshMountedView();
      } else if (now === 'dashboard') {
        // Patch the tool count in place. Re-navigating would replay the entrance
        // cascade just to update a number - the exact jitter we're removing. The
        // catalogue tile breakdown refreshes on the next visit.
        patchDashboardToolCount();
      }
    });
  } else {
    await catalogReady;
    await firstNavigate();
  }

  // The locale catalog is the second thing that can land after the first paint, and
  // it gets the same treatment as the first (Task 3.7): re-overlay the tool index's
  // translated names - localizeToolIndex is idempotent and stashes the pristine
  // English once - then re-render the mounted view through the shared path above.
  // Attached HERE, after the first navigate has resolved, so it can never race it;
  // nothing to do when the language never moved off what that paint rendered.
  void i18nReady.then(() => {
    if (loadedLang() === paintedLang) return;
    if (window.__toolIndex) localizeToolIndex(window.__toolIndex);
    // Only the stateless listing views are re-mounted. A tool / batch / projects view
    // can already hold work the user started (and a tool re-mount re-runs loadTool +
    // createRuntime), so it keeps its English chrome until the next navigation rather
    // than being torn down under them. In practice none of them reach this line
    // anyway: every route but the gallery/dashboard fast path waits for the whole
    // catalog sync first, which a locale chunk comfortably beats.
    const now = parseRoute().name;
    if (now === 'gallery' || now === 'utilities' || now === 'dashboard') refreshMountedView();
  });

  // Device sync (plans/138 B1), both best-effort and after the first paint: arm the
  // debounced auto-push (silent no-op while sync is off), then offer to apply a
  // snapshot a sibling device left newer. Never blocks boot.
  const syncDeps = (): BackupDeps => ({ host: host as unknown as BackupDeps['host'], storage: localStorage });
  initSyncAutoPush(syncDeps);
  void maybeApplyNewerAtBoot(syncDeps());

  // Android share-target (ACTION_SEND → Lolly): poll the native stash and route
  // shared files through the universal drop chooser. Placed after the first
  // navigate so a cold-start share opens its sheet over a painted view, not the
  // boot skeleton; runs regardless of which view mounted (the chooser is
  // body-mounted). A feature-detected no-op everywhere but the Android WebView.
  // drop-router (the sniff + chooser module) is itself dynamic-imported off the boot
  // path now - its heavy import/ingest deps were already lazy. Hold the resolved module
  // so the footer "Open" button below can call it SYNCHRONOUSLY inside the click gesture.
  let dropRouterMod: typeof import('./lib/drop-router.ts') | null = null;
  const dropRouterReady = import('./lib/drop-router.ts').then((m) => {
    dropRouterMod = m;
    m.initShareTargetIngest(host as unknown as Parameters<typeof m.initShareTargetIngest>[0]);
    // App Links (plan 171): a tapped https://lolly.tools/t/… link that opened the
    // Android app resolves to its in-app route. Feature-detected no-op elsewhere.
    m.initDeepLinkIntake(host as unknown as Parameters<typeof m.initDeepLinkIntake>[0]);
    // The installed PWA's own two doors (plan 202 WP4.3), both probes:
    //   share target - the service worker parked the shared files and redirected
    //     here; this drains that stash into the drop chooser.
    //   file handlers - the OS "Open with" launch delivers its files on
    //     launchQueue, which only Chromium-family browsers define. Same chooser,
    //     so a .lolly opened from Finder asks the same question a dropped one does.
    void m.initShareTargetFileIntake(host as unknown as Parameters<typeof m.initShareTargetFileIntake>[0]);
    const launchQueue = (window as Window & { launchQueue?: LaunchQueue }).launchQueue;
    if (typeof launchQueue?.setConsumer === 'function') {
      launchQueue.setConsumer((params) => {
        const handles = params?.files ?? [];
        if (!handles.length) return;
        void Promise.all(handles.map((handle) => handle.getFile()))
          .then((files) => m.openDropChooser(
            files.filter(Boolean),
            host as unknown as Parameters<typeof m.openDropChooser>[1],
          ))
          .catch((err: unknown) => console.warn('[launch] could not read the opened file', err));
      });
    }
    // Desktop integration poll loop (plans/174): drains the native event queue -
    // double-clicked .lolly files, lolly:// links, tray/search activations, hot
    // folder arrivals. Installed HERE, after the first navigate, for the same reason
    // the Android intake above is: its first tick navigates, and a tool route set
    // while boot was still choosing its own first paint was overridden (a cold
    // `lolly://tool/<id>` launch on macOS opened the docs landing, 2026-09-03,
    // while `lolly://lab` and every warm link routed). The Rust queue holds a link
    // that arrived before this point, so deferring the drain loses nothing. Same
    // dynamic-import shape as app-menu: web builds never load it.
    if ('__TAURI_INTERNALS__' in window) {
      void import('./lib/linux-desktop-boot.ts').then(d =>
        d.installLinuxDesktopBoot(host as unknown as Parameters<typeof d.installLinuxDesktopBoot>[0]));
    }
    return m;
  });

  // The footer's "Open" button (components/footer-nav.ts) is an action, not a route: it
  // opens the OS file picker that feeds the SAME chooser a dropped file gets, so a
  // .lolly / design / image can be imported without a drag. Delegated at the document so
  // it survives the footer's between-view re-renders. CAPTURE phase, so a jelly-button's
  // own click handling can't preempt it; and the picker is opened SYNCHRONOUSLY (the
  // module is pre-warmed above) because a file chooser only opens under live user
  // activation, which a `.then` microtask after a cold import would forfeit.
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('[data-open-file]')) return;
    const openPicker = (m: typeof import('./lib/drop-router.ts')) =>
      m.openDropFilePicker(host as unknown as Parameters<typeof m.openDropFilePicker>[0]);
    if (dropRouterMod) openPicker(dropRouterMod);           // warm: same-gesture, picker opens
    else void dropRouterReady.then(openPicker);             // cold first click only (rare)
  }, true);

  // Warm the likely-next view chunks so the first tap doesn't pay a cold dynamic-import.
  // import() promises are cached, so the later route reuses these.
  const warmTool = (): void => { void import('./views/tool.ts').catch(() => {}); };

  // The TOOL path is special: it statically pulls the render engine (createRuntime +
  // Handlebars + Ajv + export, ~170 KB gz). That used to sit on the boot preload - moving
  // it off made the gallery boot lean, but a cold first tool-open then showed a "Loading…"
  // state while those chunks arrived. So something is warmed PROMPTLY (tight idle timeout
  // wins the slot even while the featured row is rendering), not on deep idle - the cold
  // window shrinks from ~1.6s to <0.6s. Lolly is a tool app; the tool engine being warm
  // matters most.
  //
  // What gets warmed unconditionally is the ENGINE, not the whole view. Those 170 KB are
  // lib/mount-runtime.ts's static graph - the chokepoint every runtime in this shell goes
  // through. views/tool.ts pulls that AND ~145 more chunks of view code, a few hundred
  // bytes each: nothing in bytes, but 145 connections opened on every cold visit before
  // the visitor has touched anything, which is what scripts/check-first-load.ts counts and
  // what no byte budget can see. The view itself warms on intent below instead, where a
  // pointerdown still puts it in flight ahead of the click that navigates.
  const warmEngine = (): void => { void import('./lib/mount-runtime.ts').catch(() => {}); };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(warmEngine, { timeout: 600 });
  else setTimeout(warmEngine, 200);

  // Warm a view the instant a link to it is hovered or pressed. Capture-phase, one-shot
  // per target (import() caches), and it fires ahead of the click that navigates. Covers
  // gallery tiles, the featured row, catalog, search results - anything linking to a tool -
  // plus the three secondary routes, which used to be three unconditional deep-idle
  // imports. Those read as free and are, in bytes; in connections they were another ~32 on
  // every cold visit for views most visitors never open.
  //
  // A Map, not an object literal: the key comes off a link in the page, and an object
  // would answer `constructor` and friends from its prototype.
  const warmSecondary = new Map<string, () => void>();
  {
    const dashboard = (): void => { void import('./views/dashboard.ts').catch(() => {}); };
    const projects = (): void => { void import('./views/projects.ts').catch(() => {}); };
    const catalog = (): void => { void import('./views/catalog.ts').catch(() => {}); };
    // Every hash spelling parseRoute() below accepts for these three, including the
    // ones that land via a redirect (#/b and #/brand → the dashboard's brand tab).
    for (const k of ['d', 'dashboard', 'b', 'brand', 'platform', 'capabilities']) warmSecondary.set(k, dashboard);
    warmSecondary.set('p', projects);
    for (const k of ['c', 'catalog']) warmSecondary.set(k, catalog);
  }
  /** The route a hover/press is aimed at: the first path segment of the nearest
   *  link's hash (an `<a href>` or a jelly-button's `data-href`), else a
   *  `[data-route]` control's own value. Null when the target is neither. */
  const intentRoute = (el: Element): string | null => {
    const link = el.closest<HTMLElement>('a[href], [data-href]');
    const href = link?.getAttribute('href') ?? link?.getAttribute('data-href') ?? '';
    const hash = href.slice(href.indexOf('#') + 1);
    const seg = href.includes('#') ? hash.split('?')[0]?.split('/').filter(Boolean)[0] : undefined;
    return seg ?? el.closest<HTMLElement>('[data-route]')?.dataset.route ?? null;
  };
  const views = new Set(warmSecondary.values()).size;
  const warmedViews = new Set<() => void>();
  let toolWarmed = false;
  const warmOnIntent = (e: Event): void => {
    const el = e.target instanceof Element ? e.target : null;
    if (!el) return;
    if (!toolWarmed && el.closest?.('a[href*="tool/"]')) { toolWarmed = true; warmTool(); }
    const route = intentRoute(el);
    const warm = route ? warmSecondary.get(route) : undefined;
    if (warm && !warmedViews.has(warm)) { warmedViews.add(warm); warm(); }
    // Once there is nothing left to warm, stop walking ancestors on every pointer
    // move: these fire for the life of the page and the work is finished.
    if (!toolWarmed || warmedViews.size < views) return;
    document.removeEventListener('pointerover', warmOnIntent, { capture: true });
    document.removeEventListener('pointerdown', warmOnIntent, { capture: true });
  };
  document.addEventListener('pointerover', warmOnIntent, { capture: true, passive: true });
  document.addEventListener('pointerdown', warmOnIntent, { capture: true, passive: true });

  // Re-render on any route change. hashchange covers legacy #/… links and external
  // deep links; popstate covers History-API back/forward across /t/<id> tool entries;
  // 'lolly:navigate' is fired by navigateTo() for in-app links that leave a tool.
  // A microtask debounce collapses a synchronous same-tick burst; the real guard against
  // the hashchange+popstate DOUBLE-mount (whose events land in separate macrotasks, which
  // a microtask can't span) is the same-route dedup inside navigate() itself.
  let navQueued = false;
  const onRouteChange = () => {
    if (navQueued) return;
    navQueued = true;
    Promise.resolve().then(() => { navQueued = false; navigate(host).catch(console.error); });
  };
  // Capture the URL a hash navigation leaves BEFORE the debounced navigate
  // consumes it - it becomes the back-pill target on the next view
  // (lib/back-nav.ts; navigateTo() captures its own, popstate has none).
  window.addEventListener('hashchange', (e) => noteLeavingHref(e.oldURL));
  window.addEventListener('hashchange', onRouteChange);
  window.addEventListener('popstate', onRouteChange);
  window.addEventListener('lolly:navigate', onRouteChange);
  // Forced same-route remount - lib/drop-router.ts routes a shared file INTO the
  // route the user is already on (its one-shot stashes are consumed at mount),
  // which the same-route dedup inside navigate() would otherwise swallow.
  window.addEventListener('lolly:remount', () => { navigate(host, { force: true }).catch(console.error); });

  document.querySelectorAll<HTMLElement>('[data-route]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.route;
      window.location.hash = r === 'gallery' ? '' : `#/${r}`;
    });
  });
}

// A `lang` override rides either routing form - #/tool/id?lang=de (hash) or
// /t/id?lang=de (path) - so read both instead of depending on parseRoute()
// (which runs later and, for some routes, redirects before boot resolves i18n).
function peekUrlLang(): string | null {
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(hashQuery).get('lang') ?? new URLSearchParams(window.location.search).get('lang');
}

/** Tools renamed inside the id-break window. parseRoute is the single funnel for every
 *  share link, bookmark, docs link, AND saved-session resume URL (`#/tool/<storedId>?slot=`),
 *  so aliasing the old id here - and ONLY here - keeps all of them resolving instead of
 *  404-ing on the retired id. `layout-studio` → `design` (the Design tool), and
 *  `sequence-studio` → `design` too: the sequence editor merged into design's timeline
 *  (2026-08-14) but the standalone tool's links were never redirected, which broke the
 *  permanent-id contract for every old sequence share link and docs recipe.
 *  `carousel-maker` → `design` (plan-107 cull, 2026-08-19): the carousel workload is a
 *  Design template, and a `?slot=` resume reshapes through migrateCarouselToFrames.
 *  `bitmap-studio` → `darkroom` and `layer-stack` → `darkroom` (plan-106 convergence,
 *  2026-08-19): the merged tool keeps BOTH tools' input ids, so saved sessions and
 *  share links resume with no model shim. */
const RENAMED_TOOL_IDS: Record<string, string> = {
  'layout-studio': 'design', 'sequence-studio': 'design', 'carousel-maker': 'design',
  'bitmap-studio': 'darkroom', 'layer-stack': 'darkroom',
  // barcode folded into qr-code (plans/147 T7a, 2026-08-26): its EAN/UPC/Code-128
  // encoders became qr-code `payload` kinds, and qr-code keeps barcode's `value` id
  // so a saved barcode session's value carries. A retired-tool link that named the
  // old `symbology` param drops it (qr-code has no such input) - the value opens and
  // the barcode kind is re-picked. Barcode shipped 2026-08-24, so ~no links exist yet.
  'barcode': 'qr-code',
  // The one-word-promise renames (plans/164, 2026-08-27, inside the id window):
  // pure id renames - inputs untouched, so old links and ?slot= resumes carry
  // whole through canonToolId with no per-tool migration shim needed.
  'mesh-gradient': 'gradient',
  'd3': 'chart',
  'embed-track-image': 'claim',
  'run-web-code': 'sandbox',
  'code-canvas': 'snippet',
  'screenshot-frame': 'frame',
  'web-icon': 'icon',
  'prompt-to-image': 'prompt-card',
};
const canonToolId = (id: string): string => RENAMED_TOOL_IDS[id] ?? id;

/** Retired ids whose workload lives on as a Design template: a BARE old link (no query at
 *  all) lands on that template instead of the blank chooser. Any query is passed through
 *  untouched, because a `?slot=` resume must reach the migration shims with the saved model
 *  winning, and a packed-values share link must keep its own params over template values. */
const RETIRED_TOOL_TEMPLATES: Record<string, string> = { 'carousel-maker': 'carousel', 'sequence-studio': 'video' };
const retiredToolParams = (id: string, params: string): string =>
  params === '' && RETIRED_TOOL_TEMPLATES[id] ? `template=${RETIRED_TOOL_TEMPLATES[id]}` : params;

function parseRoute(): Route {
  const hash = window.location.hash.slice(1);

  if (hash && hash !== '/') {
    const [path, query] = hash.split('?');
    const parts = (path ?? '').split('/').filter(Boolean);
    if (parts[0] === 'tool' && parts[1]) {
      return { name: 'tool', toolId: canonToolId(parts[1]), params: retiredToolParams(parts[1], query || '') };
    }
    // #/design mirrors the /design vanity path (plan 171): before this, the hash
    // spelling of the app's most-shared tool silently fell through to the gallery
    // while /design and #/tool/design both worked.
    if (parts[0] === 'design' && !parts[1]) {
      return { name: 'tool', toolId: 'design', params: query || '' };
    }
    if (parts[0] === 'profile') return { name: 'profile', params: query || '' };
    if (parts[0] === 'history') return { name: 'history', params: query || '' };
    if (parts[0] === 'd' || parts[0] === 'dashboard') return { name: 'dashboard', params: query || '' };
    // /b and /brand are shortlinks straight to the Dashboard's Design System tab.
    // Redirect (like /platform → /d) so mountDashboard reads ?tab=brand off the hash.
    if (parts[0] === 'b' || parts[0] === 'brand') {
      const q = query ? `${query}&tab=brand` : 'tab=brand';
      window.location.replace(`/#/d?${q}`);
      return { name: 'dashboard', params: q };
    }
    // /platform and /capabilities merged into the single Dashboard (#/d). Redirect
    // old links (and their deep-link flags) so bookmarks keep working - the flags
    // still resolve, since the dashboard's sections carry the same data-flag keys.
    if (parts[0] === 'platform' || parts[0] === 'capabilities') {
      window.location.replace(`/#/d${query ? `?${query}` : ''}`);
      return { name: 'dashboard', params: query || '' };
    }
    if (parts[0] === 'verify' || parts[0] === 'valid' || parts[0] === 'v') return { name: 'verify', params: query || '' };
    if (parts[0] === 'convert') return { name: 'convert', params: query || '' }; // on-device file converter
    if (parts[0] === 'compare') return { name: 'compare' };
    if (parts[0] === 'prepare') return { name: 'prepare' };
    if (parts[0] === 'data') return { name: 'data', params: query || '' }; // on-device spreadsheet viewer/editor
    if (parts[0] === 'start') return { name: 'start', params: query || '' }; // brand wizard
    if (parts[0] === 'multi') return { name: 'multi', params: query || '' }; // multi-edit (?s=slot,slot…)
    if (parts[0] === 'batch') return { name: 'pro', params: query || '' }; // /batch mode
    // The pre-2026-08-20 name for it. Left with no redirect at the rename, so every
    // old bookmark, docs recipe and `#/pro?s=…` "Edit as sheet" link fell through to
    // the gallery instead. Same redirect style as /platform → /d, query preserved
    // (a `?s=slot,slot` hand-off is the whole point of most of those links).
    if (parts[0] === 'pro') {
      window.location.replace(`/#/batch${query ? `?${query}` : ''}`);
      return { name: 'pro', params: query || '' };
    }
    if (parts[0] === 'p') return { name: 'projects', folderId: parts[1] || null, params: query || '' };
    if (parts[0] === 'c' || parts[0] === 'catalog') return { name: 'catalog', params: query || '' };
    if (parts[0] === 'u' || parts[0] === 'utilities') return { name: 'utilities', params: query || '' }; // gallery filtered to the utility category
    if (parts[0] === 'lab') return { name: 'lab', params: query || '' }; // Colour Lab (?c=<any css colour>)
    if (parts[0] === 'pdf' || parts[0] === 'unpack') return { name: 'pdf', params: query || '' }; // Unpack - take a design file apart; #/unpack is canonical, #/pdf a kept alias for old shared links
    if (parts[0] === 'script') return { name: 'script', params: query || '' }; // Script audio - the TTS writing surface
    if (parts[0] === 'ask') return { name: 'ask', params: query || '' }; // Ask Lolly - in-app help (?q=<question>)
    // In-app docs reader. #/docs/<slug> renders in the app's current locale; the explicit
    // #/docs/<lang>/<slug> form pins a language. Since plans/177 a page slug may carry its
    // door directory (#/docs/create/using ↔ /info/create/using.html); door names and locale
    // codes never collide, so the first segment after 'docs' classifies the form.
    if (parts[0] === 'docs' && parts[1]) {
      const DOORS = new Set(['start', 'create', 'build', 'operate', 'trust']);
      if (DOORS.has(parts[1]) && parts[2]) {
        return { name: 'docs', lang: null, slug: `${parts[1]}/${parts[2]}`, params: query || '' };
      }
      if (parts[2] && DOORS.has(parts[2]) && parts[3]) {
        return { name: 'docs', lang: parts[1], slug: `${parts[2]}/${parts[3]}`, params: query || '' };
      }
      return parts[2]
        ? { name: 'docs', lang: parts[1], slug: parts[2], params: query || '' }
        : { name: 'docs', lang: null, slug: parts[1], params: query || '' };
    }
    if (parts[0] === 'components') return { name: 'components', params: query || '' }; // the browsable component library
    // The two halves of a private collab's ceremony (plan 100 section 6.1, section 11.25). These
    // paths are minted by components/collab-ceremony.ts's JOIN_ROUTE / REPLY_ROUTE - 
    // an invite link carries ?inv=<token>, a reply link ?ans=<token>. A test pins the
    // two spellings against each other so a renamed route cannot quietly orphan every
    // invite already sent.
    if (parts[0] === 'join') return { name: 'join', params: query || '' };
    if (parts[0] === 'join-reply') return { name: 'join-reply', params: query || '' };
    // The gallery itself (#/?q=… keeps its query - the search field seeds from it),
    // and the fall-through for any unrecognised hash path.
    return { name: 'gallery', params: query || '' };
  }

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  // /t/<id> is a tool's canonical address-bar URL (path form, so a copied link
  // carries the per-tool OG preview - see scripts/build-tool-og.ts); params ride in
  // the query string. Returned as a first-class tool route - NOT redirected to the
  // hash - so History-API back/forward to a /t/<id> entry re-mounts correctly. In
  // production the server serves the static OG stub at this exact path and the stub
  // bounces a human into #/tool/<id>, which mounts and then syncUrl rewrites the bar
  // back to /t/<id>; this branch is what re-mounts on client-side popstate to it.
  if (pathParts.length === 2 && pathParts[0] === 't') {
    return { name: 'tool', toolId: canonToolId(pathParts[1]!), params: retiredToolParams(pathParts[1]!, window.location.search.slice(1)) };
  }
  // /p (Projects root) and /p/<folderId> deep links → redirect into the canonical
  // hash form so all in-app projects navigation stays hash-based (folders are private
  // profile data - no OG stub / first-class path needed, unlike /t/). Same redirect
  // style as /pro|/platform|/capabilities. Must precede the length===1 tool-shortcut
  // block so a bare /p isn't treated as a tool id.
  if (pathParts[0] === 'p') {
    window.location.replace(`/#/p${pathParts[1] ? '/' + pathParts[1] : ''}${window.location.search}`);
    return { name: 'projects', folderId: pathParts[1] || null };
  }
  if (pathParts.length === 1) {
    // /design is the Design tool's canonical vanity path - the one tool with a bare
    // top-level URL. Returned as a first-class tool route (NOT redirected), so the bar
    // stays `/design` the way /t/<id> stays put; syncUrl keeps it there via tool.ts's
    // TOOL_URL_BASE special-case, and vercel.json rewrites it to the tool's OG stub.
    if (pathParts[0] === 'design') {
      return { name: 'tool', toolId: 'design', params: window.location.search.slice(1) };
    }
    // /batch and /d are real routes; everything else is a tool shortcut. /pro is the
    // retired path spelling of /batch (renamed 2026-08-20) - without this it fell
    // through to /#/tool/pro and 404'd on a tool id that doesn't exist. /platform and
    // /capabilities are retired aliases that fold into the Dashboard.
    if (pathParts[0] === 'batch' || pathParts[0] === 'pro') {
      window.location.replace(`/#/batch${window.location.search}`);
      return { name: 'pro', params: window.location.search.slice(1) };
    }
    if (pathParts[0] === 'd' || pathParts[0] === 'dashboard' || pathParts[0] === 'platform' || pathParts[0] === 'capabilities') {
      // Preserve any deep-link query (e.g. /platform?print) across the redirect,
      // like the hash-form branch and the tool-shortcut fallback below.
      window.location.replace(`/#/d${window.location.search}`);
      return { name: 'dashboard', params: window.location.search.slice(1) };
    }
    // /verify is canonical; /valid and the /v shortlink are aliases. Preserve the
    // query across the redirect (plan 171) - `/verify?src=…&check` links lost their
    // payload before, while the hash-form alias kept it.
    if (pathParts[0] === 'verify' || pathParts[0] === 'valid' || pathParts[0] === 'v') {
      window.location.replace(`/#/verify${window.location.search}`);
      return { name: 'verify', params: window.location.search.slice(1) };
    }
    // /start is the brand wizard, not a tool shortcut. Query preserved (plan 171):
    // `/start?area=color&seed=…` deep links dropped it before.
    if (pathParts[0] === 'start') {
      window.location.replace(`/#/start${window.location.search}`);
      return { name: 'start', params: window.location.search.slice(1) };
    }
    // /components is the browsable component library, not a tool shortcut - a bare
    // /components would otherwise fall through to /#/tool/components and 404.
    if (pathParts[0] === 'components') { window.location.replace('/#/components'); return { name: 'components' }; }
    // The remaining view shortlinks that carry an OG share card (scripts/build-view-og.ts
    // → vercel.json rewrites them to a crawler-visible stub). In production a human never
    // reaches this branch - the stub bounces them into the hash route - but in dev, and on
    // any fall-through, these MUST resolve to their view rather than to /#/tool/<slug>,
    // which would 404 on a tool id that doesn't exist. Same contract as /pro and /start.
    const PATH_VIEWS: Record<string, { hash: string; route: Route }> = {
      tools:     { hash: '#/',     route: { name: 'gallery' } },
      u:         { hash: '#/u',    route: { name: 'utilities' } },
      utilities: { hash: '#/u',    route: { name: 'utilities' } },
      c:         { hash: '#/c',    route: { name: 'catalog' } },
      catalog:   { hash: '#/c',    route: { name: 'catalog' } },
      lab:       { hash: '#/lab',  route: { name: 'lab' } },
      // Unpack: /unpack is canonical, /pdf a kept alias (old shared links).
      compare:   { hash: '#/compare', route: { name: 'compare' } },
      prepare:   { hash: '#/prepare', route: { name: 'prepare' } },
      unpack:    { hash: '#/unpack', route: { name: 'pdf' } },
      pdf:       { hash: '#/unpack', route: { name: 'pdf' } },
      profile:   { hash: '#/profile', route: { name: 'profile', params: '' } },
      // The rest of the frozen path vocabulary (plan 171, engine APP_PATH_WORDS):
      // every reserved word must resolve to its view rather than fall through to
      // /#/tool/<word> and 404 - these are plausible hand-typed addresses, and the
      // vocabulary is validator-enforced against tool ids, so nothing can claim them.
      script:      { hash: '#/script',  route: { name: 'script' } },
      ask:         { hash: '#/ask',     route: { name: 'ask' } },
      multi:       { hash: '#/multi',   route: { name: 'multi' } },
      convert:     { hash: '#/convert', route: { name: 'convert' } },
      data:        { hash: '#/data',    route: { name: 'data' } },
      docs:        { hash: '#/docs/index', route: { name: 'docs', lang: null, slug: 'index' } },
      join:        { hash: '#/join',    route: { name: 'join' } },
      'join-reply': { hash: '#/join-reply', route: { name: 'join-reply' } },
    };
    const view = PATH_VIEWS[pathParts[0]!];
    if (view) {
      const q = window.location.search;
      window.location.replace(`/${view.hash}${q}`);
      return view.route.name === 'profile' ? { name: 'profile', params: q.slice(1) } : view.route;
    }
    // /b and /brand → the Dashboard's Design System tab (shortlinks, not tools).
    if (pathParts[0] === 'b' || pathParts[0] === 'brand') {
      const q = window.location.search ? `${window.location.search.slice(1)}&tab=brand` : 'tab=brand';
      window.location.replace(`/#/d?${q}`);
      return { name: 'dashboard', params: q };
    }
    window.location.replace(`/#/tool/${pathParts[0]}${window.location.search}`);
    return { name: 'gallery' };
  }

  return { name: 'gallery' };
}

// Only register the service worker in production builds. In dev it would cache
// /tools/ files, so a slow reload could serve a stale edit instead of the file
// just changed on disk.
//
// On window.load, not at module top level (plans/155 Task 3.5): registering here
// used to start the SW install - and with it the whole precache - while the boot
// chunks and the first viewport's art were still downloading, so the install ate
// bandwidth from the paint it exists to make faster next time. Nothing about the
// FIRST load depends on the SW being registered early.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  onWindowLoad(() => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}


// ── Never a blank page: recover from a stale app shell ────────────────────────
// A cached shell one deploy behind points its lazy chunks (the router's
// `await import('./views/…')`) at content-hashes the new deploy removed, so the
// import 404s ("Failed to fetch dynamically imported module"). A reload boots on
// the fresh, network-first shell. This must be bullet-proof from EVERY angle a
// failure surfaces - Vite's preloadError, an unhandled rejection, a failed
// <script>/<link>, or a router mount that throws - and must NEVER strand the user
// on a blank page: when a reload can't help (just retried, or offline) show a
// visible Reload card and auto-recover the moment connectivity returns.
const CHUNK_RELOAD_KEY = 'lolly-chunk-reload-at';
const CHUNK_ERR_RE = /(dynamically imported module|module script failed|error loading dynamically|loading chunk|chunkloaderror|failed to fetch)/i;

function looksLikeChunkError(v: unknown): boolean {
  const e = v as { message?: unknown; reason?: { message?: unknown } | string } | null;
  const msg = String(e?.message ?? (typeof e?.reason === 'string' ? e.reason : e?.reason?.message) ?? v ?? '');
  return CHUNK_ERR_RE.test(msg);
}

// A visible, always-actionable fallback - the last-resort alternative to a blank
// container. Mirrors boot()'s error card (className 'error', a .btn Reload).
function showReloadCard(message?: string): void {
  const view = document.getElementById('view');
  if (!view) return;
  view.textContent = '';
  const wrap = document.createElement('div');
  wrap.className = 'error';
  const p = document.createElement('p');
  p.style.margin = '0 0 10px';
  p.textContent = message || 'This page needs a quick refresh to load the latest version.';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = 'Reload';
  btn.addEventListener('click', () => window.location.reload());
  wrap.append(p, btn);
  view.append(wrap);
  if (navigator.onLine === false) window.addEventListener('online', () => window.location.reload(), { once: true });
}

let chunkRecovering = false;
function recoverFromStaleShell(): void {
  if (chunkRecovering) return;              // one attempt per episode (preloadError + rejection can co-fire)
  chunkRecovering = true;
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  // Online and haven't just reloaded → one silent reload fixes the stale shell.
  if (navigator.onLine !== false && Date.now() - last > 15_000) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    window.location.reload();               // page unloads; the flag stays set until it does
    return;
  }
  // Reload already tried (and didn't fix it) or we're offline → don't loop; show
  // the card so the user is never left on a blank page.
  showReloadCard();
  chunkRecovering = false;
}

if (import.meta.env.PROD) {
  window.addEventListener('vite:preloadError', (event) => { event.preventDefault(); recoverFromStaleShell(); });
  window.addEventListener('unhandledrejection', (event) => {
    if (looksLikeChunkError(event)) { event.preventDefault(); recoverFromStaleShell(); }
  });
  // Resource-load failures (a removed hashed <script>/<link>) don't bubble - catch
  // them in the capture phase, scoped to our own same-origin JS/CSS so an unrelated
  // asset error never triggers a reload.
  window.addEventListener('error', (event) => {
    const el = event.target as (HTMLScriptElement & HTMLLinkElement) | null;
    const src = (el && (el.src || el.href)) || '';
    const isAppChunk = typeof src === 'string' && src.startsWith(location.origin) && /\.(m?js|css)(\?|$)/.test(src);
    if (isAppChunk || looksLikeChunkError(event)) recoverFromStaleShell();
  }, true);
}

boot().catch(err => {
  console.error('Boot failed:', err);
  // A stale-shell chunk failure during boot recovers the same way navigation does - 
  // reload onto the fresh shell (or a visible Reload card), never a dead screen.
  if (import.meta.env.PROD && looksLikeChunkError(err)) { recoverFromStaleShell(); return; }
  // Build the error node with textContent - never interpolate err.message into
  // innerHTML (it can carry attacker-influenced strings).
  const view = document.getElementById('view')!;
  view.textContent = '';
  const div = document.createElement('div');
  div.className = 'error';
  const msg = document.createElement('p');
  msg.style.margin = '0';
  msg.textContent = `Boot failed: ${err.message}`;
  div.appendChild(msg);

  // A locked/wedged database is recoverable: once the offending tab (or a page
  // frozen in the bfcache) closes, a reload boots cleanly. The common trigger is
  // a DB version upgrade blocked by an older tab. Rather than dead-ending here,
  // offer a Reload button AND auto-reload once when this page next regains
  // visibility - i.e. the moment the user switches back after closing the other
  // tab - so recovery doesn't depend on them knowing to reload manually.
  if (err && (err.code === 'DB_BLOCKED' || err.code === 'DB_OPEN_TIMEOUT')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = 'Reload';
    btn.style.marginTop = '10px';
    btn.addEventListener('click', () => window.location.reload());
    div.appendChild(btn);

    let retried = false;
    const retry = () => {
      if (retried || document.visibilityState !== 'visible') return;
      retried = true; // one automatic attempt, then leave it to the button
      window.location.reload();
    };
    document.addEventListener('visibilitychange', retry);
    window.addEventListener('focus', retry);
  }

  view.appendChild(div);
});

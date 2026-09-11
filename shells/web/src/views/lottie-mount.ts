// SPDX-License-Identifier: MPL-2.0
/**
 * Shell-side Lottie player enhancer for `[data-lottie-src]` markers.
 *
 * Modelled on the hydrateEmbeds contract (bridge/embed.js): an async post-paint
 * enhancer with an `isCurrent()` stale-render guard. The tool canvas is rebuilt
 * via `contentEl.innerHTML` on every rAF-coalesced paint, which ORPHANS every
 * mounted player - and lottie-web's global animationManager keeps rAF-ticking
 * detached trees forever unless `destroy()` is called. So this module owns a
 * registry of every player it mounts and reaps disconnected ones at the start
 * of each mount pass (and on explicit destroy), or the app leaks a whole
 * animation loop per paint.
 *
 * Why `renderer: 'svg'`: dom-to-image snapshots the live DOM, so an SVG-rendered
 * frame exports as a still - and per-frame motion capture works - with zero
 * export-pipeline changes.
 *
 * Why `animationData` is cloned per mount: lottie-web MUTATES the object it is
 * given (it annotates layers in place). The fetch cache holds the pristine
 * parsed JSON; each mount gets its own structuredClone so two players - or a
 * remount after a paint - never see a half-digested document.
 *
 * Marker attributes:
 *   data-lottie-src       required - URL of the Lottie JSON (blob:/https/relative)
 *   data-lottie-loop      'false' to play once (default loops)
 *   data-lottie-autoplay  'false' to start paused (default plays)
 *   data-lottie-fit       'cover' → 'xMidYMid slice' (default 'meet')
 *   data-lottie-speed     playback rate multiplier (setSpeed)
 */

import type { AnimationItem, LottiePlayer } from 'lottie-web';

interface Entry {
  el: Element;
  anim: AnimationItem;
  src: string;
}

// Every mounted player: { el, anim, src }. `src` lets a repeat pass over the
// SAME node (canvas not rebuilt) keep a live player instead of remounting it.
const registry = new Set<Entry>();

// Parsed-JSON promise per URL - one fetch per asset across paints and players.
const jsonCache = new Map<string, Promise<any>>();

let lottiePromise: Promise<LottiePlayer> | null = null; // memoized dynamic import (heavy lib, load on demand)

function getLottie(): Promise<LottiePlayer> {
  if (!lottiePromise) {
    // The LIGHT build (svg renderer, no After-Effects expressions engine). The full
    // `lottie-web` entry bundles an expressions interpreter that runs strings through
    // direct `eval` - which the bundler warns about, bloats the chunk, and needs
    // `unsafe-eval` under CSP. We render `renderer: 'svg'` and none of our Lotties use
    // expressions, so the light build is a drop-in with none of that baggage.
    lottiePromise = import('lottie-web/build/player/lottie_light').then((m) => m.default ?? (m as unknown as LottiePlayer));
  }
  return lottiePromise;
}

/** Fetch + parse a Lottie JSON, cached by URL (shared with the picker path). */
export async function fetchLottieJson(url: string): Promise<any> {
  let p = jsonCache.get(url);
  if (!p) {
    p = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`lottie fetch ${res.status}: ${url}`);
      return res.json();
    });
    // Drop failures from the cache - a transient network error must not poison
    // the URL for every later mount. (The catch branch also keeps the rejection
    // "handled"; callers still see it on the returned promise.)
    p.catch(() => {
      if (jsonCache.get(url) === p) jsonCache.delete(url);
    });
    jsonCache.set(url, p);
  }
  return p;
}

function entryFor(el: Element): Entry | null {
  for (const entry of registry) if (entry.el === el) return entry;
  return null;
}

function destroyEntry(entry: Entry): void {
  registry.delete(entry);
  // Drop the "live" marker so a host's resting poster/placeholder (shown behind the
  // transparent player) reappears once no player is rendering here - e.g. a grid tile
  // that scrolled off screen, or a closed details modal.
  entry.el.classList.remove('is-lottie-live');
  try {
    entry.anim.destroy(); // unregisters from lottie's global animationManager
  } catch {
    /* already destroyed - destroy must be idempotent */
  }
}

// The innerHTML rebuild replaced these containers wholesale; without this the
// detached players keep ticking (and leaking) in animationManager.
function reapDisconnected(): void {
  for (const entry of [...registry]) {
    if (!entry.el.isConnected) destroyEntry(entry);
  }
}

/**
 * Resolve once the player has built its DOM (or failed), never wedging: a
 * corrupt asset - or a destroy racing the mount - may fire neither event, and
 * an exporter awaiting the returned mount promise must not hang on it.
 */
function whenLoaded(anim: AnimationItem): Promise<void> {
  if (anim.isLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(cap);
      resolve();
    };
    const cap = setTimeout(done, 5000);
    anim.addEventListener('DOMLoaded', done);
    anim.addEventListener('data_failed', done);
    anim.addEventListener('error', done);
  });
}

async function mountOne(el: Element, lottie: LottiePlayer, isCurrent: () => boolean): Promise<void> {
  const src = el.getAttribute('data-lottie-src');
  if (!src) return;

  const prior = entryFor(el);
  if (prior && prior.src === src) return; // live player for the same asset - keep it
  if (prior) destroyEntry(prior); // same node, new asset - remount

  if (!isCurrent()) return;
  const data = await fetchLottieJson(src);
  // Re-guard after the await: the paint may have moved on, the node may be
  // orphaned, or a concurrent pass may have mounted this el while we fetched.
  if (!isCurrent() || !el.isConnected || entryFor(el)) return;

  const anim = lottie.loadAnimation({
    container: el,
    renderer: 'svg',
    loop: el.getAttribute('data-lottie-loop') !== 'false',
    autoplay: el.getAttribute('data-lottie-autoplay') !== 'false',
    animationData: structuredClone(data), // lottie-web mutates it - never hand it the cache
    rendererSettings: {
      preserveAspectRatio:
        el.getAttribute('data-lottie-fit') === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet',
      progressiveLoad: false,
    },
  });
  const speed = parseFloat(el.getAttribute('data-lottie-speed') as string);
  if (Number.isFinite(speed)) anim.setSpeed(speed);

  // Flag the marker "live" once the SVG has actually painted its first frame, so a host
  // that shows a resting poster/placeholder behind this element (a still `background-image`
  // or a ▶ glyph) can hide it - otherwise the still poster ghosts through the transparent
  // playing SVG (the catalog details modal + grid tiles). Reverted in destroyEntry so the
  // resting frame returns when the player is reaped. Gated on DOMLoaded (not whenLoaded,
  // which also resolves on failure/timeout) so a broken asset keeps its poster.
  const markLive = () => { if (el.isConnected) el.classList.add('is-lottie-live'); };
  if (anim.isLoaded) markLive();
  else anim.addEventListener('DOMLoaded', markLive);

  registry.add({ el, anim, src });
  await whenLoaded(anim);
}

/**
 * Post-paint enhancer: destroy orphaned players, then mount a player on every
 * `[data-lottie-src]` marker under `rootEl`. Resolves after every NEW player
 * has fired DOMLoaded (immediately when there is nothing to mount). Per-marker
 * failures are warned and swallowed - one bad asset must not break the paint.
 */
export async function mountLottiePlayers(
  rootEl: Element,
  { isCurrent = () => true }: { isCurrent?: () => boolean } = {},
): Promise<void> {
  const run = (async () => {
    // Reap even when this paint has no markers: the previous paint's players
    // are already orphaned by the rebuild.
    reapDisconnected();
    const els = [...rootEl.querySelectorAll('[data-lottie-src]')];
    if (!els.length || !isCurrent()) return;
    const lottie = await getLottie();
    if (!isCurrent()) return;
    await Promise.all(
      els.map(async (el) => {
        try {
          await mountOne(el, lottie, isCurrent);
        } catch (e) {
          console.warn(`lottie-mount: ${el.getAttribute('data-lottie-src')}: ${(e as any)?.message ?? e}`);
        }
      }),
    );
  })();
  return run;
}

/**
 * Mount a player on ONE `[data-lottie-src]` marker (vs mountLottiePlayers' whole-subtree
 * pass) - for the on-screen-gated thumbnail autoplayer, which mounts a single tile as it
 * scrolls into view. Reaps disconnected players first (a grid re-render orphans them), then
 * mounts this marker if it is still live. A bad asset is warned + swallowed.
 */
export async function mountLottieMarker(
  el: Element,
  { isCurrent = () => true }: { isCurrent?: () => boolean } = {},
): Promise<void> {
  reapDisconnected();
  if (!el.isConnected || !el.getAttribute('data-lottie-src') || !isCurrent()) return;
  const lottie = await getLottie();
  if (!isCurrent()) return;
  try {
    await mountOne(el, lottie, isCurrent);
  } catch (e) {
    console.warn(`lottie-mount: ${el.getAttribute('data-lottie-src')}: ${(e as any)?.message ?? e}`);
  }
}

/**
 * Auto-play every `[data-lottie-src]` thumbnail under `root`, but only while it is on
 * screen - a grid of many looping animations then costs only the handful in view. lottie-web
 * ticks EVERY mounted player from one global rAF (unlike a `<video>`, which the browser
 * throttles off-screen), so a tile's player is DESTROYED when it scrolls away, not paused.
 * Falls back to mounting all at once where IntersectionObserver is unavailable. Returns a
 * handle - call destroy() before re-rendering the grid or leaving the view.
 */
export function autoplayLottieThumbs(
  root: Element,
  { isCurrent = () => true }: { isCurrent?: () => boolean } = {},
): { destroy(): void } {
  if (typeof IntersectionObserver !== 'function') {
    void mountLottiePlayers(root, { isCurrent });
    return { destroy: () => destroyLottiePlayers(root) };
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) void mountLottieMarker(e.target, { isCurrent });
      else destroyLottiePlayers(e.target); // reclaim the rAF slot when it scrolls away
    }
  }, { rootMargin: '200px' });
  root.querySelectorAll('[data-lottie-src]').forEach((el) => io.observe(el));
  return {
    destroy() {
      io.disconnect();
      destroyLottiePlayers(root);
    },
  };
}

/**
 * Destroy all registered players (or only those inside `rootEl`) and clear
 * their registry entries. Safe to call twice - entries are removed on the
 * first pass and anim.destroy() is idempotent.
 */
export function destroyLottiePlayers(rootEl: Element | null = null): void {
  for (const entry of [...registry]) {
    if (rootEl && !rootEl.contains(entry.el)) continue;
    destroyEntry(entry);
  }
}

/**
 * The live player mounted on `el`, if any - lets a caller drive playback (play/pause/goToAndStop)
 * on a specific marker, e.g. the catalog details modal's play/pause overlay. Returns null until
 * the async mount has registered the player (and after it is destroyed).
 */
export function lottiePlayerFor(el: Element): AnimationItem | null {
  return entryFor(el)?.anim ?? null;
}

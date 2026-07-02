// SPDX-License-Identifier: MPL-2.0
/**
 * Shell-side Lottie player enhancer for `[data-lottie-src]` markers.
 *
 * Modelled on the hydrateEmbeds contract (bridge/embed.js): an async post-paint
 * enhancer with an `isCurrent()` stale-render guard. The tool canvas is rebuilt
 * via `contentEl.innerHTML` on every rAF-coalesced paint, which ORPHANS every
 * mounted player — and lottie-web's global animationManager keeps rAF-ticking
 * detached trees forever unless `destroy()` is called. So this module owns a
 * registry of every player it mounts and reaps disconnected ones at the start
 * of each mount pass (and on explicit destroy), or the app leaks a whole
 * animation loop per paint.
 *
 * Why `renderer: 'svg'`: dom-to-image snapshots the live DOM, so an SVG-rendered
 * frame exports as a still — and per-frame motion capture works — with zero
 * export-pipeline changes.
 *
 * Why `animationData` is cloned per mount: lottie-web MUTATES the object it is
 * given (it annotates layers in place). The fetch cache holds the pristine
 * parsed JSON; each mount gets its own structuredClone so two players — or a
 * remount after a paint — never see a half-digested document.
 *
 * Marker attributes:
 *   data-lottie-src       required — URL of the Lottie JSON (blob:/https/relative)
 *   data-lottie-loop      'false' to play once (default loops)
 *   data-lottie-autoplay  'false' to start paused (default plays)
 *   data-lottie-fit       'cover' → 'xMidYMid slice' (default 'meet')
 *   data-lottie-speed     playback rate multiplier (setSpeed)
 */

// Every mounted player: { el, anim, src }. `src` lets a repeat pass over the
// SAME node (canvas not rebuilt) keep a live player instead of remounting it.
const registry = new Set();

// Parsed-JSON promise per URL — one fetch per asset across paints and players.
const jsonCache = new Map();

let lottiePromise = null; // memoized dynamic import (heavy lib, load on demand)
let pending = Promise.resolve(); // latest mount pass, for exporters to await

function getLottie() {
  if (!lottiePromise) {
    lottiePromise = import('lottie-web').then((m) => m.default ?? m);
  }
  return lottiePromise;
}

/** Fetch + parse a Lottie JSON, cached by URL (shared with the picker path). */
export async function fetchLottieJson(url) {
  let p = jsonCache.get(url);
  if (!p) {
    p = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`lottie fetch ${res.status}: ${url}`);
      return res.json();
    });
    // Drop failures from the cache — a transient network error must not poison
    // the URL for every later mount. (The catch branch also keeps the rejection
    // "handled"; callers still see it on the returned promise.)
    p.catch(() => {
      if (jsonCache.get(url) === p) jsonCache.delete(url);
    });
    jsonCache.set(url, p);
  }
  return p;
}

function entryFor(el) {
  for (const entry of registry) if (entry.el === el) return entry;
  return null;
}

function destroyEntry(entry) {
  registry.delete(entry);
  try {
    entry.anim.destroy(); // unregisters from lottie's global animationManager
  } catch {
    /* already destroyed — destroy must be idempotent */
  }
}

// The innerHTML rebuild replaced these containers wholesale; without this the
// detached players keep ticking (and leaking) in animationManager.
function reapDisconnected() {
  for (const entry of [...registry]) {
    if (!entry.el.isConnected) destroyEntry(entry);
  }
}

/**
 * Resolve once the player has built its DOM (or failed), never wedging: a
 * corrupt asset — or a destroy racing the mount — may fire neither event, and
 * an exporter awaiting lottieMountPending() must not hang on it.
 */
function whenLoaded(anim) {
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

async function mountOne(el, lottie, isCurrent) {
  const src = el.getAttribute('data-lottie-src');
  if (!src) return;

  const prior = entryFor(el);
  if (prior && prior.src === src) return; // live player for the same asset — keep it
  if (prior) destroyEntry(prior); // same node, new asset — remount

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
    animationData: structuredClone(data), // lottie-web mutates it — never hand it the cache
    rendererSettings: {
      preserveAspectRatio:
        el.getAttribute('data-lottie-fit') === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet',
      progressiveLoad: false,
    },
  });
  const speed = parseFloat(el.getAttribute('data-lottie-speed'));
  if (Number.isFinite(speed)) anim.setSpeed(speed);

  registry.add({ el, anim, src });
  await whenLoaded(anim);
}

/**
 * Post-paint enhancer: destroy orphaned players, then mount a player on every
 * `[data-lottie-src]` marker under `rootEl`. Resolves after every NEW player
 * has fired DOMLoaded (immediately when there is nothing to mount). Per-marker
 * failures are warned and swallowed — one bad asset must not break the paint.
 */
export async function mountLottiePlayers(rootEl, { isCurrent = () => true } = {}) {
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
          console.warn(`lottie-mount: ${el.getAttribute('data-lottie-src')}: ${e?.message ?? e}`);
        }
      }),
    );
  })();
  // Exporters await settledness, never the outcome — pending must not reject.
  pending = run.catch(() => {});
  return run;
}

/**
 * Destroy all registered players (or only those inside `rootEl`) and clear
 * their registry entries. Safe to call twice — entries are removed on the
 * first pass and anim.destroy() is idempotent.
 */
export function destroyLottiePlayers(rootEl = null) {
  for (const entry of [...registry]) {
    if (rootEl && !rootEl.contains(entry.el)) continue;
    destroyEntry(entry);
  }
}

/** The latest in-flight mount pass (or resolved) — never rejects. */
export function lottieMountPending() {
  return pending;
}

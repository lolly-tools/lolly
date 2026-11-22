// SPDX-License-Identifier: MPL-2.0
/**
 * Hand the service worker the build files this page loaded (sw.js, cacheBootSet).
 *
 * A first visit downloads the boot chunks, the boot stylesheet and the preloaded fonts
 * before any worker exists, so they never pass through the worker's cache-first route,
 * and a second visit fetched all of them again (plan 371: second-visit first paint
 * 623 ms against 259 ms once they were cached). Which files a second visit found also
 * depended on how far the first visit had got when the worker took control, which made
 * second visits slower whenever a change moved first-visit loads earlier.
 *
 * Once a worker controls the page, this posts the addresses of the build files the page
 * has loaded; the worker stores those it lacks. Only same-origin `/_app/` and `/fonts/`
 * paths are sent, the worker checks them again, and it fetches them through the HTTP
 * cache, so nothing is downloaded twice.
 *
 * The post waits until the page's own network has been quiet for {@link QUIET_MS} (at
 * most {@link HANDOVER_WAIT_MS}), then for an idle moment. Where a host's headers leave
 * nothing in the HTTP cache the worker's fetches are full downloads, and made as soon as
 * a first visit's worker took control they shared the link with the gallery's code (300 ms
 * later to interactive on the phone profile), and made at the first idle moment with the
 * featured images (largest paint 1 s later). A first visit's network seldom goes quiet
 * soon (it warms other parts for many seconds), so the wait is short: past the featured
 * images on the phone profile (largest paint at 2.9 to 3.9 s), early enough that a visit
 * a few seconds later finds the boot set (with a 30 s cap it often did not).
 */

export const BOOT_SET_MESSAGE = 'lolly:boot-set';

/**
 * Same-origin build and font paths: the document's own script and stylesheet tags first
 * (the boot chunk, the boot stylesheet, the preloaded fonts), then the loaded resources in
 * the order they started. The worker keeps at most 200, and a cold visit loads more build
 * files than that, so the order decides what is kept; sorted by name, the boot chunk
 * (`web-boot-*`) fell past the cap and every second visit downloaded it again.
 */
export function bootSetUrls(doc: Document, entries: readonly { name: string }[], origin: string): string[] {
  const out = new Set<string>();
  const add = (raw: string | null | undefined): void => {
    if (!raw) return;
    try {
      const url = new URL(raw, origin);
      if (url.origin === origin && !url.search && /^\/(?:_app|fonts)\//.test(url.pathname)) out.add(url.pathname);
    } catch { /* not an address */ }
  };
  for (const el of doc.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[href]')) {
    add('src' in el ? el.src : el.href);
  }
  for (const entry of entries) add(entry.name);
  return [...out];
}

/** How long no resource of the page may have finished loading before the post. */
export const QUIET_MS = 1500;
/** The longest the post waits for that quiet, from when it could first be made. */
export const HANDOVER_WAIT_MS = 8000;

type Idle = (fn: () => void) => void;

/** Run `fn` once the page's resources have been quiet for QUIET_MS (or the wait runs out), at an idle moment. */
export function whenQuiet(entries: () => readonly { responseEnd?: number }[], now: () => number = () => performance.now(),
  later: (fn: () => void, ms: number) => void = (fn, ms) => { setTimeout(fn, ms); },
  idle: (fn: () => void) => void = fn => { if (typeof requestIdleCallback === 'function') requestIdleCallback(() => fn(), { timeout: 5000 }); else fn(); }): Idle {
  return fn => {
    const until = now() + HANDOVER_WAIT_MS;
    const check = (): void => {
      const last = entries().reduce((max, e) => Math.max(max, e.responseEnd ?? 0), 0);
      if (now() - last >= QUIET_MS || now() >= until) idle(fn);
      else later(check, 1000);
    };
    check();
  };
}

/**
 * Post the boot set to the controlling worker at the next quiet moment: now when a worker
 * controls the page, and again whenever a new worker takes control (an update activates a
 * new generation that does not have the old one's cache). The worker skips what it holds.
 */
export function handOverBootSet(container: ServiceWorkerContainer, doc: Document, entries: () => readonly { name: string; responseEnd?: number }[], origin: string, idle: Idle = whenQuiet(entries)): void {
  const send = (): void => {
    const worker = container.controller;
    if (!worker) return;
    const urls = bootSetUrls(doc, entries(), origin);
    if (urls.length) worker.postMessage({ type: BOOT_SET_MESSAGE, urls });
  };
  const later = (): void => idle(send);
  if (container.controller) later();
  container.addEventListener('controllerchange', later);
}

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
 */

export const BOOT_SET_MESSAGE = 'lolly:boot-set';

/** Same-origin build and font paths among the page's loaded resources and its own tags. */
export function bootSetUrls(doc: Document, entries: readonly { name: string }[], origin: string): string[] {
  const out = new Set<string>();
  const add = (raw: string | null | undefined): void => {
    if (!raw) return;
    try {
      const url = new URL(raw, origin);
      if (url.origin === origin && !url.search && /^\/(?:_app|fonts)\//.test(url.pathname)) out.add(url.pathname);
    } catch { /* not an address */ }
  };
  for (const entry of entries) add(entry.name);
  for (const el of doc.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[href]')) {
    add('src' in el ? el.src : el.href);
  }
  return [...out].sort();
}

/** Post the boot set to the controlling worker, now or once one takes control. */
export function handOverBootSet(container: ServiceWorkerContainer, doc: Document, entries: () => readonly { name: string }[], origin: string): void {
  const send = (): void => {
    const worker = container.controller;
    if (!worker) return;
    const urls = bootSetUrls(doc, entries(), origin);
    if (urls.length) worker.postMessage({ type: BOOT_SET_MESSAGE, urls });
  };
  if (container.controller) send();
  else container.addEventListener('controllerchange', send, { once: true });
}

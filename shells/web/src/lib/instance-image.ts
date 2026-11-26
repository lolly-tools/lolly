// SPDX-License-Identifier: MPL-2.0
/**
 * Pictures that sit behind the connected instance's sign-in, in the apps.
 *
 * In a browser the page IS the instance, so `<img src="/api/v1/projects/…/files/…">`
 * carries the person's session like any other request. In the apps the instance is
 * another origin and the session is held by the native transport (lib/instance.ts),
 * so the web view asks for the same picture with no session and is refused. Those
 * pictures are read through instanceFetch here and shown from the bytes.
 *
 * Everything else is left exactly as it was: outside the apps, and for any address
 * that is not on the connected instance's own origin, the element gets the address as
 * its `src` and this module makes no request. The session goes only where
 * instanceFetch sends it, which is the instance's origin.
 */
import { instanceFetch, needsInstanceTransport } from './instance.ts';

/** The largest picture read this way. A larger one keeps its fallback. */
const MAX_PICTURE_BYTES = 32 * 1024 * 1024;
const PICTURE_TIMEOUT_MS = 30000;
/** Pictures read at once: each crosses to the native side and back as a whole. */
const MAX_AT_ONCE = 3;

let running = 0;
const queue: Array<() => void> = [];

function next(): void {
  while (running < MAX_AT_ONCE && queue.length) {
    running++;
    queue.shift()!();
  }
}

async function read(img: HTMLImageElement, url: string): Promise<void> {
  try {
    const response = await instanceFetch(url, undefined, { timeoutMs: PICTURE_TIMEOUT_MS, maxResponseBytes: MAX_PICTURE_BYTES });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!type.startsWith('image/')) throw new Error('Not a picture');
    const blob = new Blob([await response.arrayBuffer()], { type });
    if (img.dataset.instanceSrc !== url) return; // the element moved on to another picture
    const objectUrl = URL.createObjectURL(blob);
    const release = (): void => { URL.revokeObjectURL(objectUrl); };
    img.addEventListener('load', release, { once: true });
    img.addEventListener('error', release, { once: true });
    img.src = objectUrl;
  } catch {
    // The same event a refused `src` raises, so each surface's own fallback runs.
    if (img.dataset.instanceSrc === url) img.dispatchEvent(new Event('error'));
  } finally {
    running--;
    next();
  }
}

/**
 * Show the picture at `url` in `img`. Returns true when the picture is being read
 * through the instance transport, false when the element simply got the address.
 */
export function setInstanceImage(img: HTMLImageElement, url: string): boolean {
  if (!needsInstanceTransport(url)) {
    delete img.dataset.instanceSrc;
    img.src = url;
    return false;
  }
  img.removeAttribute('src');
  img.dataset.instanceSrc = url;
  const start = (): void => { queue.push(() => { void read(img, url); }); next(); };
  // A lazy picture waits until it is near the screen, as the web view's own loading does.
  if (img.loading === 'lazy' && typeof IntersectionObserver === 'function') {
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      seen.disconnect();
      if (img.dataset.instanceSrc === url) start();
    }, { rootMargin: '200px' });
    seen.observe(img);
  } else {
    start();
  }
  return true;
}

/** The same for markup already built: every `<img src>` under `root` on the instance. */
export function hydrateInstanceImages(root: ParentNode): void {
  for (const img of root.querySelectorAll<HTMLImageElement>('img[src]')) {
    const url = img.getAttribute('src') ?? '';
    if (needsInstanceTransport(url)) setInstanceImage(img, url);
  }
}

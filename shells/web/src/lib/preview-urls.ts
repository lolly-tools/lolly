// SPDX-License-Identifier: MPL-2.0
/**
 * Object URLs for stored pictures (plan 373): one per content key, shared by
 * every tile that shows the same picture, held in one least-recently-used map.
 *
 * A raster picture read from the preview store becomes a `blob:` URL rather than
 * a data URL, so its bytes stay in the browser's blob store and never sit in the
 * page's heap as text. The map keeps the 300 most recently used; a URL that leaves
 * it is revoked after a grace period, long enough for an `<img>` that was just
 * handed the URL to finish loading. A tile asks again when it is shown again
 * (components/preview-image.ts does), and gets a live URL.
 *
 * An SVG picture is NEVER handed out as a `blob:` URL. A blob URL carries this
 * app's origin, and "Open image in new tab" on an `<img>` navigates to it, where an
 * SVG document would run any script it carried, with the app's storage in reach
 * (the page's CSP allows inline script). Browsers refuse to open a `data:` URL as a
 * top-level page, and an `<img>` runs no script and loads nothing either way, so
 * SVG goes out as a `data:` URL, exactly as SVG thumbnails always did.
 */

const LIMIT = 300;
const GRACE_MS = 30_000;

const live = new Map<string, string>();
const leaving = new Map<string, { url: string; timer: ReturnType<typeof setTimeout> }>();

function revokeLater(key: string, url: string): void {
  const timer = setTimeout(() => {
    leaving.delete(key);
    try { URL.revokeObjectURL(url); } catch { /* already gone */ }
  }, GRACE_MS);
  (timer as { unref?: () => void }).unref?.();
  leaving.set(key, { url, timer });
}

/** An `<img>` source for a stored picture: a `data:` URL for SVG (see the header),
 *  an object URL for a raster. Made the first time, then shared by content key. */
export async function srcForBlob(key: string, blob: Blob): Promise<string> {
  const held = heldObjectUrl(key);
  if (held) return held;
  if (blob.type === 'image/svg+xml') {
    const url = await svgDataUrl(blob);
    live.set(key, url);
    trim();
    return url;
  }
  return objectUrlFor(key, blob);
}

/** An SVG as a base64 `data:` URL. The browser's file reader does the encoding off
 *  the main thread; percent-encoding the text here cost a phone over a second for the
 *  large SVG looks a gallery visit draws. Where there is no FileReader (a test), the
 *  bytes are encoded here. */
function svgDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader === 'function') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).replace(/^data:[^;,]*/, 'data:image/svg+xml'));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  return blob.arrayBuffer().then(buffer => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  });
}

function trim(): void {
  while (live.size > LIMIT) {
    const [oldKey, oldUrl] = live.entries().next().value as [string, string];
    live.delete(oldKey);
    if (oldUrl.startsWith('blob:')) revokeLater(oldKey, oldUrl);
  }
}

/** The object URL for a stored raster picture, made from `blob` the first time.
 *  Never call this for SVG: use srcForBlob. */
export function objectUrlFor(key: string, blob: Blob): string {
  if (blob.type === 'image/svg+xml') throw new Error('An SVG picture is never handed out as a blob: URL.');
  const held = live.get(key);
  if (held) { live.delete(key); live.set(key, held); return held; }
  const back = leaving.get(key);
  if (back) { clearTimeout(back.timer); leaving.delete(key); live.set(key, back.url); return back.url; }
  const url = URL.createObjectURL(blob);
  live.set(key, url);
  trim();
  return url;
}

/** The URL already made for a content key, if it is still live. */
export function heldObjectUrl(key: string): string | null {
  const held = live.get(key);
  if (held) { live.delete(key); live.set(key, held); return held; }
  return null;
}

/** How many object URLs are live or waiting to be revoked (tests and the HUD). */
export function objectUrlCount(): number {
  return live.size + leaving.size;
}

/** Revoke everything now (a test teardown, or "Clear all my data"). */
export function revokeAllObjectUrls(): void {
  for (const url of live.values()) { if (url.startsWith('blob:')) try { URL.revokeObjectURL(url); } catch { /* gone */ } }
  for (const { url, timer } of leaving.values()) { clearTimeout(timer); try { URL.revokeObjectURL(url); } catch { /* gone */ } }
  live.clear();
  leaving.clear();
}

/** Whether a URL this module handed out is still live (not revoked). */
export function srcStillLive(src: string): boolean {
  for (const url of live.values()) if (url === src) return true;
  for (const { url } of leaving.values()) if (url === src) return true;
  return false;
}

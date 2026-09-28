// SPDX-License-Identifier: MPL-2.0
/**
 * "Add from URL" - turn a pasted address into an image File, wherever the shell
 * can reach that address. Shared by the asset picker, the catalogue's upload dropzone and
 * Verify (which passes `anyType`, since a PDF or a video is as checkable as an
 * image - though the web proxy still only relays images).
 *
 * The reach differs by shell because of the web PWA's CSP (img-src/connect-src
 * 'self', vercel.json):
 *  - a `data:` URI and a SAME-ORIGIN URL fetch straight off (CSP admits both);
 *  - the Tauri shells (no CSP, tauri-plugin-http) and a localhost dev build (no
 *    CSP headers) fetch any origin directly;
 *  - the hosted web PWA cannot fetch or display an arbitrary remote image, so it
 *    routes it through the app's OWN same-origin proxy (services/mcp
 *    image-proxy.ts, /api/fetch-image), which returns the bytes from 'self'.
 *
 * This module is deliberately host-free (no `host.*`, no storeUserUpload import),
 * so it never forms an import cycle with picker.ts - the callers own persistence.
 * Lolly TOOL links are NOT handled here: they render on-device through
 * host.compose.renderUrl and need no bytes fetched, so callers branch on them
 * first. Every failure throws AddViaUrlError with a finished, user-ready message.
 */

import { t } from '../i18n.ts';

/** The same-origin proxy the deployed web shell falls back to (gateway route). */
export const IMAGE_PROXY_PATH = '/api/fetch-image';
const FETCH_TIMEOUT_MS = 20_000;
const IMAGE_MIME = /^image\//i;

/** A user-ready failure - its message is safe to show verbatim. */
export class AddViaUrlError extends Error {
  constructor(message: string) { super(message); this.name = 'AddViaUrlError'; }
}

/** The window as the Tauri shells extend it: their runtime marker is a global that a
 *  browser never defines. */
type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

/** Tauri (no CSP) or a localhost dev build (no CSP headers) can fetch any origin
 *  directly; a deployed web PWA cannot and must use the proxy. */
function canFetchAnyOrigin(): boolean {
  try {
    if ((window as TauriWindow).__TAURI_INTERNALS__) return true;
    const h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '';
  } catch { return false; }
}

/** A plausible filename for the stored asset, from the URL or the mime type. */
function fileNameFor(url: string, mime: string): string {
  const base = /^data:/i.test(url)
    ? `pasted-${Date.now()}`
    : (url.split(/[?#]/)[0]!.split('/').pop() || `image-${Date.now()}`);
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  // An image type supplies the extension; anything else keeps the bare name,
  // and Verify sniffs the bytes rather than trusting the name.
  if (!IMAGE_MIME.test(mime)) return base;
  const ext = mime === 'image/svg+xml' ? 'svg'
    : (mime.slice(6).replace('jpeg', 'jpg').replace('vnd.microsoft.icon', 'ico').replace('x-icon', 'ico') || 'png');
  return `${base}.${ext}`;
}

export interface FetchUrlOpts {
  /** Accept any content type, not only `image/*`. The proxy path stays images-only. */
  anyType?: boolean;
}

/** Fetch one URL and turn an image response into a File; throw on anything else. */
async function fetchToImageFile(fetchUrl: string, srcUrl: string, opts: FetchUrlOpts = {}): Promise<File> {
  let res: Response;
  try {
    res = await fetch(fetchUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    const name = (e as Error)?.name;
    throw new AddViaUrlError(name === 'TimeoutError'
      ? t('That address took too long to answer.')
      : t('That address could not be reached from this browser.'));
  }
  if (!res.ok) {
    // The proxy answers a JSON {error} we can surface verbatim (SSRF refusal,
    // "not an image", rate limit, and so on); a same-origin failure may not.
    let msg = '';
    try { msg = String(((await res.clone().json()) as { error?: unknown })?.error ?? ''); } catch { /* not JSON */ }
    throw new AddViaUrlError(msg || t('That address answered with an error ({status}).', { status: String(res.status) }));
  }
  const blob = await res.blob();
  const mime = (blob.type || '').toLowerCase();
  if (!opts.anyType && !IMAGE_MIME.test(mime)) throw new AddViaUrlError(t('That URL is not an image.'));
  return new File([blob], fileNameFor(srcUrl, mime), { type: blob.type || (opts.anyType ? '' : 'image/png') });
}

/**
 * Fetch a remote image URL (or `data:` URI) into a File, choosing the direct or
 * the proxied path for this shell. Throws AddViaUrlError with a user-ready
 * message on any failure - including the honest "this browser blocked it" case.
 */
export async function fetchImageUrlAsFile(rawUrl: string, opts: FetchUrlOpts = {}): Promise<File> {
  const url = rawUrl.trim();
  if (/^data:/i.test(url)) return fetchToImageFile(url, url, opts);   // CSP admits data:
  if (!/^https?:\/\//i.test(url)) throw new AddViaUrlError(t('Enter an image address that starts with https://'));

  let sameOrigin = false;
  try { sameOrigin = new URL(url).origin === location.origin; }
  catch { throw new AddViaUrlError(t("That doesn't look like a valid web address.")); }

  // Direct where it can work; the same-origin proxy otherwise. A Tauri/dev direct
  // attempt that a host's CORS refuses still falls through to the proxy.
  if (sameOrigin || canFetchAnyOrigin()) {
    try { return await fetchToImageFile(url, url, opts); }
    catch (e) { if (sameOrigin) throw e; /* else try the proxy */ }
  }
  return fetchToImageFile(`${IMAGE_PROXY_PATH}?url=${encodeURIComponent(url)}`, url);
}

/** True for a string worth treating as a fetchable image address (not a search). */
export function looksLikeImageUrl(raw: string): boolean {
  return /^(https?:\/\/|data:image\/)/i.test(raw.trim());
}

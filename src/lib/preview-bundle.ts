// SPDX-License-Identifier: MPL-2.0
/**
 * Pre-rendered preview-look bundle (client side).
 *
 * The gallery's featured hero row and example-carousel tiles cross-fade each tool through
 * a handful of example LOOKS. Rendering those live on the client is the dominant first-load
 * cost - each look loads the engine, runs the tool off-screen, and fetches its own photos/
 * logos on the main thread (the measured LCP 8.3 s / TBT 730 ms - see featured-row.ts).
 *
 * `pnpm run previews` pre-renders each look to a committed SVGO'd SVG (or a webp/png when the
 * look is raster-heavy) and build:catalog indexes them in ONE catalog/previews/bundle.json.
 * That file is a MANIFEST, not a payload: `<toolId>:<i>` → { src, sig }. We fetch it ONCE
 * (memoised, HTTP + service-worker cached) and hand renderFeaturedVariant the look's src -
 * no engine, no render. A look that isn't in the bundle (not yet generated, or a profile-
 * personalised preview) simply falls through to the existing live render, so this is a pure
 * speed-up that degrades gracefully: an absent/failed bundle changes nothing but the timing.
 *
 * It used to inline each SVG look into the bundle and hand back a data-URL. Same win on the
 * engine, but the file reached 2.64 MB raw / 1.05 MB brotli and EVERY tile's art waited on
 * all of it - the bundle only ever had to spare the client a live render, and a look is a
 * static same-origin file the browser fetches lazily per tile (and the SW serves it
 * stale-while-revalidate). Referencing brought the same manifest to 29 KB / 8 KB gz.
 *
 * Referencing did add ONE failure an inlined data-URL could not have: the manifest can name
 * a file that is no longer there. That is not this module's to catch - it hands back a src
 * and the <img> discovers it - so the contract for every caller is on bundledLook() below.
 */

import { instanceFetch, instancePath } from './instance.ts';

/** One look: the same-origin path to its file; `sig` guards against staleness. */
interface BundleEntry { src?: string; sig?: string }

// Fetched at most once per page. Any failure resolves to {} → every look live-renders,
// exactly as before the bundle existed.
let bundlePromise: Promise<Record<string, BundleEntry>> | null = null;

export function loadPreviewBundle(): Promise<Record<string, BundleEntry>> {
  if (!bundlePromise) {
    bundlePromise = instanceFetch(instancePath('/catalog/previews/bundle.json'))
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, BundleEntry>>) : {}))
      .catch(() => ({}));
  }
  return bundlePromise;
}

/**
 * The <img> src for a pre-rendered look, or null to fall back to a live render.
 * `sig` is JSON.stringify(look.values) - a mismatch means the bundle predates a manifest
 * edit, so we reject it and let the live render (which uses the current values) win.
 *
 * It is a URL, not a guarantee: the manifest asserts the look file existed when the build
 * indexed it, and a non-null return only means the entry is PRESENT and current. The file
 * itself can be gone by the time the browser asks (a look deleted from the catalog, a
 * half-copied deploy, a manifest published ahead of its previews). While looks were inlined
 * as data-URLs that could not happen, so callers listened for `load` alone; now every
 * surface that paints one must also handle `error` - renderMissingLook() in
 * lib/featured-render.ts is the one fallback for it, and it produces the same live render
 * a null from here already takes.
 *
 * The src goes back through instancePath because the MANIFEST came from the instance: with
 * a remote base set, the paths it names are that deployment's look files, and resolving them
 * against this origin would 404. A no-op passthrough in the default same-origin state.
 */
export async function bundledLook(
  toolId: string,
  index: number,
  sig: string,
): Promise<string | null> {
  const bundle = await loadPreviewBundle();
  const entry = bundle[`${toolId}:${index}`];
  if (!entry) return null;
  if (entry.sig != null && entry.sig !== sig) return null;
  return entry.src ? instancePath(entry.src) : null;
}

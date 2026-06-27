// SPDX-License-Identifier: MPL-2.0
/**
 * Profile-personalized gallery previews.
 *
 * The committed tools/<id>/preview.{svg,png} (see scripts/build-thumbs.js) are
 * rendered with placeholder defaults. Once the user opts in to "use my details"
 * (profile.useDetails), the handful of tools that pre-fill from the profile
 * (bindToProfile) can show the user's own name/signature instead. This module
 * re-renders just those tools, off the critical path, and the gallery lazily
 * swaps the new image in.
 *
 * Performance is the whole constraint here:
 *   - SCOPE: only tools flagged `personalized` in the catalog index AND able to
 *     export a raster format (so the result is usable as an <img>) are touched.
 *     For the current catalog that's two tools; the other ~24 are never rendered
 *     because their output doesn't change with the profile.
 *   - IDLE + SERIAL: each render is *started* on a requestIdleCallback and they
 *     run one at a time, so the queue yields to interaction between renders and
 *     never piles up. (A single render isn't itself time-sliced — but the set is
 *     tiny, see SCOPE — and the next is only scheduled once the previous resolves.)
 *   - CACHED: each result is persisted (host.previews) keyed by a profile `sig`,
 *     so the work happens once per profile change, not once per gallery visit.
 *
 * The actual render reuses renderRowToBlob — the same off-screen path the compose
 * bridge and batch mode use — so the personalized thumbnail is produced by the
 * exact engine path a real export would take, picking up the live profile through
 * createRuntime's bindToProfile resolution.
 */

import { renderRowToBlob } from './pro/render-export.js';

// Raster formats a tool must be able to emit for us to produce an <img> thumbnail.
// A profile-bound tool that can only export pdf (e.g. multi-page-pdf) is skipped:
// chooseFormat() would hand back pdf, which isn't displayable, and its bound fields
// (back-page email/phone) don't show on a cover thumbnail anyway.
const RASTER_FORMATS = ['png', 'jpg', 'jpeg', 'webp'];

// Profile fields any tool currently binds via bindToProfile. The signature changes
// iff one of these changes, which is exactly when a personalized thumbnail goes
// stale. (Headshot is intentionally absent — no tool binds it today.)
const SIGNATURE_FIELDS = ['firstname', 'lastname', 'email', 'phone', 'city', 'country'];

const ric = (cb) =>
  (typeof requestIdleCallback === 'function'
    ? requestIdleCallback(cb, { timeout: 2000 })
    : setTimeout(cb, 1));

/**
 * A stable signature of the profile fields that affect personalized previews.
 * Returns '' when the user hasn't opted in — the caller treats '' as "don't
 * personalize", so opting out instantly reverts cards to the committed previews.
 */
export function profileSignature(profile) {
  if (!profile || !profile.useDetails) return '';
  return JSON.stringify(SIGNATURE_FIELDS.map((f) => profile[f] ?? ''));
}

// The displayable raster format a tool can render to (the first it declares), or
// null if it has none. Drives both eligibility and the actual render format, so
// they can never disagree.
export function rasterFormatFor(toolEntry) {
  if (!Array.isArray(toolEntry?.formats)) return null;
  return toolEntry.formats.find((f) => RASTER_FORMATS.includes(f)) ?? null;
}

/** Can this catalog index entry yield a profile-personalized <img> thumbnail? */
export function canPersonalize(toolEntry) {
  return !!toolEntry?.personalized && !!toolEntry?.preview && !!rasterFormatFor(toolEntry);
}

/**
 * Render personalized thumbnails for `tools` (catalog index entries), serially on
 * idle, and report each as a data-URL via onThumb(toolId, dataUrl). Results are
 * persisted via host.previews keyed by `sig`. Returns a cancel() function.
 */
export function regeneratePreviews({ host, tools, sig, onThumb }) {
  let cancelled = false;
  const queue = [...tools];

  async function step() {
    if (cancelled) return;
    const tool = queue.shift();
    if (tool === undefined) return;
    const toolId = tool.id;
    try {
      // Render to the same raster format that made the tool eligible (not a
      // hard-coded 'png'), so chooseFormat never falls back to a non-displayable
      // format. No values → createRuntime fills bindToProfile inputs from the live
      // profile. watermark/embedMeta off: an intermediate thumbnail, not a deliverable.
      const { blob } = await renderRowToBlob(
        { toolId, values: {} },
        host,
        { format: rasterFormatFor(tool) ?? 'png', watermark: false, embedMeta: false, thumbnail: true },
      );
      if (cancelled) return;
      const thumb = await rasterToThumbnailDataUrl(blob);
      if (cancelled) return;
      await host.previews?.put(toolId, { thumb, sig });
      if (!cancelled) onThumb(toolId, thumb);
    } catch (e) {
      host.log?.('warn', `Personalized preview failed for ${toolId}`, { error: String(e?.message ?? e) });
    }
    if (!cancelled && queue.length) ric(step);
  }

  ric(step);
  return () => { cancelled = true; };
}

// Downscale a full-resolution render to a gallery-sized PNG data-URL — mirrors the
// 720×560 ceiling captureThumbnail uses, so a personalized preview is the same
// weight as a committed one. Never upscales.
async function rasterToThumbnailDataUrl(blob, maxW = 720, maxH = 560) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const nw = img.naturalWidth || maxW;
    const nh = img.naturalHeight || maxH;
    const scale = Math.min(maxW / nw, maxH / nh, 1);
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

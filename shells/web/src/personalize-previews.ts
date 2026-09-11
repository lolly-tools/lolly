// SPDX-License-Identifier: MPL-2.0
/**
 * Profile-personalized gallery previews.
 *
 * The committed tools/<id>/preview.{svg,png} (see scripts/build-thumbs.ts) are
 * rendered with placeholder defaults. Once the user opts in to "use my details"
 * (profile.useDetails), the handful of tools that pre-fill from the profile
 * (bindToProfile) can show the user's own name/signature instead. This module
 * re-renders just those tools, off the critical path, and the gallery lazily
 * swaps the new image in.
 *
 * Performance constrains everything in this module:
 *   - SCOPE: only tools flagged `personalized` in the catalog index AND able to
 *     export a raster format (so the result is usable as an <img>) are touched.
 *     For the current catalog that's two tools; the other ~24 are never rendered
 *     because their output doesn't change with the profile.
 *   - IDLE + SERIAL: each render is *started* on a requestIdleCallback and they
 *     run one at a time, so the queue yields to interaction between renders and
 *     never piles up. (A single render isn't itself time-sliced - but the set is
 *     tiny, see SCOPE - and the next is only scheduled once the previous resolves.)
 *   - CACHED: each result is persisted (host.previews) keyed by a profile `sig`,
 *     so the work happens once per profile change, not once per gallery visit.
 *
 * The actual render reuses renderRowToBlob - the same off-screen path the compose
 * bridge and batch mode use - so the personalized thumbnail is produced by the
 * exact engine path a real export would take, picking up the live profile through
 * createRuntime's bindToProfile resolution.
 */

// render-export (→ createRuntime → Handlebars, + the tool loader → Ajv) is imported
// LAZILY inside regeneratePreviews, not statically here: the gallery imports this
// module on the landing (for the pure profileSignature/canPersonalize helpers), and a
// static import would drag the whole render engine onto the render-blocking boot chunk.
// Regenerating personalized previews is deferred post-paint work, so it loads then.
import { rasterToThumbnailDataUrl } from './lib/raster-thumb.ts';
import type { HostV1, Profile } from '@lolly-tools/core/host-v1';

/** The slice of a catalog index entry this module reads. */
export interface PersonalizableToolEntry {
  id: string;
  formats?: readonly string[];
  personalized?: boolean;
  preview?: string;
}

/**
 * The slice of the host bridge this module touches: everything the engine's
 * render path needs (HostV1 - renderRowToBlob mounts a real runtime), plus the
 * previews store this module writes thumbnails into.
 */
interface PreviewHost extends HostV1 {
  previews?: { put(toolId: string, entry: { thumb: string; sig: string }): Promise<unknown> };
}

// Raster formats a tool must be able to emit for us to produce an <img> thumbnail.
// A profile-bound tool that can only export pdf (e.g. multi-page-pdf) is skipped:
// chooseFormat() would hand back pdf, which isn't displayable, and its bound fields
// (back-page email/phone) don't show on a cover thumbnail anyway.
const RASTER_FORMATS = ['png', 'jpg', 'jpeg', 'webp'];

// Profile fields any tool currently binds via bindToProfile. The signature changes
// iff one of these changes, which is exactly when a personalized thumbnail goes
// stale. (Headshot is intentionally absent - no tool binds it today.)
const SIGNATURE_FIELDS: ReadonlyArray<'firstname' | 'lastname' | 'email' | 'phone' | 'city' | 'country'> =
  ['firstname', 'lastname', 'email', 'phone', 'city', 'country'];

const ric = (cb: () => void) =>
  (typeof requestIdleCallback === 'function'
    ? requestIdleCallback(cb, { timeout: 2000 })
    : setTimeout(cb, 1));

/**
 * A stable signature of the profile fields that affect personalized previews.
 * Returns '' when the user hasn't opted in - the caller treats '' as "don't
 * personalize", so opting out instantly reverts cards to the committed previews.
 */
export function profileSignature(profile: Profile | null | undefined): string {
  if (!profile || !profile.useDetails) return '';
  return JSON.stringify(SIGNATURE_FIELDS.map((f) => profile[f] ?? ''));
}

// The displayable raster format a tool can render to (the first it declares), or
// null if it has none. Drives both eligibility and the actual render format, so
// they can never disagree.
export function rasterFormatFor(toolEntry: PersonalizableToolEntry | null | undefined): string | null {
  if (!Array.isArray(toolEntry?.formats)) return null;
  return toolEntry.formats.find((f) => RASTER_FORMATS.includes(f)) ?? null;
}

/** Can this catalog index entry yield a profile-personalized <img> thumbnail? */
export function canPersonalize(toolEntry: PersonalizableToolEntry | null | undefined): boolean {
  return !!toolEntry?.personalized && !!toolEntry?.preview && !!rasterFormatFor(toolEntry);
}

export interface RegeneratePreviewsOpts {
  host: PreviewHost;
  tools: readonly PersonalizableToolEntry[];
  sig: string;
  onThumb(toolId: string, dataUrl: string): void;
}

/**
 * Render personalized thumbnails for `tools` (catalog index entries), serially on
 * idle, and report each as a data-URL via onThumb(toolId, dataUrl). Results are
 * persisted via host.previews keyed by `sig`. Returns a cancel() function.
 */
export function regeneratePreviews({ host, tools, sig, onThumb }: RegeneratePreviewsOpts): () => void {
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
      const { renderRowToBlob } = await import('./pro/render-export.ts');
      const { blob } = await renderRowToBlob(
        { toolId, values: {} },
        host,
        { format: rasterFormatFor(tool) ?? 'png', watermark: false, embedMeta: false, thumbnail: true, thumbAssets: true },
      );
      if (cancelled) return;
      const thumb = await rasterToThumbnailDataUrl(blob);
      if (cancelled) return;
      await host.previews?.put(toolId, { thumb, sig });
      if (!cancelled) onThumb(toolId, thumb);
    } catch (e) {
      host.log?.('warn', `Personalized preview failed for ${toolId}`, { error: String((e as { message?: unknown })?.message ?? e) });
    }
    if (!cancelled && queue.length) ric(step);
  }

  ric(step);
  return () => { cancelled = true; };
}

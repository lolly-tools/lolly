// SPDX-License-Identifier: MPL-2.0
/**
 * PreviewsAPI — cache of profile-personalized gallery preview thumbnails.
 *
 * When the user opts in to "use my details", the gallery re-renders the previews
 * of the few tools that pre-fill from the profile (bindToProfile) so the cards
 * show their name/signature instead of the committed placeholder. Those renders
 * are expensive, so the results are cached here (one record per toolId) and re-used
 * on later visits — keyed by a `sig` of the profile fields, so a profile edit
 * naturally invalidates them (a stale-sig record is ignored and re-rendered).
 *
 * This is a HOST-UI helper (like host.profile.set) — it is NOT part of the
 * tool-facing v1 bridge contract, so other shells need not implement it; the
 * gallery feature-detects `host.previews` and degrades to committed previews.
 *
 * It is pure regenerable cache: deliberately excluded from the portable backup
 * (data-transfer.js only travels profile/state/assets), and dropped if the DB is
 * ever rebuilt. Thumbnails are stored as data-URL strings (same shape the gallery
 * already consumes for session thumbnails), so a hit is used as an <img> src verbatim.
 */

const STORE = 'generated-previews';

export function createPreviewsAPI(db) {
  return {
    /** All cached records: [{ toolId, thumb, sig, updatedAt }]. */
    async list() {
      try { return await db.getAll(STORE); }
      catch { return []; }
    },
    /**
     * Approximate bytes this cache occupies, for the storage UI. Thumbs are
     * data-URL strings (ASCII, so length ≈ bytes — same byte-estimate spirit as
     * host.state.sizes()). try/catch → 0 so a missing/rebuilt store never throws.
     */
    async size() {
      try {
        const recs = await db.getAll(STORE);
        return recs.reduce((n, r) => n + (r?.thumb ? r.thumb.length : 0), 0);
      } catch { return 0; }
    },
    async get(toolId) {
      try { return (await db.get(STORE, toolId)) ?? null; }
      catch { return null; }
    },
    async put(toolId, { thumb, sig }) {
      await db.put(STORE, { toolId, thumb, sig, updatedAt: new Date().toISOString() });
    },
    async delete(toolId) {
      try { await db.delete(STORE, toolId); } catch { /* nothing to delete */ }
    },
    async clear() {
      try { await db.clear(STORE); } catch { /* already empty */ }
    },
  };
}

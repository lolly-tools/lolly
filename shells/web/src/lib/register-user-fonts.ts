// SPDX-License-Identifier: MPL-2.0
/**
 * The boot-path slice of user-fonts.ts: load every stored user font into
 * document.fonts, and keep the synchronous family-name snapshot tools read.
 *
 * WHY IT IS SPLIT OUT
 * main.ts needs exactly ONE symbol from user-fonts.ts at boot - 
 * `registerUserFonts` - but user-fonts.ts exports ~24, and the retained export
 * set of a shared module is the UNION over every importer (the same mechanism
 * that made the engine barrel expensive). The brand editor imports the rest, so
 * boot was paying for `installGoogleFont` and, through it, the whole
 * lib/google-fonts.ts fetcher. Worse, user-fonts.ts's static
 * `bustFontRegistry` import was the ONLY reason bridge/font-registry.ts (the
 * vector-export font resolver, ~2.4 KB gz) was on the preload set at all.
 *
 * `registerUserFonts` itself genuinely belongs at boot: the faces must be in
 * document.fonts before applyChromeBrandVars applies a `--font-brand` stack that
 * may name one of them, and it primes the sync `brandFontFamilies()` cache a
 * deep-linked tool's font select reads. So the CALL stays; the MODULE shrank.
 *
 * The family cache and the REGISTERED face map live here and nowhere else - 
 * user-fonts.ts imports them from this file. Two copies of either would be a
 * silent bug: `brandFontFamilies()` would return [] to a tool's select while
 * boot populated the other copy, and removeUserFont would fail to unload faces.
 */

import { designMaterialOf } from '../../../../engine/src/design-system.ts';

/** Asset-id prefix every stored user font of the DEFAULT design system shares.
 *  A namespaced system's fonts live at `user/ds/<id>/fonts/...` (plans/186
 *  section 3.2); `designMaterialOf` reads both shapes. */
export const USER_FONT_PREFIX = 'user/fonts/';

/** The minimum a host must expose for the font paths here. Structurally
 *  compatible with user-fonts.ts's fuller UserFontsHost. `designSystems` is
 *  optional: with it only the ACTIVE system's faces are registered (and the
 *  others unloaded); without it every stored face loads, as before. */
export interface RegisterFontsHost {
  assets: {
    _exportUserAssets: () => Promise<Array<{ id: string; type: string; blob?: Blob; meta?: Record<string, unknown> }>>;
  };
  designSystems?: { active(): Promise<{ id: string }> };
}

/** True when `id` is a font row of the design system `systemId` - or, with no
 *  system given, any user font row at all (the pre-registry behaviour). */
export function isFontOf(id: string, systemId: string | null): boolean {
  const m = designMaterialOf(id);
  if (!m || m.kind !== 'font') return false;
  return systemId === null || m.systemId === systemId;
}

// ── Brand-font family cache (for tool selectors that list every added font) ────
// A SYNCHRONOUS snapshot of the installed brand-font family names, so a tool's
// input renderer (which runs sync) can offer them as select options without an
// async round-trip. Refreshed at boot (registerUserFonts) and after every
// install / removal; a change fires 'lolly:brand-fonts' for anything that wants
// to react (mounted tools re-read it on their next render regardless).
let brandFontFamilyCache: string[] = [];
/** The installed brand-font family names (a copy - safe to mutate). */
export function brandFontFamilies(): string[] { return brandFontFamilyCache.slice(); }
export function setBrandFontFamilyCache(families: string[]): void {
  const next = [...new Set(families.filter(Boolean))];
  const changed = next.length !== brandFontFamilyCache.length || next.some((f, i) => f !== brandFontFamilyCache[i]);
  brandFontFamilyCache = next;
  if (changed && typeof document !== 'undefined') document.dispatchEvent(new Event('lolly:brand-fonts'));
}

// ── FontFace registration ─────────────────────────────────────────────────────

// Track what this document already registered (asset id → FontFace) so boot +
// install + import can all call register without duplicating faces, and delete
// can unload the exact faces it removes.
export const REGISTERED = new Map<string, FontFace>();

async function registerFace(
  assetId: string,
  family: string,
  blob: Blob,
  desc: { weight?: string; style?: string; unicodeRange?: string },
): Promise<void> {
  if (REGISTERED.has(assetId) || typeof FontFace === 'undefined') return;
  const face = new FontFace(family, await blob.arrayBuffer(), {
    weight: desc.weight || '400',
    style: desc.style || 'normal',
    ...(desc.unicodeRange ? { unicodeRange: desc.unicodeRange } : {}),
  });
  await face.load();
  (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
  REGISTERED.set(assetId, face);
}

/**
 * Load every stored user font into document.fonts. Call at boot (before the
 * brand vars land there's nothing to render in the face yet - it's async and
 * best-effort) and after a backup import. Idempotent per document.
 */
export async function registerUserFonts(host: RegisterFontsHost): Promise<void> {
  // Which design system's faces belong in document.fonts (plans/186 section 3.4
  // step 3). The shipped system owns no user rows, so under it nothing registers
  // and every previously loaded face is unloaded below.
  let systemId: string | null = null;
  try { systemId = (await host.designSystems?.active())?.id ?? null; } catch { systemId = null; }
  // The installed set may have just changed (install, brand pack, backup restore
  // - every path funnels through here), so the vector-export font registry must
  // re-read it rather than serve a stale family map. See bridge/font-registry.ts.
  //
  // Dynamic, and that is safe rather than sloppy: the registry it busts resolves
  // fonts for VECTOR EXPORT, which cannot run before a tool has mounted and the
  // user has pressed Get/Save. Nothing at boot reads that cache, so the reset
  // landing a microtask later is unobservable - and importing it eagerly would
  // put the whole export-side font resolver back on first paint.
  void import('../bridge/font-registry.ts').then(m => m.bustFontRegistry()).catch(() => { /* best-effort */ });
  let records: Array<{ id: string; type: string; blob?: Blob; meta?: Record<string, unknown> }>;
  try { records = await host.assets._exportUserAssets(); }
  catch { return; }
  // Refresh the family cache FIRST, off the records' meta - it needs only the
  // family names, not loaded FontFaces, so populating it before the (awaited)
  // face-load below means a tool that renders during boot (a deep link straight
  // to a font-picking tool) already sees the installed brand fonts in its select,
  // instead of racing the parse. Covers boot, install (installGoogleFont calls us)
  // and backup import; one store read for both.
  const wanted = records.filter(r => r.type === 'font' && isFontOf(r.id, systemId));
  setBrandFontFamilyCache(wanted.map(r => String(r.meta?.family ?? r.meta?.name ?? '')));
  // The unregister pass: a face loaded for another design system (or one whose
  // row is gone) leaves document.fonts, or the CSS font matcher would keep
  // answering with the outgoing system's bytes for a family name both share.
  const keep = new Set(wanted.map(r => r.id));
  for (const [assetId, face] of REGISTERED) {
    if (keep.has(assetId)) continue;
    try { (document.fonts as unknown as { delete: (f: FontFace) => boolean }).delete(face); } catch { /* already gone */ }
    REGISTERED.delete(assetId);
  }
  await Promise.all(wanted
    .filter(r => r.blob)
    .map(r => registerFace(r.id, String(r.meta?.family ?? r.meta?.name ?? ''), r.blob!, {
      weight: typeof r.meta?.weight === 'string' ? r.meta.weight : undefined,
      style: typeof r.meta?.style === 'string' ? r.meta.style : undefined,
      unicodeRange: typeof r.meta?.unicodeRange === 'string' ? r.meta.unicodeRange : undefined,
    }).catch(() => { /* one broken face never blocks the rest */ })));
}

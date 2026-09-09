// SPDX-License-Identifier: MPL-2.0
/**
 * Module-level declarations of catalog.ts that its feature modules use: the types,
 * constants and pure helpers that used to sit above mountCatalog(). Moved here verbatim so
 * no feature module has to import the orchestrator file. The asset catalog view.
 */
import type { TypeFilter } from '../catalog-filter.ts';
import { t } from '../../i18n.ts';
import { mountZoomHud } from '../../components/zoom-hud.ts';
import type { TextSignalPanel } from '../valid-text.ts';
import { icon } from '../../lib/icons.ts';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { perfUiOn } from '../../feature-flags.ts';
import { halfWindow, offsetToUv } from '../../lib/loupe-gl.ts';
import type { Loupe } from '../../lib/loupe-gl.ts';
import type { FontDownload } from '../../lib/typefaces.ts';
import type { RewordCandidate, RewordSpan, RewordSuggestion } from '@lolly/engine';
import type { RewordStatus } from '../../lib/reworder.ts';
import type { DerivedSignInputs } from '../../lib/derived-asset.ts';
import type { AssetRef, HostV1, Profile } from '@lolly-tools/core/host-v1';
import type { PhotoTreatment } from '../../../../../engine/src/photo-treatment.ts';
import type { IconTheme } from '../../../../../engine/src/icon-theme.ts';

// The user's headshot is a user asset but is managed on /profile (and backs
// profile.headshot) - keep it out of the Catalog grid so it can't be orphaned here.
export const HEADSHOT_ID = 'user/headshot';
// Only assets that thumbnail as an image belong in the grid; palette/tokens/font/
// profile entries are engine data (Swatches + Fonts panels cover those below).
// Shared with the folder overlays, which had no filter at all - see lib/asset-kinds.ts.

/** A font as the catalogue renders it - a bundled spec or an on-device user font. */
export interface CatFont {
  family: string; role: string; stack: string; typeLine: string;
  downloads: FontDownload[]; onDevice: boolean;
}

// Coarse filetype filter for the sticky toolbar - buckets over the asset types, NOT one
// option per export format (which would be a huge, noisy list): Image = raster
// photos/logos, Vector = SVG/EPS artwork, Motion = video + Lottie animations, Audio =
// the music/audio tiles admitted into the catalogue view (see the allAssets filter below).
// TypeFilter + its bucket table live in catalog-filter.ts with the predicates
// that read them, so the type and the rule cannot drift apart.
// Toolbar glyphs (Lucide house style). Each button shows icon + label on desktop and
// collapses to the icon alone on mobile (see .cat-btn-label in catalog.css).
export const catIco = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
export const CAT_ICONS = {
  all:      catIco('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
  image:    catIco('<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
  vector:   catIco('<path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/>'),
  motion:   catIco('<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>'),
  audio:    catIco('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  model:    catIco('<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  lut:      catIco('<circle cx="9" cy="9" r="7"/><circle cx="15" cy="15" r="7"/>'),
  text:     catIco('<path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/>'),
  collapse: catIco('<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>'),
  expand:   catIco('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>'),
  eye:      catIco('<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff:   catIco('<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>'),
  upload:   catIco('<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'),
};
// Update a sticky-toolbar toggle (Collapse-all / Show-hidden) in place: swap its glyph
// + label span and keep the accessible name in sync. A plain `.textContent =` would drop
// the SVG icon entirely - and, since these buttons are icon-only on the toolbar (the
// label is hidden), leave a bare word behind - as well as re-width the centred pill.
export function setCatToggle(btn: HTMLElement, icon: string, label: string): void {
  btn.innerHTML = `${icon}<span class="cat-btn-label">${label}</span>`;
  btn.title = label;
  btn.setAttribute('aria-label', label);
}
// Each type filter has a signature click sound: image = a camera shutter snick,
// vector = a pencil scribble, motion = a film reel spinning up to smooth, audio = a
// synth pulse lighting up like a waveform.
export const TYPE_FILTERS: { key: TypeFilter; label: string; icon: string; sfx?: string }[] = [
  { key: 'all', label: 'All', icon: CAT_ICONS.all },
  { key: 'image', label: 'Image', icon: CAT_ICONS.image, sfx: 'aperture' },
  { key: 'vector', label: 'Vector', icon: CAT_ICONS.vector, sfx: 'scribble' },
  { key: 'motion', label: 'Motion', icon: CAT_ICONS.motion, sfx: 'reel' },
  { key: '3d', label: '3D', icon: CAT_ICONS.model },
  { key: 'lut', label: 'LUTs', icon: CAT_ICONS.lut },
  { key: 'audio', label: 'Audio', icon: CAT_ICONS.audio, sfx: 'waveform' },
  { key: 'text', label: 'Text', icon: CAT_ICONS.text },
];

/** Stand-in for the search index when there is no query to match against. */
export const EMPTY_HAYSTACK: ReadonlyMap<string, string> = new Map();

/** One stored user-upload record - mirrors bridge/assets.ts's non-exported
 *  UserAssetRecord for the fields the trim rewrite reads and carries forward
 *  (the same local mirror views/picker.ts keeps for its upload write). */
export interface UserAssetRecordLike {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob?: Blob;
  version?: string;
  checksum?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
  credential?: Uint8Array;
  credentialFormat?: string;
  aiGenerated?: 'full' | 'partial';
}

/** The persisted per-asset AI-likelihood note (plans/125), kept on a USER upload's
 *  `meta.aiSignals` after an in-modal Analyse text / Read text run. `v` keys the
 *  verdict to the tell lexicon that produced it: a LEXICON_VERSION bump silently
 *  retires every stale note rather than letting an old verdict outlive its rules. */
export interface AiSignalsNote {
  v: number;
  band: TextSignalPanel['band'];
  score: number;
  source: 'digital' | 'ocr';
  family?: string;
  confidence?: 'low' | 'high';
}

// The web shell's concrete host exposes more than the tool-facing HostV1 contract; we
// reach for the user-asset helpers + profile.set(). main.ts passes the concrete WebHost
// (assignable to HostV1), so the parameter stays HostV1 and this narrows locally.
export interface CatalogHost extends HostV1 {
  assets: HostV1['assets'] & {
    _listUserAssets(): Promise<AssetRef[]>;
    _deleteUserAsset(id: string): Promise<void>;
    _duplicateUserAsset(id: string): Promise<string | null>;
    _renameUserAsset(id: string, name: string): Promise<void>;
    _restampUserAsset(id: string, patch: { blob: Blob; credential: Uint8Array; credentialFormat: string }): Promise<void>;
    // The retro-trim's read + write (see measureTrim / commitTrim). Records, not
    // AssetRefs: a rewrite has to carry forward everything the ref does not surface.
    _exportUserAssets(): Promise<readonly UserAssetRecordLike[]>;
    _uploadUserAsset(record: UserAssetRecordLike): Promise<void>;
    // The meta-only annotation write (AI-signals note, declare-AI-origins): no
    // quota metering, no pin-preserve - the stored bytes are untouched.
    _updateUserAssetMeta(id: string, meta: Record<string, unknown>, patch?: { aiGenerated?: 'full' | 'partial' | null }): Promise<void>;
    _iconThemes?(): Promise<IconTheme[]>;
    _photoTreatments?(): Promise<PhotoTreatment[]>;
  };
  profile: HostV1['profile'] & { set(profile: Profile): Promise<unknown> };
}

// Two-colour icons ('themable', c1/c2) and multi-colour illustrations ('illustration',
// monochromatic remap) both take a colour theme - the engine recolour handles each shape.
// Content-credentialed icons are included: a recolour breaks the embedded byte
// binding, but the download path re-signs the result with the original credential
// preserved as an ingredient (see downloadSigned), so the chain survives the edit.
export const isThemable = (ref: AssetRef): boolean => {
  const tags = ref.meta?.tags as string[] | undefined;
  return Boolean(tags?.includes('themable') || tags?.includes('illustration'));
};

// Sentinel "theme" = the asset's own bytes, unchanged. Downloading the original
// keeps any embedded Content Credential intact byte-for-byte; a recolour changes
// the bytes, so its now-mismatched credential is stripped from them - and the
// download is re-signed with a Lolly manifest that records the recolour and
// carries the original credential as an ingredient.
export const ORIGINAL_THEME = '__original';
export const stripC2paManifest = (svg: string): string =>
  svg.replace(/<metadata>\s*<c2pa:manifest>[\s\S]*?<\/c2pa:manifest>\s*<\/metadata>/g, '')
    .replace(/<c2pa:manifest>[\s\S]*?<\/c2pa:manifest>/g, '');
export const isVector = (ref: AssetRef): boolean => ref.type === 'vector';
// The date a CATALOG asset's file was first added to its brand pack, as the index
// carries it (`added`, YYYY-MM-DD, stamped by npm run build:catalog). Read at noon
// UTC so a reader west of UTC is not shown the day before. Empty string when the
// asset has no date, which is every upload - those carry a millisecond stamp
// instead and go through assetAddedAt.
export const catalogAddedText = (ref: AssetRef): string => {
  const iso = typeof ref.meta?.added === 'string' ? ref.meta.added : '';
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
// A safe, readable download filename from an asset's name (or id), + extension.
export function downloadName(ref: AssetRef, ext: string): string {
  const base = String(ref.meta?.name ?? ref.id.split('/').pop() ?? 'asset')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'asset';
  return `${base}.${ext}`;
}
export const svgTextToDataUrl = (svg: string): string => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
// Read a Blob's bytes as a `data:` URI - a self-contained href for an SVG <image>
// (an SVG used as an image may not load external refs), so a photo can be baked into
// a treatment wrapper client-side.
export const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result));
  fr.onerror = () => rej(fr.error ?? new Error('blob read failed'));
  fr.readAsDataURL(blob);
});
// Rasterise an SVG (given as its markup) to a Blob at exact pixel dimensions, in the
// given image type. Drawing from a same-origin data URL avoids canvas tainting, so
// toBlob always succeeds. JPEG gets an opaque white fill first (it has no alpha).
export async function svgToRaster(svgText: string, w: number, h: number, mime = 'image/png', quality = 0.97): Promise<Blob> {
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('SVG decode failed'));
    img.src = svgTextToDataUrl(svgText);
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');
  if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, quality));
  if (!blob) throw new Error('raster encode failed');
  return blob;
}
export const svgToPng = (svgText: string, w: number, h: number): Promise<Blob> => svgToRaster(svgText, w, h, 'image/png');
// Read the intrinsic aspect ratio (w/h) from an SVG's viewBox, falling back to its
// width/height attributes (many exporters omit viewBox), default 1. Percentage sizes
// (e.g. width="100%") carry no ratio, so they're ignored.
export function svgAspect(svgText: string): number {
  const vb = /viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/.exec(svgText);
  if (vb) { const w = parseFloat(vb[1]!), h = parseFloat(vb[2]!); if (w > 0 && h > 0) return w / h; }
  const dim = (name: string): number => {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"|\\b${name}\\s*=\\s*'([^']+)'`, 'i').exec(svgText);
    const v = (m?.[1] ?? m?.[2] ?? '').trim();
    return !v || v.endsWith('%') ? NaN : parseFloat(v);   // parseFloat tolerates unit suffixes (px/pt)
  };
  const w = dim('width'), h = dim('height');
  if (w > 0 && h > 0) return w / h;
  return 1;
}

// The SVG's user-space extent [minX, minY, width, height] - from viewBox, else its
// width/height attrs, else a unit square. Used to map a crop fraction onto the real
// coordinate system so a vector crop stays vector (just a narrower viewBox).
export function svgViewBox(svgText: string): [number, number, number, number] {
  const vb = /viewBox\s*=\s*["']\s*([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/.exec(svgText);
  if (vb) {
    const p = [vb[1], vb[2], vb[3], vb[4]].map(Number);
    if (p.every(n => Number.isFinite(n)) && p[2]! > 0 && p[3]! > 0) return p as [number, number, number, number];
  }
  const dim = (name: string): number => {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"|\\b${name}\\s*=\\s*'([^']+)'`, 'i').exec(svgText);
    const v = (m?.[1] ?? m?.[2] ?? '').trim();
    return !v || v.endsWith('%') ? NaN : parseFloat(v);
  };
  const w = dim('width'), h = dim('height');
  return [0, 0, w > 0 ? w : 100, h > 0 ? h : 100];
}

// Crop a vector by narrowing ONLY the root <svg>'s viewBox to the sub-rect (content
// coordinates are untouched, so it stays fully vector); width/height are set to the
// crop's size and preserveAspectRatio is forced to none so the box maps 1:1 (no
// letterbox). Only the opening tag is rewritten - child width/height are left alone.
export function cropSvg(svgText: string, box: [number, number, number, number]): string {
  const [x, y, w, h] = box;
  const m = /<svg\b([^>]*)>/i.exec(svgText);
  if (!m) return svgText;
  const attrs = m[1]!.replace(/\s(viewBox|width|height|preserveAspectRatio)\s*=\s*("[^"]*"|'[^']*')/gi, '');
  const open = `<svg${attrs} viewBox="${x} ${y} ${w} ${h}" width="${Math.round(w)}" height="${Math.round(h)}" preserveAspectRatio="none">`;
  return svgText.replace(m[0], open);
}

// ── Icons (Lucide house style) ────────────────────────────────────────────────
export const STAR_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
export const SHARE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
export const TAG_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/></svg>';
export const TRASH_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
export const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
export const EYE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
export const DOWNLOAD_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
// Lucide "crop"
export const CROP_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>';
export const CHEVRON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>';
// Larger left/right chevrons for the details modal's prev/next paging.
export const CHEVRON_LEFT = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 6 9 12 15 18"/></svg>';
export const CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>';
export const SLIDERS_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>';
export const PENCIL_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
export const ZOOM_IN_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
export const ZOOM_OUT_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
// A 2x2 pixel grid - the smooth ⇄ pixel-accurate interpolation toggle in the zoom pill.
export const INTERP_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
// Four corner brackets - the "zoom to fit" (reset to 100%) button in the zoom pill.
export const FIT_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
export const CHECK_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
// Swap arrows - "replace this file with another", keeping the same id.
export const REPLACE_ICON = icon('repeat', { size: 15 });
// Replace's file-picker accept for a still-image asset - a subset of UPLOAD_ACCEPT that omits
// video/audio/lottie/data/PDF/PPTX, so the OS dialog only offers files that can actually stand
// in for an image. (replaceUserUpload still enforces the kind at ingest as the hard guard.)
export const REPLACE_IMAGE_ACCEPT = 'image/svg+xml,image/png,image/apng,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif,image/bmp,.bmp,image/x-icon,.ico,.cur,.svg,.svgz';
// Filled play/pause glyphs for the details-modal Lottie playback overlay.
export const PLAY_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
export const PAUSE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
// Shield-check glyph for the "Check Content Credentials" action.
export const SHIELD_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';

// Containers the C2PA reader can inspect (engine c2pa-verify sniffFormat / EXTRACTORS):
// any asset in one of these formats CAN be checked, so its details page offers the
// checker - whether or not it currently carries a credential (a plain file honestly
// reports "No Content Credentials"). Audio joined the reader with the wav RIFF
// binding + mp3 (see /verify's accept list), then Ogg Opus (opus/ogg - the
// OpusTags comment binding, engine c2pa-containers placeOgg); lottie/JSON, fonts
// and tokens are still not readable, so they get no checker.
export const VERIFIABLE_FORMATS = new Set(['pdf', 'png', 'apng', 'jpg', 'jpeg', 'gif', 'svg', 'tiff', 'webp', 'avif', 'mp4', 'm4a', 'webm', 'mkv', 'mp3', 'wav', 'opus', 'ogg']);
export const isVerifiableAsset = (ref: AssetRef): boolean =>
  VERIFIABLE_FORMATS.has(String(ref.format ?? '').toLowerCase());

// True while the details modal is in inline-crop mode: the crop box owns the preview stage,
// so attachZoom's wheel/drag must stand down (and restore on exit). Module-level because
// attachZoom lives here, outside the view closure that flips it - one modal is open at a time.
export let cropModeActive = false;

/**
 * Pan/zoom the details-modal preview so a user can inspect an asset closely. Zoom *sizes*
 * the media element (`.cat-thumb`) - explicit width/height in px - rather than CSS-scaling
 * it, so a vector re-rasterises crisply at every step. (Icons carry a tiny intrinsic size - 
 * e.g. `boxes` is 10.58px - which `max-width/object-fit` only *caps*, never upscales, so the
 * old `transform: scale()` was magnifying a ~11px bitmap.) At 100% the art is fit to the
 * stage; pan is a cheap translate, clamped so it can't be dragged fully out of view, and the
 * cursor point is held fixed on wheel/button zoom (focal-zoom formula about the centred
 * origin). Double-click toggles. All listeners live on the stage element, thrown away with
 * the modal - nothing to tear down.
 */
export function attachZoom(dlg: HTMLDialogElement): void {
  const stage = dlg.querySelector<HTMLElement>('.cat-zoom-stage');
  const media = stage?.querySelector<HTMLElement>('.cat-thumb') ?? null;
  const hudEl = dlg.querySelector<HTMLElement>('.cat-zoom-hud');
  if (!stage || !media) return;
  const img = media as HTMLImageElement;
  // A Lottie preview is a mounted <svg> player (data-lottie-src marker), not an <img>: it has no
  // naturalWidth, and the SVG arrives asynchronously - so we read the aspect from its viewBox and
  // re-fit once it arrives, rather than from decode()/load.
  const isLottie = media.hasAttribute('data-lottie-src');
  const isVideo = media.tagName === 'VIDEO';   // a <video class="cat-thumb"> is pan/zoomable too
  const MIN = 0.15, FIT = 1, MAX = 20;   // out to 15%, fit=100%, in to 2000%
  const PAD = 20;                        // matches .cat-zoom-stage padding
  let s = 1, tx = 0, ty = 0;
  // The optional glass loupe (lib/loupe-gl.ts), lazy-mounted only when a pixel-peeper turns it
  // on. Null the rest of the time - zero cost. Re-captures its texture on scale change (below).
  let loupe: Loupe | null = null;
  // The s=1 "fit" box: the largest aspect-preserving rectangle inside the padded stage.
  // Zoom multiplies this box; the SVG/image then renders at that true pixel size. Measured
  // ONCE and locked - never re-measured in place. (In the mobile layout the stage height is
  // indefinite, so an already-enlarged media inflates stage.clientHeight; re-measuring off
  // that would feed back into an ever-growing base. Locking + the viewport cap below make it
  // impossible.) `object-fit: contain` (from CSS) centres the art, so a 0×0-reporting SVG
  // just falls back to the stage aspect without a runaway.
  let baseW = 0, baseH = 0, clipW = 0, clipH = 0, baseLocked = false;
  const measureBase = (): void => {
    // Lock the visible clip box at the SAME moment as the fit box, while the media is reset to
    // fit and the stage is deflated to its true size. clampPan must clamp against these locked
    // values - never a live getBoundingClientRect(). On the mobile layout the stage height is
    // indefinite (`.cat-details-preview` is `max-height: 46vh` + `overflow: hidden`), so a
    // zoomed media inflates the stage's live height to its own; clamping off that would collapse
    // the vertical pan range to ~0 and make the top/bottom corners unreachable.
    clipW = Math.min(stage.clientWidth, window.innerWidth);
    clipH = Math.min(stage.clientHeight, window.innerHeight);
    const availW = Math.max(1, clipW - PAD * 2);
    const availH = Math.max(1, clipH - PAD * 2);
    // Aspect: an <img> exposes naturalWidth/Height; a Lottie renders an <svg viewBox> we read once
    // it has mounted. Until either is known, fall back to the stage aspect (the SVG's own
    // preserveAspectRatio keeps the art undistorted meanwhile - measureBase re-runs on load).
    let ar = availW / availH;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) ar = img.naturalWidth / img.naturalHeight;
    else if (isVideo) {
      const v = media as HTMLVideoElement;
      if (v.videoWidth > 0 && v.videoHeight > 0) ar = v.videoWidth / v.videoHeight;
    }
    else if (isLottie) {
      const vb = media.querySelector('svg')?.viewBox?.baseVal;
      if (vb && vb.width > 0 && vb.height > 0) ar = vb.width / vb.height;
    }
    baseW = availW; baseH = availW / ar;
    if (baseH > availH) { baseH = availH; baseW = availH * ar; }
    baseLocked = true;
  };
  const clampPan = (): void => {
    // The pan range is the ABSOLUTE gap between the art and the stage, per axis, so
    // the art can sit anywhere from centred to one edge aligned with the matching
    // stage edge. This is what lets a cursor-anchored (focal) zoom actually hold its
    // point: the fit box is sized to the CONSTRAINING dimension, so most assets have
    // a wide margin in the other axis at low zoom - a `max(0, overflow)` clamp pinned
    // that axis to centre and yanked the cursor point back to the middle on the first
    // wheel steps ("zoom doesn't follow the mouse"). Using the absolute gap gives the
    // focal offset room while still never letting the art leave the viewport.
    const mx = Math.abs(baseW * s - clipW) / 2;
    const my = Math.abs(baseH * s - clipH) / 2;
    tx = Math.min(mx, Math.max(-mx, tx));
    ty = Math.min(my, Math.max(-my, ty));
  };
  const apply = (): void => {
    if (!baseLocked) measureBase();
    media.style.maxWidth = 'none';
    media.style.maxHeight = 'none';
    media.style.width = `${baseW * s}px`;
    media.style.height = `${baseH * s}px`;
    // The media is absolutely positioned at the stage centre (CSS left/top:50%); translate(-50%,-50%)
    // pulls it back onto that centre, then (tx,ty) pans. Grid-centring an oversized item pins it to
    // the top-left, which broke focal zoom - see the .cat-zoom-stage CSS note. Order is irrelevant for
    // pure translations, but the -50% must be present so the art's centre = stage centre + (tx,ty).
    media.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px)`;
    hud?.setReadout(`${Math.round(s * 100)}%`);
    // "zoomed" (pannable) only when the art is bigger than the fit box; at or below fit it is
    // centred with nothing to pan.
    stage.classList.toggle('is-zoomed', s > FIT + 0.001);
  };
  const zoomTo = (next: number, ox = 0, oy = 0): void => {
    const s2 = Math.min(MAX, Math.max(MIN, next));
    if (s2 === s) return;
    // Hold the cursor point fixed: screen offset = t + s·p about the centre origin.
    tx = ox - (s2 / s) * (ox - tx);
    ty = oy - (s2 / s) * (oy - ty);
    s = s2;
    if (s <= FIT + 0.001) { tx = 0; ty = 0; }   // fit or zoomed out ⇒ re-centre
    clampPan();
    apply();
    syncLoupe();   // scale changed ⇒ (de)activate the easter egg and re-capture if it's on
  };
  const offsetFrom = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)];
  };
  // A dedicated Fit button (leading the pill) resets to FIT (100%, the largest aspect-fit
  // box); the readout also resets on click, so either returns to fit.
  // Interpolation toggle, docked in the pill after a hairline (the HUD's `extras` slot):
  // smooth (bicubic, the default) ⇄ pixel-accurate (nearest-neighbor), so pixel-peepers can
  // read the exact pixels when zoomed in. Skipped for a Lottie - inline SVG has no raster to
  // sharpen. `image-rendering: pixelated` on the media is the whole effect.
  let pixelated = false;
  const closeLoupe = (): void => {
    loupe?.dispose();
    loupe = null;
    stage.classList.remove('has-loupe');
  };
  // The glass loupe is an EASTER EGG for pixel-peepers: no button of its own, and it exists only in
  // the one rare spot where a peeper lives - the stage zoomed all the way in (2000%) AND switched to
  // pixel-accurate viewing. Hitting that combination auto-mounts the WebGL magnifier (lib/loupe-gl.ts,
  // lazy-imported on first use); leaving it (zoom out, or interpolation back on) tears it down. Only
  // for a still image on a hover-capable pointer, stood down under reduced-motion / the perf-UI flag.
  const loupeCapable = !isLottie && !isVideo
    && typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches
    && !prefersReducedMotion() && !perfUiOn();
  const loupeWanted = (): boolean => pixelated && s >= MAX - 0.001;   // MAX = 20 = 2000%
  const activateLoupe = async (): Promise<void> => {
    if (!loupeCapable || loupe) return;
    const { mountLoupe } = await import('../../lib/loupe-gl.ts');
    if (loupe || !loupeWanted()) return;   // condition lapsed (or already mounted) while importing
    // A big lens - ~62% of the stage's short side, clamped - so the peeper gets a generous glass.
    const r = stage.getBoundingClientRect();
    const size = Math.max(320, Math.min(520, Math.round(Math.min(r.width, r.height) * 0.62)));
    const l = mountLoupe(stage, img, () => [baseW * s, baseH * s], size);
    if (!l) return;   // no WebGL, or a tainted cross-origin source ⇒ silently stay on plain zoom
    loupe = l;
    stage.classList.add('has-loupe');
  };
  // Reconcile the loupe with the live state - called whenever zoom or the toggle changes.
  const syncLoupe = (): void => {
    if (!loupeCapable) return;
    const want = loupeWanted();
    if (want && !loupe) { void activateLoupe(); return; }
    if (!want && loupe) { closeLoupe(); return; }
    if (loupe) loupe.refresh();   // still on, scale changed ⇒ re-capture so a vector stays crisp
  };
  const interpBtn = document.createElement('button');
  interpBtn.type = 'button';
  interpBtn.className = 'cat-zoom-btn cat-zoom-interp';
  interpBtn.innerHTML = INTERP_ICON;
  interpBtn.setAttribute('aria-pressed', 'false');
  interpBtn.setAttribute('aria-label', t('Pixel-accurate zoom'));
  interpBtn.title = t('Smooth / pixel-accurate');
  interpBtn.addEventListener('click', () => {
    pixelated = !pixelated;
    media.style.imageRendering = pixelated ? 'pixelated' : '';
    interpBtn.classList.toggle('is-active', pixelated);
    interpBtn.setAttribute('aria-pressed', String(pixelated));
    syncLoupe();   // the loupe only appears when pixel-accurate meets 2000%
  });
  const hud = hudEl ? mountZoomHud(hudEl, {
    ariaLabel: t('Zoom'),
    classes: { btn: 'cat-zoom-btn', pct: 'cat-zoom-pct', fit: 'cat-zoom-fit', sep: 'cat-zoom-sep' },
    initialReadout: '100%',
    onZoom: (dir) => zoomTo(s * (dir > 0 ? 1.5 : 1 / 1.5)),
    onFit: () => { s = FIT; tx = 0; ty = 0; apply(); syncLoupe(); },
    fitPosition: 'start',
    fitContent: FIT_ICON, fitAriaLabel: t('Fit to view'), fitTitle: t('Fit to view'),
    outContent: ZOOM_OUT_ICON,
    inContent: ZOOM_IN_ICON,
    outAriaLabel: t('Zoom out'), outTitle: t('Zoom out'),
    inAriaLabel: t('Zoom in'), inTitle: t('Zoom in'),
    pctAriaLabel: t('Reset zoom'), pctTitle: t('Reset zoom'),
    extras: isLottie ? [] : [interpBtn],
  }) : null;
  stage.addEventListener('wheel', (e) => {
    if (cropModeActive) return;   // inline crop owns the stage
    e.preventDefault();
    const [ox, oy] = offsetFrom(e);
    zoomTo(s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), ox, oy);
  }, { passive: false });
  let dragging = false, lastX = 0, lastY = 0;
  stage.addEventListener('pointerdown', (e) => {
    if (cropModeActive || s <= FIT) return;   // pan only when zoomed IN past fit
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    stage.classList.add('is-panning');
    try { stage.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    tx += e.clientX - lastX; ty += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    clampPan(); apply();
  });
  const endDrag = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-panning');
    try { stage.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  // Glass loupe render pass. Registered AFTER the pan handler so tx/ty are already updated for
  // this same pointermove. No rAF - the lens redraws only when the pointer moves.
  stage.addEventListener('pointermove', (e) => {
    if (!loupe) return;
    const [ox, oy] = offsetFrom(e);
    const W = baseW * s, H = baseH * s;
    const uv = offsetToUv(ox, oy, W, H, tx, ty);
    if (!uv) { loupe.hide(); return; }   // cursor off the art
    const [hu, hv] = halfWindow(W, H, loupe.size);
    const r = stage.getBoundingClientRect();
    loupe.render(e.clientX - r.left - loupe.size / 2, e.clientY - r.top - loupe.size / 2, uv[0], uv[1], hu, hv);
  });
  stage.addEventListener('pointerleave', () => loupe?.hide());
  stage.addEventListener('dblclick', (e) => {
    if (cropModeActive) return;
    const [ox, oy] = offsetFrom(e);
    zoomTo(s > FIT ? FIT : 2.5, ox, oy);   // dbl-click toggles fit ⇄ 250%
  });
  // Re-fit once the intrinsic aspect ratio is known. `decode()` resolves after the bytes are
  // decoded (unlike `complete`, which can be true with naturalWidth still 0); fall back to the
  // load event for older engines. Reset to 100% and drop the inline size first so the stage
  // deflates to its true dimensions before we re-measure.
  const refit = (): void => {
    s = FIT; tx = 0; ty = 0;
    media.style.width = ''; media.style.height = '';
    baseLocked = false;
    apply();
    syncLoupe();
  };
  if (isLottie) {
    // The player's <svg> mounts a tick or two after the modal opens; re-fit the moment it arrives so
    // the fit box matches the animation's true aspect (else it stays at the stage-aspect fallback).
    // The observer is dropped after the first mount, or GC'd with the modal if it never arrives.
    if (media.querySelector('svg')) refit();
    else {
      const mo = new MutationObserver(() => {
        if (media.querySelector('svg')) { mo.disconnect(); refit(); }
      });
      mo.observe(media, { childList: true, subtree: true });
    }
  } else if (isVideo) {
    const v = media as HTMLVideoElement;
    if (v.videoWidth) refit();
    else v.addEventListener('loadedmetadata', refit, { once: true });
  } else if (img.naturalWidth === 0) {
    if (typeof img.decode === 'function') img.decode().then(refit).catch(() => {});
    img.addEventListener('load', refit, { once: true });
  }
  // Free the loupe's GL context when the modal closes (a <dialog> fires 'close' on .close()).
  dlg.addEventListener('close', closeLoupe, { once: true });
  apply();
}

/** The reword plumbing's render state (plans/127), owned by the details modal
 *  and rebuilt from the CURRENT cleaned text after every accepted edit. */
export interface RewordUiState {
  /** Deterministic suggestions for the current cleaned text (Tier 1). */
  suggestions: RewordSuggestion[];
  /** Sentences worth offering the model (Tier 2), in document order. */
  spans: RewordSpan[];
  /** Gated model alternatives per span index. Absent = not asked yet;
   *  empty array = asked and nothing survived the gate. */
  alts: ReadonlyMap<number, RewordCandidate[]>;
  /** True once any model candidate was accepted - the save then stamps genAI. */
  modelTouched: boolean;
  /** Model tier standing ('unstaged' hides the section entirely). */
  status: RewordStatus;
  /** One-time model download size, for the consent line. */
  modelBytes: number;
  /** The cleaned text the indices refer to. */
  cleaned: string;
}

/** What downloadCrop hands its delivery: the (unsigned) bytes + the credential
 *  inputs. The default delivery signs-and-downloads; the crop mode's
 *  "Save to catalog" delivery signs-and-uploads instead. */
export type CropDeliver = (blob: Blob, format: string, o: DerivedSignInputs) => Promise<void>;

// The crop SOURCE the inline crop mode works from.
export interface CropSource {
  vector: boolean;
  svgText: string | null;   // working SVG (may be recoloured)
  origSvg: string | null;   // pre-recolour source - the credential ingredient
  theme: IconTheme | null;
  treatment: PhotoTreatment | null;
  rasterSrc: string;        // crop source for raster - a treatment bakes it into a wrapper
  aspect: number;           // provisional for raster; the real value is read from naturalWidth on load
}

// Crop-before-download: a dialog with the asset fitted into an aspect-matched stage
// and a drag/resize crop box over it. The box is the ONLY way to change dimensions
// (there is no width/height resize anywhere else): you frame a region and download
// just that. The stage matches the asset's aspect, so the image fills it with no
// letterbox. That makes the crop a straight fraction of the asset: box/stage gives a
// fraction, which maps to asset pixels (raster, canvas-crop) or a narrowed viewBox
// (vector, stays vector). The interaction core and the source prep are shared with
// the inline crop mode (see wireCropBox / prepCropSource), so the two paths cannot
// drift apart. The details modal's Crop action now opens the inline mode instead of
// this standalone dialog. The dialog is kept as-is, driving its own crop box the
// same way, so a future caller outside the details modal can still reach it.
// Render the framed region. Vector gives a narrowed viewBox (SVG stays vector; PNG
// rasterises that sub-viewBox). Raster gives a canvas cut of the source at natural
// resolution. Every output is a modified copy, so it goes out signed
// (downloadSigned): the crop, plus any theme/treatment already baked into the crop
// source, in the action history, and the source's own credential as an ingredient.
/** Straighten transforms the inline crop can bake in (rasters only). */
export interface CropTransform { rotate: number; quarter: number; skewX: number; skewY: number; flipH: boolean; flipV: boolean }
/** cropModeActive is an ES module binding now: importers read it live and write it through here. */
export function setCropModeActive(value: boolean): void { cropModeActive = value; }


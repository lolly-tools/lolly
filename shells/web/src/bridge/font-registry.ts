// SPDX-License-Identifier: MPL-2.0
/**
 * Which font file backs an outlined text run - the shell's answer to "vector
 * export needs an actual sfnt, not a CSS family name".
 *
 * Exports vectorise text (`Vector = text-as-paths`): HarfBuzz shapes the run and
 * we emit a <path>. That needs the FONT FILE, and until now only the SUSE statics
 * were resolvable - so a brand wearing a Google font (or the platform default,
 * Outfit) silently fell back to an SVG <text> element naming a family the
 * recipient's machine probably doesn't have. This module closes that hole: it
 * resolves a computed `font-family` stack to a fetchable sfnt URL, in order:
 *
 *   1. SUSE / SUSE Mono   → the brand catalog's static TTFs (text-svg.ts, unchanged)
 *   2. a USER font        → the woff2 faces stored by user-fonts.ts, decompressed
 *   3. the platform face  → SUSE (upright + italic), shell-served as variable TTFs;
 *                           Outfit too, for anything that still names it
 *
 * Two problems make (2) more than a lookup:
 *
 * **woff2 is not sfnt.** HarfBuzz cannot read it - feeding it a wOF2 blob yields
 * .notdef for every glyph (a silently blank export). Google Fonts serves woff2
 * to every browser and a browser cannot ask for anything else (`User-Agent` is a
 * forbidden fetch header), so we decompress on-device: `woff2-encoder/decompress`
 * is a lazily-imported ~127 KB-gz wasm module with the binary inlined as a data:
 * URI - no network, works offline, loads only when a vector export actually needs
 * it. The resulting sfnt is kept as an object URL for the session, never
 * persisted (it's ~2.5× the woff2 we already store).
 *
 * **Google's faces are variable and subsetted.** A family arrives as one file per
 * unicode subset, each carrying the whole `wght` axis - and the subsets are
 * DISJOINT: the `latin` file has no `Ł`, the `latin-ext` file has no ASCII, so
 * no single face can draw "Łódź". We therefore return an ordered CHAIN (the face
 * covering most of the run first) which host.text shapes segment by segment, the
 * way a browser resolves fallback. The run's computed weight rides along as a
 * variation (`wght=700`) - without it every weight would outline at the face's
 * default instance.
 *
 * Resolution is async (a face may need decompressing) and memoised per asset.
 * Anything unresolvable returns null, and the caller keeps its existing fallback.
 */

import { openDB } from './db.ts';
// Static and safe: register-user-fonts only reaches THIS module through a dynamic
// import, so there is no evaluation cycle, and the boot graph stays as it was.
import { isFontOf } from '../lib/register-user-fonts.ts';
import { resolveSuseFontUrl } from './text-svg.ts';
import type { FontStyleSlice } from './text-svg.ts';
import { discoverFontFaces } from './fontface-discovery.ts';

/**
 * WHICH source face a run resolved to, as identity rather than bytes.
 *
 * `VectorFont.url` is the thing HarfBuzz shapes: for a user face that is an object URL
 * holding the DECOMPRESSED sfnt, and subsetting (planned) will narrow it further - so it
 * is the wrong handle for "which font did this design depend on". This is the right one:
 * the family/weight/style as declared plus the SOURCE file the registry read, which is
 * what a `.lolly` reproducibility receipt records and what another machine has to be
 * able to find again.
 */
export interface VectorFontFace {
  family: string;
  /** '400', or a variable face's range ('100 900') - the face's own declaration. */
  weight: string;
  style: string;
  source: 'catalog' | 'user' | 'platform';
  /** The source file's URL, when it has one (a user face's bytes live in IndexedDB). */
  file?: string;
  /** IndexedDB asset id for a user face. */
  assetId?: string;
}

/** A face resolved for one run: the sfnt to shape with, plus its axis settings. */
export interface VectorFont {
  url: string;
  /** HarfBuzz variation strings for a variable face, e.g. `['wght=700']`. */
  variations?: string[];
  /** Sibling subsets of the same family, for characters `url` doesn't cover
   *  (Google's `latin` file has no `Ł`; its `latin-ext` file has no ASCII). */
  fallbacks?: Array<{ fontUrl: string; variations?: string[] }>;
  /** The SOURCE face behind `url` - see VectorFontFace. Identity only; nothing in the
   *  outlining path reads it. */
  face?: VectorFontFace;
}

/** One stored face as the registry models it. */
interface RegistryFace {
  /** Asset id for a user face; '' for a platform / discovered face. */
  assetId: string;
  /** Static URL for a platform face; '' when the bytes come from IndexedDB / a src URL. */
  staticUrl: string;
  /** The `url()` of a face DISCOVERED in a document `@font-face`; '' otherwise. Fetched
   *  + woff2-decompressed on demand, memoised under `src:${srcUrl}`. */
  srcUrl?: string;
  weight: string;   // '400' or a variable range '100 900'
  style: string;    // 'normal' | 'italic'
  unicodeRange: string;
}

// The shell's own default faces (styles/fonts.css + tokens.css `--font-brand`).
// Each is shipped as a variable TTF beside the woff2s precisely so it needs no
// decoding. No unicode-range: these are whole builds, and the .notdef guard in
// the callers catches anything they can't draw.
//
// SUSE is the platform default face as of 2026-08-10 and BOTH slants are listed.
// That completeness matters for two separate reasons. First, `pickFaces` is strict
// about slant, so an italic run needs a real italic entry - Outfit has none
// (upright-only family), which is exactly why italic runs used to fall back to
// an SVG <text> element. Second, `buildRegistry` skips @font-face discovery for
// any family already backed by bytes here: registering only the upright face
// would SHADOW the italic woff2 discovered from fonts.css and reintroduce the
// very hole this fixes. Add slants in pairs or not at all.
//
// Outfit stays registered (still on disk, still in fonts.css) so a saved session
// or brand doc that names it keeps resolving to real outlines. It is no longer
// the default, and it still cannot outline italic - the family has no such file.
//
// Exported for tests/platform-font-default.test.ts, which pins the two invariants
// the paragraph above only ASSERTS in prose: the default family declares both
// slants, and every staticUrl here names a file that is actually on disk. Both
// fail silently at runtime (a run just keeps its <text> element and the export
// still "succeeds"), so a guard is the only thing that can notice.
export const PLATFORM_FACES: Record<string, RegistryFace[]> = {
  suse: [
    { assetId: '', staticUrl: '/fonts/SUSE[wght].ttf', weight: '100 900', style: 'normal', unicodeRange: '' },
    { assetId: '', staticUrl: '/fonts/SUSE-Italic[wght].ttf', weight: '100 900', style: 'italic', unicodeRange: '' },
  ],
  outfit: [{ assetId: '', staticUrl: '/fonts/Outfit[wght].ttf', weight: '100 900', style: 'normal', unicodeRange: '' }],
};

// ── Pure helpers (exported for tests) ────────────────────────────────────────

/**
 * Split a computed CSS `font-family` into its families, in order, unquoted:
 * `"'Space Grotesk', Outfit, ui-sans-serif"` → `['Space Grotesk','Outfit','ui-sans-serif']`.
 * Commas inside quotes stay put (a family may legally contain one).
 */
export function parseFontFamilies(css: string | undefined): string[] {
  const out: string[] = [];
  let cur = '';
  let quote = '';
  for (const ch of String(css ?? '')) {
    if (quote) {
      if (ch === quote) quote = '';
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

/**
 * Parse a CSS `unicode-range` value to inclusive codepoint pairs.
 * Handles the three grammatical forms: `U+0-7F`, `U+2212`, and the wildcard
 * `U+4??` (which spans U+400–U+4FF). An empty/absent value → `[]`, which
 * `rangesCover` treats as "covers everything" (an unsubsetted face).
 */
export function parseUnicodeRange(spec: string | undefined): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const raw of String(spec ?? '').split(',')) {
    const t = raw.trim();
    if (!/^u\+/i.test(t)) continue;
    const body = t.slice(2);
    if (body.includes('?')) {
      const lo = parseInt(body.replace(/\?/g, '0'), 16);
      const hi = parseInt(body.replace(/\?/g, 'F'), 16);
      if (Number.isFinite(lo) && Number.isFinite(hi)) out.push([lo, hi]);
      continue;
    }
    const [a, b] = body.split('-');
    const lo = parseInt(a ?? '', 16);
    const hi = b == null ? lo : parseInt(b, 16);
    if (Number.isFinite(lo) && Number.isFinite(hi)) out.push([lo, hi]);
  }
  return out;
}

/** Does this face cover every codepoint in `text`? Whitespace is ignored (it
 *  never needs a glyph in an outline), and an empty range list means "all". */
export function rangesCover(ranges: Array<[number, number]>, text: string): boolean {
  if (!ranges.length) return true;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    const cp = ch.codePointAt(0)!;
    if (!ranges.some(([lo, hi]) => cp >= lo && cp <= hi)) return false;
  }
  return true;
}

/** How many of `text`'s visible characters this face can draw. Ranks the
 *  fallback chain: the face carrying most of the run leads. An unsubsetted
 *  face (no ranges) claims everything. */
export function coverageCount(ranges: Array<[number, number]>, text: string): number {
  let n = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    const cp = ch.codePointAt(0)!;
    if (!ranges.length || ranges.some(([lo, hi]) => cp >= lo && cp <= hi)) n++;
  }
  return n;
}

/** Is this face a variable one (a `wght` RANGE rather than a single value)? */
const weightRange = (weight: string): [number, number] | null => {
  const parts = weight.trim().split(/\s+/).map(Number);
  return parts.length === 2 && parts.every(Number.isFinite) ? [parts[0]!, parts[1]!] : null;
};

/**
 * Order this family's faces into a shaping chain for `text`: the face that
 * carries most of the run leads, its siblings follow to cover the rest (the
 * subsets are disjoint, so "Łódź" genuinely needs both `latin` and `latin-ext`).
 *
 * Weight is settled BEFORE coverage: a variable face can hit any weight, so all
 * variable subsets take a `wght` axis for the run; a static family narrows to
 * the nearest available weight, and faces of the other weights are dropped
 * (a bold run must never fall back into the regular file).
 *
 * Italic is deliberately strict: we never download italic faces, and outlining
 * an upright face for an italic run would silently un-slant the text. An empty
 * chain keeps the caller's honest <text> fallback. Exported for tests.
 */
export function pickFaces(faces: RegistryFace[], style: FontStyleSlice, text: string): Array<{ face: RegistryFace; variations?: string[] }> {
  const italic = style.fontStyle === 'italic' || style.fontStyle === 'oblique';
  const weight = parseInt(style.fontWeight ?? '') || 400;
  const slantOk = faces.filter(f => (f.style === 'italic') === italic);
  if (!slantOk.length) return [];

  const variable = slantOk.filter(f => weightRange(f.weight));
  let candidates: Array<{ face: RegistryFace; variations?: string[] }>;
  if (variable.length) {
    candidates = variable.map(f => {
      const [lo, hi] = weightRange(f.weight)!;
      return { face: f, variations: [`wght=${Math.min(hi, Math.max(lo, weight))}`] };
    });
  } else {
    const nearest = slantOk.reduce((a, b) =>
      Math.abs(parseInt(b.weight) - weight) < Math.abs(parseInt(a.weight) - weight) ? b : a);
    candidates = slantOk.filter(f => f.weight === nearest.weight).map(face => ({ face }));
  }

  // Rank by how much of THIS run each face can draw; a face that draws none of
  // it (the latin-ext subset of an ASCII run) has no place in the chain.
  return candidates
    .map(c => ({ ...c, n: coverageCount(parseUnicodeRange(c.face.unicodeRange), text) }))
    .filter(c => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .map(({ n: _n, ...c }) => c);
}

// ── The registry ─────────────────────────────────────────────────────────────

/** family (lowercased) → faces. Rebuilt after any font install/removal. */
let registryPromise: Promise<Map<string, RegistryFace[]>> | null = null;
/** assetId → object URL of the DECOMPRESSED sfnt (session-lived). */
const sfntUrls = new Map<string, string>();
/** assetId → in-flight decompression, so two runs never decode the same face twice. */
const sfntPending = new Map<string, Promise<string>>();

async function buildRegistry(): Promise<Map<string, RegistryFace[]>> {
  const byFamily = new Map<string, RegistryFace[]>();
  for (const [family, faces] of Object.entries(PLATFORM_FACES)) byFamily.set(family, [...faces]);
  try {
    const db = await openDB();
    const records = await db.getAll('user-assets') as Array<{
      id: string; type: string; meta?: Record<string, unknown>;
    }>;
    // Only the ACTIVE design system's faces resolve for vector export (plans/186
    // section 3.2): two systems may both hold "Inter" under their own namespaces,
    // and the one on screen is the one an outline must come from. The pointer is
    // read straight off the profile KV store, the way this module already reads
    // the user-assets store - it has no host. A device with no pointer yet is a
    // legacy install whose rows all belong to `default`.
    let systemId: string | null = null;
    try {
      const stored = await db.get('profile', 'active-design-system');
      systemId = typeof stored === 'string' && stored ? stored : null;
    } catch { systemId = null; }
    for (const r of records) {
      if (r.type !== 'font' || !isFontOf(r.id, systemId)) continue;
      const family = String(r.meta?.family ?? '').trim();
      if (!family) continue;
      const key = family.toLowerCase();
      // A user font SHADOWS a platform face of the same name - they installed it.
      const list = byFamily.get(key)?.filter(f => f.assetId) ?? [];
      list.push({
        assetId: r.id,
        staticUrl: '',
        weight: String(r.meta?.weight ?? '400'),
        style: String(r.meta?.style ?? 'normal'),
        unicodeRange: String(r.meta?.unicodeRange ?? ''),
      });
      byFamily.set(key, list);
    }
  } catch { /* IDB unavailable - platform faces still resolve */ }

  // Discover arbitrary @font-face families in the live document (brand fonts, system
  // webfonts, embedded data: faces) so they vectorise too - not just SUSE/user/Outfit.
  // Skip any family already backed by real bytes (SUSE's hardcoded branch, Outfit's
  // platform face, an installed user font): those take precedence and are complete.
  for (const f of discoverFontFaces()) {
    // SUSE Mono is NOT excluded here: its hardcoded /catalog static branch in
    // resolveVectorFont only holds under a brand that ships the TTFs, and under
    // lolly-start the shell-served SUSEMono woff2 discovered from fonts.css is
    // the only outlineable source. (SUSE *sans* no longer relies on discovery - 
    // it is a complete two-slant PLATFORM_FACES entry, so the check below skips
    // it deliberately.) The bytes-backed precedence check still lets a real
    // static win.
    const existing = byFamily.get(f.family);
    if (existing?.some((e) => e.assetId || e.staticUrl)) continue;
    const list = existing ?? [];
    list.push({ assetId: '', staticUrl: '', srcUrl: f.srcUrl, weight: f.weight, style: f.style, unicodeRange: f.unicodeRange });
    byFamily.set(f.family, list);
  }
  return byFamily;
}

/** url → "these bytes are actually a font". A dev/dist server's SPA fallback
 *  answers a MISSING catalog font with 200 text/html, so `resp.ok` is not the
 *  question - "is it a font" is. Memoised per url. */
const urlProbes = new Map<string, Promise<boolean>>();
export function isFontContentType(ct: string): boolean {
  const t = ct.toLowerCase();
  return t !== '' && !t.startsWith('text/') && !t.includes('html');
}
async function fontUrlUsable(url: string): Promise<boolean> {
  let p = urlProbes.get(url);
  if (!p) {
    p = (async () => {
      try {
        const r = await fetch(url, { method: 'HEAD' });
        return r.ok && isFontContentType(r.headers.get('content-type') ?? '');
      } catch { return false; }
    })();
    urlProbes.set(url, p);
  }
  return p;
}

/**
 * A registry face as IDENTITY (see VectorFontFace). `family` is the name the run's CSS
 * asked for - the registry keys by lowercased family, and the receipt should read as the
 * design wrote it.
 *
 * ponytail: the CHAIN's leader only. A run split across disjoint Google subsets genuinely
 * uses its siblings too; record them as separate entries if a receipt ever has to prove a
 * mixed-script line, which needs the fallbacks to carry faces as well.
 */
function describeFace(family: string, face: RegistryFace): VectorFontFace {
  const file = face.staticUrl || face.srcUrl || '';
  return {
    family,
    weight: face.weight,
    style: face.style,
    source: face.assetId ? 'user' : file.includes('/catalog/') ? 'catalog' : 'platform',
    ...(file ? { file } : {}),
    ...(face.assetId ? { assetId: face.assetId } : {}),
  };
}

/**
 * The SOURCE font file's bytes for a resolved face, or null when there are none to read.
 *
 * Deliberately NOT `VectorFont.url`: that is the decompressed (and, once subsetting
 * ships, narrowed) sfnt HarfBuzz shapes. A dependency is identified by the face as
 * shipped, so a user font is read back from IndexedDB as the woff2/ttf that was stored
 * and a platform/catalog face is fetched as the file on disk.
 */
export async function faceSourceBytes(face: VectorFontFace): Promise<Uint8Array | null> {
  try {
    if (face.assetId) {
      const db = await openDB();
      const rec = await db.get('user-assets', face.assetId) as { blob?: Blob } | undefined;
      return rec?.blob ? new Uint8Array(await rec.blob.arrayBuffer()) : null;
    }
    if (!face.file) return null;
    const resp = await fetch(face.file);
    if (!resp.ok) return null;
    return new Uint8Array(await resp.arrayBuffer());
  } catch { return null; }
}

/** Drop the cached registry (and every decoded face) after an install/removal. */
export function bustFontRegistry(): void {
  registryPromise = null;
  for (const url of sfntUrls.values()) URL.revokeObjectURL(url);
  sfntUrls.clear();
  sfntPending.clear();
  urlProbes.clear();
}

/**
 * The face's bytes as a fetchable URL. A platform face is already an sfnt on
 * disk; a user face is a stored woff2 that must be decompressed first (once per
 * session, memoised - including the in-flight promise, so concurrent runs of an
 * export share the single decode).
 */
async function faceUrl(face: RegistryFace): Promise<string> {
  if (face.staticUrl) return face.staticUrl;
  // A user face is keyed by its asset id; a discovered @font-face by its src URL.
  const cacheKey = face.assetId || (face.srcUrl ? `src:${face.srcUrl}` : '');
  if (!cacheKey) throw new Error('font-registry: face has no bytes source');
  const cached = sfntUrls.get(cacheKey);
  if (cached) return cached;
  const pending = sfntPending.get(cacheKey);
  if (pending) return pending;

  const job = (async () => {
    let bytes: Uint8Array;
    if (face.assetId) {
      const db = await openDB();
      const rec = await db.get('user-assets', face.assetId) as { blob?: Blob } | undefined;
      if (!rec?.blob) throw new Error(`font-registry: no bytes for ${face.assetId}`);
      bytes = new Uint8Array(await rec.blob.arrayBuffer());
    } else {
      // A discovered face: fetch its declared url() (same-origin or data:; a CORS-blocked
      // cross-origin src throws → the family is skipped, keeping the <text> fallback).
      const resp = await fetch(face.srcUrl!);
      if (!resp.ok) throw new Error(`font-registry: fetch ${face.srcUrl} → ${resp.status}`);
      bytes = new Uint8Array(await resp.arrayBuffer());
    }
    // Already an sfnt (a hand-uploaded TTF/OTF, or a static webfont)? The woff2 magic is
    // 'wOF2'; anything else goes to HarfBuzz untouched. (woff1 'wOFF' isn't decompressed
    // here - Google/brand @font-face serve woff2, and HarfBuzz can't read woff1 either, so
    // a woff1-only face falls through to the caller's <text> fallback via a .notdef.)
    const isWoff2 = bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x32;
    // Reject non-font bytes outright (an SPA fallback serves HTML at 200 - base64ing
    // that into a Blob mints a "font" HarfBuzz chokes on far less legibly). sfnt
    // magics: 00 01 00 00 (TrueType), OTTO, true, ttcf; woff1 stays rejected as before.
    const magic = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
    const isSfnt = magic === 'OTTO' || magic === 'true' || magic === 'ttcf'
      || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0);
    if (!isWoff2 && !isSfnt) throw new Error(`font-registry: ${cacheKey} is not an sfnt/woff2 (magic "${magic}")`);
    const sfnt = isWoff2
      ? await (await import('woff2-encoder/decompress')).default(bytes)
      : bytes;
    const url = URL.createObjectURL(new Blob([sfnt as BlobPart], { type: 'font/otf' }));
    sfntUrls.set(cacheKey, url);
    return url;
  })().finally(() => sfntPending.delete(cacheKey));

  sfntPending.set(cacheKey, job);
  return job;
}

/**
 * Resolve a computed style + the text it will render into the sfnt that can
 * outline it, or null when nothing can (the caller falls back to <text>).
 *
 * Families are tried IN CASCADE ORDER - the first one that resolves wins, which
 * is what the browser does when it picks a face. (The old SUSE-only resolver
 * substring-matched the whole stack, so a brand stack ending in the `--font-mono`
 * tail could wrongly claim a SUSE face for a run drawn in Inter.)
 */
export async function resolveVectorFont(style: FontStyleSlice, text: string): Promise<VectorFont | null> {
  const families = parseFontFamilies(style.fontFamily);
  const registry = (registryPromise ??= buildRegistry());
  let faces: Map<string, RegistryFace[]>;
  try { faces = await registry; }
  catch { registryPromise = null; faces = new Map(); }

  const tryFamily = async (family: string): Promise<VectorFont | null> => {
    const key = family.toLowerCase();
    if (key === 'suse' || key === 'suse mono') {
      // The catalog statics only exist under a brand that ships them; elsewhere
      // the path SPA-falls-back to an HTML page, so probe before trusting it and
      // otherwise fall THROUGH to the registry (the shell-served SUSEMono woff2
      // discovered from fonts.css outlines fine once decompressed).
      const url = resolveSuseFontUrl({ ...style, fontFamily: family });
      if (url && await fontUrlUsable(url)) {
        return { url, face: { family, weight: style.fontWeight ?? '400', style: style.fontStyle ?? 'normal', source: 'catalog', file: url } };
      }
    }
    const list = faces.get(key);
    if (!list?.length) return null;
    const chain = pickFaces(list, style, text);
    if (!chain.length) return null;
    try {
      // Decode every face in the chain up front; a failure anywhere means this
      // family can't be trusted to draw the run, so try the next one.
      const urls = await Promise.all(chain.map(c => faceUrl(c.face)));
      const [primary, ...rest] = chain.map((c, i) => ({ fontUrl: urls[i]!, variations: c.variations }));
      return {
        url: primary!.fontUrl,
        ...(primary!.variations ? { variations: primary!.variations } : {}),
        ...(rest.length ? { fallbacks: rest } : {}),
        face: describeFace(family, chain[0]!.face),
      };
    } catch {
      return null; // this family's bytes are unreadable - try the next family
    }
  };

  for (const family of families) {
    const resolved = await tryFamily(family);
    if (resolved) return resolved;
  }
  // Owner rule (Andy, 2026-08-24): tool text renders in the ACTIVE BRAND's
  // faces, never anything else. A stack that reaches its generic tail with
  // nothing resolved (e.g. "ui-monospace, Menlo, Consolas, monospace") used to
  // keep the <text> fallback, so a PDF viewer substituted whatever it liked.
  // Map each generic onto the brand's own stack for that role (the chrome vars
  // brand-vars.ts derives from the brand's font tokens) and try those faces.
  // Serif has no brand role, so a serif-only stack still falls back to <text>.
  for (const family of families) {
    const role = genericFontRole(family);
    if (!role) continue;
    for (const fam of brandRoleStack(role)) {
      if (genericFontRole(fam)) continue; // the brand stack ends in generics too
      const resolved = await tryFamily(fam);
      if (resolved) return resolved;
    }
  }
  return null;
}

/**
 * Which brand type role a CSS generic (or generic-like ui- family) stands in
 * for. Pure, so the mapping is testable; the resolution itself stays in
 * resolveVectorFont. Named platform faces (Menlo, Consolas, ...) are NOT
 * mapped: naming a face is a choice, reaching a generic is a shrug.
 */
export function genericFontRole(family: string): 'sans' | 'mono' | null {
  switch (family.toLowerCase()) {
    case 'monospace':
    case 'ui-monospace':
      return 'mono';
    case 'sans-serif':
    case 'system-ui':
    case 'ui-sans-serif':
      return 'sans';
    default:
      return null;
  }
}

/** The active brand's family stack for a type role, read from the chrome vars
 *  (tokens.css defaults; brand-vars.ts overrides them per brand). */
function brandRoleStack(role: 'sans' | 'mono'): string[] {
  let raw = '';
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      raw = getComputedStyle(document.documentElement)
        .getPropertyValue(role === 'mono' ? '--font-mono' : '--font-brand');
    }
  } catch { /* a headless DOM without getComputedStyle: use the platform default */ }
  const fams = parseFontFamilies(raw.trim());
  return fams.length ? fams : (role === 'mono' ? ['SUSE Mono'] : ['SUSE']);
}

/** All subsets of the requested family instance, without adding fallback families. */
export async function characterFontFiles(family: string, weight = 400): Promise<string[]> {
  registryPromise ??= buildRegistry();
  const faces = (await registryPromise).get(family.toLowerCase()) ?? [];
  const upright = faces.filter(face => face.style !== 'italic');
  const variable = upright.filter(face => weightRange(face.weight));
  const nearest = upright.reduce<RegistryFace | null>((a, b) => !a || Math.abs(parseInt(b.weight, 10) - weight) < Math.abs(parseInt(a.weight, 10) - weight) ? b : a, null);
  const chosen = variable.length ? variable : upright.filter(face => face.weight === nearest?.weight);
  if (chosen.length) return Promise.all(chosen.map(faceUrl));
  const url = resolveSuseFontUrl({ fontFamily: family, fontWeight: String(weight), fontStyle: 'normal' });
  return url && await fontUrlUsable(url) ? [url] : [];
}

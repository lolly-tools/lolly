// SPDX-License-Identifier: MPL-2.0
/**
 * User fonts - Google Fonts faces the user added, stored ON-DEVICE and made
 * real everywhere the brand is felt.
 *
 * The storage story is deliberately boring: every downloaded woff2 is a
 * `type:'font'` USER ASSET (`user/fonts/<slug>/<n>`), so it rides every
 * existing rail for free - the storage meter counts it, "Export my data" (and
 * the hoard) bundles the bytes, a backup import restores them, and clear-all
 * wipes them. No parallel store, no second source of truth.
 *
 * The PRIMARY font is not a separate preference: it's the brand's `font.brand`
 * token (DTCG fontFamily) in the user's installed tokens doc - exactly what
 * applyBrandFonts (brand-vars.ts) already reads to set `--font-brand` on
 * <html> for the app chrome, every tool canvas and the offscreen export
 * mounts. Setting a primary here merges the token into the active doc and
 * re-installs it at the active design system's head; there is always exactly one
 * primary while any font is installed.
 *
 * Faces load into the document via the FontFace API at boot
 * (registerUserFonts, called from main.ts) and immediately after an install,
 * so a newly-added family is usable without a reload.
 */

import { installUserTokens } from './bridge/tokens.ts';
import { activeHeadId } from './lib/design-system/active.ts';
import { applyChromeBrandVars, brandRadiusValue, brandSpaceValue } from './brand-vars.ts';
import { bustFontRegistry } from './bridge/font-registry.ts';
import { REGISTERED, USER_FONT_PREFIX, brandFontFamilies, registerUserFonts, setBrandFontFamilyCache } from './lib/register-user-fonts.ts';
import { fetchGoogleFont, GOOGLE_FAMILY_RE } from './lib/google-fonts.ts';
import type { DownloadedFontFace } from './lib/google-fonts.ts';
import { detectFontFormat, parseFontMetadata, readFontEmbedding, validateFontFile } from './lib/font-utils.ts';
import { variableWeightRange } from './lib/design-system/font-resolve.ts';

/** Every user font asset id starts with this (headshot-style fixed namespace). */

/** The slice of the web bridge this module drives. The upload record is typed
 *  loosely (`type: string`) so one signature serves both the font faces this
 *  module writes and the tokens doc installUserTokens writes through the same
 *  method; the real bridge narrows it to UserAssetRecord. */
export interface UserFontsHost {
  assets: {
    _uploadUserAsset(record: {
      id: string; type: string; format: string; blob: Blob;
      version?: string; meta?: Record<string, unknown>;
    }): Promise<void>;
    _deleteUserAsset(id: string): Promise<unknown>;
    _exportUserAssets(): Promise<Array<{
      id: string; type: string; blob?: Blob; meta?: Record<string, unknown>;
    }>>;
    _getBlob(id: string): Promise<Blob | null>;
  };
  tokens?: {
    resolve(ref: string, opts?: { theme?: string }): Promise<unknown>;
    bust?(): void;
    /** True when the shipped brand is authoritative (bridge/tokens.ts). Read
     *  here only to skip an IMPLICIT primary promotion - every actual write
     *  still goes through installUserTokens, which is the chokepoint. */
    isLocked?(): Promise<boolean>;
  };
}

/** One installed family, grouped from its per-face assets. */
export interface UserFontFamily {
  family: string;
  /** Asset ids of every stored face (latin/latin-ext × weights × slants). */
  assetIds: string[];
  /** Total stored bytes across the family's faces. */
  bytes: number;
  /** A human blurb: "variable 100–900" or "400 + 700". */
  weights: string;
  /** True when the family shipped an italic face too (Anton et al. have none). */
  italic: boolean;
  primary: boolean;
}

const slugOf = (family: string): string =>
  family.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The brand-font family cache, the REGISTERED FontFace map and registerUserFonts
// itself live in lib/register-user-fonts.ts - the boot-path slice, so main.ts can
// call registerUserFonts without dragging this module's other ~24 exports (and,
// through installGoogleFont, the whole Google-font fetcher) onto first paint. They
// must stay a SINGLE module instance: two copies of the cache would hand a tool's
// font select an empty list while boot populated the other one. Re-exported here so
// every existing import path keeps working.
export { USER_FONT_PREFIX, brandFontFamilies, registerUserFonts, REGISTERED };

/** Recompute the family cache from stored user fonts (best-effort; never throws). */
export async function refreshBrandFontFamilies(host: UserFontsHost): Promise<void> {
  try { setBrandFontFamilyCache((await listUserFonts(host)).map(f => f.family)); }
  catch { /* leave the last-known cache in place */ }
}

// ── The primary font = the brand's font.brand token ───────────────────────────

/** First family name out of a resolved fontFamily token value ('' if none). */
export function familyFromTokenValue(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && !first.startsWith('{') ? first.replace(/^['"]|['"]$/g, '').trim() : '';
}

/** Where a doc's `font` group belongs: the doc itself for a plain DTCG tree,
 *  or - for a layered Tokens-Studio doc (non-empty $themes ⇒ top-level keys
 *  are SETS) - a set enabled everywhere, `base` by convention. Mutates/creates
 *  the set container on the (already-cloned) doc it's given. */
function fontTargetOf(out: Record<string, unknown>): Record<string, unknown> {
  const layered = Array.isArray(out.$themes) && out.$themes.length > 0;
  if (!layered) return out;
  const setKey = 'base' in out ? 'base' : Object.keys(out).find(k => !k.startsWith('$')) ?? 'base';
  if (typeof out[setKey] !== 'object' || out[setKey] === null) out[setKey] = {};
  return out[setKey] as Record<string, unknown>;
}

/** A doc's `font` group (searched in the same place fontTargetOf writes), or null. */
export function fontGroupOf(doc: unknown): Record<string, unknown> | null {
  if (typeof doc !== 'object' || doc === null) return null;
  const d = doc as Record<string, unknown>;
  const layered = Array.isArray(d.$themes) && d.$themes.length > 0;
  const holder = layered
    ? (['base', ...Object.keys(d).filter(k => !k.startsWith('$'))]
      .map(k => d[k])
      .find(v => typeof v === 'object' && v !== null && 'font' in (v as object)) as Record<string, unknown> | undefined)
    : d;
  const g = holder?.font;
  return (typeof g === 'object' && g !== null) ? g as Record<string, unknown> : null;
}

/**
 * Merge (or clear, with null) the `font.brand` token into a tokens doc, in
 * place of a copy. Handles both doc shapes createTokenSet reads (layered and
 * plain DTCG - the SUSE doc's shape). Pure; exported for tests.
 */
export function withBrandFontToken(doc: unknown, family: string | null): Record<string, unknown> {
  return withFontRoleToken(doc, 'brand', family);
}

/** The font roles the chrome reads (brand-vars.ts FONT_SLOTS): the primary face,
 *  the code/data mono face, the h1/h2 display face, and the italic face. */
export type FontRole = 'brand' | 'mono' | 'display' | 'italic';

/**
 * The role-aware generalisation: `font.brand` is the app's primary face,
 * `font.mono` its code/data face, `font.display` its h1/h2 heading face and
 * `font.italic` its italic face - the roles the chrome's --font-* vars read
 * (brand-vars.ts FONT_SLOTS). Same merge semantics as withBrandFontToken always
 * had; pure, exported for tests.
 */
export function withFontRoleToken(doc: unknown, role: FontRole, family: string | null): Record<string, unknown> {
  const src = (typeof doc === 'object' && doc !== null && !Array.isArray(doc)) ? doc as Record<string, unknown> : {};
  const out: Record<string, unknown> = structuredClone(src);
  const target = fontTargetOf(out);
  const fontGroup = (typeof target.font === 'object' && target.font !== null)
    ? target.font as Record<string, unknown> : {};
  if (family) {
    fontGroup[role] = { $type: 'fontFamily', $value: [family] };
    target.font = fontGroup;
  } else {
    delete fontGroup[role];
    if (Object.keys(fontGroup).filter(k => !k.startsWith('$')).length) target.font = fontGroup;
    else delete target.font;
  }
  return out;
}

/**
 * Merge (or clear, with null) the `shape.radius` token into a tokens doc, in
 * place of a copy. Reuses fontTargetOf - it's the generic "which SET to write
 * into" resolver (base vs. a layered doc's top level), not actually font-
 * specific despite the name. Pure; exported for tests.
 */
export function withRadiusToken(doc: unknown, value: string | null): Record<string, unknown> {
  const src = (typeof doc === 'object' && doc !== null && !Array.isArray(doc)) ? doc as Record<string, unknown> : {};
  const out: Record<string, unknown> = structuredClone(src);
  const target = fontTargetOf(out);
  const shape = (typeof target.shape === 'object' && target.shape !== null)
    ? target.shape as Record<string, unknown> : {};
  if (value) {
    shape.radius = { $type: 'dimension', $value: value };
    target.shape = shape;
  } else {
    delete shape.radius;
    if (Object.keys(shape).filter(k => !k.startsWith('$')).length) target.shape = shape;
    else delete target.shape;
  }
  return out;
}

/** Merge (or clear) the single spacing-rhythm source, `space.base`, while
 * preserving an imported design system's other spacing tokens. `--sp-*` is
 * generated from this source, so this is the app-facing counterpart of
 * shape.radius rather than eight unrelated per-gap preferences. */
export function withSpaceToken(doc: unknown, value: string | null): Record<string, unknown> {
  const src = (typeof doc === 'object' && doc !== null && !Array.isArray(doc)) ? doc as Record<string, unknown> : {};
  const out: Record<string, unknown> = structuredClone(src);
  const target = fontTargetOf(out);
  const space = (typeof target.space === 'object' && target.space !== null)
    ? target.space as Record<string, unknown> : {};
  if (value) {
    space.base = { $type: 'dimension', $value: value };
    target.space = space;
  } else {
    delete space.base;
    if (Object.keys(space).filter(k => !k.startsWith('$')).length) target.space = space;
    else delete target.space;
  }
  return out;
}

/**
 * Set (or clear, with null) the app's corner-radius override: merges
 * shape.radius into the base doc (see primaryBaseDoc), installs it as the
 * user's tokens, and re-applies chrome vars immediately - no reload needed.
 * Mirrors setPrimaryFont. Rejects an unsafe/malformed value up front (the
 * same CSS-length gate applyBrandRadius checks on the way back out).
 */
export async function setBrandRadius(host: UserFontsHost, value: string | null): Promise<void> {
  if (value && !brandRadiusValue(value)) throw new Error(`"${value}" isn't a plain CSS length (e.g. "0.5rem").`);
  const doc = withRadiusToken(await primaryBaseDoc(host), value);
  await installUserTokens(host as Parameters<typeof installUserTokens>[0], doc, { label: 'My brand' });
  await applyChromeBrandVars(host as Parameters<typeof applyChromeBrandVars>[0]).catch(() => {});
}

/** Set (or clear) `space.base`, install it through the standard user-tokens
 * asset, and repaint the app's generated spacing scale immediately. */
export async function setBrandSpace(host: UserFontsHost, value: string | null): Promise<void> {
  if (value && !brandSpaceValue(value)) throw new Error(`"${value}" isn't a plain CSS length (e.g. "0.5rem").`);
  const doc = withSpaceToken(await primaryBaseDoc(host), value);
  await installUserTokens(host as Parameters<typeof installUserTokens>[0], doc, { label: 'My brand' });
  await applyChromeBrandVars(host as Parameters<typeof applyChromeBrandVars>[0]).catch(() => {});
}

/**
 * Carry the user's chosen fonts through a brand (re)install: when `doc` (a
 * freshly derived or imported tokens doc) declares no `font` group of its own,
 * graft the one from the user's currently-installed tokens onto it - otherwise
 * re-running the #/start wizard would silently snap the app back to the
 * platform face the moment the new doc lands. A doc that DOES declare fonts
 * wins (an imported brand's type choice is part of that brand).
 */
export async function carryUserFontTokens(
  host: UserFontsHost, doc: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (fontGroupOf(doc)) return doc;
  const current = await userTokensDoc(host);
  const group = current && fontGroupOf(current);
  if (!group) return doc;
  const out = structuredClone(doc);
  fontTargetOf(out).font = structuredClone(group);
  return out;
}

/** The active tokens doc as raw JSON: the user's installed doc when present,
 *  else null (setting a primary font on a catalog-branded install copies the
 *  catalog doc first - see primaryBaseDoc). The head belongs to whichever design
 *  system is active (plans/186 section 3.3), not to one well-known id. */
async function userTokensDoc(host: UserFontsHost): Promise<Record<string, unknown> | null> {
  try {
    const blob = await host.assets._getBlob(await activeHeadId(host));
    if (!blob) return null;
    const doc: unknown = JSON.parse(await blob.text());
    return (typeof doc === 'object' && doc !== null) ? doc as Record<string, unknown> : null;
  } catch { return null; }
}

/** The doc a font.brand edit starts from: the user's own doc, else a copy of
 *  whatever tokens the shell currently resolves (the active catalog brand),
 *  else a fresh empty doc. Uses the assets bridge's discovery so it works
 *  offline exactly like the tokens bridge itself. */
async function primaryBaseDoc(host: UserFontsHost): Promise<Record<string, unknown>> {
  const user = await userTokensDoc(host);
  if (user) return user;
  try {
    const meta = await (host.assets as unknown as {
      _findMetaByType(t: string): Promise<{ id: string } | null>;
    })._findMetaByType('tokens');
    if (meta) {
      const blob = await host.assets._getBlob(meta.id);
      if (blob) {
        const doc: unknown = JSON.parse(await blob.text());
        if (typeof doc === 'object' && doc !== null) return doc as Record<string, unknown>;
      }
    }
  } catch { /* no catalog tokens reachable - start empty */ }
  return {};
}

/** The current primary family, resolved through the live token set. */
export async function primaryFontFamily(host: UserFontsHost): Promise<string> {
  try { return familyFromTokenValue(await host.tokens?.resolve('{font.brand}')); }
  catch { return ''; }
}

/** Write `family` (or clear, with null) as font.brand and repaint the chrome.
 *  Throws BrandLockedError when the shipped brand is authoritative (the caller's
 *  UI should already be hidden - see host.tokens.isLocked). The repaint is
 *  cosmetic and never fails the write: the font IS the primary once the tokens
 *  land, even if the chrome can't be redrawn (no DOM, a broken token doc, …). */
export async function setPrimaryFont(host: UserFontsHost, family: string | null): Promise<void> {
  const doc = withBrandFontToken(await primaryBaseDoc(host), family);
  await installUserTokens(host as Parameters<typeof installUserTokens>[0], doc, { label: 'My brand' });
  await applyChromeBrandVars(host as Parameters<typeof applyChromeBrandVars>[0]).catch(() => {});
}

/** The current mono (code/data) family, resolved through the live token set. */
export async function monoFontFamily(host: UserFontsHost): Promise<string> {
  try { return familyFromTokenValue(await host.tokens?.resolve('{font.mono}')); }
  catch { return ''; }
}

/** Write `family` (or clear, with null) as font.mono - the code/data face - 
 *  and repaint the chrome. Same contract as setPrimaryFont. */
export async function setMonoFont(host: UserFontsHost, family: string | null): Promise<void> {
  const doc = withFontRoleToken(await primaryBaseDoc(host), 'mono', family);
  await installUserTokens(host as Parameters<typeof installUserTokens>[0], doc, { label: 'My brand' });
  await applyChromeBrandVars(host as Parameters<typeof applyChromeBrandVars>[0]).catch(() => {});
}

/** The current display (h1/h2 heading) family, resolved through the live token set. */
export async function displayFontFamily(host: UserFontsHost): Promise<string> {
  try { return familyFromTokenValue(await host.tokens?.resolve('{font.display}')); }
  catch { return ''; }
}

/** Write `family` (or clear, with null) as font.display - the heading face used
 *  for h1/h2 - and repaint the chrome. Same contract as setPrimaryFont. */
export async function setDisplayFont(host: UserFontsHost, family: string | null): Promise<void> {
  const doc = withFontRoleToken(await primaryBaseDoc(host), 'display', family);
  await installUserTokens(host as Parameters<typeof installUserTokens>[0], doc, { label: 'My brand' });
  await applyChromeBrandVars(host as Parameters<typeof applyChromeBrandVars>[0]).catch(() => {});
}

/** The current italic family, resolved through the live token set. */
export async function italicFontFamily(host: UserFontsHost): Promise<string> {
  try { return familyFromTokenValue(await host.tokens?.resolve('{font.italic}')); }
  catch { return ''; }
}

/** Write `family` (or clear, with null) as font.italic - the italic face - and
 *  repaint the chrome. Same contract as setPrimaryFont. */
export async function setItalicFont(host: UserFontsHost, family: string | null): Promise<void> {
  const doc = withFontRoleToken(await primaryBaseDoc(host), 'italic', family);
  await installUserTokens(host as Parameters<typeof installUserTokens>[0], doc, { label: 'My brand' });
  await applyChromeBrandVars(host as Parameters<typeof applyChromeBrandVars>[0]).catch(() => {});
}

// ── Install / list / remove ───────────────────────────────────────────────────

/**
 * Download a Google Fonts family and make it local: one user asset per face,
 * FontFaces registered immediately, and - when `primary` (or when it's the
 * only font) - font.brand updated so the whole app wears it. `neverPrimary`
 * suppresses that only-font promotion (a design-file import must never restyle
 * the whole app via the font.brand token).
 */
export async function installGoogleFont(
  host: UserFontsHost, family: string, opts: { primary?: boolean; neverPrimary?: boolean } = {},
): Promise<UserFontFamily> {
  const name = family.trim();
  if (!GOOGLE_FAMILY_RE.test(name)) throw new Error(`"${family}" doesn't look like a font family name.`);
  const faces = await fetchGoogleFont(name);
  const canonical = faces[0]?.family || name; // css2 echoes the canonical casing
  const slug = slugOf(canonical);
  const version = new Date().toISOString().slice(0, 10);
  const stored: string[] = [];
  for (let i = 0; i < faces.length; i++) {
    const f: DownloadedFontFace = faces[i]!;
    const id = `${USER_FONT_PREFIX}${slug}/${i}`;
    // The stored format mirrors whatever css2 actually served (see
    // google-fonts.ts's FONT_EXT_FORMAT) - usually woff2, occasionally
    // truetype/opentype when the request wasn't recognised as a modern
    // browser. The MIME type is informational only; font-registry.ts sniffs
    // the bytes' own magic number rather than trusting it.
    const mime = f.format === 'truetype' ? 'font/ttf' : f.format === 'opentype' ? 'font/otf' : 'font/woff2';
    await host.assets._uploadUserAsset({
      id,
      type: 'font',
      format: f.format,
      blob: new Blob([f.bytes as BlobPart], { type: mime }),
      version,
      meta: {
        name: `${canonical} (${f.subset || 'all'}${f.weight !== '400' ? ` ${f.weight}` : ''}${f.style === 'italic' ? ' italic' : ''})`,
        family: canonical,
        style: f.style,
        weight: f.weight,
        subset: f.subset,
        unicodeRange: f.unicodeRange,
        source: 'google-fonts',
        tags: ['font'],
      },
    });
    stored.push(id);
  }
  await registerUserFonts(host); // load the new faces into document.fonts
  const families = await listUserFonts(host);
  const mustBePrimary = opts.primary || (!opts.neverPrimary && !(await primaryFontFamily(host)));
  if (mustBePrimary) await setPrimaryFont(host, canonical);
  return families.find(f => f.family === canonical)
    ?? { family: canonical, assetIds: stored, bytes: 0, weights: '', italic: faces.some(f => f.style === 'italic'), primary: mustBePrimary };
}

/** Is the shipped brand authoritative? Best-effort: an unreachable or absent
 *  lock reads as unlocked, exactly like every other caller of isLocked(). */
async function brandIsLocked(host: UserFontsHost): Promise<boolean> {
  try { return !!(await host.tokens?.isLocked?.()); }
  catch { return false; }
}

/** A detached ArrayBuffer copy of whatever the caller handed us - a Uint8Array
 *  view over a larger buffer (a face sliced out of a PDF or a zip) must not
 *  leak its neighbours into the stored blob. */
function toArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  return bytes instanceof Uint8Array
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    : bytes;
}

/** Options for {@link installFontFromBytes}. */
export interface InstallFontBytesOptions {
  /** The file's own name, when there was a file. Recorded in meta as provenance;
   *  never used to derive the family (the sfnt's name table is the only source). */
  filename?: string;
  /** Claim `font.brand` for this family. Without it the only-font promotion below
   *  still applies, exactly as installGoogleFont's does. */
  makePrimary?: boolean;
}

/**
 * Install a font the user already has the BYTES of - an upload, a face pulled
 * out of a PDF or a design file, anything that never came from Google. The
 * second entrance into the role system: until this existed `installGoogleFont`
 * was the only way bytes could become a `font.*` token (plan 97 section 4 gap 3), so
 * an uploaded family could be stored but never *assigned*.
 *
 * Everything downstream is deliberately identical to the Google path - the same
 * `user/fonts/<slug>/<n>` user assets (so the storage meter, "Export my data",
 * a brand pack and clear-all all keep working with no new rail), the same
 * FontFace registration, the same only-font promotion - so a face's origin
 * stops mattering the moment it lands.
 *
 * Vetting is the existing pure validators, not a second opinion:
 * `validateFontFile` owns the size cap, `detectFontFormat` the magic number,
 * `parseFontMetadata` the family/weight/style, `readFontEmbedding` the licence
 * signal. **Nothing here throws for bad bytes** - an oversized, unrecognised,
 * or unparseable file returns `null` and writes nothing, because the callers
 * are drop zones handling several files at once and one bad file must not
 * abandon the rest. A `BrandLockedError` from an EXPLICIT `makePrimary` does
 * propagate: that is a refusal, not a bad file.
 *
 * Two conversions happen on the way in, both because a stored face has to stay
 * readable by everything downstream:
 * - **woff1** is unwrapped to a plain sfnt and stored that way. It is not an
 *   sfnt, `parseFontMetadata` can't read its table directory, and
 *   bridge/font-registry.ts decompresses only woff2 - a stored woff1 would be a
 *   face that installs and then silently .notdefs on vector export. Unwrapping
 *   is also the one place the size gate has to run TWICE: what lands on the
 *   device is the expanded sfnt (woff1 is zlib-per-table, so roughly 2×), and a
 *   cap that only ever saw the compressed input would not be a cap on storage.
 *   Both checks are the same `validateFontFile`; the cap itself still lives in
 *   one place.
 * - **woff2** is decompressed only to READ it; the compressed original is what
 *   gets stored (it's ~2.5× smaller, and font-registry already decompresses on
 *   demand), so its stored size is the size already vetted.
 *
 * A VARIABLE face is stored with its whole `wght` axis ("100 900"), not with the
 * default instance `OS/2.usWeightClass` names - see `variableWeightRange`. The
 * Google path has always recorded the range css2 hands it, and a file dropped in
 * by hand must not come out clamped to one weight with the other eight
 * faux-synthesised.
 *
 * A face whose own `OS/2.fsType` says `restricted` still installs - the person
 * may well hold the licence - but it is marked `deviceLocal` and its embedding
 * statement is recorded in meta, so the honesty travels with the asset instead
 * of living in the UI that happened to be on screen at the time.
 *
 * Re-installing a face this family already has (same weight + style) REPLACES
 * it in place rather than piling up `…/1`, `…/2`, `…/3` - the natural thing
 * after fixing a font file and dropping it again. Only a face THIS path wrote is
 * ever replaced: a Google-installed face of the same weight carries subset and
 * unicodeRange metadata an upload cannot reproduce, and overwriting it would
 * destroy downloaded bytes to make room for a file the person could simply have
 * added. An upload beside it takes the next index and both stand.
 *
 * NOT yet the only bytes path in the shell: components/fonts-manager.ts still
 * uploads through lib/font-asset-handler.ts, which writes a PARALLEL store
 * (`host.state` keys `font-asset:<id>` + its own index) that listUserFonts,
 * the storage meter, brand packs and backups never see. Moving it here also
 * means moving its list/delete (lib/load-user-fonts.ts reads the same keys) and
 * migrating anything already stored there, so it is its own change.
 */
export async function installFontFromBytes(
  host: UserFontsHost, bytes: ArrayBuffer | Uint8Array, opts: InstallFontBytesOptions = {},
): Promise<UserFontFamily | null> {
  const original = toArrayBuffer(bytes);

  // The 5MB cap lives in validateFontFile and nowhere else. It reads only size
  // and type, so bytes with no File behind them (a PDF-embedded face) can be
  // vetted by the same gate: an empty `type` skips the MIME branch, which is
  // advisory anyway - the magic number below is the real check.
  const withinCap = (size: number): boolean => validateFontFile({
    size, type: '', name: opts.filename ?? '',
  } as unknown as File).valid;
  if (!withinCap(original.byteLength)) return null;

  const format = detectFontFormat(original);
  if (format === 'unknown') return null;

  let stored = original;                       // what we persist
  let sfnt = original;                         // what we parse
  let storedFormat: 'ttf' | 'otf' | 'woff2' = format === 'woff2' ? 'woff2' : format === 'otf' ? 'otf' : 'ttf';

  if (format === 'woff') {
    try {
      const { woffToSfnt } = await import('@lolly/engine');
      const out = woffToSfnt(new Uint8Array(original));
      sfnt = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
      stored = sfnt;
      storedFormat = detectFontFormat(sfnt) === 'otf' ? 'otf' : 'ttf';
    } catch { return null; }
    // The gate again, against what is actually about to be written: unwrapping
    // is the one path where the stored bytes are bigger than the vetted ones.
    if (!withinCap(stored.byteLength)) return null;
  } else if (format === 'woff2') {
    try {
      const decompress = (await import('woff2-encoder/decompress')).default;
      const out = await decompress(new Uint8Array(original)) as Uint8Array | ArrayBuffer;
      const u8 = out instanceof Uint8Array ? out : new Uint8Array(out);
      sfnt = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
    } catch { return null; }
  }

  const parsed = parseFontMetadata(sfnt);
  // 'Unknown' is parseFontMetadata's "the name table told me nothing" - treating
  // it as a family would slug every such file into one bucket and label the
  // Fonts list with a non-name. Unreadable is unreadable.
  if (!parsed || !parsed.family || parsed.family === 'Unknown') return null;

  const family = parsed.family.trim();
  const slug = slugOf(family);
  if (!slug) return null;
  // A variable face is its whole axis, not its default instance (see the note
  // above); a static one is the single class OS/2 states.
  const weight = variableWeightRange(sfnt) ?? String(parsed.weight);
  const style = parsed.style;
  const embedding = readFontEmbedding(sfnt);

  // Where this face goes: over the family's existing same-weight/same-style face
  // if this path wrote it, else the next free index in the family.
  let records: Array<{ id: string; type: string; meta?: Record<string, unknown> }> = [];
  try { records = await host.assets._exportUserAssets(); }
  catch { /* an unreadable store just means we start this family at 0 */ }
  const prefix = `${USER_FONT_PREFIX}${slug}/`;
  const siblings = records.filter(r => r.type === 'font' && r.id.startsWith(prefix));
  const replacing = siblings.find(r =>
    String(r.meta?.source ?? '') === 'upload'
    && String(r.meta?.weight ?? '') === weight && String(r.meta?.style ?? 'normal') === style);
  const nextIndex = siblings.reduce((max, r) => Math.max(max, Number(r.id.slice(prefix.length)) || 0), -1) + 1;
  const id = replacing?.id ?? `${prefix}${nextIndex}`;

  // Replacing means the document is still holding the OLD bytes under this id:
  // registerUserFonts skips ids already in REGISTERED, so without this the new
  // file would store fine and render as the old one until a reload.
  const staleFace = REGISTERED.get(id);
  if (staleFace) {
    if (typeof document !== 'undefined') (document.fonts as unknown as { delete(f: FontFace): void }).delete(staleFace);
    REGISTERED.delete(id);
  }

  const mime = storedFormat === 'woff2' ? 'font/woff2' : storedFormat === 'otf' ? 'font/otf' : 'font/ttf';
  await host.assets._uploadUserAsset({
    id,
    type: 'font',
    format: storedFormat,
    blob: new Blob([stored as BlobPart], { type: mime }),
    version: new Date().toISOString().slice(0, 10),
    meta: {
      name: `${family}${weight !== '400' ? ` ${weight}` : ''}${style !== 'normal' ? ` ${style}` : ''}`,
      family,
      style,
      weight,
      source: 'upload',
      ...(opts.filename ? { fileName: opts.filename } : {}),
      // The font's own statement about reuse, recorded verbatim (raw fsType
      // included) so a report can audit it rather than trust our reading of it.
      embedding: embedding.permission,
      fsType: embedding.fsType,
      noSubsetting: embedding.noSubsetting,
      bitmapOnly: embedding.bitmapOnly,
      ...(embedding.permission === 'restricted' ? { deviceLocal: true } : {}),
      tags: ['font'],
    },
  });

  await registerUserFonts(host);   // load the new face into document.fonts

  // The only-font promotion, exactly as installGoogleFont applies it - except
  // that on a locked brand the IMPLICIT half is skipped rather than left to
  // throw: an upload is not a request to restyle a brand that forbids it. An
  // explicit makePrimary still goes through setPrimaryFont, so the lock refuses
  // it at the one chokepoint (BrandLockedError, propagated to the caller).
  const mustBePrimary = !!opts.makePrimary
    || (!(await primaryFontFamily(host)) && !(await brandIsLocked(host)));
  if (mustBePrimary) await setPrimaryFont(host, family);

  return (await listUserFonts(host)).find(f => f.family === family)
    ?? { family, assetIds: [id], bytes: 0, weights: weight, italic: style === 'italic', primary: mustBePrimary };
}

/** A weight blurb for the family list: 'variable 100–900' / '400 + 700' / '400'. */
function weightsBlurb(weights: Set<string>): string {
  const list = [...weights];
  const range = list.find(w => / /.test(w));
  if (range) return `variable ${range.replace(' ', '–')}`;
  return list.sort((a, b) => Number(a) - Number(b)).join(' + ') || '400';
}

/** Installed families, grouped, with the primary marked. */
export async function listUserFonts(host: UserFontsHost): Promise<UserFontFamily[]> {
  let records: Array<{ id: string; type: string; blob?: Blob; meta?: Record<string, unknown> }>;
  try { records = await host.assets._exportUserAssets(); }
  catch { return []; }
  const primary = await primaryFontFamily(host);
  const byFamily = new Map<string, UserFontFamily & { _weights: Set<string> }>();
  for (const r of records) {
    if (r.type !== 'font' || !r.id.startsWith(USER_FONT_PREFIX)) continue;
    const family = String(r.meta?.family ?? r.meta?.name ?? 'Font');
    let g = byFamily.get(family);
    if (!g) {
      g = { family, assetIds: [], bytes: 0, weights: '', italic: false, primary: family === primary, _weights: new Set() };
      byFamily.set(family, g);
    }
    g.assetIds.push(r.id);
    g.bytes += r.blob?.size ?? 0;
    if (typeof r.meta?.weight === 'string') g._weights.add(r.meta.weight);
    if (r.meta?.style === 'italic') g.italic = true;
  }
  return [...byFamily.values()]
    .map(({ _weights, ...fam }) => ({ ...fam, weights: weightsBlurb(_weights) }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.family.localeCompare(b.family));
}

/**
 * Remove a family: delete its assets, unload its FontFaces, and - if it was
 * the primary - hand font.brand to the next installed family (or clear it,
 * falling back to the platform default stack).
 */
export async function removeUserFont(host: UserFontsHost, family: UserFontFamily): Promise<void> {
  for (const id of family.assetIds) {
    await host.assets._deleteUserAsset(id);
    const face = REGISTERED.get(id);
    if (face) { (document.fonts as any).delete(face); REGISTERED.delete(id); }
  }
  bustFontRegistry();   // the family is gone - exports must stop resolving it
  if (family.primary) {
    const rest = (await listUserFonts(host)).filter(f => f.family !== family.family);
    await setPrimaryFont(host, rest[0]?.family ?? null);
  }
  await refreshBrandFontFamilies(host); // the removed family must leave tool selectors too
}

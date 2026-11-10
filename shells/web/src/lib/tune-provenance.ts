// SPDX-License-Identifier: MPL-2.0
/**
 * What the web shell records about a saved tune, and what an export says about the
 * tunes it holds (Andy's approval of 2026-11-10).
 *
 * Three records, each visible where it is made and named in the public docs
 * (docs/generated-music.md, docs/exporting.md, docs/privacy.md):
 *
 *   - THE SAVED TUNE. A tune saved from the music generator records who made it (the
 *     profile's name, left out when none is set: a statement of fact, not a rights
 *     claim), that it was made in the music generator, and the Lolly and engine
 *     versions that made the tune. Its licence starts as not recorded, and the person can
 *     set one in the asset's details. The details sheet shows every one of these.
 *   - THE DOWNLOAD. A WAV or M4A downloaded from the generator carries a created step
 *     that says it was made with Lolly's music generator (engine/src/tune-sign.ts).
 *   - AN EXPORT THAT PLAYS A TUNE. Each saved tune whose sound reaches a video or an
 *     audio export is one C2PA source ingredient (engine/src/tune-provenance.ts):
 *     its name, the licence when the tune records one, the digest of its recipe, the
 *     engine version that rendered it, and algorithmic media. The maker's name joins
 *     the ingredient only while the profile's "Use my details" is on, the same rule
 *     every other personal detail in an export follows (`usesDetails`): a name never
 *     leaves the device with that switch off. The export sheet lists the tunes before
 *     the export (`tuneNoteLines`), and after it says only what a reading of the
 *     delivered bytes found (`recordedSourceNames`).
 *
 * Nothing heavy loads with this module: the engine's credential reader and the asset
 * bridge are imported where they are used.
 */
import type { SourceIngredient } from '@lolly-tools/core/host-v1';
import type { Signer } from '../../../../engine/src/c2pa.ts';
import { OUTPUT_LICENCE_CHOICES } from '../../../../engine/src/rights-profiles.ts';
import { assetLicenceDeclaration } from '../../../../engine/src/asset-rights.ts';
import { tuneIngredient, type TuneOrigin } from '../../../../engine/src/tune-provenance.ts';
import { ENGINE_VERSION } from '../../../../engine/src/version.ts';
import { LOFI_TUNE_FORMAT, lofiTuneBytes, lofiTuneFromBytes, lofiTuneFromMeta, type LofiTuneRecipe } from './lofi-tune.ts';
import { lofiStationName } from './neurospicy-lofi.ts';
import { t, tRaw } from '../i18n.ts';

/** `meta.madeIn` on a tune saved from the music generator. */
export const MADE_IN_GENERATOR = 'music-generator';

const MAX_NAME = 200;
const MAX_VERSION = 64;

/** The parts of a profile a maker's name comes from. */
interface NamedProfile { firstname?: unknown; lastname?: unknown }

/** The profile's name, first then last, trimmed and bounded; '' when the profile has none. */
export function profileMaker(profile: NamedProfile | null | undefined): string {
  const parts = [profile?.firstname, profile?.lastname].map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  return parts.join(' ').slice(0, MAX_NAME);
}

/** The versions that made a saved tune. */
export interface TuneVersions { lolly: string; engine: string }

/**
 * The keys the music generator adds to a saved tune's meta: where it was made, who
 * made it (only when the profile has a name) and the versions. No licence is written:
 * a new tune's licence is not recorded until the person sets one.
 */
export function tuneSaveRecord(maker: string, versions: TuneVersions): Record<string, unknown> {
  const name = maker.trim().slice(0, MAX_NAME);
  return {
    madeIn: MADE_IN_GENERATOR,
    ...(name ? { maker: name } : {}),
    versions: { lolly: versions.lolly.slice(0, MAX_VERSION), engine: versions.engine.slice(0, MAX_VERSION) },
  };
}

/** What a saved tune records about itself, read defensively from its meta. */
export interface TuneRecord {
  origin: TuneOrigin;
  maker?: string;
  versions?: { lolly?: string; engine?: string };
}

const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

/**
 * A saved tune's record, or null when the asset is not a saved tune. A tune saved
 * from the generator before these records existed still reads as one: its meta
 * carries the generator's settings.
 */
export function readTuneRecord(ref: { format?: string; meta?: Record<string, unknown> }): TuneRecord | null {
  if (ref.format !== LOFI_TUNE_FORMAT) return null;
  const meta = ref.meta ?? {};
  const lofi = meta.lofi as { generator?: unknown } | undefined;
  const fromGenerator = meta.madeIn === MADE_IN_GENERATOR || typeof meta.generator === 'string' || typeof lofi?.generator === 'string';
  const maker = text(meta.maker, MAX_NAME);
  const v = meta.versions && typeof meta.versions === 'object' && !Array.isArray(meta.versions) ? meta.versions as Record<string, unknown> : null;
  const lolly = text(v?.lolly, MAX_VERSION);
  const engine = text(v?.engine, MAX_VERSION);
  return {
    origin: fromGenerator ? 'generator' : 'station',
    ...(maker ? { maker } : {}),
    ...(lolly || engine ? { versions: { ...(lolly ? { lolly } : {}), ...(engine ? { engine } : {}) } } : {}),
  };
}

/**
 * The licences a person can set on a tune they made: the export panel's list
 * (OUTPUT_LICENCE_CHOICES) without the Public Domain Mark, which marks a work that is
 * already free of known copyright rather than one its maker has just made.
 */
export function tuneLicenceChoices(): readonly { id: string; name: string; url: string }[] {
  return OUTPUT_LICENCE_CHOICES.filter((c) => c.id !== 'CC-PDM-1.0');
}

/** The licence a tune records, by name and terms page, or null when none is recorded. */
export function tuneLicence(meta: Record<string, unknown> | undefined): { declared: string; name: string; url?: string } | null {
  const declared = assetLicenceDeclaration(meta);
  if (!declared) return null;
  const choice = OUTPUT_LICENCE_CHOICES.find((c) => c.id === declared);
  return choice ? { declared, name: choice.name, url: choice.url } : { declared, name: declared.slice(0, 256) };
}

/** A copy of a tune's meta with its licence set to `id`, or cleared when `id` is not one of the choices. */
export function withTuneLicence(meta: Record<string, unknown> | undefined, id: string): Record<string, unknown> {
  const next = { ...meta };
  if (tuneLicenceChoices().some((c) => c.id === id)) next.license = id;
  else delete next.license;
  return next;
}

/** The name a tune is recorded and listed under: its library name, else its station and seed. */
export function tuneName(meta: Record<string, unknown> | undefined, recipe: LofiTuneRecipe): string {
  return (text(meta?.name, MAX_NAME) ?? `${lofiStationName(recipe.mood)} · ${recipe.seed >>> 0}`).slice(0, MAX_NAME);
}

/** One tune an export holds, as the sheet lists the tune and the ingredient records the tune. */
export interface TuneSource {
  recipe: LofiTuneRecipe;
  name: string;
  origin: TuneOrigin;
  maker?: string;
  licence?: { name: string; url?: string };
}

/** The tune a recipe and its asset's meta describe. The meta is optional: a tune by path has none. */
export function tuneSource(recipe: LofiTuneRecipe, ref?: { format?: string; meta?: Record<string, unknown> } | null): TuneSource {
  const record = ref ? readTuneRecord({ format: LOFI_TUNE_FORMAT, meta: ref.meta }) : null;
  const licence = tuneLicence(ref?.meta);
  return {
    recipe,
    name: tuneName(ref?.meta, recipe),
    origin: recipe.generator ? 'generator' : record?.origin ?? 'station',
    ...(record?.maker ? { maker: record.maker } : {}),
    ...(licence ? { licence: { name: licence.name, ...(licence.url ? { url: licence.url } : {}) } } : {}),
  };
}

/** SHA-256 of a tune's canonical recipe bytes (lofiTuneBytes). */
async function recipeDigest(recipe: LofiTuneRecipe): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', lofiTuneBytes(recipe) as BufferSource));
}

/**
 * Is "Use my details" on? The switch every personal detail in an export follows
 * (engine/src/metadata.ts buildExportMeta). Read from the live profile; anything
 * other than an explicit yes, including a host with no profile, reads as off.
 */
export async function usesDetails(host: unknown): Promise<boolean> {
  try {
    const store = typeof host === 'object' && host !== null && 'profile' in host
      ? (host as { profile?: { get?(): Promise<unknown> } }).profile : undefined;
    const profile = await store?.get?.();
    return typeof profile === 'object' && profile !== null && (profile as { useDetails?: unknown }).useDetails === true;
  } catch {
    return false;
  }
}

/**
 * The C2PA source ingredient for one tune an export holds, rendered by this engine.
 * `withMaker` is the export's "Use my details" (`usesDetails`): off, the maker's name
 * is left out and nothing else changes. The caller has to decide, so no path can
 * send a name by forgetting to ask.
 */
export async function tuneSourceIngredient(source: TuneSource, opts: { withMaker: boolean }): Promise<SourceIngredient> {
  return tuneIngredient({
    name: source.name,
    hash: await recipeDigest(source.recipe),
    facts: {
      origin: source.origin,
      engineVersion: ENGINE_VERSION,
      ...(opts.withMaker && source.maker ? { maker: source.maker } : {}),
      ...(source.licence ? { licence: source.licence } : {}),
    },
  });
}

/** One entry per tune, by name, in order: the same tune placed twice is one source. */
export function distinctTunes(sources: readonly (TuneSource | null | undefined)[]): TuneSource[] {
  const out: TuneSource[] = [];
  for (const s of sources) if (s && !out.some((have) => have.name === s.name)) out.push(s);
  return out;
}

// ── which tunes an export will hold ──────────────────────────────────────────

/** Largest file read to check whether a url holds a saved tune: a recipe is a few hundred bytes. */
const MAX_TUNE_BYTES = 16 * 1024;

/**
 * The recipe at a media url, or null when the url is not a saved tune. A `blob:` or
 * `data:` url (a saved tune in the library) and a `.lofi.json` path are read when
 * small enough to be one; any other url is media and is not fetched.
 */
export async function tuneAt(url: string): Promise<LofiTuneRecipe | null> {
  const path = (url.split(/[?#]/)[0] ?? '');
  if (!/^(blob|data):/i.test(url) && !/\.lofi\.json$/i.test(path)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    // A sound file states its size up front, so it is left unread.
    if (Number(res.headers.get('content-length')) > MAX_TUNE_BYTES) return null;
    const blob = await res.blob();
    if (blob.size < 2 || blob.size > MAX_TUNE_BYTES) return null;
    return lofiTuneFromBytes(new Uint8Array(await blob.arrayBuffer()));
  } catch {
    return null;
  }
}

/** The asset lookup a tune's meta comes from: an id to its ref, through the host. */
export type TuneAssetLookup = (id: string) => Promise<{ format?: string; meta?: Record<string, unknown> } | null>;

/**
 * The asset behind a media url, for its name, maker and licence. A rendered document
 * holds urls and no ids, so the id is recovered from the asset bridge's object-url
 * cache, as the credential gather does. Null when the url points at no asset.
 */
export async function tuneAssetAt(url: string, lookup: TuneAssetLookup): Promise<{ format?: string; meta?: Record<string, unknown> } | null> {
  try {
    const { assetIdForUrl } = await import('../bridge/assets.ts');
    const id = assetIdForUrl(url);
    return id ? await lookup(id) : null;
  } catch {
    return null;
  }
}

/** The tune at a media url with what its asset records, or null when the url is not a saved tune. */
export async function tuneSourceAt(url: string, lookup: TuneAssetLookup): Promise<TuneSource | null> {
  const recipe = await tuneAt(url);
  if (!recipe) return null;
  return tuneSource(recipe, await tuneAssetAt(url, lookup));
}

/** The tune an asset ref holds, from its meta or its bytes, or null when it is not a saved tune. */
export async function tuneSourceOfRef(ref: { format?: string; url?: string; meta?: Record<string, unknown> } | null): Promise<TuneSource | null> {
  if (!ref || ref.format !== LOFI_TUNE_FORMAT) return null;
  const recipe = lofiTuneFromMeta(ref.meta?.lofi) ?? (ref.url ? await tuneAt(ref.url) : null);
  return recipe ? tuneSource(recipe, ref) : null;
}

/**
 * The tunes a timeline's audio boxes hold: the boxes the export mix will play (not
 * muted, not struck through, with a length), read in timeline order. Mirrors
 * lib/rondo-provenance.ts timelineSongs and the mix in bridge/sequence-render.ts,
 * which records the same tunes as it renders them.
 */
export async function timelineTunes(root: Element, lookup: TuneAssetLookup): Promise<TuneSource[]> {
  const { parseSequenceStage } = await import('../bridge/sequence-plan.ts');
  const stage = parseSequenceStage(root as HTMLElement);
  if (!stage) return [];
  const seen = new Set<string>();
  const out: TuneSource[] = [];
  for (const L of stage.layers) {
    if (L.kind !== 'audio' || L.mute || L.ignored || !(L.durMs > 0)) continue;
    const marker = L.el.matches?.('[data-audio-src]') ? L.el : L.el.querySelector?.('[data-audio-src]');
    const src = marker?.getAttribute('data-audio-src') ?? '';
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const tune = await tuneSourceAt(src, lookup);
    if (tune) out.push(tune);
  }
  return out;
}

// ── what the export sheet says ───────────────────────────────────────────────

/**
 * The lines the export sheet shows before an export, one per tune: what the
 * credential will record. Future tense on purpose: nothing is confirmed until the
 * delivered file is read back. The maker is named only when the ingredient will
 * carry the name (`withMaker`, the export's "Use my details").
 */
export function tuneNoteLines(tunes: readonly TuneSource[], opts: { withMaker: boolean }): string[] {
  return tunes.map((tune) => {
    const name = `“${tune.name}”`;
    return [
      tRaw('Content Credentials will record the tune {name} as a source of this file: music Lolly composed from its recipe (procedural, no AI).', { name }),
      opts.withMaker && tune.maker ? tRaw('The record will name {maker} as the person who made the tune.', { maker: tune.maker }) : '',
      tune.licence ? tRaw('It will give the tune’s licence as {licence}.', { licence: tune.licence.name }) : '',
    ].filter(Boolean).join(' ');
  });
}

/** The lines after an export: which tunes the delivered file's credential was found to record, and which not. */
export function tuneRecordLines(promised: readonly string[], recorded: readonly string[]): { found: string | null; missing: string | null } {
  const quoted = (names: readonly string[]): string => names.map((n) => `“${n}”`).join(', ');
  const found = promised.filter((n) => recorded.includes(n));
  const missing = promised.filter((n) => !recorded.includes(n));
  return {
    found: found.length
      ? found.length === 1
        ? tRaw('This file’s Content Credentials record the tune {name}.', { name: quoted(found) })
        : tRaw('This file’s Content Credentials record the tunes {names}.', { names: quoted(found) })
      : null,
    missing: missing.length
      ? missing.length === 1
        ? tRaw('This file’s Content Credentials do not record the tune {name}.', { name: quoted(missing) })
        : tRaw('This file’s Content Credentials do not record the tunes {names}.', { names: quoted(missing) })
      : null,
  };
}

/** The line when the delivered file was too large to read back here. */
export const tuneNotCheckedLine = (): string => t('The tune record was not checked: this file is too large to read back here.');

// ── what the delivered file records ──────────────────────────────────────────

/** Largest file read back to confirm the record. Past it the record is not checked. */
export const MAX_READBACK_BYTES = 512 * 1024 * 1024;

/**
 * The rondocode songs and the saved tunes the delivered file's Content Credentials
 * record, read from its bytes in one pass. `null` when the file was too large to read
 * back here; empty lists when it holds no valid credential.
 */
export async function recordedSourceNames(blob: Blob): Promise<{ songs: string[]; tunes: string[] } | null> {
  if (blob.size > MAX_READBACK_BYTES) return null;
  try {
    const [{ verifyC2pa }, { isRondoSongIngredient }, { isTuneIngredient }] = await Promise.all([
      import('../../../../engine/src/c2pa-verify.ts'),
      import('../../../../engine/src/rondo-provenance.ts'),
      import('../../../../engine/src/tune-provenance.ts'),
    ]);
    const report = await verifyC2pa(new Uint8Array(await blob.arrayBuffer()));
    if (report.state !== 'valid') return { songs: [], tunes: [] };
    const records = report.ingredients ?? [];
    const titles = (keep: (r: (typeof records)[number]) => boolean): string[] => records.filter(keep).map((r) => r.title ?? '').filter(Boolean);
    return { songs: titles(isRondoSongIngredient), tunes: titles(isTuneIngredient) };
  } catch {
    return { songs: [], tunes: [] };
  }
}

// ── a download from the music generator ──────────────────────────────────────

/** A host that may hold an enrolled signing identity (the web bridge's `identity`). */
interface IdentityHost { identity?: { signer(): Promise<Signer | null> } }
const identityOf = (host: unknown): IdentityHost['identity'] =>
  typeof host === 'object' && host !== null && 'identity' in host ? (host as IdentityHost).identity : undefined;

/** The track a download holds, as its credential describes the track. */
export interface TrackFacts { name: string; style: string; styleName?: string; seed: number }

/**
 * Sign a WAV or M4A the generator made, then read the written bytes back. The created
 * step says the file was made with Lolly's music generator (engine/src/tune-sign.ts),
 * signed by the enrolled identity when there is one, else by the ephemeral on-device
 * signer. `declaration` is the description the reading found, or null when it found
 * none, so the line after the download says only what the file holds. Throws when the
 * credential could not be written.
 */
export async function signTrackDownload(host: unknown, blob: Blob, format: string, track: TrackFacts): Promise<{ blob: Blob; declaration: string | null }> {
  const [{ signTuneFile }, { verifyC2pa }, { isTuneDeclaration }] = await Promise.all([
    import('../../../../engine/src/tune-sign.ts'),
    import('../../../../engine/src/c2pa-verify.ts'),
    import('../../../../engine/src/tune-provenance.ts'),
  ]);
  let signer: Signer | null = null;
  try { signer = (await identityOf(host)?.signer()) ?? null; } catch { /* the ephemeral signer */ }
  const signed = await signTuneFile(new Uint8Array(await blob.arrayBuffer()), format, {
    name: track.name,
    facts: { style: track.style, ...(track.styleName ? { styleName: track.styleName } : {}), seed: track.seed },
    ...(signer ? { signer } : {}),
  });
  const report = await verifyC2pa(signed);
  const step = report.state === 'valid'
    ? report.history?.find((h) => h.action === 'c2pa.created' && isTuneDeclaration(h.description))
    : undefined;
  return { blob: new Blob([signed as BlobPart], { type: blob.type }), declaration: step ? String(step.description) : null };
}

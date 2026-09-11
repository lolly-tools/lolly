// SPDX-License-Identifier: MPL-2.0
/**
 * Press profiles the user supplied - an `.icc` on this device, parsed into a
 * gamut the whole colour stack can already ask questions of.
 *
 * The engine has read ICC profiles since 1.70 (`parseIccProfile` →
 * `iccGamutSource`) and every gamut surface - the slice charts, the broken
 * tracks, the 3D solid, Colour Lab's ceilings - takes a `GamutSource` wherever it
 * takes a gamut name. Nothing in the shell ever handed it one. This module is
 * that hand-off, and nothing more: bytes in, a mounted comparison target out.
 *
 * Storage is the same boring rail user fonts ride (`user-fonts.ts`): every
 * profile is a `type:'profile'` USER ASSET at `user/profiles/<digest>`, so the
 * storage meter counts it, "Export my data" bundles the bytes, a backup import
 * restores them and clear-all wipes them. No parallel object store, no second
 * source of truth.
 *
 * The id is CONTENT-ADDRESSED - `<digest>` is the same 16-hex SHA-256 prefix
 * `icc.ts` puts in `GamutSource.id` - so re-dropping the same file overwrites
 * rather than duplicating, and a shared `&limit=icc:<digest>:<intent>` link
 * matches a locally stored profile by construction rather than by filename luck.
 *
 * Two refusals, and only two. A file `parseIccProfile` cannot read is
 * `unreadable`; a profile no intent can be asked a gamut question in (an `abst`
 * effect, a `link`, an A2B0-only scanner profile) is `no-gamut`. Neither is
 * STORED: a row we can say nothing about would sit in the panel and in the user's
 * storage meter forever. Everything else mounts, including `mntr` RGB display
 * profiles - a monitor profile is a perfectly good comparison target, it just has
 * no ink to report.
 *
 * Not a policy layer: nothing here refuses a colour, warns about one, or clamps
 * anything. It answers "which gamut are we comparing against", and the caller
 * decides what to draw.
 */

import {
  parseIccProfile, iccGamutSource, iccGamutIntent,
} from '@lolly/engine';
import type { GamutSource, IccProfile, RenderingIntent } from '@lolly/engine';
import { registerColorProfile, unregisterColorProfile } from '../components/color-spaces.ts';
import type { ChannelSpec } from '../components/color-spaces.ts';

/** Every stored profile asset id starts with this. */
export const USER_PROFILE_PREFIX = 'user/profiles/';

/** The four intents, in the order the UI shows them. */
export const INTENTS: readonly RenderingIntent[] = ['perceptual', 'relative', 'saturation', 'absolute'];

/** The intent a freshly ingested profile mounts under - the print trade's default. */
export const DEFAULT_INTENT: RenderingIntent = 'relative';

/** A profile limit id exactly as `iccGamutSource` mints it. Anything else is junk. */
const LIMIT_RE = /^icc:([0-9a-f]{16}):(perceptual|relative|saturation|absolute)$/;

/** The slice of the web bridge this module drives (see user-fonts.ts's identical shape). */
export interface ColorProfilesHost {
  assets: {
    _uploadUserAsset(record: {
      id: string; type: string; format: string; blob: Blob;
      version?: string; meta?: Record<string, unknown>;
    }): Promise<void>;
    _deleteUserAsset(id: string): Promise<unknown>;
    _listUserAssets(): Promise<Array<{ id: string; type: string; meta?: Record<string, unknown> }>>;
    _getBlob(id: string): Promise<Blob | null>;
  };
}

/** One stored profile, rendered from `meta` alone - the panel never re-parses to draw a row. */
export interface ProfileEntry {
  /** 16 hex chars; the identity `GamutSource.id` carries. */
  digest: string;
  /** `user/profiles/<digest>`. */
  assetId: string;
  /** The user's filename, for a row they can recognise. */
  name: string;
  /** The profile's own `desc` tag - what the pill and the notation row are named after. */
  description: string;
  deviceClass: string;
  colourSpace: string;
  channels: number;
  version: string;
  /** The intents that can answer a gamut question. Others render disabled, never hidden. */
  intents: readonly RenderingIntent[];
  /**
   * The intent this profile mounts under when nothing says otherwise. NOT a
   * stored preference that follows the user around: which intent is live is the
   * `&limit=` id's business, because the Lab's whole state is its URL.
   */
  activeIntent: RenderingIntent;
  bytes: number;
  addedAt: number;
  /**
   * Where this profile came from, when Lolly itself fetched it. Carried on the row
   * so the PDF/X embed path reads provenance out of the same single asset listing
   * that built the row, rather than scanning the store a second time.
   */
  origin?: ProfileOrigin;
}

/**
 * Where a profile came from, recorded at ingest.
 *
 * The only kind that means anything is `registry`: a fetch LOLLY performed, for a
 * press-condition row the user pressed. That is the strongest pairing evidence the
 * PDF/X embed path has (see press-profile-embed.ts) precisely because it involves
 * no string matching - the row that was clicked is what got written. A file the
 * user dropped has no origin, and none is invented for it.
 */
export interface ProfileOrigin {
  kind: 'registry';
  url: string;
  /** The press condition whose row was pressed (`fogra51`). */
  conditionId: string;
  /** The characterization data set that source states it was built from. */
  charData?: string;
}

export type ProfileIngestFailure = { error: 'unreadable' | 'no-gamut' };

/** Ingest went wrong in one of exactly two ways. */
export const isIngestFailure = (r: ProfileEntry | ProfileIngestFailure): r is ProfileIngestFailure =>
  'error' in r;

// ── The parsed-profile cache ──────────────────────────────────────────────────
//
// Parsed profiles are small, pure and immutable, and a parse is microseconds - so
// this is a convenience for the synchronous callers (paper white, device numbers)
// rather than a performance necessity. Keyed by digest, which `iccGamutSource`
// already owns; nothing here mints an identity of its own.

const PARSED = new Map<string, IccProfile>();
/** digest → the currently MOUNTED source (at most one intent per profile). */
const MOUNTED = new Map<string, GamutSource>();

/** The content digest `iccGamutSource` will use for this profile. */
export function profileDigest(p: IccProfile): string {
  return iccGamutSource(p, DEFAULT_INTENT).id.split(':')[1] ?? '';
}

/** Which intents this profile can answer a gamut question in (possibly none). */
export function usableIntents(p: IccProfile): RenderingIntent[] {
  return INTENTS.filter(i => iccGamutIntent(p, i));
}

/** Split a `&limit=` value into its parts, or null when it is not a profile id. */
export function parseProfileLimit(id: string): { digest: string; intent: RenderingIntent } | null {
  const m = LIMIT_RE.exec(id);
  return m ? { digest: m[1]!, intent: m[2] as RenderingIntent } : null;
}

/** The pill/tab text for a profile under an intent - `FOGRA39 · rel`, ≤22 chars. */
export function shortLabel(entry: ProfileEntry, intent: RenderingIntent = entry.activeIntent): string {
  const name = (entry.description || entry.name || entry.digest).trim();
  const abbr = intent.slice(0, 3);
  const room = 22 - abbr.length - 3;                       // ' · ' is three
  return `${name.length > room ? `${name.slice(0, room - 1).trimEnd()}…` : name} · ${abbr}`;
}

/** The short form of an id whose profile is not on this device - `icc ab12cd… · rel`. */
export function absentLabel(id: string): string {
  const parsed = parseProfileLimit(id);
  if (!parsed) return 'icc';
  return `icc ${parsed.digest.slice(0, 6)}… · ${parsed.intent.slice(0, 3)}`;
}

// ── Ingest ────────────────────────────────────────────────────────────────────

/**
 * Ink channel specs for the picker tab a mounted profile becomes. Four-ink CMYK
 * gets the trade's own letters; any other channel count gets numbered channels
 * rather than a made-up naming (a 6-ink hexachrome profile's channel 5 is not
 * "orange" in any way this reader can know).
 */
function inkChannels(colourSpace: string, n: number): ChannelSpec[] {
  const pct = (v: number): string => `${Math.round(v)}%`;
  const cmyk = ['C', 'M', 'Y', 'K'];
  const aria = ['Cyan', 'Magenta', 'Yellow', 'Black'];
  const four = n === 4 && colourSpace.trim().toUpperCase() === 'CMYK';
  return Array.from({ length: Math.max(1, n) }, (_v, i) => ({
    ch: four ? cmyk[i]!.toLowerCase() : `c${i + 1}`,
    label: four ? cmyk[i]! : String(i + 1),
    aria: four ? aria[i]! : `Channel ${i + 1}`,
    min: 0, max: 100, step: 1, fmt: pct, stops: 7,
  }));
}

/**
 * The picker tab for a mounted profile - registered only when the file can
 * convert BOTH ways under this intent.
 *
 * The tab wears the profile's own name, so every number in it has to come out of
 * that file's tables: the same `fromLab` the Colour Lab's press notation row
 * reads, so the two cannot state different CMYK for one colour. A profile that
 * can only answer one direction gets no tab at all - its gamut still charts,
 * which is a question `contains` alone can answer honestly.
 */
function mountProfileTab(src: GamutSource, p: IccProfile, intent: RenderingIntent): void {
  const probe = p.toLab(intent, new Array<number>(p.nChannels).fill(0));
  if (!probe) return;                        // no forward table: nothing to state values in
  registerColorProfile(src, inkChannels(p.dataColourSpace, p.nChannels), {
    toLab: dev => p.toLab(intent, dev),
    fromLab: lab => p.fromLab(intent, lab),
  }, { space: p.dataColourSpace.trim() });
}

/**
 * Read a dropped `.icc`, validate it, store it, and return its row.
 *
 * Does NOT mount it - {@link activateProfile} is the deliberate second step, so a
 * drop that was only meant to add to the library does not silently repoint every
 * chart. Re-ingesting the same bytes is an idempotent overwrite (same digest,
 * same asset id), which is also how a shared link's missing profile heals.
 */
export async function ingestProfile(
  host: ColorProfilesHost, file: File | Blob, opts: { origin?: ProfileOrigin } = {},
): Promise<ProfileEntry | ProfileIngestFailure> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { error: 'unreadable' };
  }
  const p = parseIccProfile(bytes);
  if (!p) return { error: 'unreadable' };
  const intents = usableIntents(p);
  if (intents.length === 0) return { error: 'no-gamut' };

  const digest = profileDigest(p);
  if (!digest) return { error: 'unreadable' };
  const entry: ProfileEntry = {
    digest,
    assetId: `${USER_PROFILE_PREFIX}${digest}`,
    name: (file as File).name || `${p.description || p.dataColourSpace.trim()}.icc`,
    description: p.description || p.dataColourSpace.trim(),
    deviceClass: p.deviceClass,
    colourSpace: p.dataColourSpace.trim(),
    channels: p.nChannels,
    version: p.version,
    intents,
    activeIntent: intents.includes(DEFAULT_INTENT) ? DEFAULT_INTENT : intents[0]!,
    bytes: bytes.byteLength,
    addedAt: Date.now(),
  };
  await host.assets._uploadUserAsset({
    id: entry.assetId,
    type: 'profile',
    format: 'icc',
    blob: new Blob([bytes as unknown as BlobPart], { type: 'application/vnd.iccprofile' }),
    meta: {
      name: entry.name,
      description: entry.description,
      deviceClass: entry.deviceClass,
      colourSpace: entry.colourSpace,
      channels: entry.channels,
      version: entry.version,
      intents: entry.intents,
      activeIntent: entry.activeIntent,
      bytes: entry.bytes,
      addedAt: entry.addedAt,
      tags: ['profile'],
      ...(opts.origin ? { origin: opts.origin } : {}),
    },
  });
  PARSED.set(digest, p);
  return entry;
}

/** Rebuild a row from a stored asset's meta (no parse). Null when it is not one of ours. */
function entryFromRef(ref: { id: string; type: string; meta?: Record<string, unknown> }): ProfileEntry | null {
  if (ref.type !== 'profile' || !ref.id.startsWith(USER_PROFILE_PREFIX)) return null;
  const digest = ref.id.slice(USER_PROFILE_PREFIX.length);
  const m = ref.meta ?? {};
  const stored = Array.isArray(m.intents) ? (m.intents as unknown[]).filter(
    (i): i is RenderingIntent => INTENTS.includes(i as RenderingIntent),
  ) : [];
  const intents = stored.length ? stored : [DEFAULT_INTENT];
  const active = INTENTS.includes(m.activeIntent as RenderingIntent) && intents.includes(m.activeIntent as RenderingIntent)
    ? m.activeIntent as RenderingIntent
    : intents[0]!;
  return {
    digest,
    assetId: ref.id,
    name: String(m.name ?? digest),
    description: String(m.description ?? ''),
    deviceClass: String(m.deviceClass ?? ''),
    colourSpace: String(m.colourSpace ?? ''),
    channels: Number(m.channels ?? 0),
    version: String(m.version ?? ''),
    intents,
    activeIntent: active,
    bytes: Number(m.bytes ?? 0),
    addedAt: Number(m.addedAt ?? 0),
    ...(originFromMeta(m.origin) ? { origin: originFromMeta(m.origin)! } : {}),
  };
}

/** A stored `meta.origin`, only when it really is one (it decides what a PDF declares). */
function originFromMeta(raw: unknown): ProfileOrigin | null {
  const o = raw as Partial<ProfileOrigin> | undefined;
  if (!o || o.kind !== 'registry' || typeof o.url !== 'string' || typeof o.conditionId !== 'string') return null;
  return {
    kind: 'registry', url: o.url, conditionId: o.conditionId,
    ...(typeof o.charData === 'string' ? { charData: o.charData } : {}),
  };
}

/** Every stored profile, newest first. Best-effort: a hostile row is skipped, never thrown. */
export async function listProfiles(host: ColorProfilesHost): Promise<ProfileEntry[]> {
  const refs = await host.assets._listUserAssets().catch(() => []);
  return refs
    .map(entryFromRef)
    .filter((e): e is ProfileEntry => e !== null)
    .sort((a, b) => b.addedAt - a.addedAt);
}

/** One stored profile by digest, or null. */
export async function getProfile(host: ColorProfilesHost, digest: string): Promise<ProfileEntry | null> {
  return (await listProfiles(host)).find(e => e.digest === digest) ?? null;
}

/** The parsed profile behind a digest - for paper white and device numbers. Cache only. */
export function profileFor(digest: string): IccProfile | null {
  return PARSED.get(digest) ?? null;
}

/** The mounted source for a digest+intent, or null when it is not mounted. */
export function sourceFor(digest: string, intent?: RenderingIntent): GamutSource | null {
  const src = MOUNTED.get(digest) ?? null;
  if (!src || !intent) return src;
  return src.id.endsWith(`:${intent}`) ? src : null;
}

/** Every currently mounted profile source. */
export function mountedSources(): GamutSource[] {
  return [...MOUNTED.values()];
}

/** The mounted source whose id matches a `&limit=` value, or null. */
export function sourceForLimit(id: string): GamutSource | null {
  const parsed = parseProfileLimit(id);
  return parsed ? sourceFor(parsed.digest, parsed.intent) : null;
}

/** Parse the stored bytes for a digest, caching the result. Null when unreadable/absent. */
async function loadParsed(host: ColorProfilesHost, digest: string): Promise<IccProfile | null> {
  const cached = PARSED.get(digest);
  if (cached) return cached;
  const blob = await host.assets._getBlob(`${USER_PROFILE_PREFIX}${digest}`).catch(() => null);
  if (!blob) return null;
  let p: IccProfile | null = null;
  try {
    p = parseIccProfile(new Uint8Array(await blob.arrayBuffer()));
  } catch {
    return null;                                  // a Blob that will not read is not a profile
  }
  if (!p) return null;
  PARSED.set(digest, p);
  return p;
}

/**
 * Mount a stored profile under one intent and hand back its gamut source.
 *
 * Exactly ONE intent per profile is mounted at a time: four picker tabs per
 * profile would blow the output family apart for no gain, and the intent
 * buttons sit right beside the row. Switching intent is therefore an unmount +
 * a mount, and the id changes with it - which is correct, because the same
 * profile under a different intent IS a different gamut.
 *
 * Returns null when the profile is not on this device, will not parse, or cannot
 * answer under the intent asked for - never a source that silently answered with
 * a different table.
 */
export async function activateProfile(
  host: ColorProfilesHost, digest: string, intent: RenderingIntent = DEFAULT_INTENT,
): Promise<GamutSource | null> {
  const p = await loadParsed(host, digest);
  if (!p || !iccGamutIntent(p, intent)) return null;
  const src = iccGamutSource(p, intent);
  const prev = MOUNTED.get(digest);
  if (prev && prev.id !== src.id) unregisterColorProfile(prev.id);
  mountProfileTab(src, p, intent);
  MOUNTED.set(digest, src);
  return src;
}

/** Mount whatever a `&limit=icc:…` value names. Null when that profile is absent. */
export async function activateProfileLimit(host: ColorProfilesHost, id: string): Promise<GamutSource | null> {
  const parsed = parseProfileLimit(id);
  if (!parsed) return null;
  return activateProfile(host, parsed.digest, parsed.intent);
}

/** Unmount a profile's tab without deleting the file. */
export function deactivateProfile(digest: string): void {
  const src = MOUNTED.get(digest);
  if (src) unregisterColorProfile(src.id);
  MOUNTED.delete(digest);
}

/**
 * Delete a stored profile: unmount every intent it could have been mounted
 * under (not just the live one - an id minted before a reload is still a live
 * registry key in this document), drop the parse cache, remove the bytes.
 */
export async function removeProfile(host: ColorProfilesHost, digest: string): Promise<void> {
  for (const intent of INTENTS) unregisterColorProfile(`icc:${digest}:${intent}`);
  MOUNTED.delete(digest);
  PARSED.delete(digest);
  await host.assets._deleteUserAsset(`${USER_PROFILE_PREFIX}${digest}`);
}

/** Test seam: forget every parsed/mounted profile in this document. */
export function _resetProfileCache(): void {
  for (const src of MOUNTED.values()) unregisterColorProfile(src.id);
  MOUNTED.clear();
  PARSED.clear();
}

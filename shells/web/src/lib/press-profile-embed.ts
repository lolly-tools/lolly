// SPDX-License-Identifier: MPL-2.0
/**
 * The user's own CMYK profile, resolved into the bytes a PDF/X-4 output intent
 * embeds - and into the identity that intent may honestly declare.
 *
 * ## Why this module exists
 *
 * PDF/X-4 requires the destination profile to be EMBEDDED. No CMYK ICC ships in
 * this repo, so for years a Print PDF's intent was a registry NAME - a true and
 * useful statement of the press condition, but not X-4. `lib/color-profiles.ts`
 * changed the ingredients: a profile the user loaded is on the device, content
 * addressed, and parseable. This is the join between that library and the export
 * path, and it is the ONLY route by which a `/DestOutputProfile` reaches a CMYK
 * intent.
 *
 * ## The identity trap, and how it is made impossible
 *
 * The tempting shortcut is to embed a loaded profile under whichever condition the
 * export panel happens to name - "you picked FOGRA39, here are your FOGRA39-ish
 * bytes". That produces the confidently-wrong file. Our own source list has the
 * counter-example: `SWOP2006_Coated3v2.icc` has "SWOP" in its `desc`, so a
 * desc-match pairs it with the `swop` condition, whose intent identifier is
 * `CGATS TR 001` - while that file is built from TR003. Different numbers, same
 * word.
 *
 * So identity is DERIVED from the profile, never from the picker:
 *  - the four registry rows (`fogra39` …) keep their exact previous meaning - 
 *    name only, no embedded profile, no behaviour change;
 *  - choosing an `own:<digest>` row embeds THAT profile, and the OutputIntent's
 *    identity is read off it. Paired (below) → the registry name; unpaired →
 *    `Custom` with the profile's own description and no RegistryName.
 *
 * A file that says FOGRA39 while carrying FOGRA51 bytes therefore cannot be
 * produced: the user never selects those two things independently.
 *
 * ## What counts as pairing evidence
 *
 * 1. **Provenance.** A profile Lolly itself fetched from the ICC registry for
 *    condition X is paired to X by construction (`meta.origin`, recorded at
 *    ingest). Note the registry's SWOP profile states `CGATS TR003`, so
 *    `sourceIsExact()` is false for it and it pairs to NOTHING - the Custom
 *    branch. That is the right answer, not a gap. Provenance is testimony about
 *    where bytes came from, so it does not outrank the bytes: when the file's own
 *    `targ` names a DIFFERENT known condition, the two contradict each other and
 *    neither is declared (`Custom`). Only a contradiction demotes - a profile whose
 *    `targ` names nothing we recognise (`Coated_Fogra39L…` is built on FOGRA39L
 *    data and spells it its own way) keeps its provenance pairing.
 * 2. **`targ`.** The profile's own `FILE_DESCRIPTOR` (`iccCharacterization`)
 *    equal, after normalisation, to the condition's characterization name.
 *    Testimony from inside the file - present on ECI/Fogra-lineage profiles a
 *    print shop already has.
 * 3. Numeric agreement against published aim values would be real evidence. No
 *    aim data ships, so it is UNAVAILABLE and not approximated.
 * 4. A `desc` substring is NOT evidence. `matchesCondition` stays what it is: a
 *    UI affordance for labelling a row.
 *
 * Tier 1 or 2 pairs; anything else is `Custom`. Not a refusal - the user still
 * gets an embedded, conformant X-4 file. It just declares the profile's own name
 * instead of a registry name nothing on this device can substantiate.
 *
 * DOM-free, so it tests under plain `node --test` with a fake host.
 */

import type { IccProfile } from '@lolly/engine';
import { parseIccProfile, pdfxProfileEligibility, iccCharacterization } from '@lolly/engine';
import { getProfile, listProfiles, USER_PROFILE_PREFIX } from './color-profiles.ts';
import type { ColorProfilesHost, ProfileEntry, ProfileOrigin } from './color-profiles.ts';
import { PRESS_CONDITIONS, sourceIsExact } from './press-conditions.ts';
import type { PressCondition } from './press-conditions.ts';

/** The export-panel/URL spelling for "embed a profile from this device". */
export const OWN_PREFIX = 'own';

/** Is this `colorProfile` value the embed route rather than a registry name? */
export function isOwnProfile(value: string | undefined | null): boolean {
  return value === OWN_PREFIX || (typeof value === 'string' && value.startsWith(`${OWN_PREFIX}:`));
}

/** The digest an `own:<digest>` value names, or null for the bare `own` form. */
export function ownDigest(value: string | undefined | null): string | null {
  if (typeof value !== 'string' || !value.startsWith(`${OWN_PREFIX}:`)) return null;
  const d = value.slice(OWN_PREFIX.length + 1).trim().toLowerCase();
  return /^[0-9a-f]{16}$/.test(d) ? d : null;
}

/** Everything the export path needs to write an intent around a real profile. */
export interface EmbedResolution {
  bytes: Uint8Array;
  /** The profile's real channel count → the DestOutputProfile stream's /N. */
  components: number;
  /** OutputConditionIdentifier: a registry name when paired, else 'Custom'. */
  identifier: string;
  /** RegistryName, or null (Custom names no registry). */
  registry: string | null;
  /** OutputCondition / Info - human-readable. */
  info: string;
  /** The condition id this profile PROVED, or null. */
  pairedCondition: string | null;
  evidence: 'registry' | 'targ' | null;
  /** The stored filename, for a log line and the TIFF's provenance label. */
  name: string;
  /** The profile's own `desc`. */
  desc: string;
}

/** Registry names differ in spacing and case (`CGATS TR006` / `CGATS TR 006`). */
const normalise = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * One profile's bytes AND its parse, kept between calls.
 *
 * A 50-row batch embeds the same 8 MB profile 50 times (separate files - there is
 * no shared object to point at), so the read and the parse are both cached: parsing
 * the 8.6 MB registry FOGRA39 measures ~200 ms, which is comparable to rendering
 * the page it is being embedded into. Single entry on purpose: never hold two press
 * profiles in memory.
 */
let CACHE: { digest: string; bytes: Uint8Array; parsed: IccProfile } | null = null;

/** Test seam: forget the cached bytes. */
export function _resetEmbedCache(): void { CACHE = null; }

async function loadFor(
  host: ColorProfilesHost, digest: string,
): Promise<{ bytes: Uint8Array; parsed: IccProfile } | null> {
  if (CACHE?.digest === digest) return CACHE;
  const blob = await host.assets._getBlob(`${USER_PROFILE_PREFIX}${digest}`).catch(() => null);
  if (!blob) return null;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const parsed = parseIccProfile(bytes);
    if (!parsed) return null;
    CACHE = { digest, bytes, parsed };
    return CACHE;
  } catch {
    return null;
  }
}

/**
 * The condition this profile's stored provenance proves, if any.
 *
 * Only a fetch Lolly itself performed counts, and only when that source's
 * characterization data IS the condition's own (`sourceIsExact`). No string
 * matching: the row that was pressed is what got recorded.
 */
function pairByOrigin(origin: ProfileOrigin | undefined): PressCondition | null {
  if (!origin || origin.kind !== 'registry') return null;
  const c = PRESS_CONDITIONS.find(x => x.id === origin.conditionId);
  return c && sourceIsExact(c) ? c : null;
}

/**
 * Do a profile's stored provenance and its own `targ` name DIFFERENT conditions?
 *
 * Cheap corroboration of the strongest evidence tier against the file itself - if
 * the registry ever re-points a filename, or a `SOURCES` row is edited wrongly, the
 * bytes still say what they characterize. Only a resolved disagreement counts:
 * `iccCharacterization` returning nothing, or something no condition claims, is not
 * a contradiction (real registry profiles spell their characterization their own
 * way).
 */
export function originContradicted(bytes: Uint8Array, conditionId: string): boolean {
  const byTarg = pairByTarg(bytes);
  return Boolean(byTarg && byTarg.condition.id !== conditionId);
}

/** The condition this profile's own `targ` tag names, if any. */
function pairByTarg(bytes: Uint8Array): { condition: PressCondition; charData: string } | null {
  const charData = iccCharacterization(bytes);
  if (!charData) return null;
  const want = normalise(charData);
  if (!want) return null;
  const condition = PRESS_CONDITIONS.find(c => normalise(c.identifier) === want);
  return condition ? { condition, charData } : null;
}

/**
 * Resolve `colorProfile` into embeddable bytes plus the identity they justify.
 *
 * Returns null for every miss - not on this device, will not parse, ineligible
 * for a PDF/X intent, or the bare `own` form with no single obvious answer. Never
 * throws and never blocks an export: the caller writes no intent and no
 * conformance claim, which is strictly more honest than falling back to a
 * condition the user did not choose.
 */
export async function resolveEmbeddedProfile(
  host: ColorProfilesHost,
  colorProfile: string | undefined,
  intentSpace: 'CMYK' | 'RGB',
): Promise<EmbedResolution | null> {
  if (!isOwnProfile(colorProfile)) return null;
  const wanted = ownDigest(colorProfile);

  let entry: ProfileEntry | null = null;
  if (wanted) {
    entry = await getProfile(host, wanted).catch(() => null);
  } else {
    // Bare `own` (the URL spelling - a digest is device-local and must not travel).
    // Exactly one eligible profile is unambiguous; zero or several is not, and
    // guessing which one an author meant would let storage order decide a value of
    // record. See the caller: no intent, no claim.
    const all = await listEligible(host, intentSpace);
    if (all.length !== 1) return null;
    entry = all[0]!;
  }
  if (!entry) return null;

  const loaded = await loadFor(host, entry.digest);
  if (!loaded) return null;
  const { bytes, parsed } = loaded;
  const eligible = pdfxProfileEligibility({
    deviceClass: parsed.deviceClass,
    dataColourSpace: parsed.dataColourSpace,
    nChannels: parsed.nChannels,
    version: parsed.version,
  }, intentSpace);
  if (!eligible.ok) return null;

  const desc = parsed.description || entry.description || entry.name;
  const byOrigin = pairByOrigin(entry.origin);
  const byTarg = pairByTarg(bytes);
  // Contradicted provenance proves nothing: the bytes name one condition, the row
  // that fetched them another, and declaring either would be a coin toss written
  // into a value of record. Custom under the profile's own name is the honest read.
  const contradicted = Boolean(byOrigin && byTarg && byTarg.condition.id !== byOrigin.id);
  const paired = contradicted ? null : byOrigin ?? byTarg?.condition ?? null;

  return {
    bytes,
    components: parsed.nChannels,
    identifier: paired ? paired.identifier : 'Custom',
    registry: paired ? 'http://www.color.org' : null,
    info: paired ? paired.info : desc,
    pairedCondition: paired?.id ?? null,
    evidence: paired ? (byOrigin ? 'registry' : 'targ') : null,
    name: entry.name,
    desc,
  };
}

/**
 * The stored profiles a PDF/X intent in `intentSpace` could embed - the rows the
 * export panel offers, and the resolution set for the bare `own` form.
 *
 * Judged from the row's stored meta (no parse, no byte read): the meta is written
 * from the parse at ingest, so a row that says `prtr`/CMYK/4 is one whose bytes
 * said so. The real bytes are re-checked in {@link resolveEmbeddedProfile} before
 * anything is embedded, so a stale row can only cost an offered option, never a
 * wrong file.
 */
export async function listEligible(
  host: ColorProfilesHost, intentSpace: 'CMYK' | 'RGB',
): Promise<ProfileEntry[]> {
  const rows = await listProfiles(host).catch(() => []);
  return rows.filter(e => pdfxProfileEligibility({
    deviceClass: e.deviceClass,
    dataColourSpace: e.colourSpace,
    nChannels: e.channels,
    version: e.version,
  }, intentSpace).ok);
}

/**
 * The URL spelling of an export panel's colour-profile value.
 *
 * A digest is device-local, so `own:<digest>` must never travel in a link: a
 * shared URL would name a profile the recipient does not have, and a link's
 * meaning (and file size) must not depend on what happens to be in someone else's
 * IndexedDB. Bare `own` says "embed the profile on this device", which resolves
 * to exactly one profile or to nothing at all.
 */
export function urlProfileValue(value: string | undefined | null): string {
  return isOwnProfile(value) ? OWN_PREFIX : String(value ?? '');
}

/** `Embed PSO Coated v3 (≈1.7 MB)` - arithmetic, so the figure cannot rot. */
export function embedRowLabel(entry: ProfileEntry): string {
  const mb = entry.bytes / (1024 * 1024);
  const size = mb >= 0.1 ? `≈${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(entry.bytes / 1024))} kB`;
  return `Embed ${entry.description || entry.name} (${size})`;
}

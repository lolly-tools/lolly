// SPDX-License-Identifier: MPL-2.0
/**
 * The press conditions a print export can declare, and where the matching ICC
 * profile actually comes from.
 *
 * ## The gap this closes
 *
 * A Print PDF already declares its press condition in the OutputIntent - the
 * export panel has picked from `CMYK_CONDITIONS` (FOGRA39 / FOGRA51 / SWOP /
 * GRACoL) for a long time. But that declaration is a *registry name*: it tells the
 * printer what you targeted and carries no measurements. So the Colour Lab, which
 * answers "can this condition reproduce this colour?" by evaluating a profile's
 * lookup tables, could say nothing about the very condition your export names.
 *
 * This module is the join. It lists the conditions the export path knows, says for
 * each one whether a usable profile is loaded, and - where a licence-clean source
 * exists - fetches it on demand.
 *
 * ## Why nothing is bundled
 *
 * Following the Google Fonts path (`lib/google-fonts.ts`): the network is touched
 * at most once, at add time, and from then on the profile is a local user asset - 
 * offline, in the data backup, gone when the user deletes it. No colour data ships
 * in this repo, so there is no redistribution question to answer.
 *
 * ## What can actually be fetched, measured rather than assumed
 *
 * Probed 2026-07-28 with `curl -sSIL -H 'Origin: https://lolly.tools'`:
 * - **`registry.color.org/profile-registry/profiles/*.icc`** - the ICC's own profile
 *   registry serves `application/vnd.iccprofile` with
 *   `access-control-allow-origin: *`. Every profile listed there corresponds to a
 *   registered printing condition and a published characterization data set, and each
 *   one's registry page carries the provider's licence text verbatim. This is the
 *   source `SOURCES` below uses, one entry per condition.
 * - `www.color.org/profiles/sRGB_ICC_v4_Appearance.icc` still serves CORS `*` (the
 *   `REFERENCE_PROFILES` path). Note the rest of `www.color.org/profiles/` now 301s
 *   to a registry landing page rather than a file.
 * - `color.org/cmyk-registry/<condition>` is a *description* of the condition. There
 *   is no profile to download there.
 * - ECI's own site (`eci.org`) answers a redirect chain with no CORS header at all,
 *   so a browser fetch cannot reach it - but ECI's `PSOcoated_v3` is in the ICC
 *   registry, which can be reached, so that no longer blocks FOGRA51.
 *
 * Nothing is mirrored: the bytes come from the registry to the user's device, so
 * Lolly is never the redistributor. `licence` on each source quotes the provider's
 * own words from that profile's registry page - read it before adding an entry, and
 * note that FOGRA51's forbids *distribution* specifically, which is exactly why a
 * direct fetch is the only acceptable route for it.
 *
 * A fetch is still the second-best route on a print machine: the profile is usually
 * already installed, offline, and is the exact separation the shop uses. So each
 * condition also names the FILENAMES to look for (`files`) and `HINTS` carries the
 * per-platform folder.
 *
 * Pure apart from `fetchPressProfile`; no DOM, so it is testable under `node --test`.
 */

import { CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION } from '@lolly/engine';

/** A licence-clean URL that serves CORS `*` - we can fetch it on request. */
export interface FetchSource {
  kind: 'fetch';
  url: string;
  /** The profile's own filename, so a row names the file it will get rather than
   *  implying the condition ships with one canonical profile. */
  name: string;
  /** Bytes as served when probed - a rough size to expect, not a checksum. */
  bytes: number;
  /**
   * The characterization data set this profile was built from, as the registry states
   * it - required of a press condition, absent on a reference profile that
   * characterises no press. NOT always the condition's own OutputIntent identifier:
   * SWOP's registered profile is built from CGATS TR003, while an export declares
   * CGATS TR 001. {@link sourceIsExact} is the honest test.
   */
  charData?: string;
  /** The provider's licence, quoted from the page it was read on. */
  licence: string;
}

/** How a condition's profile can be obtained. */
export type ProfileSource =
  | FetchSource
  /** No free source we may redistribute or reach: the user supplies the file. */
  | { kind: 'own'; why: string };

/** A press condition's source states its characterization data or is the user's own. */
export type PressSource = (FetchSource & { charData: string }) | { kind: 'own'; why: string };

export interface PressCondition {
  /** The key the export option and the URL param already use (`fogra39`). */
  id: string;
  /** The registry identifier written into the PDF OutputIntent (`FOGRA39`). */
  identifier: string;
  /** The human name (`Coated FOGRA39 (ISO 12647-2:2004)`). */
  info: string;
  source: ProfileSource;
  /** Substrings that identify a loaded profile as being this condition. Matched
   *  case-insensitively against the profile's own `desc`. */
  match: readonly string[];
  /**
   * Filenames this condition's profile usually has on a machine that already has
   * it. A filename is far more actionable than a folder - it is what the user types
   * into the file picker's search field.
   */
  files: readonly string[];
}

/**
 * Where a user's existing press profiles live, per platform. Shown as a hint beside
 * the file picker - the fastest route to a real profile is almost always one already
 * on the machine.
 */
export const HINTS: Readonly<Record<string, string>> = {
  mac: '/Library/Application Support/Adobe/Color/Profiles/ · /Library/ColorSync/Profiles/',
  win: 'C:\\Windows\\System32\\spool\\drivers\\color\\',
  linux: '/usr/share/color/icc/ · ~/.local/share/icc/',
};

/** The platform hint for the current host, or the mac one as a default. */
export function locationHint(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  if (/windows/i.test(ua)) return HINTS.win!;
  if (/linux|x11/i.test(ua) && !/android/i.test(ua)) return HINTS.linux!;
  return HINTS.mac!;
}

/** Substrings that identify a loaded profile as a given condition. A profile's own
 *  `desc` is what a vendor wrote in it, so several spellings are in circulation. */
const MATCHES: Readonly<Record<string, readonly string[]>> = {
  fogra39: ['fogra39', 'coated fogra39', 'isocoated_v2'],
  fogra51: ['fogra51', 'pso coated v3'],
  swop: ['swop', 'cgats tr 001', 'us web coated'],
  gracol: ['gracol', 'cgats tr 006'],
};

/** Filenames a machine that already has the profile is likely to call it. */
const FILES: Readonly<Record<string, readonly string[]>> = {
  fogra39: ['CoatedFOGRA39.icc', 'ISOcoated_v2_eci.icc'],
  fogra51: ['PSOcoated_v3.icc'],
  swop: ['USWebCoatedSWOP.icc', 'SWOP2006_Coated3v2.icc'],
  gracol: ['CoatedGRACoL2006.icc', 'GRACoL2006_Coated1v2.icc'],
};

/** The ICC's registry - the ONE host these profiles come from. Kept as a constant so
 *  a new entry cannot quietly point somewhere unprobed. */
const ICC_REGISTRY = 'https://registry.color.org/profile-registry/profiles/';

/**
 * Fetchable sources. An entry belongs here only when the URL has been PROBED and
 * returns a profile with `access-control-allow-origin: *`, AND the provider's licence
 * plainly permits the user to download and use it. Every `licence` below is a verbatim
 * quote from that profile's page at `registry.color.org/profile-registry/<name>`,
 * read 2026-07-28.
 */
const SOURCES: Readonly<Record<string, PressSource>> = {
  fogra39: {
    kind: 'fetch',
    url: `${ICC_REGISTRY}Coated_Fogra39L_VIGC_300.icc`,
    name: 'Coated_Fogra39L_VIGC_300.icc',
    bytes: 8652444,
    charData: 'FOGRA39',
    licence: 'VIGC, with permission of X-Rite: “may be used, embedded, exchanged, and shared without restriction”.',
  },
  fogra51: {
    kind: 'fetch',
    url: `${ICC_REGISTRY}PSOcoated_v3.icc`,
    name: 'PSOcoated_v3.icc',
    bytes: 2195228,
    charData: 'FOGRA51',
    // Note the difference from the others: "may not be distributed". So this one is
    // only ever fetched from the registry itself, never mirrored or bundled by us.
    licence: 'ECI, with permission of Heidelberger Druckmaschinen: “may be used, embedded and exchanged without restriction … may not be distributed, sold or altered without written permission of ECI”.',
  },
  swop: {
    kind: 'fetch',
    url: `${ICC_REGISTRY}SWOP2006_Coated3v2.icc`,
    name: 'SWOP2006_Coated3v2.icc',
    bytes: 2747952,
    // TR003, not the TR 001 an export declares - see sourceIsExact.
    charData: 'CGATS TR003',
    licence: 'Idealliance, with permission of X-Rite: “may be used, embedded, exchanged, and shared without restriction”.',
  },
  gracol: {
    kind: 'fetch',
    url: `${ICC_REGISTRY}GRACoL2006_Coated1v2.icc`,
    name: 'GRACoL2006_Coated1v2.icc',
    bytes: 2747956,
    charData: 'CGATS TR006',
    licence: 'Idealliance, with permission of X-Rite: “may be used, embedded, exchanged, and shared without restriction”.',
  },
};

/**
 * The conditions, in the order the export panel lists them.
 *
 * Built FROM `CMYK_CONDITIONS` rather than beside it, so a condition added to the
 * engine's export list cannot silently go missing here - the identifiers and names
 * are read across, and only the source and the match strings are stated locally.
 */
export const PRESS_CONDITIONS: readonly PressCondition[] = Object.entries(CMYK_CONDITIONS)
  .map(([id, c]) => ({
    id,
    identifier: c.identifier,
    info: c.info,
    match: MATCHES[id] ?? [c.identifier],
    files: FILES[id] ?? [],
    source: SOURCES[id] ?? {
      kind: 'own' as const,
      why: 'No free profile is published for this condition - use the one your printer or design tools installed.',
    },
  }));

/** The reference profiles the ICC itself publishes - fetchable, and useful as a
 *  comparison target even though none is a press condition. */
export const REFERENCE_PROFILES: ReadonlyArray<{ id: string; name: string; source: FetchSource }> = [
  {
    id: 'srgb-v4-appearance',
    name: 'sRGB v4 Appearance (ICC)',
    source: {
      kind: 'fetch',
      url: 'https://www.color.org/profiles/sRGB_ICC_v4_Appearance.icc',
      name: 'sRGB_ICC_v4_Appearance.icc',
      bytes: 63868,
      licence: 'Published by the International Color Consortium for free use.',
    },
  },
];

/** Registry names differ in spacing and case (`CGATS TR006` / `CGATS TR 006`). */
const normalise = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Is the fetchable profile built from the very characterization data this condition's
 * OutputIntent names?
 *
 * FOGRA39, FOGRA51 and GRACoL: yes. SWOP: NO - an export declares `CGATS TR 001`, and
 * the registered profile is `CGATS TR003` (Grade #3 coated, the successor
 * characterization). Same press condition family, measurably different numbers, so the
 * row says which file it is getting rather than implying they are one thing.
 */
export function sourceIsExact(c: PressCondition): boolean {
  return c.source.kind === 'fetch'
    && !!c.source.charData
    && normalise(c.source.charData) === normalise(c.identifier);
}

/** The fetchable source for a condition, or null when the user must supply the file. */
export function fetchSourceFor(c: PressCondition): FetchSource | null {
  return c.source.kind === 'fetch' ? c.source : null;
}

/** Does this profile description look like this condition? */
export function matchesCondition(desc: string, c: PressCondition): boolean {
  const d = desc.toLowerCase();
  return c.match.some(m => d.includes(m));
}

/** The condition a loaded profile satisfies, if any. */
export function conditionFor(desc: string): PressCondition | null {
  return PRESS_CONDITIONS.find(c => matchesCondition(desc, c)) ?? null;
}

/** The condition a print export targets by default. */
export const defaultCondition = (): PressCondition =>
  PRESS_CONDITIONS.find(c => c.id === DEFAULT_CMYK_CONDITION) ?? PRESS_CONDITIONS[0]!;

/**
 * Fetch a profile's bytes. Only ever called for a `kind: 'fetch'` source, so the
 * URL is one of ours rather than anything a page supplied.
 *
 * Returns null rather than throwing on any failure - offline, CORS, a 404 after the
 * host reorganises. A profile that will not download is a thing the user can still
 * supply by hand, not an error state worth interrupting them for.
 */
export async function fetchPressProfile(
  source: Extract<ProfileSource, { kind: 'fetch' }>,
  signal?: AbortSignal,
): Promise<Uint8Array | null> {
  try {
    const res = await fetch(source.url, { signal, mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    // A profile smaller than its header cannot be one; a wildly larger response is
    // a captive portal or an error page, not the file we asked for. The ceiling is
    // generous because press profiles genuinely are large - the registry's
    // Coated_Fogra39L_VIGC_300 is 8.6 MB of lookup table, so an 8 MB cap would have
    // rejected the very profile this exists to fetch.
    if (buf.length < 132 || buf.length > 24 * 1024 * 1024) return null;
    return buf;
  } catch {
    return null;
  }
}

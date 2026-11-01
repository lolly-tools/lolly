// SPDX-License-Identifier: MPL-2.0
/**
 * The press separation a web print export uses: how Print PDF, Print TIFF and
 * EPS (CMYK) turn RGB into ink.
 *
 * In order:
 *   1. The user's own profile, when the Colour profile control picks one (`own`
 *      or `own:<digest>`): the same profile press-profile-embed.ts embeds, so the
 *      inks and the declared DestOutputProfile agree. The panel offers own rows
 *      only for profiles a PDF/X-4 intent may embed (listEligible), so the route
 *      through resolveEmbeddedProfile turns away nothing the user could pick. If it cannot be read, the
 *      export falls back to the device formula and the log says why; it does not
 *      fall back to FOGRA39, because the file would then claim one condition and
 *      carry another's numbers.
 *   2. The bundled CC0 FOGRA39-fitted profile (packages/node-shell/icc/) when the
 *      press condition resolves to Coated FOGRA39, the default.
 *   3. The device formula (rgbToCmyk) for any other named condition.
 *
 * The bundled bytes are fetched once, on the first print export, and never on
 * boot. Pure apart from that fetch.
 */
import { parseIccProfile, iccSeparation, DEVICE_SEPARATION, type CmykSeparation } from '@lolly/engine';
import { BUNDLED_PRESS_PROFILE, usesBundledPressProfile } from '@lolly-tools/node-shell/press-separation';
import { isOwnProfile, resolveEmbeddedProfile } from './press-profile-embed.ts';
import type { ColorProfilesHost } from './color-profiles.ts';

/** Where an export's separation came from, for the export log and tests. */
export type SeparationSource = 'own' | 'bundled' | 'device';

export interface ResolvedSeparation {
  sep: CmykSeparation;
  source: SeparationSource;
  /** Why the device formula ran, when it did. */
  why?: 'own-unavailable' | 'bundled-unavailable' | 'no-profile';
}

let bundled: Promise<CmykSeparation | null> | undefined;

/** The bundled profile's separation, fetched and parsed once. Null if the bytes are missing or wrong. */
export function bundledSeparation(fetchImpl: typeof fetch = fetch): Promise<CmykSeparation | null> {
  bundled ??= fetchImpl(new URL('../../../../packages/node-shell/icc/craft-coated-fogra39.icc', import.meta.url))
    .then(response => (response.ok ? response.arrayBuffer() : null))
    .then(buffer => {
      if (!buffer || buffer.byteLength !== BUNDLED_PRESS_PROFILE.bytes) return null;
      const profile = parseIccProfile(new Uint8Array(buffer));
      return profile ? iccSeparation(profile) : null;
    })
    .catch(() => null)
    .then(sep => {
      if (!sep) bundled = undefined;   // a failed fetch is retried on the next export
      return sep;
    });
  return bundled;
}

/** Test seam: forget the cached bundled separation. */
export function _resetBundledSeparation(): void { bundled = undefined; }

/** The separation for an export whose Colour profile value is `colorProfile`. */
export async function separationForExport(
  colorProfile: string | undefined,
  host: ColorProfilesHost | null,
  fetchImpl?: typeof fetch,
): Promise<ResolvedSeparation> {
  if (isOwnProfile(colorProfile)) {
    const embed = host ? await resolveEmbeddedProfile(host, colorProfile, 'CMYK').catch(() => null) : null;
    const profile = embed ? parseIccProfile(embed.bytes) : null;
    const sep = profile ? iccSeparation(profile) : null;
    return sep ? { sep, source: 'own' } : { sep: DEVICE_SEPARATION, source: 'device', why: 'own-unavailable' };
  }
  if (usesBundledPressProfile(colorProfile)) {
    const sep = await bundledSeparation(fetchImpl);
    return sep ? { sep, source: 'bundled' } : { sep: DEVICE_SEPARATION, source: 'device', why: 'bundled-unavailable' };
  }
  return { sep: DEVICE_SEPARATION, source: 'device', why: 'no-profile' };
}

/** One line for the export log: what turned RGB into ink, and why. */
export function separationLogLine(r: ResolvedSeparation): string {
  if (r.source !== 'device') {
    return `CMYK separation: ${r.sep.profile ?? 'press profile'} (relative colorimetric with black point compensation; neutral greys on K only)`;
  }
  const reason = r.why === 'own-unavailable' ? 'the selected profile could not be read'
    : r.why === 'bundled-unavailable' ? 'the bundled FOGRA39 profile could not be loaded'
    : 'no profile is loaded for this press condition';
  return `CMYK separation: device formula, because ${reason}`;
}

/** Resolve an export's separation and log one line for it, so the ink in a file
 *  can be traced back to the profile that produced the numbers. */
export async function printSeparation(
  colorProfile: string | undefined,
  host: ColorProfilesHost | null,
  log: (level: 'info' | 'warn', msg: string) => void,
): Promise<ResolvedSeparation> {
  const resolved = await separationForExport(colorProfile, host);
  log(resolved.source === 'device' ? 'warn' : 'info', separationLogLine(resolved));
  return resolved;
}

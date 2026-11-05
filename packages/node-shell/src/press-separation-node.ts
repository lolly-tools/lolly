// SPDX-License-Identifier: MPL-2.0
/**
 * The Node shells' press separation: the bundled profile read from disk, parsed
 * once, and the device formula for every condition it does not cover. The CLI's
 * EPS (CMYK) sink calls this; the browser fetches the same file in its own
 * bridge (shells/web/src/lib/cmyk-separation.ts).
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { parseIccProfile, iccSeparation, DEVICE_SEPARATION, type CmykSeparation } from '@lolly/engine';
import { repoRoot } from './repo-root.ts';
import { BUNDLED_PRESS_PROFILE, usesBundledPressProfile } from './press-separation.ts';

let bundled: Promise<CmykSeparation | null> | undefined;

/** The bundled profile's separation, or null when its bytes are missing or altered. */
export function bundledPressSeparation(): Promise<CmykSeparation | null> {
  bundled ??= readFile(new URL(`../icc/${BUNDLED_PRESS_PROFILE.file}`, import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/icc', BUNDLED_PRESS_PROFILE.file));
    })
    .then(bytes => {
      if (createHash('sha256').update(bytes).digest('hex') !== BUNDLED_PRESS_PROFILE.sha256) return null;
      const profile = parseIccProfile(new Uint8Array(bytes));
      return profile ? iccSeparation(profile) : null;
    })
    .catch(() => null);
  return bundled;
}

/** The separation an export with this `colorProfile` value uses on a Node shell. */
export async function pressSeparationFor(colorProfile: string | null | undefined): Promise<CmykSeparation> {
  if (!usesBundledPressProfile(colorProfile)) return DEVICE_SEPARATION;
  return (await bundledPressSeparation()) ?? DEVICE_SEPARATION;
}

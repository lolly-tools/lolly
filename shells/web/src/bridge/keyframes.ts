// SPDX-License-Identifier: MPL-2.0
// host.keyframes (v1.124) - the web shell's implementation of KeyframesAPI. Evaluate a `kf`
// track (the engine's canonical wire) into concrete pose samples for a tool TEMPLATE, which
// cannot import the engine. See packages/core/src/host-v1.ts for the contract. Lazy-loaded
// via the bridge/index.ts facade.
//
// The whole point is that parse + interpolation + easing stay in the engine (`parseKf` +
// `evaluateKf`), so a template's motion matches the Design tool's exactly - the caller only
// maps the returned channels onto its own scene.

import { parseKf, evaluateKf } from '../../../../engine/src/keyframes.ts';

export async function sample(kf: string, count: number): Promise<Record<string, number>[]> {
  const track = parseKf(kf);
  if (!track.length) return [];
  const t0 = track[0]!.t;
  const t1 = track[track.length - 1]!.t;
  const n = Math.max(2, Math.min(600, Math.floor(count) || 0));
  const out: Record<string, number>[] = [];
  for (let i = 0; i < n; i++) {
    // Evenly spaced across the track's OWN span; a single-instant track (t0 === t1) yields
    // `n` copies of the one pose, which the caller reads as "hold this pose".
    const t = t1 > t0 ? t0 + (t1 - t0) * (i / (n - 1)) : t0;
    out.push({ ...evaluateKf(track, t) });
  }
  return out;
}

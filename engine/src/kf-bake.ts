// SPDX-License-Identifier: MPL-2.0
/**
 * One channel's keyframes for a player that only knows bezier curves and holds (plans/329).
 *
 * A dotLottie file eases each segment with one cubic bezier, so two kinds of ease have
 * to be written out before it can carry them:
 *
 * - a design-system ease plays the curve its token has NOW (`kfEaseResolved`), so the
 *   file holds the motion the preview showed and nothing about the binding;
 * - a spring has no bezier, so its segment is BAKED: a linear key at every output frame
 *   inside the segment, each holding the value the editor evaluates there (the same
 *   arithmetic as the preview and the video), with runs of equal samples kept as their
 *   two ends.
 *
 * Every other key comes back as it was, with its frame computed by the same expression
 * the compilers always used, so a track with no spring and no design-system ease compiles
 * to exactly the bytes it did before.
 */
import { evaluateKf, kfEaseIsSpring, kfEaseResolved, KF_LINEAR_EASE, type KfChannel, type KfTrack } from './keyframes.ts';

/** One key for an exporter: its frame on the output, the ease out of it and its value. */
export interface KfExportKey {
  /** Output frame (fractional for an authored key, whole for a baked sample). */
  readonly f: number;
  /** A concrete ease: a preset, `eb(...)`, `eh` or `el`. Never a spring or a design-system ease. */
  readonly ease: string;
  readonly v: number;
}

/** The longest stretch of frames one baked spring segment may produce. */
const MAX_BAKED_FRAMES = 100_000;

/**
 * The keys of `ch` in `track`, ready for a bezier player. `startMs` is the layer's start
 * on the output timeline; `fps` the output rate.
 */
export function kfExportKeys(track: KfTrack, ch: KfChannel, fps: number, startMs: number): KfExportKey[] {
  const keys = track.filter((k) => typeof k.v[ch] === 'number');
  const out: KfExportKey[] = [];
  const frameOf = (t: number): number => ((startMs + t) * fps) / 1000;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const next = keys[i + 1];
    const value = key.v[ch] as number;
    // Opacity is always linear (or held), whatever the key carries: nothing to bake.
    const spring = ch !== 'o' && next !== undefined && kfEaseIsSpring(key.ease);
    if (!spring) {
      out.push({ f: frameOf(key.t), ease: kfEaseResolved(key.ease), v: value });
      continue;
    }
    const f0 = frameOf(key.t), f1 = frameOf(next.t);
    const first = Math.floor(f0) + 1, last = Math.ceil(f1) - 1;
    if (last - first > MAX_BAKED_FRAMES) throw new Error('dotLottie: a spring spans more than 100 000 frames. Shorten it or export video.');
    const samples: KfExportKey[] = [{ f: f0, ease: KF_LINEAR_EASE, v: value }];
    for (let f = first; f <= last; f++) {
      const local = (f * 1000) / fps - startMs;
      if (!(local > key.t && local < next.t)) continue;
      const at = evaluateKf(track, local, [ch])[ch];
      if (typeof at === 'number') samples.push({ f, ease: KF_LINEAR_EASE, v: at });
    }
    // A settled spring repeats its target: keep each run of equal values as its two ends.
    for (let j = 0; j < samples.length; j++) {
      const s = samples[j]!;
      const prev = samples[j - 1], after = samples[j + 1];
      if (prev && after && prev.v === s.v && after.v === s.v) continue;
      out.push(s);
    }
  }
  return out;
}

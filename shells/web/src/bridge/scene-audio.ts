// SPDX-License-Identifier: MPL-2.0
/** Intersect a scene's sound with its owning page, retaining source and gain time. */
import { evaluateKf, KF_LINEAR_EASE, type KfTrack } from '../../../../engine/src/keyframes.ts';

export interface SceneAudioTiming {
  startMs: number;
  durMs: number;
  clipInMs: number;
  speed: number;
  kf: KfTrack;
}
export function sceneAudioTiming(clip: SceneAudioTiming, startMs: number, endMs: number): SceneAudioTiming {
  const start = Math.max(startMs, clip.startMs);
  const trim = Math.max(0, start - clip.startMs);
  let kf = clip.kf;
  if (trim > 0 && kf.length) {
    // The audio envelope interpolates volume linearly, independent of pose easing.
    const gain = evaluateKf(kf.map(key => ({ ...key, ease: KF_LINEAR_EASE })), trim).v;
    kf = [...(gain === undefined ? [] : [{ t: 0, ease: KF_LINEAR_EASE, v: { v: gain } }]),
      ...kf.filter(key => key.t > trim).map(key => ({ ...key, t: key.t - trim }))];
  }
  return { ...clip, startMs: start, durMs: Math.max(0, Math.min(endMs, clip.startMs + clip.durMs) - start),
    clipInMs: clip.clipInMs + trim * clip.speed, kf };
}

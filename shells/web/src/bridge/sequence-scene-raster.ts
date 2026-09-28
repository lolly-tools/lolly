// SPDX-License-Identifier: MPL-2.0
import { readTiming, isActiveAt } from './sequence-dom.ts';
import type { SeqLayer } from './sequence-plan.ts';
import { PENDING_MS, type SlidePose } from '../lib/slide-pose.ts';

/** A slide plate's first settled pose, capped to its own interval. */
export function slideRestMs(pose: SlidePose, layer: SeqLayer): number {
  let rest = layer.startMs;
  for (const box of pose.boxes) {
    const timing = readTiming(box);
    if (timing.start >= PENDING_MS) continue;
    rest = Math.max(rest, timing.start + (timing.enter && timing.enter !== 'none' ? timing.enterMs : 0));
  }
  return Math.min(rest, layer.startMs + Math.max(0, layer.durMs - 1));
}
/** Raster capture lifts the off class, so pass the hidden descendants explicitly. */
export function slideHiddenAt(pose: SlidePose, time: number, end: number): Element[] {
  return pose.boxes.filter(box => !isActiveAt(readTiming(box), time, end));
}

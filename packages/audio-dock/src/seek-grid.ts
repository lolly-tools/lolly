// SPDX-License-Identifier: MPL-2.0
// Where a seek goes, for a scrub over a track. A source with a grid (a generated tune,
// which starts again only at the top of a bar) snaps to its points and steps along them;
// a continuous source (a recorded file) seeks anywhere. The dock's scrub uses this, and so
// does any other player that wants the same rules (the web app's asset preview), so a
// listener's keys and drags land in the same place everywhere. Pure: no DOM, no audio.
import type { DockSeekGrid } from './types.ts';

/** The furthest a continuous seek goes: a second short of the end, so a looping track
 *  does not wrap round to its start. */
export function lastSecond(dur: number): number { return Math.max(0, dur - 1); }

/** The point nearest `seconds` (`points` ascending); halfway goes to the later point. */
export function nearestPoint(points: readonly number[], seconds: number): number {
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i]! - seconds) <= Math.abs(points[best]! - seconds)) best = i;
    else break;   // past the nearest point, every later one is further away
  }
  return best;
}

/** The last point at or before `seconds`. */
export function pointBefore(points: readonly number[], seconds: number): number {
  let i = 0;
  while (i + 1 < points.length && points[i + 1]! <= seconds + 1e-3) i++;
  return i;
}

/** `seconds` on the grid (its nearest point), or within a continuous track of `dur` seconds. */
export function snapToGrid(seconds: number, grid: DockSeekGrid | null, dur: number): number {
  if (grid?.points.length) return grid.points[nearestPoint(grid.points, seconds)]!;
  return Math.min(lastSecond(dur), Math.max(0, seconds));
}

/** One arrow-key step from `cur`: the next or previous grid point, or 5 seconds. */
export function stepFrom(cur: number, dir: 1 | -1, grid: DockSeekGrid | null, dur: number): number {
  if (!grid?.points.length) return Math.min(lastSecond(dur), Math.max(0, cur + dir * 5));
  const i = pointBefore(grid.points, cur) + dir;
  return grid.points[Math.min(grid.points.length - 1, Math.max(0, i))]!;
}

/** A Page Up or Page Down from `cur`: the next or previous part (four points when the grid
 *  marks none), or 30 seconds. */
export function leapFrom(cur: number, dir: 1 | -1, grid: DockSeekGrid | null, dur: number): number {
  if (!grid?.points.length) return Math.min(lastSecond(dur), Math.max(0, cur + dir * 30));
  const stops = grid.marks?.length ? [0, ...grid.marks] : grid.points.filter((_, i) => i % 4 === 0);
  const i = pointBefore(stops, cur) + dir;
  return stops[Math.min(stops.length - 1, Math.max(0, i))]!;
}

/**
 * Where a key on a seek slider goes from `cur`: the arrows a step, Page Up and Page Down a
 * part, Home and End the ends. Null for any other key, which the slider leaves alone.
 */
export function seekKeyTarget(key: string, cur: number, grid: DockSeekGrid | null, dur: number): number | null {
  switch (key) {
    case 'ArrowRight': case 'ArrowUp': return stepFrom(cur, 1, grid, dur);
    case 'ArrowLeft': case 'ArrowDown': return stepFrom(cur, -1, grid, dur);
    case 'PageUp': return leapFrom(cur, 1, grid, dur);
    case 'PageDown': return leapFrom(cur, -1, grid, dur);
    case 'Home': return 0;
    case 'End': return grid?.points.length ? grid.points[grid.points.length - 1]! : lastSecond(dur);
    default: return null;
  }
}

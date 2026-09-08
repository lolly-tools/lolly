// SPDX-License-Identifier: MPL-2.0
/** Articulated 2-D motion, expanded to the existing editable keyframe wire. */
import type { KfKeyInput } from '../../../../engine/src/keyframes.ts';
import type { ChoreoBox, ChoreoPlan } from './choreograph.ts';

export type LaunchRecipe = 'editorial-reveal' | 'type-snap' | 'feature-cascade' | 'assemble-loop';
export const LAUNCH_RECIPES: readonly LaunchRecipe[] = ['editorial-reveal', 'type-snap', 'feature-cascade', 'assemble-loop'];

export function launchChoreograph(
  boxes: readonly ChoreoBox[], ranks: readonly number[], recipe: LaunchRecipe,
  durationMs: number, staggerMs: number, camera: boolean,
): ChoreoPlan {
  const loop = recipe === 'assemble-loop';
  const T = durationMs;
  // Every composition gets a readable hold. Dense selections compress the stagger
  // rather than pushing the last entrance past the middle of the composition.
  const gap = Math.min(Math.max(0, staggerMs), T * .19 / Math.max(1, boxes.length - 1));
  const out = 'eb(0.16)(1)(0.3)(1)';
  const rest = (b: ChoreoBox) => ({ x: 0, y: 0, r: 0, s: 1, o: 1, z: b.z, b: 0 });
  const key = (t: number, v: Record<string, number>, ease = out): KfKeyInput => ({ t: Math.round(t), v, ease });
  return {
    arc: loop ? 'loop' : 'intro', durationMs: T,
    boxes: boxes.map((b, i) => {
      const d = ranks[i]! * gap;
      const side = ranks[i]! % 2 ? 1 : -1;
      const r = rest(b);
      const from = recipe === 'editorial-reveal'
        ? { ...r, y: Math.min(120, b.h * .7), o: 0 }
        : recipe === 'type-snap'
          ? { ...r, x: side * Math.min(160, b.w * .28), y: 24, r: side * 7, s: .84, o: 0 }
          : { ...r, x: side * 60, y: Math.min(220, b.h * .8), r: side * 9, s: .9, o: 0 };
      const keys = [key(0, from), key(d + T * .025, from)];
      if (recipe === 'editorial-reveal') {
        keys.push(key(d + T * .18, { ...r, y: -3 }), key(d + T * .25, r));
      } else {
        // Anticipation, decisive arrival, overshoot, settle. Each layer finishes
        // its own gesture before the next beat; no perpetual floating at rest.
        keys.push(key(d + T * .055, { ...from, y: from.y + 12, s: from.s * .98, o: .18 }, 'ei'));
        keys.push(key(d + T * .17, { ...r, y: -9, r: -side * 1.2, s: 1.025 }));
        keys.push(key(d + T * .24, r));
      }
      keys.push(key(loop ? T * .70 : T, r));
      if (loop) {
        const leave = (boxes.length - 1 - ranks[i]!) * gap * .55;
        keys.push(key(T * .70 + leave, r, 'ei'));
        keys.push(key(Math.min(T * .97, T * .82 + leave), from));
        keys.push(key(T, from));
      }
      return { id: b.id, keys: [...new Map(keys.map(k => [k.t, k])).values()].sort((a, b) => (a.t ?? 0) - (b.t ?? 0)) };
    }),
    camera: camera ? [
      key(0, { x: 0, y: 0, z: -18, rx: 0, ry: 0, f: 0, a: 0 }),
      key(T * .5, { x: 0, y: 0, z: 0, rx: 0, ry: 0, f: 0, a: 0 }),
      key(T, { x: 0, y: 0, z: loop ? -18 : 0, rx: 0, ry: 0, f: 0, a: 0 }),
    ] : null,
  };
}

// SPDX-License-Identifier: MPL-2.0
/** Articulated 2-D motion, expanded to the existing editable keyframe wire. */
import type { KfKeyInput } from '../../../../engine/src/keyframes.ts';
import type { ChoreoBox, ChoreoPlan } from './choreograph.ts';

export type LaunchRecipe = 'editorial-reveal' | 'type-snap' | 'feature-cascade' | 'assemble-loop' | 'drift-loop';
export const LAUNCH_RECIPES: readonly LaunchRecipe[] = ['editorial-reveal', 'type-snap', 'feature-cascade', 'assemble-loop', 'drift-loop'];

export function launchChoreograph(
  boxes: readonly ChoreoBox[], ranks: readonly number[], recipe: LaunchRecipe,
  durationMs: number, staggerMs: number, camera: boolean,
): ChoreoPlan {
  const loop = recipe === 'assemble-loop' || recipe === 'drift-loop';
  const T = durationMs;
  // A grouped card and its lettering share one translation and one clock. Scale
  // and rotation about separate layer centres would pull the card apart.
  const units = new Map<string, { members: ChoreoBox[]; rank: number }>();
  for (const [i, box] of boxes.entries()) {
    const id = box.group ? `group:${box.group}` : `box:${box.id}`;
    const unit = units.get(id) ?? { members: [], rank: ranks[i]! };
    unit.members.push(box); unit.rank = Math.min(unit.rank, ranks[i]!); units.set(id, unit);
  }
  const ordered = [...units.values()].sort((a, b) => a.rank - b.rank);
  const byBox = new Map<string, { rank: number; w: number; h: number; grouped: boolean }>();
  for (const [rank, unit] of ordered.entries()) {
    const left = Math.min(...unit.members.map(b => b.cx - b.w / 2)), top = Math.min(...unit.members.map(b => b.cy - b.h / 2));
    const w = Math.max(...unit.members.map(b => b.cx + b.w / 2)) - left, h = Math.max(...unit.members.map(b => b.cy + b.h / 2)) - top;
    for (const box of unit.members) byBox.set(box.id, { rank, w, h, grouped: unit.members.length > 1 });
  }
  // Every composition gets a readable hold. Dense selections compress the stagger
  // rather than pushing the last entrance past the middle of the composition.
  const gap = Math.min(Math.max(0, staggerMs), T * .19 / Math.max(1, units.size - 1));
  const out = 'eb(0.16)(1)(0.3)(1)';
  const rest = (b: ChoreoBox) => ({ x: 0, y: 0, r: 0, s: 1, o: 1, z: b.z, b: 0 });
  const key = (t: number, v: Record<string, number>, ease = out): KfKeyInput => ({ t: Math.round(t), v, ease });
  return {
    arc: loop ? 'loop' : 'intro', durationMs: T,
    boxes: boxes.map(b => {
      const unit = byBox.get(b.id)!;
      const d = unit.rank * gap;
      const side = unit.rank % 2 ? 1 : -1;
      const r = rest(b);
      if (recipe === 'drift-loop') {
        const amplitude = Math.min(18, unit.h * .06);
        return { id: b.id, keys: Array.from({ length: 33 }, (_, index) => key(T * index / 32,
          { ...r, y: index === 0 || index === 32 ? 0 : -side * amplitude * Math.sin(2 * Math.PI * index / 32) }, 'el')) };
      }
      const from = recipe === 'editorial-reveal'
        ? { ...r, y: Math.min(120, unit.h * .7), o: 0 }
        : recipe === 'type-snap'
          ? { ...r, x: side * Math.min(160, unit.w * .28), y: 24, r: unit.grouped ? 0 : side * 7, s: unit.grouped ? 1 : .84, o: 0 }
          : { ...r, x: side * 60, y: Math.min(220, unit.h * .8), r: unit.grouped ? 0 : side * 9, s: unit.grouped ? 1 : .9, o: 0 };
      const keys = [key(0, from), key(d + T * .025, from)];
      if (recipe === 'editorial-reveal') {
        keys.push(key(d + T * .18, { ...r, y: -3 }), key(d + T * .25, r));
      } else {
        // Anticipation, decisive arrival, overshoot, settle. Each layer finishes
        // its own gesture before the next beat; no perpetual floating at rest.
        keys.push(key(d + T * .055, { ...from, y: from.y + 12, s: unit.grouped ? 1 : from.s * .98, o: .18 }, 'ei'));
        keys.push(key(d + T * .17, { ...r, y: -9, r: unit.grouped ? 0 : -side * 1.2, s: unit.grouped ? 1 : 1.025 }));
        keys.push(key(d + T * .24, r));
      }
      keys.push(key(loop ? T * .70 : T, r));
      if (loop) {
        const leave = (units.size - 1 - unit.rank) * gap * .55;
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

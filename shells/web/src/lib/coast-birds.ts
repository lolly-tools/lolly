// SPDX-License-Identifier: MPL-2.0
/**
 * The coast's birds sprinkled in with the Aussie birds (lib/aussie-birds.ts) when a person turns
 * the birds on in a style without its own: now and then a whipbird pair calling in a calm bar,
 * and now and then a flock of rainbow lorikeets flying over at a phrase's end. Rarer than the
 * magpie, and only in a bar the magpie and the kookaburra leave alone. Pure and deterministic,
 * on draws of their own: the same tune always gets the same birds, wherever it is played from.
 */
import type { LofiBar, LofiNote, LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';
import { lorikeetMod, whipbirdMod } from '../../../../engine/src/lofi-coast-birds.ts';

/** A draw from the tune's seed, the bar and what it is for, scrambled with a salt of these birds' own. */
function draw(seed: number, index: number, salt: number): number {
  let h = Math.imul((seed ^ Math.imul(index + 1, 0x85ebca77) ^ (salt + 0xc0a57)) >>> 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
}

const CALM = new Set(['intro', 'verse', 'break', 'bridge', 'feature', 'groove', 'outro']);
const FULL = new Set(['verse', 'drop', 'groove', 'feature']);

/** The coast's birds for a bar the Aussie birds left empty: a whipbird pair or a lorikeet flypast, rarely. */
export function coastBirdsFor(bar: LofiBar, tune: LofiTuneInfo): LofiNote[] {
  if (bar.section === 'rest') return [];
  const seed = tune.seed >>> 0, i = bar.index;
  const root = bar.tones[0] ?? 0;
  const take = (salt: number): number => Math.floor(draw(seed, i, salt) * 1048576);
  // A whipbird pair calling in a calm bar where the lead rests, in about one track in five.
  if (CALM.has(bar.section) && i % 32 === 6 && draw(seed, i, 1) < 0.12 && !bar.notes.some(n => n.voice === 'lead' && n.beat >= 1 && n.beat < 3.5)) {
    return [{ voice: 'whipbird', midi: 93 + ((root + 7) % 6), beat: 1, dur: 8, vel: 0.55, mod: whipbirdMod(draw(seed, i, 2) < 0.85, 1, take(3)) }];
  }
  // Lorikeets flying over at the end of a phrase, in about one track in six.
  if (FULL.has(bar.section) && i % 32 === 27 && draw(seed, i, 4) < 0.1) {
    return [{ voice: 'lorikeet', midi: 92 + (root % 6), beat: 1, dur: 10, vel: 0.45, mod: lorikeetMod('flypast', 6, take(5)) }];
  }
  return [];
}

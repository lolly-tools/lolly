// SPDX-License-Identifier: MPL-2.0
/**
 * The Aussie birds sprinkled into any style a person turns them on in (the music generator's
 * effects lane): a magpie's quiet warble at some phrase ends where the lead rests, now and then
 * a magpie's carol opening the tune, and a kookaburra laughing as the outro begins. Straya,
 * Sugar, botanica and sherbert sing their own birds (engine/src/lofi-straya.ts, and Sugar's
 * magpie), so they are left as they are. Pure and deterministic: every choice comes from the tune's seed and the bar's
 * place, so a track sounds the same however it is played or sought through.
 */
import { composeLofiTune, type LofiBar, type LofiMood, type LofiNote, type LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';
import { DIDGE_LEAD, LOFI_BIRD_FEATURE, LOFI_BIRD_FLOCK, readDidge } from '../../../../engine/src/lofi-straya.ts';
import { coastBirdsFor } from './coast-birds.ts';

/** The styles that place their own birds. */
export const OWN_BIRDS = new Set<LofiMood>(['straya', 'sugar', 'botanica', 'sherbert']);

/** Where each tune's outro starts (its first outro bar's index), composed once a tune. */
const OUTROS = new WeakMap<LofiTuneInfo, number>();
function outroStart(tune: LofiTuneInfo): number {
  let at = OUTROS.get(tune);
  if (at === undefined) {
    at = composeLofiTune(tune.seed, tune.mood).findIndex(b => b.section === 'outro');
    OUTROS.set(tune, at);
  }
  return at;
}

/** A draw from the tune's seed, the bar and what it is for: the same each time. */
function draw(seed: number, index: number, salt: number): number {
  let h = Math.imul((seed ^ Math.imul(index + 1, 0x9e3779b1) ^ salt) >>> 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Whether a stretch of the bar (beats) is clear of the lead. */
function clear(notes: readonly LofiNote[], from: number, to: number): boolean {
  return !notes.some(n => (n.voice === 'lead' || (n.voice === 'didge' && readDidge(n.mod ?? 0).role === DIDGE_LEAD)) && n.beat < to && n.beat + n.dur > from);
}

const CALM = new Set(['intro', 'verse', 'break', 'bridge', 'feature', 'groove', 'outro']);

/** The bar with the Aussie birds sprinkled in, as `tune` (the bar's own tune before any retiming) places them. */
export function sprinkleBirds(bar: LofiBar, tune: LofiTuneInfo): LofiBar {
  if (bar.section === 'rest') return bar;
  const seed = tune.seed >>> 0, i = bar.index;
  const root = bar.tones[0] ?? 0;
  const magpie = 84 + ((root + 7) % 12), kookaburra = 72 + ((root + 4) % 12);
  const song = (salt: number): number => Math.floor(draw(seed, i, salt) * LOFI_BIRD_FEATURE);
  const add: LofiNote[] = [];
  if (i === outroStart(tune) && draw(seed, i, 1) < 0.7) {
    add.push({ voice: 'kookaburra', midi: kookaburra, beat: 1, dur: 12, vel: 0.8, mod: song(2) + LOFI_BIRD_FEATURE + (draw(seed, i, 3) < 0.4 ? LOFI_BIRD_FLOCK : 0) });
  } else if (i === 0 && draw(seed, i, 4) < 0.4 && clear(bar.notes, 0, 3)) {
    add.push({ voice: 'magpie', midi: magpie, beat: 0, dur: 6, vel: 0.75, mod: song(5) + LOFI_BIRD_FEATURE });
  } else if (CALM.has(bar.section) && i % 8 === 3 && draw(seed, i, 6) < 0.55 && clear(bar.notes, 2, 4)) {
    add.push({ voice: 'magpie', midi: magpie, beat: 2, dur: 1.5 + draw(seed, i, 7), vel: 0.4, mod: song(8) });
  }
  if (!add.length) add.push(...coastBirdsFor(bar, tune));   // now and then a whipbird pair or lorikeets (lib/coast-birds.ts)
  return add.length ? { ...bar, notes: [...bar.notes, ...add].sort((a, b) => a.beat - b.beat) } : bar;
}

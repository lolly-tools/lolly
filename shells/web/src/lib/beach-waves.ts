// SPDX-License-Identifier: MPL-2.0
/**
 * The sea brought into any style a person turns the waves on in (the music generator's effects
 * lane), as a few moments rather than a bed (Andy, 2026-11-15: "the waves are too strong and too
 * persistent ... they should be a rare thing"): one to three moments a tune, some tunes only one.
 * A wave breaking on the first beat of a drop or a chorus, a wave breaking into the break, or the
 * shore's roar swelling in softly over a few bars and away again with a wave breaking at its
 * height. Noosacore sets its own sea (engine/src/lofi-noosa.ts), so it is left as it is. Pure and
 * deterministic: every choice comes from the tune's seed and its running order, so a track sounds
 * the same however it is played or sought through.
 */
import { composeLofiTune, lofiBarBeats, type LofiBar, type LofiMood, type LofiNote, type LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';
import { swellBeats, waveMod, WAVE_WASH } from '../../../../engine/src/lofi-waves-notes.ts';

/** The styles that set their own sea. */
export const OWN_WAVES = new Set<LofiMood>(['noosa']);

/** The seed's salt, so the sea's draws are its own. */
const SALT = 0x5ea5e;

/** A draw from the tune's seed and what it is for: the same each time. */
function draw(seed: number, salt: number): number {
  let h = Math.imul((seed ^ salt) >>> 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Each tune's sea moments, by bar, worked out once a tune from its running order. */
const MOMENTS = new WeakMap<LofiTuneInfo, Map<number, LofiNote[]>>();

function momentsOf(tune: LofiTuneInfo): Map<number, LofiNote[]> {
  let out = MOMENTS.get(tune);
  if (out) return out;
  out = new Map();
  const bars = composeLofiTune(tune.seed, tune.mood);
  const total = bars.length - 1;
  const beats = lofiBarBeats(tune);
  const seed = tune.seed >>> 0;
  let k = 0;
  const d = (): number => draw(seed, SALT + k++);
  const add = (bar: number, n: LofiNote): void => { if (bar >= 0 && bar < total) { const list = out!.get(bar) ?? []; list.push(n); out!.set(bar, list); } };
  const runs = (section: string): number[] => bars.flatMap((b, i) => (b.section === section && bars[i - 1]?.section !== section ? [i] : []));
  const wave = (crashBar: number, size: number, distance: number, vel: number): void => {
    const begin = Math.max(0, crashBar * beats - swellBeats(size, tune.bpm));
    const b = Math.floor(begin / beats);
    add(b, { voice: 'wave', midi: 48, beat: Math.round((begin - b * beats) * 1000) / 1000, dur: Math.round((swellBeats(size, tune.bpm) + (WAVE_WASH[size]! * tune.bpm) / 60) * 100) / 100, vel, mod: waveMod('break', distance, size, Math.floor(d() * 1048576)) });
  };
  const drops = runs('drop'), breaks = runs('break'), outro = runs('outro')[0] ?? -1;
  const choices: Array<() => void> = [];
  if (drops.length) choices.push(() => wave(drops[Math.floor(d() * drops.length)]!, 2 + (d() < 0.5 ? 1 : 0), 1 + (d() < 0.5 ? 1 : 0), 0.55));
  if (breaks.length) choices.push(() => wave(breaks[0]!, 2, 1 + (d() < 0.6 ? 1 : 0), 0.6));
  choices.push(() => {
    const at = d() < 0.5 || outro < 0 ? 1 : outro;
    const n = Math.min(4 + Math.floor(d() * 3), total - at - 1);
    if (n < 2) return;
    add(at, { voice: 'wave', midi: 48, beat: 0, dur: n * beats, vel: 0.6, mod: waveMod('shore', 2, 1, Math.floor(d() * 1024)) });
    wave(at + n / 2, 1, 2, 0.5);
  });
  const count = Math.min(choices.length, 1 + (d() < 0.5 ? 1 : 0) + (d() < 0.15 ? 1 : 0));
  const order = choices.map((_, i) => [d(), i] as const).sort((a, z) => a[0] - z[0]).slice(0, count);
  for (const [, i] of order) choices[i]!();
  MOMENTS.set(tune, out);
  return out;
}

/** The bar with its sea moments laid in, placed by `tune` (the bar's own tune before any retiming). */
export function sprinkleWaves(bar: LofiBar, tune: LofiTuneInfo): LofiBar {
  if (bar.section === 'rest') return bar;
  const add = momentsOf(tune).get(bar.index);
  return add?.length ? { ...bar, notes: [...bar.notes, ...add].sort((a, b) => a.beat - b.beat) } : bar;
}

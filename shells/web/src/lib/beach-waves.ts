// SPDX-License-Identifier: MPL-2.0
/**
 * The sea laid under any style a person turns the waves on in (the music generator's effects
 * lane): the shore's roar under every four bars, and waves breaking at irregular gaps, as the
 * sea sends them (engine/src/lofi-waves-notes.ts waveSeries), in front where the music is
 * quiet and under it where it is full. Noosacore sets its own sea (engine/src/lofi-noosa.ts),
 * so it is left as it is. Pure and deterministic: every choice comes from the tune's seed and
 * the bar's place, so a track sounds the same however it is played or sought through.
 */
import { lofiBarBeats, type LofiBar, type LofiMood, type LofiNote, type LofiSection, type LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';
import { swellBeats, waveMod, waveSeries, WAVE_SWELL, WAVE_WASH } from '../../../../engine/src/lofi-waves-notes.ts';

/** The styles that set their own sea. */
export const OWN_WAVES = new Set<LofiMood>(['noosa']);

/** How far forward the sea comes, by section: in front where the band is quiet, under it where it is full. */
const FORWARD: Partial<Record<LofiSection, number>> = { intro: 0.8, break: 0.8, outro: 0.8, bridge: 0.6, feature: 0.5, groove: 0.55, drums: 0.55, verse: 0.5, build: 0.45, drop: 0.4 };
/** The seconds between waves, a little different for each tune. */
const PERIOD = [7.5, 11] as const;
/** The seed's salt, so the sea's draws are its own. */
const SALT = 0x5ea5e;

/** A draw from the tune's seed and what it is for: the same each time. */
function draw(seed: number, salt: number): number {
  let h = Math.imul((seed ^ salt) >>> 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The bar with the sea laid under the bar's notes, placed by `tune` (the bar's own tune before any retiming). */
export function sprinkleWaves(bar: LofiBar, tune: LofiTuneInfo): LofiBar {
  if (bar.section === 'rest') return bar;
  const seed = tune.seed >>> 0;
  const beats = lofiBarBeats(tune);
  const spb = 60 / tune.bpm;
  const forward = FORWARD[bar.section] ?? 0.5;
  const add: LofiNote[] = [];
  // The shore under every four bars, its loop drawn once a tune.
  if (bar.index % 4 === 0) add.push({ voice: 'wave', midi: 48, beat: 0, dur: beats * 4 + 0.75, vel: forward * 0.85, mod: waveMod('shore', 2, 1, Math.floor(draw(seed, SALT + 1) * 1024)) });
  // The waves whose swell begins in this bar.
  const from = bar.index * beats * spb, to = from + beats * spb;
  const period = PERIOD[0] + draw(seed, SALT + 2) * (PERIOD[1] - PERIOD[0]);
  for (const w of waveSeries(seed ^ SALT, from, to + WAVE_SWELL[3], { period, distance: 1 })) {
    const start = w.at - WAVE_SWELL[w.size]!;
    if (start < from || start >= to) continue;
    const beat = Math.round(((start - from) / spb) * 1000) / 1000;
    add.push({ voice: 'wave', midi: 48, beat, dur: Math.round((swellBeats(w.size, tune.bpm) + WAVE_WASH[w.size]! / spb) * 100) / 100, vel: forward, mod: waveMod('break', w.distance, w.size, w.take) });
  }
  return add.length ? { ...bar, notes: [...bar.notes, ...add].sort((a, b) => a.beat - b.beat) } : bar;
}

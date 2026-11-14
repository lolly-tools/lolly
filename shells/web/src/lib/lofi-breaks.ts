// SPDX-License-Identifier: MPL-2.0
/**
 * The break's kit and its filters: how the station plays a note the composer marked as a
 * break's (engine/src/lofi-breaks.ts isBreakNote), breakbeat's drums and drum and bass's
 * top loop.
 *
 * A breakbeat producer samples a drummer and speeds the record up to the track's tempo, so
 * the whole kit plays higher and shorter: the break here is the real acoustic kit
 * (lib/lofi-kit.ts, through lib/lofi-drums.ts) with every piece played faster, as though
 * recorded at 96 to 112 bpm and sped up to the tune's tempo. A slice the composer pitched
 * (a snare roll climbing, a beat pitched down) plays faster or slower again.
 *
 * The filters are a sampler's: a low-pass a little under the top of the spectrum and a
 * gentle drive, and through a build a high-pass that climbs bar by bar, the break thinning
 * to its snare and hats before the drop. Drum and bass's top loop is high-passed so its
 * kick and body stay out of the way of the kit's, and sits under the kit.
 */
import { breakPitch } from '../../../../engine/src/lofi-breaks.ts';
import type { LofiBar, LofiNote, LofiStyle, LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';
import { mulberry32 } from '../../../../engine/src/zzfx-compose.ts';
import * as D from './lofi-drums.ts';
import { drivenBy, type VoiceKit } from './lofi-voices.ts';

/** How each style plays its break: the tempo its record was sampled at, its filters and its level. */
interface BreakSound {
  /** The source record's tempo range (bpm): the tune's over this is how far the break is sped up. */
  from: readonly [number, number];
  /** The sampler's low-pass (Hz) and the floor of its high-pass (Hz). */
  top: number;
  floor: number;
  /** How hard the sampler's input is driven (0 for clean). */
  drive: number;
  /** The break's level against the station's drums. */
  level: number;
}
const SOUNDS: Partial<Record<LofiTuneInfo['mood'], BreakSound>> = {
  breakbeat: { from: [96, 112], top: 11000, floor: 30, drive: 0.6, level: 1 },
  dnb: { from: [124, 136], top: 13000, floor: 380, drive: 0.4, level: 1 },
};
/** The fastest a break plays: a sped-up record past about seven semitones sounds like a toy. */
const MOST = 2 ** (7 / 12);

/** One tune's break kit, drawn once from its seed: a funk drummer's acoustic kit, sped up. */
const KITS = new Map<string, D.DrumKit>();
export function breakKit(tune: LofiTuneInfo): D.DrumKit {
  const key = `${tune.mood}:${tune.seed}`;
  let kit = KITS.get(key);
  if (!kit) {
    if (KITS.size > 16) KITS.clear();
    const sound = SOUNDS[tune.mood] ?? SOUNDS.breakbeat!;
    const r = mulberry32((tune.seed ^ 0xb4ea) >>> 0);
    const from = sound.from[0] + r() * (sound.from[1] - sound.from[0]);
    const base = D.drumKit((tune.seed ^ 0xb4ea) >>> 0, 'funk');
    kit = { ...base, rate: Math.min(MOST, Math.max(1, tune.bpm / from)), id: `${base.id}:break` };
    KITS.set(key, kit);
  }
  return kit;
}

/** The break's filters on a tune's drum lane. */
interface Bus { input: GainNode; hp: BiquadFilterNode; floor: number }
const BUSES = new WeakMap<AudioNode, Map<string, Bus>>();
function busOf(k: VoiceKit, lane: AudioNode, tune: LofiTuneInfo): Bus {
  let byMood = BUSES.get(lane);
  if (!byMood) { byMood = new Map(); BUSES.set(lane, byMood); }
  const had = byMood.get(tune.mood);
  if (had) return had;
  const { ctx } = k;
  const sound = SOUNDS[tune.mood] ?? SOUNDS.breakbeat!;
  const input = ctx.createGain();
  input.gain.value = sound.level;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = sound.floor;
  hp.Q.value = 0.6;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = sound.top;
  lp.Q.value = 0.5;
  input.connect(hp).connect(lp);
  if (sound.drive > 0) {
    // The sampler's input pushed a little: the driven signal in the wet half, the clean one beside the drive.
    const [push, ws] = drivenBy(ctx, sound.drive);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    lp.connect(push);
    ws.connect(wet).connect(lane);
    lp.connect(dry).connect(lane);
  } else lp.connect(lane);
  const bus = { input, hp, floor: sound.floor };
  byMood.set(tune.mood, bus);
  return bus;
}

/** The break kit's stroke for a hat, by the style's hats (a break's hats are the drummer's). */
const HATS: LofiStyle['hats'] = 'hat';

/**
 * Play a break note on the tune's break kit through its filters: pitched by its slice's
 * semitones on top of the kit's speed. `kick` is the tune's kick pitch and length, so the
 * break's bass drum sits where the tune's does.
 */
export function playBreak(k: VoiceKit, lane: AudioNode, note: LofiNote, bar: LofiBar, t: number, vel: number): void {
  const st = bar.tune.style;
  const base = breakKit(bar.tune);
  const semis = breakPitch(note);
  const kit = semis ? { ...base, rate: (base.rate ?? 1) * 2 ** (semis / 12) } : base;
  const out = busOf(k, lane, bar.tune).input;
  switch (note.voice) {
    case 'kick': D.kick(k, out, t, vel, st.kick, st.kickLen, 'acoustic', kit); break;
    case 'snare': D.snare('snare', k, out, t, vel, st.snareTone, kit); break;
    case 'rim': D.rim(k, out, t, vel, kit); break;
    case 'tom': D.tom(k, out, t, note.midi || 45, vel, kit); break;
    case 'openHat': D.hat(HATS, k, out, t, vel, st.hatTone, true, false, kit); break;
    default: D.hat(HATS, k, out, t, vel, st.hatTone, false, false, kit);
  }
}

/**
 * A bar's start: through a build the break's high-pass climbs, bar by bar, to about 700 Hz
 * by the last bar (`into` bars of `of`), and drops back to its floor the moment the drop hits.
 */
export function markBreak(k: VoiceKit, lane: AudioNode, bar: LofiBar, at: number, into: number, of: number): void {
  if (!SOUNDS[bar.tune.mood]) return;
  const bus = busOf(k, lane, bar.tune);
  const f = bar.section === 'build' && bar.tune.mood === 'breakbeat' ? bus.floor + (700 - bus.floor) * Math.min(1, into / Math.max(1, of)) ** 1.5 : bus.floor;
  bus.hp.frequency.setTargetAtTime(f, at, bar.section === 'build' ? 0.4 : 0.02);
}

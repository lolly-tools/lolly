// SPDX-License-Identifier: MPL-2.0
/**
 * Chopped breaks, played: how the station sounds a slice note (engine/src/lofi-break-chop.ts
 * isSliceNote) in jungle, breakbeat, and the drum and bass, hip-hop and trip-hop tunes that
 * chop a break.
 *
 * Each tune's break is recorded once (lib/lofi-break-record.ts: the drummer on the modelled
 * kit in a room, through the style's sampler, at the tune's tempo), a step at a time while
 * the tune plays (warm), and every slice note then plays a stretch of that one recording,
 * as a sampler's pad plays its slice: from where the slice's sound starts, at the note's
 * pitch, until the next slice cuts it (a few milliseconds of crossfade either side, so no
 * cut clicks). A slice costs one buffer source and one gain, where the kit's hits cost one
 * each per drum. A reversed slice plays the recording backwards into its attack; a held one
 * plays the sampler's time-stretch of it (lib/lofi-break-record.ts stretchSlice), worked
 * out once; a rising or falling one sweeps its rate.
 *
 * The break goes through a filter of its own on the tune's drum lane: a high-pass at the
 * style's floor (drum and bass's, high, so its break sits over the kit as a top loop), up
 * to about 650 Hz where a bar has the break without its kick (jungle's intro teasing the
 * break under its pads), and climbing through a build to the drop.
 */
import { breakTake, chopsOf, readSlice, type BreakStyle } from '../../../../engine/src/lofi-break-chop.ts';
import type { LofiBar, LofiMood, LofiNote, LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';
import * as D from './lofi-drums.ts';
import { BreakRecorder, sliceStart, stretchSlice, type BreakKit } from './lofi-break-record.ts';
import type { VoiceKit } from './lofi-voices.ts';

/** The genres that chop a break. */
const STYLE_OF: Partial<Record<LofiMood, BreakStyle>> = { jungle: 'jungle', dnb: 'dnb', breakbeat: 'breakbeat', hiphop: 'hiphop', triphop: 'triphop' };
/**
 * Each style's break against the station's drums, and its high-pass floor (Hz). Set so a
 * drop's sub sits against its breaks (K-weighted, under 120 Hz against over 150) as the
 * genre's records' does (docs/generated-music.md): jungle's about 3 LU under, breakbeat's
 * 1 to 2, hip-hop's level with them, trip-hop's 2 to 4 under, drum and bass's top loop over a kit.
 */
const BUS: Record<BreakStyle, { level: number; floor: number }> = {
  jungle: { level: 1.15, floor: 28 },
  breakbeat: { level: 0.8, floor: 30 },
  hiphop: { level: 0.75, floor: 28 },
  triphop: { level: 0.85, floor: 30 },
  dnb: { level: 0.8, floor: 320 },
};
/** The high-pass where a bar plays the break without its kick: a teaser under the intro. */
const TEASE = 650;
/** Where a jungle or breakbeat build's high-pass reaches by its last bar (Hz). */
const BUILD_TOP = 520;
/** A slice starts this long before its sound (s), so its attack is never cut; and the crossfade where one slice hands to the next. */
const PRE = 0.003;
const XF = 0.004;

/** One tune's break on one audio context: its recorder, then its recording forwards and backwards, and the held slices made so far. */
interface Bank {
  rec: BreakRecorder;
  take: ReturnType<typeof breakTake>;
  bpm: number;
  fwd: AudioBuffer | null;
  rev: AudioBuffer | null;
  held: Map<string, AudioBuffer>;
}
const BANKS = new WeakMap<BaseAudioContext, Map<string, Bank>>();

/** The kit the tune's drummer plays: a funk drummer's acoustic kit, drawn from the seed as the station's kits are. */
function kitOf(tune: LofiTuneInfo): BreakKit {
  const k = D.drumKit((tune.seed ^ 0xb4ea) >>> 0, 'funk');
  return { snareHead: k.snareHead, wires: k.wires, ring: k.ring, hatBright: k.hatBright, hatDecay: k.hatDecay, rideRate: k.rideRate, wash: k.wash, kick: 50 + ((tune.seed >>> 3) % 16) };
}

/** Whether a tune's genre chops a break (its seed decides whether it does: a slice note says so). */
export const chops = (mood: LofiMood): boolean => STYLE_OF[mood] !== undefined;

/** The tune's bank on `ctx`, begun if it is not yet. */
function bankOf(ctx: BaseAudioContext, tune: LofiTuneInfo): Bank | null {
  const style = STYLE_OF[tune.mood];
  if (!style) return null;
  let byTune = BANKS.get(ctx);
  if (!byTune) { byTune = new Map(); BANKS.set(ctx, byTune); }
  const key = `${tune.mood}:${tune.seed}:${tune.bpm}`;
  let bank = byTune.get(key);
  if (!bank) {
    if (byTune.size > 6) byTune.clear();
    const take = breakTake(tune.seed, style, tune.bpm);
    bank = { rec: new BreakRecorder(take, style, kitOf(tune), tune.bpm, ctx.sampleRate, tune.seed), take, bpm: tune.bpm, fwd: null, rev: null, held: new Map() };
    byTune.set(key, bank);
  }
  return bank;
}

/** The tunes found not to chop a break, so a bar of theirs costs one look. */
const PLAIN = new Set<string>();
/**
 * Begin recording a tune's break as soon as its first bar is queued, when its seed chops one
 * (the station calls this for every bar it queues), so the recording is made, a step a tick,
 * before its first slice plays.
 */
export function prepare(ctx: BaseAudioContext, tune: LofiTuneInfo): void {
  if (!STYLE_OF[tune.mood]) return;
  const key = `${tune.mood}:${tune.seed}:${tune.bpm}`;
  if (PLAIN.has(key)) return;
  if (!chopsOf(tune.mood, tune.seed, tune.bpm)) { if (PLAIN.size > 64) PLAIN.clear(); PLAIN.add(key); return; }
  bankOf(ctx, tune);
}

/** Do one step of the next unfinished recording on `ctx` (the station calls this every tick); false when there is none. */
export function warm(ctx: BaseAudioContext): boolean {
  for (const bank of BANKS.get(ctx)?.values() ?? []) if (!bank.rec.done) { bank.rec.step(); return true; }
  return false;
}

/** The recording as buffers, forwards and backwards, finishing it now if the steps have not. */
function buffers(ctx: BaseAudioContext, bank: Bank): { fwd: AudioBuffer; rev: AudioBuffer } {
  if (!bank.fwd || !bank.rev) {
    const data = bank.rec.finish();
    const fwd = ctx.createBuffer(1, data.length, ctx.sampleRate);
    fwd.getChannelData(0).set(data);
    const rev = ctx.createBuffer(1, data.length, ctx.sampleRate);
    const r = rev.getChannelData(0);
    for (let i = 0; i < data.length; i++) r[i] = data[data.length - 1 - i]!;
    bank.fwd = fwd;
    bank.rev = rev;
  }
  return { fwd: bank.fwd, rev: bank.rev };
}

/** The break's filter on a tune's drum lane. */
interface Bus { input: GainNode; hp: BiquadFilterNode; floor: number }
const LANES = new WeakMap<AudioNode, Map<string, Bus>>();
function busOf(k: VoiceKit, lane: AudioNode, tune: LofiTuneInfo): Bus | null {
  const style = STYLE_OF[tune.mood];
  if (!style) return null;
  let byMood = LANES.get(lane);
  if (!byMood) { byMood = new Map(); LANES.set(lane, byMood); }
  const had = byMood.get(tune.mood);
  if (had) return had;
  const input = k.ctx.createGain();
  input.gain.value = BUS[style].level;
  const hp = k.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = BUS[style].floor;
  hp.Q.value = 0.7;
  input.connect(hp).connect(lane);
  const bus = { input, hp, floor: BUS[style].floor };
  byMood.set(tune.mood, bus);
  return bus;
}

/**
 * Play a slice note: its stretch of the tune's recording from where the slice's sound
 * starts, at the note's pitch, until the next slice takes over (`note.dur`), reversed, held
 * or swept as its gesture says.
 */
export function playSlice(k: VoiceKit, lane: AudioNode, note: LofiNote, bar: LofiBar, t: number, vel: number): void {
  const bank = bankOf(k.ctx, bar.tune);
  const bus = busOf(k, lane, bar.tune);
  const s = readSlice(note.mod);
  if (!bank || !bus || !s) return;
  const { ctx } = k;
  const { fwd, rev } = buffers(ctx, bank);
  const spb = 60 / bar.tune.bpm;
  const rate = 2 ** (s.semis / 12);
  const dur = Math.max(0.01, note.dur * spb);
  const from = sliceStart(bank.take, s.slice, bar.tune.bpm);
  const g = ctx.createGain();
  const peak = vel / 0.9;
  const src = ctx.createBufferSource();
  let at = t;
  let offset = from;
  if (s.gesture === 'reverse') {
    // The region the note would play forwards, played backwards: its attack arrives as the note ends.
    src.buffer = rev;
    offset = Math.max(0, fwd.duration - (from + dur * rate));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.01);
  } else if (s.gesture === 'stretch') {
    // Held by the sampler's time-stretch: two thirds of a sixteenth of the slice spread over the note.
    const key = `${s.slice}:${Math.round(dur * rate * 1000)}`;
    let held = bank.held.get(key);
    if (!held) {
      const data = stretchSlice(fwd.getChannelData(0), ctx.sampleRate, Math.max(0, from - PRE), (spb / 4) * 0.66 * rate, dur * rate);
      held = ctx.createBuffer(1, data.length, ctx.sampleRate);
      held.getChannelData(0).set(data);
      bank.held.set(key, held);
    }
    src.buffer = held;
    offset = 0;
    at = t - PRE / rate;
    g.gain.setValueAtTime(peak, at);
  } else {
    src.buffer = fwd;
    // Begin a moment early, so the slice's attack is never cut, fading in over that moment.
    const pre = Math.min(PRE, from);
    offset = from - pre;
    at = t - pre / rate;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, t);
  }
  src.playbackRate.setValueAtTime(rate, at);
  if (s.gesture === 'rise') src.playbackRate.linearRampToValueAtTime(rate * 2, t + dur);
  const end = t + dur;
  if (s.gesture === 'fall') {
    // A turntable switched off: the rate falls away and the sound fades with the rate.
    src.playbackRate.exponentialRampToValueAtTime(rate * 0.12, end);
    g.gain.setValueAtTime(peak, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, end);
  } else {
    // The next slice takes over: a short crossfade across the hand-over.
    g.gain.setValueAtTime(peak, Math.max(t, end - XF / 2));
    g.gain.linearRampToValueAtTime(0, end + XF / 2);
  }
  src.connect(g).connect(bus.input);
  src.start(Math.max(0, at), Math.max(0, offset));
  src.stop(end + XF);
}

/**
 * A bar's start, for the break's filter: high-passed where the bar has the break without its
 * kick (an intro's teaser), climbing through a jungle or breakbeat build (`into` bars of
 * `of`), back to its floor the moment a drop arrives.
 */
export function markChop(k: VoiceKit, lane: AudioNode, bar: LofiBar, at: number, into: number, of: number): void {
  if (!bar.notes.some(n => readSlice(n.mod))) return;
  const bus = busOf(k, lane, bar.tune);
  if (!bus) return;
  const style = STYLE_OF[bar.tune.mood]!;
  const tease = !bar.layers.includes('kick') && bar.section !== 'build' && bar.section !== 'outro';
  const climbs = bar.section === 'build' && (style === 'jungle' || style === 'breakbeat');
  // A breakbeat build runs eight bars, a jungle build four (`of` is the caller's guess when the style does not say).
  const length = style === 'breakbeat' ? 8 : style === 'jungle' ? 4 : of;
  const f = tease ? TEASE : climbs ? bus.floor + (BUILD_TOP - bus.floor) * Math.min(1, into / Math.max(1, length)) ** 1.5 : bus.floor;
  bus.hp.frequency.setTargetAtTime(f, at, climbs ? 0.4 : 0.02);
}

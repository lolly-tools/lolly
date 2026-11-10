// SPDX-License-Identifier: MPL-2.0
/**
 * A music generator track as data: its settings (style, seed, length, tempo, key, the
 * instruments chosen for the whole track and per kind of section, drums, texture, tone and
 * mix), how they travel in a link, and how they shape the composer's bars. Pure, with no
 * DOM, so the music generator (views/music-studio.ts), a saved tune's renderer
 * (lib/lofi-tune.ts) and the Neurospicy player all read a track the same way.
 */
import { lofiStream, transposeChordName, LOFI_MOODS, LOFI_KEYS, LOFI_LEADS, LOFI_BASSES, LOFI_SNARES, LOFI_HATS, type LofiBar, type LofiMood, type LofiStyle, type LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';
import { LOFI_MIX, type LofiMix, type LofiSettings } from './lofi-station.ts';

export const MIX_KEYS: readonly (keyof LofiMix)[] = ['keys', 'bass', 'lead', 'drums', 'fx', 'reverb', 'texture'];

/** Instruments a person chose for one kind of section (every drop, every build…). */
export type SectionVoices = Partial<Pick<LofiStyle, 'keys' | 'lead' | 'bass' | 'snare' | 'hats'>>;
export const SECTION_NAMES = ['intro', 'verse', 'build', 'drop', 'break', 'bridge', 'feature', 'groove', 'drums', 'outro'] as const;
/** The tempos a person can set, in beats a minute. */
export const BPM_RANGE = [50, 220] as const;
/** How far the key can be moved, in semitones each way. */
export const TRANSPOSE_RANGE = 6;
/** The voices that carry a pitch, which a change of key moves (the drums and sweeps stay). */
export const PITCHED_VOICES = new Set<string>(['keys', 'lead', 'bass', 'soar', 'bwah', 'sparkle', 'game', 'hey', 'blip', 'coin', 'phaser']);

export interface MusicState {
  mood: LofiMood;
  /** Per kind of section, the instruments chosen for it, over whatever the composer chose. */
  sections: Partial<Record<string, SectionVoices>>;
  seed: number;
  bars: number;
  /** The tempo a person set, in beats a minute; absent plays the tune at the composer's. */
  bpm?: number;
  /** Semitones the person moved the key by (from -6 to 6); absent is the composer's key. */
  transpose?: number;
  keys?: LofiStyle['keys'];
  lead?: LofiStyle['lead'];
  bass?: LofiStyle['bass'];
  drums: boolean;
  texture: number;
  bright?: number;
  drive?: number;
  mix: LofiMix;
}

export const DEFAULT_STATE: MusicState = { mood: 'sugar', seed: 2024, bars: 64, drums: true, texture: 0.3, mix: { ...LOFI_MIX }, sections: {} };

/** Read a state from the link's parameters. Anything unknown or out of range falls back. */
export function parseMusicState(params: string): MusicState {
  const q = new URLSearchParams(params);
  const pick = <T extends string>(v: string | null, from: readonly T[]): T | undefined => (from as readonly string[]).includes(v ?? '') ? from.find(x => x === v) : undefined;
  const num = (v: string | null, lo: number, hi: number): number | undefined => {
    const n = Number(v);
    return v !== null && v !== '' && Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
  };
  const mix: LofiMix = { ...LOFI_MIX };
  for (const k of MIX_KEYS) {
    const v = num(q.get(`mix.${k}`), 0, 2);
    if (v !== undefined) mix[k] = v;
  }
  const sections: Partial<Record<string, SectionVoices>> = {};
  for (const name of SECTION_NAMES) {
    const v: SectionVoices = {};
    const keys = pick(q.get(`${name}.keys`), LOFI_KEYS);
    const lead = pick(q.get(`${name}.lead`), LOFI_LEADS);
    const bass = pick(q.get(`${name}.bass`), LOFI_BASSES);
    const snare = pick(q.get(`${name}.snare`), LOFI_SNARES);
    const hats = pick(q.get(`${name}.hats`), LOFI_HATS);
    if (keys) v.keys = keys;
    if (lead) v.lead = lead;
    if (bass) v.bass = bass;
    if (snare) v.snare = snare;
    if (hats) v.hats = hats;
    if (keys || lead || bass || snare || hats) sections[name] = v;
  }
  return {
    sections,
    mood: pick(q.get('style'), LOFI_MOODS) ?? DEFAULT_STATE.mood,
    seed: Math.floor(num(q.get('seed'), 0, 4294967295) ?? DEFAULT_STATE.seed),
    bars: Math.round(num(q.get('bars'), 4, 512) ?? DEFAULT_STATE.bars),
    bpm: ((v) => v === undefined ? undefined : Math.round(v))(num(q.get('bpm'), BPM_RANGE[0], BPM_RANGE[1])),
    transpose: ((v) => v === undefined || Math.round(v) === 0 ? undefined : Math.round(v))(num(q.get('transpose'), -TRANSPOSE_RANGE, TRANSPOSE_RANGE)),
    keys: pick(q.get('keys'), LOFI_KEYS),
    lead: pick(q.get('lead'), LOFI_LEADS),
    bass: pick(q.get('bass'), LOFI_BASSES),
    drums: q.get('drums') !== '0',
    texture: num(q.get('texture'), 0, 1) ?? DEFAULT_STATE.texture,
    bright: num(q.get('bright'), 0.5, 1.8),
    drive: num(q.get('drive'), 0.8, 4.5),
    mix,
  };
}

/** The link's parameters for a state: only what differs from the defaults, so links stay short. */
export function musicStateParams(s: MusicState): string {
  const q = new URLSearchParams();
  q.set('style', s.mood);
  q.set('seed', String(s.seed >>> 0));
  q.set('bars', String(s.bars));
  if (s.bpm !== undefined) q.set('bpm', String(s.bpm));
  if (s.transpose) q.set('transpose', String(s.transpose));
  if (s.keys) q.set('keys', s.keys);
  if (s.lead) q.set('lead', s.lead);
  if (s.bass) q.set('bass', s.bass);
  if (!s.drums) q.set('drums', '0');
  if (s.texture !== DEFAULT_STATE.texture) q.set('texture', String(s.texture));
  if (s.bright !== undefined) q.set('bright', String(s.bright));
  if (s.drive !== undefined) q.set('drive', String(s.drive));
  for (const k of MIX_KEYS) if (s.mix[k] !== 1) q.set(`mix.${k}`, String(s.mix[k]));
  for (const name of SECTION_NAMES) {
    const v = s.sections[name];
    if (v?.keys) q.set(`${name}.keys`, v.keys);
    if (v?.lead) q.set(`${name}.lead`, v.lead);
    if (v?.bass) q.set(`${name}.bass`, v.bass);
    if (v?.snare) q.set(`${name}.snare`, v.snare);
    if (v?.hats) q.set(`${name}.hats`, v.hats);
  }
  return q.toString();
}

/** The parts the person locked, as the composer's fixed style. */
export function fixedStyle(s: MusicState): Partial<LofiStyle> {
  const f: Partial<LofiStyle> = {};
  if (s.keys) f.keys = s.keys;
  if (s.lead) f.lead = s.lead;
  if (s.bass) f.bass = s.bass;
  if (s.bright !== undefined) f.bright = s.bright;
  if (s.drive !== undefined) f.drive = s.drive;
  return f;
}

/**
 * Each bar with the instruments chosen for its kind of section, if any, at the tempo the
 * person set and in the key they moved it to: what the station plays too. One changed
 * tune for all of a tune's bars. A change of key moves every pitched note and the chord's
 * name and tones by the same semitones; the drums stay as they are.
 */
export function shapeBar(s: MusicState): (bar: LofiBar) => LofiBar {
  const retimed = new WeakMap<LofiTuneInfo, LofiTuneInfo>();
  const shift = s.transpose ?? 0;
  const changed = (tune: LofiTuneInfo): LofiTuneInfo => {
    const bpm = s.bpm ?? tune.bpm;
    if (bpm === tune.bpm && !shift) return tune;
    let at = retimed.get(tune);
    if (!at || at.bpm !== bpm) {
      at = { ...tune, bpm, ...(shift ? { key: transposeChordName(tune.key, shift), progressions: [tune.progressions[0].map(c => transposeChordName(c, shift)), tune.progressions[1].map(c => transposeChordName(c, shift))] } : {}) };
      retimed.set(tune, at);
    }
    return at;
  };
  return (bar) => {
    const chosen = s.sections[bar.section];
    let out = chosen ? { ...bar, voices: { ...bar.voices, ...chosen, ...(chosen.lead ? { double: undefined } : {}) } } : bar;
    if (shift) {
      out = {
        ...out,
        chord: out.chord ? transposeChordName(out.chord, shift) : out.chord,
        tones: out.tones.map(pc => ((pc + shift) % 12 + 12) % 12),
        notes: out.notes.map(n => PITCHED_VOICES.has(n.voice) ? { ...n, midi: n.midi + shift } : n),
      };
    }
    const tune = changed(bar.tune);
    return tune === bar.tune ? out : { ...out, tune };
  };
}

/** The track's bars, composed: the same bars the station will play. */
export function composeTrack(s: MusicState): LofiBar[] {
  const stream = lofiStream(s.seed, { mood: s.mood, style: fixedStyle(s) });
  const shape = shapeBar(s);
  return Array.from({ length: s.bars }, () => shape(stream.next()));
}

/** Where each bar starts, in seconds, and the whole track's length. */
export function barTimes(bars: readonly LofiBar[]): { starts: number[]; total: number } {
  const starts: number[] = [];
  let at = 0;
  for (const b of bars) { starts.push(at); at += 240 / b.tune.bpm; }
  return { starts, total: at };
}

/** How long a track lasts at its own tempo (seconds), its last bar included. */
export function trackSeconds(s: MusicState): number {
  return barTimes(composeTrack(s)).total;
}

/** The station settings that play a track exactly as the generator made it (a saved tune, a render). */
export function trackSettings(s: MusicState, startBar = 0): LofiSettings {
  return { mood: s.mood, drums: s.drums, texture: s.texture, style: fixedStyle(s), startBar, bars: s.bars, shape: shapeBar(s) };
}

// SPDX-License-Identifier: MPL-2.0
/**
 * How the plucked leads that are also keys instruments are played as a melody: the
 * harp, the steel-string acoustic guitar and the Persian tar. A lead note's `mod` carries
 * its articulation to the instrument (lib/lofi-voices.ts and lib/lofi-world-voices.ts):
 *
 * - The harp lets every note ring and now and then sweeps up into a phrase's first long
 *   note: a quick run over the chord's tones below that note, a harpist's glissando.
 * - The acoustic guitar plays as a flatpicker does (flatpick): slides, hammer-ons and
 *   pull-offs between neighbouring notes and as grace notes, quick runs up or down the
 *   tune's scale into a note after a rest, the chord strummed under a held note on the
 *   beat, double stops from the chord (some hammered on as a grab), muted strings raked
 *   into a note, and the hand shifting along the neck (finger noise) on a leap. About a
 *   fifth of a recorded phrase's notes are legato (11 to 31 per cent in five takes). Half
 *   the tunes' guitarists are percussive players, who knock the top on the beats the lead
 *   rests on and on the backbeat of their strumming (rhythmKnocks).
 * - The tar tremolos a held note with its plectrum (the riz), as a tar player sustains one;
 *   the composer asks for it in Persian (its bends become the riz), and it plays some long
 *   notes so elsewhere.
 *
 * Pure and deterministic: every choice comes from the bar's seeded source.
 */
import type { LofiBar, LofiNote, LofiStyle } from '../../../../engine/src/lofi-compose.ts';

/** A note that is one lead instrument's own ornament (a harp's run, a chop's stutter or reversed swell): an instrument doubling the lead leaves it out. */
export const LEAD_OWN = 1 << 13;
/** Whether a lead note is its instrument's own ornament (see LEAD_OWN). */
export const ownOnly = (mod: number | undefined): boolean => mod !== undefined && (mod & LEAD_OWN) !== 0;

/**
 * A plucked lead's articulations, in `mod`: 1 bent (or, on the tar, tremoloed), 2 slid
 * into, 3 hammered on from a tone below, 4 a muted string raked (a dead note), 5 pulled
 * off from a tone above, 6 a knock on the top (no note); plus 8 when the hand shifts along
 * the neck to the note (the acoustic's finger noise).
 */
export const PLUCK_BEND = 1, PLUCK_SLIDE = 2, PLUCK_HAMMER = 3, PLUCK_DEAD = 4, PLUCK_PULL = 5, PLUCK_KNOCK = 6, PLUCK_SHIFT = 8;
/** A strummed string struck again as its note ends (lib/lofi-strum.ts): the new stroke takes the string over, so the old note is cut, not added to. */
export const RESTRUCK = 16;
/** The keys instruments played as a lead, which this module articulates. */
export const PLUCKED_LEADS = new Set<LofiStyle['lead']>(['harp', 'steel', 'tar']);

/** The share of a strumming lead's bars played as a strummed passage (chords or strums on about a fifth to a third of a picked phrase's notes, measured). */
const STRUM_BARS = 0.25;
/** How long a harp's run takes per note (s). */
const RUN_STEP = 0.034;

/**
 * The bar's lead notes as the instrument plays them. `spb` is seconds a beat and `rand`
 * the bar's seeded source.
 */
export function pluckedLead(notes: LofiNote[], bar: LofiBar, lead: LofiStyle['lead'], spb: number, rand: () => number): LofiNote[] {
  const lines = notes.filter(n => n.voice === 'lead').sort((a, b) => a.beat - b.beat);
  if (!lines.length) return notes;
  const before = new Map<LofiNote, LofiNote[]>();
  const played = new Map<LofiNote, LofiNote>();
  let passage: boolean | undefined;
  for (let i = 0; i < lines.length; i++) {
    const n = lines[i]!, prev = lines[i - 1];
    const rest = prev ? n.beat - (prev.beat + prev.dur) : n.beat;
    if (lead === 'harp') {
      // A glissando up into a phrase's first long note: three or four of the chord's tones below the note.
      const step = RUN_STEP / spb;
      const count = rand() < 0.5 ? 3 : 4;
      if (n.dur >= 0.5 && rest >= count * step + 0.25 && bar.tones.length && rand() < 0.35) {
        const below: number[] = [];
        for (let m = n.midi - 1; m >= n.midi - 14 && below.length < count; m--) if (bar.tones.includes(((Math.round(m) % 12) + 12) % 12)) below.push(m);
        before.set(n, below.reverse().map((m, k) => ({ ...n, midi: m, beat: n.beat - (below.length - k) * step, dur: step * 2, vel: n.vel * (0.55 + 0.1 * k), mod: LEAD_OWN })));
      }
    } else if (lead === 'steel') {
      // A songwriter's lead strums whole passages now and then: a bar where every note is a chord.
      if (passage === undefined) passage = bar.tones.length > 0 && rand() < STRUM_BARS;
      flatpick(n, prev, rest, bar, spb, rand, before, played, passage);
    } else if (lead === 'tar') {
      if (!n.mod && n.dur >= 0.75 && rand() < 0.35) played.set(n, { ...n, mod: PLUCK_BEND });
    }
  }
  if (!before.size && !played.size) return notes;
  const out: LofiNote[] = [];
  for (const n of notes) {
    out.push(...(before.get(n) ?? []));
    out.push(played.get(n) ?? n);
  }
  return out;
}

/** The tune's scale (pitch classes) from its key's name: a major or minor key's seven notes; for a mode, the chord's tones. */
function scaleOf(bar: LofiBar): number[] {
  const m = /^([A-G])([♭♯]?) (major|minor)$/.exec(bar.tune.key);
  if (!m) return [...bar.tones];
  const letter: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const root = ((letter[m[1]!] ?? 0) + (m[2] === '♭' ? -1 : m[2] === '♯' ? 1 : 0) + 12) % 12;
  return (m[3] === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]).map(i => (root + i) % 12);
}
/** Whether a tune's acoustic guitarist knocks the top on the beats: about half of them, from the tune's seed alone. */
export function percussive(seed: number): boolean {
  return ((Math.imul(seed ^ 0x6b0c, 0x9e3779b1) >>> 0) % 100) < 50;
}
const pc = (m: number): number => ((Math.round(m) % 12) + 12) % 12;

/** A flatpicker's choices for one melody note `n` (see the header), into `before` (notes added ahead of it) and `played` (the note as played). */
function flatpick(n: LofiNote, prev: LofiNote | undefined, rest: number, bar: LofiBar, spb: number, rand: () => number, before: Map<LofiNote, LofiNote[]>, played: Map<LofiNote, LofiNote>, passage: boolean): void {
  // The composer's bend (the roots styles' scoop into a note) is a slide on the acoustic, unless a lick takes the note.
  const asked = n.mod === 1;
  if (n.mod && !asked) return;
  if (asked) played.set(n, { ...n, mod: 0 });
  const add = (x: LofiNote[]): void => { before.set(n, [...(before.get(n) ?? []), ...x]); };
  const strong = Math.abs(n.beat - Math.round(n.beat)) < 0.02;
  const inChord = (m: number): boolean => bar.tones.includes(pc(m));
  // A percussive player knocks the top on the beats the lead rests over.
  if (percussive(bar.tune.seed) && rest >= 0.9) {
    const from = prev ? prev.beat + prev.dur : 0;
    for (let b = Math.ceil(from + 0.1); b < n.beat - 0.1; b++) {
      if (rand() < 0.7) add([{ ...n, beat: b, dur: 0.1, vel: n.vel * 0.85, mod: LEAD_OWN | PLUCK_KNOCK }]);
    }
  }
  // A leap is a shift of the hand along the neck: the fingers rub the strings on the way.
  const shift = prev && Math.abs(n.midi - prev.midi) >= 5 ? PLUCK_SHIFT : 0;
  const r = rand();
  if (bar.tones.length && (passage ? n.dur >= 0.2 : strong && n.dur >= 0.5 && r < 0.1)) {
    // A strum: chord tones under the melody a string's reach apart (three to seven
    // semitones), struck low to high so the stroke ends on the melody; every note of a
    // strummed passage, the odd held note elsewhere.
    const under: number[] = [];
    for (let m = Math.round(n.midi) - 3, top = Math.round(n.midi); m >= n.midi - 19 && under.length < 3; m--) {
      if (top - m >= 3 && top - m <= 7 && inChord(m)) { under.push(m); top = m; }
    }
    // The sweep: about 30 ms across five strings in the recordings, so 6 to 9 ms a string.
    const gap = (0.006 + rand() * 0.003) / spb;
    // The stroke starts a moment before the beat (a downbeat's strum reaches back into the bar before), and the melody note stays on the beat.
    add(under.reverse().map((m, k) => ({ ...n, midi: m, beat: n.beat - (under.length - k) * gap, vel: n.vel * (0.68 + 0.06 * k), mod: LEAD_OWN })));
    if (shift) played.set(n, { ...n, mod: shift });
    return;
  }
  if (n.dur >= 0.25 && bar.tones.length && r < 0.2) {
    // A double stop: a third or a sixth under the note, from the chord; now and then hammered on, both strings, as a grab.
    const m = [3, 4, 8, 9].map(d => n.midi - d).find(inChord);
    if (m !== undefined) {
      const grab = rand() < 0.35;
      add([{ ...n, midi: m, beat: n.beat + 0.003 / spb, vel: n.vel * 0.8, mod: LEAD_OWN | (grab ? PLUCK_HAMMER : 0) }]);
      played.set(n, { ...n, mod: (grab ? PLUCK_HAMMER : 0) | shift });
      return;
    }
  }
  if (rest >= 0.2 && r >= 0.2 && r < 0.26) {
    // A rake: two or three muted strings dragged across on the way into the note.
    const count = rand() < 0.5 ? 2 : 3, gap = (0.018 + rand() * 0.008) / spb;
    add(Array.from({ length: count }, (_, j) => ({ ...n, midi: n.midi - 5 * (count - j), beat: n.beat - (count - j) * gap, dur: 0.1, vel: n.vel * 0.5, mod: LEAD_OWN | PLUCK_DEAD })));
    if (shift) played.set(n, { ...n, mod: shift });
    return;
  }
  const step = spb < 0.42 ? 0.25 : 0.125;
  if (rest >= 2 * step + 0.05 && r >= 0.26 && r < 0.6) {
    // A quick run up or down the scale into the note: the first picked, the rest hammered on or pulled off.
    const scale = scaleOf(bar), up = rand() < 0.6, count = rest >= 3 * step + 0.1 && rand() < 0.5 ? 3 : 2;
    const run: number[] = [];
    for (let m = Math.round(n.midi) + (up ? -1 : 1); run.length < count && Math.abs(m - n.midi) <= 7; m += up ? -1 : 1) if (scale.includes(pc(m))) run.push(m);
    if (run.length === count) {
      const legato = up ? PLUCK_HAMMER : PLUCK_PULL;
      add(run.reverse().map((m, k) => ({ ...n, midi: m, beat: n.beat - (count - k) * step, dur: step * 0.95, vel: n.vel * (k ? 0.8 : 0.9), mod: LEAD_OWN | (k ? legato : 0) })));
      played.set(n, { ...n, mod: legato });
      return;
    }
  }
  // Between neighbouring notes: up a step or two slid or hammered, down one pulled off; after a rest, a grace note.
  const near = prev && rest < 0.15 && n.midi !== prev.midi && Math.abs(n.midi - prev.midi) <= 3;
  let art = 0;
  if (near && n.midi > prev!.midi) art = rand() < 0.3 ? PLUCK_SLIDE : rand() < 0.4 ? PLUCK_HAMMER : 0;
  else if (near) art = rand() < 0.5 ? PLUCK_PULL : 0;
  else if (rest >= 0.2 && rand() < 0.25) art = rand() < 0.6 ? PLUCK_HAMMER : PLUCK_PULL;
  else if (n.dur >= 0.4 && rand() < 0.15) art = PLUCK_HAMMER;
  if (asked && !art && rand() < 0.3) art = PLUCK_SLIDE;
  if (art || shift) played.set(n, { ...n, mod: art | shift });
}

/**
 * The knocks of a percussive strummer (see percussive): the strumming hand slapping the
 * top on the backbeat, beats two and four, in the bars the guitar strums. `rand` is the
 * bar's seeded source.
 */
export function rhythmKnocks(notes: LofiNote[], bar: LofiBar, rand: () => number): LofiNote[] {
  if (!percussive(bar.tune.seed)) return notes;
  const strums = notes.filter(n => n.voice === 'keys');
  if (!strums.length) return notes;
  const vel = Math.max(...strums.map(n => n.vel));
  const knocks: LofiNote[] = [];
  for (const b of [1, 3]) if (rand() < 0.85) knocks.push({ voice: 'keys', midi: 40, beat: b + 0.004, dur: 0.1, vel: vel * 0.8, mod: PLUCK_KNOCK });
  return [...notes, ...knocks].sort((a, b) => a.beat - b.beat);
}

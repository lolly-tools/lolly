// SPDX-License-Identifier: MPL-2.0
/**
 * How the plucked leads that are also keys instruments are played as a melody: the
 * harp, the steel-string acoustic guitar and the Persian tar. A lead note's `mod` carries
 * its articulation to the instrument (lib/lofi-voices.ts and lib/lofi-world-voices.ts):
 *
 * - The harp lets every note ring and now and then sweeps up into a phrase's first long
 *   note: a quick run over the chord's tones below that note, a harpist's glissando.
 * - The acoustic guitar slides into a note a step or two from the one before, played
 *   straight after it, and hammers some held notes on from a tone below. Now and then, as
 *   a player does in a melody, it strums the chord under a held note on the beat (a
 *   downstroke over three of the chord's tones ending on the melody), plays a double
 *   stop (a third or a sixth under the note, from the chord, sometimes hammered on as a
 *   grab), or rakes two or three muted strings on the way into a note.
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

/** A plucked lead's articulations, in `mod`: 1 bent (or, on the tar, tremoloed), 2 slid into, 3 hammered on from a tone below, 4 a muted string raked (a dead note). */
export const PLUCK_BEND = 1, PLUCK_SLIDE = 2, PLUCK_HAMMER = 3, PLUCK_DEAD = 4;
/** The keys instruments played as a lead, which this module articulates. */
export const PLUCKED_LEADS = new Set<LofiStyle['lead']>(['harp', 'steel', 'tar']);

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
      if (n.mod) continue;
      const strong = Math.abs(n.beat - Math.round(n.beat)) < 0.02;
      const inChord = (m: number): boolean => bar.tones.includes(((Math.round(m) % 12) + 12) % 12);
      const r = rand();
      if (strong && n.dur >= 0.5 && bar.tones.length && r < 0.1) {
        // The odd strum: chord tones under the melody a string's reach apart (three to seven
        // semitones), struck low to high so the stroke ends on the melody.
        const under: number[] = [];
        for (let m = Math.round(n.midi) - 3, top = Math.round(n.midi); m >= n.midi - 19 && under.length < 3; m--) {
          if (top - m >= 3 && top - m <= 7 && inChord(m)) { under.push(m); top = m; }
        }
        const gap = (0.009 + rand() * 0.004) / spb;
        // The stroke starts a moment before the beat (a downbeat's strum reaches back into the bar before), and the melody note stays on the beat.
        before.set(n, under.reverse().map((m, k) => ({ ...n, midi: m, beat: n.beat - (under.length - k) * gap, vel: n.vel * (0.68 + 0.06 * k), mod: LEAD_OWN })));
        continue;
      }
      if (n.dur >= 0.4 && bar.tones.length && r < 0.18) {
        // A double stop: a third or a sixth under the note, from the chord; now and then hammered on, both strings, as a grab.
        const m = [3, 4, 8, 9].map(d => n.midi - d).find(inChord);
        if (m !== undefined) {
          const grab = rand() < 0.35;
          before.set(n, [{ ...n, midi: m, beat: n.beat + 0.003 / spb, vel: n.vel * 0.8, mod: LEAD_OWN | (grab ? PLUCK_HAMMER : 0) }]);
          if (grab) played.set(n, { ...n, mod: PLUCK_HAMMER });
          continue;
        }
      }
      if (rest >= 0.2 && r >= 0.18 && r < 0.25) {
        // A rake: two or three muted strings dragged across on the way into the note.
        const count = rand() < 0.5 ? 2 : 3, gap = (0.018 + rand() * 0.008) / spb;
        before.set(n, Array.from({ length: count }, (_, j) => ({ ...n, midi: n.midi - 5 * (count - j), beat: n.beat - (count - j) * gap, dur: 0.1, vel: n.vel * 0.5, mod: LEAD_OWN | PLUCK_DEAD })));
        continue;
      }
      const near = prev && rest < 0.15 && n.midi !== prev.midi && Math.abs(n.midi - prev.midi) <= 3;
      if (near && rand() < 0.35) played.set(n, { ...n, mod: PLUCK_SLIDE });
      else if (n.dur >= 0.4 && rand() < 0.2) played.set(n, { ...n, mod: PLUCK_HAMMER });
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

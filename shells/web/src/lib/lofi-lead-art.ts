// SPDX-License-Identifier: MPL-2.0
/**
 * How the plucked leads that are also keys instruments are played as a melody: the
 * harp, the steel-string acoustic guitar and the Persian tar. A lead note's `mod` carries
 * its articulation to the instrument (lib/lofi-voices.ts and lib/lofi-world-voices.ts):
 *
 * - The harp lets every note ring and now and then sweeps up into a phrase's first long
 *   note: a quick run over the chord's tones below that note, a harpist's glissando.
 * - The acoustic guitar slides into a note a step or two from the one before, played
 *   straight after it, and hammers some held notes on from a tone below.
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

/** A plucked lead's articulations, in `mod`: 1 bent (or, on the tar, tremoloed), 2 slid into, 3 hammered on from a tone below. */
export const PLUCK_BEND = 1, PLUCK_SLIDE = 2, PLUCK_HAMMER = 3;
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

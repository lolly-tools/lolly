// SPDX-License-Identifier: MPL-2.0
/**
 * A strummed steel-string acoustic, played the way recorded strummers play one. Measured in
 * public-domain (CC0) recordings of strummed acoustics (four strum loops at 128 to 155 bpm,
 * a percussive strum loop, a slow strummed riff, a light strummed take, a two-guitar take
 * and two chord takes), for measurement only:
 *
 * - The hand never stops: strokes come at 1.5 to 3.9 a beat (median 2.3), downstrokes on
 *   the beats and the eighths, upstrokes between, the upstrokes about 1 to 3 dB softer and
 *   over fewer strings. A held chord is strummed through in a pattern (PATTERNS), the
 *   tune's own; a written rhythm (a boom-chick) keeps its strokes.
 * - The sweep across the strings: 20 to 41 ms (median about 30), the quartiles 10 to 60;
 *   harder is quicker. Each string a little off the even spacing.
 * - The chord rings into the next stroke: 9 to 18 dB under the last stroke's peak when the
 *   next comes (median about 11), so a string is let ring until it is struck again, and then
 *   the new stroke takes it over (the old vibration is cut, not added to).
 * - A light swing on the offbeat eighths: the "and" at 0.56 to 0.62 of the beat in most takes.
 * - A percussive strummer (lib/lofi-lead-art.ts's percussive) chokes some backbeats into a
 *   chuck (13 per cent of the strokes in the percussive take, its pick noise only 10 dB
 *   under the stroke): the strings muted under the fretting hand, with the knock on the top.
 * - A ghost upstroke now and then: the hand passing up through the top string or two, barely
 *   touching them.
 *
 * Pure and deterministic: every choice comes from the tune and the bar's seeded source.
 */
import type { LofiBar, LofiNote } from '../../../../engine/src/lofi-compose.ts';
import { percussive, PLUCK_DEAD, RESTRUCK } from './lofi-lead-art.ts';

/** A chord fingered on the fretboard: the sounding pitch on each string, low E to high E, or null. */
type Shape = Array<number | null>;
/** Standard tuning, low E to high E. */
const TUNING = [40, 45, 50, 55, 59, 64] as const;

/**
 * Strumming patterns over a bar of sixteenths (0 to 15): each a list of [sixteenth, stroke],
 * 'D' a full downstroke, 'U' an upstroke over the top strings, 'B' the bass string alone (a
 * boom), 'd' a downstroke over the treble strings (a chick).
 */
const PATTERNS = {
  // Down, down-up, up-down-up: the folk and pop strum.
  folk: [[0, 'D'], [4, 'D'], [6, 'U'], [10, 'U'], [12, 'D'], [14, 'U']],
  // Eighths straight through, down and up: a driving strum.
  drive: [[0, 'D'], [2, 'U'], [4, 'D'], [6, 'U'], [8, 'D'], [10, 'U'], [12, 'D'], [14, 'U']],
  // Room between strokes: a calm strum for the quiet styles.
  calm: [[0, 'D'], [6, 'U'], [10, 'U'], [12, 'D'], [14, 'U']],
  // Sixteenths for a slow tune, the hand going down on the eighths and up between: a busy, swung strum.
  sixteen: [[0, 'D'], [3, 'U'], [4, 'D'], [6, 'D'], [7, 'U'], [9, 'U'], [10, 'D'], [12, 'D'], [13, 'U'], [14, 'D'], [15, 'U']],
  // Boom-chick: the bass string, then the chord, twice a bar, with the upstroke after each chick.
  boom: [[0, 'B'], [4, 'd'], [6, 'U'], [8, 'B'], [12, 'd'], [14, 'U']],
} as const;
type PatternName = keyof typeof PATTERNS;
/** Which patterns each style's strummer reaches for. */
const STYLE_PATTERNS: Partial<Record<string, readonly PatternName[]>> = {
  country: ['boom', 'boom', 'folk'], straya: ['boom', 'drive', 'folk'], spanish: ['drive', 'folk'],
  warm: ['sixteen', 'folk', 'calm'], lateNight: ['calm', 'sixteen'], rainy: ['calm', 'sixteen', 'folk'], sings: ['folk', 'sixteen', 'drive'],
};

/** A small seeded source from a tune's seed, for the choices a strummer keeps all tune. */
function tuneChoice(seed: number, salt: number, n: number): number {
  return (Math.imul((seed ^ salt) >>> 0, 0x9e3779b1) >>> 0) % n;
}

/** The hand's place on the neck, per tune: the last chord's mean fret. */
const HANDS = new WeakMap<object, number>();

/** The sweep across a chord (s), by how hard the stroke is (0 to 1): 26 to 46 ms, either way a quarter (the recordings' quartiles ran 10 to 60). */
function sweepOf(vel: number, rand: () => number): number {
  return (0.026 + 0.02 * (1 - Math.min(1, vel))) * (0.75 + rand() * 0.5);
}

/**
 * A bar of the strummed acoustic: `notes` as the composer wrote them, `shapeOf` the
 * fingering of a chord near a fret (lib/lofi-perform.ts's). Returns the bar with each
 * chord strummed across the shape's strings, each string ringing until it is struck again.
 */
export function strummer(notes: LofiNote[], bar: LofiBar, spb: number, rand: () => number, shapeOf: (tones: readonly number[], near: number) => Shape | null): LofiNote[] {
  const keys = notes.filter(n => n.voice === 'keys');
  const rest = notes.filter(n => n.voice !== 'keys');
  if (!keys.length || !bar.tones.length) return notes;
  const near = HANDS.get(bar.tune) ?? 2;
  const shape = shapeOf(bar.tones, near);
  if (!shape) return notes;
  const fretted = shape.flatMap((p, s) => (p === null || p === TUNING[s] ? [] : [p - TUNING[s]!]));
  if (fretted.length) HANDS.set(bar.tune, fretted.reduce((a, b) => a + b, 0) / fretted.length);
  const strings = shape.flatMap((p, s) => (p === null ? [] : [{ p, s }]));
  const vel = Math.max(...keys.map(n => n.vel));
  // The written strokes: notes starting together (or rolled within an eighth of a beat).
  const groups: LofiNote[][] = [];
  for (const n of [...keys].sort((a, b) => a.beat - b.beat)) {
    const last = groups[groups.length - 1];
    if (last && n.beat - last[0]!.beat < 0.125) last.push(n);
    else groups.push([n]);
  }
  // Where the offbeat eighth falls: the written notes' own swing, else the tune's.
  const offs = notes.map(n => n.beat - Math.floor(n.beat)).filter(f => f > 0.45 && f < 0.75);
  const and = Math.min(0.62, Math.max(0.5, offs.length ? offs.sort((a, b) => a - b)[Math.floor(offs.length / 2)]! : 0.5 + Math.max(0, bar.tune.swing - 0.5)));
  const swing16 = Math.min(0.64, Math.max(0.5, bar.tune.swing));
  const at = (step: number): number => Math.floor(step / 4) + (step % 4 === 2 ? and : step % 4 === 0 ? 0 : (step % 4) / 4 + (swing16 - 0.5) * 0.5);
  // A held chord (a beat or more) is strummed through in the tune's pattern; a written rhythm keeps its strokes.
  const held = groups.length <= 2 && groups.every(g => Math.max(...g.map(n => n.dur)) >= 1);
  const strokes: Array<{ beat: number; kind: 'D' | 'U' | 'B' | 'd' | 'ghost'; vel: number }> = [];
  if (held) {
    const names = STYLE_PATTERNS[bar.tune.mood] ?? ['folk', 'drive', 'calm'];
    const pattern = PATTERNS[names[tuneChoice(bar.tune.seed, 0x57a, names.length)]!];
    const until = Math.max(...keys.map(n => n.beat + n.dur));
    for (const [e, k] of pattern as ReadonlyArray<readonly [number, string]>) {
      const beat = at(e);
      if (beat >= until - 0.05) continue;
      // The beats lead; the offbeats and the upstrokes lighter (measured 1 to 3 dB).
      const accent = e % 4 === 0 ? (e % 8 === 0 ? 1 : 0.92) : e % 2 === 0 ? 0.82 : 0.72;
      strokes.push({ beat, kind: k as 'D' | 'U' | 'B' | 'd', vel: vel * accent * (k === 'U' ? 0.85 : 1) * (1 + (rand() - 0.5) * 0.1) });
    }
    // A ghost upstroke where the pattern leaves an offbeat empty: the hand passing through the top strings.
    for (let e = 2; e < 16; e += 4) if (!pattern.some(([x]) => x === e) && at(e) < until && rand() < 0.35) strokes.push({ beat: at(e), kind: 'ghost', vel: vel * 0.3 });
  } else {
    for (const g of groups) {
      const beat = g[0]!.beat;
      const frac = beat - Math.floor(beat);
      // A single written note is the boom: the bass string of the shape, whatever octave it was written in.
      const bass = g.length === 1;
      const offbeat = frac > 0.3 && frac < 0.8;
      const sixteenth = Math.abs(frac * 4 - Math.round(frac * 4)) < 0.1 && Math.round(frac * 4) % 2 === 1;
      const up = offbeat || sixteenth;
      const kind = bass ? 'B' : up ? 'U' : g.length <= 3 ? 'd' : 'D';
      strokes.push({ beat, kind, vel: Math.max(...g.map(n => n.vel)) * (up ? 0.85 : 1) });
    }
    // The hand keeps moving between the written strokes: an upstroke or a ghost on an empty offbeat after a chord.
    const until = Math.max(...keys.map(n => n.beat + n.dur));
    for (let b = 0; b < 4; b++) {
      const off = b + and;
      if (off >= until || strokes.some(x => Math.abs(x.beat - off) < 0.15)) continue;
      const before = strokes.filter(x => x.beat < off && x.beat > b - 0.05 && x.kind !== 'B');
      if (!before.length) continue;
      const r = rand();
      if (r < 0.45) strokes.push({ beat: off, kind: 'U', vel: vel * 0.7 });
      else if (r < 0.75) strokes.push({ beat: off, kind: 'ghost', vel: vel * 0.3 });
    }
  }
  strokes.sort((a, b) => a.beat - b.beat);
  // A percussive strummer chokes some backbeats into a chuck.
  const chucker = percussive(bar.tune.seed);
  const out: LofiNote[] = [...rest];
  // When each string is next struck, so each rings until then and is taken over.
  const played: Array<{ s: number; note: LofiNote }> = [];
  const bassString = strings[0]!;
  for (const st of strokes) {
    let set = strings;
    if (st.kind === 'B') {
      // The boom: the shape's lowest string, or now and then the next one up (an alternating bass).
      const alt = strings[1] && Math.round(st.beat) % 4 === 2 && rand() < 0.5 ? strings[1] : bassString;
      set = [alt];
    } else if (st.kind === 'd') set = strings.filter(x => x.s >= 2);
    else if (st.kind === 'U') set = strings.filter(x => x.s >= 2).slice(-(rand() < 0.5 ? 3 : 4)).reverse();
    else if (st.kind === 'ghost') set = strings.filter(x => x.s >= 4).slice(-(rand() < 0.5 ? 1 : 2)).reverse();
    if (!set.length) continue;
    const backbeat = Math.abs(st.beat - 1) < 0.05 || Math.abs(st.beat - 3) < 0.05;
    const chuck = chucker && backbeat && st.kind !== 'B' && st.kind !== 'ghost' && rand() < 0.4;
    // The hand sweeps at about the same speed whatever the strings: fewer strings, a little quicker.
    const across = st.kind === 'B' ? 0 : sweepOf(st.vel, rand) * (set.length >= 4 ? 1 : set.length === 3 ? 0.8 : 0.5);
    // Each string a little off the even spacing, never out of order.
    let lag = 0;
    set.forEach(({ p, s }, i) => {
      if (i > 0) lag += (across / (set.length - 1)) * (0.75 + rand() * 0.5);
      const note: LofiNote = {
        voice: 'keys', midi: p, beat: st.beat + lag / spb, dur: 0.25,
        vel: Math.max(0.04, st.vel * (1 - i * 0.035)),
        ...(chuck ? { mod: PLUCK_DEAD } : {}),
      };
      played.push({ s, note });
    });
  }
  // Each string rings until it is struck again (then the new stroke takes it over), or to the bar's end and a little past.
  played.sort((a, b) => a.note.beat - b.note.beat);
  for (const [i, x] of played.entries()) {
    if ((x.note.mod ?? 0) === PLUCK_DEAD) { out.push({ ...x.note, dur: 0.1 }); continue; }
    const next = played.slice(i + 1).find(y => y.s === x.s);
    const dur = next ? Math.max(0.05, next.note.beat - x.note.beat) : Math.max(0.25, 4.3 - x.note.beat);
    out.push({ ...x.note, dur, ...(next ? { mod: RESTRUCK } : {}) });
  }
  return out.sort((a, b) => a.beat - b.beat);
}

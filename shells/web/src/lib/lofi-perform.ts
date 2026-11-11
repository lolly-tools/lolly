// SPDX-License-Identifier: MPL-2.0
/**
 * The players between the composer and the instruments. The composer writes a bar the way
 * a score does: every hit on the grid, every chord a stack of notes starting together. A
 * band does not play like that, and the difference is most of what makes a sequenced part
 * sound sequenced. This module plays the bar the way people do, before the instruments
 * sound it:
 *
 * - The drummer sits in a pocket and is never quite on the grid: each hit comes a few
 *   milliseconds off, by how loose the instrument is played (a hat more than a kick), and
 *   each style has its feel (a snare laid back in hip hop and soul, hats pushed in punk).
 *   Strokes vary in strength, and a hat leans on the beat and lightens on the sixteenths
 *   in between. Drum machines are exact, so the machine styles stay tight.
 * - A guitarist fingers a chord on the fretboard (standard tuning, a hand spanning four
 *   frets, the open strings a folk player lets ring, the nearest shape to the last chord)
 *   and strums it: a downstroke from the low strings on the beat and the eighths, an
 *   upstroke across the treble strings on the sixteenths between, faster when it is harder.
 * - A lead guitarist bends some long notes up into pitch, slides into some from the note
 *   before, and plays the rest as they are written.
 *
 * Pure and deterministic: every choice comes from a source seeded by the tune and the bar,
 * so a tune plays the same every time. Times are moved in beats, so the caller's tempo holds.
 */
import type { LofiBar, LofiMood, LofiNote, LofiStyle } from '../../../../engine/src/lofi-compose.ts';

/** A seeded source for one bar of one tune. */
function barRandom(bar: LofiBar): () => number {
  let h = (bar.tune.seed ^ Math.imul(bar.index + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  let a = (h ^ (h >>> 16)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A normally distributed draw (mean 0, deviation 1), cut at 2.5. */
function gauss(rand: () => number): number {
  const v = Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
  return Math.max(-2.5, Math.min(2.5, v));
}

// ── the drummer ─────────────────────────────────────────────────────────────

/** How far each drum strays from the grid (ms, one deviation), the way people play: the kick and snare tight, hats and hand percussion looser. */
const LOOSE: Partial<Record<LofiNote['voice'], number>> = { kick: 3, snare: 4, rim: 5, hat: 6, openHat: 6, crash: 5, tom: 5, perc: 8 };
/** How much each stroke's strength varies (one deviation, as a fraction). */
const STRENGTH = 0.07;
/** The styles played by machines, where the grid is the feel: they stay tight (a fifth of the looseness). */
const MACHINE = new Set<LofiMood>(['acid', 'electro', 'dubstep', 'brostep', 'dnb', 'chiptune', 'sherbert', 'synthwave', 'nudisco', 'kpop', 'sugar', 'amapiano']);
/** Each style's pocket (ms): where its snare and its hats sit against the grid. */
const POCKET: Partial<Record<LofiMood, { snare?: number; hat?: number }>> = {
  hiphop: { snare: 14, hat: 4 }, rnb: { snare: 10 }, soul: { snare: 8 }, triphop: { snare: 12 },
  warm: { snare: 12, hat: 5 }, lateNight: { snare: 14, hat: 6 }, rainy: { snare: 12, hat: 5 }, sings: { snare: 8 },
  jazz: { hat: -3 }, swing: { hat: -3 }, punk: { hat: -4 }, metal: { hat: -2 }, rock: { hat: -2 }, grunge: { snare: 6 }, stoner: { snare: 10 },
};

/** The drums of a bar, played: moved off the grid by the instrument's looseness and the style's pocket, each stroke a little different. */
function drummer(notes: LofiNote[], bar: LofiBar, spb: number, rand: () => number): void {
  const mood = bar.tune.mood;
  const tight = MACHINE.has(mood) ? 0.2 : 1;
  const pocket = POCKET[mood] ?? {};
  for (const [i, n] of notes.entries()) {
    const loose = LOOSE[n.voice];
    if (loose === undefined) continue;
    let ms = gauss(rand) * loose * tight;
    if (n.voice === 'snare' || n.voice === 'rim') ms += pocket.snare ?? 0;
    if (n.voice === 'hat' || n.voice === 'openHat') ms += pocket.hat ?? 0;
    // A hat leans on the beat and lightens on the sixteenths between the eighths.
    const sixteenth = Math.round(n.beat * 4) % 2 === 1;
    const onBeat = Math.abs(n.beat - Math.round(n.beat)) < 0.02;
    const lean = n.voice === 'hat' ? (onBeat ? 1.05 : sixteenth ? 0.86 : 0.97) : 1;
    const vel = n.vel * lean * (1 + gauss(rand) * STRENGTH * tight);
    notes[i] = { ...n, beat: n.beat + ms / 1000 / spb, vel: Math.max(0.02, Math.min(1, vel)) };
  }
}

// ── the rhythm guitarist ────────────────────────────────────────────────────────

/** The guitars that strum their chords, and those whose player lets the open strings ring. */
export const STRUMMED = new Set<string>(['steel', 'jazzbox', 'clean', 'wall']);
const OPEN_STRINGS = new Set<string>(['steel', 'wall']);
/** Standard tuning, low E to high E. */
const TUNING = [40, 45, 50, 55, 59, 64] as const;

/** A chord fingered on the fretboard: the sounding pitch on each string, low to high, or null for a string not played. */
type Shape = Array<number | null>;

/**
 * The shape a guitarist reaches for: every chord tone sounding (the fifth may go), the root
 * on the lowest string played, at least four strings and no gap between them but one, the
 * hand spanning four frets at most (an open string costs nothing), and of those the one
 * nearest the last chord's position. A jazz guitarist keeps off the open strings and the
 * top one.
 */
export function fingerChord(tones: readonly number[], voice: string, near: number): Shape | null {
  const root = tones[0];
  if (root === undefined) return null;
  const wanted = new Set(tones);
  const fifth = (root + 7) % 12;
  const open = OPEN_STRINGS.has(voice);
  const jazz = voice === 'jazzbox';
  let best: Shape | null = null;
  let bestScore = Infinity;
  for (let low = 0; low <= 9; low++) {
    // Each string's choices in this window: muted, open, or a fret from low to low+3 that sounds a chord tone.
    const choices = TUNING.map((open0, s) => {
      const opts: Array<number | null> = [null];
      if (open && !jazz && wanted.has(open0 % 12) && low <= 3) opts.push(open0);
      for (let f = Math.max(1, low); f <= low + 3; f++) if (wanted.has((open0 + f) % 12)) opts.push(open0 + f);
      if (jazz && s === 5) return [null];
      return opts;
    });
    const shape: Shape = new Array(6).fill(null);
    const walk = (s: number): void => {
      if (s === 6) {
        const played = shape.flatMap((p, i) => (p === null ? [] : [i]));
        if (played.length < (jazz ? 3 : 4)) return;
        const first = played[0]!, last = played[played.length - 1]!;
        if (last - first + 1 - played.length > 1) return;   // no more than one muted string between
        if ((shape[first]! % 12) !== root) return;           // the root at the bottom
        const pcs = new Set(played.map(i => shape[i]! % 12));
        for (const t of wanted) if (t !== fifth && !pcs.has(t)) return;
        const fretted = played.map(i => shape[i]! - TUNING[i]!).filter(f => f > 0);
        const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
        if (span > 3) return;
        const where = fretted.length ? fretted.reduce((a, b) => a + b, 0) / fretted.length : 0;
        // Near the last chord, more strings, a low root (the sixth or fifth string), open strings for a folk player.
        const score = Math.abs(where - near) * 1.5 - played.length * 0.8 + first * 0.6 - (open ? (played.length - fretted.length) * 0.4 : 0);
        if (score < bestScore) { bestScore = score; best = [...shape]; }
        return;
      }
      for (const c of choices[s]!) { shape[s] = c; walk(s + 1); }
      shape[s] = null;
    };
    walk(0);
  }
  return best;
}

const SHAPES = new Map<string, Shape | null>();
/** The fingered shape, remembered per chord, voice and hand position. */
function shapeFor(tones: readonly number[], voice: string, near: number): Shape | null {
  const key = `${tones.join(',')}|${voice}|${Math.round(near)}`;
  if (!SHAPES.has(key)) {
    if (SHAPES.size > 400) SHAPES.clear();
    SHAPES.set(key, fingerChord(tones, voice, near));
  }
  return SHAPES.get(key)!;
}

/** How far apart (beats) a stroke's notes may start and still be one stroke. */
const STROKE = 0.125;
/** Where a strumming hand rests, per tune: the last chord's mean fret. */
const HANDS = new WeakMap<object, number>();

/**
 * The keys of a bar on a strummed guitar: each chord (two or more notes starting together,
 * or rolled) fingered on the fretboard and strummed across every string the shape uses. On the beat and the eighths a
 * downstroke rakes up from the low strings; on the sixteenths between, an upstroke takes
 * only the four treble strings, from the top. A harder strum is faster, and the first
 * strings of a stroke ring louder than the last. A single note (a bass note in a
 * boom-chick) is played as written.
 */
function guitarist(notes: LofiNote[], bar: LofiBar, voice: string, spb: number, rand: () => number): LofiNote[] {
  const out: LofiNote[] = [];
  // A stroke: keys notes starting together, or rolled within an eighth of a beat of the
  // first (the composer writes a folk strum as a roll, evenly spaced).
  const strokes: LofiNote[][] = [];
  for (const n of [...notes].sort((x, y) => x.beat - y.beat)) {
    if (n.voice !== 'keys') { out.push(n); continue; }
    const last = strokes[strokes.length - 1];
    if (last && n.beat - last[0]!.beat < STROKE) last.push(n);
    else strokes.push([n]);
  }
  for (const group of strokes) {
    if (group.length < 2 || !bar.tones.length) { out.push(...group); continue; }
    const near = HANDS.get(bar.tune) ?? (voice === 'jazzbox' ? 5 : 2);
    const shape = shapeFor(bar.tones, voice, near);
    if (!shape) { out.push(...group); continue; }
    const fretted = shape.flatMap((p, s) => (p === null || p === TUNING[s] ? [] : [p - TUNING[s]!]));
    if (fretted.length) HANDS.set(bar.tune, fretted.reduce((a, b) => a + b, 0) / fretted.length);
    const beat = group[0]!.beat;
    const dur = Math.max(...group.map(n => n.dur));
    const vel = Math.max(...group.map(n => n.vel));
    // A roll written high to low is an upstroke; stacked notes take the stroke the beat asks for.
    const written = group.length > 1 && group[group.length - 1]!.beat > group[0]!.beat;
    const up = written ? group[group.length - 1]!.midi < group[0]!.midi : Math.round(beat * 4) % 2 === 1;
    // The stroke keeps to the register written: a boom-chick's chick takes the treble strings
    // (its bass note is the boom), a full strum every string; an upstroke never the two lowest.
    const floor = Math.min(...group.map(n => n.midi)) - 5;
    let strings = shape.flatMap((p, s) => (p === null ? [] : [{ p, s }]));
    const high = strings.filter(x => x.p >= floor);
    strings = high.length >= 3 ? high : strings.slice(-3);
    const stroke = up ? strings.filter(x => x.s >= 2).reverse() : strings;
    // A full strum takes 12 to 30 ms, faster the harder, a jazz comp the quickest.
    const across = (voice === 'jazzbox' ? 0.012 : 0.03 - vel * 0.016) * (0.85 + rand() * 0.3);
    stroke.forEach(({ p }, i) => {
      const lag = (across * i) / Math.max(1, stroke.length - 1);
      out.push({ voice: 'keys', midi: p, beat: beat + lag / spb, dur, vel: Math.max(0.05, vel * (up ? 0.82 : 1) * (1 - i * 0.035)) });
    });
  }
  return out.sort((a, b) => a.beat - b.beat);
}

// ── the lead guitarist ─────────────────────────────────────────────────────────

/** The lead guitars, which bend and slide. */
export const GUITAR_LEADS = new Set<string>(['guitar', 'overdrive', 'riff', 'metal', 'twang']);
/** A lead guitar note's articulation, carried in `mod`: plain, bent up into pitch, or slid into from the last note. */
export const LEAD_PLAIN = 0, LEAD_BEND = 1, LEAD_SLIDE = 2;

/**
 * A lead guitarist's choices: a long note on a strong beat is often bent up a tone (or a
 * semitone) into pitch; a note a few semitones from the one before, played straight
 * after it, is sometimes slid into; the rest are picked as written.
 */
function leadGuitarist(notes: LofiNote[], rand: () => number): void {
  let last: LofiNote | undefined;
  for (const [i, n] of notes.entries()) {
    if (n.voice !== 'lead') continue;
    const strong = Math.abs(n.beat - Math.round(n.beat)) < 0.02;
    const near = last && Math.abs(n.midi - last.midi) <= 4 && n.midi !== last.midi && n.beat - (last.beat + last.dur) < 0.15;
    const art = n.dur >= 0.75 && strong && rand() < 0.45 ? LEAD_BEND : near && rand() < 0.3 ? LEAD_SLIDE : LEAD_PLAIN;
    if (art !== LEAD_PLAIN && !n.mod) notes[i] = { ...n, mod: art };
    last = n;
  }
}

/**
 * A bar as the band plays it: the drums in the style's pocket, a strummed guitar's chords
 * fingered and strummed, a lead guitar's bends and slides. `keys` and `lead` are the
 * instruments playing the bar's keys and lead.
 */
export function perform(bar: LofiBar, spb: number, keys: LofiStyle['keys'], lead: LofiStyle['lead']): LofiNote[] {
  const rand = barRandom(bar);
  let notes = [...bar.notes];
  drummer(notes, bar, spb, rand);
  if (STRUMMED.has(keys)) notes = guitarist(notes, bar, keys, spb, rand);
  if (GUITAR_LEADS.has(lead)) leadGuitarist(notes, rand);
  return notes;
}

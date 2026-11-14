// SPDX-License-Identifier: MPL-2.0
/**
 * The players between the composer and the instruments. The composer writes a bar the way
 * a score does: every hit on the grid, every chord a stack of notes starting together. A
 * band does not play like that, and the difference is most of what makes a sequenced part
 * sound sequenced. This module plays the bar the way people do, before the instruments
 * sound it:
 *
 * - The drummer chooses the stroke: the ride's bell through some rock and ska choruses, a
 *   press roll for a jazz drummer's bomb at the end of a phrase.
 * - The drummer sits in a pocket and is never quite on the grid: each hit comes a few
 *   milliseconds off, by how loose the instrument is played (a hat more than a kick), and
 *   each style has its feel (a snare laid back in hip hop and soul, hats pushed in punk).
 *   Strokes vary in strength, and a hat leans on the beat and lightens on the sixteenths
 *   in between. Drum machines are exact, so the machine styles stay tight.
 * - A guitarist fingers a chord on the fretboard (standard tuning, a hand spanning four
 *   frets, the open strings a folk player lets ring, the nearest shape to the last chord)
 *   and strums it: a downstroke from the low strings on the beat and the eighths, an
 *   upstroke across the treble strings on the sixteenths between, faster when it is harder.
 * - A lead guitarist finds a place on the neck for each bar, bends some long notes up into
 *   pitch, slides into some from the note before, and plays the rest as they are written,
 *   each note on the fret the hand reaches it at.
 * - A producer chops the vocal (lib/lofi-chop.ts): each note's slice, its scoops, slides,
 *   flips, falls, gates and stutters, and the odd reversed swell into a phrase.
 * - A harpist, an acoustic guitarist or a tar player takes the lead (lib/lofi-lead-art.ts):
 *   a harp's run up into a phrase, a guitar's slides and hammer-ons, the tar's tremolo.
 * - A flautist tongues each note that is not slurred, softly ("du") when it follows close
 *   on the one before (stopping that one with the tongue), double-tongues a quick run
 *   ("tu-ku"), ghosts some quick passing notes,
 *   swells or tapers a held note, and takes a breath in a rest (lib/lofi-flutes.ts plays
 *   the flute).
 *
 * Pure and deterministic: every choice comes from a source seeded by the tune and the bar,
 * so a tune plays the same every time. Times are moved in beats, so the caller's tempo holds.
 */
import { ELECTRIC_CHOKE, ELECTRIC_DEAD, ELECTRIC_FRET, ELECTRIC_PICK, ELECTRIC_UP } from '../../../../engine/src/lofi-compose.ts';
import type { LofiBar, LofiMood, LofiNote, LofiStyle } from '../../../../engine/src/lofi-compose.ts';
import { chopper } from './lofi-chop.ts';
import { PLUCKED_LEADS, pluckedLead } from './lofi-lead-art.ts';
import { FLUTE_BREATH, FLUTE_DEEP, FLUTE_GHOST, FLUTE_KU, FLUTE_PLAYED, FLUTE_SCOOP, FLUTE_SOFT, FLUTE_STOP, FLUTE_SWELL, FLUTE_TAPER } from './lofi-flutes.ts';

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
  // Lofi house is a sampler played by hand and left unquantised: a lazy clap and hats a little late.
  lofiHouse: { snare: 8, hat: 5 },
};

/** A hat note's `mod` that plays the ride's bell instead (1 is a light hat, 2 the hat's foot). */
export const HAT_BELL = 3;
/** The styles whose drummer may ride the bell through a chorus: the rock family on the beat, ska on the offbeat with the skank. */
const BELL_CHORUS = new Set<LofiMood>(['rock', 'punk', 'metal', 'grunge', 'stoner', 'ska']);
/** The jazz drummer's press roll into the turn of a phrase: how long it is held (beats). */
const PRESS_ROLL = 0.5;

/** Whether a tune's drummer rides the bell in its choruses: about half of them, drawn from the tune's seed alone. */
function ridesBell(seed: number): boolean {
  return ((Math.imul(seed ^ 0x6e11, 0x9e3779b1) >>> 0) % 100) < 50;
}

/**
 * The drummer's choice of stroke, before the timing. In the rock family's choruses about half
 * the drummers move the right hand to the ride's bell on the beat (the stick cannot be on
 * the hats too, so the eighths between drop out), and in ska's the skank's offbeat chick
 * goes to the bell, the downbeats dropped. In jazz and swing, the snare's bomb that ends a
 * chorus phrase is a press roll held into the next bar (a `dur`).
 */
function strokes(notes: LofiNote[], bar: LofiBar): LofiNote[] {
  const mood = bar.tune.mood;
  if (bar.section !== 'drop') return notes;
  if (BELL_CHORUS.has(mood) && ridesBell(bar.tune.seed)) {
    const ska = mood === 'ska';
    return notes.flatMap((n) => {
      if (n.voice !== 'hat' || n.mod) return [n];
      const onBeat = Math.abs(n.beat - Math.round(n.beat)) < 0.02;
      return onBeat !== ska ? [{ ...n, mod: HAT_BELL, vel: Math.max(n.vel, 0.5) }] : [];
    });
  }
  if (mood === 'jazz' || mood === 'swing') return notes.map(n => (n.voice === 'snare' && n.vel >= 0.7 && n.beat > 3.25 ? { ...n, dur: PRESS_ROLL } : n));
  return notes;
}

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
export const STRUMMED = new Set<string>(['steel', 'jazzbox', 'clean', 'wall', 'electric']);
const OPEN_STRINGS = new Set<string>(['steel', 'wall']);
/** Standard tuning, low E to high E. */
export const TUNING = [40, 45, 50, 55, 59, 64] as const;

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
  const electric = voice === 'electric';
  for (const group of strokes) {
    const marks = electric ? (group[0]!.mod ?? 0) % ELECTRIC_FRET : 0;
    if (marks & ELECTRIC_PICK && bar.tones.length) {
      const near = HANDS.get(bar.tune) ?? 5;
      const shape = shapeFor(bar.tones, voice, near);
      if (shape) { out.push(...picked(shape, group, bar, spb, rand)); continue; }
    }
    // A double-stop or an octave is played as written, the two strings a breath apart.
    if (electric && group.length === 2 && !(marks & ELECTRIC_PICK)) {
      const near = HANDS.get(bar.tune) ?? 5;
      group.forEach((n, i) => { out.push({ ...n, beat: n.beat + (i * (0.002 + rand() * 0.002)) / spb, mod: marks + ELECTRIC_FRET * fretFor(n.midi, near) }); });
      continue;
    }
    if (group.length < 2 || !bar.tones.length) {
      for (const n of group) out.push(electric ? { ...n, mod: (n.mod ?? 0) % ELECTRIC_FRET + ELECTRIC_FRET * fretFor(n.midi, HANDS.get(bar.tune) ?? 5) } : n);
      continue;
    }
    const near = HANDS.get(bar.tune) ?? (voice === 'jazzbox' || electric ? 5 : 2);
    const shape = shapeFor(bar.tones, voice, near);
    if (!shape) { out.push(...group); continue; }
    const fretted = shape.flatMap((p, s) => (p === null || p === TUNING[s] ? [] : [p - TUNING[s]!]));
    if (fretted.length) HANDS.set(bar.tune, fretted.reduce((a, b) => a + b, 0) / fretted.length);
    const beat = group[0]!.beat;
    const dur = Math.max(...group.map(n => n.dur));
    const vel = Math.max(...group.map(n => n.vel));
    // A roll written high to low is an upstroke; stacked notes take the stroke the beat asks for.
    const written = group.length > 1 && group[group.length - 1]!.beat > group[0]!.beat;
    const flags = electric ? (group[0]!.mod ?? 0) % ELECTRIC_FRET : 0;
    const up = flags & ELECTRIC_UP ? true : written ? group[group.length - 1]!.midi < group[0]!.midi : Math.round(beat * 4) % 2 === 1;
    // The stroke keeps to the register written: a boom-chick's chick takes the treble strings
    // (its bass note is the boom), a full strum every string; an upstroke never the two lowest.
    const floor = Math.min(...group.map(n => n.midi)) - 5;
    let strings = shape.flatMap((p, s) => (p === null ? [] : [{ p, s }]));
    const high = strings.filter(x => x.p >= floor);
    strings = high.length >= 3 ? high : strings.slice(-3);
    const stroke = up ? strings.filter(x => x.s >= 2).reverse() : strings;
    // A full strum takes 12 to 30 ms, faster the harder, a jazz comp the quickest; an
    // electric's skank 3 to 5 ms a string and a scratch 2 to 3 (electricStroke).
    const perString = electric ? electricStroke(flags, rand) : 0;
    const across = perString ? perString * (stroke.length - 1) : (voice === 'jazzbox' ? 0.012 : 0.03 - vel * 0.016) * (0.85 + rand() * 0.3);
    stroke.forEach(({ p, s }, i) => {
      const lag = (across * i) / Math.max(1, stroke.length - 1);
      const mod = electric ? flags + ELECTRIC_FRET * (p - TUNING[s]!) : undefined;
      out.push({ voice: 'keys', midi: p, beat: beat + lag / spb, dur, vel: Math.max(0.05, vel * (up && !electric ? 0.82 : 1) * (1 - i * 0.035)), ...(mod === undefined ? {} : { mod }) });
    });
  }
  return out.sort((a, b) => a.beat - b.beat);
}

/**
 * How a held chord is picked, string by string, on each sixteenth of the bar: B the bass
 * (the lowest string of the shape), A the next string up (an alternating bass), and 1, 2,
 * 3 the top three strings, highest first; '.' rests. A tune keeps one pattern, as a
 * player keeps a part, and plays it over every held chord.
 */
const PICKING: readonly string[] = [
  'B.3.2.1.A.3.2.1.',   // up the treble strings from the bass, twice: the plainest
  'B.31.2.A.21.3.2.',   // sixteenths in it: a city pop shimmer
  'B.1.A.2.B.1.A.2.',   // an alternating bass under the top strings, as a fingerpicker plays
  'B..2.1..A..2.31.',   // syncopated, leaving room
];

/**
 * A held chord picked on its fingered shape: each string sounds when its turn comes and
 * rings until it is picked again or the chord ends (a string sounds one note at a time).
 * The bass a little stronger than the treble, and each pick a few milliseconds either
 * side of the grid.
 */
function picked(shape: Shape, group: LofiNote[], bar: LofiBar, spb: number, rand: () => number): LofiNote[] {
  const played = shape.flatMap((p, s) => (p === null ? [] : [{ p, s }]));
  const fretted = played.filter(x => x.p !== TUNING[x.s]).map(x => x.p - TUNING[x.s]!);
  if (fretted.length) HANDS.set(bar.tune, fretted.reduce((a, b) => a + b, 0) / fretted.length);
  const start = group[0]!.beat, length = Math.max(...group.map(n => n.dur));
  const vel = Math.max(...group.map(n => n.vel));
  const pattern = PICKING[(bar.tune.seed >>> 0) % PICKING.length]!;
  const role = (c: string): { p: number; s: number } | undefined => {
    if (c === 'B') return played[0];
    if (c === 'A') return played[1];
    const k = Number(c);
    return k >= 1 && k <= 3 ? played[Math.max(0, played.length - k)] : undefined;
  };
  const picks: Array<{ at: number; p: number; s: number; bass: boolean }> = [];
  for (let i = 0; i < 16; i++) {
    const at = i / 4;
    if (at >= length - 0.05) break;
    const string = role(pattern[i]!);
    if (string) picks.push({ at, ...string, bass: pattern[i] === 'B' || pattern[i] === 'A' });
  }
  return picks.map((k, i) => {
    const next = picks.slice(i + 1).find(o => o.s === k.s);
    const until = next ? next.at : length;
    return {
      voice: 'keys', midi: k.p, beat: start + k.at + ((rand() - 0.5) * 0.012) / spb,
      dur: Math.max(0.1, until - k.at), vel: Math.max(0.05, vel * (k.bass ? 1.04 : 0.9) * (0.94 + rand() * 0.12)),
      mod: ELECTRIC_FRET * (k.p - TUNING[k.s]!),
    };
  });
}

/**
 * Seconds a string between an electric stroke's strings: a skank's upstroke is a flick of
 * the wrist, 3 to 5 ms a string; a scratch's rake over muted strings 2 to 3; a chord let
 * ring, 5 to 8.
 */
export function electricStroke(flags: number, rand: () => number): number {
  if (flags & ELECTRIC_DEAD) return 0.002 + rand() * 0.001;
  if (flags & (ELECTRIC_UP | ELECTRIC_CHOKE)) return 0.003 + rand() * 0.002;
  return 0.005 + rand() * 0.003;
}

/** The fret a single note is played at: on the string that puts it nearest the hand's place on the neck. */
export function fretFor(midi: number, near: number): number {
  let best = Math.max(0, midi - TUNING[5]), score = Infinity;
  for (const open of TUNING) {
    const fret = midi - open;
    if (fret < 0 || fret > 20) continue;
    const d = Math.abs(fret - near);
    if (d < score) { score = d; best = fret; }
  }
  return best;
}

// ── the lead guitarist ─────────────────────────────────────────────────────────

/** The lead guitars, which bend and slide. */
export const GUITAR_LEADS = new Set<string>(['guitar', 'overdrive', 'riff', 'metal', 'twang']);
/** The lead guitars that sound an octave below the written line. */
const LOW_LEADS = new Set<string>(['riff', 'twang']);
/** A lead guitar note's articulation, carried in `mod`: plain, bent up into pitch, or slid into from the last note. The performer adds the fret, times ELECTRIC_FRET. */
export const LEAD_PLAIN = 0, LEAD_BEND = 1, LEAD_SLIDE = 2;

/**
 * Where a lead guitarist's hand sits for a bar: the position (the fret under the first
 * finger, the hand covering it and the three above) that reaches the bar's notes with the
 * fewest stretches, a lead player's home between the fifth and the twelfth frets preferred.
 */
export function leadPosition(pitches: readonly number[]): number {
  let best = 7, bestCost = Infinity;
  for (let pos = 1; pos <= 15; pos++) {
    let cost = Math.abs(pos - 7) * 0.15;
    for (const p of pitches) {
      let reach = Infinity;
      for (const open of TUNING) {
        const f = Math.round(p) - open;
        if (f < 0 || f > 20) continue;
        reach = Math.min(reach, f === 0 ? 0.5 : f < pos ? pos - f : f > pos + 3 ? f - pos - 3 : 0);
      }
      cost += reach;
    }
    if (cost < bestCost) { bestCost = cost; best = pos; }
  }
  return best;
}

/**
 * A lead guitarist's choices: a long note on a strong beat is often bent up a tone (or a
 * semitone) into pitch; a note a few semitones from the one before, played straight
 * after it, is sometimes slid into; the rest are picked as written. Each note is fingered
 * at the hand's place for the bar, on the string that keeps the note nearest.
 */
function leadGuitarist(notes: LofiNote[], lead: string, rand: () => number): void {
  const shift = LOW_LEADS.has(lead) ? -12 : 0;
  const pos = leadPosition(notes.filter(n => n.voice === 'lead').map(n => n.midi + shift));
  let last: LofiNote | undefined;
  for (const [i, n] of notes.entries()) {
    if (n.voice !== 'lead') continue;
    const strong = Math.abs(n.beat - Math.round(n.beat)) < 0.02;
    const near = last && Math.abs(n.midi - last.midi) <= 4 && n.midi !== last.midi && n.beat - (last.beat + last.dur) < 0.15;
    const art = n.dur >= 0.75 && strong && rand() < 0.45 ? LEAD_BEND : near && rand() < 0.3 ? LEAD_SLIDE : LEAD_PLAIN;
    const fret = fretFor(Math.round(n.midi + shift), pos + 1.5);
    notes[i] = { ...n, mod: (n.mod ? n.mod % ELECTRIC_FRET : art) + ELECTRIC_FRET * fret };
    last = n;
  }
}

/** Seconds of rest under which a following note is half-tongued, a "du", most of the time (the station slurs anything under 35 ms). */
const FLUTE_CLOSE = 0.15;
/** A rest long enough for a breath, and for a deep one (s). */
const FLUTE_BREATH_REST = 0.4;
const FLUTE_DEEP_REST = 0.75;
/** A held note the player shapes (s), and a quick one that may be ghosted (s). */
const FLUTE_HELD = 0.6;
const FLUTE_QUICK = 0.16;
/** A run quick enough to double-tongue: notes this short (s) following close on each other. */
const FLUTE_RUN = 0.2;

/**
 * A flautist's choices, measured against recorded players: a note that follows close on
 * the one before without a slur is half-tongued (recorded legato phrases dip 7 to 12 dB
 * between such notes, a full tongue 12 to 30); a quick, light note off the beat is
 * sometimes ghosted; a held note is swelled, tapered or both (recorded long notes move -5
 * to +8 dB a second); and a rest long enough gets a breath, a deep one in a longer rest
 * (recorded phrases sit 0.6 to 2.6 s apart with the breath heard between them).
 */
export function flautist(notes: LofiNote[], spb: number, rand: () => number): void {
  const lines = notes.map((n, i) => ({ n, i })).filter(({ n }) => n.voice === 'lead').sort((a, b) => a.n.beat - b.n.beat);
  if (!lines.length) return;
  const mean = lines.reduce((a, { n }) => a + n.vel, 0) / lines.length;
  // In a quick tongued run the tongue alternates front and back, "tu-ku": every other note a "ku".
  let ku = false;
  for (let k = 0; k < lines.length; k++) {
    const { n, i } = lines[k]!;
    const prev = lines[k - 1]?.n, next = lines[k + 1]?.n;
    const before = prev ? (n.beat - (prev.beat + prev.dur)) * spb : Infinity;
    const after = ((next ? next.beat : 4) - (n.beat + n.dur)) * spb;
    let flags = FLUTE_PLAYED | (n.mod === 1 ? FLUTE_SCOOP : 0);
    if (before >= 0.035 && before < FLUTE_CLOSE && rand() < 0.7) flags |= FLUTE_SOFT;
    const strong = Math.abs(n.beat - Math.round(n.beat)) < 0.02;
    if (n.dur * spb <= FLUTE_QUICK && !strong && n.vel < mean && rand() < 0.4) flags |= FLUTE_GHOST;
    if (n.dur * spb >= FLUTE_HELD) {
      const r = rand();
      flags |= r < 0.3 ? FLUTE_SWELL : r < 0.6 ? FLUTE_TAPER : r < 0.75 ? FLUTE_SWELL | FLUTE_TAPER : 0;
    }
    if (after >= FLUTE_BREATH_REST && rand() < 0.75) flags |= FLUTE_BREATH | (after >= FLUTE_DEEP_REST ? FLUTE_DEEP : 0);
    // A note followed close by a tongued one is stopped by the tongue, not let go.
    if (next && after >= 0.035 && after < FLUTE_CLOSE) flags |= FLUTE_STOP;
    const inRun = before >= 0.035 && before < FLUTE_CLOSE && n.dur * spb <= FLUTE_RUN;
    ku = inRun && !ku;
    if (ku) flags |= FLUTE_KU;
    notes[i] = { ...n, mod: flags };
  }
}

/**
 * A bar as the band plays it: the drums in the style's pocket, a strummed guitar's chords
 * fingered and strummed, a lead guitar's bends and slides. `keys` and `lead` are the
 * instruments playing the bar's keys and lead.
 */
export function perform(bar: LofiBar, spb: number, keys: LofiStyle['keys'], lead: LofiStyle['lead']): LofiNote[] {
  const rand = barRandom(bar);
  let notes = strokes([...bar.notes], bar);
  drummer(notes, bar, spb, rand);
  if (STRUMMED.has(keys)) notes = guitarist(notes, bar, keys, spb, rand);
  if (GUITAR_LEADS.has(lead)) leadGuitarist(notes, lead, rand);
  if (lead === 'chop') notes = chopper(notes, bar, spb, rand);
  else if (PLUCKED_LEADS.has(lead)) notes = pluckedLead(notes, bar, lead, spb, rand);
  else if (lead === 'flute') flautist(notes, spb, rand);
  return notes;
}

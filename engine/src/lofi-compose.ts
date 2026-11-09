// SPDX-License-Identifier: MPL-2.0
/**
 * Lofi composition: the seeded, endless stream of bars behind the Neurospicy player's
 * Lofi station. Pure and deterministic (no Web Audio, no DOM, no Date, no Math.random;
 * the PRNG is seeded), so one seed gives the same music in the live player, in an
 * offline render for a video music bed, and in any shell that can play notes.
 *
 * It writes NOTES, not sound: each bar is a list of { voice, beat, dur, midi, vel }
 * events for the shell's instruments (shells/web/src/lib/lofi-voices.ts) to play, and
 * each tune carries a STYLE that tells the shell which instruments, drum tuning and
 * signal-chain colour to use. Swing, laid-back timing and velocity variation are already
 * in the beats and velocities here, so a render never needs its own randomness.
 *
 * What makes one tune sound unlike the last is mostly not its key. So each seed picks a
 * whole style: the keys (a Rhodes, a felt piano, a Wurlitzer, a soft pluck), the lead
 * (vibes, flute, a soft brass-like line, kalimba, or none), the bass, the drum kit and
 * its tuning, the groove (boom-bap, half-time, shuffle, lazy, sparse), how often the
 * chords change, how busy the keys are, and how much tape wobble and room it gets. The
 * mood leans those choices without fixing them. Each tune also builds its own running
 * order (see arrange): how it opens, which instrument takes the front when, and how it
 * ends, so a tune can start on the hats alone or the whole kit as well as the keys.
 *
 * The harmony is the jazz-derived vocabulary lofi leans on: major and minor ninths,
 * dominant thirteenths and altered dominants, voiced without the root (the bass has
 * it) and voice-led so each chord moves as little as possible from the last, with the
 * occasional substitution so a progression is not always played the same way.
 * Melodies are a two-bar motif and its answer, drawn from the key's pentatonic scale
 * and pulled onto a chord tone on the strong beats, so the lead never fights the keys.
 * No voices: nothing here sings or speaks.
 *
 * The dance genres of the Lolly Sings family (sugar, dubstep, brostep and drum and bass)
 * are written by their own path, composeDanceTune, so adding them changed no Lofi or
 * Lolly Sings tune. They share the harmony and melody helpers but have their own
 * running order (intro, build, drop, breakdown, a second build and drop, outro), their
 * own grooves, and bass lines with movement: a wobble whose filter swings at a rate set
 * per note, a growl, a reese, a slap bass with popped octaves.
 */
import { mulberry32 } from './zzfx-compose.ts';

/** The dance genres in the Lolly Sings family, written by composeDanceTune. */
export type DanceMood = 'sugar' | 'funk' | 'soul' | 'hiphop' | 'reggae' | 'spanish' | 'rock' | 'synthwave' | 'acid' | 'electro' | 'dubstep' | 'brostep' | 'dnb';
/** The three Lofi moods, Lolly Sings (the melody-first genre, see LEAN.sings) and its dance genres. */
export type LofiMood = 'warm' | 'lateNight' | 'rainy' | 'sings' | DanceMood;
export const LOFI_MOODS: readonly LofiMood[] = ['warm', 'lateNight', 'rainy', 'sings', 'sugar', 'funk', 'soul', 'hiphop', 'reggae', 'spanish', 'rock', 'synthwave', 'acid', 'electro', 'dubstep', 'brostep', 'dnb'];
export const DANCE_MOODS: readonly DanceMood[] = ['sugar', 'funk', 'soul', 'hiphop', 'reggae', 'spanish', 'rock', 'synthwave', 'acid', 'electro', 'dubstep', 'brostep', 'dnb'];
/** Whether `mood` is one of the dance genres. */
export function isDanceMood(mood: LofiMood): mood is DanceMood { return (DANCE_MOODS as readonly string[]).includes(mood); }

/** `riser` (a build's noise sweep), `crash` (a cymbal and a low boom on a drop), `coin`
 *  (a bright two-note ding) and `magpie` (a magpie's warble, Lolly's bird, for sugar) are
 *  effects, written by the dance genres only. A magpie's `mod` seeds its song. `hey` is a
 *  synthesised shout (no recording, no words), for sugar and reggae. */
export type LofiVoice = 'keys' | 'bass' | 'lead' | 'kick' | 'snare' | 'rim' | 'hat' | 'openHat' | 'crash' | 'riser' | 'coin' | 'magpie' | 'hey';
export const LOFI_DRUM_VOICES: readonly LofiVoice[] = ['kick', 'snare', 'rim', 'hat', 'openHat', 'crash'];

export const LOFI_KEYS = ['rhodes', 'felt', 'wurli', 'pluck', 'pad', 'supersaw', 'nylon', 'crunch', 'wah'] as const;
export const LOFI_LEADS = ['vibes', 'flute', 'soft', 'kalimba', 'chip', 'angel', 'pulse', 'guitar', 'overdrive', 'synthwave', 'metal', 'panflute', 'nylon', 'none'] as const;
export const LOFI_BASSES = ['round', 'upright', 'synth', 'wobble', 'growl', 'reese', 'slap', 'screech', 'pulse', 'electro', 'picked', 'croak', 'eight', 'acid', 'motown'] as const;
export const LOFI_SNARES = ['snare', 'brush', 'rim', 'clap'] as const;
export const LOFI_HATS = ['hat', 'shaker', 'none'] as const;
export const LOFI_GROOVES = ['boomBap', 'halfTime', 'shuffle', 'lazy', 'sparse', 'bossa', 'disco', 'halfStep', 'twoStep', 'rock', 'rumba', 'oneDrop', 'funk'] as const;
export const LOFI_COMPS = ['hold', 'sparse', 'arp', 'pulse'] as const;

/** Everything about how a tune sounds, besides its notes. */
export interface LofiStyle {
  keys: typeof LOFI_KEYS[number];
  lead: typeof LOFI_LEADS[number];
  bass: typeof LOFI_BASSES[number];
  snare: typeof LOFI_SNARES[number];
  hats: typeof LOFI_HATS[number];
  groove: typeof LOFI_GROOVES[number];
  /** How busy the keys are: one held chord, a sparse restrike, a broken chord, or a pulse. */
  comp: typeof LOFI_COMPS[number];
  /** Bars per chord: 2 halves how often the harmony (and the keys) moves. */
  chordBars: 1 | 2;
  /** Drum tuning: kick pitch (Hz) and length (s), snare or clap centre (Hz), hat brightness (Hz). */
  kick: number;
  kickLen: number;
  snareTone: number;
  hatTone: number;
  /** Signal-chain colour, each about 1: tape wobble, room, tone filter, how far the music ducks under the kick. */
  wow: number;
  room: number;
  tone: number;
  duck: number;
  /** A sampler's grit on the music (a coarse bit depth, mixed in quietly). */
  crunch: boolean;
  /** How much crackle and hiss, about 1 for Lofi; Lolly Sings is cleaner. */
  dust: number;
  /**
   * The dance genres' tone, drawn per tune so two tunes of one style differ in colour as
   * well as notes: how bright the bass and the lead are (about 0.6 to 1.6 times their
   * filters) and how hard the bass is driven (about 1, clean, to 4, filthy). The other
   * stations leave both unset, which plays as 1.
   */
  bright?: number;
  drive?: number;
}

export interface LofiNote {
  voice: LofiVoice;
  /** Start, in beats from the start of the bar (swing and feel already applied). */
  beat: number;
  /** Length in beats (drums: 0, they ring their own length). */
  dur: number;
  /** MIDI note number (drums: 0). */
  midi: number;
  /** Velocity, 0 to 1. */
  vel: number;
  /**
   * A bass note's movement, on the dance genres: for a wobble or a growl, how many times
   * its filter swings each beat (2 is eighths, 3 eighth triplets, 4 sixteenths); on a
   * slap bass, how it is played: 0 thumbed, 1 popped, 2 slid into from a fourth below,
   * 3 popped and bent up a tone and back, 4 a dead note (a muted, percussive tick); on an
   * acid bass, 1 is an accent and 2 a slide.
   */
  mod?: number;
}

export type LofiSection = 'intro' | 'verse' | 'bridge' | 'feature' | 'groove' | 'break' | 'drums' | 'build' | 'drop' | 'outro' | 'rest';

export interface LofiTuneInfo {
  seed: number;
  mood: LofiMood;
  bpm: number;
  /** Swing on the sixteenths: 0.5 is straight; lofi sits around 0.56 to 0.62. */
  swing: number;
  /** Swing on the eighths, for the shuffle groove (0.5 elsewhere). */
  swing8: number;
  /** "E♭ minor". */
  key: string;
  /** Chord names of the two progressions, e.g. ["Cm9", "Fm9", …]. */
  progressions: [string[], string[]];
  style: LofiStyle;
  /** Bars in the tune, the rest bar after it included. */
  bars: number;
}

export interface LofiBar {
  tune: LofiTuneInfo;
  /** 0-based bar within the tune. */
  index: number;
  section: LofiSection;
  /** What this section puts in front, if anything. */
  feature?: LofiFeature;
  /** The parts playing in this bar. */
  layers: readonly LofiLayer[];
  /** The chord this bar sits on, e.g. "Fm9" (empty for the rest bar). */
  chord: string;
  /** That chord's pitch classes (0 is C), root first. */
  tones: readonly number[];
  notes: LofiNote[];
  /** How open the tone filter is, 0 (muffled) to 1 (open): intros and outros close the filter. */
  open: number;
  /** Overall level, 0 to 1: the outro fades. */
  level: number;
  /**
   * Instruments this bar plays instead of the tune's style (the dance genres change them
   * between sections: softer keys in an intro, a second lead and a bass switch-up in the
   * second drop). Absent means the style's own.
   */
  voices?: Partial<Pick<LofiStyle, 'keys' | 'lead' | 'bass'>> & {
    /** A second instrument playing the lead's notes with the lead (a drop's doubling). */
    double?: LofiStyle['lead'];
  };
}

export interface LofiStream {
  /** The next bar. Endless: after a tune ends the next one begins. */
  next(): LofiBar;
}

export interface LofiOptions {
  /** The first tune's mood, which later tunes keep. */
  mood: LofiMood;
  /** Fix parts of the style instead of drawing them (for auditioning one instrument). */
  style?: Partial<LofiStyle>;
  /** Play the first tune again when it ends, instead of moving on (a saved tune). */
  repeat?: boolean;
}

// ── harmony ───────────────────────────────────────────────────────────────

/** Chord qualities as semitones from the root, root first. */
const QUALITIES = {
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  six9: [0, 4, 7, 9, 14],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  m6: [0, 3, 7, 9, 14],
  dom9: [0, 4, 7, 10, 14],
  dom13: [0, 4, 10, 14, 21],
  sus: [0, 5, 7, 10, 14],
  b9: [0, 4, 7, 10, 13],
  s9: [0, 4, 7, 10, 15],
  m7b5: [0, 3, 6, 10],
  // Plainer chords for the dance genres' pop progressions.
  maj: [0, 4, 7],
  min: [0, 3, 7],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
} as const;
type Quality = keyof typeof QUALITIES;
const SUFFIX: Record<Quality, string> = {
  maj7: 'maj7', maj9: 'maj9', six9: '6/9', m7: 'm7', m9: 'm9', m11: 'm11', m6: 'm6/9', dom9: '9',
  dom13: '13', sus: '9sus4', b9: '7♭9', s9: '7♯9', m7b5: 'm7♭5', maj: '', min: 'm', add9: 'add9', madd9: 'm(add9)',
};
const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/** A chord in a progression: [semitones above the key's tonic, quality]. */
type Step = readonly [number, Quality];

/** Four-chord progressions. Major ones for warm; minor (aeolian and dorian) for the others. */
const MAJOR: readonly (readonly Step[])[] = [
  [[0, 'maj9'], [9, 'm9'], [2, 'm9'], [7, 'dom13']],     // I vi ii V
  [[2, 'm9'], [7, 'dom13'], [0, 'maj9'], [0, 'six9']],    // ii V I I
  [[5, 'maj9'], [4, 'm7'], [2, 'm9'], [0, 'maj9']],      // IV iii ii I
  [[0, 'maj7'], [5, 'maj9'], [4, 'm7'], [9, 'm9']],      // I IV iii vi
  [[5, 'maj9'], [7, 'sus'], [4, 'm7'], [9, 'm9']],       // IV V iii vi
  [[0, 'maj9'], [4, 'm7'], [5, 'maj9'], [7, 'sus']],     // I iii IV V
  [[5, 'maj9'], [5, 'm6'], [0, 'maj9'], [9, 'dom9']],    // IV iv I VI7
  [[0, 'six9'], [10, 'dom9'], [5, 'maj9'], [5, 'm6']],   // I ♭VII IV iv
  [[9, 'm9'], [2, 'dom9'], [7, 'maj9'], [0, 'maj9']],    // vi II V I (secondary dominant)
  [[0, 'maj9'], [2, 'm9'], [0, 'maj9'], [2, 'm9']],      // I ii vamp
];
const MINOR: readonly (readonly Step[])[] = [
  [[0, 'm9'], [5, 'm9'], [10, 'dom9'], [3, 'maj9']],     // i iv ♭VII ♭III
  [[0, 'm9'], [8, 'maj9'], [2, 'm7b5'], [7, 'b9']],      // i ♭VI ii° V
  [[5, 'm9'], [0, 'm9'], [8, 'maj9'], [7, 's9']],        // iv i ♭VI V
  [[0, 'm9'], [5, 'dom9'], [0, 'm11'], [5, 'dom9']],     // dorian i IV
  [[8, 'maj9'], [7, 'b9'], [0, 'm9'], [0, 'm11']],       // ♭VI V i i
  [[0, 'm11'], [3, 'maj9'], [8, 'maj9'], [7, 'sus']],    // i ♭III ♭VI V
  [[0, 'm9'], [10, 'dom13'], [8, 'maj9'], [7, 'sus']],   // i ♭VII ♭VI V
  [[3, 'maj9'], [2, 'm7b5'], [0, 'm9'], [0, 'm6']],      // ♭III ii° i i
  [[0, 'm9'], [3, 'maj9'], [5, 'm9'], [10, 'dom9']],     // i ♭III iv ♭VII
  [[0, 'm11'], [5, 'm9'], [0, 'm11'], [5, 'm9']],        // i iv vamp
];
const PENTA_MAJOR = [0, 2, 4, 7, 9];
const PENTA_MINOR = [0, 3, 5, 7, 10];

interface Chord { root: number; quality: Quality; name: string; tones: number[] }

function chordOf(key: number, [degree, quality]: Step): Chord {
  const root = ((key + degree) % 12 + 12) % 12;
  return { root, quality, name: NAMES[root] + SUFFIX[quality], tones: QUALITIES[quality].map(i => (root + i) % 12) };
}

/** Play a progression a little differently: swap a dominant for its tritone substitute,
 *  or recolour a chord with a sibling quality. */
function vary(prog: readonly Step[], chance: (p: number) => boolean): Step[] {
  return prog.map(([deg, q]): Step => {
    if ((q === 'dom13' || q === 'b9' || q === 'dom9') && deg === 7 && chance(0.25)) return [1, 'dom9'];   // tritone sub
    if (q === 'maj9' && chance(0.2)) return [deg, 'six9'];
    if (q === 'm9' && chance(0.2)) return [deg, 'm11'];
    if (q === 'dom13' && chance(0.25)) return [deg, 'sus'];
    return [deg, q];
  });
}

/** The keys' voicing: up to four chord tones without the root, guide tones first. */
function voicingClasses(c: Chord): number[] {
  const iv = QUALITIES[c.quality];
  // Order by importance: third, seventh (or sixth), then the colour tones, then the fifth.
  const rank = (i: number): number => ([3, 4].includes(i) ? 0 : [9, 10, 11].includes(i) ? 1 : i > 12 || i === 5 || i === 6 ? 2 : 3);
  const picked = iv.slice(1).sort((a, b) => rank(a) - rank(b)).slice(0, 4);
  return picked.map(i => (c.root + i) % 12);
}

const KEYS_LO = 52;
const KEYS_HI = 76;

/** Place pitch classes as a close voicing near `prev` (voice leading), within the keys' range. */
function voiceLead(classes: number[], prev: number[] | null): number[] {
  const sorted = [...classes].sort((a, b) => a - b);
  let best: number[] = [];
  let bestCost = Infinity;
  for (let rot = 0; rot < sorted.length; rot++) {
    const order = [...sorted.slice(rot), ...sorted.slice(0, rot)];
    // Each base is a C, so base + pitch class is that pitch class (40 would be an E, and
    // every voicing would sound a major third away from the bass and the lead).
    for (let base = Math.floor((KEYS_LO - 12) / 12) * 12; base <= KEYS_HI; base += 12) {
      const v: number[] = [];
      let last = -Infinity;
      for (const pc of order) {
        let p = base + pc;
        while (p <= last) p += 12;
        v.push(p);
        last = p;
      }
      if (v[0]! < KEYS_LO || v[v.length - 1]! > KEYS_HI) continue;
      const centre = v.reduce((s, p) => s + p, 0) / v.length;
      const cost = prev
        ? v.reduce((s, p, i) => s + Math.abs(p - (prev[Math.min(i, prev.length - 1)] ?? p)), 0) + Math.abs(centre - 64) * 0.15
        : Math.abs(centre - 63);
      if (cost < bestCost) { bestCost = cost; best = v; }
    }
  }
  return best;
}

// ── style ─────────────────────────────────────────────────────────────────

/** Weighted choices: [option, weight] pairs. */
type Weights<T> = ReadonlyArray<readonly [T, number]>;

/** How each mood leans the style. Every option stays possible in every mood. */
const LEAN: Record<Exclude<LofiMood, DanceMood>, {
  minor: boolean; bpm: [number, number]; swing: [number, number];
  keys: Weights<LofiStyle['keys']>; lead: Weights<LofiStyle['lead']>; bass: Weights<LofiStyle['bass']>;
  snare: Weights<LofiStyle['snare']>; hats: Weights<LofiStyle['hats']>; groove: Weights<LofiStyle['groove']>;
  busy: number;
}> = {
  warm: {
    minor: false, bpm: [74, 92], swing: [0.55, 0.6],
    keys: [['rhodes', 3], ['wurli', 3], ['pluck', 2], ['felt', 1]],
    lead: [['vibes', 2], ['soft', 2], ['flute', 2], ['kalimba', 1], ['none', 2]],
    bass: [['round', 2], ['upright', 2], ['synth', 1]],
    snare: [['snare', 3], ['clap', 2], ['rim', 1], ['brush', 1]],
    hats: [['hat', 4], ['shaker', 2], ['none', 1]],
    groove: [['boomBap', 4], ['shuffle', 2], ['lazy', 2], ['halfTime', 1], ['sparse', 1]],
    busy: 0.6,
  },
  lateNight: {
    minor: true, bpm: [62, 78], swing: [0.57, 0.62],
    keys: [['felt', 3], ['rhodes', 3], ['wurli', 1], ['pluck', 1]],
    lead: [['vibes', 2], ['soft', 2], ['flute', 1], ['kalimba', 1], ['none', 3]],
    bass: [['round', 3], ['upright', 2], ['synth', 1]],
    snare: [['rim', 3], ['brush', 2], ['snare', 2], ['clap', 1]],
    hats: [['hat', 3], ['shaker', 1], ['none', 2]],
    groove: [['halfTime', 3], ['lazy', 3], ['boomBap', 2], ['sparse', 2], ['shuffle', 1]],
    busy: 0.35,
  },
  rainy: {
    minor: true, bpm: [66, 82], swing: [0.56, 0.61],
    keys: [['felt', 3], ['pluck', 3], ['rhodes', 2], ['wurli', 1]],
    lead: [['kalimba', 3], ['flute', 2], ['vibes', 1], ['soft', 1], ['none', 2]],
    bass: [['round', 2], ['upright', 3], ['synth', 1]],
    snare: [['brush', 4], ['rim', 2], ['snare', 1], ['clap', 1]],
    hats: [['shaker', 3], ['hat', 2], ['none', 2]],
    groove: [['lazy', 3], ['boomBap', 2], ['sparse', 2], ['halfTime', 2], ['shuffle', 1]],
    busy: 0.45,
  },
  // Lolly Sings: the melody is the point. Major keys, a little faster, brighter tuned
  // instruments, a lead in every tune (it sings through every verse, see arrange) and
  // grooves that leave it room: a bossa, a shuffle, or almost nothing.
  sings: {
    minor: false, bpm: [86, 108], swing: [0.5, 0.56],
    keys: [['pluck', 3], ['felt', 2], ['rhodes', 2], ['wurli', 1]],
    lead: [['kalimba', 3], ['vibes', 3], ['chip', 3], ['flute', 2], ['soft', 1]],
    bass: [['round', 3], ['upright', 2], ['synth', 1]],
    snare: [['rim', 3], ['clap', 2], ['brush', 2], ['snare', 1]],
    hats: [['shaker', 3], ['hat', 2], ['none', 1]],
    groove: [['bossa', 3], ['shuffle', 3], ['sparse', 2], ['boomBap', 2], ['halfTime', 1]],
    busy: 0.85,
  },
};
const COMP_WEIGHTS: Weights<LofiStyle['comp']> = [['hold', 4], ['sparse', 3], ['arp', 2], ['pulse', 1]];

/** One option from `w`, each as likely as its weight. */
function weightedPick<T>(rng: () => number, w: Weights<T>): T {
  const total = w.reduce((sum, [, n]) => sum + n, 0);
  let r = rng() * total;
  for (const [v, n] of w) {
    r -= n;
    if (r < 0) return v;
  }
  return w[w.length - 1]![0];
}

function drawStyle(rng: () => number, mood: Exclude<LofiMood, DanceMood>, fixed: Partial<LofiStyle> = {}): LofiStyle {
  const lean = LEAN[mood];
  const weighted = <T>(w: Weights<T>): T => weightedPick(rng, w);
  const range = (lo: number, hi: number): number => lo + rng() * (hi - lo);
  // Lolly Sings is cleaner tape: less wobble, a brighter tone, no grit. Same draws over
  // other ranges, so the Lofi moods' tunes are exactly what they were before it existed.
  const sings = mood === 'sings';
  // Every draw happens even when `fixed` overrides it, so fixing one part does not
  // reshuffle the rest of a seed's style.
  const drawn: LofiStyle = {
    keys: weighted(lean.keys), lead: weighted(lean.lead), bass: weighted(lean.bass),
    snare: weighted(lean.snare), hats: weighted(lean.hats), groove: weighted(lean.groove),
    comp: weighted(COMP_WEIGHTS), chordBars: rng() < 0.45 ? 2 : 1,
    kick: Math.round(range(44, 60)), kickLen: Math.round(range(0.3, 0.55) * 100) / 100,
    snareTone: Math.round(range(1500, 2500)), hatTone: Math.round(range(6000, 9500)),
    wow: Math.round(range(sings ? 0.3 : 0.5, sings ? 0.8 : 1.7) * 100) / 100, room: Math.round(range(sings ? 0.8 : 0.6, sings ? 1.3 : 1.5) * 100) / 100,
    tone: Math.round(range(sings ? 1 : 0.8, sings ? 1.2 : 1.15) * 100) / 100, duck: Math.round(range(0.6, 1.3) * 100) / 100,
    crunch: rng() < 0.15 && !sings,
    dust: sings ? 0.45 : 1,
  };
  return { ...drawn, ...fixed };
}

// ── arrangement ───────────────────────────────────────────────────────────

/** The parts that can play in a stretch of a tune. */
export type LofiLayer = 'keys' | 'bass' | 'lead' | 'kick' | 'snare' | 'hats' | 'fx';
/** What a section puts in front: the lead's melody, busier keys, a walking bass, or the drums alone. */
export type LofiFeature = 'lead' | 'keys' | 'bass' | 'drums';

interface Part {
  section: LofiSection;
  bars: number;
  prog: 0 | 1;
  layers: readonly LofiLayer[];
  feature?: LofiFeature;
  /** The tone filter's opening across the part, start to end (default fully open). */
  open?: readonly [number, number];
  fade?: boolean;
}

const KIT: readonly LofiLayer[] = ['kick', 'snare', 'hats'];
const BAND: readonly LofiLayer[] = ['keys', 'bass', 'kick', 'snare', 'hats'];

/**
 * A tune's running order. It opens in one of several ways (the keys alone, the hats and
 * then the kit, the whole kit, bass and hats, keys and hats), plays a verse, then two
 * or three middle sections drawn from a menu (the second progression with the melody, a
 * lead feature, a keys feature, a walking-bass feature, a groove with the beat held back,
 * a breakdown without drums, a drum break), another verse, and one of several endings.
 * So instruments come in, take the front and drop out at different moments in each tune.
 */
function arrange(rng: () => number, hasLead: boolean, singing = false): Part[] {
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rng() * a.length)] as T;
  const weighted = <T>(w: Weights<T>): T => weightedPick(rng, w);
  const withLead = (layers: readonly LofiLayer[]): readonly LofiLayer[] => (hasLead ? [...layers, 'lead'] : layers);
  const parts: Part[] = [];

  switch (weighted<string>([['keys', 3], ['hats', 2], ['kit', 2], ['bassHats', 1], ['keysHats', 2]])) {
    case 'hats':
      parts.push({ section: 'intro', bars: 2, prog: 0, layers: ['hats'], open: [0.5, 0.65] });
      parts.push({ section: 'intro', bars: 2, prog: 0, layers: KIT, open: [0.7, 0.9] });
      break;
    case 'kit': parts.push({ section: 'intro', bars: pick([2, 4]), prog: 0, layers: KIT, open: [0.45, 0.9] }); break;
    case 'bassHats': parts.push({ section: 'intro', bars: 4, prog: 0, layers: ['bass', 'hats'], open: [0.4, 0.85] }); break;
    case 'keysHats': parts.push({ section: 'intro', bars: 4, prog: 0, layers: ['keys', 'hats'], open: [0.4, 0.85] }); break;
    default: parts.push({ section: 'intro', bars: 4, prog: 0, layers: ['keys'], open: [0.35, 0.85] });
  }

  const verse = (bars: number): void => {
    // The melody joins halfway; in Lolly Sings it sings the whole verse.
    parts.push({ section: 'verse', bars: bars / 2, prog: 0, layers: singing ? withLead(BAND) : BAND });
    parts.push({ section: 'verse', bars: bars / 2, prog: 0, layers: withLead(BAND) });
  };
  verse(pick([8, 8, 16]));

  const menu: Array<[string, number]> = [
    ['bridge', 3], ['leadFeature', hasLead ? (singing ? 4 : 2) : 0], ['keysFeature', 2], ['bassFeature', 2],
    ['groove', 2], ['breakdown', 2], ['drumBreak', 1],
  ];
  const count = rng() < 0.5 ? 2 : 3;
  let usedB = false;
  for (let n = 0; n < count; n++) {
    const choice = weighted<string>(menu.filter(([, w]) => w > 0));
    menu.find(m => m[0] === choice)![1] = 0;   // each middle section at most once
    const prog: 0 | 1 = choice === 'bridge' || (!usedB && rng() < 0.5) ? 1 : 0;
    if (prog) usedB = true;
    switch (choice) {
      case 'bridge': parts.push({ section: 'bridge', bars: 8, prog, layers: withLead(BAND) }); break;
      case 'leadFeature': parts.push({ section: 'feature', bars: 8, prog, layers: ['keys', 'bass', 'kick', 'hats', 'lead'], feature: 'lead' }); break;
      case 'keysFeature': parts.push({ section: 'feature', bars: 8, prog, layers: BAND, feature: 'keys' }); break;
      case 'bassFeature': parts.push({ section: 'feature', bars: pick([4, 8]), prog, layers: BAND, feature: 'bass' }); break;
      case 'groove': parts.push({ section: 'groove', bars: 4, prog, layers: ['keys', 'bass', 'hats'], open: [0.7, 0.8] }); break;
      case 'breakdown': parts.push({ section: 'break', bars: 4, prog, layers: withLead(['keys']), open: [0.6, 0.5] }); break;
      default: parts.push({ section: 'drums', bars: pick([2, 4]), prog, layers: rng() < 0.5 ? KIT : [...KIT, 'bass'], feature: 'drums' });
    }
  }
  verse(8);

  switch (weighted<string>([['fade', 3], ['drumsOut', 2], ['keysOut', 2], ['hatsOut', 1]])) {
    case 'drumsOut':
      parts.push({ section: 'outro', bars: 2, prog: 0, layers: BAND, open: [0.9, 0.8] });
      parts.push({ section: 'outro', bars: 2, prog: 0, layers: KIT, open: [0.7, 0.4], fade: true });
      break;
    case 'keysOut':
      parts.push({ section: 'outro', bars: 2, prog: 0, layers: ['keys', 'bass'], open: [0.8, 0.6] });
      parts.push({ section: 'outro', bars: 2, prog: 0, layers: ['keys'], open: [0.5, 0.3], fade: true });
      break;
    case 'hatsOut':
      parts.push({ section: 'outro', bars: 2, prog: 0, layers: ['keys', 'hats'], open: [0.8, 0.6] });
      parts.push({ section: 'outro', bars: 2, prog: 0, layers: ['hats'], open: [0.5, 0.35], fade: true });
      break;
    default:
      parts.push({ section: 'outro', bars: 2, prog: 0, layers: ['keys', 'bass', 'kick', 'hats'], open: [0.85, 0.7] });
      parts.push({ section: 'outro', bars: 2, prog: 0, layers: ['keys'], open: [0.55, 0.3], fade: true });
  }
  return parts;
}

// ── rhythm ────────────────────────────────────────────────────────────────

const KICKS: Record<LofiStyle['groove'], readonly (readonly number[])[]> = {
  boomBap: [[0, 10], [0, 7, 10], [0, 3, 10], [0, 8, 10], [0, 10, 11]],
  halfTime: [[0, 6], [0, 11], [0, 3, 6]],
  shuffle: [[0, 6, 10], [0, 10], [0, 6, 8]],
  lazy: [[0, 7, 10], [0, 9, 11], [0, 3, 10]],
  sparse: [[0], [0, 10], [0, 11]],
  // The bossa nova bass drum: one, the and of two, three, and the and of four.
  bossa: [[0, 6, 8, 14], [0, 6, 8, 12]],
  // The dance grooves: four on the floor; dubstep's half-time step (the snare on three);
  // drum and bass's two-step.
  disco: [[0, 4, 8, 12]],
  halfStep: [[0], [0, 10], [0, 3, 10], [0, 14], [0, 6, 10]],
  twoStep: [[0, 10], [0, 7, 10], [0, 10, 11], [0, 6, 10]],
  // A rock beat (the kick on one and three, pushed now and then), and the rumba's cajón.
  rock: [[0, 8], [0, 6, 8], [0, 8, 10], [0, 8, 11]],
  rumba: [[0, 6, 8, 14], [0, 3, 8, 11]],
  // Reggae's one drop: no kick on one, the kick and the cross-stick together on three.
  oneDrop: [[8], [8], [8, 14]],
  // Funk: the one, then kicks pushed off the beat.
  funk: [[0, 3, 10], [0, 7, 10, 13], [0, 6, 10], [0, 3, 8, 10]],
};
/** The bossa's clave, played on the rim in place of a backbeat. */
const CLAVE = [0, 3, 6, 10, 12];

/** Sixteenth `step` of a bar as a beat, with swing on the off-sixteenths and, for a shuffle, the off-eighths. */
function stepBeat(step: number, swing: number, swing8 = 0.5): number {
  let beat = step / 4;
  if (step % 4 === 2) beat += swing8 - 0.5;
  else if (step % 2 === 1) beat += (swing - 0.5) * 0.5;
  return beat;
}

/** The next tune's seed: a fixed scramble of this one, so a station's run of tunes is reproducible. */
export function nextLofiSeed(seed: number): number {
  return Math.floor(mulberry32(seed ^ 0x9e3779b9)() * 4294967296) >>> 0;
}

/** Build one tune's bars. */
export function composeLofiTune(seed: number, mood: LofiMood, fixed: Partial<LofiStyle> = {}): LofiBar[] {
  if (isDanceMood(mood)) return composeDanceTune(seed, mood, fixed);
  const rng = mulberry32(seed >>> 0);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rng() * a.length)] as T;
  const range = ([lo, hi]: [number, number]): number => lo + rng() * (hi - lo);
  const chance = (p: number): boolean => rng() < p;
  const lean = LEAN[mood];

  const key = Math.floor(rng() * 12);
  const style = drawStyle(rng, mood, fixed);
  const halfTime = style.groove === 'halfTime';
  const bpm = Math.round(range(lean.bpm) * (halfTime ? 1.12 : 1));
  const swing = Math.round(range(style.groove === 'lazy' ? [0.6, 0.64] : lean.swing) * 100) / 100;
  const swing8 = style.groove === 'shuffle' ? Math.round(range([0.6, 0.66]) * 100) / 100 : 0.5;
  const pool = lean.minor ? MINOR : MAJOR;
  const progA = vary(pick(pool), chance);
  let base = pick(pool);
  for (let tries = 0; base === progA && tries < 4; tries++) base = pick(pool);
  const progB = vary(base, chance);
  const chords = [progA.map(s => chordOf(key, s)), progB.map(s => chordOf(key, s))];
  const penta = (lean.minor ? PENTA_MINOR : PENTA_MAJOR).map(i => (key + i) % 12);
  const hasLead = style.lead !== 'none';
  const parts = arrange(rng, hasLead, mood === 'sings');
  const total = parts.reduce((s, p) => s + p.bars, 0) + 1;
  const info: LofiTuneInfo = {
    seed: seed >>> 0, mood, bpm, swing, swing8, style,
    key: `${NAMES[key]} ${lean.minor ? 'minor' : 'major'}`,
    progressions: [chords[0]!.map(c => c.name), chords[1]!.map(c => c.name)],
    bars: total,
  };

  const kickSteps = pick(KICKS[style.groove]);
  // Three motifs: the verse's, the second progression's, and a busier one for a lead feature.
  const motifs = [motif(rng, lean.busy), motif(rng, lean.busy), motif(rng, Math.min(1, lean.busy + 0.4))];
  let prevVoicing: number[] | null = null;
  let prevLead = 72;
  const sb = (step: number): number => stepBeat(step, swing, swing8);
  const loose = style.groove === 'lazy' ? 0.035 : 0.012;   // how far hands drift off the grid

  const bars: LofiBar[] = [];
  let index = 0;
  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi]!;
    const prog = chords[part.prog]!;
    const has = (l: LofiLayer): boolean => part.layers.includes(l);
    // The fade runs across the whole ending, both of its parts.
    const outroStart = parts.findIndex(p => p.section === 'outro');
    for (let i = 0; i < part.bars; i++, index++) {
      const slot = Math.floor(i / style.chordBars);
      const firstOfChord = i % style.chordBars === 0;
      const chord = prog[slot % prog.length]!;
      const nextChord = prog[(slot + 1) % prog.length]!;
      const notes: LofiNote[] = [];
      const partEnd = i === part.bars - 1;
      const [o0, o1] = part.open ?? [1, 1];
      const open = o0 + (o1 - o0) * (part.bars > 1 ? i / (part.bars - 1) : 1);
      let level = 1;
      if (part.section === 'outro') {
        const intoOutro = parts.slice(outroStart, pi).reduce((s, p) => s + p.bars, 0) + i;
        level = part.fade || intoOutro > 0 ? 1 - (intoOutro + 1) * 0.17 : 1;
      }
      const feature = part.feature;
      const leadOn = hasLead && has('lead');

      // KEYS: one voicing per chord; how often it is struck depends on the style.
      if (firstOfChord) prevVoicing = voiceLead(voicingClasses(chord), prevVoicing);
      const voicing = prevVoicing ?? [];
      if (has('keys')) {
        const span = style.chordBars * 4;   // beats the chord lasts
        const soft = part.section === 'intro' || part.section === 'outro' || part.section === 'break';
        // While the lead or the bass has the front, the keys hold the chord; when the
        // keys have it, they play more than their usual pattern.
        let comp: LofiStyle['comp'] = style.comp;
        if (feature === 'keys') comp = style.comp === 'hold' || style.comp === 'sparse' ? 'arp' : style.comp;
        else if (soft || leadOn || feature === 'bass') comp = 'hold';
        const strike = (beat: number, len: number, vel: number, spread: number): void => {
          voicing.forEach((p, n) => {
            notes.push({ voice: 'keys', midi: p, beat: beat + n * spread, dur: len, vel: clamp01(vel + (n === voicing.length - 1 ? 0.05 : 0) + (rng() - 0.5) * 0.08) });
          });
        };
        // A chord that started in a part before this one is struck again where the keys come in.
        const enter = firstOfChord || i === 0;
        const left = (style.chordBars - (i % style.chordBars)) * 4;
        if (comp === 'hold') {
          if (enter) strike(0, Math.min(span, left) - 0.25, 0.58, 0.012 + rng() * 0.02);
        } else if (comp === 'sparse') {
          if (enter) strike(0, Math.min(span, left) - 0.25, 0.58, 0.015 + rng() * 0.02);
          else if (chance(0.5)) strike(sb(10), 1.4, 0.4, 0.02);   // a quiet touch in the chord's second bar
          if (style.chordBars === 1 && chance(0.25)) strike(sb(10), 1.4, 0.38, 0.02);
        } else if (comp === 'arp') {
          // A broken chord, a few notes a beat apart, each left to ring; in a chord's second
          // bar just two notes answer the chord.
          const order = (enter ? (style.chordBars === 2 ? [0, 1, 2, 3] : [0, 2, 3]) : [3, 1]).filter(n => n < voicing.length);
          order.forEach((n, j) => {
            const step = enter ? j * 4 : 6 + j * 6;
            notes.push({ voice: 'keys', midi: voicing[n]!, beat: sb(step), dur: Math.max(1, 3.6 - sb(step)), vel: clamp01((enter ? 0.48 : 0.38) + (rng() - 0.5) * 0.1) });
          });
        } else {
          strike(0, 1.8, 0.55, 0.015);
          strike(sb(10), 1.4, 0.45, 0.02);
        }
      }

      // BASS
      if (has('bass')) {
        const root = placeIn(chord.root, 36, 47);
        const fifth = root + 7 <= 50 ? root + 7 : root - 5;
        const third = placeIn(chord.tones[1]!, root, root + 11);
        if (feature === 'bass') {
          // A walking line: a note a beat, chord tones, then a step into the next root.
          const target = placeIn(nextChord.root, 36, 47);
          const line = [root, chance(0.5) ? third : fifth, chance(0.5) ? fifth : root + 12 <= 52 ? root + 12 : third, target + (target > root ? -1 : 1)];
          line.forEach((m, b) => {
            notes.push({ voice: 'bass', midi: m, beat: b === 0 ? 0 : sb(b * 4) + (rng() - 0.5) * 0.02, dur: 0.85, vel: b === 0 ? 0.82 : 0.66 });
          });
        } else if (style.groove === 'sparse' || !has('kick')) {
          notes.push({ voice: 'bass', midi: root, beat: 0, dur: 3.2, vel: 0.8 });
        } else if (style.groove === 'bossa') {
          // The bossa bass: root and fifth, each held into the next.
          notes.push({ voice: 'bass', midi: root, beat: 0, dur: 1.4, vel: 0.8 });
          notes.push({ voice: 'bass', midi: fifth, beat: sb(6), dur: 0.45, vel: 0.62 });
          notes.push({ voice: 'bass', midi: fifth, beat: sb(8), dur: 1.4, vel: 0.72 });
          notes.push({ voice: 'bass', midi: root, beat: sb(14), dur: 0.45, vel: 0.6 });
        } else {
          const walk = chance(0.45);
          notes.push({ voice: 'bass', midi: root, beat: 0, dur: walk ? 0.75 : 1.6, vel: 0.82 });
          if (walk) notes.push({ voice: 'bass', midi: chance(0.5) ? root : root + 12 <= 52 ? root + 12 : root, beat: sb(3), dur: 0.6, vel: 0.62 });
          notes.push({ voice: 'bass', midi: chance(0.6) ? root : fifth, beat: sb(halfTime ? 11 : 10), dur: 0.9, vel: 0.7 });
          const changing = i % style.chordBars === style.chordBars - 1 && nextChord.root !== chord.root;
          if (changing && chance(0.45)) notes.push({ voice: 'bass', midi: placeIn(nextChord.root, 36, 47) + (chance(0.5) ? 1 : -1), beat: sb(14), dur: 0.4, vel: 0.6 });
        }
      }

      // LEAD
      if (leadOn) {
        const mo = motifs[feature === 'lead' ? 2 : part.prog]!;
        const answer = i % 2 === 1;
        const bar = mo[i % 2]!;
        for (let n = 0; n < bar.length; n++) {
          const { step, move, len } = bar[n]!;
          let pitch = stepScale(prevLead, answer && n === bar.length - 1 ? -Math.abs(move) : move, penta);
          if (step % 8 === 0 || n === bar.length - 1) pitch = nearestTone(pitch, chord.tones);   // strong beats sit on the chord
          // Keep the lead in its range by whole octaves, so a note snapped to the chord stays a chord tone.
          while (pitch < 64) pitch += 12;
          while (pitch > 84) pitch -= 12;
          prevLead = pitch;
          notes.push({ voice: 'lead', midi: pitch, beat: sb(step) + (rng() - 0.5) * 0.02, dur: len / 4, vel: clamp01((feature === 'lead' ? 0.56 : 0.5) + (rng() - 0.5) * 0.14) });
        }
      }

      // DRUMS
      const backbeat = style.snare === 'rim' ? 'rim' : 'snare';
      const drumsFront = feature === 'drums';
      if (has('kick')) {
        for (const s of kickSteps) notes.push({ voice: 'kick', midi: 0, dur: 0, beat: sb(s) + (s ? (rng() - 0.5) * loose : 0), vel: s === 0 ? 0.9 : 0.74 });
      }
      if (has('snare') && style.groove === 'bossa') {
        for (const s of CLAVE) notes.push({ voice: 'rim', midi: 0, dur: 0, beat: sb(s) + (rng() - 0.5) * loose, vel: s === 0 ? 0.62 : 0.5 });
      } else if (has('snare')) {
        const hits = halfTime ? [8] : style.groove === 'sparse' ? [12] : [4, 12];
        for (const s of hits) notes.push({ voice: backbeat, midi: 0, dur: 0, beat: s / 4 + 0.02 + rng() * (style.groove === 'lazy' ? 0.04 : 0.012), vel: 0.78 + (rng() - 0.5) * 0.08 });
        if (style.groove !== 'sparse' || drumsFront) {
          for (const s of [7, 9, 15]) if (chance(drumsFront ? 0.4 : 0.14)) notes.push({ voice: 'snare', midi: 0, dur: 0, beat: sb(s), vel: 0.2 });   // ghosts
        }
      }
      if (has('hats') && style.hats !== 'none') {
        const openOne = i % 4 === 3 && style.hats === 'hat' && chance(0.6);
        const every = style.groove === 'sparse' && !drumsFront ? 4 : 2;
        for (let s = 0; s < 16; s += every) {
          if (openOne && s === 14) { notes.push({ voice: 'openHat', midi: 0, dur: 0, beat: sb(s), vel: 0.42 }); continue; }
          notes.push({ voice: 'hat', midi: 0, dur: 0, beat: sb(s) + (rng() - 0.5) * loose, vel: clamp01((s % 4 === 2 ? 0.46 : 0.34) + (rng() - 0.5) * 0.1) });
          if (every === 2 && chance((drumsFront ? 0.3 : 0.1) * lean.busy)) notes.push({ voice: 'hat', midi: 0, dur: 0, beat: sb(s + 1), vel: 0.2 });
        }
      } else if (has('hats') && style.hats === 'none' && part.layers.length <= 2) {
        // A kit with no hats still needs something to count in an intro or ending made of hats.
        for (const s of [2, 6, 10, 14]) notes.push({ voice: 'rim', midi: 0, dur: 0, beat: sb(s), vel: 0.3 });
      }
      if ((partEnd || i % 8 === 7) && has('snare') && part.section !== 'outro') {   // a small fill to turn the phrase
        if (has('kick') && chance(0.5)) notes.push({ voice: 'kick', midi: 0, dur: 0, beat: sb(13), vel: 0.6 });
        notes.push({ voice: 'snare', midi: 0, dur: 0, beat: sb(15), vel: drumsFront ? 0.45 : 0.32 });
      }

      notes.sort((a, b) => a.beat - b.beat);
      bars.push({ tune: info, index, section: part.section, feature, layers: part.layers, chord: chord.name, tones: chord.tones, notes, open, level });
    }
  }
  bars.push({ tune: info, index, section: 'rest', layers: [], chord: '', tones: [], notes: [], open: 0.3, level: 0 });
  return bars;
}

/** An endless stream of bars from `seed`: one tune after another. */
export function lofiStream(seed: number, opts: LofiOptions): LofiStream {
  let tuneSeed = seed >>> 0;
  let bars = composeLofiTune(tuneSeed, opts.mood, opts.style);
  let at = 0;
  return {
    next(): LofiBar {
      if (at >= bars.length) {
        // A repeating stream keeps the same bars: composing is deterministic, so the
        // tune would come out identical anyway.
        if (!opts.repeat) {
          tuneSeed = nextLofiSeed(tuneSeed);
          bars = composeLofiTune(tuneSeed, opts.mood, opts.style);
        }
        at = 0;
      }
      return bars[at++]!;
    },
  };
}

/** How long one tune lasts, in seconds: its bars at its tempo (four beats a bar). */
export function lofiTuneSeconds(seed: number, mood: LofiMood): number {
  const bars = composeLofiTune(seed >>> 0, mood);
  return (bars.length * 4 * 60) / bars[0]!.tune.bpm;
}

// ── the dance genres ──────────────────────────────────────────────────────

/** How each dance genre leans its tunes. */
interface DanceLean {
  bpm: [number, number];
  /** The chance a tune is in a minor key. */
  minor: number;
  groove: LofiStyle['groove'];
  chordBars: 1 | 2;
  keys: Weights<LofiStyle['keys']>;
  lead: Weights<LofiStyle['lead']>;
  bass: Weights<LofiStyle['bass']>;
  snare: Weights<LofiStyle['snare']>;
  kick: [number, number];
  kickLen: [number, number];
  /** How hard the music pumps under the kick. */
  duck: [number, number];
  /** The chance of the sampler grit. */
  crunch: number;
  /** Swing on the sixteenths (0.5 is straight). */
  swing: number;
  /** Bars in the intro, the choice of build lengths, and bars in each drop and in the breakdown. */
  intro: number;
  build: readonly number[];
  drop: number;
  breakdown: number;
  /** The chord vocabulary: sugar's jazz-major, plain pop, rock's three chords, or Spanish (the Andalusian cadence). */
  harmony: 'jazz' | 'pop' | 'rock' | 'spanish';
  /** A band genre (rock, Spanish guitar): verses and choruses, a pre-chorus fill in place of a riser, a solo in the break. */
  band?: boolean;
  /** The hats, when not the closed hat. */
  hats?: LofiStyle['hats'];
  /** Whether the drop is a groove the melody sings over from the start (sugar), or the bass's alone at first. */
  singingDrop: boolean;
  busy: number;
  /** The keys of the quieter sections (intro, breakdown, outro). */
  softKeys: Weights<LofiStyle['keys']>;
  /** The bass of a groove verse, and of the second drop (its switch-up). */
  verseBass: Weights<LofiStyle['bass']>;
  switchBass: Weights<LofiStyle['bass']>;
}

const DANCE: Record<DanceMood, DanceLean> = {
  // Funk: slap bass up front, a wah guitar chanking sixteenths, horn-like stabs, tight
  // drums with ghost notes, and the jazz-funk chords.
  funk: {
    bpm: [98, 114], minor: 0.6, groove: 'funk', chordBars: 2,
    keys: [['wah', 3], ['pluck', 1], ['rhodes', 1]], lead: [['soft', 3], ['guitar', 2], ['synthwave', 1], ['flute', 1], ['vibes', 1]],
    bass: [['slap', 1]], snare: [['snare', 1]], kick: [52, 60], kickLen: [0.25, 0.35], duck: [0.6, 0.9], crunch: 0.2,
    swing: 0.54, intro: 4, build: [4], drop: 8, breakdown: 8, harmony: 'jazz', singingDrop: true, busy: 0.8, band: true,
    softKeys: [['rhodes', 2], ['felt', 1]], verseBass: [['slap', 1]], switchBass: [['slap', 1]],
  },
  // Soul: a melodic bass that walks and pushes, Rhodes and organ, a backbeat with a shaker,
  // and a vibes, flute, horn or guitar lead.
  soul: {
    bpm: [88, 108], minor: 0.35, groove: 'rock', chordBars: 2,
    keys: [['rhodes', 3], ['wurli', 2], ['pad', 1]], lead: [['vibes', 2], ['flute', 2], ['soft', 2], ['guitar', 2]],
    bass: [['motown', 1]], snare: [['snare', 2], ['clap', 1]], hats: 'shaker', kick: [50, 56], kickLen: [0.3, 0.45], duck: [0.5, 0.8], crunch: 0.1,
    swing: 0.55, intro: 4, build: [4], drop: 8, breakdown: 8, harmony: 'jazz', singingDrop: true, busy: 0.65, band: true,
    softKeys: [['felt', 2], ['pluck', 1]], verseBass: [['motown', 1]], switchBass: [['motown', 1]],
  },
  // Acid: a squelching 303 line (a resonant filter, accents and slides) over four on the
  // floor, claps and open hats.
  acid: {
    bpm: [122, 130], minor: 0.6, groove: 'disco', chordBars: 2,
    keys: [['pad', 2], ['supersaw', 1], ['pluck', 1]], lead: [['chip', 2], ['pulse', 2], ['synthwave', 1]],
    bass: [['acid', 1]], snare: [['clap', 1]], kick: [50, 56], kickLen: [0.3, 0.4], duck: [1.2, 1.6], crunch: 0.3,
    swing: 0.52, intro: 8, build: [4, 8], drop: 16, breakdown: 8, harmony: 'pop', singingDrop: false, busy: 0.6,
    softKeys: [['pad', 1], ['felt', 1]], verseBass: [['acid', 1]], switchBass: [['acid', 1]],
  },
  // Reggae: the one drop, an offbeat skank on the keys with an organ's bubble, a deep and
  // melodic bass that leaves space, and a horn-like or flute lead.
  reggae: {
    bpm: [70, 84], minor: 0.5, groove: 'oneDrop', chordBars: 1,
    keys: [['wurli', 3], ['rhodes', 2], ['pluck', 1]], lead: [['soft', 3], ['flute', 2], ['vibes', 2], ['kalimba', 1], ['guitar', 1]],
    bass: [['round', 1]], snare: [['rim', 1]], kick: [46, 54], kickLen: [0.35, 0.5], duck: [0.5, 0.8], crunch: 0,
    swing: 0.58, intro: 4, build: [4], drop: 8, breakdown: 8, harmony: 'pop', singingDrop: true, busy: 0.6, band: true,
    softKeys: [['felt', 2], ['pad', 1]], verseBass: [['round', 1]], switchBass: [['round', 1]],
  },
  // Synthwave: the eighties at night. An eighth-note octave bass, arpeggios and pads, a
  // backbeat with a big snare, a saw lead or a lead guitar, builds that open on a crash.
  synthwave: {
    bpm: [92, 118], minor: 0.8, groove: 'rock', chordBars: 2,
    keys: [['pluck', 3], ['pad', 2], ['supersaw', 1]], lead: [['synthwave', 4], ['overdrive', 2], ['soft', 1], ['pulse', 1]],
    bass: [['synth', 1]], snare: [['snare', 3], ['clap', 1]], kick: [50, 58], kickLen: [0.3, 0.42], duck: [1, 1.4], crunch: 0,
    swing: 0.5, intro: 8, build: [4], drop: 16, breakdown: 8, harmony: 'pop', singingDrop: true, busy: 0.65,
    softKeys: [['pad', 2], ['felt', 1]], verseBass: [['synth', 1]], switchBass: [['synth', 2], ['electro', 1]],
  },
  // Hip hop: a hard boom-bap with trap hat rolls, an 808 that slides, chopped keys and a
  // bright lead singing the hook.
  hiphop: {
    bpm: [84, 98], minor: 0.55, groove: 'boomBap', chordBars: 2,
    keys: [['rhodes', 3], ['wurli', 2], ['felt', 1], ['pluck', 2]], lead: [['chip', 2], ['kalimba', 2], ['vibes', 2], ['flute', 2], ['synthwave', 1], ['guitar', 1]],
    bass: [['eight', 1]], snare: [['snare', 3], ['clap', 2]], kick: [48, 56], kickLen: [0.4, 0.6], duck: [0.8, 1.2], crunch: 0.2,
    swing: 0.56, intro: 4, build: [4], drop: 8, breakdown: 8, harmony: 'pop', singingDrop: true, busy: 0.7, band: true,
    softKeys: [['felt', 2], ['pluck', 1], ['pad', 1]], verseBass: [['eight', 1]], switchBass: [['eight', 1]],
  },
  // Classic rock: a crunchy power-chord rhythm guitar chugging eighths, a picked bass, a
  // rock beat, and an overdriven lead guitar that takes a solo in the break.
  rock: {
    bpm: [108, 140], minor: 0.45, groove: 'rock', chordBars: 1,
    keys: [['crunch', 1]], lead: [['overdrive', 4], ['guitar', 2], ['metal', 1], ['synthwave', 1]],
    bass: [['picked', 1]], snare: [['snare', 1]], kick: [52, 60], kickLen: [0.3, 0.4], duck: [0.6, 0.9], crunch: 0.3,
    swing: 0.5, intro: 4, build: [4], drop: 8, breakdown: 8, harmony: 'rock', singingDrop: true, busy: 0.75, band: true,
    softKeys: [['nylon', 2], ['rhodes', 1]], verseBass: [['picked', 1]], switchBass: [['picked', 1]],
  },
  // Spanish guitar: a nylon-string guitar strumming a rumba, the Andalusian cadence, a
  // melody in the harmonic minor, upright bass, cajón, palmas and a shaker.
  spanish: {
    bpm: [100, 124], minor: 0.75, groove: 'rumba', chordBars: 1,
    keys: [['nylon', 1]], lead: [['nylon', 5], ['flute', 2], ['panflute', 1], ['guitar', 1]],
    bass: [['upright', 1]], snare: [['clap', 1]], hats: 'shaker', kick: [72, 90], kickLen: [0.12, 0.2], duck: [0.5, 0.8], crunch: 0,
    swing: 0.52, intro: 4, build: [4], drop: 8, breakdown: 8, harmony: 'spanish', singingDrop: true, busy: 0.85, band: true,
    softKeys: [['pluck', 2], ['felt', 1]], verseBass: [['upright', 1]], switchBass: [['upright', 1]],
  },
  // Sugar: bright, fast and funky. Slap bass, soaring saw chords, claps, crashes and
  // coin dings over four on the floor, in the jazz-major chords of an old platform game.
  sugar: {
    bpm: [116, 130], minor: 0.15, groove: 'disco', chordBars: 1,
    keys: [['supersaw', 4], ['rhodes', 1]], lead: [['chip', 3], ['pulse', 3], ['angel', 2], ['guitar', 2], ['synthwave', 1], ['vibes', 1], ['panflute', 2], ['flute', 1]],
    bass: [['slap', 1]], snare: [['clap', 1]], kick: [52, 60], kickLen: [0.25, 0.35], duck: [1.3, 1.7], crunch: 0,
    swing: 0.53, intro: 8, build: [4], drop: 16, breakdown: 8, harmony: 'jazz', singingDrop: true, busy: 0.9,
    // The croak: the modelled string in repeated eighths, a guttural, bubbling Sugar flavour now and then.
    softKeys: [['rhodes', 2], ['pluck', 2], ['felt', 1]], verseBass: [['slap', 3], ['pulse', 2], ['croak', 1]], switchBass: [['slap', 4], ['croak', 1]],
  },
  dubstep: {
    bpm: [138, 142], minor: 0.45, groove: 'halfStep', chordBars: 2,
    keys: [['pad', 4], ['supersaw', 2]], lead: [['chip', 2], ['kalimba', 2], ['vibes', 1], ['angel', 2], ['synthwave', 2], ['guitar', 1], ['metal', 2], ['panflute', 1]],
    bass: [['wobble', 1]], snare: [['snare', 3], ['clap', 2]], kick: [48, 56], kickLen: [0.35, 0.5], duck: [1.3, 1.7], crunch: 0,
    swing: 0.5, intro: 8, build: [4, 8], drop: 16, breakdown: 8, harmony: 'pop', singingDrop: false, busy: 0.7,
    softKeys: [['pad', 2], ['pluck', 1], ['felt', 1]], verseBass: [['wobble', 1]], switchBass: [['wobble', 2], ['growl', 1]],
  },
  brostep: {
    bpm: [145, 150], minor: 0.75, groove: 'halfStep', chordBars: 2,
    keys: [['pad', 3], ['supersaw', 2]], lead: [['chip', 2], ['soft', 2], ['angel', 1], ['overdrive', 3], ['synthwave', 1], ['metal', 3]],
    bass: [['growl', 1], ['screech', 1]], snare: [['snare', 4], ['clap', 1]], kick: [50, 58], kickLen: [0.3, 0.45], duck: [1.4, 1.8], crunch: 0.4,
    swing: 0.5, intro: 8, build: [4, 8], drop: 16, breakdown: 8, harmony: 'pop', singingDrop: false, busy: 0.75,
    softKeys: [['pad', 2], ['pluck', 1]], verseBass: [['growl', 1]], switchBass: [['growl', 1], ['screech', 1]],
  },
  dnb: {
    bpm: [170, 176], minor: 0.5, groove: 'twoStep', chordBars: 2,
    keys: [['pad', 3], ['rhodes', 2], ['pluck', 2]], lead: [['vibes', 2], ['kalimba', 2], ['chip', 1], ['angel', 2], ['guitar', 2], ['synthwave', 2], ['flute', 2], ['panflute', 1], ['metal', 1]],
    bass: [['reese', 1]], snare: [['snare', 4], ['clap', 1]], kick: [55, 62], kickLen: [0.22, 0.3], duck: [1.1, 1.4], crunch: 0,
    swing: 0.5, intro: 16, build: [8], drop: 16, breakdown: 8, harmony: 'pop', singingDrop: false, busy: 0.6,
    softKeys: [['rhodes', 2], ['pad', 2], ['pluck', 1]], verseBass: [['reese', 1]], switchBass: [['reese', 1]],
  },
  // Electro: French-house filth. Four on the floor under a hard pump, a distorted bass
  // riff jumping octaves, big saw chords, grit on the whole mix.
  electro: {
    bpm: [118, 126], minor: 0.6, groove: 'disco', chordBars: 1,
    keys: [['supersaw', 3], ['pad', 1]], lead: [['soft', 2], ['pulse', 2], ['chip', 1], ['overdrive', 3], ['synthwave', 2], ['metal', 2], ['panflute', 1]],
    bass: [['electro', 1]], snare: [['clap', 3], ['snare', 2]], kick: [50, 58], kickLen: [0.3, 0.42], duck: [1.8, 2.2], crunch: 0.7,
    swing: 0.5, intro: 8, build: [4], drop: 16, breakdown: 8, harmony: 'pop', singingDrop: true, busy: 0.7,
    softKeys: [['pad', 2], ['pluck', 1]], verseBass: [['electro', 2], ['pulse', 1]], switchBass: [['electro', 3], ['screech', 1]],
  },
};

/** Each dance genre's range of brightness and drive (see LofiStyle.bright and drive). */
const BRIGHT: Record<DanceMood, [number, number]> = { funk: [1, 1.5], soul: [0.8, 1.2], acid: [0.8, 1.6], reggae: [0.7, 1.1], synthwave: [0.8, 1.3], hiphop: [0.8, 1.2], rock: [0.9, 1.3], spanish: [0.8, 1.2], sugar: [1.1, 1.6], electro: [0.8, 1.4], dubstep: [0.7, 1.4], brostep: [0.9, 1.6], dnb: [0.6, 1.2] };
const DRIVE: Record<DanceMood, [number, number]> = { funk: [1.2, 2], soul: [1, 1.3], acid: [1.5, 3.5], reggae: [1, 1.4], synthwave: [1, 1.8], hiphop: [1.2, 2.2], rock: [2, 3.2], spanish: [1, 1.4], sugar: [1, 1.6], electro: [2.5, 4], dubstep: [1.2, 2.6], brostep: [2, 4], dnb: [1.8, 3.2] };

/** Pop progressions for the dance genres (sugar uses the jazz ones above). */
const POP_MAJOR: readonly (readonly Step[])[] = [
  [[0, 'add9'], [7, 'maj'], [9, 'min'], [5, 'add9']],     // I V vi IV
  [[9, 'madd9'], [5, 'add9'], [0, 'maj'], [7, 'maj']],    // vi IV I V
  [[5, 'add9'], [7, 'maj'], [9, 'min'], [0, 'add9']],     // IV V vi I
  [[0, 'add9'], [9, 'min'], [5, 'add9'], [7, 'maj']],     // I vi IV V
];
const POP_MINOR: readonly (readonly Step[])[] = [
  [[0, 'madd9'], [8, 'add9'], [3, 'maj'], [10, 'maj']],   // i ♭VI ♭III ♭VII
  [[0, 'min'], [5, 'min'], [8, 'add9'], [7, 'maj']],      // i iv ♭VI V
  [[0, 'madd9'], [10, 'maj'], [8, 'add9'], [10, 'maj']],  // i ♭VII ♭VI ♭VII
  [[8, 'add9'], [10, 'maj'], [0, 'madd9'], [0, 'min']],   // ♭VI ♭VII i i
];

/** Rock's three chords and their cousins. */
const ROCK_MAJOR: readonly (readonly Step[])[] = [
  [[0, 'maj'], [5, 'maj'], [7, 'maj'], [5, 'maj']],       // I IV V IV
  [[0, 'maj'], [10, 'maj'], [5, 'maj'], [0, 'maj']],      // I ♭VII IV I
  [[9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj']],       // vi IV I V
  [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']],       // I V vi IV
];
const ROCK_MINOR: readonly (readonly Step[])[] = [
  [[0, 'min'], [10, 'maj'], [8, 'maj'], [10, 'maj']],     // i ♭VII ♭VI ♭VII
  [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']],      // i ♭VI ♭III ♭VII
  [[0, 'min'], [5, 'min'], [10, 'maj'], [0, 'min']],      // i iv ♭VII i
];
/** Spanish: the Andalusian cadence, falling to a major V, and the rumba's two-chord vamps. */
const SPANISH_MINOR: readonly (readonly Step[])[] = [
  [[0, 'min'], [10, 'maj'], [8, 'maj'], [7, 'maj']],      // i ♭VII ♭VI V
  [[0, 'min'], [5, 'min'], [7, 'maj'], [0, 'min']],       // i iv V i
  [[8, 'maj'], [7, 'maj'], [8, 'maj'], [7, 'maj']],       // ♭VI V vamp
  [[0, 'min'], [10, 'maj'], [8, 'maj'], [7, 'maj']],      // the cadence again, the likeliest
];
const SPANISH_MAJOR: readonly (readonly Step[])[] = [
  [[0, 'maj'], [7, 'maj'], [7, 'maj'], [0, 'maj']],       // I V V I, the rumba catalana
  [[0, 'maj'], [5, 'maj'], [7, 'maj'], [0, 'maj']],       // I IV V I
];
/** The harmonic minor, for a Spanish melody over its major V. */
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];

/** A bass figure: [sixteenth, length in sixteenths, movement (see LofiNote.mod), semitones above the root]. */
type Figure = ReadonlyArray<readonly [number, number, number, number]>;

/** Dubstep wobbles: the filter's rate changes inside the bar, which is what makes a wobble talk. */
const WOBBLES: readonly Figure[] = [
  [[0, 6, 2, 0], [6, 2, 4, 0], [8, 8, 3, 0]],
  [[0, 4, 1, 0], [4, 4, 2, 0], [8, 4, 4, 12], [12, 4, 6, 0]],
  [[0, 8, 2, 0], [8, 4, 3, 7], [12, 2, 4, 0], [14, 2, 6, 12]],
  [[0, 3, 4, 0], [3, 3, 4, 0], [6, 2, 2, 12], [8, 8, 1.5, 0]],
  [[0, 2, 8, 0], [4, 4, 2, 0], [8, 6, 3, 10], [14, 2, 4, 12]],
];
/** Brostep growls: short, fast-moving hits around the kick and the snare, a call and its answer. */
const GROWLS: readonly Figure[] = [
  [[0, 3, 6, 0], [4, 1, 8, 12], [6, 1, 8, 1], [7, 1, 8, 0], [10, 2, 4, 0], [12, 1, 8, 12], [14, 2, 6, 0]],
  [[0, 2, 8, 0], [3, 1, 8, 0], [5, 1, 8, 12], [10, 1, 8, 1], [11, 1, 8, 0], [13, 3, 4, 7]],
  [[0, 4, 3, 0], [6, 1, 8, 12], [7, 1, 8, 10], [10, 1, 8, 0], [11, 1, 8, 0], [12, 4, 2, 12]],
  [[0, 1, 8, 0], [1, 1, 8, 12], [2, 2, 4, 0], [6, 2, 6, 7], [10, 3, 3, 0], [14, 1, 8, 12], [15, 1, 8, 1]],
];
/** Drum and bass: a reese held under the break, or a rolling two-step line. */
const REESES: readonly Figure[] = [
  [[0, 8, 0, 0], [8, 6, 0, 0], [14, 2, 0, 7]],
  [[0, 10, 0, 0], [10, 6, 0, 3]],
  [[0, 6, 0, 0], [6, 4, 0, 7], [10, 6, 0, 0]],
];
const ROLLERS: readonly Figure[] = [
  [[0, 3, 0, 0], [3, 1, 0, 0], [6, 4, 0, 7], [10, 2, 0, 0], [14, 2, 0, 12]],
  [[0, 2, 0, 0], [3, 2, 0, 12], [6, 2, 0, 0], [10, 3, 0, 7], [13, 2, 0, 0]],
];
/** Slap bass: thumbed roots (0), popped octaves (1), dead notes (a quiet thumb), and a walk into the next chord. */
const SLAPS: readonly Figure[] = [
  // Sixteenth-note funk: thumbs, popped octaves, dead notes between, a slide and a bend.
  [[0, 1, 0, 0], [1, 1, 4, 0], [2, 1, 1, 12], [3, 1, 4, 0], [4, 1, 0, 0], [6, 1, 1, 12], [7, 1, 4, 0], [8, 1, 0, 0], [9, 1, 0, 0], [10, 1, 1, 12], [11, 1, 4, 0], [12, 1, 0, 7], [13, 1, 4, 0], [14, 1, 3, 12], [15, 1, 2, 0]],
  [[0, 2, 0, 0], [2, 1, 4, 0], [3, 1, 1, 12], [4, 1, 0, 0], [5, 1, 0, 0], [6, 1, 1, 10], [8, 1, 0, 0], [9, 1, 4, 0], [10, 1, 1, 12], [11, 1, 0, 7], [12, 1, 0, 5], [13, 1, 4, 0], [14, 1, 3, 12]],
  [[0, 1, 2, 0], [1, 1, 4, 0], [2, 1, 0, 0], [3, 1, 1, 12], [5, 1, 4, 0], [6, 1, 0, 0], [7, 1, 1, 12], [8, 1, 0, 4], [9, 1, 4, 0], [10, 1, 1, 15], [12, 1, 0, 7], [13, 1, 1, 12], [14, 1, 4, 0], [15, 1, 0, 10]],
  [[0, 2, 0, 0], [2, 1, 0, 0], [3, 1, 1, 12], [6, 2, 2, 0], [8, 1, 0, 7], [10, 1, 3, 12], [11, 1, 0, 10], [12, 2, 0, 0], [14, 1, 1, 12]],
  [[0, 1, 0, 0], [1, 1, 0, 0], [3, 1, 1, 12], [4, 1, 0, 0], [6, 1, 1, 12], [8, 2, 2, 5], [10, 1, 1, 17], [12, 1, 0, 7], [13, 1, 0, 7], [14, 1, 3, 19]],
  [[0, 3, 0, 0], [3, 1, 1, 12], [5, 1, 0, 0], [7, 1, 1, 12], [8, 1, 0, 0], [9, 1, 0, 0], [10, 2, 3, 12], [12, 1, 0, 3], [13, 1, 0, 4], [14, 1, 1, 12]],
  [[0, 1, 0, 0], [1, 1, 0, 0], [2, 1, 1, 12], [4, 1, 0, 0], [5, 1, 0, 0], [6, 1, 1, 12], [8, 1, 2, 7], [10, 1, 0, 7], [11, 1, 1, 19], [12, 1, 0, 5], [14, 2, 3, 12]],
  [[0, 2, 2, 0], [3, 1, 1, 12], [4, 1, 0, 0], [6, 1, 3, 12], [8, 1, 0, 0], [9, 1, 1, 12], [10, 1, 0, 0], [11, 1, 1, 12], [12, 2, 0, 10], [14, 1, 3, 12]],
];
/** Electro: a distorted riff of sixteenths jumping between the root and its octave, with gaps for the pump. */
const RIFFS: readonly Figure[] = [
  [[0, 1, 0, 0], [1, 1, 0, 12], [2, 1, 0, 0], [4, 1, 0, 12], [6, 1, 0, 0], [7, 1, 0, 12], [8, 1, 0, 0], [10, 1, 0, 12], [12, 2, 0, 10], [14, 2, 0, 12]],
  [[0, 2, 0, 0], [2, 1, 0, 12], [3, 1, 0, 0], [6, 1, 0, 12], [7, 1, 0, 0], [8, 2, 0, 7], [10, 1, 0, 19], [11, 1, 0, 7], [14, 2, 0, 12]],
  [[0, 3, 0, 0], [3, 1, 0, 12], [4, 3, 0, 0], [7, 1, 0, 12], [8, 3, 0, 3], [11, 1, 0, 15], [12, 3, 0, 5], [15, 1, 0, 17]],
];
/** Chiptune bass: a pulse bouncing root, octave and fifth like an old console's bass channel. */
const BLIPS: readonly Figure[] = [
  [[0, 1, 0, 0], [2, 1, 0, 12], [4, 1, 0, 0], [6, 1, 0, 12], [8, 1, 0, 7], [10, 1, 0, 19], [12, 1, 0, 7], [14, 1, 0, 19]],
  [[0, 2, 0, 0], [3, 1, 0, 12], [4, 2, 0, 0], [7, 1, 0, 12], [8, 2, 0, 5], [11, 1, 0, 17], [12, 2, 0, 7], [15, 1, 0, 19]],
];
/** Screeches: long, sliding FM cries between short stabs (mod is how fast the screech moves). */
const SCREECHES: readonly Figure[] = [
  [[0, 4, 6, 12], [6, 2, 12, 13], [10, 6, 3, 12]],
  [[0, 2, 8, 0], [2, 6, 4, 12], [10, 2, 12, 15], [12, 4, 2, 12]],
  [[0, 3, 12, 12], [4, 1, 16, 0], [6, 1, 16, 0], [10, 6, 2, 19]],
];

/** In a band bass figure, these stand for the chord's own third, and for a step into the next chord's root. */
const THIRD = 99;
const APPROACH = 98;
/** Rock bass figures. Each bar draws one for its section, so the line keeps moving. */
const ROCK_DRIVE: readonly Figure[] = [
  [[0, 2, 0, 0], [2, 2, 0, 0], [4, 2, 0, 0], [6, 2, 0, 12], [8, 2, 0, 0], [10, 2, 0, 0], [12, 2, 0, 7], [14, 2, 0, 12]],
  [[0, 1, 0, 0], [1, 1, 0, 0], [2, 2, 0, 0], [4, 1, 0, 0], [5, 1, 0, 0], [6, 2, 0, 0], [8, 1, 0, 0], [9, 1, 0, 0], [10, 2, 0, 12], [12, 2, 0, 7], [14, 2, 0, APPROACH]],
  [[0, 2, 0, 0], [2, 2, 0, 7], [4, 2, 0, 12], [6, 2, 0, 7], [8, 2, 0, 0], [10, 2, 0, THIRD], [12, 2, 0, 7], [14, 2, 0, 12]],
];
const ROCK_GROOVE: readonly Figure[] = [
  [[0, 3, 0, 0], [3, 3, 0, 0], [6, 2, 0, 12], [8, 3, 0, 0], [11, 3, 0, 7], [14, 2, 0, 0]],
  [[0, 6, 0, 0], [6, 2, 0, 0], [8, 6, 0, 7], [14, 2, 0, APPROACH]],
  [[0, 2, 0, 0], [3, 1, 0, 0], [4, 2, 0, THIRD], [6, 2, 0, 7], [8, 4, 0, 0], [12, 2, 0, 12], [14, 2, 0, 7]],
  [[0, 4, 0, 0], [4, 2, 0, 7], [7, 1, 0, 0], [8, 4, 0, 12], [12, 2, 0, 7], [14, 2, 0, THIRD]],
];
/** A phrase's last bar: a walk up through the chord into the next one. */
const ROCK_FILLS: readonly Figure[] = [
  [[0, 2, 0, 0], [2, 2, 0, 0], [4, 2, 0, 0], [6, 2, 0, 0], [8, 2, 0, THIRD], [10, 2, 0, 5], [12, 2, 0, 7], [14, 2, 0, APPROACH]],
  [[0, 4, 0, 0], [4, 2, 0, 12], [6, 2, 0, 10], [8, 2, 0, 7], [10, 2, 0, 5], [12, 2, 0, THIRD], [14, 2, 0, APPROACH]],
];
const ROCKBASS: readonly Figure[] = [...ROCK_DRIVE, ...ROCK_GROOVE];
/** The croak: the modelled string in bubbling repeats, sliding up into notes and bending (mod 2 and 3, as slap). */
const CROAKS: readonly Figure[] = [
  [[0, 1, 0, 0], [1, 1, 0, 0], [2, 1, 2, 0], [4, 1, 0, 12], [5, 1, 0, 0], [6, 2, 3, 0], [8, 1, 0, 0], [9, 1, 0, 0], [10, 1, 2, 7], [12, 1, 0, 0], [13, 1, 0, 12], [14, 2, 3, 0]],
  [[0, 2, 3, 0], [2, 1, 0, 0], [3, 1, 0, 0], [4, 2, 2, 12], [6, 1, 0, 7], [7, 1, 0, 7], [8, 2, 3, 0], [10, 1, 0, 0], [11, 1, 2, 10], [12, 2, 0, 12], [14, 1, 3, 7], [15, 1, 0, 0]],
  [[0, 1, 2, 0], [1, 1, 0, 0], [2, 1, 0, 0], [3, 1, 3, 12], [6, 1, 0, 0], [7, 1, 0, 0], [8, 1, 2, 5], [9, 1, 0, 5], [10, 2, 3, 7], [12, 1, 0, 0], [13, 1, 0, 0], [14, 2, 2, 12]],
];

/** Reggae bass: deep, melodic, and as much about the rests as the notes. */
const RIDDIMS: readonly Figure[] = [
  [[0, 3, 0, 0], [4, 1, 0, 0], [6, 2, 0, 7], [10, 2, 0, 12], [12, 3, 0, 10], [15, 1, 0, 7]],
  [[0, 4, 0, 0], [6, 1, 0, 0], [7, 1, 0, THIRD], [8, 4, 0, 7], [14, 2, 0, APPROACH]],
  [[2, 2, 0, 0], [4, 2, 0, 0], [8, 3, 0, 12], [11, 1, 0, 10], [12, 2, 0, 7], [14, 2, 0, 5]],
];

/** Synthwave bass: octave eighths, the pulse of a night drive. */
const OCTAVES: readonly Figure[] = [
  [[0, 2, 0, 0], [2, 2, 0, 12], [4, 2, 0, 0], [6, 2, 0, 12], [8, 2, 0, 0], [10, 2, 0, 12], [12, 2, 0, 0], [14, 2, 0, 12]],
  [[0, 2, 0, 0], [2, 2, 0, 0], [4, 2, 0, 12], [6, 2, 0, 0], [8, 2, 0, 0], [10, 2, 0, 0], [12, 2, 0, 12], [14, 2, 0, APPROACH]],
];
/** The 808: long notes under the kick, some sliding up into their pitch (mod 2). */
const EIGHTS: readonly Figure[] = [
  [[0, 6, 0, 0], [6, 2, 0, 0], [8, 4, 0, 7], [12, 4, 2, 12]],
  [[0, 8, 0, 0], [10, 2, 0, 0], [12, 4, 2, 7]],
  [[0, 3, 0, 0], [3, 5, 0, 0], [8, 6, 2, 0], [14, 2, 0, 12]],
  [[0, 4, 0, 0], [7, 3, 2, 0], [10, 6, 0, APPROACH]],
];
/** Hip hop's chopped keys: [sixteenth, length in sixteenths]. */
const CHOPS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[0, 5], [6, 2], [10, 4]],
  [[0, 3], [3, 3], [8, 6]],
  [[0, 6], [7, 2], [10, 2], [14, 2]],
];

/** Rumba bass: the root and the fifth, pushed against the cajón. */
const RUMBA: readonly Figure[] = [
  [[0, 3, 0, 0], [3, 3, 0, 7], [6, 2, 0, 12], [8, 3, 0, 0], [11, 3, 0, 7], [14, 2, 0, 12]],
  [[0, 2, 0, 0], [3, 1, 0, 7], [4, 2, 0, 0], [8, 2, 0, 0], [11, 1, 0, 7], [12, 2, 0, 5], [14, 2, 0, 7]],
  [[0, 3, 0, 0], [3, 3, 0, THIRD], [6, 2, 0, 7], [8, 3, 0, 0], [11, 3, 0, 7], [14, 2, 0, APPROACH]],
  [[0, 4, 0, 0], [6, 2, 0, 7], [8, 2, 0, 12], [11, 3, 0, 7], [14, 2, 0, THIRD]],
];
/** Soul bass: melodic and pushing, walking through the chord and stepping into the next one. */
const SOUL: readonly Figure[] = [
  [[0, 3, 0, 0], [3, 1, 0, 0], [4, 2, 0, 7], [6, 1, 0, THIRD], [7, 1, 0, 5], [8, 3, 0, 0], [11, 1, 0, 12], [12, 2, 0, 10], [14, 2, 0, APPROACH]],
  [[0, 2, 0, 0], [2, 1, 0, 12], [3, 1, 0, 0], [6, 2, 0, 7], [8, 2, 0, 0], [10, 1, 0, THIRD], [11, 1, 0, 5], [12, 2, 0, 7], [14, 2, 0, APPROACH]],
  [[0, 4, 0, 0], [4, 1, 0, 7], [5, 1, 0, 9], [6, 2, 0, 12], [8, 2, 0, 10], [10, 2, 0, 7], [12, 2, 0, THIRD], [14, 2, 0, APPROACH]],
];
/** Acid: sixteenths of a 303 line, with accents (mod 1) and slides (mod 2) and octave jumps. */
const ACIDS: readonly Figure[] = [
  [[0, 1, 1, 0], [1, 1, 0, 0], [2, 1, 0, 12], [3, 1, 2, 12], [4, 1, 0, 0], [6, 1, 1, 0], [7, 1, 2, 3], [8, 1, 0, 0], [9, 1, 0, 12], [10, 1, 1, 0], [11, 1, 0, 7], [12, 1, 2, 10], [13, 1, 0, 0], [14, 1, 1, 12], [15, 1, 2, 0]],
  [[0, 2, 1, 0], [2, 1, 2, 12], [3, 1, 0, 0], [5, 1, 1, 0], [6, 1, 0, 3], [7, 1, 2, 5], [8, 2, 1, 0], [10, 1, 0, 12], [11, 1, 2, 10], [12, 1, 0, 7], [13, 1, 1, 0], [14, 2, 2, 12]],
  [[0, 1, 0, 0], [1, 1, 0, 0], [2, 1, 1, 12], [4, 1, 0, 0], [5, 1, 2, 1], [6, 1, 0, 0], [8, 1, 1, 0], [9, 1, 0, 0], [10, 1, 1, 15], [11, 1, 2, 12], [12, 1, 0, 0], [14, 1, 1, 7], [15, 1, 2, 12]],
];

const RUMBA_FILLS: readonly Figure[] = [
  [[0, 2, 0, 0], [2, 2, 0, THIRD], [4, 2, 0, 5], [6, 2, 0, 7], [8, 2, 0, 8], [10, 2, 0, 7], [12, 2, 0, 5], [14, 2, 0, APPROACH]],
];
/** The rumba strum: [sixteenth, stroke], where d is down, u is up and m is a muted slap. */
const RUMBA_STRUM: ReadonlyArray<readonly [number, 'd' | 'u' | 'm']> = [[0, 'd'], [2, 'm'], [3, 'u'], [6, 'd'], [8, 'd'], [10, 'm'], [11, 'u'], [14, 'd']];

/** Future-bass chord stabs for the saw chords in a sugar drop: [sixteenth, length]. */
const STABS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[0, 3], [3, 3], [6, 2], [10, 2], [12, 4]],
  [[0, 2], [2, 2], [4, 3], [7, 3], [10, 2], [12, 2], [14, 2]],
  [[0, 6], [6, 2], [8, 6], [14, 2]],
];

/** A dance tune's style: one of each instrument from its genre's lean, and a clean, bright, pumping chain. */
function drawDanceStyle(rng: () => number, mood: DanceMood, fixed: Partial<LofiStyle>): LofiStyle {
  const lean = DANCE[mood];
  const weighted = <T>(w: Weights<T>): T => weightedPick(rng, w);
  const range = ([lo, hi]: readonly [number, number]): number => lo + rng() * (hi - lo);
  const r2 = (v: number): number => Math.round(v * 100) / 100;
  const drawn: LofiStyle = {
    keys: weighted(lean.keys), lead: weighted(lean.lead), bass: weighted(lean.bass), snare: weighted(lean.snare),
    hats: lean.hats ?? 'hat', groove: lean.groove, comp: 'hold', chordBars: lean.chordBars,
    kick: Math.round(range(lean.kick)), kickLen: r2(range(lean.kickLen)),
    snareTone: Math.round(range([1700, 2600])), hatTone: Math.round(range([8000, 10500])),
    wow: r2(range([0.1, 0.3])), room: r2(range([0.8, 1.2])), tone: r2(range([1.1, 1.25])), duck: r2(range(lean.duck)),
    crunch: rng() < lean.crunch, dust: 0.15,
    bright: r2(range(BRIGHT[mood])), drive: r2(range(DRIVE[mood])),
  };
  return { ...drawn, ...fixed };
}

/** A dance part: as Part, and `alt` plays the second drop's bass figures. */
interface DancePart extends Part { alt?: boolean }

/**
 * A dance tune's running order: an intro of chords and the melody that opens the filter,
 * a build (a snare or clap roll that speeds up under a riser), the drop, a breakdown, a
 * second build and a second drop with its own bass figures, and an outro.
 */
/** How a tune can open: on the keys, the beat alone, the bass and the beat, a lead alone, or the whole band. */
type IntroStyle = 'keys' | 'beat' | 'bass' | 'lead' | 'full';
const INTROS: Record<DanceMood, Weights<IntroStyle>> = {
  sugar: [['keys', 2], ['beat', 2], ['bass', 2], ['lead', 1]],
  hiphop: [['beat', 3], ['keys', 2], ['full', 1]],
  reggae: [['full', 1]],   // reggae drops straight into the groove
  funk: [['beat', 2], ['bass', 3], ['full', 1]],
  soul: [['keys', 2], ['full', 2], ['beat', 1]],
  acid: [['bass', 3], ['beat', 2]],
  spanish: [['keys', 3], ['beat', 2], ['lead', 1]],
  rock: [['full', 2], ['beat', 1], ['keys', 2]],
  synthwave: [['keys', 2], ['bass', 2], ['beat', 1], ['lead', 1]],
  electro: [['beat', 2], ['bass', 2], ['keys', 1]],
  dubstep: [['keys', 2], ['lead', 2], ['beat', 1]],
  brostep: [['keys', 2], ['beat', 1], ['lead', 1]],
  dnb: [['keys', 2], ['beat', 3], ['bass', 1]],
};

function arrangeDance(rng: () => number, lean: DanceLean, mood: DanceMood): DancePart[] {
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rng() * a.length)] as T;
  const drums: readonly LofiLayer[] = ['kick', 'snare', 'hats'];
  const parts: DancePart[] = [];
  const intro = weightedPick(rng, INTROS[mood]);
  if (lean.band) {
    // A band's song: an intro on the guitar (the rock band joins it), verse, a pre-chorus
    // that turns with a drum fill, the chorus on a crash, a solo, a last pre-chorus and
    // chorus, and an ending that rings out.
    const band: readonly LofiLayer[] = ['keys', 'bass', 'lead', 'fx', ...drums];
    const opening: Record<IntroStyle, readonly LofiLayer[]> = {
      keys: ['keys'], beat: ['fx', ...drums], bass: ['bass', 'fx', ...drums], lead: ['lead', 'keys'], full: ['keys', 'bass', 'fx', ...drums],
    };
    parts.push({ section: 'intro', bars: lean.intro, prog: 0, layers: opening[intro], open: intro === 'full' ? [0.95, 1] : [0.6, 0.95] });
    parts.push({ section: 'verse', bars: 8, prog: 0, layers: band });
    parts.push({ section: 'build', bars: pick(lean.build), prog: 0, layers: band, open: [0.85, 1] });
    parts.push({ section: 'drop', bars: lean.drop, prog: 1, layers: band });
    parts.push({ section: 'break', bars: lean.breakdown, prog: 0, layers: band, feature: 'lead' });
    parts.push({ section: 'build', bars: pick(lean.build), prog: 0, layers: band, open: [0.85, 1] });
    parts.push({ section: 'drop', bars: lean.drop, prog: 1, layers: band, alt: true });
    parts.push({ section: 'outro', bars: 4, prog: 0, layers: ['keys', 'bass', 'fx', ...drums], open: [0.9, 0.7] });
    parts.push({ section: 'outro', bars: 2, prog: 0, layers: ['keys'], open: [0.6, 0.4], fade: true });
    return parts;
  }
  // The intro in two halves: what opens the tune, then the parts that join the opening.
  const half = lean.intro / 2;
  const withKick: readonly LofiLayer[] = mood === 'sugar' || mood === 'electro' || mood === 'dnb' || mood === 'synthwave' ? ['kick'] : [];
  const plan: Record<IntroStyle, [readonly LofiLayer[], readonly LofiLayer[]]> = {
    keys: [['keys', 'lead'], ['keys', 'lead', 'hats', 'fx', ...withKick]],
    beat: [['kick', 'snare', 'hats'], ['kick', 'snare', 'hats', 'keys', 'fx']],
    bass: [['bass', 'kick', 'hats'], ['bass', 'kick', 'snare', 'hats', 'keys', 'lead', 'fx']],
    lead: [['lead'], ['lead', 'keys', 'hats', 'fx']],
    full: [['keys', 'bass', 'kick', 'snare', 'hats'], ['keys', 'bass', 'lead', 'kick', 'snare', 'hats', 'fx']],
  };
  const [first, then] = plan[intro];
  parts.push({ section: 'intro', bars: half, prog: 0, layers: first, open: intro === 'keys' || intro === 'lead' ? [0.35, 0.6] : [0.6, 0.8] });
  parts.push({ section: 'intro', bars: half, prog: 0, layers: then, open: [0.6, 0.9] });
  if (mood === 'sugar' || mood === 'electro') parts.push({ section: 'verse', bars: 8, prog: 0, layers: ['keys', 'bass', 'lead', 'fx', ...drums] });
  const drop = (alt: boolean): void => {
    parts.push({ section: 'build', bars: pick(lean.build), prog: 0, layers: ['keys', 'lead', 'snare', 'fx', ...(mood === 'sugar' || mood === 'electro' || mood === 'dnb' ? ['kick' as const] : [])], open: [0.55, 1] });
    if (lean.singingDrop) {
      parts.push({ section: 'drop', bars: lean.drop, prog: 1, layers: ['keys', 'bass', 'lead', 'fx', ...drums], alt });
    } else {
      // The drop opens on the bass and the drums; the melody joins halfway.
      parts.push({ section: 'drop', bars: lean.drop / 2, prog: 1, layers: ['bass', 'fx', ...drums], alt });
      parts.push({ section: 'drop', bars: lean.drop / 2, prog: 1, layers: ['bass', 'lead', 'fx', ...drums], alt });
    }
  };
  drop(false);
  parts.push({ section: 'break', bars: lean.breakdown, prog: 0, layers: mood === 'sugar' ? ['keys', 'lead', 'fx'] : ['keys', 'lead'], open: [0.8, 0.6] });
  drop(true);
  parts.push({ section: 'outro', bars: 4, prog: 0, layers: ['keys', 'lead', 'kick', 'hats'], open: [0.9, 0.7] });
  parts.push({ section: 'outro', bars: 4, prog: 0, layers: ['keys'], open: [0.6, 0.3], fade: true });
  return parts;
}

/** Build one dance tune's bars (see composeLofiTune; this is the dance genres' path). */
function composeDanceTune(seed: number, mood: DanceMood, fixed: Partial<LofiStyle>): LofiBar[] {
  const rng = mulberry32(seed >>> 0);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rng() * a.length)] as T;
  const chance = (p: number): boolean => rng() < p;
  const lean = DANCE[mood];
  const key = Math.floor(rng() * 12);
  const minor = rng() < lean.minor;
  const style = drawDanceStyle(rng, mood, fixed);
  const bpm = Math.round(lean.bpm[0] + rng() * (lean.bpm[1] - lean.bpm[0]));
  const POOLS = { jazz: [MAJOR, MINOR], pop: [POP_MAJOR, POP_MINOR], rock: [ROCK_MAJOR, ROCK_MINOR], spanish: [SPANISH_MAJOR, SPANISH_MINOR] } as const;
  const pool = POOLS[lean.harmony][minor ? 1 : 0];
  const jazz = lean.harmony === 'jazz';
  const progA = jazz ? vary(pick(pool), chance) : [...pick(pool)];
  let base = pick(pool);
  for (let tries = 0; base === progA && tries < 4; tries++) base = pick(pool);
  const progB = jazz ? vary(base, chance) : [...base];
  const chords = [progA.map(s => chordOf(key, s)), progB.map(s => chordOf(key, s))];
  const scale = lean.harmony === 'spanish' && minor ? HARMONIC_MINOR : minor ? PENTA_MINOR : PENTA_MAJOR;
  const penta = scale.map(i => (key + i) % 12);
  const parts = arrangeDance(rng, lean, mood);
  const total = parts.reduce((s, p) => s + p.bars, 0) + 1;
  const info: LofiTuneInfo = {
    seed: seed >>> 0, mood, bpm, swing: lean.swing, swing8: 0.5, style,
    key: `${NAMES[key]} ${minor ? 'minor' : 'major'}`,
    progressions: [chords[0]!.map(c => c.name), chords[1]!.map(c => c.name)],
    bars: total,
  };

  const kickSteps = pick(KICKS[style.groove]);
  // Instruments by section: softer keys in the quiet parts, a second lead in the breakdown
  // and the second drop, and the second drop's bass switch-up.
  const other = <T>(w: Weights<T>, not: T): T => {
    const rest = w.filter(([v]) => v !== not);
    return rest.length ? weightedPick(rng, rest) : not;
  };
  const softKeys = other(lean.softKeys, style.keys);
  const leadB = other(lean.lead, style.lead);
  // More variety: most intros get a lead of their own, and some drops double the melody
  // with another instrument (a metal guitar under a chip lead, a flute over a guitar).
  const leadIntro = rng() < 0.6 ? other(lean.lead.filter(([v]) => v !== leadB), style.lead) : style.lead;
  const doubleA = rng() < 0.4 ? other(lean.lead.filter(([v]) => v !== leadB), style.lead) : undefined;
  const doubleB = rng() < 0.35 ? other(lean.lead.filter(([v]) => v !== style.lead), leadB) : undefined;
  const verseBass = weightedPick(rng, lean.verseBass);
  const bassB = weightedPick(rng, lean.switchBass);
  // A reese holds a note under the break, or rolls along with the drums.
  const figuresOf = (b: LofiStyle['bass']): readonly Figure[] => b === 'wobble' ? WOBBLES : b === 'growl' ? GROWLS : b === 'slap' ? SLAPS
    : b === 'electro' ? RIFFS : b === 'pulse' ? BLIPS : b === 'screech' ? SCREECHES : b === 'picked' ? ROCKBASS : b === 'croak' ? CROAKS : b === 'upright' ? RUMBA : b === 'eight' ? EIGHTS : b === 'synth' ? OCTAVES : b === 'round' ? RIDDIMS : b === 'motown' ? SOUL : b === 'acid' ? ACIDS
    : [...REESES, ...ROLLERS];
  // Two bars of bass figure for each drop and for the verse, a call and its answer.
  const figA: [Figure, Figure] = [pick(figuresOf(style.bass)), pick(figuresOf(style.bass))];
  const figB: [Figure, Figure] = [pick(figuresOf(bassB)), pick(figuresOf(bassB))];
  const figVerse: [Figure, Figure] = [pick(figuresOf(verseBass)), pick(figuresOf(verseBass))];
  const voicesOf = (part: DancePart): LofiBar['voices'] => {
    if (part.section === 'intro') return { keys: softKeys, lead: leadIntro };
    if (part.section === 'outro') return { keys: softKeys };
    if (part.section === 'break') return lean.band ? undefined : { keys: softKeys, lead: leadB };   // a band's break is the solo
    if (part.section === 'verse') return { bass: verseBass };
    if (part.section === 'drop' && part.alt) return { lead: leadB, bass: bassB, ...(doubleB ? { double: doubleB } : {}) };
    if (part.section === 'drop' && doubleA) return { double: doubleA };
    return undefined;
  };
  const stabs = pick(STABS);
  const chops = pick(CHOPS);
  const motifs = [motif(rng, lean.busy), motif(rng, lean.busy), motif(rng, Math.min(1, lean.busy + 0.3))];
  let prevVoicing: number[] | null = null;
  let prevLead = 74;
  const sb = (step: number): number => stepBeat(step, lean.swing);
  // The coin's ding: the key's fifth, high, then the key's root a fourth higher.
  const coin = placeIn((key + 7) % 12, 79, 90);

  const bars: LofiBar[] = [];
  let index = 0;
  const outroStart = parts.findIndex(p => p.section === 'outro');
  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi]!;
    const prog = chords[part.prog]!;
    const has = (l: LofiLayer): boolean => part.layers.includes(l);
    const firstOfSection = pi === 0 || parts[pi - 1]!.section !== part.section;
    const voices = voicesOf(part);
    const keysV = voices?.keys ?? style.keys;
    const bassV = voices?.bass ?? style.bass;
    for (let i = 0; i < part.bars; i++, index++) {
      const slot = Math.floor(i / style.chordBars);
      const firstOfChord = i % style.chordBars === 0;
      const chord = prog[slot % prog.length]!;
      const nextChord = prog[(slot + 1) % prog.length]!;
      const notes: LofiNote[] = [];
      const [o0, o1] = part.open ?? [1, 1];
      const open = o0 + (o1 - o0) * (part.bars > 1 ? i / (part.bars - 1) : 1);
      let level = 1;
      if (part.section === 'outro') {
        const into = parts.slice(outroStart, pi).reduce((s, p) => s + p.bars, 0) + i;
        level = part.fade || into > 0 ? 1 - (into + 1) * 0.11 : 1;
      }
      const build = part.section === 'build';
      const lastOfBuild = build && i === part.bars - 1;
      const dropStart = part.section === 'drop' && firstOfSection && i === 0;

      // KEYS: held chords, or (in a sugar drop) saw-chord stabs that pump with the kick.
      if (firstOfChord || i === 0) prevVoicing = voiceLead(voicingClasses(chord), prevVoicing);
      const voicing = prevVoicing ?? [];
      if (has('keys')) {
        const strike = (beat: number, len: number, vel: number): void => {
          for (const p of voicing) notes.push({ voice: 'keys', midi: p, beat, dur: len, vel: clamp01(vel + (rng() - 0.5) * 0.06) });
        };
        if (keysV === 'crunch') {
          // Power chords on the root (the voice builds the chord): eighth-note chugs, a
          // ringing chord at the top of a chorus bar, quarter-note hits in a pre-chorus.
          const root = placeIn(chord.root, 52, 63);
          if (build) {
            for (const s of [0, 4, 8, 12]) notes.push({ voice: 'keys', midi: root, beat: s / 4, dur: 0.85, vel: 0.7 });
          } else if (part.section === 'drop' && i % 2 === 0) {
            notes.push({ voice: 'keys', midi: root, beat: 0, dur: 1.9, vel: 0.8 });
            for (const s of [8, 10, 12, 14]) notes.push({ voice: 'keys', midi: root, beat: sb(s), dur: 0.4, vel: 0.62 });
          } else {
            for (let s = 0; s < 16; s += 2) notes.push({ voice: 'keys', midi: root, beat: sb(s), dur: 0.38, vel: s % 4 === 0 ? 0.7 : 0.58 });
          }
        } else if (keysV === 'nylon') {
          // The rumba strum: each stroke rolls across the strings (down-strokes from the
          // lowest string, up-strokes from the highest), with muted slaps between. A
          // pre-chorus is a rasgueado, a strum on every sixteenth; under a solo, only the beats.
          const strokes: ReadonlyArray<readonly [number, 'd' | 'u' | 'm']> = build
            ? Array.from({ length: 16 }, (_, s) => [s, s % 2 ? 'u' : 'd'] as const)
            : part.section === 'break' ? [[0, 'd'], [8, 'd']] : RUMBA_STRUM;
          // A guitar strums the whole chord: the root, the chord's other tones higher up, the octave.
          const low = placeIn(chord.root, 52, 63);
          const shape = [low, ...chord.tones.slice(1).map(pc => placeIn(pc, low + 1, low + 12)), low + 12].filter(p => p <= 76).sort((x, y) => x - y);
          for (const [step, stroke] of strokes) {
            const order = stroke === 'u' ? [...shape].reverse() : shape;
            const muted = stroke === 'm';
            const vel = muted ? 0.3 : build ? 0.35 + (i * 16 + step) / (part.bars * 16) * 0.4 : stroke === 'd' ? 0.6 : 0.48;
            order.forEach((p, n) => { notes.push({ voice: 'keys', midi: p, beat: sb(step) + n * 0.03, dur: muted ? 0.08 : 0.45, vel: clamp01(vel + (rng() - 0.5) * 0.06) }); });
          }
        } else if (mood === 'synthwave' && keysV === 'pluck' && part.section !== 'intro' && part.section !== 'outro') {
          // Synthwave's arpeggio: the chord's tones up and down in sixteenths.
          const arp = [...voicing, ...[...voicing].reverse().slice(1, -1)];
          for (let s = 0; s < 16; s++) notes.push({ voice: 'keys', midi: arp[s % arp.length]!, beat: s / 4, dur: 0.22, vel: s % 4 === 0 ? 0.55 : 0.4 });
        } else if (keysV === 'wah') {
          // Funk guitar: chanks on the sixteenths, the top of the chord with a wah on each,
          // muted scratches between.
          const top = voicing.slice(-3);
          for (let s = 0; s < 16; s++) {
            const chank = [0, 3, 6, 8, 10, 13, 14].includes(s);
            if (chank) for (const p of top) notes.push({ voice: 'keys', midi: p, beat: sb(s), dur: 0.14, vel: s % 4 === 0 ? 0.6 : 0.5 });
            else if (chance(0.3)) notes.push({ voice: 'keys', midi: top[0]!, beat: sb(s), dur: 0.05, vel: 0.25 });
          }
        } else if (mood === 'reggae' && part.section !== 'intro' && part.section !== 'outro') {
          // The skank: short chops on every offbeat, and the organ's bubble, a quiet chord
          // on the sixteenths either side of them.
          for (const s of [2, 6, 10, 14]) strike(sb(s), 0.16, 0.55);
          if (part.section === 'drop') for (const s of [1, 3, 9, 11]) strike(sb(s), 0.1, 0.25);
        } else if (mood === 'hiphop' && part.section !== 'intro' && part.section !== 'outro') {
          // Hip hop's chops: the chord cut into a few hits, like a sampled record.
          for (const [step, len] of chops) strike(sb(step), len / 4 - 0.05, step === 0 ? 0.6 : 0.5);
        } else if (part.section === 'drop' && keysV === 'supersaw') {
          for (const [step, len] of stabs) strike(sb(step), len / 4 - 0.05, step === 0 ? 0.62 : 0.5);
        } else if (part.section === 'drop' && (keysV === 'rhodes' || keysV === 'pluck')) {
          for (const step of [2, 6, 10, 14]) if (step !== 6 || chance(0.6)) strike(sb(step), 0.4, 0.42);   // offbeat stabs
        } else if (firstOfChord || i === 0) {
          const left = (style.chordBars - (i % style.chordBars)) * 4;
          strike(0, (lastOfBuild ? 3.5 : left) - 0.1, part.section === 'intro' ? 0.5 : 0.56);
        }
      }

      // BASS: the genre's figure, a call and its answer, on the chord's root.
      if (has('bass')) {
        const root = ['slap', 'pulse', 'electro', 'picked', 'croak', 'upright', 'synth', 'round', 'motown', 'acid'].includes(bassV) ? placeIn(chord.root, 33, 44) : placeIn(chord.root, 28, 39);
        let fig = (part.section === 'verse' ? figVerse : part.alt ? figB : figA)[i % 2]!;
        if (lean.band) {
          // A band's bass draws a figure every bar, by section, and fills into the next
          // phrase on most fourth bars, so the line never settles into one loop.
          const rock = bassV === 'picked';
          const fills = rock ? ROCK_FILLS : bassV === 'upright' ? RUMBA_FILLS : figuresOf(bassV);
          const pool = rock
            ? (part.section === 'verse' ? ROCK_GROOVE : part.section === 'drop' || part.section === 'break' ? [...ROCK_DRIVE, ROCK_GROOVE[0]!] : ROCK_DRIVE)
            : figuresOf(bassV);
          fig = i % 4 === 3 && chance(0.7) ? pick(fills) : pick(pool);
        }
        const third = (((chord.tones[1] ?? chord.root) - chord.root) % 12 + 12) % 12;
        const nextRoot = placeIn(nextChord.root, 33, 44);
        for (let n = 0; n < fig.length; n++) {
          const [step, len, mod, above] = fig[n]!;
          // A step into the next chord: a semitone below or above its root, or the fifth when the chord stays.
          let midi = above === THIRD ? root + third
            : above === APPROACH ? (nextChord.root === chord.root ? root + 7 : nextRoot + (nextRoot > root ? -1 : 1))
            : root + above;
          // A slap line's last note walks a semitone into the next chord's root.
          if (bassV === 'slap' && n === fig.length - 1 && i % style.chordBars === style.chordBars - 1 && nextChord.root !== chord.root) {
            const target = placeIn(nextChord.root, 33, 44);
            midi = target + (target > root ? -1 : 1);
          }
          const dead = bassV === 'slap' && mod === 4;
          notes.push({ voice: 'bass', midi, beat: sb(step), dur: len / 4 - 0.02, vel: dead ? 0.5 : step === 0 ? 0.92 : 0.8, mod });
        }
      }

      // LEAD: the motif and its answer, as in the other tunes, kept to the lead's range.
      if (has('lead')) {
        const mo = motifs[part.section === 'drop' || (lean.band && part.section === 'break') ? 2 : part.prog]!;
        const answer = i % 2 === 1;
        const motifBar = mo[i % 2]!;
        for (let n = 0; n < motifBar.length; n++) {
          const { step, move, len } = motifBar[n]!;
          let pitch = stepScale(prevLead, answer && n === motifBar.length - 1 ? -Math.abs(move) : move, penta);
          if (step % 8 === 0 || n === motifBar.length - 1) pitch = nearestTone(pitch, chord.tones);
          while (pitch < 64) pitch += 12;
          while (pitch > 84) pitch -= 12;
          prevLead = pitch;
          if (lastOfBuild && step >= 14) continue;   // the breath before the drop
          notes.push({ voice: 'lead', midi: pitch, beat: sb(step), dur: len / 4, vel: clamp01(0.56 + (rng() - 0.5) * 0.12) });
        }
      }

      // DRUMS
      const backbeat = style.snare === 'clap' ? 'snare' : 'snare';
      if (build && !lean.band) {
        // The roll: quarters, then eighths, then sixteenths, louder all the way, and a
        // thirty-second burst at the very end; the last half beat is left empty.
        if (has('snare')) {
          const left = part.bars - i;
          const every = left > part.bars / 2 ? 4 : left > 1 ? 2 : 1;
          for (let s = 0; s < 16; s += every) {
            if (lastOfBuild && s >= 14) break;
            const progress = (i + s / 16) / part.bars;
            notes.push({ voice: backbeat, midi: 0, dur: 0, beat: s / 4, vel: clamp01(0.3 + progress * 0.6) });
            if (lastOfBuild && s >= 12) notes.push({ voice: backbeat, midi: 0, dur: 0, beat: s / 4 + 0.125, vel: clamp01(0.3 + progress * 0.6) });
          }
        }
        if (has('kick') && i < part.bars - 1) for (const s of [0, 4, 8, 12]) notes.push({ voice: 'kick', midi: 0, dur: 0, beat: s / 4, vel: 0.8 });
        if (i === 0 && has('fx')) notes.push({ voice: 'riser', midi: 60, dur: part.bars * 4 - 0.5, beat: 0, vel: 0.8 });
      } else {
        if (has('kick')) {
          const steps = part.section === 'intro' ? [0, 8] : kickSteps;
          for (const s of steps) notes.push({ voice: 'kick', midi: 0, dur: 0, beat: sb(s), vel: s === 0 ? 0.95 : 0.82 });
        }
        if (has('snare') && style.groove === 'rumba') {
          // Palmas: claps on two and four, softer claps between, and the cajón's slap.
          for (const s of [4, 12]) notes.push({ voice: 'snare', midi: 0, dur: 0, beat: sb(s), vel: 0.9 });
          for (const s of [2, 6, 10, 14]) if (s === 6 || s === 14 || chance(0.6)) notes.push({ voice: 'snare', midi: 0, dur: 0, beat: sb(s), vel: 0.4 });
          for (const s of [7, 15]) notes.push({ voice: 'rim', midi: 0, dur: 0, beat: sb(s), vel: 0.6 });
        } else if (has('snare') && style.groove === 'oneDrop') {
          // The one drop: the cross-stick with the kick on three, and now and then a ghost.
          notes.push({ voice: 'rim', midi: 0, dur: 0, beat: sb(8), vel: 0.9 });
          if (chance(0.3)) notes.push({ voice: 'rim', midi: 0, dur: 0, beat: sb(14), vel: 0.4 });
        } else if (has('snare')) {
          const hits = style.groove === 'halfStep' ? [8] : [4, 12];
          for (const s of hits) notes.push({ voice: backbeat, midi: 0, dur: 0, beat: s / 4, vel: 0.95 });
          if (style.groove === 'twoStep') for (const s of [7, 9, 14]) if (chance(0.35)) notes.push({ voice: 'snare', midi: 0, dur: 0, beat: sb(s), vel: 0.25 });
          if (style.groove === 'funk') for (const s of [5, 7, 9, 11, 13, 15]) if (chance(0.3)) notes.push({ voice: 'snare', midi: 0, dur: 0, beat: sb(s), vel: 0.18 });
          if (style.groove === 'disco' && chance(0.45)) notes.push({ voice: 'snare', midi: 0, dur: 0, beat: sb(chance(0.5) ? 14 : 15), vel: 0.6 });   // the extra clap
          if (mood === 'brostep' && chance(0.4)) notes.push({ voice: 'snare', midi: 0, dur: 0, beat: sb(15), vel: 0.45 });
        }
        if (has('hats')) {
          for (let s = 0; s < 16; s += 2) {
            const off = s % 4 === 2;
            if (style.groove === 'disco' && off) { notes.push({ voice: 'openHat', midi: 0, dur: 0, beat: sb(s), vel: 0.5 }); continue; }
            notes.push({ voice: 'hat', midi: 0, dur: 0, beat: sb(s), vel: clamp01((off ? 0.48 : 0.32) + (rng() - 0.5) * 0.08) });
            if (style.groove === 'funk' || chance(style.groove === 'twoStep' ? 0.35 : 0.15)) notes.push({ voice: 'hat', midi: 0, dur: 0, beat: sb(s + 1), vel: 0.22 });
          }
          // Hip hop's trap roll: thirty-second hats across the last beat of a phrase.
          if (mood === 'hiphop' && i % 4 === 3 && chance(0.7)) for (let n = 0; n < 8; n++) notes.push({ voice: 'hat', midi: 0, dur: 0, beat: 3 + n / 8, vel: clamp01(0.22 + n * 0.04) });
          // Dubstep's triplet hat roll, now and then at the end of a phrase.
          if (style.groove === 'halfStep' && i % 4 === 3 && chance(0.5)) for (let n = 0; n < 6; n++) notes.push({ voice: 'hat', midi: 0, dur: 0, beat: 3 + n / 6, vel: clamp01(0.25 + n * 0.06) });
        }
        if (dropStart && has('fx')) notes.push({ voice: 'crash', midi: 0, dur: 0, beat: 0, vel: 0.95 });
        else if (part.section === 'drop' && i % 8 === 0 && i > 0 && has('fx')) notes.push({ voice: 'crash', midi: 0, dur: 0, beat: 0, vel: 0.6 });
        else if ((mood === 'sugar' || mood === 'electro' || lean.band) && firstOfSection && i === 0 && part.section !== 'intro' && part.section !== 'build' && has('fx')) notes.push({ voice: 'crash', midi: 0, dur: 0, beat: 0, vel: 0.7 });
        // A band's pre-chorus turns into the chorus with a fill across the last two beats.
        if (build && lean.band && lastOfBuild && has('snare')) {
          for (let s = 8; s < 16; s++) notes.push({ voice: 'snare', midi: 0, dur: 0, beat: s / 4, vel: clamp01(0.45 + (s - 8) * 0.06) });
        }
        // Sugar's coin dings at the end of a phrase, and now and then a magpie warbling
        // (Lolly's bird) where the music leaves room: an intro, a verse, the breakdown.
        if (mood === 'sugar' && has('fx') && i % 4 === 3 && chance(0.7)) notes.push({ voice: 'coin', midi: coin, dur: 0.5, beat: sb(chance(0.5) ? 12 : 14), vel: 0.6 });
        // The shout: a "hey" calling the next phrase in a sugar drop, and on the offbeat in a
        // reggae chorus (always at its top).
        const hey = placeIn(key, 55, 66);
        if (mood === 'sugar' && part.section === 'drop' && has('fx') && i % 4 === 3 && chance(0.5)) notes.push({ voice: 'hey', midi: hey, dur: 0.3, beat: sb(14), vel: 0.7 });
        if (mood === 'reggae' && part.section === 'drop' && ((i === 0 && firstOfSection) || (i % 4 === 1 && chance(0.4)))) notes.push({ voice: 'hey', midi: hey, dur: 0.3, beat: sb(i === 0 ? 2 : 6), vel: 0.65 });
        const quiet = part.section === 'intro' || part.section === 'verse' || part.section === 'break';
        if (mood === 'sugar' && quiet && i % 4 === 1 && chance(0.4)) {
          notes.push({ voice: 'magpie', midi: placeIn((key + 7) % 12, 84, 95), dur: 1.5 + rng() * 1.5, beat: sb(chance(0.5) ? 4 : 8), vel: 0.55, mod: Math.floor(rng() * 1000) });
        }
      }

      notes.sort((a, b) => a.beat - b.beat);
      bars.push({ tune: info, index, section: part.section, layers: part.layers, chord: chord.name, tones: chord.tones, notes, open, level, ...(voices ? { voices } : {}) });
    }
  }
  bars.push({ tune: info, index, section: 'rest', layers: [], chord: '', tones: [], notes: [], open: 0.3, level: 0 });
  return bars;
}

// ── melody helpers ────────────────────────────────────────────────────────

interface MotifNote { step: number; move: number; len: number }

/** A two-bar rhythm and contour: a few notes on the eighths, the odd sixteenth, rests between. */
function motif(rng: () => number, busy: number): [MotifNote[], MotifNote[]] {
  const bar = (answer: boolean): MotifNote[] => {
    const count = 2 + Math.floor(rng() * (2 + busy * 3));
    const steps = new Set<number>();
    while (steps.size < count) {
      const s = Math.floor(rng() * 8) * 2 + (rng() < 0.15 ? 1 : 0);
      if (s < (answer ? 12 : 16)) steps.add(s);
    }
    const sorted = [...steps].sort((a, b) => a - b);
    return sorted.map((step, n) => ({
      step,
      move: [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)]!,
      len: Math.min(8, ((sorted[n + 1] ?? 16) - step)) * (n === sorted.length - 1 ? 1 : 0.9),
    }));
  };
  return [bar(false), bar(true)];
}

/** Move `steps` places along the scale (pitch classes) from `from`. */
function stepScale(from: number, steps: number, scale: number[]): number {
  let p = from;
  const dir = Math.sign(steps);
  for (let n = 0; n < Math.abs(steps); n++) {
    do p += dir; while (!scale.includes(((p % 12) + 12) % 12));
  }
  if (steps === 0 && !scale.includes(((p % 12) + 12) % 12)) return stepScale(from, 1, scale);
  return p;
}

/** The nearest pitch to `p` whose class is one of `tones`. */
function nearestTone(p: number, tones: number[]): number {
  for (let d = 0; d <= 6; d++) {
    for (const q of [p - d, p + d]) if (tones.includes(((q % 12) + 12) % 12)) return q;
  }
  return p;
}

/** A pitch class placed between lo and hi. */
function placeIn(pc: number, lo: number, hi: number): number {
  let p = lo + ((pc - lo) % 12 + 12) % 12;
  if (p > hi) p -= 12;
  return p;
}

function clamp01(v: number): number { return Math.max(0.05, Math.min(1, v)); }

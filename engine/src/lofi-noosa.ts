// SPDX-License-Identifier: MPL-2.0
/**
 * Noosacore: the sound of Noosa today, a coastal town where many cultures meet. A sunny,
 * laid-back groove carried by a warm, rolling bass and by its effects, mixing surf guitar from
 * California, the didgeridoo, botanica's airy pads and acoustic instruments, the bush birds and
 * the sounds of the coast, a confident fusion rather than a heritage piece (Andy, 2026-11-14:
 * "noosacore is of noosa today and all the multi-cultural influences"). This is its composer,
 * the path lofi-compose.ts's composeLofiTune takes for the style. Like every path there it
 * writes notes and never sound, and is pure and deterministic.
 *
 * The style's traits (Andy, 2026-11-14: "a mix of botanica straya and touches of surf rock
 * with wave sounds bird sounds surf guitar in odd moments and most of it carried by bass and
 * effects"):
 * - The bass is the song. A round, warm line rolls through every groove: the root pushed, the
 *   octave answered, a walk through the chord, a passing note into the next chord, a run at the
 *   end of a phrase. It plays louder and busier than anything else in the band.
 * - The effects tell the story, and the coast is their setting. The sea breaks on the shore
 *   under the whole tune (lofi-waves-notes.ts): off the point, where the surf comes in sets, or
 *   at the river mouth, where only small waves lap; the shore's roar always, a wave every seven
 *   to eleven seconds and never evenly, a big one crashing on the first beat of each swell (the
 *   style's chorus), the waves coming forward in the lull (its break). In most tunes a breeze
 *   sings in the she-oaks on the dunes, and on some warm afternoons cicadas call. Botanica's glitches weather the edges:
 *   a tape stop into the second swell, a frozen chord opening the lull, a repeat at a phrase's
 *   end, a pad swelling backwards into a downbeat, a phaser drifting over the lull.
 * - From botanica, its granular pads (`grain` notes cut from a guitar, a voice, breath, a harp
 *   or a flute) and its rolled, ringing chords on a Rhodes, an acoustic, a nylon guitar or a harp.
 * - From Straya, the magpie: a quiet warble at a phrase's end where the band leaves room, and
 *   in most tunes a featured carol at an airy moment (the top of the tune, or the lull). Now
 *   and then a kookaburra laughs as the tune winds down.
 * - The didgeridoo, in some tunes: a soft drone under the intro, the lull and the ending (the
 *   mouth opening and closing on it and the breath), and in some of those one bar of rhythm
 *   over the second swell. Its toot comes only there, rising out of the drone with the band
 *   full and loud around it, never bare.
 * - From surf rock, the guitar through its spring reverb, in odd moments only: one to three
 *   licks a tune (a tremolo-picked note, a glissando down the neck, a run down the pentatonic
 *   shaken with the arm, a call and its held answer), each a bar or two, never a lead that
 *   runs through the tune.
 *
 * Running order: the shore alone, then the pads and the bass (the intro); the groove (verse);
 * the swell (the drop, a set wave breaking on its first beat); the lull (the drums and the bass
 * out, the sea and the birds in front); in most tunes a short build; the second swell; and the
 * band leaving the shore as the tune found the shore.
 *
 * Every draw comes from streams of the style's own, so no other style's tune moved when it
 * arrived. The helpers it shares with the other paths arrive as a kit (see NoosaKit), so this
 * module imports nothing from lofi-compose.ts at run time.
 */
import type { LofiBar, LofiLayer, LofiNote, LofiSection, LofiStyle, LofiTuneInfo } from './lofi-compose.ts';
import { glitchMod, grainMod, natureMod, BOTANICA_INSECTS, BOTANICA_SOURCES, type BotanicaChord, type BotanicaCloud, type BotanicaSource } from './lofi-botanica.ts';
import { DIDGE_BREATH, DIDGE_DRONE, DIDGE_MID, DIDGE_ROLE, DIDGE_SWEEP, DIDGE_TONGUE, DIDGE_TOOT, DIDGE_WA, LOFI_BIRD_FEATURE, LOFI_BIRD_FLOCK } from './lofi-straya.ts';
import { swellBeats, waveMod, waveSeries, WAVE_WASH } from './lofi-waves-notes.ts';
import { lorikeetMod, whipbirdMod, type LorikeetKind } from './lofi-coast-birds.ts';
import { mulberry32 } from './zzfx-compose.ts';

// ── the kit the composer lends ──────────────────────────────────────────────

type Weights<T> = ReadonlyArray<readonly [T, number]>;
/** The pieces of lofi-compose.ts this path shares, handed in so neither module imports the other at run time. */
export interface NoosaKit {
  /** The chord on `degree` semitones above `key`, of `quality` (a QUALITIES name). */
  chord(key: number, degree: number, quality: string): BotanicaChord;
  /** The keys' voicing of a chord: up to four of its tones, close to the last voicing. */
  voicing(chord: BotanicaChord, prev: number[] | null): number[];
  /** The tune's instruments and colour, drawn as every dance genre's are (DANCE.noosa). */
  style(rng: () => number, fixed: Partial<LofiStyle>): LofiStyle;
  /** The weights the quieter sections' keys are drawn from. */
  softKeys: Weights<LofiStyle['keys']>;
  /** A pitch class's name ("E♭"). */
  names: readonly string[];
  /** A surf lead note's playing flags (lofi-compose.ts SURF_TREMOLO, SURF_GLISS, SURF_ARM). */
  surf: { tremolo: number; gliss: number; arm: number };
  /** A `perc` note's `mod` for a kind of hand percussion. */
  perc(kind: 'shaker' | 'conga'): number;
}

/** What Noosacore calls its sections: the drop is a swell, the break a lull, as the sea comes in sets with lulls between. */
export function noosaSectionName(section: LofiSection): string {
  return section === 'drop' ? 'swell' : section === 'break' ? 'lull' : section;
}

// ── harmony ──────────────────────────────────────────────────────────────────

type Prog = ReadonlyArray<readonly [number, string]>;
/** Sunny and open: the two-chord vamp of a beach afternoon, the IV that lifts, the mixolydian ♭VII, a sus that hangs. */
const MAJOR: readonly Prog[] = [
  [[0, 'maj9'], [5, 'maj9'], [0, 'maj9'], [5, 'maj9']],
  [[0, 'six9'], [9, 'm9'], [5, 'maj9'], [7, 'sus']],
  [[0, 'maj9'], [10, 'add9'], [5, 'maj9'], [0, 'maj9']],
  [[5, 'maj9'], [4, 'm7'], [2, 'm9'], [0, 'six9']],
  [[0, 'dom9'], [5, 'maj9'], [0, 'dom9'], [10, 'add9']],
  [[0, 'maj9'], [2, 'm9'], [4, 'm7'], [5, 'maj9']],
];
/** Dorian, the minor that stays bright: the minor ninth over its major IV, the ♭VII and ♭III. */
const MINOR: readonly Prog[] = [
  [[0, 'm9'], [5, 'dom9'], [0, 'm9'], [5, 'dom9']],
  [[0, 'm11'], [3, 'maj9'], [10, 'add9'], [5, 'dom9']],
  [[0, 'm9'], [8, 'maj9'], [10, 'add9'], [0, 'm9']],
  [[0, 'm9'], [10, 'add9'], [8, 'maj9'], [10, 'add9']],
];
const PENTA_MAJOR = [0, 2, 4, 7, 9];
const PENTA_MINOR = [0, 3, 5, 7, 10];

// ── the bass ─────────────────────────────────────────────────────────────────

/**
 * A bar of the rolling bass: [sixteenth, length in sixteenths, which note, strength]. The
 * notes: r the root, o its octave, 5 the fifth, l the fifth below, 3 and 7 the chord's third
 * and seventh, s and d a step up or down the scale from the last note, a a passing note into
 * the next chord's root.
 */
type Roll = ReadonlyArray<readonly [number, number, 'r' | 'o' | '5' | 'l' | '3' | '7' | 's' | 'd' | 'a', number]>;
const ROLLS: readonly Roll[] = [
  // the root pushed, the octave answered, sliding down through the seventh and the fifth
  [[0, 3, 'r', 0.92], [3, 2, 'r', 0.55], [6, 2, 'o', 0.72], [8, 2, '7', 0.66], [10, 2, '5', 0.72], [12, 3, '3', 0.62], [15, 1, 'a', 0.58]],
  // a long root, then a walk up the chord from the and of two
  [[0, 5, 'r', 0.92], [6, 1, 'r', 0.45], [7, 2, '3', 0.66], [9, 2, '5', 0.72], [11, 3, 'o', 0.72], [14, 2, 'a', 0.62]],
  // the dotted roll: three, three and two, twice
  [[0, 3, 'r', 0.92], [3, 3, '5', 0.7], [6, 2, 'o', 0.66], [8, 3, 'r', 0.82], [11, 3, '5', 0.66], [14, 2, 'a', 0.6]],
  // the low fifth under the root, a lilt
  [[0, 2, 'r', 0.92], [2, 2, 'l', 0.6], [4, 2, 'r', 0.72], [6, 3, '5', 0.72], [10, 2, '7', 0.62], [12, 2, 'o', 0.72], [14, 2, '5', 0.56]],
  // half time: the root held, the octave on three, a pickup into the next bar
  [[0, 6, 'r', 0.92], [6, 2, '5', 0.6], [8, 4, 'o', 0.76], [12, 2, '5', 0.6], [14, 1, '3', 0.5], [15, 1, 'a', 0.56]],
  // up the scale from the root to the fifth, and down to the third
  [[0, 2, 'r', 0.92], [2, 2, 's', 0.6], [4, 2, 's', 0.66], [6, 4, '5', 0.76], [10, 2, 'd', 0.6], [12, 4, '3', 0.7]],
];

// ── the drums ────────────────────────────────────────────────────────────────

/** A groove: the kick's sixteenths, the backbeat's, a ghost, and whether the shaker plays sixteenths or eighths. */
interface Groove { kick: readonly number[]; back: readonly number[]; ghost: readonly number[]; sixteenths: boolean }
const GROOVES: readonly Groove[] = [
  // half-time sway: the kick on one and the and of three, the backbeat on three
  { kick: [0, 10], back: [8], ghost: [14], sixteenths: true },
  // the two-step lean: the kick on one, the and of two and the and of three, the backbeat on two and four
  { kick: [0, 6, 10], back: [4, 12], ghost: [7], sixteenths: false },
  // a coastal bossa: the kick on one, the and of two, three and the and of four, the rim on the clave
  { kick: [0, 6, 8, 14], back: [3, 10], ghost: [], sixteenths: true },
  // a lazy backbeat with a skip
  { kick: [0, 3, 8], back: [4, 12], ghost: [11], sixteenths: false },
];

// ── the surf guitar ──────────────────────────────────────────────────────────

/** A lick: [sixteenth, where (steps along the pentatonic from the chord tone near the middle; 'high' the root high up the neck), length in sixteenths, playing]. */
type Lick = ReadonlyArray<readonly [number, number | 'high', number, 'plain' | 'tremolo' | 'gliss' | 'arm']>;
const LICKS: readonly Lick[] = [
  // a tremolo-picked note above, falling to the chord tone and shaken with the arm
  [[0, 2, 7, 'tremolo'], [8, 0, 7, 'arm']],
  // the glissando down the neck from high on the root
  [[8, 'high', 7, 'gliss']],
  // a run down the pentatonic, the last note held and shaken
  [[0, 4, 2, 'plain'], [2, 3, 2, 'plain'], [4, 2, 2, 'plain'], [6, 1, 2, 'plain'], [8, 0, 7, 'arm']],
  // a call, two picked notes, and its answer held and tremolo-picked
  [[0, 2, 2, 'plain'], [3, 1, 2, 'plain'], [6, 0, 9, 'tremolo']],
  // a twang: the chord tone, a step up and back, held
  [[2, 0, 2, 'plain'], [4, 1, 1, 'plain'], [5, 0, 5, 'plain'], [12, -1, 4, 'arm']],
  // a phrase across two bars: a call climbing to the chord tone, then the glissando down the neck
  [[8, -2, 2, 'plain'], [10, -1, 2, 'plain'], [12, 0, 4, 'tremolo'], [24, 'high', 7, 'gliss']],
];

// ── the running order ─────────────────────────────────────────────────────────

interface Part { section: LofiSection; bars: number; prog: 0 | 1; open: readonly [number, number]; alt?: boolean; fade?: boolean }

function runningOrder(r: () => number): Part[] {
  const verse = r() < 0.6 ? 16 : 8;
  const parts: Part[] = [
    { section: 'intro', bars: 8, prog: 0, open: [0.55, 0.9] },
    { section: 'verse', bars: verse, prog: 0, open: [0.9, 1] },
    { section: 'drop', bars: 16, prog: 1, open: [1, 1] },
    { section: 'break', bars: 8, prog: 0, open: [0.88, 0.78] },
  ];
  if (r() < 0.7) parts.push({ section: 'build', bars: 4, prog: 0, open: [0.85, 1] });
  parts.push({ section: 'drop', bars: 16, prog: 1, open: [1, 1], alt: true }, { section: 'outro', bars: 8, prog: 0, open: [0.9, 0.6], fade: true });
  return parts;
}

// ── the composer ─────────────────────────────────────────────────────────────

/** A stream of the style's own, scrambled from the seed (MurmurHash3's finish), so neighbouring seeds draw unrelated choices. */
function stream(seed: number, salt: number): () => number {
  let h = (seed ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return mulberry32((h ^ (h >>> 16)) >>> 0);
}
function weighted<T>(r: () => number, w: Weights<T>): T {
  let roll = r() * w.reduce((s, [, n]) => s + n, 0);
  for (const [v, n] of w) { roll -= n; if (roll < 0) return v; }
  return w[w.length - 1]![0];
}
const pickOf = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const clampVel = (v: number): number => Math.max(0.05, Math.min(1, v));
const pc = (m: number): number => ((m % 12) + 12) % 12;
/** A pitch class placed between lo and hi. */
function placeIn(p: number, lo: number, hi: number): number {
  let q = lo + ((p - lo) % 12 + 12) % 12;
  if (q > hi) q -= 12;
  return q;
}
/** The nearest pitch to `p` whose class is one of `tones`. */
function nearestTone(p: number, tones: readonly number[]): number {
  for (let d = 0; d <= 6; d++) for (const q of [p - d, p + d]) if (tones.includes(pc(q))) return q;
  return p;
}
/** `steps` places along `scale` (pitch classes) from `from`. */
function stepScale(from: number, steps: number, scale: readonly number[]): number {
  let p = from;
  const dir = Math.sign(steps);
  for (let n = 0; n < Math.abs(steps); n++) do p += dir; while (!scale.includes(pc(p)));
  return p;
}

/** Where the tune's notable moments fall, for a reader (and a test) to find them. */
export interface NoosaPlan {
  bpm: number;
  /** The bars (tune-wide) a surf lick starts on. */
  licks: number[];
  /** The featured birds: which, and on which bar. */
  birds: Array<{ bird: 'magpie' | 'kookaburra'; bar: number }>;
  /** Whether a didgeridoo drones under the quiet sections, and the bar (tune-wide) of its one rhythm figure over a full swell, or -1. */
  didge: boolean;
  yidaki: number;
  /** Where on the coast the tune is set: off the point, where the surf breaks in sets, or at the river mouth, where small waves lap. */
  place: 'point' | 'river';
  /** Whether a breeze sings in the she-oaks on the dunes, and whether cicadas call (a warm afternoon). */
  breeze: boolean;
  cicadas: boolean;
  /** The coast's birds, rarer than the magpie (coastOf): the bars a whipbird pair calls on, and the lorikeets' bars and what they do. */
  whipbird: number[];
  lorikeets: Array<{ bar: number; kind: LorikeetKind }>;
}

/** Everything a tune draws before its bars, from the style's own streams. */
interface Plan extends NoosaPlan {
  /** Which of LICKS each lick plays. */
  lickOf: number[];
  minor: boolean; scale: readonly number[]; swing: number;
  grooves: readonly [Groove, Groove]; rolls: readonly [Roll, Roll, Roll];
  source: BotanicaSource; sourceB: BotanicaSource;
  tapeStop: boolean; freeze: boolean; repeats: number; phaser: number;
  wavePeriod: number;
}

/** The tune's plan, from its own stream: what plays, and where its odd moments fall. */
function planOf(seed: number, parts: readonly Part[], minor: boolean, key: number, bpm: number, swing: number): Omit<Plan, 'whipbird' | 'lorikeets'> {
  const p = stream(seed, 0x0005a);
  const at = (section: LofiSection, nth = 0): number => {
    let bar = 0, seen = 0;
    for (const part of parts) {
      if (part.section === section && seen++ === nth) return bar;
      bar += part.bars;
    }
    return -1;
  };
  const len = (section: LofiSection, nth = 0): number => parts.filter(x => x.section === section)[nth]?.bars ?? 0;
  // The surf guitar's odd moments: one to three, in different sections, a bar or two each.
  const slots: Array<readonly [number, number]> = [
    [at('verse') + len('verse') - 2, 3], [at('drop') + 6, 2], [at('drop') + 14, 2], [at('break') + 4, 3],
    [at('drop', 1) + 10, 2], [at('outro') + 2, 1],
  ];
  const want = weighted(p, [[1, 4], [2, 4], [3, 1]] as const);
  const licks: number[] = [];
  for (let tries = 0; licks.length < want && tries < 24; tries++) {
    const [bar] = weighted(p, slots.map(s => [s, s[1]] as const));
    if (bar >= 0 && !licks.some(l => Math.abs(l - bar) < 6)) licks.push(bar);
  }
  licks.sort((a, b) => a - b);
  const lickOf = licks.map(() => Math.floor(p() * LICKS.length));
  // The featured birds: a magpie's carol at the top or into the lull (most tunes), a kookaburra now and then as the tune winds down.
  const birds: NoosaPlan['birds'] = [];
  const carol = p();
  if (carol < 0.42) birds.push({ bird: 'magpie', bar: 1 });
  else if (carol < 0.8) birds.push({ bird: 'magpie', bar: at('break') + 1 });
  else if (carol < 0.88) birds.push({ bird: 'magpie', bar: 1 }, { bird: 'magpie', bar: at('break') + 1 });
  if (p() < 0.16) birds.push({ bird: 'kookaburra', bar: at('outro') + 3 });
  const sources: Weights<BotanicaSource> = [['guitar', 3], ['nylon', 2], ['voice', 3], ['breath', 2], ['flute', 1], ['harp', 2]];
  const source = weighted(p, sources);
  const didge = p() < 0.4;
  const grooves = [pickOf(p, GROOVES), pickOf(p, GROOVES)] as const;
  const rolls = [pickOf(p, ROLLS), pickOf(p, ROLLS), pickOf(p, ROLLS)] as const;
  const sourceB = weighted(p, sources.filter(([s]) => s !== source));
  const tapeStop = p() < 0.5, freeze = p() < 0.55, repeats = 0.2 + p() * 0.25, phaser = p();
  const wavePeriod = 7 + p() * 4;
  const place: NoosaPlan['place'] = p() < 0.3 ? 'river' : 'point';
  const breeze = p() < 0.75, cicadas = p() < 0.35;
  // The one figure the didgeridoo plays over the band, where the second swell is full and loud.
  const figure = p() < 0.6, late = p() < 0.5;
  return {
    bpm, minor, swing, licks, lickOf, birds, didge, scale: (minor ? PENTA_MINOR : PENTA_MAJOR).map(i => (key + i) % 12),
    grooves, rolls, source, sourceB, tapeStop, freeze, repeats, phaser, wavePeriod, place, breeze, cicadas,
    yidaki: didge && figure ? at('drop', 1) + (late ? 13 : 5) : -1,
  };
}

/** Build one Noosacore tune's bars, before the tag. */
export function composeNoosa(seed: number, fixed: Partial<LofiStyle>, kit: NoosaKit): LofiBar[] {
  const rng = mulberry32(seed >>> 0);
  const key = Math.floor(rng() * 12);
  const minor = rng() < 0.3;
  const style = kit.style(rng, fixed);
  const o = stream(seed, 0x0005b);   // the running order and the tempo
  const bpm = Math.round(80 + o() * 22);
  const swing = Math.round((0.52 + o() * 0.06) * 100) / 100;
  const parts = runningOrder(o);
  const plan = { ...planOf(seed, parts, minor, key, bpm, swing), ...coastOf(seed, parts, bpm) };
  const pool = minor ? MINOR : MAJOR;
  const progA = pickOf(o, pool);
  let progB = pickOf(o, pool);
  for (let tries = 0; progB === progA && tries < 4; tries++) progB = pickOf(o, pool);
  const chords = [progA.map(([d, q]) => kit.chord(key, d, q)), progB.map(([d, q]) => kit.chord(key, d, q))] as const;
  const chordBars = 2;
  const tuneStyle: LofiStyle = { ...style, chordBars, groove: 'sparse', hats: fixed.hats ?? style.hats };
  const softKeys = fixed.keys ?? (() => { const rest = kit.softKeys.filter(([v]) => v !== tuneStyle.keys); return rest.length ? weighted(o, rest) : tuneStyle.keys; })();
  const total = parts.reduce((s, p) => s + p.bars, 0) + 1;
  const info: LofiTuneInfo = {
    seed: seed >>> 0, mood: 'noosa', bpm, swing, swing8: 0.5, style: tuneStyle,
    key: `${kit.names[key]} ${minor ? 'minor' : 'major'}`,
    progressions: [chords[0].map(c => c.name), chords[1].map(c => c.name)],
    bars: total,
  };
  const waves = seaOf(seed, parts, bpm, plan);
  const m = stream(seed, 0x0005c);   // the playing: timing, velocities, small choices
  const fx = stream(seed, 0x0005d);  // the effects
  const bars: LofiBar[] = [];
  let prevVoicing: number[] | null = null;
  let lastBass = placeIn(key, 33, 44);
  let index = 0;
  for (const part of parts) {
    const prog = chords[part.prog];
    for (let i = 0; i < part.bars; i++, index++) {
      const slot = Math.floor(i / chordBars);
      const chord = prog[slot % prog.length]!;
      const nextChord = (i + 1) % chordBars === 0 ? prog[(slot + 1) % prog.length]! : chord;
      const firstOfChord = i % chordBars === 0;
      if (firstOfChord || i === 0) prevVoicing = kit.voicing(chord, prevVoicing);
      const ctx: Bar = { part, next: parts[parts.indexOf(part) + 1]?.section, i, index, plan, chord, nextChord, voicing: prevVoicing ?? [], firstOfChord, key, notes: [], m, fx, kit, lastBass, keysV: tuneStyle.keys };
      const layers = new Set<LofiLayer>(['fx']);
      const voices: LofiBar['voices'] = part.section === 'intro' || part.section === 'break' || part.section === 'outro' ? { keys: softKeys } : undefined;
      if (voices?.keys) ctx.keysV = voices.keys;
      if (pad(ctx)) layers.add('keys');
      if (keys(ctx)) layers.add('keys');
      if (bass(ctx)) layers.add('bass');
      lastBass = ctx.lastBass;
      for (const l of drums(ctx, tuneStyle)) layers.add(l);
      if (lead(ctx)) layers.add('lead');
      didge(ctx);
      cicadas(ctx);
      birds(ctx);
      coastBirds(ctx);
      effects(ctx);
      for (const w of waves.get(index) ?? []) ctx.notes.push(w);
      const [o0, o1] = part.open;
      const open = Math.round((o0 + (o1 - o0) * (part.bars > 1 ? i / (part.bars - 1) : 1)) * 1000) / 1000;
      const level = part.fade ? Math.max(0.25, 1 - (i + 1) * (0.75 / part.bars)) : 1;
      ctx.notes.sort((a, z) => a.beat - z.beat);
      bars.push({ tune: info, index, section: part.section, layers: [...layers], chord: chord.name, tones: chord.tones, notes: ctx.notes, open, level, ...(voices ? { voices } : {}) });
    }
  }
  bars.push({ tune: info, index, section: 'rest', layers: [], chord: '', tones: [], notes: [], open: 0.3, level: 0 });
  return bars;
}

/** The tune's plan as a reader sees it: its tempo, where its licks and featured birds fall, and whether a didgeridoo drones. */
export function noosaPlan(seed: number): NoosaPlan {
  const rng = mulberry32(seed >>> 0);
  const key = Math.floor(rng() * 12);
  const minor = rng() < 0.3;
  const o = stream(seed, 0x0005b);
  const bpm = Math.round(80 + o() * 22);
  const swing = Math.round((0.52 + o() * 0.06) * 100) / 100;
  const parts = runningOrder(o);
  const { licks, birds, didge, yidaki, place, breeze, cicadas } = planOf(seed, parts, minor, key, bpm, swing);
  return { bpm, licks, birds, didge, yidaki, place, breeze, cicadas, ...coastOf(seed, parts, bpm) };
}

/** What one bar's writers share. */
interface Bar {
  /** The part this bar is in, and the section that follows the part. */
  part: Part; next: LofiSection | undefined; i: number; index: number; plan: Plan;
  chord: BotanicaChord; nextChord: BotanicaChord; voicing: readonly number[]; firstOfChord: boolean;
  key: number; notes: LofiNote[];
  /** The playing's stream and the effects'. */
  m: () => number; fx: () => number;
  kit: NoosaKit;
  /** The bass's last note, for the next to move from. */
  lastBass: number;
  keysV: LofiStyle['keys'];
}

/** Sixteenth `step` as a beat, the off sixteenths swung. */
const sb = (c: Bar, step: number): number => step / 4 + (step % 2 === 1 ? (c.plan.swing - 0.5) * 0.5 : 0);

// ── the sea ──────────────────────────────────────────────────────────────────

/**
 * The tune's waves, bar by bar: the shore's roar under every four bars, and the waves
 * breaking, a series as the sea sends them (lofi-waves-notes.ts waveSeries) with the story's
 * own: the first wave breaking alone on the intro's second bar, a set wave crashing on the
 * first beat of each swell, bigger waves in the lull, and quieter ones under the band. A
 * wave's note starts as its swell begins, before the bar it breaks in when it must.
 */
function seaOf(seed: number, parts: readonly Part[], bpm: number, plan: Plan): Map<number, LofiNote[]> {
  const out = new Map<number, LofiNote[]>();
  const add = (bar: number, n: LofiNote): void => { const list = out.get(bar) ?? []; list.push(n); out.set(bar, list); };
  const w = stream(seed, 0x0005e);
  const sectionAt: LofiSection[] = [];
  const starts: number[] = [];
  let bar = 0;
  for (const p of parts) { starts.push(bar); for (let i = 0; i < p.bars; i++) sectionAt.push(p.section); bar += p.bars; }
  const total = bar;
  const spb = 60 / bpm;
  // How loud the sea is, by section: in front where the band is quiet, under it where it is full.
  const forward: Partial<Record<LofiSection, number>> = { intro: 1, break: 1, outro: 0.95, verse: 0.6, build: 0.55, drop: 0.42 };
  // The breeze in the she-oaks: in front in the quiet sections, a soft hiss beside the band elsewhere.
  const breeze: Partial<Record<LofiSection, number>> = { intro: 0.9, break: 1, outro: 0.9, verse: 0.45, build: 0.4, drop: 0.32 };
  // At the river mouth the water laps: only small waves, at the edge, and the roar of the surf further off.
  const river = plan.place === 'river';
  for (let b = 0; b < total; b += 4) {
    const span = Math.min(4, total - b) * 4;
    add(b, { voice: 'wave', midi: 48, beat: 0, dur: span + 0.75, vel: clampVel((forward[sectionAt[b]!] ?? 0.7) * (river ? 0.55 : 1)), mod: waveMod('shore', 2, 1, Math.floor(w() * 1024)) });
    if (plan.breeze) add(b, { voice: 'wave', midi: 48, beat: 0, dur: span + 0.75, vel: clampVel(breeze[sectionAt[b]!] ?? 0.5), mod: waveMod('dunes', 1, 1, Math.floor(w() * 1024)) });
  }
  // The story's waves: crash beats (tune-wide), each with its size and how far off it is.
  const big = river ? 2 : 3;
  const story: Array<{ beat: number; size: number; distance: number; vel: number }> = [{ beat: 4, size: big - 1, distance: river ? 0 : 1, vel: 0.95 }];
  parts.forEach((p, k) => {
    const at = starts[k]! * 4;
    if (p.section === 'drop') story.push({ beat: at, size: big, distance: river ? 0 : 1, vel: 0.85 });
    if (p.section === 'break') for (let b = 2; b < p.bars; b += 3) story.push({ beat: at + b * 4 + Math.floor(w() * 4) / 2, size: big - 1 + (w() < 0.4 ? 1 : 0), distance: river || w() < 0.3 ? 0 : 1, vel: 1 });
  });
  const totalSeconds = total * 4 * spb;
  const series = waveSeries(seed ^ 0x5ea, 0, totalSeconds, river ? { period: plan.wavePeriod, distance: 0, biggest: 1 } : { period: plan.wavePeriod, distance: 1 })
    .map(e => ({ beat: e.at / spb, size: e.size, distance: e.distance, take: e.take, vel: 0 }))
    .filter(e => !story.some(s => Math.abs(s.beat - e.beat) * spb < 4));
  const all = [
    ...story.map(s => ({ ...s, take: Math.floor(w() * 1048576) })),
    ...series.map(e => ({ ...e, vel: forward[sectionAt[Math.min(total - 1, Math.floor(e.beat / 4))]!] ?? 0.6 })),
  ];
  for (const e of all) {
    const start = Math.max(0, e.beat - swellBeats(e.size, bpm));
    const b = Math.floor(start / 4);
    if (b >= total - 1) continue;   // the sea goes on past the tune, but its notes stop with the band
    // A wave breaking under a swell is a little quieter, as the band's own crest takes the moment.
    const vel = clampVel(e.vel * (0.85 + w() * 0.15));
    add(b, { voice: 'wave', midi: 48, beat: Math.round((start - b * 4) * 1000) / 1000, dur: Math.round((swellBeats(e.size, bpm) + (WAVE_WASH[e.size]! * bpm) / 60) * 100) / 100, vel, mod: waveMod('break', e.distance, e.size, e.take) });
  }
  return out;
}

// ── the band ─────────────────────────────────────────────────────────────────

/** The granular pad: the chord held through, cut from the tune's source, quietly under the bass. */
function pad(c: Bar): boolean {
  const { part, i } = c;
  if (part.section === 'intro' && i < 2) return false;
  if (part.section === 'outro' && i >= part.bars - 1) return false;
  if (!c.firstOfChord && i !== 0) return true;
  const cloud: BotanicaCloud = part.section === 'break' ? (c.m() < 0.5 ? 'stretch' : 'reverse')
    : part.section === 'drop' ? (c.m() < 0.75 ? 'shimmer' : 'scatter')
    : part.section === 'build' ? 'reverse' : 'stretch';
  const source = part.alt || part.section === 'break' ? c.plan.sourceB : c.plan.source;
  const left = (2 - (i % 2)) * 4;
  const tones = [...c.voicing].sort((a, z) => a - z);
  const level = part.section === 'drop' ? 0.25 : part.section === 'break' ? 0.32 : 0.24;
  for (const [k, p] of tones.slice(0, 3).entries()) c.notes.push({ voice: 'grain', midi: k === 2 ? p + 12 : p, beat: 0, dur: left + 0.75, vel: clampVel(level - k * 0.04), mod: grainMod(source, cloud) });
  return true;
}

/** The keys: a chord rolled and left to ring where the chord changes, and in the grooves a lazy restrike off the beat. */
function keys(c: Bar): boolean {
  const { part, voicing, notes, i } = c;
  if (!voicing.length || (part.section === 'intro' && i < 2)) return false;
  const quiet = part.section === 'intro' || part.section === 'break' || part.section === 'outro';
  const strike = (at: number, p: number, len: number, vel: number): void => { notes.push({ voice: 'keys', midi: p, beat: Math.max(0, Math.min(3.95, at)), dur: len, vel: clampVel(vel + (c.m() - 0.5) * 0.06) }); };
  const sorted = [...voicing].sort((a, z) => a - z);
  if (part.section === 'build') {
    // The build: the chord on every beat, a little louder each bar.
    for (const b of [0, 1, 2, 3]) for (const p of sorted) strike(b, p, 0.8, 0.3 + (i / part.bars) * 0.18);
    return true;
  }
  if (c.firstOfChord) {
    const spread = 0.05 + c.m() * 0.08;
    sorted.forEach((p, k) => { strike(k * spread, p, 7.5, quiet ? 0.3 : 0.36); });
  }
  if (!quiet) {
    // A lazy restrike: the top of the chord on the and of two, or the and of three in a swell.
    const at = part.section === 'drop' ? (c.m() < 0.5 ? sb(c, 10) : sb(c, 6)) : sb(c, 10);
    if (c.m() < (part.section === 'drop' ? 0.75 : 0.5)) for (const p of sorted.slice(-2)) strike(at, p, 1.4, 0.3);
  } else if (c.m() < 0.5) {
    // A note of the chord falling where it falls, ringing on.
    const p = sorted[Math.floor(c.m() * sorted.length)]!;
    strike(1.5 + c.m() * 1.8, c.m() < 0.3 && p + 12 <= 76 ? p + 12 : p, 2.4, 0.26);
  }
  return true;
}

/** The rolling bass: the song's engine, through every groove; a held root in the lull, out at the tune's two ends. */
function bass(c: Bar): boolean {
  const { part, i, notes, plan, chord, nextChord } = c;
  const section = part.section;
  if (section === 'intro' && i < 4) return false;
  if (section === 'outro' && i >= 4) return false;
  const root = placeIn(chord.root, 33, 44);
  const next = placeIn(nextChord.root, 33, 44);
  const third = root + pc((chord.tones[1] ?? chord.root + 4) - chord.root);
  const seventh = root + pc((chord.tones[3] ?? chord.tones[2] ?? chord.root + 10) - chord.root);
  const push = (step: number, len: number, midi: number, vel: number): void => {
    notes.push({ voice: 'bass', midi, beat: sb(c, step), dur: Math.max(0.2, len / 4 - 0.06), vel: clampVel(vel) });
    c.lastBass = midi;
  };
  if (section === 'break') {
    // The lull: the bass lays out, or holds the root under the sea where the chord changes.
    if (!plan.didge && c.firstOfChord) push(0, 26, root, 0.42);
    return !plan.didge;
  }
  const strength = section === 'drop' ? 1 : section === 'verse' ? 0.9 : section === 'build' ? 0.82 : 0.74;
  if (section === 'build') {
    // Eighths on the root, the octave answering, climbing in strength into the swell.
    for (let s = 0; s < 16; s += 2) push(s, 2, s % 4 === 2 ? root + 12 : root, (0.7 + (i / part.bars) * 0.25) * (s % 4 === 0 ? 1 : 0.8));
    return true;
  }
  const roll = plan.rolls[section === 'drop' ? (part.alt ? 2 : 1) : 0];
  // The last bar of an eight-bar phrase in a swell runs down (or up) the scale into the next.
  const fill = section === 'drop' && i % 8 === 7;
  let prev = root;
  for (const [step, len, which, vel] of roll) {
    if (fill && step >= 8) break;
    if (section === 'intro' && step > 8) break;
    let midi: number;
    switch (which) {
      case 'r': midi = root; break;
      case 'o': midi = root + 12; break;
      case '5': midi = root + 7; break;
      case 'l': midi = root - 5 >= 28 ? root - 5 : root + 7; break;
      case '3': midi = third; break;
      case '7': midi = seventh; break;
      case 's': midi = stepScale(prev, 1, plan.scale); break;
      case 'd': midi = stepScale(prev, -1, plan.scale); break;
      default: midi = next === root ? root + 7 : next + (next > root ? -1 : 1);
    }
    push(step, len, midi, vel * strength * 1.12);
    prev = midi;
  }
  if (fill) {
    const down = c.m() < 0.5;
    let p = down ? root + 12 : root;
    for (let s = 8; s < 16; s += 2) {
      p = stepScale(p, down ? -1 : 1, plan.scale);
      push(s, 2, p, (0.68 + (s - 8) * 0.03) * strength);
    }
  }
  return true;
}

/** The drums: a soft kick, the backbeat on a rim, a snap or brushes, a shaker; a conga now and then in a swell. */
function drums(c: Bar, style: LofiStyle): LofiLayer[] {
  const { part, i, notes, plan } = c;
  const section = part.section;
  const hit = (voice: LofiNote['voice'], step: number, vel: number, mod?: number, midi = 0): void => {
    notes.push({ voice, midi, beat: Math.min(3.97, sb(c, step)), dur: 0, vel: clampVel(vel + (c.m() - 0.5) * 0.06), ...(mod === undefined ? {} : { mod }) });
  };
  const backVoice: LofiNote['voice'] = style.snare === 'rim' ? 'rim' : 'snare';
  if (section === 'break' || (section === 'outro' && i >= 4)) return [];
  if (section === 'intro') {
    if (i < 4) return [];
    // The shaker comes in alone, the kick on the last bar.
    for (let s = 2; s < 16; s += 4) hit('hat', s, 0.3, 1);
    if (i === part.bars - 1) hit('kick', 0, 0.6);
    return ['hats'];
  }
  if (section === 'build') {
    for (const s of [0, 4, 8, 12]) hit('kick', s, 0.62 + i * 0.04);
    for (let s = 0; s < 16; s += i >= 2 ? 1 : 2) hit('hat', s, 0.26 + (s % 4 === 0 ? 0.1 : 0), 1);
    if (i === part.bars - 1 && !plan.tapeStop) for (const s of [8, 10, 12, 13, 14, 15]) hit(backVoice, s, 0.45 + (s - 8) * 0.05);
    return ['kick', 'snare', 'hats'];
  }
  const groove = plan.grooves[section === 'drop' ? 1 : 0];
  const soft = section === 'verse' || section === 'outro' ? 0.88 : 1;
  for (const s of groove.kick) hit('kick', s, (s === 0 ? 0.52 : 0.42) * soft);
  for (const s of groove.back) hit(backVoice, s, 0.44 * soft);
  for (const s of groove.ghost) if (c.m() < 0.6) hit(backVoice, s, 0.18);
  // The shaker: sixteenths or eighths, the and of each beat leaning.
  for (let s = 0; s < 16; s += groove.sixteenths ? 1 : 2) hit('hat', s, (s % 4 === 2 ? 0.29 : s % 2 === 0 ? 0.22 : 0.16) * soft, 1);
  // A conga answering the backbeat in a swell, some bars.
  if (section === 'drop' && c.m() < 0.45) for (const [s, p, v] of [[7, 64, 0.28], [11, 60, 0.24], [14, 55, 0.3]] as const) hit('perc', s, v, c.kit.perc('conga'), p);
  return ['kick', 'snare', 'hats'];
}

/** The surf guitar: a lick at the plan's odd moments, through its spring, and nothing between. */
function lead(c: Bar): boolean {
  const { index, plan, notes, chord, kit } = c;
  const n = plan.licks.findIndex(l => l === index || l === index - 1);
  if (n < 0) return false;
  const lick = LICKS[plan.lickOf[n]!] ?? LICKS[0]!;
  // A lick takes its first bar, or (when it runs long) carries into the second.
  const second = index !== plan.licks[n];
  const centre = chord.tones.map(t => placeIn(t, 67, 78)).sort((a, z) => Math.abs(a - 72) - Math.abs(z - 72))[0] ?? 72;
  const flag = { plain: 0, tremolo: kit.surf.tremolo, gliss: kit.surf.gliss, arm: kit.surf.arm } as const;
  let wrote = false;
  for (const [step, where, len, how] of lick) {
    const bar = step >= 16 ? 1 : 0;
    if ((bar === 1) !== second) continue;
    // On the strong beats the guitar plays a note of the chord.
    const free = where === 'high' ? placeIn(chord.root, 72, 83) : stepScale(centre, where, plan.scale);
    const midi = step % 8 === 0 ? nearestTone(free, chord.tones) : free;
    const mod = flag[how];
    notes.push({ voice: 'lead', midi, beat: sb(c, step % 16), dur: Math.max(0.3, len / 4 - 0.1), vel: clampVel(0.66 + (c.m() - 0.5) * 0.08), ...(mod ? { mod } : {}) });
    wrote = true;
  }
  return wrote;
}

/**
 * The didgeridoo, when the tune has one: under the quiet sections the drone, the mouth opening
 * on it, a sweep of the vowel and the breath, never a toot; and in some tunes one bar of
 * rhythm over the second swell, where the band is full and loud, its toot rising out of the
 * drone at the bar's end.
 */
function didge(c: Bar): void {
  const { part, i, index, plan, notes, key } = c;
  if (!plan.didge) return;
  const root = placeIn(key, 34, 45);
  // Each shape lasts until the next, so the drone under them never stops.
  const tile = (shape: ReadonlyArray<readonly [number, number]>, vel: number, role: number): void => {
    shape.forEach(([step, art], k) => {
      const end = shape[k + 1]?.[0] ?? 16;
      notes.push({ voice: 'didge', midi: root, beat: sb(c, step), dur: Math.max(0.1, sb(c, end) - sb(c, step) - 0.01), vel, mod: art + role * DIDGE_ROLE });
    });
  };
  if (index === plan.yidaki) {
    tile([[0, DIDGE_WA], [2, DIDGE_TONGUE], [4, DIDGE_WA], [6, DIDGE_TONGUE], [8, DIDGE_SWEEP], [11, DIDGE_TONGUE], [12, DIDGE_WA], [14, DIDGE_TOOT]], 0.45, DIDGE_MID);
    return;
  }
  const on = (part.section === 'intro' && i >= 2) || part.section === 'break' || (part.section === 'outro' && i < part.bars - 2);
  if (!on) return;
  const shape: Array<readonly [number, number]> = [[0, DIDGE_DRONE], [6, DIDGE_WA], [8, c.m() < 0.4 ? DIDGE_SWEEP : DIDGE_DRONE], [12, DIDGE_WA]];
  if (i % 2 === 1) shape.push([14, DIDGE_BREATH]);
  // Blown softly: an undertone under the sea, not a part of the band.
  tile(shape, part.section === 'break' ? 0.2 : 0.12, 0);
}

/** Cicadas calling through a warm afternoon, in the tunes that have one: under the groove, and louder in the lull and the intro (botanica's cicada, lib/lofi-nature.ts). */
function cicadas(c: Bar): void {
  const { part, i, plan, notes, fx } = c;
  if (!plan.cicadas || i % 4 !== 0) return;
  const vel = part.section === 'break' ? 0.6 : part.section === 'verse' ? 0.45 : part.section === 'intro' && i >= 4 ? 0.5 : 0;
  if (!vel) return;
  const span = Math.min(4, part.bars - i) * 4;
  notes.push({ voice: 'nature', midi: 60, beat: 0, dur: span + 0.5, vel, mod: natureMod('insects', BOTANICA_INSECTS.indexOf('cicada') + 8 * Math.floor(fx() * 32)) });
}

/**
 * Where the coast's birds call, from a stream of their own so no other draw of the tune moved
 * when they arrived. In some tunes a whipbird pair calls twice in the intro or the lull, seven to
 * eleven seconds apart, as pairs do; in some, lorikeets fly over screeching at the end of a
 * phrase, and now and then a flock chatters in a tree through the lull. Both are rarer than the
 * magpie, and both keep clear of its featured carol.
 */
function coastOf(seed: number, parts: readonly Part[], bpm: number): Pick<NoosaPlan, 'whipbird' | 'lorikeets'> {
  const r = stream(seed, 0x00060);
  const at = (section: LofiSection, nth = 0): number => {
    let bar = 0, seen = 0;
    for (const part of parts) {
      if (part.section === section && seen++ === nth) return bar;
      bar += part.bars;
    }
    return -1;
  };
  const barSeconds = (4 * 60) / bpm;
  const whipbird: number[] = [];
  const lull = at('break');
  if (r() < 0.4) {
    const first = r() < 0.5 ? 3 : lull + 3;
    whipbird.push(first, first + Math.max(2, Math.round((7 + r() * 4) / barSeconds)));
  }
  const lorikeets: NoosaPlan['lorikeets'] = [];
  if (r() < 0.35) {
    // A flock flying over at a phrase's end: the verse's last bar, or the middle of a swell.
    lorikeets.push({ bar: r() < 0.5 ? at('drop') - 1 : at('drop') + 7, kind: 'flypast' });
    if (r() < 0.5 && !whipbird.some(b => b >= lull && b < lull + 8)) lorikeets.push({ bar: lull + 4, kind: 'chatter' });
  }
  return { whipbird, lorikeets };
}

/** The coast's birds of a bar: a whipbird pair calling, lorikeets flying over or chattering in a tree. */
function coastBirds(c: Bar): void {
  const { index, plan, notes, key, fx } = c;
  if (plan.whipbird.includes(index)) {
    // The pair whistles on a note of the key, near 2 kHz or now and then near 4 (as recorded pairs do); she answers most calls.
    const tone = plan.scale[Math.floor(fx() * plan.scale.length)]!;
    notes.push({ voice: 'whipbird', midi: fx() < 0.25 ? placeIn(tone, 104, 109) : placeIn(tone, 93, 98), beat: sb(c, 2), dur: 8, vel: 0.62, mod: whipbirdMod(fx() < 0.85, fx() < 0.6 ? 1 : 2, Math.floor(fx() * 1048576)) });
  }
  for (const l of plan.lorikeets) {
    if (l.bar !== index) continue;
    const flypast = l.kind === 'flypast';
    notes.push({ voice: 'lorikeet', midi: placeIn(key + 7, 92, 97), beat: flypast ? 1 : 0, dur: flypast ? 10 : 12, vel: flypast ? 0.5 : 0.4, mod: lorikeetMod(l.kind, flypast ? 6 + Math.floor(fx() * 3) : 4 + Math.floor(fx() * 3), Math.floor(fx() * 1048576)) });
  }
}

/** The birds: a featured magpie carol or kookaburra where the plan puts one, and a quiet magpie at a calm phrase's end where the lead rests. */
function birds(c: Bar): void {
  const { part, i, index, plan, notes, key } = c;
  const magpie = 84 + ((key + 7) % 12), kookaburra = 72 + ((key + 4) % 12);
  const song = (): number => Math.floor(c.fx() * LOFI_BIRD_FEATURE);
  for (const b of plan.birds) {
    if (b.bar !== index) continue;
    if (b.bird === 'magpie') notes.push({ voice: 'magpie', midi: magpie, beat: 0.5, dur: 7, vel: 0.45, mod: song() + LOFI_BIRD_FEATURE + (c.fx() < 0.5 ? LOFI_BIRD_FLOCK : 0) });
    else notes.push({ voice: 'kookaburra', midi: kookaburra, beat: 1, dur: 12, vel: 0.6, mod: song() + LOFI_BIRD_FEATURE + (c.fx() < 0.35 ? LOFI_BIRD_FLOCK : 0) });
    return;
  }
  const calm = part.section === 'intro' || part.section === 'verse' || part.section === 'break' || part.section === 'outro';
  const featuredNear = plan.birds.some(b => Math.abs(b.bar - index) < 3) || plan.whipbird.some(b => Math.abs(b - index) < 2) || plan.lorikeets.some(l => Math.abs(l.bar - index) < 2);
  if (calm && i % 4 === 3 && !featuredNear && !notes.some(n => n.voice === 'lead') && c.fx() < 0.5) {
    notes.push({ voice: 'magpie', midi: magpie, beat: sb(c, c.fx() < 0.5 ? 8 : 10), dur: 1.5 + c.fx() * 1.5, vel: 0.5, mod: song() });
  }
}

/** The effects that weather the edges: a pad swelling backwards into a swell, a tape stop, a frozen chord, a repeat, a phaser drifting. */
function effects(c: Bar): void {
  const { part, i, plan, notes, chord, fx } = c;
  const section = part.section;
  const last = i === part.bars - 1;
  const material = BOTANICA_SOURCES.indexOf(part.alt ? plan.sourceB : plan.source);
  const tone = (lo: number, hi: number): number => placeIn(chord.tones[Math.floor(fx() * chord.tones.length)]!, lo, hi);
  // Into a swell: a pad swelling backwards, its peak on the downbeat.
  if (last && c.next === 'drop') {
    notes.push({ voice: 'grain', midi: tone(60, 72), beat: 0, dur: 4, vel: 0.3, mod: grainMod(plan.sourceB, 'reverse') });
  }
  if (section === 'build' && last && plan.tapeStop) notes.push({ voice: 'glitch', midi: tone(64, 76), beat: 2, dur: 2, vel: 0.25, mod: glitchMod('tape', material) });
  if (section === 'break' && i === 0 && plan.freeze) notes.push({ voice: 'glitch', midi: tone(64, 79), beat: 0.5, dur: Math.min(12, part.bars * 4 - 1), vel: 0.18, mod: glitchMod('freeze', material) });
  if (section === 'drop' && i % 8 === 7 && fx() < plan.repeats) notes.push({ voice: 'glitch', midi: 64, beat: 3, dur: 1, vel: 0.7, mod: glitchMod('repeat', 1 + Math.floor(fx() * 2)) });
  // A phaser drifting up over the lull's last two bars, or down through a swell's middle.
  if (section === 'break' && i === part.bars - 2 && plan.phaser < 0.5) notes.push({ voice: 'phaser', midi: tone(60, 72), beat: 0, dur: 8, vel: 0.22, mod: 0 });
  if (section === 'drop' && i === 8 && plan.phaser > 0.75) notes.push({ voice: 'phaser', midi: tone(60, 72), beat: 0, dur: 4, vel: 0.2, mod: 1 });
}

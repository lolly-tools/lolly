// SPDX-License-Identifier: MPL-2.0
/**
 * Botanica, also called petalcore: acoustic instruments and the sounds of a place outdoors
 * under granular pads and digital glitches, organic warmth with a weathered, futuristic edge.
 * This is its composer, the path lib/lofi-compose.ts's composeLofiTune takes for the style.
 * Like every path there, it writes notes and never sound, and is pure and deterministic.
 *
 * The genre's traits, never any one record's:
 * - Acoustic instruments: a felt piano, a steel-string or nylon guitar, a harp, a bowed
 *   fiddle, a flute, a voice singing syllables, an upright or round bass.
 * - The sounds of a place, as `nature` notes the shell models (lib/lofi-nature.ts): a tune
 *   is set somewhere (a wood, a stream, a garden after rain, a meadow, dusk, a cave) whose
 *   wind, leaves, water, rain and insects run under it, with birds singing in the lead's
 *   rests. Twigs and droplets also play as percussion in the grooves.
 * - Granular pads (`grain` notes): the shell renders one of Lolly's own instruments or
 *   voices and cuts it into grains, reordered, reversed and stretched into a shimmer
 *   (lib/lofi-grains.ts).
 * - Glitches (`glitch` notes): stutters and repeats, bit and sample-rate crushes, spectral
 *   freezes and tape stops on the tune's own sounds (lib/lofi-glitch.ts), with an old
 *   console's sparkles and bleeps.
 *
 * Each tune is one of two kinds, drawn from its seed. A drift is slow (40 to 70 beats a
 * minute) and mostly free of the grid: chords rolled and left to ring, notes placed by
 * feel rather than on the beat, a soft pulse at most. A groove is quick and glitchy (100
 * to 168): a soft kick, crushed hats that ratchet, snaps, shakers, twigs and drips, the
 * guitar or piano picking an ostinato. Both open on the place alone, bloom (the style's
 * name for its drop), clear (its break: the place comes forward and the time goes free),
 * bloom again with a second voice, and close on the place.
 *
 * Every draw here comes from streams of this style's own, so no other style's tune moved
 * when it arrived. The helpers it shares with the other paths arrive as a kit (see
 * BotanicaKit), so this module imports nothing from lofi-compose.ts at run time.
 */
import type { LofiBar, LofiLayer, LofiNote, LofiSection, LofiStyle, LofiTuneInfo } from './lofi-compose.ts';
import { mulberry32 } from './zzfx-compose.ts';

// ── what the notes mean ──────────────────────────────────────────────────────

/**
 * The sounds of a place a `nature` note plays, by `mod % 16`; `mod >> 4` is its variant
 * (for a bird, BOTANICA_BIRDS' index plus 8 times its song; for insects, BOTANICA_INSECTS'
 * index plus 8 times its take; for the rest a take, so two notes of one kind differ).
 * The beds (wind, leaves, stream, drip, rain, insects) run for the note's length; a bird
 * sings one phrase from the note's start; a twig snaps and a droplet falls as percussion.
 */
export const BOTANICA_NATURE = ['wind', 'leaves', 'stream', 'drip', 'rain', 'insects', 'bird', 'twig', 'droplet'] as const;
export type BotanicaNature = typeof BOTANICA_NATURE[number];
/** The birds: a blackbird's fluted phrase, a robin's thin cascade, a wren's rattling trill, a thrush repeating its phrases, a wood pigeon's coo, the magpie's warbling carol. */
export const BOTANICA_BIRDS = ['blackbird', 'robin', 'wren', 'thrush', 'dove', 'magpie'] as const;
export type BotanicaBird = typeof BOTANICA_BIRDS[number];
/** The insects: a field cricket's chirps, a cicada's buzz, bees about the flowers. */
export const BOTANICA_INSECTS = ['cricket', 'cicada', 'bee'] as const;
export type BotanicaInsect = typeof BOTANICA_INSECTS[number];

/**
 * What a `grain` note's pad is cut from, by `mod % 16`: the felt piano, the steel-string
 * and nylon guitars, the bowed fiddle, the flute, a voice singing, breath, the harp.
 */
export const BOTANICA_SOURCES = ['piano', 'guitar', 'nylon', 'fiddle', 'flute', 'voice', 'breath', 'harp'] as const;
export type BotanicaSource = typeof BOTANICA_SOURCES[number];
/**
 * How the grains are played, by `mod >> 4`: a shimmer (short grains, dense, an octave
 * above as well), a reverse swell (longer grains, most of them backwards), a stretch
 * (long grains scanning slowly through the note), or a scatter (sparse, wide, glinting).
 */
export const BOTANICA_CLOUDS = ['shimmer', 'reverse', 'stretch', 'scatter'] as const;
export type BotanicaCloud = typeof BOTANICA_CLOUDS[number];

/**
 * The glitches a `glitch` note plays, by `mod % 16`; `mod >> 4` is the material, an index
 * into BOTANICA_SOURCES (or BOTANICA_MATERIAL_BIRD, a bird's syllable). A stutter repeats a
 * slice of the material, stepping its pitch; a crush cuts its bits and its sample rate; a
 * freeze holds its spectrum still for the note's length; a reverse plays it backwards,
 * crushed; a tape stop slows it to nothing. A repeat takes no material: it loops the last
 * slice of the whole mix for the note's length, the slice a beat divided by
 * BOTANICA_REPEAT_DIVISIONS[mod >> 4].
 */
export const BOTANICA_GLITCHES = ['stutter', 'crush', 'freeze', 'reverse', 'tape', 'repeat'] as const;
export type BotanicaGlitch = typeof BOTANICA_GLITCHES[number];
export const BOTANICA_MATERIAL_BIRD = 15;
export const BOTANICA_REPEAT_DIVISIONS = [2, 3, 4, 6, 8] as const;

/** A `nature` note's `mod`. */
export function natureMod(kind: BotanicaNature, variant = 0): number { return BOTANICA_NATURE.indexOf(kind) + 16 * Math.max(0, Math.floor(variant)); }
/** What a `nature` note plays. */
export function readNature(mod: number): { kind: BotanicaNature; variant: number } {
  const m = Math.max(0, Math.floor(mod));
  return { kind: BOTANICA_NATURE[m % 16] ?? 'wind', variant: m >> 4 };
}
/** A `grain` note's `mod`. */
export function grainMod(source: BotanicaSource, cloud: BotanicaCloud): number { return BOTANICA_SOURCES.indexOf(source) + 16 * BOTANICA_CLOUDS.indexOf(cloud); }
/** What a `grain` note's pad is cut from, and how. */
export function readGrain(mod: number): { source: BotanicaSource; cloud: BotanicaCloud } {
  const m = Math.max(0, Math.floor(mod));
  return { source: BOTANICA_SOURCES[m % 16] ?? 'piano', cloud: BOTANICA_CLOUDS[m >> 4] ?? 'shimmer' };
}
/** A `glitch` note's `mod`: the glitch and its material (a source's index, BOTANICA_MATERIAL_BIRD, or a repeat's division). */
export function glitchMod(kind: BotanicaGlitch, material: number): number { return BOTANICA_GLITCHES.indexOf(kind) + 16 * Math.max(0, Math.floor(material)); }
/** What a `glitch` note does, and to what. */
export function readGlitch(mod: number): { kind: BotanicaGlitch; material: number } {
  const m = Math.max(0, Math.floor(mod));
  return { kind: BOTANICA_GLITCHES[m % 16] ?? 'stutter', material: m >> 4 };
}

// ── the kit the composer lends ──────────────────────────────────────────────

/** A chord as the composer builds one: its root (a pitch class), its quality (a QUALITIES name), its name and its tones, root first. */
export interface BotanicaChord { root: number; quality: string; name: string; tones: number[] }
/** The pieces of lofi-compose.ts this path shares, handed in so neither module imports the other at run time. */
export interface BotanicaKit {
  /** The chord on `degree` semitones above `key`, of `quality` (a QUALITIES name). */
  chord(key: number, degree: number, quality: string): BotanicaChord;
  /** The keys' voicing of a chord: up to four of its tones, close to the last voicing. */
  voicing(chord: BotanicaChord, prev: number[] | null): number[];
  /** The tune's instruments and colour, drawn as every dance genre's are (DANCE.botanica). */
  style(rng: () => number, fixed: Partial<LofiStyle>): LofiStyle;
  /** The weights the style's leads and keys were drawn from, for the second lead and the softer keys. */
  leads: ReadonlyArray<readonly [LofiStyle['lead'], number]>;
  softKeys: ReadonlyArray<readonly [LofiStyle['keys'], number]>;
  switchBass: ReadonlyArray<readonly [LofiStyle['bass'], number]>;
  /** A pitch class's name ("E♭"). */
  names: readonly string[];
}

// ── harmony ──────────────────────────────────────────────────────────────────

type Prog = ReadonlyArray<readonly [number, string]>;
/** Open, unhurried progressions: the lydian II, a sus that never quite resolves, a chord held under a moving top. */
const MAJOR: readonly Prog[] = [
  [[0, 'maj9'], [2, 'add9'], [0, 'maj9'], [9, 'm9']],
  [[5, 'maj9'], [0, 'add9'], [7, 'sus'], [9, 'm9']],
  [[0, 'six9'], [4, 'm7'], [5, 'maj9'], [0, 'maj9']],
  [[9, 'm9'], [5, 'maj9'], [0, 'six9'], [7, 'sus']],
  [[0, 'maj9'], [0, 'six9'], [5, 'maj9'], [5, 'maj9']],
  [[5, 'maj9'], [9, 'm9'], [2, 'add9'], [0, 'maj9']],
];
/** Dorian and aeolian: the minor eleventh, the major IV of dorian, the ♭VI and ♭III that lift. */
const MINOR: readonly Prog[] = [
  [[0, 'm9'], [5, 'dom9'], [0, 'm11'], [3, 'maj9']],
  [[0, 'm11'], [8, 'maj9'], [3, 'maj9'], [10, 'add9']],
  [[0, 'madd9'], [8, 'maj9'], [5, 'm9'], [0, 'madd9']],
  [[0, 'm9'], [10, 'sus'], [8, 'maj9'], [3, 'six9']],
  [[0, 'm11'], [0, 'm9'], [8, 'maj9'], [8, 'maj9']],
  [[3, 'maj9'], [10, 'add9'], [0, 'm11'], [5, 'm9']],
];
const PENTA_MAJOR = [0, 2, 4, 7, 9];
const PENTA_MINOR = [0, 3, 5, 7, 10];

// ── places ───────────────────────────────────────────────────────────────────

/** Where a tune is set: the beds that run under it, the birds that sing in it, and the insects. */
interface Place { beds: readonly BotanicaNature[]; birds: readonly BotanicaBird[]; insect?: BotanicaInsect; percussion: readonly ('twig' | 'droplet')[] }
const PLACES: ReadonlyArray<readonly [Place, number]> = [
  [{ beds: ['wind', 'leaves'], birds: ['blackbird', 'robin', 'wren', 'thrush'], percussion: ['twig', 'droplet'] }, 3],   // a wood
  [{ beds: ['stream'], birds: ['wren', 'robin', 'thrush'], insect: 'bee', percussion: ['droplet', 'twig'] }, 3],   // a stream
  [{ beds: ['rain', 'drip'], birds: ['blackbird', 'dove'], percussion: ['droplet'] }, 2],   // a garden in the rain
  [{ beds: ['wind', 'insects'], birds: ['magpie', 'dove'], insect: 'cicada', percussion: ['twig'] }, 2],   // a meadow at midday
  [{ beds: ['insects', 'stream'], birds: ['thrush'], insect: 'cricket', percussion: ['droplet', 'twig'] }, 2],   // dusk
  [{ beds: ['drip', 'wind'], birds: [], percussion: ['droplet'] }, 1],   // a cave
];

/** The tallest note each bird sings round (MIDI), so a test can read the range; the shell's model owns the song. */
export const BIRD_PITCH: Record<BotanicaBird, number> = { blackbird: 95, robin: 105, wren: 106, thrush: 99, dove: 69, magpie: 90 };

// ── the running order ─────────────────────────────────────────────────────────

type Form = 'drift' | 'groove';
interface Part { section: LofiSection; bars: number; prog: 0 | 1; alt?: boolean; open: readonly [number, number]; fade?: boolean; free?: boolean }

/** A drift: the place alone, the pad and the keys, a verse, two blooms either side of a clearing, the place again. */
function driftOrder(r: () => number): Part[] {
  const bloom = r() < 0.5 ? 8 : 6;
  return [
    { section: 'intro', bars: 4, prog: 0, open: [0.7, 0.95] },
    { section: 'verse', bars: 8, prog: 0, open: [0.95, 1] },
    { section: 'drop', bars: bloom, prog: 1, open: [1, 1] },
    { section: 'break', bars: 4, prog: 0, open: [0.95, 0.9], free: true },
    { section: 'drop', bars: bloom, prog: 1, alt: true, open: [1, 1] },
    { section: 'outro', bars: 4, prog: 0, open: [0.95, 0.75], fade: true, free: true },
  ];
}
/** A groove: the place and the pad, the band coming in, a glitched build, a bloom, a free clearing, a build and the second bloom, then the band leaving. */
function grooveOrder(r: () => number): Part[] {
  const bloom = r() < 0.6 ? 16 : 12;
  return [
    { section: 'intro', bars: 8, prog: 0, open: [0.7, 0.95] },
    { section: 'verse', bars: 8, prog: 0, open: [0.95, 1] },
    { section: 'build', bars: 4, prog: 0, open: [0.9, 1] },
    { section: 'drop', bars: bloom, prog: 1, open: [1, 1] },
    { section: 'break', bars: 8, prog: 0, open: [0.95, 0.85], free: true },
    { section: 'build', bars: 4, prog: 0, open: [0.9, 1] },
    { section: 'drop', bars: bloom, prog: 1, alt: true, open: [1, 1] },
    { section: 'outro', bars: 8, prog: 0, open: [0.95, 0.75], fade: true },
  ];
}

// ── the composer ─────────────────────────────────────────────────────────────

/** A stream of the style's own, scrambled from the seed (MurmurHash3's finish), so neighbouring seeds draw unrelated choices. */
function stream(seed: number, salt: number): () => number {
  let h = (seed ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return mulberry32((h ^ (h >>> 16)) >>> 0);
}
function weighted<T>(r: () => number, w: ReadonlyArray<readonly [T, number]>): T {
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
  return scale.includes(pc(p)) ? p : nearestTone(p, scale);
}
/** A beat kept inside its bar, as the notes must start. */
const inBar = (b: number): number => Math.max(0, Math.min(3.97, b));
/** Whether a beat is a strong one (the first or third), where the lead must sit on the chord. */
const strong = (b: number): boolean => Math.abs(b - Math.round(b / 2) * 2) < 0.05;

/** Everything a tune draws before its bars, from the style's own streams. */
interface Plan {
  form: Form; place: Place; birds: readonly BotanicaBird[]; source: BotanicaSource; sourceB: BotanicaSource;
  glitchiness: number; pulse: boolean; halfTime: boolean;
  kicks: readonly [readonly number[], readonly number[]]; hats: readonly number[];
  bassFig: readonly [readonly (readonly [number, number, number])[], readonly (readonly [number, number, number])[]];
  ostinato: readonly number[]; motifs: readonly [Motif, Motif, Motif];
}
/** A bar of melody: [sixteenth, scale steps from the last note, length in sixteenths]. */
type Motif = readonly [ReadonlyArray<readonly [number, number, number]>, ReadonlyArray<readonly [number, number, number]>];

const GROOVE_KICKS: ReadonlyArray<readonly number[]> = [[0, 6, 10], [0, 7, 11, 14], [0, 3, 8, 10], [0, 10], [0, 6, 9, 12], [0, 5, 8, 13]];
const GROOVE_HATS: ReadonlyArray<readonly number[]> = [[2, 6, 10, 14], [0, 2, 3, 6, 8, 10, 11, 14], [2, 4, 6, 10, 12, 14, 15], [1, 2, 5, 6, 9, 10, 13, 14]];
/** Bass figures: [sixteenth, length in sixteenths, where (0 root, 7 fifth, 12 octave, -1 the approach to the next chord)]. */
const BASS_FIGS: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[0, 6, 0], [6, 2, 12], [10, 4, 7], [14, 2, -1]],
  [[0, 3, 0], [3, 3, 0], [8, 6, 7], [14, 2, -1]],
  [[0, 8, 0], [10, 2, 12], [12, 4, 7]],
  [[0, 4, 0], [7, 3, 7], [10, 2, 0], [12, 4, 12]],
];
/** A picked ostinato: which voicing note (from the bottom) sounds on each sixteenth, or -1 for none. */
const OSTINATI: ReadonlyArray<readonly number[]> = [
  [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 3, -1, 2, -1],
  [0, -1, -1, 2, -1, -1, 1, -1, 3, -1, -1, 2, -1, -1, 1, -1],
  [0, 2, 3, -1, 1, 2, 3, -1, 0, 2, 3, -1, 1, 3, 2, -1],
  [0, -1, 1, 2, -1, 3, -1, 2, 0, -1, 1, 2, -1, 3, 2, -1],
];

function motifOf(r: () => number, busy: number): Motif {
  const bar = (answer: boolean): Array<readonly [number, number, number]> => {
    const count = 2 + Math.floor(r() * (1 + busy * 4));
    const steps = new Set<number>();
    while (steps.size < count) {
      const s = Math.floor(r() * 8) * 2 + (r() < 0.12 ? 1 : 0);
      if (s < (answer ? 11 : 15)) steps.add(s);
    }
    const sorted = [...steps].sort((a, b) => a - b);
    return sorted.map((step, n) => [step, [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(r() * 8)]!, Math.max(2, ((sorted[n + 1] ?? 16) - step))] as const);
  };
  return [bar(false), bar(true)];
}

/** Build one botanica tune's bars, before the tag. */
export function composeBotanica(seed: number, fixed: Partial<LofiStyle>, kit: BotanicaKit): LofiBar[] {
  const rng = mulberry32(seed >>> 0);
  const key = Math.floor(rng() * 12);
  const minor = rng() < 0.5;
  const style = kit.style(rng, fixed);
  // The style's own draws, each from a stream of its own.
  const b = stream(seed, 0xb07a);
  const form: Form = b() < 0.5 ? 'drift' : 'groove';
  const bpm = form === 'drift' ? Math.round(40 + b() * 30) : Math.round(100 + b() * 68);
  const parts = form === 'drift' ? driftOrder(b) : grooveOrder(b);
  const place = weighted(b, PLACES);
  const birds = place.birds.length ? [...new Set([pickOf(b, place.birds), pickOf(b, place.birds)])] : [];
  const sources: ReadonlyArray<readonly [BotanicaSource, number]> = [['piano', 3], ['guitar', 2], ['nylon', 2], ['fiddle', 2], ['voice', 3], ['flute', 1], ['breath', 1], ['harp', 1]];
  const source = weighted(b, sources);
  const sourceB = weighted(b, sources.filter(([s]) => s !== source));
  const plan: Plan = {
    form, place, birds, source, sourceB,
    glitchiness: form === 'drift' ? 0.25 + b() * 0.25 : 0.55 + b() * 0.4,
    pulse: form === 'drift' && b() < 0.5,
    halfTime: form === 'groove' && bpm >= 132 && b() < 0.75,
    kicks: [pickOf(b, GROOVE_KICKS), pickOf(b, GROOVE_KICKS)],
    hats: pickOf(b, GROOVE_HATS),
    bassFig: [pickOf(b, BASS_FIGS), pickOf(b, BASS_FIGS)],
    ostinato: pickOf(b, OSTINATI),
    motifs: [motifOf(b, form === 'drift' ? 0.2 : 0.45), motifOf(b, form === 'drift' ? 0.25 : 0.55), motifOf(b, form === 'drift' ? 0.3 : 0.6)],
  };

  const pool = minor ? MINOR : MAJOR;
  const progA = pickOf(b, pool);
  let progB = pickOf(b, pool);
  for (let tries = 0; progB === progA && tries < 4; tries++) progB = pickOf(b, pool);
  const chords = [progA.map(([d, q]) => kit.chord(key, d, q)), progB.map(([d, q]) => kit.chord(key, d, q))] as const;
  const scale = (minor ? PENTA_MINOR : PENTA_MAJOR).map(i => (key + i) % 12);
  const chordBars: 1 | 2 = form === 'drift' ? 2 : b() < 0.5 ? 2 : 1;
  const tuneStyle: LofiStyle = { ...style, chordBars, groove: form === 'drift' ? 'sparse' : 'halfStep', hats: fixed.hats ?? (form === 'drift' ? 'shaker' : 'hat') };

  // A second voice for the second bloom, softer keys for the quiet sections and a bass for the second bloom, drawn as the dance genres draw theirs.
  const other = <T>(w: ReadonlyArray<readonly [T, number]>, not: T): T => {
    const rest = w.filter(([v]) => v !== not);
    return rest.length ? weighted(b, rest) : not;
  };
  const softKeys = fixed.keys ?? other(kit.softKeys, tuneStyle.keys);
  const leadB = fixed.lead ?? other(kit.leads, tuneStyle.lead);
  const bassB = fixed.bass ?? other(kit.switchBass, tuneStyle.bass);
  const voicesOf = (p: Part): LofiBar['voices'] => {
    if (p.section === 'intro' || p.section === 'outro' || p.section === 'break') return { keys: softKeys };
    if (p.section === 'drop' && p.alt) return { lead: leadB, bass: bassB };
    return undefined;
  };

  const total = parts.reduce((s, p) => s + p.bars, 0) + 1;
  const info: LofiTuneInfo = {
    seed: seed >>> 0, mood: 'botanica', bpm, swing: 0.5, swing8: 0.5, style: tuneStyle,
    key: `${kit.names[key]} ${minor ? 'minor' : 'major'}`,
    progressions: [chords[0].map(c => c.name), chords[1].map(c => c.name)],
    bars: total,
  };

  const n = stream(seed, 0x9a7e);   // the place's sounds
  const g = stream(seed, 0x611c);   // the glitches
  const m = stream(seed, 0x4e10);   // the playing: timing, velocities, pitches
  const bars: LofiBar[] = [];
  let prevVoicing: number[] | null = null;
  let prevLead = minor ? 72 : 74;
  let index = 0;
  let birdAt = 0;
  for (const part of parts) {
    const prog = chords[part.prog];
    const voices = voicesOf(part);
    for (let i = 0; i < part.bars; i++, index++) {
      const slot = Math.floor(i / chordBars);
      const firstOfChord = i % chordBars === 0;
      const chord = prog[slot % prog.length]!;
      const nextChord = prog[(slot + 1) % prog.length]!;
      if (firstOfChord || i === 0) prevVoicing = kit.voicing(chord, prevVoicing);
      const voicing = prevVoicing ?? [];
      const notes: LofiNote[] = [];
      const ctx: BarCtx = { form, part, i, plan, chord, nextChord, voicing, chordBars, firstOfChord, bpm, key, scale, notes, m, n, g, keysV: voices?.keys ?? tuneStyle.keys };
      const layers = new Set<LofiLayer>(['fx']);

      const quietStart = part.section === 'intro' && i < (form === 'drift' ? 2 : 4);
      if (!quietStart) { pad(ctx); layers.add('keys'); }
      if (!(part.section === 'intro' && i < (form === 'drift' ? 2 : 4)) && part.section !== 'build') keys(ctx);
      if (part.section === 'build') buildKeys(ctx);
      const bassOn = part.section === 'verse' || part.section === 'drop' || (part.section === 'build' && form === 'groove') || (part.section === 'outro' && i < 2);
      if (bassOn) { bass(ctx); layers.add('bass'); }
      const leadOn = part.section === 'drop' || (part.section === 'verse' && i >= part.bars / 2) || (part.section === 'break' && i >= 1 && i < part.bars - 1);
      const rests = leadOn ? lead(ctx, (p: number) => { prevLead = p; }, prevLead) : [0, 4];
      if (leadOn) layers.add('lead');
      if (form === 'groove' || plan.pulse) for (const l of drums(ctx)) layers.add(l);
      placeSounds(ctx, rests, (beat: number) => birdAt <= index * 4 + beat, (until: number) => { birdAt = until; }, index);
      glitches(ctx);

      const [o0, o1] = part.open;
      const open = Math.round((o0 + (o1 - o0) * (part.bars > 1 ? i / (part.bars - 1) : 1)) * 1000) / 1000;
      const level = part.fade ? Math.max(0.2, 1 - (i + 1) * (0.8 / part.bars)) : 1;
      notes.sort((a, z) => a.beat - z.beat);
      bars.push({ tune: info, index, section: part.section, layers: [...layers], chord: chord.name, tones: chord.tones, notes, open, level, ...(voices ? { voices } : {}) });
    }
  }
  bars.push({ tune: info, index, section: 'rest', layers: [], chord: '', tones: [], notes: [], open: 0.3, level: 0 });
  return bars;
}

/** What one bar's writers share. */
interface BarCtx {
  form: Form; part: Part; i: number; plan: Plan;
  chord: BotanicaChord; nextChord: BotanicaChord; voicing: readonly number[]; chordBars: number; firstOfChord: boolean;
  bpm: number; key: number; scale: readonly number[]; notes: LofiNote[];
  /** The playing's stream, the place's and the glitches'. */
  m: () => number; n: () => number; g: () => number;
  keysV: LofiStyle['keys'];
}

/** Where a note on sixteenth `step` is played: on the grid in a groove, pulled by feel in a drift or a free passage. */
function feel(c: BarCtx, step: number, amount = 1): number {
  const beat = step / 4;
  if (c.form === 'groove' && !c.part.free) return beat;
  // A phrase's time leans: late into the bar's middle and back, a little each note, as a player breathes with the phrase.
  const lean = Math.sin((Math.PI * beat) / 4) * 0.09 * amount;
  return inBar(beat + lean + (c.m() - 0.5) * 0.05 * amount);
}

/** The granular pad: the chord's tones, each held through the chord, cut from the tune's source. */
function pad(c: BarCtx): void {
  if (!c.firstOfChord && c.i !== 0) return;
  const { part } = c;
  const cloud: BotanicaCloud = part.section === 'break' ? (c.m() < 0.5 ? 'stretch' : 'reverse')
    : part.section === 'drop' ? (c.form === 'drift' ? 'shimmer' : c.m() < 0.7 ? 'shimmer' : 'scatter')
    : part.section === 'build' ? 'reverse'
    : part.section === 'intro' || part.section === 'outro' ? 'stretch' : c.m() < 0.6 ? 'stretch' : 'shimmer';
  const source = part.alt || part.section === 'break' ? c.plan.sourceB : c.plan.source;
  const left = (c.chordBars - (c.i % c.chordBars)) * 4;
  const tones = [...c.voicing].sort((a, z) => a - z);
  const take = part.section === 'intro' || part.section === 'outro' ? tones.filter((_, k) => k !== 1) : tones;
  for (const [k, p] of take.slice(0, 3).entries()) {
    // A drift's pads sit under its piano or guitar, which have no drums to compete with.
    const level = (part.section === 'drop' ? 0.46 : 0.38) * (c.form === 'drift' ? 0.75 : 1);
    c.notes.push({ voice: 'grain', midi: k === 2 ? p + 12 : p, beat: 0, dur: left + 0.75, vel: clampVel(level - k * 0.04), mod: grainMod(source, cloud) });
  }
}

/** The keys: rolled chords and falling notes in a drift or a free passage, a picked ostinato in a groove. */
function keys(c: BarCtx): void {
  const { notes, voicing, part } = c;
  if (!voicing.length) return;
  const strike = (at: number, p: number, len: number, vel: number): void => { notes.push({ voice: 'keys', midi: p, beat: inBar(at), dur: len, vel: clampVel(vel + (c.m() - 0.5) * 0.08) }); };
  const quiet = part.section === 'intro' || part.section === 'outro' || part.section === 'break';
  if (c.form === 'drift' || part.free || part.section === 'intro') {
    // A chord rolled slowly from the bottom where the chord starts, left to ring.
    if (c.firstOfChord || c.i === 0) {
      const spread = 0.06 + c.m() * 0.12;
      [...voicing].sort((a, z) => a - z).forEach((p, k) => { strike(feel(c, 0, 0.5) + k * spread, p, c.chordBars * 4 - 0.5, quiet ? 0.48 : 0.6); });
    }
    // Then a few of its notes, falling where they fall, each ringing on.
    const count = quiet ? 1 + Math.floor(c.m() * 2) : 2 + Math.floor(c.m() * 3);
    let at = 1 + c.m() * 0.8;
    for (let k = 0; k < count && at < 3.9; k++) {
      const p = voicing[Math.floor(c.m() * voicing.length)]!;
      strike(at, c.m() < 0.25 && p + 12 <= 76 ? p + 12 : p, 2.2, quiet ? 0.34 : 0.46);
      at += 0.55 + c.m() * 1.1;
    }
    return;
  }
  // A groove's keys pick an ostinato over the voicing, the accent on each group's first note.
  const sorted = [...voicing].sort((a, z) => a - z);
  for (let s = 0; s < 16; s++) {
    const which = c.plan.ostinato[s]!;
    if (which < 0) continue;
    const p = sorted[which % sorted.length]!;
    const accent = s === 0 || c.plan.ostinato[s - 1] === -1;
    strike(s / 4, p, 0.6, part.section === 'verse' ? (accent ? 0.46 : 0.36) : accent ? 0.52 : 0.4);
  }
}

/** A build's keys: the chord struck on every beat, then every eighth, louder as it climbs. */
function buildKeys(c: BarCtx): void {
  const every = c.i >= c.part.bars - 1 ? 2 : 4;
  for (let s = 0; s < 16; s += every) for (const p of c.voicing) c.notes.push({ voice: 'keys', midi: p, beat: s / 4, dur: every / 4 - 0.05, vel: clampVel(0.34 + (c.i / c.part.bars) * 0.25) });
}

/** The bass: a held root in a drift, a figure in a groove. */
function bass(c: BarCtx): void {
  const root = placeIn(c.chord.root, 33, 44);
  const fifth = root + 7;
  const next = placeIn(c.nextChord.root, 33, 44);
  if (c.form === 'drift') {
    if (c.firstOfChord) c.notes.push({ voice: 'bass', midi: root, beat: feel(c, 0, 0.3), dur: c.chordBars * 4 - 0.6, vel: 0.7 });
    else if (c.m() < 0.6) c.notes.push({ voice: 'bass', midi: c.m() < 0.5 ? fifth : root, beat: feel(c, 8, 0.5), dur: 1.6, vel: 0.5 });
    return;
  }
  if (c.part.section === 'build') {
    for (let s = 0; s < 16; s += 4) c.notes.push({ voice: 'bass', midi: root, beat: s / 4, dur: 0.8, vel: 0.62 });
    return;
  }
  const fig = c.plan.bassFig[c.part.alt ? 1 : 0];
  for (const [st, len, where] of fig) {
    const midi = where === -1 ? (next === root ? fifth : next + (next > root ? -1 : 1)) : root + where;
    c.notes.push({ voice: 'bass', midi, beat: st / 4, dur: len / 4 - 0.05, vel: st === 0 ? 0.78 : 0.62 });
  }
}

/**
 * The lead's melody, a motif and its answer, from the key's pentatonic scale with a chord
 * tone on the strong beats. Returns the stretches of the bar it leaves free (beats), where
 * the birds may sing.
 */
function lead(c: BarCtx, set: (p: number) => void, from: number): number[] {
  const { part, notes } = c;
  // The third bar of every four rests: the birds answer there.
  if (c.i % 4 === 2 && part.section !== 'break') return [0, 4];
  const mo = c.plan.motifs[part.section === 'drop' ? (part.alt ? 2 : 1) : 0];
  const line = mo[c.i % 2]!;
  let prev = from;
  let lastEnd = 0;
  for (const [step, move, len] of line) {
    if (part.free && c.m() < 0.3) continue;   // a free passage leaves more out
    const beat = feel(c, step);
    let p = stepScale(prev, move, c.scale);
    if (strong(beat) || step % 8 === 0) p = nearestTone(p, c.chord.tones);
    while (p < 64) p += 12;
    while (p > 84) p -= 12;
    if (strong(beat)) p = nearestTone(p, c.chord.tones);
    if (p > 84) p -= 12;
    if (p < 64) p += 12;
    prev = p;
    const dur = Math.max(0.3, (len / 4) * (c.form === 'drift' ? 1.1 : 0.9));
    // A groove's lead rides over its drums; a drift's sings softly over the pads and the place.
    const vel = c.form === 'groove' ? (part.section === 'drop' ? 0.66 : 0.56) : part.section === 'drop' ? 0.52 : 0.46;
    notes.push({ voice: 'lead', midi: p, beat, dur, vel: clampVel(vel + (c.m() - 0.5) * 0.12) });
    lastEnd = Math.max(lastEnd, beat + dur);
  }
  set(prev);
  return lastEnd < 3 ? [lastEnd + 0.25, 4] : [];
}

/** The drums: a groove's soft kick, snaps, crushed hats that ratchet, shakers and the place's twigs and drops; a drift's pulse at most. */
function drums(c: BarCtx): LofiLayer[] {
  const { part, notes, plan } = c;
  const section = part.section;
  if (part.free || section === 'intro' && c.i < part.bars / 2) return [];
  const hit = (voice: LofiNote['voice'], beat: number, vel: number, mod?: number, midi = 0): void => {
    notes.push({ voice, midi, beat: inBar(beat), dur: 0, vel: clampVel(vel), ...(mod === undefined ? {} : { mod }) });
  };
  const percussion = plan.place.percussion;
  if (c.form === 'drift') {
    // A drift's pulse: a droplet or a twig on the beat, a shaker breathing between, no kick until the bloom.
    if (section !== 'drop' && section !== 'verse') return [];
    for (const s of [0, 8]) natureHit(c, percussion[0]!, feel(c, s, 0.4), 0.42);
    if (c.m() < 0.6) natureHit(c, percussion[percussion.length - 1]!, feel(c, 12, 0.4), 0.32);
    for (const s of [4, 12]) hit('perc', feel(c, s, 0.3), 0.26, 0);
    if (section === 'drop' && c.i % 2 === 0) hit('kick', 0, 0.55);
    return ['kick', 'hats'];
  }
  const outroOut = section === 'outro' && c.i >= part.bars / 2;
  const kicks = plan.kicks[part.alt ? 1 : 0];
  const backbeat = plan.halfTime ? [8] : [4, 12];
  const layers: LofiLayer[] = [];
  if (section === 'build') {
    // The build: the kick on the beat, a snap roll that doubles each bar, the hats ratcheting.
    const every = [8, 4, 2, 1][Math.min(3, c.i)]!;
    for (let s = 0; s < 16; s += every) hit('snare', s / 4, 0.32 + (c.i * 16 + s) / (part.bars * 16) * 0.5);
    for (let s = 0; s < 16; s += 4) hit('kick', s / 4, 0.6);
    return ['kick', 'snare', 'hats'];
  }
  if (!outroOut && section !== 'intro') {
    for (const s of kicks) hit('kick', s / 4, s === 0 ? 0.82 : 0.66);
    layers.push('kick');
  }
  if (section !== 'intro' && !outroOut) {
    for (const s of backbeat) hit('snare', s / 4, 0.8);
    // A ghost snap or a twig answering the backbeat.
    if (c.m() < 0.5) natureHit(c, 'twig', (backbeat[0]! + 3) / 4, 0.38);
    layers.push('snare');
  }
  // The hats: a light hat (the hiss without the metal) on the sixteenths between.
  for (const s of plan.hats) hit('hat', s / 4, s % 4 === 2 ? 0.5 : 0.36, s % 2 ? 1 : undefined);
  layers.push('hats');
  // A ratchet: a burst of fast hats at the end of a phrase, a glitch the drummer could not play.
  if (c.i % 4 === 3 && section !== 'outro' && c.g() < 0.7) {
    const count = 3 + Math.floor(c.g() * 4);
    const step = c.g() < 0.5 ? 1 / 8 : 1 / 6;
    for (let k = 0; k < count; k++) hit('hat', 3 + k * step, 0.3 + k * 0.05, 1);
  }
  // The place keeps time too: droplets on the offbeats, a shaker under the bloom, a woodblock answering.
  if (section === 'drop' || section === 'verse') {
    for (const s of [6, 14]) if (c.n() < 0.6) natureHit(c, percussion[0]!, s / 4, 0.36);
    if (section === 'drop') for (let s = 1; s < 16; s += 2) hit('perc', s / 4, s % 4 === 3 ? 0.26 : 0.18, 0);
    if (c.m() < 0.35) hit('perc', 2.75, 0.42, 7, 1);
  }
  return layers;
}

/** A twig snap or a droplet, played as a drum. */
function natureHit(c: BarCtx, kind: 'twig' | 'droplet', beat: number, vel: number): void {
  c.notes.push({ voice: 'nature', midi: kind === 'droplet' ? 88 + Math.floor(c.n() * 8) : 76, beat: inBar(beat), dur: 0.25, vel: clampVel(vel), mod: natureMod(kind, Math.floor(c.n() * 64)) });
}

/**
 * The place: its beds two bars at a time (louder where the music is quiet), and its birds
 * singing in the bar's free stretches (`rests`), never over another bird.
 */
function placeSounds(c: BarCtx, rests: number[], free: (beat: number) => boolean, sing: (until: number) => void, index: number): void {
  const { part, notes, plan } = c;
  const quiet = part.section === 'intro' || part.section === 'break' || part.section === 'outro';
  const bedVel = part.section === 'drop' ? 0.28 : quiet ? 0.72 : 0.4;
  if (c.i % 2 === 0) {
    const span = Math.min(2, part.bars - c.i) * 4;
    plan.place.beds.forEach((bed, k) => {
      const variant = bed === 'insects' ? BOTANICA_INSECTS.indexOf(plan.place.insect ?? 'cricket') + 8 * Math.floor(c.n() * 32) : Math.floor(c.n() * 256);
      notes.push({ voice: 'nature', midi: 60, beat: 0, dur: span + 0.5, vel: clampVel(bedVel * (k ? 0.75 : 1)), mod: natureMod(bed, variant) });
    });
    // Bees about the flowers, now and then, where the place has them.
    if (plan.place.insect === 'bee' && c.n() < 0.3) notes.push({ voice: 'nature', midi: 60, beat: c.n() * 2, dur: 4, vel: 0.4, mod: natureMod('insects', BOTANICA_INSECTS.indexOf('bee') + 8 * Math.floor(c.n() * 32)) });
  }
  if (!plan.birds.length || rests.length < 2) return;
  const [from, to] = rests as [number, number];
  const chance = quiet ? 0.75 : part.section === 'drop' ? 0.45 : 0.55;
  if (to - from < 0.75 || c.n() >= chance) return;
  const beat = inBar(from + c.n() * Math.min(1, to - from - 0.5));
  if (!free(beat)) return;
  const bird = pickOf(c.n, plan.birds);
  // A phrase lasts its bird's breath (seconds), whatever the tempo: the dove's coo is long, the wren's trill quick.
  const seconds = bird === 'dove' ? 2.4 : bird === 'wren' ? 2.2 : bird === 'magpie' ? 2.6 : 1.6 + c.n() * 0.8;
  const dur = (seconds * c.bpm) / 60;
  const song = Math.floor(c.n() * 4096);
  notes.push({ voice: 'nature', midi: BIRD_PITCH[bird], beat, dur, vel: clampVel((quiet ? 0.62 : 0.5) + c.n() * 0.15), mod: natureMod('bird', BOTANICA_BIRDS.indexOf(bird) + 8 * song) });
  sing(index * 4 + beat + dur + (2 * c.bpm) / 60);
}

/**
 * The glitches: a repeat of the mix at the end of a bloom's phrase, a stutter or a crushed
 * note from the tune's own sounds, a frozen chord in the clearing, a tape stop into a
 * bloom, and the console's sparkles and bleeps over the top.
 */
function glitches(c: BarCtx): void {
  const { part, notes, plan, g } = c;
  const amount = plan.glitchiness;
  const material = BOTANICA_SOURCES.indexOf(part.alt ? plan.sourceB : plan.source);
  const top = c.voicing.length ? Math.max(...c.voicing) : 72;
  const chordTone = (lo: number, hi: number): number => placeIn(c.chord.tones[Math.floor(g() * c.chord.tones.length)]!, lo, hi);
  const section = part.section;
  const phraseEnd = c.i % 4 === 3;
  if (section === 'drop' && phraseEnd && g() < amount) {
    // The mix caught and repeated through the bar's last beat (or two, in a groove's half-time).
    const division = c.form === 'drift' ? (g() < 0.5 ? 0 : 1) : 2 + Math.floor(g() * 3);
    const len = c.form === 'groove' && plan.halfTime && g() < 0.4 ? 2 : 1;
    notes.push({ voice: 'glitch', midi: 64, beat: 4 - len, dur: len, vel: 0.8, mod: glitchMod('repeat', division) });
  } else if ((section === 'drop' || section === 'verse') && c.i % 2 === 1 && g() < amount * 0.7) {
    const kind: BotanicaGlitch = g() < 0.55 ? 'stutter' : g() < 0.7 ? 'reverse' : 'crush';
    const at = c.form === 'groove' ? pickOf(g, [2.5, 3, 3.5]) : 2.5 + g();
    notes.push({ voice: 'glitch', midi: chordTone(64, 84), beat: inBar(at), dur: kind === 'stutter' ? 0.75 : 0.5, vel: 0.5, mod: glitchMod(kind, g() < 0.25 && plan.birds.length ? BOTANICA_MATERIAL_BIRD : material) });
  }
  if (section === 'break' && c.i === 0) {
    // The clearing opens on a chord frozen in its spectrum, held under the free time.
    notes.push({ voice: 'glitch', midi: Math.min(84, Math.max(64, top)), beat: 0.5, dur: Math.min(12, part.bars * 4 - 1), vel: 0.42, mod: glitchMod('freeze', material) });
  }
  if (section === 'build' && c.i === part.bars - 1) {
    notes.push({ voice: 'glitch', midi: chordTone(64, 76), beat: 2, dur: 2, vel: 0.6, mod: glitchMod('tape', material) });
  }
  // The console over the organic warmth: a sparkle of the chord at a bloom's turn, and bleeps in the gaps.
  if (section === 'drop' && c.i % 8 === 6 && g() < 0.4 + amount * 0.4) {
    const third = pc((c.chord.tones[1] ?? c.chord.root) - c.chord.root);
    notes.push({ voice: 'sparkle', midi: placeIn(c.chord.root, 64, 75), beat: 2, dur: 1.5, vel: 0.5, mod: third === 3 ? 3 : 4 });
  }
  if ((section === 'drop' || section === 'verse') && g() < amount * 0.35) {
    notes.push({ voice: 'blip', midi: placeIn(c.chord.tones[Math.floor(g() * c.chord.tones.length)]!, 76, 87), beat: pickOf(g, [1.75, 2.75, 3.25, 3.75]), dur: 0.25, vel: 0.42, mod: Math.floor(g() * 3) });
  }
}

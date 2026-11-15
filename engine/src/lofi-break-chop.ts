// SPDX-License-Identifier: MPL-2.0
/**
 * Chopped breaks: a drummer's two bars sampled, cut into sixteenths and played back in a new
 * order, the way jungle, breakbeat and boom-bap producers work a break on a sampler. This
 * writes the drummer's take (what was played and how it sat against the beat) and the
 * producer's sequence of slices; the shell records the take on Lolly's modelled kit in a
 * room, through an old sampler, once per tune, and plays the slices out of that one
 * recording (lib/lofi-break-kit.ts).
 *
 * THE BREAKS ARE LOLLY'S OWN. No famous break is copied. Each take is built from a handful of
 * two-bar kick and snare skeletons written for Lolly in the funk drummer's vocabulary (the
 * kick on one and pushed off the beat, the snare on two and four), and every tune's drummer
 * then plays their own ghost notes, cymbal part, open-hat lifts, pickups and feel, drawn
 * from the tune's seed. No take carries a crash or a fill of its own: those are the
 * producer's, written around the break.
 *
 * A SLICE NOTE is a drum note (kick, snare, hat or open hat, after the loudest drum in the
 * slice, so the timeline, the drums switch and the kick's duck all work) whose `mod` is
 * SLICE plus the slice, its pitch and its gesture (sliceMod). Slices 0 to 31 are the
 * tune's main break (two bars of sixteenths), 32 to 63 a second break the same drummer
 * played, for borrowed beats. A note's `dur` is how long the slice plays before the next
 * one cuts it, as a sampler's voice in mono mode does; a gap between notes is silence.
 *
 * A note's beat is the sixteenth it is sequenced on plus where the sound starts in its
 * slice (the drummer's push or drag, BreakTake.starts), so a slice moved to another
 * sixteenth keeps the drummer's feel; the shell starts the slice a moment early, so its
 * attack is never cut. Rolls and stutters are the producer's, and sit on the grid.
 *
 * Every draw comes from the plan's own stream, so a tune's other parts never move.
 */
import type { LofiNote, LofiSection } from './lofi-compose.ts';
import { mulberry32 } from './zzfx-compose.ts';

/** The styles that chop a break, each with its own sampler, tempo and editing. */
export type BreakStyle = 'jungle' | 'dnb' | 'breakbeat' | 'hiphop' | 'triphop';

// ── slice notes ───────────────────────────────────────────────────────────────

/** A drum note's `mod` at or over this is a slice of the tune's chopped break. */
export const SLICE = 1 << 16;
/** Slices in the recording: two breaks of two bars of sixteenths. */
export const SLICES = 64;
/**
 * How a slice is played: as it is, reversed (the region from its start, played backwards,
 * so it swells into its attack), stretched (held by a sampler's time-stretch, grains of it
 * repeated without changing its pitch), rising (its pitch climbing an octave over the note)
 * or falling (slowing to a stop, as a turntable switched off does).
 */
export const SLICE_GESTURES = ['plain', 'reverse', 'stretch', 'rise', 'fall'] as const;
export type SliceGesture = typeof SLICE_GESTURES[number];
const SLICE_VOICES = new Set<LofiNote['voice']>(['kick', 'snare', 'hat', 'openHat']);
/** The pitch a slice can be moved (semitones). */
const PITCH_LO = -16, PITCH_HI = 15;

/** A slice note's `mod`: the slice (0 to 63), semitones it is pitched (-16 to 15) and its gesture. */
export function sliceMod(slice: number, semis = 0, gesture: SliceGesture = 'plain'): number {
  const s = Math.max(0, Math.min(SLICES - 1, Math.round(slice)));
  const p = Math.max(PITCH_LO, Math.min(PITCH_HI, Math.round(semis))) - PITCH_LO;
  return SLICE + s + p * 64 + SLICE_GESTURES.indexOf(gesture) * 2048;
}
/** What a slice note's `mod` holds, or null when it is not a slice's. */
export function readSlice(mod: number | undefined): { slice: number; semis: number; gesture: SliceGesture } | null {
  if (mod === undefined || mod < SLICE) return null;
  const m = mod - SLICE;
  return { slice: m % 64, semis: (Math.floor(m / 64) % 32) + PITCH_LO, gesture: SLICE_GESTURES[Math.floor(m / 2048)] ?? 'plain' };
}
/** Whether a note is a slice of a chopped break. */
export const isSliceNote = (n: LofiNote): boolean => (n.mod ?? 0) >= SLICE && SLICE_VOICES.has(n.voice);

// ── the drummer's take ────────────────────────────────────────────────────────

/** What a drummer can hit in a take. A ghost is a soft snare stroke; the soft cymbals are the strokes between the accents. */
export type BreakDrum = 'kick' | 'snare' | 'ghost' | 'hat' | 'hatSoft' | 'open' | 'ride' | 'rideSoft';
/** One stroke: its sixteenth (0 to 63, see SLICES), the drum, how hard, and how far after its sixteenth it fell (beats; negative is early). */
export interface BreakHit { step: number; drum: BreakDrum; vel: number; late: number }
/** Which cymbal carries the time: the ride, eighths on the closed hats, or sixteenths on them. */
export type BreakCymbal = 'ride' | 'hats' | 'hats16';

/** One tune's take: the tempo the drummer played at, every stroke, and what each slice holds. */
export interface BreakTake {
  /** The drummer's tempo (bpm): the tune's over this is how far the recording is sped up, its pitch rising with its speed. */
  bpm: number;
  hits: readonly BreakHit[];
  /** Where each slice's sound starts against its sixteenth (beats): its earliest stroke, or the swing's place when it has none. */
  starts: readonly number[];
  /** The voice a slice note takes for each slice: its loudest drum, or null for a slice with no stroke. */
  voices: ReadonlyArray<'kick' | 'snare' | 'hat' | 'openHat' | null>;
  cymbal: BreakCymbal;
  /** The drummer's swing on the sixteenths (0.5 straight). */
  swing: number;
  /** A slice with the main break's backbeat in it, for rolls; and one with its first kick. */
  snare: number;
  kick: number;
}

/**
 * The skeletons: two bars of kick for each, written for Lolly (sixteenths of the bar), and
 * the off-beat snare accents some of them carry. The backbeat on two and four is every
 * skeleton's; the ghost notes, the cymbals and the feel are each tune's own.
 */
const SKELETONS: ReadonlyArray<{ a: readonly number[]; b: readonly number[]; accent?: readonly number[] }> = [
  { a: [0, 3, 10], b: [0, 3, 8, 14] },
  { a: [0, 6, 11], b: [0, 6, 9, 14], accent: [15] },
  { a: [0, 7, 10], b: [0, 2, 7, 13] },
  { a: [0, 3, 6, 11], b: [0, 3, 6, 14, 15], accent: [25] },
  { a: [0, 10], b: [0, 9, 11] },
  { a: [0, 2, 7], b: [0, 2, 10, 13], accent: [14] },
  { a: [0, 3, 8, 10], b: [0, 6, 8, 11] },
  { a: [0, 9, 14], b: [0, 6, 10], accent: [31] },
];
/** Where a ghost note may fall (sixteenths of a bar), never on the beat, and how likely each is. */
const GHOST_AT: ReadonlyArray<readonly [number, number]> = [[1, 0.15], [3, 0.35], [6, 0.3], [7, 0.45], [9, 0.4], [11, 0.3], [13, 0.35], [14, 0.25], [15, 0.4]];

/** Each style's sampler session: how far its record is pitched (semitones), how busy its ghosts are, and the cymbals it favours. */
const SESSIONS: Record<BreakStyle, { pitch: readonly [number, number]; ghosts: number; swing: readonly [number, number]; cymbal: ReadonlyArray<readonly [BreakCymbal, number]> }> = {
  jungle: { pitch: [2.5, 6], ghosts: 1.35, swing: [0.49, 0.53], cymbal: [['ride', 4], ['hats16', 4], ['hats', 2]] },
  dnb: { pitch: [2, 4.5], ghosts: 1.1, swing: [0.49, 0.52], cymbal: [['hats16', 4], ['ride', 3], ['hats', 3]] },
  breakbeat: { pitch: [2, 5], ghosts: 1.1, swing: [0.49, 0.53], cymbal: [['hats16', 5], ['hats', 3], ['ride', 2]] },
  hiphop: { pitch: [-1.5, 0.3], ghosts: 1, swing: [0.5, 0.55], cymbal: [['hats', 6], ['hats16', 3], ['ride', 1]] },
  triphop: { pitch: [-4, -1.5], ghosts: 0.7, swing: [0.5, 0.55], cymbal: [['hats', 5], ['ride', 3], ['hats16', 2]] },
};

const pickWeighted = <T>(r: () => number, w: ReadonlyArray<readonly [T, number]>): T => {
  let x = r() * w.reduce((s, [, n]) => s + n, 0);
  for (const [v, n] of w) { x -= n; if (x < 0) return v; }
  return w[w.length - 1]![0];
};
/** A normal draw (mean 0, deviation 1), cut at 2.5. */
function gauss(r: () => number): number {
  const v = Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
  return Math.max(-2.5, Math.min(2.5, v));
}

/**
 * The drummer's feel, in beats: the backbeat a hair behind, the kick close to the grid, the
 * ghosts and the cymbals looser, the off-sixteenths nearly straight. Fitted to twelve takes
 * of recorded funk drumming (docs/generated-music.md): their backbeat sits 0 to 0.02 of a
 * beat late (median -0.001), their sixteenths swing 0.48 to 0.52 (median 0.50), and their
 * hats stray about 0.03 of a beat, their snare 0.02.
 */
const FEEL = { backbeat: 0.004, backbeatSpread: 0.012, kick: 0.006, snare: 0.01, ghost: 0.016, cymbal: 0.016, ghostLate: 0.003 };

/** A tune's take from its seed, for its style and tempo: the same strokes every time. */
export function breakTake(seed: number, style: BreakStyle, tuneBpm: number): BreakTake {
  const r = mulberry32((seed ^ 0x8b4ea7) >>> 0);
  const session = SESSIONS[style];
  const semis = session.pitch[0] + r() * (session.pitch[1] - session.pitch[0]);
  const bpm = Math.round((tuneBpm / 2 ** (semis / 12)) * 10) / 10;
  const swing = Math.round((session.swing[0] + r() * (session.swing[1] - session.swing[0])) * 1000) / 1000;
  const cymbal = pickWeighted(r, session.cymbal);
  const first = Math.floor(r() * SKELETONS.length);
  let second = Math.floor(r() * (SKELETONS.length - 1));
  if (second >= first) second++;
  const backbeat = FEEL.backbeat + (r() - 0.5) * FEEL.backbeatSpread;
  const hits: BreakHit[] = [];
  const swingAt = (step: number): number => (step % 2 === 1 ? (swing - 0.5) * 0.5 : 0);
  const add = (step: number, drum: BreakDrum, vel: number, spread: number, push = 0): void => {
    hits.push({ step, drum, vel: Math.max(0.08, Math.min(1, vel)), late: Math.round((swingAt(step) + push + gauss(r) * spread) * 10000) / 10000 });
  };
  // Two breaks, each two bars, by the same drummer on the same kit and cymbal.
  for (const [n, sk] of [SKELETONS[first]!, SKELETONS[second]!].entries()) {
    const base = n * 32;
    for (let bar = 0; bar < 2; bar++) {
      const from = base + bar * 16;
      const kicks = new Set(bar === 0 ? sk.a : sk.b);
      for (const s of kicks) add(from + s, 'kick', s === 0 ? 0.95 : 0.78 + r() * 0.12, FEEL.kick);
      for (const s of [4, 12]) add(from + s, 'snare', 0.9 + r() * 0.08, FEEL.snare, backbeat);
      for (const a of sk.accent ?? []) if (Math.floor(a / 16) === bar) add(from + (a % 16), 'snare', 0.62 + r() * 0.12, FEEL.snare, backbeat * 0.5);
      // The drummer's ghost notes, each tune's own: never where the kick or an accent is.
      for (const [s, p] of GHOST_AT) {
        if (kicks.has(s) || (sk.accent ?? []).includes(bar * 16 + s)) continue;
        if (r() < p * session.ghosts) add(from + s, 'ghost', 0.2 + r() * 0.12, FEEL.ghost, FEEL.ghostLate);
      }
      // The time: the ride's eighths (the beats leaned on, now and then a stroke between),
      // the closed hats' eighths, or their sixteenths, accent and lighter stroke in turn.
      for (let s = 0; s < 16; s++) {
        const beat = s % 4 === 0;
        if (cymbal === 'ride') {
          if (s % 2 === 0) add(from + s, beat ? 'ride' : 'rideSoft', beat ? 0.62 + r() * 0.08 : 0.5 + r() * 0.08, FEEL.cymbal);
          else if (r() < 0.3) add(from + s, 'rideSoft', 0.42, FEEL.cymbal);
        } else if (cymbal === 'hats' && s % 2 === 0) add(from + s, beat ? 'hat' : 'hatSoft', beat ? 0.66 : 0.5 + r() * 0.08, FEEL.cymbal);
        else if (cymbal === 'hats16') add(from + s, s % 2 === 0 ? 'hat' : 'hatSoft', s % 2 === 0 ? (beat ? 0.66 : 0.56) : 0.42 + r() * 0.08, FEEL.cymbal);
      }
      // An open hat lifting the bar: on the "and" of four in the second bar, now and then the "and" of two.
      if (cymbal !== 'ride') {
        const lifts = [...(bar === 1 && r() < 0.65 ? [14] : []), ...(r() < 0.25 ? [6] : [])];
        for (const s of lifts) {
          const i = hits.findIndex(h => h.step === from + s && (h.drum === 'hat' || h.drum === 'hatSoft'));
          if (i >= 0) hits.splice(i, 1);
          add(from + s, 'open', 0.58, FEEL.cymbal);
        }
      }
      // A pickup into the loop's top at the end of the second bar: a full stroke or two ghosts.
      if (bar === 1 && !kicks.has(15) && r() < 0.45) {
        const pick = r() < 0.5;
        if (pick) add(from + 15, 'snare', 0.6, FEEL.snare);
        else for (const s of [14, 15]) if (!hits.some(h => h.step === from + s && (h.drum === 'ghost' || h.drum === 'snare'))) add(from + s, 'ghost', 0.28, FEEL.ghost);
      }
    }
  }
  hits.sort((x, y) => x.step - y.step || x.late - y.late);
  const starts: number[] = [];
  const voices: Array<'kick' | 'snare' | 'hat' | 'openHat' | null> = [];
  for (let s = 0; s < SLICES; s++) {
    const here = hits.filter(h => h.step === s);
    starts.push(here.length ? Math.min(...here.map(h => h.late)) : swingAt(s));
    voices.push(here.some(h => h.drum === 'kick') ? 'kick'
      : here.some(h => h.drum === 'snare' || h.drum === 'ghost') ? 'snare'
        : here.some(h => h.drum === 'open') ? 'openHat'
          : here.length ? 'hat' : null);
  }
  return { bpm, hits, starts, voices, cymbal, swing, snare: 4, kick: 0 };
}

// ── the producer's plan ───────────────────────────────────────────────────────

/** How a style edits its break: how often, how hard, and with what. */
interface Editing {
  /** The chance a seed of the style chops a break at all (the others keep their kit). */
  uses: number;
  /** Bars the groove loops before it repeats (1 or 2). */
  loop: number;
  /** Bars between the small edits and the big ones, in a first drop. */
  small: number;
  big: number;
  /** The chance one of the groove bars between them is touched (a ghost slice swapped). */
  touch: number;
  /** The edits each style reaches for, weighted. */
  smallEdits: ReadonlyArray<readonly [SmallEdit, number]>;
  bigEdits: ReadonlyArray<readonly [BigEdit, number]>;
  /** How the build into a drop rolls: in thirty-seconds and sixty-fourths, plainer, a band's fill of sixteenths over its last two beats, or not at all. */
  roll: 'jungle' | 'plain' | 'fill' | 'none';
  /** A second drop's extra edits: small ones on the even bars too, big ones every four. */
  heavier: boolean;
}
type SmallEdit = 'stutter' | 'drag' | 'swap' | 'pitchFill' | 'gap' | 'stretch';
type BigEdit = 'roll32' | 'reverse' | 'halfTime' | 'slow' | 'rearrange' | 'pitchFill' | 'stretch' | 'roll64';

const EDITING: Record<BreakStyle, Editing> = {
  jungle: {
    uses: 1, loop: 2, small: 4, big: 8, touch: 0.05, roll: 'jungle', heavier: true,
    smallEdits: [['stutter', 3], ['drag', 3], ['swap', 2], ['pitchFill', 1], ['gap', 1], ['stretch', 1]],
    bigEdits: [['roll32', 3], ['rearrange', 2], ['reverse', 2], ['halfTime', 1], ['slow', 1], ['pitchFill', 2], ['stretch', 1], ['roll64', 1]],
  },
  dnb: {
    uses: 0.35, loop: 2, small: 8, big: 16, touch: 0.05, roll: 'plain', heavier: false,
    smallEdits: [['drag', 3], ['stutter', 2], ['swap', 2]],
    bigEdits: [['roll32', 2], ['reverse', 1], ['rearrange', 1]],
  },
  breakbeat: {
    uses: 1, loop: 2, small: 4, big: 8, touch: 0.05, roll: 'plain', heavier: false,
    smallEdits: [['drag', 3], ['swap', 3], ['stutter', 2]],
    bigEdits: [['roll32', 3], ['rearrange', 2], ['pitchFill', 2], ['reverse', 1]],
  },
  hiphop: {
    uses: 0.45, loop: 1, small: 8, big: 16, touch: 0, roll: 'fill', heavier: false,
    smallEdits: [['swap', 3], ['stutter', 2], ['gap', 1]],
    bigEdits: [['rearrange', 1]],
  },
  triphop: {
    uses: 0.75, loop: 2, small: 8, big: 16, touch: 0, roll: 'fill', heavier: false,
    smallEdits: [['drag', 2], ['swap', 2], ['gap', 1]],
    bigEdits: [['slow', 2], ['rearrange', 1]],
  },
};

/** One tune's chopping: its take, its editing, the loop it settled on, and a stream for the bars' choices. */
export interface ChopPlan {
  style: BreakStyle;
  take: BreakTake;
  edit: Editing;
  /** Which bars of the main break the groove loops (one bar loops are hip-hop's). */
  loop: readonly number[];
  /** Whether the tune's drummer keeps their own swing, or the tune's (hip-hop's and trip-hop's sit on the tune's swing). */
  ownFeel: boolean;
  r: () => number;
}

/** The salts that keep each style's chopping on a stream of its own. */
const SALT: Record<BreakStyle, number> = { jungle: 0x7a6e1e, dnb: 0xd0bc4b, breakbeat: 0xb4eac4, hiphop: 0x8b0b4b, triphop: 0x7b1b0b };

/** A tune's chopping plan from its seed, or null when its seed keeps the style's own kit. */
export function chopPlan(seed: number, style: BreakStyle, bpm: number): ChopPlan | null {
  const r = mulberry32((seed ^ SALT[style]) >>> 0);
  const edit = EDITING[style];
  if (r() >= edit.uses) return null;
  const take = breakTake(seed, style, bpm);
  const loop = edit.loop === 1 ? [r() < 0.5 ? 0 : 1] : [0, 1];
  return { style, take, edit, loop, ownFeel: style !== 'hiphop' && style !== 'triphop', r };
}

// ── a bar of slices ───────────────────────────────────────────────────────────

/** Where a bar is, for the chopping. */
export interface ChopAt {
  section: LofiSection;
  /** Bars into the section, and its length. */
  inSection: number;
  bars: number;
  lastOfBuild: boolean;
  /** The second drop: heavier edits. */
  alt: boolean;
  /** The last bar before drums stop (a breakdown, the end): the last slice rings out. */
  ringOut: boolean;
  /** How loud the break plays. */
  level: number;
  /** A sixteenth of the bar as a beat with the tune's swing. */
  sb: (step: number) => number;
}

/** One event of a bar, before it becomes a note: when (beats on the grid), which slice (-1 a silence), how. */
interface Ev { at: number; slice: number; semis: number; gesture: SliceGesture; vel: number; tight: boolean }

const GROOVE_VEL = 0.9;

/** The groove: the loop's bar, sixteenth by sixteenth. */
function grooveBar(plan: ChopPlan, inSection: number): Ev[] {
  const half = plan.loop[inSection % plan.loop.length]!;
  return Array.from({ length: 16 }, (_, s) => ({ at: s / 4, slice: half * 16 + s, semis: 0, gesture: 'plain' as const, vel: GROOVE_VEL, tight: false }));
}
/** Replace the events from beat `from` to `to` with `put`. */
function splice(evs: Ev[], from: number, to: number, put: Ev[]): Ev[] {
  return [...evs.filter(e => e.at < from - 1e-6 || e.at >= to - 1e-6), ...put].sort((x, y) => x.at - y.at);
}
/** A slice of the main break holding the drum asked for, near `near`. */
function sliceWith(plan: ChopPlan, voice: 'kick' | 'snare', near: number, r: () => number): number {
  const all = plan.take.voices.map((v, s) => (v === voice && s < 32 ? s : -1)).filter(s => s >= 0);
  if (!all.length) return voice === 'kick' ? plan.take.kick : plan.take.snare;
  // A backbeat for a snare (its loudest), the nearest for a kick; a little variety either way.
  const strong = voice === 'snare' ? all.filter(s => s % 16 === 4 || s % 16 === 12) : all;
  const pool = strong.length ? strong : all;
  return pool.slice().sort((x, y) => Math.abs(x - near) - Math.abs(y - near))[Math.min(pool.length - 1, Math.floor(r() * 2))]!;
}
/** A run of hits on one slice from beat `from` to `to`, `per` to a beat, louder (and higher, by `climb` semitones) as it goes. */
function roll(slice: number, from: number, to: number, per: number, vel: [number, number], climb: [number, number]): Ev[] {
  const n = Math.max(1, Math.round((to - from) * per));
  return Array.from({ length: n }, (_, i) => {
    const t = n > 1 ? i / (n - 1) : 1;
    return { at: from + i / per, slice, semis: Math.round(climb[0] + (climb[1] - climb[0]) * t), gesture: 'plain' as const, vel: vel[0] + (vel[1] - vel[0]) * t, tight: true };
  });
}

/** A small edit, on the bar's last beat or two. */
function smallEdit(plan: ChopPlan, evs: Ev[], kind: SmallEdit, r: () => number): Ev[] {
  const snare = sliceWith(plan, 'snare', 12, r);
  switch (kind) {
    case 'stutter': {
      // The last beat: one slice four times in sixteenths, or the last half beat in thirty-seconds.
      const s = r() < 0.6 ? snare : sliceWith(plan, 'kick', 8, r);
      return r() < 0.5 ? splice(evs, 3, 4, roll(s, 3, 4, 4, [0.85, 0.9], [0, 0])) : splice(evs, 3.5, 4, roll(s, 3.5, 4, 8, [0.6, 0.85], [0, 0]));
    }
    case 'drag': return splice(evs, 3.5, 4, roll(snare, 3.5, 4, 8, [0.45, 0.8], [0, 0]));
    case 'swap': {
      // A beat swapped for another of the break's, sometimes the second break's.
      const beat = 1 + Math.floor(r() * 3);
      const from = (r() < 0.35 ? 32 : 0) + Math.floor(r() * 8) * 4;
      return splice(evs, beat, beat + 1, Array.from({ length: 4 }, (_, j) => ({ at: beat + j / 4, slice: from + j, semis: 0, gesture: 'plain' as const, vel: GROOVE_VEL, tight: false })));
    }
    case 'pitchFill': {
      // The last beat's four sixteenths, a snare and a kick in turn, each pitched higher.
      const k = sliceWith(plan, 'kick', 8, r);
      return splice(evs, 3, 4, [0, 1, 2, 3].map(j => ({ at: 3 + j / 4, slice: j % 2 ? k : snare, semis: 2 + j * 2, gesture: 'plain' as const, vel: 0.8 + j * 0.05, tight: true })));
    }
    case 'gap': {
      // The drums drop out for the last beat, the backbeat's slice answering on its last sixteenth.
      return splice(evs, 3, 4, [{ at: 3, slice: -1, semis: 0, gesture: 'plain', vel: 0, tight: true }, { at: 3.75, slice: snare, semis: 0, gesture: 'plain', vel: 0.85, tight: true }]);
    }
    case 'stretch':
      // The backbeat's slice held through the last beat by the sampler's time-stretch.
      return splice(evs, 3, 4, [{ at: 3, slice: snare, semis: 0, gesture: 'stretch', vel: 0.8, tight: true }]);
  }
}

/** A big edit: the bar's second half re-cut, a roll, a reversed swell, a half-time switch. */
function bigEdit(plan: ChopPlan, evs: Ev[], kind: BigEdit, r: () => number): Ev[] {
  const snare = sliceWith(plan, 'snare', 12, r);
  const kick = sliceWith(plan, 'kick', 0, r);
  const half = evs[0]?.slice !== undefined && evs[0].slice >= 16 ? 16 : 0;
  switch (kind) {
    case 'roll32': {
      // Thirty-seconds on the backbeat's slice from the third or last beat, louder and higher to the bar line.
      const from = r() < 0.5 ? 2 : 3;
      return splice(evs, from, 4, roll(snare, from, 4, 8, [0.5, 1], [0, r() < 0.5 ? 5 : 3]));
    }
    case 'roll64': {
      // Sixteenths, then thirty-seconds, then sixty-fourths over the last half beat.
      return splice(evs, 2, 4, [...roll(snare, 2, 3, 4, [0.6, 0.75], [0, 0]), ...roll(snare, 3, 3.5, 8, [0.7, 0.85], [0, 2]), ...roll(snare, 3.5, 4, 16, [0.8, 1], [2, 5])]);
    }
    case 'reverse': {
      // A reversed backbeat swelling into the next bar's first beat, over the last one or two beats.
      const from = r() < 0.5 ? 2 : 3;
      return splice(evs, from, 4, [{ at: from, slice: half + 12, semis: 0, gesture: 'reverse', vel: 0.9, tight: true }]);
    }
    case 'halfTime': {
      // The second half in half time: a kick on its first beat, the backbeat on its last, ghost slices between.
      const ghosts = plan.take.voices.map((v, s) => (v === 'snare' && s % 16 !== 4 && s % 16 !== 12 && s < 32 ? s : -1)).filter(s => s >= 0);
      const ghost = ghosts.length ? ghosts[Math.floor(r() * ghosts.length)]! : snare;
      return splice(evs, 2, 4, [
        { at: 2, slice: kick, semis: 0, gesture: 'plain', vel: GROOVE_VEL, tight: false },
        { at: 2.5, slice: half + 2, semis: 0, gesture: 'plain', vel: 0.8, tight: false },
        { at: 3, slice: snare, semis: 0, gesture: 'plain', vel: GROOVE_VEL, tight: false },
        { at: 3.75, slice: ghost, semis: 0, gesture: 'plain', vel: 0.7, tight: false },
      ]);
    }
    case 'slow': {
      // The sampler slowed to half speed for the second half: the bar's first beat, an octave down, over two beats.
      return splice(evs, 2, 4, [{ at: 2, slice: half, semis: -12, gesture: 'plain', vel: GROOVE_VEL, tight: true }]);
    }
    case 'rearrange': {
      // The beats in a new order: the first kept, the others drawn from the two bars, the last ending on a drag.
      const beats = [1, 2, 3].map(() => Math.floor(r() * 8));
      let out = evs;
      beats.forEach((b, n) => {
        const at = n + 1;
        out = splice(out, at, at + 1, Array.from({ length: 4 }, (_, j) => ({ at: at + j / 4, slice: b * 4 + j, semis: 0, gesture: 'plain' as const, vel: GROOVE_VEL, tight: false })));
      });
      return r() < 0.6 ? splice(out, 3.5, 4, roll(snare, 3.5, 4, 8, [0.5, 0.85], [0, 0])) : out;
    }
    case 'pitchFill': {
      // The last two beats, the break's own slices climbing a tone at a time.
      return splice(evs, 2, 4, Array.from({ length: 8 }, (_, j) => ({ at: 2 + j / 4, slice: half + 8 + j, semis: j, gesture: 'plain' as const, vel: 0.8 + j * 0.025, tight: true })));
    }
    case 'stretch':
      // The backbeat held for two beats by the time-stretch, a kick slice cutting back in on the last sixteenth.
      return splice(evs, 2, 4, [{ at: 2, slice: snare, semis: 0, gesture: 'stretch', vel: 0.82, tight: true }, { at: 3.75, slice: kick, semis: 0, gesture: 'plain', vel: 0.85, tight: true }]);
  }
}

/** The build into a drop: the break thinning to its snare, then a roll from sixteenths to sixty-fourths, climbing, ending on the bar line. */
function buildBar(plan: ChopPlan, at: ChopAt, r: () => number): Ev[] {
  const left = at.bars - at.inSection;
  const snare = sliceWith(plan, 'snare', 12, r);
  if (plan.edit.roll === 'none') return at.lastOfBuild ? splice(grooveBar(plan, at.inSection), 3.5, 4, []) : grooveBar(plan, at.inSection);
  // A band's pre-chorus turns into its chorus with a fill: the backbeat's slice in sixteenths over the last two beats.
  if (plan.edit.roll === 'fill') return at.lastOfBuild ? splice(grooveBar(plan, at.inSection), 2, 4, roll(snare, 2, 4, 4, [0.5, 0.9], [0, 0])) : grooveBar(plan, at.inSection);
  const progress = at.inSection / Math.max(1, at.bars);
  const climb: [number, number] = [Math.round(progress * 6), Math.round(Math.min(1, (at.inSection + 1) / at.bars) * (plan.edit.roll === 'jungle' ? 12 : 7))];
  if (left > 2) return grooveBar(plan, at.inSection);
  if (left === 2) return [...grooveBar(plan, at.inSection).filter(e => e.at < 2), ...roll(snare, 2, 4, 4, [0.5, 0.7], climb)];
  // The last bar: sixteenths, thirty-seconds, then (jungle) sixty-fourths on the last beat.
  return plan.edit.roll === 'jungle'
    ? [...roll(snare, 0, 2, 4, [0.6, 0.75], [climb[0], climb[0] + 3]), ...roll(snare, 2, 3, 8, [0.75, 0.88], [climb[0] + 3, climb[0] + 7]), ...roll(snare, 3, 4, 16, [0.85, 1], [climb[0] + 7, climb[1]])]
    : [...roll(snare, 0, 2, 4, [0.55, 0.7], [climb[0], climb[0] + 2]), ...roll(snare, 2, 4, 8, [0.7, 1], [climb[0] + 2, climb[1]])];
}

/**
 * One bar of slices. The groove loops the break between the edits: a small edit every four
 * bars (a stutter, a drag, a swapped beat, a climbing fill, a gap, a held slice), a big one
 * every eight (a roll in thirty-seconds or sixty-fourths, a reversed swell, a half-time
 * switch, the sampler slowed, the beats re-cut), and a second drop edits harder (small
 * edits every other bar, big ones every four). A build rolls into its drop.
 */
export function chopBar(plan: ChopPlan, at: ChopAt): LofiNote[] {
  const { r, edit } = plan;
  let evs: Ev[];
  const pos = at.inSection;
  if (at.section === 'build') evs = buildBar(plan, at, r);
  else {
    evs = grooveBar(plan, pos);
    const heavy = edit.heavier && at.alt && at.section === 'drop';
    const quiet = at.section === 'intro' || at.section === 'outro' || at.section === 'verse';
    const bigEvery = heavy ? edit.big / 2 : edit.big;
    const smallEvery = heavy ? Math.max(2, edit.small / 2) : edit.small;
    const last = pos === at.bars - 1;
    if (pos % bigEvery === bigEvery - 1 && !quiet) evs = bigEdit(plan, evs, pickWeighted(r, edit.bigEdits), r);
    else if (pos % smallEvery === smallEvery - 1 && (!quiet || r() < 0.5)) evs = smallEdit(plan, evs, pickWeighted(r, edit.smallEdits), r);
    else if (heavy && pos % 8 === 3 && r() < 0.3) evs = bigEdit(plan, evs, 'halfTime', r);
    else if (pos > 0 && r() < edit.touch) {
      // A touch: one ghost slice swapped for another, the groove otherwise as it was.
      const s = 1 + 2 * Math.floor(r() * 8);
      evs = evs.map(e => (Math.abs(e.at - s / 4) < 1e-6 ? { ...e, slice: (e.slice + 2) % 32 } : e));
    }
    // A drop that ends into a breakdown slows to a stop on its last beat.
    if (last && at.ringOut && at.section === 'drop' && edit.roll === 'jungle' && r() < 0.5) evs = splice(evs, 3, 4, [{ at: 3, slice: evs.find(e => e.at >= 3)?.slice ?? 12, semis: 0, gesture: 'fall', vel: GROOVE_VEL, tight: false }]);
  }
  return notesOf(plan, evs, at);
}

/** The events as notes: each placed by the drummer's feel (or tight, the producer's), lasting until the next one cuts in. */
function notesOf(plan: ChopPlan, evs: Ev[], at: ChopAt): LofiNote[] {
  const { take } = plan;
  const sorted = [...evs].sort((x, y) => x.at - y.at);
  // A sixteenth that carries straight on from the one before, with nothing struck in it, is not retriggered: the slice before plays on.
  const kept = sorted.filter((e, i) => {
    const p = sorted[i - 1];
    return !(p && e.slice >= 0 && p.slice >= 0 && !e.tight && !p.tight && e.gesture === 'plain' && p.gesture === 'plain' && e.semis === 0 && p.semis === 0
      && e.slice === p.slice + 1 && Math.abs(e.at - p.at - 0.25) < 1e-6 && take.voices[e.slice] === null);
  });
  const beatOf = (e: Ev): number => {
    if (e.tight) return e.at;
    const step = Math.round(e.at * 4);
    const grid = plan.ownFeel ? e.at : at.sb(step);
    // The drummer's push or drag in the slice, less the swing when the tune's own swing places the slice.
    const own = take.starts[e.slice] ?? 0;
    return Math.max(0, grid + (plan.ownFeel ? own : own - (e.slice % 2 === 1 ? (take.swing - 0.5) * 0.5 : 0)));
  };
  const beats = kept.map(beatOf);
  const out: LofiNote[] = [];
  for (let i = 0; i < kept.length; i++) {
    const e = kept[i]!;
    if (e.slice < 0) continue;
    const beat = beats[i]!;
    // The bar's last slice plays to the bar line and a moment past, so the next bar's first takes over without a gap.
    const end = i + 1 < kept.length ? beats[i + 1]! : 4 + (at.ringOut ? 1.5 : at.lastOfBuild ? 0 : 0.02);
    const dur = Math.round(Math.max(0.03, end - beat) * 10000) / 10000;
    if (at.lastOfBuild && at.section === 'build' && beat >= 4) continue;
    const voice = take.voices[e.slice] ?? 'hat';
    out.push({ voice, midi: 0, beat: Math.round(beat * 10000) / 10000, dur, vel: Math.max(0.05, Math.min(1, e.vel * at.level)), mod: sliceMod(e.slice, e.semis, e.gesture) });
  }
  return out;
}

// ── the styles' drums with a break chopped in ─────────────────────────────────

/** The genres that chop a break, by the composer's mood. */
const STYLE_OF: Readonly<Record<string, BreakStyle>> = { jungle: 'jungle', dnb: 'dnb', breakbeat: 'breakbeat', hiphop: 'hiphop', triphop: 'triphop' };
/** A tune's chopping, or null when its genre does not chop or its seed keeps the kit. */
export function chopsOf(mood: string, seed: number, bpm: number): ChopPlan | null {
  const style = STYLE_OF[mood];
  return style ? chopPlan(seed, style, bpm) : null;
}
/** A note of the kit the break replaces: the old note-written break, or a kit drum. */
const KIT_DRUMS = new Set<LofiNote['voice']>(['kick', 'snare', 'rim', 'hat', 'openHat']);
const OLD_BREAK = 64;

/**
 * A bar's drums with the break chopped in, in place. Jungle's drums are the break alone.
 * Breakbeat's chopped break replaces the one its kit used to play note by note, a punchier
 * kick under its kicks through a drop. Hip-hop's and trip-hop's replace the kit (a hip-hop
 * break keeps a kick layered under its own, as boom-bap producers layer one). Drum and
 * bass keeps its kit and plays the break over it through a drop and a build's second half,
 * high-passed by the station, as a top loop. A bar with no drums in it is left as it was.
 */
export function chopDrums(notes: LofiNote[], plan: ChopPlan, at: ChopAt & { layers: readonly string[] }): void {
  const drums = at.layers.includes('kick') || at.layers.includes('snare') || at.layers.includes('hats');
  if (!drums) return;
  const { style } = plan;
  if (style === 'dnb' && !(at.section === 'drop' || (at.section === 'build' && at.inSection >= at.bars / 2))) return;
  if (style === 'breakbeat') {
    for (let n = notes.length - 1; n >= 0; n--) {
      const x = notes[n]!;
      if (((x.mod ?? 0) >= OLD_BREAK && (x.mod ?? 0) < SLICE && KIT_DRUMS.has(x.voice)) || (x.voice === 'kick' && (x.mod ?? 0) < OLD_BREAK)) notes.splice(n, 1);
    }
  } else if (style === 'hiphop' || style === 'triphop') {
    // Hip-hop's trap roll, thirty-second hats across a phrase's last beat, stays over the break.
    const roll = notes.filter(n => n.voice === 'hat' && n.beat >= 3).length >= 6;
    for (let n = notes.length - 1; n >= 0; n--) {
      const x = notes[n]!;
      if (KIT_DRUMS.has(x.voice) && !(roll && x.voice === 'hat' && x.beat >= 3)) notes.splice(n, 1);
    }
  }
  const level = style === 'dnb' ? at.level * 0.75 : at.level;
  const chopped = chopBar(plan, { ...at, level });
  // Drum and bass's break is a top loop, its low end high-passed away by the station: its kick slices are not the kit's kick.
  notes.push(...(style === 'dnb' ? chopped.map(n => (n.voice === 'kick' ? { ...n, voice: 'hat' as const } : n)) : chopped));
  // The kick a producer layers under the break's: breakbeat's in a drop, hip-hop's wherever the break plays.
  const layer = (style === 'breakbeat' && at.section === 'drop') || style === 'hiphop';
  if (layer && at.layers.includes('kick')) {
    for (const n of chopped) if (n.voice === 'kick' && readSlice(n.mod)?.gesture === 'plain' && (readSlice(n.mod)?.semis ?? 0) === 0) notes.push({ voice: 'kick', midi: 0, dur: 0, beat: n.beat, vel: style === 'hiphop' ? 0.62 : 0.55 });
  }
}

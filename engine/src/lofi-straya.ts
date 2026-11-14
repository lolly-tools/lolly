// SPDX-License-Identifier: MPL-2.0
/**
 * Straya's didgeridoo and its birds: the parts of the Straya style that lib/lofi-compose.ts's
 * dance path hands to this module. Like every composer here it writes notes, never sound,
 * and is pure and deterministic; every draw comes from the tune's own Straya stream, so no
 * other style moved when it arrived.
 *
 * The didgeridoo plays three roles, the way contemporary Australian roots records use it
 * (the genre's traits, never a ceremonial song and never one player's performance):
 *
 * - The bass: the drone on the key note through the intro, the verses and the outro, the
 *   player's breath pushing a pulse on the stomp's beats and the circular breath once every
 *   bar or two, so the drone never stops and keeps the groove under the stomp.
 * - The middle: through the pre-chorus and the chorus the player turns the drone into a
 *   rhythm, the tongue and the mouth working on the sixteenths ("doo-ga-doo-ga"), the vowel
 *   sweeping "oo" to "ee", tongued accents and toots, two bars of groove and its answer,
 *   building through the pre-chorus into toots on the chorus's downbeat.
 * - The lead: the solo section is the didgeridoo's. It trades phrases with the banjo or the
 *   fiddle, two bars each (or carries the first half alone over the stomp and the clap), with
 *   voiced calls that rise and fall, barks, a howl sung through the drone, toots and sweeps.
 *
 * The notes are `bass` notes for the drone (the tune's bass is the yidaki) and `didge` notes
 * for the other two, each note's `mod` its articulation plus its role times DIDGE_ROLE, its
 * `midi` the drone's pitch: the shell's player (lib/lofi-didgeridoo.ts) knows where its own
 * instrument's toot sits.
 *
 * The birds are Straya's signature, as they are when Australian records sample them: most
 * tunes have one bird moment up front, drawn from the seed, a magpie's carol opening the
 * tune or carrying it into the chorus, or a kookaburra's laugh after the didgeridoo's solo,
 * at a turnaround or as the last sound of the tune; some tunes have both. Featured, the
 * band leaves the lead out under it, like a sampled hook. Between phrases a quieter magpie
 * now and then sings where the lead has rested, never over the lead.
 */
import type { LofiLayer, LofiNote, LofiSection, LofiStyle } from './lofi-compose.ts';
import { mulberry32 } from './zzfx-compose.ts';

// ── what the notes mean ──────────────────────────────────────────────────────

/**
 * How a didgeridoo note is played, in its `mod`: the drone held; the mouth opening and
 * closing on it ("wa"); a toot, the overblown note on the bore's second resonance; a bark
 * shouted into the horn; the circular breath (the drone sags while the nose breathes in,
 * then the lungs push back); a howl, the voice sung through the drone; the tongue sweeping
 * "oo" to "ee" and back; a tongued accent ("d"); a voiced call that rises and falls like an
 * animal's; and a push from the diaphragm with no change of vowel.
 */
export const DIDGE_DRONE = 0, DIDGE_WA = 1, DIDGE_TOOT = 2, DIDGE_BARK = 3, DIDGE_BREATH = 4, DIDGE_HOWL = 5, DIDGE_SWEEP = 6, DIDGE_TONGUE = 7, DIDGE_CALL = 8, DIDGE_PUSH = 9;
/** The articulation's bits in a note's `mod`. */
export const DIDGE_ART = 15;
/** The role in a note's `mod`, times this: 0 the drone (a bass note), 1 the middle's rhythm, 2 the lead. */
export const DIDGE_ROLE = 16;
export const DIDGE_MID = 1, DIDGE_LEAD = 2;

/**
 * A bird note's `mod`: its song's seed in the low bits (under LOFI_BIRD_FEATURE), then
 * LOFI_BIRD_FEATURE when it is a featured moment (up front, the lead clear of it), and how
 * many birds sing together, less one, times LOFI_BIRD_FLOCK (a magpie family's carol, a
 * kookaburra family laughing together).
 */
export const LOFI_BIRD_FEATURE = 4096;
export const LOFI_BIRD_FLOCK = 8192;
/** A bird note's song seed, whether it is featured, and how many birds sing the song. */
export function readBird(mod: number): { song: number; featured: boolean; birds: number } {
  return { song: mod % LOFI_BIRD_FEATURE, featured: (mod & LOFI_BIRD_FEATURE) !== 0, birds: 1 + Math.floor(mod / LOFI_BIRD_FLOCK) % 4 };
}

type Figure = ReadonlyArray<readonly [number, number, number]>;

/**
 * The middle's grooves, a bar of sixteenths each: [step, length, articulation]. They tile
 * the bar, so the drone under them never stops, and each ends where the breath can go.
 */
const MID_GROOVES: readonly Figure[] = [
  // doo-ga-doo-ga: the mouth opening on the beats, the tongue between.
  [[0, 2, DIDGE_WA], [2, 2, DIDGE_TONGUE], [4, 2, DIDGE_WA], [6, 2, DIDGE_TONGUE], [8, 2, DIDGE_WA], [10, 2, DIDGE_TONGUE], [12, 2, DIDGE_WA], [14, 2, DIDGE_TONGUE]],
  // the sweep up to "ee" and down across a dotted beat, tongued back in.
  [[0, 3, DIDGE_SWEEP], [3, 3, DIDGE_TONGUE], [6, 2, DIDGE_WA], [8, 3, DIDGE_SWEEP], [11, 3, DIDGE_TONGUE], [14, 2, DIDGE_WA]],
  // pushes on the stomp, the mouth between, a toot on the backbeat's and.
  [[0, 2, DIDGE_PUSH], [2, 2, DIDGE_WA], [4, 2, DIDGE_PUSH], [6, 2, DIDGE_TOOT], [8, 2, DIDGE_PUSH], [10, 2, DIDGE_WA], [12, 2, DIDGE_PUSH], [14, 2, DIDGE_WA]],
  // a run of tongued sixteenths into a long sweep.
  [[0, 1, DIDGE_TONGUE], [1, 1, DIDGE_TONGUE], [2, 2, DIDGE_WA], [4, 1, DIDGE_TONGUE], [5, 1, DIDGE_TONGUE], [6, 2, DIDGE_WA], [8, 4, DIDGE_SWEEP], [12, 2, DIDGE_TONGUE], [14, 2, DIDGE_WA]],
  // the dotted feel: three and three and two.
  [[0, 3, DIDGE_WA], [3, 3, DIDGE_WA], [6, 2, DIDGE_TONGUE], [8, 3, DIDGE_WA], [11, 3, DIDGE_WA], [14, 2, DIDGE_TONGUE]],
  // "wah-ee": a sweep each half bar, tongued pairs between.
  [[0, 4, DIDGE_SWEEP], [4, 2, DIDGE_TONGUE], [6, 2, DIDGE_TONGUE], [8, 4, DIDGE_SWEEP], [12, 2, DIDGE_TONGUE], [14, 2, DIDGE_TONGUE]],
];
/** A groove's answer bar ends its phrase: the last beat turned into toots. */
const MID_TURNS: readonly Figure[] = [
  [[12, 2, DIDGE_TOOT], [14, 2, DIDGE_TOOT]],
  [[12, 1, DIDGE_TONGUE], [13, 1, DIDGE_TONGUE], [14, 2, DIDGE_TOOT]],
  [[12, 2, DIDGE_SWEEP], [14, 2, DIDGE_TOOT]],
];

/**
 * The lead's phrases, two bars each: [bar, step, length, articulation]. Calls, toots,
 * barks, a howl and sweeps over the drone, then the breath before the answer comes.
 */
const LEAD_PHRASES: ReadonlyArray<ReadonlyArray<readonly [number, number, number, number]>> = [
  [[0, 0, 6, DIDGE_SWEEP], [0, 6, 2, DIDGE_TOOT], [0, 8, 2, DIDGE_TOOT], [0, 10, 6, DIDGE_CALL], [1, 0, 4, DIDGE_HOWL], [1, 4, 2, DIDGE_TONGUE], [1, 6, 2, DIDGE_TONGUE], [1, 8, 2, DIDGE_BARK], [1, 10, 2, DIDGE_DRONE], [1, 12, 2, DIDGE_TOOT], [1, 14, 2, DIDGE_BREATH]],
  [[0, 0, 2, DIDGE_TOOT], [0, 2, 2, DIDGE_WA], [0, 4, 2, DIDGE_TOOT], [0, 6, 2, DIDGE_WA], [0, 8, 8, DIDGE_CALL], [1, 0, 2, DIDGE_BARK], [1, 2, 2, DIDGE_TONGUE], [1, 4, 2, DIDGE_BARK], [1, 6, 2, DIDGE_TONGUE], [1, 8, 4, DIDGE_SWEEP], [1, 12, 2, DIDGE_TOOT], [1, 14, 2, DIDGE_BREATH]],
  [[0, 0, 8, DIDGE_CALL], [0, 8, 2, DIDGE_TOOT], [0, 10, 2, DIDGE_TOOT], [0, 12, 2, DIDGE_TOOT], [0, 14, 2, DIDGE_DRONE], [1, 0, 4, DIDGE_SWEEP], [1, 4, 4, DIDGE_SWEEP], [1, 8, 2, DIDGE_BARK], [1, 10, 2, DIDGE_BARK], [1, 12, 4, DIDGE_BREATH]],
  [[0, 0, 3, DIDGE_BARK], [0, 3, 3, DIDGE_BARK], [0, 6, 2, DIDGE_TOOT], [0, 8, 8, DIDGE_HOWL], [1, 0, 2, DIDGE_TONGUE], [1, 2, 2, DIDGE_TONGUE], [1, 4, 2, DIDGE_TOOT], [1, 6, 2, DIDGE_WA], [1, 8, 6, DIDGE_CALL], [1, 14, 2, DIDGE_BREATH]],
  [[0, 0, 4, DIDGE_WA], [0, 4, 2, DIDGE_TOOT], [0, 6, 2, DIDGE_TOOT], [0, 8, 4, DIDGE_SWEEP], [0, 12, 4, DIDGE_CALL], [1, 0, 4, DIDGE_CALL], [1, 4, 4, DIDGE_HOWL], [1, 8, 2, DIDGE_TOOT], [1, 10, 2, DIDGE_BARK], [1, 12, 4, DIDGE_BREATH]],
  [[0, 0, 2, DIDGE_TONGUE], [0, 2, 2, DIDGE_TONGUE], [0, 4, 4, DIDGE_CALL], [0, 8, 2, DIDGE_TOOT], [0, 10, 2, DIDGE_WA], [0, 12, 2, DIDGE_TOOT], [0, 14, 2, DIDGE_WA], [1, 0, 8, DIDGE_HOWL], [1, 8, 4, DIDGE_SWEEP], [1, 12, 2, DIDGE_BARK], [1, 14, 2, DIDGE_BREATH]],
];

// ── the tune's plan ──────────────────────────────────────────────────────────

/** Where a featured bird sings. */
export type BirdMoment = { bird: 'magpie' | 'kookaburra'; at: 'open' | 'intoDrop' | 'afterSolo' | 'turn' | 'last' };

export interface StrayaPlan {
  r: () => number;
  /** The solo: traded two bars at a time, or the didgeridoo carrying its first half alone. */
  solo: 'trade' | 'carry';
  /** The lead that answers the didgeridoo in the solo. */
  answer: LofiStyle['lead'];
  /** Bars between the drone's circular breaths (one or two), and on which sixteenth it falls. */
  breathEvery: 1 | 2; breathAt: number;
  /** The middle's groove and its answer, and the answer's turn. */
  grooves: readonly [Figure, Figure]; turn: Figure;
  /** The lead's phrases, in the order they come. */
  phrases: readonly number[];
  /** The tune's featured bird moments. */
  birds: readonly BirdMoment[];
  /** The featured birds already sung (each moment sings once). */
  sung: Set<string>;
  /** Beats of the next bar still under a featured bird, where the lead stays out. */
  clearing: number;
}

/** The tune's Straya plan, from a stream of its own (`seed` already mixed). */
export function strayaOf(seed: number, lead: LofiStyle['lead'], fixedLead: boolean): StrayaPlan {
  const r = mulberry32(seed >>> 0);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)] as T;
  const solo = r() < 0.35 ? 'carry' : 'trade';
  // The banjo or the fiddle answers; a lead a person chose answers as itself.
  const answer: LofiStyle['lead'] = fixedLead ? lead : lead === 'banjo' ? (r() < 0.55 ? 'fiddle' : 'banjo') : r() < 0.7 ? 'banjo' : 'fiddle';
  const breathEvery = r() < 0.6 ? 2 : 1;
  const breathAt = pick([12, 14, 14]);
  const g = Math.floor(r() * MID_GROOVES.length);
  const g2 = r() < 0.5 ? g : Math.floor(r() * MID_GROOVES.length);
  const turn = pick(MID_TURNS);
  const order = Array.from({ length: LEAD_PHRASES.length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  // Most tunes have one bird moment up front, some two (a magpie and a kookaburra), a few none.
  const magpies: ReadonlyArray<readonly [BirdMoment['at'], number]> = [['open', 3], ['intoDrop', 2]];
  const kookas: ReadonlyArray<readonly [BirdMoment['at'], number]> = [['afterSolo', 3], ['last', 2], ['turn', 1]];
  const weighted = (w: ReadonlyArray<readonly [BirdMoment['at'], number]>): BirdMoment['at'] => {
    let x = r() * w.reduce((s, [, n]) => s + n, 0);
    for (const [v, n] of w) { x -= n; if (x < 0) return v; }
    return w[0]![0];
  };
  const kinds = r();
  const birds: BirdMoment[] = kinds < 0.08 ? []
    : kinds < 0.36 ? [{ bird: 'magpie', at: weighted(magpies) }, { bird: 'kookaburra', at: weighted(kookas) }]
    : kinds < 0.68 ? [{ bird: 'magpie', at: weighted(magpies) }]
    : [{ bird: 'kookaburra', at: weighted(kookas) }];
  return { r, solo, answer, breathEvery, breathAt, grooves: [MID_GROOVES[g]!, MID_GROOVES[g2]!], turn, phrases: order, birds, sung: new Set(), clearing: 0 };
}

/** A part of a band's running order, as the dance path builds it, with the solo's trades marked. */
export interface StrayaPart { section: LofiSection; bars: number; layers: readonly LofiLayer[]; trade?: 'didge' | 'answer' }

/**
 * The running order with the solo cut into its trades: the didgeridoo's bars (no banjo, no
 * bass drone: the soloist's own drone is under the calls), and the answers. Carried, the
 * first four bars are the didgeridoo's alone over the stomp, the clap and the shaker.
 */
export function strayaParts<P extends StrayaPart>(parts: P[], plan: StrayaPlan): P[] {
  const out: P[] = [];
  for (const p of parts) {
    if (p.section !== 'break') { out.push(p); continue; }
    const drums = p.layers.filter(l => l === 'kick' || l === 'snare' || l === 'hats' || l === 'fx');
    const didge = p.layers.filter(l => l !== 'lead' && l !== 'bass');
    const plan2: Array<[number, 'didge' | 'answer', readonly LofiLayer[]]> = plan.solo === 'carry'
      ? [[4, 'didge', drums], [2, 'answer', p.layers], [2, 'didge', didge]]
      : [[2, 'didge', didge], [2, 'answer', p.layers], [2, 'didge', didge], [2, 'answer', p.layers]];
    let left = p.bars;
    for (const [bars, trade, layers] of plan2) {
      const n = Math.min(bars, left);
      if (n <= 0) break;
      out.push({ ...p, bars: n, trade, layers });
      left -= n;
    }
  }
  return out;
}

// ── the didgeridoo's parts ───────────────────────────────────────────────────

/** Where in the tune a bar of the didgeridoo falls. */
export interface DidgeBar {
  section: LofiSection;
  /** Bars into the part, the part's length, and bars into the section. */
  i: number; bars: number; inSection: number;
  /** The kick's sixteenths in this bar (the stomp's), and whether it is a pre-chorus's last bar. */
  kicks: readonly number[]; lastOfBuild: boolean;
  /** The drone's pitch. */
  root: number;
  /** A sixteenth as a beat, with the tune's swing. */
  sb: (step: number) => number;
}

/** Notes from a figure: each lasting to the next, so the drone between them never stops. */
function tile(steps: ReadonlyArray<readonly [number, number, number, number]>, at: DidgeBar, voice: 'bass' | 'didge', role: number): LofiNote[] {
  const sorted = [...steps].sort((a, b) => a[0] - b[0]);
  return sorted.map(([step, , art, vel], n) => {
    const next = sorted[n + 1]?.[0] ?? 16;
    const beat = at.sb(step);
    return { voice, midi: at.root, beat, dur: Math.max(0.1, at.sb(next) - beat - 0.01), vel, mod: art + role * DIDGE_ROLE };
  });
}

/**
 * The drone under a bar (the bass): a push from the diaphragm on each of the stomp's beats,
 * the drone held between, and the circular breath on its bar, the push back landing on the
 * next downbeat. The intro's last bar ends on a toot into the verse.
 */
export function didgeBass(plan: StrayaPlan, at: DidgeBar): LofiNote[] {
  const r = plan.r;
  const steps: Array<[number, number, number, number]> = [];
  const breathes = (at.inSection + 1) % plan.breathEvery === 0;
  const last = at.section === 'intro' && at.i === at.bars - 1;
  for (const k of at.kicks) {
    if (breathes && k >= plan.breathAt) continue;
    if (last && k >= 12) continue;
    steps.push([k, 0, k === 0 ? DIDGE_PUSH : r() < 0.25 ? DIDGE_WA : DIDGE_PUSH, k === 0 ? 0.74 : 0.62 + r() * 0.06]);
  }
  if (!steps.some(s => s[0] === 0)) steps.push([0, 0, DIDGE_DRONE, 0.66]);
  if (last) steps.push([12, 0, DIDGE_TOOT, 0.8], [14, 0, DIDGE_BREATH, 0.7]);
  else if (breathes) steps.push([plan.breathAt, 0, DIDGE_BREATH, 0.68]);
  return tile(steps, at, 'bass', 0);
}

/**
 * The middle's rhythm for a bar: the groove, its answer turning the phrase, building through
 * a pre-chorus (pushes at first, the groove itself by its second half, toots into the chorus)
 * and the breath on its bar.
 */
export function didgeMid(plan: StrayaPlan, at: DidgeBar): LofiNote[] {
  const build = at.section === 'build';
  let fig: Array<readonly [number, number, number]> = [...plan.grooves[at.inSection % 2]!];
  if (build && at.i < at.bars / 2) fig = MID_GROOVES[2]!.map(([s, l, a]) => [s, l, a === DIDGE_TOOT ? DIDGE_WA : a] as const);
  if (at.inSection % 4 === 3 || at.lastOfBuild) fig = [...fig.filter(([s]) => s < 12), ...(at.lastOfBuild ? [[12, 1, DIDGE_TONGUE], [13, 1, DIDGE_TONGUE], [14, 2, DIDGE_TOOT]] as const : plan.turn)];
  const breathes = !at.lastOfBuild && (at.inSection + 1) % plan.breathEvery === 0;
  if (breathes) fig = [...fig.filter(([s]) => s < 14), [14, 2, DIDGE_BREATH]];
  const lift = build ? 0.05 + (0.15 * (at.i + 1)) / at.bars : 0.2;
  const steps = fig.map(([s, , a]) => [s, 0, a, Math.min(1, (s % 4 === 0 ? 0.62 : 0.5) + lift + (a === DIDGE_TOOT ? 0.12 : 0))] as [number, number, number, number]);
  return tile(steps, at, 'didge', DIDGE_MID);
}

/** The lead's two bars of a phrase: `phrase` counts the didgeridoo's phrases through the solo. */
export function didgeLead(plan: StrayaPlan, at: DidgeBar, phrase: number): LofiNote[] {
  const shape = LEAD_PHRASES[plan.phrases[phrase % plan.phrases.length]!]!;
  const half = at.i % 2;
  const steps = shape.filter(([b]) => b === half).map(([, s, , a]) => [s, 0, a, a === DIDGE_DRONE ? 0.7 : 0.82 + plan.r() * 0.12] as [number, number, number, number]);
  return tile(steps, at, 'didge', DIDGE_LEAD);
}

// ── the birds ────────────────────────────────────────────────────────────────

/** A bar, for placing the birds: its section, where it falls, and the notes it already holds. */
export interface BirdBar {
  section: LofiSection; i: number; bars: number;
  /** The section that comes next, and whether this is the bar the tune's last sound starts on (two bars into the outro). */
  next: LofiSection | undefined; closing: boolean;
  /** Whether the didgeridoo has just finished its solo (the first bar after the last trade). */
  afterSolo: boolean;
  /** Whether this bar ends the tune's first chorus. */
  firstDropEnd: boolean;
  /** The magpie's and the kookaburra's pitch for the tune. */
  magpie: number; kookaburra: number;
  sb: (step: number) => number;
}

/** Whether a stretch of the bar (beats) is clear of the lead, the banjo's or the didgeridoo's. */
function clear(notes: readonly LofiNote[], from: number, to: number): boolean {
  return !notes.some(n => (n.voice === 'lead' || (n.voice === 'didge' && Math.floor((n.mod ?? 0) / DIDGE_ROLE) === DIDGE_LEAD)) && n.beat < to && n.beat + n.dur > from);
}

/**
 * The birds of a bar, into `notes`: a featured moment where the plan puts one (the lead
 * notes under it taken out, as a producer clears room for a sampled hook), and otherwise now
 * and then a quieter magpie between phrases, only where the lead has rested.
 */
export function strayaBirds(plan: StrayaPlan, at: BirdBar, notes: LofiNote[]): void {
  const r = plan.r;
  const song = (): number => Math.floor(r() * LOFI_BIRD_FEATURE);
  // A featured bird from the bar before may still be singing: the lead waits for the bird.
  if (plan.clearing > 0) {
    for (let n = notes.length - 1; n >= 0; n--) if (notes[n]!.voice === 'lead' && notes[n]!.beat < plan.clearing) notes.splice(n, 1);
    plan.clearing = Math.max(0, plan.clearing - 4);
  }
  for (const m of plan.birds) {
    const key = `${m.bird}:${m.at}`;
    if (plan.sung.has(key)) continue;
    let beat = -1, dur = 0;
    // Each moment's length in beats: a magpie's carol a few seconds, a kookaburra's laugh about six to eight.
    if (m.at === 'open' && at.section === 'intro' && at.i === 0) { beat = 0; dur = 7; }
    else if (m.at === 'intoDrop' && at.section === 'build' && at.next === 'drop' && at.i === at.bars - 2) { beat = 2; dur = 6; }
    else if (m.at === 'afterSolo' && at.afterSolo) { beat = 0.5; dur = 12; }
    else if (m.at === 'turn' && at.firstDropEnd) { beat = 2; dur = 11; }
    else if (m.at === 'last' && at.closing) { beat = 1; dur = 16; }
    if (beat < 0) continue;
    plan.sung.add(key);
    const flock = m.bird === 'magpie' ? (r() < 0.6 ? 1 + Math.floor(r() * 2) : 0) : r() < 0.4 ? 1 : 0;
    const mod = song() + LOFI_BIRD_FEATURE + flock * LOFI_BIRD_FLOCK;
    // The band clears the lead from under the hook, in this bar.
    for (let n = notes.length - 1; n >= 0; n--) if (notes[n]!.voice === 'lead' && notes[n]!.beat >= beat - 0.25) notes.splice(n, 1);
    plan.clearing = Math.max(plan.clearing, beat + dur - 4);
    notes.push({ voice: m.bird, midi: m.bird === 'magpie' ? at.magpie : at.kookaburra, beat, dur, vel: m.bird === 'magpie' ? 0.82 : 0.86, mod });
  }
  // Between phrases: a quiet magpie in a calm section's phrase end, where the lead rests.
  const calm = at.section === 'intro' || at.section === 'verse' || at.section === 'outro' || at.section === 'break';
  if (calm && at.i % 4 === 3 && !notes.some(n => n.voice === 'magpie' || n.voice === 'kookaburra') && r() < 0.5) {
    const beat = at.sb(r() < 0.5 ? 8 : 10);
    const dur = 1.5 + r() * 1.5;
    if (clear(notes, beat, Math.min(4, beat + dur))) notes.push({ voice: 'magpie', midi: at.magpie, beat, dur, vel: 0.4, mod: song() });
  }
}

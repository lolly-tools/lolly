// SPDX-License-Identifier: MPL-2.0
/**
 * Trailer: the music a film trailer or an event's opening film is cut to. Big hits a few bars
 * apart, an ostinato under them, a rise, the full drums, a stop, and one last hit left to ring.
 * Written by its own composer (composeTrailer), as a cue is: the hits come first and the rest
 * is laid between them.
 *
 * - The tempo is 150 to 170 with the drums in half time, so the pulse a listener feels is 75
 *   to 85 and the ostinato's eighths run like sixteenths over that pulse.
 * - The running order (arrangeTrailer): an open of four bars (a drone, the pulse coming in, a
 *   riser); three or four hits, each a different number of bars after the last (one to four),
 *   as an editor places them against the cuts; a rise; the drop (the back end: toms, a
 *   half-time snare, a braam on each chord); a stop, where a sub drop falls away under a held
 *   chord; the theme alone over the pulse; a second rise and a longer drop with the theme on
 *   top, a second instrument taking the theme for its last eight bars; and the button, one hit
 *   and its ring.
 * - A hit is three notes at once: an `impact` (a sub boom with a crack and a tail of debris),
 *   a `braam` (the low brass blast) on the chord's root, and the drums' own stroke. The stop
 *   opens on a `subdrop`. lib/lofi-trailer.ts plays the three.
 * - Every fourth bar of the tune lifts into the next: a roll on the toms and a short riser.
 *   A track shorter than the tune is cut at a fourth bar and finished with the button
 *   (lofi-compose.ts fitTrack), so wherever the cut falls, the button is risen into.
 * - The harmony is natural minor, a chord every two bars in a drop: i VI III VII and its
 *   relatives. The keys stay low: the hits are tuned to the key, so the key is drawn from
 *   the roots a subwoofer plays cleanly.
 *
 * Every draw comes from a stream of the tune's own, so no other genre's tune moves.
 */
import type { LofiBar, LofiLayer, LofiNote, LofiSection, LofiStyle, LofiTuneInfo } from './lofi-compose.ts';
import { mulberry32 } from './zzfx-compose.ts';

/** An `impact` note's `mod`: the full hit, a shorter metallic slam, or the sub boom alone. */
export const TRAILER_IMPACTS = ['hit', 'slam', 'deep'] as const;
/** A `braam` note's `mod`: the root and its octave, the same with the fifth, or one that bends up a tone as it sounds. */
export const TRAILER_BRAAMS = ['low', 'fifth', 'rise'] as const;

/** What the composer hands over: how it draws a style, the taiko's percussion `mod` and the tempo's range. */
export interface TrailerDeps {
  drawStyle: (rng: () => number) => LofiStyle;
  taiko: number;
  bpm: readonly [number, number];
}

/** A trailer editor's names for the sections: the hits, the rise, the back end, the stop and the button. */
export function trailerSectionName(section: LofiSection): string {
  switch (section) {
    case 'intro': return 'open';
    case 'verse': return 'hits';
    case 'build': return 'rise';
    case 'drop': return 'back end';
    case 'break': return 'stop';
    case 'bridge': return 'theme';
    case 'outro': return 'button';
    default: return section;
  }
}

// ── harmony ───────────────────────────────────────────────────────────────

const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
type Step = readonly [number, 'min' | 'maj'];
interface Chord { root: number; minor: boolean; name: string; tones: number[] }
const chordOf = (key: number, [deg, q]: Step): Chord => {
  const root = (key + deg) % 12;
  return { root, minor: q === 'min', name: NAMES[root]! + (q === 'min' ? 'm' : ''), tones: [root, (root + (q === 'min' ? 3 : 4)) % 12, (root + 7) % 12] };
};
const i: Step = [0, 'min'], III: Step = [3, 'maj'], iv: Step = [5, 'min'], V: Step = [7, 'maj'], VI: Step = [8, 'maj'], VII: Step = [10, 'maj'];
/** A drop's four chords, two bars each. */
const DROPS: readonly (readonly Step[])[] = [[i, VI, III, VII], [i, VI, iv, V], [i, III, VII, iv], [VI, VII, i, i], [i, VII, VI, VII], [i, iv, VI, V]];
/** The chords the hits land on, in order: home first, the last one unresolved so the rise has somewhere to go. */
const HITS: readonly (readonly Step[])[] = [[i, VI, iv, V], [i, VI, VII, V], [i, iv, VI, VII], [i, III, VI, V]];
/** The keys, weighted: roots whose low octave a subwoofer plays cleanly (D, E, C, F most). */
const KEYS: ReadonlyArray<readonly [number, number]> = [[2, 4], [4, 3], [0, 2], [5, 2], [3, 1], [7, 1], [9, 1], [1, 1]];

// ── the running order ─────────────────────────────────────────────────────────

type Kind = 'open' | 'hit' | 'rise' | 'drop' | 'stop' | 'theme' | 'button';
/** One part of the cue. `hit` counts the hits (0 the first); `alt` is the second rise and drop. */
export interface TrailerPart { section: LofiSection; kind: Kind; bars: number; hit?: number; alt?: boolean }
/** How many bars a hit waits for the next, weighted: two and three most, as an editor's cuts fall. */
const GAPS: ReadonlyArray<readonly [number, number]> = [[1, 2], [2, 4], [3, 3], [4, 1]];
const OPEN_BARS = 4;

function weighted<T>(rng: () => number, w: ReadonlyArray<readonly [T, number]>): T {
  let x = rng() * w.reduce((s, [, n]) => s + n, 0);
  for (const [v, n] of w) { x -= n; if (x < 0) return v; }
  return w[w.length - 1]![0];
}

/**
 * A cue's running order: the open, three or four hits at uneven gaps, a rise of two to four
 * bars, the drop, the stop, the theme, a second rise, the long drop and the button.
 */
export function arrangeTrailer(rng: () => number): TrailerPart[] {
  const parts: TrailerPart[] = [{ section: 'intro', kind: 'open', bars: OPEN_BARS }];
  const hits = rng() < 0.5 ? 4 : 3;
  for (let h = 0; h < hits; h++) parts.push({ section: 'verse', kind: 'hit', bars: weighted(rng, GAPS), hit: h });
  parts.push({ section: 'build', kind: 'rise', bars: weighted(rng, [[2, 4], [3, 3], [4, 3]]) });
  parts.push({ section: 'drop', kind: 'drop', bars: 8 });
  parts.push({ section: 'break', kind: 'stop', bars: 4 });
  parts.push({ section: 'bridge', kind: 'theme', bars: 8 });
  parts.push({ section: 'build', kind: 'rise', bars: 4, alt: true });
  parts.push({ section: 'drop', kind: 'drop', bars: 16, alt: true });
  parts.push({ section: 'outro', kind: 'button', bars: 4 });
  return parts;
}

// ── the figures ───────────────────────────────────────────────────────────────

/** The chord's third, in an ostinato. */
const T = 99;
/** The ostinato: a bar of eighths, semitones above the chord's root. */
const OSTINATI: ReadonlyArray<readonly number[]> = [
  [0, 0, 7, 0, 12, 0, 7, 0],
  [0, 7, 12, 7, 0, 7, 12, 7],
  [0, 0, 0, 7, 0, 0, 12, 7],
  [0, 12, 7, 12, 0, 12, T, 12],
  [0, 0, 12, 0, 0, 12, 0, 7],
];
/** Which eighths an ostinato leans on: the bar's two beats in half time, or three and three and two. */
const ACCENTS: ReadonlyArray<readonly number[]> = [[0, 4], [0, 3, 6], [0, 4, 6]];
/** The drop's toms, a bar of sixteenths: [step, drum (0 the lowest), velocity]. */
type Toms = ReadonlyArray<readonly [number, number, number]>;
const TOMS: readonly Toms[] = [
  [[0, 0, 0.9], [3, 0, 0.55], [6, 1, 0.75], [10, 0, 0.6], [12, 1, 0.8], [14, 2, 0.6]],
  [[0, 0, 0.9], [4, 1, 0.6], [6, 0, 0.7], [10, 1, 0.6], [12, 0, 0.8], [13, 1, 0.5], [14, 2, 0.65]],
  [[0, 0, 0.9], [2, 0, 0.45], [6, 1, 0.75], [11, 1, 0.55], [12, 2, 0.8], [14, 0, 0.6]],
  [[0, 0, 0.9], [3, 1, 0.6], [6, 0, 0.75], [9, 1, 0.5], [12, 0, 0.8], [15, 2, 0.5]],
];
/** The drop's kick, a bar of sixteenths (the snare has the third beat). */
const KICKS: ReadonlyArray<readonly number[]> = [[0, 6], [0, 10], [0, 6, 12], [0, 3, 10]];
/** The toms' pitches, low to high. */
const TOM_PITCH = [41, 45, 50] as const;
/** The instruments a second lead is drawn from. */
const SECONDS: ReadonlyArray<LofiStyle['lead']> = ['angel', 'tenorhorn', 'cello', 'flugelhorn', 'trumpet'];

const clamp = (v: number): number => Math.max(0.05, Math.min(1, v));
/** `pc` as a pitch in `lo` to `hi`, the nearest to `near` when two octaves fit. */
function place(pc: number, lo: number, hi: number, near?: number): number {
  let best = lo + ((((pc - lo) % 12) + 12) % 12);
  if (near !== undefined) for (let m = best; m <= hi; m += 12) if (Math.abs(m - near) < Math.abs(best - near)) best = m;
  return best;
}

// ── composing ──────────────────────────────────────────────────────────────

export function composeTrailer(seed: number, fixed: Partial<LofiStyle>, deps: TrailerDeps): LofiBar[] {
  const rng = mulberry32((seed ^ 0x7a11e4) >>> 0);
  const pick = <X>(xs: readonly X[]): X => xs[Math.floor(rng() * xs.length)]!;
  const parts = arrangeTrailer(rng);
  const bpm = Math.round(deps.bpm[0] + rng() * (deps.bpm[1] - deps.bpm[0]));
  const home = weighted(rng, KEYS);
  const style: LofiStyle = { ...deps.drawStyle(rng), ...fixed };
  const hitChords = pick(HITS).map(s => chordOf(home, s));
  const dropChords = pick(DROPS).map(s => chordOf(home, s));
  const tonic = chordOf(home, i);
  const ostinato = pick(OSTINATI), accents = pick(ACCENTS);
  const toms: readonly [Toms, Toms] = [pick(TOMS), pick(TOMS)];
  const kicks = pick(KICKS);
  // The pad under the keys, and the open's and the stop's soft keys, unless a person chose the keys.
  const pad: LofiStyle['keys'] = rng() < 0.6 ? 'strings' : 'choir';
  const soft: LofiStyle['keys'] | undefined = fixed.keys ? undefined : pad === 'strings' ? 'pad' : 'strings';
  const braamKind = rng() < 0.55 ? 0 : 1;
  // The instrument that takes the theme for the long drop's last eight bars, unless a person chose the lead.
  const second: LofiStyle['lead'] | undefined = fixed.lead ? undefined : pick(SECONDS.filter(l => l !== style.lead));
  const total = parts.reduce((s, p) => s + p.bars, 0) + 1;
  const info: LofiTuneInfo = {
    seed: seed >>> 0, mood: 'trailer', bpm, swing: 0.5, swing8: 0.5, style,
    key: `${NAMES[home]} minor`,
    progressions: [hitChords.map(c => c.name), dropChords.map(c => c.name)],
    bars: total,
  };

  // The theme: eight bars over the drop's chords, a long note on each chord and a step into the next.
  const scale = MINOR.map(s => (home + s) % 12);
  const theme: Array<{ bar: number; beat: number; dur: number; midi: number }> = [];
  {
    let at = place(dropChords[0]!.tones[2]!, 64, 75);
    dropChords.forEach((c, n) => {
      const near = c.tones.map(pc => place(pc, 64, 79, at)).filter(m => n === 0 || m !== at);
      at = near.reduce((b, m) => (Math.abs(m - at) < Math.abs(b - at) ? m : b), near[0]!);
      theme.push({ bar: n * 2, beat: 0, dur: 6.9, midi: at });
      // A step toward the next chord's tone, from the scale, on the second bar's last beat.
      const next = dropChords[(n + 1) % dropChords.length]!;
      const goal = place(next.tones[rng() < 0.5 ? 1 : 2]!, 64, 79, at);
      const dir = goal >= at ? 1 : -1;
      let pass = at + dir;
      while (!scale.includes(((pass % 12) + 12) % 12)) pass += dir;
      theme.push({ bar: n * 2 + 1, beat: 3, dur: 0.9, midi: Math.max(64, Math.min(84, pass)) });
    });
  }

  const bars: LofiBar[] = [];
  let index = 0;
  for (const [pi, part] of parts.entries()) {
    const next = parts[pi + 1];
    for (let b = 0; b < part.bars; b++, index++) {
      const notes: LofiNote[] = [];
      const hit = (voice: LofiNote['voice'], step: number, vel: number, midi = 0, dur = 0, mod?: number): void => {
        notes.push({ voice, beat: step / 4, dur, midi, vel: clamp(vel), ...(mod === undefined ? {} : { mod }) });
      };
      const progress = part.bars > 1 ? b / (part.bars - 1) : 1;
      const lastBar = b === part.bars - 1;
      // The chord: the hits' own, the rise holding the last hit's, the drops' two bars each, the rest at home.
      const chord = part.kind === 'hit' ? hitChords[Math.min(part.hit!, hitChords.length - 1)]!
        : part.kind === 'rise' && !part.alt ? hitChords[hitChords.length - 1]!
        : part.kind === 'rise' ? chordOf(home, V)
        : part.kind === 'drop' || part.kind === 'theme' ? dropChords[Math.floor(b / 2) % dropChords.length]!
        : tonic;
      const low = place(chord.root, 28, 39);
      const third = chord.minor ? 3 : 4;
      const voicing = [place(chord.tones[0]!, 48, 59), place(chord.tones[2]!, 53, 64), place(chord.tones[0]!, 60, 71), place(chord.tones[1]!, 62, 73), place(chord.tones[2]!, 65, 76)];
      const layers = new Set<LofiLayer>();
      const voices: NonNullable<LofiBar['voices']> = { pad };
      let open = 1, level = 1;

      /** The chord tone next above `midi`. */
      const above = (midi: number): number => { let m = midi + 1; while (!chord.tones.includes(m % 12)) m++; return m; };
      /** The ostinato's bar: eighths on the chord, growing from `from` to `to`; `up` lifts its roots an octave, `thick` adds the chord tone above each note. */
      const pulse = (from: number, to: number, up = false, until = 16, thick = false): void => {
        layers.add('keys');
        ostinato.forEach((semis, e) => {
          if (e * 2 >= until) return;
          const vel = from + (to - from) * (e / 7) + (accents.includes(e) ? 0.14 : 0);
          const midi = place(chord.root, 52, 63) + (semis === T ? third : semis === 0 && up ? 12 : semis);
          hit('keys', e * 2, vel, midi, 0.36);
          if (thick && above(midi) <= 76) hit('keys', e * 2, vel * 0.8, above(midi), 0.36);
        });
      };
      /** The cymbals of the back end: hats in sixteenths, leaning on the beat, and an open hat off the second and fourth beats. */
      const hats = (vel: number): void => {
        layers.add('hats');
        for (let st = 0; st < 16; st++) if (st !== 6 && st !== 14) hit('hat', st, vel * (st % 4 === 0 ? 1 : st % 2 === 0 ? 0.8 : 0.55));
        for (const st of [6, 14]) hit('openHat', st, vel * 0.85);
      };
      /** The chord held under everything, on the pad. */
      const hold = (vel: number, beats = 4): void => { layers.add('keys'); for (const m of voicing) hit('pad', 0, vel, m, beats - 0.05); };
      /** The bass: the root held, or pulsing in eighths. */
      const sub = (vel: number, beats = 4): void => { layers.add('bass'); hit('bass', 0, vel, low, beats - 0.05); };
      const drive = (from: number, to: number, until = 16): void => {
        layers.add('bass');
        for (let st = 0; st < until; st += 2) hit('bass', st, from + (to - from) * (st / 14) + (st % 8 === 0 ? 0.1 : 0), low, 0.42);
      };
      /** A hit: the impact, the braam on the root and the drums' stroke. */
      const strike = (vel: number, braamBeats: number, kind = 0): void => {
        layers.add('fx').add('kick');
        hit('impact', 0, vel, place(chord.root, 24, 35), 8, kind);
        hit('braam', 0, vel * 0.9, place(chord.root, 33, 44), braamBeats, braamKind);
        hit('kick', 0, vel);
        hit('perc', 0, vel * 0.9, 1, 0, deps.taiko);
        hit('crash', 0, vel * 0.95);
      };
      /** The lift into the next bar: the toms rolling up through the bar's second half, and a riser. */
      const lift = (vel: number): void => {
        layers.add('snare').add('fx');
        for (let st = 8; st < 16; st++) hit('tom', st, vel * (0.4 + 0.5 * ((st - 8) / 7)), TOM_PITCH[Math.min(2, Math.floor((st - 8) / 3))]!);
        hit('riser', 0, vel * 0.75, 60, 3.9);
      };
      /** The theme's notes that start in bar `n` of its eight. */
      const sing = (n: number, vel: number): void => {
        layers.add('lead');
        for (const tn of theme) if (tn.bar === n % 8) notes.push({ voice: 'lead', beat: tn.beat, dur: tn.dur, midi: tn.midi, vel: clamp(vel) });
      };
      // Every fourth bar of the tune lifts into the next, in the sections the drums play.
      const fourth = index % 4 === 3;

      switch (part.kind) {
        case 'open': {
          // A drone and a soft boom; the pulse from the third bar; a riser through the last.
          if (soft) voices.keys = soft;
          open = 0.45 + 0.4 * progress;
          hold(0.55 + 0.15 * progress);
          sub(0.32);
          if (b === 0) { layers.add('fx'); hit('impact', 0, 0.55, place(chord.root, 24, 35), 8, 2); }
          if (b >= 2) pulse(0.4 + 0.12 * (b - 2), 0.5 + 0.14 * (b - 2));
          if (lastBar) { layers.add('fx'); hit('riser', 0, 0.7, 60, 3.9); }
          break;
        }
        case 'hit': {
          // Each hit is struck harder than the last, with more under the hit: the pulse, then the toms.
          const h = part.hit!;
          if (b === 0) strike(0.82 + 0.06 * h, Math.min(part.bars * 4, 6));
          hold(0.7);
          sub(0.4);
          pulse(0.66 + 0.05 * h, 0.72 + 0.05 * h, false, 16, h >= 2);
          if (h >= 1 && b > 0) { layers.add('snare'); for (const st of h >= 2 ? [0, 6, 12] : [0, 8]) hit('tom', st, 0.5, TOM_PITCH[0]); }
          // A gap of two bars or more rolls into the next hit.
          if (lastBar && part.bars > 1 && next?.kind === 'hit') lift(0.7);
          break;
        }
        case 'rise': {
          // The riser the whole way; the pulse climbing an octave; the snare rolling from eighths to sixteenths, tuned up as it goes; then a breath.
          layers.add('snare').add('fx');
          const until = lastBar ? 14 : 16;
          if (b === 0) hit('riser', 0, part.alt ? 0.95 : 0.85, 60, part.bars * 4 - 0.5);
          hold(0.6 + 0.25 * progress);
          drive(0.36 + 0.1 * progress, 0.42 + 0.14 * progress, until);
          pulse(0.7 + 0.1 * progress, 0.8 + 0.12 * progress, progress >= 0.5, until, true);
          const every = lastBar ? 1 : 2;
          for (let st = 0; st < until; st += every) {
            const along = (b + st / 16) / part.bars;
            hit('snare', st, 0.3 + 0.55 * along, 0, 0, Math.round(along * 7));
          }
          for (let st = 0; st < until; st += 4) hit('tom', st, 0.5 + 0.3 * progress, TOM_PITCH[0]);
          break;
        }
        case 'drop': {
          // The back end: the hit on the first bar, a braam on each chord, the toms, a half-time snare, the bass in eighths.
          const big = !!part.alt && b >= 8;
          layers.add('kick').add('snare').add('fx');
          if (b === 0) strike(1, 6);
          else if (b % 2 === 0) { hit('braam', 0, 0.7, place(chord.root, 33, 44), 5, braamKind); hit('crash', 0, 0.5); }
          hold(0.85);
          drive(0.5, 0.5);
          pulse(0.86, 0.86, big, 16, true);
          if (big && second) voices.lead = second;
          hats(big ? 0.95 : 0.85);
          for (const st of kicks) if (b > 0 || st > 0) hit('kick', st, st === 0 ? 0.92 : 0.7);
          hit('snare', 8, 0.95);
          if (fourth) { for (const [st, d, v] of toms[b % 2]!) if (st < 8) hit('tom', st, v, TOM_PITCH[d]!); lift(0.8); }
          else for (const [st, d, v] of toms[b % 2]!) hit('tom', st, v, TOM_PITCH[d]!);
          sing(b, big ? 0.9 : part.alt ? 0.8 : 0.7);
          break;
        }
        case 'stop': {
          // Everything falls away: a sub drop under the held chord, then the pulse creeping back.
          if (soft) voices.keys = soft;
          open = 0.7;
          if (b === 0) {
            layers.add('fx');
            hit('subdrop', 0, 0.9, place(chord.root, 36, 47), 10);
            hit('impact', 0, 0.6, place(chord.root, 24, 35), 8, 2);
          }
          hold(0.6, 4);
          if (b >= 2) pulse(0.36 + 0.08 * (b - 2), 0.44 + 0.1 * (b - 2));
          if (lastBar) { layers.add('fx'); hit('riser', 0, 0.5, 60, 3.9); }
          break;
        }
        case 'theme': {
          // The theme alone over the pulse and the held bass, a slam every four bars.
          if (b % 4 === 0) { layers.add('fx'); hit('impact', 0, 0.7, place(chord.root, 24, 35), 6, 1); }
          hold(0.7);
          sub(0.4);
          pulse(0.6, 0.68);
          sing(b, 0.7);
          if (b >= 4) { layers.add('snare'); for (const st of [0, 6, 12]) hit('tom', st, 0.45 + 0.05 * (b - 4), TOM_PITCH[0]); }
          if (fourth) lift(0.6);
          break;
        }
        case 'button': {
          // One last hit, everything at once, and its ring.
          level = [1, 0.85, 0.6, 0.35][b] ?? 0.35;
          open = 1 - 0.15 * b;
          if (b === 0) {
            strike(1, 10);
            hit('subdrop', 0, 0.8, place(chord.root, 36, 47), 8);
            hold(0.85, 16);
            sub(0.5, 8);
          }
          break;
        }
      }
      notes.sort((x, y) => x.beat - y.beat);
      bars.push({ tune: info, index, section: part.section, layers: [...layers], chord: chord.name, tones: chord.tones, notes, open, level, voices });
    }
  }
  bars.push({ tune: info, index, section: 'rest', layers: [], chord: '', tones: [], notes: [], open: 0.3, level: 0 });
  return bars;
}

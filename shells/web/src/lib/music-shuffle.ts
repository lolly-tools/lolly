// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's shuffle (#/music): a new style, a new seed and a sound to suit
 * them, all at once. Every draw comes from the random source passed in, so a test can
 * replay a shuffle exactly.
 *
 * A shuffle should always sound good, so it stays where the style itself would go. An
 * instrument it picks is one the style chooses for some other seed. Each part is left to
 * the composer about half the time. Now and then one or two kinds of section get an
 * instrument of their own. The mix moves a little either side of the designed level, and
 * brightness and drive stay near the style's own. The tempo stays the tune's own and the
 * length stays the person's, so neither is drawn here.
 *
 * A person's instrument preferences (lib/music-prefs.ts) steer the draw: an instrument
 * they blocked is never drawn, and a favourite the style plays is drawn more often, and
 * makes the shuffle choose that part's instrument more often too. A part whose tune
 * would open on a blocked instrument always gets one drawn. With no preferences, the
 * draws are exactly as they were.
 */
import { lofiStream, LOFI_KEYS, LOFI_LEADS, LOFI_BASSES, type LofiBar, type LofiMood, type LofiStyle } from '../../../../engine/src/lofi-compose.ts';
import { LOFI_MIX, type LofiMix } from './lofi-station.ts';
import { LOFI_STATION_MOODS } from './neurospicy-lofi.ts';
import { isBlocked, isFavourite, styleInstruments, type MusicPrefs } from './music-prefs.ts';

const PARTS = ['keys', 'lead', 'bass'] as const;
type Part = typeof PARTS[number];
/** Instruments chosen for one kind of section, as the generator's link carries them. */
type Voices = Partial<Pick<LofiStyle, Part>>;
/** Each part's instruments, as often as the style chooses them. */
type Pool = { [P in Part]: LofiStyle[P][] };

/** Everything a shuffle sets. The rest of the generator's state stays as it was. */
export interface MusicShuffle extends Voices {
  mood: LofiMood;
  seed: number;
  sections: Partial<Record<string, Voices>>;
  drums: boolean;
  texture: number;
  bright?: number;
  drive?: number;
  mix: LofiMix;
}

/**
 * The ranges a shuffle keeps to, well inside the sliders' own. Brightness and drive
 * are a multiple of the style's own value, then held inside the window.
 */
export const SHUFFLE_RANGES = {
  /** The lead, keys, bass and drums levels. */
  part: [0.85, 1.15],
  fx: [0.8, 1.2],
  reverb: [0.8, 1.25],
  texture: [0.15, 0.5],
  bright: [0.7, 1.5],
  brightNudge: [0.9, 1.15],
  drive: [1, 3.6],
  driveNudge: [0.85, 1.2],
} as const;

/** How often a part gets its own instrument, a section gets a change and the tone is nudged. */
const PICK_CHANCE = 0.45;
/** How often a part gets its own instrument when the style plays one of the person's favourites. */
const FAVOURITE_PICK_CHANCE = 0.75;
/** How many more times a favourite goes in the pool than the style's draws put it there. */
const FAVOURITE_WEIGHT = 3;
const SECTION_CHANCE = 0.35;
const SECOND_SECTION_CHANCE = 0.3;
const TONE_CHANCE = 0.5;
/** Other seeds of the style whose instruments make up what a shuffle may choose. */
const POOL_SEEDS = 6;

const choose = <T>(rand: () => number, list: readonly T[]): T | undefined => list[Math.floor(rand() * list.length)];
/** Seeds of up to six digits: short enough to read, type and fit the seed box on a phone. */
const SEEDS = 1_000_000;
const seedFrom = (rand: () => number): number => Math.floor(rand() * SEEDS);
/** A value on the sliders' grid: `per` steps to one. */
const snap = (v: number, per: number): number => Math.round(v * per) / per;
const within = (rand: () => number, [lo, hi]: readonly [number, number], per: number): number => snap(lo + rand() * (hi - lo), per);
const clamp = (v: number, [lo, hi]: readonly [number, number]): number => Math.min(hi, Math.max(lo, v));

/**
 * The instruments the style plays on a few other seeds: what a pick may be, weighted as
 * the style weights them. Blocked instruments are taken out, and each favourite the
 * style plays is put in a few more times.
 */
function stylePool(rand: () => number, mood: LofiMood, prefs?: MusicPrefs): Pool {
  const pool: Pool = { keys: [], lead: [], bass: [] };
  const add = <P extends Part>(part: P, v: LofiStyle[P]): void => { if (v !== 'none' && !(prefs && isBlocked(prefs, part, v))) pool[part].push(v); };
  for (let i = 0; i < POOL_SEEDS; i++) {
    const style = lofiStream(seedFrom(rand), { mood }).next().tune.style;
    for (const part of PARTS) add(part, style[part]);
  }
  if (prefs?.favourites.size) {
    for (const part of PARTS) {
      for (const id of styleInstruments(mood, part)) {
        if (!isFavourite(prefs, part, id)) continue;
        const v = pool[part].find(x => x === id) ?? ALL[part].find(x => x === id);
        for (let n = 0; v && n < FAVOURITE_WEIGHT; n++) add(part, v);
      }
    }
  }
  return pool;
}
/** Every instrument of each part, to turn a favourite's name back into the part's own type. */
const ALL: { [P in Part]: readonly LofiStyle[P][] } = { keys: LOFI_KEYS, lead: LOFI_LEADS, bass: LOFI_BASSES };

const voicesFor = <P extends Part>(part: P, v: LofiStyle[P]): Voices => {
  const out: Voices = {};
  out[part] = v;
  return out;
};

/** Now and then, an instrument of its own for one or two kinds of section where that part plays. */
function sectionChanges(rand: () => number, track: readonly LofiBar[], pool: Pool): Partial<Record<string, Voices>> {
  const sections: Partial<Record<string, Voices>> = {};
  if (rand() >= SECTION_CHANCE) return sections;
  const count = rand() < SECOND_SECTION_CHANCE ? 2 : 1;
  for (let n = 0; n < count; n++) {
    const options: Array<{ section: string; part: Part; choices: readonly LofiStyle[Part][] }> = [];
    for (const section of new Set(track.map(b => b.section))) {
      if (section === 'rest' || sections[section]) continue;
      const here = track.filter(b => b.section === section);
      for (const part of PARTS) {
        if (!here.some(b => b.notes.some(note => note.voice === part))) continue;
        const playing = new Set<string>(here.map(b => b.voices?.[part] ?? b.tune.style[part]));
        const choices = pool[part].filter(v => !playing.has(v));
        if (choices.length) options.push({ section, part, choices });
      }
    }
    const option = choose(rand, options);
    const v = option && choose(rand, option.choices);
    if (!option || !v) break;
    sections[option.section] = voicesFor(option.part, v);
  }
  return sections;
}

/**
 * A shuffled track: any style but `after` (the one playing now), a new seed, and
 * instruments, a mix and a tone to suit them. `bars` is the track's length, which says
 * which kinds of section it reaches. With `keep`, the style and seed stay as given and
 * only the sound is drawn (the generator's Shift-shuffle). `prefs` are the person's
 * favourite and blocked instruments.
 */
export function shuffleMusic(rand: () => number, opts: { bars?: number; after?: LofiMood; keep?: { mood: LofiMood; seed: number }; prefs?: MusicPrefs } = {}): MusicShuffle {
  const moods = LOFI_STATION_MOODS.filter(m => m !== opts.after);
  const mood = opts.keep?.mood ?? choose(rand, moods) ?? LOFI_STATION_MOODS[0]!;
  const seed = opts.keep ? opts.keep.seed >>> 0 : seedFrom(rand);
  const own = lofiStream(seed, { mood }).next().tune.style;
  const prefs = opts.prefs;
  const pool = stylePool(rand, mood, prefs);
  const picks: Voices = {};
  for (const part of PARTS) {
    const favoured = !!prefs && pool[part].some(x => isFavourite(prefs, part, x));
    const mustPick = !!prefs && own[part] !== 'none' && isBlocked(prefs, part, own[part]);
    if (rand() >= (favoured ? FAVOURITE_PICK_CHANCE : PICK_CHANCE) && !mustPick) continue;
    const v = choose(rand, pool[part].filter(x => x !== own[part]));
    if (v) Object.assign(picks, voicesFor(part, v));
  }
  const stream = lofiStream(seed, { mood, style: picks });
  const track = Array.from({ length: opts.bars ?? 64 }, () => stream.next());
  const R = SHUFFLE_RANGES;
  return {
    // A part left to the composer is set to nothing, so an earlier pick does not stay.
    mood, seed, keys: picks.keys, lead: picks.lead, bass: picks.bass,
    sections: sectionChanges(rand, track, pool),
    drums: true,
    texture: within(rand, R.texture, 20),
    bright: rand() < TONE_CHANCE ? snap(clamp((own.bright ?? 1) * within(rand, R.brightNudge, 100), R.bright), 20) : undefined,
    drive: rand() < TONE_CHANCE ? snap(clamp((own.drive ?? 1) * within(rand, R.driveNudge, 100), R.drive), 10) : undefined,
    mix: {
      ...LOFI_MIX,
      lead: within(rand, R.part, 20), keys: within(rand, R.part, 20), bass: within(rand, R.part, 20), drums: within(rand, R.part, 20),
      fx: within(rand, R.fx, 20), reverb: within(rand, R.reverb, 20),
    },
  };
}

// SPDX-License-Identifier: MPL-2.0
/**
 * What the coast's birds' notes mean: the eastern whipbird and the rainbow lorikeet, sung by
 * Noosacore (lofi-noosa.ts), by any style with the Aussie birds turned on, and by any composer
 * that wants them (a `whipbird` or `lorikeet` note with a `mod` from here). The notes say what
 * the bird does; the shell's models (shells/web/src/lib/lofi-coast-birds.ts) make the sound.
 * Pure: no Web Audio, no randomness.
 *
 * A `whipbird` note is one pair calling: the male's long whistle cracking into the whip and,
 * unless the note says he calls alone, the female's quick answer, a duet so tight it sounds
 * like one bird. Its `midi` is the whistle's pitch (whipbirds whistle between about 1.5 and
 * 4.4 kHz, most near 2 kHz); `mod & 1` is 1 when the female answers, `(mod >> 1) & 3` how far
 * off the pair is (WHIPBIRD_DISTANCES), and `mod >> 3` a take.
 *
 * A `lorikeet` note is rainbow lorikeets: `mod & 3` what they do (LORIKEET_KINDS), `(mod >> 2) & 7`
 * how many birds less one, and `mod >> 5` a take. Its `midi` is the flock's middle pitch (their
 * calls sit round 1.6 to 2.6 kHz) and its length how long they keep calling.
 */

/** How far off a whipbird pair is: just inside the forest's edge, in the trees, deep in the gully. */
export const WHIPBIRD_DISTANCES = ['edge', 'trees', 'gully'] as const;
/** What a `lorikeet` note plays: one or two birds screeching, a feeding flock's tumbling chatter in a tree, or a flock flying over screeching. */
export const LORIKEET_KINDS = ['screech', 'chatter', 'flypast'] as const;
export type LorikeetKind = typeof LORIKEET_KINDS[number];
/** The largest take a coast bird note carries, so its `mod` stays a small whole number. */
export const COAST_BIRD_TAKES = 1 << 20;

const take20 = (take: number): number => ((Math.floor(take) % COAST_BIRD_TAKES) + COAST_BIRD_TAKES) % COAST_BIRD_TAKES;

/** A `whipbird` note's `mod`. */
export function whipbirdMod(answered = true, distance = 1, take = 0): number {
  return (answered ? 1 : 0) + 2 * Math.max(0, Math.min(2, Math.floor(distance))) + 8 * take20(take);
}
/** What a `whipbird` note plays. */
export function readWhipbird(mod: number): { answered: boolean; distance: number; take: number } {
  const m = Math.max(0, Math.floor(mod));
  return { answered: (m & 1) === 1, distance: Math.min(2, (m >> 1) & 3), take: Math.floor(m / 8) };
}

/** A `lorikeet` note's `mod`. */
export function lorikeetMod(kind: LorikeetKind, birds = 1, take = 0): number {
  return LORIKEET_KINDS.indexOf(kind) + 4 * (Math.max(1, Math.min(8, Math.floor(birds))) - 1) + 32 * take20(take);
}
/** What a `lorikeet` note plays. */
export function readLorikeet(mod: number): { kind: LorikeetKind; birds: number; take: number } {
  const m = Math.max(0, Math.floor(mod));
  return { kind: LORIKEET_KINDS[m & 3] ?? 'screech', birds: 1 + ((m >> 2) & 7), take: Math.floor(m / 32) };
}

/** About how long a whipbird pair's call lasts (s): the whistle, the crack and the answer. */
export const WHIPBIRD_SECONDS = 3.2;

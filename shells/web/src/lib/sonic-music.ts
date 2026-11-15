// SPDX-License-Identifier: MPL-2.0
/**
 * The procedural music adapter for sound profiles, and the starting sounds the Sound room
 * offers (lib/design-system/rooms/sound.ts).
 *
 * The adapter validates settings before the permissive link reader runs, so a profile
 * never resolves to music it did not ask for.
 *
 * The starting sounds come from the open media study (examples/open-media/corpus.json):
 * its three candidate expressions, each an exact music recipe. Choosing one makes it the
 * sound of every use. A use keeps two things: the seed, for a tune of the use's own,
 * and the balance (the mix levels): Explain keeps the melody out of a voice's way while
 * Play lets the melody lead. Everything else (the genre, the tempo, the
 * instruments, the kit, the tag and the effects left out) comes from the starting sound.
 */

import type { SonicFindingV1, SonicProfileV1, SonicRecipeV1 } from '@lolly-tools/core/sonic-profile-v1';
import type { SonicMusicAdapter } from '../../../../engine/src/sonic-profile.ts';
import { ENGINE_VERSION } from '../../../../engine/src/version.ts';
import type { LofiMood } from '../../../../engine/src/lofi-compose.ts';
import corpus from '../../../../examples/open-media/corpus.json' with { type: 'json' };
import { t, tRaw } from '../i18n.ts';
import { genreTitle } from './genre-icons.ts';
import { LOFI_KIT_NAME } from './lofi-drums.ts';
import { LOFI_BASS_NAME, LOFI_KEYS_NAME, LOFI_LEAD_NAME } from './lofi-names.ts';
import { LOFI_MIX } from './lofi-station.ts';
import {
  FX_FAMILIES,
  MIX_KEYS,
  type MusicState,
  musicStateParams,
  parseMusicState,
  SECTION_NAMES,
} from './music-state.ts';

export const SONIC_MUSIC_ADAPTER = 'lolly.procedural-music.v1';

/** Accept a music settings link without fetching it or retaining private project slots. */
export function sonicMusicFromLink(value: string): string {
  const source = value.trim();
  const at = source.indexOf('#/music?');
  const parameters = at >= 0 ? source.slice(at + 8) : source;
  const query = new URLSearchParams(parameters);
  query.delete('slot');
  query.delete('lock');
  query.delete('sound');
  const findings = checkSonicMusic(query.toString());
  if (findings.length)
    throw new Error('Copy a supported settings link from Music before applying these choices.');
  return musicStateParams(parseMusicState(query.toString()));
}
const TOP = [
  'style',
  'seed',
  'bars',
  'bpm',
  'transpose',
  'keys',
  'lead',
  'bass',
  'drums',
  'texture',
  'bright',
  'drive',
  'kit',
  'tag',
  'quiet',
  'birds',
  'waves',
];
const PARTS = ['keys', 'lead', 'bass', 'snare', 'hats'] as const;
const KNOWN = new Set([
  ...TOP,
  ...MIX_KEYS.map((k) => `mix.${k}`),
  ...SECTION_NAMES.flatMap((s) => PARTS.map((p) => `${s}.${p}`)),
]);

function valuesOf(state: MusicState): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ...state,
    style: state.mood,
    transpose: state.transpose ?? 0,
    birds: state.birds ?? false,
    waves: state.waves ?? false,
  };
  for (const key of MIX_KEYS) result[`mix.${key}`] = state.mix[key];
  for (const section of SECTION_NAMES)
    for (const part of PARTS) result[`${section}.${part}`] = state.sections[section]?.[part];
  return result;
}

export function checkSonicMusic(parameters: string): SonicFindingV1[] {
  const findings: SonicFindingV1[] = [];
  const q = new URLSearchParams(parameters);
  const read = valuesOf(parseMusicState(parameters));
  const error = (key: string) =>
    findings.push({
      code: 'music-setting-unsupported',
      severity: 'error',
      message: `The music generator cannot keep the setting "${key}". Choose a supported value before making music.`,
    });
  for (const key of ['style', 'seed']) if (!q.has(key)) error(key);
  for (const [key, value] of q) {
    if (!KNOWN.has(key) || q.getAll(key).length !== 1) {
      error(key);
      continue;
    }
    if (key === 'quiet') {
      const parts = value ? value.split(',') : [];
      if (
        parts.some((p) => !(FX_FAMILIES as readonly string[]).includes(p)) ||
        new Set(parts).size !== parts.length
      )
        error(key);
      continue;
    }
    const actual = read[key];
    if (typeof actual === 'number') {
      if (!value.trim() || !Number.isFinite(Number(value)) || Number(value) !== actual) error(key);
    } else if (typeof actual === 'boolean') {
      if ((value !== '0' && value !== '1') || (value === '1') !== actual) error(key);
    } else if (actual !== value) error(key);
  }
  return findings;
}

export const sonicMusicAdapter: SonicMusicAdapter = {
  id: SONIC_MUSIC_ADAPTER,
  version: `engine-${ENGINE_VERSION}/web-music-v1`,
  resolve(parameters, seed) {
    const findings = checkSonicMusic(parameters);
    const state = parseMusicState(parameters);
    state.seed = seed;
    return { parameters: musicStateParams(state), findings };
  },
};

/** One starting sound: a candidate expression from the study, with its exact recipe. */
export interface SonicDirection {
  /** The study's id for it (corpus.json modes). */
  id: string;
  mood: LofiMood;
  /** The exact music settings, as a link's parameters. */
  parameters: string;
}

/** The starting sounds, in the study's order. */
export const SONIC_DIRECTIONS: readonly SonicDirection[] = corpus.modes.map((mode) => {
  const parameters = musicStateParams(parseMusicState(mode.music));
  return { id: mode.id, mood: parseMusicState(parameters).mood, parameters };
});

/** A starting sound's name and its line, as the room shows them on its card. */
export function directionCopy(direction: SonicDirection): { name: string; line: string } {
  const copy: Record<string, { name: string; line: string }> = {
    explain: { name: t('Calm'), line: t('Soft electric piano and a round bass, with room for a voice.') },
    demonstrate: { name: t('Steady'), line: t('A gentle pulse with vibes, for showing how something works.') },
    play: { name: t('Bright'), line: t('A playful kalimba melody over electronic drums.') },
  };
  return copy[direction.id] ?? { name: genreTitle(direction.mood), line: soundSummary(direction.parameters) };
}

/** What makes a sound itself: its settings without the seed and the balance a use keeps. */
const character = (parameters: string): string =>
  musicStateParams({ ...parseMusicState(parameters), seed: 0, mix: { ...LOFI_MIX } });

/** A use's music in a starting sound: the sound's settings, the use's own seed and balance. */
export function musicInDirection(direction: SonicDirection, own: string): string {
  const mine = parseMusicState(own);
  return musicStateParams({ ...parseMusicState(direction.parameters), seed: mine.seed, mix: { ...mine.mix } });
}

/** Make a starting sound the sound of every use the procedural adapter plays. Returns a copy. */
export function applySonicDirection(profile: SonicProfileV1, direction: SonicDirection): SonicProfileV1 {
  const next = structuredClone(profile);
  for (const context of next.contexts) {
    if (context.music.adapter !== SONIC_MUSIC_ADAPTER) continue;
    context.music.parameters = musicInDirection(direction, context.music.parameters);
  }
  next.review = { state: 'draft' };
  return next;
}

/** The starting sound the default use plays, or null when it has its own settings now. */
export function sonicDirectionOf(profile: SonicProfileV1): SonicDirection | null {
  const main = profile.contexts.find((c) => c.id === profile.defaultContext);
  if (!main || main.music.adapter !== SONIC_MUSIC_ADAPTER) return null;
  const own = character(main.music.parameters);
  return SONIC_DIRECTIONS.find((d) => character(d.parameters) === own) ?? null;
}

/** A sound in plain words: "Warm · 84 bpm · Rhodes, rolling bass, dusty kit". */
export function soundSummary(parameters: string): string {
  const s = parseMusicState(parameters);
  const parts: string[] = [];
  if (s.keys) parts.push(LOFI_KEYS_NAME[s.keys]);
  if (s.bass) parts.push(LOFI_BASS_NAME[s.bass]);
  const lead = s.lead ? (LOFI_LEAD_NAME as Readonly<Record<string, string>>)[s.lead] : '';
  if (lead && s.mix.lead > 0) parts.push(lead);
  if (s.drums) parts.push(s.kit ? t(LOFI_KIT_NAME[s.kit]).toLowerCase() : t('drums'));
  const words = parts.filter(Boolean).join(', ');
  return [
    genreTitle(s.mood),
    s.bpm !== undefined ? tRaw('{bpm} bpm', { bpm: s.bpm }) : '',
    words ? words.charAt(0).toUpperCase() + words.slice(1) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** What to listen for in each of the study's uses, in plain words (the study's own notes,
 *  examples/open-media/corpus.json, say the same for its reviewers). Saved with the sound,
 *  so a person can rewrite them. */
const STARTER_GUIDANCE: Readonly<Record<string, string>> = {
  explain: 'Leave room around the voice.\nListen for: can you follow every word at a comfortable level? Does the music help without making the explanation sleepy?\nAvoid: a melody or a voice effect that competes with the speaker.',
  demonstrate: 'A steady pulse can carry a series of steps.\nListen for: do the pictures and the words change together? Is the pulse useful rather than hurried?\nAvoid: quick cuts that hide what changed.',
  play: 'Let the melody lead, and bring it down when someone speaks.\nListen for: is the melody still enjoyable the third time? Can you follow the voice when the music comes back?\nAvoid: something new every time, so no two pieces sound related.',
};

/** Starting points from the retained listening study. Creation never asserts listening approval. */
export function starterSonicProfile(id: string, label: string): SonicProfileV1 {
  return {
    schemaVersion: 1,
    id,
    revision: 1,
    label,
    owner: 'containing-design-system',
    identity: { character: '', anchors: '', avoid: '' },
    defaultContext: 'explain',
    review: { state: 'draft' },
    contexts: corpus.modes.map((mode) => ({
      id: mode.id,
      label: mode.label,
      purpose: mode.purpose,
      guidance: STARTER_GUIDANCE[mode.id] ?? `${mode.direction}\nListen for: ${mode.listenFor.join(' ')}\nAvoid: ${mode.counterexample}`,
      music: {
        adapter: SONIC_MUSIC_ADAPTER,
        parameters: musicStateParams(parseMusicState(mode.music)),
      },
      narration: {
        voice: '',
        speed: 1,
        bedVolume: mode.bedVolume,
        duck: mode.duck,
        guidance:
          'Choose a voice for your audience. Listen for words the music covers, pronunciation and pace.',
        pronunciations: [],
      },
      signature: {
        guidance:
          'No sound signature is set. A fixed opening or ending can be its own audio file; a new tune does not keep a melody.',
      },
      examples: [],
      requirements: [],
    })),
  };
}

export function matchesSonicRecipe(state: MusicState, recipe: SonicRecipeV1): boolean {
  return musicStateParams(state) === recipe.music.parameters;
}

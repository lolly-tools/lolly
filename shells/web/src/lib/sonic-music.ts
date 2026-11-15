// SPDX-License-Identifier: MPL-2.0
/** The procedural music adapter validates settings before the permissive link reader runs. */

import type { SonicMusicAdapter } from '../../../../engine/src/sonic-profile.ts';
import { ENGINE_VERSION } from '../../../../engine/src/version.ts';
import corpus from '../../../../examples/open-media/corpus.json' with { type: 'json' };
import type {
  SonicFindingV1,
  SonicProfileV1,
  SonicRecipeV1,
} from '../../../../packages/core/src/sonic-profile-v1.ts';
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
      message: `The music generator cannot retain the setting "${key}". Choose a supported value before generating.`,
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
      guidance: `${mode.direction}\nListen for: ${mode.listenFor.join(' ')}\nAvoid: ${mode.counterexample}`,
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
          'Choose a voice for your audience. Listen for masking, pronunciation and pacing; a loudness number does not establish intelligibility.',
        pronunciations: [],
      },
      signature: {
        guidance:
          'No sonic logo is assigned. A fixed opening or ending can be a separate asset; a new seed does not preserve a melodic motif.',
      },
      examples: [],
      requirements: [],
    })),
  };
}

export function matchesSonicRecipe(state: MusicState, recipe: SonicRecipeV1): boolean {
  return musicStateParams(state) === recipe.music.parameters;
}

// SPDX-License-Identifier: MPL-2.0
/**
 * Asset categorisation - the single source of truth for how an asset is bucketed into a
 * library group, shared by the asset picker (views/picker.ts) and the Catalog view
 * (views/assets.ts) so both group identically.
 *
 * The base category is inferred from the asset's catalog TAGS. A per-user override
 * (profile.assetCategories, keyed by base asset id → group key) layers on top so a user
 * can reclassify an asset - e.g. treat a headshot as a background - without mutating the
 * immutable catalog. See lib/asset-favourites.ts for the favourite/hidden overlays that
 * live alongside this one.
 */

import { stripAssetModifiers } from '../../../../engine/src/asset-modifiers.ts';
import type { AssetRef, HostV1, Profile } from '@lolly-tools/core/host-v1';

/** One display group; may declare tag-matched `sub` groups (rendered as nested
 *  collapsible sections). Currently unused - headshots are a top-level group - but
 *  kept as a general mechanism for future nested sections. */
export interface LibSubGroup { key: string; label: string; tag: string; }
export interface LibGroup {
  key: string;
  label: string;
  sub?: LibSubGroup[];
  /** Set on the groups audio belongs in; the rest are for pictures. `other` takes either. */
  audio?: true;
}

// Library sections, in display order. A candidate is bucketed into exactly one:
// 'background' wins over 'themable' so a two-colour background pattern lands under
// Backgrounds, not Icons. Headshots and Photos are SEPARATE top-level groups (each
// collapses on its own). 'other' catches anything untagged.
export const LIB_GROUPS: LibGroup[] = [
  { key: 'logos',         label: 'Logos' },
  { key: 'backgrounds',   label: 'Backgrounds' },
  { key: 'campaign',      label: 'Campaign Photos' },
  { key: 'photos',        label: 'SUSE Photos' },
  { key: 'headshots',     label: 'Headshots' },
  { key: 'icons',         label: 'Icons' },
  { key: 'illustrations', label: 'Illustrations' },
  { key: 'music',         label: 'Music',         audio: true },
  { key: 'sound-effects', label: 'Sound effects', audio: true },
  { key: 'voice',         label: 'Voice',         audio: true },
  { key: 'other-audio',   label: 'Other audio',   audio: true },
  { key: 'other',         label: 'More' },
];

// Audio is grouped by what it is FOR, the split an editor's sound panel uses. Tags
// decide first; then the format, because a computed song (ZzFXM, a tracker module,
// a MIDI import, a rondocode song) is music whatever it is tagged. Audio whose role
// nothing states (a plain recording, a sound pulled out of a video) is Other audio,
// never guessed into Music.
const VOICE_TAGS = ['voice', 'voiceover', 'tts', 'speech', 'narration', 'podcast', 'recording', 'dictation', 'interview'];
const SFX_TAGS = ['sfx', 'sound-effect', 'sound-effects', 'effect', 'foley', 'ui-sound', 'whoosh'];
const MUSIC_TAGS = ['music', 'song', 'loop', 'module', 'tracker', 'midi', 'rondocode', 'soundtrack', 'bed', 'jingle'];
const MUSIC_FORMATS = new Set(['zzfxm', 'rondo', 'mid', 'midi', 'mod', 'xm', 'it', 's3m', 'stm', 'mtm']);

/** Whether an asset is audio: its type says so, or its tags do. */
export function isAudioAsset(ref: AssetRef | undefined): boolean {
  return ref?.type === 'audio' || ((ref?.meta?.tags as string[] | undefined) ?? []).includes('audio');
}

/** The groups an asset may be moved into: audio groups for audio, picture groups otherwise, More for both. */
export function groupsFor(ref: AssetRef | undefined): LibGroup[] {
  const audio = isAudioAsset(ref);
  return LIB_GROUPS.filter((g) => g.key === 'other' || Boolean(g.audio) === audio);
}

function audioCategory(tags: Set<string>, format: string | undefined): string {
  if (VOICE_TAGS.some((x) => tags.has(x))) return 'voice';
  if (SFX_TAGS.some((x) => tags.has(x))) return 'sound-effects';
  if (MUSIC_TAGS.some((x) => tags.has(x)) || (format !== undefined && MUSIC_FORMATS.has(format))) return 'music';
  return 'other-audio';
}

/** Human label for a group key (falls back to the key itself). */
export function categoryLabel(key: string): string {
  return LIB_GROUPS.find(g => g.key === key)?.label ?? key;
}

/**
 * The library group an asset belongs to. A per-user override (base id → group key) wins;
 * otherwise the tags decide. Keep in lockstep with LIB_GROUPS.
 */
export function libCategory(ref: AssetRef | undefined, overrides?: Record<string, string> | null): string {
  const base = stripAssetModifiers(ref?.id ?? '');
  const over = overrides?.[base];
  if (over && LIB_GROUPS.some(g => g.key === over)) return over;
  const t = new Set((ref?.meta?.tags as string[] | undefined) || []);
  // Audio first, so a "background music" tag never files a track under Backgrounds.
  if (isAudioAsset(ref)) return audioCategory(t, ref?.format?.toLowerCase());
  if (t.has('campaign'))   return 'campaign';   // campaign photos are their own group, checked before 'photo'
  if (t.has('background')) return 'backgrounds';
  if (t.has('logo'))       return 'logos';
  if (t.has('headshot'))     return 'headshots';  // headshots collapse separately from photos
  if (t.has('illustration')) return 'illustrations';
  if (t.has('photo'))        return 'photos';
  if (t.has('themable'))     return 'icons';
  return 'other';
}

type PrefHost = HostV1 & { profile: { set(p: Profile): Promise<unknown> } };

/** The per-user category overrides map from the profile (empty if none). */
export function loadAssetCategories(profile: Profile | null | undefined): Record<string, string> {
  const raw = profile?.assetCategories;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'string') out[k] = v;
  return out;
}

/**
 * Set (or clear, when `key` is null) a per-user category override for a base asset id and
 * persist it. Mutates the cached profile instance then flushes via host.profile.set.
 * Best-effort.
 */
export async function saveAssetCategory(host: PrefHost, profile: Profile, baseId: string, key: string | null): Promise<void> {
  const map = { ...loadAssetCategories(profile) };
  if (key) map[baseId] = key; else delete map[baseId];
  profile.assetCategories = map;
  try { await host.profile.set(profile); } catch { /* storage off / quota - non-fatal */ }
}

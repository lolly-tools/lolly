// SPDX-License-Identifier: MPL-2.0
/**
 * A music generator tune kept in Projects (#/music, views/music-studio.ts).
 *
 * The tune is saved in the same store as every saved session (host.state), under a slot
 * of its own kind, `__music__:<time>`, the way a learning module keeps
 * `__learning__:<id>`: Projects lists it beside the tools' sessions, files it in folders,
 * renames and duplicates it, and opens it back in the music generator rather than in a
 * tool (lib/search/projects-source.ts, sessionOpenHref). The record holds the tune's
 * settings as the share link carries them (lib/music-state.ts, musicStateParams), so a
 * project and a link open the same tune: the style, seed, length, key, tempo, the
 * instruments for the whole track and for each kind of section, the kit, the tag, the
 * effects that are off, the mix, the texture, the brightness and the drive.
 */
import { musicStateParams, parseMusicState, type MusicState } from './music-state.ts';
import { MUSIC_SLOT_PREFIX, MUSIC_TOOL_ID, isMusicSlot } from './batch-slots.ts';
import { genreTitle } from './genre-icons.ts';

// The prefix lives with the other slot kinds, which the Projects tiles read without this module.
export { MUSIC_SLOT_PREFIX, MUSIC_TOOL_ID, isMusicSlot };

/** A slot for a newly kept tune. */
export const newMusicSlot = (now = Date.now()): string => `${MUSIC_SLOT_PREFIX}${now}`;

/** Where a kept tune opens: the music generator, which reads the tune back from its slot. */
export const musicProjectHref = (slot: string): string => `#/music?slot=${encodeURIComponent(slot)}`;

/**
 * A kept tune's name: its genre and its seed ("Ska · 7"), which together pick the tune.
 * Short enough for a project tile on a phone: a shuffle's seeds have at most six digits.
 */
export function musicProjectTitle(state: MusicState): string {
  return `${genreTitle(state.mood)} · ${state.seed}`;
}

/** The saved record: the name Projects shows, and the tune's settings as its link carries them. */
export interface MusicProjectData {
  __toolId: string;
  __label: string;
  __musicStudio: { version: 1; params: string };
}

export function musicProjectRecord(state: MusicState, label: string): MusicProjectData {
  return { __toolId: MUSIC_TOOL_ID, __label: label, __musicStudio: { version: 1, params: musicStateParams(state) } };
}

/** The tune a saved record holds, or null when the record is not a tune. */
export function musicStateFromProject(data: unknown): MusicState | null {
  if (!data || typeof data !== 'object') return null;
  const studio = (data as { __musicStudio?: unknown }).__musicStudio;
  if (!studio || typeof studio !== 'object') return null;
  const params = (studio as { params?: unknown }).params;
  return typeof params === 'string' ? parseMusicState(params) : null;
}

/** The kept tune's slot in a #/music address, or null when the address has none. */
export function musicSlotFromParams(params: string): string | null {
  const slot = new URLSearchParams(params).get('slot');
  return isMusicSlot(slot) ? slot : null;
}

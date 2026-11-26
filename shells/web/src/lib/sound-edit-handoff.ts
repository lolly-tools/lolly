// SPDX-License-Identifier: MPL-2.0
/**
 * The trip from the Sound room to the music generator and back.
 *
 * "Edit in the music generator" (lib/design-system/rooms/sound.ts) keeps the room's draft
 * here, with the use being edited, and opens #/music with that use's settings and
 * `sound=edit`. The generator (views/music-studio/sound-profile.ts) shows whose sound is
 * being edited, with Save to this use and Cancel; either one writes its answer here and
 * goes back to the room, which puts its draft back, takes the new settings when there are
 * some, and clears the trip.
 *
 * The draft can hold unsaved changes and private guidance, so it never goes in the
 * address. It lives in this tab's sessionStorage (so a reload in the generator keeps it),
 * with a copy in memory for a browser that refuses storage.
 */
import type { SonicProfileV1 } from '@lolly-tools/core/sonic-profile-v1';

export interface SoundEditTrip {
  v: 1;
  /** The design system the draft belongs to: a draft is never put back on another one. */
  system: string;
  /** The design system's name, for the generator's line. */
  label: string;
  /** The saved revision the draft began from; null when nothing was saved yet. */
  base: number | null;
  /** The room's draft, unsaved changes included. */
  profile: SonicProfileV1;
  /** The use being edited. */
  contextId: string;
  /** Whether a starting sound had been chosen. */
  picked: boolean;
  /** Whether the draft held unsaved changes before the trip. */
  dirty: boolean;
  /** The generator's answer: the settings to keep, or nothing when cancelled. */
  result?: { parameters: string } | { cancelled: true };
  at: number;
}

const KEY = 'lolly:soundEdit';
/** A trip older than this is dropped rather than put back. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
let memory: SoundEditTrip | null = null;

const storage = (): Storage | null => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};

export function writeSoundEdit(trip: SoundEditTrip): void {
  memory = structuredClone(trip);
  try {
    storage()?.setItem(KEY, JSON.stringify(trip));
  } catch {
    /* storage refused: the memory copy carries the trip */
  }
}

export function readSoundEdit(now = Date.now()): SoundEditTrip | null {
  let trip = memory;
  try {
    const raw = storage()?.getItem(KEY);
    if (raw) trip = JSON.parse(raw) as SoundEditTrip;
  } catch {
    /* unreadable: fall back to the memory copy */
  }
  if (trip?.v !== 1 || typeof trip.contextId !== 'string' || !trip.profile) return null;
  if (!(now - trip.at < MAX_AGE_MS)) {
    clearSoundEdit();
    return null;
  }
  return structuredClone(trip);
}

export function clearSoundEdit(): void {
  memory = null;
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The generator's answer: keep these settings, or cancel. */
export function finishSoundEdit(result: NonNullable<SoundEditTrip['result']>): void {
  const trip = readSoundEdit();
  if (trip) writeSoundEdit({ ...trip, result });
}

/** The marker the generator's address carries while a trip is open. */
export const SOUND_EDIT_PARAM = 'sound=edit';
export const isSoundEditLink = (params: string): boolean =>
  new URLSearchParams(params.replace(/^[^?]*\?/, '')).get('sound') === 'edit';
/** Where the room sends a use to be edited. */
export const soundEditHref = (parameters: string): string => `#/music?${parameters}&${SOUND_EDIT_PARAM}`;
/** Where the generator sends the person back to. */
export const SOUND_ROOM_HREF = '#/start?area=sound';

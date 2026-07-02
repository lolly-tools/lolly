// SPDX-License-Identifier: MPL-2.0
/**
 * ProfileAPI — user profile (firstname, headshot, etc).
 *
 * Single record at key 'me'. Headshot is stored as an AssetRef pointing into
 * the user-assets object store. Subscriptions let tools (or the host UI) react
 * when the user edits their profile mid-session.
 */

import type { Profile } from '@lolly/engine';

const KEY = 'me';

/** The slice of the idb database this API touches (the 'profile' store). */
export interface ProfileDb {
  get(store: 'profile', key: typeof KEY): Promise<Profile | undefined>;
  put(store: 'profile', profile: Profile, key: typeof KEY): Promise<unknown>;
}

/** HostV1's ProfileAPI plus the host-UI setter/cache-buster/subscription. */
export interface WebProfileAPI {
  get(): Promise<Profile>;
  set(profile: Profile): Promise<void>;
  bust(): void;
  subscribe(fn: (profile: Profile) => void): () => void;
}

export function createProfileAPI(db: ProfileDb): WebProfileAPI {
  const listeners = new Set<(profile: Profile) => void>();
  let cache: Profile | null = null;

  async function read(): Promise<Profile> {
    if (cache) return cache;
    cache = (await db.get('profile', KEY)) ?? {};
    return cache;
  }

  async function write(profile: Profile): Promise<void> {
    cache = profile;
    await db.put('profile', profile, KEY);
    listeners.forEach(fn => {
      try { fn(profile); } catch (e) { console.error(e); }
    });
  }

  return {
    get: () => read(),
    // Host UI uses this — not exposed to tools but kept on the same object for simplicity.
    set: write,
    bust() { cache = null; },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}

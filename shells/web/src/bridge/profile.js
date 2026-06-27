// SPDX-License-Identifier: MPL-2.0
/**
 * ProfileAPI — user profile (firstname, headshot, etc).
 *
 * Single record at key 'me'. Headshot is stored as an AssetRef pointing into
 * the user-assets object store. Subscriptions let tools (or the host UI) react
 * when the user edits their profile mid-session.
 */

const KEY = 'me';

export function createProfileAPI(db) {
  const listeners = new Set();
  let cache = null;

  async function read() {
    if (cache) return cache;
    cache = (await db.get('profile', KEY)) ?? {};
    return cache;
  }

  async function write(profile) {
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
      return () => listeners.delete(fn);
    },
  };
}

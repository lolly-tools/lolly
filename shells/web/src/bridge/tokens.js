/**
 * TokensAPI — design tokens for the host UI and token-aware tools.
 *
 * The canonical brand tokens live in the catalog as a `tokens` asset
 * (`suse/tokens/brand`, a DTCG document). This bridge loads that document and
 * hands back a resolved token set from engine/src/tokens.js — so the colour
 * picker can source its swatches from tokens, brand-bound input values can
 * resolve their references, and a token-aware tool can read the whole tree.
 *
 * Loading is offline-safe and degrades gracefully: it prefers the core-prefetched
 * blob in IndexedDB (cached at boot by catalog/sync.js), falls back to a direct
 * catalog fetch on first load, and if neither is available returns an empty set —
 * at which point the picker quietly falls back to its built-in palette.
 *
 * This is an *additive* v1 capability (HostV1.tokens?), like net/text — a shell
 * that doesn't provide it just doesn't offer token-driven swatches.
 */

import { createTokenSet } from '@lolly/engine';

const BRAND_TOKENS_ID = 'suse/tokens/brand';
const BRAND_TOKENS_URL = '/catalog/assets/suse/tokens/brand.json';

export function createTokensAPI(host) {
  const setByTheme = new Map(); // theme key ('' = default) → token set, cached once non-empty
  let docPromise = null;

  async function loadDoc() {
    // 1) The core-prefetched blob — present and offline-safe once boot sync ran.
    try {
      const ref = await host.assets.get(BRAND_TOKENS_ID);
      if (ref?.url) {
        const resp = await fetch(ref.url);
        if (resp.ok) return await resp.json();
      }
    } catch { /* not cached yet — fall through to a direct fetch */ }
    // 2) Direct catalog fetch — first load, before the blob is cached.
    try {
      const resp = await fetch(BRAND_TOKENS_URL, { cache: 'no-store' });
      if (resp.ok) return await resp.json();
    } catch { /* offline and not yet prefetched */ }
    return null;
  }

  async function doc() {
    // Memoise a successful load; clear on failure so the next call retries
    // (e.g. after boot sync finishes caching the blob).
    if (!docPromise) docPromise = loadDoc().then(d => { if (!d) docPromise = null; return d; });
    return docPromise;
  }

  async function ensure(theme) {
    const key = theme ?? '';
    if (setByTheme.has(key)) return setByTheme.get(key);
    const set = createTokenSet(await doc(), { theme });
    if (set.size > 0) setByTheme.set(key, set); // don't cache an empty (failed) load
    return set;
  }

  return {
    /** The resolved token set for the active (or named) theme. */
    get: (opts = {}) => ensure(opts.theme),
    /** Colour tokens as picker-ready swatches ({ ref, value, name, group, cmyk }). */
    colors: async (opts = {}) => (await ensure(opts.theme)).colors(),
    /** Resolve a `{path}` alias (or bare path) to its value. */
    resolve: async (ref, opts = {}) => (await ensure(opts.theme)).resolve(ref),
    /** Theme names declared in the document. */
    themes: async () => (await ensure()).themes(),
    /** Drop caches (e.g. after the user imports their own tokens). */
    bust() { setByTheme.clear(); docPromise = null; },
  };
}

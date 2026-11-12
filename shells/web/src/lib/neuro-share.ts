// SPDX-License-Identifier: MPL-2.0
/**
 * Links to what the Neurospicy player is playing: "this tune", or "this moment" (the tune,
 * where the tune had got to, and the visualiser as the sharer was seeing the picture). Any main view
 * opened with one starts the player there.
 *
 * A link identifies the track the way someone else's app can find the same track:
 * - a generated station's tune by its style and seed (`lofi=jazz.123456`, the form tune
 *   links already had), which composes the same tune anywhere;
 * - an internet radio station or a catalog track by its id (`listen=radio/somafm/groovesalad`).
 * A track that lives only on the sharer's device (their own upload) cannot be found by
 * anyone else, so it has no link, and the share card says why.
 *
 * A moment adds, under an `ns.` prefix so no tool's own setting can be mistaken for one:
 * the bar a station had reached in its tune (`ns.at`) or the second a track had reached
 * (`ns.t`), and the visualiser's preset (`ns.viz`), colours (`ns.colours`), brand tint
 * (`ns.tint`) and preset cycle (`ns.cycle`). The receiving app applies the look for that
 * visit only and saves none of it over the listener's own settings.
 *
 * Pure: no DOM, no storage. Everything read from a link is checked before anything uses the value.
 */

/** The look the visualiser had when the moment was shared. */
export interface SharedViz { preset?: string; scheme?: string; tint?: string; cycle?: number }

/** Where the tune had got to, and the look. */
export interface NeuroMoment { bar?: number; seconds?: number; viz?: SharedViz }

/** A link's track and moment, as read back. */
export interface NeuroShared { listen?: string; moment: NeuroMoment }

export const LISTEN_PARAM = 'listen';
export const MOMENT_PARAMS = { bar: 'ns.at', seconds: 'ns.t', preset: 'ns.viz', scheme: 'ns.colours', tint: 'ns.tint', cycle: 'ns.cycle' } as const;

/** The brand tints and preset cycles the visualiser offers (lib/viz-stock.ts, lib/viz-cycle.ts). */
const TINTS = ['off', 'subtle', 'strong', 'full'] as const;
const CYCLES = [0, 5, 20, 40] as const;

/** A track someone else can play from a link: a station, internet radio or the catalog; never a device-only upload. */
export function shareableId(id: string): boolean {
  return /^[a-z0-9][a-z0-9/_.:-]{0,200}$/i.test(id) && !id.startsWith('user/') && !id.startsWith('lofi:');
}

/** A preset id as the visualiser calls its presets: words, numbers and the usual punctuation, nothing that is markup. */
const PRESET_ID = /^[\p{L}\p{N} _.,:;'()&+!#[\]-]{1,160}$/u;
/** A colour scheme id: a brand colour's hex without the hash, or a short name. */
const SCHEME_ID = /^[a-z0-9-]{1,32}$/i;

/** The moment's query parts, in a fixed order. */
export function momentParts(m: NeuroMoment): string[] {
  const parts: string[] = [];
  const add = (key: string, value: string | number | undefined): void => {
    if (value !== undefined && value !== '') parts.push(`${key}=${encodeURIComponent(String(value))}`);
  };
  if (m.bar !== undefined && Number.isInteger(m.bar) && m.bar >= 0) add(MOMENT_PARAMS.bar, m.bar);
  else if (m.seconds !== undefined && Number.isFinite(m.seconds) && m.seconds > 0) add(MOMENT_PARAMS.seconds, Math.round(m.seconds));
  const v = m.viz;
  if (v) {
    if (v.preset && PRESET_ID.test(v.preset)) add(MOMENT_PARAMS.preset, v.preset);
    if (v.scheme && SCHEME_ID.test(v.scheme)) add(MOMENT_PARAMS.scheme, v.scheme);
    if (v.tint && (TINTS as readonly string[]).includes(v.tint)) add(MOMENT_PARAMS.tint, v.tint);
    if (v.cycle !== undefined && (CYCLES as readonly number[]).includes(v.cycle)) add(MOMENT_PARAMS.cycle, v.cycle);
  }
  return parts;
}

/** A link to `route` (a main view's hash, such as `#/`) with `parts` as its query. */
export function linkTo(origin: string, path: string, route: string, parts: readonly string[]): string {
  return `${origin}${path}${route}${parts.length ? `?${parts.join('&')}` : ''}`;
}

/** The query a link carries, from the hash first (the app's own links) and then the address's search. */
function queries(loc: { hash: string; search: string }): URLSearchParams[] {
  const hashQuery = loc.hash.includes('?') ? loc.hash.slice(loc.hash.indexOf('?') + 1) : '';
  return [new URLSearchParams(hashQuery), new URLSearchParams(loc.search)];
}

/** Read a shared track and moment from a page's address, or null when it has neither. */
export function readNeuroShare(loc: { hash: string; search: string }): NeuroShared | null {
  let found = false;
  const get = (key: string): string | null => {
    for (const q of queries(loc)) { const v = q.get(key); if (v !== null) { found = true; return v; } }
    return null;
  };
  const listenRaw = get(LISTEN_PARAM);
  const listen = listenRaw && shareableId(listenRaw) ? listenRaw : undefined;
  const moment: NeuroMoment = {};
  const bar = Number(get(MOMENT_PARAMS.bar));
  if (get(MOMENT_PARAMS.bar) !== null && Number.isInteger(bar) && bar >= 0 && bar < 100000) moment.bar = bar;
  const seconds = Number(get(MOMENT_PARAMS.seconds));
  if (get(MOMENT_PARAMS.seconds) !== null && Number.isFinite(seconds) && seconds > 0 && seconds < 86400) moment.seconds = seconds;
  const viz: SharedViz = {};
  const preset = get(MOMENT_PARAMS.preset);
  if (preset && PRESET_ID.test(preset)) viz.preset = preset;
  const scheme = get(MOMENT_PARAMS.scheme);
  if (scheme && SCHEME_ID.test(scheme)) viz.scheme = scheme;
  const tint = get(MOMENT_PARAMS.tint);
  if (tint && (TINTS as readonly string[]).includes(tint)) viz.tint = tint;
  const cycleRaw = get(MOMENT_PARAMS.cycle);
  const cycle = Number(cycleRaw);
  if (cycleRaw !== null && (CYCLES as readonly number[]).includes(cycle)) viz.cycle = cycle;
  if (Object.keys(viz).length) moment.viz = viz;
  if (!found) return null;
  return { ...(listen ? { listen } : {}), moment };
}

/** The page's address with the shared track and moment taken out, so a reload does not apply them again. */
export function withoutNeuroShare(loc: { pathname: string; search: string; hash: string }): string {
  const strip = (query: string): string => {
    const q = new URLSearchParams(query);
    for (const key of [LISTEN_PARAM, ...Object.values(MOMENT_PARAMS)]) q.delete(key);
    return q.toString();
  };
  const [route, hashQuery = ''] = loc.hash.split(/\?(.*)/s);
  const hq = strip(hashQuery);
  const sq = strip(loc.search.replace(/^\?/, ''));
  return `${loc.pathname}${sq ? `?${sq}` : ''}${route ?? ''}${hq ? `?${hq}` : ''}`;
}

/** The main views a shared link may open on as they are; a link from any other view opens on the gallery. */
export function shareRoute(hash: string): string {
  const route = hash.split('?')[0] ?? '';
  return /^#\/(u|utilities|a|assets)?$/.test(route) || route === '' || route === '#' ? (route || '#/') : '#/';
}

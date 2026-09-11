// SPDX-License-Identifier: MPL-2.0
/**
 * Free net-radio stations for the Neurospicy player - an OPT-IN source that needs
 * the internet (Lolly is otherwise offline-first). A handful of curated SomaFM
 * ambient/focus channels. Streams play through an <audio> element (see neurospicy.ts)
 * rather than the decoded-buffer path, but they are tapped INTO the Web Audio graph:
 * SomaFM's icecast answers with `Access-Control-Allow-Origin: *`, so the level meter
 * and the MilkDrop visualizer work on radio just like they do on a local track.
 * neurospicy.ts falls back to an untapped element if a server ever omits the header.
 *
 * We resolve the actual stream URL from SomaFM's per-channel .pls at play time
 * (CORS is open on api.somafm.com), so we never ship a stale hard-coded server.
 *
 * DEV GOTCHA (verified 2026-07-28, curl against ice2/ice6.somafm.com): the icecast servers
 * answer 403 to any request whose `Referer` contains `localhost` - so radio does not play at
 * all on `http://localhost:5173`, tap or no tap. `http://127.0.0.1:5173` is fine, as is
 * production. It's an anti-hotlink rule on their side, nothing to fix here; use the IP form
 * when testing radio locally. (They also 403 a `HeadlessChrome` user-agent.)
 * Please keep the SomaFM attribution + support link in the UI - they're free and
 * listener-supported.
 */
export interface RadioStation {
  /** Stable id, namespaced `radio/somafm/<channel>`. */
  id: string;
  name: string;
  /** SomaFM playlist URL; File1= inside is the current stream endpoint. */
  pls: string;
  /** One-line vibe, for the picker. */
  desc: string;
}

export const SOMAFM_HOME = 'https://somafm.com';

/** Curated Neurospicy-lane channels - mostly ambient/downtempo, plus a few lounge/beats picks. */
export const RADIO_STATIONS: RadioStation[] = [
  { id: 'radio/somafm/dubstep',      name: 'Dub Step Beyond',    pls: 'https://api.somafm.com/dubstep130.pls',      desc: 'dubstep, dub & deep bass' },
  { id: 'radio/somafm/groovesalad',  name: 'Groove Salad',       pls: 'https://api.somafm.com/groovesalad130.pls',  desc: 'ambient / downtempo' },
  { id: 'radio/somafm/dronezone',    name: 'Drone Zone',         pls: 'https://api.somafm.com/dronezone130.pls',    desc: 'atmospheric ambient' },
  { id: 'radio/somafm/spacestation', name: 'Space Station Soma', pls: 'https://api.somafm.com/spacestation130.pls', desc: 'spaced-out ambient' },
  { id: 'radio/somafm/deepspaceone', name: 'Deep Space One',     pls: 'https://api.somafm.com/deepspaceone130.pls', desc: 'deep-space ambient' },
  { id: 'radio/somafm/fluid',        name: 'Fluid',              pls: 'https://api.somafm.com/fluid130.pls',        desc: 'instrumental hip-hop' },
  { id: 'radio/somafm/lush',         name: 'Lush',               pls: 'https://api.somafm.com/lush130.pls',         desc: 'mellow vocal chill' },
  { id: 'radio/somafm/secretagent',  name: 'Secret Agent',       pls: 'https://api.somafm.com/secretagent130.pls',  desc: 'lounge / spy jazz' },
  { id: 'radio/somafm/defcon',       name: 'DEF CON Radio',      pls: 'https://api.somafm.com/defcon130.pls',       desc: 'beats for hacking' },
];

/** True for a Neurospicy track id that's a radio station (vs a catalog asset). */
export function isRadioId(id: string): boolean {
  return id.startsWith('radio/');
}

export function radioStation(id: string): RadioStation | undefined {
  return RADIO_STATIONS.find((s) => s.id === id);
}

/** Are we online right now? Radio is hidden/disabled when not. */
export function radioAvailable(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Resolve a .pls to its first stream URL (CORS-open). Throws on network/parse failure.
 *  no-referrer: the icecast side 403s localhost-ish referers (the gotcha above), and the
 *  Tauri shells' origin IS one (http://tauri.localhost) - main.ts also sets the document
 *  policy there, since Android WebView ignores per-request policies on MEDIA loads. */
export async function resolveStreamUrl(pls: string): Promise<string> {
  const res = await fetch(pls, { referrerPolicy: 'no-referrer' });
  if (!res.ok) throw new Error(`playlist ${res.status}`);
  const text = await res.text();
  const m = text.match(/^\s*File\d+\s*=\s*(\S+)/im);
  if (!m) throw new Error('no stream URL in playlist');
  return m[1]!.trim();
}

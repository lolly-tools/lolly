// SPDX-License-Identifier: MPL-2.0
/** Source recognition and seek confirmation shared by preview and export. */
export const SEEK_CONFIRM_MS = 300;
export const SEEK_TOLERANCE_S = 1.5 / 30;
export const SEEK_NUDGE_S = 0.25 / 30;
export const MEDIA_END_EPS_S = 0.04;

/** The module formats libopenmpt decodes for us. Mirrors `MODULE_FORMATS` in
 *  lib/mod-render.ts, which is the shipped list - a test asserts they are identical
 *  rather than importing it, because that module must stay out of the eager graph. */
export const MODULE_EXTENSIONS = ['mod', 'xm', 's3m', 'it', 'stm', 'mtm'] as const;

/** A url's own path extension, lowercased. '' for a blob:/data: url, or a query-only
 *  match - the query and fragment are cut first, so `?src=x.mod` is NOT an extension. */
export function urlExtension(url: string): string {
  const path = (url.split('#')[0] ?? '').split('?')[0] ?? '';
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** Does this url NAME a tracker module? A fast path only - see the section header. */
export function isModuleUrl(url: string): boolean {
  return (MODULE_EXTENSIONS as readonly string[]).includes(urlExtension(url));
}

/** Original-MOD channel magics that are not a literal 4CHN/16CH-style pattern. */
const MOD_MAGIC = new Set([
  'M.K.', 'M!K!', 'M&K!', 'N.T.', 'FLT4', 'FLT8', 'EXO4', 'EXO8',
  'OCTA', 'OKTA', 'CD81', 'FA04', 'FA06', 'FA08',
]);
/** `4CHN`, `16CH`, `TDZ3` - the channel-count magics, written as patterns. */
const MOD_MAGIC_RE = /^(?:[1-9]CHN|[1-9][0-9]C[HN]|TDZ[1-9])$/;
/** ScreamTracker 2 identifies itself at offset 20, with 0x1A as the EOF marker at 28. */
const STM_TAGS = new Set(['!scream!', 'bmod2stm', 'wuzamod!', 'swavepro']);

/**
 * Is this a tracker module, by its own bytes?
 *
 * Each of the six formats carries a magic, just not all in the same place: IT and XM
 * at the very start, MTM likewise, S3M at 0x2C, STM at 0x14, and the original MOD
 * family at 1080 - AFTER its 31 sample headers, which is why the buffer has to be at
 * least 1084 bytes before that one can be read at all.
 *
 * HONEST LIMIT: a 15-instrument SoundTracker MOD (pre-1987 layout) has NO magic
 * anywhere - nothing can identify it but its extension and a heuristic on its sample
 * table, and a heuristic that guesses wrong sends an mp3 to libopenmpt. So this
 * returns false for one, the extension path catches the ones named `.mod`, and the
 * rest degrade to the same logged silence as any other undecodable box. libopenmpt
 * itself sniffs the real format from the bytes, so this only has to decide WHO
 * decodes, never WHICH format it is.
 */
export function sniffTrackerModule(src: ArrayBuffer | Uint8Array): boolean {
  const b = src instanceof Uint8Array ? src : new Uint8Array(src);
  if (b.length < 32) return false;
  const tag = (at: number, len: number): string => {
    let s = '';
    for (let i = at; i < at + len && i < b.length; i++) s += String.fromCharCode(b[i] as number);
    return s;
  };
  if (tag(0, 4) === 'IMPM') return true;                                  // Impulse Tracker
  if (tag(0, 17) === 'Extended Module: ') return true;                    // FastTracker 2
  if (tag(0, 3) === 'MTM' && (b[3] as number) < 0x20) return true;        // MultiTracker
  if (b.length >= 48 && tag(44, 4) === 'SCRM') return true;               // ScreamTracker 3
  if (STM_TAGS.has(tag(20, 8).toLowerCase()) && b[28] === 0x1a) return true; // ScreamTracker 2
  if (b.length >= 1084) {                                                 // MOD and friends
    const magic = tag(1080, 4);
    if (MOD_MAGIC.has(magic) || MOD_MAGIC_RE.test(magic)) return true;
  }
  return false;
}

/** The one question both the preview and the export mix ask: does libopenmpt own this? */
export function looksLikeTrackerModule(url: string, bytes?: ArrayBuffer | Uint8Array | null): boolean {
  if (isModuleUrl(url)) return true;
  return !!bytes && sniffTrackerModule(bytes);
}

// ── rondocode songs ─────────────────────────────────────────────────────────
//
// A rondocode song is code that computes audio (plan 301), stored as its source:
// canonical `.rondo.json` bytes behind a user asset's `blob:` url, a `.rondo` or
// `.rondo.json` file, or a rondocode share link. Like a tracker module it holds
// no encoded audio, so no demuxer and no `decodeAudioData` reads one; it is
// rendered by lib/rondo-render.ts, which runs the song in the `vm` class.
//
// These tests mirror engine/src/rondo-source.ts's `isRondoFileName` and
// `isRondoShareLink` (a test asserts they agree) instead of importing them: that
// module carries fflate and the share-link dictionary, and this one sits on the
// editor's first-paint path, where a song is rare.

/** A share link's shape: rondocode.com with an `s=` payload in the fragment. */
const RONDO_LINK_RE = /^https:\/\/(?:www\.)?rondocode\.com\/[^#\s]*#(?:[^#\s]*&)?s=[A-Za-z0-9_-]/;
/** A song file's name: `x.rondo` (rondo language) or `x.rondo.json` (a project file). */
const RONDO_PATH_RE = /\.rondo(?:\.json)?$/i;
/** Largest stored song the byte sniff parses: the code ceiling twice over, plus the JSON frame. */
export const MAX_RONDO_SNIFF_BYTES = 256 * 1024 * 2 + 4096;

/** Is this a rondocode share link, which carries its song inside the link? */
export function isRondoShareUrl(url: string): boolean {
  return RONDO_LINK_RE.test(url.trim());
}

/** Does this url NAME a rondocode song: a share link, or a `.rondo`/`.rondo.json` path? */
export function isRondoUrl(url: string): boolean {
  const u = url.trim();
  if (RONDO_LINK_RE.test(u)) return true;
  const path = (u.split('#')[0] ?? '').split('?')[0] ?? '';
  return RONDO_PATH_RE.test(path);
}

/**
 * Is this a stored rondocode song, by its own bytes? A user asset's url is a
 * `blob:` with no extension, so the bytes are what identify it, exactly as for an
 * uploaded tracker module. The stored form is always the canonical file, which
 * says `"format": "rondocode"`, so one bounded JSON parse settles the question.
 */
export function sniffRondoSource(src: ArrayBuffer | Uint8Array): boolean {
  const b = src instanceof Uint8Array ? src : new Uint8Array(src);
  if (b.length < 2 || b.length > MAX_RONDO_SNIFF_BYTES) return false;
  let i = 0;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3;            // UTF-8 BOM
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x0a || b[i] === 0x0d || b[i] === 0x09)) i++;
  if (b[i] !== 0x7b /* '{' */) return false;
  try {
    const o = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(i))) as Record<string, unknown> | null;
    return !!o && o.format === 'rondocode' && typeof o.code === 'string';
  } catch {
    return false;
  }
}

/** The question every audio consumer asks before it reaches a decoder: is this a song? */
export function looksLikeRondoSong(url: string, bytes?: ArrayBuffer | Uint8Array | null): boolean {
  if (isRondoUrl(url)) return true;
  return !!bytes && sniffRondoSource(bytes);
}


/**
 * Real confirmation that a seek presented a frame: rVFC where it exists (its
 * `mediaTime` is the frame actually on screen, unlike `currentTime` which is merely
 * what we asked for), the `seeked` event racing alongside for engines that skip rVFC
 * on a paused element, and a hard timeout so a stalled decoder cannot wedge the queue.
 *
 * Browser-only by nature; the seeker takes it as a dependency so tests inject a fake.
 */
// An intersection, not an `extends`: newer lib.dom declares both members as REQUIRED on
// HTMLVideoElement, and re-declaring them optional in a subinterface is a TS2430 conflict.
// Intersecting keeps the widening additive for older lib versions and conflict-free for new ones.
type RvfcVideo = HTMLVideoElement & {
  requestVideoFrameCallback?(cb: (now: number, meta: { mediaTime?: number }) => void): number;
  cancelVideoFrameCallback?(handle: number): void;
};

export function waitSeekConfirmed(el: { currentTime: number }, signal?: AbortSignal, timeoutMs = SEEK_CONFIRM_MS): Promise<number | null> {
  const v = el as RvfcVideo;
  if (typeof v.addEventListener !== 'function') return Promise.resolve(el.currentTime);
  return new Promise((resolve) => {
    let done = false;
    let handle = 0;
    const cleanup = (): void => {
      clearTimeout(timer);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('error', onFail);
      signal?.removeEventListener('abort', onFail);
      if (handle) { try { v.cancelVideoFrameCallback?.(handle); } catch { /* already gone */ } }
    };
    const finish = (value: number | null): void => {
      if (done) return;
      done = true;
      cleanup();
      resolve(value);
    };
    const onSeeked = (): void => finish(v.currentTime);
    const onFail = (): void => finish(null);
    const timer = setTimeout(() => finish(null), timeoutMs);
    if (typeof v.requestVideoFrameCallback === 'function') {
      try {
        handle = v.requestVideoFrameCallback((_now, meta) => {
          finish(typeof meta?.mediaTime === 'number' ? meta.mediaTime : v.currentTime);
        });
      } catch { handle = 0; }
    }
    v.addEventListener('seeked', onSeeked, { once: true });
    v.addEventListener('error', onFail, { once: true });
    if (signal?.aborted) { finish(null); return; }
    signal?.addEventListener('abort', onFail, { once: true });
  });
}

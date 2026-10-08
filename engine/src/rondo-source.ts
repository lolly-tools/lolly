// SPDX-License-Identifier: MPL-2.0
/**
 * rondo-source.ts: a rondocode song as an asset's bytes. Reading only, never running.
 *
 * A rondocode song (github.com/vijaypemmaraju/rondocode, MIT) is source code that
 * computes audio. This module reads and writes that source as an asset and never
 * runs it: rendering is a shell's job, through packages/rondo, which evaluates the
 * song in the `vm` execution class. The split mirrors `zzfxm-ref.ts`, where the id
 * format lives here and the composer lives elsewhere, so every shell recognises a
 * song the same way and none of them needs to import the renderer to do so.
 *
 * Three ways in, one record out (`RondoSourceV1`):
 *   - a `.rondo` file: rondo-language source text;
 *   - a `.rondo.json` file: rondocode's own project export, `{ name, code }`, or
 *     this module's canonical form, which adds `schemaVersion`, `format` and
 *     `lang` and still opens in rondocode (its import reads `name` and `code`);
 *   - a rondocode share link: `https://rondocode.com/#s=<payload>`, where the
 *     payload is base64url behind a one-letter scheme (`p` raw DEFLATE with a
 *     preset dictionary, `d` raw DEFLATE, `u` uncompressed) over `{ n, c, l? }`.
 *
 * Every input is untrusted, so each path is bounded before it allocates: the
 * encoded link, the inflated payload and the decoded text all have ceilings.
 */
import { inflateSync } from 'fflate';
import { RONDO_SHARE_DICTIONARY_TEXT } from './rondo-share-dict.ts';

export const RONDO_SOURCE_SCHEMA_VERSION = 1;
/** The asset `format` value a song carries in a catalog or user asset record. */
export const RONDO_ASSET_FORMAT = 'rondo';
/** The canonical file name suffix. */
export const RONDO_FILE_SUFFIX = '.rondo.json';
/** Largest song source accepted, in UTF-8 bytes. packages/rondo applies the same ceiling. */
export const RONDO_MAX_SOURCE_BYTES = 256 * 1024;
/** Largest encoded share payload read from a link. */
const MAX_LINK_CHARS = 512 * 1024;

export type RondoLang = 'js' | 'rondo' | 'auto';

export interface RondoSourceV1 {
  schemaVersion: 1;
  format: 'rondocode';
  /** A display name; never used as an identifier. */
  name: string;
  /** 'auto' means unstated: the renderer applies upstream's sniff. */
  lang: RondoLang;
  code: string;
}

export class RondoSourceError extends Error {
  override name = 'RondoSourceError';
}

const RONDO_FILE = /\.rondo(?:\.json)?$/i;

/** True for `x.rondo` and `x.rondo.json`. */
export function isRondoFileName(fileName: string): boolean {
  return RONDO_FILE.test(fileName.trim());
}

/** True for a rondocode share link. Checks the shape only; nothing is decoded. */
export function isRondoShareLink(url: string): boolean {
  return /^https:\/\/(?:www\.)?rondocode\.com\/[^#\s]*#(?:[^#\s]*&)?s=[A-Za-z0-9_-]/.test(url.trim());
}

const stemOf = (fileName: string): string =>
  fileName.trim().replace(/^.*[\\/]/, '').replace(RONDO_FILE, '') || 'Untitled song';

// Control characters (C0 and DEL) never reach a display name.
const isControl = (code: number): boolean => code < 0x20 || code === 0x7f;

const cleanName = (v: unknown, fallback: string): string => {
  const s = typeof v === 'string' ? Array.from(v, (ch) => (isControl(ch.charCodeAt(0)) ? ' ' : ch)).join('').trim() : '';
  return (s || fallback).slice(0, 200);
};

const langOf = (v: unknown): RondoLang => {
  if (v === 'rondo') return 'rondo';
  // rondocode's own project records name the JavaScript dialect 'rondocode'.
  if (v === 'js' || v === 'rondocode') return 'js';
  return 'auto';
};

function decodeText(bytes: Uint8Array): string {
  if (bytes.length > RONDO_MAX_SOURCE_BYTES * 2) throw new RondoSourceError(`A song file must be under ${RONDO_MAX_SOURCE_BYTES / 1024} KB.`);
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new RondoSourceError('The song file is not UTF-8 text.');
  }
}

function checkCode(code: string): string {
  if (code.trim() === '') throw new RondoSourceError('The song has no code.');
  if (new TextEncoder().encode(code).length > RONDO_MAX_SOURCE_BYTES) {
    throw new RondoSourceError(`A song must be under ${RONDO_MAX_SOURCE_BYTES / 1024} KB of code.`);
  }
  return code;
}

/** Read a `{ name, code, lang? }` object: rondocode's export or the canonical form. */
function fromJsonObject(obj: unknown, fallbackName: string): RondoSourceV1 {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new RondoSourceError('The song file is not a rondocode project.');
  const o = obj as Record<string, unknown>;
  if (o.schemaVersion !== undefined && o.schemaVersion !== RONDO_SOURCE_SCHEMA_VERSION) {
    throw new RondoSourceError(`This song file uses schema version ${String(o.schemaVersion)}, which this version of Lolly cannot read.`);
  }
  if (typeof o.code !== 'string') throw new RondoSourceError('The song file has no code.');
  return {
    schemaVersion: 1,
    format: 'rondocode',
    name: cleanName(o.name, fallbackName),
    lang: langOf(o.lang),
    code: checkCode(o.code),
  };
}

/** Read a song from a file's bytes. The extension decides the reading. */
export function rondoFromFile(bytes: Uint8Array, fileName: string): RondoSourceV1 {
  const text = decodeText(bytes);
  if (/\.rondo$/i.test(fileName.trim())) {
    return { schemaVersion: 1, format: 'rondocode', name: cleanName(stemOf(fileName), 'Untitled song'), lang: 'rondo', code: checkCode(text) };
  }
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new RondoSourceError('The song file is not valid JSON.');
  }
  return fromJsonObject(obj, stemOf(fileName));
}

/** Read a song back from an asset's stored bytes (the canonical form). */
export function rondoFromBytes(bytes: Uint8Array): RondoSourceV1 {
  return rondoFromFile(bytes, 'song.rondo.json');
}

/** The canonical bytes of a song: stable key order, two-space JSON, trailing newline. */
export function rondoSourceBytes(src: RondoSourceV1): Uint8Array {
  const canonical = {
    schemaVersion: RONDO_SOURCE_SCHEMA_VERSION,
    format: 'rondocode',
    name: cleanName(src.name, 'Untitled song'),
    lang: langOf(src.lang),
    code: checkCode(src.code),
  };
  return new TextEncoder().encode(`${JSON.stringify(canonical, null, 2)}\n`);
}

/** The canonical file name for a song. */
export function rondoFileName(src: Pick<RondoSourceV1, 'name'>): string {
  const slug = src.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${slug || 'song'}${RONDO_FILE_SUFFIX}`;
}

function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new RondoSourceError('The share link is malformed.');
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let dictionary: Uint8Array | null = null;

function inflateBounded(bytes: Uint8Array, dict: Uint8Array | undefined): Uint8Array {
  // The output buffer is the ceiling. fflate never grows a caller-supplied
  // `out`; it stops writing at the end of the buffer WITHOUT an error, so a full
  // buffer is read as "too large" rather than parsed as a truncated song.
  const out = new Uint8Array(RONDO_MAX_SOURCE_BYTES * 2 + 1024);
  let inflated: Uint8Array;
  try {
    inflated = inflateSync(bytes, dict ? { out, dictionary: dict } : { out });
  } catch {
    throw new RondoSourceError('The share link could not be decoded.');
  }
  if (inflated.length >= out.length) throw new RondoSourceError('The song in the share link is too large.');
  return inflated;
}

/** Read the song inside a rondocode share link. */
export function rondoFromShareLink(url: string): RondoSourceV1 {
  const hash = url.trim().split('#')[1] ?? '';
  const m = /(?:^|&)s=([^&]+)/.exec(hash);
  if (!m?.[1]) throw new RondoSourceError('That link does not carry a rondocode song.');
  const payload = m[1];
  if (payload.length > MAX_LINK_CHARS) throw new RondoSourceError('The share link is too long.');
  const scheme = payload[0];
  const body = fromBase64Url(payload.slice(1));
  let json: Uint8Array;
  if (scheme === 'p') {
    dictionary ??= new TextEncoder().encode(RONDO_SHARE_DICTIONARY_TEXT);
    json = inflateBounded(body, dictionary);
  } else if (scheme === 'd') json = inflateBounded(body, undefined);
  else if (scheme === 'u') json = body;
  else throw new RondoSourceError('The share link uses an encoding this version of Lolly cannot read.');
  let obj: unknown;
  try {
    obj = JSON.parse(decodeText(json));
  } catch (e) {
    if (e instanceof RondoSourceError) throw e;
    throw new RondoSourceError('The share link does not hold a song.');
  }
  const o = (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>;
  return fromJsonObject({ name: o.n, code: o.c, lang: o.l }, 'Shared song');
}

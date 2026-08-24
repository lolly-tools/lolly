// SPDX-License-Identifier: MPL-2.0
/**
 * WAV provenance tags: the RIFF LIST/INFO chunk. This is the WAV container's
 * own equivalent of the mp4 ilst / WebM Tags the video exports already write
 * (video-meta.ts). A generated narration clip leaves Lolly as a plain WAV, so
 * its human-readable authorship (title, the AI-declaration comment, an opted-in
 * artist, the writing software) goes where every audio tool already looks:
 *
 *   LIST ▸ INFO ▸ INAM (title) / IART (artist, only when provided) /
 *                 ICMT (comment) / ISFT (software)
 *
 * Pure bytes-in/bytes-out, no DOM, no async. Conservative like the video
 * embedders: anything that is not a walkable RIFF/WAVE file returns the
 * ORIGINAL bytes untouched - a playable file without tags always beats a
 * corrupted one with them. A prior LIST/INFO chunk is replaced, never
 * duplicated, so re-tagging is idempotent. Values are UTF-8, NUL-terminated
 * and even-padded per RIFF; the RIFF size field is patched to match. The C2PA
 * credential is a separate top-level chunk (c2pa-containers.ts placeWav) -
 * embed INFO first so the hard binding hashes the finished tag bytes.
 */

import { concatBytes } from './bytes.ts';

/** The INFO fields written. Empty/absent fields are omitted entirely. */
export interface WavInfoTags {
  /** INAM - the clip's display title. */
  title?: string;
  /** IART - the author, only when the user opted their details in. */
  artist?: string;
  /** ICMT - free-text comment (the AI-declaration line for generated audio). */
  comment?: string;
  /** ICOP - the copyright notice (user-asserted, e.g. bindToMeta). */
  copyright?: string;
  /** ISFT - the writing software; defaults to 'lolly.tools'. */
  software?: string;
}

const te = new TextEncoder();
const fourccBytes = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const u32le = (n: number): Uint8Array =>
  Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);

// One INFO sub-chunk: fourcc + size + NUL-terminated value, even-padded (the
// pad byte is not counted in the declared size, per RIFF).
function infoSub(id: string, value: string): Uint8Array {
  const body = concatBytes([te.encode(value), Uint8Array.of(0)]);
  return concatBytes([
    fourccBytes(id), u32le(body.length), body,
    body.length & 1 ? Uint8Array.of(0) : new Uint8Array(0),
  ]);
}

/**
 * Write (or replace) the LIST/INFO chunk of a WAV file. Returns the original
 * bytes untouched when the input is not a RIFF/WAVE container, when its chunk
 * list does not walk cleanly, or when no field survives trimming - never
 * throws, never corrupts.
 */
export function embedWavInfo(wav: Uint8Array, tags: WavInfoTags): Uint8Array {
  const fourcc = (o: number) => String.fromCharCode(wav[o]!, wav[o + 1]!, wav[o + 2]!, wav[o + 3]!);
  if (wav.length < 12 || fourcc(0) !== 'RIFF' || fourcc(8) !== 'WAVE') return wav;

  const clean = (s: unknown): string => (s == null ? '' : String(s).trim());
  const fields: Array<[string, string]> = [];
  const title = clean(tags.title);
  const artist = clean(tags.artist);
  const comment = clean(tags.comment);
  const software = clean(tags.software) || 'lolly.tools';
  if (title) fields.push(['INAM', title]);
  if (artist) fields.push(['IART', artist]);
  if (comment) fields.push(['ICMT', comment]);
  const copyright = clean(tags.copyright);
  if (copyright) fields.push(['ICOP', copyright]);
  fields.push(['ISFT', software]);
  if (!fields.length) return wav;

  // Walk the top-level chunks; drop a prior LIST/INFO (replace, never
  // duplicate). Bounds-checked - a declared size past EOF makes the file
  // unwalkable and the whole write a no-op.
  const dv = new DataView(wav.buffer, wav.byteOffset);
  let drop: { start: number; end: number } | null = null;
  for (let i = 12; i + 8 <= wav.length; ) {
    const size = dv.getUint32(i + 4, true);
    const end = i + 8 + size + (size & 1);
    if (end > wav.length + 1) return wav;
    if (fourcc(i) === 'LIST' && size >= 4 && fourcc(i + 8) === 'INFO') {
      drop = { start: i, end: Math.min(end, wav.length) };
    }
    i = end;
  }

  const payload = concatBytes([fourccBytes('INFO'), ...fields.map(([id, v]) => infoSub(id, v))]);
  const list = concatBytes([fourccBytes('LIST'), u32le(payload.length), payload]);
  const cleaned = drop ? concatBytes([wav.subarray(0, drop.start), wav.subarray(drop.end)]) : wav;
  const out = concatBytes([cleaned, list]);
  new DataView(out.buffer, out.byteOffset).setUint32(4, out.length - 8, true);
  return out;
}

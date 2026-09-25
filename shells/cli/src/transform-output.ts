// SPDX-License-Identifier: MPL-2.0
/**
 * What did a transform write? A transform tool (hooks.exportFile) hands back bytes and
 * the CLI names the file after them, so both `lolly smoke` (which checks the bytes
 * against the formats the tool declares) and `lolly batch` (which names each row's file
 * from them) read the container from the bytes here.
 *
 * format-sniff identifies the render formats. A transform also writes audio (clean,
 * trim), which format-sniff has no rows for, so the audio containers are identified
 * here: WAV, Ogg (an .opus file is Ogg), FLAC, MP3, and the two ISO-BMFF brands a
 * converter writes that are not a plain MP4 (M4A audio and QuickTime MOV). A font is
 * identified by the engine's sfntKind.
 */

import { sfntKind } from '@lolly/engine';
import { formatAllows, sniffFormat } from '@lolly-tools/node-shell/format-sniff';

const ascii = (b: Uint8Array, at: number, s: string): boolean => {
  if (at + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false;
  return true;
};

/** An ISO-BMFF brand format-sniff folds into mp4 but a file name must not. */
function isoAudioBrand(b: Uint8Array): 'm4a' | 'mov' | null {
  if (!ascii(b, 4, 'ftyp')) return null;
  if (ascii(b, 8, 'M4A ') || ascii(b, 8, 'M4B ')) return 'm4a';
  if (ascii(b, 8, 'qt  ')) return 'mov';
  return null;
}

/** The audio containers identified from their first bytes, or null. */
function audioKind(b: Uint8Array): 'wav' | 'ogg' | 'flac' | 'mp3' | null {
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE')) return 'wav';
  if (ascii(b, 0, 'OggS')) return 'ogg';
  if (ascii(b, 0, 'fLaC')) return 'flac';
  if (ascii(b, 0, 'ID3')) return 'mp3';
  // An MPEG audio frame header: eleven sync bits, then a layer that is not the reserved
  // 00 (AAC in ADTS framing uses 00 there, so it is not read as MP3).
  if (b.length >= 2 && b[0] === 0xff && (b[1]! & 0xe0) === 0xe0 && (b[1]! & 0x06) !== 0) return 'mp3';
  return null;
}

/**
 * The declared names each locally identified kind satisfies. An M4A or MOV file does not
 * satisfy a declared `mp4`: the name would hide which container it is.
 */
const LOCAL_ACCEPTS: Record<string, readonly string[]> = Object.assign(Object.create(null) as Record<string, readonly string[]>, {
  wav: ['wav'], mp3: ['mp3'], ogg: ['ogg'], opus: ['ogg'], oga: ['ogg'], flac: ['flac'],
  m4a: ['m4a'], mov: ['mov'],
});

const FONT_KINDS = new Set(['ttf', 'otf', 'woff', 'woff2']);

/**
 * True when a format name has a magic-byte signature this module or format-sniff can
 * check. format-sniff answers "allowed" for a name it has no row for, and a row lists
 * the few containers it admits, so a name with a row refuses PNG or refuses PDF.
 */
export function hasSignature(name: string): boolean {
  const f = name.toLowerCase();
  if (FONT_KINDS.has(f) || f in LOCAL_ACCEPTS) return true;
  return !formatAllows(f, 'png') || !formatAllows(f, 'pdf');
}

/** Does the declared name `f` describe bytes identified as `kind`? */
function describes(f: string, kind: string, sniffed: ReturnType<typeof sniffFormat>): boolean {
  if (FONT_KINDS.has(f)) return f === kind;
  const local = LOCAL_ACCEPTS[f];
  if (local?.includes(kind)) return true;
  return !!sniffed && sniffed === kind && hasSignature(f) && formatAllows(f, sniffed);
}

/**
 * The container a transform wrote, from its bytes alone: a font kind, an audio kind,
 * else the format-sniff identity (pdf, zip, png, ...), else null.
 */
export function transformOutputKind(bytes: Uint8Array): string | null {
  return sfntKind(bytes) ?? isoAudioBrand(bytes) ?? audioKind(bytes) ?? sniffFormat(bytes);
}

/** A checked result: `checked` is false when no declared format has a signature to read. */
export type TransformOutputCheck = { kind: string; checked: boolean } | { error: string };

const norm = (f: string): string => (f === 'jpeg' ? 'jpg' : f);

/**
 * Does a transform's output match what the tool declares? Non-empty, and the bytes
 * identify as one of `formats`. When the bytes carry no known signature and the tool
 * declares a format that has none (html, json, txt), the output is taken as that format
 * with `checked: false`: nothing about the bytes was verified beyond their length.
 * Returns the declared name that matched, or an error sentence.
 */
export function checkTransformOutput(bytes: Uint8Array, formats: string[]): TransformOutputCheck {
  if (!bytes.length) return { error: 'the transform wrote an empty file' };
  const declared = formats.map(f => f.toLowerCase());
  const kind = transformOutputKind(bytes);
  const unverifiable = declared.find(f => !hasSignature(f));
  if (kind) {
    const sniffed = sniffFormat(bytes);
    const exact = declared.find(f => norm(f) === kind);
    if (exact) return { kind: exact, checked: true };
    const match = declared.find(f => describes(f, kind, sniffed));
    if (match) return { kind: match, checked: true };
    if (unverifiable && !declared.some(hasSignature)) return { kind: unverifiable, checked: false };
    return { error: `the output bytes are ${kind}, which "${declared.join(', ')}" does not declare` };
  }
  if (unverifiable) return { kind: unverifiable, checked: false };
  return { error: `the output has no magic bytes for ${declared.join(', ')}` };
}

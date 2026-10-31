// SPDX-License-Identifier: MPL-2.0
/**
 * "Did the encoder actually give me the format I asked for?" This is the Node shells'
 * output guard.
 *
 * The failure this exists for: `lolly qr-code --export=avif --output=qr.avif` wrote
 * PNG BYTES under an .avif name and exited 0. Headless Chromium ships no AV1 encoder,
 * so the web shell's canvasToBlob silently degrades to PNG; the CLI wrote whatever it
 * was handed. A pipeline downstream then has a file whose extension, whose MIME
 * assumption and whose actual bytes disagree. That is a plausible-looking wrong file,
 * the worst outcome this shell can produce.
 *
 * So: sniff the bytes, compare against what was REQUESTED, and refuse on a mismatch
 * rather than writing. The check is deliberately conservative. An unrecognised
 * signature is "no opinion", never a failure, so it can only ever catch a case where
 * we positively identified a DIFFERENT container.
 *
 * DELIBERATE WORDING of the refusal, same discipline as `deepSourceRefusal` in
 * raster.ts: it must not contain "browser engine", "needs a browser", "requires an",
 * "<svg>", "no built web shell" or "chromium", because shells/cli/src/run.ts
 * pattern-matches those to take a fallback path. An encoder mismatch must fail loudly,
 * never quietly become some other file.
 */

import { sniffFormat, acceptedFormats, formatAllows, SNIFFED_FORMAT_LABEL, type SniffedFormat } from '../../../engine/src/format-sniff.ts';

// Detection and the requested-format table live in the engine (format-sniff.ts),
// shared with the export report and the web shell. This module keeps the refusal.
export { sniffFormat, formatAllows };
export type { SniffedFormat };

/** Thrown when the produced bytes are demonstrably not the requested container. */
export class FormatMismatchError extends Error {
  readonly requested: string;
  readonly produced: SniffedFormat;
  constructor(requested: string, produced: SniffedFormat, message: string) {
    super(message);
    this.name = 'FormatMismatchError';
    this.requested = requested;
    this.produced = produced;
  }
}

/**
 * Refuse output whose bytes are a different container from the one requested.
 *
 * Conservative on purpose, in both directions:
 *   • an unknown request (no row in the engine's table) is never checked;
 *   • an unrecognised signature is never a failure - "no opinion" is not "wrong".
 * Only a positive identification of a DIFFERENT container throws.
 *
 * Call it after the bytes are final and BEFORE anything is written.
 */
export function assertFormatBytes(requested: string, bytes: Uint8Array): void {
  const want = acceptedFormats(requested);
  if (!want) return;
  const got = sniffFormat(bytes);
  if (!got || want.includes(got)) return;
  throw new FormatMismatchError(
    requested, got,
    `the encoder returned ${SNIFFED_FORMAT_LABEL[got]} bytes for an export requested as "${requested}". ` +
    'This shell will not write a file whose contents disagree with its declared format - a mislabelled ' +
    'file is worse than a failed export, because nothing downstream can tell. ' +
    (got === 'png' && (requested.toLowerCase() === 'avif' || requested.toLowerCase() === 'heic')
      ? 'The headless render tier has no AV1/HEVC encoder, so its canvas encoder degrades to PNG. '
      : '') +
    `Export "${SNIFFED_FORMAT_LABEL[got].toLowerCase()}" instead, or re-encode the ${SNIFFED_FORMAT_LABEL[got]} output yourself. ` +
    'No file was written.',
  );
}

/** How far into a file `isSvgDocument` looks for the root element: a legacy
 *  Illustrator export puts a DOCTYPE and a block of ENTITY declarations first. */
export const SVG_SNIFF_BYTES = 64 * 1024;

/** The leading text of a file for `isSvgDocument`, by its byte-order mark. */
function leadingText(bytes: Uint8Array): string {
  const head = bytes.subarray(0, SVG_SNIFF_BYTES);
  const utf16 = head[0] === 0xff && head[1] === 0xfe ? 'utf-16le' : head[0] === 0xfe && head[1] === 0xff ? 'utf-16be' : null;
  return new TextDecoder(utf16 ?? 'utf-8').decode(head).replace(/^﻿/, '');
}

/**
 * Whether the bytes are an SVG document: the first element, after the XML
 * declaration, processing instructions, comments and a DOCTYPE (internal subset
 * included), is `<svg>` or a prefixed `<x:svg>`. Only the first `SVG_SNIFF_BYTES`
 * are read. Anything else is not an SVG, including text or HTML that mentions
 * `<svg` further on: a word inside a file never makes that file a picture.
 */
export function isSvgDocument(bytes: Uint8Array): boolean {
  const s = leadingText(bytes);
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i]!)) i++;
    if (s.startsWith('<?', i)) {
      const end = s.indexOf('?>', i + 2);
      if (end < 0) return false;
      i = end + 2;
    } else if (s.startsWith('<!--', i)) {
      const end = s.indexOf('-->', i + 4);
      if (end < 0) return false;
      i = end + 3;
    } else if (/^<!DOCTYPE\s/i.test(s.slice(i, i + 10))) {
      const end = doctypeEnd(s, i + 9);
      if (end < 0) return false;
      i = end + 1;
    } else {
      return /^<(?:[A-Za-z_][\w.-]*:)?svg[\s/>]/.test(s.slice(i, i + 64));
    }
  }
  return false;
}

/** The index of the `>` that closes a DOCTYPE, past its quoted ids and its
 *  `[...]` internal subset (whose ENTITY values are quoted), or -1. */
function doctypeEnd(s: string, from: number): number {
  let quote: string | null = null;
  let subset = false;
  for (let k = from; k < s.length; k++) {
    const c = s[k]!;
    if (quote) {
      if (c === quote) quote = null;
    } else if (subset && s.startsWith('<!--', k)) {
      const end = s.indexOf('-->', k + 4);
      if (end < 0) return -1;
      k = end + 2;
    } else if (c === '"' || c === '\'') {
      quote = c;
    } else if (c === '[') {
      subset = true;
    } else if (c === ']') {
      subset = false;
    } else if (c === '>' && !subset) {
      return k;
    }
  }
  return -1;
}

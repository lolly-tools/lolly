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

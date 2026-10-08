// SPDX-License-Identifier: MPL-2.0

import type { IngredientCredential, SourceIngredient } from './assets.ts';

// ─── Content Credentials signing (optional, v1.85; widened v1.104) ────────────

export interface C2paSignOpts {
  /** Labels the primary edit step in the action history. */
  description?: string;
  /** dc:title for the manifest - usually the file's own name. */
  title?: string;
  /**
   * Asserted authorship → the manifest's dc:creator. A bare string is shorthand
   * for `{ name }`. This is how an artist claims their name over content they
   * already have digitised, before uploading it anywhere. `email`/`url` are the
   * licensing contact - both survive in the manifest and /verify shows them.
   */
  author?: { name: string; email?: string; url?: string } | string;
  /** © notice + licence, combined into one line → the manifest's dc:rights. */
  rights?: string;
  /**
   * Source manifests to PRESERVE as ingredients (relationship `parentOf`), so a
   * credential already inside the bytes - or a signed element within a container
   * (a C2PA raster embedded in a PDF/SVG, a signed track in an MP4) - survives
   * and is referenced rather than orphaned. Read them with the engine's
   * `extractC2paStore` / `prepareC2paIngredientFromStore` (and `extractC2paFromPdf`
   * for a document-level PDF manifest). When present the engine prepends a
   * `c2pa.opened` step per ingredient and the new claim reads as an edit of prior
   * work, so the history must NOT also claim `c2pa.created`. A componentOf
   * ingredient is recorded as `c2pa.placed` instead. A {@link SourceIngredient}
   * (v1.194) describes a source with no credential of its own.
   */
  ingredients?: (IngredientCredential | SourceIngredient)[];
  /**
   * What Lolly did to the bytes, for an honest action history:
   * • `'imported'` - content authored elsewhere; authorship/rights/metadata added
   *    here without re-rendering the essence (the any-media stamping path). The
   *    default whenever `author`, `rights`, or `ingredients` is supplied.
   * • `'redacted'` - a fresh derivative with content removed (the redact path):
   *    `c2pa.created` + a `c2pa.redacted` step. The default when none of the above
   *    are given, preserving the original v1.85 contract.
   */
  action?: 'imported' | 'redacted';
  /**
   * The caller applied the durable Lolly pixel imprint to the essence before
   * signing (raster only) - records an honest `c2pa.edited` watermark step.
   * Ignored on `'redacted'`.
   */
  imprinted?: boolean;
  /**
   * The file is a render of one rondocode song (v1.246, plan 301). The shell
   * signs the created step and the song's source ingredient that
   * engine/src/rondo-provenance.ts words, and for WAV writes the same
   * declaration into the RIFF comment, the way a generated voice clip is signed.
   * Every other option above is ignored. A format with no credential placer
   * rejects, so a caller never reports a credential that was not written.
   */
  rondo?: C2paRondoFile;
}

/** What a rondocode render's credential records: engine RondoRenderFacts, plus the song. */
export interface C2paRondoFile {
  /** The song's canonical `.rondo.json` bytes; their sha256 identifies the source ingredient. */
  song: Uint8Array;
  /** The song's display name, the credential's title. */
  name: string;
  /** The execution class the song's code ran in, for example `vm`. */
  executionClass: string;
  /** The renderer's version, as host.audio.decode reports the version. */
  version: string;
  seed?: number;
  /** Synths whose synthesised singing is in the file. Present: composite AI media. */
  sungParts?: string[];
  /** Singing voices used. */
  voices?: string[];
  /** Parts the render could not play. */
  silentParts?: string[];
}

export interface C2paAPI {
  /**
   * Embed a freshly signed C2PA manifest into `bytes` and return the stamped
   * bytes. `format` is the output format key ('pdf', 'png', 'jpg', 'mp4', 'm4a',
   * …) - see the engine's `C2PA_FORMATS` for the full set. Two modes, chosen by
   * `opts` (see {@link C2paSignOpts}):
   *  • the default derivative path (v1.85): a redacted file, no ingredients; and
   *  • the any-media authorship path (v1.104): stamp an existing file with the
   *    artist's author/copyright/licence, carrying any manifests already inside
   *    it forward as ingredients so nested credentials are preserved, not lost.
   * Throws when the format cannot carry a manifest or signing fails - the caller
   * decides whether unsigned bytes may still ship.
   */
  sign(bytes: Uint8Array, format: string, opts?: C2paSignOpts): Promise<Uint8Array>;

  /**
   * Read EVERY C2PA manifest a file already carries and package each as an
   * ingredient ready to pass to `sign({ ingredients })` (v1.104). Collects the
   * file's own container-level credential - for any supported format (PDF, PNG,
   * JPEG, MP4, M4A, WebP, AVIF, TIFF, GIF, SVG, WebM, MP3, WAV) - plus the
   * element-level credentials nested inside a container (today: signed rasters an
   * SVG embeds via `<image href="data:…">`). This is how a tool that stamps an
   * authorship claim onto an EXISTING file preserves what is already inside it,
   * relationship `parentOf`, instead of orphaning it. Read-only; NEVER throws -
   * a file with nothing signed resolves to `[]`.
   */
  readIngredients(bytes: Uint8Array): Promise<IngredientCredential[]>;
}

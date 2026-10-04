// SPDX-License-Identifier: MPL-2.0
/**
 * design-package-v1: what `lolly package` and the `lolly_package` MCP tool report
 * after writing a Design document as a reopenable `.lolly` session (plan 291, W8).
 * Mirrored by `schemas/design-package-v1.schema.json`, with a byte-identical copy
 * under `packages/core/schema/` for the SDK.
 *
 * The writer (`packageDesign`, @lolly-tools/node-shell/design-lolly) expands any
 * authoring keys first, so the file only ever holds stored rows. It hashes every
 * picture it is given, rewrites each row that draws one to the upload ref
 * `user/media/<sha256>`, checks every other picture reference against the active
 * profile's catalog, writes the session markers the app reads to name and size the
 * document, then reads the file back and reports what the reader saw.
 *
 * Types and constants only: no runtime, no DOM, no I/O.
 */

/** Report discriminator. */
export const DESIGN_PACKAGE_FORMAT = 'lolly-package' as const;
/** Bumped only for a change an older reader would misread. */
export const DESIGN_PACKAGE_VERSION = 1 as const;

/**
 * Where a carried picture's bytes came from: a keyed file the caller gave
 * (`--asset=KEY=PATH`, `assets[]`), the folder `lolly read --media` wrote
 * (`--asset-dir`), or the source deck or `.lolly` (`--source`).
 */
export const DESIGN_PACKAGE_MEDIA_ORIGINS = ['asset', 'asset-dir', 'source'] as const;
export type DesignPackageMediaOriginV1 = (typeof DESIGN_PACKAGE_MEDIA_ORIGINS)[number];

/**
 * Every code a refusal or failure carries. The CLI maps each to an exit code and
 * an envelope kind; the MCP tool returns it as `error.code`.
 *
 * - `input.unsupported`: not a Design document (a compiled document of another tool, or no boxes).
 * - `input.unreadable`: the input or the source could not be parsed.
 * - `authoring.invalid`: an authoring key or macro the expansion refused, with its JSON pointer.
 * - `asset.invalid`: an asset argument with no key, an empty file or two files under one key.
 * - `asset.not-image`: a keyed file whose bytes are not a picture Design carries.
 * - `media.mismatch`: a key shaped `user/media/<sha256>` whose file has another hash.
 * - `media.missing`: an upload ref or a placeholder no file, folder or source resolves.
 * - `reference.unknown`: a catalog id the active profile does not hold.
 * - `path.invalid`: a path row whose `path` does not decode.
 * - `export.failed`: the written file did not read back as written.
 */
export const DESIGN_PACKAGE_ERROR_CODES = [
  'input.unsupported',
  'input.unreadable',
  'authoring.invalid',
  'asset.invalid',
  'asset.not-image',
  'media.mismatch',
  'media.missing',
  'reference.unknown',
  'path.invalid',
  'export.failed',
] as const;
export type DesignPackageErrorCodeV1 = (typeof DESIGN_PACKAGE_ERROR_CODES)[number];

/** Codes of the notes a report carries: things worth saying that did not stop the file. */
export const DESIGN_PACKAGE_WARNING_CODES = [
  'asset.unused',
  'media.missing',
  'reference.unknown',
  'reference.unchecked',
  'reference.external',
  'path.empty',
  'authoring.note',
  'design-system.not-carried',
] as const;
export type DesignPackageWarningCodeV1 = (typeof DESIGN_PACKAGE_WARNING_CODES)[number];

/** One picture the file carries, under its upload ref. */
export interface DesignPackageMediaV1 {
  /** `user/media/<sha256>`. */
  ref: string;
  /** Lower-case hex SHA-256 of the bytes. */
  sha256: string;
  mime: string;
  bytes: number;
  origin: DesignPackageMediaOriginV1;
  /** The keys rows named it by (`photo:title`, a path, the ref itself), in first-use order. */
  keys: string[];
  /** Ids of the layers that draw the picture. */
  layers: string[];
}

/** One picture reference the file holds without bytes. */
export interface DesignPackageMissingV1 {
  /** The reference, as the rows spell the reference. */
  ref: string;
  layers: string[];
}

/** How the picture references that are not uploads were classified. */
export interface DesignPackageReferencesV1 {
  /** The content profile the catalog ids were checked against, when one resolved. */
  profile?: string;
  /** Layers whose picture is a catalog id the profile holds. */
  catalog: number;
  /** Layers whose picture is a catalog id that could not be checked (no profile resolved). */
  unchecked: number;
  /** Layers whose picture is an http(s) or data: URL, left as written. */
  external: number;
  /** Catalog ids the profile does not hold. Present only under `allowMissingMedia`. */
  unknown: DesignPackageMissingV1[];
}

export interface DesignPackageWarningV1 {
  code: DesignPackageWarningCodeV1;
  message: string;
  /** A JSON pointer into the input, where there is one. */
  path?: string;
}

/** What the reader saw when the written file was opened again. */
export interface DesignPackageReadbackV1 {
  ok: true;
  /** Rows in the session's `boxes`. */
  layers: number;
  /** Carried pictures whose bytes hash to their ref. */
  media: number;
  label: string;
  filename: string;
}

export interface DesignPackageReportV1 {
  format: typeof DESIGN_PACKAGE_FORMAT;
  version: typeof DESIGN_PACKAGE_VERSION;
  /** Where the file was written, when a surface wrote it to disk. */
  output?: string;
  /** Size of the `.lolly` in bytes. */
  bytes: number;
  /** Lower-case hex SHA-256 of the `.lolly`. */
  sha256: string;
  /** The manifest's `exportedAt`, which also sets the zip entry times. */
  exportedAt: string;
  tool: { id: 'design'; version?: string };
  /** `__label`: the name Projects and the top bar show. */
  label: string;
  /** `__export_filename`: the export name the editor opens with. */
  filename: string;
  /** `__export_width`, `__export_height` and `__export_unit`, from the first frame. Null with no frame. */
  size: { width: number; height: number; unit: 'px' } | null;
  artboards: number;
  layers: number;
  /** True when the input carried authoring keys or macros that were expanded. */
  expanded: boolean;
  media: DesignPackageMediaV1[];
  references: DesignPackageReferencesV1;
  /** Upload refs and placeholders written without bytes. Present only under `allowMissingMedia`. */
  missingMedia: DesignPackageMissingV1[];
  /** Asset keys no row named; their files were not carried. */
  unusedAssets: string[];
  warnings: DesignPackageWarningV1[];
  readback: DesignPackageReadbackV1;
  /** What to run next, in words a caller can paste. */
  next: string[];
}

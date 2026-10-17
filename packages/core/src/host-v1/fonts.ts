// SPDX-License-Identifier: MPL-2.0

/**
 * Font files, read and subset on-device (v1.262). Optional/additive: a tool
 * feature-detects `host.fonts`. See the `fonts` field on HostV1.
 */

/**
 * What a font's own `OS/2.fsType` says about embedding. `unstated` means the
 * font has no OS/2 table, which is not the same as permission.
 */
export type FontEmbeddingV1 = 'installable' | 'restricted' | 'preview-print' | 'editable' | 'unstated';

/**
 * Why a font is not subset. `outlines`: only TrueType (`glyf`) outlines are
 * supported. The other four come from the font's own fsType statement.
 */
export type FontSubsetRefusalV1 = 'outlines' | 'restricted' | 'no-subsetting' | 'bitmap-only' | 'unstated';

/** One variation axis from `fvar`. */
export interface FontAxisV1 {
  tag: string;
  name: string;
  min: number;
  default: number;
  max: number;
  /** The font asks applications not to show this axis. */
  hidden: boolean;
}

/** One named instance from `fvar`, such as "Bold". */
export interface FontInstanceV1 {
  name: string;
  axes: Record<string, number>;
}

/** Mapped characters within one Unicode block. */
export interface FontBlockCoverageV1 {
  name: string;
  first: number;
  last: number;
  characters: number;
}

/** What a font file's own tables say, read without shaping or rendering. */
export interface FontInspectionV1 {
  /** The container the bytes arrived in. */
  container: 'ttf' | 'otf' | 'woff';
  /** Where the glyph outlines live. A container change never changes this. */
  outlines: 'truetype' | 'cff' | 'cff2' | 'bitmap' | 'none';
  family: string;
  style: string;
  fullName: string;
  version: string;
  postScriptName: string;
  glyphs: number;
  unitsPerEm: number;
  /** `OS/2.usWeightClass`; `min` and `max` follow a `wght` axis when there is one. */
  weight: { value: number; min: number; max: number };
  /** `OS/2.usWidthClass`, 1 to 9 (5 is normal). */
  width: number;
  italic: boolean;
  axes: FontAxisV1[];
  instances: FontInstanceV1[];
  /** Characters the cmap maps to a glyph, as inclusive code point ranges, with per-block counts. */
  coverage: { characters: number; ranges: Array<[number, number]>; blocks: FontBlockCoverageV1[] };
  /** The raw fsType is kept so a report can be audited rather than trusted. */
  embedding: { permission: FontEmbeddingV1; noSubsetting: boolean; bitmapOnly: boolean; fsType: number | null };
  /** Null when this host can subset the font and the font's own flags permit a subset. */
  subsetRefusal: FontSubsetRefusalV1 | null;
}

export interface FontSubsetRequestV1 {
  /** Every character to keep. Order and duplicates do not matter. */
  text: string;
}

/** What a subset kept, checked against the output bytes. */
export interface FontSubsetReportV1 {
  /** Distinct characters requested. */
  characters: number;
  /** Requested characters the output still maps to the same glyph. */
  kept: number;
  /** Requested characters the font has no glyph for (at most 64 listed). */
  missing: string[];
  inputBytes: number;
  outputBytes: number;
  /** The subsetter and its selection policy, for reproducibility. */
  policy: string;
  /** The output's fsType, which always equals the source's. */
  fsType: number | null;
}

export interface FontSubsetResultV1 {
  /** A TrueType sfnt. A WOFF source is unwrapped first; rewrap it with the container conversion. */
  bytes: Uint8Array;
  report: FontSubsetReportV1;
}

export interface FontsAPI {
  /**
   * Read names, outline format, weights, variation axes, named instances,
   * character coverage and embedding flags from a TTF, OTF or WOFF file.
   * Rejects WOFF2, collections and anything that is not a readable font.
   */
  inspect(bytes: Uint8Array): Promise<FontInspectionV1>;

  /**
   * Keep only the glyphs `request.text` needs, plus whatever those glyphs
   * depend on (composites and layout substitutions). Glyph ids are kept.
   * Rejects with an Error whose `code` is a {@link FontSubsetRefusalV1} when
   * the outlines are unsupported or the font's own fsType forbids subsetting;
   * those flags are honoured, never bypassed. The output is verified before it
   * is returned.
   */
  subset(bytes: Uint8Array, request: FontSubsetRequestV1): Promise<FontSubsetResultV1>;
}

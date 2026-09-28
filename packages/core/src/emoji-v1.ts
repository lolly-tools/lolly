// SPDX-License-Identifier: MPL-2.0
/** A lazy bundle includes source SVGs as well as its smaller manifest. */
export const EMOJI_BUNDLE_MAX_BYTES = 64 * 1024 * 1024;

/** Portable emoji pack and explicit artwork-selection records. No renderer or host defaults. */
import type { AssetRef } from './host-v1/asset-ref.ts';

export interface EmojiPackPinV1 {
  id: string;
  pin: { version: string };
  /** SHA-256 of the exact UTF-8 manifest bytes, including whitespace. */
  checksum: string;
}

export interface EmojiSourceV1 {
  creator: string;
  sourceUrl: string;
  revision: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  /** Changes to this source, including earlier changes supplied upstream. */
  modifications: string[];
}

export type EmojiMeaningV1 =
  | { kind: 'unicode'; key: string }
  | { kind: 'custom'; id: string };

export interface EmojiMetricsV1 {
  /** Coordinates use the SVG viewBox's units. Advance is independent of ink width. */
  unitsPerEm: number;
  advance: number;
  baseline: number;
}

export interface EmojiGlyphV1 {
  meaning: EmojiMeaningV1;
  label: string;
  /** Portable AssetRef fields; host cache metadata is not part of the pack. */
  asset: Pick<AssetRef, 'source' | 'id' | 'url'> & {
    type: 'vector';
    format: 'svg';
    pin: { version: string; format: 'svg' };
    checksum: string;
  };
  source: EmojiSourceV1;
  sourceChecksum: string;
  viewBox: [number, number, number, number];
  metrics?: EmojiMetricsV1;
}

export interface EmojiPackManifestV1 {
  schemaVersion: 1;
  minimumReader: 1;
  id: string;
  family: string;
  style: string;
  version: string;
  unicodeVersion: '17.0';
  /** Versioned admission policy, not a claim about arbitrary SVG safety. */
  artwork: 'source-svg-v1';
  metrics: EmojiMetricsV1;
  source: EmojiSourceV1;
  notices: { name: string; text: string }[];
  glyphs: EmojiGlyphV1[];
}

/** One approved brand colour, pinned by token id and its resolved sRGB value at selection time. */
export interface EmojiPaletteEntryV1 {
  id: string;
  /** Lowercase `#rrggbb`. */
  hex: string;
}

/** Which meaning-bearing artwork a treatment leaves untouched. Every flag defaults to true. */
export interface EmojiProtectionV1 {
  /** Sequences carrying a skin-tone modifier keep their original paints. */
  skinTones: boolean;
  /** Regional-indicator and tag flag sequences keep their original paints. */
  flags: boolean;
  /** Custom brand symbols keep their original paints. */
  custom: boolean;
}

/**
 * The brand treatment applied to every recoloured paint. `original` is the
 * upstream artwork. `influence` pulls each paint toward its nearest palette
 * colour by `strengthBps` (1 to 9999 basis points, OKLab interpolation).
 * `snap` replaces each paint with its nearest palette colour. `mono` keeps
 * each paint's lightness and takes the one palette colour's hue and chroma.
 * `duotone` ramps each paint's lightness between the dark and light palette
 * colours. `recipe` pins the arithmetic; a changed recipe is a new version.
 */
export type EmojiTreatmentV1 =
  | { mode: 'original'; strengthBps: 0 }
  | { mode: 'influence'; strengthBps: number; palette: EmojiPaletteEntryV1[]; protect?: EmojiProtectionV1; recipe: 'emoji-treatment-v1' }
  | { mode: 'snap'; strengthBps: 10000; palette: EmojiPaletteEntryV1[]; protect?: EmojiProtectionV1; recipe: 'emoji-treatment-v1' }
  | { mode: 'mono'; strengthBps: 10000; palette: [EmojiPaletteEntryV1]; protect?: EmojiProtectionV1; recipe: 'emoji-treatment-v1' }
  | { mode: 'duotone'; strengthBps: 10000; palette: [EmojiPaletteEntryV1, EmojiPaletteEntryV1]; protect?: EmojiProtectionV1; recipe: 'emoji-treatment-v1' };
export type EmojiTreatmentModeV1 = EmojiTreatmentV1['mode'];

export interface EmojiStyleV1 {
  schemaVersion: 1;
  primary: EmojiPackPinV1;
  /** Only an authored coverage gap permits trying the next pin, in this order. */
  fallbacks: EmojiPackPinV1[];
  metricsPolicy: 'inline-em-v1';
  /** Other recipes require a later supported contract; never ignore them. */
  treatment: EmojiTreatmentV1;
}

/**
 * A pack as one file: the exact manifest text (its sha256 is the pin checksum)
 * plus source SVG text keyed by the manifest's `asset.url`. Catalog bundles and
 * set installs contain every declared glyph. Portable documents may carry only
 * used artwork, retaining the exact manifest and its pin. Missing artwork in a
 * document subset is unavailable unless another source holds that exact pin.
 */
export interface EmojiPackBundleV1 {
  schemaVersion: 1;
  kind: 'emoji-pack-bundle';
  manifest: string;
  artwork: Record<string, string>;
}

/** What a host can say about a set before anything is loaded. */
export interface EmojiSetInfoV1 {
  pin: EmojiPackPinV1;
  family: string;
  style: string;
  /** Display name, e.g. "Twemoji Color (starter)". */
  label: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  glyphs: number;
  /** True only when the set covers the whole pinned Unicode repertoire. */
  coverageComplete: boolean;
  /** Bundle size when known, for the download prompt. */
  bytes?: number;
}

/**
 * A person's explicit choice for new, ungoverned work. The palette is not
 * stored here: a treatment resolves its colours from the brand in force when
 * it is applied, and the document then keeps the resolved palette.
 */
export interface EmojiPreferenceV1 {
  pin: EmojiPackPinV1;
  mode: EmojiTreatmentModeV1;
  /** Only read for `influence`. */
  strengthBps: number;
}

export type EmojiRequestV1 =
  | { kind: 'unicode'; text: string; presentation?: 'auto' | 'emoji' }
  | { kind: 'custom'; id: string; label: string };

export type EmojiIssueCodeV1 =
  | 'invalid-request' | 'unsupported-sequence' | 'selection-required' | 'invalid-style'
  | 'pack-unavailable' | 'integrity-mismatch' | 'invalid-pack' | 'unsupported-pack'
  | 'glyph-unavailable' | 'artwork-unavailable';

export interface EmojiIssueV1 {
  code: EmojiIssueCodeV1;
  message: string;
  packId?: string;
  assetId?: string;
}

export interface ResolvedEmojiGlyphV1 {
  request: EmojiRequestV1;
  meaning: EmojiMeaningV1;
  pack: EmojiPackPinV1;
  glyph: EmojiGlyphV1;
  metrics: EmojiMetricsV1;
  usedFallback: boolean;
}

export type EmojiResolutionV1 =
  | { status: 'text'; text: string }
  | { status: 'unresolved'; issue: EmojiIssueV1 }
  | { status: 'resolved'; value: ResolvedEmojiGlyphV1 };

/** Recorded source identity retained when emoji artwork becomes editable vectors. */
export interface EmojiSourceRecordV1 {
  pack: EmojiPackPinV1;
  family: string;
  style: string;
  meaning: EmojiMeaningV1;
  label: string;
  assetId: string;
  source: EmojiSourceV1;
  notices?: Array<{name:string;text:string}>;
  sourceChecksum: string;
  artworkChecksum: string;
  canonicalChecksum: string;
  normalizer: string;
  changes: string[];
  occurrences: Array<{start:number;end:number}>;
}

// SPDX-License-Identifier: MPL-2.0
/**
 * content-inventory-v1: what a source deck says, slide by slide, for an agent
 * that has to rebuild it (plan 291, W2). `lolly read`, the `lolly_read` MCP tool
 * and the fidelity family of `lolly check` speak this shape. Mirrored by
 * `schemas/content-inventory-v1.schema.json`, with a byte-identical copy under
 * `packages/core/schema/` for the SDK.
 *
 * It is a projection of the rebrand reader and census (`SourceDeckV1`,
 * `DeckCensusV1` in `rebrand-v1.ts`), not a second reader: text frames in reading
 * order with their role and runs, speaker notes with paragraphs and line breaks
 * kept apart, pictures with a content hash, tables and charts as data, and the
 * census class per object so decoration can be told from content.
 *
 * Units: `source.width` and `source.height` are reference px (96 dpi), as the
 * rebrand source deck uses. Every `box` is a fraction of the slide, so 0 to 1 for
 * an object on the slide; an object that sits partly off the slide reads outside
 * that range rather than being clipped. Run `size` is in points.
 *
 * Types and constants only: no runtime, no DOM, no I/O.
 */

/** The `version` discriminator. */
export const CONTENT_INVENTORY_VERSION = 'lolly/content-inventory-v1' as const;

/** The source formats the reader can inventory. */
export const INVENTORY_SOURCE_KINDS = ['pptx', 'pdf', 'psd'] as const;
export type InventorySourceKindV1 = (typeof INVENTORY_SOURCE_KINDS)[number];

/** A text frame's role, from the census. `other` when the census has no role for the frame. */
export const INVENTORY_TEXT_ROLES = ['title', 'subtitle', 'body', 'label', 'caption', 'page-number', 'footer', 'other'] as const;
export type InventoryTextRoleV1 = (typeof INVENTORY_TEXT_ROLES)[number];

/** What a picture is for. `picture` when nothing more specific is known. */
export const INVENTORY_PICTURE_KINDS = ['photo', 'icon', 'logo', 'background', 'picture'] as const;
export type InventoryPictureKindV1 = (typeof INVENTORY_PICTURE_KINDS)[number];

/** Paragraph alignment, as resolved by the source reader. */
export const INVENTORY_ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;
export type InventoryAlignV1 = (typeof INVENTORY_ALIGNMENTS)[number];

/** A rectangle in fractions of the slide. */
export interface InventoryBoxV1 { x: number; y: number; width: number; height: number }

export interface InventoryRunV1 {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Resolved `#rrggbb`. A colour the reader could not resolve is left out. */
  color?: string;
  font?: string;
  /** CSS weight, 1 to 1000. */
  weight?: number;
  /** Points. */
  size?: number;
}

export interface InventoryParagraphV1 {
  /** Outline level, 0-based. */
  lvl?: number;
  /** `true` for a bulleted paragraph, `'number'` for a numbered one, absent or `false` for none. */
  bullet?: boolean | 'number';
  align?: InventoryAlignV1;
  /** A line break inside the paragraph (pptx `a:br`) is a `\n` inside a run's text. */
  runs: InventoryRunV1[];
}

export interface InventoryTextV1 {
  /** The source object id (`SourceObjectV1.id`). */
  objectId: string;
  role: InventoryTextRoleV1;
  /** The census class (`OBJECT_CLASSES` in `rebrand-v1.ts`). */
  class: string;
  /** Position in the slide's reading order, 0-based, when the census settled one. */
  readingIndex?: number;
  box: InventoryBoxV1;
  paragraphs: InventoryParagraphV1[];
  /** Normalised text, `\n` between lines and between paragraphs. */
  plain: string;
  /**
   * The page does not show this text: a PDF's invisible text, as a scanned page's
   * OCR layer is. Other hidden objects are left out of `text` and listed only under
   * `objects`.
   */
  hidden?: boolean;
}

/** Speaker notes: paragraphs and the line breaks inside each kept apart. */
export interface InventoryNotesV1 {
  /**
   * The whole text in the form a Design artboard's `notes` take: a blank line between
   * paragraphs, `\n` for a line break inside one, and a line of one no-break space
   * (U+00A0) for an empty line inside one. `paragraphs` is the exact form.
   */
  text: string;
  paragraphs: Array<{ lines: string[] }>;
}

/** Source-image crop as fractions of each edge (pptx `a:srcRect`); negative pads. */
export interface InventoryCropV1 { l?: number; t?: number; r?: number; b?: number }

export interface InventoryPictureV1 {
  objectId: string;
  /** The media entry this picture draws (`media[].ref`). */
  ref: string;
  /** Lower-case hex SHA-256 of the picture bytes. */
  sha256: string;
  mime: string;
  bytes: number;
  /** Pixel size of the image bytes, when the reader could decode the image. */
  width?: number;
  height?: number;
  box: InventoryBoxV1;
  crop?: InventoryCropV1;
  kind: InventoryPictureKindV1;
  /** The census class. */
  class: string;
  alt?: string;
  /** Path written under `--media`, `<sha256>.<ext>`, when the bytes were written. */
  file?: string;
  /**
   * The raster the source carries beside a drawing (`media[].ref`), for a reader
   * that cannot use the SVG this picture reports.
   */
  fallbackRef?: string;
}

export interface InventoryTableV1 { objectId: string; rows: string[][] }

export interface InventoryChartV1 {
  objectId: string;
  type?: string;
  categories?: string[];
  series?: Array<{ name?: string; values: number[] }>;
}

/** Every source object with its kind and census class, decoration included. */
export interface InventoryObjectV1 {
  id: string;
  /** The source object kind (`SOURCE_OBJECT_KINDS` in `rebrand-v1.ts`). */
  kind: string;
  /** The census class. */
  class: string;
  /** The source does not show this object (a layer switched off, invisible text). */
  hidden?: boolean;
}

/** A rendered picture of one slide, written under `--media` when thumbnails were asked for. */
export interface InventoryThumbnailV1 {
  file: string;
  /** Pixel size of the PNG. */
  width: number;
  height: number;
}

export interface InventorySlideV1 {
  /** 1-based, in source order. */
  number: number;
  id: string;
  layoutName?: string;
  text: InventoryTextV1[];
  /** `null` when the slide has no speaker notes. */
  notes: InventoryNotesV1 | null;
  pictures: InventoryPictureV1[];
  tables: InventoryTableV1[];
  charts: InventoryChartV1[];
  objects: InventoryObjectV1[];
  /** The slide drawn as a PNG, when the host rendered thumbnails. */
  thumbnail?: InventoryThumbnailV1;
}

/** One distinct media file, keyed by content hash. */
export interface InventoryMediaV1 {
  ref: string;
  sha256: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  file?: string;
}

export interface InventorySourceV1 {
  name: string;
  /** Lower-case hex SHA-256 of the source file. */
  sha256: string;
  bytes: number;
  kind: InventorySourceKindV1;
  slides: number;
  /** Slide size in reference px (96 dpi). */
  width: number;
  height: number;
  title?: string;
}

export interface ContentInventoryV1 {
  version: typeof CONTENT_INVENTORY_VERSION;
  source: InventorySourceV1;
  slides: InventorySlideV1[];
  media: InventoryMediaV1[];
  warnings: Array<{ code: string; message: string }>;
}

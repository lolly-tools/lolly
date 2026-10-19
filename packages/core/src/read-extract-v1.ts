// SPDX-License-Identifier: MPL-2.0
/**
 * read-extract-v1: the words, tables and pictures of a file as one list of blocks
 * in reading order, bounded by a page range and a character budget (plan 203,
 * rank 10). The Read and extract view, `lolly read --extract` and the engine's
 * `readExtract` speak this shape. Mirrored by `schemas/read-extract-v1.schema.json`,
 * with a byte-identical copy under `packages/core/schema/` for the SDK.
 *
 * It is a projection of a content inventory (`content-inventory-v1.ts`), not a
 * second reader: every block records the page and the source object it came from,
 * so a summary or a proposed edit can be checked against the file. Text the file
 * states is kept apart from text read from pixels: `origin` says which, and a
 * recognised block carries the recogniser's model and confidence. The source's
 * own wording is kept; nothing here rewrites the words.
 *
 * Reading a file never runs what it carries. Macros, scripts and embedded
 * programs stay where they are, and a warning says when the file holds any.
 *
 * Types and constants only: no runtime, no DOM, no I/O.
 */

import type {
  CONTENT_INVENTORY_VERSION,
  InventoryBoxV1,
  InventoryPictureKindV1,
  InventoryRecognitionV1,
  InventorySourceKindV1,
  InventoryTextRoleV1,
} from './content-inventory-v1.ts';

/** The `version` discriminator. */
export const READ_EXTRACT_VERSION = 'lolly/read-extract-v1' as const;

/** What a block holds. */
export const EXTRACT_BLOCK_KINDS = ['text', 'table', 'chart', 'picture', 'notes'] as const;
export type ExtractBlockKindV1 = (typeof EXTRACT_BLOCK_KINDS)[number];

/**
 * Where a block's words came from: `authored` is text the file states as text,
 * `text-layer` is the invisible text a scan carries (another program's reading,
 * kept as the document holds it), and `recognized` is text recognition run here
 * over a page that is a picture of its text.
 */
export const EXTRACT_ORIGINS = ['authored', 'text-layer', 'recognized'] as const;
export type ExtractOriginV1 = (typeof EXTRACT_ORIGINS)[number];

/** How the words of a page that is one picture of its text were read. */
export const EXTRACT_PAGE_READS = ['text-layer', 'recognized', 'not-read'] as const;
export type ExtractPageReadV1 = (typeof EXTRACT_PAGE_READS)[number];

/** The file the blocks came from: its name and the exact version, by hash. */
export interface ExtractSourceV1 {
  name: string;
  /** Lower-case hex SHA-256 of the source file. */
  sha256: string;
  bytes: number;
  kind: InventorySourceKindV1;
  /** Pages, slides or layers the file holds. */
  pages: number;
  title?: string;
}

/** What was asked for, after defaults: a caller repeats it to continue from `next`. */
export interface ExtractRequestV1 {
  /** The pages read, 1-based, ascending. Every page when the caller named none. */
  pages: number[];
  /** The block kinds asked for, in `EXTRACT_BLOCK_KINDS` order. */
  kinds: ExtractBlockKindV1[];
  /** The budget: characters of block text, not bytes of JSON. Absent for no budget. */
  maxChars?: number;
  /** Recognised text under this confidence was left out. */
  minConfidence?: number;
  /** The id of the first block returned, when the caller continued from an earlier `next`. */
  from?: string;
}

export interface ExtractPageV1 {
  /** 1-based, in source order. */
  number: number;
  /** The page is one picture of its text, as a scan is. */
  scanned?: boolean;
  /** On a scanned page: how its words were read. */
  read?: ExtractPageReadV1;
  /** Blocks this extract returned for the page. */
  blocks: number;
}

/** A picture's facts, enough to fetch or cite it without its bytes. */
export interface ExtractPictureV1 {
  /** The media entry it draws (`ContentInventoryV1.media[].ref`). */
  ref: string;
  /** Lower-case hex SHA-256 of the picture bytes. */
  sha256: string;
  mime: string;
  width?: number;
  height?: number;
  kind: InventoryPictureKindV1;
  /** Path the host wrote the bytes to, when it wrote them. */
  file?: string;
}

/** A chart as data, as the source file holds the chart. */
export interface ExtractChartV1 {
  type?: string;
  categories?: string[];
  series?: Array<{ name?: string; values: number[] }>;
}

export interface ExtractBlockV1 {
  /**
   * `p<page>.<order>`: stable for the same file, the same inventory reader and
   * the same `kinds`, so a caller can pass it back as `from`.
   */
  id: string;
  page: number;
  /** 0-based position on its page: text in reading order, then tables, charts, pictures, notes. */
  order: number;
  kind: ExtractBlockKindV1;
  /**
   * The block as plain text: a text frame's words, a table as tab-separated rows,
   * a chart as its title line and series, a picture's alternative text (empty when
   * it has none), the speaker notes.
   */
  text: string;
  /** For `text` and `notes`. */
  origin?: ExtractOriginV1;
  /** For `text`: the frame's role on its page. */
  role?: InventoryTextRoleV1;
  /** The source object the block came from (`InventoryTextV1.objectId` and its siblings). */
  objectId?: string;
  /** The block's box, in fractions of its page, when the reader knows the box. */
  box?: InventoryBoxV1;
  /** For recognised and text-layer blocks: the model and how sure it was. */
  recognition?: InventoryRecognitionV1;
  /** For `table`: the cells as the source holds them. */
  rows?: string[][];
  /** For `chart`. */
  chart?: ExtractChartV1;
  /** For `picture`. */
  picture?: ExtractPictureV1;
  /**
   * The budget cut this block's text short: it alone is longer than the budget.
   * Only its start is here, and continuing goes on from the next block.
   */
  partial?: boolean;
}

export interface ReadExtractV1 {
  version: typeof READ_EXTRACT_VERSION;
  /** The inventory contract the blocks were projected from. */
  inventory: typeof CONTENT_INVENTORY_VERSION;
  source: ExtractSourceV1;
  request: ExtractRequestV1;
  /** The pages read, in order. */
  pages: ExtractPageV1[];
  blocks: ExtractBlockV1[];
  /** Characters of block text returned. */
  chars: number;
  /** False when the budget stopped the extract before every requested block, or cut one short. */
  complete: boolean;
  /**
   * The id of the first block left out, to pass back as `from`. Absent when nothing
   * is left, which with `complete` false means only the last block was cut short.
   */
  next?: string;
  warnings: Array<{ code: string; message: string }>;
}

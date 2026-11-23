// SPDX-License-Identifier: MPL-2.0
/** One reason a page was not drawn, with its stable code (`refusalCodes()`). */
export interface Refusal {
  code: string;
  /** The operation's row id, or empty for the page. */
  id: string;
  detail: string;
}

/** What a render gives back. `ok` decides which fields are set. */
export interface RenderResult {
  ok: boolean;
  /** The PNG, from `renderPng`. */
  png?: Buffer;
  /** Straight RGBA8 rows, from `renderRgba`; the size is also set by `admit`. */
  rgba?: Buffer;
  width?: number;
  height?: number;
  /** The first reason's code and sentence when `ok` is false. */
  code?: string;
  detail?: string;
  /** Every reason, in order, when `ok` is false. */
  refusals: Refusal[];
}

/** The lolly-render envelope: JSON text, or its UTF-8 bytes. */
export type Envelope = string | Buffer;

/** Read and check a page without drawing it: the pixel size it would draw at, or the refusals. */
export function admit(envelope: Envelope): RenderResult;
/** Draw a page as a PNG, on the calling thread. */
export function renderPng(envelope: Envelope): RenderResult;
/** Draw a page as straight RGBA8 with its size, on the calling thread. */
export function renderRgba(envelope: Envelope): RenderResult;
/** `renderPng` on the libuv thread pool. */
export function renderPngAsync(envelope: Envelope): Promise<RenderResult>;
/** `renderRgba` on the libuv thread pool. */
export function renderRgbaAsync(envelope: Envelope): Promise<RenderResult>;
/** Encode straight RGBA8 rows as a PNG with the crate's encoder, with no resolution chunk. */
export function encodePng(rgba: Buffer, width: number, height: number): RenderResult;
/** `encodePng` on the libuv thread pool. */
export function encodePngAsync(rgba: Buffer, width: number, height: number): Promise<RenderResult>;
/** The renderer this build records, such as `lolly-render-0.1.0+tiny-skia-0.12.0-scalar`. */
export function renderer(): string;
/** Every stable refusal code, in order: the crate's, then `internal`. */
export function refusalCodes(): string[];

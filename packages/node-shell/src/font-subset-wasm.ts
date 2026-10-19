// SPDX-License-Identifier: MPL-2.0
/** Byte-only runtime shared by the browser worker and Node verification. */
import { FONT_SUBSET_REFUSALS, fontSubsetRefusal } from '../../../engine/src/font-subset-policy.ts';
export interface SkeraWasm {
  memory: WebAssembly.Memory;
  lolly_subset_alloc(size: number): number;
  lolly_subset_free(pointer: number, size: number): void;
  lolly_subset_font(pointer: number, size: number, glyphPointer: number, count: number): bigint;
}

/** Validate the runtime ABI before calling the compiled subsetter. */
export function isSkeraWasm(value: unknown): value is SkeraWasm {
  if (!value || typeof value !== 'object') return false;
  const api = value as Partial<SkeraWasm>;
  return api.memory instanceof WebAssembly.Memory
    && typeof api.lolly_subset_alloc === 'function'
    && typeof api.lolly_subset_free === 'function'
    && typeof api.lolly_subset_font === 'function';
}

export const SKERA_POLICY = 'skera-0.7.0/retain-gids/notdef/all-layout/all-names/v1';
export const MAX_FONT_BYTES = 32 * 1024 * 1024;

/**
 * Subset `font` to `glyphs` (plus .notdef), keeping glyph ids. A readable sfnt
 * whose outlines are not TrueType, or whose own fsType forbids subsetting, is
 * refused here before any allocation, whoever the caller is: this pinned Skera
 * drops CFF tables it does not subset, and the font's flags are honoured, never
 * bypassed. Bytes that are not an sfnt at all fall through to Skera, which
 * rejects them.
 */
export function subsetWithSkera(wasm: SkeraWasm, font: Uint8Array, glyphs: readonly number[]): Uint8Array {
  if (!font.length || font.length > MAX_FONT_BYTES || glyphs.length > 65536 || glyphs.some(id => !Number.isInteger(id) || id < 0 || id > 65535)) {
    throw new RangeError('Font subset input exceeds supported limits');
  }
  const refusal = fontSubsetRefusal(font);
  if (refusal && refusal !== 'unreadable') throw Object.assign(new Error(FONT_SUBSET_REFUSALS[refusal]), { code: refusal });
  const ids = [...new Set([0, ...glyphs])].sort((a, b) => a - b);
  const input = wasm.lolly_subset_alloc(font.length), gids = wasm.lolly_subset_alloc(ids.length * 4);
  let output = 0, outputLength = 0;
  try {
    if (!input || !gids) throw new Error('Font subset allocation failed');
    new Uint8Array(wasm.memory.buffer, input, font.length).set(font);
    const view = new DataView(wasm.memory.buffer, gids, ids.length * 4);
    ids.forEach((id, i) => { view.setUint32(i * 4, id, true); });
    const result = wasm.lolly_subset_font(input, font.length, gids, ids.length);
    output = Number(result >> 32n); outputLength = Number(result & 0xffffffffn);
    if (!output || !outputLength || outputLength > MAX_FONT_BYTES) throw new Error('Skera could not subset this font');
    return new Uint8Array(wasm.memory.buffer, output, outputLength).slice();
  } finally {
    if (output) wasm.lolly_subset_free(output, outputLength);
    if (gids) wasm.lolly_subset_free(gids, ids.length * 4);
    if (input) wasm.lolly_subset_free(input, font.length);
  }
}

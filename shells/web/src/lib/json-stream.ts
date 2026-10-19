// SPDX-License-Identifier: MPL-2.0
/**
 * JSON written a piece at a time, byte for byte what `JSON.stringify` gives.
 *
 * A backup's history file can reach hundreds of megabytes. Stringifying it whole
 * holds the text and then its UTF-8 copy at once. `writeJson` walks the outer
 * levels of the value itself, stringifies each element on its own and hands out
 * UTF-8 chunks of about a mebibyte, so the largest thing held is one element.
 *
 * The output is the same text `JSON.stringify(value, null, space)` produces, which
 * keeps every digest and integrity record of an archive part unchanged. Two
 * details make that hold. A level is walked only for plain arrays and objects
 * without `toJSON`; anything else is stringified whole. And chunks only break
 * between whole pieces of stringify output, which is always well-formed UTF-16, so
 * no surrogate pair is ever split.
 */

/** About how much text one chunk carries before it is encoded and handed out. */
export const JSON_CHUNK_CHARS = 1024 * 1024;

type Emit = (chunk: Uint8Array) => void | Promise<void>;

class TextChunks {
  #pieces: string[] = [];
  #chars = 0;
  readonly #emit: Emit;
  readonly #encoder = new TextEncoder();
  constructor(emit: Emit) { this.#emit = emit; }
  async push(text: string): Promise<void> {
    this.#pieces.push(text);
    this.#chars += text.length;
    if (this.#chars >= JSON_CHUNK_CHARS) await this.flush();
  }
  async flush(): Promise<void> {
    if (!this.#pieces.length) return;
    const text = this.#pieces.join('');
    this.#pieces = []; this.#chars = 0;
    await this.#emit(this.#encoder.encode(text));
  }
}

function walkable(value: unknown): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === 'object' && typeof (value as { toJSON?: unknown }).toJSON !== 'function'
    && !(value instanceof Number || value instanceof String || value instanceof Boolean);
}

/** One value as stringify writes it at this indent; undefined where stringify leaves it out. */
function leaf(value: unknown, gap: string, indent: string): string | undefined {
  const text = JSON.stringify(value, null, gap);
  return text !== undefined && gap && indent ? text.replaceAll('\n', `\n${indent}`) : text;
}

/**
 * Write `value` as JSON through `emit`, walking `depth` levels of plain arrays and
 * objects and stringifying what lies below whole. `space` is 0 (compact) or the
 * indent width `JSON.stringify` would be given.
 */
export async function writeJson(value: unknown, emit: Emit, options: { space?: number; depth?: number } = {}): Promise<void> {
  const gap = ' '.repeat(Math.min(10, Math.max(0, options.space ?? 0)));
  const out = new TextChunks(emit);
  const walk = async (v: unknown, indent: string, depth: number): Promise<void> => {
    if (depth <= 0 || !walkable(v)) { await out.push(leaf(v, gap, indent) ?? 'null'); return; }
    const inner = indent + gap;
    const open = (first: boolean, bracket: string): string => first ? (gap ? `${bracket}\n${inner}` : bracket) : (gap ? `,\n${inner}` : ',');
    if (Array.isArray(v)) {
      if (!v.length) { await out.push('[]'); return; }
      for (let i = 0; i < v.length; i++) {
        await out.push(open(i === 0, '['));
        await walk(v[i], inner, depth - 1);
      }
      await out.push(gap ? `\n${indent}]` : ']');
      return;
    }
    let first = true;
    for (const key of Object.keys(v)) {
      const item = v[key];
      // Stringify drops a property whose value it cannot write (undefined, a function,
      // a symbol), so that is settled before the separator goes out.
      const text = depth > 1 && walkable(item) ? null : leaf(item, gap, inner);
      if (text === undefined) continue;
      await out.push(open(first, '{') + JSON.stringify(key) + (gap ? ': ' : ':'));
      first = false;
      if (text === null) await walk(item, inner, depth - 1); else await out.push(text);
    }
    await out.push(first ? '{}' : gap ? `\n${indent}}` : '}');
  };
  await walk(value, '', options.depth ?? 1);
  await out.flush();
}

/**
 * A JSON array written one element at a time, for when the elements are produced
 * one by one (read, written, then dropped). The text is what
 * `JSON.stringify(elements, null, space)` would give for the same elements.
 */
export function jsonArrayWriter(emit: Emit, space = 0): { item(value: unknown): Promise<void>; end(): Promise<void> } {
  const gap = ' '.repeat(Math.min(10, Math.max(0, space)));
  const out = new TextChunks(emit);
  let count = 0;
  return {
    async item(value) {
      await out.push(count++ === 0 ? (gap ? `[\n${gap}` : '[') : (gap ? `,\n${gap}` : ','));
      await out.push(leaf(value, gap, gap) ?? 'null');
    },
    async end() {
      await out.push(count === 0 ? '[]' : gap ? '\n]' : ']');
      await out.flush();
    },
  };
}

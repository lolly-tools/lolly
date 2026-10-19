// SPDX-License-Identifier: MPL-2.0
/**
 * JSON written in chunks (shells/web/src/lib/json-stream.ts) is the exact text
 * JSON.stringify gives, which is what keeps a streamed backup's parts and their
 * integrity digests unchanged.
 *
 * Run with: node --test tests/json-stream.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSON_CHUNK_CHARS, jsonArrayWriter, writeJson } from '../shells/web/src/lib/json-stream.ts';

async function written(value: unknown, space: number, depth: number): Promise<{ text: string; chunks: number }> {
  const parts: Uint8Array[] = [];
  await writeJson(value, chunk => { parts.push(chunk); }, { space, depth });
  return { text: new TextDecoder().decode(Buffer.concat(parts)), chunks: parts.length };
}

// A small seeded generator: nested arrays and objects with the awkward values
// stringify treats specially (undefined, functions, symbols, Dates, -0, NaN,
// lone surrogates, astral characters, numeric-looking keys).
function generator(seed: number): (depth: number) => unknown {
  let x = seed;
  const r = (): number => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x / 2 ** 32; };
  const leaves = [1, -0, 3.5, 'a\nb', 'é ☕ \u{1F600}', '\ud800', null, true, undefined, () => 1, Symbol('s'), new Date(0), Number.NaN, Number.POSITIVE_INFINITY, '', new String('boxed'), [], {}];
  const keys = ['a', 'b c', '"q"', '1', 'é', '__proto_'];
  const gen = (depth: number): unknown => {
    const k = r();
    if (depth <= 0 || k < 0.3) return leaves[Math.floor(r() * leaves.length)];
    if (k < 0.65) return Array.from({ length: Math.floor(r() * 4) }, () => gen(depth - 1));
    const o: Record<string, unknown> = {};
    for (let i = Math.floor(r() * 4); i > 0; i--) o[keys[Math.floor(r() * keys.length)]! + i] = gen(depth - 1);
    return o;
  };
  return gen;
}

test('writeJson equals JSON.stringify for compact and indented output at every walk depth', async () => {
  const gen = generator(7);
  for (let i = 0; i < 1500; i++) {
    const value = gen(4);
    for (const space of [0, 2]) for (const depth of [0, 1, 2, 3, 6]) {
      assert.equal((await written(value, space, depth)).text, JSON.stringify(value, null, space) ?? 'null', `case ${i} space ${space} depth ${depth}`);
    }
  }
});

test('jsonArrayWriter equals JSON.stringify of the same elements', async () => {
  const gen = generator(11);
  for (let i = 0; i < 800; i++) {
    const items = Array.from({ length: i % 5 }, () => gen(3));
    for (const space of [0, 2]) {
      const parts: Uint8Array[] = [];
      const out = jsonArrayWriter(chunk => { parts.push(chunk); }, space);
      for (const item of items) await out.item(item);
      await out.end();
      assert.equal(new TextDecoder().decode(Buffer.concat(parts)), JSON.stringify(items, null, space), `case ${i} space ${space}`);
    }
  }
});

test('a large value comes out in many chunks that decode to the same UTF-8, with no pair split', async () => {
  // Each element carries an astral character, so a chunk boundary inside a pair
  // would show up as replacement characters in the decoded text.
  const archive = { version: 1, documents: [], revisions: Array.from({ length: 3000 }, (_, i) => ({ id: `rev-${i}`, text: `\u{1F600} ${'x'.repeat(i % 900)} \u{1F680}` })), recoveries: [] };
  const parts: Uint8Array[] = [];
  await writeJson(archive, chunk => { parts.push(chunk); }, { depth: 2 });
  const expected = new TextEncoder().encode(JSON.stringify(archive));
  assert.ok(parts.length > 1, 'more than one chunk');
  assert.ok(parts.every(p => p.length <= JSON_CHUNK_CHARS * 3 + 4096), 'each chunk is about a mebibyte of text');
  assert.deepEqual(Buffer.concat(parts), Buffer.from(expected));
  assert.ok(parts.every(p => !new TextDecoder().decode(p).includes('�')), 'every chunk is whole UTF-8 on its own');
});

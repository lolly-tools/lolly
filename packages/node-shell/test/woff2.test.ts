// SPDX-License-Identifier: MPL-2.0
/**
 * WOFF2 decoding (src/woff2.ts and the Rust decoder module, wasm/woff2-kernel): every public
 * WOFF2 font in the tree decodes to the bytes the original C++ decoder returned, a
 * collection decodes to what that decoder returns for it, malformed or oversized files
 * are refused before the decoder runs, and the module itself refuses what it would not
 * hold without growing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { brotliCompressSync, constants as zlib } from 'node:zlib';
import { checkSfntOutput, decodeWoff2, preflightWoff2, Woff2Error, WOFF2_LIMITS, woff2Slots, type Woff2Runner } from '../src/woff2.ts';
import { nodeWoff2Runner, useNodeWoff2Runner } from '../src/woff2-node.ts';
import { compileWoff2Kernel, decodeWithWoff2Kernel } from '../src/woff2-kernel.ts';

useNodeWoff2Runner();

const ROOT = new URL('../../../', import.meta.url);
const read = (path: string): Uint8Array => new Uint8Array(readFileSync(new URL(path, ROOT)));
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const corpus = JSON.parse(readFileSync(new URL('./fixtures/woff2-corpus.json', import.meta.url), 'utf8')) as { fonts: Record<string, { bytes: number; sha256: string }> };
const SMALL = 'shells/web/public/fonts/Outfit-latin-ext[wght].woff2';
const kernel = compileWoff2Kernel(read('packages/node-shell/wasm/woff2-kernel/woff2-kernel.wasm'));
/** The decoder module in this thread, a fresh instance per call, for tests that decode many times. */
const inThread: Woff2Runner = async (input) => decodeWithWoff2Kernel(await kernel, input);

function refusedWith(code: string): (error: unknown) => boolean {
  return (error) => error instanceof Woff2Error && error.code === code;
}

/** A WOFF2 file from parts, for header and directory cases. Table data is whatever `data` holds. */
function woff2Of(opts: {
  flavor?: number;
  tables: Array<{ index: number; length: number; transformLength?: number; version?: number }>;
  data?: Uint8Array;
  collection?: Uint8Array;
  priv?: number;
  lengthField?: number;
  trailing?: number;
  /** Compress with Brotli's large-window extension, which RFC 7932 streams do not use. */
  largeWindow?: boolean;
}): Uint8Array {
  const dir: number[] = [];
  const base128 = (value: number): number[] => {
    const out = [value & 0x7f];
    for (value = Math.floor(value / 128); value > 0; value = Math.floor(value / 128)) out.unshift((value & 0x7f) | 0x80);
    return out;
  };
  for (const t of opts.tables) {
    dir.push(((t.version ?? 0) << 6) | t.index, ...base128(t.length));
    if (t.transformLength !== undefined) dir.push(...base128(t.transformLength));
  }
  const compressed = brotliCompressSync(opts.data ?? new Uint8Array(opts.tables.reduce((n, t) => n + (t.transformLength ?? t.length), 0)),
    opts.largeWindow ? { params: { [zlib.BROTLI_PARAM_LARGE_WINDOW]: 1 } } : {});
  const collection = opts.collection ?? new Uint8Array(0);
  const compressedOffset = 48 + dir.length + collection.length;
  const privOffset = (compressedOffset + compressed.length + 3) & ~3;
  const size = (opts.priv ? privOffset + opts.priv : privOffset) + (opts.trailing ?? 0);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x774f4632);
  view.setUint32(4, opts.flavor ?? 0x00010000);
  view.setUint32(8, opts.lengthField ?? size);
  view.setUint16(12, opts.tables.length);
  // totalSfntSize: the sfnt header, the table records and each table padded to four bytes.
  // google/woff2 ignored the field; wuff refuses zero, which no real font declares.
  view.setUint32(16, Math.min(0xffffffff, opts.tables.reduce((n, t) => n + ((t.length + 3) & ~3), 12 + 16 * opts.tables.length)));
  view.setUint32(20, compressed.length);
  if (opts.priv) { view.setUint32(40, privOffset); view.setUint32(44, opts.priv); }
  out.set(dir, 48);
  out.set(collection, 48 + dir.length);
  out.set(compressed, compressedOffset);
  return out;
}

/** Two sfnt fonts as one TrueType collection, each table copied (no sharing). */
function collectionOf(fonts: Uint8Array[]): Uint8Array {
  const headers = fonts.map((font) => 12 + 16 * new DataView(font.buffer, font.byteOffset).getUint16(4));
  let offset = 12 + 4 * fonts.length + headers.reduce((a, b) => a + b, 0);
  const parts: Array<{ at: number; bytes: Uint8Array }> = [];
  const directories: Uint8Array[] = [];
  for (const font of fonts) {
    const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
    const count = view.getUint16(4);
    const directory = new Uint8Array(font.subarray(0, 12 + 16 * count));
    const dv = new DataView(directory.buffer);
    for (let i = 0; i < count; i++) {
      const record = 12 + 16 * i;
      const from = view.getUint32(record + 8), length = view.getUint32(record + 12);
      offset = (offset + 3) & ~3;
      dv.setUint32(record + 8, offset);
      parts.push({ at: offset, bytes: font.subarray(from, from + length) });
      offset += length;
    }
    directories.push(directory);
  }
  const result = new Uint8Array((offset + 3) & ~3);
  const view = new DataView(result.buffer);
  view.setUint32(0, 0x74746366); view.setUint32(4, 0x00010000); view.setUint32(8, fonts.length);
  let at = 12 + 4 * fonts.length;
  directories.forEach((directory, i) => { view.setUint32(12 + 4 * i, at); result.set(directory, at); at += directory.length; });
  for (const part of parts) result.set(part.bytes, part.at);
  return result;
}

test('every public WOFF2 font decodes to the bytes the original C++ decoder returned', async () => {
  const entries = Object.entries(corpus.fonts);
  assert.equal(entries.length, 23);
  for (const [path, expected] of entries) {
    const out = await decodeWoff2(read(path));
    assert.equal(out.length, expected.bytes, path);
    assert.equal(sha256(out), expected.sha256, path);
  }
});

test('the guard hands back exactly what the decoder module returns', async () => {
  const bytes = read(SMALL);
  assert.deepEqual(await decodeWoff2(bytes), await inThread(bytes, { timeoutMs: 20_000 }));
});

test('a WOFF2 collection decodes to what the original C++ decoder returns for it', async () => {
  // woff2-encoder (a dev dependency) is the reference here: it compresses the collection
  // and decodes it once, on bytes this test made.
  const { compress, decompress } = await import('woff2-encoder');
  const ttc = collectionOf([read('shells/web/public/fonts/SUSEMono[wght].ttf'), read('shells/web/public/fonts/Outfit[wght].ttf')]);
  const woff2 = await compress(ttc);
  const facts = preflightWoff2(woff2);
  assert.equal(facts.collection, true);
  assert.equal(facts.fonts, 2);
  const out = await decodeWoff2(woff2);
  assert.deepEqual(out, new Uint8Array(await decompress(woff2)));
  assert.equal(new DataView(out.buffer, out.byteOffset).getUint32(0), 0x74746366);
});

test('preflight reads the real header without decompressing', () => {
  const bytes = read(SMALL);
  const facts = preflightWoff2(bytes);
  assert.equal(facts.flavor, 0x00010000);
  assert.equal(facts.collection, false);
  assert.equal(facts.totalSfntSize, corpus.fonts[SMALL]!.bytes);
  assert.ok(facts.uncompressedSize > 0 && facts.uncompressedSize <= facts.totalSfntSize);
  assert.equal(facts.compressedOffset + facts.compressedLength <= bytes.length, true);
});

test('files that are not WOFF2, or are too large to read, are refused by name', () => {
  assert.throws(() => preflightWoff2(read('shells/web/public/fonts/Outfit[wght].ttf')), refusedWith('not-woff2'));
  const big = new Uint8Array(WOFF2_LIMITS.maxInputBytes + 4);
  big.set([0x77, 0x4f, 0x46, 0x32]);
  assert.throws(() => preflightWoff2(big), refusedWith('too-large'));
});

test('a damaged header or directory is refused before the decoder runs', () => {
  const head = { index: 1, length: 54 };
  const cases: Array<[reason: string, bytes: Uint8Array]> = [
    ['header is incomplete', read(SMALL).subarray(0, 40)],
    ['length field does not match', woff2Of({ tables: [head], lengthField: 999 })],
    ['declares no tables', woff2Of({ tables: [] })],
    ['transformed loca table has a length', woff2Of({ tables: [{ index: 10, length: 100, transformLength: 80 }, { index: 11, length: 20, transformLength: 4 }] })],
    ['bytes after its last block', woff2Of({ tables: [head], trailing: 8 })],
    ['points at a missing table', woff2Of({ flavor: 0x74746366, tables: [head], collection: Uint8Array.of(0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 5) })],
    ['glyf and loca apart', woff2Of({ flavor: 0x74746366, tables: [head, { index: 10, length: 40, transformLength: 40 }, head, { index: 11, length: 12, transformLength: 0 }], collection: Uint8Array.of(0, 1, 0, 0, 1, 2, 0, 1, 0, 0, 1, 3) })],
  ];
  // Each case is refused for its own reason, not by an earlier check it happens to trip.
  for (const [reason, bytes] of cases) {
    assert.throws(() => preflightWoff2(bytes), (error) => refusedWith('malformed')(error) && (error as Error).message.includes(reason), reason);
  }
  assert.doesNotThrow(() => preflightWoff2(woff2Of({ tables: [head] })), 'the unchanged crafted file is accepted');
  // A base128 length with a leading zero byte, written by hand.
  const leading = woff2Of({ tables: [head] });
  leading[49] = 0x80;
  assert.throws(() => preflightWoff2(leading), /leading zero/);
});

test('declared sizes the decoder could not hold are refused, not attempted', async () => {
  // The measured case: an 11 MB file whose last table claims 1,000,000,000 bytes grew the
  // shared decoder by about 1 GB for the session. Its ratio is under 100, so only the
  // 30 MiB ceiling refuses the file.
  const huge = woff2Of({ tables: [{ index: 1, length: 54 }, { index: 5, length: 1_000_000_000 }], data: new Uint8Array(64), priv: 11_000_000 });
  assert.throws(() => preflightWoff2(huge), refusedWith('too-large'));
  await assert.rejects(decodeWoff2(huge), refusedWith('too-large'));
  // More data than 100 times the file size: google/woff2 refuses that ratio too.
  const ratio = woff2Of({ tables: [{ index: 5, length: 400_000 }], data: new Uint8Array(16) });
  assert.ok(ratio.length * 100 < 400_000);
  assert.throws(() => preflightWoff2(ratio), refusedWith('too-large'));
  // A caller's tighter limit applies to the preflight and to the output.
  await assert.rejects(decodeWoff2(read(SMALL), { maxOutputBytes: 1024 }), refusedWith('too-large'));
  // A declared decoded size (totalSfntSize) past the limit is refused before decoding.
  const declared = new Uint8Array(read(SMALL));
  new DataView(declared.buffer).setUint32(16, WOFF2_LIMITS.maxOutputBytes + 1);
  assert.throws(() => preflightWoff2(declared), (error) => refusedWith('too-large')(error) && /declares a decoded size/.test((error as Error).message));
});

test('decoder output that is not a coherent sfnt is refused', () => {
  const sfnt = read('shells/web/public/fonts/Outfit[wght].ttf');
  checkSfntOutput(sfnt, { collection: false });
  const shifted = new Uint8Array(sfnt);
  new DataView(shifted.buffer).setUint32(12 + 8, sfnt.length);
  assert.throws(() => checkSfntOutput(shifted, { collection: false }), refusedWith('bad-output'));
  const flavor = new Uint8Array(sfnt);
  flavor.set([0x77, 0x4f, 0x46, 0x32]);
  assert.throws(() => checkSfntOutput(flavor, { collection: false }), refusedWith('bad-output'));
  assert.throws(() => checkSfntOutput(sfnt, { collection: true }), refusedWith('bad-output'));
  assert.throws(() => checkSfntOutput(sfnt, { collection: false }, 1024), refusedWith('too-large'));
  // Checked against the declared size: zero padding up to the declared size is what the
  // decoder writes, anything past that or any data after the last table is not.
  const padded = new Uint8Array(sfnt.length + 64);
  padded.set(sfnt);
  checkSfntOutput(padded, { collection: false, totalSfntSize: padded.length });
  assert.throws(() => checkSfntOutput(padded, { collection: false, totalSfntSize: sfnt.length }), (error) => refusedWith('bad-output')(error) && /longer than its header declares/.test((error as Error).message));
  padded[padded.length - 1] = 1;
  assert.throws(() => checkSfntOutput(padded, { collection: false, totalSfntSize: padded.length }), (error) => refusedWith('bad-output')(error) && /data after its last table/.test((error as Error).message));
});

test('each decode runs in a worker thread that a time limit or an abort ends', async () => {
  const bytes = read(SMALL);
  // The largest public font, so the decode cannot finish inside the 1 ms limit even
  // when a loaded machine delays the timer.
  await assert.rejects(decodeWoff2(read('community/fallback-fonts/noto-sans-tc.woff2'), { timeoutMs: 1 }), refusedWith('timed-out'));
  const controller = new AbortController();
  const pending = decodeWoff2(bytes, { signal: controller.signal });
  controller.abort(new Error('stopped by the test'));
  await assert.rejects(pending, /stopped by the test/);
  // A decode the decoder refuses (a corrupt Brotli stream) ends with its worker; the
  // next font decodes to its reference bytes in a worker of its own.
  const corrupt = new Uint8Array(bytes);
  const { compressedOffset } = preflightWoff2(bytes);
  corrupt.fill(0xff, compressedOffset + 16, compressedOffset + 64);
  await assert.rejects(nodeWoff2Runner(corrupt, { timeoutMs: 20_000 }), refusedWith('decode-failed'));
  assert.equal(sha256(await decodeWoff2(bytes)), corpus.fonts[SMALL]!.sha256);
});

test('at most a fixed number of decode workers run at once, and a queued decode can be cancelled', async () => {
  const slot = woff2Slots(2);
  const first = await slot(), second = await slot();
  let third: (() => void) | undefined;
  const queued = slot().then((release) => { third = release; });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(third, undefined, 'the third waits while two are held');
  const controller = new AbortController();
  const cancelled = slot(controller.signal);
  controller.abort(new Error('no longer needed'));
  await assert.rejects(cancelled, /no longer needed/);
  first();
  await queued;
  assert.equal(typeof third, 'function');
  second(); third!();
  // Many fonts at once still decode, each in a thread of its own.
  const bytes = read(SMALL);
  const outs = await Promise.all(Array.from({ length: 6 }, () => decodeWoff2(bytes)));
  for (const out of outs) assert.equal(sha256(out), corpus.fonts[SMALL]!.sha256);
});

test('one-byte changes to the header and directory give a checked font or a Woff2Error', async () => {
  // About 300 decodes: run in this thread, a fresh instance each, to keep the sweep quick.
  // The guard's checks are the same whichever runner decodes.
  const bytes = read(SMALL);
  const { compressedOffset } = preflightWoff2(bytes);
  let decoded = 0;
  for (let at = 0; at < compressedOffset; at++) {
    for (const value of [0x00, 0xff, (bytes[at]! + 1) & 0xff]) {
      if (value === bytes[at]) continue;
      const mutated = new Uint8Array(bytes);
      mutated[at] = value;
      try {
        const out = await decodeWoff2(mutated, { runner: inThread });
        checkSfntOutput(out, { collection: false });
        decoded++;
      } catch (error) {
        assert.ok(error instanceof Woff2Error, `byte ${at} = ${value}: ${String(error)}`);
      }
    }
  }
  // Header fields the decoder ignores (the reserved word, totalSfntSize, versions) still decode.
  assert.ok(decoded > 0);
  assert.equal(sha256(await decodeWoff2(bytes, { runner: inThread })), corpus.fonts[SMALL]!.sha256);
});

/** One decode in `instance`, reading the module's own status, reason and memory size. */
function runIn(instance: WebAssembly.Instance, bytes: Uint8Array): { status: number; text: string; memory: number } {
  const api = instance.exports as unknown as {
    memory: WebAssembly.Memory; woff2_alloc(n: number): number; woff2_free(p: number): void;
    woff2_run(p: number, n: number, op: number): number; woff2_result_ptr(): number; woff2_result_len(): number;
  };
  const pointer = api.woff2_alloc(bytes.length);
  assert.notEqual(pointer, 0, 'the module took the input');
  new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
  const status = api.woff2_run(pointer, bytes.length, 1);
  const text = status ? new TextDecoder().decode(new Uint8Array(api.memory.buffer, api.woff2_result_ptr(), api.woff2_result_len())) : '';
  api.woff2_free(pointer);
  return { status, text, memory: api.memory.buffer.byteLength };
}

test('the decoder module refuses declared sizes it would not hold, without the preflight and without growing', async () => {
  // The files measured against the old decoder: an 11 MB file whose last table claims
  // 1,000,000,000 bytes (it grew the old module by about 1 GB) and a 25 MB file claiming
  // 2,400,000,000 (44 of those stopped the old module for good). Both pass the ratio check.
  const claim1g = woff2Of({ tables: [{ index: 1, length: 54 }, { index: 5, length: 1_000_000_000 }], data: new Uint8Array(64), priv: 11_000_000 });
  const claim24g = woff2Of({ tables: [{ index: 1, length: 54 }, { index: 5, length: 2_400_000_000 }], data: new Uint8Array(64), priv: 25_000_000 });
  // 35 MiB of tables in a 400 kB file: under wuff's own 128 MiB cap, so the module's
  // 30 MiB Brotli ceiling is what refuses it, before the buffer is allocated.
  const claim35m = woff2Of({ tables: [{ index: 1, length: 54 }, { index: 5, length: 35 * 1024 * 1024 }], data: new Uint8Array(64), priv: 400_000 });
  const instance = await WebAssembly.instantiate(await kernel, {});
  const baseline = runIn(instance, read(SMALL));
  assert.equal(baseline.status, 0);
  for (const [file, reason] of [[claim1g, /not valid/], [claim35m, /expand past 30 MB/]] as const) {
    const result = runIn(instance, file);
    assert.equal(result.status, 1);
    assert.match(result.text, reason);
    assert.ok(result.memory < file.length + 16 * 1024 * 1024, `memory grew to ${result.memory} bytes`);
  }
  // Fifty of the larger file through one instance: each refusal frees its input.
  let memory = 0;
  for (let i = 0; i < 50; i++) {
    const result = runIn(instance, claim24g);
    assert.equal(result.status, 1);
    memory = Math.max(memory, result.memory);
  }
  assert.ok(memory < claim24g.length + 16 * 1024 * 1024, `memory grew to ${memory} bytes`);
  // And the same instance still decodes a real font to its reference bytes.
  const api = instance.exports as unknown as { memory: WebAssembly.Memory; woff2_result_ptr(): number; woff2_result_len(): number };
  assert.equal(runIn(instance, read(SMALL)).status, 0);
  assert.equal(sha256(new Uint8Array(api.memory.buffer, api.woff2_result_ptr(), api.woff2_result_len())), corpus.fonts[SMALL]!.sha256);
});

test('Brotli streams are read as RFC 7932 describes them, as the C++ decoder reads them', async () => {
  const head = { index: 1, length: 54 };
  const plain = woff2Of({ tables: [head] });
  const large = woff2Of({ tables: [head], largeWindow: true });
  assert.equal((await decodeWoff2(plain)).length, 12 + 16 + 56, 'one 54-byte table, padded');
  // The large-window extension (windows up to 1 GiB) is refused, as google/woff2 refuses such a stream.
  await assert.rejects(decodeWoff2(large), (error) => refusedWith('decode-failed')(error)
    && (error as Error).message === 'This WOFF2 font could not be decoded.'
    && (error as Error).cause === 'The WOFF2 compressed data is damaged.');
  const { decompress } = await import('woff2-encoder');
  await assert.rejects(decompress(large));
  // A stream cut short, and one with more data than its tables, each give their own reason.
  const bytes = read(SMALL);
  const { compressedOffset, compressedLength } = preflightWoff2(bytes);
  const cut = new Uint8Array(bytes);
  cut.fill(0, compressedOffset + compressedLength - 64, compressedOffset + compressedLength);
  await assert.rejects(inThread(cut, { timeoutMs: 20_000 }), /compressed data/);
  const longer = woff2Of({ tables: [head], data: new Uint8Array(54 + 40) });
  await assert.rejects(inThread(longer, { timeoutMs: 20_000 }), /longer than its tables/);
});

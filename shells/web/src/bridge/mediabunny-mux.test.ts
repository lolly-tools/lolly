// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the mediabunny muxer's OPFS StreamTarget seam (plans/156 WP-A).
 *
 * Two things are proven here without a real browser:
 *
 *   • PART 1 - the FEATURE-DETECT FALLBACK. `buildMediabunnyMux({target:'opfs'})` must
 *     be SAFE to call anywhere: when no seekable sink is injected AND the environment
 *     has no OPFS (`navigator.storage.getDirectory`), it silently keeps the in-memory
 *     BufferTarget instead of throwing. An injected sink always wins.
 *
 *   • PART 2 - the TEMP-FILE CLEANUP / NO-LEAK. `opfsSeekableSink` writes a transient
 *     `lolly-mux-*` file, but that file must NEVER survive the export: `result()` reads
 *     the finished bytes into an in-memory Blob and then deletes the file; an aborted
 *     writable deletes it too; and a fresh sink sweeps a crashed prior export's orphan.
 *     A fake in-memory OPFS root (a Map of files) makes every one of those assertable in
 *     node, including "no lolly-mux-* remains after a run".
 *
 * Run directly:  node --test shells/web/src/bridge/mediabunny-mux.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMediabunnyMux, opfsSeekableSink, type SeekableSink } from './mediabunny-mux.ts';

// ── A fake in-memory OPFS directory ───────────────────────────────────────────
// Just enough of the FileSystemDirectoryHandle / FileSystemFileHandle /
// FileSystemWritableFileStream surface that opfsSeekableSink drives: positioned writes,
// commit-on-close, getFile(), removeEntry(), and the keys() async iterator the sweep
// walks. Bytes are held in a Map keyed by name, so `names()` is the leak oracle.

interface FakeRoot {
  root: unknown;                                   // stands in for navigator.storage.getDirectory()
  names(): string[];                               // committed-or-created file names, the leak oracle
  seed(name: string, bytes: Uint8Array): void;     // plant an orphan for the sweep test
}

function fakeOpfsRoot(): FakeRoot {
  const files = new Map<string, Uint8Array>();
  const handleFor = (name: string): unknown => ({
    async createWritable(): Promise<unknown> {
      let buf = new Uint8Array(0);
      let max = 0;
      return {
        async write(chunk: { type: string; position: number; data: Uint8Array }): Promise<void> {
          const end = chunk.position + chunk.data.length;
          if (end > buf.length) { const g = new Uint8Array(end); g.set(buf); buf = g; }
          buf.set(chunk.data, chunk.position);
          if (end > max) max = end;
        },
        async close(): Promise<void> { files.set(name, buf.subarray(0, max)); },
        async abort(): Promise<void> { /* discard the accumulator; commit nothing */ },
      };
    },
    async getFile(): Promise<Blob> {
      const b = files.get(name) ?? new Uint8Array(0);
      const ab = new ArrayBuffer(b.byteLength);       // fresh ArrayBuffer ⇒ a clean BlobPart
      new Uint8Array(ab).set(b);
      return new Blob([ab]);
    },
  });
  const root = {
    async getFileHandle(name: string, opts?: { create?: boolean }): Promise<unknown> {
      if (!files.has(name)) {
        if (!opts?.create) throw new Error('NotFoundError');
        files.set(name, new Uint8Array(0));          // reserve the name (empty until close)
      }
      return handleFor(name);
    },
    async removeEntry(name: string): Promise<void> {
      if (!files.has(name)) throw new Error('NotFoundError');
      files.delete(name);
    },
    async *keys(): AsyncIterableIterator<string> { for (const k of [...files.keys()]) yield k; },
  };
  return {
    root,
    names: () => [...files.keys()],
    seed: (name, bytes) => files.set(name, bytes),
  };
}

/** Install a fake `navigator.storage.getDirectory` for the duration of a test; returns a
 *  restore fn. `null` installs a navigator WITHOUT storage (the OPFS-absent case). node's
 *  own `navigator` is a getter-only global, so this goes through defineProperty. */
function withNavigator(root: unknown | null): () => void {
  const g = globalThis as unknown as Record<string, unknown>;
  const prev = Object.getOwnPropertyDescriptor(g, 'navigator');
  const value = root === null
    ? { userAgent: 'node-test' }                                   // present, but no .storage
    : { userAgent: 'node-test', storage: { getDirectory: async () => root } };
  Object.defineProperty(g, 'navigator', { value, configurable: true, writable: true });
  return () => {
    if (prev) Object.defineProperty(g, 'navigator', prev);
    else delete g.navigator;
  };
}

const mp4 = { container: 'mp4' as const, video: 'avc' as const };

// ── PART 1: feature-detect fallback ────────────────────────────────────────────

test('buildMediabunnyMux: target:opfs with no OPFS falls back to a BufferTarget (never throws)', async () => {
  const restore = withNavigator(null);               // navigator present, navigator.storage absent
  try {
    const built = await buildMediabunnyMux({ ...mp4, target: 'opfs' });
    // A BufferTarget exposes `.buffer`; the OPFS StreamTarget wrapper exposes `.blob()`.
    assert.ok(!('blob' in built.target), 'no-OPFS opfs request must NOT produce a StreamTarget');
    assert.ok('buffer' in built.target, 'it must fall back to the in-memory BufferTarget');
  } finally { restore(); }
});

test('buildMediabunnyMux: target:opfs WITH OPFS present produces a StreamTarget (blob sink)', async () => {
  const fake = fakeOpfsRoot();
  const restore = withNavigator(fake.root);
  try {
    const built = await buildMediabunnyMux({ ...mp4, target: 'opfs' });
    assert.ok('blob' in built.target, 'a real OPFS environment must stream to a StreamTarget');
  } finally { restore(); }
});

test('buildMediabunnyMux: default target stays BufferTarget even when OPFS exists', async () => {
  const fake = fakeOpfsRoot();
  const restore = withNavigator(fake.root);
  try {
    const built = await buildMediabunnyMux({ ...mp4 });     // no target ⇒ 'buffer'
    assert.ok('buffer' in built.target && !('blob' in built.target), 'the default must be BufferTarget');
  } finally { restore(); }
});

test('buildMediabunnyMux: an injected seekable sink is honoured even with no navigator OPFS', async () => {
  const restore = withNavigator(null);
  let acquired = false;
  const seekableSink = async (): Promise<SeekableSink> => {
    acquired = true;
    return { writable: new WritableStream({ write() {}, close() {} }), result: async () => new Blob([new Uint8Array([1])]) };
  };
  try {
    const built = await buildMediabunnyMux({ ...mp4, target: 'opfs', seekableSink });
    assert.ok('blob' in built.target, 'an injected sink must produce a StreamTarget regardless of OPFS');
    assert.ok(acquired, 'the injected sink factory must be the one acquired');
  } finally { restore(); }
});

// ── PART 2: temp-file cleanup / no-leak ────────────────────────────────────────

/** Drive an opfsSeekableSink end to end: write, close, result(). Returns the bytes the
 *  returned Blob holds - proving it stays valid after the file is deleted. */
async function driveSink(sink: SeekableSink, writes: Array<{ position: number; data: number[] }>): Promise<Uint8Array> {
  const w = sink.writable.getWriter();
  for (const wr of writes) await w.write({ type: 'write', position: wr.position, data: new Uint8Array(wr.data) });
  await w.close();
  const blob = await sink.result();
  return new Uint8Array(await blob.arrayBuffer());
}

test('opfsSeekableSink: result() returns the finished bytes AND leaves no lolly-mux-* file', async () => {
  const fake = fakeOpfsRoot();
  const restore = withNavigator(fake.root);
  try {
    const sink = await opfsSeekableSink('mp4');
    // A positioned write past the head (as fastStart:false backpatches the moov) proves
    // the returned Blob is the whole file, not just the last chunk.
    const bytes = await driveSink(sink, [
      { position: 0, data: [0x66, 0x74, 0x79, 0x70] },   // 'ftyp'
      { position: 4, data: [0xde, 0xad, 0xbe, 0xef] },
    ]);
    assert.deepEqual([...bytes], [0x66, 0x74, 0x79, 0x70, 0xde, 0xad, 0xbe, 0xef], 'the whole written file comes back');
    assert.equal(fake.names().filter((n) => n.startsWith('lolly-mux-')).length, 0,
      `a lolly-mux-* file leaked after result(): ${JSON.stringify(fake.names())}`);
  } finally { restore(); }
});

test('opfsSeekableSink: an aborted writable removes its temp file (no leak on a failed export)', async () => {
  const fake = fakeOpfsRoot();
  const restore = withNavigator(fake.root);
  try {
    const sink = await opfsSeekableSink('webm');
    const w = sink.writable.getWriter();
    await w.write({ type: 'write', position: 0, data: new Uint8Array([1, 2, 3]) });
    assert.equal(fake.names().filter((n) => n.startsWith('lolly-mux-')).length, 1, 'the temp file exists mid-write');
    await w.abort(new Error('encoder exploded'));
    assert.equal(fake.names().filter((n) => n.startsWith('lolly-mux-')).length, 0,
      `abort must delete the temp file, found: ${JSON.stringify(fake.names())}`);
  } finally { restore(); }
});

test('opfsSeekableSink: a fresh sink sweeps a crashed prior export ORPHAN, but not a live sibling', async () => {
  const fake = fakeOpfsRoot();
  const restore = withNavigator(fake.root);
  try {
    // A crashed run from long ago (stamp well past the stale window) and a live concurrent
    // export's file (fresh stamp). Plus an unrelated file that must be left alone.
    fake.seed('lolly-mux-100-crashed.mp4', new Uint8Array([9]));                 // ancient ⇒ orphan
    const liveName = `lolly-mux-${Date.now()}-live.webm`;
    fake.seed(liveName, new Uint8Array([8]));                                    // fresh ⇒ concurrent
    fake.seed('user-render-keepme.png', new Uint8Array([7]));                    // not ours
    const sink = await opfsSeekableSink('mp4');                                  // acquiring runs the sweep
    const after = fake.names();
    assert.ok(!after.includes('lolly-mux-100-crashed.mp4'), 'the ancient orphan must be swept');
    assert.ok(after.includes(liveName), 'a fresh sibling export file must NOT be swept');
    assert.ok(after.includes('user-render-keepme.png'), 'a non-lolly-mux file must never be touched');
    // And the sink we just acquired cleans up after itself too.
    await driveSink(sink, [{ position: 0, data: [1] }]);
    assert.equal(after.filter((n) => n.startsWith('lolly-mux-') && n !== liveName).length, 1,
      'exactly our own new temp file existed before result()');
    assert.equal(fake.names().filter((n) => n.startsWith('lolly-mux-') && n !== liveName).length, 0,
      'our own temp file is gone after result(); only the live sibling remains');
  } finally { restore(); }
});

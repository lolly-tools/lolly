// SPDX-License-Identifier: MPL-2.0
/**
 * The streamed portable backup (plan 203 R4, plan 221 streaming archives).
 *
 * exportBackup now writes through lib/zip-stream.ts instead of gathering every
 * part in memory and zipping at the end. These tests hold it to the bytes the
 * in-memory writer produced:
 *
 * - Reference outputs: the part digests below were recorded from the in-memory
 *   exportBackup on main before the change (fixed clock, the fixture below), for a
 *   manual backup and a sync copy. Only lolly.txt is left out, because it prints
 *   the date in the machine's locale.
 * - The whole archive matches the in-memory writer's (lib/bundle.ts memoryArchive)
 *   byte for byte, and ZipStream matches fflate's zipSync for the same parts.
 * - Saved results keep the exact bytes their Content Credentials sign.
 * - Large blobs are read in bounded slices, never whole: uploads, saved results
 *   and saved versions, both when they are checked and when they are archived.
 * - The history file keeps the rules decided on 27 September 2026: the 384 MiB
 *   limit, only the oldest automatic checkpoints left out, a history that cannot
 *   fit refused whole, and none of it, nor discarded edits, in a sync copy.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/backup-streaming.test.ts
 * The memory guard runs with BENCH=1 (scripts/bench-backup-finalise.ts).
 */
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { exportBackup, importBackup } from '../shells/web/src/data-transfer.ts';
import { entrySink, memoryArchive, type BundleEntry } from '../shells/web/src/lib/bundle.ts';
import { ONE_SHOT_DEFLATE_MAX, ZipStream, streamedArchive } from '../shells/web/src/lib/zip-stream.ts';
import { READ_CHUNK_BYTES } from '../shells/web/src/lib/stream-hash.ts';
import { FileOperationStore } from '../shells/web/src/lib/file-operation-store.ts';
import { writeBackupSessions, type BackupState } from '../shells/web/src/lib/backup-sessions.ts';
import type { FileHistorySnapshot } from '../shells/web/src/lib/file-history-backup.ts';
import type { RevisionArchive } from '../shells/web/src/bridge/revision-archive-format.ts';
import { readZipMembers } from '../engine/src/zip.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';

const NOW = Date.parse('2026-10-16T09:00:00Z');
const SIGNED = new Uint8Array(readFileSync(new URL('./fixtures/c2patool-signed.png', import.meta.url)));
const hex = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');

function noise(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  let x = seed >>> 0;
  for (let i = 0; i < n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; out[i] = x >>> 24; }
  return out;
}

// Recorded from the in-memory exportBackup on main (37214183d) with this fixture
// and the clock at NOW. lolly.txt is locale-dependent and left out.
const REFERENCE: Record<'manual' | 'sync', Record<string, string>> = {
  manual: {
    'revision-history.json': '27fb0efab4bd165848ed28f6250981fbd5aa4846efee740e92241fffbb30eac9',
    'sessions.json': '8f7f58ad740e3f3ef6c232f566b3bb9b98992a8aa093b653fb0a6ec360a2e20e',
    'file-history/versions/0.bin': '4df7e6130c2aadf9a7dd6fe126a5582ffc676c4a78f8c25a2d7160c357f49784',
    'file-history/versions/0.c2pa': 'bacdef9c76b37eb70caaf81ea41ecddd56d625b72e453de5eabbd59745279847',
    'file-history/results/0.bin': '0241292c898cefc8aed148dc72dc485ef217433decfec74eae268d930785bf4e',
    'file-history.json': '05aa6aef8dcd307a4a8b3dad106c27168ae068473df12f021aaf4b20352a51b8',
    'profile.json': 'aa7793799325c00161e1be6bebabd83035225465e97f968f378b9d919129453e',
    'assets/blobs/0.bin': '0241292c898cefc8aed148dc72dc485ef217433decfec74eae268d930785bf4e',
    'assets/blobs/1.bin': '19616954c85cee0cf89a19209a27d23bc90bee40164b790c8d0fdb2b263d2727',
    'assets/blobs/1.c2pa': '06df4f7e1394f1c57cc6583fba4d8060a5a66f4f4771c14aeff6b9af8a28c9b3',
    'assets/blobs/2.bin': 'a1003f7d04a4115711d0b48a2eaf1359ce565d2d2a6fd65098dfcffadeeef59f',
    'assets.json': '53130e69a26272e7c877e0d96cf57b67d7966391f4840ffcd2b3223748247451',
    'prefs.json': '34bd947fe2a1aef03594296e09dbfbdc6e55d132b589f82dfb89249e9ae73b17',
    'manifest.json': 'a94bc5042bdca06d624ce9a69fa3ecf3110a9777d063ba7c07091b2472492714',
  },
  sync: {
    'sessions.json': '30e36776555d95089f669840487bd4b68a47d98d060c2ef586aecd78cce19f3b',
    'file-history/versions/0.bin': '4df7e6130c2aadf9a7dd6fe126a5582ffc676c4a78f8c25a2d7160c357f49784',
    'file-history/versions/0.c2pa': 'bacdef9c76b37eb70caaf81ea41ecddd56d625b72e453de5eabbd59745279847',
    'file-history/results/0.bin': '0241292c898cefc8aed148dc72dc485ef217433decfec74eae268d930785bf4e',
    'file-history.json': '05aa6aef8dcd307a4a8b3dad106c27168ae068473df12f021aaf4b20352a51b8',
    'profile.json': 'aa7793799325c00161e1be6bebabd83035225465e97f968f378b9d919129453e',
    'assets/blobs/0.bin': '0241292c898cefc8aed148dc72dc485ef217433decfec74eae268d930785bf4e',
    'assets/blobs/1.bin': '19616954c85cee0cf89a19209a27d23bc90bee40164b790c8d0fdb2b263d2727',
    'assets/blobs/1.c2pa': '06df4f7e1394f1c57cc6583fba4d8060a5a66f4f4771c14aeff6b9af8a28c9b3',
    'assets/blobs/2.bin': 'a1003f7d04a4115711d0b48a2eaf1359ce565d2d2a6fd65098dfcffadeeef59f',
    'assets.json': '53130e69a26272e7c877e0d96cf57b67d7966391f4840ffcd2b3223748247451',
    'prefs.json': '34bd947fe2a1aef03594296e09dbfbdc6e55d132b589f82dfb89249e9ae73b17',
    'manifest.json': 'ebf54fbd00f578cffdce5131663c77eaa7054b219ee5a2cdec4fe82437315bb4',
  },
};

/** A small library touching every part: history with a save and an automatic
 *  checkpoint, a discarded slot, uploads with credentials, a saved result that is
 *  a real C2PA-signed PNG, a saved asset version and preferences. */
function fixture() {
  const sessions: Record<string, unknown> = {
    'design:one': { __toolId: 'design', __label: 'One', boxes: [{ id: 'a', text: 'Café ☕ 日本' }] },
    'qr-code:b': { __toolId: 'qr-code', __label: 'Launch', url: 'https://example.com/launch' },
    '__discarded__:abc:qr-code:x': { __toolId: 'qr-code', url: 'https://example.com/discarded' },
  };
  const rows = [
    { slot: 'design:one', toolId: 'design', toolVersion: '1.0.0', label: 'One', thumb: 'data:image/png;base64,AAAA', updatedAt: '2026-10-15T08:00:00.000Z', savedAt: '2026-10-15T08:00:00.000Z' },
    { slot: 'qr-code:b', toolId: 'qr-code', toolVersion: '2.1.0', label: 'Café ☕', thumb: null, updatedAt: '2026-10-14T08:00:00.000Z' },
    { slot: '__discarded__:abc:qr-code:x', toolId: 'qr-code', toolVersion: '2.1.0', label: null, thumb: null, updatedAt: '2026-10-13T08:00:00.000Z' },
  ];
  const archive = {
    version: 1,
    documents: [{ document: { slot: 'design:one', documentId: 'doc-1', head: 'rev-2', hash: 'h2', version: 'rev-2', workingHash: 'h2' },
      state: { slot: 'design:one', documentId: 'doc-1', data: sessions['design:one'], thumb: null, toolId: 'design', toolVersion: '1.0.0', label: 'One', updatedAt: '2026-10-15T08:00:00.000Z', savedAt: '2026-10-15T08:00:00.000Z' } }],
    revisions: [1, 2].map(i => ({ entry: { id: `rev-${i}`, documentId: 'doc-1', at: `2026-10-15T0${i}:00:00.000Z`, reason: i === 1 ? 'save' : 'automatic', bytes: 40 + i }, data: { __toolId: 'design', boxes: [{ id: 'a', text: `v${i} ✓` }] }, preview: 'data:image/webp;base64,UklGRg==' })),
    recoveries: [],
  } as unknown as RevisionArchive;
  const exports: Array<{ maxBytes?: number }> = [];
  const facts = (name: string, bytes: Uint8Array, mime: string) => ({ name, format: name.split('.').pop()!, mime, size: bytes.length, sha256: hex(bytes) });
  const source = noise(5000, 7);
  const request = { version: 1 as const, operation: 'convert', target: 'png', options: {} };
  const operation = { id: '6b0b1437-f729-4b69-b021-32c80f463fb0', state: 'succeeded' as const, input: facts('source.jpg', source, 'image/jpeg'), request, createdAt: 100, updatedAt: 200,
    report: { version: 1 as const, operation: 'convert', state: 'succeeded' as const, inputs: [facts('source.jpg', source, 'image/jpeg')], outputs: [facts('signed.png', SIGNED, 'image/png')], options: { target: 'png' }, changes: [], findings: [], metadata: 'not-checked' as const, execution: 'device' as const },
    output: new File([SIGNED as BlobPart], 'signed.png', { type: 'image/png' }) };
  const versionBytes = noise(70_000, 11);
  const fileHistory = { assetVersions: [{ assetId: 'user/upload/1-logo', version: 'v1', savedAt: 50, bytes: versionBytes.length, sha256: hex(versionBytes),
    record: { id: 'user/upload/1-logo', version: 'v1', type: 'raster', format: 'png', blob: new Blob([versionBytes as BlobPart], { type: 'image/png' }), credential: new Uint8Array([1, 2, 3, 250]), credentialFormat: 'png', meta: { name: 'Logo' } } }],
    operations: [operation], batches: [] } as unknown as FileHistorySnapshot;
  const assets = [
    { id: 'user/upload/1-logo', type: 'raster', format: 'png', version: 'v2', blob: new Blob([SIGNED as BlobPart], { type: 'image/png' }), meta: { name: 'Logo', modifiedAt: '2026-10-10T00:00:00.000Z' } },
    { id: 'user/fonts/inter/0', type: 'font', format: 'woff2', blob: new Blob([noise(300_000, 3) as BlobPart], { type: 'font/woff2' }), credential: new Uint8Array([9, 8, 7]), meta: { family: 'Inter' } },
    { id: 'user/upload/2-note', type: 'text', format: 'txt', blob: new Blob(['héllo wörld'], { type: 'text/plain' }), meta: { name: 'Nötë' } },
  ];
  const kv = new Map<string, string>([['theme', 'dark'], ['sidebarWidth', '320'], ['ct-metrics', '{"opens":3}']]);
  const storage = { getItem: (k: string) => kv.get(k) ?? null, setItem: (k: string, v: string) => { kv.set(k, v); }, removeItem: (k: string) => { kv.delete(k); } };
  const restored: FileHistorySnapshot[] = [];
  const host = {
    profile: { get: async () => ({ firstname: 'Ada', lastname: 'Lovelace', email: 'ada@example.com' }), set: async () => {} },
    state: { list: async () => rows, load: async (slot: string) => sessions[slot] ?? null, save: async () => {},
      history: { backup: { export: async (options: { maxBytes?: number } = {}) => { exports.push(options); return structuredClone(archive); }, restore: async () => ({ revisions: 0, recoveryDrafts: 0 }) } } },
    assets: { _exportUserAssets: async () => assets, _importUserAsset: async () => {} },
    fileHistory: { export: async () => fileHistory, restore: async (snapshot: FileHistorySnapshot) => { restored.push(snapshot); return { assetVersions: 1, fileOperations: 1, failedHistory: 0 }; } },
  };
  return { host, storage, exports, restored };
}
type Deps = Parameters<typeof exportBackup>[0];
const deps = (f: ReturnType<typeof fixture>): Deps => ({ host: f.host as unknown as Deps['host'], storage: f.storage });

const bytesOf = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());
const fixClock = (context: TestContext): void => { context.mock.timers.enable({ apis: ['Date'], now: NOW }); };

for (const mode of ['manual', 'sync'] as const) {
  test(`${mode}: every part matches the reference digests recorded from the in-memory writer`, async (context) => {
    fixClock(context);
    const f = fixture();
    const { blob, summary, size } = await exportBackup(deps(f), { mode });
    const parts = unzipSync(await bytesOf(blob));
    const { 'lolly.txt': readme, ...rest } = parts;
    assert.ok(readme && readme.length > 0, 'the README is there');
    assert.deepEqual(Object.keys(rest), Object.keys(REFERENCE[mode]), 'the same parts in the same order');
    for (const [name, digest] of Object.entries(REFERENCE[mode])) assert.equal(hex(rest[name]!), digest, name);
    assert.equal(summary.sessions, mode === 'manual' ? 3 : 2);
    assert.equal(size.largest.name, 'assets/blobs/1.bin');
    assert.equal(size.total, Object.values(parts).reduce((n, p) => n + p.length, 0));
  });

  test(`${mode}: the streamed archive is the in-memory writer's archive, byte for byte`, async (context) => {
    fixClock(context);
    const streamed = await exportBackup(deps(fixture()), { mode });
    const reference = await exportBackup(deps(fixture()), { mode }, memoryArchive());
    assert.equal(hex(await bytesOf(streamed.blob)), hex(await bytesOf(reference.blob)));
    assert.deepEqual(streamed.size, reference.size);
    assert.deepEqual(streamed.summary, reference.summary);
    assert.deepEqual(streamed.ids, reference.ids);
  });
}

test('ZipStream writes what fflate zipSync writes for the same parts, levels and time', async (context) => {
  fixClock(context);
  const big = new TextEncoder().encode(JSON.stringify(Array.from({ length: 9000 }, (_, i) => ({ i, text: `row ${i} ${'ab'.repeat(i % 40)}` }))));
  const parts: Array<{ name: string; data: Uint8Array; how: 'bytes' | 'stored' | 'blob' | 'chunks' }> = [
    { name: 'a.json', data: new TextEncoder().encode('{"hello":"world"}'), how: 'bytes' },
    { name: 'empty.txt', data: new Uint8Array(0), how: 'bytes' },
    { name: 'dir/日本語.bin', data: noise(1000, 2), how: 'stored' },
    { name: 'blob.bin', data: noise(200_000, 3), how: 'blob' },
    { name: 'empty.bin', data: new Uint8Array(0), how: 'blob' },
    { name: 'big.json', data: big, how: 'chunks' },
    { name: 'tail.json', data: new TextEncoder().encode('[1,2,3]'), how: 'bytes' },
  ];
  const zip = new ZipStream({ mtime: NOW, integrity: true });
  for (const p of parts) {
    if (p.how === 'blob') await zip.blob(p.name, new Blob([p.data as BlobPart]));
    else if (p.how === 'chunks') {
      const w = zip.open(p.name);
      for (let o = 0; o < p.data.length; o += 100_000) await w.write(p.data.subarray(o, o + 100_000));
      await w.close();
    } else await zip.bytes(p.name, p.data, p.how === 'stored');
  }
  const entries: Zippable = {};
  for (const p of parts) entries[p.name] = p.how === 'stored' || p.how === 'blob' ? [p.data, { level: 0 }] : p.data;
  assert.equal(hex(await bytesOf(zip.finish())), hex(zipSync(entries, { mtime: NOW })));
  // The digests are the SRI form manifest.integrity uses.
  const digests = zip.integrity();
  for (const p of parts) assert.equal(digests[p.name], `sha256-${createHash('sha256').update(p.data).digest('base64')}`);
});

test('a chunked part past the one-call size keeps its bytes and digest; only its compression is laid out differently', async () => {
  const row = (i: number): string => `{"id":"rev-${i}","text":"${'checkpoint '.repeat(1 + (i % 30))}${i}"}`;
  const zip = new ZipStream({ mtime: NOW, integrity: true });
  const w = zip.open('revision-history.json');
  const hash = createHash('sha256');
  let i = 0;
  while (w.bytes <= ONE_SHOT_DEFLATE_MAX + 1024 * 1024) {
    const chunk = new TextEncoder().encode(Array.from({ length: 2000 }, () => row(i++)).join(','));
    hash.update(chunk);
    await w.write(chunk);
  }
  const size = w.bytes;
  await w.close();
  const archive = await bytesOf(zip.finish());
  const part = unzipSync(archive)['revision-history.json']!;
  assert.equal(part.length, size);
  assert.equal(hex(part), hash.copy().digest('hex'));
  assert.equal(zip.integrity()['revision-history.json'], `sha256-${hash.digest('base64')}`);
  assert.ok(archive.length < size / 4, 'and it is deflated');
});

test('saved results keep the exact bytes their Content Credentials sign, stored and never re-encoded', async (context) => {
  fixClock(context);
  const f = fixture();
  const { blob } = await exportBackup(deps(f), { mode: 'manual' });
  const archive = await bytesOf(blob);
  const members = new Map(readZipMembers(archive).map(m => [m.name, m]));
  for (const name of ['file-history/results/0.bin', 'assets/blobs/0.bin']) {
    assert.equal(members.get(name)!.method, 0, `${name} is stored`);
    assert.deepEqual(members.get(name)!.compressed, SIGNED, `${name} holds the signed bytes`);
  }
  const target = fixture();
  const summary = await importBackup(deps(target), archive);
  assert.equal(summary.failedHistory, 0);
  const output = new Uint8Array(await target.restored[0]!.operations[0]!.output!.arrayBuffer());
  const report = await verifyC2pa(output);
  assert.equal(report.state, 'valid', 'the hard binding still matches after the round trip');
  assert.ok(report.checks.some(c => c.ok && c.code === 'assertion.dataHash.match'));
});

test('a large blob is read in bounded slices for its checksum and referenced, never read whole', async () => {
  const data = noise(9 * 1024 * 1024 + 123, 5);
  const slices: number[] = [];
  class Watched extends Blob {
    override slice(start?: number, end?: number, type?: string): Blob { slices.push((end ?? this.size) - (start ?? 0)); return super.slice(start, end, type); }
    override arrayBuffer(): Promise<ArrayBuffer> { throw new Error('the whole blob must not be read'); }
  }
  const zip = new ZipStream({ mtime: NOW, integrity: true });
  await zip.blob('video.mp4', new Watched([data as BlobPart], { type: 'video/mp4' }));
  assert.deepEqual(slices, [4 * 1024 * 1024, 4 * 1024 * 1024, 1024 * 1024 + 123]);
  const out = unzipSync(await bytesOf(zip.finish()));
  assert.equal(hex(out['video.mp4']!), hex(data));
});

// Blobs that record every slice taken and refuse to be read whole, under a label.
const slicesRead = new Map<string, number[]>();
function noteSlice(label: string, size: number, start = 0, end = size): void {
  slicesRead.set(label, [...(slicesRead.get(label) ?? []), end - start]);
}
const readWhole = (label: string): never => { throw new Error(`${label} was read whole`); };
class WatchedBlob extends Blob {
  readonly label: string;
  constructor(label: string, parts: BlobPart[], options?: BlobPropertyBag) { super(parts, options); this.label = label; }
  override slice(start?: number, end?: number, type?: string): Blob { noteSlice(this.label, this.size, start, end); return super.slice(start, end, type); }
  override arrayBuffer(): Promise<ArrayBuffer> { return readWhole(this.label); }
  override text(): Promise<string> { return readWhole(this.label); }
  override stream(): ReturnType<Blob['stream']> { return readWhole(this.label); }
}
class WatchedFile extends File {
  readonly label: string;
  constructor(label: string, parts: BlobPart[], name: string, options?: FilePropertyBag) { super(parts, name, options); this.label = label; }
  override slice(start?: number, end?: number, type?: string): Blob { noteSlice(this.label, this.size, start, end); return super.slice(start, end, type); }
  override arrayBuffer(): Promise<ArrayBuffer> { return readWhole(this.label); }
  override text(): Promise<string> { return readWhole(this.label); }
  override stream(): ReturnType<Blob['stream']> { return readWhole(this.label); }
}
function assertSliced(label: string, size: number): void {
  const read = slicesRead.get(label) ?? [];
  assert.ok(read.length > 1, `${label} was read in slices`);
  assert.ok(read.every(n => n <= READ_CHUNK_BYTES), `${label} was read 4 MiB or less at a time: ${read.join(', ')}`);
  const total = read.reduce((n, r) => n + r, 0);
  assert.equal(total % size, 0, `${label}: each read covers the whole file`);
}

test('exportBackup checks and archives uploads, saved results and saved versions in bounded slices, with their exact bytes', async (context) => {
  fixClock(context);
  const f = fixture();
  const history = await f.host.fileHistory.export();
  const assets = await f.host.assets._exportUserAssets();
  const upload = noise(READ_CHUNK_BYTES * 2 + 101, 21), version = noise(READ_CHUNK_BYTES + 202, 22), result = noise(READ_CHUNK_BYTES * 2 + 303, 23);
  assets[1]!.blob = new WatchedBlob('upload', [upload as BlobPart], { type: 'font/woff2' });
  const saved = history.assetVersions[0]!;
  saved.bytes = version.length; saved.sha256 = hex(version);
  saved.record.blob = new WatchedBlob('version', [version as BlobPart], { type: 'image/png' });
  const operation = history.operations[0]!;
  operation.report = { ...operation.report!, outputs: [{ name: 'big.png', format: 'png', mime: 'image/png', size: result.length, sha256: hex(result) }] };
  operation.output = new WatchedFile('result', [result as BlobPart], 'big.png', { type: 'image/png' });

  const { blob } = await exportBackup(deps(f), { mode: 'manual' });
  assertSliced('upload', upload.length);
  assertSliced('version', version.length);
  assertSliced('result', result.length);
  const parts = unzipSync(await bytesOf(blob));
  const manifest = JSON.parse(new TextDecoder().decode(parts['manifest.json']!)) as { integrity: Record<string, string> };
  for (const [name, bytes] of [['assets/blobs/1.bin', upload], ['file-history/versions/0.bin', version], ['file-history/results/0.bin', result]] as const) {
    assert.equal(hex(parts[name]!), hex(bytes), `${name} holds the source bytes`);
    assert.equal(manifest.integrity[name], `sha256-${createHash('sha256').update(bytes).digest('base64')}`, `${name} has its digest`);
  }
});

test('a saved result read back from the store is checked in bounded slices', async () => {
  const bytes = noise(READ_CHUNK_BYTES * 2 + 55, 31);
  const stored = new WatchedFile('stored', [bytes as BlobPart], '6b0b1437-f729-4b69-b021-32c80f463fb0', { type: 'image/png' });
  const record = { id: '6b0b1437-f729-4b69-b021-32c80f463fb0', state: 'succeeded', backend: 'opfs', outputName: 'big.png', outputMime: 'image/png',
    report: { outputs: [{ name: 'big.png', format: 'png', mime: 'image/png', size: bytes.length, sha256: hex(bytes) }] } };
  const db = { get: async (store: string) => (store === 'file-operations' ? record : undefined) };
  const directory = { getFileHandle: async () => ({ getFile: async () => stored }) };
  const output = await new FileOperationStore(db as never, directory as never).getOutput(record.id);
  assert.equal(output!.size, bytes.length);
  assertSliced('stored', bytes.length);
});

test('parts go in one at a time, names are unique and an aborted part leaves no trace', async () => {
  const zip = new ZipStream({ mtime: NOW });
  const w = zip.open('half.json');
  await w.write(new TextEncoder().encode('{"a":'));
  await assert.rejects(zip.bytes('other.json', new Uint8Array(1)), /one at a time/);
  assert.throws(() => zip.finish(), /still open/);
  w.abort();
  await zip.bytes('kept.json', new TextEncoder().encode('{}'));
  await assert.rejects(zip.bytes('kept.json', new Uint8Array(1)), /already has a part/);
  assert.throws(() => zip.integrity(), /not asked to keep digests/);
  assert.deepEqual(Object.keys(unzipSync(await bytesOf(zip.finish()))), ['kept.json']);
  assert.throws(() => zip.finish(), /already finished/);
});

// ── The 27 September rules on the streamed path ──────────────────────────────

/** A history provider whose archive is `size` bytes of JSON on each export, in turn. */
function sizedHistory(sizes: number[]): { state: BackupState; asked: number[] } {
  const asked: number[] = [];
  const state: BackupState = {
    list: async () => [], load: async () => null, save: async () => {},
    history: { backup: {
      export: async (options = {}) => {
        asked.push(options.maxBytes ?? -1);
        const size = sizes[asked.length - 1]!;
        if (sizes.length > 1 && asked.length === 2) options.leftOut?.(3);
        const empty = JSON.stringify({ version: 1, documents: [], revisions: [{ entry: { id: 'r' }, data: { t: '' } }], recoveries: [] }).length;
        return { version: 1, documents: [], revisions: [{ entry: { id: 'r' }, data: { t: 'x'.repeat(size - empty) } }], recoveries: [] } as unknown as RevisionArchive;
      },
      restore: async () => ({ revisions: 0, recoveryDrafts: 0 }),
    } },
  };
  return { state, asked };
}

test('a history file over the limit is made again with the overshoot taken off, and the left-out count reported', async () => {
  const MIB = 1024 * 1024, limit = 4 * MIB;
  const { state, asked } = sizedHistory([5 * MIB, 2 * MIB]);
  const entries: Record<string, BundleEntry> = {};
  const packed = await writeBackupSessions(state, entrySink(entries), { mode: 'manual' }, limit);
  assert.deepEqual(asked, [limit, limit - MIB - MIB], 'the second export is asked for the limit less the overshoot and a margin');
  assert.equal((entries['revision-history.json'] as Uint8Array).length, 2 * MIB, 'only the archive that fits is written');
  assert.equal(packed.checkpointsLeftOut, 3);
});

test('a history that still cannot fit is refused whole: no partial history and nothing else written', async () => {
  const MIB = 1024 * 1024;
  const { state } = sizedHistory([5 * MIB, 5 * MIB]);
  const zip = new ZipStream({ mtime: NOW });
  await assert.rejects(writeBackupSessions(state, zip, { mode: 'manual' }, 4 * MIB), /No partial history backup was created/);
  assert.deepEqual(Object.keys(unzipSync(await bytesOf(zip.finish()))), [], 'the archive holds nothing from the refused history');
});

test('a sync copy carries no history and no discarded edits; a manual backup carries both', async (context) => {
  fixClock(context);
  const sync = unzipSync(await bytesOf((await exportBackup(deps(fixture()), { mode: 'sync' })).blob));
  assert.equal(sync['revision-history.json'], undefined);
  const syncSlots = (JSON.parse(new TextDecoder().decode(sync['sessions.json']!)) as Array<{ slot: string }>).map(r => r.slot);
  assert.deepEqual(syncSlots, ['design:one', 'qr-code:b'], 'the discarded slot stays on this device');
  const manual = unzipSync(await bytesOf((await exportBackup(deps(fixture()), { mode: 'manual' })).blob));
  assert.ok(manual['revision-history.json']);
  assert.ok((JSON.parse(new TextDecoder().decode(manual['sessions.json']!)) as Array<{ slot: string }>).some(r => r.slot.startsWith('__discarded__:')));
});

test('the streamed archive defaults to keeping integrity only where Web Crypto is present', async () => {
  const archive = streamedArchive({ mtime: NOW });
  await archive.bytes('a.json', new TextEncoder().encode('{}'));
  assert.deepEqual(Object.keys((await archive.integrity()) ?? {}), globalThis.crypto?.subtle ? ['a.json'] : []);
});

test('finishing a backup with the streamed writer takes well under half the memory of the in-memory one', {
  skip: process.env.BENCH === '1' ? false : 'memory guard - set BENCH=1 to run (spawns two measured processes)',
  timeout: 300_000,
}, async () => {
  const { measure } = await import('../scripts/bench-backup-finalise.ts');
  const [memory, stream] = measure(96);
  assert.equal(memory!.archiveMiB, stream!.archiveMiB, 'the same archive size');
  assert.ok(stream!.peakMiB < memory!.peakMiB / 2, `streamed ${stream!.peakMiB} MiB against in-memory ${memory!.peakMiB} MiB`);
});

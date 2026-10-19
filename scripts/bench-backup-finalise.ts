// SPDX-License-Identifier: MPL-2.0
/**
 * bench-backup-finalise - how much memory finishing a portable backup takes, with
 * the streamed archive and with the in-memory one it replaced (plan 203 R4).
 *
 *   node scripts/bench-backup-finalise.ts               # the table, 192 MiB of payload
 *   node scripts/bench-backup-finalise.ts --mib=512     # a larger synthetic library
 *   node scripts/bench-backup-finalise.ts --json        # the same numbers as JSON
 *
 * Each writer runs in a fresh Node process over the same synthetic library: half
 * the payload as uploaded files, a quarter as saved file-operation results and a
 * quarter as revision history JSON, plus a few sessions. The library is built
 * first, from repeated one-mebibyte chunks so building it never peaks, and the
 * resident size is read once it is built. The process then runs exportBackup to
 * the end and delivers the archive the way a download does, reading the Blob as a
 * stream. The figure reported is the peak resident size the operating system
 * recorded (getrusage maxrss) minus that starting point: what finishing the backup
 * cost on top of the library itself. Blob storage lives outside the JavaScript
 * heap, so heap figures alone would miss most of it; the sampled heap and
 * ArrayBuffer peaks above the same point are printed beside that figure. All
 * three include garbage the collector had not yet reclaimed.
 *
 * The in-memory writer holds every part, then the whole ZIP, then a Blob copy of
 * it, so it needs about three times the payload. The streamed writer refers to
 * the uploads and results where they are and holds only chunks, the history's
 * compressed bytes and the headers.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIB = 1024 * 1024;
export type Writer = 'memory' | 'stream';

export interface FinaliseResult {
  writer: Writer;
  payloadMiB: number;
  archiveMiB: number;
  /** Peak resident size above the built library. */
  peakMiB: number;
  /** Sampled peaks of the JavaScript heap and of ArrayBuffer memory (Node keeps Blob
   *  bytes there) above the same starting point, for reference. */
  heapPeakMiB: number;
  arrayBuffersPeakMiB: number;
  ms: number;
}

function noise(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  let x = seed >>> 0;
  for (let i = 0; i < n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; out[i] = x >>> 24; }
  return out;
}

/** A Blob of `mib` mebibytes made from one repeated chunk: no transient full-size buffer. */
function bigBlob(mib: number, seed: number, type: string): Blob {
  const chunk = noise(MIB, seed);
  return new Blob(Array.from({ length: mib }, () => chunk as BlobPart), { type });
}

/** Read a Blob as a stream, the way a download does. */
async function eachChunk(blob: Blob, onChunk: (chunk: Uint8Array) => void): Promise<void> {
  const reader = blob.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    onChunk(value);
  }
}

async function hexOfBlob(blob: Blob): Promise<string> {
  const hash = createHash('sha256');
  await eachChunk(blob, chunk => { hash.update(chunk); });
  return hash.digest('hex');
}

async function library(payloadMiB: number) {
  const assetsMiB = Math.max(1, Math.round(payloadMiB / 2));
  const resultsMiB = Math.max(1, Math.round(payloadMiB / 4));
  const historyMiB = Math.max(1, payloadMiB - assetsMiB - resultsMiB);
  const assets = Array.from({ length: Math.ceil(assetsMiB / 8) }, (_, i) => ({
    id: `user/upload/${i}-bench`, type: 'raster', format: 'png', version: 'v1',
    blob: bigBlob(Math.min(8, assetsMiB - i * 8), i + 1, 'image/png'), meta: { name: `Bench ${i}` },
  }));
  const operations: Array<Record<string, unknown>> = [];
  for (let i = 0; i < Math.ceil(resultsMiB / 8); i++) {
    const output = new File([bigBlob(Math.min(8, resultsMiB - i * 8), 100 + i, 'image/png')], `result-${i}.png`, { type: 'image/png' });
    const facts = { name: `result-${i}.png`, format: 'png', mime: 'image/png', size: output.size, sha256: await hexOfBlob(output) };
    const input = { name: `source-${i}.jpg`, format: 'jpg', mime: 'image/jpeg', size: 10, sha256: 'a'.repeat(64) };
    operations.push({ id: `6b0b1437-f729-4b69-b021-${String(i).padStart(12, '0')}`, state: 'succeeded' as const, input, request: { version: 1 as const, operation: 'convert', target: 'png', options: {} }, createdAt: 100, updatedAt: 200,
      report: { version: 1, operation: 'convert', state: 'succeeded', inputs: [input], outputs: [facts], options: { target: 'png' }, changes: [], findings: [], metadata: 'not-checked', execution: 'device' }, output });
  }
  // Revision history: checkpoints of varied text, so deflate is not flattered by repeats.
  const words = ['launch', 'poster', 'keynote', 'agenda', 'speaker', 'badge', 'stage', 'brand', 'colour', 'layout'];
  const revisions = [];
  let bytes = 0, n = 0;
  while (bytes < historyMiB * MIB) {
    const text = Array.from({ length: 400 }, (_, j) => words[(n * 7 + j * 3) % words.length]! + ((n * 31 + j) % 997)).join(' ');
    const row = { entry: { id: `rev-${n}`, documentId: `doc-${n % 20}`, at: new Date(1.79e12 + n * 60_000).toISOString(), reason: n % 10 ? 'automatic' : 'save', bytes: text.length }, data: { __toolId: 'design', boxes: [{ id: `b${n}`, text }] } };
    bytes += text.length + 200; n++;
    revisions.push(row);
  }
  const archive = { version: 1, documents: [], revisions, recoveries: [] };
  const host = {
    profile: { get: async () => ({ firstname: 'Bench' }), set: async () => {} },
    state: { list: async () => [], load: async () => null, save: async () => {},
      history: { backup: { export: async () => archive, restore: async () => ({ revisions: 0, recoveryDrafts: 0 }) } } },
    assets: { _exportUserAssets: async () => assets, _importUserAsset: async () => {} },
    fileHistory: { export: async () => ({ assetVersions: [], operations, batches: [] }), restore: async () => ({ assetVersions: 0, fileOperations: 0, failedHistory: 0 }) },
  };
  const storage = { getItem: () => null, setItem: () => {} };
  return { host, storage };
}

/** One writer, in this process. Call it from a fresh process (see `measure`). */
export async function runChild(writer: Writer, payloadMiB: number): Promise<FinaliseResult> {
  const gc = (globalThis as { gc?: () => void }).gc;
  const { exportBackup } = await import(pathToFileURL(resolve(ROOT, 'shells/web/src/data-transfer.ts')).href);
  const { memoryArchive } = await import(pathToFileURL(resolve(ROOT, 'shells/web/src/lib/bundle.ts')).href);
  // exportBackup loads these on demand; load them first so module code is not counted.
  for (const lib of ['file-history-backup', 'backup-asset-record', 'zip-stream', 'json-stream', 'zip']) await import(pathToFileURL(resolve(ROOT, `shells/web/src/lib/${lib}.ts`)).href);
  const { host, storage } = await library(payloadMiB);
  gc?.(); gc?.();
  const before = process.memoryUsage();
  const start = before.rss;
  let heapPeak = before.heapUsed, arrayBuffersPeak = before.arrayBuffers;
  const sample = (): void => {
    const m = process.memoryUsage();
    heapPeak = Math.max(heapPeak, m.heapUsed);
    arrayBuffersPeak = Math.max(arrayBuffersPeak, m.arrayBuffers);
  };
  const timer = setInterval(sample, 2);
  const t0 = performance.now();
  const { blob } = await exportBackup({ host, storage }, {}, writer === 'memory' ? memoryArchive() : undefined);
  // Deliver the way a download does: read the archive as a stream.
  let delivered = 0;
  await eachChunk(blob, chunk => { delivered += chunk.length; sample(); });
  const ms = performance.now() - t0;
  clearInterval(timer);
  sample();
  if (delivered !== blob.size) throw new Error('The archive did not read back whole.');
  const peak = process.resourceUsage().maxRSS * 1024;
  return {
    writer, payloadMiB, archiveMiB: +(blob.size / MIB).toFixed(1),
    peakMiB: +(Math.max(0, peak - start) / MIB).toFixed(1),
    heapPeakMiB: +((heapPeak - before.heapUsed) / MIB).toFixed(1), arrayBuffersPeakMiB: +((arrayBuffersPeak - before.arrayBuffers) / MIB).toFixed(1),
    ms: Math.round(ms),
  };
}

/** Both writers, each in its own process so one's peak cannot hide in the other's. */
export function measure(payloadMiB: number): FinaliseResult[] {
  return (['memory', 'stream'] as const).map(writer => {
    const child = spawnSync(process.execPath, ['--expose-gc', '--import', './tests/css-stub.mjs', fileURLToPath(import.meta.url), `--child=${writer}`, `--mib=${payloadMiB}`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * MIB });
    const line = child.stdout.trim().split('\n').at(-1) ?? '';
    if (child.status !== 0 || !line.startsWith('{')) throw new Error(`The ${writer} run failed:\n${child.stderr}`);
    return JSON.parse(line) as FinaliseResult;
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (name: string): string | undefined => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const mib = Number(arg('mib') ?? 192);
  if (!Number.isFinite(mib) || mib < 4) throw new Error('--mib must be at least 4.');
  const child = arg('child');
  if (child === 'memory' || child === 'stream') {
    console.log(JSON.stringify(await runChild(child, mib)));
  } else {
    const results = measure(mib);
    if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
    else {
      console.log(`Backup finalisation, ${mib} MiB of payload (peak resident size above the built library)`);
      console.log('writer   archive MiB   peak MiB   heap peak MiB   ArrayBuffer peak MiB   ms');
      for (const r of results) console.log(`${r.writer.padEnd(8)} ${String(r.archiveMiB).padStart(11)} ${String(r.peakMiB).padStart(10)} ${String(r.heapPeakMiB).padStart(15)} ${String(r.arrayBuffersPeakMiB).padStart(22)} ${String(r.ms).padStart(6)}`);
    }
  }
}

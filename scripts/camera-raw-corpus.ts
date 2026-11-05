// SPDX-License-Identifier: MPL-2.0
/**
 * Pinned camera raw corpus from raw.pixls.us (CC0 files only). Ordinary tests need no download.
 *
 *   node scripts/camera-raw-corpus.ts --fetch    download and verify the files into plans/corpora/camera-raw
 *   node scripts/camera-raw-corpus.ts            decode every file and print a report
 *   node scripts/camera-raw-corpus.ts --json     the same report as JSON
 *
 * A requested run fails when the corpus is absent. The files are never committed.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { createCameraRawKernel, CameraRawError, type CameraRawImage } from '../packages/node-shell/src/camera-raw.ts';

interface Entry { path: string; url: string; sha256: string; make: string; model: string; format: string; mode: string; licence: string }
interface Manifest { source: string; files: Entry[] }
const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(join(root, 'scripts/data/camera-raw-corpus-manifest.json'), 'utf8')) as Manifest;
const cache = resolve(root, process.argv.find(s => s.startsWith('--dir='))?.slice(6) ?? 'plans/corpora/camera-raw');
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const MAX_TOTAL = 150 * 1024 * 1024;

for (const f of manifest.files) {
  if (!/^[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9]+$/.test(f.path) || !/^[a-f0-9]{64}$/.test(f.sha256) || f.licence !== 'CC0-1.0' || !f.url.startsWith('https://raw.pixls.us/getfile.php/')) throw new Error(`Invalid corpus recipe entry: ${f.path}`);
}

async function verified(f: Entry): Promise<Uint8Array> {
  const bytes = new Uint8Array(await readFile(join(cache, f.path)));
  if (digest(bytes) !== f.sha256) throw new Error(`Corpus checksum mismatch: ${f.path}`);
  return bytes;
}

if (process.argv.includes('--fetch')) {
  let total = 0;
  for (const f of manifest.files) {
    let bytes: Uint8Array | undefined;
    try { bytes = await verified(f); } catch { /* Fetch missing or changed fixtures. */ }
    if (!bytes) {
      const response = await fetch(f.url, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`Corpus download failed (${response.status}): ${f.path}`);
      bytes = new Uint8Array(await response.arrayBuffer());
      if (digest(bytes) !== f.sha256) throw new Error(`Corpus download checksum mismatch: ${f.path}`);
      const dest = join(cache, f.path); await mkdir(dirname(dest), { recursive: true }); await writeFile(dest, bytes);
    }
    total += bytes.length;
    if (total > MAX_TOTAL) throw new Error('The camera raw corpus is over its 150 MB budget.');
  }
  console.log(`Fetched and verified ${manifest.files.length} CC0 raw files (${(total / 1048576).toFixed(1)} MB) into ${cache}.`);
  process.exit(0);
}

// ---- report ----
const wasm = new Uint8Array(await readFile(join(root, 'packages/node-shell/wasm/camera-raw/camera-raw.wasm')));

function lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (0.4360747 * R + 0.3850649 * G + 0.1430804 * B) / 0.9642, Y = 0.2225045 * R + 0.7168786 * G + 0.0606169 * B, Z = (0.0139322 * R + 0.0971045 * G + 0.7141733 * B) / 0.8249;
  const f = (t: number) => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
/** Box-reduce an RGBA picture to a w x h grid of mean colours. */
function grid(img: CameraRawImage, w: number, h: number): Float64Array {
  const out = new Float64Array(w * h * 3), src = img.rgba8!;
  for (let gy = 0; gy < h; gy++) for (let gx = 0; gx < w; gx++) {
    const x0 = Math.floor(gx * img.width / w), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * img.width / w));
    const y0 = Math.floor(gy * img.height / h), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * img.height / h));
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y += Math.max(1, (y1 - y0) >> 2)) for (let x = x0; x < x1; x += Math.max(1, (x1 - x0) >> 2)) { const i = (y * img.width + x) * 4; r += src[i]!; g += src[i + 1]!; b += src[i + 2]!; n++; }
    out.set([r / n, g / n, b / n], (gy * w + gx) * 3);
  }
  return out;
}
/** Mean CIE76 colour difference between two pictures of (nearly) the same framing, on a 96-cell grid. */
function meanDeltaE(a: CameraRawImage, b: CameraRawImage): number | null {
  const ratio = (a.width / a.height) / (b.width / b.height);
  if (ratio < 0.97 || ratio > 1.03) return null;
  const w = 96, h = Math.max(1, Math.round(w * a.height / a.width));
  const ga = grid(a, w, h), gb = grid(b, w, h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const p = lab(ga[i * 3]!, ga[i * 3 + 1]!, ga[i * 3 + 2]!), q = lab(gb[i * 3]!, gb[i * 3 + 1]!, gb[i * 3 + 2]!);
    sum += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }
  return sum / (w * h);
}

interface Row { path: string; format: string; model: string; megabytes: number; ok: boolean; error?: string; code?: string; ms?: number; peakMiB?: number; width?: number; height?: number; colour?: string; method?: string; previewOnly?: boolean; fitDeltaE?: number | null; deltaEVsJpeg?: number | null; iso?: number | null; exposure?: number | null; warnings?: number }
const rows: Row[] = [];
for (const f of manifest.files) {
  let bytes: Uint8Array;
  try { bytes = await verified(f); } catch (e) { throw new Error(`${f.path} is missing or changed: run with --fetch first. ${(e as Error).message}`); }
  const row: Row = { path: f.path, format: f.format, model: `${f.make} ${f.model}`, megabytes: +(bytes.length / 1048576).toFixed(1), ok: false };
  const kernel = await createCameraRawKernel(wasm);
  const t0 = performance.now();
  try {
    const shown = kernel.open(bytes, 'best');
    row.ms = Math.round(performance.now() - t0);
    row.peakMiB = Math.round(kernel.memoryBytes / 1048576);
    row.ok = true; row.width = shown.width; row.height = shown.height;
    const m = shown.meta;
    Object.assign(row, { colour: m.color.label, method: m.color.method, previewOnly: m.previewOnly, fitDeltaE: m.color.deltaE, iso: m.iso, exposure: m.exposureTime, warnings: m.warnings.length });
    if (f.format !== 'DNG' && !m.previewOnly) {
      const jpeg = (await createCameraRawKernel(wasm)).preview(bytes);
      row.deltaEVsJpeg = meanDeltaE(shown, jpeg);
    }
  } catch (error) {
    row.ms = Math.round(performance.now() - t0);
    row.peakMiB = kernel.dead ? undefined : Math.round(kernel.memoryBytes / 1048576);
    row.error = error instanceof Error ? error.message : String(error);
    row.code = error instanceof CameraRawError ? error.code : 'error';
  }
  rows.push(row);
}
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
else {
  console.log('file\tMB\tok\tms\tpeak MiB\tsize\tcolour\tmethod\tfit dE\tdE vs jpeg\tnote');
  for (const r of rows) console.log([r.path, r.megabytes, r.ok ? 'yes' : 'NO', r.ms, r.peakMiB, r.width ? `${r.width}x${r.height}` : '', r.colour ?? '', r.method ?? '', r.fitDeltaE?.toFixed(1) ?? '', r.deltaEVsJpeg?.toFixed(1) ?? '', r.previewOnly ? 'preview only' : r.error ?? ''].join('\t'));
}

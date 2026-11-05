// SPDX-License-Identifier: MPL-2.0
/**
 * Pinned public Affinity documents for the Affinity reader. Ordinary tests need no download.
 *
 *   node scripts/affinity-corpus.ts fetch      fetch every file at its pinned commit into plans/corpora/affinity
 *   node scripts/affinity-corpus.ts verify     check the SHA-256 of every fetched file
 *   node scripts/affinity-corpus.ts measure    stage 1 on every file, then stage 2 artboards against the
 *                                              embedded thumbnails; writes plans/artifacts/342/affinity-measure.json
 *
 * The recipe follows vectorcraft's xtask/affinity-corpus.sha256 at 05d5f99. Only repositories whose
 * root licence is MIT, CC0-1.0 or Apache-2.0 are listed, and the files are never committed.
 * The difference is the mean absolute difference per colour channel over the artboard, in percent,
 * after both pictures are scaled to a common size and laid over white.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { loadAffinityKernel } from '../packages/node-shell/src/affinity-node.ts';
import { mapAffinityDocument, type AffinityFrame, type AffinityImage } from '../engine/src/design-map-affinity.ts';
import { compileDesignRow } from '../engine/src/design-draw.ts';
import { designDrawOpSvg, svgEscape } from '../engine/src/design-draw-svg.ts';
import { plainOfDesignText } from '../engine/src/design-text.ts';

interface Entry { name: string; repo: string; commit: string; path: string; licence: string; sha256: string; bytes: number }
const root = resolve(import.meta.dirname, '..');
const dir = join(root, 'plans/corpora/affinity');
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const CORPUS_LIMIT = 150 * 1024 * 1024;

export async function manifest(): Promise<Entry[]> {
  const parsed = JSON.parse(await readFile(join(root, 'scripts/data/affinity-corpus-manifest.json'), 'utf8')) as { files: Entry[] };
  return parsed.files;
}
const isDocument = (e: Entry) => /\.(af|afdesign|afphoto|afpub|aftemplate)$/i.test(e.name);

async function verified(e: Entry): Promise<Uint8Array | undefined> {
  try {
    const bytes = new Uint8Array(await readFile(join(dir, e.name)));
    return digest(bytes) === e.sha256 ? bytes : undefined;
  } catch { return undefined; }
}

async function fetchAll(): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entries = await manifest();
  if (entries.reduce((n, e) => n + e.bytes, 0) > CORPUS_LIMIT) throw new Error('The Affinity corpus exceeds 150 MB.');
  for (const e of entries) {
    if (await verified(e)) continue;
    const url = `https://raw.githubusercontent.com/${e.repo}/${e.commit}/${e.path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${e.name}: ${res.status} from ${url}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (digest(bytes) !== e.sha256) throw new Error(`${e.name}: SHA-256 does not match the manifest`);
    await writeFile(join(dir, e.name), bytes);
  }
  console.log(`${entries.length} files verified in ${dir}`);
}

// ── rendering Design rows without a browser ─────────────────────────────────

const dataUri = (png: Uint8Array, mime: string) => `data:${mime};base64,${Buffer.from(png).toString('base64')}`;

function textSvg(row: Record<string, unknown>): string {
  const x = Number(row.x), y = Number(row.y), w = Number(row.w), size = Number(row.fontSize) || 16;
  const lh = (Number(row.lineHeight) || 1.2) * size;
  const align = String(row.align);
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
  const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  const pad = Number(row.pad) || 0;
  const lines = plainOfDesignText(String(row.text ?? '')).split('\n');
  const family = String(row.font || 'sans-serif');
  const fam = family === 'sans' ? 'sans-serif' : family === 'mono' ? 'monospace' : family;
  const tspans = lines.map((l, i) => `<tspan x="${tx + (anchor === 'start' ? pad : anchor === 'end' ? -pad : 0)}" dy="${i === 0 ? size : lh}">${svgEscape(l)}</tspan>`).join('');
  const rot = Number(row.rot) ? ` transform="rotate(${row.rot} ${x + w / 2} ${y + Number(row.h) / 2})"` : '';
  return `<text y="${y + pad}" font-family="${svgEscape(fam)}, sans-serif" font-size="${size}" font-weight="${row.weight}" fill="${svgEscape(String(row.fg))}" text-anchor="${anchor}" opacity="${Number(row.opacity) / 100}"${rot}>${tspans}</text>`;
}

/** A frame as a standalone SVG: rows compiled by the engine, text laid out plainly. */
export function frameSvg(frame: AffinityFrame, images: Map<string, string>): string {
  const parts: string[] = [`<rect width="${frame.width}" height="${frame.height}" fill="${frame.background || '#ffffff'}"/>`];
  for (const row of frame.boxes) {
    if (row.kind === 'text') { parts.push(textSvg(row)); continue; }
    const op = compileDesignRow(row as never, { x: 0, y: 0 }, {});
    parts.push(designDrawOpSvg(op, { assetHref: ref => images.get(ref), family: f => f || 'sans-serif', mono: 'monospace' }));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}">${parts.join('')}</svg>`;
}

function raster(svg: string, width: number, height: number): Uint8Array {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: '#ffffff', font: { loadSystemFonts: true } });
  const out = r.render();
  if (out.width !== width || out.height !== height) {
    const wrapped = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${out.width} ${out.height}" preserveAspectRatio="none"><image width="${out.width}" height="${out.height}" href="${dataUri(out.asPng(), 'image/png')}"/></svg>`, { background: '#ffffff' }).render();
    return new Uint8Array(wrapped.pixels);
  }
  return new Uint8Array(out.pixels);
}

/** Mean absolute channel difference in percent between two same-size RGBA buffers over white. */
export function meanDifference(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const aa = a[i + 3]! / 255, ba = b[i + 3]! / 255;
    for (let c = 0; c < 3; c++) {
      const av = a[i + c]! * aa + 255 * (1 - aa), bv = b[i + c]! * ba + 255 * (1 - ba);
      sum += Math.abs(av - bv);
    }
  }
  return (sum / (n * 3 * 255)) * 100;
}

export interface FileResult {
  file: string; container?: number; stage1?: 'ok' | string; previewSize?: string; artboards?: number; pages?: number;
  stage2?: 'ok' | string; frames?: number; boxes?: number; meanDiffPercent?: number; frameDiffs?: number[]; readMs?: number; mapMs?: number; notes?: number;
}

export async function measureAll(log = false): Promise<{ summary: Record<string, number>; results: FileResult[] }> {
  const kernel = await loadAffinityKernel();
  const results: FileResult[] = [];
  for (const e of (await manifest()).filter(isDocument)) {
    const bytes = await verified(e);
    if (!bytes) throw new Error(`${e.name} is missing or modified; run "node scripts/affinity-corpus.ts fetch"`);
    const r: FileResult = { file: e.name };
    results.push(r);
    let thumb: Uint8Array | undefined, thumbSize: [number, number] | undefined;
    try {
      const info = kernel.inspect(bytes, e.name);
      r.container = info.container; r.stage1 = info.preview ? 'ok' : `no preview: ${info.previewError}`;
      r.artboards = info.document?.artboards; r.pages = info.document?.pages;
      if (info.preview) { r.previewSize = `${info.preview.width}x${info.preview.height}`; thumb = info.preview.png; thumbSize = [info.preview.width, info.preview.height]; }
    } catch (error) { r.stage1 = `FAILED: ${(error as Error).message}`; continue; }
    try {
      const t0 = performance.now();
      const { model, payload } = kernel.model(bytes);
      r.readMs = Math.round(performance.now() - t0);
      const images = new Map<string, string>();
      let n = 0;
      const t1 = performance.now();
      const result = await mapAffinityDocument(model, {
        image: (img: AffinityImage) => {
          const id = `img${n++}`;
          const data = payload.subarray(img.data!.o, img.data!.o + img.data!.l);
          images.set(id, dataUri(data, img.enc === 'jpeg' ? 'image/jpeg' : 'image/png'));
          return { id, type: 'raster' };
        },
      });
      r.mapMs = Math.round(performance.now() - t1);
      r.stage2 = 'ok'; r.frames = result.frames.length; r.boxes = result.frames.reduce((s, f) => s + f.boxes.length, 0); r.notes = result.report.length;
      if (thumb && thumbSize && model.spreads[0]) {
        // The thumbnail shows the first spread. Each frame is compared with its own area of that picture.
        const spread = model.spreads[0];
        const [sx, sy, ex] = spread.bounds;
        const scale = thumbSize[0] / Math.max(1, ex - sx);
        const diffs: number[] = [];
        for (const f of result.frames.filter(x => x.spread === 0)) {
          const origin = { x: f.x, y: f.y };
          const cw = Math.max(1, Math.min(256, Math.round(f.width)));
          const ch = Math.max(1, Math.round(cw * f.height / f.width));
          const mine = raster(frameSvg(f, images), cw, ch);
          const region = `${(origin.x - sx) * scale} ${(origin.y - sy) * scale} ${f.width * scale} ${f.height * scale}`;
          const ref = raster(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="${region}" preserveAspectRatio="none"><rect x="-100000" y="-100000" width="200000" height="200000" fill="#fff"/><image width="${thumbSize[0]}" height="${thumbSize[1]}" href="${dataUri(thumb, 'image/png')}"/></svg>`, cw, ch);
          diffs.push(Math.round(meanDifference(mine, ref) * 100) / 100);
        }
        r.frameDiffs = diffs;
        r.meanDiffPercent = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length * 100) / 100;
      }
    } catch (error) { r.stage2 = `FAILED: ${(error as Error).message}`; }
    if (log) console.log(r.file.padEnd(40), r.stage1 === 'ok' ? 'stage1 ok' : r.stage1, r.stage2 === 'ok' ? `stage2 ok diff=${r.meanDiffPercent ?? '-'}%` : r.stage2);
  }
  const compared = results.filter(r => r.meanDiffPercent !== undefined);
  const frameDiffs = compared.flatMap(r => r.frameDiffs!);
  const summary = {
    files: results.length,
    stage1Opened: results.filter(r => r.stage1 === 'ok').length,
    stage2Mapped: results.filter(r => r.stage2 === 'ok').length,
    comparedFiles: compared.length,
    meanOfFileMeansPercent: Math.round(compared.reduce((a, r) => a + r.meanDiffPercent!, 0) / Math.max(1, compared.length) * 100) / 100,
    meanOfArtboardsPercent: Math.round(frameDiffs.reduce((a, b) => a + b, 0) / Math.max(1, frameDiffs.length) * 100) / 100,
    artboardsCompared: frameDiffs.length,
  };
  return { summary, results };
}

async function measure(): Promise<void> {
  const out = await measureAll(true);
  console.log(out.summary);
  const outDir = join(root, 'plans/artifacts/342');
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'affinity-measure.json'), `${JSON.stringify(out, null, 2)}\n`);
}

if (import.meta.main) {
  const command = process.argv[2] ?? 'verify';
  if (command === 'fetch') await fetchAll();
  else if (command === 'verify') {
    const entries = await manifest();
    const bad: string[] = [];
    for (const e of entries) if (!(await verified(e))) bad.push(e.name);
    if (bad.length) { console.error(`Missing or modified: ${bad.join(', ')}`); process.exit(1); }
    console.log(`${entries.length} files verified`);
  } else if (command === 'measure') await measure();
  else { console.error('Usage: node scripts/affinity-corpus.ts fetch|verify|measure'); process.exit(2); }
}

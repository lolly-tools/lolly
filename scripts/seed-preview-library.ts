#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Seed a browser profile with a library of saved sessions and measure what a list
 * of them costs, before and after the move into the one preview store (plan 373).
 *
 *   node scripts/seed-preview-library.ts --url=http://127.0.0.1:4187 --seed=<dir> \
 *     [--sessions=1000] [--doc-bytes=2048] [--out=report.json]
 *
 * `--url` is a served web shell whose source modules load (the Vite dev server).
 * `--seed` is a folder of pictures: `mix.json` (an array of `{ index, kind }`, kind
 * `svg` or a raster kind) beside `<index>.svg` and `<index>.png`. Each session takes
 * the next picture in turn, so the library has the folder's own mix. A session's
 * picture is written the way builds before plan 373 wrote it: a data URL on the
 * record (percent-encoded SVG for a vector picture, base64 PNG for a raster one).
 *
 * Everything runs in one build, so before and after compare like with like:
 *  1. seed the records in the old shape (the version 27 stores start empty, as
 *     they do after the upgrade on a real device);
 *  2. measure `host.state.list()` (time, bytes handed to the page as JSON, heap
 *     after a forced collection) and the Projects view's first paint and picture
 *     reads, with the idle move held back (`__lollyPreviewMoveHold`);
 *  3. run the move to the end;
 *  4. measure the same again.
 *
 * Reads and prints sizes and times only, never a picture or a label.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name: string, fallback?: string): string | undefined => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const url = arg('url');
const seedDir = arg('seed');
const sessions = Number(arg('sessions', '1000'));
const docBytes = Number(arg('doc-bytes', '2048'));
const out = arg('out');
if (!url || !seedDir) {
  console.error('Usage: node scripts/seed-preview-library.ts --url=<served web shell> --seed=<picture folder> [--sessions=1000] [--doc-bytes=2048] [--out=report.json]');
  process.exit(2);
}

interface MixEntry { index: string; kind: string }
const mix = JSON.parse(readFileSync(join(seedDir, 'mix.json'), 'utf8')) as MixEntry[];
const pictures = mix.map(entry => entry.kind === 'svg'
  ? `data:image/svg+xml,${encodeURIComponent(readFileSync(join(seedDir, `${entry.index}.svg`), 'utf8'))}`
  : `data:image/png;base64,${readFileSync(join(seedDir, `${entry.index}.png`)).toString('base64')}`);

const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--js-flags=--expose-gc'] });
const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => { (globalThis as { __lollyPreviewMoveHold?: boolean }).__lollyPreviewMoveHold = true; });
const page = await context.newPage();

async function measureList(): Promise<{ ms: number; bytes: number; rows: number; withPicture: number; heap: number | null }> {
  return page.evaluate(async () => {
    const [{ openDB }, { createStateAPI }] = await Promise.all([import(String('/src/bridge/db.ts')), import(String('/src/bridge/state.ts'))]);
    const db = await openDB();
    const state = createStateAPI(db);
    const gc = (globalThis as { gc?: () => void }).gc;
    gc?.();
    const t0 = performance.now();
    const rows = await state.list();
    const ms = performance.now() - t0;
    const bytes = new Blob([JSON.stringify(rows)]).size;
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
    const withPicture = rows.filter((row: { thumb?: unknown; preview?: unknown }) => row.thumb || row.preview).length;
    return { ms, bytes, rows: rows.length, withPicture, heap };
  });
}

async function measureProjects(): Promise<{ firstTileMs: number; settledMs: number; pictureReads: number; tiles: number }> {
  const started = Date.now();
  // A fresh load each time (the query string differs from the page before), so the
  // first paint is measured from a cold start of the view.
  await page.goto(`${url}/?measure=${started}#/p`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.folder-tile[data-kind="session"]', { timeout: 120_000 });
  const firstTileMs = Date.now() - started;
  await page.waitForTimeout(1500);
  const settledMs = Date.now() - started;
  const { pictureReads, tiles } = await page.evaluate(async () => {
    const reader = await import(String('/src/components/preview-image.ts'));
    return { pictureReads: reader.pictureReadCount(), tiles: document.querySelectorAll('.folder-tile[data-kind="session"]').length };
  });
  return { firstTileMs, settledMs, pictureReads, tiles };
}

// 1. Seed, on an empty page of the same origin (the app does not boot here).
await page.route(`${url}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>seed</title>' }));
await page.goto(`${url}/`);
const seeded = await page.evaluate(async ({ count, pictures, docBytes }) => {
  const [{ openDB }, { indexSavedWork }] = await Promise.all([import(String('/src/bridge/db.ts')), import(String('/src/bridge/history-index.ts'))]);
  const db = await openDB();
  const filler = 'x'.repeat(Math.max(0, docBytes - 64));
  let pictureBytes = 0;
  for (let start = 0; start < count; start += 200) {
    const tx = db.transaction('state', 'readwrite');
    for (let i = start; i < Math.min(count, start + 200); i++) {
      const thumb = pictures[i % pictures.length]!;
      pictureBytes += thumb.length;
      const at = new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString();
      await tx.store.put(indexSavedWork({
        slot: `poster:${1_700_000_000_000 + i}`, toolId: 'poster', toolVersion: '1.0.0', label: `Seeded ${i}`,
        data: { __toolId: 'poster', __label: `Seeded ${i}`, title: `T${i}`, body: filler }, thumb,
        updatedAt: at, createdAt: at, savedAt: at, formatVersion: 4, engineVersion: '1.349.0',
      }));
    }
    await tx.done;
  }
  return { count, pictureBytes, version: db.version };
}, { count: sessions, pictures, docBytes });
await page.unroute(`${url}/`);

// 2. Before the move.
const beforeList = await measureList();
const beforeProjects = await measureProjects();

// 3. The move, to the end.
await page.goto(`${url}/?move=1#/settings`, { waitUntil: 'domcontentloaded' });
const move = await page.evaluate(async () => {
  const [{ openDB }, list] = await Promise.all([import(String('/src/bridge/db.ts')), import(String('/src/bridge/state-list.ts'))]);
  const db = await openDB();
  const t0 = performance.now();
  await list.migrateSessions(db, { batch: 16 });
  const ms = performance.now() - t0;
  let blobBytes = 0, blobs = 0;
  let cursor = await db.transaction('preview-blobs').store.openCursor();
  while (cursor) { blobBytes += cursor.value.size ?? 0; blobs++; cursor = await cursor.continue(); }
  return { ms, blobs, blobBytes };
});

// 4. After the move.
const afterList = await measureList();
const afterProjects = await measureProjects();
await browser.close();

const report = {
  measuredAt: new Date().toISOString(), url, sessions, docBytes, seed: { pictures: pictures.length, ...seeded },
  before: { list: beforeList, projects: beforeProjects },
  move,
  after: { list: afterList, projects: afterProjects },
};
const text = JSON.stringify(report, null, 2);
if (out) writeFileSync(out, `${text}\n`);
console.log(text);

// SPDX-License-Identifier: MPL-2.0
/**
 * The one preview store (plan 373) in a real Chromium against the web shell's own
 * modules: the writer's encoder rule, the database step from version 26 with a
 * library shaped the way earlier builds left it, the fallback when that step fails,
 * a blocked step, and the Projects tile reading a stored picture.
 *
 * Gated on a served web shell whose source modules load (the CI browser partitions
 * set LOLLY_IMPORT_TEST_URL to the Vite dev server).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_PREVIEW_TEST_URL ?? process.env.LOLLY_IMPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_PREVIEW_TEST_URL or LOLLY_IMPORT_TEST_URL to a local web shell';
if (origin) assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

async function blankPage() {
  const browser = await getBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>preview store</title>' }));
  await page.goto(`${origin}/`);
  return { context, page };
}

/** A database exactly at version 26 with the stores the version 27 step and its
 *  move read, holding pictures the way builds before plan 373 kept them. */
const SEED_V26 = async (png: string) => {
  const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="#0c322c"/></svg>')}`;
  const pngUrl = `data:image/png;base64,${png}`;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('lolly', 26);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      const state = db.createObjectStore('state', { keyPath: 'slot' });
      state.createIndex('toolId', 'toolId'); state.createIndex('updatedAt', 'updatedAt'); state.createIndex('history', 'historyKey');
      for (const name of ['profile', 'asset-blob', 'catalog-meta', 'revision-payloads', 'revision-previews', 'revision-usage', 'revision-recovery-payloads']) db.createObjectStore(name);
      db.createObjectStore('asset-meta', { keyPath: 'id' }); db.createObjectStore('user-assets', { keyPath: 'id' });
      db.createObjectStore('generated-previews', { keyPath: 'toolId' });
      db.createObjectStore('exports', { keyPath: 'id' }).createIndex('history', 'historyKey');
      db.createObjectStore('revision-documents', { keyPath: 'slot' });
      const revisions = db.createObjectStore('revisions', { keyPath: 'id' });
      revisions.createIndex('documentId', 'documentId'); revisions.createIndex('documentTime', ['documentId', 'at', 'id']);
      revisions.createIndex('documentReason', ['documentId', 'reason', 'at', 'id']); revisions.createIndex('time', ['at', 'id']); revisions.createIndex('toolTime', ['toolId', 'at', 'id']);
      const recovery = db.createObjectStore('revision-recovery', { keyPath: 'id' });
      recovery.createIndex('slot', 'slot'); recovery.createIndex('slotTime', ['slot', 'at', 'id']); recovery.createIndex('time', ['at', 'id']);
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['state', 'generated-previews', 'revisions', 'revision-previews', 'exports'], 'readwrite');
      const at = '2026-10-01T00:00:00.000Z';
      tx.objectStore('state').put({ slot: 'poster:1', toolId: 'poster', toolVersion: '1', label: 'Raster', data: { __toolId: 'poster', title: 'a' }, thumb: pngUrl, updatedAt: at, historyKey: [at, 'poster:1', 'poster', 'Raster', ''] });
      tx.objectStore('state').put({ slot: 'poster:2', toolId: 'poster', toolVersion: '1', label: 'Vector', data: { __toolId: 'poster', title: 'b' }, thumb: svg, updatedAt: at, historyKey: [at, 'poster:2', 'poster', 'Vector', ''] });
      tx.objectStore('generated-previews').put({ toolId: 'featured:poster:0:svg', thumb: svg, sig: 'x'.repeat(15000), updatedAt: at });
      tx.objectStore('revisions').put({ id: 'r1', documentId: 'd1', slot: 'poster:1', toolId: 'poster', label: 'Raster', at, reason: 'save', hash: 'h', bytes: 1, assetRefs: [] });
      tx.objectStore('revision-previews').put(pngUrl, 'r1');
      tx.objectStore('exports').put({ id: 'e1', toolId: 'poster', label: 'Poster', filename: 'p.png', format: 'png', thumb: pngUrl, query: '', at: 1 });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
  return { pngUrl, svg };
};

test('the writer: a photo-like raster is lossy WebP, thin saturated lines go lossless, an SVG over the limit becomes a vector-sharp raster', { skip, timeout: 90_000 }, async () => {
  const { context, page } = await blankPage();
  try {
    const result = await page.evaluate(async () => {
      const writer = await import(String('/src/lib/preview-writer.ts'));
      // The image chunk inside the RIFF: 'VP8 ' is lossy, 'VP8L' lossless (a 'VP8X'
      // header, written when the canvas has alpha, comes first and is skipped).
      const chunk = (bytes: Uint8Array) => {
        let at = 12;
        while (at + 8 <= bytes.length) {
          const name = String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
          if (name === 'VP8 ' || name === 'VP8L') return name;
          const size = bytes[at + 4]! | (bytes[at + 5]! << 8) | (bytes[at + 6]! << 16) | (bytes[at + 7]! << 24);
          at += 8 + size + (size & 1);
        }
        return '';
      };
      const photo = document.createElement('canvas'); photo.width = 720; photo.height = 480;
      const p = photo.getContext('2d')!;
      const g = p.createLinearGradient(0, 0, 720, 480); g.addColorStop(0, '#2c5f8a'); g.addColorStop(1, '#f2c14e'); p.fillStyle = g; p.fillRect(0, 0, 720, 480);
      // Soft, low-saturation detail, the way a photograph's colour varies.
      p.filter = 'blur(2px)'; for (let i = 0; i < 1500; i++) { p.fillStyle = `hsla(${(i * 37) % 360},25%,${40 + (i % 30)}%,0.2)`; p.beginPath(); p.arc((i * 97) % 720, (i * 53) % 480, 8 + (i % 14), 0, 6.3); p.fill(); } p.filter = 'none';
      const photoPicture = await writer.rasterPicture(photo);
      const lines = document.createElement('canvas'); lines.width = 720; lines.height = 480;
      const l = lines.getContext('2d')!;
      l.fillStyle = '#10171c'; l.fillRect(0, 0, 720, 480); l.strokeStyle = '#00c2ff'; l.lineWidth = 1;
      for (let x = 4; x < 720; x += 12) { l.beginPath(); l.moveTo(x + 0.5, 0); l.lineTo(x + 0.5, 480); l.stroke(); }
      const linePicture = await writer.rasterPicture(lines);
      let big = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">';
      for (let i = 0; big.length < 300_000; i++) big += `<rect x="${(i * 7) % 320}" y="${(i * 11) % 240}" width="3" height="3" fill="#${(i * 2654435761 >>> 8).toString(16).padStart(6, '0').slice(0, 6)}"/>`;
      big += '</svg>';
      const kept = await writer.svgPicture(big);
      const raster = await writer.rasterPicture(new Blob([big], { type: 'image/svg+xml' }), { vector: true });
      return {
        photo: { type: photoPicture?.ref.type, chunk: photoPicture ? chunk(photoPicture.bytes) : '', bytes: photoPicture?.bytes.length, route: photoPicture?.ref.route },
        lines: { type: linePicture?.ref.type, chunk: linePicture ? chunk(linePicture.bytes) : '' },
        big: { kept: !!kept, type: raster?.ref.type, width: raster?.ref.width, height: raster?.ref.height },
      };
    });
    assert.equal(result.photo.type, 'image/webp');
    assert.equal(result.photo.chunk, 'VP8 ', 'lossy WebP for a photo-like picture');
    assert.equal(result.photo.route, 'export-raster');
    assert.ok(result.photo.bytes! < 256 * 1024);
    assert.equal(result.lines.type, 'image/webp');
    assert.equal(result.lines.chunk, 'VP8L', 'thin saturated lines on a dark ground stay lossless: lossy WebP dulls them');
    assert.equal(result.big.kept, false, 'an SVG over 256 KiB is not kept as SVG');
    assert.equal(result.big.type, 'image/webp');
    assert.deepEqual([result.big.width, result.big.height], [720, 540], 'drawn at the full tile size because the source is vector');
  } finally { await context.close(); await closeBrowser(); }
});

test('version 26 to 27: the step adds empty stores and drops the old render cache; the idle move then keeps every picture', { skip, timeout: 90_000 }, async () => {
  const { context, page } = await blankPage();
  try {
    const result = await page.evaluate(async (png) => {
      const seed = await (0, eval)(`(${png.seed})`)(png.png) as { pngUrl: string; svg: string };
      const { openDB, DB_VERSION } = await import(String('/src/bridge/db.ts'));
      const db = await openDB();
      const afterUpgrade = { version: db.version, shipped: DB_VERSION, stores: [...db.objectStoreNames], thumbs: (await db.getAll('state')).filter((r: { thumb?: string }) => r.thumb).length, lean: await db.count('state-list') };
      const { createStateAPI } = await import(String('/src/bridge/state.ts'));
      const { createRevisionStore } = await import(String('/src/bridge/revision-history.ts'));
      const state = createStateAPI(db, createRevisionStore(db));
      const beforeMove = (await state.list()).map((r: { thumb?: string }) => r.thumb);
      const list = await import(String('/src/bridge/state-list.ts'));
      await list.migrateSessions(db); await list.migrateRevisionPreviews(db); await list.migrateExportPictures(db);
      const rows = await state.list();
      return {
        afterUpgrade, beforeMove,
        afterMove: await Promise.all(rows.map(async (r: { slot: string; thumb: string | null; preview?: unknown }) => ({ slot: r.slot, thumb: r.thumb, hasRef: !!r.preview, picture: await state.pictureDataUrl!({ slot: r.slot }) }))),
        records: (await db.getAll('state')).map((r: { thumb?: string | null }) => r.thumb ?? null),
        legacyHistory: await db.count('revision-previews'),
        history: !!(await state.history!.preview('r1')),
        exportsRow: await db.get('exports', 'e1'),
        seed,
      };
    }, { png: PNG, seed: SEED_V26.toString() });
    assert.equal(result.afterUpgrade.version, result.afterUpgrade.shipped);
    assert.ok(result.afterUpgrade.stores.includes('preview-blobs') && result.afterUpgrade.stores.includes('state-list'));
    assert.ok(!result.afterUpgrade.stores.includes('generated-previews'), 'the old render cache is dropped, not migrated');
    assert.equal(result.afterUpgrade.thumbs, 2, 'the upgrade itself changes no record');
    assert.equal(result.afterUpgrade.lean, 0, 'and builds no lean row');
    assert.deepEqual(result.beforeMove.sort(), [result.seed.pngUrl, result.seed.svg].sort(), 'until the move, pictures show the old way');
    for (const row of result.afterMove) {
      assert.equal(row.thumb, null); assert.equal(row.hasRef, true);
      assert.equal(row.picture, row.slot === 'poster:1' ? result.seed.pngUrl : result.seed.svg, 'byte for byte the picture it was');
    }
    assert.deepEqual(result.records, [null, null], 'no record keeps a thumb');
    assert.equal(result.legacyHistory, 0, 'History previews moved');
    assert.equal(result.history, true);
    assert.equal(result.exportsRow.thumb, null); assert.ok(result.exportsRow.preview);
  } finally { await context.close(); await closeBrowser(); }
});

test('a version 27 step that fails leaves the app working on the version 26 data, with pictures on the records, and says so', { skip, timeout: 90_000 }, async () => {
  const { context, page } = await blankPage();
  const warnings: string[] = [];
  page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
  try {
    const result = await page.evaluate(async (png) => {
      await (0, eval)(`(${png.seed})`)(png.png);
      // The step fails: creating its first store throws, so the upgrade aborts.
      const create = IDBDatabase.prototype.createObjectStore;
      IDBDatabase.prototype.createObjectStore = function (name: string, options?: IDBObjectStoreParameters) {
        if (name === 'preview-blobs') throw new DOMException('simulated', 'QuotaExceededError');
        return create.call(this, name, options);
      };
      const { openDB } = await import(String('/src/bridge/db.ts'));
      const db = await openDB();
      IDBDatabase.prototype.createObjectStore = create;
      const { createStateAPI } = await import(String('/src/bridge/state.ts'));
      const state = createStateAPI(db);
      const rows = await state.list();
      await state.save('poster:new', { __toolId: 'poster', title: 'new' }, `data:image/png;base64,${png.png}`);
      return { version: db.version, stores: [...db.objectStoreNames], rows: rows.length, kept: (await db.get('state', 'poster:new'))?.thumb };
    }, { png: PNG, seed: SEED_V26.toString() });
    assert.equal(result.version, 26, 'opened as it was');
    assert.ok(!result.stores.includes('preview-blobs'));
    assert.ok(result.stores.includes('generated-previews'), 'nothing was dropped');
    assert.equal(result.rows, 2, 'every session lists');
    assert.equal(result.kept, `data:image/png;base64,${PNG}`, 'a new save keeps its picture the old way');
    assert.ok(warnings.some(text => /version 27 did not run/.test(text)), 'the log says so');
  } finally { await context.close(); await closeBrowser(); }
});

test('a blocked step waits without writing: the version 26 data stays intact and opens once the other tab lets go', { skip, timeout: 120_000 }, async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const holder = await context.newPage();
    await holder.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>holder</title>' }));
    await holder.goto(`${origin}/`);
    await holder.evaluate(async (png) => {
      await (0, eval)(`(${png.seed})`)(png.png);
      // An old tab that never answers the version change.
      await new Promise<void>((resolve) => {
        const request = indexedDB.open('lolly', 26);
        request.onsuccess = () => { (globalThis as { held?: IDBDatabase }).held = request.result; request.result.onversionchange = () => {}; resolve(); };
      });
    }, { png: PNG, seed: SEED_V26.toString() });
    const page = await context.newPage();
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>blocked</title>' }));
    await page.goto(`${origin}/`);
    const blocked = await page.evaluate(async () => {
      const { openDB } = await import(String('/src/bridge/db.ts'));
      try { await openDB(); return 'opened'; } catch (error) { return (error as { code?: string }).code ?? String(error); }
    });
    assert.ok(['DB_BLOCKED', 'DB_OPEN_TIMEOUT'].includes(blocked), `the step waits rather than open around the other tab (${blocked})`);
    const intact = await holder.evaluate(async () => {
      const db = (globalThis as { held?: IDBDatabase }).held!;
      const count = await new Promise<number>((resolve) => { const r = db.transaction('state').objectStore('state').count(); r.onsuccess = () => resolve(r.result); });
      db.close();
      return count;
    });
    assert.equal(intact, 2, 'nothing was written while it waited');
    const opened = await page.evaluate(async () => {
      const { openDB } = await import(String('/src/bridge/db.ts'));
      const db = await openDB();
      return { version: db.version, count: await db.count('state') };
    });
    assert.equal(opened.count, 2);
    assert.ok(opened.version >= 27);
  } finally { await context.close(); await closeBrowser(); }
});

test('Projects reads a stored picture into the tile as it comes near the screen, and the calmed-pictures rule still reaches it', { skip, timeout: 180_000 }, async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>seed</title>' }));
    await page.goto(`${origin}/`);
    await page.evaluate(async (png) => {
      const [{ openDB }, { createStateAPI }] = await Promise.all([import(String('/src/bridge/db.ts')), import(String('/src/bridge/state.ts'))]);
      const state = createStateAPI(await openDB());
      await state.save('poster:1700000000000', { __toolId: 'poster', __label: 'Stored picture', title: 'a' }, `data:image/png;base64,${png}`);
    }, PNG);
    await page.unroute(`${origin}/`);
    // A query string makes this a real load: the seeding page shares the address.
    await page.goto(`${origin}/?projects#/p`, { waitUntil: 'domcontentloaded' });
    const img = page.locator('.folder-tile[data-ref="poster:1700000000000"] img.tile-cover');
    await img.waitFor({ state: 'attached', timeout: 120_000 });
    await page.waitForFunction(() => !!document.querySelector<HTMLImageElement>('.folder-tile[data-ref="poster:1700000000000"] img.tile-cover')?.getAttribute('src'), undefined, { timeout: 30_000 });
    const result = await img.evaluate((el: HTMLImageElement) => {
      document.documentElement.dataset.a11yPreviews = 'hidden';
      return { src: el.getAttribute('src') ?? '', key: el.dataset.previewKey, filter: getComputedStyle(el.closest('.tile-figure') ?? el).filter + ' / ' + getComputedStyle(el).filter };
    });
    assert.match(result.src, /^blob:/, 'a raster picture is an object URL');
    assert.match(result.key ?? '', /^[0-9a-f]{32}$/);
    assert.match(result.filter, /saturate\(0\.5\) contrast\(0\.5\)/, 'Hide colourful previews still calms the picture, and does not hide the tile');
  } finally { await context.close(); await closeBrowser(); }
});

test('a history-backed session keeps its SVG picture through a backup and a restore on another device, through the sanitiser', { skip, timeout: 90_000 }, async () => {
  const { context, page } = await blankPage();
  try {
    const result = await page.evaluate(async () => {
      const [{ memoryDb }, { createStateAPI }, { createRevisionStore }, backup, store] = await Promise.all([
        import(String('/src/bridge/idb-memory.test-utils.ts')), import(String('/src/bridge/state.ts')), import(String('/src/bridge/revision-history.ts')),
        import(String('/src/lib/backup-sessions.ts')), import(String('/src/bridge/preview-store.ts')),
      ]);
      const device = () => { const { db } = memoryDb(); return createStateAPI(db, createRevisionStore(db)); };
      const laptop = device();
      const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="#0c322c"/><circle cx="32" cy="24" r="10" fill="#30ba78" onclick="alert(1)"/></svg>')}`;
      const picture = await store.preparePicture(svg, 'legacy');
      const cursor = await laptop.history!.current('poster:svg');
      const entry = await laptop.history!.checkpoint('poster:svg', { __toolId: 'poster', title: 'vector' }, { reason: 'save', expectedHead: cursor.head, expectedVersion: cursor.version });
      await laptop.history!.attachPreview(entry.id, picture);
      const files: Record<string, Uint8Array> = {};
      await backup.packBackupSessions(laptop as never, files as never, { mode: 'manual' });
      const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes));
      const sessions = decode(files['sessions.json']!) as Array<{ slot: string; thumb?: string }>;
      const archive = decode(files['revision-history.json']!) as { revisions: Array<{ preview?: string }> };
      const phone = device();
      await backup.restoreBackupSessions(phone as never, files as never, { mode: 'manual' });
      const row = (await phone.list()).find((r: { slot: string }) => r.slot === 'poster:svg') as { preview?: { key: string; type: string; route?: string } } | undefined;
      const url = row?.preview ? await phone.pictureDataUrl!(row.preview) : null;
      const text = url ? decodeURIComponent(url.slice(url.indexOf(',') + 1)) : '';
      return { carried: sessions.find(r => r.slot === 'poster:svg')?.thumb === svg, archivePreviews: archive.revisions.filter(r => r.preview).length,
        type: row?.preview?.type, route: row?.preview?.route, circle: text.includes('<circle'), script: /onclick|alert/.test(text) };
    });
    assert.equal(result.carried, true, 'the SVG rides beside its state in sessions.json');
    assert.equal(result.archivePreviews, 0, 'the archive format is unchanged');
    assert.equal(result.type, 'image/svg+xml', 'restored as SVG');
    assert.equal(result.route, 'received');
    assert.equal(result.circle, true, 'the same picture');
    assert.equal(result.script, false, 'with the event handler the sanitiser removes');
  } finally { await context.close(); await closeBrowser(); }
});

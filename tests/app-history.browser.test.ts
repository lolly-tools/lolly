// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const origin = process.env.LOLLY_HISTORY_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL not set (serve the web shell and point it here)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

test('app History merges providers without skips and lists saved work without reading document values', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>History index</title>' })); await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const paths = ['/src/bridge/db.ts', '/src/bridge/app-history.ts', '/src/bridge/history-index.ts', '/src/bridge/revision-history.ts', '/src/bridge/state.ts'];
      const db = await (await import(paths[0]!)).openDB(), { queryAppHistory } = await import(paths[1]!), { indexSavedWork, indexExport } = await import(paths[2]!);
      const api = (await import(paths[4]!)).createStateAPI(db, (await import(paths[3]!)).createRevisionStore(db));
      const at = '2026-09-08T10:00:00.000Z';
      const context = { folders: [{ id: 'parent', name: 'Café campaign', items: [], createdAt: at, updatedAt: at },
        { id: 'child', parentId: 'parent', name: 'Social', items: [{ type: 'session', ref: 'design:0' }], createdAt: at, updatedAt: at }], tools: [{ id: 'design', name: 'Design studio' }] };
      const tx = db.transaction(['state', 'revisions', 'exports', 'file-operations', 'file-batches'], 'readwrite');
      for (let i = 0; i < 65; i++) {
        const id = String(i).padStart(3, '0');
        await tx.objectStore('state').put(indexSavedWork({ slot: `design:${i}`, toolId: 'design', label: `Poster ${i}`, data: { __export_filename: `Poster ${i}`, large: 'x'.repeat(20_000) }, updatedAt: at, thumb: null }));
        await tx.objectStore('revisions').put({ id, documentId: 'doc', slot: 'design:0', toolId: 'design', label: `Layout ${i}`, at, reason: 'save', hash: 'test', bytes: 0, assetRefs: [], ...(i === 0 ? { milestone: 'Approved' } : {}) });
      }
      for (const slot of ['__trash__:gone', '__ptpl__:template', '__xprefs__:design']) {
        await tx.objectStore('state').put(indexSavedWork({ slot, toolId: 'design', label: 'Hidden', data: {}, updatedAt: at, thumb: null }));
        await tx.objectStore('revisions').put({ id: slot, documentId: slot, slot, toolId: 'design', label: 'Hidden', at, reason: 'save' });
      }
      for (let i = 0; i < 24; i++) await tx.objectStore('exports').put(indexExport({ id: `export${i}`, toolId: 'design', label: 'Export', filename: `Export ${i}`, format: 'png', query: 'hello=world', thumb: null, at: Date.parse(at), ...(i === 0 ? { slot: 'design:0' } : {}) }));
      const input = { name: 'poster.svg', size: 4, mime: 'image/svg+xml' }, request = { version: 1, operation: 'convert', target: 'png', options: {} };
      await tx.objectStore('file-operations').put({ id: 'single', state: 'failed', input, request, createdAt: Date.parse(at), updatedAt: Date.parse(at) });
      await tx.objectStore('file-operations').put({ id: 'member', state: 'succeeded', input, request, createdAt: Date.parse(at), updatedAt: Date.parse(at) });
      await tx.objectStore('file-batches').put({ id: 'batch', request, createdAt: Date.parse(at), leaseUntil: 0, members: [
        { operationId: 'member', source: { facts: input }, report: { state: 'succeeded' } },
        { operationId: 'failed', source: { facts: input }, report: { state: 'failed' } },
        { operationId: 'cancelled', source: { facts: input }, report: { state: 'cancelled' } },
      ] }); await tx.done;
      // Fail the test if listing reaches a document/thumbnail payload, including
      // a value cursor masquerading as metadata pagination.
      const get = IDBObjectStore.prototype.get, getAll = IDBObjectStore.prototype.getAll, openCursor = IDBIndex.prototype.openCursor;
      IDBObjectStore.prototype.get = function (key) { if (['state', 'exports', 'revision-payloads', 'revision-previews'].includes(this.name)) throw new Error(`payload read: ${this.name}`); return get.call(this, key); };
      IDBObjectStore.prototype.getAll = function (...args) { if (['state', 'exports', 'revision-payloads', 'revision-previews'].includes(this.name)) throw new Error(`payload scan: ${this.name}`); return getAll.apply(this, args); };
      IDBIndex.prototype.openCursor = function (...args) { if (['state', 'exports'].includes(this.objectStore.name)) throw new Error(`value cursor: ${this.objectStore.name}`); return openCursor.apply(this, args); };
      const collect = async (view: string) => {
        const rows = []; let before: string | undefined;
        for (let i = 0; i < 15; i++) { const result = await queryAppHistory(db, { view, before }, context); rows.push(...result.entries); if (!result.before) return rows; if (before === result.before) throw new Error('Pagination stalled'); before = result.before; }
        throw new Error('Pagination did not end');
      };
      const recent = await collect('recent'), changes = await collect('changes');
      const project = await queryAppHistory(db, { view: 'changes', project: 'parent', search: 'cafe studio' }, context);
      const named = await queryAppHistory(db, { view: 'milestones' }, context);
      const missingProject = await queryAppHistory(db, { project: 'deleted' }, context);
      IDBObjectStore.prototype.get = get; IDBObjectStore.prototype.getAll = getAll; IDBIndex.prototype.openCursor = openCursor;
      // Reopening changes Recent ordering without changing the payload/head or
      // recording a revision. Moves and deletions update the index atomically.
      const checkpoint = await api.history.checkpoint('design:real', { __toolId: 'design', __label: 'Real', headline: 'Untouched' }, { reason: 'save', expectedHead: null });
      const cursorBefore = await api.history.current('design:real');
      await api.history.open('design:real');
      const cursorAfter = await api.history.current('design:real');
      const reopened = await db.get('state', 'design:real');
      await api.history.move('design:real', '__trash__:design:real');
      const trashed = await queryAppHistory(db, { search: 'Real' }, context);
      await api.history.move('__trash__:design:real', 'design:restored');
      const restored = await queryAppHistory(db, { search: 'Real' }, context);
      await api.delete('design:restored');
      const deleted = await queryAppHistory(db, { search: 'Real' }, context);
      return { recent, changes, project, named, missingProject, cursorBefore, cursorAfter, reopened, checkpoint, trashed, restored, deleted };
    });
    assert.equal(result.recent.length, 65); assert.equal(result.changes.length, 91);
    assert.equal(new Set(result.changes.map((row: { id: string }) => row.id)).size, 91);
    assert.ok(result.changes.every((row: { title: string }) => row.title !== 'Hidden'));
    assert.equal(result.changes.filter((row: { kind: string }) => row.kind === 'operation').length, 1);
    assert.deepEqual(result.changes.find((row: { kind: string }) => row.kind === 'batch').counts, { succeeded: 1, partially_succeeded: 0, failed: 1, cancelled: 1, pending: 0 });
    assert.ok(result.project.entries.length > 0); assert.ok(result.project.entries.every((row: { project: string; slot: string }) => row.project === 'Café campaign / Social' && row.slot === 'design:0'));
    assert.equal(result.named.entries.length, 1); assert.equal(result.named.entries[0].milestone, 'Approved'); assert.equal(result.missingProject.entries.length, 0);
    assert.deepEqual(result.cursorBefore, result.cursorAfter); assert.equal(result.reopened.data.headline, 'Untouched'); assert.ok(result.reopened.openedAt);
    assert.equal(result.trashed.entries.length, 0); assert.equal(result.restored.entries[0].slot, 'design:restored'); assert.equal(result.deleted.entries.length, 0);
  } finally { await browser.close(); }
});

test('same-time sparse searches continue past 500 candidates and metadata browsing scales to 50,000 creations', { skip, timeout: 90_000 }, async t => {
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })); await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', indexPath = '/src/bridge/history-index.ts', queryPath = '/src/bridge/app-history.ts';
      const db = await (await import(dbPath)).openDB(), { indexSavedWork } = await import(indexPath), { queryAppHistory } = await import(queryPath);
      const tx = db.transaction('state', 'readwrite');
      for (let i = 0; i < 50_000; i++) await tx.store.put(indexSavedWork({ slot: `s${String(i).padStart(5, '0')}`, toolId: 'design', label: i === 48_800 ? 'Needle' : 'Creation', data: {}, thumb: null, updatedAt: '2026-09-08T10:00:00.000Z' }));
      await tx.done;
      const timings = []; const context = { folders: [] };
      for (let i = 0; i < 20; i++) { const start = performance.now(); await queryAppHistory(db, {}, context); timings.push(performance.now() - start); }
      let before: string | undefined; const counts = [], cursors = []; let found: { ref: string } | undefined;
      for (let i = 0; i < 4; i++) { const page = await queryAppHistory(db, { search: 'Needle', before }, context); counts.push(page.entries.length); cursors.push(page.before); before = page.before; if (page.entries.length) { found = page.entries[0]; break; } }
      return { counts, cursors, found, timings };
    });
    assert.deepEqual(result.counts, [0, 0, 1]); assert.equal(new Set(result.cursors).size, 3); assert.equal(result.found?.ref, 's48800');
    const sorted = result.timings.sort((a: number, b: number) => a - b), p95 = sorted[18]!;
    t.diagnostic(`50k saved creations, warm metadata-only Recent p95: ${p95.toFixed(1)} ms (20 samples)`); assert.ok(p95 < 1000);
  } finally { await browser.close(); }
});

test('v23 upgrade preserves saved payloads and download settings while adding metadata keys', { skip, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })); await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const old = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('lolly', 23); request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
          const db = request.result; db.createObjectStore('state', { keyPath: 'slot' }); db.createObjectStore('exports', { keyPath: 'id' });
          for (const name of ['profile', 'asset-meta', 'asset-blob', 'user-assets']) db.createObjectStore(name);
        };
      });
      const tx = old.transaction(['state', 'exports', 'profile'], 'readwrite');
      for (let i = 0; i < 20_000; i++) tx.objectStore('state').put({ slot: `large:${i}`, toolId: 'design', label: `Legacy ${i}`, data: { body: 'x'.repeat(2048) }, updatedAt: '2025-01-01T00:00:00.000Z', thumb: null });
      tx.objectStore('state').put({ slot: 'legacy', toolId: 'design', label: 'Kept', data: { __export_filename: 'Legacy poster', headline: 'Original', body: 'x'.repeat(100_000) }, thumb: null, updatedAt: '2026-01-01T00:00:00.000Z' });
      tx.objectStore('exports').put({ id: 'download', toolId: 'design', filename: 'poster', label: 'Design', format: 'png', query: 'headline=original', at: 1, thumb: null });
      tx.objectStore('profile').put({ name: 'Keep profile' }, 'test');
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); old.close();
      const dbPath = '/src/bridge/db.ts', queryPath = '/src/bridge/app-history.ts';
      const db = await (await import(dbPath)).openDB();
      return { version: db.version, count: await db.count('state'), saved: await db.get('state', 'legacy'), exported: await db.get('exports', 'download'), profile: await db.get('profile', 'test'), page: await (await import(queryPath)).queryAppHistory(db, {}, { folders: [] }) };
    });
    assert.equal(result.version, 24); assert.equal(result.count, 20_001); assert.equal(result.saved.data.body.length, 100_000); assert.equal(result.saved.data.headline, 'Original');
    assert.equal(result.exported.query, 'headline=original'); assert.equal(result.profile.name, 'Keep profile'); assert.equal(result.page.entries[0].title, 'Kept'); assert.ok(result.exported.historyKey);
  } finally { await browser.close(); }
});

test('History route supports project filters, milestones, right-panel versions, Back and mobile', { skip, timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(origin!, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts', host = (await import(path)).getHostRef();
      const canvas = document.createElement('canvas'); canvas.width = 280; canvas.height = 180; const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#173f37'; ctx.fillRect(0, 0, 280, 180); ctx.fillStyle = '#b7e77b'; ctx.beginPath(); ctx.arc(230, 140, 90, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px sans-serif'; ctx.fillText('Autumn launch', 20, 52); ctx.font = '14px sans-serif'; ctx.fillText('Made for the everyday.', 20, 80);
      const thumb = canvas.toDataURL('image/png');
      for (let i = 0; i < 33; i++) await host.state.save(`design:app-${i}`, { __toolId: 'design', __label: `Campaign study ${i}`, __export_filename: `Campaign study ${i}` }, thumb);
      const first = await host.state.history.checkpoint('design:launch', { __toolId: 'design', __label: 'Autumn launch', headline: 'Made for the everyday.' }, { reason: 'save', expectedHead: null });
      await host.state.history.attachPreview(first.id, thumb); await host.state.history.name(first.id, 'Ready for review');
      const profile = await host.profile.get(); await host.profile.set({ ...profile, folders: [{ id: 'launch', name: 'Autumn campaign', items: [{ type: 'session', ref: 'design:launch' }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] });
      location.hash = '#/history';
    });
    await page.locator('.app-history-row').first().waitFor(); assert.equal(await page.locator('.app-history-row').count(), 30);
    await page.getByRole('button', { name: 'Older', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('.app-history-row').length === 4);
    await page.getByRole('button', { name: 'Newer', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('.app-history-row').length === 30);
    await page.getByRole('combobox', { name: 'Filter by project' }).selectOption('launch'); await page.waitForFunction(() => document.querySelectorAll('.app-history-row').length === 1);
    assert.equal(await page.locator('.app-history-row h3').textContent(), 'Autumn launch');
    await page.getByRole('button', { name: 'Milestones', exact: true }).click(); await page.locator('.app-history-row h3', { hasText: 'Ready for review' }).waitFor();
    await page.getByRole('button', { name: 'Versions', exact: true }).click(); await page.locator('.app-history-detail .revision-history-entry').waitFor();
    await page.getByRole('button', { name: 'Rename milestone', exact: true }).click();
    await page.getByRole('textbox', { name: 'Milestone name' }).fill('Ready for launch');
    await page.getByRole('button', { name: 'Keep milestone', exact: true }).click();
    await page.locator('.app-history-row h3', { hasText: 'Ready for launch' }).waitFor();
    const shots = new URL('../plans/221-history-mockups/', import.meta.url); await mkdir(shots, { recursive: true });
    await page.screenshot({ path: fileURLToPath(new URL('build-app-history-desktop.png', shots)) });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Recent', exact: true }).click(); await page.getByRole('link', { name: 'Resume', exact: true }).click();
    await page.locator('[data-topbar="history"]').waitFor(); await page.goBack(); await page.locator('.app-history-row').first().waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Filter by project' }).inputValue(), 'launch');
    assert.equal(await page.locator('.app-history-row').count(), 1);
    await page.reload({ waitUntil: 'networkidle' }); await page.locator('.app-history-row').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator('.app-history').evaluate(el => el.scrollWidth <= el.clientWidth));
    await page.screenshot({ path: fileURLToPath(new URL('build-app-history-mobile.png', shots)) });
    await page.getByRole('button', { name: 'Versions', exact: true }).click(); await page.locator('.app-history-detail .revision-history-entry').waitFor();
    assert.ok(await page.locator('.revision-history-panel').evaluate(el => el.scrollWidth <= el.clientWidth));
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.app-history-detail .revision-history-panel').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('file History hands off to the exact batch and its retained report and download', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(origin!, { waitUntil: 'networkidle' });
    const id = await page.evaluate(async () => {
      const storePath = '/src/lib/file-operation-store.ts', adapterPath = '/src/lib/file-operation-adapter.ts', savedPath = '/src/lib/saved-file-operation.ts';
      const store = await (await import(storePath)).localFileOperations();
      const { describeFile, runWebFileOperation } = await import(adapterPath), { runSavedFileOperation } = await import(savedPath);
      const request = { version: 1, operation: 'convert', target: 'json', options: {} };
      const files = [new File(['name,value\nLaunch,42'], 'campaign.csv', { type: 'text/csv' }), new File(['a,a\n1,2'], 'duplicate-headers.csv', { type: 'text/csv' })];
      const batch = await store.batches.create(files.map(file => ({ file, outputName: file.name.replace('.csv', '.json') })), request);
      for (let i = 0; i < files.length; i++) {
        const member = batch.members[i], link = { batchId: batch.id, operationId: member.operationId };
        const outcome = await runSavedFileOperation(files[i], request, { store: async () => store, describe: describeFile, execute: runWebFileOperation }, undefined, member.outputName, link);
        await store.batches.complete(link, outcome.report);
      }
      location.hash = '#/history?view=changes'; return batch.id;
    });
    const row = page.locator(`[data-history-id="batch:${id}"]`); await row.waitFor();
    assert.match(await row.innerText(), /1 ready · 1 failed/); assert.equal(await page.locator('.app-history-row').count(), 1);
    await row.getByRole('link', { name: 'View results' }).click();
    const batch = page.locator(`[data-batch-id="${id}"]`); await batch.locator('[data-batch-result]').waitFor();
    assert.equal(await batch.evaluate(el => (el as HTMLDetailsElement).open), true);
    const receipt = page.waitForEvent('download'); await batch.locator('[data-batch-saved-report]').click(); assert.equal(await (await receipt).failure(), null);
    const file = page.waitForEvent('download'); await batch.locator('[data-batch-result]').click(); const downloaded = await file;
    assert.equal(downloaded.suggestedFilename(), 'campaign.json'); assert.equal(await downloaded.failure(), null);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

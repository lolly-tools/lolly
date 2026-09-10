// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const origin = process.env.LOLLY_HISTORY_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL not set (serve the web shell and point it here)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

test('milestones, comparison, filters and bounded paging work in the History panel', { skip, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(`${origin}/#/tool/design`, { waitUntil: 'networkidle' });
    await page.locator('[data-topbar="history"]').waitFor();
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts', panelPath = '/src/components/history-panel.ts';
      const state = (await import(path)).getHostRef().state;
      let head: string | null = null;
      for (let i = 0; i < 35; i++) {
        const entry: { id: string } = await state.history.checkpoint('design:workflow', { __toolId: 'design', __label: `Campaign ${i}`, headline: `Message ${i}` }, { reason: 'save', expectedHead: head });
        head = entry.id;
      }
      (await import(panelPath)).openHistoryPanel({ state, slot: () => 'design:workflow' });
    });
    await page.locator('.revision-history-entry').first().waitFor();
    assert.equal(await page.locator('.revision-history-entry').count(), 30);
    await page.locator('.revision-history-entry').first().getByRole('button', { name: 'Name version', exact: true }).click();
    await page.getByRole('textbox', { name: 'Milestone name' }).fill('Launch approved');
    await page.getByRole('button', { name: 'Keep milestone', exact: true }).click();
    await page.locator('.revision-history-entry strong', { hasText: 'Launch approved' }).waitFor();
    await page.locator('.revision-history-entry').nth(0).getByRole('checkbox', { name: 'Compare', exact: true }).check();
    await page.locator('.revision-history-entry').nth(1).getByRole('checkbox', { name: 'Compare', exact: true }).check();
    await page.getByText('1 change found', { exact: true }).waitFor();
    assert.equal(await page.locator('.revision-history-comparison-pair figure').count(), 2);
    const shots = new URL('../plans/221-history-mockups/', import.meta.url); await mkdir(shots, { recursive: true });
    await page.screenshot({ path: fileURLToPath(new URL('build-history-workflows.png', shots)) });
    await page.getByRole('button', { name: 'Clear comparison' }).click();
    await page.getByRole('button', { name: 'Load older history' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.revision-history-entry').length === 5);
    await page.getByRole('button', { name: 'Newer history' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.revision-history-entry').length === 30);
    await page.getByText('Find a version', { exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search history' }).fill('Launch approved');
    await page.waitForFunction(() => document.querySelectorAll('.revision-history-entry').length === 1);
    await page.getByRole('checkbox', { name: 'Named milestones only' }).check();
    assert.equal(await page.locator('.revision-history-entry strong').textContent(), 'Launch approved');
    const saved = await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts'; const state = (await import(path)).getHostRef().state;
      const page = await state.history.list({ slot: 'design:workflow', milestones: true });
      const entry = page.entries[0];
      return { entry, payload: await state.history.read(entry.id), current: await state.load('design:workflow'), archive: await state.history.backup.export() };
    });
    assert.equal(saved.entry.milestone, 'Launch approved'); assert.equal(saved.entry.reason, 'save');
    assert.equal(saved.payload.__label, 'Campaign 34'); assert.equal(saved.current.__label, 'Campaign 34');
    assert.equal(saved.archive.revisions.find((row: { entry: { id: string } }) => row.entry.id === saved.entry.id).entry.milestone, 'Launch approved');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts', panelPath = '/src/components/history-panel.ts';
      (await import(panelPath)).openHistoryPanel({ state: (await import(path)).getHostRef().state, slot: () => 'design:workflow' });
    });
    await page.getByText('Find a version', { exact: true }).click();
    assert.ok(await page.locator('.revision-history-panel').evaluate(el => el.scrollWidth <= el.clientWidth));
    await page.screenshot({ path: fileURLToPath(new URL('build-history-workflows-mobile.png', shots)) });
  } finally { await browser.close(); }
});

test('50,000 metadata rows retain indexed tool/date paging and bounded free-text continuation', { skip, timeout: 90_000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>History scale</title>' }));
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', queryPath = '/src/bridge/revision-query.ts';
      const db = await (await import(dbPath)).openDB(), { queryRevisions } = await import(queryPath);
      const tx = db.transaction('revisions', 'readwrite');
      const start = Date.parse('2026-01-01T00:00:00Z');
      const requests: Promise<unknown>[] = [];
      for (let i = 0; i < 50_000; i++) requests.push(tx.store.put({ id: `r${String(i).padStart(5, '0')}`, documentId: `d${i % 10}`, slot: `s${i % 10}`,
        toolId: `tool${i % 10}`, at: new Date(start + i * 60_000).toISOString(), label: `Creation ${i}`, reason: 'automatic', hash: 'metadata-fixture', bytes: 0, assetRefs: [] }));
      await Promise.all(requests); await tx.done;
      const timings: number[] = [];
      for (let i = 0; i < 20; i++) { const at = performance.now(); await queryRevisions(db, { toolId: 'tool3', limit: 30 }); timings.push(performance.now() - at); }
      const first = await queryRevisions(db, { toolId: 'tool3', limit: 30 });
      const second = await queryRevisions(db, { toolId: 'tool3', limit: 30, before: first.before });
      const from = '2026-01-20T00:00:00.000Z', to = '2026-01-20T23:59:59.999Z';
      const dated = await queryRevisions(db, { from, to });
      const search = await queryRevisions(db, { search: 'no such milestone' });
      const nextSearch = await queryRevisions(db, { search: 'no such milestone', before: search.before });
      return { timings, first: first.entries, second: second.entries, dated: dated.entries, from, to, search, nextSearch };
    });
    assert.equal(result.first.length, 30); assert.equal(result.second.length, 30);
    assert.ok(result.first.every((entry: { toolId: string }) => entry.toolId === 'tool3'));
    assert.equal(new Set([...result.first, ...result.second].map((entry: { id: string }) => entry.id)).size, 60);
    assert.ok(result.dated.every((entry: { at: string }) => entry.at >= result.from && entry.at <= result.to));
    assert.equal(result.search.entries.length, 0); assert.ok(result.search.before);
    assert.notEqual(result.search.before, result.nextSearch.before);
    const sorted = result.timings.sort((a: number, b: number) => a - b), p95 = sorted[Math.ceil(sorted.length * .95) - 1]!;
    t.diagnostic(`50k metadata rows, Chromium, warm tool-filtered page p95: ${p95.toFixed(1)} ms (20 samples)`);
    assert.ok(p95 < 1000, 'an indexed warm page should not freeze the interface');
  } finally { await browser.close(); }
});

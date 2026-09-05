// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_CONVERT_TEST_URL;
test('durable batches preserve failures, unread cancellations, quota failures and crash windows across reload and backup', { skip: origin ? false : 'no browser origin (set LOLLY_CONVERT_TEST_URL to a running web shell)', timeout: 90_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const otherContext = await browser.newContext();
  const page = await context.newPage(), other = await otherContext.newPage();
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); other.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`${origin}/#/convert`, { waitUntil: 'networkidle' });
    const seeded = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', storePath = '/src/lib/file-operation-store.ts', adapterPath = '/src/lib/file-operation-adapter.ts', savedPath = '/src/lib/saved-file-operation.ts';
      const db = await (await import(dbPath)).openDB();
      const { localFileOperations, FileOperationStore } = await import(storePath);
      const store = await localFileOperations();
      const { describeFile, runWebFileOperation } = await import(adapterPath); const { runSavedFileOperation } = await import(savedPath);
      const request = { version: 1, operation: 'convert', target: 'json', options: {} };
      const files = [new File(['a,b\n1,2'], 'ready.csv', { type: 'text/csv' }), new File(['a,a\n1,2'], 'bad-headers.csv', { type: 'text/csv' }), new File(['x'], 'unread.csv', { type: 'text/csv' }), new File(['a,b\n3,4'], 'quota.csv', { type: 'text/csv' })];
      const batch = await store.batches.create(files.map(file => ({ file, outputName: file.name.replace('.csv', '.json') })), request);
      let noRead = 0;
      for (let i = 0; i < files.length; i++) {
        const controller = new AbortController(); if (i === 2) controller.abort();
        const member = batch.members[i]; const link = { batchId: batch.id, operationId: member.operationId };
        const outcome = await runSavedFileOperation(files[i], request, { store: async () => i === 3 ? new FileOperationStore(db, null, 1) : store,
          describe: async (file: File) => { if (i === 2) noRead++; return describeFile(file); }, execute: runWebFileOperation }, controller.signal, member.outputName, link);
        await store.batches.complete(link, outcome.report);
      }
      const crash = await store.batches.create([{ file: files[0], outputName: 'crash.json' }, { file: files[2], outputName: 'pending.json' }], request);
      const link = { batchId: crash.id, operationId: crash.members[0].operationId };
      // Simulate process loss after successful finish but before batch.complete.
      await runSavedFileOperation(files[0], request, { store: async () => store, describe: describeFile, execute: runWebFileOperation }, undefined, 'crash.json', link);
      crash.leaseUntil = 1; await db.put('file-batches', crash);
      await store.list(); const recovered = await store.batches.list();
      let fenced = false, duplicate = false, activeRemoval = false;
      try { await store.begin(await describeFile(files[2]), request, 1, { batchId: crash.id, operationId: crash.members[1].operationId }); } catch { fenced = true; }
      try { await store.batches.importRecord({ ...batch, leaseUntil: undefined }); } catch { duplicate = true; }
      const active = await store.batches.create([{ file: files[0], outputName: 'active.json' }], request);
      try { await store.batches.remove(active.id); } catch { activeRemoval = true; }
      active.leaseUntil = 1; await db.put('file-batches', active); await store.batches.list(); await store.batches.remove(active.id);
      // Recovery called directly (without store.list) atomically fences a late
      // single-operation finisher and keeps its already measured source digest.
      const late = await store.batches.create([{ file: files[0], outputName: 'late.json' }], request);
      const lateJob = await store.begin(await describeFile(files[0]), request, undefined, { batchId: late.id, operationId: late.members[0].operationId });
      await db.put('file-operations', { ...lateJob, leaseUntil: 1 });
      await store.batches.list();
      const lateOutcome = await runWebFileOperation(files[0], request, undefined, 'late.json');
      let lateRefused = false;
      try { await store.finish(lateJob.id, lateOutcome.report, lateOutcome.output); } catch { lateRefused = true; }
      const lateRecord = await db.get('file-operations', lateJob.id);
      await store.remove(lateJob.id); await store.batches.remove(late.id);
      // Metadata capacity is reserved for unread members, independently of the
      // output byte budget; exhausting it refuses BEFORE creating another batch.
      const pending = [];
      let budgetRefused = false;
      for (let i = 0; i < 4; i++) {
        try { pending.push(await store.batches.create(Array.from({ length: 20 }, (_, j) => ({ file: files[0], outputName: `reserve-${j}.json` })), request)); }
        catch { budgetRefused = true; }
      }
      for (const b of pending) await db.put('file-batches', { ...b, leaseUntil: 1 });
      await store.batches.list(); for (const b of pending) await store.batches.remove(b.id);
      window.dispatchEvent(new Event('lolly:file-operations-changed'));
      return { id: batch.id, crashId: crash.id, firstId: batch.members[0].operationId, noRead, fenced, duplicate, activeRemoval, budgetRefused, lateRefused, lateState: lateRecord.state, lateHash: lateRecord.report.inputs[0].sha256,
        rows: recovered.map((b: { id: string; members: Array<{ report: { state: string }; source: { facts: { sha256?: string } } }> }) => ({ id: b.id, states: b.members.map(m => m.report.state), hashes: b.members.map(m => m.source.facts.sha256) })) };
    });
    assert.equal(seeded.noRead, 0); assert.equal(seeded.fenced, true); assert.equal(seeded.duplicate, true); assert.equal(seeded.activeRemoval, true);
    assert.equal(seeded.budgetRefused, true); assert.equal(seeded.lateRefused, true); assert.equal(seeded.lateState, 'interrupted'); assert.match(seeded.lateHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(seeded.rows.find((b: { id: string }) => b.id === seeded.id)!.states, ['succeeded', 'failed', 'cancelled', 'failed']);
    assert.equal(seeded.rows.find((b: { id: string }) => b.id === seeded.id)!.hashes[2], undefined);
    assert.deepEqual(seeded.rows.find((b: { id: string }) => b.id === seeded.crashId)!.states, ['succeeded', 'failed']);
    await page.reload({ waitUntil: 'networkidle' });
    const batch = page.locator(`[data-batch-id="${seeded.id}"]`); await batch.locator('summary').click();
    assert.equal(await batch.locator('[data-batch-member]').count(), 4);
    const [download] = await Promise.all([page.waitForEvent('download'), batch.locator('[data-batch-saved-report]').click()]);
    const receipt = JSON.parse(await readFile((await download.path())!, 'utf8'));
    assert.deepEqual(receipt.counts, { succeeded: 1, failed: 2, cancelled: 1 });
    assert.equal(receipt.results[3].findings[0].code, 'operation-not-started');
    // A known digest must refuse a different original, even with the same name.
    await batch.locator('[data-batch-retry-file]').first().setInputFiles({ name: 'ready.csv', mimeType: 'text/csv', buffer: Buffer.from('imposter') });
    await page.waitForFunction(() => document.querySelector('[data-batch-status]')?.textContent?.includes('SHA-256 differs'));
    await batch.scrollIntoViewIfNeeded(); await page.screenshot({ path: '/Users/andy/Build/lolly/plans/203-work/batch-recovery-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => document.documentElement.setAttribute('data-a11y-text', 'large'));
    await batch.scrollIntoViewIfNeeded(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: '/Users/andy/Build/lolly/plans/203-work/batch-recovery-mobile.png', fullPage: true });

    await page.goto(`${origin}/#/profile?focus=storage-section`, { waitUntil: 'networkidle' });
    const [backup] = await Promise.all([page.waitForEvent('download'), page.locator('#export-data-btn').click()]);
    const bytes = await readFile((await backup.path())!);
    await other.goto(`${origin}/#/profile?focus=storage-section`, { waitUntil: 'networkidle' });
    await other.locator('#import-data-input').setInputFiles({ name: backup.suggestedFilename(), mimeType: 'application/zip', buffer: bytes });
    await other.locator('[data-scope="import"]').click(); await other.locator('.clear-dialog').waitFor({ state: 'detached' });
    await other.goto(`${origin}/#/convert`, { waitUntil: 'networkidle' });
    const restored = other.locator(`[data-batch-id="${seeded.id}"]`); await restored.locator('summary').click();
    assert.equal(await restored.locator('[data-batch-member]').count(), 4);
    const [result] = await Promise.all([other.waitForEvent('download'), restored.locator('[data-batch-result]').click()]);
    assert.deepEqual(JSON.parse(await readFile((await result.path())!, 'utf8')), [{ a: '1', b: '2' }]);
    // Removing only a result cannot erase batch evidence (nor fabricate bytes).
    await other.evaluate(async id => { const path = '/src/lib/file-operation-store.ts'; await (await (await import(path)).localFileOperations()).remove(id); }, seeded.firstId);
    await restored.locator('[data-batch-result]').click();
    await other.waitForFunction(() => document.querySelector('[data-batch-status]')?.textContent?.includes('no longer on this device'));
    assert.deepEqual(errors, []);
  } finally { await context.close(); await otherContext.close(); await closeBrowser(); }
});

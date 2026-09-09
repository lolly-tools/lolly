// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.LOLLY_HISTORY_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL not set (serve the web shell and point it here)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

test('a guest opens a durable copy without persisting its temporary history', { skip, timeout: 45_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>History copy</title>' }));
    await page.goto(origin!);
    await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', statePath = '/src/bridge/state.ts', historyPath = '/src/bridge/revision-history.ts';
      const panelPath = '/src/components/history-panel.ts', memoryPath = '/src/lib/ephemeral-state.ts', p2pPath = '/src/collab/rtc-history.ts';
      const db = await (await import(dbPath)).openDB();
      const state = (await import(statePath)).createStateAPI(db, (await import(historyPath)).createRevisionStore(db));
      const memory = (await import(memoryPath)).createMemoryStateAPI();
      const collab = (await import(p2pPath)).createP2PCollabHistory({ role: 'observer', host: false });
      collab.capture({ documentId: 'shared', toolId: 'chart', actorId: 'peer', label: 'Guest checkpoint', data: { title: 'Shared values' } });
      await memory.save('chart:temporary', { __toolId: 'chart', title: 'Unsaved guest work' });
      (window as unknown as { guestMemory: typeof memory }).guestMemory = memory;
      (await import(panelPath)).openHistoryPanel({ state: memory, copyState: state, collab });
    });
    await page.locator('.revision-history-entry').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Check assets', exact: true }).count(), 0);
    assert.equal(await page.getByRole('combobox', { name: 'History scope' }).locator('option').count(), 1);
    await page.getByRole('button', { name: 'Open as a copy', exact: true }).click();
    await page.waitForFunction(() => location.hash.includes('/tool/chart'));
    const result = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts';
      const db = await (await import(dbPath)).openDB();
      const memory = (window as unknown as { guestMemory: { list(): Promise<unknown[]> } }).guestMemory;
      return { states: await db.getAll('state'), revisions: await db.getAll('revisions'), drafts: await db.getAll('revision-recovery'), temporary: await memory.list() };
    });
    assert.equal(result.states.length, 1);
    assert.equal(result.states[0].toolId, 'chart');
    assert.equal(result.states[0].data.title, 'Shared values');
    assert.equal(result.states[0].data.__label, 'Guest checkpoint (copy)');
    assert.equal(result.revisions.length, 1);
    assert.equal(result.revisions[0].reason, 'save');
    assert.equal(result.drafts.length, 0);
    assert.equal(result.temporary.length, 1);
    await page.reload();
    assert.equal(await page.evaluate(async () => {
      const path = '/src/bridge/db.ts'; return (await (await import(path)).openDB()).count('state');
    }), 1, 'the explicit copy survives reload');
  } finally { await browser.close(); }
});

test('a collaboration without a history capability never reads private local history', { skip, timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>History scope</title>' }));
    await page.goto(origin!);
    await page.evaluate(async () => {
      const panelPath = '/src/components/history-panel.ts', memoryPath = '/src/lib/ephemeral-state.ts';
      const state = (await import(memoryPath)).createMemoryStateAPI();
      Object.defineProperty(state, 'history', { get() { throw new Error('Private history must not be read'); } });
      (await import(panelPath)).openHistoryPanel({ state, collaborating: true });
    });
    await page.getByText('This collaboration does not provide revision history.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Check assets', exact: true }).count(), 0);
    assert.equal(await page.getByRole('combobox', { name: 'History scope' }).locator('option').count(), 1);
  } finally { await browser.close(); }
});

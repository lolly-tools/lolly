// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import { setTimeout as delay } from 'node:timers/promises';
import type { RevisionEntry } from '../shells/web/src/bridge/revision-history.ts';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const origin = process.env.LOLLY_HISTORY_TEST_URL;
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const shots = new URL('../plans/221-history-mockups/', import.meta.url);
const shot = (name: string): string => fileURLToPath(new URL(name, shots));
async function waitForSavedLabel(page: Page, slot: string, label: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const saved = await page.evaluate(async ({ slot, label }) => {
      const path = '/src/lib/host-ref.ts';
      return (await (await import(path)).getHostRef().state.load(slot))?.__label === label;
    }, { slot, label });
    if (saved) return;
    await delay(100);
  }
  assert.fail(`The protected label did not become ${label}`);
}

test('revision transactions: concurrent writers, paged metadata, previews, quota rollback, slot moves and deletion', { skip: !origin, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', storePath = '/src/bridge/revision-history.ts', statePath = '/src/bridge/state.ts';
      const db = await (await import(dbPath)).openDB();
      const { createRevisionStore } = await import(storePath);
      const { createStateAPI } = await import(statePath);
      const api = createStateAPI(db, createRevisionStore(db));
      const other = createStateAPI(db, createRevisionStore(db));
      const history = api.history;
      const slot = 'design:transaction-test';
      const data = { __toolId: 'design', __label: 'Test creation', text: 'first', asset: { source: 'library', id: 'photo', format: 'png', version: '1' } };
      const first = await history.checkpoint(slot, data, { reason: 'save', expectedHead: null });
      const writes = await Promise.allSettled([
        history.checkpoint(slot, { ...data, text: 'left' }, { reason: 'save', expectedHead: first.id }),
        other.history.checkpoint(slot, { ...data, text: 'right' }, { reason: 'save', expectedHead: first.id }),
      ]);
      const head = await history.head(slot);
      const second = await history.read(head);
      const duplicate = await history.checkpoint(slot, second, { reason: 'save', expectedHead: head });
      const metadata = await history.list({ slot, limit: 1 });
      const older = await history.list({ slot, limit: 1, before: metadata.before });
      const preview = 'data:image/png;base64,AA==';
      await history.attachPreview(first.id, preview);
      const afterOldPreview = await db.get('state', slot);
      await history.attachPreview(head, preview);
      const afterCurrentPreview = await db.get('state', slot);
      const refs = [...await api._getAssetRefs()];
      const usage = await db.get('revision-usage', 'total');
      await db.put('revision-usage', { ...usage, bytes: 256 * 1024 * 1024 }, 'total');
      const quota = await history.checkpoint(slot, { ...data, text: 'must roll back' }, { reason: 'automatic', expectedHead: head }).then(() => false, () => true);
      const afterQuota = await history.head(slot);
      const stateAfterQuota = await api.load(slot);
      await db.put('revision-usage', usage, 'total');
      await history.move(slot, '__trash__:design:transaction-test');
      const moved = await history.list({ slot: '__trash__:design:transaction-test' });
      const oldSlot = await api.load(slot);
      const historicalText = (await history.read(first.id))?.text;
      await history.move('__trash__:design:transaction-test', slot);
      await api.delete(slot);
      return {
        writers: writes.map(result => result.status), firstId: first.id, head, duplicate: duplicate.id,
        metadata: metadata.entries, older: older.entries, historicalText,
        oldPreviewUpdatedState: afterOldPreview.thumb !== null, currentPreview: afterCurrentPreview.thumb,
        refs, quota, afterQuota, stateAfterQuota, moved: moved.entries, oldSlot,
        remaining: (await history.list({ slot })).entries, deletedPayload: await history.read(first.id),
        finalUsage: await db.get('revision-usage', 'total'),
      };
    });
    assert.deepEqual(result.writers.sort(), ['fulfilled', 'rejected']);
    assert.equal(result.duplicate, result.head);
    assert.equal(result.metadata.length, 1); assert.equal(result.older.length, 1);
    assert.notEqual(result.metadata[0].id, result.older[0].id);
    assert.ok(!('data' in result.metadata[0]));
    assert.equal(result.historicalText, 'first');
    assert.equal(result.oldPreviewUpdatedState, false);
    assert.equal(result.currentPreview, 'data:image/png;base64,AA==');
    assert.ok(result.refs.includes('photo:png:1'));
    assert.equal(result.quota, true); assert.equal(result.afterQuota, result.head);
    assert.ok(['left', 'right'].includes(result.stateAfterQuota.text));
    assert.equal(result.oldSlot, null);
    assert.ok(result.moved.every((entry: RevisionEntry) => entry.slot.startsWith('__trash__:')));
    assert.equal(new Set(result.moved.map((entry: RevisionEntry) => entry.documentId)).size, 1);
    assert.deepEqual(result.remaining, []); assert.equal(result.deletedPayload, null);
    assert.deepEqual(result.finalUsage, { bytes: 0, previews: 0 });
  } finally { await browser.close(); }
});

test('Design auto checkpoint, right History tab, and editable file export are wired end to end', { skip: !origin, timeout: 90_000 }, async () => {
  await mkdir(shots, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${origin}/#/tool/design`, { waitUntil: 'networkidle' });
    await page.locator('[data-topbar="history"]').waitFor();
    await page.keyboard.press('Escape');
    const filename = page.locator('[data-topbar="name"]');
    await filename.fill('History build review');
    await page.locator('[data-topbar="history"]').click();
    await page.locator('.revision-history-entry').first().waitFor({ timeout: 15_000 });
    await page.locator('.revision-history-entry img:not([hidden])').first().waitFor({ timeout: 15_000 });
    assert.ok(await page.locator('.revision-history-panel').innerText().then(text => text.includes('History build review')));
    await page.screenshot({ path: shot('build-history-desktop.png') });
    await page.locator('[data-topbar="export"]').click();
    await page.locator('[data-fmt-trigger]').click();
    if (await page.locator('[data-fmt-show-all]').isVisible()) await page.locator('[data-fmt-show-all]').click();
    await page.locator('[data-fmt="lolly"]').click();
    await page.locator('[data-lolly-download]').waitFor({ state: 'visible' });
    assert.ok(await page.locator('.export-share-surface').innerText().then(text => text.includes('Link behaviour')));
    assert.equal(await page.locator('[data-action="download"]').isVisible(), false);
    await page.screenshot({ path: shot('build-export-lolly.png') });
    const download = page.waitForEvent('download');
    await page.locator('[data-lolly-download]').click();
    const file = await download;
    assert.match(file.suggestedFilename(), /\.lolly$/);
    assert.equal(await file.failure(), null);
    const slotBeforeReload = await page.evaluate(() => history.state?.lollyHistory?.slot);
    assert.ok(slotBeforeReload);
    const checkpointBeforeRecovery = await page.evaluate(async slot => {
      const path = '/src/lib/host-ref.ts'; return (await import(path)).getHostRef().state.history.head(slot);
    }, slotBeforeReload);
    await page.locator('[data-topbar="name"]').fill('History recovery review');
    await waitForSavedLabel(page, slotBeforeReload, 'History recovery review');
    assert.equal(await page.evaluate(async slot => {
      const path = '/src/lib/host-ref.ts'; return (await import(path)).getHostRef().state.history.head(slot);
    }, slotBeforeReload), checkpointBeforeRecovery);
    await page.locator('[data-topbar="history"]').click();
    await page.locator('.revision-history-draft').first().waitFor();
    await page.locator('.revision-history-draft strong', { hasText: 'History recovery review' }).waitFor();
    await page.screenshot({ path: shot('build-history-recovery.png') });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-topbar="history"]').waitFor();
    assert.equal(await page.locator('[data-topbar="name"]').inputValue(), 'History recovery review');
    assert.equal(await page.evaluate(() => history.state?.lollyHistory?.slot), slotBeforeReload);
    await page.locator('[data-topbar="name"]').fill('History after reload');
    await waitForSavedLabel(page, slotBeforeReload, 'History after reload');
    assert.equal(await page.evaluate(() => history.state?.lollyHistory?.slot), slotBeforeReload);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-topbar="more"]').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.locator('[data-topbar="more"]').click();
    await page.getByRole('menuitem', { name: 'History', exact: true }).click();
    await page.locator('.revision-history-mobile').waitFor();
    await page.screenshot({ path: shot('build-history-mobile.png') });
    await page.evaluate(async slot => {
      const path = '/src/lib/host-ref.ts', state = (await import(path)).getHostRef().state;
      await state.history.recovery.save(slot, { ...await state.load(slot), __label: 'Recovered branch' }, { writerId: 'copy-test', expectedHead: null, expectedVersion: null });
    }, slotBeforeReload);
    await page.locator('.revision-history-panel').getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.locator('.revision-history-draft', { hasText: 'Recovered branch' }).getByRole('button', { name: 'Open draft as a copy' }).click();
    await page.locator('[data-topbar="name"]').waitFor();
    await page.waitForFunction(previous => history.state?.lollyHistory?.slot && history.state.lollyHistory.slot !== previous, slotBeforeReload);
    assert.equal(await page.locator('[data-topbar="name"]').inputValue(), 'Recovered branch (recovered copy)');
    assert.equal(await page.evaluate(async slot => {
      const path = '/src/lib/host-ref.ts'; return (await (await import(path)).getHostRef().state.load(slot)).__label;
    }, slotBeforeReload), 'History after reload');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('rolling recovery survives reopen, preserves competing edits and keeps the visible history sparse', { skip: !origin, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', historyPath = '/src/bridge/revision-history.ts', statePath = '/src/bridge/state.ts';
      const db = await (await import(dbPath)).openDB();
      const { createRevisionStore } = await import(historyPath), { createStateAPI } = await import(statePath);
      const state = createStateAPI(db, createRevisionStore(db)), history = state.history;
      const slot = 'design:recovery-test', initial = { __toolId: 'design', __label: 'Recovery', text: 'base' };
      const base = await history.checkpoint(slot, initial, { reason: 'save', expectedHead: null });
      let version = base.id;
      for (let i = 0; i < 40; i++) {
        const row = await history.recovery.save(slot, { ...initial, text: `edit ${i}` }, { writerId: 'left', expectedHead: base.id, expectedVersion: version });
        version = row.version;
      }
      const reopened = createStateAPI(db, createRevisionStore(db));
      const restored = await reopened.load(slot);
      const sparse = await history.list({ slot }), rolling = await history.recovery.list({ slot });
      const recoveryUsage = await db.get('revision-usage', 'recovery');
      await db.put('revision-usage', 64 * 1024 * 1024, 'recovery');
      const recoveryQuota = await history.recovery.save(slot, { ...initial, text: 'x'.repeat(2048) }, { writerId: 'left', expectedHead: base.id, expectedVersion: version }).then(() => false, () => true);
      const afterRecoveryQuota = await history.recovery.read('left');
      await db.put('revision-usage', recoveryUsage, 'recovery');
      const historyUsage = await db.get('revision-usage', 'total');
      await db.put('revision-usage', { ...historyUsage, bytes: 256 * 1024 * 1024 }, 'total');
      const protectedWhileFull = await history.recovery.save(slot, restored, { writerId: 'left', expectedHead: base.id, expectedVersion: version });
      version = protectedWhileFull.version;
      await db.put('revision-usage', historyUsage, 'total');
      await history.attachPreview(base.id, 'data:image/png;base64,AA==');
      const wrongPreview = (await db.get('state', slot)).thumb;
      const right = await history.recovery.save(slot, { ...initial, text: 'other tab', asset: { source: 'library', id: 'branch', format: 'png', version: '2' } }, { writerId: 'right', expectedHead: base.id, expectedVersion: base.id });
      const protectedRight = await history.recovery.read('right');
      const currentAfterConflict = await state.load(slot);
      const staleRejected = await history.checkpoint(slot, { ...initial, text: 'stale' }, { reason: 'save', expectedHead: base.id, expectedVersion: base.id }).then(() => false, () => true);
      const next = await history.checkpoint(slot, restored, { reason: 'save', expectedHead: base.id, expectedVersion: version });
      const remainingDrafts = await history.recovery.list({ slot });
      const refs = [...await state._getAssetRefs()];
      const previousVersion = (await history.current(slot)).version;
      const duplicate = await history.checkpoint(slot, restored, { reason: 'save', expectedHead: next.id, expectedVersion: previousVersion });
      const abaRejected = await history.recovery.save(slot, { ...initial, text: 'old token' }, { writerId: 'old-token', expectedHead: next.id, expectedVersion: previousVersion });
      await state.save(slot, { ...initial, text: 'imported current' });
      const draftsAfterImport = await history.recovery.list({ slot });
      const beforeImport = draftsAfterImport.entries.find((row: { id: string }) => row.id.startsWith('before-replacement:'));
      const retained = await history.recovery.read(beforeImport.id);
      await history.move(slot, '__trash__:recovery');
      const movedDrafts = await history.recovery.list({ slot: '__trash__:recovery' });
      await state.delete('__trash__:recovery');
      return { restored, recoveryQuota, afterRecoveryQuota, protectedWhileFull, sparse: sparse.entries.length, rolling: rolling.entries, wrongPreview, right, protectedRight, currentAfterConflict,
        staleRejected, remainingDrafts: remainingDrafts.entries, refs, duplicate: duplicate.id, next: next.id, abaRejected: abaRejected.diverged,
        retained, moved: movedDrafts.entries.length, recoveryBytes: await db.get('revision-usage', 'recovery'),
        deletedDraft: await history.recovery.read('right') };
    });
    assert.equal(result.restored.text, 'edit 39'); assert.equal(result.sparse, 1); assert.equal(result.rolling.length, 1);
    assert.equal(result.recoveryQuota, true); assert.equal(result.afterRecoveryQuota.text, 'edit 39'); assert.equal(result.protectedWhileFull.diverged, false);
    assert.ok(!('data' in result.rolling[0])); assert.equal(result.wrongPreview, null);
    assert.equal(result.right.diverged, true); assert.equal(result.protectedRight.text, 'other tab');
    assert.equal(result.currentAfterConflict.text, 'edit 39'); assert.equal(result.staleRejected, true);
    assert.deepEqual(result.remainingDrafts.map((row: { id: string }) => row.id), ['right']);
    assert.ok(result.refs.includes('branch:png:2')); assert.equal(result.duplicate, result.next); assert.equal(result.abaRejected, true);
    assert.equal(result.retained.text, 'edit 39'); assert.equal(result.moved, 3);
    assert.equal(result.recoveryBytes, 0); assert.equal(result.deletedDraft, null);
  } finally { await browser.close(); }
});

test('manual backup round-trips revision IDs, previews and drafts; reimport is idempotent and conflicts roll back', { skip: !origin, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', historyPath = '/src/bridge/revision-history.ts', statePath = '/src/bridge/state.ts', transferPath = '/src/data-transfer.ts';
      const db = await (await import(dbPath)).openDB();
      const { createRevisionStore } = await import(historyPath), { createStateAPI } = await import(statePath);
      const { exportBackup, importBackup } = await import(transferPath);
      const state = createStateAPI(db, createRevisionStore(db)), history = state.history;
      let profileWrites = 0;
      const deps = { host: { state, profile: { get: async () => ({ firstname: 'History' }), set: async () => { profileWrites++; } }, assets: { _exportUserAssets: async () => [], _importUserAsset: async () => {} } }, storage: { getItem: () => null, setItem() {} } };
      const slot = 'design:backup', initial = { __toolId: 'design', __label: 'Backup', text: 'saved' };
      const first = await history.checkpoint(slot, initial, { reason: 'save', expectedHead: null });
      await history.attachPreview(first.id, 'data:image/png;base64,AA==');
      await history.recovery.save(slot, { ...initial, text: 'latest draft' }, { writerId: 'backup-writer', expectedHead: first.id, expectedVersion: first.id });
      const { blob, summary } = await exportBackup(deps);
      const bytes = await blob.arrayBuffer();
      const sync = await exportBackup(deps, { mode: 'sync' });
      const before = await history.backup.export();
      await state.delete(slot);
      await db.put('revision-usage', { bytes: 256 * 1024 * 1024, previews: 0 }, 'total');
      const quotaRejected = await importBackup(deps, bytes).then(() => false, () => true);
      const quotaHead = await history.head(slot), quotaPayload = await history.read(first.id), quotaDraft = await history.recovery.read('backup-writer');
      await db.put('revision-usage', { bytes: 0, previews: 0 }, 'total');
      const restoredSummary = await importBackup(deps, bytes);
      const restored = await history.backup.export();
      const usage = await db.get('revision-usage', 'total');
      const recoveryUsage = await db.get('revision-usage', 'recovery');
      await importBackup(deps, bytes);
      const afterRepeat = await db.get('revision-usage', 'total');
      const repeatRecovery = await db.get('revision-usage', 'recovery');
      const cursor = await history.current(slot);
      const changed = await history.checkpoint(slot, { ...initial, text: 'new target work' }, { reason: 'save', expectedHead: cursor.head, expectedVersion: cursor.version });
      const profileBefore = profileWrites;
      const conflict = await importBackup(deps, bytes).then(() => '', (error: Error) => error.message);
      const profileAfterConflict = profileWrites;
      const afterConflict = await state.load(slot);
      const headAfterConflict = await history.head(slot);
      const malformed = structuredClone(before); malformed.revisions[0].data.text = 'corrupt';
      const corrupt = await history.backup.restore(malformed).then(() => false, () => true);
      const preserved = await history.read(first.id);
      // A snapshot-sync replacement remains separate from history. Its previous
      // working state is protected as a draft and no archive is uploaded.
      await importBackup(deps, await sync.blob.arrayBuffer(), { mode: 'sync' });
      const afterSync = await history.backup.export();
      return { summary, quotaRejected, quotaHead, quotaPayload, quotaDraft, restoredSummary, before, restored, usage, afterRepeat, recoveryUsage, repeatRecovery,
        syncSummary: sync.summary, conflict, afterConflict, headAfterConflict, changed: changed.id, profileBefore, profileAfterConflict,
        corrupt, preserved, afterSync, profileWrites };
    });
    assert.equal(result.summary.revisions, 1); assert.equal(result.summary.recoveryDrafts, 1);
    assert.equal(result.quotaRejected, true); assert.equal(result.quotaHead, null); assert.equal(result.quotaPayload, null); assert.equal(result.quotaDraft, null);
    assert.equal(result.restoredSummary.revisions, 1); assert.equal(result.restoredSummary.skipped, 0);
    assert.deepEqual(result.restored, result.before); assert.deepEqual(result.afterRepeat, result.usage); assert.equal(result.recoveryUsage, result.repeatRecovery);
    assert.equal(result.syncSummary.revisions, undefined); assert.equal(result.syncSummary.recoveryDrafts, undefined);
    assert.match(result.conflict, /conflicts.*existing work was kept/); assert.equal(result.afterConflict.text, 'new target work');
    assert.equal(result.headAfterConflict, result.changed); assert.equal(result.profileAfterConflict, result.profileBefore);
    assert.equal(result.corrupt, true); assert.equal(result.preserved.text, 'saved');
    assert.equal(result.afterSync.revisions.length, 2);
    assert.ok(result.afterSync.recoveries.some((row: { data: { text: string }; diverged: boolean }) => row.diverged && row.data.text === 'new target work'));
  } finally { await browser.close(); }
});

test('the recovery schema upgrade preserves a v21 document and adopts its old head token', { skip: !origin, timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>History migration fixture</title>' }));
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const data = { __toolId: 'design', __label: 'Preserved', text: 'v21 saved work' };
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('lolly', 21);
        open.onupgradeneeded = () => {
          const db = open.result;
          db.createObjectStore('profile'); db.createObjectStore('asset-meta'); db.createObjectStore('asset-blob'); db.createObjectStore('user-assets');
          const state = db.createObjectStore('state', { keyPath: 'slot' }); state.createIndex('updatedAt', 'updatedAt');
          db.createObjectStore('revision-documents', { keyPath: 'slot' });
          const revisions = db.createObjectStore('revisions', { keyPath: 'id' });
          revisions.createIndex('documentId', 'documentId'); revisions.createIndex('documentTime', ['documentId', 'at', 'id']);
          revisions.createIndex('documentReason', ['documentId', 'reason', 'at', 'id']); revisions.createIndex('time', ['at', 'id']);
          db.createObjectStore('revision-payloads'); db.createObjectStore('revision-previews'); db.createObjectStore('revision-usage');
          const tx = open.transaction!;
          tx.objectStore('state').put({ slot: 'legacy', documentId: 'legacy-document', toolId: 'design', label: 'Preserved', data, thumb: null, updatedAt: '2026-09-07T10:00:00.000Z' });
          tx.objectStore('revision-documents').put({ slot: 'legacy', documentId: 'legacy-document', head: 'legacy-head', hash: 'legacy-hash' });
        };
        open.onsuccess = () => { open.result.close(); resolve(); }; open.onerror = () => reject(open.error);
      });
      const dbPath = '/src/bridge/db.ts', historyPath = '/src/bridge/revision-history.ts', statePath = '/src/bridge/state.ts';
      const db = await (await import(dbPath)).openDB();
      const api = (await import(statePath)).createStateAPI(db, (await import(historyPath)).createRevisionStore(db));
      const cursor = await api.history.current('legacy'), saved = await api.load('legacy');
      const draft = await api.history.recovery.save('legacy', { ...data, text: 'after upgrade' }, { writerId: 'migration', expectedHead: cursor.head, expectedVersion: cursor.version });
      return { version: db.version, cursor, saved, draft, current: await api.load('legacy') };
    });
    assert.equal(result.version, 22); assert.deepEqual(result.cursor, { head: 'legacy-head', version: 'legacy-head' });
    assert.equal(result.saved.text, 'v21 saved work'); assert.equal(result.draft.documentId, 'legacy-document');
    assert.equal(result.draft.diverged, false); assert.equal(result.current.text, 'after upgrade');
  } finally { await browser.close(); }
});

// SPDX-License-Identifier: MPL-2.0
/**
 * History's budget (plan 277 P4 section 5, bridge/revision-budget.ts), driven
 * through the real state bridge and revision store over the in-memory IndexedDB,
 * the way revision-discard.test.ts drives the discard: previews go first and the
 * Projects tile keeps its picture, an explicit save is never refused, the
 * per-document cap in both measures, eviction of documents nobody opened, the
 * recovery drafts' limits and sweep, a bounded number of deletions per write, one
 * retry after a QuotaExceededError, and the Storage row's clear-out.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/revision-budget.test.ts
 */
import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { IDBPDatabase } from 'idb';
import { memoryDb } from './idb-memory.test-utils.ts';
import type { SavedStateData, StateDb } from './state.ts';
import type { RevisionEntry } from './revision-history.ts';
import type { RevisionTransaction } from './revision-records.ts';

const { createStateAPI } = await import('./state.ts');
const { createRevisionStore } = await import('./revision-history.ts');
const { createRevisionRecovery } = await import('./revision-recovery.ts');
const { discardUnsaved } = await import('./revision-discard.ts');
const { MAX_REVISION_BYTES } = await import('./revision-limits.ts');
const budget = await import('./revision-budget.ts');
const { createAutomaticHistory } = await import('../views/automatic-history.ts');

const MIN = 60_000, DAY = 86_400_000;
const T0 = Date.parse('2026-09-01T09:00:00.000Z');

/** What `navigator.storage.estimate()` reports; null means no estimate at all. */
function setQuota(quota: number | null): void {
  Object.defineProperty(globalThis.navigator, 'storage', { configurable: true, value: quota === null ? undefined : { estimate: async () => ({ quota, usage: 0 }) } });
  budget.forgetQuotaReading();
}
afterEach(() => { mock.timers.reset(); setQuota(null); });
const clock = (now: number): void => { mock.timers.enable({ apis: ['Date'], now }); };
const at = (ms: number): void => { mock.timers.setTime(ms); };

function device() {
  const { db: memory, stores } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  const state = createStateAPI(db as unknown as StateDb, createRevisionStore(db));
  return { memory, db, stores, state, history: state.history! };
}
type Device = ReturnType<typeof device>;
const qr = (url: string, extra: Record<string, unknown> = {}): SavedStateData => ({ __toolId: 'qr-code', __label: 'Launch', payload: 'url', url, ...extra });
const thumb = (n: number): string => `data:image/png;base64,${'A'.repeat(n)}`;
async function auto(dev: Device, slot: string, data: SavedStateData) {
  const cursor = await dev.history.current(slot);
  return dev.history.checkpoint(slot, data, { reason: 'automatic', expectedHead: cursor.head, expectedVersion: cursor.version });
}
async function save(dev: Device, slot: string, data: SavedStateData) {
  const cursor = await dev.history.current(slot);
  return dev.history.checkpoint(slot, data, { reason: 'save', expectedHead: cursor.head, expectedVersion: cursor.version });
}
const rows = (dev: Device, store: string): Array<Record<string, unknown>> => [...dev.stores.get(store)!.values()].map(row => row.value as Record<string, unknown>);
const revisionsOf = (dev: Device, slot: string): RevisionEntry[] => rows(dev, 'revisions').filter(row => row.slot === slot) as unknown as RevisionEntry[];
const setUsage = (dev: Device, bytes: number, previews = 0): void => { dev.stores.get('revision-usage')!.set(JSON.stringify('total'), { key: 'total', value: { bytes, previews } }); };

test('the budgets follow the quota: 10 % for checkpoints and previews, 2.5 % for recovery, never above the ceilings', () => {
  assert.deepEqual(budget.budgetsForQuota(null), { checkpoints: 256 * 1024 * 1024, previews: 48 * 1024 * 1024, recovery: 64 * 1024 * 1024 });
  assert.deepEqual(budget.budgetsForQuota(100 * 1024 * 1024 * 1024), budget.budgetsForQuota(null), 'a large disk keeps the ceilings');
  assert.deepEqual(budget.budgetsForQuota(1024 * 1024 * 1024), { checkpoints: 107374182, previews: 48 * 1024 * 1024, recovery: 26843545 });
});

test('previews go first: older automatic checkpoints lose their previews, explicit saves and every checkpoint stay', async () => {
  clock(T0); setQuota(60 * 1024);                                   // previews: 6 KiB, eviction past 90 %
  const dev = device();
  const saved = await save(dev, 'qr-code:p', qr('https://example.com/saved'));
  await dev.history.attachPreview(saved.id, thumb(2000));
  const autos: string[] = [];
  for (let i = 1; i <= 3; i++) {
    at(T0 + i * 2 * MIN);
    const entry = await auto(dev, 'qr-code:p', qr(`https://example.com/${i}`));
    await dev.history.attachPreview(entry.id, thumb(2000));
    autos.push(entry.id);
  }
  assert.ok(await dev.history.preview(saved.id), 'an explicit save keeps its preview');
  assert.equal(await dev.history.preview(autos[0]!), null, 'the oldest automatic checkpoint gave its preview up first');
  assert.equal(await dev.history.preview(autos[1]!), null);
  assert.ok(await dev.history.preview(autos[2]!), 'the newest keeps its own');
  assert.deepEqual(revisionsOf(dev, 'qr-code:p').map(row => row.id).sort(), [saved.id, ...autos].sort(), 'no checkpoint was touched');
  assert.equal((await dev.history.usage()).previews, 2 * thumb(2000).length, 'usage counts exactly what is kept');
});

test('the Projects tile keeps its picture when the preview budget has no room', async () => {
  clock(T0); setQuota(10 * 1024);                                   // previews: 1 KiB, a 2 KiB picture never fits
  const dev = device();
  const entry = await auto(dev, 'qr-code:t', qr('https://example.com/t'));
  await dev.history.attachPreview(entry.id, thumb(2000));
  assert.equal(await dev.history.preview(entry.id), null, 'History has no room for the preview');
  assert.equal((await dev.state.list()).find(row => row.slot === 'qr-code:t')?.thumb, thumb(2000), 'the tile is not history: it has its picture');
  assert.equal((await dev.history.usage()).previews, 0);
});

test('the tile keeps its last picture through later drafts and checkpoints until a newer capture replaces it', async () => {
  clock(T0);
  const dev = device();
  const first = await auto(dev, 'qr-code:k', qr('https://example.com/1'));
  await dev.history.attachPreview(first.id, thumb(100));
  at(T0 + 2 * MIN);
  const cursor = await dev.history.current('qr-code:k');
  await dev.history.recovery.save('qr-code:k', qr('https://example.com/2'), { writerId: 'tab', expectedHead: cursor.head, expectedVersion: cursor.version });
  const second = await auto(dev, 'qr-code:k', qr('https://example.com/2'));
  const tile = async (): Promise<string | null | undefined> => (await dev.state.list()).find(row => row.slot === 'qr-code:k')?.thumb;
  assert.equal(await tile(), thumb(100), 'a tool closed before its capture arrived still leaves a picture');
  await dev.history.attachPreview(second.id, thumb(120));
  assert.equal(await tile(), thumb(120));
});

test('an explicit save is never refused by a full budget: it is written as the current state, and no revision is recorded', async () => {
  clock(T0);
  const dev = device();
  const first = await save(dev, 'qr-code:s', qr('https://example.com/saved'));
  await dev.history.attachPreview(first.id, thumb(40));
  setUsage(dev, MAX_REVISION_BYTES);
  at(T0 + 2 * MIN);
  await assert.rejects(auto(dev, 'qr-code:s', qr('https://example.com/automatic')), /History storage is full/, 'an automatic checkpoint may be refused');
  const result = await save(dev, 'qr-code:s', qr('https://example.com/saved-again'));
  assert.equal(result.skipped, true);
  assert.equal((await dev.state.load('qr-code:s'))?.url, 'https://example.com/saved-again', 'the save reached the record');
  assert.deepEqual(revisionsOf(dev, 'qr-code:s').map(row => row.id), [first.id], 'no revision was recorded');
  const opened = await dev.history.open('qr-code:s');
  assert.equal(opened.unsaved, false, 'the record counts as saved');
  assert.equal(opened.adopt, true, 'and the next editor that can records it');
  assert.equal((await dev.state.list()).find(row => row.slot === 'qr-code:s')?.thumb, thumb(40), 'the tile keeps the picture it had');
  assert.equal((await dev.history.discard('qr-code:s')).outcome, 'unchanged', 'Leave without saving has nothing newer to undo');

  // The same through the editor's controller, for a creation that has no history yet.
  const stored: string[] = [];
  let slot: string | null = null;
  const controller = createAutomaticHistory({
    history: dev.history, toolId: 'qr-code', getSlot: () => slot, setSlot: next => { slot = next; }, snapshot: () => qr('https://example.com/new'),
    load: s => dev.state.load(s), capture: async () => null, saved() { stored.push('saved'); }, store: (s, data) => dev.state.save(s, data),
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(await controller.save('qr-code:new', qr('https://example.com/new')), 'stored', 'Save succeeds');
  assert.equal((await dev.state.load('qr-code:new'))?.url, 'https://example.com/new');
  assert.equal(controller.activity(), 'paused');
  assert.match(controller.status(), /History is paused for this creation\. History storage is full, so this save is not kept as a version/);
  controller.dispose();
});

test('the per-document cap counts automatic checkpoints in deflated and expanded bytes; past it the last hour keeps one per ten minutes', () => {
  const now = T0;
  const row = (i: number, when: number, extra: Partial<RevisionEntry> = {}): RevisionEntry => ({ id: `r${i}`, documentId: 'd', slot: 's', parentId: null, toolId: 'qr-code', label: 'L',
    at: new Date(when).toISOString(), reason: 'automatic', hash: `h${i}`, bytes: 10, stored: 10, assetRefs: [], ...extra });
  const left = (entries: RevisionEntry[], fresh: string, cap: number, keep: string[] = []): string[] => {
    const gone = new Set(budget.planThinning(entries, fresh, now, 64, new Set(keep), cap).map(entry => entry.id));
    return entries.map(entry => entry.id).filter(id => !gone.has(id));
  };
  const lastHalfHour = (extra: Partial<RevisionEntry>) => Array.from({ length: 31 }, (_, i) => row(i, now - (30 - i) * MIN, extra));
  // Deflated bytes alone pass the cap (310 of 250): thinned to ten-minute buckets.
  const deflated = left(lastHalfHour({ stored: 10, bytes: 1 }), 'r30', 250);
  assert.ok(deflated.length <= 5 && deflated.includes('r30'), `deflated: ${deflated.length} left`);
  // Expanded bytes alone pass the cap (310 of 250): the same.
  const expanded = left(lastHalfHour({ stored: 1, bytes: 10 }), 'r30', 250);
  assert.ok(expanded.length <= 5 && expanded.includes('r30'), `expanded: ${expanded.length} left`);
  // Under the cap in both measures, minute detail stays.
  assert.equal(left(lastHalfHour({ stored: 1, bytes: 1 }), 'r30', 250).length, 31);
  // Still over after the buckets: the oldest automatic checkpoints go; an explicit save never does, and is not counted.
  const days = [row(9, now - 7 * DAY, { reason: 'save', bytes: 1000, stored: 1000 }),
    ...[6, 5, 4, 3, 2].map(d => row(d, now - d * DAY, { bytes: 100, stored: 100 })), row(0, now, { bytes: 100, stored: 100 })];
  assert.deepEqual(left(days, 'r0', 350).sort(), ['r0', 'r2', 'r3', 'r9'], 'three automatic checkpoints fit the cap beside a large save');
  // The document's head and its last explicit save are never retired, whatever the cap.
  assert.ok(left(days, 'r0', 150, ['r6']).includes('r6'), 'the head stays');
  assert.equal(budget.overDocumentCap([row(1, now, { stored: 5, bytes: 30 })], 20), true, 'expanded alone is enough');
  assert.equal(budget.overDocumentCap([row(1, now, { stored: 30, bytes: 5 })], 20), true, 'deflated alone is enough');
  assert.equal(budget.overDocumentCap([row(1, now, { reason: 'save', stored: 30, bytes: 30 })], 20), false, 'saves are not counted');
});

test('end to end, a document past 24 MiB of expanded history is held under the cap however well it compresses', async () => {
  clock(T0);
  const dev = device();
  const big = 'lorem ipsum dolor sit amet '.repeat(40_000);                  // about 1 MiB, deflates to a few KiB
  for (let i = 0; i < 30; i++) { at(T0 + i * MIN); await auto(dev, 'qr-code:big', { ...qr(`https://example.com/${i}`), notes: big }); }
  const kept = revisionsOf(dev, 'qr-code:big');
  const expanded = kept.reduce((sum, entry) => sum + entry.bytes, 0), stored = kept.reduce((sum, entry) => sum + (entry.stored ?? entry.bytes), 0);
  assert.ok(expanded <= budget.DOCUMENT_CAP, `expanded ${expanded} within the cap`);
  assert.ok(stored < 1024 * 1024, 'though its deflated size never came close');
  assert.ok(kept.length < 30, `thinned: ${kept.length} kept`);
});

test('past 90 % of the budget, documents nobody opened for a month give up their oldest automatic checkpoints; saves, named versions and heads stay', async () => {
  clock(T0 - 40 * DAY);
  const dev = device();
  const old = 'qr-code:old', base = T0 - 40 * DAY;
  const saved = await save(dev, old, qr('https://example.com/o-saved'));
  at(base + 2 * MIN); const a1 = await auto(dev, old, qr('https://example.com/o-1'));
  at(base + 4 * MIN); const a2 = await auto(dev, old, qr('https://example.com/o-2'));
  at(base + 6 * MIN); const named = await auto(dev, old, qr('https://example.com/o-3')); await dev.history.name(named.id, 'Keep me');
  at(base + 8 * MIN); const head = await auto(dev, old, qr('https://example.com/o-4'));
  at(T0); await auto(dev, 'qr-code:new', qr('https://example.com/n-0'));
  const recent = await auto(dev, 'qr-code:recent', qr('https://example.com/r-0'));
  // Just past 90 %: eviction frees space down to 85 %.
  setUsage(dev, Math.floor(0.9 * MAX_REVISION_BYTES));
  at(T0 + 2 * MIN); await auto(dev, 'qr-code:new', qr('https://example.com/n-1'));
  const left = new Set(rows(dev, 'revisions').map(row => row.id));
  assert.ok(!left.has(a1.id) && !left.has(a2.id), 'the unopened document gave up its automatic checkpoints');
  for (const [id, what] of [[saved.id, 'the explicit save'], [named.id, 'the named version'], [head.id, 'the head'], [recent.id, 'a document in use']] as const) assert.ok(left.has(id), `${what} stays`);

  // Oldest first, and no more than the need.
  const again = device();
  at(base);
  await save(again, old, qr('https://example.com/o-saved'));
  at(base + 2 * MIN); const b1 = await auto(again, old, qr('https://example.com/o-1'));
  at(base + 4 * MIN); const b2 = await auto(again, old, qr('https://example.com/o-2'));
  at(base + 6 * MIN); await auto(again, old, qr('https://example.com/o-3'));
  const tx = again.db.transaction(budget.RELIEF_STORES, 'readwrite') as unknown as RevisionTransaction;
  const usage = { bytes: 1_000_000, previews: 0 };
  await budget.evictUnopened(tx, usage, 1, await budget.keptRevisions(tx), null, T0, 256);
  const kept = new Set(rows(again, 'revisions').map(row => row.id));
  assert.ok(!kept.has(b1.id) && kept.has(b2.id), 'one byte needed: only the oldest went');
});

test('protected recovery drafts: at most the newest three per creation, and the History-open sweep clears those older than 30 days', async () => {
  clock(T0);
  const dev = device();
  await save(dev, 'qr-code:r', qr('https://example.com/v0'));
  // Each save from outside the editor (a sync, an import, a rename) keeps the state it replaces as a protected draft.
  for (let i = 1; i <= 5; i++) { at(T0 + i * MIN); await dev.state.save('qr-code:r', qr(`https://example.com/v${i}`)); }
  const protectedDrafts = async (): Promise<string[]> => (await dev.history.recovery.list({ slot: 'qr-code:r' })).entries.filter(e => e.diverged).map(e => e.id);
  assert.equal((await protectedDrafts()).length, 3, 'the newest three are kept');
  const bytes = (await dev.history.usage()).recovery;
  assert.equal(bytes, rows(dev, 'revision-recovery').reduce((sum, row) => sum + Number(row.bytes), 0), 'recovery bytes count exactly what is kept');

  // A never-saved creation discarded at the start, and one discarded a day short of the limit.
  const recovery = createRevisionRecovery(dev.db);
  await auto(dev, 'qr-code:gone', qr('https://example.com/gone'));
  const gone = await discardUnsaved(dev.db, recovery, 'qr-code:gone', T0);
  await auto(dev, 'qr-code:kept', qr('https://example.com/kept'));
  const kept = await discardUnsaved(dev.db, recovery, 'qr-code:kept', T0 + 2 * DAY);

  at(T0 + 31 * DAY);
  await dev.state.save('qr-code:r', qr('https://example.com/recent'));
  await dev.state.save('qr-code:r', qr('https://example.com/recent-2'));
  const result = await dev.history.sweep();
  assert.equal(result.discarded, 1);
  const slots = (await dev.state.list()).map(row => row.slot);
  assert.ok(!slots.includes(gone.slot) && slots.includes(kept.slot), 'the discard older than 30 days went for good; the younger one stays');
  const left = await protectedDrafts();
  assert.equal(left.length, 1, 'only the protected draft younger than 30 days is left');
  assert.equal((await dev.history.usage()).recovery, rows(dev, 'revision-recovery').reduce((sum, row) => sum + Number(row.bytes), 0));
});

test('one write makes a bounded number of deletions; the next writes carry on', async () => {
  clock(T0);
  const dev = device();
  const slot = 'qr-code:b', documentId = 'doc-b', start = T0 - 2 * DAY;
  for (let i = 0; i < 150; i++) {
    const id = `r${i}`;
    dev.stores.get('revisions')!.set(JSON.stringify(id), { key: id, value: { id, documentId, slot, parentId: null, toolId: 'qr-code', label: 'L',
      at: new Date(start + i * MIN).toISOString(), reason: 'automatic', hash: `h${i}`, bytes: 100, stored: 50, assetRefs: [] } });
    dev.stores.get('revision-payloads')!.set(JSON.stringify(id), { key: id, value: { __toolId: 'qr-code' } });
  }
  dev.stores.get('revision-documents')!.set(JSON.stringify(slot), { key: slot, value: { slot, documentId, head: 'r149', hash: 'h149', workingHash: 'h149', version: 'r149', saved: null } });
  await dev.state.save('scratch', qr('https://example.com/scratch'));
  dev.stores.get('state')!.set(JSON.stringify(slot), { key: slot, value: { slot, toolId: 'qr-code', label: 'L', data: qr('https://example.com/old'), thumb: null, updatedAt: new Date(start).toISOString(), documentId } });
  setUsage(dev, 150 * 50);
  await auto(dev, slot, qr('https://example.com/new-1'));
  assert.equal(revisionsOf(dev, slot).length, 151 - budget.DELETIONS_PER_WRITE, 'the first write stopped at the bound');
  at(T0 + 2 * MIN); await auto(dev, slot, qr('https://example.com/new-2'));
  assert.equal(revisionsOf(dev, slot).length, 152 - 2 * budget.DELETIONS_PER_WRITE);
  at(T0 + 4 * MIN); await auto(dev, slot, qr('https://example.com/new-3'));
  assert.equal(revisionsOf(dev, slot).length, 4, 'the next writes finished the thinning: one from that day and the three new');
  const stored = revisionsOf(dev, slot).reduce((sum, entry) => sum + (entry.stored ?? entry.bytes), 0);
  assert.equal((await dev.history.usage()).checkpoints, stored, 'usage stays exact through bounded thinning');
});

test('a QuotaExceededError makes room, previews first, and the write is retried once', async () => {
  clock(T0);
  const dev = device();
  const c1 = await auto(dev, 'qr-code:q', qr('https://example.com/1'));
  await dev.history.attachPreview(c1.id, thumb(100));
  at(T0 + 2 * MIN);
  const c2 = await auto(dev, 'qr-code:q', qr('https://example.com/2'));
  await dev.history.attachPreview(c2.id, thumb(100));
  let failures = 0;
  const original = dev.memory.transaction.bind(dev.memory);
  dev.memory.transaction = (names: string | string[]) => {
    const tx = original(names);
    const objectStore = tx.objectStore.bind(tx);
    tx.objectStore = (name: string) => {
      const store = objectStore(name);
      if (name !== 'revision-payloads' || failures > 0) return store;
      return { ...store, add: async () => { failures++; throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' }); } };
    };
    return tx;
  };
  at(T0 + 4 * MIN);
  const c3 = await auto(dev, 'qr-code:q', qr('https://example.com/3'));
  assert.equal(failures, 1, 'the first attempt hit the quota');
  assert.ok(revisionsOf(dev, 'qr-code:q').some(row => row.id === c3.id), 'the retry wrote the checkpoint');
  assert.equal(await dev.history.preview(c1.id), null, 'room was made from an older automatic preview');
  assert.ok(await dev.history.preview(c2.id), 'the head at the time kept its preview');
  const failing = { failed: false };
  await assert.rejects(budget.retryOnQuota(async () => { throw Object.assign(new Error('again'), { name: 'QuotaExceededError' }); }, async () => { failing.failed = true; }), /again/);
  assert.equal(failing.failed, true, 'only one retry: a second quota error is reported');
});

test('removing automatic checkpoints older than 30 days keeps explicit saves, named versions, heads and recent work', async () => {
  const base = T0 - 40 * DAY;
  clock(base);
  const dev = device();
  const saved = await save(dev, 'qr-code:x', qr('https://example.com/x-saved'));
  at(base + 2 * MIN); const a1 = await auto(dev, 'qr-code:x', qr('https://example.com/x-1'));
  at(base + 4 * MIN); const a2 = await auto(dev, 'qr-code:x', qr('https://example.com/x-2'));
  at(base + 6 * MIN); const named = await auto(dev, 'qr-code:x', qr('https://example.com/x-3')); await dev.history.name(named.id, 'Launch day');
  at(base + 8 * MIN); const head = await auto(dev, 'qr-code:x', qr('https://example.com/x-4'));
  at(T0 - 5 * DAY); const recent = await auto(dev, 'qr-code:y', qr('https://example.com/y-1'));
  at(T0 - 5 * DAY + 2 * MIN); await auto(dev, 'qr-code:y', qr('https://example.com/y-2'));
  at(T0);
  const before = (await dev.history.usage()).checkpoints;
  const result = await dev.history.pruneAutomatic();
  assert.equal(result.removed, 2);
  const left = new Set(rows(dev, 'revisions').map(row => row.id));
  assert.ok(!left.has(a1.id) && !left.has(a2.id), 'the old automatic checkpoints went');
  for (const id of [saved.id, named.id, head.id, recent.id]) assert.ok(left.has(id));
  assert.equal((await dev.history.usage()).checkpoints, before - result.bytes, 'and the space they held is free');
});

test('a write is canonicalised once: the capture hashes like the old pin-then-canonicalise path, pin and all', async () => {
  const { captureRevision, canonicalDocument } = await import('./revision-capture.ts');
  const { canonicalRevisionData, revisionSnapshot, captureSnapshot } = await import('./revision-snapshot.ts');
  const { pinRevisionAssets } = await import('./revision-asset-pins.ts');
  // The pin walk as it was before the single pass, kept here as the reference.
  const legacyPin = (data: SavedStateData): SavedStateData => {
    const copy = canonicalRevisionData(data);
    const walk = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { for (const item of value) walk(item); return; }
      const ref = value as Record<string, unknown>;
      const baked = !!ref.meta && typeof ref.meta === 'object' && (ref.meta as Record<string, unknown>).baked === true;
      if (!baked && ref.source === 'remote' && typeof ref.id === 'string' && /^https?:\/\//i.test(ref.id)) { delete ref.url; delete ref.original; }
      if (ref.source === 'user' && typeof ref.id === 'string' && ref.id.startsWith('user/') && typeof ref.version === 'string' && ref.version
        && typeof ref.format === 'string' && ref.format && ref.pin === undefined) ref.pin = { version: ref.version, format: ref.format };
      for (const item of Object.values(ref)) walk(item);
    };
    walk(copy);
    return canonicalRevisionData(copy);
  };
  const doc: SavedStateData = {
    __toolId: 'design', title: 'Poster', empty: undefined, list: [1, undefined, 'two', { z: 1, a: [true, null] }],
    photo: { source: 'user', id: 'user/photo', version: 'v2', format: 'png', url: 'blob:gone', meta: { name: 'Photo' } },
    pinned: { source: 'user', id: 'user/old', version: 'v1', format: 'jpg', pin: { version: 'v0', format: 'jpg' } },
    remote: { source: 'remote', id: 'https://example.com/a.png', url: 'https://cdn.example.com/a.png', original: { url: 'blob:x' } },
    baked: { source: 'user', id: 'user/baked', version: 'v3', format: 'png', url: 'data:image/png;base64,AA==', meta: { baked: true } },
    library: { source: 'library', id: 'lolly/logo/primary', url: 'https://x/y.svg' },
    boxes: [{ id: 'b1', image: { source: 'user', id: 'user/nested', version: 'v9', format: 'webp' } }],
  };
  const capture = captureRevision(doc);
  assert.equal(capture.json, JSON.stringify(legacyPin(doc)), 'byte for byte, key order included');
  assert.equal(JSON.stringify(pinRevisionAssets(doc)), capture.json);
  assert.equal((await captureSnapshot(capture)).hash, (await revisionSnapshot(legacyPin(doc))).hash, 'so existing checkpoints keep matching');
  assert.equal(JSON.stringify(canonicalDocument(doc)), JSON.stringify(canonicalRevisionData(doc)));
  const proto = JSON.parse('{"__proto__": {"x": 1}, "a": 2}') as SavedStateData;
  assert.deepEqual(Object.keys(canonicalDocument(proto)), ['__proto__', 'a'], 'a __proto__ key stays an own key');
  assert.throws(() => captureRevision({ clip: 'blob:temporary' }), /temporary file/);
});

// ---- Review fixes (adversarial review of P4 phase 1) ---------------------------

test('B1: a save the full budget skips thins nothing, so the head it keeps still exists and backups still work', async () => {
  clock(T0);
  const dev = device();
  const slot = 'qr-code:cap';
  const big = 'x'.repeat(25 * 1024 * 1024);                              // over the cap expanded, tiny deflated
  await save(dev, slot, qr('https://example.com/0', { notes: big }));
  at(T0 + 2 * MIN);
  const a1 = await auto(dev, slot, qr('https://example.com/1', { notes: big }));
  setUsage(dev, MAX_REVISION_BYTES);
  at(T0 + 4 * MIN);
  const result = await save(dev, slot, qr('https://example.com/2', { notes: `${big}!` }));
  assert.equal(result.skipped, true);
  const head = rows(dev, 'revision-documents').find(row => row.slot === slot)!.head;
  assert.equal(head, a1.id);
  assert.ok(rows(dev, 'revisions').some(row => row.id === head), 'the head is still there');
  await dev.history.backup.export();                                     // no dangling head: the backup is valid
  setUsage(dev, 0);
  at(T0 + 6 * MIN);
  const again = await auto(dev, slot, qr('https://example.com/1', { notes: big }));
  assert.ok(again.id, 'a later write that equals the head content still gets an id');
});

test('B1: thinning never retires the document head or its last explicit save, even past the cap', () => {
  const now = T0;
  const row = (i: number, reason: 'automatic' | 'save' = 'automatic'): RevisionEntry => ({ id: `r${i}`, documentId: 'd', slot: 's', parentId: null, toolId: 'qr-code', label: 'L',
    at: new Date(now - (10 - i) * MIN).toISOString(), reason, hash: `h${i}`, bytes: 100, stored: 100, assetRefs: [] });
  const entries = Array.from({ length: 10 }, (_, i) => row(i));
  const gone = budget.planThinning(entries, 'r9', now, 64, new Set(['r8', 'r3']), 150).map(entry => entry.id);
  assert.ok(!gone.includes('r8') && !gone.includes('r3') && !gone.includes('r9'));
});

test('B2: a save from outside the editor is never refused: no room for its protected draft, or a previous state too large to keep', async () => {
  clock(T0); setQuota(40 * 1024 * 1024);                               // recovery budget: 1 MiB
  const dev = device();
  await save(dev, 'qr-code:a', qr('https://example.com/a0'));
  // Fill the recovery budget with recent protected drafts of other creations.
  for (let i = 0; i < 4; i++) {
    await save(dev, `qr-code:o${i}`, qr(`https://example.com/o${i}`));
    at(T0 + (i + 1) * MIN);
    await dev.state.save(`qr-code:o${i}`, qr(`https://example.com/o${i}-b`, { notes: 'r'.repeat(240_000) }));
    await dev.state.save(`qr-code:o${i}`, qr(`https://example.com/o${i}-c`));
  }
  const draftsBefore = rows(dev, 'revision-recovery').length;
  await dev.state.save('qr-code:a', qr('https://example.com/a1', { notes: 'r'.repeat(300_000) }));
  await dev.state.save('qr-code:a', qr('https://example.com/a2', { notes: 's'.repeat(300_000) }));
  assert.equal((await dev.state.load('qr-code:a'))?.url, 'https://example.com/a2', 'the record holds the save');
  assert.ok(rows(dev, 'revision-recovery').length <= draftsBefore + 1, 'the protected draft that had no room was left out');
  assert.ok((await dev.history.usage()).recovery <= budget.budgetsForQuota(40 * 1024 * 1024).recovery, 'recovery stays inside its budget');

  // A previous state history cannot snapshot (it does not deflate under 4 MiB).
  setQuota(null);
  const noise = (n: number): string => { const b = new Uint8Array(n * 3 / 4); for (let i = 0; i < b.length; i += 65536) crypto.getRandomValues(b.subarray(i, i + 65536)); return Buffer.from(b).toString('base64'); };
  await dev.state.save('qr-code:a', qr('https://example.com/huge', { notes: noise(6 * 1024 * 1024) }));
  await dev.state.save('qr-code:a', qr('https://example.com/after-huge'));
  assert.equal((await dev.state.load('qr-code:a'))?.url, 'https://example.com/after-huge');
  // And a record history cannot canonicalise at all (a page-local blob: URL).
  await dev.state.save('qr-code:a', qr('https://example.com/blob', { logo: { source: 'remote', id: 'x', url: 'blob:http://localhost/1' } }));
  assert.equal((await dev.state.load('qr-code:a'))?.url, 'https://example.com/blob');
});

test('B2: a protected draft is not kept when the head already holds the state being replaced', async () => {
  clock(T0);
  const dev = device();
  await save(dev, 'qr-code:h', qr('https://example.com/saved'));
  await dev.state.save('qr-code:h', qr('https://example.com/renamed-elsewhere'));
  assert.equal(rows(dev, 'revision-recovery').length, 0, 'the saved revision already holds what was replaced');
});

test('S2: eviction reaches evictable rows however many undeletable rows come first in time', async () => {
  clock(T0); setQuota(100 * 1024 * 1024);
  const dev = device();
  const seed = (n: number, o: { slot: string; documentId: string; start: number; reason: 'automatic' | 'save'; preview: boolean; prefix: string; stored: number }) => {
    for (let i = 0; i < n; i++) {
      const id = `${o.prefix}${String(i).padStart(6, '0')}`;
      dev.stores.get('revisions')!.set(JSON.stringify(id), { key: id, value: { id, documentId: o.documentId, slot: o.slot, parentId: null, toolId: 'qr-code', label: 'L',
        at: new Date(o.start + i * 1000).toISOString(), reason: o.reason, hash: `h-${id}`, bytes: o.stored, stored: o.stored, assetRefs: [] } });
      dev.stores.get('revision-payloads')!.set(JSON.stringify(id), { key: id, value: { __toolId: 'qr-code' } });
      if (o.preview) dev.stores.get('revision-previews')!.set(JSON.stringify(id), { key: id, value: thumb(1000) });
    }
    const head = `${o.prefix}${String(n - 1).padStart(6, '0')}`;
    dev.stores.get('revision-documents')!.set(JSON.stringify(o.slot), { key: o.slot, value: { slot: o.slot, documentId: o.documentId, head, hash: `h-${head}`, workingHash: `h-${head}`, version: 'v', saved: null } });
  };
  // 1,100 old checkpoints with no preview and 1,100 explicit saves, then evictable rows.
  seed(1100, { slot: 'qr-code:old', documentId: 'd-old', start: T0 - 400 * DAY, reason: 'automatic', preview: false, prefix: 'o', stored: 10 });
  seed(1100, { slot: 'qr-code:saves', documentId: 'd-s', start: T0 - 300 * DAY, reason: 'save', preview: false, prefix: 's', stored: 10 });
  seed(200, { slot: 'qr-code:stale', documentId: 'd-st', start: T0 - 200 * DAY, reason: 'automatic', preview: true, prefix: 't', stored: 100_000 });
  for (const slot of ['qr-code:old', 'qr-code:saves']) dev.stores.get('state')!.set(JSON.stringify(slot), { key: slot, value: { slot, toolId: 'qr-code', data: qr(slot), thumb: null, updatedAt: new Date(T0 - DAY).toISOString() } });
  dev.stores.get('state')!.set(JSON.stringify('qr-code:stale'), { key: 'qr-code:stale', value: { slot: 'qr-code:stale', toolId: 'qr-code', data: qr('s'), thumb: null, updatedAt: new Date(T0 - 90 * DAY).toISOString() } });
  const budgets = budget.budgetsForQuota(100 * 1024 * 1024);
  setUsage(dev, budgets.checkpoints, budgets.previews);
  const entry = await auto(dev, 'qr-code:new', qr('https://example.com/new'));
  assert.ok(entry.id, 'the checkpoint is written: the unopened document gave up checkpoints past 2,200 undeletable rows');
  assert.ok(revisionsOf(dev, 'qr-code:stale').length < 200);
  await dev.history.attachPreview(entry.id, thumb(4000));
  assert.ok(await dev.history.preview(entry.id), 'the preview is kept: older previews went, whatever lay before them');
});

test('the quota reading gives up after two seconds, so a hung estimate never holds up a write', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  Object.defineProperty(globalThis.navigator, 'storage', { configurable: true, value: { estimate: () => new Promise(() => {}) } });
  budget.forgetQuotaReading();
  const reading = budget.revisionBudgets();
  mock.timers.tick(budget.QUOTA_READING_MS);
  assert.deepEqual(await reading, budget.budgetsForQuota(null), 'the ceilings stand');
});

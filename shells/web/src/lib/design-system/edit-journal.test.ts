// SPDX-License-Identifier: MPL-2.0
/**
 * The journal of a design-system edit that has not finished saving
 * (lib/design-system/edit-journal.ts): writing the newest edit, replaying it on a
 * matching base, holding it back for a choice when the stored document moved on,
 * clearing it on save, expiring it, never journalling a locked system, keeping two
 * tabs and two systems apart, and telling a page's own late edit from another writer's
 * save by the writer stamp.
 *
 * Run directly:  node --test shells/web/src/lib/design-system/edit-journal.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOURNAL_LOCK_PREFIX, JOURNAL_MAX_AGE_MS, JOURNAL_TAB_KEY, docHash, heldJournalTabs, journalSlot, journalTabIds, nextWriterStamp,
  parseEntry, parseWriterStamp, planRecovery, readEntries, startEditJournal, stableJson, sweepJournal,
} from './edit-journal.ts';
import type { JournalEntry, JournalStore } from './edit-journal.ts';

/** host.state in memory, with a log of what was written and deleted. */
function memoryStore(): JournalStore & { rows: Map<string, unknown>; log: string[]; failNextSave: boolean } {
  const rows = new Map<string, unknown>();
  const log: string[] = [];
  const store = {
    rows, log, failNextSave: false,
    async save(slot: string, data: object) {
      if (store.failNextSave) { store.failNextSave = false; throw new Error('disk full'); }
      rows.set(slot, structuredClone(data)); log.push(`save ${slot}`);
    },
    async load(slot: string) { return rows.has(slot) ? structuredClone(rows.get(slot)) : null; },
    async delete(slot: string) { rows.delete(slot); log.push(`delete ${slot}`); },
    async list() { return [...rows.keys()].map(slot => ({ slot })); },
  };
  return store;
}

const stored = { color: { primary: { $value: '#e0452b' } }, name: 'Acme' };
const edited = { color: { primary: { $value: '#1a7f5a' } }, name: 'Acme' };
const entryOf = (store: ReturnType<typeof memoryStore>, slot: string) => store.rows.get(slot) as JournalEntry | undefined;

test('stableJson and docHash read equal documents as equal, whatever their key order', async () => {
  assert.equal(stableJson({ b: 1, a: { d: 2, c: 3 } }), stableJson({ a: { c: 3, d: 2 }, b: 1 }));
  assert.equal(await docHash({ b: 1, a: 2 }), await docHash({ a: 2, b: 1 }));
  assert.notEqual(await docHash(stored), await docHash(edited));
  assert.equal(await docHash(null), 'none');
  assert.match(await docHash(stored), /^sha256:[0-9a-f]{64}$/);
});

test('write: an edit is in the journal at once, with its system, tab and base', async () => {
  const store = memoryStore();
  const base = await docHash(stored);
  const journal = startEditJournal(store, { system: 'acme', tab: 't1', base, now: () => 1000 });
  journal.record(structuredClone(edited));
  await journal.idle();
  const entry = entryOf(store, journalSlot('acme', 't1'));
  assert.deepEqual(entry, { v: 1, system: 'acme', tab: 't1', base, at: 1000, doc: edited });
  journal.dispose();
});

test('write: the newest edit wins, and the journal copies the document when it writes', async () => {
  const store = memoryStore();
  const journal = startEditJournal(store, { system: 'acme', tab: 't1', base: 'b0' });
  const live = structuredClone(edited);
  journal.record(live);
  live.name = 'Acme 2';
  journal.record(live);
  live.name = 'Acme 3';
  journal.record(live);
  await journal.idle();
  assert.equal(entryOf(store, journalSlot('acme', 't1'))?.doc.name, 'Acme 3');
  live.name = 'changed after the write';
  assert.equal(entryOf(store, journalSlot('acme', 't1'))?.doc.name, 'Acme 3', 'a copy, not the live document');
  assert.ok(store.log.length <= 2, `rapid edits coalesce (${store.log.length} writes)`);
});

test('clear on save: the entry goes, and an edit after the save writes it again', async () => {
  const store = memoryStore();
  const journal = startEditJournal(store, { system: 'acme', tab: 't1', base: 'b0' });
  journal.record(structuredClone(edited));
  journal.clear();
  await journal.idle();
  assert.equal(store.rows.has(journalSlot('acme', 't1')), false, 'saved: nothing left to keep');
  journal.record(structuredClone(stored));
  await journal.idle();
  assert.equal(store.rows.has(journalSlot('acme', 't1')), true);
});

test("write: the newest edit's writer stamp goes in the entry, and a clear drops it", async () => {
  const store = memoryStore();
  const journal = startEditJournal(store, { system: 'acme', tab: 't1', base: 'b0', now: () => 1000 });
  journal.record(structuredClone(edited), { writer: 'page-1', seq: 3 });
  journal.record(structuredClone(edited), { writer: 'page-1', seq: 4 });
  await journal.idle();
  const entry = entryOf(store, journalSlot('acme', 't1'));
  assert.equal(entry?.writer, 'page-1');
  assert.equal(entry?.seq, 4);
  assert.deepEqual(parseEntry(entry), entry, 'read back as written');
  journal.clear();
  journal.record(structuredClone(edited));
  await journal.idle();
  const unstamped = entryOf(store, journalSlot('acme', 't1'));
  assert.equal('writer' in (unstamped ?? {}) || 'seq' in (unstamped ?? {}), false, 'an edit recorded without a stamp writes none');
});

test('writer stamps: one writer per page load, numbered in order; anything else reads as no stamp', () => {
  const a = nextWriterStamp();
  const b = nextWriterStamp();
  assert.equal(a.writer, b.writer);
  assert.ok(a.writer.length > 0);
  assert.equal(b.seq, a.seq + 1);
  assert.deepEqual(parseWriterStamp({ writer: 'w', seq: 2 }), { writer: 'w', seq: 2 });
  for (const bad of [null, 'w', {}, { writer: '', seq: 1 }, { writer: 'w', seq: 0 }, { writer: 'w', seq: 1.5 }, { writer: 'w', seq: '2' }, { writer: 3, seq: 2 }]) {
    assert.equal(parseWriterStamp(bad), null, JSON.stringify(bad));
  }
  const malformed = parseEntry({ v: 1, system: 'acme', tab: 't', base: 'b', at: 1, doc: edited, writer: 'w', seq: 'x' });
  assert.ok(malformed, 'a bad stamp does not cost the entry');
  assert.equal('writer' in malformed!, false, 'and the entry is judged by its base alone');
});

test("own writer: an edit made after its own page's save replays, though its base is from before that save", async () => {
  const store = memoryStore();
  // The page saved edit 4, then recorded edit 5 before the hash of what it wrote came back.
  const entry: JournalEntry = { v: 1, system: 'acme', tab: 'old', base: 'sha256:before-the-save', at: 5, doc: edited, writer: 'page-1', seq: 5 };
  const slot = journalSlot('acme', 'old');
  store.rows.set(slot, entry);
  const plan = await planRecovery(store, await readEntries(store, 'acme'), {
    storedDoc: stored, liveTabs: new Set(), ownTabs: new Set(['new']), locked: false, storedStamp: { writer: 'page-1', seq: 4 },
  });
  assert.equal(plan.replay?.slot, slot);
  assert.deepEqual(plan.choices, [], 'nothing to ask: no other tab and no sync saved');
});

test("own writer: an entry its own page's stored save already covers is dropped quietly", async () => {
  const store = memoryStore();
  // The journal still held edit 6 when the save of edit 7 was written and the page closed.
  const entry: JournalEntry = { v: 1, system: 'acme', tab: 'old', base: 'sha256:older', at: 5, doc: edited, writer: 'page-1', seq: 6 };
  store.rows.set(journalSlot('acme', 'old'), entry);
  const plan = await planRecovery(store, await readEntries(store, 'acme'), {
    storedDoc: stored, liveTabs: new Set(), ownTabs: new Set(), locked: false, storedStamp: { writer: 'page-1', seq: 7 },
  });
  assert.deepEqual(plan, { replay: null, choices: [] });
  assert.equal(store.rows.size, 0, 'the stored save holds this edit and what came after');
});

test('another writer, or no stamp on either side, still waits for a choice when the base moved on', async () => {
  const cases: Array<{ name: string; entry: Partial<JournalEntry>; storedStamp: { writer: string; seq: number } | null }> = [
    { name: 'another tab saved', entry: { writer: 'page-1', seq: 9 }, storedStamp: { writer: 'page-2', seq: 1 } },
    { name: 'the stored document has no stamp (an import, a sync)', entry: { writer: 'page-1', seq: 9 }, storedStamp: null },
    { name: 'the entry is from before writer ids', entry: {}, storedStamp: { writer: 'page-1', seq: 1 } },
  ];
  for (const c of cases) {
    const store = memoryStore();
    const entry = { v: 1, system: 'acme', tab: 'old', base: await docHash(stored), at: 5, doc: edited, ...c.entry } as JournalEntry;
    store.rows.set(journalSlot('acme', 'old'), entry);
    const plan = await planRecovery(store, await readEntries(store, 'acme'), {
      storedDoc: { ...stored, name: 'Acme, saved since' }, liveTabs: new Set(), ownTabs: new Set(), locked: false, storedStamp: c.storedStamp,
    });
    assert.equal(plan.replay, null, c.name);
    assert.equal(plan.choices.length, 1, c.name);
    assert.equal(store.rows.size, 1, `${c.name}: kept until the person chooses`);
  }
});

test('a save that landed while a newer edit waits moves the entry onto the new base', async () => {
  const store = memoryStore();
  const journal = startEditJournal(store, { system: 'acme', tab: 't1', base: 'b0' });
  journal.record(structuredClone(edited));
  await journal.idle();
  journal.setBase('b1');
  await journal.idle();
  assert.equal(entryOf(store, journalSlot('acme', 't1'))?.base, 'b1');
});

test('flush (the page is hiding) writes again when the newest edit never reached the journal', async () => {
  const store = memoryStore();
  const journal = startEditJournal(store, { system: 'acme', tab: 't1', base: 'b0' });
  store.failNextSave = true;
  journal.record(structuredClone(edited));
  await journal.idle();
  assert.equal(store.rows.size, 0, 'the first write failed');
  journal.flush();
  await journal.idle();
  assert.equal(entryOf(store, journalSlot('acme', 't1'))?.doc.color !== undefined, true);
  const writes = store.log.length;
  journal.flush();
  await journal.idle();
  assert.equal(store.log.length, writes, 'nothing new to write');
});

test('locked: a locked or managed system is never journalled, and nothing is recovered into one', async () => {
  const store = memoryStore();
  const journal = startEditJournal(store, { system: 'managed', tab: 't1', base: 'b0', locked: true });
  journal.record(structuredClone(edited));
  journal.flush();
  await journal.idle();
  assert.equal(store.rows.size, 0);
  const entry: JournalEntry = { v: 1, system: 'managed', tab: 'old', base: await docHash(stored), at: 1, doc: edited };
  const plan = await planRecovery(store, [{ slot: journalSlot('managed', 'old'), entry }], {
    storedDoc: stored, liveTabs: new Set(), ownTabs: new Set(), locked: true,
  });
  assert.deepEqual(plan, { replay: null, choices: [] });
});

test('replay: an entry whose base is still the stored document is replayed', async () => {
  const store = memoryStore();
  const entry: JournalEntry = { v: 1, system: 'acme', tab: 'old', base: await docHash(stored), at: 5, doc: edited };
  const slot = journalSlot('acme', 'old');
  store.rows.set(slot, entry);
  const plan = await planRecovery(store, await readEntries(store, 'acme'), {
    storedDoc: stored, liveTabs: new Set(), ownTabs: new Set(['new']), locked: false,
  });
  assert.equal(plan.replay?.slot, slot);
  assert.deepEqual(plan.replay?.entry.doc, edited);
  assert.deepEqual(plan.choices, []);
});

test('conflict: when the stored document changed since the base, the entry waits for a choice', async () => {
  const store = memoryStore();
  const savedElsewhere = { ...stored, name: 'Acme, saved in another tab' };
  const entry: JournalEntry = { v: 1, system: 'acme', tab: 'old', base: await docHash(stored), at: 5, doc: edited };
  store.rows.set(journalSlot('acme', 'old'), entry);
  const plan = await planRecovery(store, await readEntries(store, 'acme'), {
    storedDoc: savedElsewhere, liveTabs: new Set(), ownTabs: new Set(), locked: false,
  });
  assert.equal(plan.replay, null, 'never written over the newer document');
  assert.equal(plan.choices.length, 1);
  assert.equal(store.rows.has(journalSlot('acme', 'old')), true, 'kept until the person chooses');
});

test('an entry whose document is already the stored one is dropped quietly', async () => {
  const store = memoryStore();
  const entry: JournalEntry = { v: 1, system: 'acme', tab: 'old', base: 'sha256:older', at: 5, doc: { name: 'Acme', color: { primary: { $value: '#e0452b' } } } };
  store.rows.set(journalSlot('acme', 'old'), entry);
  const plan = await planRecovery(store, await readEntries(store, 'acme'), {
    storedDoc: stored, liveTabs: new Set(), ownTabs: new Set(), locked: false,
  });
  assert.deepEqual(plan, { replay: null, choices: [] });
  assert.equal(store.rows.size, 0);
});

test('two tabs on one system: separate entries, the newest matching edit replays, the other waits', async () => {
  const store = memoryStore();
  const base = await docHash(stored);
  const a = startEditJournal(store, { system: 'acme', tab: 'A', base, now: () => 10 });
  const b = startEditJournal(store, { system: 'acme', tab: 'B', base, now: () => 20 });
  a.record({ ...edited, name: 'from A' });
  b.record({ ...edited, name: 'from B' });
  await a.idle(); await b.idle();
  a.clear();
  await a.idle();
  assert.equal(store.rows.has(journalSlot('acme', 'A')), false);
  assert.equal(store.rows.has(journalSlot('acme', 'B')), true, "A's save never touches B's entry");
  b.record({ ...edited, name: 'from B again' });
  a.record({ ...edited, name: 'from A again' });
  await a.idle(); await b.idle();
  // While B is still open, its entry is its own.
  const live = await planRecovery(store, await readEntries(store, 'acme'), {
    storedDoc: stored, liveTabs: new Set(['A', 'B']), ownTabs: new Set(['C']), locked: false,
  });
  assert.deepEqual(live, { replay: null, choices: [] });
  // Both closed: the newer edit (B, written at 20) replays, A's waits for a choice.
  const closed = await planRecovery(store, await readEntries(store, 'acme'), {
    storedDoc: stored, liveTabs: new Set(), ownTabs: new Set(['C']), locked: false,
  });
  assert.equal(closed.replay?.entry.tab, 'B');
  assert.deepEqual(closed.choices.map(c => c.entry.tab), ['A']);
});

test('a page reloaded in the same tab recovers its own entry even before its old lock is released', async () => {
  const store = memoryStore();
  store.rows.set(journalSlot('acme', 'T'), { v: 1, system: 'acme', tab: 'T', base: await docHash(stored), at: 1, doc: edited });
  const plan = await planRecovery(store, await readEntries(store, 'acme'), {
    storedDoc: stored, liveTabs: new Set(['T']), ownTabs: new Set(['T']), locked: false,
  });
  assert.equal(plan.replay?.entry.tab, 'T');
});

test('systems are kept apart: an entry is only ever offered to its own design system', async () => {
  const store = memoryStore();
  store.rows.set(journalSlot('acme', 'x'), { v: 1, system: 'acme', tab: 'x', base: 'b', at: 1, doc: edited });
  store.rows.set(journalSlot('other', 'x'), { v: 1, system: 'other', tab: 'x', base: 'b', at: 2, doc: edited });
  assert.deepEqual((await readEntries(store, 'acme')).map(e => e.entry.system), ['acme']);
  assert.deepEqual((await readEntries(store, 'other')).map(e => e.entry.system), ['other']);
});

test('expiry: entries older than seven days, or for a system no longer here, are dropped', async () => {
  const store = memoryStore();
  const now = 100 * JOURNAL_MAX_AGE_MS;
  store.rows.set(journalSlot('acme', 'fresh'), { v: 1, system: 'acme', tab: 'fresh', base: 'b', at: now - 1000, doc: edited });
  store.rows.set(journalSlot('acme', 'stale'), { v: 1, system: 'acme', tab: 'stale', base: 'b', at: now - JOURNAL_MAX_AGE_MS - 1, doc: edited });
  store.rows.set(journalSlot('removed', 'x'), { v: 1, system: 'removed', tab: 'x', base: 'b', at: now - 1000, doc: edited });
  store.rows.set('some-session', { name: 'not a journal entry' });
  store.rows.set(`${journalSlot('acme', 'broken')}`, { v: 9 });
  const dropped = await sweepJournal(store, { systems: ['acme'], now });
  assert.equal(dropped, 2);
  assert.deepEqual([...store.rows.keys()].sort(), [journalSlot('acme', 'fresh'), 'some-session'].sort(), 'a malformed entry goes too; other slots stay');
});

test('tab ids: kept across a reload, renewed when another open tab already holds the id', () => {
  const storage = new Map<string, string>();
  const ss = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); } };
  const first = journalTabIds(ss, new Set());
  assert.equal(first.previous, null);
  assert.equal(storage.get(JOURNAL_TAB_KEY), first.tab);
  const reload = journalTabIds(ss, new Set());
  assert.deepEqual(reload, { tab: first.tab, previous: first.tab });
  const duplicate = journalTabIds(ss, new Set([first.tab]));
  assert.notEqual(duplicate.tab, first.tab, 'a duplicated tab never shares an entry');
  assert.equal(duplicate.previous, first.tab);
});

test('held tabs come from the Web Locks the journalling tabs hold', async () => {
  const locks = { query: async () => ({ held: [{ name: `${JOURNAL_LOCK_PREFIX}A` }, { name: 'something-else' }, { name: `${JOURNAL_LOCK_PREFIX}B` }], pending: [] }) } as unknown as LockManager;
  assert.deepEqual([...await heldJournalTabs(locks)].sort(), ['A', 'B']);
  assert.deepEqual([...await heldJournalTabs(undefined)], []);
});

test('a running journal holds its tab lock until it is disposed', async () => {
  const requested: string[] = [];
  let released = false;
  const locks = {
    request: (name: string, cb: () => Promise<void>) => { requested.push(name); return cb().then(() => { released = true; }); },
  } as unknown as LockManager;
  const journal = startEditJournal(memoryStore(), { system: 'acme', tab: 'T', base: 'b', locks });
  assert.deepEqual(requested, [`${JOURNAL_LOCK_PREFIX}T`]);
  journal.dispose();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(released, true);
});

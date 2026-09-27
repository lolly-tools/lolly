// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutomaticHistory } from './automatic-history.ts';
import type { RevisionHistoryAPI, RevisionEntry } from '../bridge/revision-history.ts';
import type { RecoveryEntry } from '../bridge/revision-recovery.ts';

test('rolling recovery protects continuous edits within five seconds without creating visible checkpoints', async context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  let value = 0, slot: string | null = null, checkpoints = 0;
  const drafts: Array<{ value: unknown; writer: string; expected: string | null }> = [];
  const controller = createAutomaticHistory({
    toolId: 'design', getSlot: () => slot, setSlot: next => { slot = next; }, snapshot: () => ({ value }),
    load: async () => null, capture: async () => null, saved() {},
    history: {
      head: async () => null, current: async () => ({ head: null, version: null }), attachPreview: async () => {},
      checkpoint: async () => { checkpoints++; return { id: 'checkpoint' } as RevisionEntry; },
      recovery: { list: async () => ({ entries: [] }), read: async () => null,
        save: async (_slot, data, options) => {
          drafts.push({ value: data.value, writer: options.writerId, expected: options.expectedVersion });
          return { version: `draft-${drafts.length}`, diverged: false } as RecoveryEntry;
        },
      },
    },
  });
  const settle = async (): Promise<void> => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  await settle();
  for (let i = 0; i < 11; i++) { value++; controller.changed(); context.mock.timers.tick(500); await settle(); }
  assert.equal(checkpoints, 0); assert.equal(drafts.length, 1); assert.ok(Number(drafts[0]!.value) >= 10);
  context.mock.timers.tick(1000); await settle();
  assert.equal(drafts.length, 2); assert.equal(drafts[1]!.expected, 'draft-1');
  assert.equal(drafts[0]!.writer, drafts[1]!.writer);
  controller.dispose();
});

test('a divergent writer keeps recovering edits without advancing the shared local head', async context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  let writes = 0, checkpoints = 0;
  const expected: Array<string | null> = [];
  const controller = createAutomaticHistory({
    toolId: 'design', getSlot: () => 'existing', setSlot() {}, snapshot: () => ({ text: writes }),
    load: async () => null, capture: async () => null, saved() {},
    history: { head: async () => 'base', current: async () => ({ head: 'base', version: 'base' }), attachPreview: async () => {},
      checkpoint: async () => { checkpoints++; return { id: 'unexpected' } as RevisionEntry; },
      recovery: { list: async () => ({ entries: [] }), read: async () => null, save: async (_slot, _data, options) => {
        writes++; expected.push(options.expectedVersion); return { version: `draft-${writes}`, diverged: true } as RecoveryEntry;
      } },
    },
  });
  controller.changed(); await controller.flush();
  controller.changed(); await controller.flush();
  assert.equal(writes, 2); assert.equal(checkpoints, 0); assert.deepEqual(expected, ['base', 'base']);
  assert.match(controller.status(), /separate draft.*protected at/);
  await assert.rejects(controller.save('existing', {}), /separate recovery draft/);
  controller.dispose();
});

test('continuous edits checkpoint by a minute, explicit saves reuse the slot, and disposal stops new captures', async context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  let slot: string | null = null, value = 0;
  const writes: Array<{ slot: string; value: unknown; expected: unknown }> = [];
  const history = {
    async head() { return null; },
    async checkpoint(key, data, opts) {
      writes.push({ slot: key, value: data.value, expected: opts.expectedHead });
      return { id: String(writes.length) } as RevisionEntry;
    },
    async attachPreview() {},
  } satisfies Pick<RevisionHistoryAPI, 'head' | 'checkpoint' | 'attachPreview'>;
  const controller = createAutomaticHistory({ history, toolId: 'design', getSlot: () => slot, setSlot: value => { slot = value; }, snapshot: () => ({ value }), load: async () => null, capture: async () => null, saved() {} });
  for (let i = 0; i < 61; i++) { value = i; controller.changed(); context.mock.timers.tick(1000); await Promise.resolve(); }
  await controller.flush();
  assert.ok(writes.length >= 1);
  assert.ok(writes.every(row => row.slot === slot));
  await controller.save(slot!, { value: 99 });
  assert.equal(writes.at(-1)?.value, 99);
  assert.ok(writes.at(-1)?.expected);
  controller.dispose();
  const count = writes.length;
  controller.changed(); context.mock.timers.tick(120_000); await Promise.resolve();
  assert.equal(writes.length, count);
});

test('a delayed preview is discarded after another edit, and failed writes do not advance the expected head', async () => {
  let finish: ((thumb: string) => void) | undefined;
  let fail = false;
  const heads: Array<string | null> = [];
  let previews = 0;
  const history = {
    async head() { return null; },
    async checkpoint(_slot, _data, opts) { heads.push(opts.expectedHead); if (fail) throw new Error('quota'); return { id: 'first' } as RevisionEntry; },
    async attachPreview() { previews++; },
  } satisfies Pick<RevisionHistoryAPI, 'head' | 'checkpoint' | 'attachPreview'>;
  const controller = createAutomaticHistory({ history, toolId: 'design', getSlot: () => null, setSlot() {}, snapshot: () => ({}), load: async () => null, capture: () => new Promise(resolve => { finish = resolve; }), saved() {} });
  await controller.save('slot', { text: 'first' });
  controller.changed(); finish!('data:image/png;base64,AA==');
  await Promise.resolve(); await Promise.resolve();
  assert.equal(previews, 0);
  fail = true;
  await assert.rejects(controller.save('slot', {}), /quota/);
  fail = false;
  await controller.save('slot', { text: 'retry' });
  assert.deepEqual(heads, [null, 'first', 'first']);
  controller.dispose();
});

test('starting collaboration cancels a queued local checkpoint before it reaches storage', async () => {
  let allowed = true, writes = 0;
  const controller = createAutomaticHistory({
    toolId: 'design', getSlot: () => null, setSlot() {}, snapshot: () => ({}), load: async () => null,
    capture: async () => null, saved() {}, allowed: () => allowed,
    history: { head: async () => null, attachPreview: async () => {}, checkpoint: async () => { writes++; return { id: 'unexpected' } as RevisionEntry; },
      recovery: { list: async () => ({ entries: [] }), read: async () => null, save: async () => { writes++; return { version: 'unexpected' } as RecoveryEntry; } },
    },
  });
  controller.changed();
  const pending = controller.flush();
  allowed = false;
  await pending;
  assert.equal(writes, 0);
  controller.dispose();
});

test('teardown freezes the snapshot before asynchronous recovery, and a slow store coalesces pending edits', async context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  let value = 1, disposed = false, finish: (() => void) | undefined;
  const drafts: unknown[] = [], checkpoints: unknown[] = [];
  const controller = createAutomaticHistory({
    toolId: 'design', getSlot: () => 'draft', setSlot() {}, snapshot: () => { assert.equal(disposed, false); return { value }; },
    load: async () => null, capture: async () => null, saved() {},
    history: { head: async () => null, attachPreview: async () => {}, checkpoint: async (_slot, data) => { checkpoints.push(data.value); return { id: 'saved' } as RevisionEntry; },
      recovery: { list: async () => ({ entries: [] }), read: async () => null, save: async (_slot, data) => {
        drafts.push(data.value); await new Promise<void>(resolve => { finish = resolve; }); return { version: 'protected', diverged: false } as RecoveryEntry;
      } },
    },
  });
  const settle = async (): Promise<void> => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  controller.changed(); context.mock.timers.tick(1000); await settle();
  for (let i = 0; i < 12; i++) { value++; controller.changed(); context.mock.timers.tick(500); await settle(); }
  assert.equal(drafts.length, 1);
  const flush = controller.flush(); controller.dispose(); disposed = true;
  finish!(); await flush;
  assert.deepEqual(checkpoints, [13]);
});

test('the opening snapshot keeps its original write token when another editor saves during mount', async () => {
  let currentReads = 0, expected: string | null = null;
  const controller = createAutomaticHistory({
    toolId: 'design', initial: { head: 'opened-head', version: 'opened-version' },
    getSlot: () => 'existing', setSlot() {}, snapshot: () => ({ text: 'opened snapshot' }),
    load: async () => null, capture: async () => null, saved() {},
    history: { head: async () => 'new-head', current: async () => { currentReads++; return { head: 'new-head', version: 'new-version' }; },
      attachPreview: async () => {}, checkpoint: async () => { throw new Error('A stale mount must not commit'); },
      recovery: { list: async () => ({ entries: [] }), read: async () => null, save: async (_slot, _data, options) => {
        expected = options.expectedVersion; return { version: 'draft', diverged: true } as RecoveryEntry;
      } },
    },
  });
  controller.changed(); await controller.flush();
  assert.equal(currentReads, 0); assert.equal(expected, 'opened-version');
  controller.dispose();
});

test('close protects the latest edits once, then nothing the controller does writes again (plan 277 P1)', async context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  let value = 1, slot: string | null = null;
  const drafts: unknown[] = [], checkpoints: unknown[] = [];
  const controller = createAutomaticHistory({
    toolId: 'qr-code', getSlot: () => slot, setSlot: next => { slot = next; }, snapshot: () => ({ value }),
    load: async () => null, capture: async () => null, saved() {},
    history: { head: async () => null, current: async () => ({ head: null, version: null }), attachPreview: async () => {},
      checkpoint: async (_slot, data) => { checkpoints.push(data.value); return { id: `c${checkpoints.length}` } as RevisionEntry; },
      recovery: { list: async () => ({ entries: [] }), read: async () => null,
        save: async (_slot, data) => { drafts.push(data.value); return { version: `d${drafts.length}`, diverged: false } as RecoveryEntry; } },
    },
  });
  const settle = async (): Promise<void> => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  await settle();
  value = 2; controller.changed();
  await controller.close();
  assert.deepEqual(drafts, [2], 'the edit made just before leaving is protected');
  assert.deepEqual(checkpoints, [2], 'and kept as a checkpoint History can open as a copy');
  assert.ok(slot, 'a creation with edits has a document to discard');
  // The teardown flush, a late hook patch and every timer after close write nothing,
  // so they cannot put the discarded edits back after the discard.
  value = 3; controller.changed(); await controller.flush();
  context.mock.timers.tick(120_000); await settle();
  await controller.close();
  assert.deepEqual(drafts, [2]); assert.deepEqual(checkpoints, [2]);
});

test('a saved state no revision holds is adopted as a saved revision before the first edit (plan 277 P1)', async () => {
  const calls: Array<{ slot: string; reason: string; adopt?: boolean; expectedHead: string | null; expectedVersion?: string | null; data: unknown }> = [];
  const controller = createAutomaticHistory({
    toolId: 'qr-code', initial: { head: 'older-save', version: 'replaced-version', workingHash: '' },
    getSlot: () => 'qr-code:renamed', setSlot() {}, snapshot: () => ({ url: 'edited' }),
    load: async () => ({ url: 'renamed in Projects' }), capture: async () => null, saved() {},
    history: { head: async () => 'older-save', current: async () => ({ head: 'older-save', version: 'replaced-version' }), attachPreview: async () => {},
      checkpoint: async (slot, data, options) => { calls.push({ slot, data: data.url, ...options }); return { id: 'adopted', currentVersion: 'v-adopted' } as RevisionEntry & { currentVersion: string }; },
    },
  });
  await controller.flush();
  assert.deepEqual(calls, [{ slot: 'qr-code:renamed', data: 'renamed in Projects', reason: 'save', adopt: true, expectedHead: 'older-save', expectedVersion: 'replaced-version' }]);
  controller.dispose();
});

// ---- Save never fails silently (plan 277 P1, review B1) ------------------------

test('a failed adopt on open pauses history for this creation, and an edit then Save still writes the record', async () => {
  const stored: unknown[] = [], drafts: unknown[] = [], failures: string[] = [];
  let adoptAttempts = 0, value = 'https://example.com/old';
  const controller = createAutomaticHistory({
    toolId: 'qr-code', initial: { head: null, version: null },
    getSlot: () => 'qr-code:legacy', setSlot() {}, snapshot: () => ({ url: value }),
    load: async () => ({ url: 'https://example.com/old' }), capture: async () => null, saved() {},
    store: async (_slot, data) => { stored.push(data.url); },
    failure: message => { failures.push(message); },
    history: { head: async () => null, current: async () => ({ head: null, version: null }), attachPreview: async () => {},
      checkpoint: async (_slot, _data, options) => {
        if (options.adopt && ++adoptAttempts === 1) throw new Error('History needs a saved asset for this temporary file.');
        return { id: `rev-${adoptAttempts}` } as RevisionEntry;
      },
      recovery: { list: async () => ({ entries: [] }), read: async () => null,
        save: async (_slot, data) => { drafts.push(data.url); return { version: 'd', diverged: false } as RecoveryEntry; } },
    },
  });
  await new Promise(resolve => setTimeout(resolve, 0)); // the adopt on open runs first
  assert.match(controller.status(), /^History is paused for this creation\. History needs a saved asset/);
  assert.equal(failures.length, 1, 'said once, plainly');
  value = 'https://example.com/new'; controller.changed(); await controller.flush();
  assert.deepEqual(drafts, [], 'no draft writes over a save that history does not hold');
  assert.equal(await controller.save('qr-code:legacy', { url: value }), 'stored');
  assert.deepEqual(stored, ['https://example.com/new'], 'the record is written before Save reports success');
  assert.equal(adoptAttempts, 2, 'the saved state is offered to history again');
  assert.match(controller.status(), /Checkpoint saved/, 'history resumed once it could take the save');
  controller.dispose();
});

test('a refusing history budget never blocks an explicit save', async () => {
  const stored: unknown[] = [], failures: string[] = [];
  const full = new Error('History storage is full. Your previous checkpoints are safe; export an editable .lolly file.');
  const controller = createAutomaticHistory({
    toolId: 'qr-code', initial: { head: 'h1', version: 'v1' },
    getSlot: () => 'qr-code:full', setSlot() {}, snapshot: () => ({ url: 'b' }),
    load: async () => ({ url: 'b' }), capture: async () => null, saved() {},
    store: async (_slot, data) => { stored.push(data.url); },
    failure: message => { failures.push(message); },
    history: { head: async () => 'h1', current: async () => ({ head: 'h1', version: 'v1' }), attachPreview: async () => {},
      checkpoint: async () => { throw full; },
    },
  });
  assert.equal(await controller.save('qr-code:full', { url: 'b' }), 'stored');
  assert.deepEqual(stored, ['b']);
  assert.equal(controller.status(), `History is paused for this creation. ${full.message}`);
  assert.deepEqual(failures, [controller.status()]);
  controller.dispose();
});

test('a save from a tab whose history fell behind still writes the record', async () => {
  const stored: unknown[] = [];
  const controller = createAutomaticHistory({
    toolId: 'design', getSlot: () => 'design:shared', setSlot() {}, snapshot: () => ({ text: 'mine' }),
    load: async () => ({ text: 'mine' }), capture: async () => null, saved() {},
    store: async (_slot, data) => { stored.push(data.text); },
    history: { head: async () => 'base', current: async () => ({ head: 'base', version: 'base' }), attachPreview: async () => {},
      checkpoint: async (_slot, _data, options) => {
        if (!options.adopt) throw new Error('This document changed in another tab. Reopen it before saving more history.');
        return { id: 'adopted', currentVersion: 'after' } as RevisionEntry & { currentVersion: string };
      },
      recovery: { list: async () => ({ entries: [] }), read: async () => null,
        save: async () => ({ version: 'draft', diverged: true } as RecoveryEntry) },
    },
  });
  controller.changed(); await controller.flush();
  assert.equal(await controller.save('design:shared', { text: 'mine' }), 'stored', 'the last write wins, as it does without history');
  assert.deepEqual(stored, ['mine']);
  controller.dispose();
});

test('the dialog may promise a kept copy only while history keeps the edits (review S5)', async () => {
  const working = createAutomaticHistory({
    toolId: 'qr-code', initial: { head: 'h', version: 'v' }, getSlot: () => 'qr-code:a', setSlot() {}, snapshot: () => ({}),
    load: async () => ({}), capture: async () => null, saved() {},
    history: { head: async () => 'h', attachPreview: async () => {}, checkpoint: async () => ({ id: 'x' }) as RevisionEntry,
      recovery: { list: async () => ({ entries: [] }), read: async () => null, save: async () => ({ version: 'd', diverged: false }) as RecoveryEntry } },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(working.keepsEdits(), true);
  await working.close();
  assert.equal(working.keepsEdits(), false, 'nothing is kept after the writer closes');
  const paused = createAutomaticHistory({
    toolId: 'qr-code', initial: { head: null, version: null }, getSlot: () => 'qr-code:legacy', setSlot() {}, snapshot: () => ({}),
    load: async () => ({ url: 'old' }), capture: async () => null, saved() {},
    history: { head: async () => null, attachPreview: async () => {}, checkpoint: async () => { throw new Error('History needs a saved asset for this temporary file.'); },
      recovery: { list: async () => ({ entries: [] }), read: async () => null, save: async () => ({ version: 'd', diverged: false }) as RecoveryEntry } },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(paused.keepsEdits(), false, 'history paused for this creation keeps nothing');
  const full = createAutomaticHistory({
    toolId: 'qr-code', initial: { head: 'h', version: 'v' }, getSlot: () => 'qr-code:b', setSlot() {}, snapshot: () => ({ n: 1 }),
    load: async () => ({}), capture: async () => null, saved() {},
    history: { head: async () => 'h', attachPreview: async () => {}, checkpoint: async () => { throw new Error('History storage is full.'); },
      recovery: { list: async () => ({ entries: [] }), read: async () => null, save: async () => ({ version: 'd', diverged: false }) as RecoveryEntry } },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  full.changed(); await full.flush();
  assert.equal(full.keepsEdits(), false, 'with checkpoints paused, History has no version of these edits to open');
  paused.dispose(); working.dispose(); full.dispose();
});

test('a creation never explicitly saved says so until a save or an adopt (recheck R2)', async () => {
  const history = { head: async () => null, attachPreview: async () => {}, checkpoint: async () => ({ id: 'saved' }) as RevisionEntry };
  const fresh = createAutomaticHistory({ toolId: 'qr-code', getSlot: () => null, setSlot() {}, snapshot: () => ({}), load: async () => null, capture: async () => null, saved() {}, history });
  assert.equal(fresh.neverSaved(), true, 'a new creation');
  await fresh.save('qr-code:new', { url: 'x' });
  assert.equal(fresh.neverSaved(), false, 'after Save');
  const opened = createAutomaticHistory({ toolId: 'qr-code', initial: { head: 'h', version: 'v', neverSaved: true }, getSlot: () => 'qr-code:auto', setSlot() {}, snapshot: () => ({}), load: async () => ({}), capture: async () => null, saved() {}, history: { ...history, head: async () => 'h' } });
  assert.equal(opened.neverSaved(), true, 'an auto-filed creation opened from Projects');
  const saved = createAutomaticHistory({ toolId: 'qr-code', initial: { head: 'h', version: 'v' }, getSlot: () => 'qr-code:saved', setSlot() {}, snapshot: () => ({}), load: async () => ({}), capture: async () => null, saved() {}, history: { ...history, head: async () => 'h' } });
  assert.equal(saved.neverSaved(), false, 'a saved creation');
  fresh.dispose(); opened.dispose(); saved.dispose();
});

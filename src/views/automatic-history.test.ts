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

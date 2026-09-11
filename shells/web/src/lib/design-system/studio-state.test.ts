// SPDX-License-Identifier: MPL-2.0
/**
 * studio-state.ts - immediate persist, session undo, rolling checkpoints.
 * Run: node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/studio-state.test.ts"
 *
 * DOM-free: the fake host is an in-memory state map plus the two bridge methods
 * the write chokepoint touches, so every install below runs through the REAL
 * installUserTokens rather than a stub of it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { createStudioState, CHECKPOINT_LIMIT, CHECKPOINTS_KEY, UNDO_ACTION, RESTORE_ACTION } from './studio-state.ts';
import { BrandLockedError } from '../../bridge/tokens.ts';

const DOC = { color: { brand: { jungle: { $type: 'color', $value: '#30ba78' } } } };
const DOC2 = { color: { brand: { jungle: { $type: 'color', $value: '#123456' } } } };
const DOC3 = { color: { brand: { jungle: { $type: 'color', $value: '#abcdef' } } } };

/** In-memory stand-in for the slices studio-state reaches through: the user-asset
 *  writer installUserTokens calls, the tokens surface it reads the head from, and
 *  host.state for the checkpoint ring. */
function fakeHost(seed: unknown = DOC, locked = false) {
  const slots = new Map<string, object>();
  const installs: string[] = [];
  let installed: unknown = seed;
  const host = {
    assets: {
      async _uploadUserAsset(rec: { id: string; blob: Blob }) {
        installs.push(rec.id);
        installed = JSON.parse(await rec.blob.text()); // round-trips through real bytes, like IDB
      },
    },
    tokens: {
      raw: async () => installed,
      isLocked: async () => locked,
      bust: () => {},
    },
    state: {
      async save(slot: string, data: object) { slots.set(slot, JSON.parse(JSON.stringify(data))); },
      async load(slot: string) { return slots.get(slot) ?? null; },
    },
  };
  return { host: host as unknown as HostV1, slots, installs, current: () => installed };
}

test('doc() is null until load(), then mirrors the head document', async () => {
  const { host } = fakeHost();
  const state = createStudioState(host);
  assert.equal(state.doc(), null);
  await state.load();
  assert.deepStrictEqual(state.doc(), DOC);
});

test('doc() hands back a copy - mutating it does not move the head', async () => {
  const { host, current } = fakeHost();
  const state = createStudioState(host);
  await state.load();
  const d = state.doc() as typeof DOC;
  d.color.brand.jungle.$value = '#000000';
  assert.deepStrictEqual(state.doc(), DOC);
  assert.deepStrictEqual(current(), DOC); // and nothing was written
});

test('install writes through the tokens chokepoint; undo round-trips byte-identical docs', async () => {
  const { host, installs, current } = fakeHost();
  const state = createStudioState(host);
  await state.load();

  await state.install(DOC2, 'add-colour');
  assert.deepStrictEqual(installs, ['user/tokens/brand']); // the one write path
  assert.deepStrictEqual(current(), DOC2);
  assert.deepStrictEqual(state.doc(), DOC2);

  assert.equal(state.canUndo(), true);
  assert.equal(await state.undo(), true);
  assert.deepStrictEqual(current(), DOC);
  assert.deepStrictEqual(state.doc(), DOC);
  // Byte-identical, not merely deep-equal: key order survives the snapshot.
  assert.equal(JSON.stringify(current()), JSON.stringify(DOC));
});

test('undo walks the stack down and never grows it', async () => {
  const { host, current } = fakeHost();
  const state = createStudioState(host);
  await state.load();
  await state.install(DOC2, 'a');
  await state.install(DOC3, 'b');

  assert.equal(await state.undo(), true);
  assert.deepStrictEqual(current(), DOC2);
  assert.equal(await state.undo(), true);
  assert.deepStrictEqual(current(), DOC);
  assert.equal(state.canUndo(), false);
  assert.equal(await state.undo(), false); // an undo of an undo is not a redo
  assert.deepStrictEqual(current(), DOC);
});

test('an install with no head yet records no undo entry', async () => {
  const { host } = fakeHost(null); // nothing installed anywhere
  const state = createStudioState(host);
  await state.load();
  assert.equal(state.doc(), null);
  await state.install(DOC, 'install-file');
  assert.equal(state.canUndo(), false); // there is nowhere to go back to
});

test('a refused install leaves the head and the undo stack untouched', async () => {
  const { host, current } = fakeHost(DOC, true); // locked brand
  const state = createStudioState(host);
  await state.load();
  await assert.rejects(state.install(DOC2, 'add-colour'), BrandLockedError);
  assert.equal(state.canUndo(), false);
  assert.deepStrictEqual(state.doc(), DOC);
  assert.deepStrictEqual(current(), DOC);
});

test('checkpoints persist under the namespaced slot and cap at CHECKPOINT_LIMIT, evicting the oldest', async () => {
  const { host, slots } = fakeHost();
  const state = createStudioState(host);
  await state.load();

  const ids: string[] = [];
  for (let i = 0; i < CHECKPOINT_LIMIT + 2; i++) ids.push(await state.checkpoint(`c${i}`));
  assert.equal(new Set(ids).size, ids.length); // ids are unique

  const list = await state.listCheckpoints();
  assert.equal(list.length, CHECKPOINT_LIMIT);
  assert.equal(list[0]!.label, 'c2');                       // c0/c1 evicted
  assert.equal(list[list.length - 1]!.label, `c${CHECKPOINT_LIMIT + 1}`);
  assert.deepStrictEqual(list.map(c => c.id), ids.slice(2));
  assert.match(list[0]!.date, /^\d{4}-\d\d-\d\dT/);
  assert.ok(slots.has(CHECKPOINTS_KEY));                    // and it survives a reload
  assert.equal((await createStudioState(host).listCheckpoints()).length, CHECKPOINT_LIMIT);
});

test('checkpoint refuses when nothing is loaded', async () => {
  const { host } = fakeHost(null);
  const state = createStudioState(host);
  await state.load();
  await assert.rejects(state.checkpoint('empty'), /no tokens document loaded/);
});

test('restoreCheckpoint installs the snapshot and is itself undoable; an unknown id is false', async () => {
  const { host, current } = fakeHost();
  const state = createStudioState(host);
  await state.load();
  const id = await state.checkpoint('before the import');

  await state.install(DOC2, 'install-file');
  assert.deepStrictEqual(current(), DOC2);

  assert.equal(await state.restoreCheckpoint(id), true);
  assert.deepStrictEqual(current(), DOC);
  assert.deepStrictEqual(state.doc(), DOC);
  assert.equal(await state.undo(), true);          // a restore is a normal action
  assert.deepStrictEqual(current(), DOC2);

  assert.equal(await state.restoreCheckpoint('nope'), false);
  assert.deepStrictEqual(current(), DOC2);         // nothing was written
});

test('onChange fires with the action for every install path, and unsubscribe stops it', async () => {
  const { host } = fakeHost();
  const state = createStudioState(host);
  await state.load();

  const seen: string[] = [];
  const off = state.onChange(a => { seen.push(a); });
  await state.install(DOC2, 'add-colour');
  const id = await state.checkpoint('x');           // persisting a checkpoint is not a change
  await state.undo();
  await state.restoreCheckpoint(id);
  assert.deepStrictEqual(seen, ['add-colour', UNDO_ACTION, RESTORE_ACTION]);

  off();
  await state.install(DOC3, 'add-colour');
  assert.deepStrictEqual(seen, ['add-colour', UNDO_ACTION, RESTORE_ACTION]);
});

test('afterInstall runs once per install, before subscribers, and a failing one does not fail the write', async () => {
  const { host, current } = fakeHost();
  const order: string[] = [];
  const state = createStudioState(host, {
    afterInstall: () => { order.push('repaint'); throw new Error('chrome repaint blew up'); },
    label: 'Design system tokens',
  });
  await state.load();
  state.onChange(a => { order.push(a); });
  await state.install(DOC2, 'add-colour');
  assert.deepStrictEqual(order, ['repaint', 'add-colour']);
  assert.deepStrictEqual(current(), DOC2);
});

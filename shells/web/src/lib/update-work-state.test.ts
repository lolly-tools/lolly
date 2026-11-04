// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { drainUpdateWrites, holdUpdateWork, hasActiveUpdateWork, settleUpdateWork, trackUpdateWrite, type UpdateDocument, type WorkProtection } from './update-work-state.ts';

function fixture() {
  let dirty = true, saved = true, durable = true, busy = false;
  const order: string[] = [];
  const doc: UpdateDocument = { unsaved: () => dirty, busy: () => busy,
    async save() { order.push('save'); if (saved) dirty = false; return saved; },
    async discard() { order.push('discard'); dirty = false; }, async flush() { order.push('flush'); return durable; } };
  const work: WorkProtection = { documents: () => [doc], busy: () => busy, drain: async () => { order.push('drain'); return durable; }, choose: doc => doc.save() };
  return { work, doc, order, failSave: () => { saved = false; }, failDurable: () => { durable = false; }, busy: () => { busy = true; } };
}

test('work barrier awaits saves and durable writes before authorizing installation', async () => {
  const f = fixture(); assert.equal(await settleUpdateWork(f.work), 'ready');
  assert.deepEqual(f.order, ['drain', 'save', 'flush', 'drain']);
});
test('failed save, cancelled prompt, failed durable receipt and active recording each veto installation', async () => {
  const failed = fixture(); failed.failSave(); assert.equal(await settleUpdateWork(failed.work), 'cancelled');
  const cancelled = fixture(); cancelled.work.choose = async () => false; assert.equal(await settleUpdateWork(cancelled.work), 'cancelled');
  const durable = fixture(); durable.failDurable(); assert.equal(await settleUpdateWork(durable.work), 'save');
  const busy = fixture(); busy.busy(); assert.equal(await settleUpdateWork(busy.work), 'busy'); assert.deepEqual(busy.order, []);
});
test('discard must finish successfully, and edits that arrive during settlement veto installation', async () => {
  const f = fixture(); f.work.choose = async doc => { await doc.discard(); return true; }; assert.equal(await settleUpdateWork(f.work), 'ready');
  const late = fixture(); late.work.choose = async () => true; assert.equal(await settleUpdateWork(late.work), 'save');
});
test('a route change while saving cannot substitute an unexamined document', async () => {
  const f = fixture(), next = fixture();
  f.work.choose = async doc => { const result = await doc.save(); f.work.documents = () => [next.doc]; return result; };
  assert.equal(await settleUpdateWork(f.work), 'cancelled');
});
test('write drain waits for actual completion and retains errors until a successful retry of that write', async () => {
  let release!: () => void;
  const write = trackUpdateWrite('test-write', new Promise<void>(resolve => { release = resolve; }));
  let done = false; const drain = drainUpdateWrites().then(result => { done = true; return result; });
  await Promise.resolve(); assert.equal(done, false); release(); await write; assert.equal(await drain, true);
  await assert.rejects(trackUpdateWrite('test-write', Promise.reject(Error('disk full'))));
  assert.equal(await drainUpdateWrites(), false);
  await trackUpdateWrite('test-write', Promise.resolve()); assert.equal(await drainUpdateWrites(), true);
});
test('recording and export ownership stays active until explicitly released; release is idempotent', () => {
  const release = holdUpdateWork(); assert.equal(hasActiveUpdateWork(), true); release(); release(); assert.equal(hasActiveUpdateWork(), false);
});

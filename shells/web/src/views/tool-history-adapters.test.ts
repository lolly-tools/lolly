// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import { AUTOMATIC_HISTORY_TOOLS, hasHistoryAdapter, historyParticipation, trackRevisionInput } from './tool-history-adapters.ts';
import { createAutomaticHistory } from './automatic-history.ts';
import type { RevisionEntry } from '../bridge/revision-history.ts';

const manifest = (id: string): ToolManifest => JSON.parse(readFileSync(new URL(`../../../../community/${id}/tool.json`, import.meta.url), 'utf8'));

test('every enabled adapter matches its shipping input schema and every shared mount opts out of device history', () => {
  for (const id of AUTOMATIC_HISTORY_TOOLS) {
    assert.deepEqual(historyParticipation(manifest(id), false), { localHistory: true, recordDeviceActivity: true }, id);
    assert.deepEqual(historyParticipation(manifest(id), true), { localHistory: false, recordDeviceActivity: false }, id);
  }
});

test('temporary files, new nested types, capture capabilities and unaudited tools cannot silently acquire an adapter', () => {
  const tool = manifest('gradient');
  for (const id of ['darkroom', 'voice-recorder', 'record', 'convert-image', 'url-shot', 'new-tool']) assert.equal(hasHistoryAdapter(id), false, id);
  const changed: ToolManifest[] = [
    { ...tool, inputs: [...tool.inputs, { id: 'file', type: 'file', label: 'File' }] },
    { ...tool, inputs: [{ id: 'blocks', type: 'blocks', fields: [{ id: 'file', type: 'file' }] }] },
    { ...tool, inputs: [{ id: 'future', type: 'future-type' } as unknown as ToolManifest['inputs'][number]] },
    { ...tool, capabilities: ['camera'] },
    { ...tool, id: 'unaudited' },
  ];
  for (const value of changed) assert.equal(historyParticipation(value, false).localHistory, false);
});

test('a slow hook gets a second checkpoint opportunity after its final input patch, without changing the returned promise', async context => {
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  let value = 'typed', slot: string | null = null, resolve: (() => void) | undefined;
  const writes: unknown[] = [];
  const controller = createAutomaticHistory({ toolId: 'chart', getSlot: () => slot, setSlot: next => { slot = next; },
    snapshot: () => ({ value }), load: async () => null, capture: async () => null, saved() {},
    history: { head: async () => null, attachPreview: async () => {}, checkpoint: async (_slot, data) => { writes.push(data.value); return { id: String(writes.length) } as RevisionEntry; } },
  });
  const pending = new Promise<void>(done => { resolve = () => { value = 'hook normalised'; done(); }; });
  assert.equal(trackRevisionInput(pending, controller.changed), pending);
  await controller.flush(); assert.deepEqual(writes, ['typed']);
  resolve!(); await pending; await controller.flush();
  assert.deepEqual(writes, ['typed', 'hook normalised']);
  controller.dispose();
  const failed = Promise.reject(new Error('hook failure')); let calls = 0;
  await assert.rejects(trackRevisionInput(failed, () => { calls++; }), /hook failure/); assert.equal(calls, 1);
});

// SPDX-License-Identifier: MPL-2.0
/**
 * The enrolment rule for automatic recovery and version history (plan 277 P4): the
 * class of every shipped manifest, per pack, so a manifest edit that moves a tool
 * between classes is a visible decision rather than drift, and what each class gets.
 * CI runs a public clone, so the community counts are what it asserts; the private
 * SUSE pack adds its own line when it is mounted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import { fileInputPaths, historyClass, historyException, historyParticipation, historyRedact, isNotKeptFile, notKeptFiles, trackRevisionInput, withoutNotKept, type HistoryClass, type HistoryManifest } from './tool-history-adapters.ts';
import { createAutomaticHistory } from './automatic-history.ts';
import type { RevisionEntry } from '../bridge/revision-history.ts';
import { captureRevision } from '../bridge/revision-capture.ts';
import { buildInputModel } from '../../../../engine/src/inputs.ts';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const LETTER: Readonly<Record<HistoryClass, 'A' | 'B' | 'C' | 'D'>> = { document: 'A', 'side-file': 'B', settings: 'C', recording: 'D' };

/** Every manifest in a pack directory, by id. */
function pack(dir: string): Map<string, ToolManifest> {
  const out = new Map<string, ToolManifest>();
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs).sort()) {
    const file = join(abs, name, 'tool.json');
    if (name.startsWith('_') || name.startsWith('.') || !existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as ToolManifest;
    out.set(manifest.id, manifest);
  }
  return out;
}
const community = pack('community');
const suse = pack('brands/suse/tools');
const suseMounted = existsSync(join(ROOT, 'brands/suse/tools'));

function classes(tools: Iterable<ToolManifest>): Record<'A' | 'B' | 'C' | 'D', string[]> {
  const ids: Record<'A' | 'B' | 'C' | 'D', string[]> = { A: [], B: [], C: [], D: [] };
  for (const tool of tools) ids[LETTER[historyClass(tool)]].push(tool.id);
  return ids;
}
const counts = (ids: Record<'A' | 'B' | 'C' | 'D', string[]>) => ({ A: ids.A.length, B: ids.B.length, C: ids.C.length, D: ids.D.length });

test('community: 50 document tools, 2 with a side file, 13 file utilities and 3 recording tools', () => {
  const ids = classes(community.values());
  assert.deepEqual(counts(ids), { A: 50, B: 2, C: 13, D: 3 }, JSON.stringify(ids));
  assert.deepEqual(ids.B, ['3d', 'darkroom']);
  assert.deepEqual(ids.C, ['annotate', 'claim', 'clean', 'compress-pdf', 'convert-image', 'font-convert', 'pages', 'rebrand-deck', 'redact', 'scan-code', 'sign', 'strip-data', 'trim']);
  assert.deepEqual(ids.D, ['record', 'screencap', 'voice-recorder']);
  // Sandbox took its Save action away and is still filed like every tool (Andy,
  // 27 September 2026); jump and Text have no export; icon, url-shot and the blocks
  // tools used to be refused by the old capability and field-type checks.
  for (const id of ['sandbox', 'jump', 'text-helper', 'countdown-timer', 'doc-studio', 'icon', 'url-shot', 'calendar-ics', 'diagram-builder', 'meeting-planner']) {
    assert.ok(ids.A.includes(id), `${id} is a document tool`);
  }
});

test('SUSE: the pack adds 12 document tools and 1 recording tool', { skip: suseMounted ? false : 'brands/suse is not checked out, so the SUSE pack cannot be counted here' }, () => {
  // 3d and 3d-studio ship in both packs; the SUSE copies are overlays, not new tools.
  const added = [...suse.values()].filter(tool => !community.has(tool.id));
  const ids = classes(added);
  assert.deepEqual(counts(ids), { A: 12, B: 0, C: 0, D: 1 }, JSON.stringify(ids));
  assert.ok(ids.A.includes('email-signature'), 'untyped blocks fields are text, so email-signature is a document tool');
  assert.ok(ids.A.includes('susecon-background'), 'background scenes keep their authored document history');
  assert.deepEqual(ids.D, ['top-tail-recorder']);
});

test('every document and side-file tool keeps history unless the exceptions map names it; the other classes wait for their phase', () => {
  for (const tool of [...community.values(), ...suse.values()]) {
    const cls = historyClass(tool);
    const local = historyParticipation(tool, false);
    const expected = (cls === 'document' || cls === 'side-file') && historyException(tool.id) === null;
    assert.equal(local.localHistory, expected, `${tool.id} (${cls})`);
    assert.equal(local.mode, expected ? 'document' : 'none', tool.id);
    assert.equal(local.recordDeviceActivity, true, tool.id);
    assert.deepEqual(historyParticipation(tool, true), { mode: 'none', localHistory: false, recordDeviceActivity: false, notKept: local.notKept }, `${tool.id} shared`);
  }
  // No class A or B tool is excepted today: phase 0 found every document tool round-trips,
  // and 3d and Darkroom left the map once historyRedact recorded their files as not kept.
  for (const tool of community.values()) if (historyClass(tool) === 'document' || historyClass(tool) === 'side-file') assert.equal(historyException(tool.id), null, tool.id);
  assert.equal(historyException('constructor'), null, 'a prototype key is not an exception');
  assert.deepEqual(historyParticipation(community.get('darkroom')!, false), { mode: 'document', localHistory: true, recordDeviceActivity: true, notKept: ['lutFile'] });
  assert.deepEqual(historyParticipation(community.get('3d')!, false), { mode: 'document', localHistory: true, recordDeviceActivity: true, notKept: ['modelUpload'] });
  assert.deepEqual(historyParticipation(community.get('sandbox')!, false), { mode: 'document', localHistory: true, recordDeviceActivity: true, notKept: [] });
});

test('the rule reads the discriminators the code acts on, with no id list', () => {
  const base: HistoryManifest = { id: 'a-tool-nobody-listed', inputs: [{ id: 'title', type: 'text' }], render: { actions: ['copy', 'download', 'save'] } };
  assert.equal(historyParticipation(base, false).localHistory, true, 'an unknown id joins by its manifest');
  for (const cap of ['compose', 'capture', 'wasm']) assert.equal(historyParticipation({ ...base, capabilities: [cap] }, false).localHistory, true, cap);
  for (const cap of ['camera', 'microphone', 'screen']) {
    assert.equal(historyClass({ ...base, capabilities: [cap] }), 'recording', cap);
    assert.equal(historyParticipation({ ...base, capabilities: [cap] }, false).localHistory, false, cap);
  }
  assert.equal(historyParticipation({ ...base, inputs: [{ id: 'rows', type: 'blocks', fields: [{ id: 'name' }, { id: 'n', type: 'number' }] }] }, false).localHistory, true, 'a blocks field with no type is text');
  assert.equal(historyParticipation({ ...base, inputs: [{ id: 'future', type: 'future-type' }] }, false).localHistory, false, 'an unknown input type waits for a decision');
  assert.equal(historyParticipation({ ...base, inputs: [{ id: 'rows', type: 'blocks', fields: [{ id: 'x', type: 'future-type' }] }] }, false).localHistory, false);
  const nested: HistoryManifest = { ...base, inputs: [{ id: 'rows', type: 'blocks', fields: [{ id: 'f', type: 'file' }] }] };
  assert.equal(historyClass(nested), 'side-file');
  assert.deepEqual(fileInputPaths(nested.inputs), ['rows.f']);
  assert.deepEqual(historyParticipation(nested, false), { mode: 'document', localHistory: true, recordDeviceActivity: true, notKept: ['rows.f'] }, 'a file inside a blocks row is recorded as not kept too');
  assert.equal(historyClass({ ...nested, render: { actions: [] } }), 'settings');
  assert.equal(historyParticipation({ ...nested, render: { actions: [] } }, false).mode, 'none', 'class C files nothing until its settings history exists');
  assert.equal(historyClass({ ...base, render: { actions: ['copy', 'download'] } }), 'document', 'no Save action is still a document tool');
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

/** A loaded file as the web picker and the CLI hand one to the runtime. */
const loaded = (name: string, size = 4) => ({ __file: true as const, name, mime: 'text/plain', size, bytes: new Uint8Array(size), url: 'blob:http://localhost/1' });

test('historyRedact records every file as not kept: its name, type and size, never its bytes', () => {
  const data = { title: 'Grade', lutFile: loaded('warm.cube'), frames: [loaded('a.png', 2), loaded('b.png', 3)],
    rows: [{ __rid: 'r1', label: 'one', f: loaded('one.glb') }, { __rid: 'r2', label: 'two', f: null }], __toolId: 'x' };
  const kept = historyRedact(data, ['lutFile', 'frames', 'rows.f']);
  assert.deepEqual(kept.lutFile, { notKept: true, name: 'warm.cube', mime: 'text/plain', size: 4 });
  assert.deepEqual(kept.frames, [{ notKept: true, name: 'a.png', mime: 'text/plain', size: 2 }, { notKept: true, name: 'b.png', mime: 'text/plain', size: 3 }]);
  assert.deepEqual(kept.rows, [{ __rid: 'r1', label: 'one', f: { notKept: true, name: 'one.glb', mime: 'text/plain', size: 4 } }, { __rid: 'r2', label: 'two', f: null }]);
  assert.equal(kept.title, 'Grade'); assert.equal(kept.__toolId, 'x');
  assert.ok(data.lutFile.bytes instanceof Uint8Array, 'the live document is not changed');
  // What history refused before ("Save imported files to the library...") it now stores.
  assert.throws(() => captureRevision(data as never), /library/);
  assert.doesNotThrow(() => captureRevision(kept as never));
  assert.equal(JSON.stringify(captureRevision(kept as never).data).includes('blob:'), false, 'no temporary URL is kept either');
  assert.deepEqual(notKeptFiles(kept, ['lutFile', 'frames', 'rows.f']), ['warm.cube', 'a.png', 'b.png', 'one.glb']);
  assert.deepEqual(historyRedact(kept, ['lutFile', 'frames', 'rows.f']), kept, 'a kept document is kept as it is');
});

test('historyRedact leaves a document with nothing to leave out alone, and drops what is not a file', () => {
  const plain = { title: 'x', lutFile: null, frames: [] as unknown[] };
  assert.equal(historyRedact(plain, []), plain, 'no file inputs: the same object');
  assert.equal(historyRedact(plain, ['lutFile', 'frames', 'missing', 'rows.f']), plain, 'empty slots: the same object');
  const odd = historyRedact({ lutFile: 'C:/fake/path.cube', frames: [loaded('a.png'), 'stray'] }, ['lutFile', 'frames']);
  assert.equal(odd.lutFile, null, 'a stray value in a file slot is not kept as if it were a file');
  assert.deepEqual(odd.frames, [{ notKept: true, name: 'a.png', mime: 'text/plain', size: 4 }]);
  const long = historyRedact({ f: { __file: true, name: 'n'.repeat(400), size: Number.NaN } }, ['f']).f;
  assert.ok(isNotKeptFile(long)); assert.equal(long.name.length, 255); assert.equal(long.size, 0); assert.equal(long.mime, '');
  assert.equal(isNotKeptFile({ notKept: true }), false, 'a record carries the file name');
});

test('a not-kept file reopens as an empty file slot, so nothing claims the file is still there', () => {
  const kept = historyRedact({ lutFile: loaded('warm.cube'), frames: [loaded('a.png')], rows: [{ f: loaded('one.glb') }] }, ['lutFile', 'frames', 'rows.f']);
  assert.deepEqual(withoutNotKept(kept, ['lutFile', 'frames', 'rows.f']), { lutFile: null, frames: [], rows: [{ f: null }] });
  const model = buildInputModel({ inputs: [
    { id: 'lutFile', type: 'file', label: 'LUT' }, { id: 'frames', type: 'file', label: 'Frames', multiple: true },
  ] } as never, { initial: kept as never });
  assert.equal(model.find(i => i.id === 'lutFile')?.value, null, 'the engine reads the record as no file');
  assert.deepEqual(model.find(i => i.id === 'frames')?.value, []);
});

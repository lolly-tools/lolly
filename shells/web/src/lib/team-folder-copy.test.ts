// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFolderToTeam, folderCopyKey, sharedFolderMaterialName, type FolderCopyKit, type FolderCopyEntry } from './team-folder-copy.ts';
import type { Folder, FolderTeamCopy } from '../folders.ts';

function fixture() {
  const saved: string[] = [], uploaded: string[] = [], checkpoints: FolderTeamCopy[] = [];
  let creates = 0;
  const kit: FolderCopyKit = { writer: { projectOptions: () => ({ canCreate: true, groups: [] }),
    createProject: async () => { creates++; return { kind: 'created', project: { id: 'prj_event', name: 'Event' } }; },
    createSession: async (_project, session) => { saved.push(String(session.meta?.label)); return { kind: 'saved', id: `ses_${saved.length}`, rev: 1 }; },
    updateSession: async () => { throw Error('a copy must never overwrite a shared document'); },
  }, upload: async (_project, _blob, name) => { uploaded.push(name); return `file_${uploaded.length}`; },
  remember: async copy => { checkpoints.push(structuredClone(copy)); }, current: () => true, progress: () => {} };
  return { kit, saved, uploaded, checkpoints, creates: () => creates };
}
const entries: FolderCopyEntry[] = [{ ref: 'deck', name: 'Deck', session: { toolId: 'design', inputs: { title: 'Event' }, meta: { label: 'Deck' } } },
  { ref: 'logo', name: 'Images / Logo', file: new Blob(['logo']) }];

test('sharing copies all documents and files and never changes the local source', async () => {
  const f = fixture(), before = structuredClone(entries);
  const copy = await copyFolderToTeam('Event', 'https://instance.test', entries, undefined, f.kit);
  assert.deepEqual(entries, before); assert.equal(copy.complete, true); assert.deepEqual(f.saved, ['Deck']); assert.deepEqual(f.uploaded, ['Images / Logo']);
  assert.deepEqual(copy.copied, { deck: 'ses_1', logo: 'file_1' }); assert.equal(f.checkpoints.at(-1)?.complete, true);
});

test('a failed file transfer leaves a checkpoint and retry does not duplicate already shared documents', async () => {
  const f = fixture(), upload = f.kit.upload; f.kit.upload = async () => { throw Error('offline'); };
  await assert.rejects(copyFolderToTeam('Event', 'https://instance.test', entries, undefined, f.kit), /offline/);
  const partial = f.checkpoints.at(-1)!; assert.equal(partial.complete, false); assert.deepEqual(partial.copied, { deck: 'ses_1' });
  f.kit.upload = upload;
  const copy = await copyFolderToTeam('Event', 'https://instance.test', entries, partial, f.kit);
  assert.equal(copy.complete, true); assert.equal(f.creates(), 1); assert.deepEqual(f.saved, ['Deck']); assert.deepEqual(f.uploaded, ['Images / Logo']);
});

test('cancelling after a document finishes preserves that checkpoint and stops subsequent transfers', async () => {
  const f = fixture(); let current = true; f.kit.current = () => current; f.kit.progress = () => { current = false; };
  await assert.rejects(copyFolderToTeam('Event', 'https://instance.test', entries, undefined, f.kit), /cancelled/);
  assert.deepEqual(f.saved, ['Deck']); assert.deepEqual(f.uploaded, []); assert.equal(f.checkpoints.at(-1)?.complete, false);
});

test('checkpoint keys change with the material and do not borrow object prototype properties', async () => {
  assert.notEqual(await folderCopyKey('deck', '{"title":"one"}'), await folderCopyKey('deck', '{"title":"two"}'));
  const f = fixture(), item = { ...entries[0]!, ref: '__proto__' };
  const copy = await copyFolderToTeam('Event', 'https://instance.test', [item], undefined, f.kit);
  assert.equal(Object.hasOwn(copy.copied, '__proto__'), true); assert.deepEqual(f.saved, ['Deck']);
});

test('nested folder names stay attached to shared document names', () => {
  const tree: Folder[] = [{ id: 'root', name: 'Event', items: [], createdAt: '', updatedAt: '' }, { id: 'child', parentId: 'root', name: 'Stage', items: [], createdAt: '', updatedAt: '' }];
  assert.equal(sharedFolderMaterialName(tree, 'root', 'child', 'Deck'), 'Stage / Deck');
  assert.equal(sharedFolderMaterialName(tree, 'root', 'root', 'Deck'), 'Deck');
});

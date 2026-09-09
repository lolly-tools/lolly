// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisionSnapshot } from './revision-snapshot.ts';
import { validateRevisionArchive, type RevisionArchive } from './revision-archive-format.ts';

async function archive(): Promise<RevisionArchive> {
  const saved = await revisionSnapshot({ __toolId: 'design', __label: 'One', text: 'saved' });
  const draft = await revisionSnapshot({ ...saved.data, text: 'draft' });
  const at = '2026-09-07T10:00:00.000Z';
  return { version: 1,
    documents: [{ document: { slot: 'slot', documentId: 'doc', head: 'revision', hash: saved.hash, version: 'draft', workingHash: draft.hash },
      state: { slot: 'slot', documentId: 'doc', toolId: 'design', toolVersion: undefined, label: 'One', data: draft.data, thumb: null, updatedAt: at } }],
    revisions: [{ entry: { id: 'revision', documentId: 'doc', slot: 'slot', parentId: 'compacted-parent', toolId: 'design', label: 'One', at, reason: 'save', hash: saved.hash, bytes: saved.bytes, assetRefs: [] }, data: saved.data, preview: 'data:image/png;base64,AA==' }],
    recoveries: [{ id: 'writer', documentId: 'doc', slot: 'slot', version: 'draft', baseHead: 'revision', baseVersion: 'revision', toolId: 'design', label: 'One', at, diverged: false, hash: draft.hash, bytes: draft.bytes, assetRefs: [], data: draft.data }],
  };
}

test('portable validation retains the current working draft, immutable checkpoint, thumbnail and compacted parent reference', async () => {
  const saved = await archive(); saved.revisions[0]!.entry.milestone = 'Approved launch';
  const value = await validateRevisionArchive(saved);
  assert.equal(value.revisions[0]!.entry.milestone, 'Approved launch');
  assert.equal(value.documents[0]!.state.data.text, 'draft');
  assert.equal(value.revisions[0]!.data.text, 'saved');
  assert.equal(value.revisions[0]!.entry.parentId, 'compacted-parent');
  assert.equal(value.revisions[0]!.preview, 'data:image/png;base64,AA==');
  assert.equal(value.recoveries[0]!.data.text, 'draft');
});

test('archive validation rejects altered hashes, duplicate identities, missing heads, cyclic ancestry and executable previews', async () => {
  for (const mutate of [
    (value: RevisionArchive) => { value.revisions[0]!.data.text = 'tampered'; },
    (value: RevisionArchive) => { value.revisions.push(value.revisions[0]!); },
    (value: RevisionArchive) => { value.documents[0]!.document.head = 'missing'; },
    (value: RevisionArchive) => { value.revisions[0]!.entry.parentId = 'revision'; },
    (value: RevisionArchive) => { value.revisions[0]!.preview = 'data:image/svg+xml,<svg onload="alert(1)"/>'; },
    (value: RevisionArchive) => { value.recoveries[0]!.data.text = 'tampered draft'; },
    (value: RevisionArchive) => { value.revisions[0]!.entry.milestone = 'x'.repeat(121); },
  ]) {
    const value = await archive(); mutate(value);
    await assert.rejects(validateRevisionArchive(value), /Invalid revision history/);
  }
});

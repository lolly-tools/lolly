// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://instance.test/#/p' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location });
const { projectsDropHooks, sharedDropTarget } = await import('./projects-drop.ts');

test('the shared project and folder come from the address', () => {
  assert.deepEqual(sharedDropTarget('#/p?team=prj_1'), { projectId: 'prj_1', folderId: null });
  assert.deepEqual(sharedDropTarget('#/p?team=prj_1&folder=fld_2'), { projectId: 'prj_1', folderId: 'fld_2' });
  assert.deepEqual(sharedDropTarget('#/p?team=prj_1&tab=files'), { projectId: 'prj_1', folderId: null });
  assert.equal(sharedDropTarget('#/p?team=prj_1&tab=people'), null, 'not on the People tab');
  assert.equal(sharedDropTarget('#/p'), null);
  assert.equal(sharedDropTarget('#/p/fld_local'), null);
  assert.equal(sharedDropTarget('#/tool/design?team=prj_1'), null);
});

test('at the top of Projects, and for .lolly files, the chooser still runs', async () => {
  const hooks = projectsDropHooks({
    host: {} as never, folderTarget: () => null, addToFolder: async () => {}, refresh: async () => {}, mounted: () => true,
  });
  dom.window.location.hash = '#/p';
  assert.equal(await hooks.direct!([new dom.window.File(['x'], 'a.png') as unknown as File]), false);
  assert.equal(hooks.hint!(), '', 'the usual hint');
  const inFolder = projectsDropHooks({
    host: {} as never, folderTarget: () => 'fld_1', addToFolder: async () => {}, refresh: async () => {}, mounted: () => true,
  });
  assert.equal(await inFolder.direct!([new dom.window.File(['x'], 'pack.lolly') as unknown as File]), false);
  assert.equal(inFolder.hint!(), 'Drop to add to this folder');
});

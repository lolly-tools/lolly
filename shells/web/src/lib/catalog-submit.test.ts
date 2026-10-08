// SPDX-License-Identifier: MPL-2.0
/**
 * lib/catalog-submit.ts - the dormant-by-default seam behind "Submit to <workspace>".
 *
 * Run directly:  node --test shells/web/src/lib/catalog-submit.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  _clearCatalogSubmitterForTests, catalogSubmitter, openCatalogSubmit, registerCatalogSubmitter,
  templateSubject, uploadSubject, userToolSubject, type CatalogSubmitSubject,
} from './catalog-submit.ts';

test('nothing is offered until something registers, and an unregister restores that', () => {
  _clearCatalogSubmitterForTests();
  assert.equal(catalogSubmitter('upload'), null);
  assert.equal(openCatalogSubmit(templateSubject({ id: 't1', toolId: 'design', name: 'A', values: {}, createdAt: '', updatedAt: '' })), false);
  const opened: CatalogSubmitSubject[] = [];
  const off = registerCatalogSubmitter({ label: () => 'Submit to Acme', accepts: (k) => k !== 'user-tool', open: (s) => opened.push(s) });
  assert.equal(catalogSubmitter('upload')?.label(), 'Submit to Acme');
  assert.equal(catalogSubmitter('user-tool'), null, 'a kind the submitter does not take is not offered');
  assert.equal(openCatalogSubmit(templateSubject({ id: 't1', toolId: 'design', name: 'A', values: {}, createdAt: '', updatedAt: '' })), true);
  assert.equal(opened[0]?.ref, 'template:t1');
  off();
  assert.equal(catalogSubmitter('upload'), null);
});

test('a throwing submitter never breaks the surface that asked', () => {
  _clearCatalogSubmitterForTests();
  registerCatalogSubmitter({ label: () => 'x', accepts: () => { throw new Error('boom'); }, open: () => {} });
  assert.equal(catalogSubmitter('upload'), null);
  _clearCatalogSubmitterForTests();
  registerCatalogSubmitter({ label: () => 'x', accepts: () => true, open: () => { throw new Error('boom'); } });
  assert.equal(openCatalogSubmit(uploadSubject({ id: 'user/a.png', url: 'blob:x', type: 'raster', format: 'png', source: 'user' } as never)), false);
  _clearCatalogSubmitterForTests();
});

test('a template subject sends the exported file shape plus the tool it seeds', async () => {
  const s = templateSubject({ id: 't9', toolId: 'design', name: 'Launch poster', description: 'Big type', values: { doc: '{}' }, createdAt: '', updatedAt: '' });
  assert.equal(s.kind, 'template');
  assert.equal(s.toolId, 'design');
  const body = await s.body();
  assert.equal(body.type, 'application/json');
  assert.deepEqual(JSON.parse(await body.text()), { toolId: 'design', id: 'launch-poster', name: 'Launch poster', description: 'Big type', values: { doc: '{}' } });
});

test('a user tool subject sends its base tool, title, glyph, formats and values', async () => {
  const s = userToolSubject({ id: 'u1', title: 'Badge maker', icon: '★', formats: ['png'], baseToolId: 'design', values: { a: 1 }, createdAt: '', updatedAt: '' });
  assert.equal(s.ref, 'user-tool:u1');
  assert.deepEqual(JSON.parse(await (await s.body()).text()), { baseToolId: 'design', title: 'Badge maker', icon: '★', formats: ['png'], values: { a: 1 } });
});

test('an upload subject names itself from the asset and keeps its tags', () => {
  const s = uploadSubject({ id: 'user/abc', url: 'blob:x', type: 'raster', format: 'png', source: 'user', meta: { name: 'Hero shot', tags: ['launch', 3] } } as never);
  assert.equal(s.name, 'Hero shot');
  assert.deepEqual(s.tags, ['launch']);
  assert.equal(s.ref, 'upload:user/abc');
  assert.equal(uploadSubject({ id: 'user/raw.png', url: 'blob:x', type: 'raster', format: 'png', source: 'user' } as never).name, 'raw.png');
});

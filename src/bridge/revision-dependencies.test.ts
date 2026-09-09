// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { revisionDependencies } from './revision-dependencies.ts';
import { encodeAssetVersion } from '../../../../engine/src/asset-version.ts';

const ref = (id = 'user/upload/photo') => ({ source: 'user', id, type: 'raster', format: 'png', pin: { version: 'v1', format: 'png' }, meta: { name: 'Portrait' } });

test('dependency groups retain every occurrence and keep exact versions and formats separate', () => {
  const first = ref(), second = ref();
  const report = revisionDependencies({ first, nested: [second, { ...ref(), pin: { version: 'v2', format: 'png' } }, { ...ref(), pin: { version: 'v1', format: 'webp' } }] });
  assert.equal(report.truncated, false); assert.equal(report.dependencies.length, 3);
  assert.deepEqual(report.dependencies[0]?.references, [first, second]);
  assert.equal(report.dependencies[0]?.label, 'Portrait');
  const encoded = revisionDependencies({ ref: { ...ref(encodeAssetVersion('user/upload/photo', { version: 'old', format: 'png' })), pin: undefined } });
  assert.equal(encoded.dependencies[0]?.pin?.version, 'old');
});

test('embedded files, external references and malformed pins are not presented as catalog lookups', () => {
  const report = revisionDependencies({ embedded: { ...ref(), meta: { baked: true }, url: 'data:image/png;base64,AA==' },
    remote: { ...ref('https://example.test/photo'), source: 'remote' }, invalid: { ...ref(), pin: { version: '' } },
    title: 'user/upload/photo', link: encodeAssetVersion('user/upload/photo', { version: 'v1' }) });
  assert.deepEqual(report.dependencies.map(dep => dep.kind), ['embedded', 'unverified', 'invalid', 'unverified']);
  assert.equal(report.dependencies[3]?.references.length, 0, 'a string is never a repair target without its input schema');
});

test('large, deep and cyclic inputs stop with an incomplete report', () => {
  const wide = revisionDependencies(Array.from({ length: 200 }, (_, i) => ref(`user/upload/${i}`)));
  assert.equal(wide.dependencies.length, 128); assert.equal(wide.truncated, true);
  assert.equal(revisionDependencies(Array.from({ length: 20_001 }, () => 0)).truncated, true);
  let deep: unknown = ref(); for (let i = 0; i < 80; i++) deep = { child: deep };
  assert.equal(revisionDependencies(deep).truncated, true);
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  assert.equal(revisionDependencies(cycle).truncated, true);
});

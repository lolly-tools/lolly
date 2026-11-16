// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toolCanvasRole } from './tool-canvas-role.ts';

const manifest = { id: 'preview', render: { width: 640, height: 480, formats: ['png'] } };

test('ordinary previews keep the image role', () => {
  assert.equal(toolCanvasRole(manifest, false, false), 'img');
  assert.equal(toolCanvasRole({ ...manifest, render: { ...manifest.render, webPreview: false, sidebar: true, export: true } }, false, false), 'img');
});

test('each canvas control condition keeps children accessible', () => {
  assert.equal(toolCanvasRole(manifest, true, false), 'group');
  assert.equal(toolCanvasRole({ ...manifest, id: '3d-studio' }, false, false), 'group');
  assert.equal(toolCanvasRole(manifest, false, true), 'group');
  for (const render of [{ webPreview: true }, { sidebar: false }, { export: false }]) {
    assert.equal(toolCanvasRole({ ...manifest, render: { ...manifest.render, ...render } }, false, false), 'group');
  }
});

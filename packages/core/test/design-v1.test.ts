// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESIGN_DOCUMENT_VERSION, inspectDesignV1 } from '../src/design-v1.ts';

test('Design inspection exposes ordered artboards, layers and timing', () => {
  const report = inspectDesignV1([
    { id: 'page-2', kind: 'frame', name: 'Second', order: 2, x: 1200, y: 0, w: 1000, h: 800 },
    { id: 'page-1', kind: 'frame', name: 'First', order: 1, x: 0, y: 0, w: 1000, h: 800 },
    {
      id: 'headline',
      kind: 'text',
      frame: 'page-1',
      x: 80,
      y: 100,
      w: 840,
      h: 160,
      text: 'Hello',
      start: 1,
      dur: 2,
    },
    {
      id: 'photo',
      kind: 'image',
      frame: 'page-2',
      x: 1280,
      y: 100,
      w: 840,
      h: 600,
      image: 'catalog/photo',
    },
  ]);

  assert.equal(report.version, DESIGN_DOCUMENT_VERSION);
  assert.equal(report.valid, true);
  assert.deepEqual(
    report.artboards.map((item) => item.id),
    ['page-1', 'page-2']
  );
  assert.deepEqual(report.artboards[0]!.childLayerIds, ['headline']);
  assert.equal(report.layers.find((item) => item.id === 'headline')!.timing!.end, 3);
  assert.equal(report.layers.find((item) => item.id === 'photo')!.assetId, 'catalog/photo');
  assert.deepEqual(report.summary, {
    artboards: 2,
    layers: 2,
    hiddenLayers: 0,
    timedLayers: 1,
    duration: 3,
    errors: 0,
    warnings: 0,
  });
  assert.deepEqual(report.requiresMount, ['text-overflow', 'computed-contrast', 'resolved-fonts']);
});

test('Design inspection reports structural errors and actionable warnings', () => {
  const report = inspectDesignV1([
    { id: 'page', kind: 'frame', x: 0, y: 0, w: 100, h: 100 },
    { id: 'copy', kind: 'text', frame: 'missing', x: 0, y: 0, w: 0, h: 20, text: '' },
    { id: 'copy', kind: 'mystery', x: 0, y: 0, w: 20, h: 20 },
    { id: 'outside', kind: 'image', frame: 'page', x: 90, y: 90, w: 40, h: 40 },
  ]);

  assert.equal(report.valid, false);
  const ids = new Set(report.findings.map((item) => item.id));
  for (const id of [
    'design.layer.id-duplicate',
    'design.layer.kind-unknown',
    'design.layer.dimension-invalid',
    'design.layer.artboard-missing',
    'design.layer.outside-artboard',
    'design.text.empty',
    'design.image.empty',
    'design.artboard.unnamed',
  ])
    assert.ok(ids.has(id as never), `missing ${id}`);
  assert.equal(report.summary.errors, 4);
  assert.ok(report.summary.warnings >= 4);
});

test('Design inspection fails honestly when boxes is not an array', () => {
  const report = inspectDesignV1({});
  assert.equal(report.valid, false);
  assert.equal(report.findings[0]!.id, 'design.boxes.invalid');
  assert.equal(report.layers.length, 0);
});

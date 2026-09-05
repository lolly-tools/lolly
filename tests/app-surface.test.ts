// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appSurfaceBoxes, appSurfaceExportReport, appSurfaceToPenpotDoc, type AppSurface } from '../engine/src/app-surface.ts';

const surface: AppSurface = {
  id: 'component-library-sample', name: 'Lolly UI library sample', canvas: { w: 640, h: 480 }, background: '#f8fafc', dataPolicy: 'sample',
  nodes: [
    { type: 'frame', id: 'library', name: 'Component library', x: 0, y: 0, w: 640, h: 480, background: '#f8fafc' },
    { type: 'rect', id: 'button', frame: 'library', name: 'Save', role: 'control', component: { name: 'Button', variant: 'primary', state: 'default' }, x: 24, y: 24, w: 120, h: 40, background: '#0c322c', radius: 8 },
    { type: 'text', id: 'label', frame: 'library', name: 'Save label', role: 'text', component: { name: 'Button', variant: 'primary' }, x: 56, y: 35, w: 64, h: 18, text: 'Save', color: '#ffffff', weight: 700 },
  ],
};

test('app surfaces preserve declared component semantics as editable shape names', () => {
  const boxes = appSurfaceBoxes(surface);
  assert.equal(boxes[1]?.name, 'Save [Button/primary/default]');
  assert.equal(boxes[2]?.name, 'Save label [Button/primary]');
  const doc = appSurfaceToPenpotDoc(surface, { tokens: { lolly: { ui: {} } } });
  assert.equal(doc.pages[0]?.shapes[0]?.type, 'board');
  assert.equal((doc.pages[0]?.shapes[0] as any).children.length, 2);
  assert.deepEqual(doc.tokens, { lolly: { ui: {} } });
});

test('app surface reports do not overstate component or token support', () => {
  assert.deepEqual(appSurfaceExportReport(surface), {
    surfaceId: 'component-library-sample', dataPolicy: 'sample', nodeCount: 3,
    componentMode: 'named-editable-frames', tokenBindingMode: 'token-document', fallbacks: [],
  });
});

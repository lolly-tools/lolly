// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { seededPenpotUuid, PENPOT_ROOT_ID } from '../../../../engine/src/penpot-file.ts';
import type { PenpotDoc } from '../../../../engine/src/penpot-file.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { buildComponentArchive, componentTokenDocument } from './component-penpot.ts';
import { AUDIT_SECTIONS } from '../views/components-data.ts';
import { componentFixture } from '../views/components-fixtures.ts';

const fixture = (): PenpotDoc => ({ name: 'Button', pages: [{ name: 'Primary button', shapes: [{
  type: 'board', name: 'Primary button', x: 0, y: 0, w: 240, h: 100, children: [
    { type: 'rect', name: 'Primary surface', x: 30, y: 28, w: 180, h: 44, radius: 8, fills: [{ color: '#0c322c' }] },
    { type: 'text', name: 'Label', x: 74, y: 40, w: 94, h: 20, paragraphs: [{ runs: [{ text: 'Make something', fontSize: 14, fontFamily: 'SUSE', color: '#ffffff' }] }] },
  ],
}] }] });

test('a zipped component has a reusable main instance, editable text, and token links that all resolve', () => {
  const doc = fixture();
  const before = structuredClone(doc);
  const build = buildComponentArchive(doc, { uuid: seededPenpotUuid(12), now: () => '2026-09-06T10:00:00Z' });
  assert.deepEqual(doc, before, 'export must not rename or change the caller’s document');
  const zipped = zipSync(Object.fromEntries(Object.entries(build.entries).map(([path, value]) => [path, typeof value === 'string' ? strToU8(value) : value])));
  const entries = Object.fromEntries(Object.entries(unzipSync(zipped)).map(([path, value]) => [path, JSON.parse(strFromU8(value))]));
  const components = Object.entries(entries).filter(([path]) => path.includes('/components/')).map(([, value]) => value);
  assert.equal(components.length, 1);
  const component = components[0]!;
  const shapes = Object.entries(entries).filter(([path]) => /^files\/[^/]+\/pages\/[^/]+\/[^/]+\.json$/.test(path)).map(([, value]) => value);
  const root = shapes.find(s => s.id === component.mainInstanceId)!;
  assert.equal(root.type, 'frame');
  assert.equal(root.componentId, component.id);
  assert.equal(root.componentFile, build.fileId);
  assert.equal(root.mainInstance, true);
  assert.equal(root.componentRoot, true);
  assert.equal(root.pageId, component.mainInstancePage);
  assert.equal(shapes.find(s => s.id === PENPOT_ROOT_ID)?.componentId, undefined);
  const text = shapes.find(s => s.type === 'text')!;
  assert.equal(text.content.children[0].children[0].children[0].text, 'Make something');
  assert.ok(text.appliedTokens.fontSize);
  assert.ok(text.appliedTokens.fontFamily);
  assert.equal(build.mediaCount, 0, 'the component must not be a flattened image');
  const tokenDoc = entries[`files/${build.fileId}/tokens.json`];
  const tokens = createTokenSet(tokenDoc);
  for (const shape of shapes) for (const path of Object.values(shape.appliedTokens || {})) {
    assert.ok(tokens.has(path as string), `missing token ${path}`);
    assert.notEqual(tokens.resolve(path as string), undefined, `unresolved token ${path}`);
  }
  const surface = shapes.find(s => s.name.endsWith('Primary surface'))!;
  assert.equal(tokens.resolve(surface.appliedTokens.fill), '#0c322c');
  assert.equal(tokens.resolve(surface.appliedTokens.r1), '8px');
  assert.equal(tokenDoc.global.lolly.component['primary-button-1']['layer-2'].fill.$value, '{lolly.ui.color.action.primary}');
  assert.deepEqual(build.warnings, []);
});

test('multiple components with repeated layer names keep separate bindings and page ownership', () => {
  const doc = fixture();
  const second = structuredClone(doc.pages[0]!);
  second.name = 'Secondary button';
  const board = second.shapes[0]!;
  if (board.type !== 'board' || board.children[0]?.type !== 'rect') throw new Error('bad fixture');
  board.children[0].fills = [{ color: '#ff0000' }];
  doc.pages.push(second);
  const build = buildComponentArchive(doc, { uuid: seededPenpotUuid(18) });
  const objects = Object.values(build.entries).filter((s): s is string => typeof s === 'string').map(s => JSON.parse(s));
  const components = objects.filter(x => x.mainInstanceId);
  assert.equal(components.length, 2);
  assert.notEqual(components[0].mainInstancePage, components[1].mainInstancePage);
  const tokens = createTokenSet(JSON.parse(build.entries[`files/${build.fileId}/tokens.json`] as string));
  const colors = objects.filter(x => x.name?.endsWith('Primary surface')).map(x => tokens.resolve(x.appliedTokens.fill));
  assert.deepEqual(colors, ['#0c322c', '#ff0000']);
});

test('theme capture preserves aliases and never writes CSS calc expressions as Penpot token values', () => {
  const doc = componentTokenDocument({ 'lolly.ui.color.action.primary': 'rgb(22, 33, 44)', 'lolly.ui.type.display': 'calc(64px * 1.2)', 'lolly.ui.radius.control': '12px' });
  assert.equal(doc.lolly.ui.color.action.primary.$value, '#16212c');
  assert.equal(doc.lolly.ui.type.display.$value, '64px');
  assert.equal(doc.lolly.ui.radius.control.$value, '{lolly.foundation.radius.sm}');
});

test('every host-only inventory entry has a labelled design fixture rather than a code-only export', () => {
  const items = AUDIT_SECTIONS.flatMap(s => s.items);
  for (const item of items.filter(s => !s.live && !s.markup)) assert.ok(componentFixture(item), `missing fixture: ${item.name}`);
});

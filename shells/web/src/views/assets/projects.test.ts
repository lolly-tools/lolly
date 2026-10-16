// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { projectsOps, projectSourceId, projectFileRef } from './projects.ts';
import { registerSessionSource } from '../../lib/session-source.ts';
import type { CatCtx } from './context.ts';
import type { TeamFile } from '../../org/team-files.ts';

const dom = new JSDOM('<main></main>');
const file: TeamFile = { id: 'fil_abcdefghijklmnopqrstuv', projectId: 'p1', name: 'Hero.png', checksum: 'a'.repeat(64), size: 32, contentType: 'image/png', ready: true, asset: { format: 'png' } };
const settle = () => new Promise(resolve => setTimeout(resolve, 10));

test('shared browsing is metadata-only, scoped by folder, and clears retained selections after access loss', async () => {
  let denied = false; const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  const off = registerSessionSource({ label: 'Work', scope: 'person', listProjects: async () => [{ id: 'p1', name: 'Campaign', myRole: 'viewer' }], listSessions: async () => [], fetchSession: async () => null });
  globalThis.fetch = async input => {
    const url = String(input); calls.push(url);
    if (denied) return Response.json({}, { status: 403 });
    if (url.endsWith('/files')) return Response.json({ files: [file], limits: {} });
    if (url.endsWith('/folders')) return Response.json({ folders: [{ id: 'nested', projectId: 'p1', name: 'Nested', parentId: null, items: [{ kind: 'file', ref: file.id }] }] });
    throw new Error('Browsing must not read original file bytes');
  };
  let closed = 0;
  const cat = { viewEl: dom.window.document.querySelector('main')!, sourceSelection: projectSourceId('p1', 'nested'), sourceExpanded: new Set(), hiddenSet: new Set(), selected: new Set(), assetById: new Map(), mounted: true, query: '', typeFilter: 'all',
    sections: { renderBody() {}, closeDetails() { closed++; } }, sources: { mount() {} }, filters: { matchesType: () => true }, thumbs: { assetTile: () => '<span>file</span>' } } as unknown as CatCtx;
  const projects = projectsOps(cat);
  try {
    projects.sync(); await settle();
    assert.equal(projects.visible().length, 1); assert.equal(calls.length, 2);
    assert.equal(projects.tree()?.children?.[0]?.children?.[0]?.label, 'Nested');
    assert.equal(projectFileRef(file).meta?._placeholder, true, 'no original downloads for grid thumbnails');
    cat.selected.add(projectFileRef(file).id);
    cat.sourceSelection = projectSourceId('p1'); projects.sync(); await settle();
    assert.equal(projects.visible().length, 0); assert.ok(cat.assetById.has(projectFileRef(file).id));
    denied = true; cat.sourceSelection = projectSourceId('p1', 'nested'); projects.sync(); await settle();
    assert.equal(projects.visible().length, 0); assert.equal(cat.selected.size, 0); assert.equal(cat.assetById.size, 0); assert.ok(closed);
  } finally { projects.dispose(); off(); globalThis.fetch = originalFetch; }
});

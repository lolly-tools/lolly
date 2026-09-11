// SPDX-License-Identifier: MPL-2.0
/**
 * installed-tools - pure helpers (plans/114 Wave 7).
 *
 * The Cache Storage + IndexedDB paths (installTool/uninstall/fetchFile) need a browser
 * and are verified there; here we exercise the framework-free logic that decides content
 * types, path safety, module-hooks refusal, and how a sideloaded tool projects into the
 * catalog tool-index (the shape the galleries + the tool view's existence check read).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import {
  contentTypeFor,
  usesModuleHooks,
  safeToolRelPath,
  toolIndexEntryFromMeta,
  mergeInstalledEntries,
  type InstalledToolMeta,
} from './installed-tools.ts';

const manifest = (over: Partial<ToolManifest> = {}): ToolManifest => ({
  id: 'demo-tool',
  name: 'Demo Tool',
  description: 'A sideloaded demo',
  version: '2.0.0',
  category: 'Utilities',
  render: { formats: ['svg', 'png'] },
  inputs: [],
  ...over,
} as ToolManifest);

const meta = (over: Partial<InstalledToolMeta> = {}): InstalledToolMeta => ({
  id: 'demo-tool',
  at: '2026-08-16T00:00:00.000Z',
  trust: 'custom',
  version: '2.0.0',
  bytes: 100,
  fileCount: 4,
  manifest: manifest(),
  ...over,
});

test('contentTypeFor maps loader files to believable types (never HTML for non-.html)', () => {
  assert.equal(contentTypeFor('template.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeFor('styles.css'), 'text/css; charset=utf-8');
  assert.equal(contentTypeFor('hooks.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('tool.json'), 'application/json; charset=utf-8');
  assert.equal(contentTypeFor('icon.svg'), 'image/svg+xml');
  assert.equal(contentTypeFor('template.ics'), 'text/plain; charset=utf-8');
  assert.equal(contentTypeFor('assets/logo.png'), 'image/png');
  assert.equal(contentTypeFor('assets/mystery'), 'application/octet-stream');
  // The loader rejects an HTML body for a non-.html path, so nothing else may be HTML.
  for (const p of ['styles.css', 'hooks.js', 'tool.json', 'assets/logo.png']) {
    assert.ok(!contentTypeFor(p).includes('text/html'), `${p} must not be served as HTML`);
  }
});

test('usesModuleHooks detects the code shape we cannot sideload yet', () => {
  assert.equal(usesModuleHooks(manifest({ hooks: { module: true } as ToolManifest['hooks'] })), true);
  assert.equal(usesModuleHooks(manifest({ hooks: { onInit: true } as ToolManifest['hooks'] })), false);
  assert.equal(usesModuleHooks(manifest()), false);
});

test('safeToolRelPath strips leading slashes and rejects traversal', () => {
  assert.equal(safeToolRelPath('template.html'), 'template.html');
  assert.equal(safeToolRelPath('assets/logo.svg'), 'assets/logo.svg');
  assert.equal(safeToolRelPath('/template.html'), 'template.html');
  assert.equal(safeToolRelPath('./assets/./x.svg'), 'assets/x.svg');
  assert.equal(safeToolRelPath('../evil.js'), '', 'traversal is dropped');
  assert.equal(safeToolRelPath('assets/../../evil'), '', 'nested traversal is dropped');
});

test('toolIndexEntryFromMeta projects the manifest into a catalog-shaped entry', () => {
  const entry = toolIndexEntryFromMeta(meta({ icon: '<svg id="x"/>' }));
  assert.equal(entry.id, 'demo-tool');
  assert.equal(entry.name, 'Demo Tool');
  assert.equal(entry.description, 'A sideloaded demo');
  assert.equal(entry.category, 'Utilities');
  assert.deepEqual(entry.formats, ['svg', 'png']);
  assert.equal(entry.exportable, true);
  assert.equal(entry.icon, '<svg id="x"/>');
  assert.equal(entry._installed, true);
  assert.equal(entry._trust, 'custom');
  assert.deepEqual(entry.en, { name: 'Demo Tool', description: 'A sideloaded demo' });
});

test('toolIndexEntryFromMeta marks a render-only / no-format tool non-exportable', () => {
  const entry = toolIndexEntryFromMeta(meta({ manifest: manifest({ render: { formats: [], export: false, width: 100, height: 100 } }) }));
  assert.equal(entry.exportable, false);
  assert.deepEqual(entry.formats, []);
});

test('mergeInstalledEntries is idempotent, appends installed, and lets the catalog win', () => {
  const catalogTools: Array<Record<string, unknown>> = [
    { id: 'qr-code', name: 'QR Code' },
    { id: 'demo-tool', name: 'Demo (from catalog)' },   // same id as an installed tool
  ];
  const metas = [meta(), meta({ id: 'sideloaded-only', manifest: manifest({ id: 'sideloaded-only', name: 'Sideloaded' }) })];

  const once = mergeInstalledEntries(catalogTools, metas);
  // demo-tool stays the catalog copy (not shadowed); only the catalog-absent one is added.
  assert.equal(once.filter(t => t.id === 'demo-tool').length, 1);
  assert.equal(once.find(t => t.id === 'demo-tool')!.name, 'Demo (from catalog)');
  assert.equal(once.find(t => t.id === 'demo-tool')!._installed, undefined);
  const added = once.find(t => t.id === 'sideloaded-only')!;
  assert.equal(added._installed, true);

  // Re-merging the already-merged list drops the prior _installed entry first, so no dupes.
  const twice = mergeInstalledEntries(once, metas);
  assert.equal(twice.filter(t => t.id === 'sideloaded-only').length, 1);
  assert.equal(twice.length, once.length);
});

test('mergeInstalledEntries with no installed tools returns only the catalog tools', () => {
  const catalogTools: Array<Record<string, unknown>> = [{ id: 'qr-code' }, { id: 'street-map' }];
  const out = mergeInstalledEntries(catalogTools, []);
  assert.deepEqual(out.map(t => t.id), ['qr-code', 'street-map']);
});

// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deriveBrandTokens, readZip, summarizeTokensDoc } from '@lolly/engine';

const dir = await mkdtemp(join(tmpdir(), 'lolly-node-systems-'));
process.env.LOLLY_STATE_DIR = dir;
const store = await import('../src/design-systems.ts');

test.after(async () => { await rm(dir, { recursive: true, force: true }); });

test('a resources-first workspace keeps catalog tokens available until a colour arrives', async () => {
  const workspace = await store.createNodeDesignSystem({
    label: 'Mixed material', tokens: null, source: { kind: 'manual' },
  });
  await store.addNodeDesignResources([{ name: '../logo.svg', bytes: new TextEncoder().encode('<svg/>') }]);
  assert.equal(await store.readActiveDesignSystemTokens(), null);
  assert.equal((await store.activeNodeDesignSystem())?.resources[0]?.name, 'logo.svg');

  const doc = deriveBrandTokens({ primary: '#f05a47', name: 'Mixed material' });
  const filled = await store.writeNodeDesignSystemTokens({
    id: workspace.id, tokens: doc, source: { kind: 'colour', name: '#f05a47' },
  });
  assert.equal(filled.id, workspace.id, 'adding a colour fills the same workspace, not a second system');
  assert.equal(filled.resources.length, 1, 'earlier resources remain attached');
  assert.ok(summarizeTokensDoc(await store.readActiveDesignSystemTokens()).colorCount > 1);
});

test('systems are switchable and the registry is a readable on-device document', async () => {
  const second = await store.createNodeDesignSystem({
    label: 'Ocean', tokens: deriveBrandTokens({ primary: '#0088cc' }), source: { kind: 'colour', name: '#0088cc' },
  });
  assert.equal((await store.activeNodeDesignSystem())?.id, second.id);
  await store.activateNodeDesignSystem('mixed-material');
  assert.equal((await store.activeNodeDesignSystem())?.id, 'mixed-material');
  const registry = JSON.parse(await readFile(join(dir, 'design-systems.json'), 'utf8')) as { format: number; systems: unknown[] };
  assert.equal(registry.format, 1);
  assert.equal(registry.systems.length, 2);
});

test('an active system exports as a portable .lolly pack with retained resources', async () => {
  const made = await store.createNodeDesignSystem({
    label: 'North Star', tokens: deriveBrandTokens({ primary: '#123456' }), source: { kind: 'colour' },
  });
  await store.addNodeDesignResources([{ name: 'mark.svg', bytes: new TextEncoder().encode('<svg/>') }]);
  const packed = await store.exportActiveDesignSystem();
  assert.equal(packed.system.id, made.id);
  assert.match(packed.filename, /^LollyBrand-North-Star-\d{4}-\d{2}-\d{2}\.lolly$/);
  const zippedEntries = readZip(packed.bytes);
  assert.equal(zippedEntries[0]?.name, 'manifest.json', 'streaming preflight can identify the pack immediately');
  const files = new Map(zippedEntries.map(entry => [entry.name, entry.bytes]));
  assert.ok(files.has('tokens.json'));
  assert.ok(files.has('resources/mark.svg'));
  assert.equal(JSON.parse(Buffer.from(files.get('manifest.json')!).toString('utf8')).format, 'lolly-brand');
});

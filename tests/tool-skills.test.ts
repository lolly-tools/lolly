// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { generateToolSkill, readToolSkill } from '../packages/core/src/tool-skill-v1.ts';
import type { ToolManifest } from '../packages/core/src/manifest.ts';
import { satisfiesRange } from '../engine/src/semver-range.ts';
import { loadTool } from '../engine/src/loader.ts';
import { sha256Hex, signCatalogEnvelope, CATALOG_SIG_ALG, jwkThumbprint } from '../engine/src/catalog-integrity.ts';

const root = resolve(import.meta.dirname, '..');
const manifest: ToolManifest = {
  id: 'test-tool', name: 'Test', version: '1.2.0', engineVersion: '^1.0.0', status: 'community',
  render: { width: 100, height: 100, formats: ['svg'] },
  inputs: [{ id: 'mode', type: 'select', urlKey: 'm', options: [{ value: 'a', label: 'A' }] }],
};
const authored = '---\nname: lolly-test-tool\ndescription: Operate Test.\n---\n\nRead [workflow](skill/workflow.md).\n';
const source = { version: 1, toolId: 'test-tool', toolVersionRange: '^1.2.0', skillRevision: '2', references: ['skill/workflow.md'] };
const files: Record<string, string> = { 'skill.json': JSON.stringify(source), 'SKILL.md': authored, 'skill/workflow.md': 'Use the declared mode.\n' };

test('baseline preserves exact input IDs, choices, aliases and formats', () => {
  const skill = generateToolSkill(manifest);
  assert.equal(skill.toolVersion, '1.2.0');
  assert.match(skill.markdown, /\| mode \| select \| m \|/);
  assert.match(skill.markdown, /Declared output formats: svg/);
  assert.deepEqual(JSON.parse(skill.files['reference/inputs.json']!), manifest.inputs);
});

test('authored guidance preserves portable references and rejects incompatible versions and traversal', async () => {
  const read = async (path: string) => files[path] ?? null;
  const skill = await readToolSkill(manifest, read, satisfiesRange);
  assert.equal(skill.origin, 'authored');
  assert.equal(skill.skillRevision, '2');
  assert.equal(skill.files['skill/workflow.md'], files['skill/workflow.md']);
  const mismatch = await readToolSkill({ ...manifest, version: '2.0.0' }, read, satisfiesRange);
  assert.equal(mismatch.origin, 'generated');
  assert.match(mismatch.warning!, /does not support tool version/);
  const requested: string[] = [];
  const unsafe = await readToolSkill(manifest, async path => {
    requested.push(path);
    return path === 'skill.json' ? JSON.stringify({ ...source, references: ['skill/../../private.md'] }) : read(path);
  }, satisfiesRange);
  assert.equal(unsafe.origin, 'generated');
  assert.match(unsafe.warning!, /Invalid tool skill reference/);
  assert.deepEqual(requested, ['skill.json']);
});

test('missing and oversized authored guidance report a bounded manifest fallback', async () => {
  const absent = await readToolSkill(manifest, async path => path === 'skill.json' ? files[path]! : null, satisfiesRange);
  assert.equal(absent.origin, 'generated');
  assert.match(absent.warning!, /missing/);
  const large = await readToolSkill(manifest, async path => path === 'SKILL.md' ? authored + 'x'.repeat(65536) : files[path] ?? null, satisfiesRange);
  assert.equal(large.origin, 'generated');
  assert.ok(large.markdown.length < 65536);
});

test('public coverage, version metadata, hashes and relative reference files agree', () => {
  const index = JSON.parse(readFileSync(resolve(root, 'skills/tools/index.json'), 'utf8'));
  const catalog = JSON.parse(readFileSync(resolve(root, 'brands/lolly-start/catalog/tools/index.json'), 'utf8'));
  assert.deepEqual(index.tools.map((entry: { toolId: string }) => entry.toolId).sort(), catalog.tools.map((entry: { id: string }) => entry.id).sort());
  for (const entry of index.tools) {
    const dir = resolve(root, 'skills/tools', entry.toolId);
    const metadata = JSON.parse(readFileSync(resolve(dir, 'metadata.json'), 'utf8'));
    assert.equal(metadata.toolVersion, entry.toolVersion);
    assert.ok(satisfiesRange(entry.toolVersion, entry.toolVersionRange));
    for (const [path, expected] of Object.entries(entry.files) as [string, { sha256: string; bytes: number }][]) {
      const bytes = readFileSync(resolve(dir, path));
      assert.equal(bytes.length, expected.bytes, `${entry.toolId}/${path} size`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `${entry.toolId}/${path} hash`);
    }
    for (const path of entry.references) assert.ok(entry.files[path], `${entry.toolId}: ${path}`);
    assert.ok(!entry.toolId.startsWith('suse-'), 'Public index must use public packs only');
  }
});

test('lazy skill reads retain the loaded source and verify signed authored bytes', async () => {
  const toolFiles = { ...Object.fromEntries(Object.entries(files).map(([path, value]) => [`test-tool/${path}`, value])),
    'test-tool/tool.json': JSON.stringify(manifest), 'test-tool/template.html': '<svg></svg>' };
  const key = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const digests: Record<string, string> = {};
  for (const [path, value] of Object.entries(toolFiles)) digests[path] = await sha256Hex(new TextEncoder().encode(value));
  const envelope = await signCatalogEnvelope({ alg: CATALOG_SIG_ALG,
    keyId: await jwkThumbprint(await crypto.subtle.exportKey('jwk', key.publicKey)), signedAt: new Date().toISOString(),
    indexHash: await sha256Hex(new Uint8Array()), files: digests }, key.privateKey);
  const fetch = async (path: string) => {
    if (!(path in toolFiles)) throw new Error('missing');
    return toolFiles[path as keyof typeof toolFiles]!;
  };
  const tool = await loadTool('test-tool', fetch, { integrity: { envelope, publicKey: key.publicKey } });
  assert.equal((await tool.readSkill!()).origin, 'authored');
  const tampered = await loadTool('test-tool', async path => path.endsWith('/SKILL.md') ? authored + 'Injected instructions' : fetch(path), { integrity: { envelope, publicKey: key.publicKey } });
  const result = await tampered.readSkill!();
  assert.equal(result.origin, 'generated');
  assert.match(result.warning!, /catalog integrity/);
  assert.ok(!result.markdown.includes('Injected instructions'));
  // A packed installation has only its own tool files, with no public skill URL.
  const installed = await loadTool('test-tool', fetch, { trustClass: 'sideloaded-consented' });
  assert.equal((await installed.readSkill!()).files['skill/workflow.md'], files['skill/workflow.md']);
});

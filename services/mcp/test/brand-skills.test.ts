// SPDX-License-Identifier: MPL-2.0
/**
 * Brand skills over MCP (plan 323): the index, one SKILL.md with Lolly's metadata over
 * the brand's body, the coverage map, the listing in the server instructions, and a
 * hosted server's links pointing at its public origin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.LOLLY_PROFILE = 'lolly-demo';
const { readResource, RESOURCES, RESOURCE_TEMPLATES } = await import('../src/resources.ts');
const { serverInstructions } = await import('../src/tools.ts');

test('brand skills are advertised as a resource and two templates', () => {
  assert.ok(RESOURCES.some((r) => r.uri === 'lolly://design-system/skills'));
  for (const t of ['lolly://design-system/skill/{name}', 'lolly://design-system/skill/{name}/{path}']) {
    assert.ok(RESOURCE_TEMPLATES.some((r) => r.uriTemplate === t), t);
  }
});

test('the index lists the profile skills and the generated baseline, without bodies', async () => {
  const r = await readResource('lolly://design-system/skills');
  const list = JSON.parse(r.text!);
  assert.deepEqual(list.skills.map((s: { name: string }) => s.name), ['lolly-demo-brand', 'lolly-demo-motion', 'lolly-demo-photography']);
  assert.equal(list.baseline.name, 'lolly-demo-baseline');
  assert.ok(!JSON.stringify(list).includes('# Lolly Demo brand standards'), 'no bodies in the index');
});

test('one skill reads as SKILL.md with source metadata; its coverage and companion read as JSON', async () => {
  const r = await readResource('lolly://design-system/skill/lolly-demo-brand');
  assert.equal(r.mimeType, 'text/markdown');
  assert.match(r.text!, /^---\nname: "lolly-demo-brand"/);
  assert.match(r.text!, /lolly-asset: "lolly\/skill\/brand"/);
  assert.match(r.text!, /# Lolly Demo brand standards/);
  const coverage = JSON.parse((await readResource('lolly://design-system/skill/lolly-demo-brand/coverage.json')).text!);
  assert.ok(coverage.coverage.rows.some((row: { status: string; kind: string }) => row.kind === 'colour' && row.status === 'agree'));
  const companion = JSON.parse((await readResource('lolly://design-system/skill/lolly-demo-brand/lolly.json')).text!);
  assert.equal(companion.asset, 'lolly/skill/brand');
  await assert.rejects(readResource('lolly://design-system/skill/no-such-skill'), /No brand skill/);
});

test('a hosted server links to its public origin and still serves the public skills', async () => {
  process.env.LOLLY_MCP_HOSTED = '1';
  process.env.LOLLY_MCP_PUBLIC_ORIGIN = 'https://lolly.example';
  try {
    const r = await readResource('lolly://design-system/skill/lolly-demo-photography');
    assert.match(r.text!, /https:\/\/lolly\.example\/catalog\/assets\/lolly\/luts\/slide-standard\.cube/);
    assert.match(r.text!, /lolly-source: "https:\/\/lolly\.example\/catalog\/assets\/lolly\/skills\/photography\/SKILL\.md"/);
  } finally {
    delete process.env.LOLLY_MCP_HOSTED;
    delete process.env.LOLLY_MCP_PUBLIC_ORIGIN;
  }
});

test('the server instructions name the brand skills', async () => {
  const text = await serverInstructions();
  assert.match(text, /lolly:\/\/design-system\/skills: lolly-demo-brand \(brand\)/);
  assert.match(text, /lolly:\/\/skill holds the shared Lolly workflows/);
});

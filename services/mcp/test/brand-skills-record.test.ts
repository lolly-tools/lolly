// SPDX-License-Identifier: MPL-2.0
/**
 * The brand skills record over MCP (plan 323, decision 4): `lolly_render` takes the
 * names of the brand skills the agent read and followed, resolves each against the
 * profile and records `{ id, name, revision, sha256 }` beside the design-system
 * record. "Guided by", never a check. An unknown name fails with the list of names
 * the profile holds, and `madeWith: false` leaves the skills out with the rest.
 *
 * Browser-free throughout. Nothing here needs Chromium.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { JsonRpcResponse } from '../src/protocol.ts';

process.env.LOLLY_PROFILE = 'lolly-demo';
const { dispatch } = await import('../src/server.ts');
const { render, credentialAndRecord, designRecordText } = await import('../src/render.ts');
const { brandSkillsSettings } = await import('../src/tools.ts');
const { readProfileBrandSkill } = await import('../../../packages/node-shell/src/brand-skills.ts');
const { readDesignRecord, readDesignRecordXml, verifyC2pa, embedC2pa } = await import('../../../engine/src/index.ts');
const { buildExportC2paOpts } = await import('../../../packages/node-shell/src/c2pa-opts.ts');

type Result = { content: { type: string; text?: string; resource?: { text?: string } }[]; isError?: boolean };

let nextId = 1;
async function call(name: string, args: Record<string, unknown>): Promise<Result> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } })) as JsonRpcResponse;
  assert.ok(!res.error, `${name} errored: ${JSON.stringify(res.error)}`);
  return res.result as Result;
}
const textOf = (r: Result): string => r.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n');
const svgOf = (r: Result): string => r.content.find((c) => c.type === 'resource')?.resource?.text ?? '';

/** The record the demo brand skill should leave: its catalog id, name, revision and the admitted hash. */
async function expectedBrand() {
  const skill = await readProfileBrandSkill('lolly-demo-brand', { audience: 'all' });
  assert.ok(skill, 'the lolly-demo profile holds its brand skill');
  const sha256 = skill.skill.sha256.replace(/^sha256:/, '');
  assert.match(sha256, /^[0-9a-f]{64}$/);
  return { id: 'lolly/skill/brand', name: 'lolly-demo-brand', revision: '1.0', sha256 };
}

test('lolly_render declares brandSkills as provenance, and the link builder does not take it', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })) as JsonRpcResponse;
  const tools = (res.result as { tools: { name: string; inputSchema: { properties: Record<string, { description?: string }> } }[] }).tools;
  const arg = tools.find((t) => t.name === 'lolly_render')!.inputSchema.properties.brandSkills;
  assert.ok(arg, 'lolly_render accepts brandSkills');
  assert.match(arg.description!, /guided by/);
  assert.match(arg.description!, /not a check/);
  assert.doesNotMatch(arg.description!, /complies|approved/);
  assert.equal('brandSkills' in tools.find((t) => t.name === 'lolly_build_url')!.inputSchema.properties, false,
    'a skill is the agent\'s, so it never travels in a link');
});

test('a named skill resolves to its id, revision and hash; an unknown name lists the available names', async () => {
  const brand = await expectedBrand();
  assert.deepEqual(await brandSkillsSettings({ brandSkills: ['lolly-demo-brand', ' lolly-demo-brand '] }), { brandSkills: [brand] });
  assert.deepEqual(await brandSkillsSettings({}), { brandSkills: [] });
  const unknown = await brandSkillsSettings({ brandSkills: ['no-such-skill'] });
  assert.ok('error' in unknown);
  assert.match(unknown.error, /Unknown brand skill "no-such-skill"\. Available: lolly-demo-brand, lolly-demo-motion, lolly-demo-photography, lolly-demo-baseline \(generated\)\./);
  const malformed = await brandSkillsSettings({ brandSkills: 'lolly-demo-brand' });
  assert.ok('error' in malformed && /must be a list/.test(malformed.error));
});

test('lolly_render records the skills in the file and says so beside it', async () => {
  const brand = await expectedBrand();
  const r = await call('lolly_render', { toolId: 'qr-code', inputs: { url: 'https://lolly.tools' }, format: 'svg', c2pa: 'off', brandSkills: ['lolly-demo-brand'] });
  assert.ok(!r.isError, textOf(r));
  assert.match(textOf(r), /Recorded as guided by: lolly-demo-brand 1\.0\. Pass madeWith: false to leave the record out\./);
  assert.doesNotMatch(textOf(r), /complies|approved|checked/);
  const record = readDesignRecordXml(svgOf(r));
  assert.deepEqual(record?.brandSkills, [brand], 'the SVG metadata lists the skill');
  assert.ok(record?.designSystem, 'beside the design system the profile drew with');
  // The link beside the file says nothing about the skills.
  assert.doesNotMatch(textOf(r), /brandSkills|lolly-demo-brand[^ ]/);
});

test('an unknown skill fails the call before anything renders', async () => {
  const r = await call('lolly_render', { toolId: 'qr-code', inputs: { url: 'https://lolly.tools' }, format: 'svg', brandSkills: ['lolly-demo-brand', 'made-up'] });
  assert.equal(r.isError, true);
  assert.match(textOf(r), /Unknown brand skill "made-up"\. Available: lolly-demo-brand, lolly-demo-motion, lolly-demo-photography/);
});

test('madeWith: false leaves the skills out with the rest of the record', async () => {
  const r = await call('lolly_render', { toolId: 'qr-code', inputs: { url: 'https://lolly.tools' }, format: 'svg', c2pa: 'off', madeWith: false, brandSkills: ['lolly-demo-brand'] });
  assert.ok(!r.isError, textOf(r));
  assert.equal(svgOf(r).includes('lolly:'), false, 'no lolly: properties at all');
  assert.doesNotMatch(textOf(r), /guided by/i);
});

test('a browser-free PNG carries the skills in its credential, read back from the bytes', async () => {
  const brand = await expectedBrand();
  const out = await render('qr-code', 'url=https%3A%2F%2Flolly.tools', { format: 'png', noBrowser: true, c2pa: { on: true, days: 1 }, brandSkills: [brand] });
  assert.equal(out.tier, 'A(resvg)');
  const env = (await verifyC2pa(out.bytes)).environment ?? null;
  assert.deepEqual(readDesignRecord(env)?.brandSkills, [brand]);
  assert.deepEqual(out.designRecord?.brandSkills, [brand]);
  const plain = await render('qr-code', 'url=https%3A%2F%2Flolly.tools', { format: 'png', noBrowser: true, c2pa: { on: true, days: 1 } });
  assert.equal(plain.designRecord?.brandSkills, undefined, 'no skills named, none recorded');
});

test('on the browser tier only the credential stamped here carries the skills, and no credential means a warning', async () => {
  const brand = await expectedBrand();
  const manifest = { id: 'chart', name: 'Chart', version: '1.0.0', inputs: [], render: { width: 1, height: 1, formats: ['gif'] } };
  const meta = { software: 'Lolly', source: 'https://lolly.tools/t/chart', tool: 'Chart', author: '', contact: '', description: 'd', designSystem: { id: 'acme', label: 'Acme' } };
  const gif = Uint8Array.from(Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'));
  const browserOpts = buildExportC2paOpts({ surface: 'cli', manifest, model: [], format: 'gif', days: 1, meta });
  const browserGif = await embedC2pa(gif, 'gif', browserOpts);

  const warnings: string[] = [];
  const out = await credentialAndRecord({ bytes: browserGif, tier: 'B' }, {
    fmt: 'gif', exportFmt: 'gif', deliveredFormat: 'gif', manifest: manifest as never, values: {},
    merged: { c2pa: { on: true, days: 1 }, brandSkills: [brand] }, placed: [], recorded: null, sampled: false, warnings,
  });
  assert.deepEqual(warnings, []);
  assert.deepEqual(readDesignRecord((await verifyC2pa(out.bytes)).environment ?? null), { designSystem: meta.designSystem, brandSkills: [brand] });
  assert.deepEqual(out.designRecord, { designSystem: meta.designSystem, brandSkills: [brand] });
  assert.equal(designRecordText(out.designRecord), 'Recorded the design system: Acme. Recorded as guided by: lolly-demo-brand 1.0. Pass madeWith: false to leave the record out.');

  const unstamped: string[] = [];
  const off = await credentialAndRecord({ bytes: browserGif, tier: 'B' }, {
    fmt: 'gif', exportFmt: 'gif', deliveredFormat: 'gif', manifest: manifest as never, values: {},
    merged: { brandSkills: [brand] }, placed: [], recorded: null, sampled: false, warnings: unstamped,
  });
  assert.equal(off.designRecord?.brandSkills, undefined, 'never claims a record the file does not hold');
  assert.match(unstamped.join('\n'), /brand skills were not recorded/);

  const optedOut: string[] = [];
  const quiet = await credentialAndRecord({ bytes: browserGif, tier: 'B' }, {
    fmt: 'gif', exportFmt: 'gif', deliveredFormat: 'gif', manifest: manifest as never, values: {},
    merged: { c2pa: { on: true, days: 1 }, madeWith: false, brandSkills: [brand] }, placed: [], recorded: null, sampled: false, warnings: optedOut,
  });
  assert.deepEqual(optedOut, []);
  assert.equal(readDesignRecord((await verifyC2pa(quiet.bytes)).environment ?? null)?.brandSkills, undefined);
});

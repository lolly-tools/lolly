// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { BrandSystemV1, BrandRuleV1 } from '@lolly-tools/core/brand-system-v1';
import { createMockHost } from '@lolly-tools/core';
import { validateDesignTool, type DesignToolDefinitionV1 } from '@lolly-tools/core/design-tool-v1';
import { brandRuleDisposition, checkBrandRules, constrainBrandPoster } from '../engine/src/brand-rules.ts';
import { compileDesignTool } from '../engine/src/design-tool/compiler.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { loadTool } from '../engine/src/loader.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';

const doc = { identity: { beacon: { $type: 'color', $value: '#ffcc00' }, voice: { $type: 'fontFamily', $value: 'SUSE' } } };
const context = { tool: 'brand-poster', mode: 'Day', output: 'png' };
const rule = (kind: string, slot: string, roleIds: string[] = [], parameters = {}): BrandRuleV1 => ({ id: kind, label: `Our ${kind}`, kind, roleIds, parameters: { slot, ...parameters }, scope: { tools: ['brand-poster'], outputs: ['png'] }, requirement: 'required', origin: { kind: 'manual', author: 'Studio' }, review: { state: 'approved', authority: 'Studio' } });
const system = (): BrandSystemV1 => ({ schemaVersion: 1, id: 'harbour', label: 'Harbour',
  roles: [{ id: 'beacon', label: 'Beacon', resources: [{ type: 'token', path: 'identity.beacon' }] }, { id: 'voice', label: 'Our voice', resources: [{ type: 'token', path: 'identity.voice' }] }, { id: 'ribbon', label: 'Signal ribbon', resources: [{ type: 'asset', id: 'user/logo/ribbon' }] }],
  bindings: [{ id: 'a', roleId: 'beacon', consumer: { tool: 'brand-poster', slot: 'accent' } }, { id: 'f', roleId: 'voice', consumer: { tool: 'brand-poster', slot: 'type' } }, { id: 'd', roleId: 'ribbon', consumer: { tool: 'brand-poster', slot: 'device' } }],
  rules: [rule('color-choices', 'accent', ['beacon']), rule('font-choices', 'type', ['voice']), rule('fixed-artwork', 'device', ['ribbon']), rule('text-length', 'heading', [], { max: 20 })] });
const facts = { accent: { value: '#ffcc00' }, type: { value: 'SUSE' }, device: { value: 'user/logo/ribbon', fixed: true }, heading: { value: 'Welcome' } };

test('custom vocabulary resolves without renaming roles to platform slots', () => {
  const brand = system(), before = structuredClone(brand);
  assert.deepEqual(checkBrandRules(brand, doc, context, facts).map(result => result.state), ['pass', 'pass', 'pass', 'pass']);
  assert.deepEqual(brand, before);
  assert.equal(brandRuleDisposition(checkBrandRules(brand, doc, context, facts)), 'checked');
});
test('missing facts, unsupported predicates, bindings and extra parameters stay unknown', () => {
  for (const mutate of [(s: BrandSystemV1) => { s.rules[0]!.kind = 'contrast-against-image'; }, (s: BrandSystemV1) => { s.bindings = []; }, (s: BrandSystemV1) => { s.rules[0]!.parameters.unrecognised = true; }, (s: BrandSystemV1) => { s.roles[0]!.resources = [{ type: 'token', path: 'missing' }]; }]) {
    const brand = system(); mutate(brand);
    assert.equal(checkBrandRules(brand, doc, context, facts)[0]!.state, 'unknown');
    assert.equal(brandRuleDisposition(checkBrandRules(brand, doc, context, facts)), 'draft');
  }
  assert.equal(brandRuleDisposition(checkBrandRules(system(), doc, context, {})), 'draft');
});
test('scopes and approval do not expand into other tools or formats', () => {
  assert.ok(checkBrandRules(system(), doc, { ...context, tool: 'design' }, facts).every(result => result.state === 'outside'));
  assert.ok(checkBrandRules(system(), doc, { ...context, output: 'pdf' }, facts).every(result => result.state === 'outside'));
  const brand = system(); brand.rules[0]!.scope!.modes = ['Night'];
  assert.equal(checkBrandRules(brand, doc, context, facts)[0]!.state, 'outside');
  brand.rules[0]!.scope!.modes = ['Day']; brand.rules[0]!.review = { state: 'draft' };
  const results = checkBrandRules(brand, doc, context, { ...facts, accent: { value: '#000000' } });
  assert.equal(results[0]!.state, 'fail'); assert.equal(results[0]!.enforced, false); assert.equal(brandRuleDisposition(results), 'checked');
});
test('required failures block while required missing facts allow labelled drafts', () => {
  for (const bad of [{ accent: { value: '#000000' } }, { device: { value: 'user/logo/ribbon', fixed: false } }, { heading: { value: 'x'.repeat(21) } }]) assert.equal(brandRuleDisposition(checkBrandRules(system(), doc, context, { ...facts, ...bad })), 'blocked');
  assert.equal(brandRuleDisposition(checkBrandRules(system(), doc, context, { ...facts, type: { value: undefined } })), 'draft');
});

test('compiled poster refuses disallowed values through init, URL, patch and export', async () => {
  const draft: DesignToolDefinitionV1 = { schemaVersion: 1, id: 'brand-rule-test', name: 'Brand poster', version: '1.0.0', presentation: 'sidebar', formats: ['png'], defaultVariant: 'poster', choices: [], recipes: [], compilerVersion: 1, rendererDigest: 'fixture', css: '', dependencies: [],
    variants: [{ id: 'poster', label: 'Poster', width: 800, height: 400, background: '#ffffff', boxes: [{ id: 'title', kind: 'text', x: 40, y: 40, w: 700, h: 100, text: 'Welcome', font: 'SUSE', fontSize: 48, fg: '#ffcc00' }, { id: 'ribbon', kind: 'box', x: 40, y: 300, w: 720, h: 12, bg: '#ffcc00' }] }],
    inputs: [
      { input: { id: 'headline', label: 'Heading', type: 'text', default: 'Welcome' }, targets: [{ variantId: 'poster', layerId: 'title', property: 'text' }] },
      { input: { id: 'accent', label: 'Accent', type: 'color', default: '#ffcc00' }, targets: [{ variantId: 'poster', layerId: 'title', property: 'fg' }] },
      { input: { id: 'typeface', label: 'Typeface', type: 'select', default: 'SUSE', options: [{ value: 'SUSE', label: 'SUSE' }] }, targets: [{ variantId: 'poster', layerId: 'title', property: 'font' }] },
    ] };
  draft.variants[0]!.boxes.push({ id: 'device', kind: 'image', image: 'user/logo/ribbon', x: 40, y: 200, w: 200, h: 50 });
  const constrained = constrainBrandPoster(draft, checkBrandRules(system(), doc, context, facts), { heading: 'headline', accent: 'accent', type: 'typeface' });
  assert.deepEqual(validateDesignTool(constrained), []);
  const compiled = compileDesignTool({ ...draft, ...constrained }, { source: await readFile('community/design/assets/rules-renderer.js', 'utf8'), styles: '' });
  const tool = await loadTool(compiled.manifest.id, async path => String(compiled.files[path.slice(compiled.manifest.id.length + 1)] ?? ''));
  const host = createMockHost();
  const runtime = await createRuntime(tool, host);
  await assert.rejects(runtime.setInput('accent', '#000000'), /approved|choice/);
  await assert.rejects(runtime.applyPatch({ typeface: 'Arial' }), /approved|choice/);
  await assert.rejects(runtime.applyPatch({ boxes: [] }), /fixed/);
  await assert.rejects(runtime.applyPatch({ headline: 'x'.repeat(21) }), /length|full value|20/);
  await assert.rejects(runtime.export({}, 'png'), /length|full value|20/);
  await runtime.setInput('headline', 'Welcome');
  await assert.rejects(runtime.setInput('accent', '#000000'), /approved|choice/);
  await assert.rejects(runtime.export({}, 'png'), /approved|choice/);
  runtime.destroy();
  const { values } = parseUrlState('?accent=%23000000', tool.manifest);
  await assert.rejects(createRuntime(tool, host, values), /approved|choice/);
  await assert.rejects(createRuntime(tool, host, { typeface: 'Arial' }), /approved|choice/);
});

test('compilation refuses missing facts and artwork exposed through another input', () => {
  const draft = { variants: [{ id: 'poster', boxes: [{ id: 'device', image: 'user/logo/ribbon' }] }], inputs: [], choices: [] } as unknown as DesignToolDefinitionV1;
  assert.throws(() => constrainBrandPoster(draft, checkBrandRules(system(), doc, context, {}), {}), /Resolve required rules/);
  const brand = system(); brand.rules = [brand.rules[2]!];
  const results = checkBrandRules(brand, doc, context, facts);
  assert.doesNotThrow(() => constrainBrandPoster(draft, results, {}));
  draft.inputs.push({ input: { id: 'replace_image', type: 'asset', label: 'Image' }, targets: [{ variantId: 'poster', layerId: 'device', property: 'image' }] });
  assert.throws(() => constrainBrandPoster(draft, results, {}), /no editable targets/);
});

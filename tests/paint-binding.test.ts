// SPDX-License-Identifier: MPL-2.0
/**
 * The end-to-end chain that lets an input-driven tool inherit its theme into a
 * `.penpot` export (plans/222): a colour INPUT bound to a brand token keeps that
 * link all the way to the rendered DOM, as a `data-lolly-bind` attribute the
 * exporter reads - even though the value the template paints is a flat hex.
 *
 * annotateTemplate stamps `data-lolly-paint` on the paint attribute, the runtime's
 * getHydrated resolves it to the token via the model's `{ref}` (resolveTokenRefs
 * kept it), and a literal input resolves to nothing. This is the composition that
 * the annotateTemplate / resolvePaintBindings / tokenBindingsOf unit tests each
 * prove a link of.
 *
 * Run with: node --test tests/paint-binding.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../engine/src/runtime.ts';
import { annotateTemplate } from '../engine/src/template.ts';

// A token set that resolves the one alias this test uses (resolveTokenRefs only
// calls .resolve; the rest of the surface is stubbed to satisfy the type).
const tokenSet = {
  resolve: (r: string) => (r === '{color.semantic.primary}' ? '#30ba78' : undefined),
  size: 1, has: () => true, get: () => undefined, query: () => [], colors: () => [], themes: () => [],
} as unknown;
const host = { version: '1', log: () => {}, profile: { get: async () => ({}) }, tokens: { get: async () => tokenSet } } as never;

const toolWith = (colourDefault: string) => ({
  manifest: {
    id: 'paint-t', name: 'Paint', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
    render: { width: 10, height: 10, formats: ['svg'] },
    inputs: [{ id: 'bg', type: 'color', default: colourDefault }],
  },
  template: annotateTemplate('<div style="background:{{bg}}">hi</div>', ['bg']),
}) as never;

test('a colour input bound to a token reaches the DOM as data-lolly-bind; a literal does not', async () => {
  const rt = await createRuntime(toolWith('{color.semantic.primary}'), host, {});
  const html = rt.getHydrated();
  assert.ok(html.includes('background:#30ba78'), `the flat hex is what paints: ${html}`);
  assert.ok(html.includes('data-lolly-bind="fill:color.semantic.primary"'), `the token binding survives: ${html}`);
  assert.ok(!html.includes('data-lolly-paint'), 'the intermediate marker is consumed');

  const literal = await createRuntime(toolWith('#ff0000'), host, {});
  const out = literal.getHydrated();
  assert.ok(out.includes('background:#ff0000'));
  assert.ok(!out.includes('data-lolly-bind'), 'a literal colour input binds nothing');
});

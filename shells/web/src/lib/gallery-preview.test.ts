// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { galleryPreviewLooks, galleryLookHref } from './gallery-preview.ts';
import { previewContextSignature } from './preview-context.ts';

test('Design discovery uses the available templates and opens the exact selected template', async () => {
  const index = JSON.parse(await readFile(new URL('../../../../brands/lolly-start/catalog/tools/index.json', import.meta.url), 'utf8'));
  const design = index.tools.find((tool: { id: string }) => tool.id === 'design');
  const looks = galleryPreviewLooks(design);
  assert.ok(looks.length > 1);
  assert.deepEqual(looks.map(look => look.templateId), design.templates.map((tpl: { id: string }) => tpl.id));
  assert.equal(await galleryLookHref('design', looks[0]), `#/tool/design?template=${design.templates[0].id}`);
});

test('tools without templates use their default state, ignoring authored artwork and examples', async () => {
  const tool = { id: 'backdrop', preview: '/catalog/previews/backdrop.svg', examples: [{ values: { color: '#ff0000' } }] };
  assert.deepEqual(galleryPreviewLooks(tool), [{ values: {} }]);
  assert.equal(await galleryLookHref(tool.id, galleryPreviewLooks(tool)[0]), '#/tool/backdrop');
});

test('preview identity follows the active palette and opted-in details, independent of token order', async () => {
  let color = '#112233';
  let reverse = false;
  let name = 'Andy';
  let useDetails = false;
  const host = {
    tokens: {
      get: async () => ({ query: () => {
        const tokens = [{ path: 'color.semantic.primary', type: 'color', value: color }, { path: 'font.body', type: 'fontFamily', value: 'SUSE' }];
        return reverse ? tokens.reverse() : tokens;
      } }),
      active: async () => ({ id: 'my-brand' }),
    },
    profile: { get: async () => ({ firstname: name, useDetails }) },
  } as unknown as Parameters<typeof previewContextSignature>[0];
  const original = await previewContextSignature(host);
  reverse = true;
  assert.equal(await previewContextSignature(host), original);
  name = 'Someone else';
  assert.equal(await previewContextSignature(host), original, 'private details do not influence previews without opt-in');
  color = '#aabbcc';
  const recolored = await previewContextSignature(host);
  assert.notEqual(recolored, original, 'editing a palette invalidates previews even when the brand ID stays the same');
  useDetails = true;
  assert.notEqual(await previewContextSignature(host), recolored);
});

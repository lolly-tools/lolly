// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { galleryPreviewLooks, galleryLookHref } from './gallery-preview.ts';
import { coverFormats } from './featured-render.ts';
import { previewContextSignature } from './preview-context.ts';

test('Design discovery uses the available templates and opens the exact selected template', async () => {
  const index = JSON.parse(await readFile(new URL('../../../../brands/lolly-start/catalog/tools/index.json', import.meta.url), 'utf8'));
  const design = index.tools.find((tool: { id: string }) => tool.id === 'design');
  const looks = galleryPreviewLooks(design);
  assert.ok(looks.length > 1);
  assert.deepEqual(new Set(looks.map(look => look.templateId)), new Set(design.templates.map((tpl: { id: string }) => tpl.id)));
  const cover = design.templates.find((tpl: { galleryCover?: boolean }) => tpl.galleryCover) ?? design.templates[0];
  assert.equal(await galleryLookHref('design', looks[0]), `#/tool/design?template=${cover.id}`);
});

test('tools without templates use their default state, ignoring authored artwork and examples', async () => {
  const tool = { id: 'backdrop', preview: '/catalog/previews/backdrop.svg', examples: [{ values: { color: '#ff0000' } }] };
  assert.deepEqual(galleryPreviewLooks(tool), [{ values: {} }]);
  assert.equal(await galleryLookHref(tool.id, galleryPreviewLooks(tool)[0]), '#/tool/backdrop');
});

test('a curated cover leads without changing template order or losing its open target', async () => {
  const templates = [
    { id: 'detailed', name: 'Detailed' },
    { id: 'simple', name: 'Simple', galleryCover: true },
    { id: 'wide', name: 'Wide' },
  ];
  const looks = galleryPreviewLooks({ id: 'chart', templates });
  assert.deepEqual(looks.map(look => look.templateId), ['simple', 'detailed', 'wide']);
  assert.deepEqual(templates.map(template => template.id), ['detailed', 'simple', 'wide']);
  assert.equal(await galleryLookHref('chart', looks[0]), '#/tool/chart?template=simple');
});

test('tools without a displayable export keep their icon card', () => {
  assert.deepEqual(galleryPreviewLooks({ id: 'record', formats: ['webm', 'mp4'] }), []);
  assert.deepEqual(galleryPreviewLooks({ id: 'deck-builder', formats: ['pptx'] }), []);
  assert.deepEqual(galleryPreviewLooks({ id: 'spatial-photo', formats: ['png'], galleryArt: 'icon' }), []);
});

test('a tool with no still export that states render art draws a template as a PNG cover', () => {
  const tool = { id: 'record', formats: ['webm', 'mp4'], galleryArt: 'render' as const, templates: [{ id: 'landscape-intro', name: 'Landscape intro', galleryCover: true }] };
  assert.deepEqual(galleryPreviewLooks(tool).map(look => look.templateId), ['landscape-intro']);
  assert.deepEqual(coverFormats(tool), ['png']);
  assert.deepEqual(tool.formats, ['webm', 'mp4'], 'the export list stays as it is');
  assert.deepEqual(coverFormats({ formats: ['svg', 'png'], galleryArt: 'render' }), ['svg', 'png'], 'a tool that exports a still draws in what it exports');
  assert.deepEqual(galleryPreviewLooks({ id: 'spatial-photo', formats: ['png'], galleryArt: 'icon' }), []);
});

test('transparent template variants preserve their theme and exact open target', async () => {
  const looks = galleryPreviewLooks({ id: 'wordmark', templates: [
    { id: 'light', name: 'Light ink', galleryCover: true, galleryTheme: 'light' },
    { id: 'dark', name: 'Reverse ink', galleryCover: true, galleryTheme: 'dark' },
  ] });
  assert.deepEqual(looks.map(look => look.theme), ['light', 'dark']);
  assert.equal(await galleryLookHref('wordmark', looks.find(look => look.theme === 'dark')), '#/tool/wordmark?template=dark');
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

test('a cover size reaches the card render without entering the template values', async () => {
  const { withGallerySize } = await import('./gallery-preview.ts');
  const values = { effect: 'voronoi' };
  assert.deepEqual(withGallerySize(values, { width: 1600, height: 1200 }), { effect: 'voronoi', width: 1600, height: 1200 });
  assert.equal(withGallerySize(values, undefined), values);
  assert.equal(withGallerySize(values, { width: 0, height: 1200 }), values);
  assert.equal(withGallerySize(values, { width: '1600', height: 1200 }), values);
  assert.deepEqual(values, { effect: 'voronoi' });
});

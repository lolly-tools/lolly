// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createRuntime } from '../engine/src/runtime.ts';
import type { LoadedTool } from '../engine/src/loader.ts';
import type { InputFile } from '../packages/core/src/host-v1.ts';
import { storeZip } from '../engine/src/zip.ts';
import { createMockHost } from '../packages/core/src/mock-host.ts';
import { createPrepareAPI, inspectPreparation } from '../engine/src/prepare.ts';
import { renderPreparationReview, preparationChoices } from '../shells/web/src/components/prepare/review.ts';
import { renderCoverage } from '../shells/web/src/components/prepare/inspector.ts';

const encoder = new TextEncoder();
const fileRef = (value: { name: string; bytes: Uint8Array; size: number }): InputFile => ({ __file: true, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', url: null, ...value });
const office = storeZip([
  { name: '[Content_Types].xml', bytes: encoder.encode('<Types/>') },
  { name: 'word/document.xml', bytes: encoder.encode('<document/>') },
  { name: 'docProps/core.xml', bytes: encoder.encode('<properties><creator>Private Office Author</creator></properties>') },
]);
const tool: LoadedTool = {
  trustClass: 'development-unsigned', styles: null, hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
  manifest: JSON.parse(readFileSync(new URL('../community/strip-data/tool.json', import.meta.url), 'utf8')),
  hooksSource: readFileSync(new URL('../community/strip-data/hooks.js', import.meta.url), 'utf8'),
  template: readFileSync(new URL('../community/strip-data/template.html', import.meta.url), 'utf8'),
};

test('Strip Hidden Data shares Office census, conceals values and never offers a cleaned Office download', async () => {
  const host = createMockHost(); host.prepare = createPrepareAPI();
  const runtime = await createRuntime(tool, host, { source: fileRef({ name: 'private.docx', bytes: office, size: office.length }) });
  const html = runtime.getHydrated();
  assert.match(html, /Document property/); assert.match(html, /Private Office Author/);
  assert.match(html, /Office inspection is read-only/); assert.doesNotMatch(html, /data-export-file/);
  assert.doesNotMatch(html, /already clean/); assert.doesNotMatch(html, /id="exif-show-details"[^>]*\bchecked\b/);
  await assert.rejects(runtime.exportFile(), /read-only/);
  assert.equal(host.inspect.logs.length, 0); assert.equal(host.inspect.state.size, 0);
});

test('missing Office capability and unsupported containers are not called clean', async () => {
  const host = createMockHost(); delete host.prepare;
  const runtime = await createRuntime(tool, host, { source: fileRef({ name: 'private.docx', bytes: office, size: office.length }) });
  assert.match(runtime.getHydrated(), /unavailable/); assert.doesNotMatch(runtime.getHydrated(), /already clean|data-export-file/);
  await assert.rejects(runtime.exportFile(), /read-only/);
});

test('renamed Office ZIP input shares the census and cannot produce a misleading cleaned archive', async () => {
  const host = createMockHost(); host.prepare = createPrepareAPI();
  const runtime = await createRuntime(tool, host, { source: fileRef({ name: 'document.zip', bytes: office, size: office.length }) });
  assert.match(runtime.getHydrated(), /Document property|Office inspection is read-only/);
  assert.doesNotMatch(runtime.getHydrated(), /already clean|data-export-file/);
  await assert.rejects(runtime.exportFile(), /read-only/);
  delete host.prepare;
  const missing = await createRuntime(tool, host, { source: fileRef({ name: 'document.zip', bytes: office, size: office.length }) });
  await assert.rejects(missing.exportFile(), /read-only/);
});

test('replacing an Office source restores the existing image cleaning actions and clears private findings', async () => {
  const host = createMockHost(); host.prepare = createPrepareAPI();
  const runtime = await createRuntime(tool, host, { source: fileRef({ name: 'private.docx', bytes: office, size: office.length }) });
  const svg = encoder.encode('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
  await runtime.setInput('source', fileRef({ name: 'art.svg', bytes: svg, size: svg.length }));
  assert.match(runtime.getHydrated(), /data-export-file/); assert.doesNotMatch(runtime.getHydrated(), /Private Office Author|Office inspection is read-only/);
  await runtime.setInput('source', null); assert.doesNotMatch(runtime.getHydrated(), /private.docx|Private Office Author/);
});

test('Prepare Office review has reveal controls but no enabled replacement or part removal choices', async () => {
  const dom = new JSDOM('<main><section data-review></section><section data-coverage></section></main>');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  try {
    const root = document.querySelector<HTMLElement>('main')!, review = root.querySelector<HTMLElement>('[data-review]')!;
    const inspection = await inspectPreparation([{ id: 'office', name: 'private.docx', bytes: office }]);
    renderPreparationReview(review, inspection); renderCoverage(root, inspection);
    assert.equal(review.querySelector('[data-replacement]'), null);
    assert.equal(review.querySelector('[data-selected]:not(:disabled)'), null);
    assert.equal(root.querySelector('[data-remove]'), null);
    assert(!review.textContent!.includes('Private Office Author'));
    review.querySelector<HTMLButtonElement>('[data-select-all]')!.click(); assert.deepEqual(preparationChoices(review), []);
    review.querySelector<HTMLButtonElement>('[data-reveal]')!.click(); assert(review.textContent!.includes('Private Office Author'));
    review.querySelector<HTMLButtonElement>('[data-reveal]')!.click(); assert(!review.textContent!.includes('Private Office Author'));
  } finally {
    dom.window.close(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document');
  }
});

// SPDX-License-Identifier: MPL-2.0
/// <reference path="../vendor.d.ts" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { sniffFile, dropChooserChoices } from './drop-router.ts';
const picker = { isPptxUpload: () => false, isPdfUpload: () => false };
test('MOGRT and 3MF packages retain their identity through universal file drop', async () => {
  const bytes = zipSync({ 'definition.json': strToU8('{"authorApp":"aefx"}'), 'tool.json': strToU8('{}'), 'design-system.json': strToU8('{}') });
  for (const extension of ['mogrt', '3mf']) {
    for (const deep of [false, true]) {
      const sniff = await sniffFile(new File([bytes], `Example.${extension}`, { type: 'application/zip' }), deep, picker);
      assert.equal(sniff.media, true); assert.equal(sniff.design, false); assert.equal(sniff.archive, false);
      assert.equal(sniff.tool, false); assert.equal(sniff.designSystem, false); assert.equal(sniff.animation, false);
      const routes = dropChooserChoices(sniff, { single: true, count: 1, allIngestable: true, has: () => true });
      assert.ok(routes.some(route => route.id === 'library'), extension);
      assert.ok(!routes.some(route => ['design', 'unpack', 'install-tool'].includes(route.id)), extension);
    }
  }
});
test('font and mesh files can enter the library even when the OS supplies no MIME', async () => {
  for (const extension of ['ttf','otf','woff','woff2','glb','stl']) {
    const sniff = await sniffFile(new File([new Uint8Array([0,1,2,3])], `face.${extension}`), true, picker);
    assert.equal(sniff.media, true, extension); assert.equal(sniff.design, false);
  }
});

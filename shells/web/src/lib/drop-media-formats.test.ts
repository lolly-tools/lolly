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
test('a rondocode song enters the library as audio, never as a Lottie or a token document', async () => {
  // plan 301: `.rondo` is rondo-language text with no MIME, and `.rondo.json` is JSON
  // that a suffix test alone would hand to the animation or design-system routes.
  const project = strToU8(JSON.stringify({ schemaVersion: 1, format: 'rondocode', name: 'Acid', lang: 'rondo', code: 'play acid\n  c4\n' }));
  for (const [name, bytes] of [['acid.rondo', strToU8('play acid\n  c4\n')], ['acid.rondo.json', project]] as const) {
    for (const deep of [false, true]) {
      const sniff = await sniffFile(new File([bytes], name, { type: name.endsWith('.json') ? 'application/json' : '' }), deep, picker);
      assert.equal(sniff.media, true, `${name} is library media`);
      assert.equal(sniff.animation, false, `${name} is not a Lottie`);
      assert.equal(sniff.designSystem, false, `${name} is not a token document`);
      assert.equal(sniff.design, false, name);
      const routes = dropChooserChoices(sniff, { single: true, count: 1, allIngestable: true, has: () => true });
      assert.ok(routes.some(route => route.id === 'library'), name);
    }
  }
});

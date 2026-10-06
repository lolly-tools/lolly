// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { startStudioHarness, studioSkip } from './helpers/studio3d-browser.ts';

const xml = `<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" unit="millimeter"><resources><object id="1"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="2" y="0" z="0"/><vertex x="0" y="3" z="0"/><vertex x="0" y="0" z="4"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/><triangle v1="0" v2="3" v3="1"/><triangle v1="1" v2="3" v3="2"/><triangle v1="2" v2="3" v3="0"/></triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model"/></Relationships>`;
const bytes = zipSync({ '_rels/.rels': strToU8(rels), '3D/3dmodel.model': strToU8(xml) });

test('3MF upload gets a Studio thumbnail, renders, and releases its detail preview', {
  skip: studioSkip,
}, async () => {
  const harness = await startStudioHarness({
    routes: { '/tetra.3mf': bytes },
    extraSource: `
import { tryStoreModelUpload } from './shells/web/src/lib/model-upload.ts';
import { mountModelPreview } from './shells/web/src/lib/model-preview.ts';
window.uploadMf = async () => {
 const bytes = await (await fetch('/tetra.3mf')).arrayBuffer();
 let stored;
 const host = { assets: { async _uploadUserAsset(record) { stored = record; }, async get(id) { return { ...stored, source: 'user', url: '/tetra.3mf' }; } } };
 const ref = await tryStoreModelUpload(host, new File([bytes], 'tetra.3mf', { type: 'model/3mf' }));
 return { type: ref.type, format: ref.format, poster: ref.meta.posterUrl, original: Array.from(new Uint8Array(await stored.blob.arrayBuffer())) };
};
window.previewMf = () => {
 const preview = document.createElement('div'); preview.id = 'detail'; document.body.append(preview);
 window.stopMf = mountModelPreview(preview, { source: 'remote', id: 'model', type: 'model', format: '3mf', url: '/tetra.3mf' });
};
`,
  });
  try {
    const page = await harness.open();
    const uploaded = await page.evaluate(() => (window as any).uploadMf());
    assert.equal(uploaded.type, 'model');
    assert.equal(uploaded.format, '3mf');
    assert.match(uploaded.poster, /^data:image\/png;base64,/);
    assert.deepEqual(uploaded.original, Array.from(bytes));
    const frame = await harness.render(page, {
      source: 'model',
      modelAsset: { url: '/tetra.3mf', format: '3mf' },
      samples: 8,
    });
    assert.equal(frame.state, 'ready');
    await page.evaluate(() => (window as any).previewMf());
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLElement>('#detail [data-lolly-studio]')?.dataset.studioState ===
        'ready'
    );
    assert.equal(await page.locator('#detail canvas').count(), 1);
    await page.evaluate(() => (window as any).stopMf());
    assert.equal(await page.locator('#detail canvas').count(), 0);
    assert.deepEqual(harness.errors, []);
  } finally {
    await harness.close();
  }
});

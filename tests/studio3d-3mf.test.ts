// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import * as THREE from 'three';
import { buildStudioScene } from '../engine/src/studio3d.ts';
import { loadStudioSource } from '../shells/web/src/lib/studio3d/source.ts';
import { loadThreeMf } from '../shells/web/src/lib/studio3d/three-mf.ts';
import { threeMfThumbnail } from '../shells/web/src/lib/three-mf.ts';
import { applyStudioMaterials } from '../shells/web/src/lib/studio3d/materials.ts';
import { installStudioDom } from './helpers/studio3d-dom.ts';

const core = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const production = 'http://schemas.microsoft.com/3dmanufacturing/production/2015/06';
const rels =
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model"/></Relationships>';
const mesh =
  '<mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="2" y="0" z="0"/><vertex x="0" y="3" z="0"/><vertex x="0" y="0" z="4"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/><triangle v1="0" v2="3" v3="1"/><triangle v1="1" v2="3" v3="2"/><triangle v1="2" v2="3" v3="0"/></triangles></mesh>';
function model(resources: string, build = '<item objectid="1"/>', unit = 'millimeter') {
  return `<model xmlns="${core}" xmlns:p="${production}" unit="${unit}"><resources>${resources}</resources><build>${build}</build></model>`;
}
function archive(root: string, extra: Record<string, string | Uint8Array> = {}) {
  return zipSync(
    Object.fromEntries(
      Object.entries({ '_rels/.rels': rels, '3D/3dmodel.model': root, ...extra }).map(([k, v]) => [
        k,
        typeof v === 'string' ? strToU8(v) : v,
      ])
    )
  );
}
installStudioDom();
test('3MF core geometry, units and authored colors survive Studio source mode', async () => {
  const bytes = archive(
    model(
      `<basematerials id="2"><base name="green" displaycolor="#00ff00"/></basematerials><object id="1" pid="2" pindex="0">${mesh}</object>`,
      undefined,
      'centimeter'
    )
  );
  const scene = buildStudioScene({
    version: 1,
    values: { source: 'model', modelAsset: { url: '/tetra.3mf', name: 'tetra.3mf' } },
  });
  assert.equal(scene.source.kind, '3mf');
  const asset = await loadStudioSource(scene, async () => bytes, new AbortController().signal);
  try {
    assert.equal(asset.info.triangles, 4);
    assert.ok(Math.abs(asset.info.bounds!.span - 40) < 0.001);
    assert.ok(Math.abs(asset.info.bounds!.y - 40) < 0.001);
    const original = [...asset.originals.values()][0] as THREE.MeshStandardMaterial;
    assert.equal(original.vertexColors, true);
    const restore = applyStudioMaterials(asset, scene);
    assert.equal([...asset.originals.keys()][0]!.material, original);
    restore();
  } finally {
    asset.dispose();
  }
});
test('Bambu production parts resolve ids in each file and compose transforms', () => {
  const bytes = archive(
    model(
      '<object id="1"><components><component objectid="1" p:path="/3D/Objects/a.model" transform="1 0 0 0 1 0 0 0 1 10 0 0"/><component objectid="1" p:path="/3D/Objects/b.model" transform="1 0 0 0 1 0 0 0 1 20 0 0"/></components></object>'
    ),
    {
      '3D/Objects/a.model': model(`<object id="1">${mesh}</object>`),
      '3D/Objects/b.model': model(`<object id="1">${mesh}</object>`),
    }
  );
  const loaded = loadThreeMf(bytes);
  const size = new THREE.Box3().setFromObject(loaded.object).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 12) < 0.001);
  loaded.object.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.geometry.dispose();
      (n.material as THREE.Material).dispose();
    }
  });
});
test('invalid packages, triangle indices and component cycles fail clearly', () => {
  assert.throws(() => threeMfThumbnail(zipSync({ 'file.txt': strToU8('no model') })), /valid 3MF/);
  assert.throws(
    () =>
      loadThreeMf(archive(model(`<object id="1">${mesh.replace('v3="2"', 'v3="99"')}</object>`))),
    /triangle index/
  );
  assert.throws(
    () =>
      loadThreeMf(
        archive(model('<object id="1"><components><component objectid="1"/></components></object>'))
      ),
    /circular/
  );
});
test('plate thumbnail can be extracted without inflating a large mesh', async () => {
  const bytes = archive(model(`<object id="1">${mesh}</object>`), {
    'Metadata/plate_1.png': new Uint8Array([137, 80, 78, 71]),
    'ignored.bin': new Uint8Array(10_000),
  });
  const thumb = threeMfThumbnail(bytes)!;
  assert.equal(thumb.type, 'image/png');
  assert.deepEqual(new Uint8Array(await thumb.arrayBuffer()), new Uint8Array([137, 80, 78, 71]));
});

test('format detection follows asset metadata for opaque DAM and blob URLs', () => {
  for (const modelAsset of [
    {
      id: 'ext/suse/chameleon',
      url: '/catalog/ext/suse/chameleon/attachment',
      format: '3mf',
      meta: { name: 'Chameleon' },
    },
    { id: 'user/upload/example', url: 'blob:opaque', meta: { name: 'chameleon.3mf' } },
  ]) {
    assert.equal(
      buildStudioScene({ version: 1, values: { source: 'model', modelAsset } }).source.kind,
      '3mf'
    );
  }
});

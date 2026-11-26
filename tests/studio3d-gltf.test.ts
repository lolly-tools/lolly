// SPDX-License-Identifier: MPL-2.0
/**
 * A self-contained .gltf in 3D Studio (shells/web/src/lib/gltf-container.ts).
 *
 * A .gltf is a manifest that may point at other files. The studio reads one only when
 * every buffer and image is embedded, rewrites it as the equivalent .glb and hands that
 * to the inspector and loader a .glb upload already goes through. These tests hold three
 * things: the rewrite gives the same model as the .glb, a file that refers outside itself
 * is refused by name with nothing fetched, and hostile input is refused with a plain
 * message instead of a crash, a hang or a large allocation.
 *
 * Run directly:  node --test tests/studio3d-gltf.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildStudioScene } from '../engine/src/studio3d.ts';
import { tryStoreModelUpload } from '../shells/web/src/lib/model-upload.ts';
import {
  GLTF_MANIFEST_MAX_BYTES,
  GLTF_MAX_JSON_DEPTH,
  GLTF_MAX_UNBACKED_COUNT,
  MODEL_MAX_BYTES,
  gltfToGlb,
  inspectGlb,
  inspectedGlb,
  jsonDepthWithin,
} from '../shells/web/src/lib/gltf-container.ts';
import { loadStudioSource } from '../shells/web/src/lib/studio3d/source.ts';
import { installStudioDom } from './helpers/studio3d-dom.ts';
import { encodePng } from './helpers/studio3d-glb.ts';
import {
  TRIANGLE_BUFFER_BYTES,
  base64,
  glbOf,
  jsonBytes,
  readGlb,
  triangleBuffer,
  triangleGlb,
  triangleGltf,
  triangleManifest,
} from './helpers/studio3d-gltf.ts';

const NOT_A_MODEL = 'Use a self-contained glTF 2.0 binary (.glb) model.';
const BAD_MANIFEST = 'The GLB manifest is invalid or too large.';
const TOO_BIG = 'Use a source file between 1 byte and 32 MB.';
const external = (name: string) =>
  `This .gltf refers to a separate file, ${name}. Export a .glb, which holds everything in one file.`;

const dataUri = (bytes: Uint8Array, type = 'application/octet-stream') =>
  `data:${type};base64,${base64(bytes)}`;
const embedded = (extra: Record<string, unknown> = {}) => ({
  uri: dataUri(triangleBuffer()),
  byteLength: TRIANGLE_BUFFER_BYTES,
  ...extra,
});

/** Every refusal is an Error with one of the studio's own messages, never a stray TypeError. */
function refused(bytes: Uint8Array, message: string | RegExp, label: string): void {
  assert.throws(
    () => inspectedGlb(bytes),
    (error: unknown) => {
      assert.ok(error instanceof Error, `${label}: threw a non-Error`);
      assert.equal(error.constructor, Error, `${label}: threw ${error.constructor.name}`);
      if (typeof message === 'string') assert.equal(error.message, message, label);
      else assert.match(error.message, message, label);
      return true;
    },
    label
  );
}

test('a self-contained .gltf becomes the same .glb the model would be exported as', () => {
  const glb = gltfToGlb(triangleGltf());
  assert.deepEqual(glb, triangleGlb(), 'byte for byte the hand-built .glb');
  const { manifest, bin } = readGlb(glb);
  assert.deepEqual(manifest.buffers, [{ byteLength: TRIANGLE_BUFFER_BYTES }]);
  assert.deepEqual(bin, triangleBuffer());
  assert.ok(!JSON.stringify(manifest).includes('data:'), 'no URI is left in the manifest');
  assert.doesNotThrow(() => inspectGlb(glb));
  // A .glb is handed back untouched; a .gltf comes back converted. Both are inspected.
  const same = triangleGlb();
  assert.equal(inspectedGlb(same), same);
  assert.deepEqual(inspectedGlb(triangleGltf()), triangleGlb());
  // A byte order mark and leading white space are still JSON.
  const marked = new Uint8Array([0xef, 0xbb, 0xbf, 0x20, 0x0a, ...triangleGltf()]);
  assert.deepEqual(inspectedGlb(marked), triangleGlb());
});

test('the loader reads a .gltf and the equivalent .glb as the same model', async () => {
  installStudioDom();
  const scene = buildStudioScene({
    version: 1,
    values: { source: 'model', modelAsset: { url: '/triangle.gltf', name: 'triangle.gltf' } },
  });
  assert.equal(scene.source.kind, 'glb', 'both containers are the one glTF kind');
  const signal = new AbortController().signal;
  const fromGltf = await loadStudioSource(scene, async () => triangleGltf(), signal);
  const fromGlb = await loadStudioSource(scene, async () => triangleGlb(), signal);
  try {
    assert.equal(fromGltf.info.triangles, 1);
    assert.deepEqual(fromGltf.info, fromGlb.info);
    assert.deepEqual(fromGltf.info.bounds, { x: 2, y: 1, z: 0, span: 2 });
  } finally {
    fromGltf.dispose();
    fromGlb.dispose();
  }
});

test('the engine takes gltf as a model format and keeps the one glTF kind', () => {
  const kind = (values: Record<string, unknown>) =>
    buildStudioScene({ version: 1, values: { source: 'model', ...values } }).source.kind;
  assert.equal(kind({ modelFormat: 'gltf', modelAsset: { url: '/a.bin' } }), 'glb');
  assert.equal(kind({ modelAsset: { url: '/a', format: 'gltf' } }), 'glb');
  assert.equal(kind({ modelAsset: { url: '/models/a.gltf?v=2' } }), 'glb');
  // The other formats are detected as before.
  assert.equal(kind({ modelAsset: { url: '/a.stl' } }), 'stl');
  assert.equal(kind({ modelAsset: { url: '/a.3mf' } }), '3mf');
  assert.equal(kind({ modelFormat: 'stl', modelAsset: { url: '/a.gltf' } }), 'stl');
});

test('an embedded picture moves into the binary chunk and is typed from its bytes', () => {
  const png = encodePng(2, 2, () => [255, 0, 0, 255]);
  const gltf = (image: Record<string, unknown>) =>
    jsonBytes(triangleManifest(embedded(), { images: [image] }));
  for (const label of ['image/png', 'application/octet-stream', 'image/jpeg']) {
    const { manifest, bin } = readGlb(gltfToGlb(gltf({ uri: dataUri(png, label), name: 'Paint' })));
    const image = (manifest.images as Record<string, unknown>[])[0]!;
    assert.equal(image.uri, undefined);
    assert.equal(image.mimeType, 'image/png', `labelled ${label}, the bytes are a PNG`);
    assert.equal(image.name, 'Paint');
    const view = (manifest.bufferViews as Record<string, number>[])[image.bufferView as number]!;
    assert.deepEqual(bin.subarray(view.byteOffset, view.byteOffset! + view.byteLength!), png);
    assert.equal(view.byteOffset! % 4, 0, 'the picture starts on a four byte boundary');
  }
  // A picture already stored in a buffer view is left where it is.
  const kept = readGlb(gltfToGlb(gltf({ bufferView: 0, mimeType: 'image/png' })));
  assert.deepEqual(kept.manifest.images, [{ bufferView: 0, mimeType: 'image/png' }]);
  refused(gltf({ uri: dataUri(triangleBuffer(), 'image/png') }), NOT_A_MODEL, 'not a picture');
  refused(gltf({ bufferView: 9 }), NOT_A_MODEL, 'a picture in a view that does not exist');
  refused(gltf({}), NOT_A_MODEL, 'a picture with no data');
  refused(gltf({ uri: 'data:image/png,plain' }), NOT_A_MODEL, 'a data URI that is not base64');
});

test('a .gltf that refers to another file is refused by name, and nothing is fetched', () => {
  const fetched: unknown[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((...args: unknown[]) => {
    fetched.push(args);
    return Promise.reject(new Error('the network was touched'));
  }) as typeof fetch;
  try {
    const withBuffer = (uri: unknown) =>
      jsonBytes(triangleManifest({ uri, byteLength: TRIANGLE_BUFFER_BYTES }));
    refused(withBuffer('scene.bin'), external('scene.bin'), 'a sibling file');
    for (const uri of [
      '../secret.bin',
      '../../../../etc/passwd',
      '/etc/passwd',
      'C:\\models\\scene.bin',
      'http://example.test/scene.bin',
      'https://example.test/scene.bin',
      '//example.test/scene.bin',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'blob:https://example.test/0a1b',
      'DATA:application/octet-stream;base64,AAAA',
      ' data:application/octet-stream;base64,AAAA',
    ])
      refused(withBuffer(uri), external(uri.trim()), uri);
    // A URI that is not text at all is refused the same way, as it is written.
    refused(withBuffer(7), external('7'), 'a number for a URI');
    // The first reference is the one named: buffers in order, then images.
    refused(
      jsonBytes(
        triangleManifest(embedded(), { images: [{ uri: 'paint.png' }, { uri: 'trim.png' }] })
      ),
      external('paint.png'),
      'an image beside the model'
    );
    refused(
      jsonBytes({
        ...triangleManifest(embedded()),
        buffers: [embedded(), { uri: 'second.bin', byteLength: 4 }, { uri: 'third.bin' }],
      }),
      external('second.bin'),
      'the first external buffer'
    );
    // A long or unprintable name is cut and cleaned before it is shown.
    refused(
      withBuffer(`${'a'.repeat(200)}\u0000\u202e.bin`),
      external(`${'a'.repeat(80)}...`),
      'a long name'
    );
    // A .glb with the same fault keeps the message it always gave.
    refused(
      glbOf(triangleManifest({ uri: 'scene.bin', byteLength: 44 }), null),
      'This GLB links external files. Embed its textures and buffers before importing.',
      'a .glb that links out'
    );
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(fetched, []);
});

test('hostile and broken .gltf files are refused plainly', () => {
  const text = (s: string) => new TextEncoder().encode(s);
  const withBuffer = (buffer: unknown, extra: Record<string, unknown> = {}) =>
    jsonBytes(triangleManifest(buffer as Record<string, unknown>, extra));

  // Not JSON, or JSON that is not a glTF 2.x manifest.
  refused(text('{ this is not json'), NOT_A_MODEL, 'broken JSON');
  refused(text('{}'), NOT_A_MODEL, 'no asset');
  refused(text('{"asset":{"version":"1.0"}}'), NOT_A_MODEL, 'glTF 1.0');
  refused(text('{"asset":{"version":"3.0"}}'), NOT_A_MODEL, 'a later major version');
  refused(text('{"asset":{"version":2}}{'), NOT_A_MODEL, 'trailing text');
  refused(new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d]), NOT_A_MODEL, 'invalid UTF-8');
  refused(text('[1,2,3,4,5,6,7,8,9,10,11,12]'), NOT_A_MODEL, 'an array is not a model');
  refused(text('solid not a model at all, only text'), NOT_A_MODEL, 'plain text');
  refused(new Uint8Array(0), 'The GLB file is incomplete.', 'an empty file');
  // Sections of the wrong shape.
  for (const key of ['buffers', 'bufferViews', 'images', 'accessors'])
    refused(
      jsonBytes({ ...triangleManifest(embedded()), [key]: { length: 1e9 } }),
      NOT_A_MODEL,
      `${key} as an object`
    );
  refused(withBuffer(null), NOT_A_MODEL, 'a null buffer');
  refused(withBuffer({ byteLength: 44 }), NOT_A_MODEL, 'a buffer with no data');
  refused(withBuffer({ uri: '', byteLength: 44 }), NOT_A_MODEL, 'an empty URI');

  // A data URI whose length disagrees with what the manifest declares.
  const short = dataUri(triangleBuffer().subarray(0, 20));
  refused(withBuffer({ uri: short, byteLength: 44 }), NOT_A_MODEL, 'payload shorter than declared');
  refused(
    withBuffer({ uri: dataUri(triangleBuffer()), byteLength: 8 }),
    NOT_A_MODEL,
    'payload longer than declared'
  );
  for (const byteLength of [-1, 1.5, 1e12, '44', null, undefined, Number.MAX_SAFE_INTEGER])
    refused(
      withBuffer({ uri: dataUri(triangleBuffer()), byteLength }),
      NOT_A_MODEL,
      `byteLength ${String(byteLength)}`
    );
  // Characters outside the base64 alphabet, white space included.
  const good = base64(triangleBuffer());
  for (const bad of [
    `${good.slice(0, 8)} ${good.slice(9)}`,
    `${good.slice(0, 8)}*${good.slice(9)}`,
    `${good.slice(0, 8)}\u00e9${good.slice(9)}`,
    `${good.slice(0, 8)}=${good.slice(9)}`,
    `${good}A`,
  ])
    refused(
      withBuffer({ uri: `data:application/octet-stream;base64,${bad}`, byteLength: 44 }),
      NOT_A_MODEL,
      `base64 ${JSON.stringify(bad.slice(4, 14))}`
    );
  refused(
    withBuffer({ uri: 'data:application/octet-stream,AAAA', byteLength: 3 }),
    NOT_A_MODEL,
    'a data URI that is not base64'
  );
  refused(withBuffer({ uri: 'data:', byteLength: 0 }), NOT_A_MODEL, 'a data URI with no payload');

  // Buffer views that reach outside their buffer or name one that does not exist.
  for (const view of [
    { buffer: 0, byteOffset: 40, byteLength: 8 },
    { buffer: 0, byteOffset: 0, byteLength: 1e12 },
    { buffer: 0, byteOffset: -4, byteLength: 4 },
    { buffer: 1, byteOffset: 0, byteLength: 4 },
    { buffer: -1, byteLength: 4 },
    { buffer: '0', byteLength: 4 },
    { buffer: 0.5, byteLength: 4 },
    { byteLength: 4 },
    { buffer: 0 },
    null,
    'view',
  ])
    refused(
      jsonBytes({ ...triangleManifest(embedded()), bufferViews: [view] }),
      NOT_A_MODEL,
      `buffer view ${JSON.stringify(view)}`
    );

  // Counts the loader would allocate for: an accessor with no buffer view is filled with
  // zeros, so its count is held to what a mesh at the triangle limit uses, in both containers.
  for (const count of [1e12, 1e308, -1, Number.NaN, '3', GLTF_MAX_UNBACKED_COUNT + 1]) {
    const accessors = [{ componentType: 5126, count, type: 'MAT4' }];
    refused(withBuffer(embedded(), { accessors }), BAD_MANIFEST, `.gltf accessor count ${count}`);
    refused(
      glbOf(triangleManifest({ byteLength: 44 }, { accessors }), triangleBuffer()),
      BAD_MANIFEST,
      `.glb accessor count ${count}`
    );
  }
  // One at the limit is read, as a sparse morph target would be.
  assert.doesNotThrow(() =>
    inspectedGlb(
      withBuffer(embedded(), {
        accessors: [{ componentType: 5126, count: GLTF_MAX_UNBACKED_COUNT, type: 'VEC3' }],
      })
    )
  );
  // Many of them add up to the same refusal.
  refused(
    withBuffer(embedded(), {
      accessors: Array.from({ length: 64 }, () => ({ componentType: 5126, count: 1e6, type: 'VEC3' })),
    }),
    BAD_MANIFEST,
    'accessors that add up past the limit'
  );
  // A manifest larger than a .glb may carry, here a hundred thousand nodes.
  const many = withBuffer(embedded(), {
    nodes: Array.from({ length: 100_000 }, (_, i) => ({ name: `node ${i}`, mesh: 0 })),
  });
  assert.ok(many.length > GLTF_MANIFEST_MAX_BYTES && many.length < MODEL_MAX_BYTES);
  refused(many, BAD_MANIFEST, 'a hundred thousand nodes');
  // Compression the studio has no decoder for is refused as it is for a .glb.
  refused(
    withBuffer(embedded(), { extensionsRequired: ['KHR_draco_mesh_compression'] }),
    'Export this model without Draco, Meshopt or KTX2 compression.',
    'Draco'
  );
  // A file over the model limit is refused before it is read as text.
  const big = new Uint8Array(MODEL_MAX_BYTES + 1).fill(0x20);
  big[0] = 0x7b;
  refused(big, TOO_BIG, 'a file over 32 MB');
});

test('deep nesting is stopped before the manifest is parsed', () => {
  const text = (s: string) => new TextEncoder().encode(s);
  const nest = (depth: number) =>
    text(`{"asset":{"version":"2.0"},"extras":${'['.repeat(depth)}${']'.repeat(depth)}}`);
  assert.doesNotThrow(() => inspectedGlb(nest(GLTF_MAX_JSON_DEPTH - 1)));
  refused(nest(GLTF_MAX_JSON_DEPTH), NOT_A_MODEL, 'one level too deep');
  refused(nest(200_000), NOT_A_MODEL, 'two hundred thousand levels');
  refused(text('{"a":'.repeat(200_000)), NOT_A_MODEL, 'unclosed objects');
  // Brackets inside a string are text, not structure, and an escaped quote does not end one.
  assert.equal(jsonDepthWithin(text(`{"a":"${'['.repeat(500)}"}`), 4), true);
  assert.equal(jsonDepthWithin(text(`{"a":"\\"${'{'.repeat(500)}"}`), 4), true);
  assert.equal(jsonDepthWithin(text('[[[[[]]]]]'), 4), false);
  assert.equal(jsonDepthWithin(text('[[[[]]]]'), 4), true);
  // The same guard reads a .glb's manifest.
  const deep = `{"asset":{"version":"2.0"},"extras":${'['.repeat(500)}${']'.repeat(500)}}`;
  const padded = text(deep.padEnd(Math.ceil(deep.length / 4) * 4));
  const glb = new Uint8Array(20 + padded.length);
  const view = new DataView(glb.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, glb.length, true);
  view.setUint32(12, padded.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  glb.set(padded, 20);
  refused(glb, BAD_MANIFEST, 'a deep .glb manifest');
});

test('an upload stores a self-contained .gltf and refuses one that refers outside itself', async () => {
  const stored: { id: string; type: string; format: string; meta: Record<string, unknown> }[] = [];
  const host = {
    assets: {
      async get(id: string) {
        return { id } as never;
      },
      async _uploadUserAsset(record: (typeof stored)[number]) {
        stored.push(record);
      },
    },
  };
  const file = (bytes: Uint8Array, name: string, type = '') =>
    new File([bytes as BlobPart], name, { type });
  const ref = await tryStoreModelUpload(host, file(triangleGltf(), 'Tri angle.gltf'));
  assert.ok(ref);
  assert.equal(stored.length, 1);
  assert.equal(stored[0]!.type, 'model');
  assert.equal(stored[0]!.format, 'gltf');
  assert.deepEqual(stored[0]!.meta.tags, ['3d', 'gltf']);
  assert.match(stored[0]!.id, /^user\/upload\/[0-9a-f-]+-Tri_angle\.gltf$/);
  // The media type alone is enough, as it is for a .glb.
  await tryStoreModelUpload(host, file(triangleGltf(), 'triangle', 'model/gltf+json'));
  assert.equal(stored[1]!.format, 'gltf');
  const linked = jsonBytes(triangleManifest({ uri: 'scene.bin', byteLength: 44 }));
  await assert.rejects(tryStoreModelUpload(host, file(linked, 'scene.gltf')), {
    message: external('scene.bin'),
  });
  await assert.rejects(tryStoreModelUpload(host, file(new Uint8Array(0), 'empty.gltf')), {
    message: 'Use a model between 1 byte and 32 MB.',
  });
  await assert.rejects(
    tryStoreModelUpload(host, file(new TextEncoder().encode('{"scenes":[]}'), 'not.gltf')),
    { message: NOT_A_MODEL }
  );
  assert.equal(stored.length, 2, 'a refused file stores nothing');
  // A file that is not a model at all is left for the other importers.
  assert.equal(await tryStoreModelUpload(host, file(triangleGltf(), 'data.json')), null);
});

test('the tool offers glTF wherever it offers a model format, and lists .gltf for upload', () => {
  const manifest = JSON.parse(readFileSync('community/3d-studio/tool.json', 'utf8'));
  const formats: string[][] = [];
  const accepts: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const item = value as Record<string, unknown>;
    if (item.id === 'modelFormat')
      formats.push((item.options as { value: string }[]).map((option) => option.value));
    if (typeof item.accept === 'string' && item.accept.includes('.glb')) accepts.push(item.accept);
    for (const entry of Object.values(item)) walk(entry);
  };
  walk(manifest.inputs);
  assert.equal(formats.length, 3, 'the scene, a collection item and an arrangement row');
  for (const options of formats) assert.deepEqual(options, ['auto', 'glb', 'gltf', 'stl', '3mf']);
  assert.ok(accepts.length >= 2);
  for (const accept of accepts) assert.ok(accept.split(',').includes('.gltf'), accept);
});

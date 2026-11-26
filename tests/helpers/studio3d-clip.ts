// SPDX-License-Identifier: MPL-2.0
/**
 * Small animated glTF 2.0 models for the baked clip suite (tests/studio3d-clip.test.ts).
 *
 * Each is one triangle, (0,0,0) (2,0,0) (0,1,0), that moves in a way a test can state in
 * a line. None carries an image, so Node loads them with no decoder. Nothing reads a clock
 * or a random source, so every call returns the same bytes.
 *
 *   movingGlb   the triangle's node slides along x: 0 at 0 s, 4 at 1 s, 0 at 2 s
 *   morphGlb    a morph target lifts every vertex by 3 in y: weight 0, 1, 0 at 0, 1, 2 s
 *   skinnedGlb  the triangle is bound to one bone that slides along x: 0, 4, 0 at 0, 1, 2 s
 *   twoClipGlb  movingGlb with a second clip, "Rise", that lifts the node 2 in y over 1 s
 */
import { glbOf } from './studio3d-gltf.ts';

type Json = Record<string, unknown>;

/** Pack typed chunks into one buffer, each on a four byte boundary, with a view and an accessor per chunk. */
function pack(chunks: { data: ArrayBufferView; accessor: Json }[]): { bin: Uint8Array; bufferViews: Json[]; accessors: Json[] } {
  const bufferViews: Json[] = [];
  const accessors: Json[] = [];
  const parts: Uint8Array[] = [];
  let at = 0;
  for (const [i, chunk] of chunks.entries()) {
    const bytes = new Uint8Array(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength);
    const padded = new Uint8Array(bytes.length + ((4 - (bytes.length % 4)) % 4));
    padded.set(bytes);
    bufferViews.push({ buffer: 0, byteOffset: at, byteLength: bytes.length });
    accessors.push({ bufferView: i, ...chunk.accessor });
    parts.push(padded);
    at += padded.length;
  }
  const bin = new Uint8Array(at);
  let offset = 0;
  for (const part of parts) {
    bin.set(part, offset);
    offset += part.length;
  }
  return { bin, bufferViews, accessors };
}

const POSITIONS = {
  data: new Float32Array([0, 0, 0, 2, 0, 0, 0, 1, 0]),
  accessor: { componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [2, 1, 0] },
};
const INDICES = { data: new Uint16Array([0, 1, 2]), accessor: { componentType: 5123, count: 3, type: 'SCALAR' } };
const TIMES = { data: new Float32Array([0, 1, 2]), accessor: { componentType: 5126, count: 3, type: 'SCALAR', min: [0], max: [2] } };
const SLIDE = { data: new Float32Array([0, 0, 0, 4, 0, 0, 0, 0, 0]), accessor: { componentType: 5126, count: 3, type: 'VEC3' } };

function model(chunks: { data: ArrayBufferView; accessor: Json }[], rest: Json): Uint8Array {
  const { bin, bufferViews, accessors } = pack(chunks);
  return glbOf(
    {
      asset: { version: '2.0', generator: 'lolly test' },
      scene: 0,
      buffers: [{ byteLength: bin.length }],
      bufferViews,
      accessors,
      ...rest,
    },
    bin
  );
}

const slide = (name: string, node: number): Json => ({
  name,
  samplers: [{ input: 2, output: 3, interpolation: 'LINEAR' }],
  channels: [{ sampler: 0, target: { node, path: 'translation' } }],
});

export function movingGlb(): Uint8Array {
  return model([POSITIONS, INDICES, TIMES, SLIDE], {
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Slider' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    animations: [slide('Slide', 0)],
  });
}

export function twoClipGlb(): Uint8Array {
  return model(
    [
      POSITIONS,
      INDICES,
      TIMES,
      SLIDE,
      { data: new Float32Array([0, 1]), accessor: { componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] } },
      { data: new Float32Array([0, 0, 0, 0, 2, 0]), accessor: { componentType: 5126, count: 2, type: 'VEC3' } },
    ],
    {
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: 'Slider' }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      animations: [
        slide('Slide', 0),
        {
          name: 'Rise',
          samplers: [{ input: 4, output: 5, interpolation: 'LINEAR' }],
          channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
        },
      ],
    }
  );
}

export function morphGlb(): Uint8Array {
  return model(
    [
      POSITIONS,
      INDICES,
      TIMES,
      { data: new Float32Array([0, 3, 0, 0, 3, 0, 0, 3, 0]), accessor: { componentType: 5126, count: 3, type: 'VEC3', min: [0, 3, 0], max: [0, 3, 0] } },
      { data: new Float32Array([0, 1, 0]), accessor: { componentType: 5126, count: 3, type: 'SCALAR' } },
    ],
    {
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: 'Lifter' }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, targets: [{ POSITION: 3 }] }], weights: [0] }],
      animations: [
        {
          name: 'Lift',
          samplers: [{ input: 2, output: 4, interpolation: 'LINEAR' }],
          channels: [{ sampler: 0, target: { node: 0, path: 'weights' } }],
        },
      ],
    }
  );
}

export function skinnedGlb(): Uint8Array {
  return model(
    [
      POSITIONS,
      INDICES,
      TIMES,
      SLIDE,
      { data: new Uint8Array(12), accessor: { componentType: 5121, count: 3, type: 'VEC4' } },
      { data: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), accessor: { componentType: 5126, count: 3, type: 'VEC4' } },
    ],
    {
      scenes: [{ nodes: [0, 1] }],
      nodes: [
        { mesh: 0, skin: 0, name: 'Skin' },
        { name: 'Bone' },
      ],
      skins: [{ joints: [1] }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 4, WEIGHTS_0: 5 }, indices: 1 }] }],
      animations: [slide('Slide', 1)],
    }
  );
}

// SPDX-License-Identifier: MPL-2.0
/**
 * A deterministic, self-contained glTF 2.0 binary with three materials, for the 3D Studio
 * material override suite (tests/studio3d-quality-glb.browser.test.ts).
 *
 * The bundled sample models (duck, cat and the Geeko models) each carry one material, so
 * none of them can show that an override on one slot leaves the other slots alone. This
 * model is one mesh with three box primitives side by side along x:
 *
 *   Paint   baseColorTexture
 *   Rubber  normalTexture, metallicRoughnessTexture and occlusionTexture
 *   Trim    emissiveTexture, emissiveFactor and alphaMode BLEND (base alpha 0.6)
 *
 * Every texture is its own 4 by 4 RGBA PNG, encoded here with node:zlib, and stored in the
 * BIN chunk through a bufferView. No two textures share an image, because three.js caches a
 * texture per image and sampler, and a shared texture would take the colour space of
 * whichever map claimed it last. Every primitive carries POSITION, NORMAL, TEXCOORD_0 and
 * TANGENT, so GLTFLoader keeps the authored material objects rather than cloning them for
 * derived tangents. No compression extension is used: the studio refuses Draco, Meshopt and
 * KTX2 (shells/web/src/lib/gltf-container.ts, inspectGlb).
 *
 * Nothing here reads the clock or a random source, so every call returns the same bytes.
 */
import { deflateSync } from 'node:zlib';

/** The material names, in primitive order. The studio lists them as slots in this order. */
export const MULTI_GLB_MATERIALS = ['Paint', 'Rubber', 'Trim'] as const;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** The CRC-32 a PNG chunk carries (ISO 3309, as zlib computes it). */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const ascii = (text: string) => Uint8Array.from(text, (ch) => ch.charCodeAt(0));

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(ascii(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export type Rgba = readonly [number, number, number, number];

/** An 8-bit RGBA PNG; `pixel(x, y)` gives each pixel, rows top to bottom. */
export function encodePng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => Rgba
): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8); // bit depth 8, colour type RGBA, deflate, filter set 0, no interlace
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    raw[row] = 0; // filter type None
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), row + 1 + x * 4);
  }
  return concat([
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

const checker = (a: Rgba, b: Rgba) => (x: number, y: number) => ((x + y) % 2 ? b : a);

/** The five texture images, one per map, in texture index order. */
const TEXTURES = [
  // 0: Paint base colour, an orange and cream checker (sRGB data).
  { name: 'paint-base', pixel: checker([235, 110, 40, 255], [250, 235, 200, 255]) },
  // 1: Rubber normal map, close to flat with a small tilt on alternate texels (linear data).
  { name: 'rubber-normal', pixel: checker([128, 128, 255, 255], [150, 120, 240, 255]) },
  // 2: Rubber metal and roughness: G is roughness, B is metalness (linear data).
  { name: 'rubber-metal-rough', pixel: checker([0, 220, 20, 255], [0, 180, 60, 255]) },
  // 3: Rubber occlusion in R (linear data).
  { name: 'rubber-occlusion', pixel: checker([255, 255, 255, 255], [170, 170, 170, 255]) },
  // 4: Trim emission, a cyan and blue checker (sRGB data).
  { name: 'trim-emissive', pixel: checker([60, 230, 255, 255], [30, 90, 255, 255]) },
] as const;

type Vec3 = readonly [number, number, number];
/** Each face as its normal, then the u and v directions, with u cross v equal to the normal. */
const FACES: readonly [Vec3, Vec3, Vec3][] = [
  [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ],
  [
    [-1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ],
  [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, -1],
  ],
  [
    [0, -1, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
  [
    [0, 0, 1],
    [1, 0, 0],
    [0, 1, 0],
  ],
  [
    [0, 0, -1],
    [-1, 0, 0],
    [0, 1, 0],
  ],
];

interface BoxData {
  position: number[];
  normal: number[];
  uv: number[];
  tangent: number[];
  index: number[];
}

/** A cube with four vertices per face, counter-clockwise from outside. */
function box(center: Vec3, size: number): BoxData {
  const out: BoxData = { position: [], normal: [], uv: [], tangent: [], index: [] };
  const half = size / 2;
  for (const [f, [n, u, v]] of FACES.entries()) {
    for (const [s, t] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ] as const) {
      for (let axis = 0; axis < 3; axis++)
        out.position.push(
          center[axis]! +
            n[axis]! * half +
            u[axis]! * (s - 0.5) * size +
            v[axis]! * (t - 0.5) * size
        );
      out.normal.push(...n);
      // glTF puts the first image row at v = 0, so t runs upward as 1 - v.
      out.uv.push(s, 1 - t);
      out.tangent.push(...u, 1);
    }
    const base = f * 4;
    out.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return out;
}

const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

/** The model described in the header, as GLB bytes. */
export function buildMultiMaterialGlb(): Uint8Array {
  const bin: Uint8Array[] = [];
  let length = 0;
  const bufferViews: Record<string, number>[] = [];
  const accessors: Record<string, unknown>[] = [];
  const view = (bytes: Uint8Array, target?: number): number => {
    const pad = (4 - (length % 4)) % 4;
    if (pad) {
      bin.push(new Uint8Array(pad));
      length += pad;
    }
    bufferViews.push({
      buffer: 0,
      byteOffset: length,
      byteLength: bytes.length,
      ...(target ? { target } : {}),
    });
    bin.push(bytes);
    length += bytes.length;
    return bufferViews.length - 1;
  };
  const floats = (values: number[], size: number, type: string, bounds = false): number => {
    const array = new Float32Array(values);
    const extra: Record<string, number[]> = {};
    if (bounds) {
      extra.min = [];
      extra.max = [];
      for (let axis = 0; axis < size; axis++) {
        const column = values.filter((_, i) => i % size === axis);
        extra.min.push(Math.min(...column));
        extra.max.push(Math.max(...column));
      }
    }
    accessors.push({
      bufferView: view(new Uint8Array(array.buffer), ARRAY_BUFFER),
      componentType: FLOAT,
      count: values.length / size,
      type,
      ...extra,
    });
    return accessors.length - 1;
  };
  const indices = (values: number[]): number => {
    const array = new Uint16Array(values);
    accessors.push({
      bufferView: view(new Uint8Array(array.buffer), ELEMENT_ARRAY_BUFFER),
      componentType: UNSIGNED_SHORT,
      count: values.length,
      type: 'SCALAR',
    });
    return accessors.length - 1;
  };

  const primitives = MULTI_GLB_MATERIALS.map((_, material) => {
    const data = box([(material - 1) * 1.25, 0, 0], 1);
    return {
      attributes: {
        POSITION: floats(data.position, 3, 'VEC3', true),
        NORMAL: floats(data.normal, 3, 'VEC3'),
        TEXCOORD_0: floats(data.uv, 2, 'VEC2'),
        TANGENT: floats(data.tangent, 4, 'VEC4'),
      },
      indices: indices(data.index),
      material,
      mode: 4,
    };
  });
  const images = TEXTURES.map((texture) => ({
    name: texture.name,
    mimeType: 'image/png',
    bufferView: view(encodePng(4, 4, texture.pixel)),
  }));

  const json = {
    asset: { version: '2.0', generator: 'lolly tests/helpers/studio3d-glb.ts' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'multi', mesh: 0 }],
    meshes: [{ name: 'multi', primitives }],
    materials: [
      {
        name: 'Paint',
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 0.5,
        },
      },
      {
        name: 'Rubber',
        pbrMetallicRoughness: {
          baseColorFactor: [0.05, 0.05, 0.06, 1],
          metallicRoughnessTexture: { index: 2 },
          metallicFactor: 1,
          roughnessFactor: 1,
        },
        normalTexture: { index: 1, scale: 1 },
        occlusionTexture: { index: 3, strength: 1 },
      },
      {
        name: 'Trim',
        pbrMetallicRoughness: {
          baseColorFactor: [0.9, 0.8, 0.2, 0.6],
          metallicFactor: 0,
          roughnessFactor: 0.3,
        },
        emissiveTexture: { index: 4 },
        emissiveFactor: [1, 0.5, 0.25],
        alphaMode: 'BLEND',
      },
    ],
    // Linear magnification, trilinear minification, repeat wrapping.
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    textures: TEXTURES.map((texture, i) => ({ name: texture.name, sampler: 0, source: i })),
    images,
    accessors,
    bufferViews,
    buffers: [{ byteLength: 0 }],
  };
  const binPad = (4 - (length % 4)) % 4;
  const binary = concat([...bin, new Uint8Array(binPad)]);
  json.buffers[0]!.byteLength = binary.length;
  let text = JSON.stringify(json);
  text += ' '.repeat((4 - (text.length % 4)) % 4);
  const jsonBytes = ascii(text);

  const header = new Uint8Array(12);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, 0x46546c67, true); // glTF
  headerView.setUint32(4, 2, true);
  headerView.setUint32(8, 12 + 8 + jsonBytes.length + 8 + binary.length, true);
  const chunkHeader = (size: number, type: number) => {
    const bytes = new Uint8Array(8);
    const chunkView = new DataView(bytes.buffer);
    chunkView.setUint32(0, size, true);
    chunkView.setUint32(4, type, true);
    return bytes;
  };
  return concat([
    header,
    chunkHeader(jsonBytes.length, 0x4e4f534a), // JSON
    jsonBytes,
    chunkHeader(binary.length, 0x004e4942), // BIN
    binary,
  ]);
}

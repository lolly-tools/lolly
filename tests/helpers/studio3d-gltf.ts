// SPDX-License-Identifier: MPL-2.0
/**
 * One triangle as a glTF 2.0 model, in both containers, for the suites that read a .gltf
 * (tests/studio3d-gltf.test.ts and the `gltf-container` fuzz target).
 *
 * The buffer is 44 bytes: three float32 positions (36 bytes), then three uint16 indices
 * (6 bytes) and two bytes of padding. Nothing reads a clock or a random source, so every
 * call returns the same bytes.
 */

export const TRIANGLE_BUFFER_BYTES = 44;

export function triangleBuffer(): Uint8Array {
  const out = new Uint8Array(TRIANGLE_BUFFER_BYTES);
  const view = new DataView(out.buffer);
  for (const [i, n] of [0, 0, 0, 2, 0, 0, 0, 1, 0].entries()) view.setFloat32(i * 4, n, true);
  for (const [i, n] of [0, 1, 2].entries()) view.setUint16(36 + i * 2, n, true);
  return out;
}

export function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

type Json = Record<string, unknown>;

/** The triangle's manifest; `buffer` is the one entry of `buffers`. */
export function triangleManifest(buffer: Json, extra: Json = {}): Json {
  return {
    asset: { version: '2.0', generator: 'lolly test' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Triangle' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [buffer],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [2, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    ...extra,
  };
}

export function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

/** A self-contained .gltf: the buffer rides in the manifest as a base64 `data:` URI. */
export function triangleGltf(extra: Json = {}): Uint8Array {
  return jsonBytes(
    triangleManifest(
      {
        uri: `data:application/octet-stream;base64,${base64(triangleBuffer())}`,
        byteLength: TRIANGLE_BUFFER_BYTES,
      },
      extra
    )
  );
}

/** A .glb from a manifest and its binary chunk, padded as the specification asks. */
export function glbOf(manifest: unknown, bin: Uint8Array | null): Uint8Array {
  const text = jsonBytes(manifest);
  const jsonLength = text.length + ((4 - (text.length % 4)) % 4);
  const binLength = bin ? bin.length + ((4 - (bin.length % 4)) % 4) : 0;
  const length = 20 + jsonLength + (bin ? 8 + binLength : 0);
  const out = new Uint8Array(length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, length, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(text, 20);
  if (bin) {
    view.setUint32(20 + jsonLength, binLength, true);
    view.setUint32(24 + jsonLength, 0x004e4942, true);
    out.set(bin, 28 + jsonLength);
  }
  return out;
}

/** The same triangle as a .glb: the buffer is the binary chunk and the manifest holds no URI. */
export function triangleGlb(extra: Json = {}): Uint8Array {
  return glbOf(triangleManifest({ byteLength: TRIANGLE_BUFFER_BYTES }, extra), triangleBuffer());
}

/** The manifest and binary chunk a .glb carries. */
export function readGlb(glb: Uint8Array): { manifest: Json; bin: Uint8Array } {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  const manifest = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength))) as Json;
  const at = 20 + jsonLength;
  const bin = at + 8 <= glb.length ? glb.subarray(at + 8, at + 8 + view.getUint32(at, true)) : new Uint8Array(0);
  return { manifest, bin };
}

// SPDX-License-Identifier: MPL-2.0
/**
 * The two containers a glTF 2.0 model arrives in, read as untrusted bytes.
 *
 * A .glb holds the manifest and every buffer in one file. A .gltf is the manifest alone,
 * and the specification lets its buffers and images point anywhere: a sibling file, a
 * path above the model, a web address. The studio never follows such a pointer. A .gltf
 * is accepted only when every buffer and image is embedded, as a base64 `data:` URI or as
 * an image stored in a buffer view. Anything else is refused by name, with no fetch, no
 * path resolution and no read of a neighbouring file.
 *
 * An accepted .gltf is rewritten as the equivalent .glb, with the embedded bytes moved
 * into the binary chunk, and that .glb then goes through `inspectGlb` and the loader
 * exactly as an uploaded .glb does. There is one inspector and one set of limits.
 *
 * Nothing here needs a DOM or three.js, so Node tests and the fuzz harness call it directly.
 */

/** The largest GLB, STL or glTF file the studio reads. Embedded data counts toward the same limit. */
export const MODEL_MAX_BYTES = 32 * 1024 * 1024;
/** The largest manifest, measured as the JSON chunk a GLB carries. */
export const GLTF_MANIFEST_MAX_BYTES = 2_000_000;
/** No real manifest nests this deep; a hostile one is stopped before it is parsed. */
export const GLTF_MAX_JSON_DEPTH = 64;
/**
 * The most elements one accessor with no buffer view may declare: three per triangle at
 * the studio's limit of one million triangles, which is the most a mesh it draws can use.
 */
export const GLTF_MAX_UNBACKED_COUNT = 3_000_000;
/** The most memory all accessors with no buffer view may ask for together: 256 MiB. */
export const GLTF_MAX_UNBACKED_BYTES = 8 * MODEL_MAX_BYTES;

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const NOT_A_MODEL = 'Use a self-contained glTF 2.0 binary (.glb) model.';
const BAD_MANIFEST = 'The GLB manifest is invalid or too large.';
const REFUSED_COMPRESSION = [
  'KHR_draco_mesh_compression',
  'EXT_meshopt_compression',
  'KHR_texture_basisu',
];

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
/** A whole number from 0 up to the model limit, or -1. */
function size(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MODEL_MAX_BYTES
    ? value
    : -1;
}

/** True when the bytes open with the GLB magic. */
export function isGlb(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x67 &&
    bytes[1] === 0x6c &&
    bytes[2] === 0x54 &&
    bytes[3] === 0x46
  );
}

/**
 * How deep the brackets of a JSON text nest, read without parsing. The scan stops as soon
 * as the depth passes `limit`, so a file of nothing but opening brackets costs one pass.
 */
export function jsonDepthWithin(bytes: Uint8Array, limit: number): boolean {
  let depth = 0,
    inString = false;
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]!;
    if (inString) {
      if (c === 0x5c) i++;
      else if (c === 0x22) inString = false;
    } else if (c === 0x22) inString = true;
    else if (c === 0x7b || c === 0x5b) {
      if (++depth > limit) return false;
    } else if (c === 0x7d || c === 0x5d) depth--;
  }
  return true;
}

function parseManifest(bytes: Uint8Array, refusal: string): Json {
  if (!jsonDepthWithin(bytes, GLTF_MAX_JSON_DEPTH)) throw new Error(refusal);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error(refusal);
  }
  if (!isRecord(json)) throw new Error(refusal);
  return json;
}

/** A URI as it is shown in a refusal: printable, and short enough to read. */
function shownUri(uri: unknown): string {
  const text = String(uri)
    .replace(/[^\x20-\x7e]/g, '')
    .trim();
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

const COMPONENT_BYTES: Record<number, number> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};
const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

/**
 * The checks every manifest gets, whichever container it came in. `external` builds the
 * refusal for a buffer or image that is not embedded.
 */
function inspectManifest(json: Json, external: (uri: unknown) => string): void {
  for (const item of [...list(json.buffers), ...list(json.images)]) {
    if (!isRecord(item)) continue;
    const uri = item.uri;
    if (uri && !(typeof uri === 'string' && uri.startsWith('data:')))
      throw new Error(external(uri));
  }
  if (
    list(json.extensionsRequired).some(
      (name) => typeof name === 'string' && REFUSED_COMPRESSION.includes(name)
    )
  )
    throw new Error('Export this model without Draco, Meshopt or KTX2 compression.');
  // An accessor with no buffer view is one the loader fills with zeros, which allocates
  // whatever the count says. Sparse morph targets are the honest use. A count read from
  // the file is never trusted with that allocation: each is held to what a mesh at the
  // triangle limit can use, and all of them together to a fixed budget.
  let unbacked = 0;
  for (const accessor of list(json.accessors)) {
    if (!isRecord(accessor) || typeof accessor.bufferView === 'number') continue;
    const count = accessor.count;
    const each =
      (COMPONENT_BYTES[accessor.componentType as number] ?? 4) *
      (TYPE_COMPONENTS[accessor.type as string] ?? 16);
    if (typeof count !== 'number' || !(count >= 0 && count <= GLTF_MAX_UNBACKED_COUNT))
      throw new Error(BAD_MANIFEST);
    unbacked += count * each;
    if (unbacked > GLTF_MAX_UNBACKED_BYTES) throw new Error(BAD_MANIFEST);
  }
}

/** Refuse a GLB that is malformed, links outside itself or needs a decoder the studio lacks. */
export function inspectGlb(bytes: Uint8Array): void {
  if (bytes.byteLength < 20) throw new Error('The GLB file is incomplete.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, true) !== GLB_MAGIC ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.length ||
    view.getUint32(16, true) !== JSON_CHUNK
  )
    throw new Error(NOT_A_MODEL);
  const length = view.getUint32(12, true);
  if (length > GLTF_MANIFEST_MAX_BYTES || length + 20 > bytes.length) throw new Error(BAD_MANIFEST);
  inspectManifest(
    parseManifest(bytes.subarray(20, 20 + length), BAD_MANIFEST),
    () => 'This GLB links external files. Embed its textures and buffers before importing.'
  );
}

const BASE64 = (() => {
  const table = new Int16Array(128).fill(-1);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < alphabet.length; i++) table[alphabet.charCodeAt(i)] = i;
  return table;
})();

/** Where the base64 payload of a `data:` URI starts and ends, or null when it has none. */
function base64Span(uri: string): { from: number; to: number; bytes: number } | null {
  // The media type is a few dozen characters; a header longer than this is not one.
  const comma = uri.slice(0, 256).indexOf(',');
  if (!uri.startsWith('data:') || comma < 0) return null;
  if (!/;base64$/i.test(uri.slice(5, comma))) return null;
  const from = comma + 1;
  let to = uri.length;
  while (to > from && to > uri.length - 2 && uri.charCodeAt(to - 1) === 0x3d) to--;
  const chars = to - from;
  if (chars % 4 === 1) return null;
  return { from, to, bytes: Math.floor((chars * 3) / 4) };
}

/** Strict base64: the standard alphabet only, no white space, written straight into `out`. */
function decodeBase64(uri: string, span: { from: number; to: number }, out: Uint8Array): boolean {
  let bits = 0,
    held = 0,
    at = 0;
  for (let i = span.from; i < span.to; i++) {
    const code = uri.charCodeAt(i);
    const value = code < 128 ? BASE64[code]! : -1;
    if (value < 0) return false;
    bits = (bits << 6) | value;
    held += 6;
    if (held >= 8) {
      held -= 8;
      out[at++] = (bits >> held) & 0xff;
    }
  }
  return at === out.length;
}

/** The picture formats the loader decodes from a buffer view, told from the bytes themselves. */
function pictureType(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'image/webp';
  return '';
}

/**
 * A self-contained .gltf as the equivalent .glb. Every embedded buffer and picture moves
 * into one binary chunk and the manifest keeps no URI at all. Throws a plain message for
 * a file that refers outside itself, and for one that is not a valid glTF 2.x manifest.
 */
export function gltfToGlb(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (!bytes.length || bytes.length > MODEL_MAX_BYTES)
    throw new Error('Use a source file between 1 byte and 32 MB.');
  const json = parseManifest(bytes, NOT_A_MODEL);
  if (!isRecord(json.asset) || !/^2\.\d+$/.test(String(json.asset.version)))
    throw new Error(NOT_A_MODEL);
  for (const key of ['buffers', 'bufferViews', 'images', 'accessors'])
    if (json[key] !== undefined && !Array.isArray(json[key])) throw new Error(NOT_A_MODEL);
  inspectManifest(
    json,
    (uri) =>
      `This .gltf refers to a separate file, ${shownUri(uri)}. Export a .glb, which holds everything in one file.`
  );

  // Pass one measures. Nothing is allocated until every declared length agrees with its
  // payload and the total is inside the model limit.
  let total = 0;
  const place = (length: number): number => {
    const at = total;
    total += length + ((4 - (length % 4)) % 4);
    if (total > MODEL_MAX_BYTES) throw new Error('Use a source file between 1 byte and 32 MB.');
    return at;
  };
  const buffers = list(json.buffers).map((buffer) => {
    if (!isRecord(buffer) || typeof buffer.uri !== 'string') throw new Error(NOT_A_MODEL);
    const span = base64Span(buffer.uri),
      declared = size(buffer.byteLength);
    // The payload may carry up to three bytes of padding past the declared length.
    if (!span || declared < 0 || span.bytes < declared || span.bytes - declared > 3)
      throw new Error(NOT_A_MODEL);
    return { uri: buffer.uri, span, declared, at: place(span.bytes) };
  });
  const views: Json[] = list(json.bufferViews).map((view) => {
    if (!isRecord(view)) throw new Error(NOT_A_MODEL);
    const buffer = buffers[typeof view.buffer === 'number' ? view.buffer : -1];
    const offset = view.byteOffset === undefined ? 0 : size(view.byteOffset),
      length = size(view.byteLength);
    if (!buffer || offset < 0 || length < 0 || offset + length > buffer.declared)
      throw new Error(NOT_A_MODEL);
    return { ...view, buffer: 0, byteOffset: buffer.at + offset };
  });
  const authoredViews = views.length;
  const pictures: {
    uri: string;
    span: { from: number; to: number; bytes: number };
    at: number;
    image: Json;
  }[] = [];
  const images = list(json.images).map((image) => {
    if (!isRecord(image)) throw new Error(NOT_A_MODEL);
    if (image.uri === undefined) {
      // A picture already stored in a buffer view stays where it is.
      const index = typeof image.bufferView === 'number' ? image.bufferView : -1;
      if (!Number.isInteger(index) || index < 0 || index >= authoredViews)
        throw new Error(NOT_A_MODEL);
      return image;
    }
    const span = typeof image.uri === 'string' ? base64Span(image.uri) : null;
    if (!span?.bytes) throw new Error(NOT_A_MODEL);
    const at = place(span.bytes);
    views.push({ buffer: 0, byteOffset: at, byteLength: span.bytes });
    const embedded: Json = { ...image, bufferView: views.length - 1 };
    delete embedded.uri;
    pictures.push({ uri: image.uri as string, span, at, image: embedded });
    return embedded;
  });

  // Pass two decodes into one allocation of the measured size.
  const bin = new Uint8Array(total);
  for (const item of [...buffers, ...pictures])
    if (!decodeBase64(item.uri, item.span, bin.subarray(item.at, item.at + item.span.bytes)))
      throw new Error(NOT_A_MODEL);
  // The picture's type is read from its bytes, never from the label the file gave.
  for (const picture of pictures) {
    const mimeType = pictureType(bin.subarray(picture.at, picture.at + picture.span.bytes));
    if (!mimeType) throw new Error(NOT_A_MODEL);
    picture.image.mimeType = mimeType;
  }

  const manifest: Json = { ...json };
  if (total) manifest.buffers = [{ byteLength: total }];
  else delete manifest.buffers;
  if (views.length) manifest.bufferViews = views;
  if (images.length) manifest.images = images;
  let text: Uint8Array;
  try {
    text = new TextEncoder().encode(JSON.stringify(manifest));
  } catch {
    throw new Error(BAD_MANIFEST);
  }
  if (text.length > GLTF_MANIFEST_MAX_BYTES) throw new Error(BAD_MANIFEST);
  const jsonLength = text.length + ((4 - (text.length % 4)) % 4);
  const length = 12 + 8 + jsonLength + (total ? 8 + total : 0);
  if (length > MODEL_MAX_BYTES) throw new Error('Use a source file between 1 byte and 32 MB.');
  const out = new Uint8Array(length);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, length, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, JSON_CHUNK, true);
  out.fill(0x20, 20, 20 + jsonLength);
  out.set(text, 20);
  if (total) {
    view.setUint32(20 + jsonLength, total, true);
    view.setUint32(24 + jsonLength, BIN_CHUNK, true);
    out.set(bin, 28 + jsonLength);
  }
  return out;
}

/**
 * The inspected .glb for a model file in either container. A .glb comes back as it was
 * handed in; a file that opens as JSON is read as a self-contained .gltf and comes back
 * converted. Both have passed `inspectGlb`.
 */
export function inspectedGlb(bytes: Uint8Array): Uint8Array {
  let at = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  while (at < bytes.length && at < 64 && [0x20, 0x09, 0x0a, 0x0d].includes(bytes[at]!)) at++;
  const glb = !isGlb(bytes) && bytes[at] === 0x7b ? gltfToGlb(bytes) : bytes;
  inspectGlb(glb);
  return glb;
}

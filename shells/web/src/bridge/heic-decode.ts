// SPDX-License-Identifier: MPL-2.0
/**
 * HEIC/HEIF decode fallback for user uploads (web shell).
 *
 * iPhones shoot HEIC by default, but only Safari's `createImageBitmap` decodes it - 
 * Chrome and Firefox can't. When a native decode fails on a HEIC-looking file, we
 * fall back to a bundled libheif (via `heic-to`) so the photo still comes in.
 *
 * The decoder is HEAVY (~3 MB of inlined WASM), so it's DYNAMICALLY imported - pulled
 * only the first time someone actually uploads a HEIC, never in the initial bundle.
 * We use heic-to's CSP-safe build (WASM inlined, no `eval`, no CDN fetch) so the app
 * stays self-contained.
 */

// ISOBMFF 'ftyp' major/compatible brands that mean "HEIF-family still image".
const HEIF_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevm', 'hevs', 'mif1', 'msf1']);

let _heicToP: Promise<typeof import('heic-to/csp')> | null = null;
function loadHeicTo(): Promise<typeof import('heic-to/csp')> {
  // One shared module (and WASM instance) across every upload this session.
  return (_heicToP ??= import('heic-to/csp'));
}

/**
 * Cheap, dependency-free sniff: is this a HEIC/HEIF file? Runs on the decode-error
 * path only, to decide whether pulling the 3 MB decoder is worthwhile - so it must
 * NOT load heic-to. Checks name/MIME first, then the ISOBMFF 'ftyp' brand in the
 * header bytes (authoritative when the OS drops the extension/MIME).
 *
 * @param {Blob & {name?: string}} file
 * @returns {Promise<boolean>}
 */
export async function looksLikeHeic(file: Blob & { name?: string }): Promise<boolean> {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  if (/\.(heic|heif|hif)$/.test(name) || /hei[cf]/.test(type)) return true;
  try {
    const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    // bytes 4..8 == 'ftyp', bytes 8..12 == a HEIF-family brand.
    if (buf.length < 12 || buf[4] !== 0x66 || buf[5] !== 0x74 || buf[6] !== 0x79 || buf[7] !== 0x70) return false;
    return HEIF_BRANDS.has(String.fromCharCode(buf[8]!, buf[9]!, buf[10]!, buf[11]!));
  } catch {
    return false;
  }
}

/**
 * Decode a HEIC/HEIF file to an ImageBitmap (rotation baked in), matching the shape
 * the native `createImageBitmap` path returns so callers are otherwise unchanged.
 * Rejects if the file isn't decodable HEIF.
 *
 * @param {Blob} file
 * @returns {Promise<ImageBitmap>}
 */
export async function decodeHeicBitmap(file: Blob): Promise<ImageBitmap> {
  const { heicTo } = await loadHeicTo();
  return heicTo({ blob: file, type: 'bitmap', options: { imageOrientation: 'from-image' } });
}

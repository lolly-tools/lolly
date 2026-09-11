// SPDX-License-Identifier: MPL-2.0
/**
 * Font file utilities: metadata extraction, validation, format detection.
 * Supports TTF, OTF, WOFF, WOFF2 with minimal footprint.
 */

export interface FontMetadata {
  family: string;
  weight: number;
  style: 'normal' | 'italic' | 'oblique';
  unicodeRange?: string;
}

export type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2' | 'unknown';

/**
 * What a font's OWN `OS/2.fsType` says about embedding and reuse.
 *
 * This is the font vendor's machine-readable statement of intent, and it is the
 * only licence signal a font file carries. It is NOT the licence - a permissive
 * fsType does not grant rights the actual EULA withholds - but a restrictive one
 * is an unambiguous "no", and it is the thing to show anyone about to pull a font
 * out of a document they were merely sent.
 *
 * Bits 0–3 are a small exclusive set (section OS/2 fsType); bits 8 and 9 are separate
 * flags that ride alongside.
 */
export type FontEmbedding =
  | 'installable'   // 0x0000 - no restriction stated
  | 'restricted'    // 0x0002 - must not be embedded or reused at all
  | 'preview-print' // 0x0004 - may be embedded to view/print, not to edit
  | 'editable'      // 0x0008 - may be embedded for editing too
  | 'unknown';      // no OS/2 table (Type1 / bare CFF), so nothing is stated

export interface FontEmbeddingInfo {
  permission: FontEmbedding;
  /** Bit 8 - the vendor forbids subsetting. */
  noSubsetting: boolean;
  /** Bit 9 - only a bitmap may be embedded, never outlines. */
  bitmapOnly: boolean;
  /** The raw value, so a report can be audited rather than trusted. */
  fsType: number | null;
}

/**
 * Read `OS/2.fsType`. Returns `permission: 'unknown'` when the font states
 * nothing - a Type1 or bare-CFF program has no OS/2 table at all, and absence of
 * a restriction is not the same as permission.
 */
export function readFontEmbedding(buffer: ArrayBuffer): FontEmbeddingInfo {
  const none: FontEmbeddingInfo = { permission: 'unknown', noSubsetting: false, bitmapOnly: false, fsType: null };
  try {
    const format = detectFontFormat(buffer);
    if (format !== 'ttf' && format !== 'otf') return none;
    const view = new DataView(buffer);
    if (buffer.byteLength < 12) return none;

    const numTables = view.getUint16(4, false);
    let os2 = 0;
    for (let i = 0, off = 12; i < numTables && off + 16 <= buffer.byteLength; i++, off += 16) {
      if (readTag(view, off) === 'OS/2') { os2 = view.getUint32(off + 8, false); break; }
    }
    // fsType is a uint16 at OS/2 offset 8: version(2) + xAvgCharWidth(2) +
    // usWeightClass(2) + usWidthClass(2).
    if (!os2 || os2 + 10 > buffer.byteLength) return none;
    const fsType = view.getUint16(os2 + 8, false);

    const bits = fsType & 0x000f;
    const permission: FontEmbedding =
      bits === 0 ? 'installable'
        : bits & 0x0002 ? 'restricted'
          : bits & 0x0004 ? 'preview-print'
            : bits & 0x0008 ? 'editable'
              : 'unknown';

    return { permission, noSubsetting: !!(fsType & 0x0100), bitmapOnly: !!(fsType & 0x0200), fsType };
  } catch { return none; }
}

/**
 * Detect font file format by magic bytes.
 */
export function detectFontFormat(buffer: ArrayBuffer): FontFormat {
  const view = new Uint8Array(buffer);
  if (view.length < 4) return 'unknown';

  const magic = ((view[0] ?? 0) << 24) | ((view[1] ?? 0) << 16) | ((view[2] ?? 0) << 8) | (view[3] ?? 0);

  // TTF: 0x00010000 or 'true'
  if (magic === 0x00010000 || magic === 0x74727565) return 'ttf';
  // OTF: 'OTTO'
  if (magic === 0x4f54544f) return 'otf';
  // WOFF: 'wOFF'
  if (magic === 0x774f4646) return 'woff';
  // WOFF2: 'wOF2'
  if (magic === 0x774f4632) return 'woff2';

  return 'unknown';
}

/**
 * Parse font metadata from TTF/OTF (TrueType/CFF outline) files.
 * Extracts family name, weight, style from name table and OS/2 table.
 */
export function parseFontMetadata(buffer: ArrayBuffer): FontMetadata | null {
  try {
    const view = new DataView(buffer);
    const format = detectFontFormat(buffer);

    if (format !== 'ttf' && format !== 'otf') return null;

    // TrueType/OTF structure: scaler type (4 bytes) + num tables (2) + search params (6)
    if (buffer.byteLength < 12) return null;

    const numTables = view.getUint16(4, false);
    let offset = 12;

    // Find 'name' and 'OS/2' tables
    let nameTableOffset = 0;
    let os2TableOffset = 0;

    for (let i = 0; i < numTables && offset + 16 <= buffer.byteLength; i++) {
      const tag = readTag(view, offset);
      const tableOffset = view.getUint32(offset + 8, false);

      if (tag === 'name') nameTableOffset = tableOffset;
      if (tag === 'OS/2') os2TableOffset = tableOffset;

      offset += 16;
    }

    if (!nameTableOffset) return null;

    // Extract family name from name table
    const family = extractFamilyName(view, nameTableOffset);
    const weight = os2TableOffset ? extractWeight(view, os2TableOffset) : 400;
    const style = extractStyle(view, nameTableOffset);

    return { family, weight, style };
  } catch {
    return null;
  }
}

function readTag(view: DataView, offset: number): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, 4);
  return String.fromCharCode(...bytes);
}

function extractFamilyName(view: DataView, nameTableOffset: number): string {
  try {
    // Name table: format (2) + count (2) + stringOffset (2)
    if (nameTableOffset + 6 > view.byteLength) return 'Unknown';

    const count = view.getUint16(nameTableOffset + 2, false);
    const stringOffset = view.getUint16(nameTableOffset + 4, false);

    let offset = nameTableOffset + 6;

    // Name ID 16 (Typographic Family) preferred, fallback to 1 (Family Name).
    // Both must be collected before choosing: name records are ordered by nameId,
    // so 1 is always encountered first and returning on first match would make the
    // preference unreachable. It matters for variable fonts - Outfit[wght].ttf has
    // nameId 1 = "Outfit Thin" (legacy, tied to the default instance) but nameId 16
    // = "Outfit", and only the latter groups every weight under one family. Getting
    // this wrong mislabels the Fonts tab, slugs the asset id "outfit-thin", and makes
    // font-registry miss a `font-family: Outfit` stack.
    let preferred = '';
    let legacy = '';

    for (let i = 0; i < count && offset + 12 <= view.byteLength; i++) {
      const platformId = view.getUint16(offset, false);
      const encodingId = view.getUint16(offset + 2, false);
      const nameId = view.getUint16(offset + 6, false);
      const length = view.getUint16(offset + 8, false);
      const stringOffset_ = view.getUint16(offset + 10, false);

      offset += 12;

      if (nameId !== 16 && nameId !== 1) continue;

      const strOffset = nameTableOffset + stringOffset + stringOffset_;

      // Support Unicode (platformId 3, encodingId 1) and Mac (platformId 1, encodingId 0)
      if ((platformId === 3 && encodingId === 1) || (platformId === 1 && encodingId === 0)) {
        const str = readString(view, strOffset, length, platformId === 3);
        if (!str) continue;
        // First record wins per id, so the Windows/Unicode entry (which sorts ahead
        // of Mac) keeps the precedence the old first-match loop gave it.
        if (nameId === 16) { if (!preferred) preferred = str; }
        else if (!legacy) legacy = str;
      }
    }

    return preferred || legacy || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function extractWeight(view: DataView, os2TableOffset: number): number {
  try {
    // OS/2 table: usWeightClass at offset 4 (2 bytes)
    if (os2TableOffset + 6 > view.byteLength) return 400;
    return view.getUint16(os2TableOffset + 4, false);
  } catch {
    return 400;
  }
}

function extractStyle(view: DataView, nameTableOffset: number): 'normal' | 'italic' | 'oblique' {
  try {
    // Look for name ID 2 (Subfamily) to detect italic
    const count = view.getUint16(nameTableOffset + 2, false);
    const stringOffset = view.getUint16(nameTableOffset + 4, false);

    let offset = nameTableOffset + 6;

    for (let i = 0; i < count && offset + 12 <= view.byteLength; i++) {
      const nameId = view.getUint16(offset + 6, false);
      const length = view.getUint16(offset + 8, false);
      const stringOffset_ = view.getUint16(offset + 10, false);
      const platformId = view.getUint16(offset, false);

      if (nameId === 2 && ((platformId === 3) || (platformId === 1))) {
        const strOffset = nameTableOffset + stringOffset + stringOffset_;
        const str = readString(view, strOffset, length, platformId === 3);
        if (str?.toLowerCase().includes('italic')) return 'italic';
        if (str?.toLowerCase().includes('oblique')) return 'oblique';
      }

      offset += 12;
    }

    return 'normal';
  } catch {
    return 'normal';
  }
}

function readString(view: DataView, offset: number, length: number, isUnicode: boolean): string {
  try {
    if (offset + length > view.byteLength) return '';

    const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);

    if (isUnicode) {
      // UTF-16 BE
      let str = '';
      for (let i = 0; i < bytes.length; i += 2) {
        const code = (bytes[i]! << 8) | bytes[i + 1]!;
        if (code > 0) str += String.fromCharCode(code);
      }
      return str;
    } else {
      // Mac Roman / ASCII
      return String.fromCharCode(...Array.from(bytes));
    }
  } catch {
    return '';
  }
}

/**
 * Validate uploaded font file.
 */
export function validateFontFile(file: File): { valid: boolean; error?: string; format?: FontFormat } {
  // Size check: max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: 'Font file must be smaller than 5MB' };
  }

  // MIME type check (permissive, will validate by magic bytes)
  const validMimes = ['application/octet-stream', 'font/ttf', 'font/otf', 'application/font-woff', 'application/font-woff2'];
  if (file.type && !validMimes.includes(file.type) && !file.type.startsWith('font/')) {
    return { valid: false, error: 'Invalid font file type' };
  }

  return { valid: true };
}

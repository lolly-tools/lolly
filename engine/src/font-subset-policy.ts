// SPDX-License-Identifier: MPL-2.0
/**
 * Whether a font's own tables permit glyph subsetting, read straight off the sfnt
 * directory with no imports, so the Skera worker runtime can enforce it too.
 *
 * Two things can refuse a subset. The outlines: the pinned Skera build subsets
 * TrueType `glyf` outlines and silently drops a `CFF `/`CFF2` table it does not
 * know, which would leave a font with no outlines at all, so anything other than
 * TrueType is refused rather than damaged. And the font's own `OS/2.fsType`
 * statement: restricted licence embedding (bit 1), no subsetting (bit 8) and
 * bitmap embedding only (bit 9) each refuse, and a font with no OS/2 table states
 * nothing, which is not the same as permission. Preview and print (bit 2) and
 * editable (bit 3) embedding permit a subset. When bits 1 to 3 are combined in an
 * older font, the most restrictive one is honoured, matching
 * shells/web/src/lib/font-utils.ts.
 *
 * fsType is the only licence signal a font file carries. It is not the licence:
 * a permissive value grants nothing the EULA withholds, so a subset is never a
 * rights grant, only the absence of a stated refusal.
 */

/** Why a subset is refused. See {@link FONT_SUBSET_REFUSALS} for the wording. */
export type FontSubsetRefusal = 'outlines' | 'restricted' | 'no-subsetting' | 'bitmap-only' | 'unstated';

/** What `OS/2.fsType` says, decoded. `unstated`: there is no OS/2 table. */
export type FontEmbeddingPermission = 'installable' | 'restricted' | 'preview-print' | 'editable' | 'unstated';

export interface FontEmbeddingFlags {
  permission: FontEmbeddingPermission;
  noSubsetting: boolean;
  bitmapOnly: boolean;
  fsType: number | null;
}

export type FontOutlines = 'truetype' | 'cff' | 'cff2' | 'bitmap' | 'none';

/** Plain-English reasons, shown to people and carried on refusal errors. */
export const FONT_SUBSET_REFUSALS: Readonly<Record<FontSubsetRefusal, string>> = {
  outlines: 'Subsetting works on TrueType outlines only. This font keeps its outlines in another format, so it is not subset.',
  restricted: 'This font says it must not be embedded or changed (restricted licence embedding), so it is not subset.',
  'no-subsetting': 'This font says it must not be subset, so it is not subset.',
  'bitmap-only': 'This font allows only bitmap embedding, so its outlines are not subset.',
  unstated: 'This font states no embedding permission (it has no OS/2 table), so it is not subset.',
};

/** One table's position, checked to lie inside the file. */
export interface SfntTable { off: number; len: number }

export interface SfntDirectory {
  flavor: number;
  tables: Map<string, SfntTable>;
}

const SFNT_TRUETYPE = 0x00010000;
const SFNT_TRUE = 0x74727565;
const SFNT_OTTO = 0x4f54544f;

/**
 * Read a plain sfnt's table directory. Null for anything else (WOFF, a
 * collection, a truncated file). Tables that run past the end are left out.
 */
export function readSfntDirectory(bytes: Uint8Array): SfntDirectory | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flavor = view.getUint32(0);
  if (flavor !== SFNT_TRUETYPE && flavor !== SFNT_TRUE && flavor !== SFNT_OTTO) return null;
  const count = view.getUint16(4);
  if (12 + count * 16 > bytes.length) return null;
  const tables = new Map<string, SfntTable>();
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
    const off = view.getUint32(at + 8);
    const len = view.getUint32(at + 12);
    if (off + len <= bytes.length && !tables.has(tag)) tables.set(tag, { off, len });
  }
  return { flavor, tables };
}

/** Where the outlines live, from the flavour and the tables actually present. */
export function sfntOutlines(directory: SfntDirectory): FontOutlines {
  const { flavor, tables } = directory;
  if (flavor !== SFNT_OTTO && tables.has('glyf') && tables.has('loca')) return 'truetype';
  if (tables.has('CFF2')) return 'cff2';
  if (tables.has('CFF ')) return 'cff';
  if (tables.has('CBDT') || tables.has('EBDT') || tables.has('sbix')) return 'bitmap';
  return 'none';
}

/** Decode `OS/2.fsType`, a uint16 at offset 8 of the OS/2 table. */
export function readEmbeddingFlags(bytes: Uint8Array, directory: SfntDirectory): FontEmbeddingFlags {
  const os2 = directory.tables.get('OS/2');
  if (!os2 || os2.len < 10) return { permission: 'unstated', noSubsetting: false, bitmapOnly: false, fsType: null };
  const fsType = (bytes[os2.off + 8]! << 8) | bytes[os2.off + 9]!;
  const bits = fsType & 0x000f;
  const permission: FontEmbeddingPermission = bits === 0 ? 'installable'
    : bits & 0x0002 ? 'restricted'
      : bits & 0x0004 ? 'preview-print'
        : bits & 0x0008 ? 'editable'
          : 'restricted';
  return { permission, noSubsetting: (fsType & 0x0100) !== 0, bitmapOnly: (fsType & 0x0200) !== 0, fsType };
}

/** The refusal for given outlines and flags, or null when a subset is permitted. */
export function subsetRefusalFor(outlines: FontOutlines, flags: FontEmbeddingFlags): FontSubsetRefusal | null {
  if (outlines !== 'truetype') return 'outlines';
  if (flags.permission === 'unstated') return 'unstated';
  if (flags.permission === 'restricted') return 'restricted';
  if (flags.noSubsetting) return 'no-subsetting';
  if (flags.bitmapOnly) return 'bitmap-only';
  return null;
}

/**
 * The refusal for a plain sfnt, null when permitted, or `unreadable` when the
 * bytes are not an sfnt at all (the caller's parser rejects those itself).
 */
export function fontSubsetRefusal(bytes: Uint8Array): FontSubsetRefusal | 'unreadable' | null {
  const directory = readSfntDirectory(bytes);
  if (!directory) return 'unreadable';
  return subsetRefusalFor(sfntOutlines(directory), readEmbeddingFlags(bytes, directory));
}

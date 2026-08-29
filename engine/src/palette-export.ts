// SPDX-License-Identifier: MPL-2.0
/**
 * Palette exchange - serialise a flat list of named colours as a standalone file
 * in one of several interchange formats: a DTCG design-tokens JSON (nested under
 * each swatch's canonical dotted key), a plain CSS custom-properties block, a set
 * of CSS utility classes (bg/text/border), an SCSS `$var` block, a GIMP .gpl
 * palette (name + 0-255 RGB only, no alpha), or a binary Adobe Swatch Exchange
 * (.ase) file.
 *
 * Pure - no DOM, no host - so a tool reaches it through `host.color.paletteExport`
 * / `paletteExportBytes` (makeColorApi attaches the same code every shell runs)
 * and the web shell's brand editor reaches the same functions through the thin
 * lib/swatch-export.ts adapter, so a downloaded palette is byte-identical whether
 * it came from a tool export or the Swatches panel. Moved here from that adapter
 * at ENGINE 1.108 so web + Worker + CLI + Tauri produce identical bytes.
 */

/** The minimal swatch shape every serializer reads: a canonical dotted key, a
 *  display name, a group label, and a resolved sRGB hex (or '' / an alias - those
 *  are filtered out by `resolved()`). The web shell's richer BrandSwatch and a
 *  tool's own flat rows both structurally satisfy this. */
export interface PaletteSwatch {
  key: string;
  name: string;
  group: string;
  hex: string;
}

interface ResolvedSwatch { key: string; name: string; group: string; hex: string; rgb: [number, number, number] }

const HEX6 = /^#[0-9a-f]{6}$/i;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Only swatches with a resolved literal colour - an unresolved alias or the
 *  empty/"transparent" tile has nothing to export. */
function resolved(swatches: PaletteSwatch[]): ResolvedSwatch[] {
  return swatches
    .filter(s => HEX6.test(s.hex))
    .map(s => ({ key: s.key, name: s.name, group: s.group, hex: s.hex.toLowerCase(), rgb: hexToRgb(s.hex) }));
}

/** A swatch's canonical dotted key ('color.ramp.primary.5') slugged into a safe
 *  CSS identifier / JSON path segment ('color-ramp-primary-5'). Keys come from
 *  the token document's own JSON path, so collisions can't happen. */
function slug(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'swatch';
}

const isPlainObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A DTCG tokens document, colour leaves only, nested by each swatch's dotted key. */
/** Optional non-colour extras a brand tokens export may carry alongside the
 *  palette. `fonts` become DTCG `fontFamilies` tokens under `font.<role>` -
 *  the shape Penpot (>= 2.6) and Tokens Studio import natively, and the same
 *  group/vocabulary the chrome scale uses (font.brand / font.mono), so a
 *  brand's faces travel with its colours instead of staying behind in the app. */
export interface PaletteTokensOpts {
  fonts?: Array<{ role: string; families: string[] }>;
}

export function paletteTokensJson(swatches: PaletteSwatch[], opts?: PaletteTokensOpts): string {
  const root: Record<string, unknown> = {};
  for (const f of opts?.fonts ?? []) {
    if (!f.families.length) continue;
    const font = (root.font ??= {}) as Record<string, unknown>;
    font[f.role] = { $value: f.families, $type: 'fontFamilies' };
  }
  for (const s of resolved(swatches)) {
    const segs = s.key.split('.');
    let node = root;
    for (let i = 0; i < segs.length - 1; i++) {
      const seg = segs[i]!;
      if (!isPlainObj(node[seg])) node[seg] = {};
      node = node[seg] as Record<string, unknown>;
    }
    node[segs[segs.length - 1]!] = { $value: s.hex, $type: 'color', $description: s.name };
  }
  return JSON.stringify(root, null, 2) + '\n';
}

/** `:root { --color-ramp-primary-5: #...; }` - one custom property per swatch. */
export function paletteCssVariables(swatches: PaletteSwatch[]): string {
  const lines = resolved(swatches).map(s => `  --${slug(s.key)}: ${s.hex};`);
  return `:root {\n${lines.join('\n')}\n}\n`;
}

/** bg/text/border utility classes, one triad per swatch. */
export function paletteCssClasses(swatches: PaletteSwatch[]): string {
  const blocks = resolved(swatches).flatMap(s => {
    const c = slug(s.key);
    return [
      `.bg-${c} { background-color: ${s.hex}; }`,
      `.text-${c} { color: ${s.hex}; }`,
      `.border-${c} { border-color: ${s.hex}; }`,
    ];
  });
  return blocks.join('\n') + '\n';
}

/** `$color-ramp-primary-5: #...;` - one Sass variable per swatch. */
export function paletteScssVariables(swatches: PaletteSwatch[]): string {
  const lines = resolved(swatches).map(s => `$${slug(s.key)}: ${s.hex};`);
  return lines.join('\n') + '\n';
}

/** GIMP palette (.gpl) - name + space-padded 0-255 RGB triples, tab, then a
 *  human label. GPL carries no alpha and no colour-space metadata. */
export function paletteGpl(swatches: PaletteSwatch[], paletteName = 'Lolly brand'): string {
  const pad = (n: number): string => String(n).padStart(3, ' ');
  const rows = resolved(swatches).map(s => `${pad(s.rgb[0])} ${pad(s.rgb[1])} ${pad(s.rgb[2])}\t${s.group} ${s.name}`);
  return `GIMP Palette\nName: ${paletteName}\nColumns: 0\n#\n${rows.join('\n')}\n`;
}

// ── Adobe Swatch Exchange (.ase) - binary ───────────────────────────────────
// Spec (unofficial but widely implemented): 'ASEF' signature, u16 version major/minor,
// u32 block count, then N blocks. A colour-entry block: u16 type (0x0001), u32 data
// length (of everything after this field), u16 name length (UTF-16 code units,
// INCLUDING the null terminator), the UTF-16BE name itself, a 4-byte ASCII colour
// model ('RGB ' - space-padded to 4 chars), the channel values as big-endian
// float32 in 0..1, and a u16 colour type (0 Global / 1 Spot / 2 Normal).

function utf16beNameBytes(name: string): Uint8Array {
  const withNull = `${name}\u0000`;
  const out = new Uint8Array(withNull.length * 2);
  for (let i = 0; i < withNull.length; i++) {
    const code = withNull.charCodeAt(i);
    out[i * 2] = (code >> 8) & 0xff;
    out[i * 2 + 1] = code & 0xff;
  }
  return out;
}

function colorEntryBlock(name: string, rgb: [number, number, number]): Uint8Array {
  const nameBytes = utf16beNameBytes(name.slice(0, 255));
  const nameUnits = nameBytes.length / 2;
  const dataLen = 2 + nameBytes.length + 4 + 12 + 2; // nameLen + name + model + 3 floats + colour type
  const block = new Uint8Array(2 + 4 + dataLen);
  const dv = new DataView(block.buffer);
  let o = 0;
  dv.setUint16(o, 0x0001, false); o += 2;       // block type: colour entry
  dv.setUint32(o, dataLen, false); o += 4;      // length of everything below
  dv.setUint16(o, nameUnits, false); o += 2;
  block.set(nameBytes, o); o += nameBytes.length;
  block.set([0x52, 0x47, 0x42, 0x20], o); o += 4; // 'RGB '
  dv.setFloat32(o, rgb[0] / 255, false); o += 4;
  dv.setFloat32(o, rgb[1] / 255, false); o += 4;
  dv.setFloat32(o, rgb[2] / 255, false); o += 4;
  dv.setUint16(o, 2, false); o += 2;            // colour type: Normal
  return block;
}

/** Adobe Swatch Exchange - readable by Illustrator, Photoshop, Affinity, etc. */
export function paletteAse(swatches: PaletteSwatch[]): Uint8Array {
  const blocks = resolved(swatches).map(s => colorEntryBlock(`${s.group} ${s.name}`, s.rgb));
  const headerLen = 4 + 2 + 2 + 4;
  const total = headerLen + blocks.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  out.set([0x41, 0x53, 0x45, 0x46], 0); // 'ASEF'
  const dv = new DataView(out.buffer);
  dv.setUint16(4, 1, false);  // version major
  dv.setUint16(6, 0, false);  // version minor
  dv.setUint32(8, blocks.length, false);
  let pos = headerLen;
  for (const b of blocks) { out.set(b, pos); pos += b.length; }
  return out;
}

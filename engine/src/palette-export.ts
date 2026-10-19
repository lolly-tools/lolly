// SPDX-License-Identifier: MPL-2.0
/**
 * Palette exchange - serialise a flat list of named colours as a standalone file
 * in one of several interchange formats: a DTCG design-tokens JSON (nested under
 * each swatch's canonical dotted key), a plain CSS custom-properties block, a set
 * of CSS utility classes (bg/text/border), an SCSS `$var` block, a GIMP .gpl
 * palette (name + 0-255 RGB only, no alpha), or a binary Adobe Swatch Exchange
 * (.ase) file.
 *
 * What each format carries beyond the sRGB hex (v1.281). A swatch may say what it
 * was authored as (`css`) and what it is locked to on press (`cmyk`, `spot`); each
 * format keeps what it has room for and nothing it would have to invent:
 *
 *   - CSS variables and CSS classes write a colour wider than sRGB beside its hex,
 *     so a browser that can show it does and one that cannot keeps the hex.
 *   - DTCG JSON keeps the hex as `$value` (what Penpot and Tokens Studio import)
 *     and puts the wider colour, the CMYK build and the spot ink under Lolly's
 *     own `$extensions` namespace, which other importers ignore by the spec and
 *     Lolly reads back as faces and print locks.
 *   - Adobe .ase writes a CMYK lock as a CMYK swatch, a spot lock as a Spot
 *     swatch under the ink's own name, and a wider colour as Lab, which reaches
 *     past every screen gamut.
 *   - SCSS and GIMP .gpl stay sRGB: Sass colour maths and the .gpl format both
 *     take sRGB, so they write the hex.
 *
 * With none of the three fields set, every format writes exactly the bytes it
 * wrote before.
 *
 * Pure - no DOM, no host - so a tool reaches it through `host.color.paletteExport`
 * / `paletteExportBytes` (makeColorApi attaches the same code every shell runs)
 * and the web shell's brand editor reaches the same functions through the thin
 * lib/swatch-export.ts adapter, so a downloaded palette is byte-identical whether
 * it came from a tool export or the Swatches panel. Moved here from that adapter
 * at ENGINE 1.108 so web + Worker + CLI + Tauri produce identical bytes.
 */

import { convertColor, formatColor, parseColor } from './css-color.ts';
import { describeColor } from './color-describe.ts';
import { TOKEN_EXT } from './token-ext.ts';

/** A spot ink locked onto a swatch: the ink's name, its book, and the tactile
 *  finish it is when it is not an ink at all. */
export interface PaletteSpot {
  name: string;
  book?: string;
  finish?: string;
}

/** The minimal swatch shape every serializer reads: a canonical dotted key, a
 *  display name, a group label, and a resolved sRGB hex (or '' / an alias - those
 *  are filtered out by `resolved()`). The web shell's richer BrandSwatch and a
 *  tool's own flat rows both structurally satisfy this. */
export interface PaletteSwatch {
  key: string;
  name: string;
  group: string;
  hex: string;
  /** (v1.281) The colour as authored, in any CSS colour notation. Only a colour
   *  that reaches past sRGB is written anywhere, and only by the formats that can
   *  hold one (see the module header); a value that does not parse is ignored. */
  css?: string | null;
  /** (v1.281) A locked CMYK build, four percentages 0-100. */
  cmyk?: readonly number[] | null;
  /** (v1.281) A locked spot ink. */
  spot?: PaletteSpot | null;
}

/** A colour wider than sRGB: the value to write, the face it belongs to, and its
 *  Lab (D50), which is how .ase holds a colour no RGB model can. */
interface WideColour { css: string; face: 'display-p3' | 'rec2020'; lab: [number, number, number] }

interface ResolvedSwatch {
  key: string; name: string; group: string; hex: string; rgb: [number, number, number];
  wide: WideColour | null;
  cmyk: [number, number, number, number] | null;
  spot: PaletteSpot | null;
}

const HEX6 = /^#[0-9a-f]{6}$/i;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** The authored colour when it reaches past sRGB, re-serialised by the engine's
 *  own parser so nothing but a colour reaches a stylesheet; null otherwise. */
function wideColour(css: string | null | undefined): WideColour | null {
  if (!css) return null;
  const parsed = parseColor(css);
  if (!parsed) return null;
  const gamut = describeColor(css)?.gamut;
  if (!gamut || gamut === 'srgb') return null;
  const [l, a, b] = convertColor(parsed, 'lab').components as [number, number, number];
  return { css: formatColor(parsed), face: gamut === 'p3' ? 'display-p3' : 'rec2020', lab: [l, a, b] };
}

/** Four finite percentages, clamped to 0-100, or null. */
function cmykOf(v: readonly number[] | null | undefined): [number, number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(n => typeof n === 'number' && Number.isFinite(n))) return null;
  return v.map(n => Math.min(100, Math.max(0, n))) as [number, number, number, number];
}

function spotOf(v: PaletteSpot | null | undefined): PaletteSpot | null {
  if (!v || typeof v.name !== 'string' || !v.name.trim()) return null;
  return {
    name: v.name.trim(),
    ...(typeof v.book === 'string' && v.book ? { book: v.book } : {}),
    ...(typeof v.finish === 'string' && v.finish ? { finish: v.finish } : {}),
  };
}

/** Only swatches with a resolved literal colour - an unresolved alias or the
 *  empty/"transparent" tile has nothing to export. */
function resolved(swatches: PaletteSwatch[]): ResolvedSwatch[] {
  return swatches
    .filter(s => HEX6.test(s.hex))
    .map(s => ({
      key: s.key, name: s.name, group: s.group, hex: s.hex.toLowerCase(), rgb: hexToRgb(s.hex),
      wide: wideColour(s.css), cmyk: cmykOf(s.cmyk), spot: spotOf(s.spot),
    }));
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
    const ext: Record<string, unknown> = {
      ...(s.cmyk ? { cmyk: s.cmyk } : {}),
      ...(s.spot ? { spot: s.spot } : {}),
      ...(s.wide ? { faces: { [s.wide.face]: { value: s.wide.css } } } : {}),
    };
    node[segs[segs.length - 1]!] = {
      $value: s.hex, $type: 'color', $description: s.name,
      ...(Object.keys(ext).length ? { $extensions: { [TOKEN_EXT]: ext } } : {}),
    };
  }
  return JSON.stringify(root, null, 2) + '\n';
}

/** The notation a wide colour is written in (`oklch(`, `color(display-p3`), so
 *  colours that need the same browser support share one `@supports` block. */
const notationOf = (css: string): string => /^[a-z-]+\((?:[a-z0-9-]+)?/i.exec(css)?.[0] ?? css;

/** `:root { --color-ramp-primary-5: #...; }` - one custom property per swatch.
 *  A colour wider than sRGB is set again inside an `@supports` block that tests
 *  its own notation: a custom property holding a value the browser cannot parse
 *  breaks where it is used rather than falling back, so the override must only
 *  apply in a browser that reads that notation. */
export function paletteCssVariables(swatches: PaletteSwatch[]): string {
  const rows = resolved(swatches);
  const lines = rows.map(s => `  --${slug(s.key)}: ${s.hex};`);
  const byNotation = new Map<string, ResolvedSwatch[]>();
  for (const s of rows) {
    if (!s.wide) continue;
    const key = notationOf(s.wide.css);
    byNotation.set(key, [...(byNotation.get(key) ?? []), s]);
  }
  const blocks = [...byNotation.values()].map(group =>
    `@supports (color: ${group[0]!.wide!.css}) {\n  :root {\n${group.map(s => `    --${slug(s.key)}: ${s.wide!.css};`).join('\n')}\n  }\n}\n`);
  return `:root {\n${lines.join('\n')}\n}\n${blocks.join('')}`;
}

/** bg/text/border utility classes, one triad per swatch. */
export function paletteCssClasses(swatches: PaletteSwatch[]): string {
  const blocks = resolved(swatches).flatMap(s => {
    const c = slug(s.key);
    // A wider colour is declared second: a browser that cannot parse it drops the
    // declaration and keeps the hex above, with no @supports needed.
    const v = (prop: string): string => (s.wide ? `${prop}: ${s.hex}; ${prop}: ${s.wide.css};` : `${prop}: ${s.hex};`);
    return [
      `.bg-${c} { ${v('background-color')} }`,
      `.text-${c} { ${v('color')} }`,
      `.border-${c} { ${v('border-color')} }`,
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
// model ('RGB ', 'CMYK' or 'LAB ' - space-padded to 4 chars), the channel values as
// big-endian float32, and a u16 colour type (0 Global / 1 Spot / 2 Normal). RGB and
// CMYK channels run 0..1; Lab is L in 0..1 with a and b as they are (-128..127), the
// layout Adobe's own files use and the published readers (swatch, Krita) expect.
// Lab is D50, as CSS lab() is.

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

type AseModel = 'RGB ' | 'CMYK' | 'LAB ';
/** ASE colour types. */
const ASE_SPOT = 1, ASE_NORMAL = 2;

function colorEntryBlock(name: string, model: AseModel, values: readonly number[], type: number): Uint8Array {
  const nameBytes = utf16beNameBytes(name.slice(0, 255));
  const nameUnits = nameBytes.length / 2;
  const dataLen = 2 + nameBytes.length + 4 + 4 * values.length + 2; // nameLen + name + model + floats + colour type
  const block = new Uint8Array(2 + 4 + dataLen);
  const dv = new DataView(block.buffer);
  let o = 0;
  dv.setUint16(o, 0x0001, false); o += 2;       // block type: colour entry
  dv.setUint32(o, dataLen, false); o += 4;      // length of everything below
  dv.setUint16(o, nameUnits, false); o += 2;
  block.set(nameBytes, o); o += nameBytes.length;
  for (let i = 0; i < 4; i++) block[o + i] = model.charCodeAt(i);
  o += 4;
  for (const v of values) { dv.setFloat32(o, v, false); o += 4; }
  dv.setUint16(o, type, false); o += 2;
  return block;
}

/** One swatch's .ase entry. A spot lock is a Spot swatch under the ink's own name,
 *  which is how Illustrator and InDesign match a spot to a plate, built from its
 *  CMYK lock when there is one and its Lab otherwise. A CMYK lock is a CMYK swatch;
 *  a colour wider than sRGB is Lab; everything else stays RGB. */
function aseEntry(s: ResolvedSwatch): Uint8Array {
  const cmyk = s.cmyk?.map(n => n / 100);
  const lab = (): number[] => {
    const [l, a, b] = s.wide?.lab ?? (convertColor(parseColor(s.hex)!, 'lab').components as [number, number, number]);
    return [l / 100, a, b];
  };
  if (s.spot) return cmyk ? colorEntryBlock(s.spot.name, 'CMYK', cmyk, ASE_SPOT) : colorEntryBlock(s.spot.name, 'LAB ', lab(), ASE_SPOT);
  const name = `${s.group} ${s.name}`;
  if (cmyk) return colorEntryBlock(name, 'CMYK', cmyk, ASE_NORMAL);
  if (s.wide) return colorEntryBlock(name, 'LAB ', lab(), ASE_NORMAL);
  return colorEntryBlock(name, 'RGB ', s.rgb.map(v => v / 255), ASE_NORMAL);
}

/** Adobe Swatch Exchange - readable by Illustrator, Photoshop, Affinity, etc. */
export function paletteAse(swatches: PaletteSwatch[]): Uint8Array {
  const blocks = resolved(swatches).map(aseEntry);
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

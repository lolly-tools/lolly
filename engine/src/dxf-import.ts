// SPDX-License-Identifier: MPL-2.0
/**
 * DXF import: the flat entity list from the shell's tag reader to paths, text and a report.
 *
 * `engine/src/dxf.ts` writes DXF; this module reads DXF files. The engine stays free of WebAssembly:
 * a shell supplies `read` (bytes to {@link DxfRaw}), the way `readXlsx` takes `formatCell`. Lolly's
 * own flattener then does the drawing work: entities become cubic and line subpaths, blocks are
 * expanded to a bounded depth, layers keep their names and colours, and `$INSUNITS` sets the
 * real-world scale reported to the person.
 *
 * Nothing is guessed. A text style that gives a TrueType face keeps that face's name. A style that
 * uses an SHX font, an XREF, a paper-space layout or an entity this importer does not draw is
 * counted in the report instead of being replaced by something plausible.
 *
 * Pure: no DOM, no network, no clock.
 */
import type { PathSegment, SubPath } from './svg-path.ts';
import {
  IDENTITY, type Mat, matApply, matMul, matRotate, matScale, matTranslate, planeOf, mapSubPath, subPathBounds,
  arcSegments, seg, polylineSubPath, catmullRomSubPath, sampleNurbs, nurbsValid, polylineFromPoints,
} from './geom/dxf-geom.ts';

// ---- The reader's output (see packages/node-shell/wasm/dxf/src/read.rs) --------------------

export type Pt3 = [number, number, number];
export interface DxfRawEntity {
  t: 'LINE' | 'ARC' | 'CIRCLE' | 'ELLIPSE' | 'LWPOLYLINE' | 'POLYLINE' | 'SPLINE' | 'TEXT' | 'MTEXT' | 'INSERT';
  l: number;
  c?: number; tc?: number; n?: Pt3;
  p?: Pt3; q?: Pt3; r?: number; a0?: number; a1?: number; k?: number;
  v?: Pt3[]; fit?: Pt3[]; kn?: number[]; deg?: number; cl?: boolean; fl?: number;
  nm?: string; sx?: number; sy?: number; sz?: number; rot?: number; cols?: number; rows?: number; dx?: number; dy?: number;
  tx?: string; h?: number; st?: number; xs?: number; ob?: number; ha?: number; va?: number; wd?: number; gn?: number;
}
export interface DxfRawLayer { n: string; c: number; tc?: number; off?: boolean; fz?: boolean }
export interface DxfRawStyle { n: string; f?: string; b?: string; tt?: string }
export interface DxfRaw {
  v: number;
  fmt: 'ascii' | 'binary';
  acadver: string;
  cp: string;
  /** `$INSUNITS`. */
  u: number;
  /** `$MEASUREMENT`. */
  ms: number;
  ext?: [number, number, number, number];
  tags: number;
  layers: DxfRawLayer[];
  styles: DxfRawStyle[];
  blocks: Array<{ n: string; bx: number; by: number; e: DxfRawEntity[] }>;
  e: DxfRawEntity[];
  paper: { n: number; types: Record<string, number> };
  skipped: Record<string, number>;
  xrefs: Array<{ n: string; path: string }>;
  notes: string[];
}
/** The shell-supplied reader. It throws an Error with a plain message when the file cannot be read. */
export type DxfReader = (bytes: Uint8Array) => DxfRaw;

// ---- Limits --------------------------------------------------------------------------------

export const DXF_LIMITS = {
  /** Block nesting followed when expanding INSERTs. */
  insertDepth: 8,
  /** Entities drawn in all, counting every copy of every block. */
  drawnEntities: 200_000,
  /** Block placements followed, so a tree of empty blocks cannot run unbounded either. */
  placements: 100_000,
  /** Segments kept across the drawing. */
  segments: 2_500_000,
  /** Copies one array INSERT may make. */
  arrayCopies: 10_000,
  /** Longest side of the imported drawing in pixels when no scale is given. */
  fitPx: 2400,
  /** Text items kept. */
  texts: 5000,
} as const;

// ---- Units ---------------------------------------------------------------------------------

/** Metres in one drawing unit for each `$INSUNITS` code. */
const UNIT_TABLE: Record<number, { name: string; metres: number }> = {
  1: { name: 'inches', metres: 0.0254 }, 2: { name: 'feet', metres: 0.3048 }, 3: { name: 'miles', metres: 1609.344 },
  4: { name: 'millimetres', metres: 0.001 }, 5: { name: 'centimetres', metres: 0.01 }, 6: { name: 'metres', metres: 1 },
  7: { name: 'kilometres', metres: 1000 }, 8: { name: 'microinches', metres: 2.54e-8 }, 9: { name: 'mils', metres: 2.54e-5 },
  10: { name: 'yards', metres: 0.9144 }, 11: { name: 'angstroms', metres: 1e-10 }, 12: { name: 'nanometres', metres: 1e-9 },
  13: { name: 'micrometres', metres: 1e-6 }, 14: { name: 'decimetres', metres: 0.1 }, 15: { name: 'decametres', metres: 10 },
  16: { name: 'hectometres', metres: 100 },
};

export interface DxfUnits {
  /** The `$INSUNITS` code as stored. */
  code: number;
  /** False when the file declares no units. */
  declared: boolean;
  name: string;
  metresPerUnit: number;
}

export function dxfUnits(code: number, unitless: 'mm' | 'in' | undefined): DxfUnits {
  const known = UNIT_TABLE[code];
  if (known) return { code, declared: true, name: known.name, metresPerUnit: known.metres };
  // 0 is "unitless". Millimetres are assumed unless the caller says inches, and the report says so.
  return unitless === 'in'
    ? { code, declared: false, name: 'inches', metresPerUnit: 0.0254 }
    : { code, declared: false, name: 'millimetres', metresPerUnit: 0.001 };
}

// ---- Colour --------------------------------------------------------------------------------

const ACI_BASE: Record<number, string> = {
  1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff',
  // 7 is white on a dark screen and black on a light page. The imported page is light.
  7: '#000000', 8: '#808080', 9: '#c0c0c0',
};
const ACI_GREY = ['#333333', '#5b5b5b', '#848484', '#adadad', '#d6d6d6', '#ffffff'];

function hsv(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (n: number) => Math.min(255, Math.floor((n + m) * 255 + 1e-9)).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** The AutoCAD Color Index as a hex colour, or null for an index that is not a colour (0, 256). */
export function aciToHex(index: number): string | null {
  const i = Math.trunc(index);
  if (ACI_BASE[i]) return ACI_BASE[i]!;
  if (i >= 10 && i <= 249) {
    const hue = Math.floor((i - 10) / 10) * 15, k = (i - 10) % 10;
    const s = k % 2 === 0 ? 1 : 0.5, v = [1, 1, 0.65, 0.65, 0.5, 0.5, 0.3, 0.3, 0.15, 0.15][k]!;
    return hsv(hue, s, v);
  }
  if (i >= 250 && i <= 255) return ACI_GREY[i - 250]!;
  return null;
}

function trueHex(tc: number): string { return `#${(tc & 0xffffff).toString(16).padStart(6, '0')}`; }

// ---- Result types --------------------------------------------------------------------------

export interface DxfStroke {
  layer: number;
  color: string;
  subpaths: SubPath[];
}
export interface DxfText {
  layer: number;
  color: string;
  /** Plain text, lines joined with \n. */
  text: string;
  /** Anchor point in output pixels. */
  x: number;
  y: number;
  /** Glyph height in pixels (the DXF text height). */
  height: number;
  /** Clockwise degrees on the page. */
  rotation: number;
  /** Horizontal anchor: 0 left, 1 centre, 2 right. */
  hAnchor: 0 | 1 | 2;
  /** Vertical anchor: 0 baseline, 1 bottom, 2 middle, 3 top. */
  vAnchor: 0 | 1 | 2 | 3;
  /** MTEXT box width in pixels, when the file gives one. */
  width?: number;
  /** Relative width factor of TEXT. */
  widthFactor: number;
  /** The font family the file names. Absent when the file names none that Lolly can set. */
  font?: string;
  /** Where the font name came from: the style's TrueType record, its font file name or an inline code. */
  fontSource?: 'typeface' | 'file' | 'inline';
  /** The SHX font file the style uses, when it uses one. */
  shx?: string;
  style?: string;
}
export interface DxfLayerOut {
  name: string;
  /** Layer colour as hex. */
  color: string;
  hidden: boolean;
  strokes: number;
  texts: number;
}
export interface DxfReport {
  version: string;
  format: 'ascii' | 'binary';
  codePage: string;
  units: DxfUnits;
  /** Output pixels per drawing unit. */
  pxPerUnit: number;
  /** Real-world size of one output pixel in millimetres. */
  mmPerPx: number;
  entitiesRead: number;
  entitiesDrawn: number;
  textItems: number;
  layersImported: string[];
  layersHidden: string[];
  layersFiltered: string[];
  xrefs: Array<{ name: string; path: string; inserted: number }>;
  paperSpace: { count: number; types: Record<string, number> };
  shxFonts: Array<{ file: string; styles: string[]; textItems: number }>;
  /** Text items whose style gives no font at all. */
  unnamedFontTexts: number;
  skipped: Record<string, number>;
  missingBlocks: string[];
  recursiveBlocks: string[];
  truncated: string[];
  notes: string[];
}
export interface DxfImport {
  /** Drawing size in output pixels, margin included. */
  width: number;
  height: number;
  layers: DxfLayerOut[];
  strokes: DxfStroke[];
  texts: DxfText[];
  report: DxfReport;
}

export interface DxfImportOptions {
  /** The shell's reader. */
  read: DxfReader;
  /** Layer names to import. Every visible layer when absent. */
  layers?: readonly string[];
  /** Import layers the file has switched off or frozen. */
  includeHidden?: boolean;
  /** Output pixels per drawing unit. Fit to `fitPx` when absent. */
  pxPerUnit?: number;
  fitPx?: number;
  margin?: number;
  /** How to read a file that declares no units. */
  unitless?: 'mm' | 'in';
}

// ---- Text helpers --------------------------------------------------------------------------

/** %%d, %%p and %%c and the toggles AutoCAD's single-line text uses. */
function percentCodes(s: string): string {
  return s.replace(/%%([dDpPcC%uUoO])|%%(\d{3})/g, (_m, c: string | undefined, num: string | undefined) => {
    if (num) return String.fromCharCode(Number(num));
    switch ((c ?? '').toLowerCase()) {
      case 'd': return '°';
      case 'p': return '±';
      case 'c': return 'Ø';
      case '%': return '%';
      default: return '';
    }
  });
}

export interface MtextPlain { text: string; font?: string; extraFonts: number }

/** MTEXT contents as plain lines. The first inline font is kept; later changes are counted. */
export function plainMtext(raw: string): MtextPlain {
  let out = '';
  let font: string | undefined;
  let extraFonts = 0;
  const s = raw;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === '\\') {
      const nx = s[i + 1];
      if (nx === undefined) break;
      if (nx === 'P' || nx === 'X') { out += '\n'; i++; continue; }
      if (nx === '~') { out += ' '; i++; continue; }
      if (nx === '\\' || nx === '{' || nx === '}') { out += nx; i++; continue; }
      if (nx === 'U' && s[i + 2] === '+' && /^[0-9a-fA-F]{4}$/.test(s.slice(i + 3, i + 7))) {
        out += String.fromCharCode(parseInt(s.slice(i + 3, i + 7), 16));
        i += 6; continue;
      }
      if ('LlOoKk'.includes(nx)) { i++; continue; }
      if (nx === 'S') {
        const end = s.indexOf(';', i);
        if (end > 0) {
          const body = s.slice(i + 2, end).replace(/\\([\\^#/])/g, '$1');
          const m = /^(.*?)[/#^](.*)$/.exec(body);
          out += m ? `${m[1]}/${m[2]}` : body;
          i = end; continue;
        }
      }
      if ('fFCcHhWwQqTtAapP'.includes(nx)) {
        const end = s.indexOf(';', i);
        if (end > 0) {
          if (nx === 'f' || nx === 'F') {
            const name = s.slice(i + 2, end).split('|')[0]!.trim();
            if (name) { if (font === undefined) font = name; else if (font !== name) extraFonts++; }
          }
          i = end; continue;
        }
      }
      continue;
    }
    if (ch === '{' || ch === '}') continue;
    out += ch;
  }
  return { text: percentCodes(out).replace(/\r/g, ''), ...(font ? { font } : {}), extraFonts };
}

/** Drop control characters other than tab and line breaks. */
function stripControls(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) continue;
    out += ch;
  }
  return out;
}

function fontFromFile(file: string): string {
  const base = file.replace(/^.*[\\/]/, '');
  return base.replace(/\.(ttf|ttc|otf|pfb|pfm)$/i, '');
}
const isShxFile = (f: string) => /\.shx$/i.test(f.trim());

// ---- The importer --------------------------------------------------------------------------

interface Ctx {
  raw: DxfRaw;
  layerHidden: boolean[];
  layerColor: string[];
  layerKept: boolean[];
  blocks: Map<string, DxfRaw['blocks'][number]>;
  strokes: Map<string, DxfStroke>;
  texts: Array<{ t: Omit<DxfText, 'x' | 'y' | 'height' | 'width'> & { x: number; y: number; height: number; width?: number }; layer: number }>;
  drawn: number;
  placed: number;
  segments: number;
  report: DxfReport;
  shx: Map<string, { styles: Set<string>; items: number }>;
  xrefInserted: Map<string, number>;
  xrefNames: Set<string>;
  hiddenSeen: Set<number>;
  filteredSeen: Set<number>;
  textOverflow: boolean;
  mtextFontNotes: number;
}

interface Inherit { m: Mat; layer: number | null; color: string | null; chain: string[] }

function pushTruncated(ctx: Ctx, why: string): void {
  if (!ctx.report.truncated.includes(why)) ctx.report.truncated.push(why);
}

function bucket(ctx: Ctx, layer: number, color: string): DxfStroke {
  const key = `${layer}|${color}`;
  let s = ctx.strokes.get(key);
  if (!s) { s = { layer, color, subpaths: [] }; ctx.strokes.set(key, s); }
  return s;
}

function resolveColor(ctx: Ctx, e: DxfRawEntity, layer: number, inherit: Inherit): string | null {
  if (e.tc !== undefined) return trueHex(e.tc);
  const c = e.c;
  if (c !== undefined && c < 0) return null;
  if (c === 0) return inherit.color ?? ctx.layerColor[layer] ?? '#000000';
  if (c !== undefined && c !== 256) return aciToHex(c) ?? ctx.layerColor[layer] ?? '#000000';
  return ctx.layerColor[layer] ?? '#000000';
}

function num(v: number | undefined, d: number): number { return typeof v === 'number' && Number.isFinite(v) ? v : d; }
const BIG = 1e9;
function sane(...vals: Array<number | undefined>): boolean {
  return vals.every((v) => v === undefined || (Number.isFinite(v) && Math.abs(v) < BIG));
}

/** Subpaths in the entity's own plane, already mapped to world x and y. */
function entityPaths(e: DxfRawEntity, ctx: Ctx): SubPath[] {
  const plane = planeOf(e.n);
  const toWorld = (sp: SubPath): SubPath => (e.n ? mapSubPath(sp, plane.m) : sp);
  switch (e.t) {
    case 'LINE': {
      if (!e.p || !e.q || !sane(...e.p, ...e.q)) return [];
      return [{ segments: [seg('M', e.p[0], e.p[1]), seg('L', e.q[0], e.q[1])], closed: false }];
    }
    case 'CIRCLE': {
      if (!e.p || !(num(e.r, 0) > 0) || !sane(...e.p, e.r)) return [];
      return [toWorld({ segments: [seg('M', e.p[0] + e.r!, e.p[1]), ...arcSegments(e.p[0], e.p[1], e.r!, e.r!, 0, 0, Math.PI * 2)], closed: true })];
    }
    case 'ARC': {
      if (!e.p || !(num(e.r, 0) > 0) || !sane(...e.p, e.r, e.a0, e.a1)) return [];
      const a0 = (num(e.a0, 0) * Math.PI) / 180;
      let sweep = ((num(e.a1, 360) - num(e.a0, 0)) * Math.PI) / 180;
      sweep = ((sweep % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (sweep < 1e-9) sweep = Math.PI * 2;
      const sx = e.p[0] + e.r! * Math.cos(a0), sy = e.p[1] + e.r! * Math.sin(a0);
      return [toWorld({ segments: [seg('M', sx, sy), ...arcSegments(e.p[0], e.p[1], e.r!, e.r!, 0, a0, sweep)], closed: false })];
    }
    case 'ELLIPSE': {
      if (!e.p || !e.q || !sane(...e.p, ...e.q, e.k, e.a0, e.a1)) return [];
      const rx = Math.hypot(e.q[0], e.q[1]);
      const ry = rx * Math.min(Math.max(num(e.k, 1), 0), 1);
      if (!(rx > 0) || !(ry > 0)) return [];
      const rot = Math.atan2(e.q[1], e.q[0]);
      let t0 = num(e.a0, 0), t1 = num(e.a1, Math.PI * 2);
      let sweep = t1 - t0;
      sweep = ((sweep % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (sweep < 1e-9) sweep = Math.PI * 2;
      // The parameter runs about the extrusion, so a downward-facing ellipse is traversed clockwise on the plan.
      const flip = e.n !== undefined && e.n[2] < 0;
      if (flip) { t0 = -t0; sweep = -sweep; }
      const cx = e.p[0] + 0, cy = e.p[1] + 0;
      const first = matApply([Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), cx, cy], rx * Math.cos(t0), ry * Math.sin(t0));
      return [{ segments: [seg('M', first[0], first[1]), ...arcSegments(cx, cy, rx, ry, rot, t0, sweep)], closed: Math.abs(sweep) >= Math.PI * 2 - 1e-9 }];
    }
    case 'LWPOLYLINE':
    case 'POLYLINE': {
      const v = e.v ?? [];
      if (v.length < 2 || !v.every((p) => sane(p[0], p[1], p[2]))) return [];
      const verts = v.map((p) => ({ x: p[0], y: p[1], bulge: p[2] }));
      return [toWorld(polylineSubPath(verts, !!e.cl))];
    }
    case 'SPLINE': return splinePaths(e, ctx);
    default: return [];
  }
}

function splinePaths(e: DxfRawEntity, ctx: Ctx): SubPath[] {
  const ctrl = e.v ?? [], fit = e.fit ?? [];
  if (![...ctrl, ...fit].every((p) => sane(p[0], p[1]))) return [];
  const closed = !!e.cl;
  const input = { degree: num(e.deg, 3), points: ctrl, knots: e.kn ?? [] };
  if (ctrl.length >= 2 && nurbsValid(input)) {
    const samples = Math.min(1500, Math.max(32, ctrl.length * 12));
    const pts = sampleNurbs(input, samples);
    if (pts.length >= 2) return [polylineFromPoints(pts, closed)];
  }
  if (fit.length >= 2) return [catmullRomSubPath(fit.map((p) => [p[0], p[1]] as [number, number]), closed)];
  if (ctrl.length >= 2) {
    const msg = 'Some splines had control points that do not describe a curve; they are drawn as straight lines through the control points.';
    if (!ctx.report.notes.includes(msg)) ctx.report.notes.push(msg);
    return [polylineFromPoints(ctrl.map((p) => [p[0], p[1]] as [number, number]), closed)];
  }
  return [];
}

function effectiveLayer(e: DxfRawEntity, inherit: Inherit): number {
  // Entities on layer 0 inside a block take the layer of the INSERT that places them.
  return e.l === 0 && inherit.layer !== null ? inherit.layer : e.l;
}

function layerAllowed(ctx: Ctx, layer: number): boolean {
  if (!ctx.layerKept[layer]) { ctx.filteredSeen.add(layer); return false; }
  if (ctx.layerHidden[layer]) { ctx.hiddenSeen.add(layer); return false; }
  return true;
}

function addStroke(ctx: Ctx, layer: number, color: string, sp: SubPath, m: Mat): void {
  const mapped = m === IDENTITY ? sp : mapSubPath(sp, m);
  if (ctx.segments + mapped.segments.length > DXF_LIMITS.segments) { pushTruncated(ctx, 'The drawing has more line and curve segments than the importer keeps.'); return; }
  ctx.segments += mapped.segments.length;
  bucket(ctx, layer, color).subpaths.push(mapped);
}

function styleInfo(ctx: Ctx, index: number | undefined): { font?: string; source?: 'typeface' | 'file'; shx?: string; name?: string } {
  const st = index === undefined ? undefined : ctx.raw.styles[index];
  if (!st) return {};
  if (st.tt) return { font: st.tt, source: 'typeface', name: st.n };
  const f = (st.f ?? '').trim();
  if (f && isShxFile(f)) return { shx: f, name: st.n };
  if (f) return { font: fontFromFile(f), source: 'file', name: st.n };
  const b = (st.b ?? '').trim();
  if (b && isShxFile(b)) return { shx: b, name: st.n };
  return { name: st.n };
}

function addText(ctx: Ctx, e: DxfRawEntity, layer: number, color: string, inherit: Inherit): void {
  if (!e.p || !e.tx || !sane(...e.p, e.h, e.rot, e.wd)) return;
  if (ctx.texts.length >= DXF_LIMITS.texts) { if (!ctx.textOverflow) { ctx.textOverflow = true; pushTruncated(ctx, `The drawing has more than ${DXF_LIMITS.texts} text items; the rest are left out.`); } return; }
  const info = styleInfo(ctx, e.st);
  let text: string, font = info.font, source: DxfText['fontSource'] = info.source;
  if (e.t === 'MTEXT') {
    const plain = plainMtext(e.tx);
    text = plain.text;
    if (plain.font) { font = plain.font; source = 'inline'; }
    if (plain.extraFonts) ctx.mtextFontNotes++;
  } else {
    text = percentCodes(e.tx);
  }
  text = stripControls(text);
  if (!text.trim()) return;
  // Justified TEXT is placed by its second point; left-baseline TEXT by its first.
  const ha = num(e.ha, 0), va = num(e.va, 0);
  const aligned = e.t === 'TEXT' && (ha !== 0 || va !== 0) && e.q;
  const at = aligned ? e.q! : e.p;
  const plane = planeOf(e.n);
  const ocs = (x: number, y: number, z: number): [number, number] => {
    const [px, py] = e.n ? matApply(plane.m, x, y) : [x, y];
    return [px + plane.z[0] * z, py + plane.z[1] * z];
  };
  const [ox, oy] = ocs(at[0], at[1], at[2]);
  const [wx, wy] = matApply(inherit.m, ox, oy);
  // Rotation: the angle of the text's x axis in the plan, through the plane and the insert maps.
  const rotRad = (num(e.rot, 0) * Math.PI) / 180;
  const tipOcs = ocs(at[0] + Math.cos(rotRad), at[1] + Math.sin(rotRad), at[2]);
  const tip = matApply(inherit.m, tipOcs[0], tipOcs[1]);
  const angle = Math.atan2(tip[1] - wy, tip[0] - wx);
  const scaleY = Math.hypot(inherit.m[2], inherit.m[3]);
  let hAnchor: 0 | 1 | 2 = 0, vAnchor: 0 | 1 | 2 | 3 = 0;
  if (e.t === 'MTEXT') {
    const a = num(e.ha, 1);
    vAnchor = a <= 3 ? 3 : a <= 6 ? 2 : 1;
    hAnchor = ((a - 1) % 3) as 0 | 1 | 2;
  } else {
    // 0 left, 1 centre, 2 right; 3 aligned, 4 middle and 5 fit are anchored at their centre.
    hAnchor = ha === 1 || ha === 4 ? 1 : ha === 2 ? 2 : ha === 3 || ha === 5 ? 1 : 0;
    vAnchor = va === 1 ? 1 : va === 2 ? 2 : va === 3 ? 3 : 0;
    if (ha === 4) vAnchor = 2;
  }
  const item: DxfText = {
    layer, color, text, x: wx, y: wy,
    height: Math.abs(num(e.h, 0)) * (scaleY || 1), rotation: angle * (180 / Math.PI),
    hAnchor, vAnchor, widthFactor: num(e.xs, 1) || 1,
    ...(e.t === 'MTEXT' && e.wd ? { width: e.wd * (Math.hypot(inherit.m[0], inherit.m[1]) || 1) } : {}),
    ...(font ? { font, fontSource: source } : {}),
    ...(info.shx ? { shx: info.shx } : {}),
    ...(info.name ? { style: info.name } : {}),
  };
  if (!(item.height > 0)) {
    // A style with height 0 takes the height from the text; the file gave none, so nothing is drawn rather than guessed.
    const msg = 'Some text items state no height and were left out.';
    if (!ctx.report.notes.includes(msg)) ctx.report.notes.push(msg);
    return;
  }
  if (info.shx) {
    const rec = ctx.shx.get(info.shx.toLowerCase()) ?? { styles: new Set<string>(), items: 0 };
    if (info.name) rec.styles.add(info.name);
    rec.items++;
    ctx.shx.set(info.shx.toLowerCase(), rec);
  } else if (!font) {
    ctx.report.unnamedFontTexts++;
  }
  ctx.texts.push({ t: item, layer });
}

function walk(ctx: Ctx, entities: readonly DxfRawEntity[], inherit: Inherit): void {
  for (const e of entities) {
    if (ctx.drawn >= DXF_LIMITS.drawnEntities) { pushTruncated(ctx, 'The drawing expands to more entities than the importer draws.'); return; }
    ctx.report.entitiesRead++;
    if (e.t === 'INSERT') { insert(ctx, e, inherit); continue; }
    const layer = effectiveLayer(e, inherit);
    if (!layerAllowed(ctx, layer)) continue;
    const color = resolveColor(ctx, e, layer, inherit);
    if (color === null) continue;
    if (e.t === 'TEXT' || e.t === 'MTEXT') {
      ctx.drawn++;
      addText(ctx, e, layer, color, inherit);
      continue;
    }
    const paths = entityPaths(e, ctx);
    if (!paths.length) continue;
    ctx.drawn++;
    for (const sp of paths) addStroke(ctx, layer, color, sp, inherit.m);
  }
}

function insert(ctx: Ctx, e: DxfRawEntity, inherit: Inherit): void {
  const name = e.nm ?? '';
  const key = name.toUpperCase();
  const insLayer = effectiveLayer(e, inherit);
  if (!layerAllowed(ctx, insLayer)) return;
  if (ctx.xrefNames.has(key)) { ctx.xrefInserted.set(key, (ctx.xrefInserted.get(key) ?? 0) + 1); return; }
  const block = ctx.blocks.get(key);
  if (!block) { if (!ctx.report.missingBlocks.includes(name) && ctx.report.missingBlocks.length < 50) ctx.report.missingBlocks.push(name); return; }
  if (inherit.chain.includes(key)) { if (!ctx.report.recursiveBlocks.includes(name)) ctx.report.recursiveBlocks.push(name); return; }
  if (inherit.chain.length >= DXF_LIMITS.insertDepth) { pushTruncated(ctx, `Blocks nested more than ${DXF_LIMITS.insertDepth} deep were left out.`); return; }
  if (!e.p || !sane(...e.p, e.sx, e.sy, e.rot, e.dx, e.dy)) return;
  if (ctx.placed + 1 > DXF_LIMITS.placements) { pushTruncated(ctx, 'The drawing places more blocks than the importer follows.'); return; }
  const plane = planeOf(e.n);
  const sx = num(e.sx, 1), sy = num(e.sy, 1);
  const rot = (num(e.rot, 0) * Math.PI) / 180;
  const cols = Math.max(1, Math.trunc(num(e.cols, 1))), rows = Math.max(1, Math.trunc(num(e.rows, 1)));
  const copies = cols * rows;
  if (copies > DXF_LIMITS.arrayCopies) { pushTruncated(ctx, `An array insert of ${copies} copies was left out.`); return; }
  const color = resolveColor(ctx, e, insLayer, inherit);
  if (color === null) return;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const off = [c * num(e.dx, 0), r * num(e.dy, 0)];
      const rotated = matApply(matRotate(rot), off[0]!, off[1]!);
      const place = matTranslate(e.p[0] + rotated[0], e.p[1] + rotated[1]);
      let local = matMul(place, matMul(matRotate(rot), matMul(matScale(sx, sy), matTranslate(-block.bx, -block.by))));
      if (e.n) local = matMul([plane.m[0], plane.m[1], plane.m[2], plane.m[3], 0, 0], local);
      ctx.placed++;
      walk(ctx, block.e, { m: matMul(inherit.m, local), layer: insLayer, color, chain: [...inherit.chain, key] });
    }
  }
}

/** Run the flattener over a raw drawing. */
export function flattenDxf(raw: DxfRaw, opts: Omit<DxfImportOptions, 'read'> = {}): DxfImport {
  const units = dxfUnits(raw.u, opts.unitless);
  const filter = opts.layers ? new Set(opts.layers.map((n) => n.toUpperCase())) : null;
  const layerHidden = raw.layers.map((l) => !opts.includeHidden && (!!l.off || !!l.fz));
  const layerKept = raw.layers.map((l) => !filter || filter.has(l.n.toUpperCase()));
  const layerColor = raw.layers.map((l) => (l.tc !== undefined ? trueHex(l.tc) : (aciToHex(l.c) ?? '#000000')));
  const report: DxfReport = {
    version: raw.acadver, format: raw.fmt, codePage: raw.cp, units, pxPerUnit: 1, mmPerPx: 1,
    entitiesRead: 0, entitiesDrawn: 0, textItems: 0, layersImported: [], layersHidden: [], layersFiltered: [],
    xrefs: [], paperSpace: { count: raw.paper.n, types: { ...raw.paper.types } }, shxFonts: [], unnamedFontTexts: 0,
    skipped: { ...raw.skipped }, missingBlocks: [], recursiveBlocks: [], truncated: [], notes: [...raw.notes],
  };
  const ctx: Ctx = {
    raw, layerHidden, layerColor, layerKept,
    blocks: new Map(raw.blocks.map((b) => [b.n.toUpperCase(), b])),
    strokes: new Map(), texts: [], drawn: 0, placed: 0, segments: 0, report, shx: new Map(),
    xrefInserted: new Map(), xrefNames: new Set(raw.xrefs.map((x) => x.n.toUpperCase())),
    hiddenSeen: new Set(), filteredSeen: new Set(), textOverflow: false, mtextFontNotes: 0,
  };
  walk(ctx, raw.e, { m: IDENTITY, layer: null, color: null, chain: [] });

  // Bounds of everything drawn, in drawing units.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (b: [number, number, number, number] | null) => {
    if (!b) return;
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
  };
  for (const s of ctx.strokes.values()) for (const sp of s.subpaths) grow(subPathBounds(sp));
  for (const t of ctx.texts) grow([t.t.x, t.t.y, t.t.x, t.t.y]);
  if (!(x0 <= x1)) {
    x0 = y0 = 0; x1 = y1 = 1;
  }
  const spanX = Math.max(x1 - x0, 1e-9), spanY = Math.max(y1 - y0, 1e-9);
  const margin = opts.margin ?? 40;
  const fit = opts.fitPx ?? DXF_LIMITS.fitPx;
  let s = opts.pxPerUnit ?? fit / Math.max(spanX, spanY);
  if (!(s > 0) || !Number.isFinite(s)) s = 1;
  report.pxPerUnit = s;
  report.mmPerPx = (units.metresPerUnit * 1000) / s;
  const toPx = (x: number, y: number): [number, number] => [(x - x0) * s + margin, (y1 - y) * s + margin];
  const flip: Mat = [s, 0, 0, -s, margin - x0 * s, margin + y1 * s];

  const strokes: DxfStroke[] = [...ctx.strokes.values()]
    .sort((a, b) => a.layer - b.layer)
    .map((st) => ({ ...st, subpaths: st.subpaths.map((sp) => mapSubPath(sp, flip)) }));
  const texts: DxfText[] = ctx.texts.map(({ t }) => {
    const [px, py] = toPx(t.x, t.y);
    // The page's y axis points down, so a counter-clockwise plan angle becomes a negative page rotation.
    return { ...t, x: px, y: py, height: t.height * s, rotation: -t.rotation, ...(t.width ? { width: t.width * s } : {}) };
  });

  const strokeCount = new Map<number, number>(), textCount = new Map<number, number>();
  for (const st of strokes) strokeCount.set(st.layer, (strokeCount.get(st.layer) ?? 0) + st.subpaths.length);
  for (const t of texts) textCount.set(t.layer, (textCount.get(t.layer) ?? 0) + 1);
  const layers: DxfLayerOut[] = raw.layers.map((l, i) => ({
    name: l.n, color: layerColor[i]!, hidden: !!(l.off || l.fz),
    strokes: strokeCount.get(i) ?? 0, texts: textCount.get(i) ?? 0,
  }));

  report.entitiesDrawn = ctx.drawn;
  report.textItems = texts.length;
  report.layersImported = layers.filter((l) => l.strokes + l.texts > 0).map((l) => l.name);
  report.layersHidden = [...ctx.hiddenSeen].map((i) => raw.layers[i]!.n);
  report.layersFiltered = [...ctx.filteredSeen].map((i) => raw.layers[i]!.n);
  report.xrefs = raw.xrefs.map((x) => ({ name: x.n, path: x.path, inserted: ctx.xrefInserted.get(x.n.toUpperCase()) ?? 0 }));
  report.shxFonts = [...ctx.shx.entries()].map(([file, v]) => ({ file, styles: [...v.styles], textItems: v.items }));
  if (ctx.mtextFontNotes) report.notes.push(`${ctx.mtextFontNotes} text items change font part way through; the first font named is used for the whole item.`);
  if (units.declared === false) report.notes.push(`The file does not state its drawing units, so ${units.name} are assumed. Pass the unit explicitly if that is wrong.`);

  return {
    width: Math.ceil(spanX * s + margin * 2), height: Math.ceil(spanY * s + margin * 2),
    layers, strokes, texts, report,
  };
}

/** Read and flatten a DXF file with the shell-supplied reader. */
export function importDxf(bytes: Uint8Array, opts: DxfImportOptions): DxfImport {
  return flattenDxf(opts.read(bytes), opts);
}

/** Does the file look like DXF? ASCII starts with a group code line then SECTION; binary has a sentinel. */
export function looksLikeDxf(bytes: Uint8Array): boolean {
  const sentinel = 'AutoCAD Binary DXF';
  if (bytes.length >= sentinel.length && [...sentinel].every((c, i) => bytes[i] === c.charCodeAt(0))) return true;
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 512)).replace(/^﻿/, '');
  return /^\s*0\s*\r?\n\s*SECTION\s*\r?\n\s*2\s*\r?\n\s*(HEADER|CLASSES|TABLES|BLOCKS|ENTITIES|OBJECTS)\b/i.test(head)
    || /^\s*999\s*\r?\n[^\n]*\r?\n\s*0\s*\r?\n\s*SECTION\b/i.test(head);
}

/** The report as short, plain sentences. Nothing is listed that did not happen. */
export function dxfReportLines(r: DxfReport): string[] {
  const out: string[] = [];
  const scale = r.mmPerPx >= 10 ? `${(r.mmPerPx / 1000).toFixed(3)} m` : `${r.mmPerPx.toFixed(2)} mm`;
  out.push(`Read ${r.format === 'binary' ? 'a binary' : 'an ASCII'} DXF${r.version ? ` (${r.version})` : ''}: ${r.entitiesDrawn} entities drawn, ${r.textItems} text items. Units: ${r.units.name}${r.units.declared ? '' : ' (assumed)'}; one pixel is ${scale}.`);
  if (r.layersHidden.length) out.push(`${r.layersHidden.length} layers that the file turns off or freezes were not imported: ${listNames(r.layersHidden)}.`);
  if (r.layersFiltered.length) out.push(`${r.layersFiltered.length} layers were left out by the layer filter.`);
  for (const x of r.xrefs) out.push(`External reference "${x.name}" (${x.path || 'no path stated'}) is not loaded${x.inserted ? `, so ${plural(x.inserted, 'placement')} of it ${x.inserted === 1 ? 'is' : 'are'} empty` : ''}. Open that drawing separately to import it.`);
  if (r.paperSpace.count) out.push(`${plural(r.paperSpace.count, 'item')} ${r.paperSpace.count === 1 ? 'sits' : 'sit'} in paper space (layouts and viewports: ${typeList(r.paperSpace.types)}). Only model space is imported.`);
  for (const f of r.shxFonts) out.push(`Text style${f.styles.length === 1 ? '' : 's'} ${f.styles.map((s) => `"${s}"`).join(', ') || '(unnamed)'} ${f.styles.length === 1 ? 'uses' : 'use'} the SHX font ${f.file}, which Lolly cannot draw. ${plural(f.textItems, 'text item')} keep${f.textItems === 1 ? 's' : ''} their wording and use${f.textItems === 1 ? 's' : ''} the default font.`);
  if (r.unnamedFontTexts) out.push(`${plural(r.unnamedFontTexts, 'text item')} ${r.unnamedFontTexts === 1 ? 'comes' : 'come'} from styles that name no font and ${r.unnamedFontTexts === 1 ? 'uses' : 'use'} the default font.`);
  const skipped = Object.entries(r.skipped);
  if (skipped.length) out.push(`Not imported: ${skipped.map(([k, n]) => `${n} ${k}`).join(', ')}.`);
  if (r.missingBlocks.length) out.push(`Blocks used but not defined: ${listNames(r.missingBlocks)}.`);
  if (r.recursiveBlocks.length) out.push(`Blocks that contain themselves were left out: ${listNames(r.recursiveBlocks)}.`);
  for (const t of r.truncated) out.push(t);
  out.push(...r.notes);
  return out;
}

function plural(n: number, noun: string): string { return `${n} ${noun}${n === 1 ? '' : 's'}`; }
function listNames(names: readonly string[]): string {
  const shown = names.slice(0, 6).map((n) => `"${n}"`).join(', ');
  return names.length > 6 ? `${shown} and ${names.length - 6} more` : shown;
}
function typeList(types: Record<string, number>): string {
  return Object.entries(types).slice(0, 6).map(([k, n]) => `${n} ${k}`).join(', ');
}

export type { PathSegment };

// SPDX-License-Identifier: MPL-2.0
/**
 * `.penpot` writer - a Lolly document (plus the brand's tokens) → the binfile-v3
 * archive Penpot itself exports and imports (plans/178). Pure, DOM-free,
 * platform-agnostic: it emits zip ENTRIES (path → bytes/string); the caller zips
 * them (web: lib/zip.ts, CLI: fflate) exactly the way `buildPptxParts` is zipped.
 *
 * Three producers feed ONE intermediate representation ({@link PenpotIrShape}):
 *   - {@link boxesToPenpotDoc}: the Design tool's raw box rows (its frames become
 *     boards, its boxes rects / ellipses / texts / images / paths) - the inverse of
 *     design-map.ts's `nodeToBox`;
 *   - {@link svgToPenpotDoc}: any tool's vector render, lowered permissively (solid
 *     and gradient paint, strokes, plain text runs, embedded images, groups). When
 *     the SVG carries something the lowering cannot carry faithfully it returns
 *     null and the caller wraps the whole SVG as one image ({@link imageToPenpotDoc}),
 *     so fidelity never regresses;
 *   - {@link imageToPenpotDoc}: one board with one picture - what a PNG/JPEG/SVG
 *     send becomes.
 * {@link buildPenpotEntries} then writes the archive: manifest, file, pages, one
 * JSON per shape, media + storage objects, library colours, typographies and the
 * brand tokens (`tokens.json`, filtered by {@link penpotTokensJson} to what Penpot's
 * DTCG reader accepts).
 *
 * Every record mirrors Penpot's malli schemas (penpot/penpot@develop
 * `common/src/app/common/types/*.cljc`, verified 2026-09-02 - see plans/178 section 2):
 * import validates each entry and then the assembled file, so a stray key, a
 * NaN, or a fill with two paints is a refused archive, not a warning. The
 * `version` + `migrations` pin mirrors a Penpot 2.17 export so the migrator
 * treats the file as current; a newer Penpot migrates forward by design.
 *
 * Keys are camelCase (Penpot writes `write-camel-key`, reads `read-kebab-key`),
 * matrices `{a..f}`, uuids strings, `null` where a record field is unset.
 * No Handlebars, no ajv, no deps. Fully node:test-able.
 */
import { parseSvgPath, type SubPath, type PathSegment } from './svg-path.ts';
import { colorToHex } from './tokens.ts';
import { makeGeomApi } from './geom-api.ts';
import { pathBounds, pathFromSubPaths } from './geom/path.ts';

// ─── constants ────────────────────────────────────────────────────────────────

/** The download/blob type. Deliberately NOT `application/zip`: the web shell's
 *  `extFor` renames a zip-typed blob to `.zip`, and Penpot's own picker wants
 *  `.penpot`. Penpot's media table names the file type `application/penpot`. */
export const PENPOT_MIME = 'application/x-penpot';
/** The synthetic root frame every page hangs its top-level shapes off. */
export const PENPOT_ROOT_ID = '00000000-0000-0000-0000-000000000000';
/** File data version + the migrations a 2.17 export declares applied. */
export const PENPOT_FILE_VERSION = 67;
export const PENPOT_FEATURES: readonly string[] = Object.freeze([
  'fdata/path-data', 'design-tokens/v1', 'variants/v1', 'layout/grid', 'components/v2', 'fdata/shape-data-type',
]);
export const PENPOT_MIGRATIONS: readonly string[] = Object.freeze([
  'legacy-2', 'legacy-3', 'legacy-5', 'legacy-6', 'legacy-7', 'legacy-8', 'legacy-9', 'legacy-10', 'legacy-11',
  'legacy-12', 'legacy-13', 'legacy-14', 'legacy-16', 'legacy-17', 'legacy-18', 'legacy-19', 'legacy-25', 'legacy-26',
  'legacy-27', 'legacy-28', 'legacy-29', 'legacy-31', 'legacy-32', 'legacy-33', 'legacy-34', 'legacy-36', 'legacy-37',
  'legacy-38', 'legacy-39', 'legacy-40', 'legacy-41', 'legacy-42', 'legacy-43', 'legacy-44', 'legacy-45', 'legacy-46',
  'legacy-47', 'legacy-48', 'legacy-49', 'legacy-50', 'legacy-51', 'legacy-52', 'legacy-53', 'legacy-54', 'legacy-55',
  'legacy-56', 'legacy-57', 'legacy-59', 'legacy-62', 'legacy-65', 'legacy-66', 'legacy-67',
  '0001-remove-tokens-from-groups', '0002-normalize-bool-content-v2', '0002-clean-shape-interactions',
  '0003-fix-root-shape', '0003-convert-path-content-v2', '0005-deprecate-image-type', '0006-fix-old-texts-fills',
  '0008-fix-library-colors-v4', '0009-clean-library-colors', '0009-add-partial-text-touched-flags',
  '0010-fix-swap-slots-pointing-non-existent-shapes', '0011-fix-invalid-text-touched-flags', '0012-fix-position-data',
  '0013-fix-component-path', '0013-clear-invalid-strokes-and-fills', '0014-fix-tokens-lib-duplicate-ids',
  '0014-clear-components-nil-objects', '0015-fix-text-attrs-blank-strings', '0015-clean-shadow-color',
  '0016-copy-fills-from-position-data-to-text-node', '0017-fix-layout-flex-dir',
  '0018-remove-unneeded-objects-from-components', '0019-fix-missing-swap-slots',
  '0020-sync-component-id-with-near-main', '0021-fix-shape-svg-attrs', '0022-normalize-component-root-and-resync',
  '0023-repair-token-themes-with-inexistent-sets', '0024b-fix-stroke-cap-placement',
]);
/** Media types Penpot stores as image media, with the blob extension its reader
 *  expects beside the storage object (`app.common.media/mtype->extension`). */
const MTYPE_EXT: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/svg+xml': '.svg',
  'image/webp': '.webp', 'image/avif': '.avif', 'image/apng': '.apng',
};
export const PENPOT_IMAGE_MTYPES: readonly string[] = Object.freeze(Object.keys(MTYPE_EXT));
/** Penpot's blend-mode vocabulary (shape.cljc `blend-modes`). */
const BLEND_MODES = new Set(['normal', 'darken', 'multiply', 'color-burn', 'lighten', 'screen', 'color-dodge',
  'overlay', 'soft-light', 'hard-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']);
/** Penpot's stroke cap vocabulary (line caps + markers). */
const STROKE_CAPS = new Set(['round', 'square', 'line-arrow', 'triangle-arrow', 'square-marker', 'circle-marker', 'diamond-marker']);
/** DTCG `$type` values Penpot's token reader keeps (token.cljc
 *  `dtcg-token-type->token-type`), keyed by every spelling we may meet. */
const TOKEN_TYPE_MAP: Record<string, string> = {
  boolean: 'boolean', borderRadius: 'borderRadius', color: 'color', dimension: 'dimension',
  fontFamilies: 'fontFamilies', fontFamily: 'fontFamilies', fontSizes: 'fontSizes', fontSize: 'fontSizes',
  fontWeights: 'fontWeights', fontWeight: 'fontWeights', letterSpacing: 'letterSpacing', number: 'number',
  opacity: 'opacity', other: 'other', rotation: 'rotation', shadow: 'shadow', boxShadow: 'shadow', sizing: 'sizing',
  spacing: 'spacing', string: 'string', borderWidth: 'borderWidth', textCase: 'textCase',
  textDecoration: 'textDecoration', typography: 'typography',
};
/** Background-blur px ↔ Penpot value: the inverse of design-map's
 *  `penpotBackgroundBlurPx` (px = value·A + B). */
const BG_BLUR_SIGMA_A = 1.1547;
const BG_BLUR_SIGMA_B = 1;
const MAX_SVG_LEN = 8_000_000;
const MAX_SVG_TAGS = 60_000;
const MAX_SHAPES = 6_000;
const MAX_TEXT_PARAGRAPHS = 400;

// ─── the intermediate representation ─────────────────────────────────────────

export interface PenpotIrGradientStop { color: string; opacity?: number; offset: number }
/** A gradient in the shape's own unit box (0..1 on both axes), Penpot's model. */
export interface PenpotIrGradient {
  type: 'linear' | 'radial';
  startX: number; startY: number; endX: number; endY: number;
  /** Radial only: the perpendicular scale in the shape's NORMALIZED unit box, applied
   *  before the box maps it to px (Penpot's `gradients.cljs` scales by `(width, 1)`
   *  about the start point). So the painted semi-axes are `width·r·w` by `r·h`:
   *  `1` is an ellipse matching the shape box, `h/w` a true circle. */
  width?: number;
  stops: PenpotIrGradientStop[];
}
/** Exactly one of `color` / `gradient` / `media` (Penpot refuses a fill with two paints). */
export interface PenpotIrFill {
  color?: string;
  gradient?: PenpotIrGradient;
  /** A {@link PenpotMedia} id - the picture fills the shape's box. */
  media?: string;
  keepAspectRatio?: boolean;
  opacity?: number;
}
export interface PenpotIrStroke {
  color: string;
  opacity?: number;
  width: number;
  alignment?: 'center' | 'inner' | 'outer';
  style?: 'solid' | 'dashed' | 'dotted';
  dash?: number;
  gap?: number;
  capStart?: string;
  capEnd?: string;
}
export interface PenpotIrShadow {
  style: 'drop-shadow' | 'inner-shadow';
  x: number; y: number; blur: number; spread?: number;
  color: string; opacity?: number;
}
export interface PenpotIrTextRun {
  text: string;
  fontFamily?: string;
  /** 100 to 900. */
  fontWeight?: number;
  italic?: boolean;
  /** px. */
  fontSize?: number;
  /** A ratio (1.2), like CSS unitless line-height. */
  lineHeight?: number;
  /** px. */
  letterSpacing?: number;
  color?: string;
  opacity?: number;
  decoration?: 'none' | 'underline' | 'line-through';
  transform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}
export interface PenpotIrParagraph {
  align?: 'left' | 'center' | 'right' | 'justify';
  runs: PenpotIrTextRun[];
}
interface PenpotIrShapeBase {
  name?: string;
  /** Page (absolute) px, top-left origin, the UNROTATED box. */
  x: number; y: number; w: number; h: number;
  /** Degrees clockwise about the box centre (CSS / Penpot convention). */
  rotation?: number;
  /** 0..1. */
  opacity?: number;
  fills?: PenpotIrFill[];
  strokes?: PenpotIrStroke[];
  shadows?: PenpotIrShadow[];
  /** Layer blur, px. */
  blur?: number;
  /** Backdrop blur, px (the CSS `backdrop-filter` reading). */
  backgroundBlur?: number;
  blend?: string;
  hidden?: boolean;
  /** Picture mirroring, images only (a path bakes its mirror into `d`). */
  flipX?: boolean; flipY?: boolean;
  /** Radii clockwise from top-left; a number sets all four. */
  radius?: number | [number, number, number, number];
}
export interface PenpotIrRect extends PenpotIrShapeBase { type: 'rect' }
export interface PenpotIrCircle extends PenpotIrShapeBase { type: 'circle' }
/** `d` is PAGE-absolute SVG path data (Penpot stores path content page-space-final). */
export interface PenpotIrPath extends PenpotIrShapeBase { type: 'path'; d: string }
export interface PenpotIrText extends PenpotIrShapeBase {
  type: 'text';
  paragraphs: PenpotIrParagraph[];
  valign?: 'top' | 'center' | 'bottom';
  growType?: 'fixed' | 'auto-width' | 'auto-height';
}
/** A picture: emitted as Penpot writes one - a rect whose fill is the image. */
export interface PenpotIrImage extends PenpotIrShapeBase { type: 'image'; media: string; keepAspectRatio?: boolean }
export interface PenpotIrGroup extends PenpotIrShapeBase {
  type: 'group';
  children: PenpotIrShape[];
  /** The first child clips the rest (a Penpot masked group). */
  masked?: boolean;
}
/** A board (Penpot "frame"): clips its children unless `showContent`. */
export interface PenpotIrBoard extends PenpotIrShapeBase {
  type: 'board';
  children: PenpotIrShape[];
  showContent?: boolean;
}
export type PenpotIrShape = PenpotIrRect | PenpotIrCircle | PenpotIrPath | PenpotIrText | PenpotIrImage | PenpotIrGroup | PenpotIrBoard;

export interface PenpotIrPage {
  name: string;
  /** Page background hex. */
  background?: string;
  /** Top-level shapes in paint order (first = bottom). Boards usually. */
  shapes: PenpotIrShape[];
}
/** One embedded picture. `id` is what a fill's `media` names. */
export interface PenpotMedia {
  id: string;
  name: string;
  mtype: string;
  width: number;
  height: number;
  bytes: Uint8Array;
}
export interface PenpotPaletteColor { name: string; path?: string; color: string; opacity?: number }
export interface PenpotIrTypography {
  name: string;
  path?: string;
  fontFamily: string;
  fontWeight?: number;
  italic?: boolean;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: string;
}
export interface PenpotDoc {
  name: string;
  pages: PenpotIrPage[];
  media?: PenpotMedia[];
  /** The brand's Tokens-Studio / DTCG document (host.tokens.raw()); filtered on write. */
  tokens?: unknown;
  /** Library colours for the Assets tab. */
  palette?: PenpotPaletteColor[];
  typographies?: PenpotIrTypography[];
  /** Families known to be Google Fonts - they get Penpot's `gfont-` font ids. */
  googleFamilies?: Iterable<string>;
  /** Manifest `generatedBy`; defaults to `lolly`. */
  generatedBy?: string;
}

export interface PenpotBuildOptions {
  /** Injectable uuid v4 source (seeded in tests for byte-stable goldens). */
  uuid?: () => string;
  /** Injectable clock, ISO-8601. */
  now?: () => string;
}
export interface PenpotBuild {
  /** Zip entries: path → bytes or text. Zip them with no compression concerns; Penpot inflates. */
  entries: Record<string, Uint8Array | string>;
  fileId: string;
  pageIds: string[];
  shapeCount: number;
  mediaCount: number;
  /** Things dropped or degraded on the way in, for the caller's log. Never fatal. */
  warnings: string[];
}

// ─── small helpers ────────────────────────────────────────────────────────────

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const fin = (v: unknown, d = 0): number => { const n = typeof v === 'number' ? v : parseFloat(String(v)); return Number.isFinite(n) ? n : d; };
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
/** Round to 4 decimals and never let a NaN/Infinity reach a `safe-number` field. */
const r4 = (v: number): number => { const n = Math.round(v * 10000) / 10000; return Number.isFinite(n) ? (Object.is(n, -0) ? 0 : n) : 0; };

function fallbackUuid(): string {
  const b = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
/** uuid v4 - `crypto.randomUUID` where the platform has it. */
export function penpotUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : fallbackUuid();
}
/** A deterministic uuid sequence for tests: `seededUuid('a')` yields distinct, valid v4-shaped ids. */
export function seededPenpotUuid(seed = 1): () => string {
  let n = seed >>> 0 || 1;
  return () => {
    // xorshift32 - four words per id.
    const w: number[] = [];
    for (let i = 0; i < 4; i++) { n ^= n << 13; n >>>= 0; n ^= n >>> 17; n ^= n << 5; n >>>= 0; w.push(n); }
    const h = w.map((x) => x.toString(16).padStart(8, '0')).join('');
    const s = h.slice(0, 12) + '4' + h.slice(13, 16) + '8' + h.slice(17, 32);
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
  };
}

// ─── colour ───────────────────────────────────────────────────────────────────

/** Null-prototype on purpose: a plain literal would answer `NAMED['constructor']` and
 *  `NAMED['__proto__']` with an inherited non-string, which every caller then treats as
 *  a colour (see the `typeof` guard in {@link parsePenpotColor}). */
const NAMED: Record<string, string> = Object.assign(Object.create(null) as Record<string, string>, {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00',
  cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff', gray: '#808080', grey: '#808080',
  silver: '#c0c0c0', maroon: '#800000', olive: '#808000', lime: '#00ff00', teal: '#008080', navy: '#000080',
  purple: '#800080', orange: '#ffa500', pink: '#ffc0cb', brown: '#a52a2a', gold: '#ffd700', indigo: '#4b0082',
  violet: '#ee82ee', tomato: '#ff6347', coral: '#ff7f50', salmon: '#fa8072', khaki: '#f0e68c', tan: '#d2b48c',
  beige: '#f5f5dc', ivory: '#fffff0', lavender: '#e6e6fa', crimson: '#dc143c', turquoise: '#40e0d0',
  orchid: '#da70d6', plum: '#dda0dd', chocolate: '#d2691e', sienna: '#a0522d', wheat: '#f5deb3', snow: '#fffafa',
  skyblue: '#87ceeb', steelblue: '#4682b4', slategray: '#708090', slategrey: '#708090', dimgray: '#696969',
  dimgrey: '#696969', darkgray: '#a9a9a9', darkgrey: '#a9a9a9', lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
  whitesmoke: '#f5f5f5', gainsboro: '#dcdcdc', darkblue: '#00008b', darkgreen: '#006400', darkred: '#8b0000',
  royalblue: '#4169e1', dodgerblue: '#1e90ff', deepskyblue: '#00bfff', forestgreen: '#228b22', seagreen: '#2e8b57',
  limegreen: '#32cd32', springgreen: '#00ff7f', hotpink: '#ff69b4', deeppink: '#ff1493', firebrick: '#b22222',
  darkorange: '#ff8c00', orangered: '#ff4500', goldenrod: '#daa520', rebeccapurple: '#663399', mintcream: '#f5fffa',
});

export interface PenpotColor { hex: string; alpha: number }
/**
 * Read a CSS/DTCG colour into Penpot's `#rrggbb` + alpha. Accepts hex (3/4/6/8),
 * rgb[a](), hsl[a](), oklch(), the common named colours, and `var(--x, <fallback>)`
 * - for which it returns the LITERAL fallback, a stale copy of whatever the brand
 * paints today, so a caller holding a live resolver must ask that first and treat
 * this as the last resort (see `boxesToPenpotDoc`'s `color()`). `transparent`,
 * `none`, an alias `{a.b}` or anything unreadable → null, so the caller either
 * resolves it (brand tokens) or drops the paint.
 */
export function parsePenpotColor(input: unknown): PenpotColor | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  const varM = /^var\(\s*--[\w-]+\s*,\s*([\s\S]+)\)$/.exec(s);
  if (varM) s = varM[1]!.trim();
  if (/^var\(/.test(s) || /^\{/.test(s)) return null;
  const lower = s.toLowerCase();
  if (lower === 'transparent' || lower === 'none' || lower === 'currentcolor' || lower === 'inherit') return null;
  const named = NAMED[lower];
  if (typeof named === 'string') return { hex: named, alpha: 1 };
  const hex = colorToHex(s);
  if (!hex || hex === 'transparent') return null;
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!m) return null;
  return { hex: `#${m[1]!.toLowerCase()}`, alpha: m[2] ? parseInt(m[2], 16) / 255 : 1 };
}

// ─── geometry ─────────────────────────────────────────────────────────────────

export interface PenpotMatrix { a: number; b: number; c: number; d: number; e: number; f: number }
const IDENT: PenpotMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const mul = (m: PenpotMatrix, n: PenpotMatrix): PenpotMatrix => ({
  a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b,
  c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d,
  e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f,
});
const apply = (m: PenpotMatrix, x: number, y: number): [number, number] => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
const meanScale = (m: PenpotMatrix): number => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
const isAxisAligned = (m: PenpotMatrix): boolean => Math.abs(m.b) < 1e-9 && Math.abs(m.c) < 1e-9 && m.a > 0 && m.d > 0;

/** Penpot's geometry block for an unrotated box + a rotation about its centre. */
function geometry(x: number, y: number, w: number, h: number, rotation = 0): Rec {
  const W = Math.max(0.01, w), H = Math.max(0.01, h);
  const rot = ((fin(rotation) % 360) + 360) % 360;
  const rad = rot * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const cx = x + W / 2, cy = y + H / 2;
  const corner = (px: number, py: number): Rec => {
    const dx = px - cx, dy = py - cy;
    return { x: r4(cx + dx * cos - dy * sin), y: r4(cy + dx * sin + dy * cos) };
  };
  const ident = rot === 0;
  return {
    x: r4(x), y: r4(y), width: r4(W), height: r4(H), rotation: r4(rot),
    selrect: { x: r4(x), y: r4(y), width: r4(W), height: r4(H), x1: r4(x), y1: r4(y), x2: r4(x + W), y2: r4(y + H) },
    points: ident
      ? [{ x: r4(x), y: r4(y) }, { x: r4(x + W), y: r4(y) }, { x: r4(x + W), y: r4(y + H) }, { x: r4(x), y: r4(y + H) }]
      : [corner(x, y), corner(x + W, y), corner(x + W, y + H), corner(x, y + H)],
    transform: ident ? { ...IDENT } : { a: r4(cos), b: r4(sin), c: r4(-sin), d: r4(cos), e: 0, f: 0 },
    transformInverse: ident ? { ...IDENT } : { a: r4(cos), b: r4(-sin), c: r4(sin), d: r4(cos), e: 0, f: 0 },
  };
}

/**
 * TIGHT bounding box of parsed subpaths - the curve's own extrema, not the control
 * hull, because this box IS the shape's stored `selrect` / `points` / width / height
 * (plan 178 section 3.1: "x, y, width, height = the path's bbox"), and the same box
 * maps a userSpaceOnUse gradient into the shape's unit square. `pathBounds` solves the
 * per-axis cubic derivative roots; a degenerate subpath (a lone `M`) yields no curves,
 * so the point scan stays as the fallback for that case.
 */
function subpathBounds(subs: SubPath[]): { x: number; y: number; w: number; h: number } | null {
  const exact = pathBounds(pathFromSubPaths(subs));
  if (exact) return { x: exact.x0, y: exact.y0, w: exact.x1 - exact.x0, h: exact.y1 - exact.y0 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x: number, y: number): void => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const sp of subs) for (const s of sp.segments) {
    take(s.x, s.y);
    if (s.op === 'C') { take(s.x1, s.y1); take(s.x2, s.y2); }
  }
  if (!Number.isFinite(x0)) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function transformSubpaths(subs: SubPath[], m: PenpotMatrix): SubPath[] {
  return subs.map((sp) => ({
    closed: sp.closed,
    segments: sp.segments.map((s): PathSegment => {
      const [x, y] = apply(m, s.x, s.y);
      if (s.op === 'C') {
        const [x1, y1] = apply(m, s.x1, s.y1), [x2, y2] = apply(m, s.x2, s.y2);
        return { op: 'C', x1, y1, x2, y2, x, y };
      }
      return { op: s.op, x, y };
    }),
  }));
}
function subpathsToD(subs: SubPath[]): string {
  const n = (v: number): string => String(r4(v));
  const out: string[] = [];
  for (const sp of subs) {
    for (const s of sp.segments) {
      if (s.op === 'M') out.push(`M${n(s.x)},${n(s.y)}`);
      else if (s.op === 'L') out.push(`L${n(s.x)},${n(s.y)}`);
      else out.push(`C${n(s.x1)},${n(s.y1)} ${n(s.x2)},${n(s.y2)} ${n(s.x)},${n(s.y)}`);
    }
    if (sp.closed) out.push('Z');
  }
  return out.join('');
}
const K = 0.5522847498; // cubic circle constant
function ellipseSubpath(cx: number, cy: number, rx: number, ry: number): SubPath {
  const kx = rx * K, ky = ry * K;
  return { closed: true, segments: [
    { op: 'M', x: cx + rx, y: cy },
    { op: 'C', x1: cx + rx, y1: cy + ky, x2: cx + kx, y2: cy + ry, x: cx, y: cy + ry },
    { op: 'C', x1: cx - kx, y1: cy + ry, x2: cx - rx, y2: cy + ky, x: cx - rx, y: cy },
    { op: 'C', x1: cx - rx, y1: cy - ky, x2: cx - kx, y2: cy - ry, x: cx, y: cy - ry },
    { op: 'C', x1: cx + kx, y1: cy - ry, x2: cx + rx, y2: cy - ky, x: cx + rx, y: cy },
  ] };
}
function roundedRectSubpath(x: number, y: number, w: number, h: number, rx: number, ry: number): SubPath {
  rx = clamp(rx, 0, w / 2); ry = clamp(ry, 0, h / 2);
  if (rx <= 0 || ry <= 0) {
    return { closed: true, segments: [{ op: 'M', x, y }, { op: 'L', x: x + w, y }, { op: 'L', x: x + w, y: y + h }, { op: 'L', x, y: y + h }] };
  }
  const kx = rx * K, ky = ry * K;
  return { closed: true, segments: [
    { op: 'M', x: x + rx, y },
    { op: 'L', x: x + w - rx, y },
    { op: 'C', x1: x + w - rx + kx, y1: y, x2: x + w, y2: y + ry - ky, x: x + w, y: y + ry },
    { op: 'L', x: x + w, y: y + h - ry },
    { op: 'C', x1: x + w, y1: y + h - ry + ky, x2: x + w - rx + kx, y2: y + h, x: x + w - rx, y: y + h },
    { op: 'L', x: x + rx, y: y + h },
    { op: 'C', x1: x + rx - kx, y1: y + h, x2: x, y2: y + h - ry + ky, x, y: y + h - ry },
    { op: 'L', x, y: y + ry },
    { op: 'C', x1: x, y1: y + ry - ky, x2: x + rx - kx, y2: y, x: x + rx, y },
  ] };
}

// ─── record builders (the schema, one field at a time) ───────────────────────

const TEXT_DEFAULTS = { fontFamily: 'sourcesanspro', fontSize: 14, fontWeight: 400, lineHeight: 1.2, letterSpacing: 0 };

function fontIdFor(family: string, google: Set<string>): string {
  const slug = family.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return TEXT_DEFAULTS.fontFamily;
  return google.has(family.trim().toLowerCase()) ? `gfont-${slug}` : slug;
}
function fontVariantId(weight: number, italic: boolean): string {
  const w = clamp(Math.round(weight / 100) * 100, 100, 900);
  if (w === 400) return italic ? 'italic' : 'regular';
  return `${w}${italic ? 'italic' : ''}`;
}

function fillRecord(f: PenpotIrFill, media: Map<string, PenpotMedia>, warn: (s: string) => void): Rec | null {
  const op = f.opacity == null ? 1 : clamp(fin(f.opacity, 1), 0, 1);
  if (f.media) {
    const m = media.get(f.media);
    if (!m) { warn(`fill names unknown media ${f.media}`); return null; }
    return {
      fillImage: { id: m.id, mtype: m.mtype, width: Math.max(1, Math.round(m.width)), height: Math.max(1, Math.round(m.height)), name: m.name, keepAspectRatio: f.keepAspectRatio !== false },
      fillOpacity: r4(op),
    };
  }
  if (f.gradient) {
    const g = f.gradient;
    const stops = g.stops.map((s) => {
      const c = parsePenpotColor(s.color);
      if (!c) return null;
      const a = clamp(fin(s.opacity, 1), 0, 1) * c.alpha;
      return { color: c.hex, opacity: r4(a), offset: r4(clamp(fin(s.offset), 0, 1)) };
    }).filter((s): s is { color: string; opacity: number; offset: number } => !!s);
    if (stops.length < 1) return null;
    return {
      fillColorGradient: {
        type: g.type === 'radial' ? 'radial' : 'linear',
        startX: r4(fin(g.startX)), startY: r4(fin(g.startY)), endX: r4(fin(g.endX, 1)), endY: r4(fin(g.endY, 1)),
        width: r4(fin(g.width, 1)) || 1,
        stops,
      },
      fillOpacity: r4(op),
    };
  }
  const c = parsePenpotColor(f.color);
  if (!c) return null;
  return { fillColor: c.hex, fillOpacity: r4(op * c.alpha) };
}
function strokeRecord(s: PenpotIrStroke): Rec | null {
  const c = parsePenpotColor(s.color);
  const w = fin(s.width);
  if (!c || !(w > 0)) return null;
  const rec: Rec = {
    strokeColor: c.hex,
    strokeOpacity: r4(clamp(fin(s.opacity, 1), 0, 1) * c.alpha),
    strokeWidth: r4(w),
    strokeAlignment: s.alignment === 'inner' || s.alignment === 'outer' ? s.alignment : 'center',
    strokeStyle: s.style === 'dashed' || s.style === 'dotted' ? s.style : 'solid',
  };
  if (s.dash != null && s.dash > 0) rec.strokeDash = r4(s.dash);
  if (s.gap != null && s.gap > 0) rec.strokeGap = r4(s.gap);
  if (s.capStart && STROKE_CAPS.has(s.capStart)) rec.strokeCapStart = s.capStart;
  if (s.capEnd && STROKE_CAPS.has(s.capEnd)) rec.strokeCapEnd = s.capEnd;
  return rec;
}
function shadowRecord(sh: PenpotIrShadow, uuid: () => string): Rec | null {
  const c = parsePenpotColor(sh.color);
  if (!c) return null;
  return {
    id: uuid(), style: sh.style === 'inner-shadow' ? 'inner-shadow' : 'drop-shadow', hidden: false,
    offsetX: r4(fin(sh.x)), offsetY: r4(fin(sh.y)), blur: r4(Math.max(0, fin(sh.blur))), spread: r4(fin(sh.spread)),
    color: { color: c.hex, opacity: r4(clamp(fin(sh.opacity, 1), 0, 1) * c.alpha) },
  };
}
function radii(r: PenpotIrShapeBase['radius'], w: number, h: number): [number, number, number, number] {
  const cap = Math.max(0, Math.min(w, h) / 2);
  const one = (v: unknown): number => r4(clamp(fin(v), 0, cap));
  if (Array.isArray(r)) return [one(r[0]), one(r[1]), one(r[2]), one(r[3])];
  const v = one(r);
  return [v, v, v, v];
}

/** Every attr shared by all shape types. */
function baseRecord(
  id: string, type: string, sh: PenpotIrShapeBase, parentId: string, frameId: string, pageId: string,
  media: Map<string, PenpotMedia>, uuid: () => string, warn: (s: string) => void, fallbackName: string,
): Rec {
  const rec: Rec = {
    id, name: (sh.name && String(sh.name).trim()) || fallbackName, type,
    ...geometry(fin(sh.x), fin(sh.y), fin(sh.w), fin(sh.h), fin(sh.rotation)),
    parentId, frameId, pageId,
    flipX: sh.flipX === true ? true : null, flipY: sh.flipY === true ? true : null,
    proportionLock: false,
    proportion: r4(fin(sh.h) > 0 ? fin(sh.w) / fin(sh.h) : 1) || 1,
    fills: (sh.fills ?? []).map((f) => fillRecord(f, media, warn)).filter((f): f is Rec => !!f),
    strokes: (sh.strokes ?? []).map(strokeRecord).filter((s): s is Rec => !!s),
  };
  if (sh.opacity != null && fin(sh.opacity, 1) < 1) rec.opacity = r4(clamp(fin(sh.opacity, 1), 0, 1));
  if (sh.blend && sh.blend !== 'normal' && BLEND_MODES.has(sh.blend)) rec.blendMode = sh.blend;
  if (sh.hidden) rec.hidden = true;
  const shadows = (sh.shadows ?? []).map((s) => shadowRecord(s, uuid)).filter((s): s is Rec => !!s);
  if (shadows.length) rec.shadow = shadows;
  if (sh.blur != null && fin(sh.blur) > 0) rec.blur = { id: uuid(), type: 'layer-blur', value: r4(fin(sh.blur)), hidden: false };
  if (sh.backgroundBlur != null && fin(sh.backgroundBlur) > 0) {
    rec.backgroundBlur = { id: uuid(), type: 'background-blur', value: r4(Math.max(0, (fin(sh.backgroundBlur) - BG_BLUR_SIGMA_B) / BG_BLUR_SIGMA_A)), hidden: false };
  }
  return rec;
}

/** `key` is Penpot's editor-side paragraph identity. It comes from the BUILD's own
 *  counter, never a module-global one, so a build is a pure function of (doc, uuid, now). */
function textContentRecord(t: PenpotIrText, google: Set<string>, nextKey: () => string): Rec | null {
  const paras = t.paragraphs.slice(0, MAX_TEXT_PARAGRAPHS).map((p) => {
    const runs = p.runs.filter((r) => typeof r.text === 'string');
    if (!runs.length) return null;
    const spans = runs.map((r) => {
      const family = (r.fontFamily && r.fontFamily.trim()) || TEXT_DEFAULTS.fontFamily;
      const weight = clamp(Math.round(fin(r.fontWeight, TEXT_DEFAULTS.fontWeight) / 100) * 100, 100, 900);
      const italic = r.italic === true;
      const c = parsePenpotColor(r.color ?? '#000000') ?? { hex: '#000000', alpha: 1 };
      const rec: Rec = {
        text: r.text,
        fontId: fontIdFor(family, google), fontFamily: family,
        fontVariantId: fontVariantId(weight, italic),
        fontSize: String(r4(Math.max(1, fin(r.fontSize, TEXT_DEFAULTS.fontSize)))),
        fontWeight: String(weight), fontStyle: italic ? 'italic' : 'normal',
        lineHeight: String(r4(Math.max(0.1, fin(r.lineHeight, TEXT_DEFAULTS.lineHeight)))),
        letterSpacing: String(r4(fin(r.letterSpacing, 0))),
        textTransform: r.transform ?? 'none', textDecoration: r.decoration ?? 'none',
        textDirection: 'ltr',
        fills: [{ fillColor: c.hex, fillOpacity: r4(clamp(fin(r.opacity, 1), 0, 1) * c.alpha) }],
      };
      return rec;
    });
    const lead = spans[0]!;
    const align = p.align && ['left', 'center', 'right', 'justify'].includes(p.align) ? p.align : 'left';
    const para: Rec = {
      type: 'paragraph', key: nextKey(),
      textAlign: align, textDirection: 'ltr',
      fontId: lead.fontId, fontFamily: lead.fontFamily, fontVariantId: lead.fontVariantId, fontSize: lead.fontSize,
      fontWeight: lead.fontWeight, fontStyle: lead.fontStyle, lineHeight: lead.lineHeight, letterSpacing: lead.letterSpacing,
      textTransform: lead.textTransform, textDecoration: lead.textDecoration, fills: lead.fills,
      children: spans,
    };
    return para;
  }).filter((p): p is Rec => !!p);
  if (!paras.length) return null;
  return {
    type: 'root',
    verticalAlign: t.valign === 'center' || t.valign === 'bottom' ? t.valign : 'top',
    children: [{ type: 'paragraph-set', children: paras }],
    fills: [],
  };
}
// ─── the archive ──────────────────────────────────────────────────────────────

/**
 * Write the binfile-v3 entries for one file. Ids are fresh uuids (or `opts.uuid`'s),
 * so two builds of the same doc are two distinct Penpot files - and, the other way
 * round, the build holds NO module state: with `opts.uuid` + `opts.now` pinned it is
 * a pure function of (doc, uuid, now) and two builds are byte-identical.
 */
export function buildPenpotEntries(doc: PenpotDoc, opts: PenpotBuildOptions = {}): PenpotBuild {
  const uuid = opts.uuid ?? penpotUuid;
  const now = opts.now ?? (() => new Date().toISOString());
  let keySeq = 0;
  const nextKey = (): string => `lolly${(++keySeq).toString(36)}`;
  const warnings: string[] = [];
  const warn = (s: string): void => { if (warnings.length < 200) warnings.push(s); };
  const entries: Record<string, Uint8Array | string> = {};
  const put = (path: string, obj: unknown): void => { entries[path] = JSON.stringify(obj); };
  const google = new Set(Array.from(doc.googleFamilies ?? [], (f) => String(f).trim().toLowerCase()));
  const fileId = uuid();
  const fileName = (doc.name && doc.name.trim()) || 'From Lolly';
  const stamp = now();

  // Media: every picture the shapes reference, once, with its storage object.
  const media = new Map<string, PenpotMedia>();
  for (const m of doc.media ?? []) {
    if (!m || !m.id || !(m.bytes instanceof Uint8Array) || !m.bytes.length) { warn('media entry without bytes skipped'); continue; }
    if (!MTYPE_EXT[m.mtype]) { warn(`media ${m.name} has unsupported type ${m.mtype}; skipped`); continue; }
    if (!(m.width > 0 && m.height > 0)) { warn(`media ${m.name} has no size; skipped`); continue; }
    media.set(m.id, m);
  }
  const mediaRecords = new Map<string, { mediaId: string; objectId: string }>();
  for (const m of media.values()) {
    const objectId = uuid();
    mediaRecords.set(m.id, { mediaId: m.id, objectId });
    put(`objects/${objectId}.json`, { id: objectId, size: m.bytes.length, contentType: m.mtype, bucket: 'file-media-object' });
    entries[`objects/${objectId}${MTYPE_EXT[m.mtype]}`] = m.bytes;
    put(`files/${fileId}/media/${m.id}.json`, {
      id: m.id, name: m.name || 'image', width: Math.max(1, Math.round(m.width)), height: Math.max(1, Math.round(m.height)),
      mtype: m.mtype, mediaId: objectId, isLocal: true, createdAt: stamp,
    });
  }

  // Pages + shapes.
  const pageIds: string[] = [];
  let shapeCount = 0;
  const pages = doc.pages.length ? doc.pages : [{ name: 'Page 1', shapes: [] }];
  pages.forEach((page, index) => {
    const pageId = uuid();
    pageIds.push(pageId);
    const pageRec: Rec = { id: pageId, name: (page.name && page.name.trim()) || `Page ${index + 1}`, index };
    const bg = parsePenpotColor(page.background);
    if (bg) pageRec.background = bg.hex;
    put(`files/${fileId}/pages/${pageId}.json`, pageRec);

    const topIds: string[] = [];
    const emit = (sh: PenpotIrShape, parentId: string, frameId: string, depth: number): string | null => {
      if (shapeCount >= MAX_SHAPES) { warn('shape ceiling reached; remaining shapes dropped'); return null; }
      if (depth > 64) { warn('nesting ceiling reached; shape dropped'); return null; }
      const id = uuid();
      const nameOf = (fallback: string): string => fallback;
      let rec: Rec;
      switch (sh.type) {
        case 'board': {
          rec = baseRecord(id, 'frame', sh, parentId, frameId, pageId, media, uuid, warn, nameOf('Board'));
          const [r1, r2, r3, r4v] = radii(sh.radius, fin(sh.w), fin(sh.h));
          Object.assign(rec, { r1, r2, r3, r4: r4v, hideFillOnExport: false, growType: 'fixed' });
          if (sh.showContent) rec.showContent = true;
          shapeCount++;
          const kids: string[] = [];
          for (const child of sh.children) { const cid = emit(child, id, id, depth + 1); if (cid) kids.push(cid); }
          rec.shapes = kids;
          break;
        }
        case 'group': {
          const kids: PenpotIrShape[] = sh.children.filter(Boolean);
          if (!kids.length) return null;
          rec = baseRecord(id, 'group', sh, parentId, frameId, pageId, media, uuid, warn, nameOf('Group'));
          rec.fills = []; rec.strokes = [];
          if (sh.masked) rec.maskedGroup = true;
          shapeCount++;
          const ids: string[] = [];
          for (const child of kids) { const cid = emit(child, id, frameId, depth + 1); if (cid) ids.push(cid); }
          if (!ids.length) { shapeCount--; return null; }
          rec.shapes = ids;
          break;
        }
        case 'rect': {
          rec = baseRecord(id, 'rect', sh, parentId, frameId, pageId, media, uuid, warn, nameOf('Rectangle'));
          const [r1, r2, r3, r4v] = radii(sh.radius, fin(sh.w), fin(sh.h));
          Object.assign(rec, { r1, r2, r3, r4: r4v });
          shapeCount++;
          break;
        }
        case 'image': {
          const m = media.get(sh.media);
          if (!m) { warn(`image shape names unknown media ${sh.media}; dropped`); return null; }
          const fills: PenpotIrFill[] = [{ media: sh.media, keepAspectRatio: sh.keepAspectRatio !== false, opacity: 1 }];
          rec = baseRecord(id, 'rect', { ...sh, fills }, parentId, frameId, pageId, media, uuid, warn, nameOf(m.name || 'Image'));
          const [r1, r2, r3, r4v] = radii(sh.radius, fin(sh.w), fin(sh.h));
          Object.assign(rec, { r1, r2, r3, r4: r4v });
          shapeCount++;
          break;
        }
        case 'circle': {
          rec = baseRecord(id, 'circle', sh, parentId, frameId, pageId, media, uuid, warn, nameOf('Ellipse'));
          shapeCount++;
          break;
        }
        case 'path': {
          const d = typeof sh.d === 'string' ? sh.d.trim() : '';
          if (!d) return null;
          rec = baseRecord(id, 'path', sh, parentId, frameId, pageId, media, uuid, warn, nameOf('Path'));
          rec.content = d;
          shapeCount++;
          break;
        }
        case 'text': {
          const content = textContentRecord(sh, google, nextKey);
          if (!content) return null;
          rec = baseRecord(id, 'text', { ...sh, fills: [] }, parentId, frameId, pageId, media, uuid, warn, nameOf('Text'));
          rec.content = content;
          rec.growType = sh.growType ?? 'fixed';
          shapeCount++;
          break;
        }
        default:
          return null;
      }
      put(`files/${fileId}/pages/${pageId}/${id}.json`, rec);
      return id;
    };
    for (const sh of page.shapes) { const id = emit(sh, PENPOT_ROOT_ID, PENPOT_ROOT_ID, 0); if (id) topIds.push(id); }

    // The root frame - Penpot's infinite-canvas origin, present in every export.
    put(`files/${fileId}/pages/${pageId}/${PENPOT_ROOT_ID}.json`, {
      id: PENPOT_ROOT_ID, name: 'Root Frame', type: 'frame',
      ...geometry(0, 0, 0.01, 0.01, 0),
      parentId: PENPOT_ROOT_ID, frameId: PENPOT_ROOT_ID, pageId,
      flipX: null, flipY: null, hideFillOnExport: false, proportionLock: false, proportion: 1,
      r1: 0, r2: 0, r3: 0, r4: 0, strokes: [], fills: [{ fillColor: '#ffffff', fillOpacity: 1 }],
      shapes: topIds,
    });
  });

  // Library colours + typographies (the Assets tab).
  for (const c of doc.palette ?? []) {
    const col = parsePenpotColor(c.color);
    if (!col || !c.name) continue;
    const id = uuid();
    const rec: Rec = { id, name: String(c.name), color: col.hex, opacity: r4(clamp(fin(c.opacity, 1), 0, 1) * col.alpha), modifiedAt: stamp };
    if (c.path && String(c.path).trim()) rec.path = String(c.path).trim();
    put(`files/${fileId}/colors/${id}.json`, rec);
  }
  for (const t of doc.typographies ?? []) {
    if (!t || !t.name || !t.fontFamily) continue;
    const id = uuid();
    const weight = clamp(Math.round(fin(t.fontWeight, 400) / 100) * 100, 100, 900);
    const rec: Rec = {
      id, name: String(t.name),
      fontId: fontIdFor(t.fontFamily, google), fontFamily: t.fontFamily,
      fontVariantId: fontVariantId(weight, t.italic === true), fontWeight: String(weight),
      fontStyle: t.italic ? 'italic' : 'normal',
      fontSize: String(r4(Math.max(1, fin(t.fontSize, 14)))), lineHeight: String(r4(Math.max(0.1, fin(t.lineHeight, 1.2)))),
      letterSpacing: String(r4(fin(t.letterSpacing, 0))), textTransform: t.textTransform || 'none', modifiedAt: stamp,
    };
    if (t.path) rec.path = t.path;
    put(`files/${fileId}/typographies/${id}.json`, rec);
  }

  // Brand tokens.
  const tokens = doc.tokens == null ? null : penpotTokensJson(doc.tokens);
  if (tokens) put(`files/${fileId}/tokens.json`, tokens);
  else if (doc.tokens != null) warn('token document carried nothing Penpot can read; tokens.json omitted');

  put(`files/${fileId}.json`, {
    id: fileId, name: fileName, revn: 0, vern: 0, version: PENPOT_FILE_VERSION,
    features: [...PENPOT_FEATURES], migrations: [...PENPOT_MIGRATIONS],
    isShared: false, hasMediaTrimmed: false, createdAt: stamp, modifiedAt: stamp,
    options: { componentsV2: true, baseFontSize: '16px' },
  });
  put('manifest.json', {
    type: 'penpot/export-files', version: 1,
    generatedBy: doc.generatedBy || 'lolly', referer: 'lolly',
    files: [{ id: fileId, name: fileName, features: [...PENPOT_FEATURES] }],
    relations: [],
  });
  return { entries, fileId, pageIds, shapeCount, mediaCount: media.size, warnings };
}

// ─── tokens.json ──────────────────────────────────────────────────────────────

/**
 * The brand's Tokens-Studio / DTCG document → what Penpot's multi-set reader
 * accepts: sets of nested groups whose leaves carry `$value` + a `$type` Penpot
 * knows (group-level `$type` is pushed down onto each leaf, unknown types such as
 * Lolly's `asset` or `lineHeights` are dropped, `$description` kept on leaves
 * only), `$themes` with the required `description`, and `$metadata` naming the
 * set order and the active sets. Null when nothing survives.
 *
 * The token document is third-party data (a brand pack's DTCG blob, JSON.parsed), so
 * every accumulator here is null-prototype: a set or group named `__proto__` must be
 * an ordinary key rather than a prototype write, and `k in sets` must answer for the
 * sets that exist rather than for `toString` / `valueOf` / `constructor`.
 */
export function penpotTokensJson(doc: unknown): Record<string, unknown> | null {
  if (!isRec(doc)) return null;
  const isTokenLeaf = (v: unknown): v is Rec => isRec(v) && ('$value' in v || 'value' in v);
  const sets: Record<string, unknown> = Object.create(null);
  const reserved = new Set(['$themes', '$metadata', '$description', '$extensions', '$type', '$schema']);
  const convert = (node: Rec, inherited: string | null): Rec | null => {
    const out: Rec = Object.create(null);
    let kept = 0;
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$')) continue;
      if (isTokenLeaf(v)) {
        const rawType = typeof v.$type === 'string' ? v.$type : (typeof v.type === 'string' ? v.type : inherited);
        const mapped = rawType ? TOKEN_TYPE_MAP[rawType] : undefined;
        // `typeof`, not truthiness: `$type: 'constructor'` would otherwise index the map's
        // prototype and write a leaf whose `$type` JSON.stringify then drops entirely.
        if (typeof mapped !== 'string') continue;
        const leaf: Rec = { $value: '$value' in v ? v.$value : v.value, $type: mapped };
        const desc = v.$description ?? v.description;
        if (typeof desc === 'string' && desc) leaf.$description = desc;
        out[k] = leaf; kept++;
      } else if (isRec(v)) {
        const groupType = typeof v.$type === 'string' ? v.$type : inherited;
        const sub = convert(v, groupType);
        if (sub) { out[k] = sub; kept++; }
      }
    }
    return kept ? out : null;
  };
  const hasSets = '$themes' in doc || '$metadata' in doc;
  if (hasSets) {
    for (const [name, v] of Object.entries(doc)) {
      if (reserved.has(name) || !isRec(v)) continue;
      const set = convert(v, typeof v.$type === 'string' ? v.$type : null);
      if (set) sets[name] = set;
    }
  } else {
    const set = convert(doc, typeof doc.$type === 'string' ? doc.$type : null);
    if (set) sets.global = set;
  }
  const setNames = Object.keys(sets);
  if (!setNames.length) return null;

  const metaIn = isRec(doc.$metadata) ? doc.$metadata : {};
  const order = (Array.isArray(metaIn.tokenSetOrder) ? metaIn.tokenSetOrder : []).map(String).filter((n) => n in sets);
  for (const n of setNames) if (!order.includes(n)) order.push(n);

  const themes: Rec[] = [];
  for (const raw of Array.isArray(doc.$themes) ? doc.$themes : []) {
    if (!isRec(raw) || typeof raw.name !== 'string' || !raw.name) continue;
    const sel: Record<string, 'enabled' | 'disabled'> = {};
    const srcSel = isRec(raw.selectedTokenSets) ? raw.selectedTokenSets : {};
    for (const [set, state] of Object.entries(srcSel)) {
      if (!(set in sets)) continue;
      sel[set] = state === 'disabled' ? 'disabled' : 'enabled';
    }
    const theme: Rec = {
      name: raw.name,
      description: typeof raw.description === 'string' ? raw.description : '',
      isSource: raw.isSource === true,
      selectedTokenSets: sel,
    };
    if (typeof raw.id === 'string' && raw.id) theme.id = raw.id;
    if (typeof raw.group === 'string' && raw.group) theme.group = raw.group;
    themes.push(theme);
  }
  // Active sets: what the first theme enables, else every set - so tokens resolve
  // the moment the file opens, without naming a theme path Penpot has to parse.
  const first = themes[0];
  const active = first
    ? Object.entries(first.selectedTokenSets as Record<string, string>).filter(([, s]) => s === 'enabled').map(([n]) => n)
    : order.slice();
  const out: Record<string, unknown> = Object.create(null);
  for (const n of order) out[n] = sets[n];
  if (themes.length) out.$themes = themes;
  out.$metadata = { tokenSetOrder: order, activeSets: active.length ? active : order.slice() };
  return out;
}

// ─── producer 1: Design boxes ─────────────────────────────────────────────────

export interface BoxesToPenpotOptions {
  name: string;
  /** The no-frames artboard size (the tool's render box). */
  canvas: { w: number; h: number };
  /** The no-frames artboard background. */
  background?: string;
  /** What the Design tool's `sans` / `mono` font keys resolve to (the brand's faces). */
  fonts?: { sans?: string; mono?: string };
  googleFamilies?: Iterable<string>;
  /** The bytes behind an image box, resolved by the shell (fetch/decode are not the engine's). */
  mediaFor?: (box: Record<string, unknown>) => PenpotMedia | null;
  /** Resolve a colour against the LIVE brand. Asked first for any `var(…)` or `{token}`
   *  value - the literal fallback inside `var(--brand-primary, #1e293b)` is a stale copy
   *  of the brand, and every shipped Design template paints that way - and asked as the
   *  last resort for anything else the parser cannot read. A caller with no live cascade
   *  (CLI, jsdom) supplies none and the literal fallback stands. */
  resolveColor?: (css: string) => string | null;
  tokens?: unknown;
  palette?: PenpotPaletteColor[];
  typographies?: PenpotIrTypography[];
  generatedBy?: string;
  /** Injectable geometry API (path boxes); defaults to the engine's own. */
  geom?: ReturnType<typeof makeGeomApi>;
}
type Box = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? '' : String(v));
const H_ALIGN = new Set(['left', 'center', 'right']);
const MARKER_CAP: Record<string, string> = { triangle: 'triangle-arrow', open: 'line-arrow', circle: 'circle-marker', diamond: 'diamond-marker', bar: 'square-marker' };

/** Lolly's `lin.srgb_<angle>_<hex[aa]>-<pos>_…` / `rad.srgb_0_…` gradient spec → the unit-box gradient. */
export function gradSpecToPenpot(spec: unknown, w: number, h: number): PenpotIrGradient | null {
  const m = /^(lin|rad)\.srgb_(-?\d+(?:\.\d+)?)_(.+)$/.exec(str(spec).trim());
  if (!m) return null;
  const stops: PenpotIrGradientStop[] = [];
  for (const part of m[3]!.split('_')) {
    const sm = /^([0-9a-f]{6})([0-9a-f]{2})?-(\d+(?:\.\d+)?)$/i.exec(part);
    if (!sm) return null;
    stops.push({ color: `#${sm[1]!.toLowerCase()}`, opacity: sm[2] ? parseInt(sm[2], 16) / 255 : 1, offset: clamp(fin(sm[3]) / 100, 0, 1) });
  }
  if (stops.length < 2) return null;
  // `rad.` is CSS's `radial-gradient(ellipse farthest-corner …)`, an ellipse that fills
  // the box - which is exactly Penpot's `width: 1` (the scale is applied in the unit box,
  // BEFORE the box maps it to px, so the aspect must not be pre-multiplied in here).
  if (m[1] === 'rad') return { type: 'radial', startX: 0.5, startY: 0.5, endX: 0.5, endY: 1, width: 1, stops };
  // CSS angle: 0 = to top, 90 = to right. The gradient line spans the box like CSS does.
  const th = fin(m[2]) * Math.PI / 180;
  const dx = Math.sin(th), dy = -Math.cos(th);
  const W = Math.max(1, w), H = Math.max(1, h);
  const L = Math.abs(W * dx) + Math.abs(H * dy);
  return {
    type: 'linear',
    startX: 0.5 - dx * L / (2 * W), startY: 0.5 - dy * L / (2 * H),
    endX: 0.5 + dx * L / (2 * W), endY: 0.5 + dy * L / (2 * H),
    stops,
  };
}

interface MdRun {
  text: string;
  color?: string;
  weight?: number;
  family?: 'sans' | 'mono';
  italic?: boolean;
  decoration?: 'underline' | 'line-through';
}
/**
 * The Design tool's inline markdown subset → runs: `{#hex w700 mono u s|text}`, `**b**`,
 * `*i*`, `_i_`, `` `code` ``. The attribute tokens are exactly the ones `inlineMd` in
 * `community/design/hooks.js` paints on the artboard - a colour, `w100`..`w900`,
 * `mono`/`sans`, and the decorations `u` (underline) / `s` (line-through) - and an
 * UNRECOGNISED token (an unreadable colour included) leaves the `{…|…}` braces standing
 * as literal text there, so it does here too: the archive must not say something the
 * artboard does not. Penpot's `textDecoration` is one enum value, so `{u s|…}` keeps
 * the underline where the artboard draws both bars.
 */
export function designTextRuns(line: string): MdRun[] {
  const out: MdRun[] = [];
  const push = (text: string, style: Omit<MdRun, 'text'>): void => { if (text) out.push({ text, ...style }); };
  const unesc = (s: string): string => s.replace(/\\\*/g, '*').replace(/\\_/g, '_');
  let rest = line;
  while (rest.length) {
    const m = /\{([^|{}]+)\|([^{}]*)\}|\*\*([^*]+)\*\*|`([^`]+)`|(?<![\w\\])\*([^*\s][^*]*?)\*(?!\w)|(?<![\w\\])_([^_\s][^_]*?)_(?!\w)/.exec(rest);
    if (!m) { push(unesc(rest), {}); break; }
    push(unesc(rest.slice(0, m.index)), {});
    if (m[1] != null) {
      const style: Omit<MdRun, 'text'> = {};
      let known = true;
      for (const tok of m[1].trim().split(/\s+/)) {
        if (/^#[0-9a-f]{3,8}$/i.test(tok)) style.color = tok;
        else if (/^w[1-9]00$/.test(tok)) style.weight = parseInt(tok.slice(1), 10);
        else if (tok === 'mono' || tok === 'sans') style.family = tok;
        else if (tok === 'u') style.decoration = 'underline';
        else if (tok === 's') style.decoration = style.decoration ?? 'line-through';
        else { known = false; break; }
      }
      if (!known) {
        // The artboard keeps the whole run literal. Emit the `{attrs|` head as text and
        // carry on scanning the body, so its `**bold**` still reads as bold and the
        // closing brace comes out as text - what `inlineMd` leaves behind, character for
        // character.
        const head = `{${m[1]}|`;
        push(unesc(head), {});
        rest = rest.slice(m.index + head.length);
        continue;
      }
      push(unesc(m[2] ?? ''), style);
    } else if (m[3] != null) push(unesc(m[3]), { weight: 700 });
    else if (m[4] != null) push(m[4], { family: 'mono' });
    else if (m[5] != null) push(unesc(m[5]), { italic: true });
    else if (m[6] != null) push(unesc(m[6]), { italic: true });
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

/**
 * The Design tool's raw box rows → a {@link PenpotDoc}. Frames become boards with
 * their member boxes (world coordinates are Penpot's page coordinates already);
 * with no frames, one board the size of the canvas holds every box. Scratch boxes
 * (outside every frame while frames exist) land on the page's pasteboard.
 */
export function boxesToPenpotDoc(boxesIn: unknown, o: BoxesToPenpotOptions): PenpotDoc {
  const boxes: Box[] = (Array.isArray(boxesIn) ? boxesIn : []).filter(isRec);
  const geomApi = o.geom ?? makeGeomApi();
  const media: PenpotMedia[] = [];
  const byId = new Map<string, Box>();
  for (const b of boxes) { const id = str(b.id); if (id && !byId.has(id)) byId.set(id, b); }
  const google = new Set(Array.from(o.googleFamilies ?? [], (f) => String(f).trim().toLowerCase()));

  const hexOf = (p: PenpotColor): string => (p.alpha < 1 ? `${p.hex}${Math.round(p.alpha * 255).toString(16).padStart(2, '0')}` : p.hex);
  const color = (v: unknown): string | null => {
    const s = str(v).trim();
    if (!s) return null;
    // A `var(…)` or `{token}` NAMES brand data, so the live cascade answers first: the
    // literal inside `var(--brand-primary, #1e293b)` is only the authored fallback, and
    // parsePenpotColor would happily return it and never ask. With no resolver (or none
    // that answers) the literal still stands, so the headless path is unchanged.
    if (/var\(/i.test(s) || s.startsWith('{')) {
      const live = o.resolveColor?.(s) ?? null;
      const lp = live ? parsePenpotColor(live) : null;
      if (lp) return hexOf(lp);
    }
    const p = parsePenpotColor(s);
    if (p) return hexOf(p);
    const r = o.resolveColor?.(s) ?? null;
    return r && parsePenpotColor(r) ? r : null;
  };
  const familyOf = (key: unknown): string => {
    const k = str(key).trim();
    if (!k || k === 'sans') return o.fonts?.sans || 'sans-serif';
    if (k === 'mono') return o.fonts?.mono || 'monospace';
    return k.replace(/[^\w \-]/g, '').trim() || (o.fonts?.sans || 'sans-serif');
  };
  const weightOf = (b: Box): number => {
    let w = clamp(Math.round(fin(b.weight, 700) / 100) * 100, 100, 900);
    if (/mono/i.test(str(b.font)) && w > 800) w = 800;
    return w;
  };

  const effects = (b: Box, base: PenpotIrShapeBase): void => {
    const op = clamp(fin(b.opacity, 100), 0, 100) / 100;
    if (op < 1) base.opacity = op;
    const blend = str(b.blend);
    if (blend && blend !== 'normal' && BLEND_MODES.has(blend)) base.blend = blend;
    const rot = fin(b.rot);
    if (rot) base.rotation = rot;
    const shadowKind = str(b.shadow);
    if (shadowKind === 'depth') {
      const dz = clamp(fin(b.z), -300, 900);
      base.shadows = [{ style: 'drop-shadow', x: 0, y: dz * 0.15, blur: clamp(10 + dz * 0.2, 0, 300), spread: 0, color: '#000000', opacity: 0x55 / 255 }];
    } else if (shadowKind && shadowKind !== 'none') {
      const c = color(b.shadowColor) ?? '#00000055';
      const p = parsePenpotColor(c);
      base.shadows = [{ style: 'drop-shadow', x: fin(b.shadowX), y: fin(b.shadowY), blur: fin(b.shadowBlur, 10), spread: 0, color: p?.hex ?? '#000000', opacity: p?.alpha ?? 0x55 / 255 }];
    }
    const blur = fin(b.blur);
    if (blur > 0) base.blur = blur;
    const bgBlur = fin(b.bgBlur);
    if (bgBlur > 0) base.backgroundBlur = bgBlur;
  };
  const strokeOf = (b: Box): PenpotIrStroke[] => {
    const sc = color(b.stroke);
    const sw = fin(b.strokeW);
    if (!sc || !(sw > 0)) return [];
    const p = parsePenpotColor(sc);
    if (!p) return [];
    const st: PenpotIrStroke = { color: p.hex, opacity: p.alpha, width: sw, alignment: 'center' };
    const dashKind = str(b.strokeDash);
    if (dashKind === 'dashed' || dashKind === 'dotted') {
      st.style = dashKind;
      const dl = fin(b.strokeDashLen), gl = fin(b.strokeGapLen);
      if (dl > 0) st.dash = dl;
      if (gl > 0) st.gap = gl;
    }
    const cap = str(b.strokeCap);
    if (cap === 'round' || cap === 'square') { st.capStart = cap; st.capEnd = cap; }
    const hs = MARKER_CAP[str(b.headStart)], he = MARKER_CAP[str(b.headEnd)];
    if (hs) st.capStart = hs;
    if (he) st.capEnd = he;
    return [st];
  };
  const fillsOf = (b: Box, w: number, h: number): PenpotIrFill[] => {
    const grad = gradSpecToPenpot(b.grad, w, h);
    if (grad) return [{ gradient: grad }];
    const c = color(b.bg);
    if (!c) return [];
    const p = parsePenpotColor(c);
    if (!p) return [];
    return [{ color: p.hex, opacity: p.alpha }];
  };
  const nameOf = (b: Box, fallback: string): string => str(b.name).trim() || fallback;

  const lowerBox = (b: Box): PenpotIrShape | null => {
    const kind = str(b.kind) || 'box';
    if (kind === 'audio' || kind === 'camera' || kind === 'frame') return null;
    const x = fin(b.x), y = fin(b.y), w = Math.max(1, fin(b.w, 1)), h = Math.max(1, fin(b.h, 1));
    const base: PenpotIrShapeBase = { name: nameOf(b, kind), x, y, w, h };
    effects(b, base);
    let shape: PenpotIrShape | null = null;
    if (kind === 'text') {
      const text = str(b.text);
      if (!text.trim()) return null;
      const family = familyOf(b.font);
      const weight = weightOf(b);
      const fg = color(b.fg) ?? '#000000';
      const size = Math.max(1, Math.round(fin(b.fontSize, 48)));
      const lh = fin(b.lineHeight, 1.12) || 1.12;
      const tracking = clamp(fin(b.tracking), -100, 400);
      const align = H_ALIGN.has(str(b.align)) ? (str(b.align) as 'left' | 'center' | 'right') : 'center';
      const valignRaw = str(b.valign);
      const paragraphs: PenpotIrParagraph[] = text.split('\n').map((line) => {
        let ln = line;
        const mb = /^(\s*)[-*•]\s+(.*)$/.exec(ln);
        const mo = /^(\s*)(\d{1,3})\.\s+(.*)$/.exec(ln);
        if (mb) ln = `${mb[1]}•  ${mb[2]}`; else if (mo) ln = `${mo[1]}${mo[2]}.  ${mo[3]}`;
        const runs = designTextRuns(ln).map((r): PenpotIrTextRun => {
          const rc = r.color ? (color(r.color) ?? fg) : fg;
          const rp = parsePenpotColor(rc) ?? { hex: '#000000', alpha: 1 };
          return {
            text: r.text,
            fontFamily: r.family ? familyOf(r.family) : family,
            fontWeight: r.weight ?? weight, italic: r.italic === true,
            fontSize: size, lineHeight: lh, letterSpacing: tracking, color: rp.hex, opacity: rp.alpha,
            decoration: r.decoration,
          };
        });
        if (!runs.length) runs.push({ text: '', fontFamily: family, fontWeight: weight, fontSize: size, lineHeight: lh, letterSpacing: tracking, color: fg });
        return { align, runs };
      });
      shape = { ...base, type: 'text', paragraphs, valign: valignRaw === 'top' ? 'top' : valignRaw === 'bottom' ? 'bottom' : 'center', growType: 'fixed' };
      shape.strokes = strokeOf(b);
    } else if (kind === 'image') {
      const m = o.mediaFor?.(b) ?? null;
      if (!m) {
        const fills = fillsOf(b, w, h);
        if (!fills.length) return null;
        shape = { ...base, type: 'rect', fills, strokes: strokeOf(b), radius: str(b.shape) === 'rounded' ? fin(b.radius) : 0 };
      } else {
        media.push(m);
        shape = {
          ...base, type: 'image', media: m.id, keepAspectRatio: str(b.fit) !== 'fill',
          strokes: strokeOf(b), radius: str(b.shape) === 'rounded' ? fin(b.radius) : str(b.shape) === 'pill' ? Math.min(w, h) / 2 : 0,
          flipX: b.flipH === true, flipY: b.flipV === true,
        };
      }
    } else if (kind === 'path') {
      const raw = str(b.path).trim();
      if (!raw) return null;
      const dec = geomApi.decodeAuthored(raw) as { ok: boolean; value?: Array<{ kind: string; closed?: boolean; tension?: number; nodes: Array<Record<string, unknown>> }> };
      if (!dec || !dec.ok || !Array.isArray(dec.value)) return null;
      const ds: string[] = [];
      for (const src of dec.value) {
        const nodes = src.nodes.map((n) => {
          const out: Record<string, unknown> = { x: fin(n.x) * w, y: fin(n.y) * h };
          for (const k of ['hInX', 'hOutX']) if (n[k] != null) out[k] = fin(n[k]) * w;
          for (const k of ['hInY', 'hOutY']) if (n[k] != null) out[k] = fin(n[k]) * h;
          if (n.continuity) out.continuity = n.continuity;
          return out;
        });
        const res = geomApi.fromNodes({ kind: src.kind, nodes, closed: src.closed === true, tension: src.tension, decimals: 3 } as never) as { ok: boolean; d?: string };
        if (res?.ok && res.d) ds.push(res.d);
      }
      if (!ds.length) return null;
      // Box-local → page, baking rotation/mirroring into the data (Penpot path content is page-space-final).
      let m: PenpotMatrix = { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
      const rot = fin(b.rot);
      const fx = b.flipH === true, fy = b.flipV === true;
      if (rot || fx || fy) {
        const cx = w / 2, cy = h / 2, rad = rot * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
        const about: PenpotMatrix = mul(mul({ a: 1, b: 0, c: 0, d: 1, e: cx, f: cy }, { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }), { a: fx ? -1 : 1, b: 0, c: 0, d: fy ? -1 : 1, e: 0, f: 0 });
        m = mul(m, mul(about, { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy }));
      }
      const subs = transformSubpaths(parseSvgPath(ds.join(' ')), m);
      const bb = subpathBounds(subs);
      if (!bb) return null;
      shape = { ...base, type: 'path', d: subpathsToD(subs), x: bb.x, y: bb.y, w: Math.max(0.01, bb.w), h: Math.max(0.01, bb.h), rotation: 0, fills: fillsOf(b, w, h), strokes: strokeOf(b) };
    } else {
      const shapeKind = str(b.shape);
      const fills = fillsOf(b, w, h);
      const strokes = strokeOf(b);
      if (shapeKind === 'ellipse' || shapeKind === 'circle') shape = { ...base, type: 'circle', fills, strokes };
      else shape = { ...base, type: 'rect', fills, strokes, radius: shapeKind === 'rounded' ? fin(b.radius) : shapeKind === 'pill' ? Math.min(w, h) / 2 : 0 };
    }
    // A box clipped by another box (`clip`) → a masked group: the mask's outline first, then the box.
    const clipId = str(b.clip);
    const mask = clipId && clipId !== str(b.id) ? byId.get(clipId) : undefined;
    if (shape && mask) {
      const mw = Math.max(1, fin(mask.w, 1)), mh = Math.max(1, fin(mask.h, 1));
      const mshape = str(mask.shape);
      const maskShape: PenpotIrShape = (mshape === 'ellipse' || mshape === 'circle')
        ? { type: 'circle', name: 'Mask', x: fin(mask.x), y: fin(mask.y), w: mw, h: mh, rotation: fin(mask.rot), fills: [{ color: '#000000' }] }
        : { type: 'rect', name: 'Mask', x: fin(mask.x), y: fin(mask.y), w: mw, h: mh, rotation: fin(mask.rot), fills: [{ color: '#000000' }], radius: mshape === 'rounded' ? fin(mask.radius) : mshape === 'pill' ? Math.min(mw, mh) / 2 : 0 };
      return { type: 'group', name: `${shape.name ?? 'Box'} (clipped)`, x: shape.x, y: shape.y, w: shape.w, h: shape.h, masked: true, children: [maskShape, shape] };
    }
    return shape;
  };

  const frames = boxes
    .map((b, idx) => ({ b, idx }))
    .filter(({ b }) => str(b.kind) === 'frame')
    .sort((p, q) => (fin(p.b.order) - fin(q.b.order)) || (fin(p.b.x) - fin(q.b.x)) || (p.idx - q.idx));
  const shapes: PenpotIrShape[] = [];
  if (frames.length) {
    const frameIds = new Set(frames.map(({ b, idx }) => (str(b.id) || String(idx))));
    for (const { b: fb, idx } of frames) {
      const fid = str(fb.id) || String(idx);
      const children: PenpotIrShape[] = [];
      for (const cb of boxes) {
        if (str(cb.kind) === 'frame' || str(cb.frame) !== fid) continue;
        const s = lowerBox(cb); if (s) children.push(s);
      }
      const bg = color(fb.bg) ?? '#ffffff';
      const p = parsePenpotColor(bg) ?? { hex: '#ffffff', alpha: 1 };
      const board: PenpotIrBoard = {
        type: 'board', name: nameOf(fb, `Board ${shapes.length + 1}`),
        x: fin(fb.x), y: fin(fb.y), w: Math.max(1, fin(fb.w, 1)), h: Math.max(1, fin(fb.h, 1)),
        fills: [{ color: p.hex, opacity: p.alpha }],
        // A frame carries a REAL border (the Artboard add-kind seeds one), and a Penpot
        // board takes strokes like any other shape. `inner`, because the design tool
        // paints that border inside the box (`box-sizing: border-box`).
        strokes: strokeOf(fb).map((s) => ({ ...s, alignment: 'inner' as const })),
        children, showContent: fb.clipChildren === false,
      };
      effects(fb, board);
      shapes.push(board);
    }
    for (const cb of boxes) {
      if (str(cb.kind) === 'frame') continue;
      const f = str(cb.frame);
      if (f && frameIds.has(f)) continue;
      const s = lowerBox(cb); if (s) shapes.push(s);
    }
  } else {
    const children: PenpotIrShape[] = [];
    for (const cb of boxes) { const s = lowerBox(cb); if (s) children.push(s); }
    const bg = o.background == null ? null : color(o.background);
    const p = bg ? parsePenpotColor(bg) : null;
    shapes.push({
      type: 'board', name: 'Artboard', x: 0, y: 0, w: Math.max(1, fin(o.canvas.w, 1)), h: Math.max(1, fin(o.canvas.h, 1)),
      fills: p ? [{ color: p.hex, opacity: p.alpha }] : [], children,
    });
  }
  return {
    name: o.name, pages: [{ name: 'Page 1', shapes }], media,
    tokens: o.tokens, palette: o.palette, typographies: o.typographies, googleFamilies: google, generatedBy: o.generatedBy,
  };
}

// ─── producer 2: an SVG render ────────────────────────────────────────────────

export interface SvgToPenpotOptions {
  name: string;
  tokens?: unknown;
  palette?: PenpotPaletteColor[];
  typographies?: PenpotIrTypography[];
  googleFamilies?: Iterable<string>;
  generatedBy?: string;
  /** Board background; absent = transparent board. */
  background?: string;
  /** Injectable uuid source for the media ids the lowering assigns (seeded in tests). */
  uuid?: () => string;
  /** A sink for the same notes {@link SvgToPenpotResult.notes} carries. A DECLINED
   *  lowering returns null and takes its result (and its notes) with it, so a caller
   *  that wants to log WHY the whole SVG became one picture passes an array here. */
  notes?: string[];
}
/** An `<image>` whose bytes the caller must supply before building (an http(s) href). */
export interface PenpotPendingImage { mediaId: string; href: string; width: number; height: number; name: string }
export interface SvgToPenpotResult {
  doc: PenpotDoc;
  width: number;
  height: number;
  /** Images the lowering could not decode itself (non-data hrefs). Resolve each into
   *  `doc.media` (same `id`) or drop the placeholder shape by leaving it unresolved. */
  pending: PenpotPendingImage[];
  /** Why a construct was simplified, for the caller's log. */
  notes: string[];
}

interface SvgTag { name: string; attrs: Record<string, string>; selfClosing: boolean; closing: boolean; start: number; end: number }
interface Frame {
  m: PenpotMatrix;
  fill: string | null | undefined;      // undefined = inherit default (black), null = none
  fillOpacity: number;
  stroke: string | null;
  strokeWidth: number;
  strokeOpacity: number;
  strokeDash: string;
  strokeCap: string;
  opacity: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: string;
  textAnchor: string;
  letterSpacing: number;
  blend: string;
  visible: boolean;
}
interface GradientDef {
  type: 'linear' | 'radial';
  units: 'objectBoundingBox' | 'userSpaceOnUse';
  x1: number; y1: number; x2: number; y2: number;
  cx: number; cy: number; r: number;
  href: string;
  transform: string;
  stops: PenpotIrGradientStop[];
}

const BAIL_TAGS = new Set(['filter', 'mask', 'clippath', 'pattern', 'foreignobject', 'use', 'symbol', 'marker', 'textpath', 'style', 'switch', 'animate', 'animatetransform', 'animatemotion', 'set']);
const SKIP_TAGS = new Set(['title', 'desc', 'metadata', 'defs']);

function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? '');
  return out;
}
function decodeEntities(s: string): string {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, ent: string) => {
    const e = ent.toLowerCase();
    if (e === 'amp') return '&'; if (e === 'lt') return '<'; if (e === 'gt') return '>';
    if (e === 'quot') return '"'; if (e === 'apos') return "'"; if (e === 'nbsp') return ' ';
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16) || 32);
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10) || 32);
    return all;
  });
}
function parseStyle(s: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!s) return out;
  for (const part of s.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}
function parseTransform(s: string | undefined): PenpotMatrix | null {
  if (!s || !s.trim()) return { ...IDENT };
  let m: PenpotMatrix = { ...IDENT };
  const re = /(matrix|translate|scale|rotate|skewx|skewy)\s*\(([^)]*)\)/gi;
  let hit: RegExpExecArray | null;
  let any = false;
  while ((hit = re.exec(s))) {
    any = true;
    const fn = hit[1]!.toLowerCase();
    const a = hit[2]!.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (a.some((n) => !Number.isFinite(n))) return null;
    let t: PenpotMatrix;
    if (fn === 'matrix' && a.length === 6) t = { a: a[0]!, b: a[1]!, c: a[2]!, d: a[3]!, e: a[4]!, f: a[5]! };
    else if (fn === 'translate') t = { a: 1, b: 0, c: 0, d: 1, e: a[0] ?? 0, f: a[1] ?? 0 };
    else if (fn === 'scale') t = { a: a[0] ?? 1, b: 0, c: 0, d: a[1] ?? a[0] ?? 1, e: 0, f: 0 };
    else if (fn === 'rotate') {
      const r = (a[0] ?? 0) * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
      const rot: PenpotMatrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
      if (a.length >= 3) t = mul(mul({ a: 1, b: 0, c: 0, d: 1, e: a[1]!, f: a[2]! }, rot), { a: 1, b: 0, c: 0, d: 1, e: -a[1]!, f: -a[2]! });
      else t = rot;
    } else if (fn === 'skewx') t = { a: 1, b: 0, c: Math.tan((a[0] ?? 0) * Math.PI / 180), d: 1, e: 0, f: 0 };
    else if (fn === 'skewy') t = { a: 1, b: Math.tan((a[0] ?? 0) * Math.PI / 180), c: 0, d: 1, e: 0, f: 0 };
    else return null;
    m = mul(m, t);
  }
  return any ? m : null;
}
function parseLen(v: string | undefined, d = 0, ref = 0): number {
  if (v == null || v === '') return d;
  const m = /^(-?\d*\.?\d+(?:e[-+]?\d+)?)\s*(px|pt|mm|cm|in|%|em|rem)?$/i.exec(v.trim());
  if (!m) return d;
  const n = parseFloat(m[1]!);
  switch ((m[2] ?? 'px').toLowerCase()) {
    case '%': return ref * n / 100;
    case 'pt': return n * 96 / 72;
    case 'mm': return n * 96 / 25.4;
    case 'cm': return n * 96 / 2.54;
    case 'in': return n * 96;
    case 'em': case 'rem': return n * 16;
    default: return n;
  }
}
/** Base64 → bytes without depending on Buffer or atob being present. */
export function decodeBase64(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const len = clean.length;
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array(Math.floor(len * 3 / 4) - pad);
  let o = 0, bits = 0, acc = 0;
  for (let i = 0; i < len; i++) {
    const ch = clean[i]!;
    if (ch === '=') break;
    const v = A.indexOf(ch);
    if (v < 0) continue;
    acc = (acc << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; if (o < out.length) out[o++] = (acc >> bits) & 0xff; }
  }
  return o === out.length ? out : out.slice(0, o);
}
/** A `data:` URL's bytes + type, or null. */
export function decodeDataUrl(href: string): { bytes: Uint8Array; mtype: string } | null {
  const m = /^data:([^;,]+)?((?:;[^;,]+)*),([\s\S]*)$/i.exec(href.trim());
  if (!m) return null;
  const mtype = (m[1] || 'application/octet-stream').toLowerCase();
  const isB64 = /;base64/i.test(m[2] ?? '');
  const payload = m[3] ?? '';
  const bytes = isB64 ? decodeBase64(payload) : new TextEncoder().encode(decodeURIComponent(payload));
  return { bytes, mtype };
}

/**
 * Stored pixel dimensions from an image's own header - PNG, GIF, JPEG, WebP, and an
 * SVG's width/height or viewBox. Null when unreadable, so the caller measures.
 */
export function imageDimensions(bytes: Uint8Array, mtype?: string): { w: number; h: number } | null {
  const b = bytes;
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
    return { w: b[6]! | (b[7]! << 8), h: b[8]! | (b[9]! << 8) };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: (b[i + 7]! << 8) | b[i + 8]!, h: (b[i + 5]! << 8) | b[i + 6]! };
      }
      const len = (b[i + 2]! << 8) | b[i + 3]!;
      if (len < 2) break;
      i += 2 + len;
    }
    return null;
  }
  if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const tag = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
    if (tag === 'VP8X') return { w: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), h: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
    if (tag === 'VP8L') { const b0 = b[21]!, b1 = b[22]!, b2 = b[23]!, b3 = b[24]!; return { w: 1 + (((b1 & 0x3f) << 8) | b0), h: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) }; }
    if (tag === 'VP8 ') return { w: (b[26]! | (b[27]! << 8)) & 0x3fff, h: (b[28]! | (b[29]! << 8)) & 0x3fff };
    return null;
  }
  const looksSvg = mtype === 'image/svg+xml' || (b.length > 5 && (b[0] === 0x3c || (b[0] === 0xef && b[3] === 0x3c)));
  if (looksSvg) {
    const head = new TextDecoder().decode(b.subarray(0, Math.min(b.length, 4096)));
    const tag = /<svg\b([^>]*)>/i.exec(head);
    if (!tag) return null;
    const a = parseAttrs(tag[1]!);
    const vb = (a.viewbox ?? '').trim().split(/[\s,]+/).map(Number);
    const vbW = vb.length === 4 && Number.isFinite(vb[2]) ? vb[2]! : 0, vbH = vb.length === 4 && Number.isFinite(vb[3]) ? vb[3]! : 0;
    const w = parseLen(a.width, vbW, vbW), h = parseLen(a.height, vbH, vbH);
    return w > 0 && h > 0 ? { w: Math.round(w), h: Math.round(h) } : null;
  }
  return null;
}

/**
 * Lower an SVG document to a one-board {@link PenpotDoc}. Permissive where Penpot
 * has the construct (solid + gradient paint, strokes with dashes and caps, opacity,
 * blend modes, groups, embedded images, plain `<text>` runs); null where it does
 * not (filters, masks, clip paths, patterns, `<use>`, `<foreignObject>`, `<style>`
 * sheets, positioned `<tspan>`s, an unreadable paint or transform) - the caller
 * then keeps the SVG whole as one picture.
 */
export function svgToPenpotDoc(svgText: string, o: SvgToPenpotOptions): SvgToPenpotResult | null {
  if (typeof svgText !== 'string' || !svgText.trim() || svgText.length > MAX_SVG_LEN) return null;
  const src = svgText.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
  const notes: string[] = [];
  // Notes ride the result, and ALSO the caller's own sink (`o.notes`) - the one place a
  // caller can still read why a lowering declined after it has returned null.
  const note = (s: string): void => { if (notes.length < 100) notes.push(s); if (o.notes && o.notes.length < 100) o.notes.push(s); };

  // Tokenise.
  const tags: SvgTag[] = [];
  const re = /<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (tags.length > MAX_SVG_TAGS) return null;
    const name = m[2]!.toLowerCase().replace(/^svg:/, '');
    if (BAIL_TAGS.has(name)) { note(`<${name}> is not expressible; kept as a picture`); return null; }
    tags.push({ name, attrs: parseAttrs(m[3] ?? ''), selfClosing: m[4] === '/', closing: m[1] === '/', start: m.index, end: m.index + m[0].length });
  }
  const rootIdx = tags.findIndex((t) => t.name === 'svg' && !t.closing);
  if (rootIdx < 0) return null;
  const root = tags[rootIdx]!;
  const vb = (root.attrs.viewbox ?? '').trim().split(/[\s,]+/).map(Number);
  const hasVb = vb.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0;
  const width = Math.round(parseLen(root.attrs.width, hasVb ? vb[2]! : 0, hasVb ? vb[2]! : 0));
  const height = Math.round(parseLen(root.attrs.height, hasVb ? vb[3]! : 0, hasVb ? vb[3]! : 0));
  if (!(width > 0 && height > 0)) return null;
  let rootM: PenpotMatrix = { ...IDENT };
  if (hasVb) {
    const par = (root.attrs.preserveaspectratio ?? 'xMidYMid meet').trim().toLowerCase();
    const sx = width / vb[2]!, sy = height / vb[3]!;
    if (par === 'none') rootM = { a: sx, b: 0, c: 0, d: sy, e: -vb[0]! * sx, f: -vb[1]! * sy };
    else {
      const s = par.includes('slice') ? Math.max(sx, sy) : Math.min(sx, sy);
      const ox = (width - vb[2]! * s) / 2, oy = (height - vb[3]! * s) / 2;
      rootM = { a: s, b: 0, c: 0, d: s, e: ox - vb[0]! * s, f: oy - vb[1]! * s };
    }
  }

  // Gradient defs (anywhere in the document; href chains one level).
  const grads = new Map<string, GradientDef>();
  for (let i = 0; i < tags.length; i++) {
    const t = tags[i]!;
    if (t.closing || (t.name !== 'lineargradient' && t.name !== 'radialgradient')) continue;
    const id = t.attrs.id;
    if (!id) continue;
    const a = t.attrs;
    const g: GradientDef = {
      type: t.name === 'radialgradient' ? 'radial' : 'linear',
      units: (a.gradientunits ?? 'objectBoundingBox').toLowerCase() === 'userspaceonuse' ? 'userSpaceOnUse' : 'objectBoundingBox',
      x1: 0, y1: 0, x2: 1, y2: 0, cx: 0.5, cy: 0.5, r: 0.5,
      href: (a.href ?? a['xlink:href'] ?? '').replace(/^#/, ''), transform: a.gradienttransform ?? '', stops: [],
    };
    const rel = g.units === 'objectBoundingBox';
    // A percentage is a fraction of the unit box in objectBoundingBox space and a
    // fraction of the VIEWPORT (the viewBox when there is one) in user space.
    const refW = hasVb ? vb[2]! : width, refH = hasVb ? vb[3]! : height;
    const pl = (v: string | undefined, d: number, ref: number): number => {
      if (v == null) return d;
      const s = v.trim();
      if (s.endsWith('%')) return parseFloat(s) / 100 * (rel ? 1 : ref);
      return rel ? parseFloat(s) : parseLen(s, d);
    };
    // SVG's own defaults: x2 is 100% (the unit box, or the viewport width in user space).
    g.x1 = pl(a.x1, 0, refW); g.y1 = pl(a.y1, 0, refH); g.x2 = pl(a.x2, rel ? 1 : refW, refW); g.y2 = pl(a.y2, 0, refH);
    g.cx = pl(a.cx, rel ? 0.5 : refW / 2, refW); g.cy = pl(a.cy, rel ? 0.5 : refH / 2, refH);
    g.r = pl(a.r, rel ? 0.5 : Math.sqrt(refW * refW + refH * refH) / Math.SQRT2 / 2, Math.sqrt(refW * refW + refH * refH) / Math.SQRT2);
    if (!t.selfClosing) {
      for (let j = i + 1; j < tags.length; j++) {
        const s = tags[j]!;
        if (s.closing && s.name === t.name) break;
        if (s.name !== 'stop' || s.closing) continue;
        const st = parseStyle(s.attrs.style);
        const col = parsePenpotColor(st['stop-color'] ?? s.attrs['stop-color'] ?? '#000000');
        if (!col) { note('gradient stop with an unreadable colour'); return null; }
        const so = s.attrs['stop-opacity'] ?? st['stop-opacity'];
        const off = (s.attrs.offset ?? '0').trim();
        g.stops.push({ color: col.hex, opacity: clamp((so == null ? 1 : fin(so, 1)) * col.alpha, 0, 1), offset: clamp(off.endsWith('%') ? parseFloat(off) / 100 : fin(off), 0, 1) });
      }
    }
    grads.set(id, g);
  }
  for (const g of grads.values()) if (!g.stops.length && g.href && grads.get(g.href)?.stops.length) g.stops = grads.get(g.href)!.stops;

  const google = new Set(Array.from(o.googleFamilies ?? [], (f) => String(f).trim().toLowerCase()));
  const uuid = o.uuid ?? penpotUuid;
  const media: PenpotMedia[] = [];
  const pending: PenpotPendingImage[] = [];
  const base: Frame = {
    m: rootM, fill: undefined, fillOpacity: 1, stroke: null, strokeWidth: 1, strokeOpacity: 1, strokeDash: '', strokeCap: 'butt',
    opacity: 1, fontFamily: '', fontSize: 16, fontWeight: 400, fontStyle: 'normal', textAnchor: 'start', letterSpacing: 0, blend: 'normal', visible: true,
  };

  // Frame from an element's presentation attributes + style.
  const frameFor = (parent: Frame, t: SvgTag): Frame | null => {
    const a = t.attrs, st = parseStyle(a.style);
    const get = (k: string): string | undefined => st[k] ?? a[k];
    const local = parseTransform(a.transform);
    if (local === null) { note('unreadable transform'); return null; }
    const f: Frame = { ...parent, m: mul(parent.m, local) };
    const fill = get('fill');
    if (fill != null) {
      const v = fill.trim();
      if (/^none$/i.test(v)) f.fill = null;
      else if (/^url\(/i.test(v)) f.fill = v;
      else if (parsePenpotColor(v)) f.fill = v;
      else if (/^currentcolor$/i.test(v)) f.fill = '#000000';
      else { note(`unreadable fill ${v}`); return null; }
    }
    const fo = get('fill-opacity'); if (fo != null) f.fillOpacity = clamp(fin(fo, 1), 0, 1);
    const stroke = get('stroke');
    if (stroke != null) {
      const v = stroke.trim();
      if (/^none$/i.test(v)) f.stroke = null;
      else if (parsePenpotColor(v)) f.stroke = v;
      else if (/^currentcolor$/i.test(v)) f.stroke = '#000000';
      else if (/^url\(/i.test(v)) { note('gradient stroke is not expressible'); return null; }
      else { note(`unreadable stroke ${v}`); return null; }
    }
    const sw = get('stroke-width'); if (sw != null) f.strokeWidth = Math.max(0, parseLen(sw, 1));
    const so = get('stroke-opacity'); if (so != null) f.strokeOpacity = clamp(fin(so, 1), 0, 1);
    const sd = get('stroke-dasharray'); if (sd != null) f.strokeDash = sd.trim();
    const sc = get('stroke-linecap'); if (sc != null) f.strokeCap = sc.trim().toLowerCase();
    const op = get('opacity'); if (op != null) f.opacity = parent.opacity * clamp(fin(op, 1), 0, 1); else f.opacity = parent.opacity;
    const ff = get('font-family'); if (ff != null) f.fontFamily = ff.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '');
    const fs = get('font-size'); if (fs != null) f.fontSize = Math.max(1, parseLen(fs, 16));
    const fw = get('font-weight'); if (fw != null) f.fontWeight = /^bold/i.test(fw) ? 700 : /^normal/i.test(fw) ? 400 : clamp(Math.round(fin(fw, 400) / 100) * 100, 100, 900);
    const fst = get('font-style'); if (fst != null) f.fontStyle = fst.trim().toLowerCase();
    const ta = get('text-anchor'); if (ta != null) f.textAnchor = ta.trim().toLowerCase();
    const ls = get('letter-spacing'); if (ls != null) f.letterSpacing = /normal/i.test(ls) ? 0 : parseLen(ls, 0);
    const bm = get('mix-blend-mode'); if (bm != null && BLEND_MODES.has(bm.trim())) f.blend = bm.trim();
    const vis = get('visibility'), disp = get('display');
    if ((vis && /hidden|collapse/i.test(vis)) || (disp && /none/i.test(disp))) f.visible = false;
    if (get('filter') || get('mask') || get('clip-path')) { note('filter/mask/clip-path is not expressible'); return null; }
    return f;
  };
  const gradientFor = (paint: string, bbox: { x: number; y: number; w: number; h: number }, m: PenpotMatrix): PenpotIrGradient | null => {
    const id = /^url\(\s*['"]?#([^'")]+)['"]?\s*\)/i.exec(paint)?.[1];
    const g = id ? grads.get(id) : undefined;
    if (!g || !g.stops.length) { note('paint references something that is not a gradient'); return null; }
    // gradientTransform acts in the gradient's own space (the unit box, or user space)
    // BEFORE the element's CTM. A linear gradient is exact under any affine map (a line
    // stays a line); a radial one keeps its centre and per-axis radii under a scale or
    // translate, and only rotation/skew has no Penpot equivalent.
    const gm = g.transform ? parseTransform(g.transform) : { ...IDENT };
    if (!gm) { note('unreadable gradientTransform'); return null; }
    const obb = g.units === 'objectBoundingBox';
    const toUnit = (x: number, y: number): [number, number] => {
      const [gx, gy] = apply(gm, x, y);
      if (obb) return [gx, gy];
      const [px, py] = apply(m, gx, gy);
      return [bbox.w > 0 ? (px - bbox.x) / bbox.w : 0.5, bbox.h > 0 ? (py - bbox.y) / bbox.h : 0.5];
    };
    if (g.type === 'radial') {
      if (Math.abs(gm.b) > 1e-9 || Math.abs(gm.c) > 1e-9) { note('a rotated or skewed radial gradientTransform is not expressible'); return null; }
      const [cx, cy] = toUnit(g.cx, g.cy);
      const sx = Math.abs(gm.a) || 1, sy = Math.abs(gm.d) || 1;
      // Penpot paints the semi-axes as (width * r * w) by (r * h) in the unit box, so
      // `r` is the vertical unit radius and `width` the horizontal/vertical ratio in
      // that normalized space (1 = an ellipse matching the box, h/w = a circle).
      let ru: number, width: number;
      if (obb) {
        ru = g.r * sy;
        width = sx / sy;
      } else {
        const k = meanScale(m);
        const pxY = g.r * sy * k, pxX = g.r * sx * k;
        ru = pxY / Math.max(1, bbox.h);
        width = bbox.w > 0 && bbox.h > 0 ? (pxX / bbox.w) / (pxY / bbox.h) : 1;
      }
      return { type: 'radial', startX: cx, startY: cy, endX: cx, endY: cy + ru, width: r4(width) || 1, stops: g.stops };
    }
    const [sx, sy] = toUnit(g.x1, g.y1), [ex, ey] = toUnit(g.x2, g.y2);
    return { type: 'linear', startX: sx, startY: sy, endX: ex, endY: ey, stops: g.stops };
  };
  const paintFills = (f: Frame, bbox: { x: number; y: number; w: number; h: number }): PenpotIrFill[] | null => {
    const fill = f.fill === undefined ? '#000000' : f.fill;
    if (fill === null) return [];
    if (/^url\(/i.test(fill)) {
      const g = gradientFor(fill, bbox, f.m);
      if (!g) return null;
      return [{ gradient: g, opacity: f.fillOpacity }];
    }
    const c = parsePenpotColor(fill);
    return c ? [{ color: c.hex, opacity: f.fillOpacity * c.alpha }] : [];
  };
  const strokesOf = (f: Frame): PenpotIrStroke[] => {
    if (!f.stroke || !(f.strokeWidth > 0)) return [];
    const c = parsePenpotColor(f.stroke);
    if (!c) return [];
    const s: PenpotIrStroke = { color: c.hex, opacity: f.strokeOpacity * c.alpha, width: f.strokeWidth * meanScale(f.m), alignment: 'center' };
    if (f.strokeDash && !/^none$/i.test(f.strokeDash)) {
      const nums = f.strokeDash.split(/[\s,]+/).map((v) => parseLen(v, 0)).filter((n) => Number.isFinite(n));
      if (nums.length && nums.some((n) => n > 0)) {
        const k = meanScale(f.m);
        const dash = (nums[0] ?? 0) * k, gap = (nums[1] ?? nums[0] ?? 0) * k;
        s.style = dash <= s.width * 1.05 && f.strokeCap === 'round' ? 'dotted' : 'dashed';
        s.dash = dash; s.gap = gap;
      }
    }
    if (f.strokeCap === 'round' || f.strokeCap === 'square') { s.capStart = f.strokeCap; s.capEnd = f.strokeCap; }
    return [s];
  };
  const decorate = (sh: PenpotIrShape, f: Frame, t: SvgTag): PenpotIrShape => {
    if (f.opacity < 1) sh.opacity = f.opacity;
    if (f.blend !== 'normal') sh.blend = f.blend;
    const id = t.attrs.id ?? t.attrs['data-name'] ?? t.attrs['aria-label'];
    if (id && !sh.name) sh.name = id;
    return sh;
  };
  const pathShape = (subs: SubPath[], f: Frame, t: SvgTag, name: string): PenpotIrShape | null | 'bail' => {
    const ts = transformSubpaths(subs, f.m);
    const bb = subpathBounds(ts);
    if (!bb) return null;
    const fills = paintFills(f, bb);
    if (fills === null) return 'bail';
    const strokes = strokesOf(f);
    if (!fills.length && !strokes.length) return null;
    return decorate({ type: 'path', name, d: subpathsToD(ts), x: bb.x, y: bb.y, w: Math.max(0.01, bb.w), h: Math.max(0.01, bb.h), fills, strokes }, f, t);
  };
  const boxOf = (f: Frame, x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number } => {
    const [x0, y0] = apply(f.m, x, y), [x1, y1] = apply(f.m, x + w, y + h);
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
  };

  // Walk.
  let shapeBudget = MAX_SHAPES;
  // Recursion is bounded well under the engine's stack and far above real content: a
  // document nested deeper than this is hostile, and the caller keeps it whole as a picture.
  const MAX_WALK_DEPTH = 512;
  const walk = (from: number, to: number, parent: Frame, out: PenpotIrShape[], depth = 0): boolean => {
    if (depth > MAX_WALK_DEPTH) { note('nesting ceiling reached'); return false; }
    let i = from;
    while (i < to) {
      const t = tags[i]!;
      if (t.closing) { i++; continue; }
      // Find the matching close for a container.
      let close = i;
      if (!t.selfClosing) {
        let depth = 0;
        for (let j = i + 1; j < to; j++) {
          const u = tags[j]!;
          if (u.name !== t.name) continue;
          if (u.closing) { if (depth === 0) { close = j; break; } depth--; }
          else if (!u.selfClosing) depth++;
        }
        if (close === i) close = to; // unclosed: treat the rest as its body
      }
      if (SKIP_TAGS.has(t.name) || t.name === 'lineargradient' || t.name === 'radialgradient' || t.name === 'stop') { i = close + 1; continue; }
      const f = frameFor(parent, t);
      if (!f) return false;
      if (!f.visible) { i = close + 1; continue; }
      if (--shapeBudget < 0) { note('shape ceiling reached'); return false; }
      const name = t.attrs.id ?? '';
      const a = t.attrs;
      switch (t.name) {
        case 'g': case 'svg': case 'a': {
          let gf = f;
          if (t.name === 'svg' && i !== rootIdx) gf = { ...f, m: mul(f.m, { a: 1, b: 0, c: 0, d: 1, e: parseLen(a.x), f: parseLen(a.y) }) };
          const kids: PenpotIrShape[] = [];
          // Group opacity is carried by the group itself, not multiplied into children.
          const inner: Frame = { ...gf, opacity: 1, blend: 'normal' };
          if (!walk(i + 1, close, inner, kids, depth + 1)) return false;
          if (kids.length === 1 && t.name !== 'svg') {
            const k = kids[0]!;
            if (f.opacity < 1) k.opacity = (k.opacity ?? 1) * f.opacity;
            if (f.blend !== 'normal' && !k.blend) k.blend = f.blend;
            out.push(k);
          } else if (kids.length > 1 || (t.name === 'svg' && kids.length)) {
            const bb = kids.reduce((acc, k) => ({ x0: Math.min(acc.x0, k.x), y0: Math.min(acc.y0, k.y), x1: Math.max(acc.x1, k.x + k.w), y1: Math.max(acc.y1, k.y + k.h) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
            const g: PenpotIrGroup = { type: 'group', name: name || (t.name === 'svg' ? 'SVG' : 'Group'), x: bb.x0, y: bb.y0, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0, children: kids };
            if (f.opacity < 1) g.opacity = f.opacity;
            if (f.blend !== 'normal') g.blend = f.blend;
            out.push(g);
          }
          break;
        }
        case 'rect': {
          const x = parseLen(a.x), y = parseLen(a.y), w = parseLen(a.width), h = parseLen(a.height);
          if (!(w > 0 && h > 0)) break;
          const rx = a.rx != null ? parseLen(a.rx) : (a.ry != null ? parseLen(a.ry) : 0), ry = a.ry != null ? parseLen(a.ry) : rx;
          if (isAxisAligned(f.m)) {
            const box = boxOf(f, x, y, w, h);
            const fills = paintFills(f, box);
            if (fills === null) return false;
            const strokes = strokesOf(f);
            if (!fills.length && !strokes.length) break;
            out.push(decorate({ type: 'rect', name, ...box, fills, strokes, radius: Math.max(rx, ry) * meanScale(f.m) }, f, t));
          } else {
            const r = pathShape([roundedRectSubpath(x, y, w, h, rx, ry)], f, t, name);
            if (r === 'bail') return false;
            if (r) out.push(r);
          }
          break;
        }
        case 'circle': case 'ellipse': {
          const cx = parseLen(a.cx), cy = parseLen(a.cy);
          const rx = t.name === 'circle' ? parseLen(a.r) : parseLen(a.rx), ry = t.name === 'circle' ? parseLen(a.r) : parseLen(a.ry);
          if (!(rx > 0 && ry > 0)) break;
          if (isAxisAligned(f.m)) {
            const box = boxOf(f, cx - rx, cy - ry, rx * 2, ry * 2);
            const fills = paintFills(f, box);
            if (fills === null) return false;
            const strokes = strokesOf(f);
            if (!fills.length && !strokes.length) break;
            out.push(decorate({ type: 'circle', name, ...box, fills, strokes }, f, t));
          } else {
            const r = pathShape([ellipseSubpath(cx, cy, rx, ry)], f, t, name);
            if (r === 'bail') return false;
            if (r) out.push(r);
          }
          break;
        }
        case 'line': {
          const subs: SubPath[] = [{ closed: false, segments: [{ op: 'M', x: parseLen(a.x1), y: parseLen(a.y1) }, { op: 'L', x: parseLen(a.x2), y: parseLen(a.y2) }] }];
          const r = pathShape(subs, { ...f, fill: null }, t, name);
          if (r === 'bail') return false;
          if (r) out.push(r);
          break;
        }
        case 'polyline': case 'polygon': {
          const pts = (a.points ?? '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
          if (pts.length < 4) break;
          const segs: PathSegment[] = [{ op: 'M', x: pts[0]!, y: pts[1]! }];
          for (let k = 2; k + 1 < pts.length; k += 2) segs.push({ op: 'L', x: pts[k]!, y: pts[k + 1]! });
          const r = pathShape([{ closed: t.name === 'polygon', segments: segs }], t.name === 'polyline' && f.fill === undefined ? { ...f, fill: null } : f, t, name);
          if (r === 'bail') return false;
          if (r) out.push(r);
          break;
        }
        case 'path': {
          const d = a.d ?? '';
          if (!d.trim()) break;
          let subs: SubPath[];
          try { subs = parseSvgPath(d); } catch { note('unreadable path data'); return false; }
          if (!subs.length) break;
          const r = pathShape(subs, f, t, name);
          if (r === 'bail') return false;
          if (r) out.push(r);
          break;
        }
        case 'image': {
          const href = a.href ?? a['xlink:href'] ?? '';
          const x = parseLen(a.x), y = parseLen(a.y), w = parseLen(a.width), h = parseLen(a.height);
          if (!href || !(w > 0 && h > 0)) break;
          if (!isAxisAligned(f.m)) { note('a rotated <image> is not expressible'); return false; }
          const box = boxOf(f, x, y, w, h);
          const mediaId = uuid();
          const data = /^data:/i.test(href) ? decodeDataUrl(href) : null;
          const fname = name || 'image';
          if (data) {
            if (!MTYPE_EXT[data.mtype]) { note(`embedded ${data.mtype} image is not a Penpot media type`); return false; }
            const dim = imageDimensions(data.bytes, data.mtype) ?? { w: Math.round(box.w), h: Math.round(box.h) };
            media.push({ id: mediaId, name: fname, mtype: data.mtype, width: dim.w, height: dim.h, bytes: data.bytes });
          } else {
            pending.push({ mediaId, href, width: Math.round(box.w), height: Math.round(box.h), name: fname });
          }
          const par = (a.preserveaspectratio ?? '').toLowerCase();
          out.push(decorate({ type: 'image', name: fname, ...box, media: mediaId, keepAspectRatio: par !== 'none', fills: [], strokes: [] }, f, t));
          break;
        }
        case 'text': {
          if (!isAxisAligned(f.m) && Math.abs(f.m.a * f.m.d - f.m.b * f.m.c) <= 0) { note('degenerate text transform'); return false; }
          // Inner tspans may not position themselves; the run is the concatenated text.
          let hasPositionedSpan = false;
          for (let j = i + 1; j < close; j++) {
            const u = tags[j]!;
            if (u.closing) continue;
            if (u.name !== 'tspan') { note(`<${u.name}> inside <text> is not expressible`); return false; }
            if (u.attrs.x != null || u.attrs.y != null || u.attrs.dx != null || u.attrs.dy != null || u.attrs.rotate != null) hasPositionedSpan = true;
          }
          if (hasPositionedSpan) { note('positioned <tspan> is not expressible'); return false; }
          if (a.textlength != null || a.rotate != null || a.dx != null || a.dy != null) { note('text with textLength/rotate/dx/dy is not expressible'); return false; }
          const bodyStart = tags[i]!.end, bodyEnd = tags[close]!.start;
          const text = decodeEntities(src.slice(bodyStart, bodyEnd).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
          if (!text) break;
          // Local geometry: baseline anchor → an unrotated box, then the CTM's rotation as shape rotation.
          const scale = meanScale(f.m);
          const size = f.fontSize * scale;
          const rotDeg = Math.atan2(f.m.b, f.m.a) * 180 / Math.PI;
          const lx = parseLen((a.x ?? '0').split(/[\s,]+/)[0]), ly = parseLen((a.y ?? '0').split(/[\s,]+/)[0]);
          const [px, py] = apply(f.m, lx, ly);
          const estW = Math.max(size * 0.6, text.length * size * 0.56 + Math.max(0, text.length - 1) * f.letterSpacing * scale);
          const lineH = 1.2;
          const db = (parseStyle(a.style)['dominant-baseline'] ?? a['dominant-baseline'] ?? a['alignment-baseline'] ?? '').toLowerCase();
          const ascent = db === 'middle' || db === 'central' ? size * 0.55 : db === 'hanging' || db === 'text-before-edge' ? size * 0.05 : size * 0.95;
          const align = f.textAnchor === 'middle' ? 'center' : f.textAnchor === 'end' ? 'right' : 'left';
          const ax = align === 'center' ? px - estW / 2 : align === 'right' ? px - estW : px;
          const top = py - ascent;
          const fillFrame = f.fill === undefined ? '#000000' : f.fill;
          const col = fillFrame && !/^url\(/i.test(fillFrame) ? parsePenpotColor(fillFrame) : null;
          if (fillFrame && /^url\(/i.test(fillFrame)) { note('gradient text is not expressible'); return false; }
          if (!col) break;
          const run: PenpotIrTextRun = {
            text, fontFamily: f.fontFamily || undefined, fontWeight: f.fontWeight, italic: /italic|oblique/.test(f.fontStyle),
            fontSize: size, lineHeight: lineH, letterSpacing: f.letterSpacing * scale, color: col.hex, opacity: f.fillOpacity * col.alpha,
          };
          const strokes = strokesOf(f);
          const shape: PenpotIrText = {
            type: 'text', name: name || text.slice(0, 40), x: ax, y: top, w: estW, h: size * lineH,
            paragraphs: [{ align, runs: [run] }], valign: 'top', growType: 'auto-width', strokes,
          };
          if (Math.abs(rotDeg) > 0.01) {
            // Rotate the box about the anchor point as the CTM did.
            const cx = ax + estW / 2, cy = top + size * lineH / 2;
            const rad = rotDeg * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
            const dx = cx - px, dy = cy - py;
            const ncx = px + dx * cos - dy * sin, ncy = py + dx * sin + dy * cos;
            shape.x = ncx - estW / 2; shape.y = ncy - size * lineH / 2; shape.rotation = rotDeg;
          }
          out.push(decorate(shape, f, t));
          break;
        }
        default:
          if (!t.selfClosing && close > i) { if (!walk(i + 1, close, f, out, depth + 1)) return false; }
          break;
      }
      i = close + 1;
    }
    return true;
  };
  const rootClose = (() => { let depth = 0; for (let j = rootIdx + 1; j < tags.length; j++) { const u = tags[j]!; if (u.name !== 'svg') continue; if (u.closing) { if (depth === 0) return j; depth--; } else if (!u.selfClosing) depth++; } return tags.length; })();
  const rootFrame = frameFor(base, { ...root, attrs: { ...root.attrs, transform: '' } });
  if (!rootFrame) return null;
  const children: PenpotIrShape[] = [];
  if (!walk(rootIdx + 1, rootClose, rootFrame, children)) return null;

  const bg = o.background ? parsePenpotColor(o.background) : null;
  const board: PenpotIrBoard = {
    type: 'board', name: o.name || 'Artboard', x: 0, y: 0, w: width, h: height,
    fills: bg ? [{ color: bg.hex, opacity: bg.alpha }] : [], children, showContent: false,
  };
  return {
    doc: { name: o.name, pages: [{ name: 'Page 1', shapes: [board] }], media, tokens: o.tokens, palette: o.palette, typographies: o.typographies, googleFamilies: google, generatedBy: o.generatedBy },
    width, height, pending, notes,
  };
}
function isIdentity(m: PenpotMatrix): boolean { return Math.abs(m.a - 1) < 1e-9 && Math.abs(m.d - 1) < 1e-9 && Math.abs(m.b) < 1e-9 && Math.abs(m.c) < 1e-9 && Math.abs(m.e) < 1e-9 && Math.abs(m.f) < 1e-9; }

// ─── producer 3: one picture ──────────────────────────────────────────────────

/** One board holding one picture - what a PNG/JPEG/WebP/GIF/SVG send becomes, and
 *  the whole-SVG fallback when {@link svgToPenpotDoc} declines. */
export function imageToPenpotDoc(media: PenpotMedia, o: Omit<SvgToPenpotOptions, 'background'> & { background?: string }): PenpotDoc {
  const w = Math.max(1, Math.round(media.width)), h = Math.max(1, Math.round(media.height));
  const bg = o.background ? parsePenpotColor(o.background) : null;
  const board: PenpotIrBoard = {
    type: 'board', name: o.name || media.name || 'Artboard', x: 0, y: 0, w, h,
    fills: bg ? [{ color: bg.hex, opacity: bg.alpha }] : [],
    children: [{ type: 'image', name: media.name || 'Image', x: 0, y: 0, w, h, media: media.id, keepAspectRatio: true }],
  };
  return { name: o.name, pages: [{ name: 'Page 1', shapes: [board] }], media: [media], tokens: o.tokens, palette: o.palette, typographies: o.typographies, googleFamilies: o.googleFamilies, generatedBy: o.generatedBy };
}

// ─── the import stream ────────────────────────────────────────────────────────

export interface PenpotImportResult {
  /** The imported file ids (from the `end` event). */
  fileIds: string[];
  /** Penpot's error hint/code when the import failed, else null. */
  error: string | null;
  /** The sections the stream reported, in order. */
  sections: string[];
}
/**
 * Read `import-binfile`'s server-sent-event body. Penpot writes transit-flavoured
 * JSON (`{"~:section":"~:manifest"}`, ids as `"~u<uuid>"`); the `end` event carries
 * the new file ids, an `error` event the failure.
 */
export function parsePenpotImportStream(text: string): PenpotImportResult {
  const out: PenpotImportResult = { fileIds: [], error: null, sections: [] };
  const strip = (v: unknown): string => String(v ?? '').replace(/^~[:u]/, '');
  let event = '';
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { event = ''; continue; }
    if (line.startsWith('event:')) { event = line.slice(6).trim(); continue; }
    if (!line.startsWith('data:')) continue;
    const body = line.slice(5).trim();
    let data: unknown = null;
    try { data = JSON.parse(body); } catch { data = body; }
    if (event === 'end') {
      const ids = Array.isArray(data) ? data : [data];
      for (const id of ids) { const s = strip(id); if (/^[0-9a-f-]{36}$/i.test(s)) out.fileIds.push(s); }
    } else if (event === 'error') {
      const rec = isRec(data) ? data : {};
      const hint = rec['~:hint'] ?? rec.hint ?? rec['~:code'] ?? rec.code ?? rec['~:type'] ?? body;
      out.error = strip(hint) || 'Penpot refused the import';
    } else if (event === 'progress') {
      const rec = isRec(data) ? data : {};
      const sec = strip(rec['~:section'] ?? rec.section);
      if (sec) out.sections.push(sec);
    }
  }
  if (!out.fileIds.length && !out.error) out.error = 'Penpot did not confirm the import';
  return out;
}

/** The workspace URL for a file (page optional). */
export function penpotWorkspaceUrl(teamId: string, fileId: string, pageId?: string, origin = 'https://design.penpot.app'): string {
  const q = new URLSearchParams({ 'team-id': teamId, 'file-id': fileId });
  if (pageId) q.set('page-id', pageId);
  return `${origin}/#/workspace?${q.toString()}`;
}

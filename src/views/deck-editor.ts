// SPDX-License-Identifier: MPL-2.0
/**
 * Deck Builder - live on-canvas editor overlay (render.layout:"deck").
 *
 * Mounts into the stage subtree (a region of the stage OUTSIDE #tool-canvas, like
 * doc-editor.ts / free-canvas.ts) so it SURVIVES the canvas's full-innerHTML repaint on
 * every model commit - the canvas is rebuilt each paint, the overlay is not. The 'deck'
 * layout is NOT chromeless: the input sidebar stays, and this overlay ADDS on-canvas
 * editing on top of it. See plans/50-slides-live-editor.md.
 *
 * Shipped here:
 *   • a bottom FILMSTRIP (pagination) - one thumbnail per slide, click to make it the
 *     active slide (writes `focusSlide`, which the tool freezes the preview to). Add /
 *     remove slides from the strip.
 *   • JSON + Markdown LOAD - paste a deck as JSON or Markdown and it populates the `deck`
 *     blocks array (image references become resolvable {url}/{id} refs).
 *
 * Later phases add: per-region inline rich-text editing of title/subtitle, an on-canvas
 * background + image-slot picker, and the edit-mode render-mode ↔ export handshake.
 *
 * All writes go through the runtime the overlay receives (shell-side clone-and-commit,
 * the way free-canvas commits), never by poking sidebar DOM.
 */

import {
  boxRect, withRect, moveBoxes, resizeRect, num,
  marqueeHit, alignBoxes, distributeBoxes, reorderZ, rotateGroup, selectionAABB, boxAABB,
  snapMove, snapAngle, normDragRect,
} from './free-canvas-math.ts';
import type { Box, BoxFieldConfig, HandleName, AlignEdge, Axis, ZOp, AABB, Rect } from './free-canvas-math.ts';
import { icon } from '../lib/icons.ts';
import type { IconName } from '../lib/icons.ts';
import { mountColorField } from '../components/color-field.ts';
import { parsePptxGenJs, inchesToNative } from '../lib/pptxgen-import.ts';
import type { TextRun } from '../lib/pptxgen-import.ts';
import { nearestBrandColor, isPptx, readPptx, parseColor, colorToHexString } from '@lolly/engine';
import type { PptxDeckRead, PptxReadPara, PptxParts } from '@lolly/engine';
import { escape as escapeHtml } from '../utils.ts';
import { isTypingTarget } from '../lib/typing-target.ts';

// ── types ────────────────────────────────────────────────────────────────────

interface AssetRef { url?: string; id?: string; [k: string]: unknown }

// The field-name config the free-canvas geometry helpers read a box's geometry from.
// Mirrors the SHARED box shape (see CONTRACT below) - id/x/y/w/h + optional rot, all in
// px on the slide's native canvas (e.g. 1920×1920). The tool renders each box absolutely
// positioned as a % of the slide; a text box's `text` is markdown (same renderer as slide
// content), an image box's `src` is an asset ref/url.
const BOX_CFG: BoxFieldConfig = {
  idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
};
// The 8 resize handles, in a stable order (mirrors free-canvas.ts HANDLES).
const HANDLES: HandleName[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** One slide row of the `deck` blocks input. Every field is optional / defended.
 *  `content` is a plain MARKDOWN STRING (the single source of the slide text - the first
 *  `# heading` acts as the title, the rest is body; supports ## / bullets / **bold** /
 *  *italic*). It REPLACES the old title/subtitle pair. `bg` is an OPTIONAL per-slide
 *  override - empty means "inherit the deck theme background". `theme`/`logo` are per-slide
 *  furniture overrides threaded through verbatim (resolved by the tool hook, not here). */
interface Slide {
  layout?: string;
  content?: string;
  /** 'layout' (structured template + `content`, the default) or 'freeform' (a free-canvas
   *  of hand-positioned `boxes`). SHARED contract with the tool hook: a freeform slide
   *  renders its boxes, a layout/absent slide renders content+layout. */
  mode?: string;
  /** Freeform slides only - hand-positioned elements (the free-canvas geometry shape). */
  boxes?: Box[];
  bg?: string;
  theme?: string;
  logo?: string;
  media1?: AssetRef | null;
  media2?: AssetRef | null;
  media3?: AssetRef | null;
  media4?: AssetRef | null;
  notes?: string;
  [k: string]: unknown;
}

interface DeckInput { id: string; fields?: Array<{ id: string; type?: string }> }

interface DeckRuntime {
  getModel(): Array<{ id: string; value: unknown }>;
  setInput(id: string, value: unknown): Promise<void> | void;
  setInputNoHistory?(id: string, value: unknown): Promise<void> | void;
  subscribe(fn: () => void): () => void;
}

export interface InitDeckEditorOpts {
  viewEl: HTMLElement & { _cleanup?: () => void };
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  runtime: DeckRuntime;
  host: { assets?: { pick?: (...args: unknown[]) => Promise<unknown> } };
  input: DeckInput;
  inputs: Array<{ id: string; type?: string }>;
  nativeW?: number;
  nativeH?: number;
  onDirty?: (id: string) => void;
  editTool?: (toolUrl: string, mode?: string) => Promise<unknown>;
  history?: { undo?: () => void; redo?: () => void; register?: (sync: (u: boolean, r: boolean) => void) => void };
  actions?: { export?: () => void; save?: () => void; canSave?: boolean; dirtyRef?: HTMLElement | null };
}

export interface DeckEditorHandle { destroy(): void }

const OVERLAY_CLASS = 'deck-editor';
// Which media slots each layout shows, in order - mirrors SLOTS_FOR in the tool hook so a
// thumbnail lays out the same cells the real slide does.
const SLOTS_FOR: Record<string, string[]> = {
  title: [], full: ['media1'], hero: ['media1'],
  split: ['media1', 'media2'], stack: ['media1', 'media2'], golden: ['media1', 'media2'],
  cols3: ['media1', 'media2', 'media3'], grid4: ['media1', 'media2', 'media3', 'media4'],
};
const LAYOUTS = Object.keys(SLOTS_FOR);
const MAX_SLIDES = 40;   // mirrors the tool hook's cap
const MAX_BOXES = 120;   // lock-step with MAX_BOXES in community/deck-builder/hooks.js - the tool renders at most this many boxes per freeform slide

// Static thumbnail scheme colours - mirror the tool hook's THEME_FALLBACK + schemeColors
// (community/deck-builder/hooks.js) so a themed slide's thumbnail reflects its scheme
// (light/dark/primary/accent) rather than collapsing to one swatch. The overlay can't resolve
// live brand tokens (only the hook can), so these are the blank/SUSE FALLBACK colours: exact on
// an un-branded profile, a close approximation of the theme on a branded one.
const THUMB_SCHEMES: Record<string, { bg: string; ink: string }> = {
  auto:    { bg: '#ffffff', ink: '#172029' },
  brand:   { bg: '#ffffff', ink: '#172029' },
  light:   { bg: '#ffffff', ink: '#172029' },
  dark:    { bg: '#172029', ink: '#ffffff' },
  primary: { bg: '#30ba78', ink: '#ffffff' },
  accent:  { bg: '#2453ff', ink: '#ffffff' },
};

/** Contrasting ink for a background - the same white/dark pick the tool's idealInk makes,
 *  so a thumbnail's text is legible on its slide colour. */
function idealInk(hex: string): string {
  const s = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{3,8}$/.test(s)) return '#ffffff';
  const h = s.length === 3 ? s.replace(/(.)/g, '$1$1') : (s + '000000').slice(0, 6);
  const lin = (i: number): number => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  return lum < 0.5 ? '#ffffff' : '#141b2d';
}

// ── pure helpers (exported for headless tests) ───────────────────────────────

/** A ref → its display URL, matching the tool hook's refUrl exactly. */
export function refUrl(r: unknown): string {
  return r && typeof r === 'object' && typeof (r as AssetRef).url === 'string' ? (r as AssetRef).url! : '';
}

const isHex = (s: string): boolean => /^#[0-9a-fA-F]{3,8}$/.test(s.trim());
const clampLayout = (v: unknown): string => (typeof v === 'string' && LAYOUTS.includes(v) ? v : 'title');
const asText = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Turn a loose image value (a URL string, a catalog id, a {url}/{id} ref) into a ref the
 *  runtime resolves: an http(s)/data URL → {url} (passes through untouched, the hook reads
 *  .url); anything else that looks like an id → {id} (resolved via the catalog / tool-URL
 *  path). Empty → null (renders as the placeholder slot). */
export function toMediaRef(v: unknown): AssetRef | null {
  if (!v) return null;
  if (typeof v === 'object') {
    const r = v as AssetRef;
    if (typeof r.url === 'string' && r.url) return { url: r.url };
    if (typeof r.id === 'string' && r.id) return { id: r.id };
    return null;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/^(https?:|data:)/i.test(s)) return { url: s };
  return { id: s };   // a catalog id or a Lolly tool link
}

/** Derive the slide's `content` markdown string from a loose object: an explicit `content`
 *  string wins; otherwise synthesise one from the legacy title/subtitle/body aliases as
 *  `# {title}` + a blank-line-separated body, so hand-written JSON that predates the content
 *  model still loads. Returns '' for an empty slide. */
export function deriveContent(o: Record<string, unknown>): string {
  if (typeof o.content === 'string') return o.content;
  const title = asText(o.title ?? o.heading);
  const body = asText(o.subtitle ?? o.body ?? o.text);
  const parts: string[] = [];
  if (title) parts.push('# ' + title);
  if (body) parts.push(body);
  return parts.join('\n\n');
}

/** Coerce one loose object into a defended slide record. Accepts common aliases so hand-
 *  written JSON is forgiving (image/img/media → media1; content OR title/subtitle/body →
 *  the `content` markdown string). `bg` defaults to '' - empty means "inherit the deck
 *  theme background", so a per-slide `bg` only overrides when explicitly a hex colour. */
export function coerceSlide(o: Record<string, unknown>): Slide {
  const bg = asText(o.bg ?? o.background);
  const media1 = toMediaRef(o.media1 ?? o.image ?? o.img ?? o.media ?? o.photo);
  const s: Slide = {
    layout: clampLayout(o.layout),
    content: deriveContent(o),
    bg: isHex(bg) ? bg : '',
    notes: asText(o.notes),
  };
  const theme = asText(o.theme), logo = asText(o.logo);
  if (theme) s.theme = theme;
  if (logo) s.logo = logo;
  if (media1) s.media1 = media1;
  const m2 = toMediaRef(o.media2), m3 = toMediaRef(o.media3), m4 = toMediaRef(o.media4);
  if (m2) s.media2 = m2; if (m3) s.media3 = m3; if (m4) s.media4 = m4;
  // A slide carrying images but no explicit layout reads better as a picture layout.
  if (s.layout === 'title' && media1 && !o.layout) s.layout = 'full';
  // Freeform mode + boxes are threaded through verbatim (defended). Only 'freeform' is a
  // real override - anything else means the default structured 'layout' experience.
  if (asText(o.mode) === 'freeform') s.mode = 'freeform';
  if (Array.isArray(o.boxes)) {
    const boxes = o.boxes.filter((b): b is Record<string, unknown> => !!b && typeof b === 'object').map(coerceBox);
    if (boxes.length) s.boxes = boxes;
  }
  return s;
}

let boxSeq = 0;
let colourSeq = 0;   // unique-enough id per mounted inspector colour picker
/** Any CSS colour → a safe `#rrggbb(aa)`, or '' when it isn't a colour at all.
 *  Accepts the hash-less 6-hex pptxgenjs uses, and passes hex through untouched so
 *  an authored `#fff` stays short. Anything else - a named colour, `oklch()`, a
 *  wide-gamut `color()` - resolves through the engine parser instead of being
 *  rejected: '' makes coerceBox omit the key, which silently reverted the shape to
 *  inheriting the slide. The deck wire format itself stays hex. */
export function toHex(v: unknown): string {
  const s = asText(v).trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^[0-9a-fA-F]{6}$/.test(s) || /^[0-9a-fA-F]{3}$/.test(s) || /^[0-9a-fA-F]{8}$/.test(s)) return '#' + s;
  if (!s || s.toLowerCase() === 'transparent') return '';
  const parsed = parseColor(s);
  return parsed ? colorToHexString(parsed) : '';
}
const SHAPE_NORM: Record<string, 'rect' | 'round' | 'pill' | 'ellipse'> = {
  rect: 'rect', square: 'rect', round: 'round', rounded: 'round', roundrect: 'round',
  pill: 'pill', stadium: 'pill', ellipse: 'ellipse', circle: 'ellipse', oval: 'ellipse',
};
/** The three geometries the inspector offers. `round` is not among them: since the tool's
 *  boxRadiusCss lets a `rect` carry its authored corners, "rounded" is a rectangle WITH a
 *  radius, not a separate shape - so offering both would be one control contradicting
 *  another. Legacy/imported `round` records still load, and read as Rectangle. */
type ShapeUi = 'rect' | 'pill' | 'ellipse';
function shapeUi(v: unknown): ShapeUi {
  const s = SHAPE_NORM[asText(v).toLowerCase()] || 'rect';
  return s === 'pill' ? 'pill' : s === 'ellipse' ? 'ellipse' : 'rect';
}
/** The tool's own default text size: styles.css gives an unsized .sl-box-text `3cqw`, i.e.
 *  3% of the native canvas width. Shown as the Size field's placeholder so an unset box
 *  reads as what it actually renders, without writing a value we didn't need to store. */
const DEFAULT_TEXT_PX = Math.round(1920 * 0.03);

/** Coerce a loose object into a defended freeform box (the SHARED box shape): id +
 *  kind:"text"|"image"|"box" + x/y/w/h numbers (px on the slide native canvas) + optional
 *  rot; text/color/fontSize/align/valign/fit for text, src for image, and
 *  fill/shape/radius/lineColor/lineWidth for a shape "box". Missing geometry defaults to a
 *  sensible size.
 *
 *  The record is kept MINIMAL on purpose - it is stored as JSON in a `text` sub-field, so
 *  it round-trips through URL/session state and every key costs URL budget. So: compact
 *  align codes, and every optional key omitted rather than written at its default. */
export function coerceBox(o: Record<string, unknown>): Box {
  const rawKind = asText(o.kind);
  const kind = rawKind === 'image' ? 'image' : rawKind === 'box' ? 'box' : 'text';
  const b: Box = {
    id: asText(o.id) || ('bx' + (Date.now().toString(36).slice(-3)) + (boxSeq++).toString(36)),
    kind,
    x: num(o.x as never, 0), y: num(o.y as never, 0),
    w: Math.max(1, num(o.w as never, 600)), h: Math.max(1, num(o.h as never, 300)),
  };
  const rot = num(o.rot as never, 0); if (rot) b.rot = rot;
  if (kind === 'box') {
    // A filled shape (rect / rounded / pill / ellipse), used as a card/background layer. No
    // text or image of its own - text sits in separate boxes above it (array order = z-order).
    const fill = toHex(o.fill); if (fill) b.fill = fill;
    b.shape = SHAPE_NORM[asText(o.shape).toLowerCase()] || 'rect';
    const radius = coerceRadius(o.radius); if (radius != null) b.radius = radius;
    const lc = toHex(o.lineColor ?? o.stroke); if (lc) b.lineColor = lc;
    if (o.lineWidth != null || o.strokeWidth != null) { const lw = Math.max(0, num((o.lineWidth ?? o.strokeWidth) as never, 0)); if (lw) b.lineWidth = lw; }
  } else if (kind === 'text') {
    b.text = asText(o.text);
  } else if (o.src != null) {
    b.src = o.src as Box[string];
  } else {
    const ref = toMediaRef(o.image ?? o.url); if (ref) b.src = ref.url ?? ref.id;
  }
  if (typeof o.color === 'string' && o.color) b.color = o.color;
  if (o.fontSize != null && Number.isFinite(num(o.fontSize as never, NaN))) b.fontSize = num(o.fontSize as never, 0);
  // Accept both the compact 'l'/'c'/'r' the overlay writes AND the full words 'left'/
  // 'center'/'right' (what design-style tools + hand-written JSON use). The hook's
  // BOX_ALIGN map renders both, so normalise to the compact form for a stable stored value.
  const al = ALIGN_NORM[asText(o.align).toLowerCase()];
  if (al) b.align = al;
  const va = VALIGN_NORM[asText(o.valign).toLowerCase()];
  if (va && va !== 't') b.valign = va;          // 't' is the render default - don't store it
  if (o.fit) b.fit = true;                      // omitted when off, so an unfitted box carries no key
  return b;
}

const ALIGN_NORM: Record<string, 'l' | 'c' | 'r'> = {
  l: 'l', left: 'l', c: 'c', center: 'c', centre: 'c', r: 'r', right: 'r',
};
/** Vertical text position inside the box. Mirrors the hook's BOX_VALIGN: compact codes are
 *  what we store, the full words are what hand-written / design-shaped JSON uses. */
const VALIGN_NORM: Record<string, 't' | 'm' | 'b'> = {
  t: 't', top: 't', m: 'm', middle: 'm', center: 'm', centre: 'm', b: 'b', bottom: 'b',
};

/** A shape's corner rounding, in native px: ONE number for all four corners, or a
 *  [topLeft, topRight, bottomRight, bottomLeft] array (CSS corner order) when they differ.
 *  Collapses a uniform array back to a single number so the stored record stays minimal,
 *  and returns null for "no rounding" so the key is omitted entirely. Mirrors radiusList()
 *  in the tool hook - the two must read the same shape. */
export function coerceRadius(v: unknown): number | number[] | null {
  if (Array.isArray(v)) {
    const r = [0, 1, 2, 3].map(i => Math.max(0, num(v[i] as never, 0)));
    if (r.every(n => n === r[0])) return r[0]! > 0 ? r[0]! : null;
    return r;
  }
  if (v == null) return null;
  const one = Math.max(0, num(v as never, 0));
  return one > 0 ? one : null;
}

/** A radius (number | number[] | absent) as the 4 corners it paints, for the inspector's
 *  per-corner fields. */
export function radiusCorners(v: unknown): [number, number, number, number] {
  const r = coerceRadius(v);
  if (Array.isArray(r)) return [r[0]!, r[1]!, r[2]!, r[3]!];
  const one = typeof r === 'number' ? r : 0;
  return [one, one, one, one];
}

/** Clone the boxes at `indices` for a Duplicate op: structured clones (a nested src asset
 *  ref must NOT be shared with its original), id dropped so coerceBox re-mints a fresh one,
 *  offset +off/+off native px, appended after the originals in index order. Pure - the
 *  caller re-points the selection at `ids` and commits ONCE (one undo step). */
export function duplicateBoxes(boxes: Box[], indices: number[], off = 24): { boxes: Box[]; ids: string[] } {
  const clones = indices.filter(i => boxes[i]).map(i => {
    const c = structuredClone(boxes[i]) as Record<string, unknown>;
    delete c.id;
    return coerceBox({ ...c, x: num(c.x as never, 0) + off, y: num(c.y as never, 0) + off });
  });
  return { boxes: [...boxes, ...clones], ids: clones.map(c => String(c.id)) };
}

// ── layout → freeform conversion ("switch to freeform, keep the content") ─────────
// Turning a structured layout slide into a freeform canvas EXPLODES its content into
// positioned boxes: one text box holding the slide's `content` markdown placed where the
// layout paints its text, plus one image box per FILLED media slot placed on that layout's
// slot grid. So the user drops into freeform already holding their content and fine-tunes,
// rather than starting from a blank canvas. Fractions of the native canvas mirror the CSS
// grid in the tool's styles.css (a head band on top, the slot grid below), so a converted
// slide reads like the layout it came from.
interface Frac { x: number; y: number; w: number; h: number }
const FF_PAD = 0.055, FF_GAP = 0.03, FF_HEAD = 0.24;

/** The slot-grid cell rectangles (fractions) for a layout - mirrors SLOTS_FOR + the
 *  grid-template rules in styles.css (.sl-l-*). */
function gridCells(layout: string): Frac[] {
  const gx = FF_PAD, gw = 1 - 2 * FF_PAD;
  const gy = FF_PAD + FF_HEAD + FF_GAP, gh = 1 - gy - FF_PAD;
  const cols = (n: number, weights?: number[]): Frac[] => {
    const ws = weights ?? Array<number>(n).fill(1);
    const tot = ws.reduce((a, b) => a + b, 0);
    const cells: Frac[] = []; let cx = gx;
    for (let i = 0; i < n; i++) { const cw = (gw - FF_GAP * (n - 1)) * ws[i]! / tot; cells.push({ x: cx, y: gy, w: cw, h: gh }); cx += cw + FF_GAP; }
    return cells;
  };
  const rows = (n: number): Frac[] => {
    const cells: Frac[] = []; let cy = gy; const rh = (gh - FF_GAP * (n - 1)) / n;
    for (let i = 0; i < n; i++) { cells.push({ x: gx, y: cy, w: gw, h: rh }); cy += rh + FF_GAP; }
    return cells;
  };
  switch (layout) {
    case 'full':   return [{ x: 0, y: 0, w: 1, h: 1 }];
    case 'hero':   return [{ x: 0, y: FF_PAD + FF_HEAD + FF_GAP, w: 1, h: 1 - (FF_PAD + FF_HEAD + FF_GAP) }];
    case 'split':  return cols(2);
    case 'stack':  return rows(2);
    case 'golden': return cols(2, [1.618, 1]);
    case 'cols3':  return cols(3);
    case 'grid4': {
      const halfH = (gh - FF_GAP) / 2;
      const top = cols(2).map(c => ({ ...c, h: halfH }));
      const bot = top.map(c => ({ ...c, y: gy + halfH + FF_GAP }));
      return [top[0]!, top[1]!, bot[0]!, bot[1]!];
    }
    default:       return [];
  }
}

/** Where the text (title + body) sits for a layout - centred for `title`, a caption band
 *  at the foot for `full` (over the cover image), else the head band on top. */
function textRegion(layout: string): Frac {
  if (layout === 'title') return { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  if (layout === 'full') return { x: 0.04, y: 0.76, w: 0.92, h: 0.2 };
  return { x: FF_PAD, y: FF_PAD, w: 1 - 2 * FF_PAD, h: FF_HEAD };
}

/** How the text is anchored VERTICALLY inside its region - chosen so the exploded box
 *  holds the text exactly where the template painted it, and the switch to freeform never
 *  makes it jump: `title` centres it (the layout centres the title in the whole slide),
 *  `full` drops it to the foot (the caption band sits at the bottom over the cover), and
 *  every other layout tops its head band (where those layouts pin the title). */
function textValign(layout: string): 't' | 'm' | 'b' {
  if (layout === 'title') return 'm';
  if (layout === 'full') return 'b';
  return 't';
}

/** Explode a layout slide into freeform boxes. Image boxes are pushed FIRST so a `full`
 *  slide's caption text lands ON TOP of its cover image (later boxes paint above). */
export function layoutToBoxes(slide: Slide, nativeW = 1920, nativeH = 1920): Box[] {
  const layout = clampLayout(slide.layout);
  const boxes: Box[] = [];
  const px = (f: Frac): Record<string, unknown> => ({
    x: Math.round(f.x * nativeW), y: Math.round(f.y * nativeH),
    w: Math.round(f.w * nativeW), h: Math.round(f.h * nativeH),
  });
  const slots = SLOTS_FOR[layout] ?? [];
  const cells = gridCells(layout);
  slots.forEach((field, i) => {
    const url = refUrl((slide as Record<string, unknown>)[field]);
    const cell = cells[i];
    if (url && cell) boxes.push(coerceBox({ kind: 'image', src: url, ...px(cell) }));
  });
  const content = asText(slide.content);
  if (content.trim()) {
    boxes.push(coerceBox({ kind: 'text', text: content, align: layout === 'title' ? 'c' : 'l', valign: textValign(layout), fit: true, ...px(textRegion(layout)) }));
  }
  return boxes;
}

/** Parse a JSON deck: an array of slide objects, or { slides|deck: [...] }. Throws on
 *  malformed JSON so the caller can surface a clear error. */
export function parseJsonDeck(text: string): Slide[] {
  const data = JSON.parse(text);
  const rows: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { slides?: unknown[] })?.slides) ? (data as { slides: unknown[] }).slides
    : Array.isArray((data as { deck?: unknown[] })?.deck) ? (data as { deck: unknown[] }).deck
    : [];
  return rows
    .filter(r => r && typeof r === 'object')
    .slice(0, MAX_SLIDES)
    .map(r => coerceSlide(r as Record<string, unknown>));
}

/** Parse a Markdown deck (Marp/reveal convention): a line that is exactly `---` splits
 *  slides; the whole slide chunk - headings, prose, bullets, inline bold/italic markup - IS
 *  the slide's `content` markdown string (kept verbatim, no flattening). Standalone
 *  directive lines are peeled off first: `![alt](url)` becomes the slide image (media1) and
 *  `bg: #hex` / `layout: name` set those fields; everything else is preserved as content.
 *  Returns at least one slide. */
export function parseMarkdownDeck(text: string): Slide[] {
  let src = String(text).replace(/\r\n?/g, '\n');
  // Strip a leading YAML front-matter block (Marp / Jekyll / reveal): `---\n…\n---` at the very
  // top - otherwise its closing `---` reads as a slide separator and the metadata becomes a
  // bogus first slide ("marp: true", …).
  src = src.replace(/^\uFEFF?[ \t]*\n?---[ \t]*\n[\s\S]*?\n---[ \t]*(?:\n|$)/, '');
  const chunks = src.split(/^[ \t]*---[ \t]*$/m).map(c => c.trim()).filter(Boolean);
  const slides = chunks.map((chunk): Slide => {
    const o: Record<string, unknown> = {};
    const contentLines: string[] = [];
    for (const raw of chunk.split('\n')) {
      const line = raw.trim();
      const bg = /^bg\s*:\s*(#[0-9a-fA-F]{3,8})\s*$/i.exec(line);
      const layoutDir = /^layout\s*:\s*([a-z0-9]+)\s*$/i.exec(line);
      const img = /^!\[[^\]]*\]\(([^)]+)\)\s*$/.exec(line);   // a line that is ONLY an image
      if (bg) { o.bg = bg[1]; continue; }
      if (layoutDir) { o.layout = layoutDir[1]; continue; }
      if (img) { if (o.image == null) o.image = img[1]; continue; }
      // an image embedded mid-prose still seeds the slot, but the line stays in content
      const inlineImg = /!\[[^\]]*\]\(([^)]+)\)/.exec(line);
      if (inlineImg && o.image == null) o.image = inlineImg[1];
      contentLines.push(raw);   // preserve the raw markdown (markup + indentation)
    }
    o.content = contentLines.join('\n').trim();
    if (o.image && o.layout == null) o.layout = 'full';
    return coerceSlide(o);
  });
  return slides.length ? slides : [coerceSlide({})];
}

/** The first `# heading`'s text from a content markdown string, inline formatting stripped - 
 *  the slide's "title" line, used for thumbnails + accessible labels. '' if none. */
export function contentTitle(content: string): string {
  for (const raw of String(content).split('\n')) {
    // #{1,3} only - matches the tool hook's heading regex (hooks.js), so title detection
    // here agrees with what the tool actually renders as a heading (####+ is body text).
    const h = /^#{1,3}\s+(.*)$/.exec(raw.trim());
    if (h) return mdInlineToText(h[1]!);
  }
  return '';
}

/** The first non-heading, non-blank line of a content markdown string (a leading bullet
 *  marker dropped), inline formatting stripped - a one-line body preview. '' if none. */
export function contentBody(content: string): string {
  for (const raw of String(content).split('\n')) {
    const line = raw.trim();
    if (!line || /^#{1,3}\s+/.test(line)) continue;   // #{1,3} = heading (matches the tool hook)
    return mdInlineToText(line.replace(/^[-*+]\s+/, ''));
  }
  return '';
}

/** Strip the inline Markdown we don't yet render richly, down to plain text. */
function mdInlineToText(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')       // images (handled separately)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')    // links → their text
    .replace(/\*\*([^*]+)\*\*/g, '$1')          // bold
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')    // italic
    .replace(/`([^`]+)`/g, '$1')                // code
    .trim();
}

/** True when the pasted text is a pptxgenjs BUILDER SCRIPT (require/new pptxgen + slide-builder
 *  calls) rather than plain Markdown/JSON - so parseDeck runs it through the pptxgen importer. */
export function isPptxGenSource(t: string): boolean {
  return /require\(\s*['"]pptxgenjs['"]|new\s+[A-Za-z_$][\w$]*\s*\([^)]*\)|PptxGenJS/.test(t)
    && /\.addSlide\s*\(|\.addText\s*\(|\.addShape\s*\(/.test(t);
}

/** One text element's runs → the markdown a freeform text box stores (bold/italic marks; a
 *  run's breakLine becomes a newline). */
function runsToMarkdown(runs: TextRun[]): string {
  let md = '';
  for (const r of runs) {
    let t = asText(r.text);
    if (r.bold && t) t = '**' + t + '**';
    if (r.italic && t) t = '*' + t + '*';
    md += t;
    if (r.breakLine) md += '\n';
  }
  return md.replace(/\n+$/, '');
}

/** Import a pptxgenjs builder script as FREEFORM slides: each captured element becomes a
 *  positioned box - a shape → a `box`, an image → an `image`, text runs → a `text` box - 
 *  with inches mapped onto the tool's 1920² native canvas (the pptxgen layout aspect and the
 *  deck's wide size match, so a single per-axis map keeps proportions). Colours/fonts get
 *  re-themed to the brand separately (brandifyDeck, at load time - it needs the host tokens). */
export function parsePptxGenDeck(source: string): Slide[] {
  const parsed = parsePptxGenJs(source);
  const NW = 1920;
  const wIn = parsed.layout.wIn || 13.333, hIn = parsed.layout.hIn || 7.5;
  const nx = (v: number): number => Math.round(inchesToNative(v, wIn, NW));   // x / width / radius (width axis)
  const ny = (v: number): number => Math.round(inchesToNative(v, hIn, NW));   // y / height (height axis)
  const npt = (pt: number): number => Math.round(inchesToNative(pt / 72, wIn, NW));   // points → native (WIDTH axis - the hook paints fontSize/lineWidth as cqw)
  const slides = parsed.slides.slice(0, MAX_SLIDES).map((sl): Slide => {
    const boxes: Box[] = [];
    for (const el of sl.elements) {
      if (el.type === 'shape') {
        boxes.push(coerceBox({
          kind: 'box', x: nx(el.xIn), y: ny(el.yIn), w: nx(el.wIn), h: ny(el.hIn),
          fill: el.fill, shape: el.shape,
          radius: el.radius != null ? nx(el.radius) : undefined,
          lineColor: el.line?.color, lineWidth: el.line?.widthPt != null ? npt(el.line.widthPt) : undefined,
        }));
      } else if (el.type === 'image') {
        boxes.push(coerceBox({ kind: 'image', x: nx(el.xIn), y: ny(el.yIn), w: nx(el.wIn), h: ny(el.hIn), src: el.src }));
      } else {
        const first = el.runs[0];
        boxes.push(coerceBox({
          kind: 'text', x: nx(el.xIn), y: ny(el.yIn), w: nx(el.wIn), h: ny(el.hIn),
          text: runsToMarkdown(el.runs),
          color: first?.color, fontSize: first?.sizePt != null ? npt(first.sizePt) : undefined,
          align: el.align,
        }));
      }
    }
    const s: Slide = { mode: 'freeform', boxes };
    const bg = toHex(sl.background); if (bg) s.bg = bg;
    return s;
  });
  return slides.length ? slides : [coerceSlide({})];
}

/** A read text node's paragraphs → the markdown a freeform text box stores - the binary-read
 *  sibling of runsToMarkdown: **bold** / *italic* marks; paragraph boundaries and explicit
 *  break runs (the reader emits `a:br` as a run whose text is just '\n') become line breaks.
 *  Underline has no markdown equivalent - dropped. */
function readRunsToMarkdown(paras: PptxReadPara[]): string {
  const lines = paras.map(p => {
    let md = '';
    for (const r of p.runs) {
      const t = asText(r.text);
      if (t === '\n') { md += '\n'; continue; }
      let m = t;
      if (r.bold && m) m = '**' + m + '**';
      if (r.italic && m) m = '*' + m + '*';
      md += m;
    }
    return md;
  });
  return lines.join('\n').replace(/\n+$/, '');
}

/** A pipe-table cell: '|' escaped so it can't split the row, newlines flattened (a pipe row
 *  is one line). */
const tableCell = (s: string): string => asText(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();

// Light neutral for a frame we can't materialise (missing/oversized media, charts, SmartArt)
// - reads as an empty card, and brandifyDeck may snap it onto a brand grey.
const PLACEHOLDER_FILL = '#e6e9ee';
const EMU_PER_IN = 914400;

/** Import a READ binary .pptx (the engine's readPptx model) as FREEFORM slides - the binary
 *  twin of parsePptxGenDeck, same EMU→1920² proportional mapping, one box per node:
 *  text → a `text` box (runs → markdown, colour/size from the first run - a text node's own
 *  fill is dropped, one box per node), shape → a `box`, pic → an `image` via `getMediaUrl`
 *  (null → a placeholder card + a small label), table → a `text` box holding a markdown pipe
 *  table, chart/SmartArt/OLE (`unknown`) → a placeholder card + a small label. Boxes cap at
 *  MAX_BOXES per slide (the tool renders no more). Colours re-theme to the brand separately
 *  (brandifyDeck - it needs the host tokens). */
export function pptxDeckToSlides(deck: PptxDeckRead, getMediaUrl?: (path: string) => string | null): Slide[] {
  const NW = 1920;
  const wIn = deck.widthEmu / EMU_PER_IN || 13.333, hIn = deck.heightEmu / EMU_PER_IN || 7.5;
  const nx = (emu: number): number => Math.round(inchesToNative(emu / EMU_PER_IN, wIn, NW));   // x / width (width axis)
  const ny = (emu: number): number => Math.round(inchesToNative(emu / EMU_PER_IN, hIn, NW));   // y / height (height axis)
  const npt = (pt: number): number => Math.round(inchesToNative(pt / 72, wIn, NW));            // points → native (WIDTH axis - the hook paints fontSize/lineWidth as cqw)
  const slides = deck.slides.slice(0, MAX_SLIDES).map((sl): Slide => {
    const boxes: Array<Record<string, unknown>> = [];
    // Light card + a small label naming the loss - shared by unresolvable media and the
    // chart/SmartArt/OLE frames, so what didn't survive import is visible on the slide.
    const placeholder = (geo: { x: number; y: number; w: number; h: number; rot?: number }, label: string): void => {
      boxes.push({ kind: 'box', ...geo, fill: PLACEHOLDER_FILL });
      const pad = Math.max(8, Math.round(Math.min(geo.w, geo.h) * 0.08));
      boxes.push({
        kind: 'text', text: label,
        x: geo.x + pad, y: geo.y + pad, w: Math.max(1, geo.w - 2 * pad), h: Math.max(1, geo.h - 2 * pad),
        rot: geo.rot, fontSize: npt(12), color: '#172029',   // explicit dark ink - the card is light
      });
    };
    for (const node of sl.nodes) {
      if (boxes.length >= MAX_BOXES) break;   // the tool renders at most MAX_BOXES per slide
      const geo = { x: nx(node.xEmu), y: ny(node.yEmu), w: nx(node.cxEmu), h: ny(node.cyEmu), rot: node.rot };
      if (node.type === 'text') {
        const first = node.paras[0]?.runs[0];
        boxes.push({
          kind: 'text', ...geo, text: readRunsToMarkdown(node.paras),
          // .hex regardless of scheme provenance - brandify re-snaps it to the brand anyway.
          // toHex here because coerceBox stores `color` verbatim (the reader's hex is bare).
          color: toHex(first?.color?.hex) || undefined,
          fontSize: first?.sizePt != null ? npt(first.sizePt) : undefined,
        });
      } else if (node.type === 'shape') {
        boxes.push({
          kind: 'box', ...geo, fill: node.fill?.hex,
          shape: node.geom === 'ellipse' ? 'ellipse' : node.geom === 'roundRect' ? 'round' : 'rect',
          lineColor: node.line?.hex,
          // The reader doesn't surface a:ln w yet; the tool draws a border only when BOTH
          // lineColor and lineWidth are set, so an outline needs a default visible width.
          lineWidth: node.line?.hex ? Math.max(2, npt(1)) : undefined,
        });
      } else if (node.type === 'pic') {
        const src = node.media ? getMediaUrl?.(node.media) ?? null : null;
        if (src) boxes.push({ kind: 'image', ...geo, src });
        else placeholder(geo, 'Image placeholder - could not be imported');
      } else if (node.type === 'table') {
        if (!node.rows.length) continue;
        const row = (cells: string[]): string => '| ' + cells.map(tableCell).join(' | ') + ' |';
        boxes.push({
          kind: 'text', ...geo,
          text: [row(node.rows[0]!), '| ' + node.rows[0]!.map(() => '---').join(' | ') + ' |', ...node.rows.slice(1).map(row)].join('\n'),
        });
      } else {
        placeholder(geo, 'Chart / SmartArt placeholder - not editable');
      }
    }
    boxes.length = Math.min(boxes.length, MAX_BOXES);   // a placeholder pair can land one over
    return coerceSlide({ mode: 'freeform', boxes, notes: sl.notes });
  });
  return slides.length ? slides : [coerceSlide({})];
}

// Extension → mime for the media parts we inline as data: URLs; anything else (emf, tiff,
// video…) stays a placeholder.
const MEDIA_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml',
};
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;   // a data: URL beyond this bloats the stored deck

/** A .pptx media part → a data: URL an image box can store, or null when the part is
 *  missing, not an inlineable image type, or too big. Base64 is built over ~8k slices - 
 *  String.fromCharCode over a whole multi-MB part would overflow the argument stack. */
export function pptxMediaDataUrl(parts: PptxParts, path: string): string | null {
  const part = parts[path];
  if (!(part instanceof Uint8Array) || part.length > MAX_MEDIA_BYTES) return null;
  const mime = MEDIA_MIME[(/\.([a-z0-9]+)$/i.exec(path)?.[1] ?? '').toLowerCase()];
  if (!mime) return null;
  let bin = '';
  for (let i = 0; i < part.length; i += 8192) bin += String.fromCharCode(...part.subarray(i, i + 8192));
  return 'data:' + mime + ';base64,' + btoa(bin);
}

// Whole-import budget for inlined media, in data-URL chars - past it, further paths resolve
// to null (an on-slide placeholder) rather than exhausting the heap on a media-heavy deck.
const TOTAL_MEDIA_CHARS = 64 * 1024 * 1024;

/** Wrap a media resolver with per-path memoisation (null results too - a part that failed
 *  once fails for every pic referencing it) and the TOTAL_MEDIA_CHARS budget. Without the
 *  memo, N pic nodes sharing one r:embed would re-encode the same part into N distinct
 *  multi-MB strings. */
export function makeMediaResolver(resolve: (path: string) => string | null, budget = TOTAL_MEDIA_CHARS): (path: string) => string | null {
  const cache = new Map<string, string | null>();
  let chars = 0;
  return (path) => {
    if (cache.has(path)) return cache.get(path) ?? null;
    const url = chars > budget ? null : resolve(path);
    if (url) chars += url.length;
    cache.set(path, url);
    return url;
  };
}

/** Route paste text to the right parser: a pptxgenjs script → the pptxgen importer; JSON if it
 *  starts with { or [ ; else Markdown. */
export function parseDeck(text: string): Slide[] {
  const t = text.trim();
  if (isPptxGenSource(t)) return parsePptxGenDeck(t);
  return t.startsWith('{') || t.startsWith('[') ? parseJsonDeck(t) : parseMarkdownDeck(t);
}

/** Build a faithful mini-slide for a thumbnail: the SAME structure the tool renders - a
 *  header (title + subtitle) over a slot grid whose template is chosen by the layout - 
 *  so the thumbnail shows the real composition (which layout, where the image sits, the
 *  slide colour + contrasting ink), not just a colour swatch. `data-layout` drives the
 *  per-layout grid template in deck-editor.css, mirroring the tool's .sl-l-* rules. */
export function buildThumbFace(slide: Slide, deckTheme = 'auto', resolved?: { bg: string; ink: string } | null): HTMLElement {
  const layout = typeof slide.layout === 'string' && SLOTS_FOR[slide.layout] ? slide.layout : 'title';
  // Prefer the ACTUAL rendered colours (read off the live slide's --bg/--ink by the caller) so
  // a brand-derived scheme - e.g. SUSE's green accent - matches the render exactly rather than
  // the static THUMB_SCHEMES approximation (which can't resolve brand tokens). Fall back to the
  // scheme: an explicit per-slide `bg` wins; else the slide/deck theme picks the scheme colours.
  const explicitBg = typeof slide.bg === 'string' && isHex(slide.bg) ? slide.bg : '';
  const slideTheme = typeof slide.theme === 'string' && slide.theme && slide.theme !== 'auto' ? slide.theme : deckTheme;
  const scheme = THUMB_SCHEMES[slideTheme] || THUMB_SCHEMES.auto!;
  const bg = resolved?.bg || explicitBg || scheme.bg;
  const face = document.createElement('div');
  face.className = 'deck-thumb__slide';
  face.dataset.layout = layout;
  face.style.background = bg;
  face.style.color = resolved?.ink || (explicitBg ? idealInk(bg) : scheme.ink);

  const content = asText(slide.content);
  const title = contentTitle(content), subtitle = contentBody(content);
  if (title || subtitle) {
    const head = document.createElement('div');
    head.className = 'deck-thumb__head';
    if (title) { const t = document.createElement('div'); t.className = 'deck-thumb__t-title'; t.textContent = title; head.appendChild(t); }
    if (subtitle) { const s = document.createElement('div'); s.className = 'deck-thumb__t-sub'; s.textContent = subtitle; head.appendChild(s); }
    face.appendChild(head);
  }

  const slots = SLOTS_FOR[layout]!;
  if (slots.length) {
    const grid = document.createElement('div');
    grid.className = 'deck-thumb__grid';
    for (const field of slots) {
      const url = refUrl((slide as Record<string, unknown>)[field]);
      const cell = document.createElement('div');
      cell.className = 'deck-thumb__slot' + (url ? ' is-filled' : '');
      if (url) {
        const im = document.createElement('img');
        im.className = 'deck-thumb__slot-img';
        im.src = url; im.alt = ''; im.loading = 'lazy';
        cell.appendChild(im);
      }
      grid.appendChild(cell);
    }
    face.appendChild(grid);
  }
  return face;
}

// ── rich-text: the slide `content` markdown subset ⇄ editable HTML (step 5) ────
// The on-canvas editor edits `content` as RICH TEXT but the stored value is a MARKDOWN
// STRING (the same subset the tool hook renders: `#`/`##`/`###` headings, `-`/`*` bullets,
// `**bold**`, `*italic*`). These two pure functions are the bridge - markdown → editable
// HTML on open, editable HTML → markdown on blur - so the round-trip is lossless for that
// subset and DOM-testable headlessly.

/** One line's inline markdown (`**bold**` / `*italic*`) → HTML. Bold is consumed first so
 *  its `**` markers never leak into the italic pass. */
function inlineMdToHtml(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/** Markdown subset → the HTML shown in the contenteditable. Consecutive bullet lines fold
 *  into one `<ul>` and consecutive numbered lines (`1.` / `1)`) into one `<ol>`; headings
 *  become `<h1..3>`; blank lines become empty paragraphs (so the paragraph structure
 *  round-trips); everything else is a `<p>`. */
export function mdToRichHtml(md: string): string {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  // One buffer for whichever kind of list is currently open - the two never interleave
  // without a flush between them, so a single { tag, items } holds both.
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  const flushList = (): void => { if (list) { out.push(`<${list.tag}>` + list.items.join('') + `</${list.tag}>`); list = null; } };
  const pushItem = (tag: 'ul' | 'ol', html: string): void => {
    if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
    list.items.push('<li>' + html + '</li>');
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) { pushItem('ul', inlineMdToHtml(bullet[2]!)); continue; }
    const numbered = /^(\s*)\d{1,9}[.)]\s+(.*)$/.exec(line);
    if (numbered) { pushItem('ol', inlineMdToHtml(numbered[2]!)); continue; }
    flushList();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) { const lvl = heading[1]!.length; out.push(`<h${lvl}>` + inlineMdToHtml(heading[2]!) + `</h${lvl}>`); continue; }
    if (line.trim() === '') { out.push('<p><br></p>'); continue; }
    out.push('<p>' + inlineMdToHtml(line) + '</p>');
  }
  flushList();
  return out.join('');
}

/** One inline node → markdown (`<strong>`→`**`, `<em>`→`*`, `<br>`→newline). */
function inlineNodeToMd(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue || '';
  if (node.nodeType !== 1) return '';
  const c = node as HTMLElement;
  const tag = c.tagName.toUpperCase();
  // A soft break (Shift+Enter, or a browser's in-block <br>) is real content - emit a
  // newline, don't drop it, or adjacent lines merge into one run of words on save.
  if (tag === 'BR') return '\n';
  const inner = inlineHtmlToMd(c);
  if (tag === 'STRONG' || tag === 'B') return '**' + inner + '**';
  if (tag === 'EM' || tag === 'I') return '*' + inner + '*';
  // The hook's inlineMd also renders `code` spans and [text](url) links - serialise
  // them back to their markdown, or a click-then-blur with NO edit would commit the
  // flattened text (the same data-loss class as tables). A link the hook rendered
  // href-less (unsafe scheme) stays plain text.
  if (tag === 'CODE') return '`' + inner + '`';
  if (tag === 'A') {
    const href = c.getAttribute('href');
    return href ? '[' + inner + '](' + href + ')' : inner;
  }
  return inner;
}

/** One inline element's children → markdown. */
function inlineHtmlToMd(el: Node): string {
  let s = '';
  for (const node of Array.from(el.childNodes)) s += inlineNodeToMd(node);
  return s;
}

/** A rendered <ul>/<ol> → markdown list lines. Recurses into a list nested inside an
 *  <li> (the hook's renderList opens a child list inside the still-open parent item)
 *  with a two-space indent per level - exactly what the hook's listItem() reads back - 
 *  so nesting round-trips instead of the child items flattening into the parent's text. */
function listToMd(el: HTMLElement, blocks: string[], depth = 0): void {
  const ordered = el.tagName.toUpperCase() === 'OL';
  let n = 1;
  for (const li of Array.from(el.children)) {
    if (li.tagName.toUpperCase() !== 'LI') continue;
    let text = '';
    const nested: HTMLElement[] = [];
    for (const node of Array.from(li.childNodes)) {
      const t = node.nodeType === 1 ? (node as HTMLElement).tagName.toUpperCase() : '';
      if (t === 'UL' || t === 'OL') nested.push(node as HTMLElement);
      else text += inlineNodeToMd(node);
    }
    blocks.push('  '.repeat(depth) + (ordered ? `${n++}. ` : '- ') + text.trim());
    for (const sub of nested) listToMd(sub, blocks, depth + 1);
  }
}

/** A rendered pipe table (the hook's readTable output) → markdown pipe rows. Cell
 *  pipes are re-escaped (`\|` - the form splitRow un-escapes), and the separator row
 *  after the header - what makes the rows a table again on re-parse - carries each
 *  column's alignment read back off the header cells' text-align styles. */
function tableToMd(el: HTMLElement, blocks: string[]): void {
  const rows = Array.from(el.querySelectorAll('tr'));
  if (!rows.length) return;
  const cells = (tr: Element): HTMLElement[] => Array.from(tr.children)
    .filter((c): c is HTMLElement => c instanceof HTMLElement && /^T[HD]$/.test(c.tagName.toUpperCase()));
  const rowMd = (tr: Element): string =>
    '| ' + cells(tr).map(c => inlineHtmlToMd(c).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()).join(' | ') + ' |';
  blocks.push(rowMd(rows[0]!));
  blocks.push('| ' + cells(rows[0]!).map(c => {
    const a = (c.style?.textAlign || '').toLowerCase();
    return a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---';
  }).join(' | ') + ' |');
  for (const tr of rows.slice(1)) blocks.push(rowMd(tr));
}

/** The contenteditable's HTML → the stored markdown-subset string. Block children map back:
 *  `<h1..3>`→`#…`, `<ul>/<ol>`→`- `/`N. ` list lines (nested lists indented),
 *  `<table>`→pipe rows, `<p>/<div>`→a plain line. Trailing empty lines (a browser's
 *  stray final paragraph) are trimmed. Must round-trip everything the deck-builder
 *  hook renders from content markdown - the inline layout editor serialises the
 *  HOOK-RENDERED slide DOM on every blur, so any structure this can't re-emit would
 *  be silently destroyed by a click-then-blur with no edit at all. */
export function richHtmlToMd(root: HTMLElement): string {
  const blocks: string[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === 3) { const txt = (node.nodeValue || '').trim(); if (txt) blocks.push(txt); continue; }
    if (node.nodeType !== 1) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (/^H[1-6]$/.test(tag)) {
      const lvl = Math.min(3, Number(tag[1]));
      blocks.push('#'.repeat(lvl) + ' ' + inlineHtmlToMd(el));
    } else if (tag === 'UL' || tag === 'OL') {
      listToMd(el, blocks);
    } else if (tag === 'LI') {
      blocks.push('- ' + inlineHtmlToMd(el));
    } else if (tag === 'TABLE') {
      tableToMd(el, blocks);
    } else {
      // p / div / anything block-level. A paragraph that is ONLY a soft break (an empty
      // <p><br></p>, the browser's blank-line marker) collapses to an empty block = the
      // blank-line separator; a paragraph with real content keeps its internal <br> newlines.
      const md = inlineHtmlToMd(el);
      blocks.push(md.trim() === '' ? '' : md);
    }
  }
  while (blocks.length && blocks[blocks.length - 1] === '') blocks.pop();
  return blocks.join('\n');
}

// ── the overlay ──────────────────────────────────────────────────────────────

export function initDeckEditor(opts: InitDeckEditorOpts): DeckEditorHandle {
  const { stageEl, input, runtime, onDirty } = opts;

  stageEl.querySelectorAll(`.${OVERLAY_CLASS}`).forEach(n => n.remove());

  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('data-deck-editor', '');

  // model access ----------------------------------------------------------------
  const readDeck = (): Slide[] => {
    const v = runtime.getModel().find(i => i.id === input.id)?.value;
    return Array.isArray(v) ? (v as Slide[]) : [];
  };
  const activeIndex = (): number => {
    const f = Number(runtime.getModel().find(i => i.id === 'focusSlide')?.value) || 0;
    return f > 0 ? f - 1 : 0;
  };
  const commitDeck = (next: Slide[]): void => {
    onDirty?.(input.id);
    runtime.setInput(input.id, next);
  };

  // Re-theme an imported deck's colours to the active brand: snap every box fill / text colour /
  // stroke / slide background to the nearest brand token (host.tokens). This is how a pptxgen
  // import "forms in our tokens" - its bespoke palette collapses onto the brand's. Fonts follow
  // automatically because the tool renders freeform text in the brand font. No brand tokens (or
  // a headless host) → the deck keeps its original colours untouched.
  async function brandifyDeck(slides: Slide[]): Promise<Slide[]> {
    let brand: Array<{ name: string; hex: string }> = [];
    try {
      const tk = (opts.host as { tokens?: { colors?: (o: unknown) => Promise<Array<{ path?: string; value?: string }>> } }).tokens;
      const sw = tk?.colors ? await tk.colors({ theme: 'light' }) : [];
      brand = (sw || []).map(s => ({ name: asText(s.path), hex: toHex(s.value) })).filter(b => !!b.hex);
    } catch { /* no brand tokens available */ }
    if (!brand.length) return slides;
    // Snap through the engine's brand mapper (Fable track E3): perceptual ΔEOK with a CHROMA GATE,
    // so a slate greys to a brand grey instead of jumping to the nearest saturated accent, and a
    // chromatic source never collapses to a neutral. Falls back to the source when unmappable.
    const snap = (v: unknown): string | undefined => {
      const h = toHex(v);
      if (!h) return typeof v === 'string' ? v : undefined;
      return nearestBrandColor(h, brand)?.hex ?? h;
    };
    return slides.map(s => {
      const out: Slide = { ...s };
      if (s.bg) out.bg = snap(s.bg);
      if (Array.isArray(s.boxes)) {
        out.boxes = (s.boxes as Box[]).map(b => {
          const nb: Box = { ...b };
          if (b.fill) nb.fill = snap(b.fill);
          if (b.color) nb.color = snap(b.color);
          if (b.lineColor) nb.lineColor = snap(b.lineColor);
          return nb;
        });
      }
      return out;
    });
  }
  // Navigation stays OUT of undo history (setInputNoHistory) so slide-hopping doesn't
  // hide real edits in the undo stack.
  // Expand the sidebar block that authors slide `i` (accordion: fold every other block), so the
  // active slide's fields are open to edit as you move through the filmstrip. Reaches into the
  // shell's blocks-input by its stable [data-block-index] contract; NEVER moves focus (so the
  // filmstrip's own arrow-key navigation keeps working). No-op when the sidebar isn't present.
  const expandSidebarBlock = (i: number): void => {
    try {
      const blocksEl = opts.viewEl.querySelector<HTMLElement>('.blocks-input[data-input-id="' + input.id + '"]');
      if (!blocksEl) return;
      const items = Array.from(blocksEl.querySelectorAll<HTMLElement>('.block-item.is-typed'));
      const target = items.find(b => b.dataset.blockIndex === String(i));
      if (!target) return;
      for (const b of items) {
        const collapse = b !== target;
        if (b.classList.contains('is-collapsed') !== collapse) {
          b.classList.toggle('is-collapsed', collapse);
          const btn = b.querySelector('[data-block-collapse]');
          btn?.setAttribute('aria-label', collapse ? 'Expand block' : 'Collapse block');
          btn?.setAttribute('title', collapse ? 'Expand' : 'Collapse');
        }
      }
      target.closest('details.input-section')?.setAttribute('open', '');
      // Scroll the sidebar so the just-opened block is in view (the accordion above it just
      // collapsed, so its position moved) - deferred a frame to let that relayout settle.
      requestAnimationFrame(() => { try { target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* jsdom */ } });
    } catch { /* sidebar not present (headless) */ }
  };

  const setActive = (i: number): void => {
    const deck = readDeck();
    const clamped = Math.max(0, Math.min(deck.length - 1, i));
    (runtime.setInputNoHistory ?? runtime.setInput)('focusSlide', clamped + 1);
    expandSidebarBlock(clamped);
  };

  // active-slide helpers (shared by the toolbar, the text editor + the free-canvas) ------
  const clampedActive = (): number => {
    const deck = readDeck();
    return Math.max(0, Math.min(deck.length - 1, activeIndex()));
  };
  const activeSlide = (): Slide | undefined => readDeck()[clampedActive()];
  // Clone-and-commit a patch onto the ACTIVE slide (the shared shell-side write-back path:
  // read the live deck, clone, mutate deck[i].<field>, setInput("deck", arr) + onDirty).
  // Commit a patch to a SPECIFIC slide index (not necessarily the active one). Used by the
  // deferred text-edit commits, which must land on the slide the editor was OPENED on even if
  // the user has since navigated away (else the edit overwrites the wrong slide).
  const commitSlideAt = (i: number, patch: Partial<Slide>): void => {
    const deck = readDeck().slice();
    if (!deck[i]) return;
    deck[i] = { ...deck[i], ...patch } as Slide;
    commitDeck(deck);
  };
  const commitSlide = (patch: Partial<Slide>): void => commitSlideAt(clampedActive(), patch);
  const commitBoxesAt = (i: number, boxes: Box[]): void => commitSlideAt(i, { boxes });
  const commitBoxes = (boxes: Box[]): void => commitSlide({ boxes });

  // Native(box-space px) ↔ screen mapping, read off the LIVE canvas rect each call so a
  // repaint/resize is picked up (the overlays reposition on every model commit - subscribe).
  // ANISOTROPIC: boxes live in a fixed nativeW×nativeH space (the tool's 1920×1920), and the
  // hook places each as a % of that space applied to the REAL slide rect - so a wide (16:9)
  // slide squishes Y/height vs X/width. We must use the SAME per-axis scale or the overlay
  // frames drift below + taller than the rendered content (the "duplicated, off-size" bug).
  interface Metrics { cr: DOMRect; sr: DOMRect; scaleX: number; scaleY: number }
  const canvasMetrics = (): Metrics => {
    const cr = opts.canvasEl.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    const nw = opts.nativeW || 1920, nh = opts.nativeH || 1920;
    const scaleX = cr.width > 0 && nw > 0 ? cr.width / nw : 1;
    const scaleY = cr.height > 0 && nh > 0 ? cr.height / nh : 1;
    return { cr, sr, scaleX, scaleY };
  };

  // slide toolbar (step 7) + free-canvas layer (step 6) - created up front, (re)populated
  // by renderBar()/renderFree() on every model change.
  const bar = document.createElement('div');
  bar.className = 'deck-bar';
  bar.setAttribute('data-export-hide', '');
  overlay.appendChild(bar);

  const free = document.createElement('div');
  free.className = 'deck-free';
  free.setAttribute('data-export-hide', '');
  free.hidden = true;
  overlay.appendChild(free);

  // The freeform toolbar + inspector live HERE, docked to the stage below the slide bar - 
  // NOT inside `free` (which overlays the canvas), so they never cover the content being
  // edited. renderFree reserves matching stage space (--stage-reserve-*) so the fitted canvas
  // sits BELOW them. Empty + zero-reserve in layout mode, so that path is unchanged.
  const freeChrome = document.createElement('div');
  freeChrome.className = 'deck-free-chrome';
  freeChrome.setAttribute('data-export-hide', '');
  freeChrome.hidden = true;
  overlay.appendChild(freeChrome);

  // ── slide toolbar (step 7) ────────────────────────────────────────────────────
  const DECK_THEMES = ['auto', 'light', 'dark', 'primary', 'accent'];
  const SLIDE_LOGOS = ['auto', 'mono', 'off'];
  const MODES = ['layout', 'freeform'];
  const cap1 = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

  // Friendly labels for the on-canvas layout picker (mirrors the manifest's layout option
  // labels - makeSelect's default cap1 would render 'cols3'/'grid4' unhelpfully).
  const LAYOUT_LABELS: Record<string, string> = {
    title: 'Title only', full: 'Full bleed', hero: 'Hero + title', split: 'Side by side',
    stack: 'Stacked', golden: 'Golden ratio', cols3: 'Three columns', grid4: 'Four grid',
  };

  // Each top-bar control is an ICON + a compact select - no text caption. The icon carries a
  // `title` tooltip naming the control, the select carries the matching aria-label, so the
  // meaning survives for both hover and assistive tech while the bar stays uncluttered.
  function makeSelect(cls: string, iconName: IconName, label: string, choices: string[], value: string, onChange: (v: string) => void, labelOf: (v: string) => string = cap1): HTMLLabelElement {
    const wrap = document.createElement('label');
    wrap.className = 'deck-bar__field';
    wrap.title = label;
    const capEl = document.createElement('span');
    capEl.className = 'deck-bar__ico';
    capEl.innerHTML = icon(iconName);
    const sel = document.createElement('select'); sel.className = cls;
    sel.setAttribute('aria-label', label);
    for (const o of choices) { const op = document.createElement('option'); op.value = o; op.textContent = labelOf(o); sel.appendChild(op); }
    sel.value = value;
    sel.addEventListener('change', () => onChange(sel.value));
    wrap.append(capEl, sel);
    return wrap;
  }
  // A group wrapper so related controls read as a cluster (matches the freeform toolbar's grps).
  const barGroup = (...kids: HTMLElement[]): HTMLElement => {
    const g = document.createElement('div'); g.className = 'deck-bar__grp'; g.append(...kids); return g;
  };

  function renderBar(): void {
    bar.textContent = '';
    const slide = activeSlide();
    const deckTheme = String(runtime.getModel().find(i => i.id === 'theme')?.value ?? 'auto') || 'auto';
    const slideTheme = asText(slide?.theme), slideLogo = asText(slide?.logo);
    const mode = asText(slide?.mode) === 'freeform' ? 'freeform' : 'layout';

    // Structure cluster: mode + (in layout mode) the slide layout, and the inline-edit button.
    // Mode: switching a layout slide to freeform EXPLODES its content into positioned boxes
    // (layoutToBoxes) so the user keeps their content - but only when the slide has no boxes
    // yet, so flipping back and forth never clobbers a canvas they've already arranged.
    const structure: HTMLElement[] = [
      makeSelect('deck-bar__sel deck-bar__slide-mode', 'shapes', 'Slide mode',
        MODES, mode, (v) => {
          if (v === 'freeform') {
            const s = activeSlide();
            const hasBoxes = Array.isArray(s?.boxes) && (s!.boxes as Box[]).length > 0;
            if (s && !hasBoxes) { commitSlide({ mode: 'freeform', boxes: layoutToBoxes(s, opts.nativeW, opts.nativeH) }); return; }
          }
          commitSlide({ mode: v });
        }),
    ];
    if (mode !== 'freeform') {
      // On-canvas slide LAYOUT picker - layout mode only (freeform has no template). Mirrors
      // the sidebar's layout sub-field so the primary flow never needs the sidebar.
      const slideLayout = asText(slide?.layout);
      structure.push(makeSelect('deck-bar__sel deck-bar__slide-layout', 'grid', 'Slide layout',
        LAYOUTS, LAYOUTS.includes(slideLayout) ? slideLayout : 'title',
        (v) => commitSlide({ layout: v }), (v) => LAYOUT_LABELS[v] ?? cap1(v)));
      // Edit-text focuses the inline editor. Click-to-edit on the slide is the primary path;
      // this is the discoverable, keyboard-reachable affordance for it.
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'deck-bar__btn';
      editBtn.title = 'Edit slide text';
      editBtn.setAttribute('aria-label', 'Edit slide text');
      editBtn.innerHTML = icon('pen');
      editBtn.addEventListener('click', () => openTextEditor());
      structure.push(editBtn);
    }
    bar.appendChild(barGroup(...structure));

    // Styling cluster: deck theme (GLOBAL - committed via setInput("theme"), never the deck
    // clone), then this slide's theme + logo overrides.
    bar.appendChild(barGroup(
      makeSelect('deck-bar__sel deck-bar__deck-theme', 'palette', 'Deck theme',
        DECK_THEMES, DECK_THEMES.includes(deckTheme) ? deckTheme : 'auto',
        (v) => { onDirty?.('theme'); runtime.setInput('theme', v); }),
      makeSelect('deck-bar__sel deck-bar__slide-theme', 'droplet', 'Slide theme',
        DECK_THEMES, DECK_THEMES.includes(slideTheme) ? slideTheme : 'auto',
        (v) => commitSlide({ theme: v })),
      makeSelect('deck-bar__sel deck-bar__slide-logo', 'seal', 'Slide logo',
        SLIDE_LOGOS, SLIDE_LOGOS.includes(slideLogo) ? slideLogo : 'auto',
        (v) => commitSlide({ logo: v })),
    ));
  }

  // ── inline layout-slide text editing ───────────────────────────────────────────
  // Edit the REAL rendered slide text in place - the actual `.sl-head` / `.sl-body` in the
  // tool canvas become contenteditable, so you type on the slide at its true size/position,
  // no popup. The trick that makes this safe against the tool's every-commit canvas repaint:
  // we DON'T commit while typing, so the model never changes mid-edit and the tool never
  // repaints the editable out from under the caret. The edit lands (and the sidebar's own
  // `content` field updates with it) on blur / Escape / navigating away - one commit, one
  // repaint, at the end.
  interface LayoutEdit { slideIdx: number; regions: HTMLElement[]; toolbar: HTMLElement; injected: HTMLElement | null }
  let layoutEdit: LayoutEdit | null = null;
  const isEditingLayout = (): boolean => layoutEdit !== null;

  const onEditorKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); commitLayoutEdit(); }
  };
  // The rendered element(s) that hold this slide's editable text: the title band and the
  // body. A truly empty slide has neither - we inject a bare editable body so it can still
  // be typed into (returned as `injected` so it's removed cleanly if the edit is abandoned).
  function editRegions(slideEl: HTMLElement): { regions: HTMLElement[]; injected: HTMLElement | null } {
    // Direct children only (a nested `.sl-body` inside a slot must not become editable) - 
    // filtered by class rather than a `:scope >` selector so it's robust across engines.
    const found = Array.from(slideEl.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && (c.classList.contains('sl-head') || c.classList.contains('sl-body')),
    );
    if (found.length) return { regions: found, injected: null };
    const body = document.createElement('div');
    body.className = 'sl-body';
    body.innerHTML = '<p><br></p>';
    // Before the corner furniture so it reads as slide content, not over the logo.
    const furniture = slideEl.querySelector('.sl-logo, .sl-pageno');
    slideEl.insertBefore(body, furniture ?? null);
    return { regions: [body], injected: body };
  }
  // Serialise the editable regions back to the slide's `content` markdown. Head (its <h1>) →
  // `# title`; body blocks → their lines. Joined, the hook re-lifts the first heading as the
  // title on the next render, so this round-trips.
  function serializeLayout(regions: HTMLElement[]): string {
    return regions.map(r => richHtmlToMd(r)).filter(md => md.trim() !== '').join('\n\n');
  }
  function teardownLayoutEdit(): void {
    if (!layoutEdit) return;
    for (const r of layoutEdit.regions) {
      r.removeAttribute('contenteditable');
      r.removeAttribute('role');
      r.removeAttribute('aria-label');
      r.classList.remove('is-editing');
    }
    layoutEdit.injected?.remove();
    layoutEdit.toolbar.remove();
    layoutEdit = null;
    document.removeEventListener('keydown', onEditorKey, true);
  }
  function commitLayoutEdit(): void {
    if (!layoutEdit) return;
    const { slideIdx, regions } = layoutEdit;
    const md = serializeLayout(regions);
    teardownLayoutEdit();
    // Commit to the slide the edit OPENED on (blur can fire after navigation), and only when
    // it actually changed - a no-op edit shouldn't churn a repaint or an undo entry.
    if (md !== asText(readDeck()[slideIdx]?.content)) commitSlideAt(slideIdx, { content: md });
  }

  /** Place the caret where the user clicked, rather than selecting the region - so the first
   *  keystroke edits, never replaces. Falls back to the end of the text. */
  function caretAt(region: HTMLElement, at: { x: number; y: number } | null): void {
    const sel = document.defaultView?.getSelection?.();
    if (!sel) return;
    const range = document.createRange();
    let placed = false;
    if (at) {
      const doc = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      };
      try {
        // Two names for one feature: WebKit/Blink ship caretRangeFromPoint, Gecko the
        // standard caretPositionFromPoint. Neither exists in jsdom.
        const r = doc.caretRangeFromPoint?.(at.x, at.y);
        if (r && region.contains(r.startContainer)) { range.setStart(r.startContainer, r.startOffset); placed = true; }
        else {
          const p = doc.caretPositionFromPoint?.(at.x, at.y);
          if (p && region.contains(p.offsetNode)) { range.setStart(p.offsetNode, p.offset); placed = true; }
        }
      } catch { /* unsupported - fall through to the end */ }
    }
    if (!placed) range.selectNodeContents(region);
    range.collapse(placed);   // caret point → collapse to it; fallback → END, never select-all
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // A compact floating format bar (bold / italic / H2 / bullet / numbered), styled like the
  // freeform toolbar for a consistent look. It acts on whichever region has the selection;
  // pointerdown-preventDefault keeps that selection alive through the click.
  function buildTextFormatBar(exec: (c: string, val?: string) => void): HTMLElement {
    const fmt = document.createElement('div');
    fmt.className = 'deck-fmt';
    fmt.setAttribute('data-export-hide', '');
    const cmd = (label: string, title: string, run: () => void, cls = ''): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'deck-fmt__btn' + cls; b.title = title;
      b.setAttribute('aria-label', title);
      b.textContent = label;
      b.addEventListener('pointerdown', (e) => e.preventDefault());   // keep the editable's selection
      b.addEventListener('click', run);
      return b;
    };
    fmt.append(
      cmd('B', 'Bold (⌘B)', () => exec('bold'), ' deck-fmt__btn--b'),
      cmd('I', 'Italic (⌘I)', () => exec('italic'), ' deck-fmt__btn--i'),
      cmd('H', 'Heading', () => exec('formatBlock', 'h2')),
      cmd('•', 'Bulleted list', () => exec('insertUnorderedList')),
      cmd('1.', 'Numbered list', () => exec('insertOrderedList')),
    );
    return fmt;
  }
  function positionFormatBar(): void {
    if (!layoutEdit) return;
    const m = canvasMetrics();
    // +44 top clears the deck bar that docks over the canvas on a tall/square deck (mirrors
    // the freeform toolbar's offset), so the format bar never hides behind it.
    layoutEdit.toolbar.style.left = (m.cr.left - m.sr.left + 8) + 'px';
    layoutEdit.toolbar.style.top = (m.cr.top - m.sr.top + 44) + 'px';
  }

  /** Enter inline editing on the active layout slide. `at` (client coords) targets the caret
   *  and picks which region (title vs body) to focus. */
  function openTextEditor(at: { x: number; y: number } | null = null): void {
    if (layoutEdit) { commitLayoutEdit(); return; }
    const slide = activeSlide();
    if (!slide || asText(slide.mode) === 'freeform') return;
    const idx = clampedActive();
    const slideEl = opts.canvasEl.querySelector<HTMLElement>('.slides .sl-slide--' + idx);
    if (!slideEl) return;

    const { regions, injected } = editRegions(slideEl);
    for (const r of regions) {
      r.setAttribute('contenteditable', 'true');   // setAttribute (not .contentEditable) so it reflects everywhere
      r.setAttribute('role', 'textbox');
      r.setAttribute('aria-label', r.classList.contains('sl-head') ? 'Slide title' : 'Slide body');
      r.classList.add('is-editing');
    }

    // execCommand acts on the current selection (in whichever region has focus); refocus that
    // region afterward so the caret stays put.
    const exec = (c: string, val?: string): void => {
      const active = (document.activeElement instanceof HTMLElement && regions.includes(document.activeElement))
        ? document.activeElement : regions[0]!;
      try { document.execCommand(c, false, val); } catch { /* jsdom / unsupported */ }
      active.focus();
    };
    const toolbar = buildTextFormatBar(exec);
    overlay.appendChild(toolbar);
    layoutEdit = { slideIdx: idx, regions, toolbar, injected };
    positionFormatBar();
    document.addEventListener('keydown', onEditorKey, true);

    // Bold / Italic keyboard chords - ONLY those two: browsers route ⌘B/⌘I into a
    // contenteditable, so binding them (with preventDefault so the native default doesn't
    // also fire) is safe. NOT ⌘1/2/8 - those are the browser's reserved switch-to-tab-N
    // accelerators, un-preventable, so they'd leave the app AND not format. Headings and
    // lists live on the visible format bar.
    for (const r of regions) {
      r.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') return;   // handled by the capture-phase onEditorKey
        if (!((ev as KeyboardEvent).metaKey || (ev as KeyboardEvent).ctrlKey) || ev.altKey || ev.shiftKey) return;
        const k = ev.key.toLowerCase();
        if (k === 'b') { ev.preventDefault(); exec('bold'); }
        else if (k === 'i') { ev.preventDefault(); exec('italic'); }
      });
      // Commit when focus leaves the editing surface entirely (to another slide, the sidebar,
      // anywhere that isn't a region or the format bar). Deferred a tick so moving BETWEEN
      // the two regions, or clicking a format button, doesn't count as leaving.
      r.addEventListener('focusout', () => {
        setTimeout(() => {
          if (!layoutEdit) return;
          const ae = document.activeElement;
          const inside = ae instanceof Node && (layoutEdit.regions.some(rr => rr.contains(ae)) || layoutEdit.toolbar.contains(ae));
          if (!inside) commitLayoutEdit();
        }, 0);
      });
    }

    // Focus the clicked region (title vs body), or the first, and drop the caret at the click.
    const target = (at && regions.find(r => {
      const rc = r.getBoundingClientRect();
      return at.x >= rc.left && at.x <= rc.right && at.y >= rc.top && at.y <= rc.bottom;
    })) || regions[0]!;
    target.focus();
    caretAt(target, at);
  }

  // ── per-slide free-canvas (step 6+) ────────────────────────────────────────────
  // A design-grade editor over the ACTIVE freeform slide's boxes, reusing the shared,
  // tested geometry in free-canvas-math (move/resize/rotate/align/distribute/z-order/marquee/
  // snap). Multi-select (shift/⌘-click + marquee), a group bounding box with a rotate handle,
  // snap guides, arrow-nudge and copy/paste. All writes clone-and-commit deck[i].boxes.
  const SNAP_SCREEN = 6;   // snap tolerance in SCREEN px (converted to native per gesture)
  let selection = new Set<number>();
  let primary = -1;        // the single box whose resize/rotate handles show
  let lastActiveIdx = -1;  // active slide at the last render - a change resets the selection
  let boxEls: HTMLElement[] = [];
  let guidesLayer: HTMLElement | null = null;
  let marqueeEl: HTMLElement | null = null;
  let clipboard: Box[] = [];
  interface Gesture {
    type: 'move' | 'resize' | 'rotate' | 'marquee';
    idx: number;
    handle?: HandleName;
    indices: number[];
    startClient: { x: number; y: number };
    startBoxes: Box[];
    startRect?: Rect;
    centre?: { x: number; y: number };
    startAngle?: number;
    marqueeBase?: Set<number>;
    marqueeOrigin?: { x: number; y: number };
    plainClick?: boolean;   // a non-additive pointerdown (candidate for click-through collapse)
    moved?: boolean;        // the pointer actually dragged (so it wasn't just a click)
    scaleX: number;
    scaleY: number;
    live: Box[];
  }
  let gesture: Gesture | null = null;
  const selIndices = (): number[] => [...selection].sort((a, b) => a - b);
  const idOf = (b: Box | undefined): string => (b && typeof b.id === 'string' ? b.id : '');
  // Re-point the selection at box IDS after an op reorders/removes boxes, so highlight +
  // subsequent ops follow the same boxes rather than stale indices.
  const setSelByIds = (boxes: Box[], ids: string[]): void => {
    selection = new Set(ids.map(id => boxes.findIndex(b => idOf(b) === id)).filter(i => i >= 0));
    primary = selection.size === 1 ? selIndices()[0]! : -1;
  };
  // Freeform text-box edit state: which box (if any) is open as a live contenteditable, plus
  // a stored commit closure so a click elsewhere can flush it. And a pointerdown timestamp for
  // double-click detection (the dblclick EVENT is unreliable - selecting rebuilds the box DOM
  // between the two clicks - so we detect it from two quick pointerdowns on the same box).
  let editingBox = -1;
  let boxEditCommit: (() => void) | null = null;
  let lastDown = { idx: -1, t: 0 };
  const activeBoxes = (): Box[] => { const b = activeSlide()?.boxes; return Array.isArray(b) ? b : []; };

  function positionBoxEls(boxes: Box[], scaleX: number, scaleY: number): void {
    for (let i = 0; i < boxEls.length; i++) {
      const box = boxes[i]; const el = boxEls[i];
      if (!box || !el) continue;
      const r = boxRect(box, BOX_CFG);
      el.style.left = (r.x * scaleX) + 'px';
      el.style.top = (r.y * scaleY) + 'px';
      el.style.width = (r.w * scaleX) + 'px';
      el.style.height = (r.h * scaleY) + 'px';
      el.style.transform = r.rot ? `rotate(${r.rot}deg)` : '';
    }
  }

  // The overlay box is a TRANSPARENT interactive frame that sits ON TOP of the tool hook's
  // live render - it draws NO image/text of its own (that would duplicate the rendered content
  // and, on any coordinate drift, show a second mis-placed copy). It carries only the frame +
  // selection handles; a text box's editable is populated on demand while editing.
  function buildBoxEl(box: Box, i: number): HTMLElement {
    const el = document.createElement('div');
    const kindCls = box.kind === 'image' ? ' deck-free-box--img' : box.kind === 'box' ? ' deck-free-box--shape' : ' deck-free-box--text';
    el.className = 'deck-free-box' + (selection.has(i) ? ' is-sel' : '') + kindCls;
    el.dataset.idx = String(i);
    if (box.kind === 'image') {
      const src = typeof box.src === 'string' ? box.src : refUrl(box.src);
      // Empty image box: the hook renders nothing, so show a hint + a faint fill; a filled box
      // stays transparent so the hook's picture shows through the frame.
      if (!src) { el.classList.add('is-empty'); const hint = document.createElement('span'); hint.className = 'deck-free-box__hint'; hint.textContent = 'Double-click to add an image'; el.appendChild(hint); }
    } else if (box.kind === 'box') {
      // A shape: the hook renders the fill/stroke beneath; the overlay is only the transparent
      // interactive frame (drag / resize / rotate). No content of its own.
    } else {
      // Empty transparent text host - the hook renders the text beneath; startBoxTextEdit fills
      // this node (and makes it opaque) only while the box is being edited.
      const tx = document.createElement('div');
      tx.className = 'deck-free-box__text';
      el.appendChild(tx);
    }
    el.addEventListener('pointerdown', (e) => startMove(e as PointerEvent, i));
    // Resize + rotate handles show only for a SINGLE selected box (a multi-selection gets
    // the group bounding box's rotate handle instead - see renderFree).
    if (selection.size === 1 && i === primary) {
      for (const h of HANDLES) {
        const hd = document.createElement('div');
        hd.className = 'deck-free-h deck-free-h--' + h;
        hd.dataset.handle = h;
        hd.addEventListener('pointerdown', (e) => startResize(e as PointerEvent, i, h));
        el.appendChild(hd);
      }
      const rot = document.createElement('div');
      rot.className = 'deck-free-rot';
      rot.title = 'Rotate';
      rot.addEventListener('pointerdown', (e) => startRotate(e as PointerEvent));
      el.appendChild(rot);
    }
    return el;
  }

  function buildToolbar(): HTMLElement {
    const tools = document.createElement('div');
    tools.className = 'deck-free__tools';
    const hasSel = selection.size > 0;
    const btn = (label: string, title: string, cls: string, run: () => void, disabled = false, svg?: string): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'deck-free__btn' + cls; b.title = title; b.disabled = disabled;
      if (svg) { b.innerHTML = svg; b.setAttribute('aria-label', title); } else b.textContent = label;
      b.addEventListener('pointerdown', (e) => e.stopPropagation());   // a toolbar click never starts a marquee
      b.addEventListener('click', run);
      return b;
    };
    const grp = (...kids: HTMLElement[]): HTMLElement => { const g = document.createElement('div'); g.className = 'deck-free__grp'; g.append(...kids); return g; };
    tools.append(
      grp(
        btn('+ Text', 'Add a text box', '', () => addBox('text')),
        btn('+ Image', 'Add an image box', '', () => addBox('image')),
        btn('+ Shape', 'Add a shape', '', () => addBox('box')),
      ),
      grp(
        btn('', 'Align left', ' deck-free__btn--icon', () => doAlign('left'), !hasSel, icon('alignL')),
        btn('', 'Align centre', ' deck-free__btn--icon', () => doAlign('hcentre'), !hasSel, icon('alignC')),
        btn('', 'Align right', ' deck-free__btn--icon', () => doAlign('right'), !hasSel, icon('alignR')),
        btn('', 'Align top', ' deck-free__btn--icon', () => doAlign('top'), !hasSel, icon('alignT')),
        btn('', 'Align middle', ' deck-free__btn--icon', () => doAlign('vcentre'), !hasSel, icon('alignM')),
        btn('', 'Align bottom', ' deck-free__btn--icon', () => doAlign('bottom'), !hasSel, icon('alignB')),
      ),
      grp(
        btn('', 'Distribute horizontally', ' deck-free__btn--icon', () => doDistribute('h'), selection.size < 3, icon('distH')),
        btn('', 'Distribute vertically', ' deck-free__btn--icon', () => doDistribute('v'), selection.size < 3, icon('distV')),
      ),
      grp(
        btn('', 'Bring to front', ' deck-free__btn--icon', () => doZ('front'), !hasSel, icon('orderFront')),
        btn('', 'Bring forward', ' deck-free__btn--icon', () => doZ('forward'), !hasSel, icon('orderForward')),
        btn('', 'Send backward', ' deck-free__btn--icon', () => doZ('backward'), !hasSel, icon('orderBackward')),
        btn('', 'Send to back', ' deck-free__btn--icon', () => doZ('back'), !hasSel, icon('orderBack')),
      ),
      grp(btn('Delete', 'Delete selection', ' deck-free__btn--del', () => deleteBox(), !hasSel)),
    );
    return tools;
  }

  // ── the box inspector - per-box control values for the selection ─────────────────
  // A second toolbar row, shown only when the selection holds something to control: text
  // boxes get size / colour / align / vertical position / fit, shapes get fill / geometry /
  // corner radius / border. Every control writes to EVERY selected box of its kind, so a
  // multi-selection restyles in one gesture.
  //
  // The row above it aligns BOXES TO EACH OTHER; these controls set what's INSIDE a box.
  // They're deliberately labelled fields rather than icons - icon-for-icon they'd be the
  // same six arrows as the arrange row, meaning something else entirely.
  const boxKind = (b: Box | undefined): 'text' | 'image' | 'box' => {
    const k = asText(b?.kind);
    return k === 'image' ? 'image' : k === 'box' ? 'box' : 'text';
  };
  // UI-only: whether the corner fields are split into four. Sticky across repaints so
  // unlinking doesn't collapse the moment a value commits.
  let cornersSplit = false;

  /** Apply a patch to every selected box of `kind`. Everything routes back through
   *  coerceBox, so it is the ONE normaliser - which is also what keeps the stored records
   *  minimal, since coerceBox drops any key sitting at its render default. */
  function patchSel(kind: 'text' | 'box', patch: Record<string, unknown>): void {
    const boxes = activeBoxes().slice();
    const hit = selIndices().filter(i => boxes[i] && boxKind(boxes[i]) === kind);
    if (!hit.length) return;
    for (const i of hit) boxes[i] = coerceBox({ ...boxes[i]!, ...patch });
    commitBoxes(boxes);
  }
  /** The value every selected box of a kind agrees on, or `mixed` when they differ. */
  function shared<T>(idxs: number[], read: (b: Box) => T, mixed: T): T {
    const boxes = activeBoxes();
    if (!idxs.length) return mixed;
    const first = read(boxes[idxs[0]!]!);
    for (const i of idxs) if (read(boxes[i]!) !== first) return mixed;
    return first;
  }

  function buildInspector(): HTMLElement | null {
    const boxes = activeBoxes();
    const texts = selIndices().filter(i => boxes[i] && boxKind(boxes[i]) === 'text');
    const shapes = selIndices().filter(i => boxes[i] && boxKind(boxes[i]) === 'box');
    if (!texts.length && !shapes.length) return null;

    const bar = document.createElement('div');
    bar.className = 'deck-free__insp';
    // A toolbar click must never start a marquee on the canvas underneath.
    bar.addEventListener('pointerdown', (e) => e.stopPropagation());

    const cell = (label: string, control: HTMLElement): HTMLElement => {
      const c = document.createElement('label');
      c.className = 'deck-free__cell';
      const t = document.createElement('span');
      t.className = 'deck-free__cell-t';
      t.textContent = label;
      c.append(t, control);
      return c;
    };
    const numField = (value: number | null, placeholder: string, onSet: (n: number) => void, aria?: string): HTMLInputElement => {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.className = 'deck-free__num'; inp.min = '0';
      if (aria) inp.setAttribute('aria-label', aria);   // glyph-labelled fields (corner radii) need a real name
      inp.value = value == null ? '' : String(value);
      inp.placeholder = placeholder;
      // `change`, not `input`: a commit repaints the whole overlay and would tear the field
      // out from under the caret on every keystroke.
      inp.addEventListener('change', () => { const n = Number(inp.value); if (Number.isFinite(n)) onSet(Math.max(0, Math.round(n))); });
      return inp;
    };
    const selectField = <T extends string>(value: T, options: Array<[T, string]>, onSet: (v: T) => void): HTMLSelectElement => {
      const sel = document.createElement('select');
      sel.className = 'deck-free__sel';
      for (const [v, label] of options) {
        const o = document.createElement('option');
        o.value = v; o.textContent = label; o.selected = v === value;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => onSet(sel.value as T));
      return sel;
    };
    // The app's real colour picker (OKLCH sliders + hex + alpha + brand-token swatches), the
    // SAME component every other colour surface uses - never a native <input type=color>.
    // Mounted as a compact float trigger (swatch + name, click to open the popover). A small
    // clear button rides alongside for the "inherit the slide / no fill" state the picker
    // can't express (empty ≠ black). Each field needs a stable-enough id; the running seq is fine.
    const colourField = (value: string, onSet: (hex: string) => void, onClear: () => void): HTMLElement => {
      const wrap = document.createElement('span');
      wrap.className = 'deck-free__colour';
      if (!value) wrap.classList.add('is-unset');
      const host = document.createElement('span');
      host.className = 'deck-free__cpick';
      mountColorField(host, 'deck-col-' + (colourSeq++), {
        value: value || 'transparent',
        float: true,
        onChange: (hex) => { if (hex && hex !== 'transparent') onSet(hex); },
      });
      const clr = document.createElement('button');
      clr.type = 'button'; clr.className = 'deck-free__clear';
      clr.textContent = '×';
      clr.title = 'Clear - inherit the slide';
      clr.setAttribute('aria-label', 'Clear colour - inherit the slide');
      clr.disabled = !value;
      clr.addEventListener('click', onClear);
      wrap.append(host, clr);
      return wrap;
    };
    const group = (...kids: HTMLElement[]): HTMLElement => {
      const g = document.createElement('div');
      g.className = 'deck-free__grp';
      g.append(...kids);
      return g;
    };

    if (texts.length) {
      // Size is authored in NATIVE px (the box coordinate space), matching x/y/w/h. Unset
      // means the tool's own 3cqw default, so that's the placeholder rather than a value we
      // silently write in.
      const fs = shared<number | null>(texts, b => (b.fontSize == null ? null : num(b.fontSize as never, 0)), null);
      const colour = shared(texts, b => asText(b.color), '');
      const align = shared(texts, b => (ALIGN_NORM[asText(b.align).toLowerCase()] || 'l'), 'l' as 'l' | 'c' | 'r');
      const valign = shared(texts, b => (VALIGN_NORM[asText(b.valign).toLowerCase()] || 't'), 't' as 't' | 'm' | 'b');
      const fit = shared(texts, b => !!b.fit, false);

      const fitBox = document.createElement('input');
      fitBox.type = 'checkbox'; fitBox.className = 'deck-free__check'; fitBox.checked = fit;
      fitBox.addEventListener('change', () => patchSel('text', { fit: fitBox.checked }));

      bar.append(group(
        cell('Size', numField(fs, String(DEFAULT_TEXT_PX), n => patchSel('text', { fontSize: n }))),
        cell('Colour', colourField(colour, hex => patchSel('text', { color: hex }), () => patchSel('text', { color: '' }))),
      ), group(
        cell('Text', selectField(align, [['l', 'Left'], ['c', 'Centre'], ['r', 'Right']], v => patchSel('text', { align: v }))),
        cell('Position', selectField(valign, [['t', 'Top'], ['m', 'Middle'], ['b', 'Bottom']], v => patchSel('text', { valign: v }))),
        cell('Shrink to fit', fitBox),
      ));
    }

    if (shapes.length) {
      const fill = shared(shapes, b => asText(b.fill), '');
      const shape = shared(shapes, b => shapeUi(b.shape), 'rect' as ShapeUi);
      const lineColor = shared(shapes, b => asText(b.lineColor), '');
      const lineWidth = shared<number | null>(shapes, b => (b.lineWidth == null ? null : num(b.lineWidth as never, 0)), null);
      // Corners only mean something on a rectangle - a pill and an ellipse ARE their
      // rounding, so the fields would show incorrect information.
      const roundable = shape === 'rect';
      const corners = shared<string>(shapes, b => radiusCorners(b.radius).join(','), '');
      const cur = corners ? corners.split(',').map(Number) as [number, number, number, number] : [0, 0, 0, 0];
      const uniform = cur[0] === cur[1] && cur[1] === cur[2] && cur[2] === cur[3];
      const split = cornersSplit || !uniform;

      bar.append(group(
        cell('Fill', colourField(fill, hex => patchSel('box', { fill: hex }), () => patchSel('box', { fill: '' }))),
        cell('Shape', selectField(shape, [['rect', 'Rectangle'], ['pill', 'Pill'], ['ellipse', 'Ellipse']], v => patchSel('box', { shape: v }))),
      ));

      if (roundable) {
        const cornerGrp = group();
        if (split) {
          // CSS corner order - the same order the record stores and the hook paints.
          const labels: Array<[string, number, string]> = [
            ['↖', 0, 'Top-left corner radius'], ['↗', 1, 'Top-right corner radius'],
            ['↘', 2, 'Bottom-right corner radius'], ['↙', 3, 'Bottom-left corner radius'],
          ];
          for (const [glyph, i, aria] of labels) {
            cornerGrp.append(cell(glyph, numField(cur[i]!, '0', n => {
              const next = cur.slice() as [number, number, number, number];
              next[i] = n;
              patchSel('box', { radius: next });
            }, aria)));
          }
        } else {
          cornerGrp.append(cell('Corners', numField(cur[0]!, '0', n => patchSel('box', { radius: n }))));
        }
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'deck-free__btn deck-free__btn--link' + (split ? '' : ' is-on');
        link.textContent = split ? 'Link' : 'Split';
        link.title = split ? 'Link all four corners to one value' : 'Set each corner separately';
        link.addEventListener('click', () => {
          cornersSplit = !split;
          // Linking collapses to the largest corner rather than silently picking the first - 
          // the user's biggest radius is the one they meant to keep.
          if (!cornersSplit) patchSel('box', { radius: Math.max(cur[0]!, cur[1]!, cur[2]!, cur[3]!) });
          else renderFree();
        });
        cornerGrp.append(link);
        bar.append(cornerGrp);
      }

      bar.append(group(
        cell('Border', colourField(lineColor, hex => patchSel('box', { lineColor: hex }), () => patchSel('box', { lineColor: '' }))),
        cell('Width', numField(lineWidth, '0', n => patchSel('box', { lineWidth: n }))),
      ));
    }
    return bar;
  }

  function renderFree(): void {
    const isFree = asText(activeSlide()?.mode) === 'freeform';
    free.hidden = !isFree;
    free.textContent = '';
    freeChrome.textContent = '';
    freeChrome.hidden = !isFree;
    boxEls = []; guidesLayer = null; marqueeEl = null;
    // Box indices are PER-SLIDE, so a stale selection carried across a slide change would
    // highlight - and drive Delete/align/nudge on - the wrong boxes. Reset it whenever the
    // active slide changes (navigation), not just when the deck shrinks under it.
    const ai = clampedActive();
    if (ai !== lastActiveIdx) { selection = new Set(); primary = -1; lastActiveIdx = ai; }
    if (!isFree) { selection = new Set(); primary = -1; syncFreeReserve(); return; }

    const boxes = activeBoxes();
    // Drop any stale selection indices (a load/undo can shrink the deck), then re-derive primary.
    selection = new Set(selIndices().filter(i => i < boxes.length));
    primary = selection.size === 1 ? selIndices()[0]! : -1;

    // The arrange toolbar + (when something's selected) the inspector dock OUTSIDE the canvas,
    // in the stage band above it - see freeChrome. Reserve that band FIRST: it re-fits the
    // canvas, so every metric below must be read AFTER it or the box layer lands on the
    // pre-fit rect.
    freeChrome.appendChild(buildToolbar());
    const insp = buildInspector();
    if (insp) freeChrome.appendChild(insp);
    syncFreeReserve();

    const m = canvasMetrics();
    free.style.left = (m.cr.left - m.sr.left) + 'px';
    free.style.top = (m.cr.top - m.sr.top) + 'px';
    free.style.width = m.cr.width + 'px';
    free.style.height = m.cr.height + 'px';

    // A full-cover background BELOW the boxes catches empty-canvas marquee-drags + deselect.
    const bg = document.createElement('div');
    bg.className = 'deck-free__bg';
    bg.addEventListener('pointerdown', (e) => startMarquee(e as PointerEvent));
    free.appendChild(bg);

    boxes.forEach((box, i) => { const el = buildBoxEl(box, i); free.appendChild(el); boxEls[i] = el; });

    // A group bounding box (with a rotate handle) frames a multi-selection.
    if (selection.size > 1) {
      const aabb = selectionAABB(boxes, selIndices(), BOX_CFG);
      if (aabb) {
        const bbox = document.createElement('div');
        bbox.className = 'deck-free-bbox';
        bbox.style.left = (aabb.minX * m.scaleX) + 'px';
        bbox.style.top = (aabb.minY * m.scaleY) + 'px';
        bbox.style.width = (aabb.w * m.scaleX) + 'px';
        bbox.style.height = (aabb.h * m.scaleY) + 'px';
        const rot = document.createElement('div');
        rot.className = 'deck-free-rot';
        rot.title = 'Rotate selection';
        rot.addEventListener('pointerdown', (e) => startRotate(e as PointerEvent));
        bbox.appendChild(rot);
        free.appendChild(bbox);
      }
    }

    guidesLayer = document.createElement('div');
    guidesLayer.className = 'deck-free__guides';
    free.appendChild(guidesLayer);

    positionBoxEls(boxes, m.scaleX, m.scaleY);
  }

  // Reserve the stage band the freeform chrome occupies - the slide bar + arrange toolbar +
  // inspector across the top - so fitCanvas fits the canvas BELOW them (--stage-reserve-*, read
  // by tool.ts). Layout mode reserves nothing (the bars keep floating over the canvas edges as
  // before). Only re-fits when the reservation actually CHANGES, so its own canvas-resize
  // dispatch can't loop against the ResizeObserver that dispatch wakes. Freeform docks the bar
  // stack from the top and leaves the filmstrip floating, so only a top band is reserved.
  function syncFreeReserve(): void {
    let top = '', bottom = '';
    if (!freeChrome.hidden) {
      const barH = bar.getBoundingClientRect().height || 0;
      freeChrome.style.top = Math.round(barH) + 'px';   // dock the toolbars just under the slide bar
      const chromeH = freeChrome.getBoundingClientRect().height || 0;
      top = Math.round(barH + chromeH + 12) + 'px';
      // The canvas shifts down into the band; reserve the filmstrip too so its bottom doesn't
      // slide under it.
      bottom = Math.round((strip.getBoundingClientRect().height || 0) + 6) + 'px';
    }
    if (stageEl.style.getPropertyValue('--stage-reserve-top') === top &&
        stageEl.style.getPropertyValue('--stage-reserve-bottom') === bottom) return;
    stageEl.style.setProperty('--stage-reserve-top', top);
    stageEl.style.setProperty('--stage-reserve-bottom', bottom);
    opts.canvasEl.dispatchEvent(new Event('canvas-resize'));   // → tool.ts fitCanvas re-fits
  }

  // Keep the box-overlay layer aligned to the (re-fitted / resized) canvas WITHOUT rebuilding
  // it - so a window/sidebar resize, or our own reserve-driven re-fit, never tears an open
  // colour popover or the box under a live gesture. Full rebuilds stay in renderFree.
  function repositionFree(): void {
    syncFreeReserve();   // chrome may have reflowed (bar wrap on resize) → re-fit before reading rects
    if (free.hidden) return;
    const m = canvasMetrics();
    free.style.left = (m.cr.left - m.sr.left) + 'px';
    free.style.top = (m.cr.top - m.sr.top) + 'px';
    free.style.width = m.cr.width + 'px';
    free.style.height = m.cr.height + 'px';
    positionBoxEls(activeBoxes(), m.scaleX, m.scaleY);
    const bbox = free.querySelector<HTMLElement>('.deck-free-bbox');
    if (bbox && selection.size > 1) {
      const aabb = selectionAABB(activeBoxes(), selIndices(), BOX_CFG);
      if (aabb) {
        bbox.style.left = (aabb.minX * m.scaleX) + 'px';
        bbox.style.top = (aabb.minY * m.scaleY) + 'px';
        bbox.style.width = (aabb.w * m.scaleX) + 'px';
        bbox.style.height = (aabb.h * m.scaleY) + 'px';
      }
    }
    syncFreeReserve();
  }

  function addBox(kind: 'text' | 'image' | 'box'): void {
    const boxes = activeBoxes().slice();
    const nw = opts.nativeW || 1920, nh = opts.nativeH || 1080;
    const w = Math.round(nw * 0.4), h = Math.round(nh * 0.2);
    const seed: Record<string, unknown> = { kind, x: Math.round((nw - w) / 2), y: Math.round((nh - h) / 2), w, h };
    if (kind === 'text') { seed.text = 'Text'; seed.fit = true; }   // shrink-to-fit on by default
    // A rectangle carrying a radius IS the rounded shape (see ShapeUi) - no `round` needed.
    else if (kind === 'box') { seed.shape = 'rect'; seed.radius = Math.round(nw * 0.02); seed.fill = '#cfd8dc'; }
    boxes.push(coerceBox(seed));
    const at = boxes.length - 1;
    selection = new Set([at]); primary = at;
    commitBoxes(boxes);
    // A new image box is empty - go straight to the picker so "+ Image" is one gesture.
    if (kind === 'image') void pickBoxImage(at);
  }
  function deleteBox(): void {
    if (!selection.size) return;
    const del = new Set(selIndices());
    const boxes = activeBoxes().filter((_, i) => !del.has(i));
    selection = new Set(); primary = -1;
    commitBoxes(boxes);
  }

  // ── arrange ops (align / distribute / z-order) - all operate on the selection ─────
  function doAlign(edge: AlignEdge): void {
    if (!selection.size) return;
    const nw = opts.nativeW || 1920, nh = opts.nativeH || 1920;
    commitBoxes(alignBoxes(activeBoxes().slice(), selIndices(), edge, BOX_CFG, { w: nw, h: nh }));
  }
  function doDistribute(axis: Axis): void {
    if (selection.size < 3) return;
    commitBoxes(distributeBoxes(activeBoxes().slice(), selIndices(), axis, BOX_CFG));
  }
  function doZ(op: ZOp): void {
    if (!selection.size) return;
    const ids = selIndices().map(i => idOf(activeBoxes()[i])).filter(Boolean);
    const boxes = reorderZ(activeBoxes().slice(), selIndices(), op);
    setSelByIds(boxes, ids);   // reordering moves the boxes - keep the selection on them
    commitBoxes(boxes);
  }
  function duplicateSelection(): void {
    if (!selection.size) return;
    const { boxes, ids } = duplicateBoxes(activeBoxes().slice(), selIndices());
    setSelByIds(boxes, ids);   // the CLONES become the selection (appended after the originals)
    commitBoxes(boxes);        // one commit = one undo step
  }

  // ── right-click context menu (freeform) - the toolbar's object ops at the cursor ──
  // Mirrors free-canvas.ts openContextMenu (same structure, same shared .fc-popover /
  // .fc-context-menu classes from styles/parts/editor.css) but self-contained - that file
  // is a parallel in-flight stream, so nothing is imported from it.
  let ctxMenu: HTMLElement | null = null;
  const closeCtxMenu = (): void => {
    if (!ctxMenu) return;
    ctxMenu.remove(); ctxMenu = null;
    document.removeEventListener('pointerdown', onCtxDown, true);
    document.removeEventListener('keydown', onCtxKey, true);
    document.removeEventListener('scroll', closeCtxMenu, true);
    document.defaultView?.removeEventListener('resize', closeCtxMenu);
  };
  // Capture-phase: a pointerdown that stopPropagation()s (box startMove) must still close.
  const onCtxDown = (e: Event): void => {
    if (ctxMenu && !(e.target instanceof Node && ctxMenu.contains(e.target))) closeCtxMenu();
  };
  // Escape closes ONLY the menu - preventDefault + stopPropagation so the same keypress
  // never also clears the selection or reaches another Escape handler.
  const onCtxKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCtxMenu(); }
  };
  function openCtxMenu(clientX: number, clientY: number): void {
    closeCtxMenu();
    const hasSel = selection.size > 0;
    const menu = document.createElement('div');
    menu.className = 'fc-popover fc-context-menu';
    const item = (label: string, svg: string, run: () => void, disabled: boolean, danger = false): void => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fc-pop-item' + (danger ? ' fc-pop-danger' : '');
      b.disabled = disabled;
      b.innerHTML = `<span class="fc-pop-ic">${svg}</span><span>${label}</span>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); if (b.disabled) return; run(); closeCtxMenu(); });
      menu.appendChild(b);
    };
    const sep = (): void => { const s = document.createElement('div'); s.className = 'fc-pop-sep'; menu.appendChild(s); };
    // Icon-only grid row (title/aria carry the label); `cols` drives the CSS var.
    const grid = (cols: number, cells: Array<[string, IconName, () => void, boolean]>): void => {
      const g = document.createElement('div');
      g.className = 'fc-pop-grid';
      g.style.setProperty('--cols', String(cols));
      for (const [label, name, run, disabled] of cells) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'fc-pop-gitem'; b.disabled = disabled;
        b.title = label; b.setAttribute('aria-label', label);
        b.innerHTML = icon(name);
        b.addEventListener('click', (e) => { e.stopPropagation(); if (b.disabled) return; run(); closeCtxMenu(); });
        g.appendChild(b);
      }
      menu.appendChild(g);
    };
    item('Duplicate', icon('duplicate'), () => duplicateSelection(), !hasSel);
    item('Delete', icon('trash'), () => deleteBox(), !hasSel, true);
    sep();
    // Stacking order - 2×2: columns are magnitude (one step │ all the way), rows are
    // direction (up = forward/front, down = backward/back).
    grid(2, [
      ['Bring forward', 'orderForward', () => doZ('forward'), !hasSel],
      ['Bring to front', 'orderFront', () => doZ('front'), !hasSel],
      ['Send backward', 'orderBackward', () => doZ('backward'), !hasSel],
      ['Send to back', 'orderBack', () => doZ('back'), !hasSel],
    ]);
    sep();
    // Align - 3 across × 2 rows (L/C/R then T/M/B); distribute - one row of 2 (needs 3+).
    grid(3, [
      ['Align left', 'alignL', () => doAlign('left'), !hasSel],
      ['Align centre', 'alignC', () => doAlign('hcentre'), !hasSel],
      ['Align right', 'alignR', () => doAlign('right'), !hasSel],
      ['Align top', 'alignT', () => doAlign('top'), !hasSel],
      ['Align middle', 'alignM', () => doAlign('vcentre'), !hasSel],
      ['Align bottom', 'alignB', () => doAlign('bottom'), !hasSel],
    ]);
    grid(2, [
      ['Distribute horizontally', 'distH', () => doDistribute('h'), selection.size < 3],
      ['Distribute vertically', 'distV', () => doDistribute('v'), selection.size < 3],
    ]);
    menu.addEventListener('pointerdown', (e) => e.stopPropagation());
    stageEl.appendChild(menu);
    // Clamp into the stage rect (free-canvas's math) so a menu opened near the bottom /
    // right edge slides back into view instead of clipping offscreen.
    const sr = stageEl.getBoundingClientRect();
    menu.style.left = Math.max(6, Math.min(clientX - sr.left, sr.width - menu.offsetWidth - 6)) + 'px';
    menu.style.top = Math.max(6, Math.min(clientY - sr.top, sr.height - menu.offsetHeight - 6)) + 'px';
    ctxMenu = menu;
    document.addEventListener('pointerdown', onCtxDown, true);
    document.addEventListener('keydown', onCtxKey, true);
    document.addEventListener('scroll', closeCtxMenu, true);
    document.defaultView?.addEventListener('resize', closeCtxMenu);
  }
  const onFreeContextMenu = (e: MouseEvent): void => {
    if (asText(activeSlide()?.mode) !== 'freeform') return;
    const t = e.target as HTMLElement | null;
    if (!t?.closest) return;
    // An open text edit keeps the NATIVE menu (spellcheck / paste while typing).
    if (t.closest('[contenteditable="true"]')) return;
    // The toolbar + inspector are controls, not canvas objects - leave them native too.
    if (t.closest('.deck-free__tools, .deck-free__insp')) return;
    e.preventDefault();
    if (boxEditCommit) boxEditCommit();   // a right-click elsewhere flushes an open edit first
    const boxEl = t.closest<HTMLElement>('.deck-free-box');
    const idx = boxEl ? Number(boxEl.dataset.idx) : -1;
    // A right-click on an UNSELECTED box selects it (single) first; on a selected box the
    // whole selection stays, so the menu acts on all of it. Empty canvas keeps whatever
    // selection exists - the items disable themselves off selection.size.
    if (idx >= 0 && !selection.has(idx)) { selection = new Set([idx]); primary = idx; renderFree(); }
    openCtxMenu(e.clientX, e.clientY);
  };
  free.addEventListener('contextmenu', onFreeContextMenu);

  // Open a text box for in-place rich-text editing: the box's rendered `.deck-free-box__text`
  // (already showing mdToRichHtml(box.text)) becomes contenteditable; on blur / Escape /
  // Cmd+Enter it serialises back to the box's markdown `text` via richHtmlToMd. One box at a
  // time; boxEditCommit lets a click elsewhere flush it first.
  function startBoxTextEdit(idx: number, boxEl: HTMLElement): void {
    const tx = boxEl.querySelector<HTMLElement>('.deck-free-box__text');
    if (!tx) return;
    editingBox = idx;
    const editSlideIdx = clampedActive();   // the deferred commit lands HERE, even if the user navigates away
    selection = new Set([idx]); primary = idx;
    const box = activeBoxes()[idx];
    tx.innerHTML = mdToRichHtml(asText(box?.text));
    tx.setAttribute('contenteditable', 'true');
    tx.setAttribute('role', 'textbox');
    tx.setAttribute('aria-label', 'Box text');
    tx.style.pointerEvents = 'auto';
    boxEl.classList.add('is-editing');
    const range = document.createRange(); range.selectNodeContents(tx);
    // Reach the window via document.defaultView (present in browsers AND jsdom) rather than a
    // global `window`, so selecting-all never throws where no global window exists.
    const sel = document.defaultView?.getSelection?.(); sel?.removeAllRanges(); sel?.addRange(range);
    tx.focus();
    let done = false;
    const commit = (): void => {
      if (done) return; done = true;
      tx.removeEventListener('blur', onBlur); tx.removeEventListener('keydown', onKey);
      boxEditCommit = null;
      editingBox = -1;
      const md = richHtmlToMd(tx);
      const slideBoxes = readDeck()[editSlideIdx]?.boxes;
      const boxes = Array.isArray(slideBoxes) ? slideBoxes.slice() : [];
      if (boxes[idx] && asText(boxes[idx]!.text) !== md) { boxes[idx] = { ...boxes[idx]!, text: md }; commitBoxesAt(editSlideIdx, boxes); }
      else { boxEl.classList.remove('is-editing'); renderFree(); }
    };
    // Commit on blur, but DEFERRED: a click on another box, or a browser that blurs on an
    // innerHTML change, must not pre-empt an Escape / Cmd+Enter with stale content (mirrors
    // the layout text editor's focusout timing). The guard skips it once already committed.
    function onBlur(): void { setTimeout(() => { if (editingBox === idx) commit(); }, 0); }
    function onKey(ev: KeyboardEvent): void {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); commit(); }
      else if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); commit(); }
      ev.stopPropagation();   // keep global Delete/nav off while typing
    }
    boxEditCommit = commit;
    tx.addEventListener('blur', onBlur);
    tx.addEventListener('keydown', onKey);
  }

  // Pick / replace an image box's picture via the host asset picker (same picker + edit-tool
  // flow as the sidebar image slots). Stores the resolved URL string as the box `src` (the
  // hook's boxUrl reads a URL string). No-ops without a host picker (headless / CLI).
  async function pickBoxImage(idx: number): Promise<void> {
    const pick = opts.host?.assets?.pick;
    if (typeof pick !== 'function') return;
    const box = activeBoxes()[idx];
    const cur = typeof box?.src === 'string' ? box.src : refUrl(box?.src);
    try {
      const ref = await pick({ title: 'Choose an image', allowUpload: true, current: cur, editTool: opts.editTool }) as (Record<string, unknown> & { url?: string }) | null;
      if (!ref || typeof ref.url !== 'string' || !ref.url) return;
      const boxes = activeBoxes().slice();
      // Store the FULL asset ref (id = canonical embed URL + meta.toolUrl), not just the url - so
      // a Lolly-tool render placed on the canvas keeps its identity: editable in place + re-
      // renderable on load, matching the sidebar media slots (Fable N1). boxUrl reads .url either way.
      if (boxes[idx]) { boxes[idx] = { ...boxes[idx]!, src: ref as Box[string] }; commitBoxes(boxes); }
    } catch { /* user cancelled */ }
  }

  // Layout-mode counterpart of pickBoxImage: click a slot on the canvas → the picker → set the
  // slide's matching media field. The clicked slot's position among its `.sl-slot` siblings maps
  // to SLOTS_FOR[layout][i] (the same order the hook renders them), so it works for any layout.
  async function pickSlot(slotEl: HTMLElement): Promise<void> {
    const pick = opts.host?.assets?.pick;
    if (typeof pick !== 'function') return;
    const slide = activeSlide();
    if (!slide) return;
    const fields = SLOTS_FOR[clampLayout(slide.layout)] ?? [];
    const grid = slotEl.parentElement;
    const i = grid ? Array.prototype.indexOf.call(grid.children, slotEl) : -1;
    const field = fields[i];
    if (!field) return;
    const cur = refUrl((slide as Record<string, unknown>)[field]);
    try {
      const ref = await pick({ title: 'Choose an image', allowUpload: true, current: cur, editTool: opts.editTool }) as (Record<string, unknown> & { url?: string }) | null;
      if (!ref || typeof ref.url !== 'string' || !ref.url) return;
      commitSlide({ [field]: toMediaRef(ref) } as Partial<Slide>);
    } catch { /* user cancelled */ }
  }

  function startMove(e: PointerEvent, idx: number): void {
    // Right-click is the context menu, never a gesture - a move begun on button 2 would
    // collapse a multi-selection (or hang) on the pointerup the native menu swallows.
    if (e.button === 2) return;
    // A pointerdown INSIDE the box currently being edited just places the caret - never move.
    if (editingBox === idx) return;
    e.preventDefault(); e.stopPropagation();
    // A click on a DIFFERENT box while an edit is open commits that edit first.
    if (boxEditCommit) boxEditCommit();
    // Double-click (two quick pointerdowns on the same box) opens it: a text box → in-place
    // rich-text edit; an image box → the picker. Shift-clicks are multi-select, never edits.
    const now = Date.now();
    if (lastDown.idx === idx && now - lastDown.t < 350 && !e.shiftKey) {
      lastDown = { idx: -1, t: 0 };
      const box = activeBoxes()[idx];
      if (box?.kind === 'image') { void pickBoxImage(idx); return; }
      const bEl = boxEls[idx]; if (bEl) startBoxTextEdit(idx, bEl);
      return;
    }
    lastDown = { idx, t: now };
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (additive) { if (selection.has(idx)) selection.delete(idx); else selection.add(idx); }
    else if (!selection.has(idx)) selection = new Set([idx]);
    primary = selection.size === 1 ? selIndices()[0]! : -1;
    renderFree();   // reflect the new selection (handles / bbox) immediately
    if (!selection.has(idx)) return;   // an additive click that DESELECTED this box - no drag
    const boxes = activeBoxes().slice();
    const m = canvasMetrics();
    gesture = { type: 'move', idx, indices: selIndices(), startClient: { x: e.clientX, y: e.clientY }, startBoxes: boxes, scaleX: m.scaleX, scaleY: m.scaleY, live: boxes, plainClick: !additive, moved: false };
    attachGesture();
  }
  function startResize(e: PointerEvent, idx: number, handle: HandleName): void {
    if (e.button === 2) return;   // right-click is the context menu, never a gesture
    e.preventDefault(); e.stopPropagation();
    selection = new Set([idx]); primary = idx;
    const boxes = activeBoxes().slice();
    const m = canvasMetrics();
    gesture = { type: 'resize', idx, handle, indices: [idx], startClient: { x: e.clientX, y: e.clientY }, startBoxes: boxes, startRect: boxRect(boxes[idx], BOX_CFG), scaleX: m.scaleX, scaleY: m.scaleY, live: boxes };
    attachGesture();
  }
  function startRotate(e: PointerEvent): void {
    if (e.button === 2) return;   // right-click is the context menu, never a gesture
    e.preventDefault(); e.stopPropagation();
    const boxes = activeBoxes().slice();
    const idxs = selIndices();
    const aabb = selectionAABB(boxes, idxs, BOX_CFG);
    if (!aabb) return;
    const centre = { x: (aabb.minX + aabb.maxX) / 2, y: (aabb.minY + aabb.maxY) / 2 };
    const m = canvasMetrics();
    // Angle is measured in SCREEN space (about the box's on-screen centre), matching the hook's
    // CSS `rotate()` - so the box visually follows the pointer even on a squished (16:9) slide.
    const csx = m.cr.left + centre.x * m.scaleX, csy = m.cr.top + centre.y * m.scaleY;
    const startAngle = Math.atan2(e.clientY - csy, e.clientX - csx) * 180 / Math.PI;
    gesture = { type: 'rotate', idx: primary, indices: idxs, centre, startAngle, startClient: { x: e.clientX, y: e.clientY }, startBoxes: boxes, scaleX: m.scaleX, scaleY: m.scaleY, live: boxes };
    attachGesture();
  }
  function startMarquee(e: PointerEvent): void {
    // Right-click is the context menu - an empty-canvas one must not deselect first.
    if (e.button === 2) return;
    e.preventDefault();
    if (boxEditCommit) boxEditCommit();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const base = additive ? new Set(selection) : new Set<number>();
    if (!additive) { selection = new Set(); primary = -1; }   // click empty canvas = deselect
    const m = canvasMetrics();
    const ox = (e.clientX - m.cr.left) / m.scaleX, oy = (e.clientY - m.cr.top) / m.scaleY;
    gesture = { type: 'marquee', idx: -1, indices: [], startClient: { x: e.clientX, y: e.clientY }, startBoxes: activeBoxes().slice(), scaleX: m.scaleX, scaleY: m.scaleY, live: activeBoxes().slice(), marqueeBase: base, marqueeOrigin: { x: ox, y: oy } };
    attachGesture();
  }

  const clearGuides = (): void => { if (guidesLayer) guidesLayer.textContent = ''; };
  function drawGuides(guides: Array<{ x1: number; y1: number; x2: number; y2: number }>, scaleX: number, scaleY: number): void {
    if (!guidesLayer) return;
    guidesLayer.textContent = '';
    for (const g of guides) {
      const d = document.createElement('div');
      const vertical = Math.abs(g.x1 - g.x2) < 0.5;
      d.className = 'deck-free__guide deck-free__guide--' + (vertical ? 'v' : 'h');
      if (vertical) { d.style.left = (g.x1 * scaleX) + 'px'; d.style.top = (Math.min(g.y1, g.y2) * scaleY) + 'px'; d.style.height = (Math.abs(g.y2 - g.y1) * scaleY) + 'px'; }
      else { d.style.top = (g.y1 * scaleY) + 'px'; d.style.left = (Math.min(g.x1, g.x2) * scaleX) + 'px'; d.style.width = (Math.abs(g.x2 - g.x1) * scaleX) + 'px'; }
      guidesLayer.appendChild(d);
    }
  }

  const onGestureMove = (e: Event): void => {
    if (!gesture) return;
    const pe = e as PointerEvent;
    // A gesture only becomes a real drag once the pointer clears a small threshold, so a click
    // carrying sub-pixel trackpad jitter still reads as a click (no box move, no commit).
    if (Math.abs(pe.clientX - gesture.startClient.x) > 3 || Math.abs(pe.clientY - gesture.startClient.y) > 3) gesture.moved = true;
    const dx = (pe.clientX - gesture.startClient.x) / gesture.scaleX;
    const dy = (pe.clientY - gesture.startClient.y) / gesture.scaleY;
    if (gesture.type === 'move') {
      if (!gesture.moved) return;   // below the drag threshold - don't nudge the box yet
      let moved = moveBoxes(gesture.startBoxes, gesture.indices, dx, dy, BOX_CFG);
      // Smart-guide snap to the artboard + sibling edges/centres (hold Alt to bypass).
      if (!pe.altKey) {
        const sel = new Set(gesture.indices);
        const active = selectionAABB(moved, gesture.indices, BOX_CFG);
        if (active) {
          const others: AABB[] = [];
          moved.forEach((b, i) => { if (!sel.has(i)) others.push(boxAABB(b, BOX_CFG)); });
          const snap = snapMove(active, others, { w: opts.nativeW || 1920, h: opts.nativeH || 1920 }, SNAP_SCREEN / gesture.scaleX);
          if (snap.dx || snap.dy) moved = moveBoxes(moved, gesture.indices, snap.dx, snap.dy, BOX_CFG);
          drawGuides(snap.guides, gesture.scaleX, gesture.scaleY);
        }
      } else clearGuides();
      gesture.live = moved;
      positionBoxEls(gesture.live, gesture.scaleX, gesture.scaleY);
    } else if (gesture.type === 'resize') {
      if (!gesture.moved) return;
      const nr = resizeRect(gesture.startRect!, gesture.handle!, dx, dy, { minSize: 24 });
      gesture.live = gesture.startBoxes.map((b, i) => (i === gesture!.idx ? withRect(b, nr, BOX_CFG) : b));
      positionBoxEls(gesture.live, gesture.scaleX, gesture.scaleY);
    } else if (gesture.type === 'rotate') {
      if (!gesture.moved) return;
      const cm = canvasMetrics();
      const csx = cm.cr.left + gesture.centre!.x * cm.scaleX, csy = cm.cr.top + gesture.centre!.y * cm.scaleY;
      const ang = Math.atan2(pe.clientY - csy, pe.clientX - csx) * 180 / Math.PI;
      let delta = ang - gesture.startAngle!;
      // Snap the reference box's RESULTING angle to 15° steps (hold Alt to bypass).
      const refI = gesture.idx >= 0 ? gesture.idx : gesture.indices[0]!;
      const rot0 = boxRect(gesture.startBoxes[refI], BOX_CFG).rot || 0;
      if (!pe.altKey) { delta = snapAngle(rot0 + delta, 15, 5) - rot0; }
      gesture.live = rotateGroup(gesture.startBoxes, gesture.indices, gesture.centre!, delta, BOX_CFG);
      positionBoxEls(gesture.live, gesture.scaleX, gesture.scaleY);
    } else if (gesture.type === 'marquee') {
      const cm = canvasMetrics();
      const cx = (pe.clientX - cm.cr.left) / cm.scaleX, cy = (pe.clientY - cm.cr.top) / cm.scaleY;
      const rectN = normDragRect(gesture.marqueeOrigin!.x, gesture.marqueeOrigin!.y, cx, cy, 1);
      if (!marqueeEl) { marqueeEl = document.createElement('div'); marqueeEl.className = 'deck-free__marquee'; free.appendChild(marqueeEl); }
      marqueeEl.style.left = (rectN.x * gesture.scaleX) + 'px';
      marqueeEl.style.top = (rectN.y * gesture.scaleY) + 'px';
      marqueeEl.style.width = (rectN.w * gesture.scaleX) + 'px';
      marqueeEl.style.height = (rectN.h * gesture.scaleY) + 'px';
      const next = new Set(gesture.marqueeBase);
      for (const i of marqueeHit(gesture.startBoxes, rectN, BOX_CFG)) next.add(i);
      selection = next; primary = selection.size === 1 ? selIndices()[0]! : -1;
      for (let i = 0; i < boxEls.length; i++) boxEls[i]?.classList.toggle('is-sel', selection.has(i));
    }
  };
  const onGestureUp = (): void => {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    detachGesture();
    clearGuides();
    if (marqueeEl) { marqueeEl.remove(); marqueeEl = null; }
    if (g.type === 'marquee') { renderFree(); return; }   // selection changed → repaint chrome
    // A real drag clears the double-click candidate, so a quick follow-up click on the same
    // box isn't mistaken for a double-click (which would open the text editor).
    if (g.moved) lastDown = { idx: -1, t: 0 };
    if (!g.moved) {
      // No drag happened (a click). A plain click on a box within a multi-selection collapses
      // to just that box; otherwise there is nothing to commit - restore any sub-threshold
      // nudge and skip the commit so resize/rotate/move clicks never push a no-op undo entry.
      if (g.type === 'move' && g.plainClick && selection.size > 1) { selection = new Set([g.idx]); primary = g.idx; renderFree(); return; }
      // A plain click on an EMPTY image box opens the picker straight away - filling it is the
      // only thing an empty box is for, so it shouldn't need the double-click a filled box uses
      // to REPLACE its picture. (A drag still moves it; right-click still deletes it.)
      if (g.type === 'move' && g.plainClick) {
        const box = activeBoxes()[g.idx];
        if (box?.kind === 'image' && !(typeof box.src === 'string' ? box.src : refUrl(box.src))) {
          lastDown = { idx: -1, t: 0 };   // consume the double-click candidate this click seeded
          void pickBoxImage(g.idx);
          return;
        }
      }
      positionBoxEls(activeBoxes(), g.scaleX, g.scaleY);
      return;
    }
    commitBoxes(g.live);
  };
  function attachGesture(): void {
    document.addEventListener('pointermove', onGestureMove, true);
    document.addEventListener('pointerup', onGestureUp, true);
  }
  function detachGesture(): void {
    document.removeEventListener('pointermove', onGestureMove, true);
    document.removeEventListener('pointerup', onGestureUp, true);
  }

  // ── keyboard: nudge, copy/paste, delete (freeform slide, selection present) ────────
  function onFreeKey(e: KeyboardEvent): void {
    if (editingBox >= 0 || gesture) return;
    if (asText(activeSlide()?.mode) !== 'freeform') return;
    // Shadow-aware (lib/typing-target.ts) so jelly fields, whose real <input> sits
    // in a shadow root, still count as typing and keep their keystrokes.
    const ae = document.activeElement as HTMLElement | null;
    if (isTypingTarget(ae)) return;
    if (ae?.closest?.('.deck-strip, .deck-bar, .deck-load, .deck-fmt')) return;   // their own keys
    const nudges: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (nudges[e.key] && selection.size) {
      e.preventDefault();
      const [ux, uy] = nudges[e.key]!;
      const step = e.shiftKey ? 10 : 1;
      commitBoxes(moveBoxes(activeBoxes().slice(), selIndices(), ux * step, uy * step, BOX_CFG));
      return;
    }
    const meta = e.metaKey || e.ctrlKey;
    if (meta && (e.key === 'c' || e.key === 'C') && selection.size) {
      clipboard = selIndices().map(i => ({ ...activeBoxes()[i] })) as Box[];
      return;
    }
    if (meta && (e.key === 'v' || e.key === 'V') && clipboard.length) {
      e.preventDefault();
      const off = (opts.nativeW || 1920) * 0.03;
      const boxes = activeBoxes().slice();
      const start = boxes.length;
      for (const b of clipboard) boxes.push(coerceBox({ ...b, id: undefined, x: num(b.x as never, 0) + off, y: num(b.y as never, 0) + off }));
      selection = new Set(boxes.map((_, i) => i).filter(i => i >= start));
      primary = selection.size === 1 ? selIndices()[0]! : -1;
      commitBoxes(boxes);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.size) { e.preventDefault(); deleteBox(); }
  }
  document.addEventListener('keydown', onFreeKey);

  // Re-render everything on a model change (strip + toolbar + free-canvas), and reposition
  // the open text editor over the (repainted) canvas.
  // Cap the sidebar "Pause on slide" slider at the actual slide count (0 = play the whole
  // deck, 1..n = hold on slide n) - the manifest's static max:40 would let it run past the
  // last slide. Reaches into the sidebar control by its [data-input-id] (no-op when absent).
  function syncFocusMax(): void {
    try {
      const n = Math.max(1, readDeck().length);
      const host = opts.viewEl.querySelector<HTMLElement>('[data-input-id="focusSlide"]');
      host?.querySelectorAll<HTMLInputElement>('input[type="range"], input[type="number"]').forEach(el => { el.max = String(n); });
    } catch { /* sidebar not present (headless) */ }
  }

  function renderAll(): void {
    renderStrip();
    renderBar();
    renderFree();
    positionFormatBar();
    syncFocusMax();
  }

  // filmstrip -------------------------------------------------------------------
  const strip = document.createElement('div');
  strip.className = 'deck-strip';
  strip.setAttribute('role', 'listbox');
  strip.setAttribute('aria-label', 'Slides');
  strip.setAttribute('aria-orientation', 'horizontal');

  const loadBtn = document.createElement('button');
  loadBtn.type = 'button';
  loadBtn.className = 'deck-strip__load';
  loadBtn.innerHTML = icon('uploadImage') + '<span>Load deck</span>';
  loadBtn.title = 'Load a whole deck from Markdown, JSON, or a PowerPoint file';
  loadBtn.setAttribute('aria-label', 'Load a deck from Markdown, JSON, or PowerPoint');

  const stripScroll = document.createElement('div');
  stripScroll.className = 'deck-strip__scroll';

  strip.append(loadBtn, stripScroll);
  overlay.appendChild(strip);
  stageEl.appendChild(overlay);

  // one thumbnail per slide, keyboard-navigable
  // Thumbnail width tracks the deck's aspect ratio (read off the live canvas) so a square
  // deck gets square thumbs and a wide deck gets wide ones - height is fixed by CSS.
  const thumbWidth = (): number => {
    const cw = parseFloat(opts.canvasEl.style.width) || opts.nativeW || 1;
    const ch = parseFloat(opts.canvasEl.style.height) || opts.nativeH || 1;
    const aspect = cw > 0 && ch > 0 ? cw / ch : 1;
    return Math.round(Math.max(44, Math.min(150, 66 * aspect)));
  };

  // The exact colours the hook rendered slide `i` with - its inlined `--bg`/`--ink` custom
  // props on the live `.sl-slide--i` node - so a thumbnail matches the brand-derived scheme
  // (e.g. SUSE green accent) instead of the static approximation. Null when unavailable
  // (not yet painted, or a headless/jsdom env where custom props don't compute).
  const readRenderedColors = (i: number): { bg: string; ink: string } | null => {
    try {
      const view = document.defaultView;
      const el = opts.canvasEl.querySelector<HTMLElement>('.sl-slide--' + i);
      if (!el || !view?.getComputedStyle) return null;
      const cs = view.getComputedStyle(el);
      const bg = cs.getPropertyValue('--bg').trim();
      const ink = cs.getPropertyValue('--ink').trim();
      return bg ? { bg, ink: ink || '#ffffff' } : null;
    } catch { return null; }
  };

  function renderStrip(): void {
    const deck = readDeck();
    const active = activeIndex();
    const deckTheme = String(runtime.getModel().find(i => i.id === 'theme')?.value ?? 'auto') || 'auto';
    const prevScroll = stripScroll.scrollLeft;
    const w = thumbWidth();
    stripScroll.textContent = '';

    // A fresh, untouched deck (the single starter slide) → make Load INVITING: bringing in a
    // real deck is the strong first move, so it glows until the user has started building.
    const starter = deck.length <= 1 && asText(deck[0]?.content).startsWith('# New deck');
    loadBtn.classList.toggle('is-inviting', starter);

    deck.forEach((slide, i) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'deck-thumb' + (i === active ? ' is-active' : '');
      thumb.setAttribute('role', 'option');
      thumb.setAttribute('aria-selected', String(i === active));
      const label = contentTitle(asText(slide.content));
      thumb.setAttribute('aria-label', `Slide ${i + 1}${label ? ': ' + label : ''}`);
      thumb.tabIndex = i === active ? 0 : -1;
      thumb.style.width = w + 'px';

      // A faithful mini-render of the slide (layout + theme colour + text + images), tinted with
      // the ACTUAL rendered slide colours where we can read them off the live canvas.
      const face = buildThumbFace(slide, deckTheme, readRenderedColors(i));

      const num = document.createElement('span');
      num.className = 'deck-thumb__num';
      num.textContent = String(i + 1);

      const del = document.createElement('span');
      del.className = 'deck-thumb__del';
      del.setAttribute('role', 'button');
      del.setAttribute('aria-label', `Delete slide ${i + 1}`);
      del.title = 'Delete slide';
      del.textContent = '×';
      // The × is a span (a nested <button> inside the thumb <button> would be invalid HTML),
      // so deletion is ALSO reachable from the keyboard: Delete/Backspace on the focused thumb.
      const deleteThis = (): void => {
        const d = readDeck();
        if (d.length <= 1) return;   // keep at least one slide
        const next = d.slice(0, i).concat(d.slice(i + 1));
        commitDeck(next);
        setActive(Math.min(i, next.length - 1));
      };
      del.addEventListener('click', (e) => { e.stopPropagation(); deleteThis(); });

      thumb.append(face, num, del);
      thumb.addEventListener('click', () => setActive(i));
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setActive(i + 1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setActive(i - 1); }
        else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
        else if (e.key === 'End') { e.preventDefault(); setActive(readDeck().length - 1); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteThis(); }
      });
      stripScroll.appendChild(thumb);
    });

    // add-slide button
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'deck-thumb deck-thumb--add';
    add.setAttribute('aria-label', 'Add slide');
    add.title = 'Add slide';
    add.textContent = '+';
    add.disabled = deck.length >= MAX_SLIDES;
    add.addEventListener('click', () => {
      const d = readDeck();
      if (d.length >= MAX_SLIDES) return;
      const next = d.concat([coerceSlide({})]);
      commitDeck(next);
      setActive(next.length - 1);
    });
    stripScroll.appendChild(add);

    stripScroll.scrollLeft = prevScroll;
    // keep the active thumb in view (scrollIntoView is absent in jsdom test envs)
    stripScroll.querySelector<HTMLElement>('.deck-thumb.is-active')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    // move focus to the active thumb only if focus already lives in the strip (so we don't
    // steal focus from the canvas / a text field mid-edit)
    if (stripScroll.contains(document.activeElement)) {
      stripScroll.querySelector<HTMLElement>('.deck-thumb.is-active')?.focus();
    }
  }

  // load popover ----------------------------------------------------------------
  let loadPop: HTMLElement | null = null;
  const closeLoad = (): void => { loadPop?.remove(); loadPop = null; document.removeEventListener('keydown', onLoadKey, true); };
  const onLoadKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); closeLoad(); } };

  function openLoad(): void {
    if (loadPop) { closeLoad(); return; }
    loadPop = document.createElement('div');
    loadPop.className = 'deck-load';
    // Dialog semantics (it's a hand-rolled popover, not mountModal, but should still announce
    // as a labelled dialog). It already closes on Escape + focuses the textarea (see below).
    loadPop.setAttribute('role', 'dialog');
    loadPop.setAttribute('aria-modal', 'true');
    loadPop.setAttribute('aria-label', 'Load a deck');
    loadPop.innerHTML =
      '<div class="deck-load__hd">Load a deck</div>' +
      '<p class="deck-load__hint">Paste, <strong>upload</strong>, or <strong>drop a file</strong> - Markdown (slides split by <code>---</code>), JSON (an array of slides), a <strong>pptxgenjs</strong> script, or a PowerPoint <strong>.pptx</strong> (re-themed to your brand).</p>';
    const ta = document.createElement('textarea');
    ta.className = 'deck-load__ta';
    ta.setAttribute('aria-label', 'Deck Markdown or JSON');
    ta.placeholder = '# My first slide\nA subtitle line\n\n---\n\n# Second slide\n![](https://example.com/pic.jpg)';
    const err = document.createElement('div');
    err.className = 'deck-load__err';
    err.hidden = true;
    // The err div is styled as an ERROR (red); an informational note reuses it but overrides
    // the colour inline - cleared again whenever a real error lands.
    const showErr = (msg: string): void => { err.hidden = false; err.style.color = ''; err.textContent = msg; };
    const showNote = (msg: string): void => { err.hidden = false; err.style.color = 'var(--ink-muted)'; err.textContent = msg; };

    // A binary .pptx (the upload/drop path only - never the textarea): unzip via the web
    // bridge (fflate stays a dynamic chunk; the engine reader is zip-free and already
    // statically bundled), lower to freeform slides, snap the imported palette to the
    // brand, commit as ONE undo step.
    const loadPptxFile = async (bytes: ArrayBuffer): Promise<void> => {
      const { inflatePptx } = await import('../bridge/pptx.ts');
      const parts = await inflatePptx(bytes);
      if (!isPptx(parts)) throw new Error('That file is not a PowerPoint presentation (.pptx).');
      const deck = readPptx(parts, (xml) => new DOMParser().parseFromString(xml, 'application/xml'));
      const total = deck.slides.length;
      // The source deck's own author (docProps/core.xml) → the tool's
      // sourceAuthor input, so the re-export credits both authors when they
      // differ (plans/144 G6). Visible in the sidebar; the user can clear it.
      const creator = deck.coreProps?.creator?.trim();
      if (creator) { try { void runtime.setInput('sourceAuthor', creator); } catch { /* older manifest without the input */ } }
      // Memoised + budgeted resolver; slides past MAX_SLIDES are sliced off inside
      // pptxDeckToSlides BEFORE lowering, so their media is never encoded at all.
      let slides = pptxDeckToSlides(deck, makeMediaResolver((path) => pptxMediaDataUrl(parts, path)));
      try { slides = await brandifyDeck(slides); } catch { /* keep the imported colours */ }
      commitDeck(slides);
      setActive(0);
      if (total > MAX_SLIDES) {
        // informational, not an error - the popover stays open so the note is readable
        showNote('Loaded the first ' + MAX_SLIDES + ' slides - the deck has ' + total + '.');
      } else {
        closeLoad();
      }
    };
    // Read a picked / dropped file: a binary PowerPoint deck goes straight through the
    // .pptx importer; anything else is text into the textarea.
    const readFile = (file: File | null | undefined): void => {
      if (!file) return;
      let pptx = /\.pptx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      void (async () => {
        try {
          const buf = await file.arrayBuffer();
          const b = new Uint8Array(buf);
          // PK\x03\x04 = a zip container (every real .pptx, whatever it's named); a zip that
          // ISN'T a deck is told apart by isPptx() with a clear error, not decoded as text.
          pptx ||= b.length > 3 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
          if (pptx) { await loadPptxFile(buf); return; }
          ta.value = new TextDecoder().decode(buf);
          err.hidden = true;
          ta.focus();
        } catch (e) {
          showErr((pptx ? 'Could not import that PowerPoint file. ' : 'Could not read that file. ') + ((e as Error)?.message ?? ''));
        }
      })();
    };
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.md,.markdown,.mdown,.json,.txt,.js,.mjs,.pptx,text/markdown,application/json,text/plain,text/javascript,application/vnd.openxmlformats-officedocument.presentationml.presentation';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => readFile(fileInput.files?.[0]));
    // Drag-and-drop a file anywhere on the popover.
    loadPop.addEventListener('dragover', (e) => { e.preventDefault(); loadPop?.classList.add('is-dragover'); });
    loadPop.addEventListener('dragleave', () => loadPop?.classList.remove('is-dragover'));
    loadPop.addEventListener('drop', (e) => {
      e.preventDefault(); loadPop?.classList.remove('is-dragover');
      readFile(e.dataTransfer?.files?.[0]);
    });

    const row = document.createElement('div');
    row.className = 'deck-load__row';
    const upload = document.createElement('button');
    upload.type = 'button'; upload.className = 'deck-load__btn'; upload.textContent = 'Upload file…';
    upload.addEventListener('click', () => fileInput.click());
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'deck-load__btn'; cancel.textContent = 'Cancel';
    cancel.addEventListener('click', closeLoad);
    const go = document.createElement('button');
    go.type = 'button'; go.className = 'deck-load__btn deck-load__btn--go'; go.textContent = 'Load deck';
    go.addEventListener('click', async () => {
      const text = ta.value.trim();
      if (!text) { closeLoad(); return; }
      let slides: Slide[];
      try { slides = parseDeck(text); }
      catch (e) { showErr('Could not parse that - check the Markdown / JSON / pptxgenjs. ' + (e as Error).message); return; }
      if (!slides.length) { showErr('No slides found in that input.'); return; }
      // A pptxgenjs import arrives with its own colours - re-theme them to the brand palette.
      if (isPptxGenSource(text)) { try { slides = await brandifyDeck(slides); } catch { /* keep the imported colours */ } }
      commitDeck(slides);
      setActive(0);
      closeLoad();
    });
    row.append(upload, cancel, go);
    loadPop.append(ta, err, row, fileInput);
    overlay.appendChild(loadPop);
    document.addEventListener('keydown', onLoadKey, true);
    ta.focus();
  }
  loadBtn.addEventListener('click', openLoad);

  // Click the slide's text on the canvas → open the rich-text editor, caret where you
  // clicked. Layout mode only: a freeform slide is edited per box, through its own overlay.
  //
  // Delegated from the canvas ELEMENT, which survives the full-innerHTML repaint the tool
  // does on every commit - a listener bound to the rendered text inside would not.
  //
  // Editing edits activeSlide(), and this only lands on the RIGHT slide when the deck is
  // FROZEN: frozen takes pointer-events off every slide but the focused one (styles.css /
  // buildAnimCss), so a click can only reach the active slide. When the deck is instead
  // playing (sl-anim: a transition is set and nothing is focused) the slides are stacked
  // full-frame layers all catching clicks, and the topmost is not activeSlide() - so a
  // click there would edit the wrong slide. Bail; the user focuses a slide first (clicking
  // a filmstrip thumb freezes onto it), and the "Edit text" button covers the rest.
  const onCanvasClick = (e: MouseEvent): void => {
    if (isEditingLayout()) return;                            // already editing
    if (!opts.canvasEl.querySelector('.slides.sl-frozen')) return;   // only when frozen on one slide
    if (asText(activeSlide()?.mode) === 'freeform') return;   // freeform owns its canvas
    const t = e.target as Element | null;
    if (!t?.closest) return;
    // A slot (filled or empty) is an image target: clicking it opens the picker straight away - 
    // the primary way to fill a layout slide's media without hunting for the sidebar field.
    const slotEl = t.closest<HTMLElement>('.sl-slot');
    if (slotEl) { void pickSlot(slotEl); return; }
    // The brand logo or the page number is furniture, not a text click.
    if (t.closest('.sl-logo, .sl-pageno')) return;
    // The text bands, or the bare slide - the latter so a slide with no text yet can still
    // be clicked into, rather than being the one slide you can't start typing on.
    if (!t.closest('.sl-head, .sl-body, .sl-slide')) return;
    openTextEditor({ x: e.clientX, y: e.clientY });
  };
  opts.canvasEl.addEventListener('click', onCanvasClick);

  // wire up ---------------------------------------------------------------------
  renderAll();
  // Re-render when the model changes (add/remove/reorder/nav/edit). Skip work when the
  // deck signature + active index are unchanged so unrelated input edits don't thrash it.
  let lastSig = '';
  // The signature covers everything buildThumbFace draws - the full content, the slide
  // theme/bg (thumbnails reflect the scheme), and ALL slots the layout can show (media1-4),
  // plus the deck-level theme (a global-theme change restyles every themed slide). Anything
  // the thumbnail renders must be here, or a change to it leaves the strip stale.
  // The signature also covers the toolbar + free-canvas surfaces: per-slide mode / logo and
  // the freeform `boxes` geometry (a box move/resize/add/delete must repaint the layer), so a
  // committed change to any of them re-renders. A live drag doesn't commit until pointer-up,
  // so this never thrashes mid-gesture.
  const sigOf = (): string => {
    const deck = readDeck();
    const deckTheme = String(runtime.getModel().find(i => i.id === 'theme')?.value ?? '');
    return activeIndex() + '|' + deckTheme + '|' + deck.map(s =>
      `${s.layout}:${s.bg}:${s.theme}:${s.logo}:${s.mode}:${s.content || ''}:${refUrl(s.media1)}:${refUrl(s.media2)}:${refUrl(s.media3)}:${refUrl(s.media4)}:${JSON.stringify(s.boxes || [])}`
    ).join('~');
  };
  lastSig = sigOf();
  const unsubscribe = runtime.subscribe(() => {
    if (!overlay.isConnected) return;
    if (gesture) return;    // a live drag/resize owns the DOM until pointer-up commits
    if (editingBox >= 0) return;   // an open box text edit owns its node until it commits
    // An OPEN colour popover (the inspector's fill / text / border pickers) owns its DOM:
    // every slider/hex/swatch change commits through patchSel, and rebuilding the overlay
    // on that commit would tear the popover - and the slider under the pointer, mid-drag - 
    // out of the DOM after a single increment. The field keeps its own trigger swatch in
    // sync and the tool repaints the canvas regardless; lastSig stays stale, so the overlay
    // catches up on the first commit or selection change after the popover closes.
    if (overlay.querySelector('.color-popover:not([hidden])')) return;   // inspector lives in freeChrome
    const sig = sigOf();
    if (sig === lastSig) return;
    lastSig = sig;
    renderAll();
  });

  // Keep the freeform overlay glued to the canvas as the stage resizes (window / sidebar
  // toggle) or our own reserve-driven re-fit moves it. repositionFree is a lightweight
  // reposition (no rebuild), so an open colour popover survives. A live gesture owns the DOM.
  // (Tauri's older WebView, the CLI's jsdom renderer, and the unit tests have no ResizeObserver.)
  const stageRO = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => { if (overlay.isConnected && !gesture) repositionFree(); })
    : null;
  stageRO?.observe(stageEl);

  return {
    destroy(): void {
      try { unsubscribe(); } catch { /* already gone */ }
      try { stageRO?.disconnect(); } catch { /* already gone */ }
      // Release the reserved stage bands so a non-deck tool mounted next fits the whole stage.
      stageEl.style.removeProperty('--stage-reserve-top');
      stageEl.style.removeProperty('--stage-reserve-bottom');
      opts.canvasEl.dispatchEvent(new Event('canvas-resize'));
      detachGesture();
      closeCtxMenu();   // the menu lives on stageEl (not the overlay) + holds document listeners
      opts.canvasEl.removeEventListener('click', onCanvasClick);
      document.removeEventListener('keydown', onFreeKey);
      teardownLayoutEdit();
      closeLoad();
      overlay.remove();
    },
  };
}

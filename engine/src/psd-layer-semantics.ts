// SPDX-License-Identifier: MPL-2.0
/**
 * What a Photoshop layer IS, beyond its pixels (plans/289 item 1): live type,
 * a shape drawn with the shape tool, a vector path, a solid colour fill, and
 * the things an importer has to say it could not keep (effects, smart objects,
 * gradient fills, adjustments). Read from the layer's tagged blocks (`TySh`,
 * `vogk`, `vmsk`/`vsms`, `SoCo`, `vstk`, `iOpa` and the keys that only earn a
 * note) with the readers in psd-descriptor.ts.
 *
 * The result is editor-neutral: document pixels, `#rrggbb` colours, a numeric
 * font weight. The web shell turns it into Design text, shape and path boxes
 * (shells/web/src/views/psd-import.ts); `psd.ts` attaches it to each layer.
 *
 * Follows Adobe's Photoshop File Formats Specification, with the interpretation
 * choices of Composa's PsdText.cs and PsdVector.cs (MIT, Copyright (c) 2026
 * Dennis van der Stelt): the placement test for shear and uneven scale, the
 * paragraph-frame test, tracking in thousandths of an em, the PostScript-name
 * reading, and the origination types. Where Lolly can do more it does: a path
 * that is not a rectangle or an ellipse stays a vector path instead of becoming
 * pixels, and a stroke is kept instead of dropped.
 */

import {
  descBool, descChild, descColor, descData, descEnum, descList, descNumber, descText,
  engineBool, engineList, engineNumber, engineString, engineWalk, parseEngineData,
  readDescriptor, readVersionedDescriptor, type DescObject, type EngineValue,
} from './psd-descriptor.ts';

export interface PsdRect { x: number; y: number; w: number; h: number }

/** A stretch of type layer text with one character style. */
export interface PsdTextRun {
  text: string;
  /** The family read from the run's font name; null when the run has no font. */
  family: string | null;
  /** 100 to 900; faux bold reads as at least 700. */
  weight: number;
  /** From the font name, or faux italic. */
  italic: boolean;
  /** Font size in document pixels. */
  size: number;
  color: string | null;
  underline: boolean;
  strike: boolean;
}

export interface PsdTextInfo {
  text: string;
  /** The font's PostScript name as Photoshop stores it, e.g. `Helvetica-BoldOblique`. */
  postScriptName: string | null;
  /** The family read from that name, e.g. `Helvetica`; null when the layer gives no font. */
  family: string | null;
  /** 100 to 900, read from the style words in the name. */
  weight: number;
  italic: boolean;
  /** Font size in document pixels. */
  size: number;
  color: string | null;
  /** Letter spacing in document pixels. */
  tracking: number;
  /** Line height as a multiple of the size (auto leading is 1.2). */
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  /** The text box in document pixels, unrotated, around its centre. */
  box: PsdRect;
  /** True for paragraph (frame) text, false for point text. */
  paragraph: boolean;
  /** Clockwise, in degrees. */
  rotation: number;
  /** The text split where its character style changes; together the runs spell
   *  `text`. The single-value fields above (family, weight, italic, size, colour)
   *  are the first run's. */
  runs: PsdTextRun[];
}

export interface PsdShapeInfo {
  kind: 'rect' | 'rounded' | 'ellipse';
  box: PsdRect;
  radius: number;
  fill: string | null;
  stroke: { color: string; width: number } | null;
}

export interface PsdKnot { x: number; y: number; inX: number; inY: number; outX: number; outY: number }
export interface PsdSubpath { closed: boolean; knots: PsdKnot[] }

export interface PsdPathInfo {
  subpaths: PsdSubpath[];
  fill: string | null;
  stroke: { color: string; width: number } | null;
}

export interface PsdLayerSemantics {
  text?: PsdTextInfo;
  shape?: PsdShapeInfo;
  path?: PsdPathInfo;
  /** A solid colour fill layer with no vector mask: the colour, covering the canvas. */
  fill?: string;
  /** Fill opacity (`iOpa`), 0 to 1, when it is not 1. */
  fillOpacity?: number;
  /** An adjustment layer's kind, in words ("Levels"). */
  adjustment?: string;
  /** What an importer cannot keep from this layer, in plain words. */
  notes: string[];
}

const ADJUSTMENTS: Record<string, string> = {
  levl: 'Levels', curv: 'Curves', brit: 'Brightness/Contrast', blnc: 'Color Balance', blwh: 'Black & White',
  hue2: 'Hue/Saturation', 'hue ': 'Hue/Saturation', expA: 'Exposure', vibA: 'Vibrance', selc: 'Selective Color',
  mixr: 'Channel Mixer', grdm: 'Gradient Map', phfl: 'Photo Filter', nvrt: 'Invert', thrs: 'Threshold',
  post: 'Posterize', clrL: 'Color Lookup',
};

/** The tagged-block keys this module reads; psd.ts keeps a bounded copy of each. */
export const SEMANTIC_BLOCK_KEYS: ReadonlySet<string> = new Set([
  'TySh', 'tySh', 'vogk', 'vmsk', 'vsms', 'SoCo', 'vstk', 'iOpa', 'GdFl', 'PtFl', 'SoLd', 'PlLd', 'SoLE',
  'lfx2', 'lrFX', 'lmfx', ...Object.keys(ADJUSTMENTS),
]);

const r2 = (v: number) => Math.round(v * 100) / 100;

// ── text ─────────────────────────────────────────────────────────────────────

/** The type block's transform as one scale, a rotation and a flip; null for shear or uneven scale. */
function placement(xx: number, xy: number, yx: number, yy: number): { scale: number; rotation: number; flip: boolean } | null {
  const sx = Math.hypot(xx, yx);
  if (sx <= 1e-6) return null;
  const cos = xx / sx, sin = yx / sx;
  const lx = cos * xy + sin * yy, ly = -sin * xy + cos * yy;
  const sy = Math.abs(ly);
  if (sy <= 1e-6) return null;
  const big = Math.max(sx, sy);
  if (Math.abs(lx) > 0.02 * big || Math.abs(sx - sy) > 0.02 * big) return null;
  return { scale: sx, rotation: (Math.atan2(sin, cos) * 180) / Math.PI, flip: ly < 0 };
}

const WEIGHTS: [RegExp, number][] = [
  [/(thin|hairline)/i, 100], [/(extra|ultra)\s*light/i, 200], [/light/i, 300],
  [/(semi|demi)\s*bold/i, 600], [/(extra|ultra)\s*bold/i, 800], [/(black|heavy)/i, 900], [/bold/i, 700],
  [/medium/i, 500],
];
const ITALIC = /(italic|oblique)/i;
const STYLE_WORDS = /(Thin|Hairline|ExtraLight|UltraLight|Light|Regular|Book|Normal|Medium|SemiBold|DemiBold|Semibold|Demibold|ExtraBold|UltraBold|Extrabold|Ultrabold|Bold|Black|Heavy|Italic|Oblique)+$/;

/**
 * A PostScript font name as a family, a weight and italic. The family is the
 * part before the hyphen with Adobe's `PSMT`, `MT` and `PS` tags removed and
 * run-together words spaced ("TimesNewRomanPS-BoldMT" is Times New Roman, 700).
 */
export function readFontName(name: string): { family: string; weight: number; italic: boolean } {
  const dash = name.indexOf('-');
  let family = dash > 0 ? name.slice(0, dash) : name;
  let style = dash > 0 ? name.slice(dash + 1) : '';
  if (dash < 0) {
    const m = STYLE_WORDS.exec(family);
    if (m && m.index > 0) { style = family.slice(m.index); family = family.slice(0, m.index); }
  }
  for (const tag of ['PSMT', 'MT', 'PS']) {
    if (family.length > tag.length + 2 && family.endsWith(tag)) { family = family.slice(0, -tag.length); break; }
  }
  family = family.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  let weight = 400;
  for (const [re, w] of WEIGHTS) if (re.test(style)) { weight = w; break; }
  return { family, weight, italic: ITALIC.test(style) };
}

function engineColor(values: EngineValue[]): string | null {
  const n = values.map(v => engineNumber(v)).filter((v): v is number => v != null);
  if (!n.length) return null;
  const [r, g, b] = n.length >= 4 ? [n[1]!, n[2]!, n[3]!] : n.length === 3 ? [n[0]!, n[1]!, n[2]!] : [n[0]!, n[0]!, n[0]!];
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v > 1 ? v : v * 255))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** The spacing a text box holds once for all of its text. */
function spacingSignature(sheet: EngineValue | null): string {
  const keys = ['FontSize', 'Tracking', 'AutoLeading', 'Leading', 'HorizontalScale', 'VerticalScale'];
  return keys.map(k => String(engineWalk(sheet, k) ?? '')).join('|');
}

/** One style run's character style. `fonts` is the document's FontSet. */
function runStyle(run: EngineValue | null, fonts: EngineValue[], scale: number): Omit<PsdTextRun, 'text'> & { sheet: EngineValue | null; postScriptName: string | null } {
  const sheet = run ? (engineWalk(run, 'StyleSheet', 'StyleSheetData') ?? run) : null;
  const points = engineNumber(engineWalk(sheet, 'FontSize')) ?? 12;
  const index = Math.round(engineNumber(engineWalk(sheet, 'Font')) ?? 0);
  const postScriptName = (index >= 0 && index < fonts.length ? engineString(engineWalk(fonts[index]!, 'Name')) : null) || null;
  let family: string | null = null, weight = 400, italic = false;
  if (postScriptName) ({ family, weight, italic } = readFontName(postScriptName));
  if (engineBool(engineWalk(sheet, 'FauxBold'))) weight = Math.max(weight, 700);
  if (engineBool(engineWalk(sheet, 'FauxItalic'))) italic = true;
  return {
    sheet, postScriptName, family, weight, italic,
    size: Math.max(1, Math.min(2000, points * scale)),
    color: engineColor(engineList(engineWalk(sheet, 'FillColor', 'Values'))),
    underline: engineBool(engineWalk(sheet, 'Underline')) === true,
    strike: engineBool(engineWalk(sheet, 'Strikethrough')) === true,
  };
}

const sameStyle = (a: Omit<PsdTextRun, 'text'>, b: Omit<PsdTextRun, 'text'>): boolean =>
  a.family === b.family && a.weight === b.weight && a.italic === b.italic && Math.abs(a.size - b.size) < 0.01
  && a.color === b.color && a.underline === b.underline && a.strike === b.strike;

/**
 * Split `text` into runs by the StyleRun lengths (UTF-16 units, as JavaScript
 * counts). Lengths that are missing or do not match the run list give one run in
 * the first style. Runs of the same style next to each other are joined.
 */
function splitRuns(text: string, styles: Array<Omit<PsdTextRun, 'text'>>, lengths: Array<number | null>): PsdTextRun[] {
  const first = styles[0]!;
  const usable = styles.length > 1 && lengths.length === styles.length && lengths.every(n => n != null && Number.isInteger(n) && n >= 0);
  if (!usable) return [{ ...first, text }];
  const out: PsdTextRun[] = [];
  let at = 0;
  styles.forEach((style, i) => {
    if (at >= text.length) return;
    const end = i === styles.length - 1 ? text.length : Math.min(text.length, at + lengths[i]!);
    const piece = text.slice(at, end);
    at = end;
    if (!piece) return;
    const last = out[out.length - 1];
    if (last && sameStyle(last, style)) last.text += piece;
    else out.push({ ...style, text: piece });
  });
  return out.length ? out : [{ ...first, text }];
}

function descRect(o: DescObject | null): { left: number; top: number; right: number; bottom: number } | null {
  const left = descNumber(o, 'Left'), top = descNumber(o, 'Top '), right = descNumber(o, 'Rght'), bottom = descNumber(o, 'Btom');
  return left == null || top == null || right == null || bottom == null ? null : { left, top, right, bottom };
}

/**
 * A type layer, or null with a note when it holds something a text box cannot
 * (vertical text, shear, uneven scale). `pixels` is the layer's rendered bounds,
 * which give point text its width.
 */
function readText(block: Uint8Array, pixels: PsdRect, notes: string[]): PsdTextInfo | null {
  if (block.length < 2 + 48 + 2) return null;
  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);
  if (dv.getUint16(0) !== 1) return null;
  const [xx, xy, yx, yy, tx, ty] = [0, 1, 2, 3, 4, 5].map(i => dv.getFloat64(2 + i * 8)) as [number, number, number, number, number, number];
  if (![xx, xy, yx, yy, tx, ty].every(Number.isFinite)) return null;
  if (dv.getUint16(50) !== 50) return null;
  const read = readVersionedDescriptor(block, 52);
  if (!read) return null;
  const desc = read.value;
  if (descEnum(desc, 'Ornt') === 'Vrtc') { notes.push('Vertical text is kept as pixels.'); return null; }
  const place = placement(xx, xy, yx, yy);
  if (!place) { notes.push('Text that is sheared or stretched unevenly is kept as pixels.'); return null; }
  if (place.flip) { notes.push('Mirrored text is kept as pixels.'); return null; }
  // The warp descriptor follows the text one.
  if (read.end + 2 <= block.length && dv.getUint16(read.end) === 1) {
    const warp = readVersionedDescriptor(block, read.end + 2);
    const style = warp ? descEnum(warp.value, 'warpStyle') : null;
    if (style && style !== 'warpNone' && style !== 'none') notes.push('The text warp was dropped.');
  }
  const engineBytes = descData(desc, 'EngineData');
  const engine = engineBytes ? parseEngineData(engineBytes) : null;
  const clean = (s: string | null) => (s == null ? null : s.replace(/^﻿/, '').replace(/\0+$/, '').replace(/\r\n?/g, '\n'));
  const text = clean(descText(desc, 'Txt ')) ?? clean(engineString(engineWalk(engine, 'EngineDict', 'Editor', 'Text')));
  if (!text?.trim()) return null;
  const content = text.replace(/\n+$/, '');

  // Style: the box takes the first run's; weight, italic, colour, underline and
  // strikethrough stay per run. Size, spacing and family are one per box.
  const styleRuns = engineList(engineWalk(engine, 'EngineDict', 'StyleRun', 'RunArray'));
  const fonts = engineList(engineWalk(engine, 'ResourceDict', 'FontSet'));
  const styles = (styleRuns.length ? styleRuns : [null]).map(run => runStyle(run, fonts, place.scale));
  const lengths = engineList(engineWalk(engine, 'EngineDict', 'StyleRun', 'RunLengthArray')).map(v => engineNumber(v));
  const runs = splitRuns(content, styles.map(({ sheet: _sheet, postScriptName: _name, ...style }) => style), lengths);
  const first = styles[0]!;
  const { sheet, postScriptName, family, weight, italic, size, color } = first;
  const trackingThousandths = engineNumber(engineWalk(sheet, 'Tracking')) ?? 0;
  const tracking = r2(Math.max(-100, Math.min(400, (trackingThousandths * size) / 1000)));
  const auto = engineBool(engineWalk(sheet, 'AutoLeading')) ?? true;
  const leadingPts = engineNumber(engineWalk(sheet, 'Leading'));
  const lineHeight = !auto && leadingPts && leadingPts > 0 ? r2(Math.max(0.5, Math.min(4, (leadingPts * place.scale) / size))) : 1.2;
  if (styles.some(s => spacingSignature(s.sheet) !== spacingSignature(sheet))) {
    notes.push('The text mixes sizes or spacing. All of the text uses the first size and spacing.');
  }
  if (styles.some(s => s.family !== family)) {
    notes.push('The text mixes font families. All of the text uses the first family; weight and italic are kept.');
  }
  const paras = engineList(engineWalk(engine, 'EngineDict', 'ParagraphRun', 'RunArray'));
  const just = Math.round(engineNumber(engineWalk(paras[0] ?? null, 'ParagraphSheet', 'Properties', 'Justification')) ?? 0);
  const align = just === 1 ? 'right' : just === 2 ? 'center' : 'left';
  if (just > 2) notes.push('Justified text was imported left-aligned.');

  // Placement. Paragraph text has a frame; point text is placed from its
  // rendered pixels, around their centre, so a rotated layer keeps its position.
  const lines = content.split('\n').length;
  const textH = lines * size * lineHeight;
  const rad = (place.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const bounds = descRect(descChild(desc, 'bounds'));
  const glyphs = descRect(descChild(desc, 'boundingBox'));
  let box: PsdRect;
  let paragraph = false;
  if (bounds && glyphs && bounds.right - bounds.left > glyphs.right - glyphs.left + 4 && bounds.bottom - bounds.top > glyphs.bottom - glyphs.top + 4) {
    paragraph = true;
    const w = (bounds.right - bounds.left) * place.scale, h = (bounds.bottom - bounds.top) * place.scale;
    // The frame's centre, through the transform.
    const cx = (bounds.left + bounds.right) / 2, cy = (bounds.top + bounds.bottom) / 2;
    const ccx = xx * cx + xy * cy + tx, ccy = yx * cx + yy * cy + ty;
    box = { x: r2(ccx - w / 2), y: r2(ccy - h / 2), w: r2(w), h: r2(h) };
  } else if (pixels.w > 0 && pixels.h > 0) {
    // Unrotate the rendered bounds: W = w cos + h sin, with h the line boxes.
    let w = pixels.w;
    if (sin > 0.01) w = cos > 0.3 ? (pixels.w - textH * sin) / cos : (pixels.h - textH * cos) / sin;
    // A little room, so a font whose advance runs slightly wider does not wrap.
    w = Math.max(size, w) * 1.06 + size * 0.2;
    const cx = pixels.x + pixels.w / 2, cy = pixels.y + pixels.h / 2;
    box = { x: r2(cx - w / 2), y: r2(cy - textH / 2), w: r2(w), h: r2(textH) };
    // Keep the edge the alignment reads from at Photoshop's position.
    if (sin <= 0.01) {
      if (align === 'left') box.x = r2(pixels.x - size * 0.05);
      else if (align === 'right') box.x = r2(pixels.x + pixels.w + size * 0.05 - box.w);
    }
  } else {
    // No pixels to measure: the anchor is the first baseline at the alignment edge.
    const w = Math.max(size * 2, content.length * size * 0.6);
    const top = ty - size * (0.5 * lineHeight + 0.3);
    const x = align === 'left' ? tx : align === 'right' ? tx - w : tx - w / 2;
    box = { x: r2(x), y: r2(top), w: r2(w), h: r2(textH) };
  }
  return {
    text: content, postScriptName, family, weight, italic, size: r2(size), color, tracking, lineHeight, align, box, paragraph,
    rotation: r2(place.rotation), runs: runs.map(r => ({ ...r, size: r2(r.size) })),
  };
}

// ── shapes and paths ─────────────────────────────────────────────────────────

function strokeOf(vstk: Uint8Array | undefined): { fill: boolean | null; stroke: { color: string; width: number } | null; alignment: string | null } {
  const s = vstk ? readVersionedDescriptor(vstk)?.value ?? null : null;
  if (!s) return { fill: null, stroke: null, alignment: null };
  const on = descBool(s, 'strokeEnabled') ?? false;
  const color = descColor(descChild(descChild(s, 'strokeStyleContent'), 'Clr '));
  const width = descNumber(s, 'strokeStyleLineWidth') ?? 1;
  return {
    fill: descBool(s, 'fillEnabled'),
    stroke: on && color && width > 0 && width < 10_000 ? { color, width: r2(width) } : null,
    alignment: descEnum(s, 'strokeStyleLineAlignment'),
  };
}

function originShape(vogk: Uint8Array, notes: string[]): { kind: 'rect' | 'rounded' | 'ellipse'; box: PsdRect; radius: number } | null {
  if (vogk.length < 8) return null;
  const root = readDescriptor(vogk, 8)?.value ?? null; // two versions (1 and 16) lead
  const shape = (descList(root, 'keyDescriptorList') ?? []).find(v => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array)) as DescObject | undefined;
  if (!shape) return null;
  const type = descNumber(shape, 'keyOriginType');
  if (type !== 1 && type !== 2 && type !== 5) return null;
  const b = descRect(descChild(shape, 'keyOriginShapeBBox'));
  if (!b || b.right - b.left < 1 || b.bottom - b.top < 1) return null;
  const box = { x: r2(b.left), y: r2(b.top), w: r2(b.right - b.left), h: r2(b.bottom - b.top) };
  if (type === 5) return { kind: 'ellipse', box, radius: 0 };
  let radius = 0;
  const radii = descChild(shape, 'keyOriginRRectRadii');
  if (radii) {
    const corners = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'].map(k => descNumber(radii, k)).filter((v): v is number => v != null);
    if (corners.length) {
      const lo = Math.min(...corners), hi = Math.max(...corners);
      if (hi - lo > 0.5) notes.push('The rounded rectangle\'s corners differ; the largest radius was used for all four.');
      radius = Math.max(0, hi);
    }
  }
  return { kind: radius > 0 ? 'rounded' : 'rect', box, radius: r2(radius) };
}

/** Path records (26 bytes after an 8-byte header) as subpaths of knots in document pixels. */
export function readVectorPath(mask: Uint8Array, canvasW: number, canvasH: number): PsdSubpath[] {
  const dv = new DataView(mask.buffer, mask.byteOffset, mask.byteLength);
  const out: PsdSubpath[] = [];
  let cur: PsdSubpath | null = null;
  const fx = (v: number) => v / 0x1000000;
  for (let o = 8; o + 26 <= mask.length && out.length < 1000; o += 26) {
    const type = dv.getInt16(o);
    if (type === 0 || type === 3) { cur = { closed: type === 0, knots: [] }; out.push(cur); continue; }
    if (type !== 1 && type !== 2 && type !== 4 && type !== 5) continue;
    if (!cur) { cur = { closed: type === 1 || type === 2, knots: [] }; out.push(cur); }
    if (cur.knots.length >= 20_000) continue;
    const pt = (k: number) => [fx(dv.getInt32(o + 2 + k * 8 + 4)) * canvasW, fx(dv.getInt32(o + 2 + k * 8)) * canvasH] as const;
    const [ix, iy] = pt(0), [ax, ay] = pt(1), [ox, oy] = pt(2);
    cur.knots.push({ x: r2(ax), y: r2(ay), inX: r2(ix), inY: r2(iy), outX: r2(ox), outY: r2(oy) });
  }
  return out.filter(s => s.knots.length >= 2);
}

/** Four sharp, axis-aligned corners in one subpath: a rectangle even without an origination record. */
function sharpRect(subpaths: PsdSubpath[]): PsdRect | null {
  if (subpaths.length !== 1 || subpaths[0]!.knots.length !== 4) return null;
  const k = subpaths[0]!.knots;
  if (k.some(p => Math.hypot(p.inX - p.x, p.inY - p.y) > 0.5 || Math.hypot(p.outX - p.x, p.outY - p.y) > 0.5)) return null;
  for (let i = 0; i < 4; i++) {
    const a = k[i]!, b = k[(i + 1) % 4]!;
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) return null;
  }
  const xs = k.map(p => p.x), ys = k.map(p => p.y);
  const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  return box.w >= 1 && box.h >= 1 ? box : null;
}

// ── the layer ────────────────────────────────────────────────────────────────

/**
 * Everything this module can say about one layer, or null when it is an
 * ordinary pixel layer with nothing to add. `blocks` holds the layer's tagged
 * blocks by key, `pixels` its rendered bounds, `canvas` the document size.
 */
export function readLayerSemantics(blocks: ReadonlyMap<string, Uint8Array>, pixels: PsdRect, canvas: { w: number; h: number }): PsdLayerSemantics | null {
  const notes: string[] = [];
  const out: PsdLayerSemantics = { notes };
  const get = (k: string) => blocks.get(k);

  const tySh = get('TySh') ?? get('tySh');
  if (tySh) {
    const text = readText(tySh, pixels, notes);
    if (text) out.text = text;
  }

  const soco = get('SoCo');
  const fill = soco ? descColor(descChild(readVersionedDescriptor(soco)?.value ?? null, 'Clr ')) : null;
  if (soco && !fill) notes.push('The fill colour could not be read; the layer is kept as pixels.');
  if (get('GdFl')) notes.push('Gradient fill kept as pixels.');
  if (get('PtFl')) notes.push('Pattern fill kept as pixels.');
  const { fill: fillOn, stroke, alignment } = strokeOf(get('vstk'));
  if (stroke && alignment && alignment !== 'strokeStyleAlignCenter') notes.push('The stroke is drawn centred on the edge; Photoshop drew it inside or outside.');
  const mask = get('vmsk') ?? get('vsms');
  const vogk = get('vogk');
  const hasVector = !!(mask || vogk);
  const shapeFill = fillOn === false ? null : fill;

  if (!out.text && hasVector && (shapeFill || stroke)) {
    const origin = vogk ? originShape(vogk, notes) : null;
    const subpaths = mask ? readVectorPath(mask, canvas.w, canvas.h) : [];
    const rect = !origin ? sharpRect(subpaths) : null;
    if (origin) out.shape = { ...origin, fill: shapeFill, stroke };
    else if (rect) out.shape = { kind: 'rect', box: rect, radius: 0, fill: shapeFill, stroke };
    else if (subpaths.length) out.path = { subpaths, fill: shapeFill, stroke };
  } else if (!out.text && fill && !hasVector) {
    out.fill = fill;
  }

  const iOpa = get('iOpa');
  if (iOpa && iOpa.length >= 1 && iOpa[0]! < 255) out.fillOpacity = r2(iOpa[0]! / 255);

  for (const [k, name] of Object.entries(ADJUSTMENTS)) {
    if (get(k)) { out.adjustment = name; notes.push(`${name} adjustment layer was not applied.`); break; }
  }
  if (get('lfx2') || get('lrFX') || get('lmfx')) notes.push('Layer effects (shadows, glows, strokes) were dropped.');
  if (get('SoLd') || get('PlLd') || get('SoLE')) notes.push('Smart object kept as pixels.');

  return out.text || out.shape || out.path || out.fill || out.fillOpacity != null || out.adjustment || notes.length ? out : null;
}

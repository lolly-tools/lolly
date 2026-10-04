// SPDX-License-Identifier: MPL-2.0
/**
 * What `logo: auto` and the text slots need to know about a photograph under a
 * composed slide (plan 291 M4): the light of the picture where the master places its
 * logo and its text, and the colours of each logo mark. The engine composes synchronously and reads no bytes, so this
 * measures first and hands it `DesignComposeContext.photoSurface`.
 *
 * A slide is measured when its `under` rows hold a picture covering 90% or more of it
 * (the engine's own test) and the picture's bytes are here: the source deck's media
 * (`user/media/<sha256>`, `photo:<sha12>`) or a file the caller supplied for a
 * placeholder key (`--asset=KEY=PATH`). Its plain `under` rows are drawn at a quarter
 * of the slide's size with resvg (pictures with their fit, position and flips, boxes
 * with their fill, linear `grad` and opacity, a percent as Design reads it), and a
 * box's light is read as the 20th and 80th percentiles of relative luminance. A colour
 * written as a token (`{color.brand.pine}`, a `$tint` on a scrim) is drawn through the
 * caller's resolver. A slide whose rows this cannot draw as the canvas will (a token
 * that does not resolve, a radial or conic gradient, a picture with a photo look or
 * with no bytes here) is left unmeasured, and the caller is told why, rather than the
 * bare photo being judged. A mark's colours come from its SVG; a mark that is not an
 * SVG has none, and the engine then leaves the pick alone.
 *
 * Reads files and nothing else: no network, no browser.
 */
import { readFile } from 'node:fs/promises';

import { colorToHexString, extractSvgColors, gradientSpecStops, parseColor, parseGradientSpec, parseTreatedAssetId, tintGradientSpec } from '@lolly/engine';
import type { DesignComposeContext } from '@lolly/engine';

type Row = Record<string, unknown>;
type Box = { x: number; y: number; w: number; h: number };

const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
/** The share of a slide one picture must cover to be its photograph (as the engine's `PHOTO_COVER`). */
const PHOTO_COVER = 0.9;
/** The slide is drawn at this fraction of its size for measuring. */
const SCALE = 0.25;
const ALIGN: Record<string, string> = {
  'left top': 'xMinYMin', 'center top': 'xMidYMin', top: 'xMidYMin', 'right top': 'xMaxYMin',
  'left center': 'xMinYMid', left: 'xMinYMid', center: 'xMidYMid', 'right center': 'xMaxYMid', right: 'xMaxYMid',
  'left bottom': 'xMinYMax', 'center bottom': 'xMidYMax', bottom: 'xMidYMax', 'right bottom': 'xMaxYMax',
};

function mimeOf(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  return null;
}

function boxOf(row: Row): Box | null {
  const [x, y, w, h] = ['x', 'y', 'w', 'h'].map((k) => Number(row[k]));
  if (![x, y, w, h].every(Number.isFinite) || !(w! > 0) || !(h! > 0)) return null;
  return { x: x!, y: y!, w: w!, h: h! };
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** How the caller reads a colour a row writes as a token, for one slide. */
export interface ComposePhotoOptionsV1 {
  /** A token reference (`{color.brand.pine}`) as hex for this slide, or null when it does not resolve. */
  resolveColour?: (ref: string, slideIndex: number) => string | null;
  /** Told of each slide with a covering photograph that was left unmeasured, and why. */
  onUnmeasured?: (slideIndex: number, reason: string) => void;
}

/** A row drawn, or why the canvas's drawing of the row cannot be reproduced here. */
type Drawn = { svg: string; picture: Box | null } | { refused: string; quiet?: boolean };

const isRef = (value: string): boolean => /^\{[^{}]+\}$/.test(value.trim());
const hiddenRow = (row: Row): boolean => row.hidden === true || row.hidden === 1 || row.hidden === 'true' || row.hidden === '1';

/** A colour value as hex and alpha: a literal, a token through the resolver, or the cached value of a token var. Null when it does not resolve. */
function paintOf(value: string, slideIndex: number, opts: ComposePhotoOptionsV1): { hex: string; alpha: number } | null {
  const text = value.trim();
  if (!text || /^(none|transparent)$/i.test(text)) return { hex: '#000000', alpha: 0 };
  let literal = text;
  if (isRef(text)) {
    const hex = opts.resolveColour?.(text, slideIndex);
    if (!hex) return null;
    literal = hex;
  } else {
    // `var(--brand-token-<hex>, <cached>)`: the token's cached value.
    const cached = /^var\(\s*--[\w-]+\s*,\s*(.+)\)$/i.exec(text);
    if (cached) literal = cached[1]!.trim();
  }
  const colour = parseColor(literal);
  if (!colour) return null;
  return { hex: colorToHexString({ ...colour, alpha: 1 }).slice(0, 7), alpha: Math.max(0, Math.min(1, colour.alpha ?? 1)) };
}

/** A row's linear `grad` (recoloured by `$tint`) as an SVG gradient over its box, or why it cannot be drawn. */
function gradSvg(row: Row, box: Box, id: string, slideIndex: number, opts: ComposePhotoOptionsV1): { defs: string; fill: string } | { refused: string } {
  let spec = String(row.grad).trim();
  if (row.$tint !== undefined) {
    const raw = typeof row.$tint === 'string' ? row.$tint.trim() : '';
    const ref = raw && !isRef(raw) ? `{${raw}}` : raw;
    const hex = ref ? opts.resolveColour?.(ref, slideIndex) : null;
    const tinted = hex ? tintGradientSpec(spec, hex) : null;
    if (!tinted) return { refused: `its scrim's $tint ${raw || '(empty)'} does not resolve here` };
    spec = tinted;
  }
  const g = parseGradientSpec(spec);
  if (!g) return { refused: `its grad ${spec.slice(0, 40)} does not read` };
  if (g.kind !== 'linear') return { refused: `it has a ${g.kind} gradient, which this measurement does not draw` };
  let angle = g.angle;
  if (row.flipH === true) angle = (360 - angle) % 360;
  if (row.flipV === true) angle = (540 - angle) % 360;
  // CSS geometry: 0 deg points up, 90 deg right, and the line spans the box's corners.
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(box.w * dx) + Math.abs(box.h * dy)) / 2;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const stops = gradientSpecStops(g).map((s) => {
    const hex = colorToHexString({ ...s.color, alpha: 1 }).slice(0, 7);
    const alpha = Math.max(0, Math.min(1, s.color.alpha ?? 1));
    return `<stop offset="${Math.max(0, Math.min(100, s.pos))}%" stop-color="${hex}" stop-opacity="${alpha}"/>`;
  });
  return {
    defs: `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${cx - dx * half}" y1="${cy - dy * half}" x2="${cx + dx * half}" y2="${cy + dy * half}">${stops.join('')}</linearGradient>`,
    fill: `url(#${id})`,
  };
}

/**
 * A plain `under` row as SVG: a picture with its fit and position, or a box with its
 * fill and linear gradient. Empty for a row that paints nothing measured here (text, a
 * macro, a hidden row); `refused` for one that paints and cannot be drawn faithfully.
 */
function rowSvg(row: Row, bytesOf: (key: string) => Uint8Array | null, slideIndex: number, n: number, opts: ComposePhotoOptionsV1): Drawn {
  const box = boxOf(row);
  if (!box || hiddenRow(row)) return { svg: '', picture: null };
  // Design opacity is a percent, 0 to 100 (the renderer's `clamp(num(b.opacity, 100), 0, 100) / 100`).
  const rawOpacity = row.opacity === undefined || row.opacity === null || row.opacity === '' ? 100 : Number(row.opacity);
  const opacity = Number.isFinite(rawOpacity) ? Math.max(0, Math.min(100, rawOpacity)) / 100 : 1;
  const rot = Number(row.rot);
  const turn = Number.isFinite(rot) && rot % 360 !== 0 ? ` transform="rotate(${rot} ${box.x + box.w / 2} ${box.y + box.h / 2})"` : '';
  const group = (inner: string): string => (opacity < 1 || turn ? `<g${opacity < 1 ? ` opacity="${opacity}"` : ''}${turn}>${inner}</g>` : inner);
  if (row.kind === 'image' || (row.kind === undefined && typeof row.image === 'string')) {
    const key = typeof row.image === 'string' ? row.image : record(row.image) && typeof row.image.id === 'string' ? row.image.id : '';
    if (!key) return { svg: '', picture: null };
    if (parseTreatedAssetId(key).treatment) return { refused: `its picture ${key} carries a photo look, which this measurement does not bake` };
    const bytes = bytesOf(key);
    const mime = bytes ? mimeOf(bytes) : null;
    // compose.asset.needed already says a placeholder has no bytes here, so this one is quiet.
    if (!bytes || !mime) return { refused: `the bytes of ${key} are not here`, quiet: true };
    const fit = String(row.fit ?? 'contain');
    const align = ALIGN[String(row.imgpos ?? '').trim()] ?? 'xMidYMid';
    const aspect = fit === 'fill' ? 'none' : `${align} ${fit === 'cover' ? 'slice' : 'meet'}`;
    const flipH = row.flipH === true;
    const flipV = row.flipV === true;
    // Inside the nested svg the picture's box starts at 0,0, so a flip turns about its centre there.
    const flip = flipH || flipV
      ? ` transform="translate(${box.w / 2} ${box.h / 2}) scale(${flipH ? -1 : 1} ${flipV ? -1 : 1}) translate(${-box.w / 2} ${-box.h / 2})"`
      : '';
    const href = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
    return {
      svg: group(`<svg x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" overflow="hidden"><image${flip} x="0" y="0" width="${box.w}" height="${box.h}" preserveAspectRatio="${aspect}" href="${esc(href)}"/></svg>`),
      picture: box,
    };
  }
  if (row.kind === 'box' || row.kind === undefined) {
    const parts: string[] = [];
    const rect = (fill: string, alpha = 1): string => `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${fill}"${alpha < 1 ? ` fill-opacity="${alpha}"` : ''}/>`;
    if (typeof row.bg === 'string' && row.bg.trim()) {
      const paint = paintOf(row.bg, slideIndex, opts);
      if (!paint) return { refused: `its fill ${row.bg.trim()} does not resolve here` };
      if (paint.alpha > 0) parts.push(rect(paint.hex, paint.alpha));
    }
    // The renderer draws the gradient over the box's own fill.
    if (typeof row.grad === 'string' && row.grad.trim()) {
      const grad = gradSvg(row, box, `g${slideIndex}-${n}`, slideIndex, opts);
      if ('refused' in grad) return grad;
      parts.push(`<defs>${grad.defs}</defs>${rect(grad.fill)}`);
    }
    return { svg: parts.length ? group(parts.join('')) : '', picture: null };
  }
  return { svg: '', picture: null };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function hexLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  if (!m) return null;
  const v = Number.parseInt(m[1]!, 16);
  return relativeLuminance((v >> 16) & 255, (v >> 8) & 255, v & 255);
}

/** One measured slide: its drawn under rows as luminance, at SCALE. */
interface Measured { width: number; height: number; lum: Float32Array }

function percentilesUnder(m: Measured, box: Box): { low: number; high: number; mid: number } | null {
  const x0 = Math.max(0, Math.floor(box.x * SCALE));
  const y0 = Math.max(0, Math.floor(box.y * SCALE));
  const x1 = Math.min(m.width, Math.ceil((box.x + box.w) * SCALE));
  const y1 = Math.min(m.height, Math.ceil((box.y + box.h) * SCALE));
  const values: number[] = [];
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) values.push(m.lum[y * m.width + x]!);
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const at = (q: number): number => values[Math.min(values.length - 1, Math.max(0, Math.round(q * (values.length - 1))))]!;
  return { low: at(0.2), high: at(0.8), mid: at(0.5) };
}

/** The colours a logo mark paints with, from its SVG in the active catalog; null for a mark with no SVG in this catalog. */
async function markInks(id: string): Promise<string[] | null> {
  try {
    const { contentUrlFile, readAssetIndex } = await import('./content-roots.ts');
    const index = readAssetIndex() as { assets?: Array<{ id?: string; formats?: Array<{ format?: string; url?: string }> }> };
    const entry = (index.assets ?? []).find((a) => a.id === id.replace(/\?.*$/, ''));
    const svg = (entry?.formats ?? []).find((f) => String(f.format).toLowerCase() === 'svg' && f.url);
    const file = svg?.url ? contentUrlFile(svg.url) : null;
    if (!file) return null;
    const colours = extractSvgColors(await readFile(file, 'utf8'));
    // An SVG that sets no paint fills in black.
    if (!colours.length) return ['#000000'];
    // A mark that carries its own contrast (a badge, a light shape on a dark one) does
    // not lean on the picture, so the picture does not judge that mark.
    const lums = colours.map((c) => hexLuminance(c)).filter((l): l is number => l !== null);
    if (lums.length && (Math.max(...lums) + 0.05) / (Math.min(...lums) + 0.05) >= 3) return null;
    return colours;
  } catch {
    return null;
  }
}

/**
 * Measure the photographs under a spec's slides for `logo: auto` and the text over them, or null when no slide
 * has one whose bytes are here. `bytesOf` answers an `image` value with its bytes.
 */
export async function measureComposePhotos(
  spec: unknown,
  size: { width: number; height: number },
  bytesOf: (key: string) => Uint8Array | null,
  marks: readonly string[],
  opts: ComposePhotoOptionsV1 = {},
): Promise<DesignComposeContext['photoSurface'] | null> {
  const slides = record(spec) && Array.isArray(spec.slides) ? spec.slides : [];
  const measured = new Map<number, Measured>();
  const { rasterizeSvgToRgba } = await import('./raster.ts');
  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    if (!record(slide) || !Array.isArray(slide.under)) continue;
    // Only `logo: auto` judges a mark against the photograph, so only it is told of a
    // slide left unmeasured; the slide's choice wins over the deck's. The text slots
    // over the photograph are judged whatever the logo does.
    const deckFurniture = record(spec) && record(spec.furniture) ? spec.furniture : {};
    const furniture = record(slide.furniture) ? slide.furniture : {};
    const logoMode = furniture.logo ?? deckFurniture.logo ?? 'auto';
    const omitted = [deckFurniture.omit, furniture.omit].some((list) => Array.isArray(list) && list.includes('logo'));
    const tell = logoMode === 'auto' && !omitted;
    let covered = false;
    let refused: { reason: string; quiet: boolean } | null = null;
    const parts: string[] = [];
    for (const [n, row] of (slide.under as unknown[]).entries()) {
      if (!record(row)) continue;
      const drawn = rowSvg(row, bytesOf, index, n, opts);
      // A picture that covers the slide is still the slide's photograph when it cannot be drawn.
      const box = boxOf(row);
      const isPicture = row.kind === 'image' || (row.kind === undefined && row.image !== undefined);
      if (isPicture && box && !hiddenRow(row)) {
        const across = Math.max(0, Math.min(size.width, box.x + box.w) - Math.max(0, box.x));
        const down = Math.max(0, Math.min(size.height, box.y + box.h) - Math.max(0, box.y));
        if ((across * down) / (size.width * size.height) >= PHOTO_COVER) covered = true;
      }
      if ('refused' in drawn) {
        refused ??= { reason: `under row ${n + 1}${typeof row.id === 'string' ? ` (${row.id})` : ''}: ${drawn.refused}`, quiet: drawn.quiet === true };
        continue;
      }
      if (drawn.svg) parts.push(drawn.svg);
    }
    if (!covered) continue;
    if (refused) {
      if (!refused.quiet && tell) opts.onUnmeasured?.(index, refused.reason);
      continue;
    }
    const width = Math.max(1, Math.round(size.width * SCALE));
    const height = Math.max(1, Math.round(size.height * SCALE));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}" width="${width}" height="${height}"><rect width="${size.width}" height="${size.height}" fill="#ffffff"/>${parts.join('')}</svg>`;
    try {
      const frame = await rasterizeSvgToRgba(svg, width, height);
      const lum = new Float32Array(frame.width * frame.height);
      for (let i = 0; i < lum.length; i += 1) lum[i] = relativeLuminance(frame.data[i * 4]!, frame.data[i * 4 + 1]!, frame.data[i * 4 + 2]!);
      measured.set(index, { width: frame.width, height: frame.height, lum });
    } catch {
      // A picture resvg cannot draw leaves this slide unmeasured.
      if (tell) opts.onUnmeasured?.(index, 'its pictures could not be drawn here');
    }
  }
  if (!measured.size) return null;
  const inks: Record<string, string[]> = {};
  for (const id of new Set(marks)) {
    const found = await markInks(id);
    if (found) inks[id] = found;
  }
  return {
    luminanceUnder: (slideIndex, box) => {
      const m = measured.get(slideIndex);
      return m ? percentilesUnder(m, box) : null;
    },
    inks,
  };
}

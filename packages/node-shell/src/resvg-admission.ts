// SPDX-License-Identifier: MPL-2.0
/**
 * Which SVGs the browser-free raster route may draw, and what it rewrites first.
 *
 * The CLI, the TUI and the MCP server draw PNG (and BMP, JPEG XL, EXR, HDR and the HDR
 * stills, from the same pixels) for an SVG-native tool with resvg, no browser. Measured
 * against the browser tier on 57 cases (plan 371, 2026-11-19), resvg agreed with the
 * browser on plain vector drawing and differed visibly on a short list of features.
 * The maintainer's rule: draw here only where the result can be trusted to match the
 * browser, and hand everything else to the browser tier. So this module reads the exact
 * SVG resvg is about to draw and refuses it, with a reason, when it holds one of those
 * features. Where there is no browser tier the job fails with that reason; a wrong
 * picture is never written.
 *
 * Every rule below says what was measured on resvg-js 2.6.2. Changing the resvg
 * version, or widening a rule, needs the comparison run again.
 *
 * Two rewrites happen before the checks, both because the browser does the same thing:
 * a CSS variable inside a vector picture takes its fallback (a picture is its own
 * document, so the page's variables never reach it), and a drawing the page lays out
 * width first from the top keeps that placement (`placeSvg`).
 */
import { decodeDataUrl, iccProfileBytes, imageDimensions, jpegSegmentBody, scanJpegSegments } from '@lolly/engine';
import { cleanJpeg } from './pdf-images.ts';
import { readFileSync } from 'node:fs';
import { browserFreeStatus, readBrowserFreeRecord, toolSourceDigest } from './browser-free-record.ts';
import { toolFile } from './content-roots.ts';

export type ResvgRefusalCode =
  | 'unmeasured' | 'paged' | 'draft-mark' | 'canvas-pixels' | 'fallback-faces' | 'layout' | 'css-variable' | 'css-animation' | 'live-text' | 'html'
  | 'picture-type' | 'picture-orientation' | 'picture-colour' | 'picture-in-picture' | 'picture-outside'
  | 'picture-downscale' | 'gradient-opacity' | 'blend-in-filter' | 'noise-filter' | 'crisp-edges' | 'unreadable';

export interface ResvgRefusal { code: ResvgRefusalCode; reason: string }

/** Facts about the render that the SVG itself does not carry. */
export interface ResvgRouteFacts {
  /** The tool being drawn and whether it may take this route (`toolAdmission`). */
  tool?: ToolRouteFact;
  /** The tool is a paged document (`render.paged`). */
  paged?: boolean;
  /** The export carries the experimental DRAFT mark (the runtime's resolved `watermark`). */
  draftMark?: boolean;
  /** A tool hook drew or decoded pixels through the Node canvas for this render. */
  canvasPixels?: boolean;
  /** The SVG export outlined some characters from fallback faces (the fill notice). */
  fallbackFaces?: boolean;
}

/** Whether one tool may take this route at all, before any render is judged. */
export interface ToolRouteFact {
  id: string;
  /** The tool's `browser-free.json` admits the tool, and the shell trusts the tool's own files. */
  browserFree: boolean;
  /** A sideloaded or remote tool, which its own files cannot admit to the route. */
  untrusted: boolean;
  /** Why a record that once admitted the tool no longer does (browser-free-record.ts). */
  stale?: string;
}

/**
 * Which tools this route draws: those with a `browser-free.json` beside `tool.json` whose
 * verdict is `resvg` and which still describes the tool (browser-free-record.ts). The
 * record is written by `scripts/tool-browser-free.ts` only when every measured case of the
 * tool came out inside the plan 326 bands against the browser tier, the way `isolate` is
 * written from evidence by `scripts/tool-isolation.ts`. Plain vector drawing that one tool
 * draws inside the bands another can draw outside them (Colour Palette's swatch edges came
 * out 0.7% to 1.7% over 24 levels where the band is 0.5%), so admission is per tool.
 *
 * The record lives outside `tool.json` so that no engine or app reads it: an app on any
 * engine keeps every tool. Trust is the receiving shell's, never the tool's: a sideloaded
 * or remote tool (`sideloaded-consented`, `remote-untrusted`, the classes `isolate` forces
 * into strict isolation) is never admitted, whatever its folder holds, and the record is
 * read only from the active profile's own tool packs through the resolver. The record holds
 * only for the files it was measured on, so the loaded tool's own template, stylesheet and
 * hooks must be the resolver's files: a tool loaded from anywhere else is not admitted.
 * Call this with the tool as loaded, before a shell annotates its template.
 */
export function toolAdmission(tool: AdmittedTool): ToolRouteFact {
  const id = tool.manifest.id;
  const untrusted = tool.trustClass === 'sideloaded-consented' || tool.trustClass === 'remote-untrusted';
  if (untrusted) return { id, browserFree: false, untrusted };
  const read = readBrowserFreeRecord(id);
  if (!read) return { id, browserFree: false, untrusted };
  if ('problem' in read) return { id, browserFree: false, untrusted, stale: read.problem };
  const status = browserFreeStatus(read.record, { id, version: String(tool.manifest.version ?? ''), digest: toolSourceDigest(id) });
  if (status.admitted && !loadedFromResolver(id, tool)) {
    return { id, browserFree: false, untrusted, stale: 'the tool was loaded from files other than the ones its record was measured on' };
  }
  return { id, browserFree: status.admitted, untrusted, ...(status.stale ? { stale: status.stale } : {}) };
}

/** A loaded tool (engine LoadedTool), with the fields admission reads. */
export interface AdmittedTool {
  manifest: { id: string; version?: string; hooks?: { module?: boolean } | unknown };
  trustClass?: string;
  /** The template as loaded, before any annotation. */
  template: string;
  styles?: string | null;
  hooksSource?: string | null;
}

/** Whether the loaded texts are the files the resolver serves for this tool, which the record's digest covers. */
function loadedFromResolver(id: string, tool: AdmittedTool): boolean {
  const file = (name: string): string | null => {
    try {
      const path = toolFile(id, name);
      return path ? readFileSync(path, 'utf8') : null;
    } catch { return null; }
  };
  if (tool.template !== file('template.html')) return false;
  if ((tool.styles ?? null) !== file('styles.css')) return false;
  // A module hook is loaded by URL, never as text; every other declared hook is the text.
  const hooks = tool.manifest.hooks as { module?: boolean } | undefined;
  if (hooks && hooks.module !== true && (tool.hooksSource ?? null) !== file('hooks.js')) return false;
  if (typeof tool.hooksSource === 'string' && tool.hooksSource !== file('hooks.js')) return false;
  return true;
}

/**
 * The most a raster picture may be shrunk on this route. resvg resamples a picture once,
 * with no smaller copies to draw from, so a picture shrunk far comes out aliased where the
 * browser's is smooth (a 1075 px picture drawn at 64 px: 11% of its pixels over 24 levels).
 * Measured with a PNG and a JPEG at 16 sizes: up to a shrink of 1.99 no pixel differed by
 * more than 16 levels; from 2.04 to 3.8 about 0.4% of the picture differed by more than 24
 * (inside the 0.5% band, with little to spare); from 4.2 the band failed (2% and more).
 */
export const MAX_PICTURE_SHRINK = 2;

/** The sentence a refused job prints or fails with. */
export function resvgRefusalSentence(refusals: readonly ResvgRefusal[]): string {
  const reasons = [...new Set(refusals.map((r) => r.reason))];
  return `The browser-free renderer (resvg) was not used because ${reasons.join('; ')}.`;
}

/** Thrown where a refused job has no browser tier to go to, or must be handed on by type. */
export class ResvgRefusedError extends Error {
  readonly code = 'RESVG_REFUSED';
  readonly refusals: readonly ResvgRefusal[];
  constructor(refusals: readonly ResvgRefusal[], format = 'png') {
    super(`${resvgRefusalSentence(refusals)} This ${format.toUpperCase()} needs the browser render tier.`);
    this.name = 'ResvgRefusedError';
    this.refusals = refusals;
  }
}

/** True for a refusal from this module, by type or by its code (it may cross a realm). */
export function isResvgRefusal(e: unknown): e is ResvgRefusedError {
  return e instanceof ResvgRefusedError || (!!e && typeof e === 'object' && (e as { code?: unknown }).code === 'RESVG_REFUSED');
}

/** The refusals that come from the render rather than from the SVG. */
export function routeRefusals(facts: ResvgRouteFacts = {}): ResvgRefusal[] {
  const out: ResvgRefusal[] = [];
  if (facts.tool && !facts.tool.browserFree) {
    out.push({ code: 'unmeasured', reason: facts.tool.untrusted
      ? `the ${facts.tool.id} tool is sideloaded or remote, and such a tool cannot admit itself to this route`
      : facts.tool.stale
        ? `the ${facts.tool.id} tool's browser-free record no longer describes it (${facts.tool.stale}); run scripts/tool-browser-free.ts again`
        : `the ${facts.tool.id} tool has not been measured inside the fidelity bands on this route (no browser-free.json admits it)` });
  }
  if (facts.paged) out.push({ code: 'paged', reason: 'a paged document, whose pages the browser writes at their print size' });
  if (facts.draftMark) out.push({ code: 'draft-mark', reason: 'this experimental tool marks its exports DRAFT, and that mark is drawn by the browser' });
  if (facts.canvasPixels) out.push({ code: 'canvas-pixels', reason: 'the tool computed part of the picture with a 2D canvas, which this shell emulates and the browser draws natively' });
  if (facts.fallbackFaces) out.push({ code: 'fallback-faces', reason: 'some characters came from fallback faces, where the browser picks faces of its own' });
  return out;
}

// ─── placement ───────────────────────────────────────────────────────────────

/** How the page lays the drawn root `<svg>` out on the canvas. */
export type SvgPlacement =
  | { kind: 'fill' }
  | { kind: 'top' }
  | { kind: 'unknown'; reason: string };

type StyleReader = (el: Element) => { getPropertyValue(name: string): string } | null;

const near = (a: number, b: number): boolean => Math.abs(a - b) <= 0.5;

/**
 * How the browser lays the drawn root `<svg>` out inside a canvas of `canvasW` x
 * `canvasH` pixels, read from the element before the SVG export changes its size.
 *
 * `fill`: the box is the whole canvas, so the SVG's own viewBox and preserveAspectRatio
 * place the drawing (what this route has always done). `top`: the box is the canvas's
 * width and its height follows the viewBox (CSS `height:auto`, or no height at all), so
 * the browser draws it from the top and the rest of the canvas belongs to the page.
 * `unknown`: a size this route cannot lay out the way the page does.
 *
 * `styleOf` is the element's computed style with the tool's own stylesheet in force
 * (`withStyleSheet`), so a size the stylesheet sets counts; the width and height
 * attributes are the fallback, as they are in the browser.
 */
export function svgPlacement(svg: Element, canvasW: number, canvasH: number, styleOf?: StyleReader, renderSize?: { width?: number; height?: number }): SvgPlacement {
  const computed = (name: string): string => { try { return styleOf?.(svg)?.getPropertyValue(name)?.trim() ?? ''; } catch { return ''; } };
  const spec = (name: 'width' | 'height'): string => computed(name) || svg.getAttribute(name)?.trim() || 'auto';
  const full = (value: string, canvas: number, render: number | undefined): boolean => {
    if (value === '100%') return true;
    const px = /^(\d+(?:\.\d+)?)(px)?$/.exec(value);
    return !!px && (near(Number(px[1]), canvas) || (render !== undefined && near(Number(px[1]), render)));
  };
  const w = spec('width'), h = spec('height');
  const widthFull = w === 'auto' || full(w, canvasW, renderSize?.width);
  if (widthFull && full(h, canvasH, renderSize?.height)) return { kind: 'fill' };
  if (widthFull && h === 'auto') {
    const vb = viewBoxOf(svg.getAttribute('viewBox'));
    if (!vb) return { kind: 'unknown', reason: `its size is ${w} by ${h} with no viewBox to give it a shape` };
    // `max-height:100%` caps a drawing taller than the canvas at the canvas, which is the fill case.
    if (computed('max-height') === '100%' && canvasW * vb[3] / vb[2] > canvasH) return { kind: 'fill' };
    return { kind: 'top' };
  }
  return { kind: 'unknown', reason: `its box is ${w} by ${h} on a ${canvasW} by ${canvasH} canvas, a layout the page around it decides` };
}

/** A computed background that paints something: a colour that is not transparent, or an image. */
function paintsGround(style: { getPropertyValue(name: string): string } | null | undefined): boolean {
  if (!style) return false;
  const colour = (style.getPropertyValue('background-color') || '').trim().toLowerCase();
  const image = (style.getPropertyValue('background-image') || '').trim().toLowerCase();
  const short = (style.getPropertyValue('background') || '').trim().toLowerCase();
  const clear = (v: string): boolean => !v || v === 'transparent' || v === 'none' || v === 'initial' || /^rgba\([^)]*,\s*0\)$/.test(v);
  return !clear(colour) || !clear(image) || !clear(short);
}

/**
 * The layout half of the admission: where the page places the drawing, and the reasons
 * this route cannot follow that layout. resvg ignores a CSS background on the root `<svg>`, so a
 * stylesheet ground on the drawing itself is refused; and where the drawing leaves part
 * of the canvas uncovered, a wrapper between the canvas and the drawing that paints a
 * ground is refused too, since that band is the wrapper's in the browser.
 */
export function layoutAdmission(
  root: Element, svg: Element, canvasW: number, canvasH: number, styleOf?: StyleReader, renderSize?: { width?: number; height?: number },
): { placement: SvgPlacement; refusals: ResvgRefusal[] } {
  const placement = svgPlacement(svg, canvasW, canvasH, styleOf, renderSize);
  const style = (el: Element) => { try { return styleOf?.(el) ?? null; } catch { return null; } };
  if (placement.kind === 'unknown') return { placement, refusals: [{ code: 'layout', reason: `the tool's drawing is laid out by the page around it (${placement.reason})` }] };
  if (paintsGround(style(svg))) return { placement, refusals: [{ code: 'layout', reason: 'the drawing has a background set by the stylesheet, which resvg does not paint' }] };
  const vb = viewBoxOf(svg.getAttribute('viewBox'));
  const uncovered = placement.kind === 'top' && !!vb && Math.abs(canvasW * vb[3] / vb[2] - canvasH) > 0.5;
  if (uncovered) {
    for (let el = svg.parentElement; el && el !== root.parentElement; el = el.parentElement) {
      if (paintsGround(style(el))) return { placement, refusals: [{ code: 'layout', reason: 'the drawing leaves part of the canvas to a wrapper that paints its own ground' }] };
      if (el === root) break;
    }
  }
  return { placement, refusals: [] };
}

/**
 * Run `read` with the tool's stylesheet in the document, so computed styles answer as the
 * page's do. The Node shells do not keep a tool's stylesheet in their document (nothing
 * else there reads it), so it is added for the read and taken out again.
 */
export function withStyleSheet<T>(doc: Document | null | undefined, css: string | null | undefined, read: () => T): T {
  if (!doc || !css) return read();
  const sheet = doc.createElement('style');
  sheet.textContent = css;
  (doc.head ?? doc.documentElement).appendChild(sheet);
  try { return read(); } finally { sheet.remove(); }
}

function viewBoxOf(value: string | null | undefined): [number, number, number, number] | null {
  const n = (value ?? '').trim().split(/[\s,]+/).map(Number);
  return n.length === 4 && n.every(Number.isFinite) && n[2]! > 0 && n[3]! > 0 ? n as [number, number, number, number] : null;
}

/**
 * The root `<svg>` of `svg` sized to exactly `width` x `height` pixels. With `top`, the
 * root keeps its own viewBox and is drawn the output's width wide, with the height its
 * viewBox gives it, at the top of an outer `<svg>` of the output's size: the browser's
 * layout. The root stays its own viewport, so a percentage length and the clipping at
 * its edges mean what they mean in the browser.
 */
export function placeSvg(svg: string, width: number, height: number, placement: SvgPlacement = { kind: 'fill' }): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const m = svg.match(/<svg\b([^>]*)>/);
  if (!m) return svg;
  let attrs = m[1]!;
  // Keep a viewBox (the content coordinate space); make one from the root's own
  // width and height when it has none, so the content still scales to the box.
  if (!/\bviewBox=/.test(attrs)) {
    const ow = attrs.match(/\bwidth="([\d.]+)"/)?.[1];
    const oh = attrs.match(/\bheight="([\d.]+)"/)?.[1];
    if (ow && oh) attrs += ` viewBox="0 0 ${ow} ${oh}"`;
  }
  attrs = attrs.replace(/\s(width|height)="[^"]*"/g, '');
  const vb = placement.kind === 'top' ? viewBoxOf(/\bviewBox="([^"]*)"/.exec(attrs)?.[1]) : null;
  if (!vb) return svg.replace(/<svg\b[^>]*>/, `<svg${attrs} width="${w}" height="${h}">`);
  const inner = +(w * vb[3] / vb[2]).toFixed(6);
  const at = svg.search(/<svg\b/);
  const end = svg.lastIndexOf('</svg>');
  if (end < at) return svg;
  return `${svg.slice(0, at)}<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + svg.slice(at, end + 6).replace(/<svg\b[^>]*>/, `<svg${attrs} x="0" y="0" width="${w}" height="${inner}">`)
    + `</svg>${svg.slice(end + 6)}`;
}

// ─── the SVG itself ──────────────────────────────────────────────────────────

const HREF = /(\s(?:xlink:)?href\s*=\s*)("([^"]*)"|'([^']*)')/gi;

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

/** Markup with every attribute value that is a `data:` URL emptied, for scanning the markup around pictures. */
function withoutDataUrls(svg: string): string {
  return svg.replace(/=\s*"data:[^"]*"/gi, '=""').replace(/=\s*'data:[^']*'/gi, "=''");
}

/** `var(--name, fallback)` replaced by its fallback wherever `--name` is not declared in `markup`. Null when one cannot be. */
function varFallbacks(markup: string): string | null {
  let failed = false;
  const declared = (name: string): boolean => new RegExp(`${name.replace(/[-]/g, '\\-')}\\s*:`).test(markup);
  const resolve = (value: string, depth: number): string => {
    if (depth > 8) { failed = true; return value; }
    let out = '', cursor = 0;
    for (;;) {
      const at = value.indexOf('var(', cursor);
      if (at < 0) return out + value.slice(cursor);
      out += value.slice(cursor, at);
      let end = at + 4, level = 1;
      for (; end < value.length && level; end++) {
        if (value[end] === '(') level++;
        else if (value[end] === ')') level--;
      }
      if (level) { failed = true; return out + value.slice(at); }
      const body = value.slice(at + 4, end - 1);
      const comma = body.indexOf(',');
      const name = (comma < 0 ? body : body.slice(0, comma)).trim();
      if (comma < 0 || !/^--[\w-]+$/.test(name) || declared(name)) { failed = true; out += value.slice(at, end); }
      else out += resolve(body.slice(comma + 1).trim(), depth + 1);
      cursor = end;
    }
  };
  const next = markup.replace(/var\([^"'<>]*/g, (run) => run.includes('var(') ? resolve(run, 0) : run);
  return failed ? null : next;
}

/** Whether the decoded ICC profile is the engine's own sRGB profile, every byte equal. */
function isEngineSrgb(icc: Uint8Array): boolean {
  const srgb = iccProfileBytes('srgb');
  return !!srgb && srgb.length === icc.length && srgb.every((b, i) => icc[i] === b);
}

function jpegRefusal(bytes: Uint8Array): ResvgRefusal | null {
  let orientation = 1;
  try { orientation = cleanJpeg(bytes).orientation; } catch { return { code: 'unreadable', reason: 'a JPEG picture this route cannot read' }; }
  if (orientation !== 1) return { code: 'picture-orientation', reason: 'a JPEG picture turned by its Exif orientation, which resvg does not apply' };
  const scan = scanJpegSegments(bytes);
  if (!scan) return { code: 'unreadable', reason: 'a JPEG picture this route cannot read' };
  const icc: Uint8Array[] = [];
  for (const seg of scan.segments) {
    const body = jpegSegmentBody(bytes, seg);
    const sof = seg.marker >= 0xc0 && seg.marker <= 0xcf && seg.marker !== 0xc4 && seg.marker !== 0xc8 && seg.marker !== 0xcc;
    if (sof && body.length >= 6 && body[5] === 4) return { code: 'picture-colour', reason: 'a CMYK JPEG picture, which resvg converts without its colour profile' };
    if (seg.marker === 0xe2 && body.length > 14 && Buffer.from(body.subarray(0, 12)).toString('latin1') === 'ICC_PROFILE\0') icc.push(body.subarray(14));
  }
  if (icc.length && !isEngineSrgb(new Uint8Array(Buffer.concat(icc)))) return { code: 'picture-colour', reason: 'a JPEG picture with its own colour profile, which resvg does not apply' };
  return null;
}

async function pngRefusal(bytes: Uint8Array): Promise<ResvgRefusal | null> {
  const { inflateSync } = await import('node:zlib');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let srgb = false;
  for (let at = 8; at + 8 <= bytes.length;) {
    const length = view.getUint32(at), type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    if (type === 'IDAT' || type === 'IEND') break;
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'sRGB') srgb = true;
    if (type === 'iCCP') {
      let icc: Uint8Array | null = null;
      try { icc = new Uint8Array(inflateSync(body.subarray(body.indexOf(0) + 2), { maxOutputLength: 1 << 20 })); } catch { icc = null; }
      if (!icc || !isEngineSrgb(icc)) return { code: 'picture-colour', reason: 'a PNG picture with its own colour profile, which resvg does not apply' };
    }
    if (type === 'cHRM' && !srgb) return { code: 'picture-colour', reason: 'a PNG picture with its own chromaticities, which resvg does not apply' };
    if (type === 'acTL') return ANIMATED_PICTURE;
    at += 12 + length;
  }
  return null;
}

const ANIMATED_PICTURE: ResvgRefusal = { code: 'css-animation', reason: 'an animated picture (APNG or GIF), which the browser draws at a moment of its animation and resvg draws at its first frame' };

/** A GIF that loops or holds more than one frame (more than one graphic control block). */
function gifAnimates(bytes: Uint8Array): boolean {
  const text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1');
  if (text.includes('NETSCAPE2.0') || text.includes('ANIMEXTS1.0')) return true;
  let controls = 0;
  for (let i = text.indexOf('\x21\xf9'); i >= 0; i = text.indexOf('\x21\xf9', i + 2)) if (++controls > 1) return true;
  return false;
}

/** What one vector picture holds that resvg would draw unlike the browser. */
function vectorPictureRefusals(markup: string): ResvgRefusal[] {
  const out: ResvgRefusal[] = [];
  const bare = withoutDataUrls(markup);
  if (/<(?:[\w-]+:)?image[\s/>]/i.test(markup)) out.push({ code: 'picture-in-picture', reason: 'a vector picture that holds a picture of its own, which resvg leaves out' });
  if (hasLiveText(bare)) out.push({ code: 'live-text', reason: 'a vector picture with live text, which each renderer sets in its own faces' });
  if (hasAnimation(bare)) out.push({ code: 'css-animation', reason: 'a vector picture that animates, which the browser draws at a moment of its animation and resvg draws still' });
  // Where a picture's edges land on the output grid is not read here, so any snapped edge refuses.
  if (/crispEdges/i.test(bare)) out.push({ code: 'crisp-edges', reason: 'a vector picture with snapped edges (crispEdges), which resvg can round a pixel apart from the browser' });
  out.push(...markupRefusals(bare, 'a vector picture'));
  return out;
}

/** Rewrite one vector picture's variables to their fallbacks; refuse what cannot be. */
function preparedVectorPicture(markup: string): { markup: string } | { refusal: ResvgRefusal } {
  if (!withoutDataUrls(markup).includes('var(')) return { markup };
  const next = varFallbacks(markup);
  return next === null
    ? { refusal: { code: 'css-variable', reason: 'a vector picture whose colours come from a CSS variable it does not resolve itself' } }
    : { markup: next };
}

const hasLiveText = (markup: string): boolean => {
  for (const m of markup.matchAll(/<(?:[\w-]+:)?text\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?text>/gi)) {
    if (m[1]!.replace(/<[^>]*>/g, '').trim()) return true;
  }
  return false;
};

const hasAnimation = (markup: string): boolean =>
  /@keyframes\b/i.test(markup) || /(^|[\s;{"'])animation(-name)?\s*:\s*(?!none\b)/i.test(markup)
  || /<(?:[\w-]+:)?(animate|animateTransform|animateMotion|set)\b/i.test(markup);

/** The checks every SVG document gets, the page and each vector picture alike. */
function markupRefusals(bare: string, where: string): ResvgRefusal[] {
  const out: ResvgRefusal[] = [];
  if (/var\(/.test(bare)) out.push({ code: 'css-variable', reason: `${where} with a CSS variable left unresolved, which resvg cannot read` });
  // A foreignObject that asks for an extension (a legacy Illustrator file's private data
  // in a <switch>) is drawn by neither renderer, so only the others count.
  if (/<(?:[\w-]+:)?foreignObject\b(?![^>]*\brequiredExtensions\s*=)/i.test(bare)) out.push({ code: 'html', reason: `${where} that holds HTML, which resvg does not draw` });
  if (/<(?:[\w-]+:)?feTurbulence\b/i.test(bare)) out.push({ code: 'noise-filter', reason: `${where} with a noise filter (feTurbulence), whose grain resvg draws differently` });
  if (gradientFades(bare)) out.push({ code: 'gradient-opacity', reason: `${where} with a gradient that fades through transparency, which resvg blends a few levels away from the browser` });
  return out;
}

/** A stop's opacity below one, read from stop-opacity, its style or an alpha in its colour. */
function stopFades(attrs: string): boolean {
  const opacity = /\sstop-opacity\s*=\s*["']\s*([\d.]+%?)/i.exec(attrs)?.[1] ?? /stop-opacity\s*:\s*([\d.]+%?)/i.exec(attrs)?.[1];
  if (opacity !== undefined && (opacity.endsWith('%') ? Number.parseFloat(opacity) < 100 : Number(opacity) < 1)) return true;
  const color = /\sstop-color\s*=\s*["']([^"']*)/i.exec(attrs)?.[1] ?? /stop-color\s*:\s*([^;"']*)/i.exec(attrs)?.[1] ?? '';
  const c = color.trim().toLowerCase();
  if (c === 'transparent') return true;
  if (/^#[0-9a-f]{4}$/.test(c)) return c[4] !== 'f';
  if (/^#[0-9a-f]{8}$/.test(c)) return c.slice(7) !== 'ff';
  const alpha = /^(?:rgba?|hsla?)\(([^)]*)\)$/.exec(c)?.[1]?.split(/[\s,/]+/).filter(Boolean)[3];
  return alpha !== undefined && (alpha.endsWith('%') ? Number.parseFloat(alpha) < 100 : Number(alpha) < 1);
}

function gradientFades(markup: string): boolean {
  for (const m of markup.matchAll(/<(?:[\w-]+:)?(?:linear|radial)Gradient\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?(?:linear|radial)Gradient>/gi)) {
    for (const stop of m[1]!.matchAll(/<(?:[\w-]+:)?stop\b([^>]*)>/gi)) if (stopFades(stop[1]!)) return true;
  }
  return false;
}

/**
 * Prepare an SVG for resvg and say whether it may be drawn here.
 *
 * Returns the SVG to draw (vector pictures with their variables resolved to fallbacks)
 * and every reason it may not be, empty when it may. `width` and `height` are the output
 * size in pixels, which the shrink of each raster picture is measured against.
 */
export async function admitForResvg(svg: string, width: number, height: number, facts: ResvgRouteFacts = {}, placement: SvgPlacement = { kind: 'fill' }): Promise<{ svg: string; refusals: ResvgRefusal[] }> {
  const refusals: ResvgRefusal[] = [...routeRefusals(facts)];
  const add = (r: ResvgRefusal | null): void => { if (r && !refusals.some((x) => x.code === r.code && x.reason === r.reason)) refusals.push(r); };

  // Pictures first: vector pictures are rewritten in place, raster pictures checked.
  const jobs: Promise<void>[] = [];
  const out = svg.replace(HREF, (whole, lead: string, _q: string, dq: string | undefined, sq: string | undefined) => {
    const href = (dq ?? sq ?? '').trim();
    if (!href || href.startsWith('#')) return whole;
    if (!/^data:/i.test(href)) { add({ code: 'picture-outside', reason: 'a picture that points outside the SVG, which this route does not fetch' }); return whole; }
    let decoded: { bytes: Uint8Array; mtype: string } | null = null;
    try { decoded = decodeDataUrl(href); } catch { decoded = null; }
    if (!decoded) { add({ code: 'unreadable', reason: 'a picture whose bytes cannot be read' }); return whole; }
    const { bytes, mtype } = decoded;
    if (mtype === 'image/svg+xml') {
      const markup = new TextDecoder().decode(bytes);
      const prepared = preparedVectorPicture(markup);
      if ('refusal' in prepared) { add(prepared.refusal); return whole; }
      for (const r of vectorPictureRefusals(prepared.markup)) add(r);
      return prepared.markup === markup ? whole : `${lead}"data:image/svg+xml;base64,${base64(new TextEncoder().encode(prepared.markup))}"`;
    }
    if (mtype === 'image/webp' || (bytes.length > 12 && Buffer.from(bytes.subarray(8, 12)).toString('latin1') === 'WEBP')) {
      add({ code: 'picture-type', reason: 'a WebP picture, which this resvg build does not decode (it would be left blank)' });
    } else if (mtype === 'image/jpeg' || mtype === 'image/jpg') {
      add(jpegRefusal(bytes));
    } else if (mtype === 'image/png') {
      jobs.push(pngRefusal(bytes).then(add));
    } else if (mtype === 'image/gif') {
      if (gifAnimates(bytes)) add(ANIMATED_PICTURE);
    } else {
      add({ code: 'picture-type', reason: `a picture of type ${mtype || 'unknown'}, which resvg does not decode` });
    }
    return whole;
  });
  await Promise.all(jobs);

  const bare = withoutDataUrls(out);
  if (hasLiveText(bare)) add({ code: 'live-text', reason: 'text the outliner left live (a character no face here covers), which resvg sets in other faces than the browser' });
  if (hasAnimation(bare)) add({ code: 'css-animation', reason: 'the drawing animates, and the browser draws a moment of the animation where resvg draws it still' });
  for (const r of markupRefusals(bare, 'the drawing')) add(r);

  if (crispRectsOffGrid(bare, width, height, placement)) add({ code: 'crisp-edges', reason: 'rectangles with snapped edges (crispEdges) between whole pixels, which resvg rounds a pixel apart from the browser' });
  // Blend modes inside filters, and how far each raster picture is shrunk, read from
  // resvg's own normalised tree, where every size and transform is explicit.
  for (const r of await treeRefusals(placeSvg(out, width, height, placement))) add(r);
  return { svg: out, refusals };
}

/**
 * Whether a `<rect>` drawn with `shape-rendering: crispEdges` has an edge between whole
 * output pixels. Measured on QR Code's EAN-13 bars: at a scale of 1.71 and 2.85 one bar came
 * out a pixel wider in resvg than in the browser (2% to 3% of its region over 24 levels),
 * and at a scale of 2 the bars agreed. QR modules, drawn as one crispEdges path, agreed
 * exactly at 600, 777 and 1000 pixels, so paths are not refused. A rect under a transform
 * is refused too: its edges are not read here.
 */
function crispRectsOffGrid(markup: string, width: number, height: number, placement: SvgPlacement): boolean {
  if (!/crispEdges/i.test(markup)) return false;
  const root = /<svg\b([^>]*)>/i.exec(markup)?.[1] ?? '';
  const vb = viewBoxOf(/\sviewBox\s*=\s*"([^"]*)"/i.exec(root)?.[1]);
  if (!vb) return true;
  let sx = width / vb[2], sy = height / vb[3], ox = 0, oy = 0;
  const par = /\spreserveAspectRatio\s*=\s*"([^"]*)"/i.exec(root)?.[1]?.trim() ?? 'xMidYMid meet';
  if (placement.kind === 'top') { sx = sy = width / vb[2]; }
  else if (!par.startsWith('none')) {
    const k = par.includes('slice') ? Math.max(sx, sy) : Math.min(sx, sy);
    const slack = (size: number, view: number, align: string): number => align === 'Min' ? 0 : align === 'Max' ? size - view * k : (size - view * k) / 2;
    ox = slack(width, vb[2], /x(Min|Mid|Max)/.exec(par)?.[1] ?? 'Mid');
    oy = slack(height, vb[3], /Y(Min|Mid|Max)/.exec(par)?.[1] ?? 'Mid');
    sx = sy = k;
  }
  const crisp = (attrs: string): boolean | null => /crispEdges/i.test(attrs) ? true : /shape-rendering\s*[=:]\s*["']?\s*(auto|geometricPrecision|optimizeSpeed)/i.test(attrs) ? false : null;
  const offGrid = (v: number): boolean => Math.abs(v - Math.round(v)) > 0.01;
  const stack: Array<{ crisp: boolean; moved: boolean }> = [{ crisp: crisp(root) ?? false, moved: false }];
  for (const tag of markup.slice(markup.indexOf('>', markup.search(/<svg\b/i)) + 1).matchAll(/<(\/?)([\w:-]+)([^>]*?)(\/?)>/g)) {
    const [, close, name, attrs = '', selfClose] = tag;
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    const top = stack[stack.length - 1]!;
    const here = { crisp: crisp(attrs) ?? top.crisp, moved: top.moved || /\stransform\s*=/.test(attrs) || name === 'svg' };
    if (name === 'rect' && here.crisp) {
      if (here.moved) return true;
      const n = (a: string): number => { const v = attrOf(attrs, a); return v === undefined ? 0 : /^-?[\d.]+(e-?\d+)?$/i.test(v) ? Number(v) : NaN; };
      const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')];
      if (![x, y, w, h].every(Number.isFinite)) return true;
      if ([(x - vb[0]) * sx + ox, (x + w - vb[0]) * sx + ox, (y - vb[1]) * sy + oy, (y + h - vb[1]) * sy + oy].some(offGrid)) return true;
    }
    if (!selfClose) stack.push(here);
  }
  return false;
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

function matrixOf(attrs: string): Matrix {
  const m = /\stransform="matrix\(([^)]*)\)"/.exec(attrs)?.[1]?.split(/[\s,]+/).map(Number);
  return m && m.length === 6 && m.every(Number.isFinite) ? m as Matrix : IDENTITY;
}

const attrOf = (attrs: string, name: string): string | undefined => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1];

/**
 * The refusals read from resvg's normalised tree (`Resvg.toString()`): a blend mode on or
 * inside a filtered group, and a raster picture shrunk past `MAX_PICTURE_SHRINK`.
 *
 * The blend rule is measured: the gradient tool's hard-light blobs inside its blur group
 * leave a dark band 40 px tall along the bottom edge in resvg (luma 43 against 130), and
 * removing either the blend or the filter removes the band.
 */
async function treeRefusals(svg: string): Promise<ResvgRefusal[]> {
  const { Resvg } = await import('@resvg/resvg-js');
  let tree: string;
  try { tree = new Resvg(svg, { font: { loadSystemFonts: false } }).toString(); } catch {
    return [{ code: 'unreadable', reason: 'an SVG resvg cannot read' }];
  }
  const out: ResvgRefusal[] = [];
  const root = /<svg\b([^>]*)>/.exec(tree)?.[1] ?? '';
  const vb = viewBoxOf(attrOf(root, 'viewBox'));
  const W = Number(attrOf(root, 'width')), H = Number(attrOf(root, 'height'));
  // usvg writes the root size and viewBox; the drawing is placed by its own aspect rule.
  let rootM: Matrix = IDENTITY;
  if (vb && W > 0 && H > 0) {
    const par = attrOf(root, 'preserveAspectRatio') ?? 'xMidYMid meet';
    const sx = W / vb[2], sy = H / vb[3];
    const s = par.startsWith('none') ? null : par.includes('slice') ? Math.max(sx, sy) : Math.min(sx, sy);
    rootM = s === null ? [sx, 0, 0, sy, -vb[0] * sx, -vb[1] * sy] : [s, 0, 0, s, -vb[0] * s, -vb[1] * s];
  }
  const stack: Array<{ m: Matrix; filtered: boolean }> = [{ m: rootM, filtered: false }];
  let blend = false, shrunk = 0;
  for (const tag of tree.matchAll(/<(\/?)([\w:-]+)([^>]*?)(\/?)>/g)) {
    const [, close, name, attrs = '', selfClose] = tag;
    if (name === 'svg') continue;
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    const top = stack[stack.length - 1]!;
    const m = multiply(top.m, matrixOf(attrs));
    const filtered = top.filtered || /\sfilter="/.test(attrs);
    const mode = /mix-blend-mode:\s*([\w-]+)/.exec(attrs)?.[1];
    if (mode && mode !== 'normal' && filtered) blend = true;
    if (name === 'image') {
      const href = /\s(?:xlink:)?href="([^"]*)"/.exec(attrs)?.[1]?.replace(/\s+/g, '') ?? '';
      const data = /^data:(image\/(?:png|jpeg|jpg|gif));base64,(.*)$/i.exec(href);
      if (data) {
        const size = imageDimensions(new Uint8Array(Buffer.from(data[2]!, 'base64')), data[1]!.toLowerCase());
        const bw = Number(attrOf(attrs, 'width')), bh = Number(attrOf(attrs, 'height'));
        if (size && size.w > 0 && size.h > 0 && bw > 0 && bh > 0) {
          const par = attrOf(attrs, 'preserveAspectRatio') ?? 'xMidYMid meet';
          const fx = bw / size.w, fy = bh / size.h;
          const k = par.startsWith('none') ? null : par.includes('slice') ? Math.max(fx, fy) : Math.min(fx, fy);
          const scaleX = Math.hypot(m[0], m[1]) * (k ?? fx), scaleY = Math.hypot(m[2], m[3]) * (k ?? fy);
          const shrink = 1 / Math.max(1e-9, Math.min(scaleX, scaleY));
          if (shrink > shrunk) shrunk = shrink;
        }
      }
    }
    if (!selfClose) stack.push({ m, filtered });
  }
  // usvg resolves a stop's opacity from a stylesheet into the stop itself, so a fade the
  // markup check cannot see (`<stop class="fade">`) is read here.
  if (gradientFades(tree)) out.push({ code: 'gradient-opacity', reason: 'the drawing with a gradient that fades through transparency, which resvg blends a few levels away from the browser' });
  if (blend) out.push({ code: 'blend-in-filter', reason: 'a blend mode inside a filtered group, which resvg composites unlike the browser (a dark band along an edge)' });
  if (shrunk > MAX_PICTURE_SHRINK) out.push({ code: 'picture-downscale', reason: `a picture drawn at 1/${shrunk.toFixed(2)} of its own size (the limit here is 1/${MAX_PICTURE_SHRINK}), which resvg shrinks with visible grain` });
  return out;
}

/** The callbacks the SVG export reports through: the DRAFT mark and the fallback-face notice. */
export interface ExportFactHooks {
  onDraftMark: (on: boolean) => void;
  onFillNotice: () => void;
}

/**
 * The browser-free route's whole decision for one drawn tree, shared by the CLI, the TUI
 * and the MCP server: read the layout off the DOM, refuse early what the render's facts
 * already rule out (so a refused job never pays for its SVG export), export the SVG, then
 * read the SVG itself. `exportSvg` runs the shell's own SVG export with the callback the
 * bridge reports the DRAFT mark through, and answers null when there is no SVG to draw.
 */
export async function admitTierA(args: {
  /** The node the export walks (the canvas or a picked page). */
  root: Element;
  /** The drawn root `<svg>` of `root` (raster.ts `drawnRootSvg`), or null. */
  drawn: Element | null;
  /** Output size in pixels. */
  width: number;
  height: number;
  renderSize?: { width?: number; height?: number };
  /** The tool's own stylesheet, read for the layout (`withStyleSheet`). */
  styles?: string | null;
  /** Pixel work the tool's hooks did through the Node canvas (canvas.ts `pixelWorkCount`). */
  pixelWork?: () => number;
  /** The tool (`toolAdmission`) and whether it is a paged document. */
  tool?: ToolRouteFact;
  paged?: boolean;
  exportSvg: (hooks: ExportFactHooks) => Promise<string | null>;
}): Promise<{ svg: string; placement: SvgPlacement } | { refusals: ResvgRefusal[] } | null> {
  const { root, drawn, width, height } = args;
  const known = { ...(args.tool ? { tool: args.tool } : {}), paged: !!args.paged };
  const before = routeRefusals({ ...known, canvasPixels: (args.pixelWork?.() ?? 0) > 0 });
  if (before.length) return { refusals: before };
  const layout = drawn ? readLayout(root, drawn, width, height, args.styles, args.renderSize) : { placement: { kind: 'fill' } as SvgPlacement, refusals: [] };
  const placement = layout.placement;
  if (layout.refusals.length) return { refusals: layout.refusals };
  let draftMark = false, fallbackFaces = false;
  const svg = await args.exportSvg({ onDraftMark: (on) => { draftMark = on; }, onFillNotice: () => { fallbackFaces = true; } });
  if (svg === null) return null;
  const admitted = await admitForResvg(svg, width, height, { draftMark, fallbackFaces, canvasPixels: (args.pixelWork?.() ?? 0) > 0 }, placement);
  return admitted.refusals.length ? { refusals: admitted.refusals } : { svg: admitted.svg, placement };
}

/** `layoutAdmission` with the tool's stylesheet in force, read through the element's own window. */
export function readLayout(root: Element, svg: Element, width: number, height: number, styles?: string | null, renderSize?: { width?: number; height?: number }): { placement: SvgPlacement; refusals: ResvgRefusal[] } {
  const doc = svg.ownerDocument;
  const win = doc?.defaultView as { getComputedStyle?: (el: Element) => { getPropertyValue(name: string): string } } | null | undefined;
  const styleOf: StyleReader | undefined = win?.getComputedStyle ? (el) => win.getComputedStyle!(el) : undefined;
  return withStyleSheet(doc, styles, () => layoutAdmission(root, svg, width, height, styleOf, renderSize));
}

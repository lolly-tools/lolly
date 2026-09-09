// SPDX-License-Identifier: MPL-2.0
/**
 * A DOM → Penpot document producer for the `.penpot` export of an HTML-layout tool
 * (plans/222 work package E). Unlike the SVG-outline path it replaces for these
 * tools, TEXT STAYS TEXT - one editable Penpot text object per visual line, not an
 * outlined `<path>` and not a whole-document picture - and a colour/font a box
 * inherits from a brand token is bound to that token (`appliedTokens`), so editing
 * the token in Penpot re-paints the box.
 *
 * It is the proven parts of `component-capture.ts` generalised for arbitrary tool
 * canvases, but deliberately CONSERVATIVE: it captures only what it can carry
 * faithfully and returns `null` the moment it meets a case it cannot (a transform
 * on the node), so the caller falls back to the existing outline/whole-image path
 * and the export can never regress below today's behaviour. An unsupported SVG or
 * `<canvas>` is embedded as LOCAL artwork, so one complex illustration never
 * flattens the editable text around it.
 *
 * Bindings come from a box's OWN inline source (`style="color: var(--brand-primary)"`,
 * a `{alias}`) - never a value-equality guess - and the engine writer re-validates
 * every one against the file's own tokens, so a stale binding degrades to the
 * painted colour rather than a broken import.
 *
 * jsdom test: dom-penpot.test.ts. jsdom has no layout engine, so those tests mock
 * getBoundingClientRect to isolate the DOM→IR boundary; they are NOT pixel-fidelity
 * evidence and do not replace a real-browser + Penpot-import pass.
 */
import { parseBoxShadow } from '../../../../engine/src/css-box.ts';
import { parsePenpotColor, svgToPenpotDoc, penpotUuid, decodeDataUrl } from '../../../../engine/src/penpot-file.ts';
import type { PenpotDoc, PenpotIrShape, PenpotIrText, PenpotMedia } from '../../../../engine/src/penpot-file.ts';
import { bakeTextStyles } from '../bridge/bake-text-styles.ts';
import { componentBackground } from './component-background.ts';

const px = (v: string): number => Number.parseFloat(v) || 0;
const colour = (css: string): string | undefined => {
  const c = parsePenpotColor(css);
  return c && c.alpha > 0 ? c.hex + (c.alpha < 1 ? Math.round(c.alpha * 255).toString(16).padStart(2, '0') : '') : undefined;
};

export interface DomPenpotReport {
  /** Editable text objects produced. */
  editableText: number;
  /** Applied-token bindings attached (a colour/font that follows a brand token). */
  bound: number;
  /** Illustrations kept as embedded local artwork (SVG/canvas the walk cannot lower). */
  embedded: number;
  /** Images that could not be read and were left out. */
  missingImages: number;
  /** Font families the text uses (Penpot needs the face installed to paint them). */
  fonts: string[];
  /** Human-readable limitations, for the export status. */
  notes: string[];
}

export interface DomPenpotOptions {
  name: string;
  background?: string;
  /** The brand token a box's inline source names, or null for a literal. The engine
   *  handles a bare `{alias}` itself; this maps the brand-specific `var(--brand-*)`
   *  forms only the shell knows (see bridge/export-penpot.ts). */
  bindToken?: (css: string, kind: 'color' | 'font') => string | null;
}

/** The token PATH an inline source string names, or null. A bare `{alias}` resolves
 *  here directly; anything else is the shell's `bindToken`. */
function tokenPathOf(src: string, kind: 'color' | 'font', bind?: DomPenpotOptions['bindToken']): string | null {
  const s = src.trim();
  if (!s) return null;
  const alias = /^\{([A-Za-z0-9_.-]+)\}$/.exec(s);
  if (alias) return alias[1]!;
  return bind?.(s, kind) ?? null;
}

/** An element's explicit `data-lolly-bind="fill:path;strokeColor:path"` opt-in
 *  (plans/222 work package C's declarative binding), as prop → path. Empty when
 *  absent. The writer re-validates every path. */
function explicitBind(el: Element): Record<string, string> {
  const raw = el.getAttribute?.('data-lolly-bind');
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const pair of raw.split(';')) {
    const i = pair.indexOf(':');
    if (i < 0) continue;
    const prop = pair.slice(0, i).trim();
    const path = pair.slice(i + 1).trim();
    if (prop && /^[A-Za-z0-9_.-]+$/.test(path)) out[prop] = path;
  }
  return out;
}

/** The raw inline value of one of `props` on an element (the last that is set), read
 *  off the style ATTRIBUTE text so a `var(--brand-*)` survives shorthand
 *  serialisation. `''` when none is set inline. */
function inlineValue(el: Element, props: string[]): string {
  const style = el.getAttribute?.('style');
  if (!style) return '';
  let out = '';
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const name = decl.slice(0, i).trim().toLowerCase();
    if (props.includes(name)) out = decl.slice(i + 1).trim();
  }
  return out;
}

/**
 * Walk a rendered tool canvas into an editable Penpot document, or return null to
 * defer to the caller's faithful fallback. `node` is the tool's render root (the
 * stage), already settled (fonts loaded, `beforeExport` run).
 */
export async function domToPenpotDoc(node: Element, opts: DomPenpotOptions): Promise<{ doc: PenpotDoc; report: DomPenpotReport } | null> {
  if (typeof getComputedStyle !== 'function') return null;
  const bounds = node.getBoundingClientRect?.();
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
  // A transform on the canvas root is exactly the case the bounding-box approximation
  // gets wrong; hand it to the faithful path instead of guessing.
  const rootStyle = getComputedStyle(node);
  if (rootStyle.transform && rootStyle.transform !== 'none') return null;

  const media: PenpotMedia[] = [];
  const notes = new Set<string>();
  const fonts = new Set<string>();
  let editableText = 0, bound = 0, embedded = 0, missingImages = 0;

  const box = (r: DOMRect): { x: number; y: number; w: number; h: number } => ({ x: r.x - bounds.x, y: r.y - bounds.y, w: r.width, h: r.height });

  const textShape = (text: string, style: CSSStyleDeclaration, rect: DOMRect): PenpotIrText => {
    const family = style.fontFamily.split(',')[0]!.trim().replace(/['"]/g, '');
    if (family) fonts.add(family);
    editableText++;
    return {
      type: 'text', name: text.trim().slice(0, 60), ...box(rect), growType: 'auto-height',
      paragraphs: [{ runs: [{
        text, fontFamily: family, fontSize: px(style.fontSize), fontWeight: px(style.fontWeight) || 400,
        italic: style.fontStyle === 'italic', lineHeight: px(style.lineHeight) / px(style.fontSize) || 1.2,
        letterSpacing: px(style.letterSpacing), color: colour(style.color) || '#000000',
        transform: ['uppercase', 'lowercase', 'capitalize'].includes(style.textTransform) ? style.textTransform as 'uppercase' | 'lowercase' | 'capitalize' : 'none',
        decoration: style.textDecorationLine.includes('underline') ? 'underline' : style.textDecorationLine.includes('line-through') ? 'line-through' : 'none',
      }] }],
    };
  };

  const walk = async (el: Element): Promise<PenpotIrShape[]> => {
    if (el.matches('script, style, template, [data-export-hide], [hidden]')) return [];
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return [];
    if (style.transform && style.transform !== 'none') { notes.add('An element with a CSS transform was embedded as artwork.'); return await embedElement(el); }
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    const b = box(rect);
    const label = el.getAttribute('aria-label') || el.classList[0] || el.tagName.toLowerCase();
    const shapes: PenpotIrShape[] = [];

    if (el.tagName.toLowerCase() === 'svg') return await lowerOrEmbedSvg(el as SVGElement, b, label);
    if (el.tagName.toLowerCase() === 'canvas' || el.tagName.toLowerCase() === 'video') {
      notes.add(`${el.tagName.toLowerCase()} content is embedded as a still, not editable geometry.`);
      return await embedElement(el);
    }

    // Surface: fill + border + radius + shadow.
    const fill = colour(style.backgroundColor);
    const bw = px(style.borderTopWidth);
    const stroke = colour(style.borderTopColor);
    const corner = (css: string): number => css.includes('%') ? px(css) / 100 * Math.min(b.w, b.h) : px(css);
    const corners = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(corner) as [number, number, number, number];
    const radius = corners.every(r => r === corners[0]) ? corners[0] : corners;
    const shadows = parseBoxShadow(style.boxShadow).map(s => ({ style: s.inset ? 'inner-shadow' as const : 'drop-shadow' as const, x: s.x, y: s.y, blur: s.blur, spread: s.spread, color: colour(s.color) || '#000000' }));
    const backgroundBlur = px(/blur\(([^)]+)\)/.exec(style.backdropFilter || '')?.[1] || '') || undefined;
    if (fill || bw || shadows.length) {
      const surface: PenpotIrShape = { type: 'rect', name: `${label} surface`, ...b, radius,
        fills: fill ? [{ color: fill }] : [], strokes: bw && stroke ? [{ color: stroke, width: bw, alignment: 'inner' }] : [], shadows, backgroundBlur };
      const applied: Record<string, string> = {};
      if (fill) { const p = tokenPathOf(inlineValue(el, ['background-color', 'background']), 'color', opts.bindToken); if (p) applied.fill = p; }
      if (bw && stroke) { const p = tokenPathOf(inlineValue(el, ['border-color', 'border-top-color', 'border']), 'color', opts.bindToken); if (p) applied.strokeColor = p; }
      // A resolved data-lolly-bind (from a token-linked input) wins over the inline
      // guess. `textFill` is the element's text colour, not the surface's - it rides
      // to the text shapes below, not this rect.
      const eb = explicitBind(el);
      if (eb.fill) applied.fill = eb.fill;
      if (eb.strokeColor) applied.strokeColor = eb.strokeColor;
      if (Object.keys(applied).length) { surface.appliedTokens = applied; bound += Object.keys(applied).length; }
      shapes.push(surface);
    }
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      const size = style.backgroundSize;
      const tiled = size?.split(',').some(s => s.trim() !== 'auto' && s.trim() !== 'auto auto');
      const paints = !tiled && componentBackground(style.backgroundImage, b, radius);
      if (paints) shapes.push(...paints);
      else notes.add('A tiled or unsupported CSS background was simplified.');
    }

    if (el instanceof HTMLImageElement && el.currentSrc) {
      const shape = await imageShape(el, b, radius, label);
      if (shape) shapes.push(shape);
    } else {
      for (const child of el.childNodes) {
        if (child.nodeType === 1 /* ELEMENT */) shapes.push(...await walk(child as Element));
        else if (child.nodeType === 3 /* TEXT */ && child.textContent?.trim()) {
          shapes.push(...lineShapes(child, style));
        }
      }
    }
    if (!shapes.length) return [];
    const clips = [style.overflow, style.overflowX, style.overflowY].some(v => ['hidden', 'clip', 'scroll', 'auto'].includes(v));
    return [{ type: 'group', name: label, ...b, opacity: Number(style.opacity) || 1, masked: clips || undefined,
      children: clips ? [{ type: 'rect', name: `${label} clip`, ...b, radius, fills: [{ color: '#ffffff' }] }, ...shapes] : shapes }];
  };

  /** A text node → one editable text object per visual line (range-measured), each
   *  carrying its colour binding when the parent's inline colour names a token. */
  function lineShapes(textNode: ChildNode, style: CSSStyleDeclaration): PenpotIrShape[] {
    const parent = textNode.parentElement;
    const fillPath = parent ? tokenPathOf(inlineValue(parent, ['color']), 'color', opts.bindToken) : null;
    const fontPath = parent ? tokenPathOf(inlineValue(parent, ['font-family']), 'font', opts.bindToken) : null;
    const text = textNode.textContent ?? '';
    const range = (node.ownerDocument ?? document).createRange();
    const lines: Array<{ text: string; rect: DOMRect }> = [];
    for (const match of text.matchAll(/\S+\s*/g)) {
      range.setStart(textNode, match.index!); range.setEnd(textNode, match.index! + match[0].length);
      const r = range.getBoundingClientRect();
      const last = lines.at(-1);
      if (last && Math.abs(last.rect.y - r.y) < 2) {
        last.text += match[0];
        last.rect = new DOMRect(Math.min(last.rect.x, r.x), r.y, Math.max(last.rect.right, r.right) - Math.min(last.rect.x, r.x), Math.max(last.rect.height, r.height));
      } else if (r.width && r.height) lines.push({ text: match[0], rect: r });
    }
    const eb = parent ? explicitBind(parent) : {};
    return lines.map(line => {
      const shape = textShape(line.text.trimEnd(), style, line.rect);
      const applied: Record<string, string> = {};
      if (fillPath) applied.fill = fillPath;
      if (fontPath) applied.fontFamily = fontPath;
      // The text colour's resolved binding (from `color: {{fg}}` on the parent) wins.
      if (eb.textFill) applied.fill = eb.textFill;
      if (Object.keys(applied).length) { shape.appliedTokens = applied; bound += Object.keys(applied).length; }
      return shape;
    });
  }

  async function imageShape(el: HTMLImageElement, b: { x: number; y: number; w: number; h: number }, radius: number | [number, number, number, number], label: string): Promise<PenpotIrShape | null> {
    try {
      const res = await fetch(el.currentSrc);
      if (!res.ok) { missingImages++; notes.add('An image could not be read and was left out.'); return null; }
      const blob = await res.blob();
      const id = penpotUuid();
      media.push({ id, name: el.alt || label, mtype: blob.type, width: el.naturalWidth || b.w, height: el.naturalHeight || b.h, bytes: new Uint8Array(await blob.arrayBuffer()) });
      return { type: 'image', name: el.alt || label, ...b, media: id, radius };
    } catch { missingImages++; notes.add('An image could not be read and was left out.'); return null; }
  }

  async function lowerOrEmbedSvg(el: SVGElement, b: { x: number; y: number; w: number; h: number }, label: string): Promise<PenpotIrShape[]> {
    const clone = el.cloneNode(true) as SVGElement;
    bakeTextStyles(el, clone);
    clone.querySelectorAll('style, script').forEach(n => { n.remove(); });
    clone.setAttribute('x', String(b.x)); clone.setAttribute('y', String(b.y));
    clone.setAttribute('width', String(b.w)); clone.setAttribute('height', String(b.h));
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}">${new XMLSerializer().serializeToString(clone)}</svg>`;
    const lowered = svgToPenpotDoc(xml, { name: label });
    const board = lowered?.doc.pages[0]?.shapes[0];
    if (board && 'children' in board && !lowered?.pending.length) return board.children;
    // Unsupported vector artwork stays LOCAL; the surrounding text remains editable.
    clone.removeAttribute('x'); clone.removeAttribute('y');
    const id = penpotUuid();
    media.push({ id, name: label, mtype: 'image/svg+xml', width: b.w, height: b.h, bytes: new TextEncoder().encode(new XMLSerializer().serializeToString(clone)) });
    embedded++;
    notes.add('Complex SVG artwork is embedded; the text around it stays editable.');
    return [{ type: 'image', name: label, ...b, media: id }];
  }

  async function embedElement(el: Element): Promise<PenpotIrShape[]> {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    const b = box(rect);
    const tag = el.tagName.toLowerCase();
    const label = el.getAttribute('aria-label') || tag;
    if (tag === 'svg') return await lowerOrEmbedSvg(el as SVGElement, b, label);
    // A <canvas> is captured as a still - its current pixels - so a live visualiser
    // reads as a picture in Penpot rather than vanishing. A tainted (cross-origin)
    // canvas throws on read and falls through to the labelled placeholder below.
    if (tag === 'canvas') {
      try {
        const got = decodeDataUrl((el as HTMLCanvasElement).toDataURL('image/png'));
        if (got?.bytes.length) {
          const id = penpotUuid();
          media.push({ id, name: label, mtype: 'image/png', width: (el as HTMLCanvasElement).width || Math.round(b.w), height: (el as HTMLCanvasElement).height || Math.round(b.h), bytes: got.bytes });
          embedded++;
          return [{ type: 'image', name: label, ...b, media: id }];
        }
      } catch { /* tainted or unreadable - fall through to a placeholder */ }
    }
    // A labelled placeholder rect, so unsupported content does not vanish and does
    // not flatten its neighbours; the report says it was simplified.
    embedded++;
    return [{ type: 'rect', name: label, ...b, fills: [{ color: colour(getComputedStyle(el).backgroundColor) || '#eeeeee', opacity: 0.5 }] }];
  }

  let children: PenpotIrShape[];
  try { children = await walk(node); } catch { return null; }
  if (!children.length) return null;

  const doc: PenpotDoc = {
    name: opts.name,
    pages: [{ name: opts.name, shapes: [{ type: 'board', name: opts.name, x: 0, y: 0, w: bounds.width, h: bounds.height,
      fills: [{ color: colour(opts.background ?? '') || colour(rootStyle.backgroundColor) || '#ffffff' }], children }] }],
    media,
  };
  const report: DomPenpotReport = { editableText, bound, embedded, missingImages, fonts: [...fonts], notes: [...notes] };
  return { doc, report };
}

// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import { boxesToPenpotDoc, buildPenpotEntries, seededPenpotUuid, type BoxesToPenpotOptions, type PenpotDoc, type PenpotIrShape } from '../engine/src/penpot-file.ts';
import { compileDesignDraw, compileDesignRow, type DrawShapeOp } from '../engine/src/design-draw.ts';
import { designDrawPenpot, isPenpotPrimitiveRow } from '../engine/src/design-draw-penpot.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';

/** Frozen pre-P3e-2 producer and its private helpers. It imports no drawing compiler or consumer. */
const legacySource = `// SPDX-License-Identifier: MPL-2.0
import { makeGeomApi } from './geom-api.ts';
import { parseSvgPath } from './svg-path.ts';
import { pathBounds, pathFromSubPaths } from './geom/path.ts';
import { parsePenpotColor } from './draw-color.ts';
import { clamp } from './clamp.ts';
const BLEND_MODES = new Set(['normal', 'darken', 'multiply', 'color-burn', 'lighten', 'screen', 'color-dodge',
  'overlay', 'soft-light', 'hard-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']);
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const fin = (v: unknown, d = 0): number => { const n = typeof v === 'number' ? v : parseFloat(String(v)); return Number.isFinite(n) ? n : d; };
/** Round to 4 decimals and never let a NaN/Infinity reach a \`safe-number\` field. */
const r4 = (v: number): number => { const n = Math.round(v * 10000) / 10000; return Number.isFinite(n) ? (Object.is(n, -0) ? 0 : n) : 0; };

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
      if (s.op === 'M') out.push(\`M\${n(s.x)},\${n(s.y)}\`);
      else if (s.op === 'L') out.push(\`L\${n(s.x)},\${n(s.y)}\`);
      else out.push(\`C\${n(s.x1)},\${n(s.y1)} \${n(s.x2)},\${n(s.y2)} \${n(s.x)},\${n(s.y)}\`);
    }
    if (sp.closed) out.push('Z');
  }
  return out.join('');
}
export interface BoxesToPenpotOptions {
  name: string;
  /** The no-frames artboard size (the tool's render box). */
  canvas: { w: number; h: number };
  /** The no-frames artboard background. */
  background?: string;
  /** What the Design tool's \`sans\` / \`mono\` font keys resolve to (the brand's faces). */
  fonts?: { sans?: string; mono?: string };
  googleFamilies?: Iterable<string>;
  /** The bytes behind an image box, resolved by the shell (fetch/decode are not the engine's). */
  mediaFor?: (box: Record<string, unknown>) => PenpotMedia | null;
  /** Resolve a colour against the LIVE brand. Asked first for any \`var(…)\` or \`{token}\`
   *  value - the literal fallback inside \`var(--brand-primary, #1e293b)\` is a stale copy
   *  of the brand, and every shipped Design template paints that way - and asked as the
   *  last resort for anything else the parser cannot read. A caller with no live cascade
   *  (CLI, jsdom) supplies none and the literal fallback stands. */
  resolveColor?: (css: string) => string | null;
  /**
   * The brand token a box field's SOURCE names, for applied-token bindings
   * (plans/222). Given a box's raw \`bg\`/\`fg\`/\`stroke\`/\`font\` string and its kind,
   * return the dotted token PATH it inherits from, or null for a literal. The
   * engine already recognises a bare \`{alias}\` itself; this is for the brand-
   * specific forms only the shell can map (a \`var(--brand-primary)\` → the
   * semantic slot's path, a \`sans\`/\`mono\` font role → the font token). Never a
   * value-equality guess - only a real source reference. A caller without a brand
   * cascade (CLI, jsdom) omits it and boxes export unbound, exactly as before.
   */
  bindToken?: (css: string, kind: 'color' | 'font') => string | null;
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

/** Lolly's \`lin.srgb_<angle>_<hex[aa]>-<pos>_…\` / \`rad.srgb_0_…\` gradient spec → the unit-box gradient. */
export function gradSpecToPenpot(spec: unknown, w: number, h: number): PenpotIrGradient | null {
  const m = /^(lin|rad)\\.srgb_(-?\\d+(?:\\.\\d+)?)_(.+)$/.exec(str(spec).trim());
  if (!m) return null;
  const stops: PenpotIrGradientStop[] = [];
  for (const part of m[3]!.split('_')) {
    const sm = /^([0-9a-f]{6})([0-9a-f]{2})?-(\\d+(?:\\.\\d+)?)$/i.exec(part);
    if (!sm) return null;
    stops.push({ color: \`#\${sm[1]!.toLowerCase()}\`, opacity: sm[2] ? parseInt(sm[2], 16) / 255 : 1, offset: clamp(fin(sm[3]) / 100, 0, 1) });
  }
  if (stops.length < 2) return null;
  // \`rad.\` is CSS's \`radial-gradient(ellipse farthest-corner …)\`, an ellipse that fills
  // the box - which is exactly Penpot's \`width: 1\` (the scale is applied in the unit box,
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
 * The Design tool's inline markdown subset → runs: \`{#hex w700 mono u s|text}\`, \`**b**\`,
 * \`*i*\`, \`_i_\`, \`\` \`code\` \`\`. The attribute tokens are exactly the ones \`inlineMd\` in
 * \`community/design/hooks.js\` paints on the artboard - a colour, \`w100\`..\`w900\`,
 * \`mono\`/\`sans\`, and the decorations \`u\` (underline) / \`s\` (line-through) - and an
 * UNRECOGNISED token (an unreadable colour included) leaves the \`{…|…}\` braces standing
 * as literal text there, so it does here too: the archive must not say something the
 * artboard does not. Penpot's \`textDecoration\` is one enum value, so \`{u s|…}\` keeps
 * the underline where the artboard draws both bars.
 */
export function designTextRuns(line: string): MdRun[] {
  const out: MdRun[] = [];
  const push = (text: string, style: Omit<MdRun, 'text'>): void => { if (text) out.push({ text, ...style }); };
  const unesc = (s: string): string => s.replace(/\\\\\\*/g, '*').replace(/\\\\_/g, '_');
  let rest = line;
  while (rest.length) {
    const m = /\\{([^|{}]+)\\|([^{}]*)\\}|\\*\\*([^*]+)\\*\\*|\`([^\`]+)\`|(?<![\\w\\\\])\\*([^*\\s][^*]*?)\\*(?!\\w)|(?<![\\w\\\\])_([^_\\s][^_]*?)_(?!\\w)/.exec(rest);
    if (!m) { push(unesc(rest), {}); break; }
    push(unesc(rest.slice(0, m.index)), {});
    if (m[1] != null) {
      const style: Omit<MdRun, 'text'> = {};
      let known = true;
      for (const tok of m[1].trim().split(/\\s+/)) {
        if (/^#[0-9a-f]{3,8}$/i.test(tok)) style.color = tok;
        else if (/^w[1-9]00$/.test(tok)) style.weight = parseInt(tok.slice(1), 10);
        else if (tok === 'mono' || tok === 'sans') style.family = tok;
        else if (tok === 'u') style.decoration = 'underline';
        else if (tok === 's') style.decoration = style.decoration ?? 'line-through';
        else { known = false; break; }
      }
      if (!known) {
        // The artboard keeps the whole run literal. Emit the \`{attrs|\` head as text and
        // carry on scanning the body, so its \`**bold**\` still reads as bold and the
        // closing brace comes out as text - what \`inlineMd\` leaves behind, character for
        // character.
        const head = \`{\${m[1]}|\`;
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

export function boxesToPenpotDoc(boxesIn: unknown, o: BoxesToPenpotOptions): PenpotDoc {
  const boxes: Box[] = (Array.isArray(boxesIn) ? boxesIn : []).filter(isRec);
  const geomApi = o.geom ?? makeGeomApi();
  const media: PenpotMedia[] = [];
  const byId = new Map<string, Box>();
  for (const b of boxes) { const id = str(b.id); if (id && !byId.has(id)) byId.set(id, b); }
  const google = new Set(Array.from(o.googleFamilies ?? [], (f) => String(f).trim().toLowerCase()));

  const hexOf = (p: PenpotColor): string => (p.alpha < 1 ? \`\${p.hex}\${Math.round(p.alpha * 255).toString(16).padStart(2, '0')}\` : p.hex);
  const color = (v: unknown): string | null => {
    const s = str(v).trim();
    if (!s) return null;
    // A \`var(…)\` or \`{token}\` NAMES brand data, so the live cascade answers first: the
    // literal inside \`var(--brand-primary, #1e293b)\` is only the authored fallback, and
    // parsePenpotColor would happily return it and never ask. With no resolver (or none
    // that answers) the literal still stands, so the headless path is unchanged.
    if (/var\\(/i.test(s) || s.startsWith('{')) {
      const live = o.resolveColor?.(s) ?? null;
      const lp = live ? parsePenpotColor(live) : null;
      if (lp) return hexOf(lp);
    }
    const p = parsePenpotColor(s);
    if (p) return hexOf(p);
    const r = o.resolveColor?.(s) ?? null;
    return r && parsePenpotColor(r) ? r : null;
  };
  /**
   * The brand token PATH a box field's source names, or null for a literal
   * (plans/222). A bare \`{color.semantic.primary}\` alias resolves here directly
   * (the path IS brand-free); anything else (\`var(--brand-primary)\`, a \`sans\`
   * role) is the shell's \`bindToken\` to map. The writer validates the returned
   * path against the file's own tokens and drops it if it does not survive, so a
   * stale binding degrades to the painted colour rather than a broken import.
   */
  const tokenPathOf = (v: unknown, kind: 'color' | 'font'): string | null => {
    const s = str(v).trim();
    if (!s) return kind === 'font' ? (o.bindToken?.('', kind) ?? null) : null;
    const alias = /^\\{([A-Za-z0-9_.-]+)\\}$/.exec(s);
    if (alias) return alias[1]!;
    return o.bindToken?.(s, kind) ?? null;
  };
  const familyOf = (key: unknown): string => {
    const k = str(key).trim();
    if (!k || k === 'sans') return o.fonts?.sans || 'sans-serif';
    if (k === 'mono') return o.fonts?.mono || 'monospace';
    return k.replace(/[^\\w \\-]/g, '').trim() || (o.fonts?.sans || 'sans-serif');
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
    let textHasRunColor = false;
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
      const paragraphs: PenpotIrParagraph[] = text.split('\\n').map((line) => {
        let ln = line;
        const mb = /^(\\s*)[-*•]\\s+(.*)$/.exec(ln);
        const mo = /^(\\s*)(\\d{1,3})\\.\\s+(.*)$/.exec(ln);
        if (mb) ln = \`\${mb[1]}•  \${mb[2]}\`; else if (mo) ln = \`\${mo[1]}\${mo[2]}.  \${mo[3]}\`;
        const runs = designTextRuns(ln).map((r): PenpotIrTextRun => {
          if (r.color) textHasRunColor = true;
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
    // Applied-token bindings from the box's OWN source refs (plans/222): a fill/
    // text colour, a stroke colour and a font that name a brand token bind to it,
    // so editing that token in Penpot re-paints this box. Only a solid fill can
    // carry a colour token (a gradient/image is not one colour), and a text box
    // with a per-run colour keeps its colours local rather than letting one token
    // overwrite them. The writer re-validates every path and drops what it cannot
    // resolve, so a stale ref never breaks the import.
    if (shape) {
      const applied: Record<string, string> = {};
      const solidFill = shape.type !== 'image' && !gradSpecToPenpot(b.grad, w, h);
      if (kind === 'text') {
        if (!textHasRunColor) { const p = tokenPathOf(b.fg, 'color'); if (p) applied.fill = p; }
        const fp = tokenPathOf(b.font, 'font'); if (fp) applied.fontFamily = fp;
      } else if (solidFill && color(b.bg)) {
        const p = tokenPathOf(b.bg, 'color'); if (p) applied.fill = p;
      }
      if (strokeOf(b).length) { const sp = tokenPathOf(b.stroke, 'color'); if (sp) applied.strokeColor = sp; }
      if (Object.keys(applied).length) shape.appliedTokens = { ...shape.appliedTokens, ...applied };
    }

    // A box clipped by another box (\`clip\`) → a masked group: the mask's outline first, then the box.
    const clipId = str(b.clip);
    const mask = clipId && clipId !== str(b.id) ? byId.get(clipId) : undefined;
    if (shape && mask) {
      const mw = Math.max(1, fin(mask.w, 1)), mh = Math.max(1, fin(mask.h, 1));
      const mshape = str(mask.shape);
      const maskShape: PenpotIrShape = (mshape === 'ellipse' || mshape === 'circle')
        ? { type: 'circle', name: 'Mask', x: fin(mask.x), y: fin(mask.y), w: mw, h: mh, rotation: fin(mask.rot), fills: [{ color: '#000000' }] }
        : { type: 'rect', name: 'Mask', x: fin(mask.x), y: fin(mask.y), w: mw, h: mh, rotation: fin(mask.rot), fills: [{ color: '#000000' }], radius: mshape === 'rounded' ? fin(mask.radius) : mshape === 'pill' ? Math.min(mw, mh) / 2 : 0 };
      return { type: 'group', name: \`\${shape.name ?? 'Box'} (clipped)\`, x: shape.x, y: shape.y, w: shape.w, h: shape.h, masked: true, children: [maskShape, shape] };
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
        type: 'board', name: nameOf(fb, \`Board \${shapes.length + 1}\`),
        x: fin(fb.x), y: fin(fb.y), w: Math.max(1, fin(fb.w, 1)), h: Math.max(1, fin(fb.h, 1)),
        fills: [{ color: p.hex, opacity: p.alpha }],
        // A frame carries a REAL border (the Artboard add-kind seeds one), and a Penpot
        // board takes strokes like any other shape. \`inner\`, because the design tool
        // paints that border inside the box (\`box-sizing: border-box\`).
        strokes: strokeOf(fb).map((s) => ({ ...s, alignment: 'inner' as const })),
        children, showContent: fb.clipChildren === false,
      };
      effects(fb, board);
      const boardApplied: Record<string, string> = {};
      const bfp = tokenPathOf(fb.bg, 'color'); if (bfp) boardApplied.fill = bfp;
      if (strokeOf(fb).length) { const bsp = tokenPathOf(fb.stroke, 'color'); if (bsp) boardApplied.strokeColor = bsp; }
      if (Object.keys(boardApplied).length) board.appliedTokens = boardApplied;
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

`;
assert.equal(createHash('sha256').update(legacySource).digest('hex'), 'b995d78b5e8bb6981187f79034f2a98b75dc9773a7d6c6503cf4d6f82725b583', 'the retained producer source is immutable');
const bundled = await build({ stdin: { contents: legacySource, resolveDir: fileURLToPath(new URL('../engine/src/', import.meta.url)), sourcefile: 'legacy-penpot-producer.ts', loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm' });
const legacy = (await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles![0]!.text).toString('base64')}`)).boxesToPenpotDoc as typeof boxesToPenpotDoc;
const NOW = '2026-10-09T12:00:00.000Z';
const rows = [
  { id: 'frame', kind: 'frame', name: 'Board', x: 120.25, y: 10.5, w: 500, h: 300, bg: '#ffffff', clipChildren: false },
  { id: 'plain', kind: 'box', name: 'Plain', frame: 'frame', x: '135.75px', y: -3.25, w: 73.5, h: 29.25, bg: '#12345680', stroke: '#abcdef40', strokeW: '2.5px', rot: 12.345, opacity: '42.5%', hidden: true },
  { id: 'round', kind: 'box', name: 'Rounded', frame: 'frame', shape: 'rounded', x: 230.25, y: 20.5, w: 20, h: 10, radius: 50, bg: '#304050' },
  { id: 'pill', kind: 'box', name: 'Pill', frame: 'frame', shape: 'pill', x: 170.5, y: 90.25, w: 70.5, h: 10.75, bg: '#6789ab' },
  { id: 'ellipse', kind: 'box', name: 'Ellipse', frame: 'frame', shape: 'ellipse', x: 250, y: 90, w: 60.5, h: 20.25, bg: '#aabbcc' },
  { id: 'scratch', kind: 'box', name: 'Scratch', x: 650.25, y: 0.5, w: 30.5, h: 20, bg: '#000000' },
];
function options(): BoxesToPenpotOptions { return { name: 'Legacy primitive contract', canvas: { w: 900, h: 450 } }; }
function entries(doc: PenpotDoc) { return buildPenpotEntries(doc, { uuid: seededPenpotUuid(17), now: () => NOW }); }
function flatShapes(doc: PenpotDoc): PenpotIrShape[] {
  const out: PenpotIrShape[] = [];
  const visit = (shape: PenpotIrShape): void => { out.push(shape); if ('children' in shape) shape.children.forEach(visit); };
  doc.pages.forEach(page => { page.shapes.forEach(visit); });
  return out;
}
test('frozen producer characterizes complete IR and seeded archive, with non-vacuous negative controls', () => {
  const expected = legacy(rows, options());
  assert.deepEqual(boxesToPenpotDoc(rows, options()), expected);
  assert.deepEqual(entries(boxesToPenpotDoc(rows, options())), entries(expected));
  const plain = flatShapes(expected).find(shape => shape.name === 'Plain')!;
  assert.equal(plain.x, 135.75);
  assert.equal(plain.opacity, 0.425);
  assert.equal(plain.strokes![0]!.alignment, 'center');
  assert.equal(flatShapes(expected).find(shape => shape.name === 'Rounded')!.radius, 50);
  for (const mutation of ['missing-shape', 'moved-shape', 'inside-stroke', 'changed-paint']) {
    const changed = structuredClone(expected);
    const board = changed.pages[0]!.shapes[0]!;
    assert.ok('children' in board);
    const target = board.children[0]!;
    if (mutation === 'missing-shape') board.children.splice(0, 1);
    if (mutation === 'moved-shape') target.x += 1;
    if (mutation === 'inside-stroke') target.strokes![0]!.alignment = 'inner';
    if (mutation === 'changed-paint') target.fills![0]!.color = '#ff0000';
    assert.throws(() => assert.deepEqual(changed, expected), mutation);
    assert.throws(() => assert.deepEqual(entries(changed), entries(expected)), mutation);
  }
});

test('the Penpot consumer uses evaluated primitives and preserves distinct default and preview semantics', () => {
  const row = { id: 'owned', kind: 'box', shape: 'rounded', radius: 50, x: 10.25, y: -0.75, w: 20.5, h: 10.75, rot: 12.345, opacity: '42.5%', hidden: true, flipH: true };
  const supplied = { fills: [{ kind: 'color' as const, color: '#123456', opacity: 0.5 }], stroke: { color: '#abcdef', opacity: 0.25, width: 2.5, cap: 'square' } };
  const op = compileDesignRow(row, { x: 0, y: 0 }, { semantics: 'penpot-compat', penpotCompat: supplied }) as DrawShapeOp;
  const expected = designDrawPenpot(op), before = structuredClone(op);
  row.radius = 1;
  supplied.fills[0]!.color = '#ff0000';
  supplied.stroke.width = 8;
  assert.deepEqual(designDrawPenpot(op), expected, 'authored row and supplied paint edits cannot alter the evaluated operation');
  assert.deepEqual(op, before);
  assert.deepEqual(op.box, { x: 10.25, y: -0.75, w: 20.5, h: 10.75 });
  assert.deepEqual(op.shape, { kind: 'rect', radius: 50 });
  assert.equal(expected.opacity, 0.425);
  assert.equal(expected.rotation, 12.345);
  assert.equal(expected.strokes![0]!.alignment, 'center');
  assert.equal(expected.strokes![0]!.capStart, 'square');
  const shifted = structuredClone(op);
  shifted.box.x += 1;
  assert.notDeepEqual(designDrawPenpot(shifted), expected);
  const defaultRow = { ...row, bg: '#123456', stroke: '#abcdef', strokeW: 2.5, radius: 50 };
  const current = compileDesignRow(defaultRow, { x: 0, y: 0 }) as DrawShapeOp;
  const preview = compileDesignRow(defaultRow, { x: 0, y: 0 }, { semantics: 'preview' }) as DrawShapeOp;
  assert.deepEqual(current.box, { x: 10, y: -1, w: 21, h: 11 });
  assert.deepEqual(current.shape, { kind: 'rect', radius: 5.5 });
  assert.equal(current.stroke!.align, 'inside');
  assert.equal(current.pose!.flipH, true);
  assert.deepEqual(preview.box, op.box);
  assert.deepEqual(preview.shape, { kind: 'rect', radius: 50 });
  assert.equal(current.compatibility, undefined);
  assert.equal(preview.compatibility, undefined);
  assert.throws(() => designDrawPenpot(current), /named native-primitive/);
  assert.throws(() => designDrawPenpot({ ...op, compatibility: 'lottie-native-v1' }), /named native-primitive/);
});

test('the primitive policy refuses unsupported families and malformed evaluation instead of discarding content', () => {
  const row = { id: 'flat', kind: 'box', w: 20, h: 10 };
  const options = { semantics: 'penpot-compat' as const, penpotCompat: { fills: [{ kind: 'color' as const, color: '#123456', opacity: 1 }] } };
  const legacy: DesignBoxRowV1[] = [
    { kind: 'text', text: 'Words' }, { kind: 'image', image: 'picture' }, { kind: 'path', path: 'outline' }, { kind: 'frame' },
    { kind: 'web' }, { shape: 'polygon' }, { grad: 'invalid-but-present' }, { clip: 'missing' }, { pathPaint: '{}' },
    { shadow: 'depth' }, { blend: 'multiply' }, { blur: 0.1 }, { bgBlur: 1 }, { rx: 1 }, { ry: 1 },
    { strokeDash: 'dashed' }, { headStart: 'triangle' }, { headEnd: 'circle' }, { kf: '0:1' }, { enter: 'fade' },
    { start: 0 }, { dur: 0 }, { lane: 'seq' }, { text: 'Text on an ordinary box' },
  ];
  for (const fields of legacy) {
    const input = { ...row, ...fields };
    assert.equal(isPenpotPrimitiveRow(input), false, JSON.stringify(fields));
    assert.throws(() => compileDesignRow(input, { x: 0, y: 0 }, options), /legacy Penpot producer/);
  }
  assert.equal(isPenpotPrimitiveRow({ ...row, hidden: '1', flipH: true, strokeCap: 'unrecognized', shadow: 'none', blend: 'normal' }), true);
  assert.throws(() => compileDesignRow(row, { x: 0, y: 0 }, { semantics: 'penpot-compat' }), /resolved paints/);
  assert.throws(() => compileDesignDraw([row], { width: 20, height: 10 }, options), /Penpot producer owns page selection/);
  const op = compileDesignRow(row, { x: 0, y: 0 }, options) as DrawShapeOp;
  for (const fields of [
    { clip: { points: [[0, 0] as [number, number]] } }, { blur: 1 }, { blend: 'multiply' },
    { pose: { rot: 0, flipH: true, flipV: false } },
    { shape: { kind: 'path' as const, contours: [], evenOdd: false } },
    { fills: [{ kind: 'radial' as const, stops: [] }] },
    { fills: [...op.fills, ...op.fills] },
    { box: { ...op.box, x: NaN } }, { opacity: 101 },
    { stroke: { color: '#123456', width: 1, align: 'inside' as const } },
    { stroke: { color: '#123456', width: 1, dash: [1, 1] as [number, number] } },
    { stroke: { color: '#123456', width: 1, cap: 'triangle-arrow' } },
    { fills: [{ kind: 'color' as const, color: 'var(--private)', opacity: 1 }] },
  ]) assert.throws(() => designDrawPenpot({ ...op, ...fields }));
});

test('mixed documents and resolver call order keep the complete legacy IR and archive', () => {
  const triangle = makeGeomApi().encodeAuthored([{ kind: 'line', closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }] }]);
  assert.ok(triangle.ok);
  const mixed = [
    ...rows,
    { id: 'token', kind: 'box', frame: 'frame', x: 5, y: 8, w: 40, h: 20, bg: 'var(--brand-primary, #ff0000)', stroke: '{color.edge}', strokeW: 2 },
    { id: 'empty-kind', shape: 'circle', w: 25, h: 15, bg: '#ff9900', flipV: '1' },
    { id: 'text', kind: 'text', text: 'Hello **world**\n{u s|decorated}', fontSize: 18, fg: '#aabbcc', w: 160, h: 80 },
    { id: 'gradient', kind: 'box', grad: 'lin.srgb_90_ff000080-0_0000ff-100', bg: '#ffffff', w: 80, h: 40 },
    { id: 'effects', kind: 'box', shadow: 'box', shadowColor: '#00000055', shadowX: 3, shadowY: 4, blur: 2, bgBlur: 4, blend: 'multiply', bg: '#123456', w: 50, h: 30 },
    { id: 'dash', kind: 'box', stroke: '#112233', strokeW: 3, strokeDash: 'dashed', strokeDashLen: 6, strokeGapLen: 2, headStart: 'open', w: 60, h: 20 },
    { id: 'clipped', kind: 'box', clip: 'ellipse', bg: '#aabbcc', w: 80, h: 40 },
    { id: 'picture', kind: 'image', image: 'picture', w: 30, h: 30, shape: 'rounded', radius: 4 },
    { id: 'path', kind: 'path', path: triangle.value, x: 15, y: 30, w: 30, h: 20, bg: '#ddccbb', rot: 15, flipH: true },
    { id: 'bad-path', kind: 'path', path: '%invalid', w: 30, h: 20 },
    { id: 'audio', kind: 'audio', w: 10, h: 10 }, { id: 'camera', kind: 'camera', w: 10, h: 10 },
    { id: 'unknown', kind: 'web', image: 'ignored', text: 'ignored', w: 40, h: 20, bg: '#345678' },
    { id: 'second', kind: 'frame', name: 'First by order', x: 900, order: -1, w: 100, h: 80, bg: '#dddddd', hidden: true },
  ];
  const configured = (trace: string[]): BoxesToPenpotOptions => ({
    ...options(), fonts: { sans: 'SUSE', mono: 'SUSE Mono' }, googleFamilies: ['SUSE'],
    resolveColor(value) { trace.push(`resolve:${value}`); return value.includes('primary') ? '#2468ac80' : value === '{color.edge}' ? '#0a0b0c' : null; },
    bindToken(value, kind) { trace.push(`bind:${kind}:${value}`); return value.includes('primary') ? 'color.primary' : null; },
    mediaFor(box) { trace.push(`media:${box.id}`); return null; },
    tokens: { color: { primary: { $type: 'color', $value: '#2468ac' }, edge: { $type: 'color', $value: '#0a0b0c' } } },
    palette: [{ name: 'Primary', color: '#2468ac' }], typographies: [{ name: 'Body', fontFamily: 'SUSE', fontSize: 18 }],
  });
  const expectedTrace: string[] = [], actualTrace: string[] = [];
  const expected = legacy(mixed, configured(expectedTrace)), actual = boxesToPenpotDoc(mixed, configured(actualTrace));
  assert.deepEqual(actualTrace, expectedTrace);
  assert.deepEqual(actual, expected);
  assert.deepEqual(entries(actual), entries(expected));
  assert.ok(flatShapes(actual).some(shape => shape.name === 'text' && shape.type === 'text'));
  assert.ok(flatShapes(actual).some(shape => shape.name === 'box (clipped)' && shape.type === 'group'));
});

test('seeded primitive and coercion corpus preserves all legacy producer bytes and source rows', () => {
  let state = 0x295e2;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const shapes = ['', 'rect', 'rounded', 'pill', 'circle', 'ellipse'];
  const weird = ['', null, undefined, '9.75px', '50%', 'invalid', Infinity, NaN, -0, true, false];
  const corpus: Record<string, unknown>[] = [];
  for (let index = 0; index < 384; index++) {
    corpus.push({ id: `shape-${index}`, kind: index % 7 ? 'box' : '', shape: shapes[index % shapes.length],
      x: index % 9 ? random() * 900 - 100 : weird[index % weird.length], y: random() * 400 - 50,
      w: index % 11 ? random() * 100 - 3 : weird[index % weird.length], h: random() * 70 - 2,
      radius: index % 5 ? random() * 150 - 20 : weird[index % weird.length],
      opacity: index % 4 ? random() * 180 - 40 : weird[index % weird.length],
      rot: index % 6 ? random() * 800 - 400 : weird[index % weird.length], hidden: index % 2 === 0,
      bg: ['#123456', '#abcdef80', 'transparent', 'none', 'not-a-colour', 'var(--brand-primary, #112233)'][index % 6],
      stroke: index % 3 ? '#2468ac80' : '', strokeW: random() * 15 - 3,
      strokeCap: ['round', 'square', '', 'unknown'][index % 4], flipH: [true, '1', false][index % 3] });
  }
  const before = structuredClone(corpus);
  for (const row of corpus) assert.deepEqual(boxesToPenpotDoc([row], options()), legacy([row], options()), String(row.id));
  const expected = legacy(corpus, options()), actual = boxesToPenpotDoc(corpus, options());
  assert.deepEqual(actual, expected);
  assert.deepEqual(entries(actual), entries(expected));
  assert.deepEqual(corpus, before);
});

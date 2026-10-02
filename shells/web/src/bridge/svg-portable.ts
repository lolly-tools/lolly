// SPDX-License-Identifier: MPL-2.0
/**
 * The last pass over a walker-built SVG before it is serialised: paint every SVG 1.1
 * consumer can read, and path data packed without moving a point.
 *
 * ## Paint
 *
 * The walker fills boxes and shadows with the computed CSS colour, and the inline-<svg>
 * passthrough clones authored markup verbatim, so `fill="rgba(12,50,44,0.13)"` and
 * `style="stroke: rgba(…)"` reached the file. Browsers read that. SVG 1.1 paint is only
 * a hex, `rgb()` or a keyword, and the editors people open an export in (Inkscape before
 * 1.4, Illustrator, librsvg viewers) drop anything else as invalid paint. An invalid
 * fill falls back to opaque BLACK and an invalid stroke to NONE: Snippet's translucent
 * close button became a black disc with no ×, and every soft box-shadow a solid black
 * blur (user report, 2026-10-02). Each such colour becomes `#rrggbb`, and its alpha
 * moves to the paired `*-opacity`, multiplied into whatever opacity the element
 * already inherits, so the composite is unchanged.
 *
 * ## Path data
 *
 * Outlined text is nearly all of an export's bytes (39 kB of a 42 kB five-line Snippet),
 * written as absolute commands at two decimals. Rewritten relative, on the integer grid
 * of the path's own precision, the same points cost about a third less. Every
 * coordinate survives exactly; a path this cannot rewrite exactly (arcs, exponents, more
 * than four decimals) is left as it was.
 */
import { parseColor, colorToSrgb8 } from '@lolly/engine';

// Paint property → its opacity partner, and whether that partner inherits. A paint
// with no partner (lighting-color) can only be normalised when it is opaque.
const PAINT: Record<string, { opacity: string | null; inherited: boolean }> = {
  'fill': { opacity: 'fill-opacity', inherited: true },
  'stroke': { opacity: 'stroke-opacity', inherited: true },
  'stop-color': { opacity: 'stop-opacity', inherited: false },
  'flood-color': { opacity: 'flood-opacity', inherited: false },
  'lighting-color': { opacity: null, inherited: false },
};
// Already SVG 1.1: hex, integer or percentage rgb(), url() and keywords. `transparent`
// is a CSS3 keyword and is handled on its own.
const SVG11_PAINT = /^(?:#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgb\(\s*\d{1,3}(?:\.\d+)?%\s*,\s*\d{1,3}(?:\.\d+)?%\s*,\s*\d{1,3}(?:\.\d+)?%\s*\)|url\(.*|[a-z-]+)$/i;

const fmtOpacity = (v: number): string => String(Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000);
const hex2 = (n: number): string => n.toString(16).padStart(2, '0');

/**
 * An SVG 1.1 spelling of one paint value: `{ paint, alpha }`, or null when the value
 * is already portable or is not a colour at all. `alpha` is what the paired opacity
 * must be multiplied by; a fully transparent colour comes back as `none` for fill and
 * stroke (identical, and readable everywhere) and as black at alpha 0 otherwise.
 */
export function portablePaint(prop: string, value: string): { paint: string; alpha: number } | null {
  const v = value.trim();
  if (!/^transparent$/i.test(v) && SVG11_PAINT.test(v)) return null;
  const c = parseColor(v);
  if (!c) return null;
  if (c.alpha <= 0) return prop === 'fill' || prop === 'stroke' ? { paint: 'none', alpha: 1 } : { paint: '#000000', alpha: 0 };
  const [r, g, b, a] = colorToSrgb8(c);
  return { paint: `#${hex2(r)}${hex2(g)}${hex2(b)}`, alpha: a };
}

function styleDecl(style: string, prop: string): string | null {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]*)`, 'i').exec(style);
  return m ? m[1]!.trim() : null;
}
function setStyleDecl(style: string, prop: string, value: string): string {
  const re = new RegExp(`((?:^|;)\\s*${prop}\\s*:\\s*)[^;]*`, 'i');
  if (re.test(style)) return style.replace(re, `$1${value}`);
  const base = style.trim().replace(/;\s*$/, '');
  return (base ? `${base}; ` : '') + `${prop}: ${value};`;
}

// The opacity this element paints with before its own rewrite: its style, then its
// attribute, then (for the inherited pair) the nearest ancestor that sets either.
function liveOpacity(el: Element, prop: string, inherited: boolean): number {
  for (let at: Element | null = el; at; at = inherited ? at.parentElement : null) {
    const raw = styleDecl(at.getAttribute('style') ?? '', prop) ?? at.getAttribute(prop);
    if (raw?.trim() && raw.trim() !== 'inherit') {
      const n = raw.trim().endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  return 1;
}

/** Rewrite every non-1.1 paint in `root`'s subtree, in place. */
export function portableSvgPaint(root: Element): void {
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const [prop, pair] of Object.entries(PAINT)) {
      const style = el.getAttribute('style') ?? '';
      const fromStyle = styleDecl(style, prop);
      const fromAttr = el.getAttribute(prop);
      if (fromStyle == null && fromAttr == null) continue;
      const base = pair.opacity ? liveOpacity(el, pair.opacity, pair.inherited) : 1;
      // The live declaration (style wins over the attribute) carries the alpha into
      // the opacity; a shadowed attribute is only respelled.
      const live = fromStyle != null ? 'style' : 'attr';
      let opacity: number | null = null;
      if (fromAttr != null) {
        const p = portablePaint(prop, fromAttr);
        if (p && (p.alpha >= 1 || pair.opacity)) {
          el.setAttribute(prop, p.paint);
          if (live === 'attr' && p.alpha < 1) opacity = base * p.alpha;
        }
      }
      if (fromStyle != null) {
        const p = portablePaint(prop, fromStyle);
        if (p && (p.alpha >= 1 || pair.opacity)) {
          el.setAttribute('style', setStyleDecl(style, prop, p.paint));
          if (p.alpha < 1) opacity = base * p.alpha;
        }
      }
      if (opacity == null || !pair.opacity) continue;
      // Write the opacity where it will win: the style if the style already sets it,
      // else the attribute.
      const s = el.getAttribute('style') ?? '';
      if (styleDecl(s, pair.opacity) != null) el.setAttribute('style', setStyleDecl(s, pair.opacity, fmtOpacity(opacity)));
      else el.setAttribute(pair.opacity, fmtOpacity(opacity));
    }
  }
}

// ─── Path data ────────────────────────────────────────────────────────────────

const ARGC: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, z: 0 };
const PATH_TOKEN = /([MmLlHhVvCcSsQqTtZz])|([+-]?(?:\d+\.?\d*|\.\d+))|([\s,]+)|(.)/g;

/**
 * `d` with relative commands, implicit repeats, H/V for axis-aligned lines and no
 * separator a sign or second decimal point already provides. Exact: coordinates are
 * moved to the integer grid of the path's own finest precision, so every endpoint and
 * control point reads back as the same number. Returns `d` untouched when it cannot
 * promise that, or when the rewrite would not be shorter.
 */
export function compactPathData(d: string): string {
  const toks: (string | number)[] = [];
  let places = 0;
  for (const m of d.matchAll(PATH_TOKEN)) {
    if (m[4] !== undefined) return d;   // arcs, exponents, anything unexpected
    if (m[1] !== undefined) toks.push(m[1]);
    else if (m[2] !== undefined) {
      const dot = m[2].indexOf('.');
      if (dot >= 0) places = Math.max(places, m[2].length - dot - 1);
      toks.push(Number(m[2]));
    }
  }
  if (places > 4 || !toks.length || typeof toks[0] !== 'string' || toks[0].toLowerCase() !== 'm') return d;
  const k = 10 ** places;
  const q = (v: string | number): number => Math.round((v as number) * k);

  const fmt = (n: number): string => {
    if (n === 0) return '0';
    const neg = n < 0, a = Math.abs(n);
    let s = String(Math.floor(a / k));
    const frac = a % k;
    if (frac) s += '.' + String(frac).padStart(places, '0').replace(/0+$/, '');
    if (s.startsWith('0.')) s = s.slice(1);
    return (neg ? '-' : '') + s;
  };
  let out = '', prevCmd = '', prevNum = '';
  const emit = (cmd: string, nums: number[]): void => {
    // After `m` an omitted command letter means `l`, so a following `l` leaves its letter out.
    const implicit = cmd !== 'm' && cmd !== 'z' && (cmd === prevCmd || (cmd === 'l' && prevCmd === 'm'));
    if (!implicit) { out += cmd; prevNum = ''; }
    for (const n of nums) {
      const s = fmt(n);
      if (prevNum && !s.startsWith('-') && !(s.startsWith('.') && prevNum.includes('.'))) out += ' ';
      out += s; prevNum = s;
    }
    prevCmd = cmd === 'm' ? 'm' : cmd;
  };

  let cx = 0, cy = 0, sx = 0, sy = 0, i = 0;
  while (i < toks.length) {
    const letter = toks[i++] as string;
    if (typeof letter !== 'string') return d;
    const lower = letter.toLowerCase(), rel = letter !== letter.toUpperCase();
    const argc = ARGC[lower]!;
    if (argc === 0) { emit('z', []); cx = sx; cy = sy; continue; }
    let first = true;
    do {
      const args = toks.slice(i, i + argc);
      if (args.length < argc || args.some(a => typeof a === 'string')) return d;
      i += argc;
      const n = args.map(q);
      // Absolute grid coordinates for this segment, from either spelling.
      const ox = rel ? cx : 0, oy = rel ? cy : 0;
      const cmd = lower === 'm' && !first ? 'l' : lower;
      if (cmd === 'h') { const x = n[0]! + ox; emit('h', [x - cx]); cx = x; }
      else if (cmd === 'v') { const y = n[0]! + oy; emit('v', [y - cy]); cy = y; }
      else {
        const abs = n.map((v, j) => v + (j % 2 ? oy : ox));
        const ex = abs[argc - 2]!, ey = abs[argc - 1]!;
        const relNums = abs.map((v, j) => v - (j % 2 ? cy : cx));
        if (cmd === 'l' && relNums[1] === 0) emit('h', [relNums[0]!]);
        else if (cmd === 'l' && relNums[0] === 0) emit('v', [relNums[1]!]);
        else emit(cmd, relNums);
        cx = ex; cy = ey;
        if (cmd === 'm') { sx = ex; sy = ey; }
      }
      first = false;
    } while (i < toks.length && typeof toks[i] !== 'string');
  }
  return out.length < d.length ? out : d;
}

/** Pack every <path>'s `d` in `root`'s subtree, in place. */
export function compactSvgPaths(root: Element): void {
  for (const p of root.querySelectorAll('path')) {
    const d = p.getAttribute('d');
    if (d) { const c = compactPathData(d); if (c !== d) p.setAttribute('d', c); }
  }
}

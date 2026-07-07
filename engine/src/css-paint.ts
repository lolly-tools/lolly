// Pure, DOM-free CSS "paint" value parsers: clip-path basic shapes, gradient stops
// + radial-gradient geometry, and drop-shadow filters.
//
// Sibling to css-box.ts (box-model geometry). Single source of truth for the export
// walkers (the SVG walker and the PDF walker in shells/web/src/bridge/export.ts) so
// the two vector renderers compute identical shapes and can never drift. The shell
// reads getComputedStyle, passes the raw CSS strings/numbers in, and turns the plain
// geometry returned here into SVG elements or jsPDF path ops. NOTHING here touches the
// DOM (engine stays platform-agnostic, like css-box.ts / units.ts / color.ts).

// ── clip-path basic shapes ───────────────────────────────────────────────────

/** A clip-path resolved to box-local geometry (CSS px, origin at the box top-left). */
export type ClipShape =
  | { kind: 'circle';  cx: number; cy: number; r: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'inset';   x: number; y: number; w: number; h: number; r: number }
  | { kind: 'polygon'; points: [number, number][] };

// A clip length token → px. `%` resolves against `ref`; anything non-finite → null.
function clipLen(tok: string | undefined, ref: number): number | null {
  if (!tok) return null;
  const t = tok.trim();
  if (t.endsWith('%')) { const p = parseFloat(t); return Number.isFinite(p) ? p / 100 * ref : null; }
  const p = parseFloat(t);                 // '50px' → 50
  return Number.isFinite(p) ? p : null;
}

// A clip-path position ("at <x> <y>") → centre in box px; defaults to the centre.
function clipPos(posStr: string, w: number, h: number): { cx: number; cy: number } {
  const s = (posStr || '').trim().toLowerCase();
  if (!s) return { cx: w / 2, cy: h / 2 };
  const toks = s.split(/\s+/);
  const XK: Record<string, number> = { left: 0, right: w, center: w / 2 };
  const YK: Record<string, number> = { top: 0, bottom: h, center: h / 2 };
  const first = toks[0]!, second = toks[1];
  const cx = first in XK ? XK[first]! : (first in YK ? null : clipLen(first, w));
  const cy = second == null ? h / 2 : (second in YK ? YK[second]! : (second in XK ? null : clipLen(second, h)));
  return { cx: cx ?? w / 2, cy: cy ?? h / 2 };
}

// A clip shape radius (axis 'circle' | 'x' | 'y') — length, %, or closest/farthest-side.
function clipRadius(tok: string | undefined, w: number, h: number, cx: number, cy: number, axis: 'circle' | 'x' | 'y'): number | null {
  const t = (tok || 'closest-side').trim().toLowerCase();
  if (t === 'closest-side')  return axis === 'x' ? Math.min(cx, w - cx) : axis === 'y' ? Math.min(cy, h - cy) : Math.min(cx, w - cx, cy, h - cy);
  if (t === 'farthest-side') return axis === 'x' ? Math.max(cx, w - cx) : axis === 'y' ? Math.max(cy, h - cy) : Math.max(cx, w - cx, cy, h - cy);
  if (t.endsWith('%')) {
    const p = parseFloat(t);
    if (!Number.isFinite(p)) return null;
    const ref = axis === 'x' ? w : axis === 'y' ? h : Math.sqrt(w * w + h * h) / Math.SQRT2;
    return p / 100 * ref;
  }
  const px = parseFloat(t);                // closest/farthest-corner (rare) → NaN → null → raster
  return Number.isFinite(px) ? px : null;
}

// Split a basic-shape's inner text into [size, position] at the " at " keyword.
function splitShapeAt(inner: string): [string, string] {
  const s = inner.trim();
  const lead = /^at\s+/i.exec(s);          // size omitted (e.g. Chrome's "circle(at 50% 50%)")
  if (lead) return ['', s.slice(lead[0].length)];
  const i = s.toLowerCase().indexOf(' at ');
  return i >= 0 ? [s.slice(0, i), s.slice(i + 4)] : [s, ''];
}

// Parse a CSS circle()/ellipse()/inset()/polygon() clip-path into box-local geometry
// (CSS px, origin at the box top-left). `w`/`h` are the element's border-box size in
// CSS px. Returns null for url()/path()/unparseable shapes (the caller then rasterises),
// or a polygon with fewer than 3 usable points.
export function parseClipShape(cp: string, w: number, h: number): ClipShape | null {
  const s = cp.trim();
  if (s.indexOf('polygon(') === 0) {
    const pts = s.slice(8, s.indexOf(')')).split(',')
      .map((t: string) => t.trim().split(/\s+/).map(parseFloat))
      .filter((p: number[]) => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) as [number, number][];
    return pts.length >= 3 ? { kind: 'polygon', points: pts } : null;
  }
  let m = /^circle\(\s*(.*?)\s*\)$/i.exec(s);
  if (m) {
    const [radS, posS] = splitShapeAt(m[1]!);
    const pos = clipPos(posS, w, h);
    const r = clipRadius(radS.trim() || undefined, w, h, pos.cx, pos.cy, 'circle');
    return (r != null && r > 0) ? { kind: 'circle', cx: pos.cx, cy: pos.cy, r } : null;
  }
  m = /^ellipse\(\s*(.*?)\s*\)$/i.exec(s);
  if (m) {
    const [radS, posS] = splitShapeAt(m[1]!);
    const pos = clipPos(posS, w, h);
    const rs = radS.trim() ? radS.trim().split(/\s+/) : [];
    const rx = clipRadius(rs[0], w, h, pos.cx, pos.cy, 'x');
    const ry = clipRadius(rs[1] ?? rs[0], w, h, pos.cx, pos.cy, 'y');
    return (rx != null && ry != null && rx > 0 && ry > 0)
      ? { kind: 'ellipse', cx: pos.cx, cy: pos.cy, rx, ry } : null;
  }
  m = /^inset\(\s*(.*?)\s*\)$/i.exec(s);
  if (m) {
    let body = m[1]!, roundS = '';
    const ri = body.toLowerCase().indexOf(' round ');
    if (ri >= 0) { roundS = body.slice(ri + 7); body = body.slice(0, ri); }
    const t = body.trim().split(/\s+/);
    let tt: string | undefined, rt: string | undefined, bt: string | undefined, lt: string | undefined;
    if (t.length === 1) { tt = rt = bt = lt = t[0]; }
    else if (t.length === 2) { tt = bt = t[0]; rt = lt = t[1]; }
    else if (t.length === 3) { tt = t[0]; rt = lt = t[1]; bt = t[2]; }
    else if (t.length >= 4) { [tt, rt, bt, lt] = t; }
    else return null;
    const top = clipLen(tt, h), right = clipLen(rt, w), bot = clipLen(bt, h), left = clipLen(lt, w);
    if (top == null || right == null || bot == null || left == null) return null;
    const rw = w - left - right, rh = h - top - bot;
    if (rw <= 0.5 || rh <= 0.5) return null;
    const rr = roundS ? clipLen(roundS.trim().split(/\s+/)[0], Math.min(w, h)) : null;
    return { kind: 'inset', x: left, y: top, w: rw, h: rh, r: (rr && rr > 0) ? rr : 0 };
  }
  return null;                             // circle/ellipse/inset that failed, url(), path()
}

// ── gradient argument + stop parsing (shared by linear + radial) ─────────────

/** One parsed colour-stop: null colorStr = an un-parseable / bare-position hint. */
export interface GradientStop { colorStr: string | null; opacity: number; offset: string }

// Split a CSS argument string on top-level commas, respecting nested parens.
export function splitCssArgs(str: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < str.length; i++) {
    if      (str[i] === '(') depth++;
    else if (str[i] === ')') depth--;
    else if (str[i] === ',' && depth === 0) {
      parts.push(str.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(str.slice(start).trim());
  return parts;
}

// Convert a CSS gradient angle token to radians (SVG y-down convention).
export function parseGradientAngle(token: string): number {
  const t = token.trim().toLowerCase();
  if (t === 'to top')          return 0;
  if (t === 'to top right')    return Math.PI * 0.25;
  if (t === 'to right')        return Math.PI * 0.5;
  if (t === 'to bottom right') return Math.PI * 0.75;
  if (t === 'to bottom')       return Math.PI;
  if (t === 'to bottom left')  return Math.PI * 1.25;
  if (t === 'to left')         return Math.PI * 1.5;
  if (t === 'to top left')     return Math.PI * 1.75;
  if (t.endsWith('deg'))  return parseFloat(t) * Math.PI / 180;
  if (t.endsWith('turn')) return parseFloat(t) * 2 * Math.PI;
  if (t.endsWith('rad'))  return parseFloat(t);
  if (t.endsWith('grad')) return parseFloat(t) * Math.PI / 200;
  return Math.PI;
}

// Split a CSS value on top-level whitespace, respecting nested parens — so the
// commas/spaces *inside* rgb(48, 186, 120) stay together while the SPACE between a
// colour and its position separates them. (splitCssArgs only splits commas, which
// can't separate the space-delimited "<color> <position>" of a computed gradient
// stop — getComputedStyle serialises stops as e.g. "rgb(48, 186, 120) 0%".)
function splitTopLevelWs(str: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of str) {
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth--; cur += ch; }
    else if (depth === 0 && /\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

// Parse one gradient colour-stop into { colorStr, opacity, offset }. Supports hex,
// rgb/rgba, and "transparent"; named colours return colorStr: null. A computed stop is
// "<color> <position?>" with the position SPACE-separated from the colour (e.g.
// "rgb(48, 186, 120) 0%"); the colour itself may contain commas/spaces inside its
// parens, so tokens are split on top-level whitespace and trailing length/percent
// tokens are peeled off as the position.
export function parseGradientStop(raw: string, index: number, total: number): GradientStop {
  const tokens = splitTopLevelWs(raw.trim());
  const positions: string[] = [];
  while (tokens.length && /^-?[\d.]+(px|%)$/.test(tokens[tokens.length - 1]!)) {
    positions.unshift(tokens.pop()!);
  }
  const colorRaw = tokens.join(' ').trim().toLowerCase();
  const pos = positions[0];
  const offset = pos
    ? (pos.endsWith('%') ? pos : parseFloat(pos) + 'px')
    : `${((index / Math.max(total - 1, 1)) * 100).toFixed(2)}%`;

  if (!colorRaw)                  return { colorStr: null, opacity: 1, offset }; // bare position = colour hint
  if (colorRaw === 'transparent') return { colorStr: 'rgba(0,0,0,0)', opacity: 0, offset };
  if (colorRaw.startsWith('#'))   return { colorStr: colorRaw, opacity: 1, offset };
  if (colorRaw.startsWith('rgb')) {
    const am = colorRaw.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
    return { colorStr: colorRaw, opacity: am ? parseFloat(am[1]!) : 1, offset };
  }
  return { colorStr: null, opacity: 1, offset };
}

// ── radial-gradient geometry ─────────────────────────────────────────────────

/** A radial gradient resolved to box-local geometry (CSS px) + its parsed stops. */
export interface RadialGradient { cx: number; cy: number; rx: number; ry: number; stops: GradientStop[] }

// Resolve a radial-gradient size token: a length (px) or percentage of `ref`.
function radialLen(tok: string | undefined, ref: number): number | null {
  if (!tok) return null;
  const t = tok.trim();
  if (t.endsWith('%')) { const p = parseFloat(t); return Number.isFinite(p) ? p / 100 * ref : null; }
  const p = parseFloat(t);
  return Number.isFinite(p) ? p : null;
}

// Radii (rx, ry) for a radial-gradient keyword size, per CSS Images 3 §3.2.1. `l/r/t/b`
// are the centre's distances to the four box edges. Corner sizes keep the matching
// side's aspect ratio and reach the corner (the √2 factor when the centre is centred).
function radialKeywordRadii(kw: string, shape: string, cx: number, cy: number, w: number, h: number): [number, number] {
  const l = cx, r = w - cx, t = cy, b = h - cy;
  const nx = Math.min(l, r), fx = Math.max(l, r), ny = Math.min(t, b), fy = Math.max(t, b);
  if (shape === 'circle') {
    let rad: number;
    switch (kw) {
      case 'closest-side':   rad = Math.max(0, Math.min(nx, ny)); break;
      case 'farthest-side':  rad = Math.max(fx, fy); break;
      case 'closest-corner': rad = Math.hypot(nx, ny); break;
      default:               rad = Math.hypot(fx, fy); break;   // farthest-corner (default)
    }
    return [rad, rad];
  }
  switch (kw) {
    case 'closest-side':   return [Math.max(0, nx), Math.max(0, ny)];
    case 'farthest-side':  return [fx, fy];
    case 'closest-corner': return [nx * Math.SQRT2, ny * Math.SQRT2];
    default:               return [fx * Math.SQRT2, fy * Math.SQRT2];   // farthest-corner
  }
}

// Parse a CSS radial-gradient() value into box-local geometry (centre + rx/ry in CSS px)
// plus its colour stops. Handles the optional "[<shape> || <size>]? [at <position>]?"
// header (circle/ellipse; keyword or explicit sizes; positioned centre). `w`/`h` are the
// box size in CSS px. Returns null if the value isn't a parseable radial gradient (with
// at least two stops and a positive radius).
export function parseRadialGradient(value: string, w: number, h: number): RadialGradient | null {
  const m = value.match(/^radial-gradient\((.+)\)$/s);
  if (!m) return null;
  const parts = splitCssArgs(m[1]!);
  if (parts.length < 2) return null;

  // Split off the optional shape/size/position header (present iff parts[0] isn't a stop).
  const first = parts[0]!.trim();
  const isHeader = /circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner|(^|\s)at\s/i.test(first)
    || /^-?[\d.]+[a-z%]*(\s+-?[\d.]+[a-z%]*)?$/i.test(first);
  const rawStops = isHeader ? parts.slice(1) : parts;
  if (rawStops.length < 2) return null;

  // Position ("… at <pos>") then shape/size tokens.
  const headerStr = isHeader ? first : '';
  let posStr = '', sizeShape = headerStr;
  const atIdx = headerStr.toLowerCase().indexOf(' at ');
  if (atIdx >= 0) { posStr = headerStr.slice(atIdx + 4); sizeShape = headerStr.slice(0, atIdx); }
  else if (/^at\s/i.test(headerStr.trim())) { posStr = headerStr.trim().replace(/^at\s+/i, ''); sizeShape = ''; }
  const pos = clipPos(posStr, w, h);          // defaults to the centre

  let shape = 'ellipse';                       // CSS default ending shape
  let sizeKw = '';
  const sizeToks: string[] = [];
  for (const tok of sizeShape.trim().split(/\s+/).filter(Boolean)) {
    if (/^(circle|ellipse)$/i.test(tok)) shape = tok.toLowerCase();
    else if (/^(closest-side|closest-corner|farthest-side|farthest-corner)$/i.test(tok)) sizeKw = tok.toLowerCase();
    else sizeToks.push(tok);
  }

  let rx: number | null, ry: number | null;
  if (sizeToks.length) {
    if (shape === 'circle') { rx = ry = radialLen(sizeToks[0], Math.min(w, h)); }
    else { rx = radialLen(sizeToks[0], w); ry = radialLen(sizeToks[1] ?? sizeToks[0], h); }
  } else {
    [rx, ry] = radialKeywordRadii(sizeKw || 'farthest-corner', shape, pos.cx, pos.cy, w, h);
  }
  if (rx == null || ry == null || rx <= 0 || ry <= 0) return null;

  const stops = rawStops.map((raw, i) => parseGradientStop(raw.trim(), i, rawStops.length)).filter((s) => s.colorStr);
  if (stops.length < 2) return null;
  return { cx: pos.cx, cy: pos.cy, rx, ry, stops };
}

// ── drop-shadow filter ───────────────────────────────────────────────────────

/** One parsed drop-shadow() from a CSS `filter` value (px offsets/blur + raw colour). */
export interface DropShadow { dx: number; dy: number; blur: number; color: string }

// Split a CSS `filter` value into its top-level function tokens ("blur(2px) invert(1)"
// → ["blur(2px)", "invert(1)"]), respecting parens so a nested rgb(...) isn't split.
function splitFilterFunctions(str: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of str) {
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth--; cur += ch; }
    else if (depth === 0 && /\s/.test(ch)) { if (cur.trim()) { out.push(cur.trim()); cur = ''; } }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Parse a CSS `filter` value IFF it consists solely of drop-shadow() functions, into
// their { dx, dy, blur, color } parameters (px / raw CSS colour). Any other filter
// function (blur, brightness, …) → null, so the caller rasterises instead. CSS applies
// chained drop-shadows to each other's result; a chain of <feDropShadow> primitives
// (default `in` = previous result) reproduces that exactly, so order is preserved.
export function parseDropShadowFilter(filterStr: string | null | undefined): DropShadow[] | null {
  if (!filterStr || filterStr === 'none') return null;
  const fns = splitFilterFunctions(filterStr);
  if (!fns.length) return null;
  const shadows: DropShadow[] = [];
  for (const fn of fns) {
    if (!/^drop-shadow\(/i.test(fn)) return null;          // a non-drop-shadow fn → can't vectorise
    const body = fn.slice(fn.indexOf('(') + 1, fn.lastIndexOf(')')).trim();
    let color = 'rgb(0,0,0)';
    const cm = body.match(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8}/i);
    const rest = cm ? body.replace(cm[0], ' ') : body;
    if (cm) color = cm[0];
    const nums = (rest.match(/-?\d*\.?\d+(?:px)?/g) || []).map(parseFloat).filter(Number.isFinite);
    if (nums.length < 2) return null;
    const [dx, dy, blur = 0] = nums;
    shadows.push({ dx: dx!, dy: dy!, blur: Math.max(0, blur), color });
  }
  return shadows.length ? shadows : null;
}

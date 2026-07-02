// Pure, DOM-free CSS box-model + border-radius geometry.
//
// Single source of truth for the export walkers (the SVG walker and the PDF
// walker in shells/web/src/bridge/export.js) so the two vector renderers — and
// any future shell — compute identical geometry and can never drift. The shell
// reads getComputedStyle and passes the raw CSS strings/numbers in; NOTHING here
// touches the DOM (engine stays platform-agnostic, like units.js / color.js).
//
// The reason this exists: browsers render border-radius with the CSS Backgrounds
// & Borders §5.5 "corner overlap" rule — a single scale factor shrinks every
// corner together so a huge `border-radius: 999px` becomes a stadium/pill. SVG
// <rect> and jsPDF roundedRect instead clamp each axis independently (→ ellipse),
// so the geometry must be resolved here before it reaches those primitives.

/** One resolved corner: [horizontal, vertical] radius in px. */
export type CornerPair = [number, number];

/** The four border-radius corner longhands as raw computed-CSS strings. */
export interface CornerInputs {
  topLeft: string;
  topRight: string;
  bottomRight: string;
  bottomLeft: string;
}

/** The four corners resolved to px pairs (post corner-overlap clamping). */
export interface CornerRadii {
  topLeft: CornerPair;
  topRight: CornerPair;
  bottomRight: CornerPair;
  bottomLeft: CornerPair;
}

/** One outer shadow parsed from a computed `box-shadow` value. */
export interface BoxShadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** Raw CSS color token (rgb/rgba in computed values) for the shell to resolve. */
  color: string;
}

// Parse a CSS length to px. `refPx` resolves percentages. CSS math functions
// (calc/min/max/clamp) carry internal structure we can't resolve here, so they
// deterministically resolve to 0 rather than producing wrong geometry. Anything
// non-finite → 0.
export function parseCssLength(
  value: string | number | null | undefined,
  refPx: number = 0,
): number {
  if (value == null || value === '' || value === '0' || value === '0px') return 0;
  const s = String(value).trim();
  if (s.includes('(')) return 0;
  if (s.endsWith('%')) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? (n / 100) * refPx : 0;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Resolve one border-radius corner longhand into a [horizontal, vertical] px
// pair. The computed value is "10px" or "10px 20px" (horizontal vertical); a
// percentage resolves its horizontal part against width, vertical against height.
function cornerPair(value: string, w: number, h: number): CornerPair {
  const s = String(value || '').trim();
  const t = s.includes('(') ? [s] : s.split(/\s+/);
  return [parseCssLength(t[0], w), parseCssLength(t[1] ?? t[0], h)];
}

// Resolve the four border-radius corners for a w×h box, applying the CSS §5.5
// corner-overlap rule: a SINGLE scale factor f (the min over all four edges of
// edge_length / sum-of-the-two-corner-radii-on-that-edge) shrinks every radius
// together so adjacent corners never overlap. This is what makes a huge radius a
// pill and keeps a genuine 50% an ellipse, while preserving distinct corners.
//
// `corners` = { topLeft, topRight, bottomRight, bottomLeft } raw CSS strings.
// Returns { topLeft:[h,v], topRight, bottomRight, bottomLeft } in px (clamped).
export function cornerRadii(corners: CornerInputs, w: number, h: number): CornerRadii {
  const tl = cornerPair(corners.topLeft,     w, h);
  const tr = cornerPair(corners.topRight,    w, h);
  const br = cornerPair(corners.bottomRight, w, h);
  const bl = cornerPair(corners.bottomLeft,  w, h);
  const ratio = (len: number, a: number, b: number): number => {
    const s = a + b;
    return s > 0 ? len / s : Infinity;
  };
  const f = Math.min(
    1,
    ratio(w, tl[0], tr[0]),   // top edge    — horizontal radii
    ratio(w, bl[0], br[0]),   // bottom edge  — horizontal radii
    ratio(h, tl[1], bl[1]),   // left edge    — vertical radii
    ratio(h, tr[1], br[1]),   // right edge   — vertical radii
  );
  const scale = (p: CornerPair): CornerPair => [p[0] * f, p[1] * f];
  return { topLeft: scale(tl), topRight: scale(tr), bottomRight: scale(br), bottomLeft: scale(bl) };
}

// If all four (already-clamped) corners are equal, return the single [rx, ry]
// pair — the fast path callers use to emit <rect rx ry> / jsPDF.roundedRect.
// Returns [0, 0] when there is no rounding, and null when corners differ (the
// caller must emit a four-corner path via roundedRectPath instead).
export function uniformRadius(radii: CornerRadii): CornerPair | null {
  const c = [radii.topLeft, radii.topRight, radii.bottomRight, radii.bottomLeft];
  const [rx, ry] = radii.topLeft;
  const equal = c.every((p) => Math.abs(p[0] - rx) < 1e-3 && Math.abs(p[1] - ry) < 1e-3);
  if (!equal) return null;
  if (rx <= 0 && ry <= 0) return [0, 0];
  return [rx, ry];
}

// Shrink every corner by `inset` px (clamped ≥ 0). Used to derive the radius of a
// border's centre-line / inner edge from the outer (border-box) radius.
export function insetCorners(radii: CornerRadii, inset: number): CornerRadii {
  const r = (p: CornerPair): CornerPair => [Math.max(0, p[0] - inset), Math.max(0, p[1] - inset)];
  return {
    topLeft:     r(radii.topLeft),
    topRight:    r(radii.topRight),
    bottomRight: r(radii.bottomRight),
    bottomLeft:  r(radii.bottomLeft),
  };
}

// Split a comma-separated CSS list at top level (commas inside parens — e.g.
// rgba(0,0,0,.5) — are not separators).
function splitTopLevel(str: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of String(str)) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// Parse a computed CSS `box-shadow` into a list of OUTER shadows (inset shadows
// are skipped — they can't be expressed as a single vector primitive). The color
// is returned as the raw CSS token (always rgb/rgba in a computed value) for the
// shell to resolve; lengths are px. Order matches CSS paint order (first listed is
// topmost). Returns [] for 'none' / empty.
//   getComputedStyle form per shadow: "<color> <offX> <offY> [blur] [spread] [inset]"
export function parseBoxShadow(value: string | null | undefined): BoxShadow[] {
  if (!value || value === 'none') return [];
  const shadows: BoxShadow[] = [];
  for (const raw of splitTopLevel(value)) {
    const part = raw.trim();
    if (!part || /\binset\b/.test(part)) continue;
    const colorMatch = part.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+/);
    const color = colorMatch ? colorMatch[0] : 'rgb(0,0,0)';
    const rest = colorMatch ? part.replace(colorMatch[0], ' ') : part;
    const nums = (rest.match(/-?\d*\.?\d+(?:px)?/g) || [])
      .map((s) => parseFloat(s)).filter(Number.isFinite);
    if (nums.length < 2) continue;
    const [x, y, blur = 0, spread = 0] = nums;
    if (x === undefined || y === undefined) continue;
    shadows.push({ x, y, blur: Math.max(0, blur), spread, color });
  }
  return shadows;
}

const n3 = (v: number): number => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};

// An SVG/PDF path `d` string for a rounded rectangle with four independent
// corners (clockwise from the top-left, y-down). `radii` is the cornerRadii
// shape. Each corner is an elliptical arc (sweep-flag 1), matching svg-ir's
// rectPath convention so EMF/EPS consume it identically.
export function roundedRectPath(
  x: number, y: number, w: number, h: number, radii: CornerRadii,
): string {
  const cl = (p: CornerPair): CornerPair => [
    Math.max(0, Math.min(p[0], w)),
    Math.max(0, Math.min(p[1], h)),
  ];
  const [tlh, tlv] = cl(radii.topLeft);
  const [trh, trv] = cl(radii.topRight);
  const [brh, brv] = cl(radii.bottomRight);
  const [blh, blv] = cl(radii.bottomLeft);
  return [
    `M${n3(x + tlh)},${n3(y)}`,
    `H${n3(x + w - trh)}`,
    (trh || trv) ? `A${n3(trh)},${n3(trv)} 0 0 1 ${n3(x + w)},${n3(y + trv)}` : '',
    `V${n3(y + h - brv)}`,
    (brh || brv) ? `A${n3(brh)},${n3(brv)} 0 0 1 ${n3(x + w - brh)},${n3(y + h)}` : '',
    `H${n3(x + blh)}`,
    (blh || blv) ? `A${n3(blh)},${n3(blv)} 0 0 1 ${n3(x)},${n3(y + h - blv)}` : '',
    `V${n3(y + tlv)}`,
    (tlh || tlv) ? `A${n3(tlh)},${n3(tlv)} 0 0 1 ${n3(x + tlh)},${n3(y)}` : '',
    'Z',
  ].filter(Boolean).join(' ');
}

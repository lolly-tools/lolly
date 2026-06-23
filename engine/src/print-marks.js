/**
 * Print-marks & bleed geometry — platform-agnostic, no DOM.
 *
 * The single source of truth for laying out a print-ready PDF page: where the
 * trim, bleed and media boxes sit, and the vector primitives for crop marks,
 * bleed marks, registration targets and a colour bar. Mirrors `units.js`
 * (dimension math) and `color.js` (colour math): the engine owns the geometry;
 * each shell's export bridge draws the primitives with its own PDF library.
 *
 * The design (artwork) is rendered at TRIM size and scaled to cover the BLEED
 * box; the marks live in the MARGIN band beyond the bleed.
 *
 *   ┌─ media (full sheet) ───────────────────────┐
 *   │   ╷            registration            ╷    │
 *   │   ┌─ bleed ───────────────────────────┐│    │
 *   │   │  ┌─ trim (= art) ───────────────┐ ││    │
 *   │   │  │          design              │ ││    │
 *   │   │  └──────────────────────────────┘ ││    │
 *   │   └───────────────────────────────────┘│    │
 *   │      ▭▭▭▭ colour bar      registration ╵    │
 *   └─────────────────────────────────────────────┘
 *
 * All coordinates are TOP-LEFT origin, in PostScript points (1/72"), matching
 * `drawHtmlVectors`/jsPDF. A pdf-lib consumer flips y (bottom-left origin).
 */

// Fixed, print-standard mark metrics (points). Not user-exposed in v1.
export const PRINT_MARK_DEFAULTS = {
  bleed: '3mm',        // default bleed amount (a dimension string; see units.js)
  markLengthPt: 18,    // crop / bleed tick length (~0.25")
  markStrokePt: 0.5,   // hairline stroke for all line marks
  markReachPt: 30,     // margin band beyond the bleed that holds the marks
  regRadiusPt: 6,      // registration target circle radius
  regCrossPt: 11,      // registration crosshair half-length (overshoots the circle)
  barCellPt: 14,       // colour-bar cell size (square)
};

// Colour-bar cells as CMYK (0–1): the four process primaries, the three
// two-colour overprints, and a black tint ramp. The RGB equivalent for the
// RGB-PDF path is derived per cell (see cmykToRgbApprox).
const COLOR_BAR_CELLS = [
  [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1],
  [1, 1, 0, 0], [1, 0, 1, 0], [0, 1, 1, 0],
  [0, 0, 0, 0.25], [0, 0, 0, 0.5], [0, 0, 0, 0.75],
];

/** Naive DeviceCMYK→RGB (0–1) for previewing bar inks in the RGB PDF path. */
export function cmykToRgbApprox([c, m, y, k]) {
  return [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
}

/**
 * Compute the page geometry and mark primitives for a print PDF.
 *
 * @param {object} o
 * @param {number} o.trimWpt  trim (design) width in points
 * @param {number} o.trimHpt  trim (design) height in points
 * @param {number} [o.bleedPt=0]  bleed on each edge, in points
 * @param {object} [o.marks]   { crop, registration, bleed, colorBars } booleans
 * @returns {{
 *   page: {w:number,h:number},
 *   boxes: { media:Box, bleed:Box, trim:Box },   // Box = {x,y,w,h}, top-left pt
 *   artwork: Box,                                // where the design is drawn (= bleed box)
 *   strokeWeight: number,                        // pt, for line/circle marks
 *   primitives: {
 *     lines:   Array<{x1,y1,x2,y2,mark}>,        // crop | bleed | registration
 *     circles: Array<{cx,cy,r,mark}>,            // registration (stroked)
 *     bars:    Array<{x,y,w,h,cmyk,rgb,mark}>,   // colorbar (filled)
 *   }
 * }}
 */
export function computePrintGeometry({ trimWpt, trimHpt, bleedPt = 0, marks = {} }) {
  const m = { crop: false, registration: false, bleed: false, colorBars: false, ...marks };
  const { markLengthPt: L, markReachPt: R, regRadiusPt: rr, regCrossPt: rc, barCellPt: bc } = PRINT_MARK_DEFAULTS;

  const anyMark = m.crop || m.registration || m.bleed || m.colorBars;
  const reach = anyMark ? R : 0;            // margin band beyond the bleed for marks
  const M = bleedPt + reach;                // total margin on each edge
  const pageW = trimWpt + 2 * M;
  const pageH = trimHpt + 2 * M;

  const trim  = { x: M, y: M, w: trimWpt, h: trimHpt };
  const bleed = { x: M - bleedPt, y: M - bleedPt, w: trimWpt + 2 * bleedPt, h: trimHpt + 2 * bleedPt };
  const media = { x: 0, y: 0, w: pageW, h: pageH };

  // Edge coordinates.
  const trimL = trim.x, trimT = trim.y, trimR = trim.x + trim.w, trimB = trim.y + trim.h;
  const bL = bleed.x, bT = bleed.y, bR = bleed.x + bleed.w, bB = bleed.y + bleed.h;

  const lines = [], circles = [], bars = [];
  const line = (x1, y1, x2, y2, mark) => lines.push({ x1, y1, x2, y2, mark });

  // Crop (trim) marks — ticks aligned to the trim edges, sitting beyond the bleed.
  if (m.crop) {
    // verticals at the trim left/right; horizontals at the trim top/bottom.
    line(trimL, bT, trimL, bT - L, 'crop');  line(bL, trimT, bL - L, trimT, 'crop'); // TL
    line(trimR, bT, trimR, bT - L, 'crop');  line(bR, trimT, bR + L, trimT, 'crop'); // TR
    line(trimL, bB, trimL, bB + L, 'crop');  line(bL, trimB, bL - L, trimB, 'crop'); // BL
    line(trimR, bB, trimR, bB + L, 'crop');  line(bR, trimB, bR + L, trimB, 'crop'); // BR
  }

  // Bleed marks — ticks aligned to the bleed edges (offset from the crop marks).
  if (m.bleed && bleedPt > 0) {
    line(bL, bT, bL, bT - L, 'bleed');  line(bL, bT, bL - L, bT, 'bleed'); // TL
    line(bR, bT, bR, bT - L, 'bleed');  line(bR, bT, bR + L, bT, 'bleed'); // TR
    line(bL, bB, bL, bB + L, 'bleed');  line(bL, bB, bL - L, bB, 'bleed'); // BL
    line(bR, bB, bR, bB + L, 'bleed');  line(bR, bB, bR + L, bB, 'bleed'); // BR
  }

  // Registration targets — bullseye + crosshair, centred on each side's margin.
  if (m.registration) {
    const reg = (cx, cy) => {
      circles.push({ cx, cy, r: rr, mark: 'registration' });
      line(cx, cy - rc, cx, cy + rc, 'registration');
      line(cx - rc, cy, cx + rc, cy, 'registration');
    };
    const midX = pageW / 2, midY = pageH / 2, half = reach / 2;
    reg(midX, bT - half);   // top
    reg(midX, bB + half);   // bottom
    reg(bL - half, midY);   // left
    reg(bR + half, midY);   // right
  }

  // Colour bar — a row of process/overprint/tint cells, left-aligned in the
  // bottom margin so it clears the centred bottom registration target.
  if (m.colorBars) {
    const y = bB + reach / 2 - bc / 2;
    const maxX = m.registration ? (pageW / 2 - rc - 6) : (pageW - M);
    let x = trimL;
    for (const cmyk of COLOR_BAR_CELLS) {
      if (x + bc > maxX) break;            // ran out of room before the centre mark
      bars.push({ x, y, w: bc, h: bc, cmyk, rgb: cmykToRgbApprox(cmyk), mark: 'colorbar' });
      x += bc;
    }
  }

  return {
    page: { w: pageW, h: pageH },
    boxes: { media, bleed, trim },
    artwork: { ...bleed },
    strokeWeight: PRINT_MARK_DEFAULTS.markStrokePt,
    primitives: { lines, circles, bars },
  };
}

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
  barPairGapPt: 6,     // gap between brand RGB/CMYK swatch pairs
  barGroupGapPt: 18,   // wider gap between the process primaries and the brand pairs
  barMaxCells: 12,     // flat ceiling on brand colour-bar cells (width is the real cap)
  labelSizePt: 6,      // provenance / credit text size (points)
  labelInsetPt: 5,     // provenance text inset from the page edge
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
 * @param {object} [o.marks]   { crop, registration, bleed, colorBars, provenance } booleans
 * @param {Array<{rgb:number[],cmyk:number[],label?:string}>} [o.palette]
 *   Brand swatches (rgb & cmyk both 0–1). When supplied with colorBars, the bar
 *   becomes one RGB reference cell beside its CMYK substitution per colour, so a
 *   press operator can confirm the RGB→CMYK swap and calibrate against known
 *   inks. Empty → the generic process/overprint/tint control bar.
 * @returns {{
 *   page: {w:number,h:number},
 *   boxes: { media:Box, bleed:Box, trim:Box },   // Box = {x,y,w,h}, top-left pt
 *   artwork: Box,                                // where the design is drawn (= bleed box)
 *   strokeWeight: number,                        // pt, for line/circle marks
 *   primitives: {
 *     lines:   Array<{x1,y1,x2,y2,mark}>,                  // crop | bleed | registration
 *     circles: Array<{cx,cy,r,mark}>,                      // registration (stroked)
 *     bars:    Array<{x,y,w,h,cmyk,rgb,ink,label,mark}>,   // colorbar (filled); ink = rgb|cmyk|page
 *     labels:  Array<{slot,x,y,size,rotation,align,mark}>, // provenance anchors; shell supplies the text
 *   }
 * }}
 */
export function computePrintGeometry({ trimWpt, trimHpt, bleedPt = 0, marks = {}, palette = [] }) {
  const m = { crop: false, registration: false, bleed: false, colorBars: false, provenance: false, ...marks };
  const { markLengthPt: L, markReachPt: R, regRadiusPt: rr, regCrossPt: rc, barCellPt: bc, barPairGapPt: bg, barGroupGapPt: bgap, barMaxCells: bmax, labelSizePt: ls, labelInsetPt: li } = PRINT_MARK_DEFAULTS;

  const anyMark = m.crop || m.registration || m.bleed || m.colorBars || m.provenance;
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

  const lines = [], circles = [], bars = [], labels = [];
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

  // Colour bar — a row of cells left-aligned in the bottom margin so it clears
  // the centred bottom registration target. Two modes:
  //  • Brand palette supplied → a verification bar: the four solid process
  //    primaries (C, M, Y, K) for the press to calibrate against, a wider gap,
  //    then each brand colour as an RGB reference swatch touching its CMYK
  //    substitution so the RGB→CMYK swap is visible to check.
  //  • No palette → the generic process/overprint/tint control bar.
  // Capped by the available margin width (the real limit) and a flat ceiling.
  if (m.colorBars) {
    const y = bB + reach / 2 - bc / 2;
    const maxX = m.registration ? (pageW / 2 - rc - 6) : (pageW - M);
    let x = trimL;
    if (palette.length) {
      // Solid process primaries first — fixed calibration reference, DeviceCMYK
      // on the cmyk plate (the first four COLOR_BAR_CELLS are C, M, Y, K).
      for (const cmyk of COLOR_BAR_CELLS.slice(0, 4)) {
        if (x + bc > maxX) break;
        bars.push({ x, y, w: bc, h: bc, cmyk, rgb: cmykToRgbApprox(cmyk), ink: 'cmyk', mark: 'colorbar' });
        x += bc;
      }
      if (bars.length) x += bgap;                  // wider gap before the brand pairs
      // Brand pairs — RGB reference cell touching its CMYK substitution. Capped
      // on brand cells only (the process primaries above are always kept).
      let brandCells = 0;
      for (const { rgb, cmyk, label } of palette) {
        if (brandCells + 2 > bmax) break;          // flat ceiling on brand cells
        if (x + 2 * bc > maxX) break;              // no room for the pair before the centre mark
        bars.push({ x,        y, w: bc, h: bc, cmyk, rgb, ink: 'rgb',  label, mark: 'colorbar' });
        bars.push({ x: x + bc, y, w: bc, h: bc, cmyk, rgb, ink: 'cmyk', label, mark: 'colorbar' });
        x += 2 * bc + bg;                          // gap separates one colour's pair from the next
        brandCells += 2;
      }
    } else {
      for (const cmyk of COLOR_BAR_CELLS) {
        if (bars.length >= bmax) break;
        if (x + bc > maxX) break;                  // ran out of room before the centre mark
        bars.push({ x, y, w: bc, h: bc, cmyk, rgb: cmykToRgbApprox(cmyk), ink: 'page', mark: 'colorbar' });
        x += bc;
      }
    }
  }

  // Provenance labels — small credit text living in the proof margin (the white
  // reach band; trimmed off at the final cut, like the marks). Anchors only: the
  // engine fixes where/orientation, the shell supplies the strings and measures
  // them for right-alignment. `align` is along the (post-rotation) baseline.
  if (m.provenance && reach > 0) {
    // Top edge, horizontal, baselines near the page top (above the crop ticks,
    // clear of the centred top mark): the timestamp left-aligned at the artwork
    // (bleed) left edge, the platform credit right-aligned at the right edge.
    labels.push({ slot: 'topLeft',  x: bL, y: li + ls, size: ls, rotation: 0, align: 'left',  mark: 'label' });
    labels.push({ slot: 'topRight', x: bR, y: li + ls, size: ls, rotation: 0, align: 'right', mark: 'label' });
    // Bottom-left, reading upward (90° CCW): starts low in the left margin band
    // and climbs — the conventional spot for a tool/author credit.
    labels.push({ slot: 'bottomLeftUp', x: reach / 2, y: bB, size: ls, rotation: 90, align: 'left', mark: 'label' });
  }

  return {
    page: { w: pageW, h: pageH },
    boxes: { media, bleed, trim },
    artwork: { ...bleed },
    strokeWeight: PRINT_MARK_DEFAULTS.markStrokePt,
    primitives: { lines, circles, bars, labels },
  };
}

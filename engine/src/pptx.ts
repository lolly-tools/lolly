// SPDX-License-Identifier: MPL-2.0
/**
 * PPTX (PowerPoint / OOXML) builder — pure, DOM-free, platform-agnostic.
 *
 * A .pptx is a ZIP of XML parts. This module owns the OOXML *scaffolding* (content
 * types, relationships, a minimal slide master + blank layout + theme,
 * presentation.xml, per-slide XML, docProps) and serializes each slide's SHAPES to
 * DrawingML. The shell walks the DOM into shapes + media and zips the returned parts
 * with fflate; the engine never touches a DOM.
 *
 * The point of the format (per its use): TRANSPORT the page's treated images and
 * vectors into PowerPoint so a user can pull each one out at full fidelity — layout
 * is secondary. So a slide is a set of independent, extractable objects:
 *   • pic  — a raster image at native resolution (extract the real photo), OR a
 *            VECTOR embedded as a real SVG via PowerPoint's asvg:svgBlip extension
 *            (a PNG fallback blip + the .svg itself — modern PowerPoint renders the
 *            SVG and can even "Convert to Shape"; old viewers show the PNG).
 *   • text — a native, editable text box (font size / colour / weight / align).
 *   • rect — a solid/gradient block or border (light layout context).
 *
 * A PPTX has a SINGLE deck-wide slide size (p:sldSz); the shell sizes it from page 0.
 *
 * Two namespace traps (both handled): the .rels CONTAINER ns is
 * …/package/2006/relationships, NOT the …/officeDocument/… Type base; and the SVG
 * blip extension needs the fixed Microsoft ext GUID. Fully node:test-able — returns
 * strings + byte arrays, no zip, no DOM, no deps.
 */

export const EMU_PER_INCH = 914400;
export const EMU_PER_PX = EMU_PER_INCH / 96; // CSS px at the 96-DPI convention

// ─── Shape model (all geometry in EMU; the shell converts px → EMU) ─────────────
export type PptxFill =
  | { solid: string; alpha?: number }
  | { grad: Array<{ pos: number; color: string; alpha?: number }>; angle: number };

export interface PptxRun {
  text: string; sizePt: number; color?: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; font?: string;
  /** Internal hyperlink: jump to another slide by 0-based index (an agenda/ToC link).
   *  buildPptxParts emits the `a:hlinkClick` + a slide→slide relationship for it. */
  linkSlide?: number;
}
/** A paragraph. `align`/`runs` are the original contract; the rest are additive rich-text
 *  controls (bullets, indent level, spacing) and are all optional — a bare
 *  `{ runs, align }` serializes byte-for-byte as it did before they existed.
 *  `bullet`: omitted/undefined = inherit (no marker on a plain text box); `false` = force
 *  none (`<a:buNone/>`); `true` = a filled round bullet; `'number'` = auto arabic numbering;
 *  `{ char }` = a custom glyph. `level` is a 0-based indent depth (0–8). */
export interface PptxPara {
  runs: PptxRun[];
  align?: 'l' | 'ctr' | 'r' | 'just';
  level?: number;
  bullet?: boolean | 'number' | { char?: string };
  /** Line spacing as a PERCENT — 100 = single, 150 = 1.5×. (Not a fraction: 1.5 clamps to 1%.) */
  lineSpacingPct?: number;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
}

export interface PptxRect { kind: 'rect'; x: number; y: number; cx: number; cy: number; rot?: number; fill?: PptxFill; line?: { color: string; w: number }; radius?: number; }
export interface PptxText { kind: 'text'; x: number; y: number; cx: number; cy: number; rot?: number; paras: PptxPara[]; anchor?: 't' | 'ctr' | 'b'; }
/** A picture. `media` is the index (into the slide's media[]) of the raster blip;
 *  `svg`, when set, is the index of an .svg part embedded via svgBlip (media is then
 *  the PNG fallback). */
export interface PptxPic {
  kind: 'pic'; x: number; y: number; cx: number; cy: number; rot?: number; media: number; svg?: number; name?: string;
  /** Source crop (object-fit:cover), as fractions 0..1 cropped off each edge — the
   *  blip stays the full image (un-croppable in PowerPoint), only the view is cropped. */
  srcRect?: { l?: number; t?: number; r?: number; b?: number };
}
/** A cell border edge (colour + width in EMU). */
export interface PptxLine { color: string; w: number; }
/** One table cell. Content is either `paras` (full rich-text model) or the `text`
 *  shorthand (a single run styled by the `bold`/`color`/`sizePt`/`font` shorthands).
 *  `colSpan`/`rowSpan` > 1 merge to the right/down; the covered grid positions are
 *  filled with hMerge/vMerge markers automatically — the author supplies only the
 *  visible (origin) cells per row, never the swallowed ones. */
export interface PptxTableCell {
  paras?: PptxPara[];
  text?: string;
  fill?: string;
  align?: 'l' | 'ctr' | 'r' | 'just';
  anchor?: 't' | 'ctr' | 'b';
  colSpan?: number;
  rowSpan?: number;
  bold?: boolean; color?: string; sizePt?: number; font?: string;
  margin?: number;
  borders?: { l?: PptxLine; r?: PptxLine; t?: PptxLine; b?: PptxLine };
}
/** A native (editable) PowerPoint table — an inline `a:tbl` inside a `p:graphicFrame`,
 *  needing NO extra parts, rels, or content types. `cols` (per-column widths in EMU)
 *  defines the grid every row is padded/clamped to. */
export interface PptxTable {
  kind: 'table';
  x: number; y: number; cx: number; cy: number;
  cols: number[];
  rows: Array<{ h?: number; cells: PptxTableCell[] }>;
  firstRow?: boolean;
  styleId?: string;
}
export type PptxShape = PptxRect | PptxText | PptxPic | PptxTable;

export interface PptxMedia { bytes: Uint8Array; ext: 'png' | 'jpeg' | 'emf' | 'svg'; }
/** `notes` is the slide's speaker note (PowerPoint's Notes pane). Blank/absent =>
 *  no notes parts are emitted for this slide at all (see buildPptxParts). */
export interface PptxSlide { shapes: PptxShape[]; media: PptxMedia[]; notes?: string; }

/** A DrawingML theme expressed as plain VALUES — the shell resolves the active brand's
 *  design tokens into these hexes + font names and passes them down; the engine never
 *  reads tokens, the DOM, or a brand pack. Any field omitted falls back to the neutral
 *  default scheme (see themeXml), so a partial theme is fine. Colours are `#rrggbb` or
 *  bare `rrggbb`. */
export interface PptxTheme {
  name?: string;
  colors?: {
    dk1?: string; lt1?: string; dk2?: string; lt2?: string;
    accent1?: string; accent2?: string; accent3?: string; accent4?: string; accent5?: string; accent6?: string;
    hlink?: string; folHlink?: string;
  };
  fonts?: { major?: string; minor?: string };
}

export interface PptxBuildOpts {
  emuW?: number;
  emuH?: number;
  meta?: { title?: string; description?: string; source?: string; contact?: string } | null;
  now?: string;
  /** Brand theme (values only). Threads into theme1.xml (+ the notes theme2.xml). */
  theme?: PptxTheme;
}

// ─── low-level helpers ──────────────────────────────────────────────────────────
// Strip the chars ILLEGAL in XML 1.0's Char production BEFORE entity-escaping — the C0
// controls (below U+0020 except tab/LF/CR) plus the non-characters U+FFFE/U+FFFF. A stray
// one in user run text, a custom bullet glyph, or a speaker note is a hard parse-fail
// (PowerPoint repair), so drop them at the single chokepoint every text value flows through.
const xmlEsc = (s: string): string =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
// Fixed GUID that flags a blip's SVG companion (Office 2016+ SVG-in-Office feature).
const SVG_EXT_URI = '{96DAC541-7B7A-43D3-8B79-37D633B846F1}';

const MEDIA_CT: Record<PptxMedia['ext'], string> = {
  emf: 'image/x-emf', png: 'image/png', jpeg: 'image/jpeg', svg: 'image/svg+xml',
};
const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));
// A finite rounded integer, or `fallback` for NaN/±Infinity — geometry that reaches an
// XML attribute must never be the literal "NaN" (schema-invalid → PowerPoint repair).
// Authored models (the tool path) can carry non-finite numbers; the DOM walker can't.
const finInt = (v: number, fallback = 0): number => (Number.isFinite(v) ? Math.round(v) : fallback);

// srgbClr, self-closing unless an alpha child is needed.
function clr(hex: string, alpha?: number): string {
  const v = (hex || '#000000').replace('#', '').slice(0, 6).toUpperCase().padStart(6, '0');
  if (alpha != null && alpha < 1) return `<a:srgbClr val="${v}"><a:alpha val="${clampInt(alpha * 100000, 0, 100000)}"/></a:srgbClr>`;
  return `<a:srgbClr val="${v}"/>`;
}

function fillXml(fill?: PptxFill): string {
  if (!fill) return '<a:noFill/>';
  if ('solid' in fill) return `<a:solidFill>${clr(fill.solid, fill.alpha)}</a:solidFill>`;
  const stops = fill.grad.map(s => `<a:gs pos="${clampInt((s.pos ?? 0) * 100000, 0, 100000)}">${clr(s.color, s.alpha)}</a:gs>`).join('');
  // CSS angle (0 = to-top, clockwise) → DrawingML ang (0 = left→right, clockwise, 60000ths).
  const ang = ((Math.round(fill.angle) - 90) % 360 + 360) % 360;
  return `<a:gradFill><a:gsLst>${stops}</a:gsLst><a:lin ang="${ang * 60000}" scaled="1"/></a:gradFill>`;
}

const lineXml = (line?: { color: string; w: number }): string =>
  line ? `<a:ln w="${Math.max(0, Math.round(line.w))}"><a:solidFill>${clr(line.color)}</a:solidFill></a:ln>` : '';

const xfrmXml = (s: { x: number; y: number; cx: number; cy: number; rot?: number }): string =>
  `<a:xfrm${s.rot ? ` rot="${Math.round(((s.rot % 360) + 360) % 360 * 60000)}"` : ''}>` +
  `<a:off x="${Math.round(s.x)}" y="${Math.round(s.y)}"/><a:ext cx="${Math.max(1, Math.round(s.cx))}" cy="${Math.max(1, Math.round(s.cy))}"/></a:xfrm>`;

function geomXml(radius?: number, cx = 0, cy = 0): string {
  if (radius && radius > 0) {
    const adj = clampInt(radius / Math.max(1, Math.min(cx, cy)) * 100000, 0, 50000);
    return `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst></a:prstGeom>`;
  }
  return `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`;
}

function rectXml(r: PptxRect, id: number): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="rect${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr>${xfrmXml(r)}${geomXml(r.radius, r.cx, r.cy)}${fillXml(r.fill)}${lineXml(r.line)}</p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
}

// Set by buildPptxParts around each slide's serialization (synchronous + sequential, so a
// module var is safe): maps a run's linkSlide target → the slide-jump relationship id.
let slideLinkRid: ((target: number) => string | undefined) | null = null;

function runXml(run: PptxRun): string {
  const u = run.underline ? ' u="sng"' : '';
  const strike = run.strike ? ' strike="sngStrike"' : '';
  const attrs = `lang="en-US" sz="${clampInt(run.sizePt * 100, 100, 400000)}" b="${run.bold ? 1 : 0}" i="${run.italic ? 1 : 0}"${u}${strike} dirty="0"`;
  const fill = run.color ? `<a:solidFill>${clr(run.color)}</a:solidFill>` : '';
  const font = run.font ? `<a:latin typeface="${xmlEsc(run.font)}"/><a:cs typeface="${xmlEsc(run.font)}"/>` : '';
  // hlinkClick sits after latin/cs in CT_TextCharacterProperties; the ppaction marks it an
  // internal slide jump rather than an external URL.
  const rid = run.linkSlide != null && slideLinkRid ? slideLinkRid(run.linkSlide) : undefined;
  const hlink = rid ? `<a:hlinkClick r:id="${rid}" action="ppaction://hlinksldjump"/>` : '';
  return `<a:r><a:rPr ${attrs}>${fill}${font}${hlink}</a:rPr><a:t>${xmlEsc(run.text)}</a:t></a:r>`;
}

// EMU per indent level for bullets: PowerPoint's default outline step (~0.3").
const BULLET_STEP = 342900;
// a:pPr — attributes then children, both in strict schema order. A paragraph carrying
// only `align` still yields exactly `<a:pPr algn="…"/>` (the pre-rich-text shape), so
// existing callers are byte-for-byte unchanged.
function paraXml(p: PptxPara): string {
  const lvl = p.level && p.level > 0 ? Math.min(8, Math.round(p.level)) : 0;
  const hasBullet = p.bullet === true || p.bullet === 'number' || (typeof p.bullet === 'object' && p.bullet != null);
  const attrs: string[] = [];
  // Attributes in CT_TextParagraphProperties document order (marL, lvl, indent, algn) —
  // XML treats attribute order as insignificant, but matching the schema keeps the
  // output identical to what real PowerPoint writes. A bulleted line hangs its text past
  // the marker (negative indent); a plain out-dented line just shifts its left margin.
  if (hasBullet) attrs.push(`marL="${(lvl + 1) * BULLET_STEP}"`);
  else if (lvl > 0) attrs.push(`marL="${lvl * BULLET_STEP}"`);
  if (lvl > 0) attrs.push(`lvl="${lvl}"`);
  if (hasBullet) attrs.push(`indent="-${BULLET_STEP}"`);
  if (p.align) attrs.push(`algn="${p.align}"`);
  let kids = '';
  if (p.lineSpacingPct && p.lineSpacingPct > 0) kids += `<a:lnSpc><a:spcPct val="${clampInt(p.lineSpacingPct * 1000, 1000, 1000000)}"/></a:lnSpc>`;
  if (p.spaceBeforePt && p.spaceBeforePt > 0) kids += `<a:spcBef><a:spcPts val="${clampInt(p.spaceBeforePt * 100, 0, 158400)}"/></a:spcBef>`;
  if (p.spaceAfterPt && p.spaceAfterPt > 0) kids += `<a:spcAft><a:spcPts val="${clampInt(p.spaceAfterPt * 100, 0, 158400)}"/></a:spcAft>`;
  if (hasBullet) {
    if (p.bullet === 'number') kids += `<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>`;
    else {
      const ch = typeof p.bullet === 'object' && p.bullet && p.bullet.char ? p.bullet.char : '•';
      kids += `<a:buFont typeface="Arial"/><a:buChar char="${xmlEsc(ch)}"/>`;
    }
  } else if (p.bullet === false) {
    kids += `<a:buNone/>`;
  }
  const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';
  const pPr = attrs.length || kids ? (kids ? `<a:pPr${attrStr}>${kids}</a:pPr>` : `<a:pPr${attrStr}/>`) : '';
  return `<a:p>${pPr}${p.runs.map(runXml).join('')}</a:p>`;
}
function textXml(t: PptxText, id: number): string {
  // noAutofit keeps the box at its authored geometry (matches the DOM box) so text
  // sits where the layout put it — spAutoFit grew boxes and overlapped neighbours.
  const body = `<a:bodyPr wrap="square" anchor="${t.anchor ?? 't'}" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>`;
  const paras = t.paras.length ? t.paras.map(paraXml).join('') : '<a:p/>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="text${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr>${xfrmXml(t)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody>${body}<a:lstStyle/>${paras}</p:txBody></p:sp>`;
}

// media index → relationship id (rId1 is the slide layout).
const mediaRid = (i: number): string => `rId${i + 2}`;
function picXml(p: PptxPic, id: number): string {
  const blip = p.svg != null
    ? `<a:blip r:embed="${mediaRid(p.media)}"><a:extLst><a:ext uri="${SVG_EXT_URI}">` +
      `<asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${mediaRid(p.svg)}"/></a:ext></a:extLst></a:blip>`
    : `<a:blip r:embed="${mediaRid(p.media)}"/>`;
  const pct = (v?: number): string => v && v > 0 ? String(clampInt(v * 100000, 0, 99000)) : '0';
  const sr = p.srcRect;
  const srcRect = sr && (sr.l || sr.t || sr.r || sr.b)
    ? `<a:srcRect l="${pct(sr.l)}" t="${pct(sr.t)}" r="${pct(sr.r)}" b="${pct(sr.b)}"/>` : '';
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${xmlEsc(p.name ?? `pic${id}`)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill>${blip}${srcRect}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr>${xfrmXml(p)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

// ─── native table (a:tbl) ─────────────────────────────────────────────────────
// A table is inline DrawingML in the spTree — a p:graphicFrame wrapping a:tbl. It
// needs NO extra part, relationship, or content-type entry (unlike a chart). Built-in
// table-style GUID: "Medium Style 2 – Accent 1" (what PowerPoint applies to a new
// table). srgbClr, EMU, strict child order throughout — see buildTableGrid for how
// author-supplied origin cells become a rectangular hMerge/vMerge grid.
const DEFAULT_TABLE_STYLE = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';

type TcSlot =
  | { kind: 'origin'; cell: PptxTableCell; gridSpan: number; rowSpan: number }
  | { kind: 'hmerge' }
  | { kind: 'vmerge' }
  | { kind: 'hvmerge' };

// Non-finite / < 1 span → 1 (an authored model can carry NaN or a hostile huge span).
const spanOf = (v: number | undefined): number => (Number.isFinite(v) && (v as number) > 1 ? Math.floor(v as number) : 1);

// Place each row's visible (origin) cells left-to-right, skipping positions already
// covered by a span from above/left, and stamp the covered positions with merge markers
// so every row ends up exactly `nCols` cells wide (the grid MUST stay rectangular —
// gridCol count == tc-per-row count, or PowerPoint repairs). A span is clamped to the
// run of consecutive FREE cells (not just the grid edge), and every stamp is guarded
// against overwriting an existing marker — so a lower row's colSpan can never clobber an
// upper row's rowSpan into a contradictory hMerge+vMerge cell.
function buildTableGrid(nCols: number, rows: PptxTable['rows']): TcSlot[][] {
  const nRows = rows.length;
  const grid: (TcSlot | null)[][] = Array.from({ length: nRows }, () => Array<TcSlot | null>(nCols).fill(null));
  for (let r = 0; r < nRows; r++) {
    let c = 0;
    for (const cell of rows[r]!.cells) {
      while (c < nCols && grid[r]![c] !== null) c++;
      if (c >= nCols) break;
      // Horizontal span: shrink to the free run to this cell's right.
      let cs = Math.min(spanOf(cell.colSpan), nCols - c);
      for (let dc = 1; dc < cs; dc++) if (grid[r]![c + dc] !== null) { cs = dc; break; }
      // Vertical span: descend only while the whole cs-wide block stays free.
      let rs = Math.min(spanOf(cell.rowSpan), nRows - r);
      rows: for (let dr = 1; dr < rs; dr++) {
        for (let dc = 0; dc < cs; dc++) if (grid[r + dr]![c + dc] !== null) { rs = dr; break rows; }
      }
      grid[r]![c] = { kind: 'origin', cell, gridSpan: cs, rowSpan: rs };
      for (let dr = 0; dr < rs; dr++)
        for (let dc = 0; dc < cs; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (grid[r + dr]![c + dc] !== null) continue;
          const hm = dc > 0, vm = dr > 0;
          grid[r + dr]![c + dc] = { kind: hm && vm ? 'hvmerge' : hm ? 'hmerge' : 'vmerge' };
        }
      c += cs;
    }
    for (let cc = 0; cc < nCols; cc++) if (grid[r]![cc] === null) grid[r]![cc] = { kind: 'origin', cell: {}, gridSpan: 1, rowSpan: 1 };
  }
  return grid as TcSlot[][];
}

const EMPTY_TXBODY = '<a:txBody><a:bodyPr/><a:lstStyle/><a:p/></a:txBody>';

function cellTxBody(cell: PptxTableCell): string {
  const paras: PptxPara[] = cell.paras && cell.paras.length
    ? cell.paras
    : [{ runs: cell.text ? [{ text: cell.text, sizePt: cell.sizePt ?? 12, bold: cell.bold, color: cell.color, font: cell.font }] : [], align: cell.align }];
  const body = paras.map(paraXml).join('') || '<a:p/>';
  return `<a:txBody><a:bodyPr/><a:lstStyle/>${body}</a:txBody>`;
}

const lnSideXml = (tag: string, line?: PptxLine): string =>
  line ? `<a:${tag} w="${Math.max(0, Math.round(line.w))}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill>${clr(line.color)}</a:solidFill></a:${tag}>` : '';

function tcPrXml(cell: PptxTableCell): string {
  const m = cell.margin != null ? Math.max(0, Math.round(cell.margin)) : null;
  const mar = m != null
    ? ` marL="${m}" marR="${m}" marT="${Math.round(m * 0.5)}" marB="${Math.round(m * 0.5)}"`
    : ` marL="91440" marR="91440" marT="45720" marB="45720"`;
  const anchor = ` anchor="${cell.anchor ?? 'ctr'}"`;
  const b = cell.borders ?? {};
  // Child order is strict: all four borders (L,R,T,B) BEFORE the fill.
  const borders = lnSideXml('lnL', b.l) + lnSideXml('lnR', b.r) + lnSideXml('lnT', b.t) + lnSideXml('lnB', b.b);
  const fill = cell.fill ? `<a:solidFill>${clr(cell.fill)}</a:solidFill>` : '';
  return `<a:tcPr${mar}${anchor}>${borders}${fill}</a:tcPr>`;
}

function tcXml(slot: TcSlot): string {
  if (slot.kind !== 'origin') {
    const attr = slot.kind === 'hmerge' ? ' hMerge="1"' : slot.kind === 'vmerge' ? ' vMerge="1"' : ' hMerge="1" vMerge="1"';
    return `<a:tc${attr}>${EMPTY_TXBODY}<a:tcPr/></a:tc>`;
  }
  const span = slot.gridSpan > 1 ? ` gridSpan="${slot.gridSpan}"` : '';
  const rspan = slot.rowSpan > 1 ? ` rowSpan="${slot.rowSpan}"` : '';
  return `<a:tc${span}${rspan}>${cellTxBody(slot.cell)}${tcPrXml(slot.cell)}</a:tc>`;
}

// Guard rails on an authored table: bound the cell count so a hostile/typo'd model
// (100k×10k) can't OOM the grid allocation, and keep the derived column widths and the
// grid column-count in lockstep (else gridCol-count ≠ tc-count → repair).
export const MAX_TABLE_COLS = 128;
export const MAX_TABLE_ROWS = 512;

function tableXml(t: PptxTable, id: number): string {
  // Column widths drive nCols; an empty/degenerate cols[] synthesizes one column from
  // the frame width so tblGrid and every row still agree. Widths coerced finite (≥1).
  const rawCols = Array.isArray(t.cols) && t.cols.length ? t.cols : [t.cx];
  const colW = rawCols.slice(0, MAX_TABLE_COLS).map(w => Math.max(1, finInt(w, 914400)));
  const nCols = colW.length;
  const rows = (t.rows ?? []).slice(0, MAX_TABLE_ROWS);
  const grid = buildTableGrid(nCols, rows);
  const styleId = t.styleId ?? DEFAULT_TABLE_STYLE;
  const tblPr = `<a:tblPr firstRow="${t.firstRow ? 1 : 0}" bandRow="1"><a:tableStyleId>${styleId}</a:tableStyleId></a:tblPr>`;
  const tblGrid = `<a:tblGrid>${colW.map(w => `<a:gridCol w="${w}"/>`).join('')}</a:tblGrid>`;
  const fallbackH = Math.max(1, finInt((finInt(t.cy) || 0) / Math.max(1, rows.length))) || 370840;
  const trs = rows.map((row, r) => {
    const h = row.h != null ? Math.max(1, finInt(row.h, fallbackH)) : fallbackH;
    return `<a:tr h="${h}">${grid[r]!.map(tcXml).join('')}</a:tr>`;
  }).join('');
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="table${id}"/>` +
    `<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>` +
    `<p:xfrm><a:off x="${finInt(t.x)}" y="${finInt(t.y)}"/><a:ext cx="${Math.max(1, finInt(t.cx, 914400))}" cy="${Math.max(1, finInt(t.cy, 914400))}"/></p:xfrm>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">` +
    `<a:tbl>${tblPr}${tblGrid}${trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

function shapeXml(shape: PptxShape, id: number): string {
  switch (shape.kind) {
    case 'rect':  return rectXml(shape, id);
    case 'text':  return textXml(shape, id);
    case 'pic':   return picXml(shape, id);
    case 'table': return tableXml(shape, id);
  }
}

function slideXml(slide: PptxSlide): string {
  let id = 1;
  const shapes = slide.shapes.map(s => shapeXml(s, ++id)).join('');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr/>` +
    shapes +
    `</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>` +
    `</p:sld>`
  );
}

// Media file names are unique across the whole deck (slide#_media#) to avoid
// collisions in ppt/media; slideRels targets them by the same name.
const mediaName = (slideIdx: number, mediaIdx: number, ext: string): string => `image${slideIdx + 1}_${mediaIdx + 1}.${ext}`;

// The base rId for a slide's first slide-jump link relationship: past the layout (rId1),
// the media (rId2…), and the notesSlide (one more, when present).
const linkRidBase = (mediaCount: number, hasNotes: boolean): number => mediaCount + 2 + (hasNotes ? 1 : 0);

// Unique, sorted 0-based slide-jump targets referenced by a slide's TEXT runs (the agenda
// ToC case) — one slide→slide relationship is emitted per target.
function collectLinkTargets(slide: PptxSlide): number[] {
  const set = new Set<number>();
  for (const s of slide.shapes) {
    if (s.kind !== 'text') continue;
    for (const p of s.paras) for (const r of p.runs) if (typeof r.linkSlide === 'number' && Number.isFinite(r.linkSlide)) set.add(Math.trunc(r.linkSlide));
  }
  return [...set].sort((a, b) => a - b);
}

// slide rels: rId1 → layout, then one relationship per media entry (rId2, rId3, …), then —
// only when the slide carries a note — the notesSlide, then any slide-jump links (past all
// the above). A slide→slide relationship targets `slideM.xml` in the same folder.
function slideRelsXml(slideIdx: number, media: PptxMedia[], hasNotes = false, linkTargets: readonly number[] = []): string {
  let rels = `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`;
  media.forEach((m, i) => { rels += `<Relationship Id="${mediaRid(i)}" Type="${REL}/image" Target="../media/${mediaName(slideIdx, i, m.ext)}"/>`; });
  if (hasNotes) rels += `<Relationship Id="rId${media.length + 2}" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${slideIdx + 1}.xml"/>`;
  const base = linkRidBase(media.length, hasNotes);
  linkTargets.forEach((t, k) => { rels += `<Relationship Id="rId${base + k}" Type="${REL}/slide" Target="slide${t + 1}.xml"/>`; });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG_REL_NS}">${rels}</Relationships>`;
}

// ─── speaker notes ──────────────────────────────────────────────────────────────
// The slide→notesSlide relationship above is what binds a note to its slide; the
// notesSlide relates back to that slide and to the notes master. ECMA-376 §13.3.5
// lists the back-relationship as permitted rather than required — but every real
// producer emits it (round-trip one of these decks through LibreOffice and it adds
// the rel back), so match the convention rather than hand PowerPoint a part shape it
// sees from nobody else. The note text must live in the `body` placeholder:
// that ph, matched by type+idx to the master's, is what PowerPoint's Notes pane
// reads. A bare text box would render on the notes page but leave the pane empty.
function notesSlideXml(notes: string): string {
  const paras = notes.split(/\r?\n/)
    .map(line => `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${xmlEsc(line)}</a:t></a:r></a:p>`).join('');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
    `<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/>${paras || '<a:p/>'}</p:txBody></p:sp>` +
    `</p:spTree></p:cSld>` +
    `<p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>` +
    `</p:notes>`
  );
}

// notesSlide rels: rId1 → the slide it annotates, rId2 → the shared notes master.
function notesSlideRelsXml(slideIdx: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG_REL_NS}">` +
    `<Relationship Id="rId1" Type="${REL}/slide" Target="../slides/slide${slideIdx + 1}.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/notesMaster" Target="../notesMasters/notesMaster1.xml"/>` +
    `</Relationships>`;
}

// One master shared by every notesSlide, carrying the `body` ph the notes inherit
// from. Sized off the deck's own notesSz (page = notesH × notesW, see
// presentationXml) so the placeholder stays inside the page: notes text in the
// lower half, where the master's slide image would sit above it.
function notesMasterXml(notesW: number, notesH: number): string {
  const x = Math.round(notesW * 0.1), cx = Math.round(notesW * 0.8);
  const y = Math.round(notesH * 0.5), cy = Math.round(notesH * 0.4);
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
    `<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>` +
    `</p:spTree></p:cSld>` +
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
    `</p:notesMaster>`
  );
}

// Third namespace/rels trap: a theme part is 1:1 with a master — every real deck
// gives each slideMaster/notesMaster its OWN theme part, never a shared one, and
// pointing a notesMaster at the slideMaster's theme1 is a known PowerPoint repair
// trigger. So the notes master gets theme2.xml (same content as theme1).
const notesMasterRels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/theme" Target="../theme/theme2.xml"/></Relationships>`;

// notesMasterIdLst is NOT free-floating: CT_Presentation is an xsd:sequence, so it
// must sit between sldMasterIdLst and sldIdLst. Emitting it after sldIdLst (where
// it reads more naturally) makes the part schema-invalid → PowerPoint repairs.
function presentationXml(n: number, emuW: number, emuH: number, hasAnyNotes = false): string {
  let sldIds = '';
  for (let i = 0; i < n; i++) sldIds += `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`;
  const notesMasterIdLst = hasAnyNotes ? `<p:notesMasterIdLst><p:notesMasterId r:id="rId${n + 3}"/></p:notesMasterIdLst>` : '';
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    notesMasterIdLst +
    `<p:sldIdLst>${sldIds}</p:sldIdLst>` +
    `<p:sldSz cx="${emuW}" cy="${emuH}"/><p:notesSz cx="${emuH}" cy="${emuW}"/>` +
    `</p:presentation>`
  );
}

function presentationRelsXml(n: number, hasAnyNotes = false): string {
  let rels = `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>`;
  for (let i = 0; i < n; i++) rels += `<Relationship Id="rId${i + 2}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`;
  rels += `<Relationship Id="rId${n + 2}" Type="${REL}/theme" Target="theme/theme1.xml"/>`;
  if (hasAnyNotes) rels += `<Relationship Id="rId${n + 3}" Type="${REL}/notesMaster" Target="notesMasters/notesMaster1.xml"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG_REL_NS}">${rels}</Relationships>`;
}

function contentTypesXml(n: number, exts: Set<string>, notedIdxs: readonly number[] = []): string {
  const defaults = [
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`,
    `<Default Extension="xml" ContentType="application/xml"/>`,
  ];
  for (const e of exts) defaults.push(`<Default Extension="${e}" ContentType="${MEDIA_CT[e as PptxMedia['ext']]}"/>`);
  let overrides =
    `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`;
  for (let i = 0; i < n; i++) overrides += `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  if (notedIdxs.length) {
    overrides += `<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>` +
      `<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`;
    for (const i of notedIdxs) overrides += `<Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="${CT}">${defaults.join('')}${overrides}</Types>`;
}

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/>` +
  `<Relationship Id="rId2" Type="${REL}/metadata/core-properties" Target="docProps/core.xml"/>` +
  `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>` +
  `</Relationships>`;

function slideMasterXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>` +
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
    `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
    `</p:sldMaster>`
  );
}
const slideMasterRels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
  `<Relationship Id="rId2" Type="${REL}/theme" Target="../theme/theme1.xml"/></Relationships>`;

function slideLayoutXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">` +
    `<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>` +
    `<p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>` +
    `</p:sldLayout>`
  );
}
const slideLayoutRels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;

// Default scheme = the blank brand's spectrum (brands/lolly-start tokens: blue/green/
// amber at oklch(65% .12 h), hlink = primary ramp step 4). A caller-supplied PptxTheme
// (values the shell resolved from the active brand's tokens) overrides any field; the
// engine itself never reads a brand pack. hexNorm strips '#' and normalises to 6 upper.
const THEME_DEFAULT_COLORS: Required<NonNullable<PptxTheme['colors']>> = {
  dk1: '000000', lt1: 'FFFFFF', dk2: '44546A', lt2: 'E7E6E6',
  accent1: '5194D5', accent2: '4DA46B', accent3: 'B28727', accent4: 'EFEFEF',
  accent5: 'A0A0A0', accent6: '6B7280', hlink: '336699', folHlink: '6B7280',
};
const hexNorm = (v: string): string => v.replace('#', '').slice(0, 6).toUpperCase().padStart(6, '0');

function themeXml(theme?: PptxTheme): string {
  const col = { ...THEME_DEFAULT_COLORS };
  if (theme?.colors)
    for (const k of Object.keys(col) as Array<keyof typeof col>) {
      const v = theme.colors[k];
      if (v) col[k] = hexNorm(v);
    }
  const name = xmlEsc(theme?.name ?? 'Lolly');
  const majorFace = xmlEsc(theme?.fonts?.major ?? 'Calibri');
  const minorFace = xmlEsc(theme?.fonts?.minor ?? 'Calibri');
  const c = (n: string, hex: string) => `<a:${n}><a:srgbClr val="${hex}"/></a:${n}>`;
  const fontLst = (face: string) => `<a:latin typeface="${face}"/><a:ea typeface="${face}"/><a:cs typeface="${face}"/>`;
  const three = (inner: string) => inner + inner + inner;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${name}"><a:themeElements>` +
    `<a:clrScheme name="${name}">` + c('dk1', col.dk1) + c('lt1', col.lt1) + c('dk2', col.dk2) + c('lt2', col.lt2) +
    c('accent1', col.accent1) + c('accent2', col.accent2) + c('accent3', col.accent3) + c('accent4', col.accent4) +
    c('accent5', col.accent5) + c('accent6', col.accent6) + c('hlink', col.hlink) + c('folHlink', col.folHlink) + `</a:clrScheme>` +
    `<a:fontScheme name="${name}"><a:majorFont>${fontLst(majorFace)}</a:majorFont><a:minorFont>${fontLst(minorFace)}</a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="${name}">` +
    `<a:fillStyleLst>${three('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>')}</a:fillStyleLst>` +
    `<a:lnStyleLst>${three('<a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>')}</a:lnStyleLst>` +
    `<a:effectStyleLst>${three('<a:effectStyle><a:effectLst/></a:effectStyle>')}</a:effectStyleLst>` +
    `<a:bgFillStyleLst>${three('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>')}</a:bgFillStyleLst>` +
    `</a:fmtScheme></a:themeElements></a:theme>`
  );
}

function corePropsXml(meta: PptxBuildOpts['meta'], now: string): string {
  const title = xmlEsc(meta?.title ?? 'Presentation');
  const desc = [meta?.description, meta?.contact, meta?.source].filter(Boolean).map(String).join(' · ');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${title}</dc:title>` + (desc ? `<dc:description>${xmlEsc(desc)}</dc:description>` : '') +
    `<dc:creator>Lolly</dc:creator><cp:lastModifiedBy>Lolly</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    `</cp:coreProperties>`
  );
}
const appPropsXml = (n: number): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Lolly</Application><Slides>${n}</Slides><PresentationFormat>Custom</PresentationFormat></Properties>`;

/**
 * Build the full PPTX part tree from per-slide shapes + media. Returns a map of
 * archive path → bytes/string; the shell zips it with fflate.
 *
 * The notes parts (notesSlides + the shared notesMaster and its theme) are emitted
 * ONLY for slides carrying a non-blank `notes`; a deck with no notes anywhere is
 * byte-for-byte what it was before speaker notes existed.
 */
export function buildPptxParts(slides: PptxSlide[], opts: PptxBuildOpts = {}): Record<string, string | Uint8Array> {
  if (!slides.length) throw new Error('buildPptxParts: at least one slide is required');
  const emuW = Math.max(1, Math.round(opts.emuW ?? 1280 * EMU_PER_PX));
  const emuH = Math.max(1, Math.round(opts.emuH ?? 720 * EMU_PER_PX));
  const n = slides.length;
  const exts = new Set<string>();
  for (const s of slides) for (const m of s.media) exts.add(m.ext);
  const now = opts.now ?? '2026-01-01T00:00:00Z';
  // Slide indices that actually carry a note — drives every notes part below.
  const noted = slides.map((s, i) => ({ i, notes: (s.notes ?? '').trim() })).filter(x => x.notes !== '');
  const hasAnyNotes = noted.length > 0;

  const parts: Record<string, string | Uint8Array> = {
    '[Content_Types].xml': contentTypesXml(n, exts, noted.map(x => x.i)),
    '_rels/.rels': ROOT_RELS,
    'ppt/presentation.xml': presentationXml(n, emuW, emuH, hasAnyNotes),
    'ppt/_rels/presentation.xml.rels': presentationRelsXml(n, hasAnyNotes),
    'ppt/slideMasters/slideMaster1.xml': slideMasterXml(),
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': slideMasterRels,
    'ppt/slideLayouts/slideLayout1.xml': slideLayoutXml(),
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': slideLayoutRels,
    'ppt/theme/theme1.xml': themeXml(opts.theme),
    'docProps/core.xml': corePropsXml(opts.meta, now),
    'docProps/app.xml': appPropsXml(n),
  };
  slides.forEach((slide, i) => {
    const hasNotes = (slide.notes ?? '').trim() !== '';
    const targets = collectLinkTargets(slide);
    // Wire this slide's linkSlide targets → their relationship ids for the run serializer,
    // then clear it so a later slide can't inherit a stale map.
    if (targets.length) {
      const base = linkRidBase(slide.media.length, hasNotes);
      const map = new Map(targets.map((t, k) => [t, `rId${base + k}`] as const));
      slideLinkRid = t => map.get(t);
    }
    parts[`ppt/slides/slide${i + 1}.xml`] = slideXml(slide);
    slideLinkRid = null;
    parts[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = slideRelsXml(i, slide.media, hasNotes, targets);
    slide.media.forEach((m, j) => { parts[`ppt/media/${mediaName(i, j, m.ext)}`] = m.bytes; });
  });
  if (hasAnyNotes) {
    // Notes page = the deck's notesSz (presentationXml swaps the slide's axes).
    parts['ppt/notesMasters/notesMaster1.xml'] = notesMasterXml(emuH, emuW);
    parts['ppt/notesMasters/_rels/notesMaster1.xml.rels'] = notesMasterRels;
    parts['ppt/theme/theme2.xml'] = themeXml(opts.theme);
    for (const { i, notes } of noted) {
      parts[`ppt/notesSlides/notesSlide${i + 1}.xml`] = notesSlideXml(notes);
      parts[`ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`] = notesSlideRelsXml(i);
    }
  }
  return parts;
}

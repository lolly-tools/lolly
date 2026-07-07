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

export interface PptxRun { text: string; sizePt: number; color?: string; bold?: boolean; italic?: boolean; font?: string; }
export interface PptxPara { runs: PptxRun[]; align?: 'l' | 'ctr' | 'r' | 'just'; }

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
export type PptxShape = PptxRect | PptxText | PptxPic;

export interface PptxMedia { bytes: Uint8Array; ext: 'png' | 'jpeg' | 'emf' | 'svg'; }
export interface PptxSlide { shapes: PptxShape[]; media: PptxMedia[]; }

export interface PptxBuildOpts {
  emuW?: number;
  emuH?: number;
  meta?: { title?: string; description?: string; source?: string; contact?: string } | null;
  now?: string;
}

// ─── low-level helpers ──────────────────────────────────────────────────────────
const xmlEsc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
// Fixed GUID that flags a blip's SVG companion (Office 2016+ SVG-in-Office feature).
const SVG_EXT_URI = '{96DAC541-7B7A-43D3-8B79-37D633B846F1}';

const MEDIA_CT: Record<PptxMedia['ext'], string> = {
  emf: 'image/x-emf', png: 'image/png', jpeg: 'image/jpeg', svg: 'image/svg+xml',
};
const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));

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

function runXml(run: PptxRun): string {
  const attrs = `lang="en-US" sz="${clampInt(run.sizePt * 100, 100, 400000)}" b="${run.bold ? 1 : 0}" i="${run.italic ? 1 : 0}" dirty="0"`;
  const fill = run.color ? `<a:solidFill>${clr(run.color)}</a:solidFill>` : '';
  const font = run.font ? `<a:latin typeface="${xmlEsc(run.font)}"/><a:cs typeface="${xmlEsc(run.font)}"/>` : '';
  return `<a:r><a:rPr ${attrs}>${fill}${font}</a:rPr><a:t>${xmlEsc(run.text)}</a:t></a:r>`;
}
function paraXml(p: PptxPara): string {
  const pPr = p.align ? `<a:pPr algn="${p.align}"/>` : '';
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

function shapeXml(shape: PptxShape, id: number): string {
  switch (shape.kind) {
    case 'rect': return rectXml(shape, id);
    case 'text': return textXml(shape, id);
    case 'pic':  return picXml(shape, id);
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

// slide rels: rId1 → layout, then one relationship per media entry (rId2, rId3, …).
function slideRelsXml(slideIdx: number, media: PptxMedia[]): string {
  let rels = `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`;
  media.forEach((m, i) => { rels += `<Relationship Id="${mediaRid(i)}" Type="${REL}/image" Target="../media/${mediaName(slideIdx, i, m.ext)}"/>`; });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG_REL_NS}">${rels}</Relationships>`;
}

function presentationXml(n: number, emuW: number, emuH: number): string {
  let sldIds = '';
  for (let i = 0; i < n; i++) sldIds += `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    `<p:sldIdLst>${sldIds}</p:sldIdLst>` +
    `<p:sldSz cx="${emuW}" cy="${emuH}"/><p:notesSz cx="${emuH}" cy="${emuW}"/>` +
    `</p:presentation>`
  );
}

function presentationRelsXml(n: number): string {
  let rels = `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>`;
  for (let i = 0; i < n; i++) rels += `<Relationship Id="rId${i + 2}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`;
  rels += `<Relationship Id="rId${n + 2}" Type="${REL}/theme" Target="theme/theme1.xml"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG_REL_NS}">${rels}</Relationships>`;
}

function contentTypesXml(n: number, exts: Set<string>): string {
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

function themeXml(): string {
  const c = (n: string, hex: string) => `<a:${n}><a:srgbClr val="${hex}"/></a:${n}>`;
  const font = `<a:latin typeface="Calibri"/><a:ea typeface="Calibri"/><a:cs typeface="Calibri"/>`;
  const three = (inner: string) => inner + inner + inner;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Lolly"><a:themeElements>` +
    `<a:clrScheme name="Lolly">` + c('dk1', '000000') + c('lt1', 'FFFFFF') + c('dk2', '44546A') + c('lt2', 'E7E6E6') +
    c('accent1', '30BA78') + c('accent2', '2453FF') + c('accent3', 'FE7C3F') + c('accent4', 'EFEFEF') +
    c('accent5', 'A0A0A0') + c('accent6', '6B7280') + c('hlink', '2453FF') + c('folHlink', '6B7280') + `</a:clrScheme>` +
    `<a:fontScheme name="Lolly"><a:majorFont>${font}</a:majorFont><a:minorFont>${font}</a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="Lolly">` +
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
 */
export function buildPptxParts(slides: PptxSlide[], opts: PptxBuildOpts = {}): Record<string, string | Uint8Array> {
  if (!slides.length) throw new Error('buildPptxParts: at least one slide is required');
  const emuW = Math.max(1, Math.round(opts.emuW ?? 1280 * EMU_PER_PX));
  const emuH = Math.max(1, Math.round(opts.emuH ?? 720 * EMU_PER_PX));
  const n = slides.length;
  const exts = new Set<string>();
  for (const s of slides) for (const m of s.media) exts.add(m.ext);
  const now = opts.now ?? '2026-01-01T00:00:00Z';

  const parts: Record<string, string | Uint8Array> = {
    '[Content_Types].xml': contentTypesXml(n, exts),
    '_rels/.rels': ROOT_RELS,
    'ppt/presentation.xml': presentationXml(n, emuW, emuH),
    'ppt/_rels/presentation.xml.rels': presentationRelsXml(n),
    'ppt/slideMasters/slideMaster1.xml': slideMasterXml(),
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': slideMasterRels,
    'ppt/slideLayouts/slideLayout1.xml': slideLayoutXml(),
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': slideLayoutRels,
    'ppt/theme/theme1.xml': themeXml(),
    'docProps/core.xml': corePropsXml(opts.meta, now),
    'docProps/app.xml': appPropsXml(n),
  };
  slides.forEach((slide, i) => {
    parts[`ppt/slides/slide${i + 1}.xml`] = slideXml(slide);
    parts[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = slideRelsXml(i, slide.media);
    slide.media.forEach((m, j) => { parts[`ppt/media/${mediaName(i, j, m.ext)}`] = m.bytes; });
  });
  return parts;
}

// SPDX-License-Identifier: MPL-2.0
/**
 * PPTX (PowerPoint / OOXML) builder — pure, DOM-free, platform-agnostic.
 *
 * A .pptx is a ZIP of XML parts. This module owns the OOXML *scaffolding* — the
 * part tree a valid deck needs (content types, relationships, a minimal slide
 * master + one blank layout, presentation.xml, per-slide XML, docProps) — and
 * places ONE picture per slide filling the frame. The shell renders each page to a
 * picture (EMF vector, or a PNG fallback) and zips the returned parts with fflate;
 * the engine sees only image bytes + geometry, never the DOM.
 *
 * Design notes:
 *   • A PPTX has a SINGLE deck-wide slide size (p:sldSz) — slides can't each carry
 *     their own dimensions. So the deck size is the first page's; each later page's
 *     picture is fit (contain, centred) into that frame. For the common uniform-page
 *     case (a carousel, a paged document) every picture fills exactly.
 *   • Picture kind is the shell's choice (emf | png | jpeg) — it's always a p:pic with
 *     a stretch fill, so the container is identical either way. The web shell renders
 *     a high-res PNG per slide (faithful to the source: gradients, photos and effects
 *     survive, and it opens everywhere), which is why png is the common `ext`.
 *
 * Like the other format authorities (emf.ts / apng.ts / pptx has no external deps),
 * fully node:test-able: it returns strings + byte arrays, no zip, no DOM.
 */

export const EMU_PER_INCH = 914400;
export const EMU_PER_PX = EMU_PER_INCH / 96; // CSS px at the 96-DPI convention

export interface PptxSlideInput {
  /** Encoded picture bytes for this slide. */
  image: Uint8Array;
  /** Media extension / kind — drives the content-type + how PowerPoint decodes it. */
  ext: 'emf' | 'png' | 'jpeg';
  /** Intrinsic picture size (px) — used only to fit non-matching aspects into the deck. */
  wPx: number;
  hPx: number;
}

export interface PptxBuildOpts {
  /** Deck slide size in EMU (English Metric Units). Defaults to 1280×720 px @96dpi. */
  emuW?: number;
  emuH?: number;
  /** Provenance for docProps/core.xml. */
  meta?: { title?: string; description?: string; source?: string; contact?: string } | null;
  /** ISO timestamp for docProps (injected so the module stays deterministic/pure). */
  now?: string;
}

const xmlEsc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Relationship TYPE base (…/officeDocument/2006/relationships/<kind>) vs the
// Relationships CONTAINER namespace (…/package/2006/relationships) — DIFFERENT URIs.
// The .rels root element uses PKG_REL_NS; only the Type="" attributes use REL.
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';

const MEDIA_CT: Record<PptxSlideInput['ext'], string> = {
  emf: 'image/x-emf',
  png: 'image/png',
  jpeg: 'image/jpeg',
};

// contain-fit `wPx×hPx` inside `emuW×emuH`, returning the centred EMU frame.
function fitFrame(wPx: number, hPx: number, emuW: number, emuH: number): { x: number; y: number; cx: number; cy: number } {
  const aspect = wPx > 0 && hPx > 0 ? wPx / hPx : emuW / emuH;
  const deckAspect = emuW / emuH;
  let cx = emuW, cy = emuH;
  if (aspect > deckAspect) { cy = Math.round(emuW / aspect); }       // letterbox top/bottom
  else if (aspect < deckAspect) { cx = Math.round(emuH * aspect); }  // pillarbox left/right
  return { x: Math.round((emuW - cx) / 2), y: Math.round((emuH - cy) / 2), cx, cy };
}

function slideXml(slide: PptxSlideInput, emuW: number, emuH: number, index: number): string {
  const f = fitFrame(slide.wPx, slide.hPx, emuW, emuH);
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emuW}" cy="${emuH}"/><a:chOff x="0" y="0"/><a:chExt cx="${emuW}" cy="${emuH}"/></a:xfrm></p:grpSpPr>` +
    `<p:pic>` +
    `<p:nvPicPr><p:cNvPr id="2" name="Slide ${index + 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${f.x}" y="${f.y}"/><a:ext cx="${f.cx}" cy="${f.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
    `</p:pic>` +
    `</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>` +
    `</p:sld>`
  );
}

const slideRelsXml = (index: number, ext: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
  `<Relationship Id="rId2" Type="${REL}/image" Target="../media/image${index + 1}.${ext}"/>` +
  `</Relationships>`;

function presentationXml(n: number, emuW: number, emuH: number): string {
  // Master is rId1; slides are rId2..rId(n+1). Slide ids start at 256 (OOXML rule).
  let sldIds = '';
  for (let i = 0; i < n; i++) sldIds += `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    `<p:sldIdLst>${sldIds}</p:sldIdLst>` +
    `<p:sldSz cx="${emuW}" cy="${emuH}"/>` +
    `<p:notesSz cx="${emuH}" cy="${emuW}"/>` +
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
  for (const e of exts) defaults.push(`<Default Extension="${e}" ContentType="${MEDIA_CT[e as PptxSlideInput['ext']]}"/>`);
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

// A single blank layout + its master. The spTree is empty (the picture lives on the
// slide, not the layout) — enough for a valid, openable deck.
function slideMasterXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr/>` +
    `</p:spTree></p:cSld>` +
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
    `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
    `</p:sldMaster>`
  );
}
const slideMasterRels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
  `<Relationship Id="rId2" Type="${REL}/theme" Target="../theme/theme1.xml"/>` +
  `</Relationships>`;

function slideLayoutXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">` +
    `<p:cSld name="Blank"><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr/>` +
    `</p:spTree></p:cSld>` +
    `<p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>` +
    `</p:sldLayout>`
  );
}
const slideLayoutRels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>` +
  `</Relationships>`;

// A minimal but complete theme — PowerPoint refuses a deck whose master theme is
// missing the colour / font / format scheme, so ship a plain neutral one.
function themeXml(): string {
  const dk = (n: string, hex: string) => `<a:${n}><a:srgbClr val="${hex}"/></a:${n}>`;
  const font = `<a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Lolly">` +
    `<a:themeElements>` +
    `<a:clrScheme name="Lolly">` +
    dk('dk1', '000000') + dk('lt1', 'FFFFFF') + dk('dk2', '44546A') + dk('lt2', 'E7E6E6') +
    dk('accent1', '30BA78') + dk('accent2', '2453FF') + dk('accent3', 'FE7C3F') + dk('accent4', 'EFEFEF') +
    dk('accent5', 'A0A0A0') + dk('accent6', '6B7280') + dk('hlink', '2453FF') + dk('folHlink', '6B7280') +
    `</a:clrScheme>` +
    `<a:fontScheme name="Lolly"><a:majorFont>${font}</a:majorFont><a:minorFont>${font}</a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="Lolly">` +
    `<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>` +
    `<a:lnStyleLst><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>` +
    `<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>` +
    `<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>` +
    `</a:fmtScheme>` +
    `</a:themeElements>` +
    `</a:theme>`
  );
}

function corePropsXml(meta: PptxBuildOpts['meta'], now: string): string {
  const title = xmlEsc(meta?.title ?? 'Presentation');
  const desc = [meta?.description, meta?.contact, meta?.source].filter(Boolean).map(String).join(' · ');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${title}</dc:title>` +
    (desc ? `<dc:description>${xmlEsc(desc)}</dc:description>` : '') +
    `<dc:creator>Lolly</dc:creator><cp:lastModifiedBy>Lolly</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    `</cp:coreProperties>`
  );
}
const appPropsXml = (n: number): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
  `<Application>Lolly</Application><Slides>${n}</Slides><PresentationFormat>Custom</PresentationFormat>` +
  `</Properties>`;

/**
 * Build the full PPTX part tree from rendered slide pictures. Returns a map of
 * archive path → bytes (string parts are UTF-8-encoded by the caller's zip step).
 * The shell zips this with fflate; nothing here touches a DOM or a zip library.
 */
export function buildPptxParts(slides: PptxSlideInput[], opts: PptxBuildOpts = {}): Record<string, string | Uint8Array> {
  if (!slides.length) throw new Error('buildPptxParts: at least one slide is required');
  const emuW = Math.max(1, Math.round(opts.emuW ?? 1280 * EMU_PER_PX));
  const emuH = Math.max(1, Math.round(opts.emuH ?? 720 * EMU_PER_PX));
  const n = slides.length;
  const exts = new Set(slides.map(s => s.ext));
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
    parts[`ppt/slides/slide${i + 1}.xml`] = slideXml(slide, emuW, emuH, i);
    parts[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = slideRelsXml(i, slide.ext);
    parts[`ppt/media/image${i + 1}.${slide.ext}`] = slide.image;
  });
  return parts;
}

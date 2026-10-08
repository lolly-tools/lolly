// SPDX-License-Identifier: MPL-2.0
/** PDF finishing shared by the web and Node shells. No DOM, files or browser imports. */
import { parseDimension, toPoints, computePrintGeometry, roundedRectPath, rgbToCmyk, FINISH_MASK_CMYK, buildEncryptDictValues, preparePassword, encryptObjectBytes } from '@lolly/engine';
import type { BrandPaletteEntry } from '@lolly/engine';
import type { ExportOpts, ExportMeta } from '@lolly-tools/core/host-v1';
import type { LabelSlot, PrintGeometry } from '../../../engine/src/print-marks.ts';
import type { CornerRadii } from '../../../engine/src/css-box.ts';
import { applyPdfX } from './pdfx.ts';
import type { PdfXLog } from './pdfx.ts';

type Rgb = [number, number, number];
export type LabelsRecord = Partial<Record<LabelSlot, string>>;
/** Existing shell export options understood by the shared print/security pass. */
export interface PdfFinishingOpts extends Omit<ExportOpts, 'meta'> {
  meta?: ExportMeta | null;
  palette?: BrandPaletteEntry[];
  bleed?: number | string;
  cropMarks?: boolean;
  registrationMarks?: boolean;
  bleedMarks?: boolean;
  colorBars?: boolean;
  provenance?: boolean;
  barStyle?: 'cmyk-verify' | 'rgb-swatches';
  barRadiusPt?: number;
  c2pa?: boolean;
  password?: string;
  strongPassword?: string;
  convertPaths?: boolean;
}
export interface PdfFinishSettings {
  intentKind?: string | null;
  geo?: PrintGeometry | null;
  geos?: (PrintGeometry | null)[] | null;
  space?: string;
  labels?: LabelsRecord | null;
  log?: PdfXLog | null;
}

// Normalise the shell's brand palette (hex + CMYK 0–100, and/or an independent
// spot lock) into the engine's colour-bar form: { rgb, cmyk } both 0–1, plus a
// label and - for a spot-locked swatch - its ink name, so the shell's bar
// renderer can annotate the pair with the name instead of raw CMYK numbers.
// Only entries with a declared CMYK anchor or a spot lock qualify (the others
// fall back to generic RGB→CMYK at render time and so have nothing to verify);
// a spot lock with no explicit cmyk still qualifies, deriving one from the
// swatch's own hex (same fallback buildCmykPaletteMap uses) so its Separation
// substitution has something to verify against. Deduped by hex+ink, since the
// palette repeats Black/White as ramp endpoints; order is preserved so the
// primary brand hues lead and survive the flat cell cap.
export function brandSwatchPalette(palette: BrandPaletteEntry[] | undefined): { rgb: Rgb; cmyk: [number, number, number, number]; label?: string; spotName?: string }[] {
  const out: { rgb: Rgb; cmyk: [number, number, number, number]; label?: string; spotName?: string }[] = [], seen = new Set<string>();
  for (const { hex, cmyk, label, spot } of palette ?? []) {
    if (!hex || (!cmyk && !spot)) continue;
    const h = hex.replace('#', '').toLowerCase();
    if (h.length !== 6) continue;                         // skips 'transparent' etc.
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const frac = cmyk && cmyk.length === 4 ? (cmyk.map(v => v / 100) as [number, number, number, number]) : rgbToCmyk(r, g, b);
    const key = `${h}:${frac.join(',')}:${spot?.name ?? ''}:${spot?.finish ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // The bar is a VERIFICATION strip: an RGB reference cell beside its CMYK
    // substitution so the operator can check the conversion. A finish has no
    // conversion to verify, so printing its swatch build would make the margin
    // the second place in the file asserting a process build that does not
    // exist. Its cell is the mask, and its name carries the finish.
    out.push({
      rgb: [r, g, b],
      cmyk: spot?.finish ? FINISH_MASK_CMYK : frac,
      label,
      spotName: spot ? (spot.finish ? `${spot.name} (${spot.finish})` : spot.name) : undefined,
    });
  }
  return out;
}

export function printGeometryForSize(trimWpt: number, trimHpt: number, opts: PdfFinishingOpts, paletteSource: BrandPaletteEntry[] | undefined): PrintGeometry | null {
  const bleedDim = parseDimension(opts.bleed);
  const bleedPt = bleedDim ? toPoints(bleedDim) : 0;
  const marks = {
    crop:         Boolean(opts.cropMarks),
    registration: Boolean(opts.registrationMarks),
    bleed:        Boolean(opts.bleedMarks),
    colorBars:    Boolean(opts.colorBars),
    provenance:   Boolean(opts.provenance),
  };
  const anyMark = marks.crop || marks.registration || marks.bleed || marks.colorBars || marks.provenance;
  if (bleedPt <= 0 && !anyMark) return null;
  // Brand swatches drive the colour bar (RGB swatches for RGB output, RGB-beside-CMYK
  // pairs for CMYK). The plain RGB PDF with no palette gets the generic process bar.
  const palette = marks.colorBars ? brandSwatchPalette(paletteSource) : [];
  return computePrintGeometry({ trimWpt, trimHpt, bleedPt, marks, palette, barStyle: opts.barStyle, barRadiusPt: opts.barRadiusPt });
}

export async function encryptPdfStrong(blob: Blob, password: string): Promise<Blob> {
  const { PDFDocument, PDFString, PDFHexString, PDFRawStream, PDFStream, PDFDict, PDFArray } =
    await import('pdf-lib') as any;
  // updateMetadata:false - the finished bytes already carry Lolly's /Producer +
  // dates (from applyPdfX / renderCmykPdf); pdf-lib would otherwise overwrite them
  // with "pdf-lib ..." + the load time, which we'd then encrypt into the file (and it
  // would disagree with the still-Lolly XMP). Same guard finishPdfX uses.
  const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()), { updateMetadata: false });
  const ctx = doc.context;

  const rnd = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));
  const hexU = (b: Uint8Array): string => {
    let s = '';
    for (const x of b) s += x.toString(16).padStart(2, '0');
    return s.toUpperCase();
  };

  // Permissions: grant everything (P = -4). The open-password IS the protection;
  // per-permission restrictions are unenforceable anyway once the opener holds the
  // (owner) password, and Lolly uses the same value for user and owner.
  const P = -4;
  const fileKey = rnd(32);
  const vals = await buildEncryptDictValues({
    userPw: preparePassword(password),
    ownerPw: preparePassword(password),
    fileKey,
    salts: { uvs: rnd(8), uks: rnd(8), ovs: rnd(8), oks: rnd(8) },
    permsRandom: rnd(4),
    P,
    encryptMetadata: true,
  });

  // Public /ID (never encrypted).
  const idArr = PDFArray.withContext(ctx);
  idArr.push(PDFHexString.of(hexU(rnd(16))));
  idArr.push(PDFHexString.of(hexU(rnd(16))));

  // The /Encrypt dict - its own strings (U/O/UE/OE/Perms) are stored raw, so it is
  // registered AFTER the encryption walk (below), never encrypted. /Length is 256
  // (BITS) at top level but 32 (BYTES) inside the crypt filter - the classic trap.
  const encDict = ctx.obj({
    Filter: 'Standard', V: 5, R: 6, Length: 256, P,
    U: PDFHexString.of(hexU(vals.U)),
    O: PDFHexString.of(hexU(vals.O)),
    UE: PDFHexString.of(hexU(vals.UE)),
    OE: PDFHexString.of(hexU(vals.OE)),
    Perms: PDFHexString.of(hexU(vals.Perms)),
    CF: { StdCF: { CFM: 'AESV3', AuthEvent: 'DocOpen', Length: 32 } },
    StmF: 'StdCF', StrF: 'StdCF', EncryptMetadata: true,
  });

  // Encrypt every string (→ PDFHexString, which serialises verbatim - PDFString
  // does not escape binary) and every stream body. Same file key, fresh IV each.
  const encStr = async (o: any): Promise<any> =>
    PDFHexString.of(hexU(await encryptObjectBytes(fileKey, rnd(16), o.asBytes())));
  const walk = async (c: any): Promise<void> => {
    if (c instanceof PDFDict) {
      for (const [k, v] of c.entries()) {
        if (v instanceof PDFString || v instanceof PDFHexString) c.set(k, await encStr(v));
        else if (v instanceof PDFDict || v instanceof PDFArray) await walk(v);
      }
    } else if (c instanceof PDFArray) {
      for (let i = 0; i < c.size(); i++) {
        const v = c.get(i);
        if (v instanceof PDFString || v instanceof PDFHexString) c.set(i, await encStr(v));
        else if (v instanceof PDFDict || v instanceof PDFArray) await walk(v);
      }
    }
  };
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFStream) {
      const ct = await encryptObjectBytes(fileKey, rnd(16), new Uint8Array(obj.getContents()));
      await walk(obj.dict);
      ctx.assign(ref, PDFRawStream.of(obj.dict, ct));
    } else if (obj instanceof PDFDict || obj instanceof PDFArray) {
      await walk(obj);
    } else if (obj instanceof PDFString || obj instanceof PDFHexString) {
      ctx.assign(ref, await encStr(obj));
    }
  }

  const encRef = ctx.register(encDict); // after the walk → the dict itself stays clear
  ctx.trailerInfo.Encrypt = encRef;
  ctx.trailerInfo.ID = idArr;
  // Classic xref table (no object/xref streams): the encryption rule stays uniform
  // (every indirect object encrypted, nothing stream-shaped to exempt).
  const out = await doc.save({ useObjectStreams: false });
  return new Blob([out], { type: 'application/pdf' });
}

export async function finishPdfX(
  blobOrBytes: Blob | Uint8Array, opts: PdfFinishingOpts,
  { intentKind = 'srgb', geo = null, geos = null, space = 'rgb', labels = null, log = null }:
    PdfFinishSettings = {},
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib') as any;
  const bytes = blobOrBytes instanceof Uint8Array
    ? blobOrBytes
    : new Uint8Array(await blobOrBytes.arrayBuffer());
  // updateMetadata:false - pdf-lib would otherwise stamp itself as Producer on
  // load; applyPdfX writes the document's real dates/producer below.
  const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false });
  // Marks + boxes per page. The single-page caller passes one `geo` (page 0); the
  // multi-page caller passes `geos` (one per page, any entry may be null). Each
  // setPageBoxes/drawPrintMarks reads its own geo, so the loop is per-page-safe.
  const perPage = geos ?? (geo ? [geo] : null);
  if (perPage) {
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const g = perPage[i];
      if (!g) continue;
      setPageBoxes(pages[i], g);
      await drawPrintMarks(pages[i], g, { space, labels });
    }
  }
  await applyPdfX(pdfDoc, opts, intentKind, { log });
  // The C2PA embedder only parses a classic xref table; pdf-lib's default save
  // (object streams) writes a cross-reference stream it refuses. Only flipped
  // when credentials are requested, so ordinary PDFs keep the compact form.
  const out = await pdfDoc.save(opts.c2pa ? { useObjectStreams: false } : undefined);
  return new Blob([out], { type: 'application/pdf' });
}

export function provenanceLabels(meta: ExportMeta | null | undefined): LabelsRecord | null {
  if (!meta) return null;
  const topLeft  = formatStamp(new Date());
  const topRight = meta.source ? `Made with ${meta.source}` : '';
  const credit = [meta.tool, meta.author && `by ${meta.author}`].filter(Boolean).join(' ');
  return { topLeft, topRight, bottomLeftUp: meta.tool ? credit : '' };
}

// Local export timestamp as "YYYY-MM-DD HH:MM".
function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Declare the print page boxes so a RIP / print shop knows the cut (trim) and
// bleed extents: Media ⊇ Bleed ⊇ Trim (= Art); CropBox = Media. The engine's
// geometry is top-left origin; PDF boxes are bottom-left, so flip y.
export function setPageBoxes(page: any, geo: PrintGeometry): void {
  const H = geo.page.h;
  const box = (b: { x: number; y: number; w: number; h: number }): [number, number, number, number] => [b.x, H - (b.y + b.h), b.w, b.h]; // → [x, y(bottom-left), w, h]
  page.setMediaBox(...box(geo.boxes.media));
  page.setCropBox(...box(geo.boxes.media));
  page.setBleedBox(...box(geo.boxes.bleed));
  page.setTrimBox(...box(geo.boxes.trim));
  page.setArtBox(...box(geo.boxes.trim));
}

// Draw the crop / bleed / registration marks, colour bar and provenance labels
// in the page margin. Line marks use registration colour (DeviceCMYK 1,1,1,1 on
// the CMYK path so they print on every plate; black on the RGB path). Colour-bar
// cells follow their own `ink`: brand pairs force 'rgb' (the unconverted
// reference swatch) and 'cmyk' (the substitution) regardless of page space, so
// the two sit side by side for comparison; the generic bar's 'page' cells follow
// the page space. `labels` (optional) maps each engine label slot → its string.
// Engine coords are top-left; flip y.
export async function drawPrintMarks(page: any, geo: PrintGeometry, { space = 'rgb', labels }: { space?: string; labels?: LabelsRecord | null } = {}): Promise<void> {
  const { rgb, cmyk, degrees, StandardFonts } = await import('pdf-lib') as any;
  const H = geo.page.h;
  const fy = (y: number) => H - y;
  const markColor = space === 'cmyk' ? cmyk(1, 1, 1, 1) : rgb(0, 0, 0);
  const w = geo.strokeWeight;
  for (const ln of geo.primitives.lines) {
    page.drawLine({ start: { x: ln.x1, y: fy(ln.y1) }, end: { x: ln.x2, y: fy(ln.y2) }, thickness: w, color: markColor });
  }
  for (const c of geo.primitives.circles) {
    // borderColor without `color` strokes a ring (no fill) - see pdf-lib drawEllipse.
    page.drawCircle({ x: c.cx, y: fy(c.cy), size: c.r, borderWidth: w, borderColor: markColor });
  }
  for (const b of geo.primitives.bars) {
    const ink = b.ink === 'page' || !b.ink ? space : b.ink;
    const fill = ink === 'cmyk' ? cmyk(...b.cmyk) : rgb(...b.rgb);
    const r = Math.max(0, Math.min(b.r ?? 0, b.w / 2, b.h / 2));
    if (r > 0) {
      // Rounded cell (brand --radius). pdf-lib drawSvgPath draws the path y-DOWN from
      // its origin, so anchor at the cell's TOP edge (fy(b.y)). Any surprise falls
      // back to a square rect rather than dropping the cell.
      try {
        const rad: CornerRadii = { topLeft: [r, r], topRight: [r, r], bottomRight: [r, r], bottomLeft: [r, r] };
        page.drawSvgPath(roundedRectPath(0, 0, b.w, b.h, rad), { x: b.x, y: fy(b.y), color: fill, borderWidth: 0 });
        continue;
      } catch { /* fall through to a square cell */ }
    }
    page.drawRectangle({ x: b.x, y: fy(b.y + b.h), width: b.w, height: b.h, color: fill });
  }
  // Provenance text - only the engine's anchors that the caller supplied a string
  // for. Helvetica (a standard-14 font: referenced, not embedded) keeps it light.
  const slots = (geo.primitives.labels ?? []).filter(l => labels?.[l.slot]);
  if (slots.length) {
    const font = await page.doc.embedFont(StandardFonts.Helvetica);
    const textColor = space === 'cmyk' ? cmyk(0, 0, 0, 0.7) : rgb(0.35, 0.35, 0.35);
    for (const l of slots) {
      const text = labels![l.slot]!;
      // Right-aligned horizontal text shifts left by its measured width; rotated
      // text (read-up) starts at its anchor and climbs, so no shift needed.
      const shift = (l.rotation === 0 && l.align === 'right') ? font.widthOfTextAtSize(text, l.size) : 0;
      page.drawText(text, {
        x: l.x - shift, y: fy(l.y), size: l.size, font, color: textColor, rotate: degrees(l.rotation),
      });
    }
  }
}

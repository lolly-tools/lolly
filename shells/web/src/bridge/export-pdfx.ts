// SPDX-License-Identifier: MPL-2.0
/**
 * The PDF/X-4 metadata pass, over an already-loaded pdf-lib document - moved out
 * of bridge/export.ts verbatim (same precedent as export-pdf-vector.ts) and
 * deliberately DOM-free, so the produced bytes can be re-opened and asserted on
 * under plain `node --test`.
 *
 * WHAT X-4 requires comes from the engine (`pdfx.ts`); this maps it onto pdf-lib
 * objects:
 *  - every page carries a TrimBox (pages the print path already boxed keep their
 *    computed trim/bleed; unmarked pages trim at the full page),
 *  - a catalog /Metadata XMP packet,
 *  - Info dict: CreationDate == ModDate (one clock read, matching the XMP dates),
 *    Trapped /False, and the GTS_PDFXVersion claim,
 *  - trailer /ID: two identical 16-byte ids sharing the XMP DocumentID's bytes,
 *  - a single GTS_PDFX OutputIntent from pdfxOutputIntentSpec, with an embedded
 *    /DestOutputProfile whenever bytes are available.
 *
 * ## The claim gate
 *
 * Writing the metadata and CLAIMING conformance are separate decisions. The
 * metadata is nearly always worth writing - a RIP reads the output intent whether
 * or not the file is a valid X-4 - but `GTS_PDFXVersion` is an assertion about the
 * whole document, and this module withholds it unless everything it can actually
 * check holds:
 *
 *  1. an output intent exists, and it EMBEDS its destination profile. sRGB always
 *     does. A CMYK press condition embeds only when the caller resolved a profile
 *     from the user's own device (`resolveEmbeddedProfile`); a registry NAME alone
 *     is a true statement of the press condition but it is not X-4 (referencing an
 *     external profile is the X-4p variant, which needs a DestOutputProfileRef
 *     dict we do not write), so no claim;
 *  2. no unmanaged RGB under a CMYK intent - no image XObject in plain /DeviceRGB,
 *     no transparency group in /DeviceRGB, and no /DeviceRGB shading (the vector
 *     form a CSS gradient takes: jsPDF writes an axial/radial ShadingPattern whose
 *     /ColorSpace is /DeviceRGB, and a shading is a bare dict, so the CMYK pass's
 *     content-stream substitution never touches it). This is not a nicety - it is
 *     the standard's own colour-consistency rule, and embedding a CMYK profile does
 *     NOT cure it;
 *  3. every font the content actually SELECTS is embedded (X-4 has no exception for
 *     the standard 14). Read off the content streams' `Tf` operators, not off the
 *     resource dicts: jsPDF declares all fourteen standard fonts in every page's
 *     resources whether a glyph is set in them or not, so resource dicts would
 *     withhold the claim from every export including the conformant ones (text
 *     outlined to paths selects no font at all). pdf-lib's StandardFonts, which
 *     drawPrintMarks uses for the provenance labels, are NOT embedded - so a marked
 *     Print PDF withholds the claim until those labels are drawn with a real face.
 *     Withholding is the correct interim answer;
 *  4. the document is not encrypted (X-4 forbids it) - the last word, so a
 *     perfectly embedded AES-256 export keeps its intent and drops the claim.
 *
 * What is NOT checked, and therefore never implied: content-stream colour
 * operators (`hasDeviceRgbImage` inspects image XObjects only - on the CMYK path
 * `substitutePdfRgb` is trusted to have converted them, not verified), spot
 * alternates, overprint, halftones, annotations/actions/JS/external references (we
 * write none), the PDF header version, and ICC-internal conformance to ICC.1.
 * Above all: nothing here can check that a profile's MEASUREMENTS really describe
 * the condition its identifier names - see press-profile-embed.ts, which is why
 * identity is derived from the embedded profile rather than from a picker.
 */
import {
  buildPdfXXmp, formatPdfDate, makeDocumentId, pdfxOutputIntentSpec, PDFX_VERSION,
} from '@lolly/engine';
import type { PdfXOutputIntentSpec } from '@lolly/engine';
import type { EmbedResolution } from '../lib/press-profile-embed.ts';

/** The slice of ExportOpts this pass reads. */
export interface PdfXDocOpts {
  meta?: { tool?: string; software?: string } | null;
  /** Present when the caller will AES-256 encrypt after this pass. */
  strongPassword?: string;
}

export type PdfXLog = (level: 'debug' | 'info' | 'warn' | 'error', msg: string) => void;

/** Extras: the resolved profile to embed, and where to log a withheld claim. */
export interface PdfXExtra {
  embed?: EmbedResolution | null;
  log?: PdfXLog | null;
}

/**
 * Write the PDF/X-4 metadata set, and claim conformance only where honest.
 *
 * `intentKind`: null / 'none' → metadata but no intent and no claim; 'srgb' → the
 * engine's sRGB intent; a CMYK condition id → that press condition, name-only
 * unless `extra.embed` carries bytes; 'own' → embed the user's profile, and write
 * NOTHING at all when `extra.embed` is null (a stale saved session or a
 * hand-edited URL naming a profile this device cannot use). Falling back to a
 * default condition there would re-declare something the user never chose.
 */
export async function applyPdfX(
  pdfDoc: any,
  opts: PdfXDocOpts,
  intentKind: string | null,
  extra: PdfXExtra = {},
): Promise<void> {
  const lib = await import('pdf-lib') as any;
  const { PDFName, PDFString, PDFHexString } = lib;
  const log = extra.log ?? null;
  const embed = extra.embed ?? null;
  // pdf-lib defers font/image embedding until save, so the font check below would
  // look at a document with no font dicts in it yet - and grant a claim to a page
  // drawn with a non-embedded standard face. Materialise them first (save() calls
  // this itself; calling it twice is a no-op).
  await pdfDoc.flush?.();

  // TrimBox is not inheritable, so the leaf dict says whether setPageBoxes ran.
  for (const page of pdfDoc.getPages()) {
    if (!page.node.get(PDFName.of('TrimBox'))) {
      const mb = page.getMediaBox();
      page.setTrimBox(mb.x, mb.y, mb.width, mb.height);
    }
  }

  const spec = outputIntentSpec(intentKind, embed, log);
  const intentSpace: 'CMYK' | 'RGB' = intentKind === 'srgb' ? 'RGB' : 'CMYK';
  let claim = Boolean(spec);
  // An intent with no embedded profile is not PDF/X-4 - it names the condition
  // without carrying it. Write it (a RIP still wants it), claim nothing.
  if (spec && !spec.iccBytes) {
    claim = false;
    log?.('info', 'PDF/X metadata written without conformance claim: the press condition is named, not embedded (no profile on this device)');
  }
  // The standard's colour-consistency rule, and it applies WITH bytes embedded:
  // unmanaged RGB under a CMYK intent is a violation an embedded profile cannot cure.
  if (spec && claim && intentSpace === 'CMYK'
      && (hasDeviceRgbImage(pdfDoc, PDFName) || !shadingCsOk(pdfDoc, PDFName))) {
    claim = false;
    log?.('info', 'PDF/X conformance claim dropped: unmanaged RGB content (image or shading) under a CMYK output intent');
  }
  if (spec && claim && intentSpace === 'CMYK' && !groupCsOk(pdfDoc, PDFName)) {
    claim = false;
    log?.('info', 'PDF/X conformance claim dropped: a transparency group is /DeviceRGB under a CMYK output intent');
  }
  if (spec && claim && !usedFontsEmbedded(pdfDoc, lib)) {
    claim = false;
    log?.('info', 'PDF/X conformance claim dropped: a font is not embedded (PDF/X-4 has no exception for the standard 14)');
  }
  // A strong-locked export gets AES-256-encrypted after this pass - and PDF/X-4
  // forbids encryption, so the file cannot honestly claim conformance. Keep the
  // CMYK / output-intent / marks metadata, but drop the GTS_PDFXVersion claim.
  if (claim && opts.strongPassword) {
    claim = false;
    log?.('info', 'PDF/X conformance claim dropped: document is AES-256 encrypted (PDF/X-4 forbids encryption)');
  }
  if (spec) setPdfxOutputIntent(pdfDoc, spec, { PDFName, PDFString, PDFHexString });

  const now = new Date();
  const producer = opts.meta?.software || 'Lolly';
  const documentId = makeDocumentId();
  let xmp = buildPdfXXmp({
    createDate: now.toISOString(),
    title: opts.meta?.tool || '',
    creatorTool: producer,
    producer,
    documentId,
    instanceId: makeDocumentId(),
  });
  // Withholding the claim means no GTS_PDFXVersion anywhere - Info or XMP (the
  // packet builder always writes the property, so strip its one known line).
  if (!claim) xmp = xmp.replace(/[ \t]*<pdfxid:GTS_PDFXVersion>[^<]*<\/pdfxid:GTS_PDFXVersion>\n/, '');
  // The XMP stream stays uncompressed so non-PDF-aware scanners can find the
  // xpacket markers (the point of the packet's writable padding).
  const meta = pdfDoc.context.stream(new TextEncoder().encode(xmp), { Type: 'Metadata', Subtype: 'XML' });
  pdfDoc.catalog.set(PDFName.of('Metadata'), pdfDoc.context.register(meta));

  // getInfoDict is private in the d.ts but a plain method at runtime.
  const info = pdfDoc.getInfoDict();
  const pdfDate = PDFString.of(formatPdfDate(now));
  info.set(PDFName.of('Producer'), PDFString.of(producer));
  info.set(PDFName.of('CreationDate'), pdfDate);
  info.set(PDFName.of('ModDate'), pdfDate);       // == CreationDate: untouched since export
  info.set(PDFName.of('Trapped'), PDFName.of('False'));
  if (claim) info.set(PDFName.of('GTS_PDFXVersion'), PDFString.of(PDFX_VERSION));

  // Trailer /ID: two identical entries (a fresh document, not a revision) reusing
  // the XMP DocumentID's 16 bytes so file identity agrees end to end.
  const idHex = documentId.replace(/^uuid:/, '').replace(/-/g, '');
  const id = PDFHexString.of(idHex);
  pdfDoc.context.trailerInfo.ID = pdfDoc.context.obj([id, id]);
}

/**
 * The intent descriptor for this export, or null for "write no intent".
 *
 * The embed route is the ONLY one that supplies CMYK profile bytes, and its
 * identity comes from the profile (identifier / registry / info), never from the
 * condition the panel happens to name. See press-profile-embed.ts section identity trap.
 */
function outputIntentSpec(
  intentKind: string | null, embed: EmbedResolution | null, log: PdfXLog | null,
): PdfXOutputIntentSpec | null {
  if (!intentKind || intentKind === 'none') return null;
  if (intentKind === 'own') {
    if (!embed) {
      log?.('info', 'PDF/X output intent omitted: the chosen colour profile is not on this device (or cannot be an output profile)');
      return null;
    }
    return pdfxOutputIntentSpec(embed.pairedCondition ?? 'fogra39', {
      iccBytes: embed.bytes,
      components: embed.components,
      identifier: embed.identifier,
      registry: embed.registry,
      info: embed.info,
    });
  }
  return pdfxOutputIntentSpec(intentKind);
}

/**
 * Materialise the engine's OutputIntent spec (pdfx.js) into the catalog,
 * REPLACING any existing intents so an export carries exactly one. Field map:
 * S ← subtype, OutputConditionIdentifier ← identifier, OutputCondition/Info ←
 * info, RegistryName ← registry (omitted when null - a `Custom` identity names no
 * registry), DestOutputProfile ← iccBytes as a compressed stream with /N
 * components. 'srgb' always ships bytes; a CMYK condition ships them only when
 * the user's own profile was resolved for this export.
 */
export function setPdfxOutputIntent(
  pdfDoc: any, spec: PdfXOutputIntentSpec, { PDFName, PDFString, PDFHexString }: any,
): void {
  const str = (s: string): any => pdfText(s, { PDFString, PDFHexString });
  const intent = pdfDoc.context.obj({
    Type: 'OutputIntent',
    S: spec.subtype,
    OutputConditionIdentifier: str(spec.identifier),
    OutputCondition: str(spec.info),
    Info: str(spec.info),
  });
  if (spec.registry) intent.set(PDFName.of('RegistryName'), str(spec.registry));
  if (spec.iccBytes) {
    const icc = pdfDoc.context.flateStream(spec.iccBytes, { N: spec.components });
    intent.set(PDFName.of('DestOutputProfile'), pdfDoc.context.register(icc));
  }
  pdfDoc.catalog.set(PDFName.of('OutputIntents'), pdfDoc.context.obj([intent]));
}

/**
 * A PDF text string that survives a round-trip, whatever an ICC file called itself.
 *
 * Two of these values come out of a user's profile - its `desc` and its filename - 
 * so they are untrusted text, and pdf-lib's PDFString deliberately does not escape
 * anything ("for simplicity, we will not bother escaping them" is in its source).
 * An unbalanced parenthesis in a description therefore terminates the literal early
 * and leaves the rest as garbage tokens inside the catalog dict, which breaks the
 * whole file, not just the intent; a backslash silently disappears; and a byte over
 * 0x7f gets truncated into a control character - a wrong value of record in a place
 * whose entire job is to be right. So: printable ASCII goes out as a literal with
 * `\ ( )` escaped, and anything else (any German or Japanese profile name - ICC's
 * `mluc` desc is UTF-16) as a hex string, which PDF defines as UTF-16BE text.
 */
function pdfText(s: string, { PDFString, PDFHexString }: any): any {
  return /^[\x20-\x7e]*$/.test(s)
    ? PDFString.of(s.replace(/([\\()])/g, '\\$1'))
    : PDFHexString.fromText(s);
}

/**
 * True when any image XObject draws in plain /DeviceRGB - jsPDF embeds rasters
 * this way, and unmanaged RGB pixels under a CMYK output intent are exactly what
 * PDF/X's colour-consistency rule forbids. Indirect (ICCBased/Indexed) colour
 * spaces don't stringify to /DeviceRGB and count as managed.
 */
export function hasDeviceRgbImage(pdfDoc: any, PDFName: any): boolean {
  for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    const dict = obj?.dict;
    if (!dict?.get) continue;
    const sub = dict.get(PDFName.of('Subtype'));
    if (!sub || !String(sub).includes('Image')) continue;
    const cs = dict.get(PDFName.of('ColorSpace'));
    if (cs && String(cs).includes('DeviceRGB')) return true;
  }
  return false;
}

/**
 * False when a transparency group declares /DeviceRGB while the intent is CMYK - 
 * the group-colour-space half of the same colour-consistency rule (a blend done
 * in RGB under a CMYK intent is not reproducible as declared). A group with no
 * /CS inherits the page and is fine.
 */
export function groupCsOk(pdfDoc: any, PDFName: any): boolean {
  const rgbGroup = (group: any): boolean => {
    const cs = group?.get?.(PDFName.of('CS'));
    return Boolean(cs && String(cs).includes('DeviceRGB'));
  };
  for (const page of pdfDoc.getPages()) {
    if (rgbGroup(page.node.get(PDFName.of('Group')))) return false;
  }
  for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    const dict = obj?.dict ?? obj;
    if (!dict?.get) continue;
    if (rgbGroup(dict.get(PDFName.of('Group')))) return false;
    const type = dict.get(PDFName.of('Type'));
    if (type && String(type).includes('Group') && rgbGroup(dict)) return false;
  }
  return true;
}

/**
 * False when a shading paints in plain /DeviceRGB - the third face of the same
 * colour-consistency rule, and the one the two checks above cannot see.
 *
 * A CSS gradient on the print path is exported as a TRUE VECTOR jsPDF
 * ShadingPattern (`fillPdfShading`, taken for every opaque linear/radial
 * gradient), which jsPDF writes as `<< /ShadingType 2 /ColorSpace /DeviceRGB … >>`.
 * That is a bare dict, not a stream, so renderCmykPdf's substitution loop - which
 * only rewrites `rg`/`RG` operators inside content streams - never converts it: the
 * better vector path is the one that escapes, since the raster fallback would have
 * been caught as a DeviceRGB image. Shadings live in a /Shading (or /Pattern)
 * resource dict as well as standing on their own, so both routes are walked.
 */
export function shadingCsOk(pdfDoc: any, PDFName: any): boolean {
  const ctx = pdfDoc.context;
  const rgb = (d: any): boolean => {
    const cs = d?.get?.(PDFName.of('ColorSpace'));
    return Boolean(cs && String(cs).includes('DeviceRGB'));
  };
  /** Depth-bounded: a hostile or merely odd file must not cost an unbounded walk. */
  const bad = (obj: any, depth = 0): boolean => {
    const dict = obj?.dict ?? obj;
    if (!dict?.get || depth > 4) return false;
    if (dict.get(PDFName.of('ShadingType')) && rgb(dict)) return true;
    for (const key of ['Shading', 'Pattern']) {
      const held = ctx.lookup(dict.get(PDFName.of(key)));
      if (!held) continue;
      if (bad(held, depth + 1)) return true;                       // a shading itself
      for (const [, v] of held.entries?.() ?? []) {                // …or a name → shading map
        if (bad(ctx.lookup(v), depth + 1)) return true;
      }
    }
    return false;
  };
  for (const page of pdfDoc.getPages()) {
    if (bad(page.node.Resources?.() ?? null)) return false;
  }
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    if (bad(obj)) return false;
    const dict = obj?.dict ?? obj;
    if (dict?.get && bad(ctx.lookup(dict.get(PDFName.of('Resources'))), 1)) return false;
  }
  return true;
}

/**
 * Is every font the content actually DRAWS WITH embedded? X-4 requires it with no
 * exception for the standard 14.
 *
 * "Actually draws with" is the whole subtlety. Every jsPDF document declares all
 * fourteen standard fonts in its page resources whether or not a glyph is set in
 * them (VERIFIED: 14 /Font dicts, none with a FontDescriptor, on a two-word
 * document), so judging resource dicts would withhold the claim from every export
 * Lolly makes - including the ones that genuinely are conformant because the text
 * was outlined to paths. So the content streams are read, and only a font a `Tf`
 * operator selects has to be embedded.
 *
 * pdf-lib's StandardFonts - what drawPrintMarks sets the provenance labels in - 
 * write a bare /Type1 dict with no FontDescriptor and no FontFile, so a marked
 * Print PDF answers false here. That is a real conformance defect in the file, and
 * withholding the claim is the honest interim behaviour; drawing those labels with
 * a real face is its own piece of work.
 *
 * Conservative: anything this cannot positively confirm as embedded counts as not
 * embedded, because the consequence is withholding a claim rather than blocking an
 * export.
 */
export function usedFontsEmbedded(pdfDoc: any, lib: any): boolean {
  const { PDFName } = lib;
  const ctx = pdfDoc.context;
  const descriptorEmbeds = (fd: any): boolean => {
    if (!fd?.get) return false;
    for (const k of ['FontFile', 'FontFile2', 'FontFile3']) {
      if (fd.get(PDFName.of(k))) return true;
    }
    return false;
  };
  const fontOk = (dict: any): boolean => {
    if (!dict?.get) return false;
    const sub = String(dict.get(PDFName.of('Subtype')) ?? '');
    // A Type3 font's glyphs ARE the file (CharProcs content streams).
    if (sub.includes('Type3')) return true;
    if (sub.includes('Type0')) {
      const kids = ctx.lookup(dict.get(PDFName.of('DescendantFonts')))?.asArray?.() ?? [];
      if (!kids.length) return false;
      return kids.every((k: any) => descriptorEmbeds(ctx.lookup(ctx.lookup(k)?.get?.(PDFName.of('FontDescriptor')))));
    }
    return descriptorEmbeds(ctx.lookup(dict.get(PDFName.of('FontDescriptor'))));
  };

  for (const { stream, resources } of contentStreams(pdfDoc, lib)) {
    const fonts = resources?.get ? ctx.lookup(resources.get(PDFName.of('Font'))) : null;
    for (const name of selectedFontNames(stream)) {
      // A Tf naming something the resource dict does not have is a broken file, not
      // an unembedded font - the claim gate is not the place to adjudicate that.
      const entry = fonts?.get?.(PDFName.of(name));
      if (!entry) continue;
      if (!fontOk(ctx.lookup(entry))) return false;
    }
  }
  return true;
}

/** `/F1 16 Tf` → `F1`. Only the names a Tf operator selects. */
function selectedFontNames(stream: string): Set<string> {
  const names = new Set<string>();
  const re = /\/([^\s/<>\[\]{}()%]+)\s+[-\d.]+\s+Tf\b/g;
  for (let m = re.exec(stream); m; m = re.exec(stream)) names.add(m[1]!);
  return names;
}

/**
 * Every content stream in the document, decoded, paired with the resource dict it
 * resolves names against: each page's contents, plus each form XObject (which may
 * carry resources of its own).
 *
 * Best-effort by design - an undecodable stream yields no font names, and the
 * claim then rests on the streams that did decode.
 */
function* contentStreams(pdfDoc: any, lib: any): Generator<{ stream: string; resources: any }> {
  const { PDFName, decodePDFRawStream } = lib;
  const ctx = pdfDoc.context;
  // Two shapes reach here and they decode differently: a stream PARSED out of the
  // jsPDF bytes is a PDFRawStream (pdf-lib's own decoder handles its filter chain - 
  // no second inflate, and synchronous, which DecompressionStream is not), while one
  // pdf-lib itself built for the print marks holds its operators unencoded until
  // save. Reading getContents() on the latter returns the compressed bytes, which is
  // how a Tf operator went missing and a page drawn in Helvetica passed the gate.
  const decode = (obj: any): string => {
    try {
      const bytes = typeof obj?.getUnencodedContents === 'function'
        ? obj.getUnencodedContents()
        : obj?.dict ? decodePDFRawStream(obj).decode() : null;
      return bytes ? new TextDecoder().decode(bytes) : '';
    } catch {
      return '';                     // an undecodable stream contributes no names
    }
  };
  for (const page of pdfDoc.getPages()) {
    const resources = page.node.Resources?.() ?? null;
    const contents = page.node.get(PDFName.of('Contents'));
    const parts = ctx.lookup(contents)?.asArray?.() ?? [contents];
    for (const part of parts) {
      const stream = decode(ctx.lookup(part));
      if (stream) yield { stream, resources };
    }
  }
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    const dict = obj?.dict;
    if (!dict?.get) continue;
    if (!String(dict.get(PDFName.of('Subtype')) ?? '').includes('Form')) continue;
    const stream = decode(obj);
    if (stream) yield { stream, resources: ctx.lookup(dict.get(PDFName.of('Resources'))) };
  }
}

// SPDX-License-Identifier: MPL-2.0
/**
 * PDF/X-4 metadata authority — pure strings + small descriptor objects, no PDF
 * byte-wrangling. The shell's pdf-lib export pass consumes these: it embeds the
 * XMP packet as the catalog /Metadata stream, writes the Info-dict dates via
 * formatPdfDate, materializes the OutputIntent from pdfxOutputIntentSpec, and
 * sets the trailer /ID from makeDocumentId.
 *
 * Like color.js / units.js this is a single source of truth: what PDF/X-4
 * requires lives here (XMP properties, namespaces, packet framing), while HOW
 * it lands in the file is the shell's per-library concern. DOM-free, clock-free
 * (callers pass dates), fully node:test-able.
 */
import { srgbIccProfile, cmykCondition } from './color.ts';

/** The conformance level this module targets (value of pdfxid:GTS_PDFXVersion). */
export const PDFX_VERSION = 'PDF/X-4';

// Minimal XML escape for interpolated metadata values (attribute- and
// text-safe: covers & < > " ').
const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/**
 * Deterministic-format 'uuid:xxxxxxxx-…' identifier for xmpMM:DocumentID /
 * InstanceID and the trailer /ID. With a seed the result is a stable name-based
 * (v5-style) UUID — same seed, same id — so re-exports of an unchanged document
 * can keep their DocumentID. Without a seed it defers to the platform's
 * crypto.randomUUID (callers who want reproducibility should pass a seed).
 */
export function makeDocumentId(seed?: string): string {
  if (seed == null || seed === '') {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return 'uuid:' + uuid;
    seed = String(Math.random()) + '/' + String(Math.random()); // no-crypto fallback
  }
  // Four salted FNV-1a streams → 128 bits. Identity, not security: only has to
  // be stable per seed and well-spread across documents.
  const s = String(seed);
  let hex = '';
  for (let w = 0; w < 4; w++) {
    let h = (0x811c9dc5 ^ Math.imul(w + 1, 0x9e3779b9)) >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    hex += (h >>> 0).toString(16).padStart(8, '0');
  }
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return 'uuid:' + hex.slice(0, 8) + '-' + hex.slice(8, 12) +
    '-5' + hex.slice(13, 16) +               // version nibble 5 (name-based)
    '-' + variant + hex.slice(17, 20) +
    '-' + hex.slice(20, 32);
}

/**
 * A date in the PDF Info-dict form `D:YYYYMMDDHHmmSS+HH'mm'` (local time with
 * numeric UTC offset — the Adobe convention; zero offset still writes +00'00'
 * so the string shape is uniform). Accepts a Date or anything Date() parses.
 */
export function formatPdfDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new TypeError('formatPdfDate: invalid date');
  const p = (v: number): string => String(v).padStart(2, '0');
  const offMin = -d.getTimezoneOffset();             // minutes EAST of UTC
  const sign = offMin < 0 ? '-' : '+';
  const abs = Math.abs(offMin);
  return 'D:' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
    p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) +
    sign + p(Math.floor(abs / 60)) + "'" + p(abs % 60) + "'";
}

// Adobe's recommended in-place-edit headroom: ~2KB of whitespace between the
// metadata and the end marker, so editors can rewrite the packet without
// resizing the stream. end='w' declares the padding writable.
const XPACKET_BEGIN = '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>';
const XPACKET_END = "<?xpacket end='w'?>";
const XPACKET_PAD = ('\n' + ' '.repeat(99)).repeat(20) + '\n';

/** Options for {@link buildPdfXXmp}. */
export interface PdfXXmpOptions {
  /** required — ISO 8601 (e.g. new Date().toISOString()) */
  createDate?: string;
  /** defaults to createDate */
  modifyDate?: string;
  /** document title (dc:title x-default) */
  title?: string;
  /** xmp:CreatorTool, default 'Lolly' */
  creatorTool?: string;
  /** pdf:Producer, default 'Lolly' */
  producer?: string;
  /** xmpMM:DocumentID ('uuid:…') */
  documentId?: string;
  /** xmpMM:InstanceID ('uuid:…') */
  instanceId?: string;
  /** pdf:Trapped, default 'False' (X-4 forbids unset) */
  trapped?: string;
  /** pdfxid:GTS_PDFXVersion, default PDFX_VERSION */
  pdfxVersion?: string;
}

/**
 * Build the complete XMP packet a PDF/X-4 file carries as its catalog
 * /Metadata stream. Dates are caller-supplied ISO-8601 strings (the engine has
 * no clock); ids default to fresh makeDocumentId() values but callers SHOULD
 * pass the same documentId they put in the trailer /ID.
 */
export function buildPdfXXmp(opts: PdfXXmpOptions = {}): string {
  const {
    createDate,
    modifyDate = createDate,
    title = '',
    creatorTool = 'Lolly',
    producer = 'Lolly',
    documentId = makeDocumentId(),
    instanceId = makeDocumentId(),
    trapped = 'False',
    pdfxVersion = PDFX_VERSION,
  } = opts;
  if (!createDate) throw new TypeError('buildPdfXXmp: createDate (ISO string) is required');

  const meta =
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n' +
    ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
    '  <rdf:Description rdf:about=""\n' +
    '    xmlns:dc="http://purl.org/dc/elements/1.1/"\n' +
    '    xmlns:xmp="http://ns.adobe.com/xap/1.0/"\n' +
    '    xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"\n' +
    '    xmlns:pdf="http://ns.adobe.com/pdf/1.3/"\n' +
    '    xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/">\n' +
    '   <dc:title>\n' +
    '    <rdf:Alt>\n' +
    '     <rdf:li xml:lang="x-default">' + esc(title) + '</rdf:li>\n' +
    '    </rdf:Alt>\n' +
    '   </dc:title>\n' +
    '   <xmp:CreateDate>' + esc(createDate) + '</xmp:CreateDate>\n' +
    '   <xmp:ModifyDate>' + esc(modifyDate) + '</xmp:ModifyDate>\n' +
    '   <xmp:CreatorTool>' + esc(creatorTool) + '</xmp:CreatorTool>\n' +
    '   <pdf:Producer>' + esc(producer) + '</pdf:Producer>\n' +
    '   <pdf:Trapped>' + esc(trapped) + '</pdf:Trapped>\n' +
    '   <pdfxid:GTS_PDFXVersion>' + esc(pdfxVersion) + '</pdfxid:GTS_PDFXVersion>\n' +
    '   <xmpMM:DocumentID>' + esc(documentId) + '</xmpMM:DocumentID>\n' +
    '   <xmpMM:InstanceID>' + esc(instanceId) + '</xmpMM:InstanceID>\n' +
    '  </rdf:Description>\n' +
    ' </rdf:RDF>\n' +
    '</x:xmpmeta>';

  return XPACKET_BEGIN + '\n' + meta + XPACKET_PAD + XPACKET_END;
}

/** Options for {@link pdfxOutputIntentSpec}. */
export interface PdfXOutputIntentOptions {
  /** override the human-readable Info string */
  info?: string;
}

/** The OutputIntent descriptor a PDF/X-4 export should carry. */
export interface PdfXOutputIntentSpec {
  subtype: string;
  identifier: string;
  info: string;
  registry: string;
  iccBytes: Uint8Array | null;
  components: number;
}

/**
 * Describe the OutputIntent a PDF/X-4 export should carry; the shell maps the
 * fields onto pdf-lib objects (S ← subtype, OutputConditionIdentifier ←
 * identifier, Info ← info, RegistryName ← registry, DestOutputProfile ←
 * iccBytes stream with /N components).
 *
 * Conformance note: X-4 strictly wants an embedded DestOutputProfile. The
 * 'srgb' intent embeds the engine-generated profile and is fully conformant.
 * A CMYK press-condition intent (fogra39/fogra51/swop/gracol) is registry-name
 * only — no CMYK ICC bytes ship in the repo — so it is "X-4 ready", not
 * strictly conformant; the shell only CLAIMS GTS_PDFXVersion when it judges
 * that honest (its call, not this module's).
 *
 * @param kind 'srgb' | a CMYK condition name (see color.js CMYK_CONDITIONS;
 *   unknown names fall back to the default condition)
 */
export function pdfxOutputIntentSpec(
  kind: string = 'srgb',
  opts: PdfXOutputIntentOptions = {},
): PdfXOutputIntentSpec {
  if (kind === 'srgb') {
    return {
      subtype: 'GTS_PDFX',
      identifier: 'sRGB IEC61966-2.1',
      info: opts.info ?? 'sRGB IEC61966-2.1',
      registry: 'http://www.color.org',
      iccBytes: srgbIccProfile(),
      components: 3,
    };
  }
  const c = cmykCondition(kind);
  return {
    subtype: 'GTS_PDFX',
    identifier: c.identifier,
    info: opts.info ?? c.info,
    registry: c.registry,
    iccBytes: null,
    components: 4,
  };
}

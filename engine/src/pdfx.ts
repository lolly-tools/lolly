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
  /**
   * Embedded destination-profile bytes. The engine NEVER reads a profile store —
   * a caller that has the bytes (the web shell's on-device profile library)
   * supplies them, and a caller that has none (the CLI) passes nothing.
   */
  iccBytes?: Uint8Array | null;
  /** The profile's REAL channel count → the stream's /N. Required with iccBytes. */
  components?: number;
  /**
   * Override OutputConditionIdentifier. `'Custom'` is the standard's own spelling
   * for "the condition is the one the embedded profile describes, and it names no
   * registered characterization".
   */
  identifier?: string;
  /** null omits RegistryName entirely — a Custom identity names no registry. */
  registry?: string | null;
}

/** The OutputIntent descriptor a PDF/X-4 export should carry. */
export interface PdfXOutputIntentSpec {
  subtype: string;
  identifier: string;
  info: string;
  /** null → the shell writes no RegistryName key. */
  registry: string | null;
  iccBytes: Uint8Array | null;
  components: number;
}

/**
 * Describe the OutputIntent a PDF/X-4 export should carry; the shell maps the
 * fields onto pdf-lib objects (S ← subtype, OutputConditionIdentifier ←
 * identifier, Info ← info, RegistryName ← registry when non-null,
 * DestOutputProfile ← iccBytes stream with /N components).
 *
 * Conformance note: X-4 requires an EMBEDDED DestOutputProfile (referencing an
 * external one is the X-4p variant, which needs a DestOutputProfileRef dict we
 * do not write). Two routes reach that here:
 *  - 'srgb' embeds the engine-generated profile — always;
 *  - a CMYK press condition (fogra39/fogra51/swop/gracol) has NO bytes of its
 *    own, because no CMYK ICC ships in this repo. Bytes arrive only when the
 *    caller passes `iccBytes` (the web shell, from a profile the user loaded on
 *    their own device). Without them the intent is a registry NAME: still a
 *    useful statement of the press condition to a RIP, but not X-4, so the shell
 *    withholds the GTS_PDFXVersion claim. Which files may claim is the shell's
 *    call (it can see the rest of the document); this module only describes.
 *
 * @param kind 'srgb' | a CMYK condition name (see color.js CMYK_CONDITIONS;
 *   unknown names fall back to the default condition)
 */
export function pdfxOutputIntentSpec(
  kind: string = 'srgb',
  opts: PdfXOutputIntentOptions = {},
): PdfXOutputIntentSpec {
  // A supplied identity is only honoured as a whole: `identifier` given means the
  // caller derived it from the thing it is embedding (see the shell's
  // press-profile-embed), so `registry` given as null must survive the merge.
  const over = <T>(given: T | undefined, base: T): T => (given === undefined ? base : given);
  if (kind === 'srgb') {
    return {
      subtype: 'GTS_PDFX',
      identifier: over(opts.identifier, 'sRGB IEC61966-2.1'),
      info: opts.info ?? 'sRGB IEC61966-2.1',
      registry: over(opts.registry, 'http://www.color.org'),
      iccBytes: over(opts.iccBytes, srgbIccProfile()),
      components: over(opts.components, 3),
    };
  }
  const c = cmykCondition(kind);
  return {
    subtype: 'GTS_PDFX',
    identifier: over(opts.identifier, c.identifier),
    info: opts.info ?? c.info,
    registry: over(opts.registry, c.registry),
    iccBytes: over(opts.iccBytes, null),
    components: over(opts.components, 4),
  };
}

/** The facts about a profile that decide whether PDF/X may embed it. */
export interface PdfXProfileFacts {
  /** ICC header device class: 'prtr' | 'mntr' | 'scnr' | 'abst' | 'link' | 'nmcl'. */
  deviceClass: string;
  /** ICC data colour space signature, e.g. 'CMYK' or 'RGB '. */
  dataColourSpace: string;
  nChannels: number;
  /** 'major.minor.patch' as parseIccProfile reports it. */
  version: string;
}

/** Channel counts PDF's /N permits on an ICCBased-style stream. */
const N_ALLOWED = new Set([1, 3, 4]);

/**
 * May a profile with these facts be embedded as the DestOutputProfile of a
 * PDF/X output intent in `intentSpace`?
 *
 * Pure rules, stated here because what X-4 requires is the engine's business:
 *  - device class must be `prtr`. PDF/A tolerates a display profile; PDF/X does
 *    not — an output intent describes an OUTPUT device.
 *  - the profile's data space must be the intent's space. Embedding an RGB
 *    profile under a CMYK intent would produce bytes that merely *render* the
 *    condition while claiming to BE it.
 *  - /N ∈ {1,3,4}, and consistent with the space.
 *  - ICC version: v2 (any minor) or v4 up to 4.2 — the versions the PDF spec's
 *    ICC-version table reaches, and the ones preflight tools accept. v1 is
 *    rejected as obsolete, v5/iccMAX as beyond what any PDF version admits.
 */
export function pdfxProfileEligibility(
  f: PdfXProfileFacts, intentSpace: 'CMYK' | 'RGB',
): { ok: true } | { ok: false; reason: string } {
  const cls = String(f.deviceClass ?? '').trim().toLowerCase();
  if (cls !== 'prtr') {
    return { ok: false, reason: `device class ${cls || '?'} is not an output profile (prtr)` };
  }
  const space = String(f.dataColourSpace ?? '').trim().toUpperCase();
  if (space !== intentSpace) {
    return { ok: false, reason: `profile is ${space || '?'}, the output intent is ${intentSpace}` };
  }
  const n = Number(f.nChannels);
  if (!N_ALLOWED.has(n)) return { ok: false, reason: `${n} colour channels cannot be an /N value` };
  if (intentSpace === 'CMYK' && n !== 4) return { ok: false, reason: `CMYK profile with ${n} channels` };
  if (intentSpace === 'RGB' && n !== 3) return { ok: false, reason: `RGB profile with ${n} channels` };
  const m = /^(\d+)\.(\d+)/.exec(String(f.version ?? ''));
  if (!m) return { ok: false, reason: 'unreadable ICC version' };
  const [major, minor] = [Number(m[1]), Number(m[2])];
  if (major === 2) return { ok: true };
  if (major === 4 && minor <= 2) return { ok: true };
  return { ok: false, reason: `ICC version ${f.version} is outside PDF/X's range (2.x–4.2)` };
}

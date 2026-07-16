// SPDX-License-Identifier: MPL-2.0
/**
 * pptx-patch.ts — SURGICAL rebrand of an unzipped .pptx part map (Pipeline A,
 * plans/fable-new-potential-pptx.md §2.2 / track E2).
 *
 * The winning architecture for "make rebranding an existing deck EASY" is NOT
 * "parse the whole deck into a model and regenerate it" (that silently strips
 * SmartArt, charts, animations, embedded xlsx, sections — everything we don't
 * model). Instead we rewrite ONLY the brand-bearing values in the original OOXML
 * parts and pass every other byte through VERBATIM. High fidelity, deterministic,
 * fuzzable.
 *
 * Convention (established, mirrors the IDML/PDF ingest surfaces): the CALLER
 * inflates the zip. Our input is a part map — Record<path, Uint8Array|string> —
 * and we return a new map. We touch only the XML text parts we understand; media,
 * fonts, and any unknown byte stays exactly as it arrived.
 *
 * Threat model: a HOSTILE zip (same as the PDF reader). Every rewrite is a
 * string/regex-DELIMITED attribute/element edit — NOT a DOM parse — with LINEAR
 * regexes only (no nested quantifiers → no catastrophic backtracking), a per-part
 * size cap, and a "no close tag ⇒ no edit, pass through verbatim" failure mode.
 * We never emit invalid XML: we only rewrite well-formed, known attributes on
 * known elements, and an unmatched pattern leaves the bytes untouched.
 *
 * Pure + DOM-free: strings + Uint8Array only (TextDecoder/TextEncoder are the Web
 * platform globals shared by browsers and Node, like the rest of the engine).
 *
 * What it does (§2.2):
 *   1. THEME SWAP        — ppt/theme/theme*.xml: the 12 <a:clrScheme> slots + the
 *                          major/minor <a:latin> of <a:fontScheme>.
 *   2. LITERAL COLOUR    — every DrawingML-bearing part: <a:srgbClr val> and
 *                          <a:sysClr lastClr> through colorMap.
 *   3. FONT REMAP        — explicit <a:latin/ea/cs typeface> through fontMap in
 *                          slides/layouts/masters + presentation.xml + tableStyles
 *                          + charts.
 *   4. STRIP EMBEDDED    — <p:embeddedFontLst>, the ppt/fonts/*.fntdata parts, their
 *      FONTS               rels, and the [Content_Types].xml fntdata Default (a
 *                          dangling default is a "file is corrupt" repair trigger —
 *                          the three are removed together).
 */

// ─── caps (hostile-input hardening) ──────────────────────────────────────────
/** Above this a text part is passed through VERBATIM rather than rewritten —
 *  a real slide/theme part is KBs; a multi-MB one is a red flag, not a rebrand
 *  candidate. Bounds the total regex work to O(total bytes). */
const MAX_PART_CHARS = 32 * 1024 * 1024;

// ─── the plan ────────────────────────────────────────────────────────────────

/** A brand theme expressed as flat VALUES (the shell resolves these from the
 *  active brand's design tokens). Any slot omitted is left as-is in the deck. */
export interface RebrandTheme {
  dk1?: string; lt1?: string; dk2?: string; lt2?: string;
  accent1?: string; accent2?: string; accent3?: string;
  accent4?: string; accent5?: string; accent6?: string;
  hlink?: string; folHlink?: string;
  majorFont?: string; minorFont?: string;
}

export interface RebrandPlan {
  /** Overwrite the given theme colour slots + scheme fonts in every theme part. */
  theme?: RebrandTheme;
  /** Literal colour remap. Keys are UPPERCASE, hash-less RRGGBB. */
  colorMap?: Map<string, string>;
  /** Explicit-typeface remap. Keys are the exact family name (unescaped). */
  fontMap?: Map<string, string>;
  /** Remove all embedded-font machinery (list element, parts, rels, content type). */
  dropEmbeddedFonts?: boolean;
}

export interface RebrandReport {
  themesPatched: number;
  colorsRemapped: number;
  fontsRemapped: number;
  embeddedFontsStripped: number;
  slidesTouched: string[];
}

export type PartMap = Record<string, Uint8Array | string>;

// ─── text codec (only where we actually rewrite) ─────────────────────────────

const DEC = new TextDecoder('utf-8', { fatal: false });
const ENC = new TextEncoder();

/** The 12 clrScheme slot names, in schema order. */
const SLOT_ORDER = [
  'dk1', 'lt1', 'dk2', 'lt2',
  'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
  'hlink', 'folHlink',
] as const;

// ─── tiny XML entity codec (font names may contain & < > " ') ─────────────────

function xmlDecode(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#x?[0-9A-Fa-f]+;/g, (m) => {
      const hex = /^&#x/i.test(m);
      const code = Number.parseInt(m.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    })
    .replace(/&amp;/g, '&');
}
function xmlEncode(s: string): string {
  return s
    // strip chars illegal in XML 1.0 first (mirrors pptx.ts's chokepoint)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Normalise a colour to 6 upper-hex, hash-less — the well-formed `val` form. */
function hexNorm(v: string): string {
  const h = v.replace('#', '').replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase();
  return h.length === 6 ? h : h.padStart(6, '0');
}

// ─── path predicates (normalised: lower-case, no leading slash) ──────────────

const norm = (p: string) => p.replace(/^\/+/, '').toLowerCase();
const isTheme = (p: string) => /^ppt\/theme\/theme[^/]*\.xml$/.test(p);
const isSlide = (p: string) => /^ppt\/slides\/slide[^/]*\.xml$/.test(p);
const isLayout = (p: string) => /^ppt\/slidelayouts\/slidelayout[^/]*\.xml$/.test(p);
const isMaster = (p: string) => /^ppt\/slidemasters\/slidemaster[^/]*\.xml$/.test(p);
const isChart = (p: string) => /^ppt\/charts\/chart[^/]*\.xml$/.test(p);
const isDiagramColors = (p: string) => /^ppt\/diagrams\/[^/]*colors[^/]*\.xml$/.test(p);
const isPresentation = (p: string) => p === 'ppt/presentation.xml';
const isTableStyles = (p: string) => p === 'ppt/tablestyles.xml';
const isPresentationRels = (p: string) => p === 'ppt/_rels/presentation.xml.rels';
const isContentTypes = (p: string) => p === '[content_types].xml';
const isFntData = (p: string) => /^ppt\/fonts\/[^/]*\.fntdata$/.test(p);

const isColorRemapPart = (p: string) =>
  isSlide(p) || isLayout(p) || isMaster(p) || isChart(p) || isDiagramColors(p);
const isFontRemapPart = (p: string) =>
  isSlide(p) || isLayout(p) || isMaster(p) || isChart(p) || isPresentation(p) || isTableStyles(p);

// ─── the one delimited-rewrite utility + its callers ─────────────────────────

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Rewrite the VALUE of `attr` on every `<qname …>` OPENING TAG via `map` (return
 * undefined to leave a tag unchanged). Linear: the tag body match is `[^>]*`
 * (bounded by the first `>`, never crosses tags), the attr match is a single
 * `="[^"]*"` capture. An attribute value containing a raw `>` (legal but never
 * produced for these hex/typeface attrs) simply fails to match → verbatim.
 */
function rewriteTagAttr(
  xml: string,
  qname: string,
  attr: string,
  map: (raw: string) => string | undefined,
): { text: string; count: number } {
  let count = 0;
  const tagRe = new RegExp(`<${reEsc(qname)}(?=[\\s/>])[^>]*>`, 'g');
  const attrRe = new RegExp(`(\\s${reEsc(attr)}=")([^"]*)(")`);
  const text = xml.replace(tagRe, (tag) => {
    let changed = false;
    const out = tag.replace(attrRe, (whole, pre: string, val: string, post: string) => {
      const nv = map(val);
      if (nv === undefined || nv === val) return whole;
      changed = true;
      return pre + nv + post;
    });
    if (changed) count++;
    return out;
  });
  return { text, count };
}

/** Replace a clrScheme slot's colour child with a single `<a:srgbClr val="HEX"/>`.
 *  Matches `<a:SLOT …>…</a:SLOT>` (lazy body → linear); no close tag ⇒ no edit. */
function setThemeSlot(xml: string, slot: string, hex: string): { text: string; changed: boolean } {
  const re = new RegExp(`<a:${reEsc(slot)}(?=[\\s>])[^>]*>[\\s\\S]*?</a:${reEsc(slot)}>`);
  const replacement = `<a:${slot}><a:srgbClr val="${hex}"/></a:${slot}>`;
  let changed = false;
  const text = xml.replace(re, (m) => {
    if (m === replacement) return m;
    changed = true;
    return replacement;
  });
  return { text, changed };
}

/** Rewrite the FIRST <a:latin typeface> under <a:majorFont>/<a:minorFont>. The
 *  schema fixes latin as the first child of the font collection, so the first
 *  latin after the opening tag is the scheme face. */
function setSchemeFont(xml: string, which: 'major' | 'minor', face: string): { text: string; changed: boolean } {
  const enc = xmlEncode(face);
  const re = new RegExp(`(<a:${which}Font>\\s*<a:latin(?=[\\s/>])[^>]*?\\stypeface=")([^"]*)(")`);
  let changed = false;
  const text = xml.replace(re, (whole, pre: string, val: string, post: string) => {
    if (val === enc) return whole;
    changed = true;
    return pre + enc + post;
  });
  return { text, changed };
}

// ─── per-operation part rewriters ────────────────────────────────────────────

function patchTheme(xml: string, theme: RebrandTheme): { text: string; changed: boolean } {
  let text = xml;
  let changed = false;
  for (const slot of SLOT_ORDER) {
    const v = theme[slot];
    if (!v) continue;
    const r = setThemeSlot(text, slot, hexNorm(v));
    text = r.text;
    changed = changed || r.changed;
  }
  if (theme.majorFont) {
    const r = setSchemeFont(text, 'major', theme.majorFont);
    text = r.text; changed = changed || r.changed;
  }
  if (theme.minorFont) {
    const r = setSchemeFont(text, 'minor', theme.minorFont);
    text = r.text; changed = changed || r.changed;
  }
  return { text, changed };
}

function remapColors(xml: string, colorMap: Map<string, string>): { text: string; count: number } {
  const lookup = (raw: string): string | undefined => {
    const key = hexNorm(raw);
    const to = colorMap.get(key);
    return to === undefined ? undefined : hexNorm(to);
  };
  const a = rewriteTagAttr(xml, 'a:srgbClr', 'val', lookup);
  const b = rewriteTagAttr(a.text, 'a:sysClr', 'lastClr', lookup);
  return { text: b.text, count: a.count + b.count };
}

function remapFonts(xml: string, fontMap: Map<string, string>): { text: string; count: number } {
  const lookup = (raw: string): string | undefined => {
    const to = fontMap.get(xmlDecode(raw));
    return to === undefined ? undefined : xmlEncode(to);
  };
  let text = xml;
  let count = 0;
  for (const q of ['a:latin', 'a:ea', 'a:cs']) {
    const r = rewriteTagAttr(text, q, 'typeface', lookup);
    text = r.text; count += r.count;
  }
  return { text, count };
}

/** Remove the <p:embeddedFontLst>…</p:embeddedFontLst> element (or its empty
 *  self-closing form) from presentation.xml. */
function stripEmbeddedFontLst(xml: string): string {
  return xml
    .replace(/<p:embeddedFontLst(?=[\s>])[^>]*>[\s\S]*?<\/p:embeddedFontLst>/g, '')
    .replace(/<p:embeddedFontLst\s*\/>/g, '');
}

/** Drop <Relationship> entries pointing at an embedded font (Type …/font or a
 *  *.fntdata target) from presentation.xml.rels. */
function stripFontRels(xml: string): string {
  return xml.replace(/<Relationship(?=[\s/>])[^>]*\/>/g, (rel) =>
    /Type="[^"]*\/font"/.test(rel) || /Target="[^"]*\.fntdata"/i.test(rel) ? '' : rel,
  );
}

/** Remove the fntdata Default from [Content_Types].xml (a dangling default is a
 *  repair trigger, so it goes together with the parts + rels). */
function stripFntDataDefault(xml: string): string {
  return xml.replace(/<Default(?=[\s/>])[^>]*Extension="fntdata"[^>]*\/>/gi, '');
}

// ─── public entry ────────────────────────────────────────────────────────────

/**
 * Surgically rebrand an unzipped .pptx part map. Returns a NEW map (unchanged
 * parts pass through by reference — byte-identical) plus a report of what moved.
 */
export function rebrandPptxParts(
  parts: PartMap,
  plan: RebrandPlan = {},
): { parts: PartMap; report: RebrandReport } {
  const out: PartMap = {};
  const report: RebrandReport = {
    themesPatched: 0,
    colorsRemapped: 0,
    fontsRemapped: 0,
    embeddedFontsStripped: 0,
    slidesTouched: [],
  };

  const theme = plan.theme;
  const colorMap = plan.colorMap && plan.colorMap.size ? plan.colorMap : undefined;
  const fontMap = plan.fontMap && plan.fontMap.size ? plan.fontMap : undefined;
  const drop = plan.dropEmbeddedFonts === true;

  for (const [path, value] of Object.entries(parts)) {
    const p = norm(path);

    // (4a) embedded-font PARTS removed entirely.
    if (drop && isFntData(p)) {
      report.embeddedFontsStripped++;
      continue;
    }

    const inScope =
      (theme && isTheme(p)) ||
      (colorMap && isColorRemapPart(p)) ||
      (fontMap && isFontRemapPart(p)) ||
      (drop && (isPresentation(p) || isPresentationRels(p) || isContentTypes(p)));

    if (!inScope) {
      out[path] = value; // untouched → byte-identical
      continue;
    }

    // Decode to text only for parts we will actually consider rewriting.
    const original = typeof value === 'string' ? value : DEC.decode(value);
    if (original.length > MAX_PART_CHARS) {
      out[path] = value; // hostile-size backstop: pass through verbatim
      continue;
    }

    let text = original;

    if (theme && isTheme(p)) {
      const r = patchTheme(text, theme);
      text = r.text;
      if (r.changed) report.themesPatched++;
    }
    if (colorMap && isColorRemapPart(p)) {
      const r = remapColors(text, colorMap);
      text = r.text; report.colorsRemapped += r.count;
    }
    if (fontMap && isFontRemapPart(p)) {
      const r = remapFonts(text, fontMap);
      text = r.text; report.fontsRemapped += r.count;
    }
    if (drop && isPresentation(p)) text = stripEmbeddedFontLst(text);
    if (drop && isPresentationRels(p)) text = stripFontRels(text);
    if (drop && isContentTypes(p)) text = stripFntDataDefault(text);

    if (text === original) {
      out[path] = value; // no change → keep the exact original bytes/string
      continue;
    }

    if (isSlide(p)) report.slidesTouched.push(path);
    // Preserve the caller's representation: bytes in → bytes out, string → string.
    out[path] = typeof value === 'string' ? text : ENC.encode(text);
  }

  return { parts: out, report };
}

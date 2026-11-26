// SPDX-License-Identifier: MPL-2.0
/**
 * Fallback fonts: the fonts that draw characters a design system's own fonts cannot,
 * so an export keeps those words as vector outlines.
 *
 * They live in the shared asset root community/fallback-fonts, one catalog entry per
 * font with a `meta.fallbackFont` record (scripts/import-fallback-fonts.ts writes them).
 * Both shells read the same entries and make the same choices here, so a run outlines
 * the same way on the web, in the CLI and in the MCP render route. Pure: no DOM, no
 * network, no file system.
 *
 * Three rules hold throughout:
 *
 * - A brand font always wins for any character it covers. A fallback font is chosen only
 *   for a grapheme cluster that no face before it can draw whole.
 * - Nothing is chosen for text the brand covers, so a run its fonts draw keeps exactly
 *   the chain, and the bytes, it had before.
 * - A cluster no fallback font covers is reported; the caller keeps the answer it had for
 *   those characters (a picture in a PDF, live text in an SVG).
 *
 * Chinese, Japanese and Korean share the Han characters but draw many of them
 * differently. One run takes every Han character from one of those fonts only, the one
 * `hanForms` picks from the run's language, then its script, then a stated default.
 * See docs/fallback-fonts.md.
 */
import { emojiGraphemes } from '../../../engine/src/emoji-segment.ts';
import { textScriptRuns } from '../../../engine/src/text-unicode.ts';
import { parseUnicodeRange } from './font-faces.ts';

/** The language whose forms a Chinese, Japanese or Korean fallback font draws Han characters in. */
export type HanForm = 'zh-Hans' | 'zh-Hant' | 'ja' | 'ko';
const HAN_FORMS: readonly string[] = ['zh-Hans', 'zh-Hant', 'ja', 'ko'];

/** The block whose coverage a Chinese, Japanese or Korean pack records as a bitmap. */
const IDEOGRAPHS_FROM = 0x4E00;
const IDEOGRAPHS_TO = 0x9FFF;

/** One fallback font, as described by its catalog entry. */
export interface FallbackFontPack {
  id: string;
  version: string;
  /** The family name inside the file, e.g. `Noto Sans Arabic`. */
  family: string;
  /** What it fills, in words: `Arabic`. */
  label: string;
  /** ISO 15924 codes this font is chosen for. */
  scripts: string[];
  style: 'normal' | 'italic';
  /** The CSS weight range of the file's `wght` axis, `100 900`. */
  weight: string;
  /** The characters this font is chosen for, as a CSS unicode-range. */
  claims: string;
  /** Every character the file maps. */
  covers: string;
  url: string;
  format: string;
  checksum?: string;
  size?: number;
  /** For a Chinese, Japanese or Korean font: the language whose Han forms it draws. */
  han?: HanForm;
  /**
   * Which code points of U+4E00 to U+9FFF the file maps, one bit each, lowest first. The
   * block is listed whole in `claims` and `covers`; this says which of it is really there.
   */
  ideographs?: Uint8Array;
}

/** Base64 to bytes, without reaching for a platform decoder. */
function fromBase64(text: string): Uint8Array | null {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = text.replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(clean)) return null;
  const out = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let acc = 0, bits = 0, at = 0;
  for (const ch of clean) {
    acc = (acc << 6) | ALPHABET.indexOf(ch);
    bits += 6;
    if (bits >= 8) { bits -= 8; out[at++] = (acc >> bits) & 0xff; }
  }
  return out;
}

/** A pack's ideograph bitmap, when its entry carries one for exactly the block it lists. */
function ideographsOf(meta: Record<string, unknown>): Uint8Array | undefined {
  const raw = meta.ideographs as { range?: unknown; bits?: unknown } | undefined;
  if (raw?.range !== 'U+4E00-9FFF' || typeof raw.bits !== 'string') return undefined;
  const bits = fromBase64(raw.bits);
  return bits && bits.length * 8 >= IDEOGRAPHS_TO - IDEOGRAPHS_FROM + 1 ? bits : undefined;
}

interface PackEntry {
  id?: unknown; version?: unknown; formats?: Array<{ format?: unknown; url?: unknown; checksum?: unknown; size?: unknown }>;
  meta?: { fallbackFont?: Record<string, unknown> } | null;
}

/** The fallback fonts among catalog entries, in index order. Anything malformed is skipped. */
export function fallbackPacksFrom(entries: readonly unknown[]): FallbackFontPack[] {
  const out: FallbackFontPack[] = [];
  for (const raw of entries) {
    const entry = raw as PackEntry;
    const meta = entry?.meta?.fallbackFont;
    const format = entry?.formats?.[0];
    if (!meta || typeof entry.id !== 'string' || typeof entry.version !== 'string' || typeof format?.url !== 'string') continue;
    const { family, label, scripts, style, weight, claims, covers, han } = meta as Record<string, unknown>;
    if (typeof family !== 'string' || typeof label !== 'string' || !Array.isArray(scripts) || typeof claims !== 'string' || typeof covers !== 'string') continue;
    // A Chinese, Japanese or Korean entry without its bitmap would claim the whole block.
    const ideographs = ideographsOf(meta as Record<string, unknown>);
    if (han !== undefined && (typeof han !== 'string' || !HAN_FORMS.includes(han) || !ideographs)) continue;
    out.push({
      id: entry.id,
      version: entry.version,
      family,
      label,
      scripts: scripts.filter((s): s is string => typeof s === 'string'),
      style: style === 'italic' ? 'italic' : 'normal',
      weight: typeof weight === 'string' ? weight : '400',
      claims,
      covers,
      url: format.url,
      format: typeof format.format === 'string' ? format.format : 'woff2',
      ...(typeof format.checksum === 'string' ? { checksum: format.checksum } : {}),
      ...(typeof format.size === 'number' ? { size: format.size } : {}),
      ...(typeof han === 'string' ? { han: han as HanForm } : {}),
      ...(ideographs ? { ideographs } : {}),
    });
  }
  return out;
}

/** Characters that never need a glyph of their own: spaces, controls and default ignorables. */
const QUIET = /^[\p{Cc}\p{Z}\p{Default_Ignorable_Code_Point}]$/u;
/** A space character, which takes a face of its own rather than the face before the space. */
const SPACE = /^\p{Zs}$/u;
const isQuiet = (cp: number): boolean => QUIET.test(String.fromCodePoint(cp));

/** The code points of a cluster that have to be drawn. */
function drawn(cluster: string): number[] {
  const out: number[] = [];
  for (const ch of cluster) { const cp = ch.codePointAt(0)!; if (!isQuiet(cp)) out.push(cp); }
  return out;
}

/** Grapheme clusters, by the engine's pinned rules; past its length limit, one per code point. */
function clusters(text: string): Array<{ text: string; start: number }> {
  try { return emojiGraphemes(text).map(({ text: t, start }) => ({ text: t, start })); }
  catch {
    const out: Array<{ text: string; start: number }> = [];
    let at = 0;
    for (const ch of text) { out.push({ text: ch, start: at }); at += ch.length; }
    return out;
  }
}

/** A set of code points a face draws. */
export type Coverage = ReadonlySet<number> | { has(cp: number): boolean };

const coversAll = (cover: Coverage, cps: readonly number[]): boolean => cps.every((cp) => cover.has(cp));

/** A grapheme cluster no face drew, with the script of the run it sits in. */
export interface FillCluster { text: string; start: number; script: string }

/**
 * The clusters of `text` that no single face in `faces` can draw whole. Empty for text the
 * faces cover, which is the common case and costs one pass over the characters.
 */
export function uncoveredClusters(text: string, faces: readonly Coverage[]): FillCluster[] {
  let anyMissing = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (!isQuiet(cp) && !faces.some((f) => f.has(cp))) { anyMissing = true; break; }
  }
  const out: FillCluster[] = [];
  const pending: Array<{ text: string; start: number }> = [];
  for (const c of clusters(text)) {
    const cps = drawn(c.text);
    if (!cps.length) continue;
    // A cluster whose characters are each covered can still split across two faces, the
    // way a base letter and its accent would; only a face drawing all of it will do.
    if (!anyMissing && cps.length === 1) continue;
    if (!faces.some((f) => coversAll(f, cps))) pending.push(c);
  }
  if (!pending.length) return out;
  const runs = textScriptRuns(text);
  for (const c of pending) {
    const run = runs.find((r) => c.start >= r.start && c.start < r.end);
    out.push({ ...c, script: run?.script ?? 'Zyyy' });
  }
  return out;
}

const rangesOf = new Map<string, Array<[number, number]>>();
function ranges(spec: string): Array<[number, number]> {
  let hit = rangesOf.get(spec);
  if (!hit) { hit = parseUnicodeRange(spec); rangesOf.set(spec, hit); }
  return hit;
}
const inRanges = (list: Array<[number, number]>, cp: number): boolean => {
  let lo = 0, hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [a, b] = list[mid]!;
    if (cp < a) hi = mid - 1; else if (cp > b) lo = mid + 1; else return true;
  }
  return false;
};

/** A code point of a pack's range list, refined by its ideograph bitmap inside that block. */
function mapsPoint(pack: FallbackFontPack, list: Array<[number, number]>, cp: number): boolean {
  if (pack.ideographs && cp >= IDEOGRAPHS_FROM && cp <= IDEOGRAPHS_TO) {
    const i = cp - IDEOGRAPHS_FROM;
    return ((pack.ideographs[i >> 3]! >> (i & 7)) & 1) === 1;
  }
  return inRanges(list, cp);
}

/** Does this pack's file map every one of these characters? */
export function packCovers(pack: FallbackFontPack, cps: readonly number[]): boolean {
  const list = ranges(pack.covers);
  return cps.every((cp) => mapsPoint(pack, list, cp));
}

/** Is this character one the pack is chosen for (its own script, not a shared space or digit)? */
export function packClaims(pack: FallbackFontPack, cp: number): boolean {
  return mapsPoint(pack, ranges(pack.claims), cp);
}

// ── Chinese, Japanese and Korean: which font draws a run's Han characters ────

/** The scripts whose clusters a Chinese, Japanese or Korean font may draw. */
const CJK_SCRIPTS = new Set(['Hani', 'Hira', 'Kana', 'Hang', 'Bopo']);
const KANA = /^[\p{Script=Hiragana}\p{Script=Katakana}]$/u;
const HANGUL = /^\p{Script=Hangul}$/u;
const HAN = /^\p{Script=Han}$/u;
/** Any character a Chinese, Japanese or Korean run can hold, punctuation included. */
const CJK_ANY = /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}\p{scx=Bopomofo}]/u;

/** Does this text hold anything a Chinese, Japanese or Korean font would be chosen for? */
export function hasCjk(text: string): boolean { return CJK_ANY.test(text); }

/**
 * The Han forms a BCP 47 language tag asks for, or null for a tag that gives no Chinese,
 * Japanese or Korean (or none at all). Chinese is Traditional for the Hant script and for
 * Taiwan, Hong Kong and Macao, and for Cantonese; otherwise Simplified.
 */
export function hanFormOfLang(lang: string | null | undefined): HanForm | null {
  if (!lang) return null;
  const [primary, ...rest] = lang.trim().toLowerCase().replace(/_/g, '-').split('-');
  if (primary === 'ja') return 'ja';
  if (primary === 'ko') return 'ko';
  if (primary !== 'zh' && primary !== 'cmn' && primary !== 'yue') return null;
  if (rest.includes('hant')) return 'zh-Hant';
  if (rest.includes('hans')) return 'zh-Hans';
  if (primary === 'yue' || rest.some((r) => r === 'tw' || r === 'hk' || r === 'mo' || r === 'yue')) return 'zh-Hant';
  return 'zh-Hans';
}

/** What a stretch of text shows about its language, for `hanForms`. */
export interface HanEvidence {
  /** Which of kana and Hangul comes first, if either does. */
  first: 'ja' | 'ko' | null;
  kana: boolean;
  hangul: boolean;
  /** A Han character only the Traditional Chinese font has. */
  traditional: boolean;
  /** A Han character only the Simplified Chinese font has. */
  simplified: boolean;
}

/** Read `text` for kana, Hangul, and Han characters only one form of Chinese writes. */
export function hanEvidence(text: string, packs: readonly FallbackFontPack[]): HanEvidence {
  const out: HanEvidence = { first: null, kana: false, hangul: false, traditional: false, simplified: false };
  const sc = packs.find((p) => p.han === 'zh-Hans');
  const tc = packs.find((p) => p.han === 'zh-Hant');
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    // Nothing below the Hangul jamo is evidence; most text ends its check here.
    if (cp < 0x1100) continue;
    if (KANA.test(ch)) { out.kana = true; out.first ??= 'ja'; }
    else if (HANGUL.test(ch)) { out.hangul = true; out.first ??= 'ko'; }
    else if (sc && tc && HAN.test(ch)) {
      const s = packCovers(sc, [cp]), t = packCovers(tc, [cp]);
      if (t && !s) out.traditional = true;
      else if (s && !t) out.simplified = true;
    }
  }
  return out;
}

/** What `hanForms` reads for one run. */
export interface HanContext {
  /**
   * The run's language: the `lang` of its element or of the nearest ancestor that has
   * one, inside the document being drawn (`runLang`). The app's own language and the
   * design system's never count.
   */
  lang?: string | null;
  /** The run's own text. */
  text?: string;
  /** What the whole document's text shows (`hanEvidence`), when the caller has read the document. */
  document?: HanEvidence | null;
}

/**
 * Which Chinese, Japanese or Korean font draws a run's Han characters, first choice first.
 *
 * 1. The run's language, when it names Chinese, Japanese or Korean.
 * 2. Its script: kana means Japanese and Hangul means Korean, read in the run first, then
 *    in the whole document when the document holds only one of the two.
 * 3. A Han character that only Traditional Chinese writes, in the run and then in the
 *    document, means Traditional Chinese, unless the same text holds one only
 *    Simplified Chinese writes.
 * 4. Otherwise Simplified Chinese.
 *
 * The first answer draws the run's Han characters. When the run also holds kana or Hangul
 * that font cannot draw, Japanese or Korean follows it in the list, for those letters
 * only (`choosePacks` keeps every Han character away from that font). The answer depends on the
 * document alone, never on who exports it or in which app language, so every export of
 * it is the same.
 */
export function hanForms(ctx: HanContext | undefined, packs: readonly FallbackFontPack[]): HanForm[] {
  const run = hanEvidence(ctx?.text ?? '', packs);
  const doc = ctx?.document;
  const traditional = (run.traditional && !run.simplified) || (!run.simplified && Boolean(doc?.traditional) && !doc?.simplified);
  const first: HanForm = hanFormOfLang(ctx?.lang)
    ?? run.first
    ?? (doc && doc.kana !== doc.hangul ? (doc.kana ? 'ja' : 'ko') : null)
    ?? (traditional ? 'zh-Hant' : 'zh-Hans');
  const forms: HanForm[] = [first];
  // Kana before Hangul when the run shows both, in the order they first appear.
  const letters: HanForm[] = run.first === 'ko' ? ['ko', 'ja'] : ['ja', 'ko'];
  for (const form of letters) if (form !== first && (form === 'ja' ? run.kana : run.hangul)) forms.push(form);
  return forms;
}

/** An element as `runLang` reads it: any DOM, the browser's or jsdom's. */
export interface LangElement {
  getAttribute(name: string): string | null;
  getAttributeNS?(namespace: string, name: string): string | null;
  readonly parentElement: LangElement | null;
  readonly ownerDocument?: { readonly documentElement?: unknown } | null;
}

/**
 * A run's language: the `lang` (or `xml:lang`) of its element or the nearest ancestor that
 * has one. The page's root element carries the app's own language, which is the person's
 * and not the document's, so the search ends before the root element. Null when nothing says.
 */
export function runLang(el: LangElement | null | undefined): string | null {
  for (let e = el; e; e = e.parentElement) {
    if (e === e.ownerDocument?.documentElement) return null;
    const lang = e.getAttribute('lang') ?? e.getAttributeNS?.('http://www.w3.org/XML/1998/namespace', 'lang') ?? null;
    if (lang !== null) return lang;
  }
  return null;
}

/**
 * Which packs fill these clusters, in the order they were first needed, and which clusters
 * none can. A cluster takes a pack made for its script first, then any pack that maps the cluster.
 * An italic run takes an italic pack where one exists, else the upright one: Arabic,
 * Hebrew, the Indic scripts and Thai have no italic, and a browser slants nothing for them
 * in a face that has none of its own either.
 *
 * Chinese, Japanese and Korean fonts follow `han` (from `hanForms`): only a Chinese,
 * Japanese or Korean cluster takes one, and only the first form's font draws Han
 * characters, so no word mixes two of them. A Han character that font lacks stays
 * unfilled. A later form's font takes only the kana or Hangul the first cannot draw, and
 * is left out when it would also draw a Han character the first lacks.
 */
export function choosePacks(found: readonly FillCluster[], packs: readonly FallbackFontPack[], italic: boolean, han: readonly HanForm[] = ['zh-Hans']): { packs: FallbackFontPack[]; unfilled: FillCluster[] } {
  const chosen: FallbackFontPack[] = [];
  const unfilled: FillCluster[] = [];
  const styled = (list: readonly FallbackFontPack[]): FallbackFontPack[] => {
    if (!italic) return list.filter((p) => p.style === 'normal');
    // Per script, the italic file when there is one.
    const out: FallbackFontPack[] = [];
    for (const p of list) {
      if (p.style === 'italic') { out.push(p); continue; }
      const twin = list.some((q) => q.style === 'italic' && q.scripts.join() === p.scripts.join());
      if (!twin) out.push(p);
    }
    return out;
  };
  const usable = styled(packs);
  const plain = usable.filter((p) => !p.han);
  const [primary, ...others] = han.map((form) => usable.find((p) => p.han === form)).filter((p): p is FallbackFontPack => Boolean(p));
  const withPrimary = primary ? [...plain, primary] : plain;
  // A later form's font draws only kana or Hangul, and never when it would also be the
  // first face in the chain to map a Han character the first form's font lacks.
  const lacking = primary ? found.filter((c) => CJK_SCRIPTS.has(c.script) && drawn(c.text).some((cp) => HAN.test(String.fromCodePoint(cp))) && !packCovers(primary, drawn(c.text))) : [];
  const secondary = others.filter((p) => !lacking.some((c) => packCovers(p, drawn(c.text))));
  for (const c of found) {
    const cps = drawn(c.text);
    // Only a Chinese, Japanese or Korean cluster may take one of their fonts, so a symbol
    // in an English line never downloads one.
    const cjk = CJK_SCRIPTS.has(c.script);
    const candidates = cjk ? withPrimary : plain;
    const own = candidates.filter((p) => p.scripts.includes(c.script) && packCovers(p, cps));
    let pack = own[0] ?? candidates.find((p) => packCovers(p, cps));
    if (!pack && cjk && !cps.some((cp) => HAN.test(String.fromCodePoint(cp)))) pack = secondary.find((p) => packCovers(p, cps));
    if (!pack) { unfilled.push(c); continue; }
    if (!chosen.includes(pack)) chosen.push(pack);
  }
  // The first form's font goes before any later one, so the chain gives it every Han
  // character both could draw.
  const later = (p: FallbackFontPack): boolean => others.includes(p);
  return { packs: [...chosen.filter((p) => !later(p)), ...chosen.filter(later)], unfilled };
}

/** A face in a shaping chain, as toPath sees it: what it maps, and whether it only fills. */
export interface ChainFace { unicodes: Coverage; fill?: boolean }

/**
 * Split `text` into runs one face draws, for a chain that holds a fill face. Each grapheme
 * cluster goes to the first face that maps all of it, so a brand face keeps every
 * character it can draw and a fill face takes only what came before it could not. A space
 * goes to the first face that maps it, as in a browser, and a joiner stays with its cluster. A
 * cluster no face covers stays with the current face and shapes as `.notdef`, which the
 * caller counts.
 *
 * Only for a chain with a fill face: a chain without one keeps the older rule in each
 * shell, which leaves every existing outline as it was.
 */
export function fillSegments(text: string, chain: readonly ChainFace[]): Array<{ text: string; face: number }> {
  const segs: Array<{ text: string; face: number }> = [];
  let cur = 0;
  for (const c of clusters(text)) {
    const cps = drawn(c.text);
    if (cps.length) {
      let at = chain.findIndex((f) => coversAll(f.unicodes, cps));
      if (at === -1) at = chain.findIndex((f) => f.unicodes.has(cps[0]!));
      if (at !== -1) cur = at;
    } else {
      // A space between two words a fill face draws is drawn by the first face that maps
      // it, as Chrome does: measured, the browser's line is narrower by exactly the
      // difference between the brand's space and the fallback font's, once per space.
      const spaces = [...c.text].map((ch) => ch.codePointAt(0)!).filter((cp) => SPACE.test(String.fromCodePoint(cp)));
      if (spaces.length) {
        const at = chain.findIndex((f) => coversAll(f.unicodes, spaces));
        if (at !== -1) cur = at;
      }
    }
    const last = segs[segs.length - 1];
    if (last && last.face === cur) last.text += c.text;
    else segs.push({ text: c.text, face: cur });
  }
  return segs;
}

/** What a fill drew, for the notice: one entry per pack, in first-use order. */
export interface FillUse { label: string; family: string }

/**
 * The sentence an export shows when a fallback font drew some of its text, or null.
 * Plain words, one sentence, giving each script and the font that drew those letters.
 */
export function fillNotice(uses: readonly FillUse[]): string | null {
  const seen = new Set<string>();
  const list = uses.filter((u) => {
    const key = `${u.label}\u0000${u.family}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!list.length) return null;
  const clause = (u: FillUse, first: boolean): string => {
    if (u.label === 'Latin') return first ? `Some Latin letters are drawn with ${u.family}` : `some Latin letters with ${u.family}`;
    return first ? `${u.label} text is drawn with ${u.family}` : `${u.label} text with ${u.family}`;
  };
  const parts = list.map((u, i) => clause(u, i === 0));
  const joined = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${joined}, because this design system's fonts do not have those letters.`;
}

/** The characters a pack is chosen for, as code points. */
export function claimedPoints(pack: FallbackFontPack): number[] {
  const out: number[] = [];
  const list = ranges(pack.claims);
  for (const [lo, hi] of list) for (let cp = lo; cp <= hi; cp++) if (mapsPoint(pack, list, cp)) out.push(cp);
  return out;
}

/** Sorted code points as a CSS unicode-range, consecutive runs folded. Empty for none. */
export function unicodeRangeOf(points: readonly number[]): string {
  const sorted = [...new Set(points)].sort((a, b) => a - b);
  const hex = (n: number): string => n.toString(16).toUpperCase();
  const out: string[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    out.push(i === j ? `U+${hex(sorted[i]!)}` : `U+${hex(sorted[i]!)}-${hex(sorted[j]!)}`);
    i = j + 1;
  }
  return out.join(',');
}

/** Weight variations for a pack at a run's CSS weight, clamped to the file's axis. */
export function packVariations(pack: FallbackFontPack, weight: number): string[] {
  const [lo, hi] = pack.weight.split(/\s+/).map(Number);
  const w = Number.isFinite(weight) && weight > 0 ? weight : 400;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [`wght=${w}`];
  return [`wght=${Math.min(hi!, Math.max(lo!, w))}`];
}

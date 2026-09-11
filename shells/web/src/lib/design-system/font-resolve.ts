// SPDX-License-Identifier: MPL-2.0
/**
 * font-resolve.ts - the pure family-name resolver of plan 97 section 7.2 (gap 3).
 *
 * A face discovered inside a PDF or on a website arrives as one string and
 * nothing else: "ABCDEF+Inter-SemiBold", "HelveticaNeue-Bold",
 * "RobotoCondensed-LightItalic". Until that string is split into a family, a
 * weight and a slant it is a dead end - it cannot be compared on the specimen
 * stage, cannot be matched against Google Fonts, and cannot be assigned a role.
 * This module does the splitting, and only the splitting: no DOM, no network,
 * no state. The Type room decides what to DO with the result.
 *
 * Three honesty rules run through it:
 *
 *  1. **A guess is labelled a guess.** The weight and slant come from words in
 *     a name, not from the font program. `parseFaceName` reads what the name
 *     SAYS. Where the bytes are in hand the file always wins, and the one
 *     reading of the file that lives here is `variableWeightRange` - the `fvar`
 *     axis a name cannot state (see its note for why it is here and not in
 *     `font-utils.ts`).
 *  2. **A lookalike is never the font.** `googleMatch` returns a Google family
 *     only when it IS that family under a different spelling. Arial is metric
 *     compatible with Helvetica; it is not Helvetica, so asking for Helvetica
 *     returns null. See METRIC_LOOKALIKES.
 *  3. **"unknown" stays unknown.** `describeFaceSource` reports the subset and
 *     embedding facts a source actually stated and invents nothing to fill a
 *     gap. Absence of a licence signal is itself the signal.
 *
 * Known limitation, stated rather than papered over: a family whose own name
 * ends in a weight word parses that word as the weight. "Archivo Black" reads
 * as family "Archivo" at 900, because a catalogue-free parser cannot tell a
 * family word from a style word. Callers that have a
 * catalogue should try `googleMatch(raw)` on the whole spelled name FIRST and
 * fall back to `googleMatch(parseFaceName(raw).family)` - the test suite pins
 * that two step order.
 */

import { POPULAR_FAMILIES } from '../google-fonts.ts';

/** What a face NAME says about the face. Every field is a reading, not a measurement. */
export interface ParsedFaceName {
  /**
   * Human spelling of the family: "Helvetica Neue", "Roboto Condensed".
   *
   * Best effort on word boundaries - "JetBrainsMono" comes back as "Jet Brains
   * Mono", because camelCase alone cannot say which capital starts a new word.
   * `googleMatch` ignores spacing entirely, so a mis-spaced family still
   * resolves; only the label shown to a person is affected, and they can retype
   * it.
   */
  family: string;
  /** CSS weight the name states, 400 when it states none. */
  weight: number;
  /** True for Italic and for Oblique (CSS's two slants collapse to one flag here). */
  italic: boolean;
  /** Present and true only when a width word was found. The word STAYS in the family. */
  condensed?: boolean;
}

/** What a source said about the bytes behind a face. Both fields are optional: unsaid is unknown. */
export interface FaceSourceMeta {
  /** The document embedded only the glyphs it printed (PDF section 9.6.4 "ABCDEF+" marker). */
  subset?: boolean;
  /** The font's own OS/2 fsType permission, as `font-utils.ts` reports it. */
  embedding?: string;
}

/** Chip labels for the compare stage, in display order. */
export interface FaceSourceChips {
  chips: string[];
}

// ── Name tokens ──────────────────────────────────────────────────────────────

/**
 * Weight words → CSS weights. Compound keys are listed whole as well as split,
 * because "ExtraBold" arrives as one token from a hyphenated name and as two
 * from camelCase; MODIFIERS below rejoins the split form.
 *
 * 350 for SemiLight is not on the 100..900 ladder because the ladder has no rung
 * for it and CSS accepts any integer. Rounding it to 300 would claim the name
 * said Light, which it did not.
 *
 * "Roman" is deliberately ABSENT. It is an upright marker in PostScript names
 * ("Times-Roman"), but it is also the last word of the most common face name in
 * existence, and a table entry would turn "TimesNewRomanPSMT" into the family
 * "Times New". Leaving it in the family costs nothing: Roman means upright at
 * normal weight, which is the default this function already returns.
 */
const WEIGHTS: Readonly<Record<string, number>> = {
  thin: 100, hairline: 100,
  extralight: 200, ultralight: 200, extlight: 200,
  light: 300,
  semilight: 350, demilight: 350,
  regular: 400, normal: 400, book: 400, plain: 400,
  medium: 500,
  semibold: 600, demibold: 600, semi: 600, demi: 600,
  bold: 700,
  extrabold: 800, ultrabold: 800,
  black: 900, heavy: 900, ultra: 900, ultrablack: 900, extrablack: 900,
  fat: 900, poster: 900,
};

/** Words that only qualify the word after them ("Extra" + "Bold"). */
const MODIFIERS = new Set(['extra', 'ultra', 'semi', 'demi', 'ext']);

/** Slant words. "Oblique" is a slanted upright, but ParsedFaceName has one slant flag. */
const ITALICS = new Set(['italic', 'italics', 'ital', 'it', 'oblique', 'obl']);

/**
 * Width words, kept in the family and normalised to their long spelling - 
 * Google's own family names carry the width ("Roboto Condensed", "Archivo
 * Narrow"), so dropping it would resolve a condensed face to the wrong file.
 * The `condensed` flag is for callers that want to fold width themselves.
 */
const WIDTHS: Readonly<Record<string, string>> = {
  condensed: 'Condensed', cond: 'Condensed', cnd: 'Condensed',
  semicondensed: 'SemiCondensed', extracondensed: 'ExtraCondensed',
  ultracondensed: 'UltraCondensed',
  narrow: 'Narrow', compressed: 'Compressed',
};

/**
 * Format and foundry markers that are never part of a family: Monotype's "MT",
 * PostScript's "PS"/"PSMT", and the variable-font suffixes a build tool bakes
 * into the family name ("InterVariable", "IBMPlexSansVar").
 */
const NOISE = new Set(['mt', 'ps', 'psmt', 'variable', 'vf', 'var']);

/** File extensions a dropped file carries into its face name. */
const FONT_EXT_RE = /\.(?:ttf|otf|woff2?|eot|pfb|pfa|cff|ttc)$/i;
/** The PDF subset marker: six capitals and a plus (PDF 32000-1 section 9.6.4). */
const SUBSET_PREFIX_RE = /^[A-Z]{6}\+/;
/** A three digit weight written as a number: "Roboto700", "Inter 600". */
const NUMERIC_WEIGHT_RE = /^(?:[1-9]00|1000)$/;

/** CSS's own default weight, used when a name states none. */
const DEFAULT_WEIGHT = 400;

/**
 * Split a face name into words. Handles the four spellings that actually turn
 * up: hyphenated ("Inter-SemiBold"), underscored ("Open_Sans_Bold"), spaced
 * ("Helvetica Neue Bold") and camelCase ("HelveticaNeueBold").
 *
 * The digit rule is deliberately narrow - only lowercase→digit splits, so
 * "Exo2" becomes "Exo 2" while "B612" stays one word.
 */
function tokenize(raw: string): string[] {
  let s = String(raw ?? '').normalize('NFKC').trim();
  s = s.replace(/^["'“‘]+|["'”’]+$/g, '').trim();
  s = s.replace(FONT_EXT_RE, '');
  s = s.replace(SUBSET_PREFIX_RE, '');
  s = s.replace(/[_+.]+/g, ' ');
  s = s.replace(/[-‐–-]+/g, ' ');
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  s = s.replace(/([a-z])(\d)/g, '$1 $2');
  return s.split(/\s+/).filter(Boolean);
}

/**
 * Read a table with own-property semantics. A plain object literal answers to
 * "constructor" and "toString" through its prototype, and a face name is
 * untrusted text from a document, so every table lookup here goes through this.
 */
function lookup<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

/** Title-case a word only when it has no case of its own ("inter" → "Inter", "PLUS" stays). */
const spell = (token: string): string =>
  /[A-Z]/.test(token) ? token : token.charAt(0).toUpperCase() + token.slice(1);

/**
 * Read a face name. Weight words, slant words and format noise are lifted out;
 * whatever is left, in its original order, is the family.
 *
 * Style words are only lifted while at least one other word remains - a name
 * that is nothing BUT style words ("Bold") keeps its word as the family rather
 * than resolving to an empty string.
 */
export function parseFaceName(raw: string): ParsedFaceName {
  const tokens = tokenize(raw);
  if (!tokens.length) return { family: '', weight: DEFAULT_WEIGHT, italic: false };

  const familyWords: string[] = [];
  let weight: number | null = null;
  let italic = false;
  let condensed = false;
  // Words that were consumed as style, kept so an all-style name can put them back.
  const consumed: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] as string;
    const key = token.toLowerCase();

    // "Extra" + "Bold" is one weight word split by the camelCase pass.
    if (MODIFIERS.has(key) && i + 1 < tokens.length) {
      const joined = key + (tokens[i + 1] as string).toLowerCase();
      const joinedWeight = lookup(WEIGHTS, joined);
      if (joinedWeight !== undefined) {
        weight = joinedWeight;
        consumed.push(token, tokens[i + 1] as string);
        i++;
        continue;
      }
      const joinedWidth = lookup(WIDTHS, joined);
      if (joinedWidth !== undefined) {
        condensed = true;
        familyWords.push(joinedWidth);
        i++;
        continue;
      }
    }

    const named = lookup(WEIGHTS, key);
    if (named !== undefined) { weight = named; consumed.push(token); continue; }

    if (NUMERIC_WEIGHT_RE.test(key)) { weight = Number(key); consumed.push(token); continue; }

    if (ITALICS.has(key)) { italic = true; consumed.push(token); continue; }

    const width = lookup(WIDTHS, key);
    if (width !== undefined) { condensed = true; familyWords.push(width); continue; }

    if (NOISE.has(key)) { consumed.push(token); continue; }

    familyWords.push(token);
  }

  const words = familyWords.length ? familyWords : consumed;
  const family = words.map(spell).join(' ');
  return {
    family,
    weight: weight ?? DEFAULT_WEIGHT,
    italic,
    ...(condensed ? { condensed: true } : {}),
  };
}

// ── What the font PROGRAM says about its weight ──────────────────────────────

/** `fvar`'s per-axis record: tag(4) min(4) default(4) max(4) flags(2) nameID(2). */
const FVAR_AXIS_SIZE = 20;
/** CSS's own bounds for a weight. A file that states something outside them is
 *  stating something CSS cannot express, so the range is not used. */
const WEIGHT_MIN = 1;
const WEIGHT_MAX = 1000;

/** Read a 4-byte tag at `offset` without allocating a view per call. */
function tagAt(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3),
  );
}

/**
 * The `wght` axis range a VARIABLE font declares, as a CSS weight descriptor
 * ("100 900"), or null for a static face.
 *
 * Why this matters: `OS/2.usWeightClass` - the only weight `parseFontMetadata`
 * reads - describes the font's DEFAULT INSTANCE, not the file. Outfit[wght].ttf
 * says 100 there while carrying every weight from 100 to 900, so storing (and
 * registering) that face as `weight: '100'` pins the whole app to Thin and makes
 * every other weight a browser-synthesised fake. The `fvar` table is where the
 * file states the truth, and it is the same shape css2 hands the Google path,
 * which is why the answer is spelled as a css2 descriptor here.
 *
 * It lives in this module rather than in `font-utils.ts` for one reason: that
 * file's `FontMetadata` is a fixed-shape record with a dozen readers (the upload
 * validator, the font registry, the brand editor, the export path), and widening
 * it would change what all of them get. This is an ADDITIVE read, used by the two
 * callers that care - the bytes install path and the compare stage.
 *
 * Pure and defensive: a truncated table, a nonsense axis count or a range CSS
 * cannot express all return null rather than a half-read number. Only an sfnt is
 * readable - a WOFF/WOFF2 wrapper hides the table directory, exactly as it hides
 * `OS/2` from `readFontEmbedding`.
 */
export function variableWeightRange(buffer: ArrayBuffer): string | null {
  try {
    if (buffer.byteLength < 12) return null;
    const view = new DataView(buffer);
    const numTables = view.getUint16(4, false);
    let fvar = 0;
    for (let i = 0, off = 12; i < numTables && off + 16 <= buffer.byteLength; i++, off += 16) {
      if (tagAt(view, off) === 'fvar') { fvar = view.getUint32(off + 8, false); break; }
    }
    // fvar header: version(4) axesArrayOffset(2) reserved(2) axisCount(2)
    // axisSize(2) instanceCount(2) instanceSize(2).
    if (!fvar || fvar + 16 > buffer.byteLength) return null;
    const axesAt = fvar + view.getUint16(fvar + 4, false);
    const axisCount = view.getUint16(fvar + 8, false);
    const axisSize = view.getUint16(fvar + 10, false);
    if (axisSize < FVAR_AXIS_SIZE) return null;

    for (let i = 0; i < axisCount; i++) {
      const at = axesAt + i * axisSize;
      if (at + FVAR_AXIS_SIZE > buffer.byteLength) return null;
      if (tagAt(view, at) !== 'wght') continue;
      // Fixed 16.16 - the axis bounds, rounded to the integers CSS accepts.
      const min = Math.round(view.getInt32(at + 4, false) / 65536);
      const max = Math.round(view.getInt32(at + 12, false) / 65536);
      if (!(min >= WEIGHT_MIN && max <= WEIGHT_MAX && min < max)) return null;
      return `${min} ${max}`;
    }
    return null;
  } catch {
    return null; // an unreadable table is a static face as far as anyone here is concerned
  }
}

// ── Google matching ──────────────────────────────────────────────────────────

/**
 * Same typeface, different spelling. Every entry here is an identity claim, and
 * each one has to be defensible: a rename by the foundry, or a build-tool name
 * for the same family. Anything that is merely SIMILAR belongs in
 * METRIC_LOOKALIKES, not here.
 */
const FAMILY_ALIASES: Readonly<Record<string, string>> = {
  // Adobe's Source families were renumbered when they went variable on Google.
  sourcesanspro: 'Source Sans 3',
  sourceserifpro: 'Source Serif 4',
  // Muli was renamed Mulish by its designer.
  muli: 'Mulish',
  // Variable builds ship under a decorated family name; the family is the same.
  intervariable: 'Inter',
  intervar: 'Inter',
  // The Google-hosted spelling of Nunito's sans sibling.
  nunitosansvariable: 'Nunito Sans',
};

/**
 * The classic metric-compatible pairs, recorded so the intent is testable and
 * so nobody "helpfully" adds them to FAMILY_ALIASES later.
 *
 * A metric-compatible face occupies the same advance widths as the face it
 * substitutes, which is why documents reflow identically - and it is why these
 * pairs are so tempting to resolve. They are still DIFFERENT typefaces drawn by
 * different people: Arial is not Helvetica, Tinos is not Times New Roman.
 * Claiming otherwise would put someone's brand into the wrong letterforms and
 * tell them it matched. Every one of these resolves to null; the Type room can
 * offer a substitute as a substitute, in its own words, having been told the
 * truth here.
 */
const METRIC_LOOKALIKES: Readonly<Record<string, string>> = {
  helvetica: 'Arial',
  helveticaneue: 'Arial',
  arial: 'Liberation Sans',
  arialnarrow: 'Liberation Sans Narrow',
  timesnewroman: 'Tinos',
  timesroman: 'Tinos',
  times: 'Tinos',
  couriernew: 'Cousine',
  calibri: 'Carlito',
  cambria: 'Caladea',
  georgia: 'Gelasio',
  segoeui: 'Selawik',
  futura: 'Jost',
  gillsans: 'Lato',
  avenir: 'Nunito Sans',
  frutiger: 'Nunito Sans',
  myriadpro: 'Source Sans 3',
};

/** Fold a family name to its comparison key: case, spaces and punctuation all ignored. */
const normFamily = (family: string): string =>
  String(family ?? '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** One index per catalogue array, built on first use. */
const indexCache = new WeakMap<readonly string[], Map<string, string>>();

function indexOf(catalog: readonly string[]): Map<string, string> {
  const hit = indexCache.get(catalog);
  if (hit) return hit;
  const index = new Map<string, string>();
  for (const family of catalog) {
    const key = normFamily(family);
    // First spelling wins, so a catalogue's own ordering decides ties.
    if (key && !index.has(key)) index.set(key, family);
  }
  indexCache.set(catalog, index);
  return index;
}

/**
 * The Google family this name IS, or null.
 *
 * Matching is exact once case, spaces and punctuation are folded away, so
 * "RobotoCondensed", "roboto condensed" and "Roboto+Condensed" all reach
 * "Roboto Condensed". FAMILY_ALIASES adds renames and build-tool spellings, and
 * an alias only resolves when its target is actually in the catalogue passed in.
 * A metric lookalike resolves to null on purpose (see METRIC_LOOKALIKES).
 *
 * The catalogue is consulted BEFORE the lookalike table: a name that the
 * catalogue actually carries is that family by definition, whatever anyone
 * substitutes for it elsewhere. Only a name the catalogue does not have can be
 * refused for being a lookalike.
 *
 * The returned string is always the CATALOGUE spelling, never the input's, so
 * it can be handed straight to the css2 fetch ladder.
 */
export function googleMatch(family: string, catalog: readonly string[] = POPULAR_FAMILIES): string | null {
  const key = normFamily(family);
  if (!key) return null;
  const index = indexOf(catalog);
  const direct = index.get(key);
  if (direct) return direct;
  if (Object.hasOwn(METRIC_LOOKALIKES, key)) return null;
  const alias = lookup(FAMILY_ALIASES, key);
  if (!alias) return null;
  return index.get(normFamily(alias)) ?? null;
}

// ── Source honesty ───────────────────────────────────────────────────────────

/** The five things `OS/2.fsType` can say, per font-utils.ts's FontEmbedding. */
const EMBEDDING_VALUES = new Set(['installable', 'restricted', 'preview-print', 'editable', 'unknown']);

/**
 * The chips shown beside a face that came out of a document rather than out of
 * a font shop.
 *
 * NO CALLER YET, and that is a seam rather than an oversight - say so plainly so
 * the next reader does not take it for live code. It reads `{subset, embedding}`,
 * which is precisely what `views/pdf-import.ts`'s `EmbeddedFont` already carries
 * off a real document; what does not exist yet is the route from there into the
 * tray (plan 97 M5, the PDF source), because `Candidate` has nowhere to put a
 * per-face fact today. The Type room's live chips come from
 * `type-compare.ts`'s `chipsFromFacts`, and the two are deliberately different
 * jobs rather than two spellings of one: `chipsFromFacts` reads BYTES WE HOLD and
 * writes sentences for a card ("Embedding not permitted"); this reports what a
 * SOURCE stated about bytes we may never see, in the source's own vocabulary, so
 * a report can quote it. Wiring it to invented data would be the opposite of the
 * honesty it exists for.
 *
 * - `SUBSET` when the source said the bytes are a subset. A subset renders the
 *   document it came from and drops every character that document never
 *   printed, which is the one thing worth shouting about.
 * - Exactly one embedding chip, always: the fsType permission when the source
 *   stated one we recognise, and `unknown` otherwise. Unstated is not
 *   permission and it is not refusal, so it is neither of those words. An
 *   unrecognised string is also `unknown` - repeating a word whose meaning we
 *   cannot vouch for would dress a guess as a fact.
 *
 * `subset: false` produces no chip. Saying "FULL" would claim the source
 * verified something it may simply not have looked at.
 */
export function describeFaceSource(meta: FaceSourceMeta): FaceSourceChips {
  const chips: string[] = [];
  if (meta?.subset === true) chips.push('SUBSET');
  const embedding = typeof meta?.embedding === 'string' ? meta.embedding.trim().toLowerCase() : '';
  chips.push(EMBEDDING_VALUES.has(embedding) ? embedding : 'unknown');
  return { chips };
}

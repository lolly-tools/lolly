// SPDX-License-Identifier: MPL-2.0
/**
 * `DesignCensus` - the one shape every design-system source scans into.
 *
 * Plan 97 section 8: a Source scans material into a census, the census feeds the role
 * proposer, and everything lands as candidates in the tray. Until now
 * `proposeBrandRoles` only spoke Penpot's `PenpotUsage`, so a guidelines PDF, a
 * screenshot or a logo SVG had no route to the same proposal at all. This module
 * is the keystone: a small pure type, one adapter per source, and
 * `censusToUsage` - the bridge that lets the shipped `brand-propose.ts` pipeline
 * run over any source unchanged.
 *
 * Adapting TO the existing shape rather than retargeting the proposer is
 * deliberate. `brand-propose.ts` is shipped, covered and high-traffic, and its
 * four paint buckets (fills / strokes / text runs / gradient stops) are exactly
 * the distinctions the proposal scores: surface comes from fills, text from text
 * runs, and a colour sharing a gradient with the surface leaves the accent pool.
 * A census that could not express those four would lose the proposal's judgement,
 * so `CensusColor.kind` carries them and nothing else.
 *
 * Weights are occurrence counts, never normalised: the proposer only ever
 * compares them, and rescaling one source's counts against another's would be a
 * claim about relative importance that no source actually makes.
 *
 * Pure and DOM-free on purpose - unit-testable under plain node, importable from
 * any shell module.
 */

import { hexToOklch, oklchToHex, parseColorToSrgb8 } from '@lolly/engine';
import type {
  ImageCloud, PenpotUsage, PenpotUsageColor, PenpotUsageGradient, PenpotFontUsage,
} from '@lolly/engine';

/** One colour a source painted with, and how much of it there was. */
export interface CensusColor {
  hex: string;
  weight: number;
  kind?: 'fill' | 'stroke' | 'text' | 'gradient';
}

/** One gradient a source painted with. Stops carry no positions - see `censusToUsage`. */
export interface CensusGradient {
  stops: string[];
  angle?: number;
  weight: number;
}

/** One face a source set type in. `usage` is a hint; `count` is the occurrence tally. */
export interface CensusFont {
  family: string;
  weight?: number;
  italic?: boolean;
  usage: 'heading' | 'body' | 'mono' | 'unknown';
  count: number;
}

/** Where a census came from, for the provenance chip on every candidate. */
export interface CensusSource {
  kind: 'penpot' | 'pdf' | 'image' | 'svg' | 'site' | 'css';
  label: string;
}

/** Everything one source has to say about a design system. */
export interface DesignCensus {
  colors: CensusColor[];
  gradients: CensusGradient[];
  fonts: CensusFont[];
  name?: string;
  source: CensusSource;
}

/** Default face weight when a source reports none - CSS's own default. */
const DEFAULT_FONT_WEIGHT = 400;

// ── Ink and ground ───────────────────────────────────────────────────────────
// Artwork sources (a logo SVG, a PDF's vector marks) report the paint a MARK is
// drawn in. That is ink, not ground - but `proposeBrandRoles` reads the surface
// off the heaviest FILL and, failing that, off the heaviest colour overall, so an
// adapter that files every colour as a fill proposes the logo's own brand colour
// as the page background and leaves a leftover neutral as the brand colour. Roles
// come out exactly inverted, which is the bug these two constants fix.
//
// The split follows the proposer's own line: a colour it could never call an
// accent (chroma under its accent floor) sitting at one end of the lightness
// range is paper or the dark card a reverse mark is drawn for. Everything else is
// ink, and ink is filed under `stroke` - the one bucket that scores toward an
// accent without claiming either the ground or the body copy.

/** Mirrors ACCENT_CHROMA_MIN in lib/brand-propose.ts: below it, the proposer will
 *  not consider a colour an accent, so it is a neutral and can be a ground. */
const GROUND_CHROMA_MAX = 0.09;
/** …and a ground has to be at one END of the range. A mid grey is ink. */
const GROUND_L_LIGHT = 0.85;
const GROUND_L_DARK = 0.30;
/** The ground artwork implies when it carries none of its own: paper. The one
 *  safe assumption about a mark, and it can only ever be the surface - nothing
 *  else claims a fill, and the surface never enters the accent pool. */
const IMPLIED_GROUND = '#FFFFFF';
/** What an implied ground weighs: the minimum, so any ground the file really
 *  does carry outranks it. */
const IMPLIED_GROUND_WEIGHT = 1;

function isGroundColor(hex: string): boolean {
  const ok = hexToOklch(hex);
  if (!ok) return false;
  return ok.c < GROUND_CHROMA_MAX && (ok.l >= GROUND_L_LIGHT || ok.l <= GROUND_L_DARK);
}

/** An artwork colour's bucket: ground candidates are the fill, marks are ink. */
const artworkKind = (hex: string): CensusColor['kind'] => (isGroundColor(hex) ? 'fill' : 'stroke');

/** Append the implied ground when the artwork carries none and has ink to sit on
 * - without it the proposer's fallback makes the heaviest ink the surface. */
function withImpliedGround(rows: CensusColor[]): CensusColor[] {
  if (!rows.length || rows.some(r => r.kind === 'fill')) return rows;
  return [...rows, { hex: IMPLIED_GROUND, weight: IMPLIED_GROUND_WEIGHT, kind: 'fill' }];
}

const KIND_BUCKET = {
  fill: 'fills',
  stroke: 'strokes',
  text: 'textRuns',
  gradient: 'gradientStops',
} as const satisfies Record<NonNullable<CensusColor['kind']>, keyof Omit<PenpotUsageColor, 'hex' | 'total'>>;

const hex2 = (n: number): string => n.toString(16).padStart(2, '0').toUpperCase();

/**
 * Any CSS colour notation to `#RRGGBB` uppercase - the form `PenpotUsage` rows
 * are in, and the proposer's surface-shade exclusion compares gradient stops to
 * colours by string identity, so one spelling has to win.
 *
 * Alpha is dropped: one colour painted at two opacities is one colour. A fully
 * transparent value comes back null along with anything unreadable, which is the
 * same answer either way - nothing was painted.
 */
export function censusHex(value: string): string | null {
  const rgb = parseColorToSrgb8(value);
  return rgb ? `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}` : null;
}

const weightOf = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Bridge a census onto the census shape `brand-propose.ts` already speaks, so
 * `proposeBrandRoles(censusToUsage(c))` and `proposeFonts(censusToUsage(c))`
 * work over every source.
 *
 * Three mappings carry judgement:
 *
 *  - **An unqualified colour counts as a fill.** Every source that omits `kind`
 *    (an SVG colour list, an image's buckets) is reporting painted area, and
 *    fills are what the surface pick reads. Counting them as nothing would leave
 *    the proposer with no surface at all.
 *  - **Gradients do not invent colour rows.** A census's gradients become usage
 *    gradients only, so the shade exclusion works; a source that wants its stops
 *    tallied says so with `kind: 'gradient'` colours (which is what the Penpot
 *    adapter does). Synthesising them here would push colours into the accent
 *    pool that no source ever claimed were painted.
 *  - **Stops are spaced evenly.** A census records which colours a gradient runs
 *    through, not where they sit; the proposer reads stop colours only.
 *
 * `name` has no home in the usage shape - `buildBrandDocFromUsage` takes the
 * label separately, so callers pass `census.name` there.
 */
export function censusToUsage(census: DesignCensus): PenpotUsage {
  const byHex = new Map<string, PenpotUsageColor>();
  for (const c of census.colors) {
    const hex = censusHex(c.hex);
    if (!hex) continue;
    let row = byHex.get(hex);
    if (!row) {
      row = { hex, fills: 0, strokes: 0, textRuns: 0, gradientStops: 0, total: 0 };
      byHex.set(hex, row);
    }
    const w = weightOf(c.weight);
    row[KIND_BUCKET[c.kind ?? 'fill']] += w;
    row.total += w;
  }
  // PenpotUsage's documented order, which proposeBrandRoles leans on: colors[0]
  // is its surface fallback for a census with no fills anywhere.
  const colors = [...byHex.values()]
    .sort((a, b) => (b.total - a.total) || (a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0));

  const gradients: PenpotUsageGradient[] = [];
  for (const g of census.gradients) {
    const stops: string[] = [];
    for (const s of g.stops) {
      const hex = censusHex(s);
      if (hex) stops.push(hex);
    }
    if (stops.length < 2) continue;
    gradients.push({
      type: 'linear',
      stops: stops.map((color, i) => ({ color, offset: i / (stops.length - 1), opacity: 1 })),
      count: weightOf(g.weight),
      angle: Number.isFinite(g.angle) ? Math.round(g.angle as number) : 0,
    });
  }
  const sig = (g: PenpotUsageGradient): string => g.stops.map(s => s.color).join(',');
  gradients.sort((a, b) => (b.count - a.count) || (sig(a) < sig(b) ? -1 : sig(a) > sig(b) ? 1 : 0));

  // fontId is the family verbatim, never a `gfont-` id: a census records what a
  // source used, never where the face can be fetched from, so proposeFonts lists
  // every family under `missing` and claims nothing under `google`. Same stance
  // as proposeFontsFromTokens - saying nothing beats claiming an unchecked source.
  const fonts: PenpotFontUsage[] = census.fonts.map(f => {
    const fontWeight = Number.isFinite(f.weight) ? Number(f.weight) : DEFAULT_FONT_WEIGHT;
    return {
      fontId: f.family,
      fontFamily: f.family,
      fontVariantId: `${fontWeight}${f.italic ? 'italic' : ''}`,
      fontWeight,
      fontStyle: f.italic ? 'italic' : 'normal',
      runs: weightOf(f.count),
    };
  });

  return { colors, gradients, fonts };
}

/**
 * The inverse adapter: Penpot's paint census as a `DesignCensus`, so the Penpot
 * path becomes one source among peers rather than the shape everything else has
 * to imitate. Each tallied bucket becomes its own row, which is what lets
 * `censusToUsage` rebuild the four counts exactly.
 */
export function censusFromPenpotUsage(usage: PenpotUsage, label: string): DesignCensus {
  const colors: CensusColor[] = [];
  for (const c of usage.colors) {
    if (c.fills) colors.push({ hex: c.hex, weight: c.fills, kind: 'fill' });
    if (c.strokes) colors.push({ hex: c.hex, weight: c.strokes, kind: 'stroke' });
    if (c.textRuns) colors.push({ hex: c.hex, weight: c.textRuns, kind: 'text' });
    if (c.gradientStops) colors.push({ hex: c.hex, weight: c.gradientStops, kind: 'gradient' });
  }
  return {
    colors,
    gradients: usage.gradients.map(g => ({
      stops: g.stops.map(s => s.color),
      angle: g.angle,
      weight: g.count,
    })),
    fonts: usage.fonts.map(f => {
      const family = f.fontFamily || f.fontId;
      return {
        family,
        weight: f.fontWeight,
        italic: f.fontStyle === 'italic',
        usage: /mono/i.test(family) ? 'mono' : 'unknown',
        count: f.runs,
      } satisfies CensusFont;
    }),
    source: { kind: 'penpot', label },
  };
}

/**
 * A logo's colours (engine `extractSvgColors`) as a census.
 *
 * The extractor returns distinct colours in first-seen order and reports no
 * areas at all, so order is the only ranking there is - and it is a ranking of
 * PRECEDENCE, not of painted area: the colour a mark leads with is the one its
 * owner names first, which is the same rule the shipped SVG import states ("the
 * first one kept becomes the main colour"). Weight therefore falls with position
 * WITHIN each bucket, so the leading ink wins the accent race and the leading
 * neutral wins the surface. Reading that order as painted area instead is what
 * inverted the roles (see "Ink and ground" above).
 */
export function censusFromSvgColors(colors: string[], label: string): DesignCensus {
  const rows: CensusColor[] = [];
  const seen = new Set<string>();
  for (const raw of colors) {
    const hex = censusHex(raw);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    rows.push({ hex, weight: 0, kind: artworkKind(hex) });
  }
  for (const kind of ['fill', 'stroke'] as const) {
    const bucket = rows.filter(r => r.kind === kind);
    for (const [i, row] of bucket.entries()) row.weight = bucket.length - i;
  }
  return { colors: withImpliedGround(rows), gradients: [], fonts: [], source: { kind: 'svg', label } };
}

/**
 * An image's colour cloud (engine `imageColorCloud`) as a census.
 *
 * A bucket's `n` is its share of the sampled pixels, which is a real occurrence
 * count and maps straight onto weight - so a screenshot's background, being most
 * of its pixels, proposes as the surface. Points are read back through
 * `oklchToHex`, the authoritative value; two buckets can land on one hex once a
 * wide-gamut source is mapped into sRGB, and those sum.
 */
export function censusFromImageCloud(cloud: ImageCloud, label: string): DesignCensus {
  const byHex = new Map<string, CensusColor>();
  for (const p of cloud.points) {
    const hex = censusHex(oklchToHex({ l: p.l, c: p.c, h: p.h }));
    if (!hex) continue;
    const row = byHex.get(hex);
    if (row) row.weight += weightOf(p.n);
    else byHex.set(hex, { hex, weight: weightOf(p.n), kind: 'fill' });
  }
  return {
    colors: [...byHex.values()],
    gradients: [],
    fonts: [],
    source: { kind: 'image', label },
  };
}

/**
 * The vector marks lifted off a PDF (`listVectors`) as a census.
 *
 * Each mark reports its own fill palette most-used-first, and that per-mark
 * order is all the extractor knows - so a mark contributes falling weights the
 * same way an SVG's colour list does, and marks sum. A guidelines PDF then
 * proposes from the colours its artwork actually paints with.
 *
 * `listVectors` returns MARKS, so the same ink/ground split applies: a mark's
 * chromatic paint is ink however the PDF filed it, and only a neutral at an
 * extreme reads as the ground it sits on.
 */
export function censusFromPdfVectors(vectors: { fills: string[] }[], label: string): DesignCensus {
  const byHex = new Map<string, CensusColor>();
  for (const mark of vectors) {
    const seen = new Set<string>();
    const fills: string[] = [];
    for (const raw of mark.fills) {
      const hex = censusHex(raw);
      if (!hex || seen.has(hex)) continue;
      seen.add(hex);
      fills.push(hex);
    }
    for (const [i, hex] of fills.entries()) {
      const weight = fills.length - i;
      const row = byHex.get(hex);
      if (row) row.weight += weight;
      else byHex.set(hex, { hex, weight, kind: artworkKind(hex) });
    }
  }
  return {
    colors: withImpliedGround([...byHex.values()]),
    gradients: [],
    fonts: [],
    source: { kind: 'pdf', label },
  };
}

/**
 * Fold several sources into one census - a shopping session that pulled from a
 * site, a PDF and a logo asks one proposer one question.
 *
 * Colours dedupe on their resolved value (so `red` and `#FF0000` are one row)
 * *per kind*: a hex used as a fill and as text is two facts, and collapsing them
 * would erase the text signal the proposal reads. First-seen spelling and
 * first-seen order both survive - ranking is the proposer's job, not the union's.
 *
 * The merged source is the first entry's, since provenance beyond "where this
 * started" belongs on individual candidates. An empty merge has no provenance to
 * report at all: it comes back with an empty label, which callers should read as
 * "no source".
 */
export function mergeCensus(list: DesignCensus[]): DesignCensus {
  const colors = new Map<string, CensusColor>();
  const gradients = new Map<string, CensusGradient>();
  const fonts = new Map<string, CensusFont>();
  let name: string | undefined;

  for (const census of list) {
    if (!name && census.name) name = census.name;

    for (const c of census.colors) {
      const key = `${(censusHex(c.hex) ?? c.hex).toLowerCase()}|${c.kind ?? ''}`;
      const row = colors.get(key);
      if (row) row.weight += weightOf(c.weight);
      else colors.set(key, { ...c, weight: weightOf(c.weight) });
    }

    for (const g of census.gradients) {
      const key = `${g.stops.map(s => (censusHex(s) ?? s).toLowerCase()).join(',')}|${g.angle ?? ''}`;
      const row = gradients.get(key);
      if (row) row.weight += weightOf(g.weight);
      else gradients.set(key, { ...g, stops: [...g.stops], weight: weightOf(g.weight) });
    }

    for (const f of census.fonts) {
      const key = `${f.family.toLowerCase()}|${f.weight ?? ''}|${f.italic ? 1 : 0}`;
      const row = fonts.get(key);
      if (!row) { fonts.set(key, { ...f, count: weightOf(f.count) }); continue; }
      row.count += weightOf(f.count);
      // A concrete role beats the placeholder whichever order the sources arrived in.
      if (row.usage === 'unknown' && f.usage !== 'unknown') row.usage = f.usage;
    }
  }

  const out: DesignCensus = {
    colors: [...colors.values()],
    gradients: [...gradients.values()],
    fonts: [...fonts.values()],
    source: list[0]?.source ?? { kind: 'css', label: '' },
  };
  if (name) out.name = name;
  return out;
}

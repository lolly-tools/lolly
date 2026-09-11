// SPDX-License-Identifier: MPL-2.0
/**
 * Pure page-model logic for the format side-door pages (plan 116 workstream A).
 *
 * Everything here is a deterministic transform over the already-parsed format
 * register (docs/site/formats-catalog.json). It has NO filesystem or DOM
 * dependency and NO import side effects, so a unit test can import it directly
 * (docs/build.ts cannot be imported: it reads the catalog and runs build() at
 * import time). build.ts owns the wiring - it loads the register, calls these
 * functions, renders the HTML chrome and writes the files.
 *
 * The register is the single source of truth. Every generated page, every row in
 * capabilities.json and every convert page is derived from it, so a page can
 * never promise a format the register does not list, and the drift test
 * (tests/formats-pages-drift.test.ts) pins the register-to-pages bijection both
 * ways.
 */

/**
 * What Lolly reads and writes in a format's own metadata containers, and what
 * survives an ingest then re-export round trip (plans/144 O1). `reads`/`writes`
 * use one controlled vocabulary (see METADATA_VOCAB); an empty array means none.
 * Every claim here is checked against the real writer by
 * the claim tests under tests/, so the register cannot drift from the code.
 */
export interface FmtMetadata {
  reads: string[];
  writes: string[];
  preserves: 'full' | 'partial' | 'none' | 'n/a';
  note?: string;
}

/** The only tokens `reads`/`writes` may contain. No 'none' token: use []. */
export const METADATA_VOCAB = [
  'exif', 'xmp', 'iptc', 'dc', 'core-props', 'id3', 'info', 'prodid', 'c2pa',
] as const;

/** Display names for the vocabulary, used on the convert pages and in llms.txt. */
export const METADATA_LABEL: Record<string, string> = {
  exif: 'EXIF',
  xmp: 'XMP',
  iptc: 'IPTC',
  dc: 'Dublin Core',
  'core-props': 'Office core properties',
  id3: 'ID3',
  info: 'RIFF INFO',
  prodid: 'PRODID',
  c2pa: 'Content Credential',
};

/** One format entry, matching the shape in docs/site/formats-catalog.json. */
export interface FmtEntry {
  token: string;
  name: string;
  full: string;
  category: string;
  dir: 'in' | 'out' | 'both';
  features: string[];
  desc: string;
  metadata: FmtMetadata;
}

/** The parsed register: the feature label map plus the format array. */
export interface FmtCatalog {
  features: Record<string, string>;
  specifics?: Record<string, string[]>;
  unsupported?: Record<string, string[]>;
  formats: FmtEntry[];
}

/**
 * A url-safe slug for a format token. Lowercase, every run of non-alphanumeric
 * characters becomes a single hyphen, and the ends are trimmed. So "CMYK PDF"
 * becomes "cmyk-pdf", "Animated WebP" becomes "animated-webp" and "glTF" becomes
 * "gltf". Uniqueness across the register is asserted by the drift test.
 */
export function tokenSlug(token: string): string {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Does Lolly read this format? True for import and round-trip formats. */
export function reads(entry: FmtEntry): boolean {
  return entry.dir !== 'out';
}

/** Does Lolly write this format? True for export and round-trip formats. */
export function writes(entry: FmtEntry): boolean {
  return entry.dir !== 'in';
}

/** The feature keys resolved to their human labels, unknown keys dropped. */
export function featureLabels(entry: FmtEntry, catalog: FmtCatalog): string[] {
  return entry.features.map((k) => catalog.features[k]).filter((v): v is string => typeof v === 'string');
}

/**
 * The machine-readable claims file (/info/capabilities.json). Built straight from
 * the register so an agent can ask "what does Lolly do with format X" without
 * scraping a page. Platform-neutral and server-free: it is a static JSON.
 */
export interface CapabilityRow {
  token: string;
  name: string;
  category: string;
  dir: 'in' | 'out' | 'both';
  reads: boolean;
  writes: boolean;
  roundTrips: boolean;
  features: string[];
  /** The register's metadata claims, verbatim (plans/144 O1). */
  metadata: FmtMetadata;
}
export interface CapabilitiesDoc {
  generator: 'lolly';
  license: 'MPL-2.0';
  offers: 0;
  url: string;
  formats: CapabilityRow[];
}
export function buildCapabilities(catalog: FmtCatalog, opts: { url?: string } = {}): CapabilitiesDoc {
  return {
    generator: 'lolly',
    license: 'MPL-2.0',
    offers: 0,
    url: opts.url ?? 'https://lolly.tools',
    formats: catalog.formats.map((f) => ({
      token: f.token,
      name: f.name,
      category: f.category,
      dir: f.dir,
      reads: reads(f),
      writes: writes(f),
      roundTrips: f.dir === 'both',
      features: [...f.features],
      metadata: {
        reads: [...f.metadata.reads],
        writes: [...f.metadata.writes],
        preserves: f.metadata.preserves,
        ...(f.metadata.note ? { note: f.metadata.note } : {}),
      },
    })),
  };
}

/** Every per-format page the generator emits: one per register format, in order. */
export function formatPageList(catalog: FmtCatalog): Array<{ token: string; slug: string }> {
  return catalog.formats.map((f) => ({ token: f.token, slug: tokenSlug(f.token) }));
}

/**
 * The tool a format page's "do it now" link opens. Lolly has no generic convert
 * surface, so most formats point at the catalogue (/#/c) where the reader picks a
 * tool that opens or makes the file. A few formats have one obvious on-device
 * tool, listed here and nowhere else so the mapping stays reviewable.
 */
export const FORMAT_TOOL_HINTS: Record<string, string> = {
  // The image converter reads and writes these, so a format page for one of them
  // can open straight into it (convert-image is a real community tool).
  HEIC: '#/tool/convert-image',
  AVIF: '#/tool/convert-image',
  TIFF: '#/tool/convert-image',
  // Fonts have their own on-device converter.
  WOFF: '#/tool/font-convert',
  TTF: '#/tool/font-convert',
  OTF: '#/tool/font-convert',
  // The PDF utilities.
  PDF: '#/tool/compress-pdf',
  // A course package comes out of a Design deck's export panel and nowhere else.
  SCORM: '#/tool/design',
};

/** The app hash a format page's "do it now" link opens (catalogue by default). */
export function formatAppHash(entry: FmtEntry): string {
  return FORMAT_TOOL_HINTS[entry.token] ?? '#/c';
}

/** The rendered model for one per-format side-door page. */
export interface FormatPageModel {
  token: string;
  slug: string;
  name: string;
  full: string;
  category: string;
  dir: 'in' | 'out' | 'both';
  reads: boolean;
  writes: boolean;
  roundTrips: boolean;
  desc: string;
  features: string[];
  featureLabels: string[];
  /** True when the format keeps a Content Credential (the `provenance` feature). */
  provenance: boolean;
  /** The page title seed (build.ts appends " - Lolly"). */
  title: string;
  /** The social/search description. */
  description: string;
  /** The direction sentence: reads, writes, or both. */
  direction: string;
  /** The app hash the "do it now" link opens. */
  appHash: string;
}

/** The one-line description of what Lolly does with a format, keyed by direction. */
function directionSentence(name: string, entry: FmtEntry): string {
  if (entry.dir === 'both') return `Lolly opens ${name} files and makes them, all on your device.`;
  if (entry.dir === 'in') return `Lolly opens ${name} files on your device.`;
  return `Lolly makes ${name} files on your device.`;
}

export function buildFormatPageModel(entry: FmtEntry, catalog: FmtCatalog): FormatPageModel {
  const r = reads(entry);
  const w = writes(entry);
  const labels = featureLabels(entry, catalog);
  const provenance = entry.features.includes('provenance');
  return {
    token: entry.token,
    slug: tokenSlug(entry.token),
    name: entry.name,
    full: entry.full,
    category: entry.category,
    dir: entry.dir,
    reads: r,
    writes: w,
    roundTrips: entry.dir === 'both',
    desc: entry.desc,
    features: [...entry.features],
    featureLabels: labels,
    provenance,
    title: `${entry.name} file format`,
    description:
      `What ${entry.name} is, whether Lolly can open it, make it, or both, and how. ` +
      `Free, on your device, no account.`,
    direction: directionSentence(entry.name, entry),
    appHash: formatAppHash(entry),
  };
}

/**
 * The curated set of high-intent conversion pages. NOT the cartesian product
 * (that would be thousands of pages): each pair is a real search a reader types,
 * where the input is a format Lolly reads and the output a format Lolly writes.
 * Kept as a named constant so the list is reviewable in one place. Each pair is
 * [inputToken, outputToken] and both tokens must exist in the register with the
 * right direction, which convertPageList() and the drift test both enforce.
 */
export const CONVERT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  // iPhone photos into the everyday formats.
  ['HEIC', 'JPG'],
  ['HEIC', 'PNG'],
  ['HEIC', 'WEBP'],
  // The common raster round of trips.
  ['JPG', 'PNG'],
  ['PNG', 'JPG'],
  ['WEBP', 'PNG'],
  ['WEBP', 'JPG'],
  ['PNG', 'WEBP'],
  ['JPG', 'WEBP'],
  ['AVIF', 'PNG'],
  ['AVIF', 'JPG'],
  ['TIFF', 'PNG'],
  ['TIFF', 'JPG'],
  // Raster and vector crossings people search for.
  ['PNG', 'SVG'],
  ['SVG', 'PNG'],
  ['PDF', 'PNG'],
  ['PDF', 'SVG'],
  ['SVG', 'PDF'],
  ['JPG', 'PDF'],
  ['WEBP', 'PDF'],
  // Fonts, on device.
  ['TTF', 'WOFF'],
  ['OTF', 'WOFF'],
  ['WOFF', 'TTF'],
];

/** A convert page after the register has confirmed both tokens and directions. */
export interface ConvertPair {
  inToken: string;
  outToken: string;
  slug: string;
  in: FmtEntry;
  out: FmtEntry;
}

/**
 * The convert pages the generator emits. Each pair in CONVERT_PAIRS is resolved
 * against the register: the input token must exist and be readable, the output
 * token must exist and be writable. A pair that fails throws, so a register edit
 * that drops a format or flips its direction breaks the build loudly rather than
 * shipping a page that promises a conversion Lolly can no longer do.
 */
export function convertPageList(catalog: FmtCatalog): ConvertPair[] {
  const byToken = new Map(catalog.formats.map((f) => [f.token, f]));
  return CONVERT_PAIRS.map(([inToken, outToken]) => {
    const inEntry = byToken.get(inToken);
    const outEntry = byToken.get(outToken);
    if (!inEntry) throw new Error(`convert pair ${inToken}->${outToken}: input token "${inToken}" is not in the register`);
    if (!outEntry) throw new Error(`convert pair ${inToken}->${outToken}: output token "${outToken}" is not in the register`);
    if (!reads(inEntry)) throw new Error(`convert pair ${inToken}->${outToken}: Lolly does not read "${inToken}"`);
    if (!writes(outEntry)) throw new Error(`convert pair ${inToken}->${outToken}: Lolly does not write "${outToken}"`);
    return {
      inToken,
      outToken,
      slug: `${tokenSlug(inToken)}-to-${tokenSlug(outToken)}`,
      in: inEntry,
      out: outEntry,
    };
  });
}

/** The image converter's writable output tokens mapped to its format values. */
const CONVERT_IMAGE_OUT: Record<string, string> = { PNG: 'png', JPG: 'jpeg', WEBP: 'webp' };
/** The image converter's readable input tokens. */
const CONVERT_IMAGE_IN = new Set(['HEIC', 'JPG', 'PNG', 'WEBP', 'AVIF', 'TIFF']);
/** The font converter's tokens. */
const FONT_TOKENS = new Set(['TTF', 'OTF', 'WOFF']);

/**
 * The app hash a convert page's "do it now" link opens. Image pairs the
 * convert-image tool actually handles open straight into it with the output
 * preselected; font pairs open the font converter. Everything else opens the
 * catalogue, because Lolly has no single tool for that crossing and inventing a
 * convert surface that does not exist would be a false promise.
 */
export function convertAppHash(inToken: string, outToken: string): string {
  if (CONVERT_IMAGE_IN.has(inToken) && CONVERT_IMAGE_OUT[outToken]) {
    return `#/tool/convert-image?format=${CONVERT_IMAGE_OUT[outToken]}`;
  }
  if (FONT_TOKENS.has(inToken) && FONT_TOKENS.has(outToken)) return '#/tool/font-convert';
  return '#/c';
}

/** The rendered model for one convert side-door page. */
export interface ConvertPageModel {
  inToken: string;
  outToken: string;
  slug: string;
  inName: string;
  outName: string;
  inDesc: string;
  outDesc: string;
  /** True when the output format keeps a Content Credential. */
  provenance: boolean;
  outFeatureLabels: string[];
  title: string;
  description: string;
  appHash: string;
  /**
   * The metadata containers BOTH sides speak: the input's `reads` intersected
   * with the output's `writes`, as display labels. Derived from the register, so
   * it moves when a claim moves.
   */
  carriesLabels: string[];
  /**
   * Which carry story this pair actually gets. 'converter' is the image
   * converter's own carry (plans/144 Wave 1) and is the only pair kind where
   * Lolly moves fields from the source file into the output; 'font' is the
   * on-device container swap, where the whole font passes through; 'none' is
   * every other pair, where the output is rendered fresh.
   */
  carryKind: 'converter' | 'font' | 'none';
}

/** The carry story for a pair, keyed off the tool the page's link opens. */
function carryKindFor(inToken: string, outToken: string): ConvertPageModel['carryKind'] {
  const hash = convertAppHash(inToken, outToken);
  if (hash.startsWith('#/tool/convert-image')) return 'converter';
  if (hash === '#/tool/font-convert') return 'font';
  return 'none';
}

/** "reads exif, xmp; writes exif, xmp, c2pa; round trip partial" - the register's
 *  metadata claims for one format, as one flat clause for llms.txt. */
export function metadataClause(m: FmtMetadata): string {
  const list = (v: string[]): string => (v.length ? v.join(', ') : 'nothing');
  return `reads ${list(m.reads)}; writes ${list(m.writes)}; round trip ${m.preserves}`;
}

/**
 * The Formats section for /info/llms.txt. One line per per-format page, plus a
 * pointer to the machine-readable capabilities.json and the convert pages. Pure,
 * so the llms test can assert on it without building the site.
 *
 * The metadata claims ride INLINE on each format's existing line: the pinned test
 * counts "- [" lines against the register, so a second bullet per format would
 * break the bijection it guards.
 */
export function llmsFormatsSection(catalog: FmtCatalog, opts: { url?: string } = {}): string {
  const url = opts.url ?? 'https://lolly.tools';
  const lines = catalog.formats.map((f) => {
    const dir = f.dir === 'both' ? 'reads and writes' : f.dir === 'in' ? 'reads' : 'writes';
    return `- [${f.name}](${url}/info/formats/${tokenSlug(f.token)}/): Lolly ${dir} ${f.name}.` +
      ` Metadata: ${metadataClause(f.metadata)}.`;
  });
  return `## Formats

Machine-readable capabilities (no scraping): ${url}/info/capabilities.json - a
static JSON of every format, whether Lolly reads it, writes it, or both, its
features and its metadata claims. Curated conversion pages live under
${url}/info/convert/.

Each line below ends with what Lolly reads and writes in that format's own
metadata containers (exif, xmp, iptc, dc, core-props, id3, info, prodid, c2pa),
and what survives an ingest then re-export round trip: full, partial, none, or
n/a for a one-direction format. Those claims are tested against the real writers,
so they describe the code rather than an intention.

${lines.join('\n')}`;
}

export function buildConvertPageModel(pair: ConvertPair, catalog: FmtCatalog): ConvertPageModel {
  return {
    inToken: pair.inToken,
    outToken: pair.outToken,
    slug: pair.slug,
    inName: pair.in.name,
    outName: pair.out.name,
    inDesc: pair.in.desc,
    outDesc: pair.out.desc,
    provenance: pair.out.features.includes('provenance'),
    outFeatureLabels: featureLabels(pair.out, catalog),
    title: `Convert ${pair.in.name} to ${pair.out.name}`,
    description:
      `Turn ${pair.in.name} into ${pair.out.name} on your own device. ` +
      `Free, no account, nothing uploaded.`,
    appHash: convertAppHash(pair.inToken, pair.outToken),
    carriesLabels: pair.in.metadata.reads
      .filter((r) => pair.out.metadata.writes.includes(r))
      .map((r) => METADATA_LABEL[r] ?? r),
    carryKind: carryKindFor(pair.inToken, pair.outToken),
  };
}

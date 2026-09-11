// SPDX-License-Identifier: MPL-2.0
/**
 * Google Fonts - fetch a family's css2 stylesheet and resolve it to a set of
 * downloadable font files (woff2 when the request is recognised as a modern
 * browser, truetype/opentype otherwise - see FONT_EXT_FORMAT below), so a
 * chosen face can be stored ON-DEVICE (as `type:'font'` user assets) and
 * served from IndexedDB forever after. The network is touched exactly once
 * per family - at add time; from then on the face is local, offline, and
 * travels in the data backup like any user asset.
 *
 * Scope decisions (deliberate):
 *   - latin + latin-ext, plus the non-Latin scripts of shipped UI languages
 *     (cyrillic for bg, devanagari for hi) - close to the shell's own bundled
 *     builds (shells/web/public/fonts/) while keeping a family to a few hundred KB.
 *   - Upright AND italic (`ital@0;1`). A family with no italic simply returns
 *     upright faces - css2 ignores the slant rather than erroring - so asking
 *     always is free. Without the real italic face an italic run cannot be
 *     outlined at all (an upright outline would silently un-slant the text).
 *   - The variable `wght` axis whenever the family has one, at its TRUE range
 *     (see resolveFamilySpec): css2 rejects a range the family doesn't cover,
 *     and its 400 body is a generic error page, so the range is discovered by
 *     probing. Families with no axis fall back to their static weights.
 *   - Licensing: everything on Google Fonts is OFL/Apache/UFL - free to
 *     download, embed and redistribute; the css2 endpoint and fonts.gstatic.com
 *     both serve CORS `*`, and the service worker ignores cross-origin URLs,
 *     so a plain fetch works. The font's own licence rides along in meta.
 *
 * The css2 parser and the spec builders are pure and exported for tests; only
 * fetchGoogleFont and resolveFamilySpec touch the network.
 */

/** One @font-face block resolved out of a css2 response. */
export interface GoogleFontFace {
  family: string;
  style: string;          // 'normal' | 'italic'
  weight: string;         // '400' or a variable range '100 900'
  subset: string;         // 'latin', 'latin-ext', … (from the preceding comment)
  unicodeRange: string;   // the block's unicode-range, verbatim ('' if absent)
  url: string;            // the font file on fonts.gstatic.com
  format: 'woff2' | 'truetype' | 'opentype'; // actual format served (see FONT_EXT_FORMAT)
}

/** A downloaded face: the parsed descriptor plus its bytes. */
export interface DownloadedFontFace extends GoogleFontFace {
  bytes: Uint8Array;
}

// The subsets worth carrying offline by default (see module header).
// cyrillic/cyrillic-ext cover the bg UI language; devanagari covers hi; bengali
// covers bn; arabic covers both ar and ur (Urdu uses the Arabic script).
const SUBSETS_KEPT = new Set(['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'devanagari', 'bengali', 'arabic']);

const CSS2 = 'https://fonts.googleapis.com/css2';

// A family name as the css2 API accepts it: letters/digits/spaces (Google Fonts
// names are ASCII; "M PLUS Rounded 1c" is about as exotic as they get). Also the
// safety gate before the name lands in a CSS font-family value or an asset id.
export const GOOGLE_FAMILY_RE = /^[A-Za-z0-9][A-Za-z0-9 ]{0,63}$/;

// css2 serves woff2 only when it recognises the request as a modern browser - 
// a UA it doesn't recognise (an unusual/locked-down browser, a privacy
// extension that normalises the UA header on cross-origin requests, a proxy)
// gets the SAME @font-face data back as legacy truetype instead. That's the
// entire response format for every face, not a mix - so accepting whichever
// format actually came back (rather than discarding the whole family) is what
// makes a family reliably downloadable regardless of the requester's UA. The
// vector-export path (bridge/font-registry.ts) already sniffs the stored
// bytes' own magic number rather than trusting a format field, so it already
// handles either shape.
const FONT_EXT_FORMAT: Record<string, GoogleFontFace['format']> = {
  woff2: 'woff2', ttf: 'truetype', otf: 'opentype',
};

/**
 * Parse a css2 response into faces. css2 emits one @font-face block per
 * subset, each preceded by a comment naming it - "latin-ext" then a block
 * with font-family/style/weight, a fonts.gstatic.com src, and that subset's
 * unicode-range. Pure; exported for tests.
 */
export function parseGoogleFontCss(css: string): GoogleFontFace[] {
  const faces: GoogleFontFace[] = [];
  // Walk "<comment>? @font-face { … }" pairs; the comment names the subset.
  const block = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = block.exec(css))) {
    const subset = m[1] ?? '';
    const body = m[2] ?? '';
    const prop = (name: string): string =>
      new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body)?.[1]?.trim() ?? '';
    const url = /src\s*:[^;]*url\((['"]?)([^)'"]+)\1\)/.exec(body)?.[2] ?? '';
    const ext = /\.(woff2|ttf|otf)(\?|$)/i.exec(url)?.[1]?.toLowerCase();
    if (!url || !ext) continue; // an unrecognised format we can't use at all
    faces.push({
      family: prop('font-family').replace(/^['"]|['"]$/g, ''),
      style: prop('font-style') || 'normal',
      weight: prop('font-weight') || '400',
      subset,
      unicodeRange: prop('unicode-range'),
      url,
      format: FONT_EXT_FORMAT[ext]!,
    });
  }
  return faces;
}

/** The faces worth storing: kept subsets only (or everything when the css names
 *  no subsets at all - some single-script families skip the comments). */
export function keepFaces(faces: GoogleFontFace[]): GoogleFontFace[] {
  const named = faces.filter(f => f.subset);
  if (!named.length) return faces;
  return named.filter(f => SUBSETS_KEPT.has(f.subset));
}

/** The family name as css2 wants it in the `family=` value. */
export const encodeFamily = (family: string): string => family.trim().replace(/ /g, '+');

/** Both slants across a variable weight range: `Inter:ital,wght@0,100..900;1,100..900`.
 *  Upright is listed first, so the primary face leads the css2 response. */
export const variableSpec = (enc: string, lo: number, hi: number): string =>
  `${enc}:ital,wght@0,${lo}..${hi};1,${lo}..${hi}`;

/**
 * The non-variable ladder, best first - regular+bold in both slants, then a
 * single weight in both slants (display faces like Anton ship only 400 and
 * reject a `700` they don't have), then every style the family has at its
 * default weight, then the bare family (some faces reject any axis spec).
 */
export const staticSpecs = (enc: string): string[] => [
  `${enc}:ital,wght@0,400;0,700;1,400;1,700`,
  `${enc}:ital,wght@0,400;1,400`,
  `${enc}:ital@0;1`,
  enc,
];

// Where a Google variable `wght` axis can start and end. Probed low-to-high and
// high-to-low respectively, so the FIRST hit is the true bound.
const WGHT_LO_STOPS = [100, 200, 300, 400] as const;
const WGHT_HI_STOPS = [1000, 900, 800, 700] as const;
// A weight no static instance is ever named at: only a real variable axis
// answers 200 for it. (`Anton:wght@450` → 400; `Figtree:wght@450` → 200.)
const VARIABLE_PROBE_WEIGHT = 450;

/**
 * GET a css2 spec: its text when the API accepts it, else null - a SOFT probe
 * that never throws, so the caller can try the next spec.
 *
 * The subtlety that makes this soft: css2 answers a spec that doesn't fit the
 * family (wrong weight range, unknown family) with a 400 whose error body
 * carries NO `Access-Control-Allow-Origin` header - so in a browser the `fetch`
 * itself REJECTS ("TypeError: Failed to fetch") rather than resolving with a
 * readable 400. A dead network throws identically. We therefore CANNOT tell a
 * mis-fit spec from real offline here, so both fold to null; resolveFamilySpec
 * only concludes "unreachable/unknown" once the whole ladder - ending in the
 * bare family, which 200s for any real font - has failed.
 */
async function fetchSpec(spec: string): Promise<string | null> {
  try {
    const resp = await fetch(`${CSS2}?family=${spec}&display=swap`);
    return resp.ok ? await resp.text() : null;
  } catch {
    return null;
  }
}

/** True when css2 accepts this spec at all (used for the cheap axis probes). */
async function specOk(spec: string): Promise<boolean> {
  try {
    return (await fetch(`${CSS2}?family=${spec}&display=swap`)).ok;
  } catch { return false; }
}

/**
 * The variable `wght` range this family actually exposes, or null when it has
 * no axis. css2 refuses a range that isn't a subrange of the family's own
 * (`Figtree:wght@100..900` → 400, because Figtree starts at 300) and its error
 * body is an HTML page, not a machine-readable range - and the metadata
 * endpoint that would answer this serves no CORS header. So bound-probe with
 * single-weight requests, which cost ~1 KB each and only run when the widest
 * range was refused.
 */
async function probeWeightRange(enc: string): Promise<{ lo: number; hi: number } | null> {
  if (!await specOk(`${enc}:wght@${VARIABLE_PROBE_WEIGHT}`)) return null;  // static family
  let lo: number | null = null;
  for (const w of WGHT_LO_STOPS) if (await specOk(`${enc}:wght@${w}`)) { lo = w; break; }
  let hi: number | null = null;
  for (const w of WGHT_HI_STOPS) if (await specOk(`${enc}:wght@${w}`)) { hi = w; break; }
  return lo != null && hi != null && hi > lo ? { lo, hi } : null;
}

/**
 * The css2 stylesheet for a family, with the widest weight axis and both slants
 * it supports. Tries the common `100..900` first (one request for most
 * families), then probes the real axis bounds, then the static ladder.
 * Returns null when css2 refuses every spec - i.e. no such family.
 */
export async function resolveFamilySpec(name: string): Promise<string | null> {
  const enc = encodeFamily(name);
  const wide = await fetchSpec(variableSpec(enc, 100, 900));
  if (wide) return wide;

  const range = await probeWeightRange(enc);
  if (range) {
    const css = await fetchSpec(variableSpec(enc, range.lo, range.hi));
    if (css) return css;
  }
  for (const spec of staticSpecs(enc)) {
    const css = await fetchSpec(spec);
    if (css) return css;
  }
  return null;
}

/**
 * Fetch + parse + download one family: css2 (widest axis + both slants), filter
 * to the kept subsets, then pull every face's bytes. Throws with a
 * user-presentable message when the family doesn't exist or the network is out.
 */
export async function fetchGoogleFont(family: string): Promise<DownloadedFontFace[]> {
  const name = family.trim();
  if (!GOOGLE_FAMILY_RE.test(name)) {
    throw new Error(`"${family}" doesn't look like a Google Fonts family name.`);
  }
  // A definite offline signal short-circuits the whole spec ladder (which would
  // otherwise fire a dozen doomed requests before failing). navigator.onLine is
  // only trustworthy in the negative: false ⇒ certainly offline.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Couldn’t reach Google Fonts - you appear to be offline.');
  }
  const css = await resolveFamilySpec(name);
  // Everything failed: online-but-nothing-resolved is almost always a wrong name
  // (a mis-fit spec and an unknown family are indistinguishable here - both are
  // CORS-blocked 400s); a rare true outage lands here too, so name both.
  if (!css) throw new Error(`Couldn’t find a Google Font called “${name}” - check the spelling (or your connection).`);

  const faces = keepFaces(parseGoogleFontCss(css));
  if (!faces.length) throw new Error(`"${name}" has no downloadable latin faces.`);

  const downloaded: DownloadedFontFace[] = [];
  for (const face of faces) {
    const resp = await fetch(face.url).catch(() => null);
    if (!resp?.ok) throw new Error(`Downloading "${name}" failed partway - try again.`);
    downloaded.push({ ...face, bytes: new Uint8Array(await resp.arrayBuffer()) });
  }
  return downloaded;
}

// ─── Pinned brand fonts (SUSE era) ────────────────────────────────────────────
// TEMPORARY, SUSE-branded ordering: these families surface at the TOP of the
// add-font picker (in this exact order) ahead of the alphabetical rest, so the
// brand's own faces are one keystroke away. SWITCH THIS BACK ON 2026-08-29 - 
// when the SUSE branding leaves the public build, delete PINNED_FAMILIES and
// export the plain alphabetical `ALPHABETICAL_FAMILIES` as POPULAR_FAMILIES.
// (This ordering is intentionally NOT gated on the active content profile: the
// web bundle has no runtime profile signal, so the revert is a one-line edit.)
// Exported since plan 182 section 6.4: the compare stage offers the first six of
// these as one-press preview chips, which is the same "these are near at hand"
// claim the datalist order makes. Its filter drops any family already serving a
// role, so the starter's own faces never appear as something to add.
export const PINNED_FAMILIES: readonly string[] = [
  'Outfit', 'SUSE', 'SUSE Mono', 'Overpass', 'Overpass Mono',
  'JetBrains Mono', 'Ubuntu', 'Ubuntu Mono', 'Red Hat Display', 'Red Hat Mono',
];

/**
 * A hand-curated slice of the most-used Google Fonts families (alphabetical),
 * for the add-font <datalist> - suggestion only (any family name can be typed;
 * the list is names, not availability). Static data, no API key, works offline.
 */
const ALPHABETICAL_FAMILIES: readonly string[] = [
  'Albert Sans', 'Alegreya', 'Anton', 'Archivo', 'Archivo Black', 'Arimo',
  'Asap', 'Assistant', 'Atkinson Hyperlegible', 'Barlow', 'Be Vietnam Pro',
  'Bebas Neue', 'Bitter', 'Bricolage Grotesque', 'Cabin', 'Catamaran',
  'Caveat', 'Chivo', 'Comfortaa', 'Cormorant Garamond', 'Crimson Text',
  'DM Mono', 'DM Sans', 'DM Serif Display', 'Dancing Script', 'Dosis',
  'EB Garamond', 'Exo 2', 'Figtree', 'Fira Code', 'Fira Sans', 'Fraunces',
  'Gabarito', 'Geist', 'Geist Mono', 'Hanken Grotesk', 'Heebo', 'IBM Plex Mono',
  'IBM Plex Sans', 'IBM Plex Serif', 'Inconsolata', 'Instrument Sans', 'Inter',
  'JetBrains Mono', 'Josefin Sans', 'Kanit', 'Karla', 'Lato', 'Lexend',
  'Libre Baskerville', 'Libre Franklin', 'Lobster', 'Lora', 'M PLUS Rounded 1c',
  'Manrope', 'Maven Pro', 'Merriweather', 'Montserrat', 'Mulish', 'Noto Sans',
  'Noto Serif', 'Nunito', 'Nunito Sans', 'Onest', 'Open Sans', 'Oswald',
  'Outfit', 'Overpass', 'Overpass Mono', 'Oxanium', 'PT Sans', 'PT Serif', 'Pacifico',
  'Playfair Display', 'Plus Jakarta Sans', 'Poppins', 'Prompt', 'Public Sans',
  'Quicksand', 'Raleway', 'Red Hat Display', 'Red Hat Mono', 'Red Hat Text', 'Righteous',
  'Roboto', 'Roboto Condensed', 'Roboto Mono', 'Roboto Slab', 'Rubik',
  'Schibsted Grotesk', 'Signika', 'Sora', 'Source Code Pro', 'Source Sans 3',
  'Source Serif 4', 'Space Grotesk', 'Space Mono', 'Spectral', 'SUSE', 'SUSE Mono', 'Syne',
  'Titillium Web', 'Ubuntu', 'Ubuntu Mono', 'Unbounded', 'Urbanist',
  'Varela Round', 'Vollkorn', 'Work Sans', 'Zilla Slab',
];

/**
 * The picker order: pinned brand fonts first (see PINNED_FAMILIES), then every
 * other family alphabetically, de-duplicated so a pinned family never repeats
 * further down. The <datalist> renders in array order, which is the display
 * order until the user starts typing.
 */
export const POPULAR_FAMILIES: readonly string[] = (() => {
  const pinned = new Set(PINNED_FAMILIES);
  return [...PINNED_FAMILIES, ...ALPHABETICAL_FAMILIES.filter((f) => !pinned.has(f))];
})();

// SPDX-License-Identifier: MPL-2.0
/**
 * Module-level declarations of start.ts that its feature modules use: the types,
 * constants and pure helpers that used to sit above mountStart(). Moved here verbatim so
 * no feature module has to import the orchestrator file. Make it yours: brand rooms, source imports, exports and recovery.
 */
import { hexToOklch } from '@lolly/engine';
import type { UsageHost } from '../../lib/design-system/usage-model.ts';
import type { UserFontsHost } from '../../user-fonts.ts';
import type { installUserTokens } from '../../bridge/tokens.ts';
import { t } from '../../i18n.ts';
import type { LangSwitchHost } from '../../i18n.ts';
import type { DesignCensus } from '../../lib/design-system/census.ts';
import type { SwitchHost } from '../../lib/design-system/switch.ts';
import type { StartArea, StartSource } from '../../lib/design-system/start-route.ts';
import type { detectFontFormat } from '../../lib/font-utils.ts';
import { icon } from '../../lib/icons.ts';
import type { IconName } from '../../lib/icons.ts';

/** The view container, which main.ts reads a teardown fn off (see navigate()). */
export type ViewElement = HTMLElement & { _cleanup?: () => void };

/** Whatever host installUserTokens needs - stays in lock-step with the bridge -
 *  plus the profile slice the language switcher persists its choice through. */
export type StartHost = Parameters<typeof installUserTokens>[0] & LangSwitchHost & SwitchHost & UsageHost & UserFontsHost;

// ── The import card's format marks ───────────────────────────────────────────
// Recognition beats description: the four accepted formats lead the card as
// icon tiles, in preference order. Lolly's own brand file wears the full-colour
// app mark; the rest are mono inline SVGs on currentColor so they follow the
// theme like any glyph.
export const PENPOT_ICON = `<svg viewBox="0 -1 7.6 10.075" width="26" height="26" fill="none" stroke="currentColor" stroke-width="0.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M 1.1,2.4513642 V 0.65136419 l 0.9,-1.3 0.9,1.3 V 1.0513642 L 3.8,-0.24863581 4.7,1.0513642 V 0.65136419 l 0.9,-1.3 0.9,1.3 V 2.4513642 m -2.7,1.4 v 5 m -2.7,-7.3 -0.9,0.5 v 5 l 3.6,1.8 3.6,-1.8 v -5 l -0.9,-0.5 m -6.3,0.5 3.6,1.8 3.6,-1.8 m -4.5,-1 v 2.3 m 1.8,-2.3 v 2.3 m -3,-3.50000001 h 0.6 m 1.2,0.4 h 0.6 m 1.2,-0.4 h 0.6"/><path stroke-width="0.3" d="m 1.1,0.85136419 h 1.8 m 0,0.40000001 h 1.8 m 0,-0.40000001 h 1.8 m -4.5,0 V 2.8513642 m 1.8,-1.6 v 2.6 M 5.6,0.85136419 V 2.9513642"/></svg>`;
export const TOKENS_ICON = `<svg viewBox="0 0 26.0005 20.000443" width="28" height="22" fill="currentColor" aria-hidden="true"><path d="M 21.034696,6.7857749 C 19.657911,6.5152605 18.584202,5.5233742 18.29198,4.2542941 17.730078,1.8096451 14.90387,1.0874383 13.00025,2.0851691 c 0.772302,0.5310098 1.294128,1.3408833 1.415191,2.2584616 0.04342,0.2554858 0.123569,0.5059622 0.223759,0.7480893 a 3.6987005,3.6987005 0 0 0 1.576331,1.7341311 c 0.435829,0.2563208 0.936782,0.3899082 1.422706,0.5176511 0.399092,0.1319176 0.764788,0.3256193 1.071204,0.582775 1.284108,1.0219434 1.284108,3.1267798 0,4.1487228 -0.306416,0.257156 -0.672112,0.450857 -1.071204,0.582775 -0.484254,0.127743 -0.986877,0.260495 -1.422706,0.517651 -0.921753,0.515146 -1.619747,1.436064 -1.80009,2.482221 -0.121063,0.918413 -0.642889,1.728286 -1.415191,2.259296 1.90195,0.996061 4.728158,0.272184 5.29173,-2.16996 0.292222,-1.26908 1.365931,-2.260966 2.742716,-2.531481 3.75965,-0.737235 3.75965,-5.6908219 0,-6.4288921 z M 11.585059,15.658481 A 3.5066687,3.5066687 0 0 0 11.3613,14.909557 3.6987005,3.6987005 0 0 0 9.7849688,13.175426 C 9.34914,12.91994 8.8481873,12.786353 8.3622632,12.657775 A 3.2561923,3.2561923 0 0 1 7.2910594,12.075 c -1.2841087,-1.021943 -1.2841087,-3.1267794 0,-4.1487228 C 7.5974755,7.6691215 7.9631709,7.4754198 8.3622632,7.3435022 8.8465175,7.2149244 9.34914,7.0830069 9.7849688,6.8258511 10.707557,6.3107048 11.404716,5.3897868 11.585059,4.3427958 11.706122,3.4243825 12.227948,2.614509 13.00025,2.0843341 11.0983,1.0874383 8.2720917,1.8096451 7.70852,4.2534592 7.4162976,5.5225393 6.3417541,6.5152605 4.9658041,6.78494 c -3.7596498,0.7380703 -3.7596498,5.692492 0,6.429727 1.3751151,0.26968 2.4504935,1.262401 2.7427159,2.531481 0.5619019,2.443814 3.38811,3.166856 5.29173,2.169125 -0.772302,-0.53101 -1.294128,-1.340883 -1.415191,-2.258461 z"/></svg>`;
export const SVG_ICON = `<svg viewBox="0 0 390 390" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="m 216.63,37.47 53.15,53.98 c 5.04,5.15 4.97,15.13 2.15,18 L 245.54,88.34 240.35,119.6 218.3,107.96 182.99,130.27 171.3,83.24 152.33,116.06 h -29 c -11.82,0 -13.21,-15 -2.47,-25.74 18.76,-20.25 40.29,-40.89 51.99,-52.85 11.76,-12.02 32.25,-11.68 43.78,0 z M 131,238.6 c 3.59,2.23 57.89,13.26 71.16,15.46 4.6,0.97 1.34,5.71 -5,8.91 C 182.86,266.77 113.5,238.6 131,238.6 Z M 163.15,27.83 28.81,165.3 C -16.58,221.51 59.7,214.97 92.4,231.16 104.13,243.15 47.44,252 59.17,264 c 11.73,11.99 70.93,23.1 82.68,35.09 11.73,11.99 -24.01,24.71 -12.28,36.7 11.73,11.99 38.86,0.63 43.94,28.31 3.62,19.78 48.89,8.5 71.03,-7.7 11.73,-12 -22.44,-10.87 -10.71,-22.86 29.17,-29.83 56.33,-10.84 66.31,-40.73 4.93,-14.77 -42.94,-22.77 -31.19,-34.76 33.75,-19.71 150.4,-32.54 95.05,-87.89 L 224.75,27.83 c -17.03,-16.35 -45.45,-16.53 -61.6,0 z m 154.31,264.98 c 0,6.82 50.25,11.29 50.25,-1.61 -7.16,-20.72 -44.31,-19.32 -50.25,1.61 z M 91.1,329.05 c 11.9,10.29 30.28,-2.56 35.79,-16.92 -11.53,-15.32 -54.69,0.55 -35.79,16.92 z m 220.06,-22.23 c -15.34,13.76 1.72,27.72 16.84,18.83 3.37,-3.42 -0.09,-15.41 -16.84,-18.83 z"/></svg>`;

export const IMPORT_FORMATS: ReadonlyArray<{ icon: string; name: string; ext: string }> = [
  // `.lolly` is intentionally named generically here: its manifest can declare
  // a shared design, a design system, or an instance pack. The unified intake
  // reads that declaration and offers the matching verb.
  {
    icon: `<img src="/icons/icon-192.png" alt="" width="26" height="26" decoding="async">`,
    name: 'Lolly file',
    ext: '.lolly',
  },
  // Web builds before 1.0.7 exported the same lolly-brand payload as .zip.
  {
    icon: `<img src="/icons/icon-192.png" alt="" width="26" height="26" decoding="async">`,
    name: 'Brand pack',
    ext: '.zip',
  },
  { icon: PENPOT_ICON, name: 'Penpot', ext: '.penpot' },
  // The braces are the studio's own Tokens glyph (Andy, 2026-09-04) - the Token Studio mark
  // below is that product's, and a plain DTCG file is not from it.
  { icon: icon('tokens', { size: 26 }), name: 'Design Tokens', ext: '.json' },
  { icon: TOKENS_ICON, name: 'Token Studio', ext: '.json' },
  { icon: SVG_ICON, name: 'Plain SVG', ext: '.svg' },
];

/** The rail's glyphs, from the one registry (lib/icons.ts). Every AREA, not just
 *  the rooms: the foot's Versions entry wears its own from the same table. */
export const ROOM_ICONS: Record<StartArea, IconName> = {
  overview: 'dashboard',
  color: 'palette',
  type: 'font',
  logos: 'shapes',
  tokens: 'tokens',
  catalogue: 'folder',
  usage: 'clipboard',
  versions: 'tag',
};

// ── The source picker (plan 97 section 8) ───────────────────────────────────────────
// Stage 1 of the modal: WHAT you have, not what format it is. Four tiles are
// always here; the Website tile joins them ONLY on a device that can actually
// read a page (plan 97 section 9 - see the website source below). A disabled tile or a
// "coming soon" line would be advertising something nobody can press, so the
// gate is presence, not state: with no transport the tile does not exist, and
// `?source=url` opens this plain list exactly as it did before M6.
export type PickerSource = Extract<StartSource, 'file' | 'pdf' | 'image' | 'font' | 'url' | 'page'>;

export const SOURCE_TILES: ReadonlyArray<{ id: PickerSource; icon: IconName }> = [
  { id: 'image', icon: 'image' },
  { id: 'file', icon: 'upload' },
  { id: 'pdf', icon: 'document' },
  { id: 'page', icon: 'globe' },
  { id: 'font', icon: 'font' },
];

/** The capability-gated one, kept out of the list above so the gate reads as a
 *  gate: it is spliced in at the front only when a transport answered. */
export const WEBSITE_TILE: { id: PickerSource; icon: IconName } = { id: 'url', icon: 'globe' };

/** A screenshot or a photo. Bigger than a token file by a lot, and still far
 *  under what a decode of a phone panorama costs. */
export const IMAGE_MAX_BYTES = 20 * 1024 * 1024;

/** What the image source names its own kind of file - the router's own test, so
 *  a drag anywhere on the studio and the picker's Image stage agree. SVG is
 *  excluded: a mark's colours are read as a colour LIST, not as painted pixels. */
export const IMAGE_NAME = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;
export const FONT_NAME = /\.(ttf|otf|woff2?)$/i;
/** What the PDF source claims. `.ai` is a PDF wearing another extension, and
 *  the reader opens it as one - the drop router's own sniff says the same. */
export const PDF_NAME = /\.(pdf|ai)$/i;

/** How many embedded faces the PDF stage offers to install in the dialog. The
 *  candidates arrive installable-first, so a longer list is the tail: rarely the
 *  brand's own type, and a dialog is not the place to scroll thirty rows. The
 *  rest are named as a count, with the way to see them all beside it. */
export const MAX_PDF_FONT_ROWS = 6;

/** One embedded face as the PDF stage shows it.
 *
 *  `format` is THIS DEVICE's reading of the bytes (the magic number, through the
 *  same `detectFontFormat` the install itself uses), and it is the only honest
 *  way to know whether the one action the row offers can succeed:
 *  `PdfFontCandidate.chips` report what the DOCUMENT stated, and a raw `cff`/
 *  `pfb` font program is not a file anything can install. A row that cannot act
 *  says so instead of wearing a button guaranteed to answer "could not add". */
export interface PdfFontRow {
  family: string;
  /** The document's own spelling, kept for the stored file's name. */
  raw: string;
  chips: string[];
  bytes: Uint8Array;
  subset: boolean;
  format: ReturnType<typeof detectFontFormat>;
}

/** A source's own vocabulary, in words. `describeFaceSource` reports what the
 *  DOCUMENT stated about the bytes, so each chip is translated and nothing is
 *  softened: `unknown` stays unknown, and an unrecognised token is repeated
 *  verbatim rather than guessed at. A switch, not a table, so an attacker-shaped
 *  token can never reach an inherited key. */
export function faceChipText(chip: string): string {
  switch (chip) {
    case 'SUBSET':
      return t('subset');
    case 'installable':
      return t('no stated restriction');
    case 'restricted':
      return t('reuse forbidden');
    case 'preview-print':
      return t('preview and print only');
    case 'editable':
      return t('embedding for editing');
    case 'unknown':
      return t('embedding unknown');
    default:
      return chip;
  }
}

/** Fold perceptually-identical colours together before they become candidates.
 *
 * A quantised photo cloud reports one wall as dozens of adjacent buckets, so the
 * heaviest twelve would be twelve shades of the same paint. Greedy and
 * deterministic: heaviest first, and a later colour within `minDistance` in
 * OKLab of one already kept folds into it (weights sum; the heavier evidence
 * keeps its hex). Sources that already report DISTINCT colours - an SVG's list,
 * a token document - are untouched at this threshold.
 *
 * INTERIM HOME. Plan 97 section 2d puts this in lib/design-system/census.ts as
 * `condenseCensus`, beside the adapters it serves; it lives here only because
 * this milestone's shell work must not reach into that file. Move it, keep the
 * behaviour.
 */
export function condenseColors(
  census: DesignCensus,
  opts: { minDistance?: number; max?: number } = {}
): DesignCensus {
  const minDistance = opts.minDistance ?? 0.06;
  const max = opts.max ?? 24;
  const rows = [...census.colors].sort(
    (a, b) => b.weight - a.weight || (a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0)
  );
  const kept: Array<{ row: (typeof rows)[number]; l: number; a: number; b: number }> = [];
  for (const row of rows) {
    const o = hexToOklch(row.hex);
    if (!o) continue;
    const a = o.c * Math.cos((o.h * Math.PI) / 180);
    const b = o.c * Math.sin((o.h * Math.PI) / 180);
    const near = kept.find((k) => Math.hypot(k.l - o.l, k.a - a, k.b - b) < minDistance);
    if (near) near.row.weight += row.weight;
    else if (kept.length < max) kept.push({ row: { ...row }, l: o.l, a, b });
  }
  return { ...census, colors: kept.map((k) => k.row) };
}

// ── The website source's transport (plan 97 section 9, M6) ──────────────────────────

/**
 * How long the studio waits for a page read before it stops waiting.
 *
 * It has to exceed the EXTENSION's own budget, which is 30s for the page to
 * load, a settle, then up to 20s to read it: a shorter one here gives up while
 * the extension is still working, and the person pays with a re-press of a
 * consent button. The native fetch has its own, much shorter, Rust-side
 * deadline (and clamps anything longer than 60s to 60s), so this is only ever
 * the backstop for a transport that dies without answering.
 */
export const SITE_READ_BUDGET_MS = 90_000;

/** What the Logos room will actually take (its own `LOGO_ACCEPT_TYPES`). A
 *  favicon is very often an `.ico` or a `.gif`, and offering to send marks the
 *  room then refuses would be a button that promises a count it cannot keep. */
export const LOGO_ROOM_MIME = /^image\/(?:png|jpeg|svg\+xml|webp)$/;

/** The file extension for a mark the room accepts. A switch, not a lookup: the
 *  same rule faceChipText follows, so no inherited key can ever answer. */
export function markExtension(mime: string): string | null {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/svg+xml':
      return 'svg';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

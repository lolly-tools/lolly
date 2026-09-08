// SPDX-License-Identifier: MPL-2.0
/**
 * #/start - the Design System studio (plan 97). This is THE place the design
 * system is set, saved, edited and deleted; the Dashboard's Design-system tab
 * renders the result read-only, and user preferences (theme, sound) live on
 * Profile. Five of the six rooms are lib/brand-editor.ts's panels, mounted once
 * with everything wired; this view owns what sits around them:
 *
 *   - the RAIL of rooms (Overview · Colours · Type · Logos · Tokens · Files) -
 *     independent areas, not steps: nothing is numbered, nothing gates on
 *     anything else, and arriving anywhere is legitimate. The editor renders
 *     all five of its panels and this view flips `data-active-tab` on it, so
 *     changing room never re-mounts anything. `overview` is not one of the
 *     editor's panels - parking that key on the same attribute hides all five,
 *     which is exactly what the Overview room wants. On a phone the rail
 *     becomes a horizontal chip strip pinned under the header;
 *   - the RAIL FOOT: "Add from…" (the source picker - a design file: a
 *     W3C/Tokens-Studio JSON, a Penpot file, an SVG's colours or a Lolly brand
 *     file; a PDF, read here for its colours, marks and embedded faces; an image;
 *     a font file), Export, and Versions (plan 97 section 6a - publish, activate,
 *     restore; hidden until the studio has something of its own to publish, and
 *     mounted the first time it is opened). All three act on the whole design
 *     system rather than the open room, which is why they sit in the chrome and
 *     not in a room;
 *   - the OVERVIEW room itself (lib/design-system/rooms/overview.ts) - the hub
 *     and the completion state. There is no finish card: Overview is always
 *     reachable and always reflects exactly what exists.
 *
 * Everything persists to the one `user/tokens/brand` install via the bridge's
 * single write chokepoint (installUserTokens → bust); a source install takes a
 * checkpoint first (lib/design-system/studio-state.ts), so "revert to before
 * the import" is one restore rather than a lost afternoon. A LOCKED catalog
 * owns its brand and can't be adjusted, so the route degrades to a read-only
 * note. Esc or the back pill returns to the view the user came from - the pill
 * wears that view's name (lib/back-nav.ts), falling back to "Tools" (the
 * gallery) when there's no history. `?area=<key>` deep-links a room (`?tab=` is
 * its kept alias - see lib/design-system/start-route.ts for the whole table).
 */

import '../styles/parts/start.css'; // this view's shell/layout (lazy chunk)
import type { PenpotUsage, TokensExtraction } from '@lolly/engine';
import {
  deriveBrandTokens,
  extractPenpotProject,
  extractSvgColors,
  hexToOklch,
  imageColorCloud,
  scanPenpotAppliedTokens,
  scanPenpotUsage,
  summarizeTokensDoc,
} from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { announce } from '../a11y.ts';
import { applyChromeBrandVars } from '../brand-vars.ts';
import { bustFontRegistry } from '../bridge/font-registry.ts';
import { installUserTokens } from '../bridge/tokens.ts';
import { siteIngestSupport } from '../capabilities.ts';
import { backPillHtml, mountBackPill, resolveBackTarget } from '../components/back-pill.ts';
import { homeFabHtml, mountHomeFab } from '../components/home-fab.ts';
import { attachLangMenu, langFabHtml } from '../components/lang-menu.ts';
import { type ModalHandle, mountModal } from '../components/modal.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { markWelcomeDismissed } from '../components/welcome-dialog.ts';
import type { LangSwitchHost } from '../i18n.ts';
import { t, tRaw } from '../i18n.ts';
import { addSwatch } from '../lib/brand-doc.ts';
import type { BrandEditorHandle, BrandTabKey } from '../lib/brand-editor.ts';
import { mountBrandEditor } from '../lib/brand-editor.ts';
import type { TokenRoleProposal } from '../lib/brand-propose.ts';
import {
  buildBrandDocFromUsage,
  proposeBrandRoles,
  proposeFonts,
  proposeFontsFromTokens,
  proposeRolesFromTokens,
  withRoleAliases,
} from '../lib/brand-propose.ts';
import { activeDesignSystemRecord } from '../lib/design-system/active.ts';
import type { ColorEntry } from '../lib/design-system/add-color.ts';
import type { DesignCensus } from '../lib/design-system/census.ts';
import { censusFromImageCloud, censusFromSvgColors } from '../lib/design-system/census.ts';
import { renameDesignSystem } from '../lib/design-system/manage.ts';
import { hasPendingLogoFiles, stashPendingLogoFiles } from '../lib/design-system/pending-files.ts';
import type { OverviewRoom } from '../lib/design-system/rooms/overview.ts';
// readOverview is imported for its `furnished` answer alone (plans/137 B1): the
// foot's export actions and the first-publish entry appear on the same signal the
// Overview room decides its empty state with, so the two can never disagree about
// whether anything is here.
import { mountOverviewRoom, readOverview } from '../lib/design-system/rooms/overview.ts';
import type { VersionsRoom } from '../lib/design-system/rooms/versions.ts';
// Versions (plan 97 section 6a, M7): a foot-pinned panel, not a room - it acts on the
// whole design system, and it stays hidden until something has been published.
import { mountVersionsRoom } from '../lib/design-system/rooms/versions.ts';
import type {
  ColorTokenRow,
  DesignFileRoute,
  RoleFollow,
} from '../lib/design-system/sources/file.ts';
import {
  applyMappingChoice,
  censusFromTokensDoc,
  chooserRows,
  colorTokenRows,
  designFileLimit,
  docNeedsMappingReview,
  followRoles,
  routeDesignFile,
} from '../lib/design-system/sources/file.ts';
// The PDF source (M5). The scanner itself is imported on demand - it reaches
// views/pdf-import.ts, and with it pdf-lib and the whole PDF interpreter, which
// the studio must not carry until a PDF actually arrives. Only its SHAPES are
// named here, and a type import is erased.
import type { PdfFontCandidate, PdfLogoPick } from '../lib/design-system/sources/pdf.ts';
import type {
  SiteScanPhase,
  SiteScanResult,
  SiteScanWarning,
} from '../lib/design-system/sources/website.ts';
// The website source (M6). Imported statically, unlike the PDF one: the picker
// has to know AT MOUNT whether a transport exists, because that decides whether
// the tile is rendered at all (plan 97 section 9) - and the module it pulls in is the
// pure HTML/CSS reader plus a transport probe, not a parser library. Its own
// heavy leg (the image decoder, for a screenshot census) is lazy inside it.
import {
  detectSiteTransport,
  normalizeSiteUrl,
  SITE_MAX_URL_CHARS,
  scanWebsite,
} from '../lib/design-system/sources/website.ts';
import type { StartArea, StartRoom, StartSource } from '../lib/design-system/start-route.ts';
import { isStartArea, resolveStartRoute, START_ROOMS } from '../lib/design-system/start-route.ts';
import { createStudioState } from '../lib/design-system/studio-state.ts';
import type { Tray } from '../lib/design-system/tray.ts';
// The M2 source framework: one census type, one persistent tray, one file router.
// This view owns the copy, the markup and the install; those modules own the
// sniffing, the shapes and the model (plan 97 section 8).
import { candidatesFromCensus, createTray } from '../lib/design-system/tray.ts';
import type { TrayUi } from '../lib/design-system/tray-ui.ts';
import { mountTrayUi } from '../lib/design-system/tray-ui.ts';
import { readSystemName } from '../lib/design-system/type-compare.ts';
// The published-version index, read once for the rail entry's latch. readIndex,
// not hasPublishableSystem: the latter also answers true for a system that merely
// EXISTS, which put versioning on the face of a studio one colour old.
import { readIndex } from '../lib/design-system/versions-io.ts';
import { openLollyFile, takePendingDesignSystemFile } from '../lib/drop-router.ts';
import { detectFontFormat } from '../lib/font-utils.ts';
import type { IconName } from '../lib/icons.ts';
import { icon } from '../lib/icons.ts';
import { playSfx } from '../lib/sfx.ts';
import { mountPaletteSheet, type PaletteSheet } from '../lib/design-system/palette-sheet.ts';
import { navigateTo } from '../nav.ts';
import { saveBlob } from '../pro/zip.ts';
import { applyTheme } from '../theme.ts';
import type { UserFontsHost } from '../user-fonts.ts';
import { carryUserFontTokens, installFontFromBytes, installGoogleFont } from '../user-fonts.ts';
import { escape } from '../utils.ts';

/** The view container, which main.ts reads a teardown fn off (see navigate()). */
type ViewElement = HTMLElement & { _cleanup?: () => void };

/** Whatever host installUserTokens needs - stays in lock-step with the bridge -
 *  plus the profile slice the language switcher persists its choice through. */
type StartHost = Parameters<typeof installUserTokens>[0] & LangSwitchHost;

// Compile-time pin: every room but Overview IS one of the editor's panel keys,
// which is what lets a room key be written straight onto `data-active-tab`. If
// either list drifts, this stops compiling instead of silently opening a room
// with no panel behind it. START_ROOMS, not START_AREAS: `versions` is a
// foot-pinned panel this view renders itself, and parking its key on the same
// attribute is exactly how the editor hides - the same trick `overview` uses.
type RoomsArePanels =
  Exclude<StartRoom, 'overview'> extends BrandTabKey
    ? BrandTabKey extends Exclude<StartRoom, 'overview'>
      ? true
      : never
    : never;
const ROOMS_ARE_PANELS: RoomsArePanels = true;
void ROOMS_ARE_PANELS;

// ── The import card's format marks ───────────────────────────────────────────
// Recognition beats description: the four accepted formats lead the card as
// icon tiles, in preference order. Lolly's own brand file wears the full-colour
// app mark; the rest are mono inline SVGs on currentColor so they follow the
// theme like any glyph.
const PENPOT_ICON = `<svg viewBox="0 -1 7.6 10.075" width="26" height="26" fill="none" stroke="currentColor" stroke-width="0.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M 1.1,2.4513642 V 0.65136419 l 0.9,-1.3 0.9,1.3 V 1.0513642 L 3.8,-0.24863581 4.7,1.0513642 V 0.65136419 l 0.9,-1.3 0.9,1.3 V 2.4513642 m -2.7,1.4 v 5 m -2.7,-7.3 -0.9,0.5 v 5 l 3.6,1.8 3.6,-1.8 v -5 l -0.9,-0.5 m -6.3,0.5 3.6,1.8 3.6,-1.8 m -4.5,-1 v 2.3 m 1.8,-2.3 v 2.3 m -3,-3.50000001 h 0.6 m 1.2,0.4 h 0.6 m 1.2,-0.4 h 0.6"/><path stroke-width="0.3" d="m 1.1,0.85136419 h 1.8 m 0,0.40000001 h 1.8 m 0,-0.40000001 h 1.8 m -4.5,0 V 2.8513642 m 1.8,-1.6 v 2.6 M 5.6,0.85136419 V 2.9513642"/></svg>`;
const TOKENS_ICON = `<svg viewBox="0 0 26.0005 20.000443" width="28" height="22" fill="currentColor" aria-hidden="true"><path d="M 21.034696,6.7857749 C 19.657911,6.5152605 18.584202,5.5233742 18.29198,4.2542941 17.730078,1.8096451 14.90387,1.0874383 13.00025,2.0851691 c 0.772302,0.5310098 1.294128,1.3408833 1.415191,2.2584616 0.04342,0.2554858 0.123569,0.5059622 0.223759,0.7480893 a 3.6987005,3.6987005 0 0 0 1.576331,1.7341311 c 0.435829,0.2563208 0.936782,0.3899082 1.422706,0.5176511 0.399092,0.1319176 0.764788,0.3256193 1.071204,0.582775 1.284108,1.0219434 1.284108,3.1267798 0,4.1487228 -0.306416,0.257156 -0.672112,0.450857 -1.071204,0.582775 -0.484254,0.127743 -0.986877,0.260495 -1.422706,0.517651 -0.921753,0.515146 -1.619747,1.436064 -1.80009,2.482221 -0.121063,0.918413 -0.642889,1.728286 -1.415191,2.259296 1.90195,0.996061 4.728158,0.272184 5.29173,-2.16996 0.292222,-1.26908 1.365931,-2.260966 2.742716,-2.531481 3.75965,-0.737235 3.75965,-5.6908219 0,-6.4288921 z M 11.585059,15.658481 A 3.5066687,3.5066687 0 0 0 11.3613,14.909557 3.6987005,3.6987005 0 0 0 9.7849688,13.175426 C 9.34914,12.91994 8.8481873,12.786353 8.3622632,12.657775 A 3.2561923,3.2561923 0 0 1 7.2910594,12.075 c -1.2841087,-1.021943 -1.2841087,-3.1267794 0,-4.1487228 C 7.5974755,7.6691215 7.9631709,7.4754198 8.3622632,7.3435022 8.8465175,7.2149244 9.34914,7.0830069 9.7849688,6.8258511 10.707557,6.3107048 11.404716,5.3897868 11.585059,4.3427958 11.706122,3.4243825 12.227948,2.614509 13.00025,2.0843341 11.0983,1.0874383 8.2720917,1.8096451 7.70852,4.2534592 7.4162976,5.5225393 6.3417541,6.5152605 4.9658041,6.78494 c -3.7596498,0.7380703 -3.7596498,5.692492 0,6.429727 1.3751151,0.26968 2.4504935,1.262401 2.7427159,2.531481 0.5619019,2.443814 3.38811,3.166856 5.29173,2.169125 -0.772302,-0.53101 -1.294128,-1.340883 -1.415191,-2.258461 z"/></svg>`;
const SVG_ICON = `<svg viewBox="0 0 390 390" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="m 216.63,37.47 53.15,53.98 c 5.04,5.15 4.97,15.13 2.15,18 L 245.54,88.34 240.35,119.6 218.3,107.96 182.99,130.27 171.3,83.24 152.33,116.06 h -29 c -11.82,0 -13.21,-15 -2.47,-25.74 18.76,-20.25 40.29,-40.89 51.99,-52.85 11.76,-12.02 32.25,-11.68 43.78,0 z M 131,238.6 c 3.59,2.23 57.89,13.26 71.16,15.46 4.6,0.97 1.34,5.71 -5,8.91 C 182.86,266.77 113.5,238.6 131,238.6 Z M 163.15,27.83 28.81,165.3 C -16.58,221.51 59.7,214.97 92.4,231.16 104.13,243.15 47.44,252 59.17,264 c 11.73,11.99 70.93,23.1 82.68,35.09 11.73,11.99 -24.01,24.71 -12.28,36.7 11.73,11.99 38.86,0.63 43.94,28.31 3.62,19.78 48.89,8.5 71.03,-7.7 11.73,-12 -22.44,-10.87 -10.71,-22.86 29.17,-29.83 56.33,-10.84 66.31,-40.73 4.93,-14.77 -42.94,-22.77 -31.19,-34.76 33.75,-19.71 150.4,-32.54 95.05,-87.89 L 224.75,27.83 c -17.03,-16.35 -45.45,-16.53 -61.6,0 z m 154.31,264.98 c 0,6.82 50.25,11.29 50.25,-1.61 -7.16,-20.72 -44.31,-19.32 -50.25,1.61 z M 91.1,329.05 c 11.9,10.29 30.28,-2.56 35.79,-16.92 -11.53,-15.32 -54.69,0.55 -35.79,16.92 z m 220.06,-22.23 c -15.34,13.76 1.72,27.72 16.84,18.83 3.37,-3.42 -0.09,-15.41 -16.84,-18.83 z"/></svg>`;

const IMPORT_FORMATS: ReadonlyArray<{ icon: string; name: string; ext: string }> = [
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
const ROOM_ICONS: Record<StartArea, IconName> = {
  overview: 'dashboard',
  color: 'palette',
  type: 'font',
  logos: 'shapes',
  tokens: 'tokens',
  catalogue: 'folder',
  versions: 'tag',
};

// ── The source picker (plan 97 section 8) ───────────────────────────────────────────
// Stage 1 of the modal: WHAT you have, not what format it is. Four tiles are
// always here; the Website tile joins them ONLY on a device that can actually
// read a page (plan 97 section 9 - see the website source below). A disabled tile or a
// "coming soon" line would be advertising something nobody can press, so the
// gate is presence, not state: with no transport the tile does not exist, and
// `?source=url` lands on this plain list exactly as it did before M6.
type PickerSource = Extract<StartSource, 'file' | 'pdf' | 'image' | 'font' | 'url'>;

const SOURCE_TILES: ReadonlyArray<{ id: PickerSource; icon: IconName }> = [
  { id: 'file', icon: 'upload' },
  { id: 'pdf', icon: 'document' },
  { id: 'image', icon: 'image' },
  { id: 'font', icon: 'font' },
];

/** The capability-gated one, kept out of the list above so the gate reads as a
 *  gate: it is spliced in at the front only when a transport answered. */
const WEBSITE_TILE: { id: PickerSource; icon: IconName } = { id: 'url', icon: 'globe' };

/** A screenshot or a photo. Bigger than a token file by a lot, and still far
 *  under what a decode of a phone panorama costs. */
const IMAGE_MAX_BYTES = 20 * 1024 * 1024;

/** What the image source names its own kind of file - the router's own test, so
 *  a drag anywhere on the studio and the picker's Image stage agree. SVG is
 *  excluded: a mark's colours are read as a colour LIST, not as painted pixels. */
const IMAGE_NAME = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;
const FONT_NAME = /\.(ttf|otf|woff2?)$/i;
/** What the PDF source claims. `.ai` is a PDF wearing another extension, and
 *  the reader opens it as one - the drop router's own sniff says the same. */
const PDF_NAME = /\.(pdf|ai)$/i;

/** How many embedded faces the PDF stage offers to install in the dialog. The
 *  candidates arrive installable-first, so a longer list is the tail: rarely the
 *  brand's own type, and a dialog is not the place to scroll thirty rows. The
 *  rest are named as a count, with the way to see them all beside it. */
const MAX_PDF_FONT_ROWS = 6;

/** One embedded face as the PDF stage shows it.
 *
 *  `format` is THIS DEVICE's reading of the bytes (the magic number, through the
 *  same `detectFontFormat` the install itself uses), and it is the only honest
 *  way to know whether the one action the row offers can succeed:
 *  `PdfFontCandidate.chips` report what the DOCUMENT stated, and a raw `cff`/
 *  `pfb` font program is not a file anything can install. A row that cannot act
 *  says so instead of wearing a button guaranteed to answer "could not add". */
interface PdfFontRow {
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
function faceChipText(chip: string): string {
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
function condenseColors(
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
const SITE_READ_BUDGET_MS = 90_000;

/** What the Logos room will actually take (its own `LOGO_ACCEPT_TYPES`). A
 *  favicon is very often an `.ico` or a `.gif`, and offering to send marks the
 *  room then refuses would be a button that promises a count it cannot keep. */
const LOGO_ROOM_MIME = /^image\/(?:png|jpeg|svg\+xml|webp)$/;

/** The file extension for a mark the room accepts. A switch, not a lookup: the
 *  same rule faceChipText follows, so no inherited key can ever answer. */
function markExtension(mime: string): string | null {
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

export async function mountStart(viewEl: HTMLElement, host: StartHost, params = ''): Promise<void> {
  document.title = 'Make it yours · Lolly';

  // The back pill wears the name of the view the user came from - a tool's
  // "Manage fonts", the Dashboard CTA, a project folder - and returns there;
  // with no recorded history it's the classic "Tools" → gallery. Rendering and
  // click handling are the shared ones (components/back-pill.ts), so /start's
  // pill behaves and lines up exactly like every other view's; only the in-flow
  // placement (.start-back) is this view's own. Esc leaves the studio the same
  // way, hence the resolved target being kept alongside.
  const backTarget = resolveBackTarget();
  const backHref = backTarget.href;
  const backPill = backPillHtml({ class: 'start-back' });
  const wireBackPill = (): void => {
    mountBackPill(viewEl);
  };

  // The history-INDEPENDENT escape, beside the back pill in the same in-flow row
  // (shared chrome - components/home-fab.ts). The back pill answers "where did I
  // come from"; this answers "just get me out", always to the front door. The
  // studio paints no global nav of its own, so it is the one exit that never
  // depends on the back stack.
  //
  // One Home per view (plans/137 B4). A pill that IS the way home already - a
  // direct arrival, or a back target that happens to BE Home - renders with
  // `data-back-home`, which is the same attribute back-pill.ts reads before it
  // adds a FAB of its own (addHomeEscape). Read off the rendered markup rather
  // than re-derived from backTarget, so this can never disagree with the pill:
  // the ` data-back-home>` form cannot come out of escaped label text, because
  // escape() turns a '>' into an entity.
  const pillIsHome = backPill.includes(' data-back-home>');
  const homeFab = pillIsHome ? '' : homeFabHtml();
  const wireHomeFab = (): void => {
    mountHomeFab(viewEl);
    // Light/dark/brand beside the escape - the studio is where you're shaping the
    // brand, so flipping the theme to check it in place belongs right here.
    mountThemeFab(viewEl.querySelector('.gallery-topright'), host);
    mountProfileFab(viewEl.querySelector('.gallery-topright'), host);
  };

  // A locked catalog is authoritative - its brand (colours, fonts, radius) can't
  // be adjusted; every write funnels through installUserTokens, which refuses. So
  // skip the whole studio and say why, rather than dead-ending on an error.
  if (await host.tokens?.isLocked?.().catch(() => false)) {
    document.title = 'Brand · Lolly';
    // Nothing here can accept a file the front door handed over (lib/drop-router.ts),
    // so the stash is spent rather than left holding a document's bytes for the
    // rest of the session.
    takePendingDesignSystemFile();
    viewEl.innerHTML = `
      <div class="start">
        <div class="start-back-row">${backPill}${homeFab}</div>
        <div class="gallery-topright">${langFabHtml()}</div>
        <header class="start-head">
          <p class="start-eyebrow">${t('Brand')}</p>
          <h1 class="start-title">${t('This brand is set')}</h1>
          <p class="start-sub">${t('This build ships with a fixed brand - its colours, fonts and tokens are what every tool and export use. Brand adjustment is turned off here, so there’s nothing to change.')}</p>
        </header>
      </div>`;
    attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);
    wireBackPill();
    wireHomeFab();
    return;
  }

  // A READ-ONLY design system (plans/186 section 3.5, the material lock): a hosted
  // or packaged system whose material is the host's. The rooms would refuse every
  // write, so say so once, and offer the two honest moves - an editable copy, or
  // a switch. The BUILD lock above is the other lock and keeps its own page.
  {
    const active = await activeDesignSystemRecord(host);
    if (active?.locked) {
      document.title = `${active.label} · Lolly`;
      takePendingDesignSystemFile();
      viewEl.innerHTML = `
        <div class="start">
          <div class="start-back-row">${backPill}${homeFab}</div>
          <div class="gallery-topright">${langFabHtml()}</div>
          <header class="start-head">
            <p class="start-eyebrow">${t('Design system')}</p>
            <h1 class="start-title">${escape(active.label)}</h1>
            <p class="start-sub">${t('This design system is read-only: its colours, type and logos are kept current from where it came. Make an editable copy to change them, or switch to another design system.')}</p>
            <p class="start-sub">
              <button type="button" class="be-btn" data-ds-fork>${t('Make an editable copy')}</button>
              <a class="be-btn" href="#/profile?focus=design-systems-section">${t('Switch')}</a>
            </p>
          </header>
        </div>`;
      attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);
      wireBackPill();
      wireHomeFab();
      viewEl.querySelector('[data-ds-fork]')?.addEventListener('click', async () => {
        const [{ createDesignSystem }, { switchDesignSystem }] = await Promise.all([
          import('../lib/design-system/manage.ts'),
          import('../lib/design-system/switch.ts'),
        ]);
        const copy = await createDesignSystem(
          host as unknown as Parameters<typeof createDesignSystem>[0],
          { label: `${active.label} copy`, seedFrom: active.id }
        );
        await switchDesignSystem(
          host as unknown as Parameters<typeof switchDesignSystem>[0],
          copy.id,
          { route: 'start' }
        );
      });
      return;
    }
  }

  // Read-only deep-link flags, consumed on mount and never propagated into a
  // generated link: which room, whether the OKLCH colour chart opens with it,
  // and whether the source modal is open on arrival (`?import=0` still means
  // shut, so the links that carried it land where they always did).
  const route = resolveStartRoute(params);
  const wantWheel = route.wheel;
  const importOpen = route.importOpen;
  // Profile creates a system with a neutral temporary label, then brings focus
  // here. Naming belongs beside the colours, type and assets it describes - not
  // in a detached setup prompt.
  const focusDsName =
    new URLSearchParams(params.startsWith('?') ? params.slice(1) : params).get('rename') === '1';
  // `?source=url&u=<address>` PREFILLS the website source's field and does
  // nothing else - the fetch button is the consent, so a link somebody sends
  // must never be able to start a read (plan 97 section 9). Read here rather than in
  // resolveStartRoute because it is the only param that belongs to one stage
  // rather than to the route; it should move there the next time that file is
  // open, with the same "prefill, never act" contract written on it.
  let urlPrefill =
    new URLSearchParams(params.startsWith('?') ? params.slice(1) : params).get('u') ?? '';
  if (urlPrefill.length > SITE_MAX_URL_CHARS) urlPrefill = '';
  let activeArea: StartArea = isStartArea(route.area) ? route.area : 'overview';

  // Rooms are peers: one flat list, no order to obey. Built at mount so every
  // label resolves against the language in force right now.
  const ROOM_LABELS: Record<StartArea, string> = {
    overview: t('Overview'),
    color: t('Colours'),
    type: t('Type'),
    logos: t('Logos'),
    tokens: t('Tokens'),
    catalogue: t('Files'),
    versions: t('Versions'),
  };

  viewEl.innerHTML = `
    <div class="start start--studio">
      <div class="start-back-row">${backPill}${homeFab}</div>
      <div class="gallery-topright start-topright">${langFabHtml()}</div>
      <header class="start-head">
        <p class="start-eyebrow">${t('Design system')}</p>
        <h1 class="start-title">${t('Make it yours')}</h1>
        <p class="start-sub">${t('Everything stays on this device. Every tool and export follows it.')}</p>
        <!-- Which design system the studio is editing (plans/186 section 5): filled
             async from the registry; the link opens the Profile card that switches. -->
        <p class="start-sub start-ds" data-start-ds hidden></p>
      </header>

      <div class="ds-shell">
        <!-- The rail: independent rooms, in no order. A phone gets the same list
             as a horizontal chip strip pinned under the header. -->
        <aside class="ds-rail">
          <nav class="ds-room-nav" aria-label="${escape(t('Design system rooms'))}">
            <ul class="ds-rooms" role="list">
            ${START_ROOMS.map(
              (area) => `
              <li>
                <button type="button" class="ds-room" id="ds-room-${area}" data-ds-room="${area}"${area === activeArea ? ' aria-current="page"' : ''}>
                  <span class="ds-room-ic" aria-hidden="true">${icon(ROOM_ICONS[area])}</span>
                  <span class="ds-room-label">${escape(ROOM_LABELS[area])}</span>
                </button>
              </li>`
            ).join('')}
            </ul>
          </nav>
          <!-- Foot: whole-system actions. They belong to the studio rather than
               to any one room, and the transient note rides with them. -->
          <div class="ds-rail-actions">
            <!-- Hidden while the studio is empty: the Overview room's own two
                 doors are showing then, and "Start from a file" opens this very
                 modal - three ways into one dialog on one screen (plans/163 F2).
                 It appears with the furnished room, which is where the doors go. -->
            <button type="button" class="be-btn start-import-cta" data-start-import aria-haspopup="dialog" hidden>
              <span class="start-import-cta-ic" aria-hidden="true">↓</span> <span>${t('Add from…')}</span></button>
            <!-- Hidden until a scan actually keeps something: an empty concept is
                 never advertised (plan 97 section 9). The count rides the subscription. -->
            <button type="button" class="be-btn ds-tray-toggle" data-start-tray aria-expanded="false" hidden>
              <span class="ds-tray-toggle-ic" aria-hidden="true">${icon('dock')}</span>
              <span>${t('Tray')}</span>
              <span class="ds-tray-toggle-n" data-start-tray-n></span></button>
            <!-- Both exports wait for a system worth exporting (plans/137 B1,
                 raised by plans/163 F4). An empty studio has nothing to send
                 anywhere, and offering to export it is a button that can only
                 disappoint - and one colour in is still nearly empty, which is
                 why the bar is readOverview's worthExporting rather than its
                 furnished. data-start-furnished is what refreshFurnished()
                 reveals, on the same reading the Overview room decides its own
                 empty state with. -->
            <button type="button" class="be-btn start-export-btn" data-start-export data-start-furnished data-sfx="whoosh" hidden>
              <span aria-hidden="true">↑</span> <span>${t('Export')}</span></button>
            <!-- The pack zip carries fonts, logos and a theme preference; this is
                 the plain document, for a repo or another tool that reads DTCG. -->
            <button type="button" class="be-btn start-export-tokens" data-start-export-tokens data-start-furnished hidden>
              <span aria-hidden="true">↑</span> <span>${t('Tokens (.json)')}</span></button>
            <!-- Get this brand's fonts onto a Linux box as an installable package
                 (plan 197 M5). Shell-side because enumerating the brand's fonts uses
                 host.assets internals a tool hook can't reach; it seals them with
                 host.export.pack and hands over the .rpm. -->
            <button type="button" class="be-btn start-get-on-device" data-start-get-on-device data-start-furnished data-sfx="whoosh" hidden>
              <span aria-hidden="true">${icon('dock')}</span> <span>${t('Fonts for Linux (.rpm)')}</span></button>
            <!-- Versions (plan 97 section 6a). Hidden until something has actually been
                 published, or until a link asks for the panel by name (plans/137
                 B2): the entry used to appear the moment a system EXISTED, which
                 put publishing on the face of a studio one colour old. It carries
                 data-ds-room, so the rail's existing click delegate routes it with
                 no second listener. -->
            <button type="button" class="be-btn ds-versions-toggle" id="ds-room-versions" data-ds-room="versions" hidden>
              <span class="ds-versions-toggle-ic" aria-hidden="true">${icon(ROOM_ICONS.versions)}</span>
              <span>${escape(ROOM_LABELS.versions)}</span></button>
            <!-- The way to a FIRST publish, for a furnished system that has never
                 published one: a quiet line under the export actions rather than a
                 fifth peer button, and it stands down the moment the entry above
                 latches on. Its own listener, not data-ds-room: two elements with
                 that attribute would both take aria-current, and the versionsBtn
                 lookup reads the first one in the document. -->
            <button type="button" class="ds-versions-link" data-ds-versions-link hidden>${t('Versions & publishing')}</button>
            <span class="ds-rail-note" data-start-note aria-live="polite"></span>
          </div>
        </aside>

        <div class="ds-main">
          <section class="ds-panel" id="start-panel-overview" data-ds-panel="overview"
            role="region" aria-labelledby="ds-room-overview" hidden></section>
          <section class="ds-panel" id="start-panel-versions" data-ds-panel="versions"
            role="region" aria-labelledby="ds-room-versions" hidden></section>
          <div class="start-editor-wrap">
            <div class="start-editor-mount" data-start-editor><p class="start-editor-loading">${t('Loading the design system…')}</p></div>
          </div>
        </div>
      </div>

      <!-- The import card lives here at rest, inside a hidden holder, and is MOVED
           into the modal when "Add from…" is clicked (and back on close) - so the
           file input, the drop target and every delegated listener below are wired
           once against nodes that outlive any one dialog. -->
      <div class="start-import-home" data-start-import-home hidden>
      <div class="start-import-panel" data-start-import-panel>
        <!-- The whole card is the control: click anywhere (it's the file input's
             label) or drop a file on it. The format tiles lead so people
             recognise THEIR export at a glance, in preference order. -->
        <label class="start-import-drop" data-start-import-drop>
          <input type="file" class="start-import-file visually-hidden" accept=".json,application/json,.penpot,.svg,image/svg+xml,.zip,application/zip,.lolly" aria-label="${escape(t('Choose a design or brand file'))}">
          <span class="start-import-formats" role="list" aria-label="${escape(t('Accepted formats, in preference order'))}">
            ${IMPORT_FORMATS.map(
              (f) => `
              <span class="start-import-fmt" role="listitem">
                <span class="start-import-fmt-icon" aria-hidden="true">${f.icon}</span>
                <span class="start-import-fmt-name">${escape(t(f.name))}</span>
                <span class="start-import-fmt-ext">${escape(f.ext)}</span>
              </span>`
            ).join('')}
          </span>
          <span class="be-btn start-import-btn" aria-hidden="true">${t('Choose a design or brand file…')}</span>
          <span class="start-import-drophint">${t('or drag & drop it here')}</span>
        </label>
        <!-- tabindex="-1": the result is a status message with controls in it, so
             it takes focus when it appears rather than being announced whole. -->
        <div class="start-import-result" tabindex="-1" hidden></div>
      </div>
      </div>
    </div>`;

  attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);
  wireBackPill();
  wireHomeFab();

  // Mount liveness: #view itself is the router's persistent container (it never
  // disconnects - navigation just replaces its innerHTML), so "are we still the
  // mounted view" must be asked of a node THIS mount created.
  const shell = viewEl.querySelector<HTMLElement>('.start')!;
  const importResult = viewEl.querySelector<HTMLElement>('.start-import-result')!;
  /**
   * The one result sink: what a picked or dropped file turned out to be, and the
   * controls that act on it.
   *
   * It is a STATUS MESSAGE in the WCAG 4.1.3 sense - new content that answers
   * something the person just did, in a place their focus is not. It is not a
   * live region: the card is a whole panel (stats, warnings, a question, two or
   * three buttons) and reading all of it aloud on every render is noise. So each
   * caller says its one fact through `say`, and focus moves to the card, which
   * is where the buttons are and where a screen reader then reads from.
   */
  const showImportResult = (
    html: string,
    opts: { say?: string; assertive?: boolean } = {}
  ): void => {
    importResult.innerHTML = html;
    importResult.hidden = false;
    if (opts.say) announce(opts.say, { assertive: !!opts.assertive });
    importResult.focus();
  };
  /** A refusal, in the card and out loud. `text` is PLAIN text: the card escapes
   *  it, the announcement must not (a live region is a text sink, and entities
   *  are read out as entities there). */
  const showImportError = (text: string): void => {
    showImportResult(`<p class="start-import-err">${escape(text)}</p>`, {
      say: text,
      assertive: true,
    });
  };

  // ── The studio (all five editor panels, mounted once) ────────────────────────
  const editorMount = viewEl.querySelector<HTMLElement>('[data-start-editor]')!;
  const noteEl = viewEl.querySelector<HTMLElement>('[data-start-note]');
  const overviewPanel = viewEl.querySelector<HTMLElement>('[data-ds-panel="overview"]')!;
  const versionsPanel = viewEl.querySelector<HTMLElement>('[data-ds-panel="versions"]')!;
  const versionsBtn = viewEl.querySelector<HTMLButtonElement>('[data-ds-room="versions"]');
  const versionsLink = viewEl.querySelector<HTMLButtonElement>('[data-ds-versions-link]');
  const railEl = viewEl.querySelector<HTMLElement>('.ds-rail')!;
  // The name is editable HERE, alongside the actual brand editor. Profile owns
  // switching and destructive management; it deliberately no longer carries a
  // second, disconnected rename affordance.
  void activeDesignSystemRecord(host)
    .then((rec) => {
      const line = viewEl.querySelector<HTMLElement>('[data-start-ds]');
      if (!line || !rec) return;
      const state = rec.locked ? ` <span class="start-ds-lock">${t('read-only')}</span>` : '';
      line.innerHTML = rec.locked
        ? `${t('Editing {name}', { name: escape(rec.label) })}${state} · <a href="#/profile?focus=design-systems-section">${t('Switch')}</a>`
        : `${t('Editing')} <input class="start-ds-name" data-start-ds-name value="${escape(rec.label)}" aria-label="${escape(t('Design system name'))}"> · <a href="#/profile?focus=design-systems-section">${t('Switch')}</a>`;
      line.hidden = false;
      const nameInput = line.querySelector<HTMLInputElement>('[data-start-ds-name]');
      nameInput?.addEventListener('change', async () => {
        const label = nameInput.value.trim();
        if (!label) {
          nameInput.value = rec.label;
          return;
        }
        try {
          await renameDesignSystem(
            host as unknown as Parameters<typeof renameDesignSystem>[0],
            rec.id,
            label
          );
          nameInput.value = label;
          document.title = `${label} · Lolly`;
          showNote(t('Design system name saved.'));
        } catch (err) {
          nameInput.value = rec.label;
          showNote(String((err as { message?: unknown })?.message ?? err), true);
        }
      });
      if (focusDsName)
        queueMicrotask(() => {
          nameInput?.focus();
          nameInput?.select();
        });
    })
    .catch(() => {
      /* no registry - the line stays hidden */
    });
  const roomBtns = [...viewEl.querySelectorAll<HTMLButtonElement>('[data-ds-room]')];
  /** The foot actions that only exist once there is a system worth exporting. */
  const furnishedOnly = [...viewEl.querySelectorAll<HTMLElement>('[data-start-furnished]')];
  /** The rail's "Add from…" hero. Declared up here because refreshFurnished()
   *  below reveals it; its click wiring is with the rest of the picker's. */
  const importBtn = viewEl.querySelector<HTMLButtonElement>('[data-start-import]');

  // The save discipline's substrate (plan 97 section 6): used here for the checkpoint a
  // source install takes before it lands, so "revert to before the import" is a
  // restore rather than an apology. The rooms adopt the rest in M1.
  //
  // `afterInstall` fires only on studio.install, which nothing but the Versions
  // panel calls today - so an unversioned studio never runs it. It exists because
  // activating a version changes what the CHROME resolves against
  // (applyChromeBrandVars reads active-or-latest), and a repaint nobody triggers
  // would leave the app painted in the version the page opened with.
  //
  // No `label`: a routine save is not a rename. Passing one here renamed the
  // design system on every commit, so a system the person called "Acme" went
  // back to "My brand" the next time they touched a colour (plans/186 section
  // 3.3). A first install still gets a name from the write chokepoint's default.
  const studio = createStudioState(host as unknown as Parameters<typeof createStudioState>[0], {
    afterInstall: () => applyChromeBrandVars(host),
  });
  const checkpointBeforeInstall = async (): Promise<void> => {
    // Best-effort by design: a first-ever install has no head to snapshot, and a
    // storage failure must never stop the tokens the user asked for from landing.
    try {
      await studio.load();
      await studio.checkpoint(t('Before import'));
    } catch {
      /* nothing to go back to */
    }
  };

  // ── The candidate tray (plan 97 section 8) ──────────────────────────────────────────
  // A source scans material into a census, the census becomes typed candidates,
  // and NOTHING joins the design system until someone presses Add. The model is
  // persistent and outlives the view (lib/design-system/tray.ts); its surface
  // and its two commit paths are wired further down, once the editor exists.
  //
  // Created HERE, before the editor, because there must be exactly ONE live tray
  // per mounted studio. The tray persists its whole candidate list on every
  // write, so two instances on the same key each save their own in-memory list
  // and the later write erases whatever the other one added. The Logos room
  // hands the colours a mark carries to a tray too - it gets this one.
  const tray: Tray = createTray(host as unknown as Parameters<typeof createTray>[0]);
  try {
    await tray.load();
  } catch {
    /* an unreadable tray simply starts empty */
  }

  // A hand-off is waiting (the #/pdf exploder's Send to Logos, or this view's own
  // send across the remount). Read BEFORE the editor mounts, because the Logos
  // room's paint drains the stash: after that the answer is always false. It
  // decides one thing - whether the room this mount opens on takes focus, so a
  // keyboard user who pressed a button that navigated lands somewhere.
  const marksArriving = hasPendingLogoFiles();

  let editor: BrandEditorHandle | null = null;
  let overview: OverviewRoom | null = null;
  let versions: VersionsRoom | null = null;
  try {
    editor = await mountBrandEditor(
      editorMount,
      host as unknown as Parameters<typeof mountBrandEditor>[1],
      {
        tray,
        onChange: () => {
          if (!shell.isConnected) return;
          // The first colour, face or mark furnishes the system, so the foot's
          // export actions appear on the edit that did it - before the early return
          // below, because that edit is usually made in a room with the Overview
          // panel hidden. One keyed read while unfurnished, then nothing.
          refreshFurnished();
          // Only a VISIBLE Overview re-reads - the same rule the room applies to
          // its own palette subscription (lib/design-system/rooms/overview.ts).
          // An edit lands here on every commit, and one refresh walks the whole
          // system: the tokens doc, its colours, four font-family reads, and a
          // logo listing that mints and revokes an object URL per slot. A hidden
          // panel is caught by the refresh selectRoom() runs on entry.
          if (overviewPanel.hidden) return;
          overview?.refresh();
        },
        // The durable half of the room's undo (plan 97 section 6): the editor's own stack
        // is session-only, so a destructive action also asks the host for a named
        // checkpoint. Same shape as checkpointBeforeInstall, with the label the
        // room supplies. Best-effort - a first-ever edit has no head to snapshot.
        checkpoint: async (label) => {
          try {
            await studio.load();
            await studio.checkpoint(label);
          } catch {
            /* nothing to go back to */
          }
        },
        // Beat 0's "or bring a file" - the same picker the rail's "Add from…"
        // opens, on its source list (plan 182 section 3a).
        openImport: () => {
          openImport();
          playSfx('click');
        },
        // "From an image" beside the add row. THIS view owns the image pipeline
        // (the source picker's image tile runs the same call), so the room asks
        // for it rather than carrying a second copy - plan 182 section 5.3.
        scanImage: (file) => {
          void scanImageFile(file, showNote);
        },
      }
    );
  } catch (err) {
    editorMount.innerHTML = `<p class="be-err">${t('Couldn’t open the brand editor: {error}', { error: String((err as { message?: unknown })?.message ?? err) })}</p>`;
  }
  const editorRoot = editorMount.querySelector<HTMLElement>('[data-brand-editor]');
  // Name each editor panel after the rail item that opens it (the editor renders
  // the panels; only this view knows what navigates to them).
  editorRoot?.querySelectorAll<HTMLElement>('[data-be-tab-panel]').forEach((panel) => {
    const key = panel.dataset.beTabPanel!;
    panel.id = `start-panel-${key}`;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', `ds-room-${key}`);
  });
  // ── Mobile palette sheet (≤640px) - mounted only while the Colours room shows,
  // and only when the editor actually mounted (a locked build renders no studio;
  // a failed mount leaves editor null / editorRoot missing - nothing to mirror).
  // Torn down on every room change away and on view unmount.
  let paletteSheet: PaletteSheet | null = null;
  let trayUi: TrayUi | null = null;
  const syncPaletteSheet = (): void => {
    // Single owner of the phone's bottom edge: the tray and the palette sheet are
    // both fixed sheets there, and two of them stacked is one of them unreachable.
    // The tray is the transient one, so it wins while it is open and the palette
    // mirror comes back the moment it closes (onOpenChange calls this).
    //
    // Beat 0 has nothing to mirror (plan 182 section 3a): the room holds no
    // colour of its own, so a sheet there would peek an empty strip and eat the
    // bottom of the one screen the first pick has to fit in. The editor answers
    // the beat, and every commit re-asks through onPalette below.
    const want =
      activeArea === 'color' &&
      editor !== null &&
      !!editorRoot &&
      (editor.colourBeat?.() ?? 2) > 0 &&
      !(trayUi?.isOpen() ?? false);
    if (want && !paletteSheet) paletteSheet = mountPaletteSheet(shell, editor!, editorRoot!);
    else if (!want && paletteSheet) {
      paletteSheet.teardown();
      paletteSheet = null;
    }
  };

  // ── Rooms ────────────────────────────────────────────────────────────────────
  // A rail item is navigation, not a tab in a tablist: it carries aria-current,
  // and the panel it opens is a region named after it. `overview` on the editor's
  // data-active-tab matches none of its five panels, which is how the editor
  // hides itself while the Overview room shows.
  // Is there a system worth EXPORTING here? The Overview room's own answer
  // (readOverview → `worthExporting`), reused rather than re-derived, so the
  // foot's export actions can never contradict the room (plans/137 B1). The bar
  // used to be the room's `furnished` - which the first colour makes true, so
  // one gesture in the rail grew Export, Tokens and Versions (plans/163 F4).
  // Latched on: nothing in a session takes a design system away again.
  //
  // Cheap where it matters most. readOverview returns its empty model straight
  // after the tokens-asset lookup, so an EMPTY studio pays one keyed read per
  // call; a furnished one pays the full read on each room change and commit
  // until this answers true, after which nothing here reads again. That window
  // is a handful of user-paced gestures wide, which is what it buys: the rail
  // grows its power actions when the system does, not on the first colour.
  let worthExporting = false;
  // Whether the foot's Versions entry is offered at all. Two ways in: something
  // has actually been published (the version index, read once below), or the panel was
  // asked for by name - a `?area=versions` link must never land on a control that
  // is not there. A system that merely EXISTS is deliberately not enough: that
  // rule put publishing on the face of a studio one colour old (plans/137 B2).
  //
  // Once shown it STAYS shown for the session. Hiding it again the moment the
  // user opens another room made the deep link one-way: the panel's own empty
  // state invites you to go and add colours first, `selectRoom` replaceStates the
  // URL so Back cannot recover it either, and the way home was to retype the
  // link. A latch is cheaper than a second door, and it cannot make the entry
  // appear for somebody who never asked for it.
  let versionsOffered = false;
  const syncVersionsEntry = (): void => {
    if (activeArea === 'versions') versionsOffered = true;
    if (versionsBtn) versionsBtn.hidden = !versionsOffered;
    // The first publish has to stay one press away, so a system worth exporting
    // that has never published gets the quiet entry instead of the rail one - and
    // drops it again as soon as the rail entry latches on.
    if (versionsLink) versionsLink.hidden = versionsOffered || !worthExporting;
  };
  /** Re-read the room's signals and reveal what each of the two latches owes.
   *  Called from the two paths the studio already refreshes on - every room
   *  change and every committed edit - so a studio that grows mid-session
   *  reveals them without a reload, whichever room the edit was made in. */
  const refreshFurnished = (): void => {
    if (worthExporting) return; // the harder latch is set, so both are
    void readOverview(host as unknown as Parameters<typeof readOverview>[0])
      .then((model) => {
        if (!shell.isConnected) return;
        // The hero only duplicates a door while the doors are up (plans/163 F2).
        if (model.furnished && importBtn) importBtn.hidden = false;
        if (!model.worthExporting) return;
        worthExporting = true;
        for (const el of furnishedOnly) el.hidden = false;
        syncVersionsEntry();
      })
      .catch(() => {
        /* undiscoverable storage - the actions stay out of the way */
      });
  };
  /** Mount-on-first-open, then refresh. Reassigned once the panel's context
   *  exists further down; until then opening the area is simply a no-op panel,
   *  which is what the very first selectRoom() call needs. The laziness is the
   *  point: reading the ledger, hashing the pinned assets and totting up storage
   *  are the panel's costs, and a studio that never opens it must never pay them. */
  let openVersions: () => void = () => {
    /* wired below */
  };

  const selectRoom = (area: StartArea, opts: { focus?: boolean; sfx?: boolean } = {}): void => {
    activeArea = area;
    editor?.closeOverlays(); // a popover anchored in the outgoing room must not linger
    refreshFurnished(); // the install path runs through here too (selectRoom('color'))
    syncVersionsEntry(); // before the focus loop: a hidden button cannot take it
    for (const btn of roomBtns) {
      const on = btn.dataset.dsRoom === area;
      if (on) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
      if (on && opts.focus) btn.focus();
    }
    overviewPanel.hidden = area !== 'overview';
    versionsPanel.hidden = area !== 'versions';
    editorRoot?.setAttribute('data-active-tab', area);
    if (area === 'overview') overview?.refresh();
    if (area === 'versions') openVersions();
    syncPaletteSheet();
    // Keep the URL shareable without spamming history.
    // `area` is deliberately the ONLY param that survives: `focus`, `wheel`, `import`,
    // `source` and `seed` are one-shot flags, consumed on mount and never propagated
    // into a generated link (the contract in lib/design-system/start-route.ts). So a
    // room click dropping them is the design, not a regression - the URL you copy
    // afterwards says which room you are in, not which wing you once opened.
    try {
      history.replaceState(null, '', `#/start?area=${area}`);
    } catch {
      /* sandboxed */
    }
    if (opts.sfx) playSfx('click');
  };

  railEl.addEventListener('click', (e) => {
    const area =
      (e.target as HTMLElement).closest<HTMLElement>('[data-ds-room]')?.dataset.dsRoom ?? '';
    if (isStartArea(area)) selectRoom(area, { sfx: true });
  });
  // The quiet first-publish entry opens the same panel. Focus goes with it: the
  // press hides the control that was made (syncVersionsEntry latches the rail
  // entry on), so a keyboard user needs somewhere to land.
  versionsLink?.addEventListener('click', () => selectRoom('versions', { focus: true, sfx: true }));

  // The room is selected BEFORE the Overview room mounts, so the panel's hidden
  // state is already true/false when the room takes its first reading (and the
  // arrival doesn't read the design system twice).
  //
  // Marks arriving from a hand-off take the focus with them. The send navigates
  // (or remounts), which destroys the control that was pressed along with the
  // dialog that restored focus to it, so without this a keyboard user is
  // returned to the top of the document. The rail item is the landing: it is a
  // real control, it names the room the marks arrive in, and the queue is the
  // next stop from there.
  selectRoom(activeArea, { focus: marksArriving });
  overview = mountOverviewRoom(overviewPanel, {
    host: host as unknown as Parameters<typeof mountOverviewRoom>[1]['host'],
    editor: () => editor,
    goto: (area, focus) => {
      if (!isStartArea(area)) return;
      selectRoom(area, { focus: true, sfx: true });
      // A door names the room AND the control it wants open there - the same
      // pair `?focus=` carries, routed through the same openers, so the door and
      // the link can never land in different places.
      if (focus) openFocus(area, focus);
    },
    // The Overview's "Start from a file" door means exactly that, so it skips the
    // source list and opens on the file stage. OverviewCtx.openImport stays a
    // bare `() => void` - the room never learns the picker has stages.
    // Same picker, same first stage as the rail's "Add from…" (Andy, 2026-09-04: two
    // buttons, two different modals - unify). The door used to skip to the file stage.
    openImport: () => {
      openImport();
      playSfx('click');
    },
  });

  // Deep-link: `#/start?area=color&wheel` opens the OKLCH Colour chart on mount -
  // the same folded card the Colours room reveals on click. Reuses the editor's
  // own opener (it repaints the wheel via its toggle handler). A no-op when the
  // editor didn't mount (failed/locked) or the chart card is absent (openColorChart
  // returns false), so a locked/degraded studio deep-links gracefully. The flag
  // is consumed here - selectRoom's replaceState above already dropped it from the URL.
  if (activeArea === 'color' && wantWheel) editor?.openColorChart();

  /**
   * Open what a `?focus=` (or an Overview door) asked for, in the room it
   * belongs to. One table for both, so a door and a link can never disagree.
   *
   * Every opener is optional on the handle and answers false when its room did
   * not render, which is how a locked or degraded studio degrades: the room
   * opens, the control does not, nothing throws. None of them writes - `pick`
   * and `stage` put a decision in front of the person and wait for it.
   */
  function openFocus(area: StartArea, focus: string): void {
    if (area === 'type') {
      if (focus === 'stage') editor?.openTypeStage?.('brand');
      return;
    }
    if (area !== 'color') return;
    if (focus === 'pick') {
      editor?.openPickCard?.();
      return;
    }
    if (focus === 'chart') {
      editor?.openColorChart();
      return;
    }
    if (focus === 'generate' || focus === 'curves' || focus === 'contrast' || focus === 'print') {
      editor?.openWing?.(focus);
    }
  }

  // Deep-link: `#/start?area=color&focus=<wing>` opens that wing of the Colours
  // room (`chart` is the colour chart, the same target as `?wheel`). Same
  // consume-on-mount, no-op-when-degraded contract as the wheel flag.
  // `?seed=<hex>` primes the Generate wing's primary FIRST, so the wing opens
  // already showing ramps built from the carried colour (audit 167 F-A12 - the
  // added-chip's "Generate your palette from this colour" finally means it).
  if (route.focus) {
    if (activeArea === 'color' && route.seed) editor?.setGeneratePrimary?.(route.seed);
    openFocus(activeArea, route.focus);
  }

  // Deep-link: `#/start?area=color&group=<name>` reveals one INHERITED colour
  // group in the pane, folded and tagged Starter (plan 182 section 12) - minted
  // by the Tokens room's "Open" beside the starter neutrals, and the one thing
  // that ever draws a starter tile. Same consume-on-mount, no-op-when-degraded
  // contract as the wing flags above.
  if (activeArea === 'color' && route.group) editor?.openStarterGroup?.(route.group);

  // ── Export (always on) ───────────────────────────────────────────────────────
  const showNote = (msg: string, isError = false): void => {
    if (!noteEl) return;
    noteEl.textContent = msg;
    noteEl.classList.toggle('is-error', isError);
    if (msg) {
      setTimeout(() => {
        if (!noteEl.isConnected || noteEl.textContent !== msg) return;
        noteEl.textContent = '';
      }, 4000);
    }
  };
  viewEl
    .querySelector<HTMLButtonElement>('[data-start-export]')
    ?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      if (!editor) {
        showNote(t('The brand editor didn’t open - reload to export.'), true);
        return;
      }
      btn.disabled = true;
      try {
        const { filename } = await editor.exportPack();
        showNote(tRaw('Exported {filename}', { filename }));
      } catch (err) {
        showNote(String((err as { message?: unknown })?.message ?? err), true);
      }
      btn.disabled = false;
    });

  // The tray's surface (lib/design-system/tray-ui.ts) and its two commit paths.
  // The model itself was created above the editor mount - see the note there.
  const isRec = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

  // The head document, kept in step with what is installed - the source of the
  // plain-tokens export below, which re-reads it at the press either way.
  //
  // NOTHING WRITES THROUGH THIS. A view-held snapshot of the installed document
  // is only ever safe to READ from: the Colours room edits its own live copy and
  // installs it, so writing into a snapshot and installing that reverts every
  // edit made since it was taken. Adds go through `editor.addColors`.
  let headDoc: Record<string, unknown> | null = null;
  const refreshHead = async (): Promise<void> => {
    try {
      await studio.load();
      const doc = studio.doc();
      headDoc = isRec(doc) ? doc : null;
    } catch {
      headDoc = null;
    }
  };
  await refreshHead();

  // The plain document, beside the pack. The pack zip carries fonts, logos and a
  // theme preference and verifies its own integrity map (brand-transfer.ts); this
  // is what a repo, a CI step or another tokens tool actually reads, and it is
  // the head document verbatim - the same precedence host.tokens.raw() applies.
  viewEl
    .querySelector<HTMLButtonElement>('[data-start-export-tokens]')
    ?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      try {
        await refreshHead();
        if (!headDoc) showNote(t('There are no tokens to export yet.'), true);
        else {
          await saveBlob(
            new Blob([JSON.stringify(headDoc, null, 2)], { type: 'application/json' }),
            'tokens.json'
          );
          showNote(tRaw('Exported {filename}', { filename: 'tokens.json' }));
          playSfx('whoosh');
        }
      } catch (err) {
        showNote(String((err as { message?: unknown })?.message ?? err), true);
      }
      btn.disabled = false;
    });

  // "Fonts for Linux (.rpm)": seal the brand's fonts into an installable system
  // package (plan 197 M5). Shell-side, because enumerating the brand's fonts uses a
  // host.assets internal a sandboxed tool hook can't reach. Google-fetched and
  // SUSE/platform faces are redistributable (packed silently); a self-uploaded face
  // needs a confirm - a NON-blocking two-click one (a browser confirm() dialog would
  // jam the page). The package bytes come from host.export.pack (the engine's RPM
  // writer); like every export.file path it carries no watermark.
  const fontExt = (b: Uint8Array): string => {
    const sig = String.fromCharCode(b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 0);
    if (sig === 'wOF2') return 'woff2';
    if (sig === 'wOFF') return 'woff';
    if (sig === 'OTTO') return 'otf';
    return 'ttf';
  };
  let getOnDeviceArmed = false;
  viewEl
    .querySelector<HTMLButtonElement>('[data-start-get-on-device]')
    ?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      try {
        // StartHost narrows the host; the runtime host is the full bridge, so reach
        // export.pack through a typed cast (added in engine 1.178, feature-detected).
        const exp = (host as unknown as { export?: { pack?: (s: unknown) => Promise<Uint8Array> } })
          .export;
        if (typeof exp?.pack !== 'function') {
          showNote(t('This build can’t create packages yet.'), true);
          btn.disabled = false;
          return;
        }
        const assetsApi = host.assets as unknown as {
          _exportUserAssets?: () => Promise<
            Array<{ id?: string; type?: string; blob?: Blob; meta?: Record<string, unknown> }>
          >;
        };
        const records = (await assetsApi._exportUserAssets?.()) ?? [];
        const faces = records.filter(
          (r) =>
            r?.type === 'font' &&
            typeof r?.id === 'string' &&
            r.id.startsWith('user/fonts/') &&
            r.blob
        );
        if (faces.length === 0) {
          showNote(t('No fonts to package yet - add fonts in the Type room first.'), true);
          getOnDeviceArmed = false;
          btn.disabled = false;
          return;
        }
        const hasUpload = faces.some((r) => r.meta?.source === 'upload');
        if (hasUpload && !getOnDeviceArmed) {
          getOnDeviceArmed = true;
          showNote(
            t(
              'Some of these fonts you uploaded - click again to confirm you may redistribute them.'
            ),
            true
          );
          btn.disabled = false;
          return;
        }
        getOnDeviceArmed = false;
        const fonts: { name: string; data: Uint8Array }[] = [];
        const seen = new Set<string>();
        for (const r of faces) {
          const bytes = new Uint8Array(await (r.blob as Blob).arrayBuffer());
          const fam = String(r.meta?.family ?? 'Font').replace(/[^A-Za-z0-9]+/g, '') || 'Font';
          const wt = String(r.meta?.weight ?? '400').replace(/[^A-Za-z0-9]+/g, '');
          const ital = r.meta?.style === 'italic' ? 'Italic' : '';
          const ext = fontExt(bytes);
          let name = `${fam}-${wt}${ital}.${ext}`;
          for (let i = 1; seen.has(name); i++) name = `${fam}-${wt}${ital}-${i}.${ext}`;
          seen.add(name);
          fonts.push({ name, data: bytes });
        }
        const allRedistributable = faces.every((r) => r.meta?.source === 'google-fonts');
        const spec = {
          target: 'rpm' as const,
          type: 'font' as const,
          meta: {
            name: 'brand-fonts',
            version: '1.0',
            release: '1',
            summary: 'Brand fonts packaged by Lolly',
            description: 'Fonts from your Lolly brand, installed system-wide.',
            license: allRedistributable ? 'OFL-1.1' : 'LicenseRef-lolly-user-supplied',
            vendor: 'Lolly',
            url: 'https://lolly.tools',
          },
          foundry: 'brand',
          fonts,
        };
        const bytes = await exp.pack(spec);
        await saveBlob(
          new Blob([bytes as BlobPart], { type: 'application/x-rpm' }),
          `${spec.meta.name}-${spec.meta.version}-${spec.meta.release}.noarch.rpm`
        );
        showNote(tRaw('Exported {filename}', { filename: `${spec.meta.name}.rpm` }));
        playSfx('whoosh');
      } catch (err) {
        showNote(String((err as { message?: unknown })?.message ?? err), true);
      }
      btn.disabled = false;
    });

  // ── Versions (plan 97 section 6a, M7) ───────────────────────────────────────────────
  // The panel writes the head through THIS studio, so publish, activate and
  // restore land on the same undo stack as every other edit and repaint chrome
  // through the same afterInstall. Version payloads never come through here -
  // they go to installUserTokens with an explicit slug, which is where
  // immutability is enforced (lib/design-system/versions-io.ts).
  const versionsCtx = {
    host: host as unknown as Parameters<typeof mountVersionsRoom>[1]['host'],
    // load() first, every time. The rooms install through their own path, so the
    // studio's in-memory head goes stale the moment a colour is edited - and the
    // undo entry is a snapshot of THAT. Without the re-read, undoing a publish
    // would step back to the document this view mounted with and quietly drop
    // every edit made since.
    install: async (doc: unknown, action: string) => {
      await studio.load();
      await studio.install(doc, action);
    },
    // No `label`: every head write here goes through `install` above, and a
    // hard-coded name on the fallback path would rename whatever the user calls
    // their design system on the next publish or activate. The chokepoint keeps
    // the existing name when a write does not supply one (bridge/tokens.ts).
    undo: () => studio.undo(),
    notify: showNote,
  };
  // The panel is built the first time it is opened, and it reads on mount - so
  // this is both the lazy mount and the re-entry refresh.
  openVersions = (): void => {
    if (versions) versions.refresh();
    else versions = mountVersionsRoom(versionsPanel, versionsCtx);
  };
  if (activeArea === 'versions') openVersions(); // arrived by deep link
  // Whether to OFFER the rail entry, resolved once: has anything been PUBLISHED?
  // The version index the head document carries, not "does a design system
  // exist" - the second answer is true one colour into a blank brand, which is how
  // the entry ended up on the first-run face (plans/137 B2). Until the first publish, the
  // quiet "Versions & publishing" line under the export actions is the way in.
  // The head is already memoised by the tokens bridge, so this reads no more than
  // hasPublishableSystem did, and never on a render or an export path.
  void readIndex(versionsCtx)
    .then((index) => {
      if (!shell.isConnected) return;
      // ||=, not =: a `?area=versions` arrival has already latched the entry on,
      // and a late "nothing published yet" must not take it away underneath.
      versionsOffered ||= index.versions.length > 0;
      syncVersionsEntry();
    })
    .catch(() => {
      /* undiscoverable storage - the entry stays hidden */
    });

  /**
   * One token per colour, through the Colours room's own write (plan 97 section 2b).
   *
   * The room's `addColors` writes into the LIVE document the editor is holding
   * - the only correct target. This view once kept its own `headDoc` snapshot
   * and wrote into that when the room had no add path: a snapshot taken at mount
   * and refreshed only by this view's own installs, so a tray Add made after any
   * edit in the room reinstalled the pre-edit document and reverted it. There is
   * one document; the room owns it, and there is no second way in.
   *
   * The tray is mounted only when the editor mounted (see below), so the absent
   * case is a degraded studio rather than a state a person can press their way
   * into - it still says so instead of going quiet, because a press that reports
   * nothing added reads exactly like a dead button.
   */
  const addColorsToSystem = (entries: ColorEntry[]): number => {
    const own = editor?.addColors;
    if (!own) {
      showNote(t('The brand editor didn’t open - reload the page and try again.'), true);
      return 0;
    }
    return own(entries);
  };

  let unsubTray: (() => void) | null = null;
  /** Unsubscribe from the palette seam that re-asks the Colours beat (plan 182
   *  section 3a) - the mirror only exists past beat 0. */
  let unsubBeat: (() => void) | null = null;
  const trayToggle = viewEl.querySelector<HTMLButtonElement>('[data-start-tray]');
  const trayCountEl = viewEl.querySelector<HTMLElement>('[data-start-tray-n]');
  const syncTrayToggle = (): void => {
    if (!trayToggle) return;
    const n = trayUi?.count() ?? 0;
    trayToggle.hidden = n === 0; // an empty concept is never advertised
    trayToggle.setAttribute('aria-expanded', String(trayUi?.isOpen() ?? false));
    if (trayCountEl) trayCountEl.textContent = n ? String(n) : '';
  };

  // A locked build never reaches here (the route returned above) and a failed
  // editor mount has nothing to repaint an add into, so the tray is mounted only
  // where its Adds can actually land.
  if (editor) {
    trayUi = mountTrayUi(shell, {
      tray,
      // The disclosure pair: the panel is a fixed dock appended after the whole
      // studio, so `aria-controls` and the focus hand-back are the only things
      // tying it to the control that opens it.
      toggle: trayToggle ?? undefined,
      addColors: addColorsToSystem,
      // Only families we hold a fetchable source for get an Add at all (the tray
      // checks that itself); this is what happens when one is pressed. The face
      // becomes the primary only when nothing else claims that role yet.
      installFont: async (family) => {
        await installGoogleFont(host as unknown as UserFontsHost, family);
        bustFontRegistry();
        await editor?.reload();
      },
      onOpenChange: (open) => {
        syncPaletteSheet();
        syncTrayToggle();
        // A tray that closes by EMPTYING also hides the toggle it would hand
        // focus back to, so there is nothing left in the panel's own story to
        // return to. Rather than leave a keyboard user at the top of the
        // document, put them on the rail action that starts the next scan - and
        // only when focus was actually dropped, so this can never be a steal.
        // Queried here, not captured: this fires long after mount either way.
        if (!open && trayToggle?.hidden && document.activeElement === document.body) {
          // The hero is itself hidden on an empty studio (plans/163 F2), and
          // focus() on a hidden element does nothing - so fall back to the rail.
          const back =
            importBtn?.hidden === false
              ? importBtn
              : railEl.querySelector<HTMLElement>('[data-ds-room]');
          back?.focus();
        }
      },
    });
    unsubTray = tray.subscribe(syncTrayToggle);
    syncTrayToggle();
    trayToggle?.addEventListener('click', () => {
      trayUi?.toggle();
      syncTrayToggle();
      playSfx('click');
    });
    // The Colours room's beat moves on a commit, and the palette mirror only
    // exists past beat 0 - so the first colour is what mounts the sheet, and an
    // undo back to nothing is what takes it away. Same seam the mirror itself
    // re-renders off; it tolerates double-fires, and so does this.
    unsubBeat = editor.onPalette(syncPaletteSheet);
  }

  /** A finished census into the tray, opened on what it found. Every source ends
   *  here - there is no second path that skips the tray. */
  const keepInTray = async (
    census: DesignCensus,
    note?: (msg: string, isError?: boolean) => void
  ): Promise<number> => {
    // One sink per message: `note` writes into an aria-live region of its own, so
    // announce() on top of it says everything twice. It is the fallback for a
    // call that passed no note, never a second voice for one that did.
    const say = (msg: string, isError = false): void => {
      if (note) note(msg, isError);
      else announce(msg, { assertive: isError });
    };
    const candidates = candidatesFromCensus(census);
    if (!candidates.length) {
      say(tRaw('Nothing to keep from {source}.', { source: census.source.label }), true);
      return 0;
    }
    let n = 0;
    try {
      n = await tray.add(candidates);
    } catch (err) {
      say(String((err as { message?: unknown })?.message ?? err), true);
      return 0;
    }
    // No `focus`: a scan can land while the source dialog is still open, and the
    // tray sits outside it. The panel refuses to open on an empty list itself.
    trayUi?.open(); // fires onOpenChange → the rail toggle and the sheet resync
    syncTrayToggle(); // …and again for the count, which the open didn't change
    // A rescan of the same source adds nothing, because the tray dedupes on
    // type+value - say so rather than reporting "0 kept". Which "already" it is
    // matters: a candidate still pending is IN the tray, one already added is in
    // the design system and will never come back to the tray, and telling
    // someone to look in a tray that is empty (and whose toggle is hidden) is
    // the more confusing of the two by a distance.
    const stillPending = new Set(
      tray
        .list()
        .filter((c) => c.state === 'pending')
        .map((c) => c.id)
    );
    const msg =
      n === 0
        ? candidates.some((c) => stillPending.has(c.id))
          ? t('Already in the tray.')
          : t('Already added to the design system.')
        : n === 1
          ? t('1 kept in the tray')
          : tRaw('{n} kept in the tray', { n });
    say(msg);
    return n;
  };

  /** A screenshot or a photo as colour candidates. The decoder is imported on
   *  demand - it drags in the bitmap/codec chunk, which has no business in the
   *  studio's entry chunk (the Colour Lab does the same, for the same reason). */
  const scanImageFile = async (
    file: File,
    note?: (msg: string, isError?: boolean) => void
  ): Promise<void> => {
    if (file.size > IMAGE_MAX_BYTES) {
      note?.(
        tRaw('{filename} is too large (max {n} MB).', {
          filename: file.name,
          n: Math.round(IMAGE_MAX_BYTES / (1024 * 1024)),
        }),
        true
      );
      return;
    }
    // The decode is the only step that can fail because of the FILE, so it is the
    // only step inside this catch - a storage failure keeping candidates must not
    // report back as "that image could not be read".
    let census: DesignCensus;
    try {
      const { sampleImageFile } = await import('../lib/image-sample.ts');
      const img = await sampleImageFile(file);
      const cloud = imageColorCloud(img.data, img.width, img.height, {
        space: img.space,
        maxPoints: 256,
      });
      census = condenseColors(censusFromImageCloud(cloud, file.name));
    } catch {
      note?.(tRaw('{filename} could not be read as an image.', { filename: file.name }), true);
      return;
    }
    await keepInTray(census, note);
  };

  // ── The PDF source (plan 97 section 8 gap 2, M5) ────────────────────────────────────
  // A guidelines PDF is the richest single file most teams have: its artwork
  // carries the marks AND the palette they are drawn in, and it embeds the real
  // font programs. All of the reading is lib/design-system/sources/pdf.ts's
  // (views/pdf-import.ts's PdfHandle underneath, imported on demand so nobody
  // pays for pdf-lib until a PDF actually arrives); this owns the copy, the
  // result card and the presses. Every byte is read here, on this device.
  //
  // The three findings travel three different ways, deliberately:
  //   colours + families → the tray, like every other source. Nothing installs.
  //   marks              → the Logos room, and only once the button is pressed:
  //                        a stash armed by a scan nobody acted on would queue
  //                        chips into a later visit that were never asked for.
  //   embedded faces     → an install, one press per face, with the caveats the
  //                        document itself states shown BEFORE the press.
  let pdfPicks: PdfLogoPick[] = [];
  let pdfFonts: PdfFontRow[] = [];
  /** The scanned file's stem, so a mark sent to Logos arrives named after the
   *  document it came out of rather than as "logo.svg". */
  let pdfStem = '';

  /** What kind of font file these bytes are, through the same magic-number read
   *  the install itself performs. Only the first four bytes are copied: a
   *  Uint8Array's own `.buffer` is the whole allocation behind it, which for a
   *  face lifted out of a PDF can be the document. */
  const formatOf = (bytes: Uint8Array): ReturnType<typeof detectFontFormat> =>
    detectFontFormat(bytes.slice(0, 4).buffer as ArrayBuffer);

  const pdfResultEl = (): HTMLElement | null =>
    importModal?.el.querySelector<HTMLElement>('[data-ds-pdf-result]') ?? null;

  /**
   * One PDF, scanned into design-system material.
   *
   * The scanner returns a refusal rather than throwing, so every failure here is
   * a sentence rather than a lost drop. Colours and families go straight to the
   * tray (which says how many it kept, through the same note line the progress
   * used); the marks and the faces need a decision, so they are painted into the
   * stage's result card and wait there.
   */
  const scanPdfFile = async (
    file: File,
    note?: (msg: string, isError?: boolean) => void
  ): Promise<void> => {
    pdfPicks = [];
    pdfFonts = [];
    pdfStem = file.name.replace(/\.[^./\\]+$/, '') || file.name;
    const before = pdfResultEl();
    if (before) {
      before.hidden = true;
      before.textContent = '';
    }
    // Escape CANCELS, and a cancel keeps nothing. The read cannot be called back
    // once the chunk is running, so the cancel is enforced at the one place it
    // matters: the commit. Identity, not truthiness - a scan started from the
    // drag-anywhere path can legitimately run with no dialog at all.
    const startedIn = importModal;
    const cancelled = (): boolean => !!startedIn && importModal !== startedIn;

    note?.(tRaw('Reading {filename} on this device…', { filename: file.name }));
    // The only step that can throw is loading the chunk itself - the scan reports
    // every failure of its own as a value, so that a bad drop is a sentence.
    let source: typeof import('../lib/design-system/sources/pdf.ts');
    try {
      source = await import('../lib/design-system/sources/pdf.ts');
    } catch {
      note?.(t('The PDF reader could not be loaded. Reload the page and try again.'), true);
      return;
    }
    const result = await source.scanPdfForDesignSystem(
      host as unknown as Parameters<typeof source.scanPdfForDesignSystem>[0],
      file,
      {
        onProgress: (phase) => {
          // A cancelled scan stops talking. `note` falls back to the rail when
          // the dialog is gone, so without this the progress of a read nobody
          // is waiting for keeps posting itself onto the page behind it.
          if (cancelled()) return;
          if (phase === 'vectors') note?.(t('Looking for marks and colours…'));
          else if (phase === 'fonts') note?.(t('Reading the fonts…'));
        },
      }
    );

    // The dialog went away while the reader ran: the person cancelled, so the
    // findings are dropped whole. Nothing is kept, nothing is said - a rail note
    // reporting colours somebody just cancelled out of is the confusing half of
    // a half-cancel, and the marks and faces were being discarded anyway.
    if (cancelled()) return;

    if (result.kind === 'refused') {
      note?.(
        result.reason === 'too-large'
          ? tRaw('{filename} is too large (max {n} MB).', {
              filename: file.name,
              n: Math.round((result.limit ?? 0) / (1024 * 1024)),
            })
          : tRaw('{filename} could not be read as a PDF.', { filename: file.name }),
        true
      );
      return;
    }

    // The tray first: it is the one place a source's findings wait, and its own
    // count is the answer to "what did that do", so it replaces the progress line.
    await keepInTray(result.census, note);

    pdfPicks = result.logoPicks;
    pdfFonts = result.fontCandidates.slice(0, MAX_PDF_FONT_ROWS).map(
      (c: PdfFontCandidate): PdfFontRow => ({
        family: c.family,
        raw: c.raw,
        chips: c.chips,
        bytes: c.bytes,
        subset: c.chips.includes('SUBSET'),
        format: formatOf(c.bytes),
      })
    );
    renderPdfResult({
      filename: file.name,
      marks: pdfPicks.length,
      hiddenFonts: Math.max(0, result.fontCandidates.length - pdfFonts.length),
      pageWindow: result.pageWindow,
      pages: result.pageCount,
      warnings: result.warnings,
    });
  };

  /**
   * The PDF stage's result card: what the scan found, and the two things that can
   * be done with it without leaving the dialog.
   *
   * A warning is printed for each half that did not run. "No fonts" and "the font
   * table could not be read" are different facts, and a card that shows the first
   * when the second happened is lying by omission.
   *
   * The card is a status message with controls in it, so it does BOTH things
   * showImportResult does for the sibling card: its one-sentence summary is
   * spoken, then focus moves into it. Focus alone is not an announcement - a
   * `tabindex="-1"` div has no role and no name, so a reader that lands on it
   * says nothing at all, and the marks, the faces and the warnings would go
   * unheard behind the tray's own count.
   */
  function renderPdfResult(o: {
    filename: string;
    marks: number;
    hiddenFonts: number;
    pageWindow: number;
    pages: number;
    warnings: readonly string[];
  }): void {
    const el = pdfResultEl();
    if (!el) return; // the dialog closed while the scan ran - the tray still has it
    const warnings: string[] = [];
    if (o.warnings.some((w) => w.startsWith('vectors'))) {
      warnings.push(
        t('The artwork in this document could not be read, so no colours or marks came from it.')
      );
    }
    if (o.warnings.some((w) => w.startsWith('fonts'))) {
      warnings.push(t('The fonts in this document could not be read.'));
    }
    const fontRows = pdfFonts
      .map(
        (row, i) => `
      <li class="ds-pdf-font">
        <span class="ds-pdf-font-name">${escape(row.family)}</span>
        <span class="ds-pdf-font-chips">${row.chips
          .map(
            (chip) => `
          <span class="ds-pdf-chip${chip === 'SUBSET' || chip === 'restricted' ? ' ds-pdf-chip--warn' : ''}">${escape(faceChipText(chip))}</span>`
          )
          .join('')}
        </span>
        ${
          row.format === 'unknown'
            ? `<span class="ds-pdf-font-note">${t('These are raw font-program bytes, not a file that can be installed.')}</span>`
            : `<button type="button" class="be-btn be-btn--sm ds-pdf-add" data-ds-pdf-font="${i}">${t('Add to the design system')}</button>`
        }
      </li>`
      )
      .join('');

    el.innerHTML = `
      <p class="start-import-name">${escape(o.filename)}<span class="start-import-source">${t('PDF')}</span></p>
      ${
        o.pages > o.pageWindow
          ? `<p class="start-import-stats">${t('Marks and colours were taken from the first {n} pages of {total}.', { n: o.pageWindow, total: o.pages })}</p>`
          : ''
      }
      ${warnings.map((w) => `<p class="start-import-warn">${escape(w)}</p>`).join('')}
      ${
        o.marks
          ? `
        <div class="start-color-actions">
          <button type="button" class="be-btn be-btn--sm ds-pdf-logos" data-ds-pdf-logos>${t(
            o.marks === 1 ? 'Review {n} mark in Logos' : 'Review {n} marks in Logos',
            { n: o.marks }
          )}</button>
        </div>`
          : ''
      }
      ${
        fontRows
          ? `
        <p class="ds-src-stage-note">${t('Fonts in this document')}</p>
        <ul class="ds-pdf-fonts" role="list">${fontRows}</ul>`
          : ''
      }
      ${
        pdfFonts.some((r) => r.subset)
          ? `<p class="start-import-warn">${t('A subset carries only the characters this document printed, so it will be missing others.')}</p>`
          : ''
      }
      ${
        o.hiddenFonts
          ? `<p class="start-import-stats">${t(
              o.hiddenFonts === 1
                ? '{n} more font is embedded in this document.'
                : '{n} more fonts are embedded in this document.',
              { n: o.hiddenFonts }
            )}</p>`
          : ''
      }
      ${
        !o.marks && !fontRows && !warnings.length
          ? `<p class="start-import-stats">${t('No marks and no embedded fonts were found in the pages that were read.')}</p>`
          : ''
      }
      <p class="ds-src-stage-note">${t('Images, text and attachments are in Unpack, which asks for the file again.')}</p>
      <a class="be-btn be-btn--sm ds-pdf-more" href="#/unpack">${t('Open Unpack')}</a>`;
    el.hidden = false;
    // What the card SAYS, in one line: the two counts it offers a decision on,
    // plus any half of the scan that did not run. Deliberately not the whole
    // card read aloud (the caveats, the hidden-font tally and the way out are
    // all there to be read at leisure) and deliberately not the tray count,
    // which keepInTray already said through the dialog's own note line.
    const said: string[] = [...warnings];
    if (o.marks)
      said.push(o.marks === 1 ? t('1 mark found') : tRaw('{n} marks found', { n: o.marks }));
    if (pdfFonts.length) {
      said.push(
        pdfFonts.length === 1 ? t('1 font found') : tRaw('{n} fonts found', { n: pdfFonts.length })
      );
    }
    if (!said.length)
      said.push(t('No marks and no embedded fonts were found in the pages that were read.'));
    announce(said.join(' '));
    // The card is a status message with controls in it, exactly like the design
    // file card's - focus moves to it so a screen reader reads from where the
    // buttons are, rather than being read the whole thing over the tray's own line.
    el.focus();
  }

  /**
   * Install one embedded face (plan 97 section 7.2 / M5).
   *
   * `installFontFromBytes` is the whole vetting story - the cap, the magic
   * number, the name table, the fsType reading and the variable axis - and it
   * returns null rather than throwing for bytes it cannot use. So the judgement
   * here is only what to SAY: a refusal is reported plainly and the control goes
   * back to being an offer, and a subset that installs is still called a subset,
   * because the missing characters turn up long after this dialog is closed.
   *
   * Busy and added are `aria-disabled`, never `disabled`: disabling the button
   * under the press hands focus to the body, and on the failure path there would
   * be nothing to hand it back to.
   */
  async function addPdfFont(index: number, btn: HTMLButtonElement): Promise<void> {
    const row = pdfFonts[index];
    if (!row || btn.getAttribute('aria-disabled') === 'true') return;
    const was = btn.textContent;
    btn.setAttribute('aria-disabled', 'true');
    btn.textContent = t('Adding…');

    let family: string | null = null;
    // A throw and a null are different answers, and only one of them means
    // nothing was written: installFontFromBytes stores the asset first and
    // registers/promotes it afterwards, so a failure in a later step leaves the
    // face already saved. Claiming "nothing was added" there would be false.
    let threw = false;
    try {
      const installed = await installFontFromBytes(host as unknown as UserFontsHost, row.bytes, {
        filename: `${(row.raw || row.family).replace(/[^a-z0-9.+-]/gi, '_')}.${row.format}`,
      });
      family = installed?.family ?? null;
    } catch (err) {
      // installFontFromBytes returns null for bytes it cannot use rather than
      // throwing, so anything caught here is unexpected: log it, and say the
      // one thing that is certainly true - this did not finish.
      threw = true;
      (host as unknown as { log?: (level: string, msg: string, ctx?: object) => void }).log?.(
        'warn',
        'start: pdf font install failed',
        { error: String((err as { message?: unknown })?.message ?? err) }
      );
    }
    if (!family) {
      btn.textContent = t('Could not add');
      announce(
        threw
          ? tRaw(
              '{name} could not be added. Part of it may have been saved, so check the fonts in the design system before trying again.',
              { name: row.family }
            )
          : tRaw('{name} could not be read as a font, so nothing was added.', { name: row.family }),
        { assertive: true }
      );
      setTimeout(() => {
        if (!btn.isConnected) return;
        btn.textContent = was;
        btn.removeAttribute('aria-disabled');
      }, 1800);
      return;
    }
    // The face is a user font now, so the Type room has to be told: the registry
    // caches its resolutions and the room paints from the document.
    try {
      bustFontRegistry();
      await editor?.reload();
    } catch {
      /* it installed either way */
    }
    // Said before the button is touched: the face landed whether or not the
    // dialog is still open, and a closed dialog must not swallow the one
    // sentence that reports it.
    announce(
      row.subset
        ? tRaw(
            '{family} added to the design system. It is a subset, so characters this document did not print are missing from it.',
            { family }
          )
        : tRaw('{family} added to the design system', { family })
    );
    playSfx('save');
    if (!btn.isConnected) return;
    // A quiet, permanent state: offering to install it again would say the first
    // press did nothing.
    btn.textContent = t('Added');
    btn.classList.add('is-added');
  }

  /**
   * The marks, to the Logos room.
   *
   * The stash is armed HERE rather than at scan time: it survives one navigation
   * and is drained by the room's own paint, so arming it for a scan nobody acted
   * on would drop chips into some later visit that were never asked for.
   *
   * And it REMOUNTS the studio on the Logos room rather than flipping rooms in
   * place, because the drain runs from that paint and the paint runs on a mount
   * (lib/brand-editor.ts). This is the same door #/pdf's own "Send to Logos"
   * goes through, so a mark arrives the same way whichever one sent it. The
   * remount reads `hasPendingLogoFiles()` and focuses the room it lands in.
   *
   * The stash reports what it actually armed, and this says so: a mark can be
   * refused for being over its 4 MB cap (an extracted mark inherits the page's
   * inlined rasters, so a logo over a photograph can be), and a button that
   * promised three marks must not navigate to a room holding two without
   * mentioning it - or, when nothing survived, navigate at all.
   */
  function sendPdfMarksToLogos(): void {
    if (!pdfPicks.length) return;
    // Named after the mark's place in the document, not its rank in this list:
    // the same number the exploder's tile carries, so one document names its
    // marks the same way whichever door sent them.
    const { sent } = stashPendingLogoFiles(
      pdfPicks.map(
        (pick) =>
          new File([pick.svg], `${pdfStem}-logo-${pick.index + 1}.svg`, { type: 'image/svg+xml' })
      )
    );
    if (!sent) {
      srcNote(
        pdfPicks.length === 1
          ? t('That mark is over the 4 MB limit, so it was not sent.')
          : t('Those marks are all over the 4 MB limit, so none were sent.'),
        true
      );
      return;
    }
    // Said out loud rather than into the dialog's note: the remount below takes
    // the dialog with it, and the live region is body-mounted and survives it.
    if (sent < pdfPicks.length) {
      announce(
        tRaw('{n} of {total} marks were sent. The rest are over the 4 MB limit.', {
          n: sent,
          total: pdfPicks.length,
        })
      );
    }
    playSfx('click');
    sendToLogosRoom();
  }

  /** The one way this view hands marks to the Logos room. The room drains the
   *  stash from its own PAINT, and the paint runs on a mount, so this remounts
   *  the studio on that room rather than flipping to it in place. */
  function sendToLogosRoom(): void {
    // A start→start hand-off: REPLACE the current history entry rather than
    // pushing a new #/start?area=logos one. A push left a phantom studio stop
    // that the browser Back button (and the back pill's history.back()) had to
    // unwind before it could leave the studio at all - the "back loop" that
    // stranded anyone who reached /start mid-session. The remount is what drains
    // the logos stash (the room reads it on paint), so it fires unconditionally.
    // Like selectRoom, this writes `area` alone: the one-shot arrival flags
    // (focus/wheel/import/source/seed) are consumed on mount by design and must not
    // be carried forward - a remount would re-fire them.
    try {
      history.replaceState(null, '', '#/start?area=logos');
    } catch {
      /* sandboxed */
    }
    window.dispatchEvent(new Event('lolly:remount'));
  }

  // ── The website source (plan 97 section 9, M6) ──────────────────────────────────────
  // section 9's decision in one sentence: NO SERVER FETCH, EVER. The deployed PWA
  // cannot reach an arbitrary origin at all (its CSP allowlists six hosts, so
  // this dies before CORS is even asked), and no fetching service was built -
  // it was ruled out, not deferred. So the source exists only where a reader
  // already lives on the device: a Tauri shell's native fetch, or the Lolly
  // extension reading one background tab.
  //
  // `siteTransport === null` is the gate, and it gates the TILE, not the tile's
  // state: nothing about this source appears in the picker on a plain browser,
  // because a control that cannot work teaches the person a lie about their own
  // machine. Discovery lives on the capabilities page instead (capabilities.ts's
  // `siteIngestSupport`, rendered as prose in lib/capabilities-data.ts).
  //
  // Nothing is fetched before the press. The button IS the consent, its label
  // names the host, and the line above it names WHO does the reading, because
  // "the extension opens a background tab on suse.com" and "this app opens a
  // socket to suse.com" are different facts about somebody's device. A
  // `?source=url&u=` link only fills the field in.
  const siteTransport = detectSiteTransport(host as unknown as HostV1);
  // Read through the one place verdicts live, so the picker and the capabilities
  // page cannot disagree about what 'ready' means. 'install' (Chromium without
  // the extension) deliberately renders NOTHING here - see capabilities.ts.
  const siteReady =
    siteIngestSupport(siteTransport !== null).status === 'ready' && siteTransport !== null;

  /** The marks a scan found that the Logos room can take, and the name the page
   *  calls itself: held between the result card and its presses, the same
   *  lifecycle as the PDF stage's `pdfPicks`. */
  let siteMarks: File[] = [];
  let siteNameOffer = '';
  /** The host the last scan actually landed on (after any redirect) - the
   *  provenance in the card, and the noun in everything said about it. */
  let siteHostName = '';

  const siteResultEl = (): HTMLElement | null =>
    importModal?.el.querySelector<HTMLElement>('[data-ds-site-result]') ?? null;

  /** Why a scan produced nothing, in this view's words. The source module
   *  reports machine reasons precisely so the copy lives here. */
  //
  // t() OR tRaw() IS A DECISION HERE, not a habit. scripts/translate.ts finds
  // keys by scanning source for a literal `t(` call, so a `tRaw(` string is
  // English forever unless somebody hand-lists it. Every sentence whose only
  // parameter is a HOSTNAME or a NUMBER therefore uses t(): those cannot carry
  // an HTML-special character (a hostname comes out of `new URL().hostname`),
  // so the escaping t() adds is a no-op and the string becomes translatable.
  // The two that stay tRaw are the two whose parameter is free text off a
  // third-party page or out of the field - escaping those would show somebody
  // `O&#39;Brien` in a sentence that is written to `textContent`.
  function siteRefusalText(
    refusal: Extract<SiteScanResult, { kind: 'refused' }>,
    typed: string
  ): string {
    switch (refusal.reason) {
      case 'empty-url':
        return t('Type a web address first.');
      case 'unsupported-scheme':
        return t('Only an http or https address can be read.');
      case 'credentials-in-url':
        return t('That address carries a username and password. Take them out and try again.');
      case 'url-too-long':
        return t('That address is too long (limit {n} characters).', {
          n: refusal.limit ?? SITE_MAX_URL_CHARS,
        });
      case 'unparseable-url':
        return tRaw('{value} is not a web address.', { value: typed });
      // The tile is not rendered without a transport, so this is defence in
      // depth rather than a state somebody can press their way into.
      case 'no-transport':
        return t(
          'This app cannot read a website. The desktop app can, and so can Chromium with the Lolly extension.'
        );
      case 'timeout':
        return t('{host} took too long to answer.', { host: siteHostName });
      case 'empty-page':
        return t('{host} answered with no page to read.', { host: siteHostName });
      default:
        return t('{host} could not be read.', { host: siteHostName });
    }
  }

  /**
   * A refusal put where the field is, not only where the note is.
   *
   * The sentence is announced (once, assertively) AND left in a static element
   * the field names through `aria-describedby`, with `aria-invalid` on the
   * field itself. WCAG 3.3.1 asks for the error to be identified; a live region
   * alone identifies it in TIME but not in PLACE, so somebody who tabs back to
   * the address a minute later has nothing to re-read. Same shape as the
   * Versions panel's slug field.
   */
  function siteFieldError(msg: string): void {
    const modalEl = importModal?.el;
    const field = modalEl?.querySelector<HTMLInputElement>('.ds-src-urlfield');
    const errEl = modalEl?.querySelector<HTMLElement>('[data-ds-site-error]');
    if (!field || !errEl) {
      srcNote(msg, true);
      return;
    } // no stage: say it in the note
    // The progress line said "Reading suse.com…"; leaving that under a refusal
    // would be the dialog claiming two things at once.
    srcNote('');
    errEl.textContent = msg;
    errEl.hidden = false;
    field.setAttribute('aria-invalid', 'true');
    announce(msg, { assertive: true });
  }

  /** Clears it. Called when the address changes and when a read succeeds - the
   *  refusal was about an address that no longer stands. */
  function clearSiteFieldError(): void {
    const modalEl = importModal?.el;
    const errEl = modalEl?.querySelector<HTMLElement>('[data-ds-site-error]');
    if (errEl && !errEl.hidden) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    modalEl?.querySelector<HTMLInputElement>('.ds-src-urlfield')?.removeAttribute('aria-invalid');
  }

  /** A partial read said plainly. Each line is one FACT about what did not
   *  happen - a card that stays silent about a truncated page is claiming to
   *  have read the whole of it. */
  function siteWarningText(warnings: readonly SiteScanWarning[]): string[] {
    const out: string[] = [];
    if (warnings.includes('html-truncated') || warnings.includes('css-truncated')) {
      out.push(t('That page is very large, so only the first part of it was read.'));
    }
    if (warnings.includes('screenshot-failed')) {
      out.push(
        t('The picture of the page could not be read, so only the colours it declares were used.')
      );
    }
    if (
      warnings.includes('logo-not-image') ||
      warnings.includes('logo-too-large') ||
      warnings.includes('assets-truncated')
    ) {
      out.push(t('Some of the marks on the page could not be used.'));
    }
    return out;
  }

  /** One logo candidate as a file the Logos room accepts, or null. Named after
   *  the page it came from so a mark arrives recognisable rather than as
   *  "logo.svg" - the same courtesy the PDF hand-off pays. */
  function siteMarkFile(url: string, bytes: Uint8Array, mime: string, index: number): File | null {
    const ext = markExtension(mime);
    if (!ext) return null;
    let stem = '';
    try {
      const path = new URL(url).pathname;
      stem = (path.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
    } catch {
      /* an unresolvable URL simply names itself after the host */
    }
    stem = stem
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    // `hostPart`, not `host`: the view's own `host` is the bridge, and shadowing
    // it inside a helper that also uses the design system risks bugs.
    const hostPart = siteHostName.replace(/[^a-z0-9.-]+/gi, '-') || 'site';
    const name = stem ? `${hostPart}-${stem}.${ext}` : `${hostPart}-mark-${index + 1}.${ext}`;
    return new File([bytes as unknown as BlobPart], name, { type: mime });
  }

  /**
   * One page, read once, on the press of the button that named it.
   *
   * The order is the privacy posture: the address is validated before anything
   * (a refusal costs no fetch), the transport is called exactly once for that
   * one address, and everything after it is parsing on this device. The scan
   * never throws - a hostile page must cost a sentence, not the dialog.
   */
  async function scanSite(
    field: HTMLInputElement | null,
    btn: HTMLButtonElement | null
  ): Promise<void> {
    if (!siteTransport || btn?.getAttribute('aria-disabled') === 'true') return;
    const raw = field?.value ?? '';
    siteMarks = [];
    siteNameOffer = '';
    const before = siteResultEl();
    if (before) {
      before.hidden = true;
      before.textContent = '';
    }
    clearSiteFieldError();

    // Escape CANCELS, and a cancel keeps nothing. A read in flight cannot be
    // called back (the transport owns the tab or the socket), so the cancel is
    // enforced where it matters: the commit. Identity, not truthiness - the
    // same rule the PDF scan follows.
    //
    // "All sources" counts as a cancel too, and that is not a nicety. The stage
    // it leaves is `display: none`, so a result landing behind it would un-hide
    // a card inside a hidden section, announce "3 marks found" and then call
    // focus() on an element that cannot take focus - an announcement with no
    // destination. Back and Escape now mean the same thing, which is also the
    // simpler sentence to hold in your head.
    const startedIn = importModal;
    const stageGone = (): boolean =>
      !!startedIn?.el.querySelector<HTMLElement>('[data-ds-stage="url"]')?.hidden;
    const cancelled = (): boolean =>
      (!!startedIn && importModal !== startedIn) || !shell.isConnected || stageGone();

    // Only for the progress line and the words said about it; `scanWebsite`
    // validates the address itself and is the authority on refusing one.
    const check = normalizeSiteUrl(raw);
    siteHostName = check.ok ? check.siteHost : '';

    // Busy is aria-disabled, never `disabled`: disabling the button under the
    // press hands focus to the body, and on the refusal path below there would
    // be nothing to hand it back to.
    if (btn) {
      btn.setAttribute('aria-disabled', 'true');
      btn.textContent = t('Reading…');
    }
    // Re-derived from the field rather than restored from a captured string:
    // the address can be edited while a read runs (the field is live, only the
    // button is busy), and a label naming the previous host would then be
    // offering to read something the field no longer says.
    const restore = (): void => {
      if (!btn?.isConnected) return;
      btn.removeAttribute('aria-disabled');
      const now = normalizeSiteUrl(field?.value ?? '');
      btn.textContent = now.ok ? t('Read {host}', { host: now.siteHost }) : t('Read the page');
    };

    const result = await scanWebsite(
      siteTransport,
      raw,
      (phase: SiteScanPhase) => {
        // A cancelled read stops talking: `srcNote` falls back to the rail when
        // the dialog is gone, so without this the progress of a read nobody is
        // waiting for keeps posting itself onto the page behind it.
        if (cancelled()) return;
        if (phase === 'fetch') srcNote(t('Reading {host}…', { host: siteHostName }));
        else if (phase === 'read') srcNote(t('Reading the colours, type and marks…'));
        else if (phase === 'paint') srcNote(t('Reading the colours as painted…'));
      },
      { timeoutMs: SITE_READ_BUDGET_MS, host: host as unknown as HostV1 }
    );

    // The dialog went away while the read ran: the person cancelled, so the
    // findings are dropped whole and nothing is said. A rail note reporting
    // colours somebody just cancelled out of is the confusing half of a
    // half-cancel - and the marks and the name were being discarded anyway.
    if (cancelled()) return;
    restore();

    if (result.kind === 'refused') {
      siteFieldError(siteRefusalText(result, raw));
      return;
    }

    siteHostName = result.siteHost || siteHostName;
    // The tray first: it is where every source's findings wait, and its own
    // count is the answer to "what did that do", so it replaces the progress.
    await keepInTray(result.census, srcNote);

    // A mark travels only if the Logos room would take it (an .ico favicon is
    // common and it would not), and only with bytes - a URL alone is nothing
    // this device holds.
    let listedOnly = 0;
    let refusedFormat = 0;
    result.logoCandidates.forEach((cand, i) => {
      if (!cand.bytes || !cand.mime) {
        listedOnly++;
        return;
      }
      if (!LOGO_ROOM_MIME.test(cand.mime)) {
        refusedFormat++;
        return;
      }
      const file = siteMarkFile(cand.url, cand.bytes, cand.mime, i);
      if (file) siteMarks.push(file);
    });

    // The name is a SUGGESTION and only where there is none: a page's <title>
    // is a guess about what somebody calls their design system, and overwriting
    // a name they chose with it would be the studio talking over them.
    const named = await readSystemName(host as unknown as HostV1).catch(() => null);
    if (cancelled()) return;
    if (!named && result.siteName) siteNameOffer = result.siteName.slice(0, 60);

    renderSiteResult({
      marks: siteMarks.length,
      listedOnly,
      refusedFormat,
      families: result.googleFamilies,
      warnings: result.warnings,
      usedScreenshot: result.usedScreenshot,
    });
  }

  /**
   * The website stage's result card: what one page turned out to hold, and the
   * two decisions it offers without leaving the dialog.
   *
   * Same construction as the PDF card, and for the same reason: it is a status
   * message with controls in it, so its one-sentence summary is SPOKEN and then
   * focus moves into it. Focus alone announces nothing - a `tabindex="-1"` div
   * has no role and no name - so the marks, the type and the caveats would go
   * unheard behind the tray's own count.
   */
  function renderSiteResult(o: {
    marks: number;
    listedOnly: number;
    refusedFormat: number;
    families: readonly string[];
    warnings: readonly SiteScanWarning[];
    usedScreenshot: boolean;
  }): void {
    const el = siteResultEl();
    if (!el) return; // the dialog closed while the read ran - the tray still has it
    const warnings = siteWarningText(o.warnings);
    const familyList = o.families.slice(0, 6).join(', ');

    el.innerHTML = `
      <p class="start-import-name">${escape(siteHostName)}<span class="start-import-source">${t('Website')}</span></p>
      ${o.usedScreenshot ? `<p class="start-import-stats">${t('The colours it is painted with were read too, not only the ones it declares.')}</p>` : ''}
      ${warnings.map((w) => `<p class="start-import-warn">${escape(w)}</p>`).join('')}
      ${
        /* Each plural is TWO whole t() calls, not one t() over a ternary:
            scripts/translate.ts finds literal call sites by scanning source, so
            a string spelled inside a conditional never reaches a translator
            unless somebody remembers to hand-list it in extra-keys.spa.json. */ ''
      }
      ${
        o.marks
          ? `
        <div class="start-color-actions">
          <button type="button" class="be-btn be-btn--sm ds-site-act" data-ds-site-logos>${
            o.marks === 1
              ? t('Review {n} mark in Logos', { n: o.marks })
              : t('Review {n} marks in Logos', { n: o.marks })
          }</button>
        </div>`
          : ''
      }
      ${
        o.refusedFormat
          ? `<p class="start-import-stats">${
              o.refusedFormat === 1
                ? t('{n} more mark is in a format Logos does not take (PNG, JPEG, SVG or WebP).', {
                    n: o.refusedFormat,
                  })
                : t('{n} more marks are in formats Logos does not take (PNG, JPEG, SVG or WebP).', {
                    n: o.refusedFormat,
                  })
            }</p>`
          : ''
      }
      ${
        o.listedOnly
          ? `<p class="start-import-stats">${
              o.listedOnly === 1
                ? t('The page lists {n} more mark whose file was not read.', { n: o.listedOnly })
                : t('The page lists {n} more marks whose files were not read.', { n: o.listedOnly })
            }</p>`
          : ''
      }
      ${familyList ? `<p class="start-import-stats">${t('Google Fonts on this page: {list}. Type installs them.', { list: familyList })}</p>` : ''}
      ${
        siteNameOffer
          ? `
        <div class="start-color-actions">
          <button type="button" class="be-btn be-btn--sm ds-site-act" data-ds-site-name>${t(
            'Use {name} as the design system name',
            { name: siteNameOffer }
          )}</button>
        </div>`
          : ''
      }
      ${
        !o.marks && !familyList && !siteNameOffer && !warnings.length
          ? `<p class="start-import-stats">${t('No marks, no Google Fonts and no name came out of this page. Whatever colours it declares are in the tray.')}</p>`
          : ''
      }`;
    el.hidden = false;

    // What the card SAYS, in one line: the counts it offers a decision on, plus
    // any part of the read that did not run. Deliberately not the whole card
    // read aloud, and deliberately not the tray count - keepInTray already said
    // that through the dialog's own note line.
    const said: string[] = [...warnings];
    if (o.marks)
      said.push(o.marks === 1 ? t('1 mark found') : t('{n} marks found', { n: o.marks }));
    if (familyList) said.push(tRaw('Type: {list}', { list: familyList }));
    if (siteNameOffer) said.push(tRaw('This page calls itself {name}.', { name: siteNameOffer }));
    if (!said.length) said.push(t('Nothing beyond the colours came out of this page.'));
    announce(said.join(' '));
    el.focus();
  }

  /**
   * The marks, to the Logos room - the same door the PDF stage uses, so a mark
   * arrives and is classified identically whichever source sent it. Nothing is
   * installed by this: the room queues confirm chips.
   *
   * The stash is armed HERE rather than at scan time, because it survives one
   * navigation and is drained by the room's paint: arming it for a scan nobody
   * acted on would drop chips into some later visit that were never asked for.
   */
  function sendSiteMarksToLogos(): void {
    if (!siteMarks.length) return;
    const { sent } = stashPendingLogoFiles(siteMarks);
    if (!sent) {
      srcNote(
        siteMarks.length === 1
          ? t('That mark is over the 4 MB limit, so it was not sent.')
          : t('Those marks are all over the 4 MB limit, so none were sent.'),
        true
      );
      return;
    }
    // Said out loud rather than into the dialog's note: the remount takes the
    // dialog with it, and the live region is body-mounted and survives it.
    if (sent < siteMarks.length) {
      // t(), not tRaw(): both parameters are counts, so the escaping is a no-op
      // and the sentence becomes something a translator can actually see.
      announce(
        t('{n} of {total} marks were sent. The rest are over the 4 MB limit.', {
          n: sent,
          total: siteMarks.length,
        })
      );
    }
    playSfx('click');
    sendToLogosRoom();
  }

  /**
   * Name the design system after the page, on one press.
   *
   * The name is the tokens asset's own label, so this is a head write with a
   * label and no change to the document: `refreshHead` first, every time, so
   * the write carries whatever the rooms have installed since this view mounted
   * rather than the snapshot it opened with.
   *
   * No checkpoint, unlike an install: nothing is replaced, the document is
   * byte-identical either side, and the way back is to type another name. It is
   * only offered where there is no name to overwrite (see the scan), so it
   * cannot take one away.
   */
  async function useSiteName(btn: HTMLButtonElement): Promise<void> {
    const name = siteNameOffer;
    if (!name || btn.getAttribute('aria-disabled') === 'true') return;
    const was = btn.textContent;
    btn.setAttribute('aria-disabled', 'true');
    btn.textContent = t('Naming…');
    try {
      await refreshHead();
      if (!headDoc) throw new Error(t('There is nothing to name yet. Add a colour first.'));
      await installUserTokens(host, headDoc, { label: name });
      void applyChromeBrandVars(host); // bust() cleared the caches; nothing repaints by itself
    } catch (err) {
      announce(String((err as { message?: unknown })?.message ?? err), { assertive: true });
      if (!btn.isConnected) return;
      btn.textContent = t('Could not name it');
      setTimeout(() => {
        if (!btn.isConnected) return;
        btn.textContent = was;
        btn.removeAttribute('aria-disabled');
      }, 1800);
      return;
    }
    // Said before the button is touched: the name landed whether or not the
    // dialog is still open, and a closed dialog must not swallow the sentence.
    announce(tRaw('The design system is called {name} now', { name }));
    playSfx('save');
    if (!btn.isConnected) return;
    btn.textContent = t('Named');
    btn.classList.add('is-added');
  }

  // ── Add from…: a two-stage picker ────────────────────────────────────────────
  // Stage 1 asks WHAT you have (plan 97 section 8); stage 2 is that source's own control.
  // The design-file card is NOT rebuilt per open - it's moved out of its hidden
  // holder into the file stage and back again, so the file input, the drop target
  // and the delegated result handlers below stay wired to the same nodes for the
  // life of the view. Everything else is the shared modal primitive: Escape,
  // backdrop dismissal, focus containment and restore come free (components/modal.ts).
  const importHome = viewEl.querySelector<HTMLElement>('[data-start-import-home]')!;
  const importPanel = viewEl.querySelector<HTMLElement>('[data-start-import-panel]')!;
  let importModal: ModalHandle<void> | null = null;

  // Built at open so every label resolves against the language in force.
  const SOURCE_NAME: Record<PickerSource, () => string> = {
    file: () => t('Lolly pack or design file'),
    pdf: () => t('PDF'),
    image: () => t('Image'),
    font: () => t('Font file'),
    url: () => t('Website'),
  };
  const SOURCE_NOTE: Record<PickerSource, () => string> = {
    // User-first, not format-first (plans/137 B3): the exact formats are one tap
    // away on the file stage's own chips, which is where somebody checking
    // whether THEIR export is accepted is already looking.
    file: () => t('A .lolly file, tokens JSON, a Penpot project or an SVG.'),
    pdf: () =>
      t('A deck or guidelines file. Colours, marks and typefaces are read on this device.'),
    image: () =>
      t('A screenshot or a photo. Colours are read on this device and nothing is uploaded.'),
    font: () => t('TTF, OTF or WOFF. Opens Type, where the face installs.'),
    // The tile names its reader AND whose session does the reading, because the
    // two are different things to do to somebody's device and the person is
    // about to consent to one of them.
    url: () =>
      siteTransport?.kind === 'extension'
        ? t('One page, read through the extension in a background tab, signed in as you.')
        : t('One page, fetched by the app on this device, signed in to nothing.'),
  };

  /** The tiles this device can actually offer. Website leads when it is there
   *  (plan 97 section 5's order) and is simply absent when it is not. */
  const sourceTiles = (): ReadonlyArray<{ id: PickerSource; icon: IconName }> =>
    siteReady ? [WEBSITE_TILE, ...SOURCE_TILES] : SOURCE_TILES;

  /** The picker's own note line - one sentence about what just happened, in the
   *  dialog rather than the rail, because that is where the eye already is. */
  const srcNote = (msg: string, isError = false): void => {
    const el = importModal?.el.querySelector<HTMLElement>('[data-ds-source-note]');
    if (!el) {
      showNote(msg, isError);
      return;
    } // the dialog closed under us
    el.textContent = msg;
    el.classList.toggle('is-error', isError);
  };

  /** Show one stage, or the source list when `src` names no stage of its own.
   *  A pure `hidden` toggle over nodes that are already there - nothing here
   *  rebuilds markup, which is why the picker adds no raw-HTML sink. */
  function showStage(src: StartSource | null): void {
    const el = importModal?.el;
    if (!el) return;
    // `url` is a stage only where a transport answered: on a plain browser the
    // section was never rendered, so a `?source=url` link falls through to the
    // list rather than opening an empty panel (plan 97 section 9's degrade).
    const stage =
      src === 'file' || src === 'image' || src === 'pdf'
        ? src
        : src === 'url' && siteReady
          ? 'url'
          : null;
    const tiles = el.querySelector<HTMLElement>('[data-ds-src-tiles]');
    const intro = el.querySelector<HTMLElement>('[data-ds-src-intro]');
    if (tiles) tiles.hidden = stage !== null;
    if (intro) intro.hidden = stage !== null;
    el.querySelectorAll<HTMLElement>('[data-ds-stage]').forEach((s) => {
      s.hidden = s.dataset.dsStage !== stage;
    });
    // Focus follows the stage: the control the person came for, or the first
    // source when they came for the list.
    const focusSel =
      stage === 'file'
        ? '.start-import-file'
        : stage === 'image'
          ? '.ds-src-imgfile'
          : stage === 'pdf'
            ? '.ds-src-pdffile'
            : stage === 'url'
              ? '.ds-src-urlfield'
              : '[data-ds-source]';
    el.querySelector<HTMLElement>(focusSel)?.focus();
  }

  /** A tile press. Three of the four open a stage; the font tile is an ACTION -
   *  the Type room already owns installing a face, so sending someone there beats
   *  a second uploader that would have to agree with it forever. */
  function chooseSource(src: StartSource): void {
    if (src === 'font') {
      closeImport();
      selectRoom('type', { focus: true });
      // Focus the room's own upload control. Never .click() it from here - a file
      // dialog belongs to the press the user made, not to a route.
      editorRoot?.querySelector<HTMLElement>('.fonts-upload-file')?.focus();
      return;
    }
    showStage(src);
  }

  function openImport(source: StartSource | null = null): void {
    // A named source that is an ACTION rather than a stage never opens a dialog
    // it would immediately close: `?source=font` goes straight to the Type room.
    if (source === 'font') {
      chooseSource('font');
      return;
    }
    if (importModal) {
      showStage(source);
      return;
    }
    importModal = mountModal<void>(
      `
      <!-- A VISIBLE way out (plans/137 B3). Escape and a backdrop tap both
           dismiss already (components/modal.ts owns each), but on a phone the
           card fills the screen and neither is something you can see. -->
      <div class="start-import-head">
        <h2 class="modal-title">${t('Add from…')}</h2>
        <button type="button" class="start-import-close" data-ds-src-close
          aria-label="${escape(t('Close'))}">&#x2715;</button>
      </div>
      <p class="modal-msg" data-ds-src-intro>${t('Bring across what you already have. Everything is read on this device.')}</p>
      <ul class="ds-src-tiles" role="list" data-ds-src-tiles>
        ${sourceTiles()
          .map(
            (tile) => `
          <li>
            <button type="button" class="ds-src-tile" data-ds-source="${escape(tile.id)}">
              <span class="ds-src-tile-ic" aria-hidden="true">${icon(tile.icon)}</span>
              <span class="ds-src-tile-name">${escape(SOURCE_NAME[tile.id]())}</span>
              <span class="ds-src-tile-note">${escape(SOURCE_NOTE[tile.id]())}</span>
            </button>
          </li>`
          )
          .join('')}
      </ul>
      <section class="ds-src-stage" data-ds-stage="file" hidden>
        <button type="button" class="be-btn be-btn--sm ds-src-back" data-ds-src-back>${t('All sources')}</button>
        <div data-import-mount></div>
      </section>
      <section class="ds-src-stage" data-ds-stage="image" hidden>
        <button type="button" class="be-btn be-btn--sm ds-src-back" data-ds-src-back>${t('All sources')}</button>
        <label class="start-import-drop ds-src-drop" data-ds-image-drop>
          <input type="file" class="ds-src-imgfile visually-hidden" accept="image/*" aria-label="${escape(t('Choose an image'))}">
          <span class="ds-src-drop-ic" aria-hidden="true">${icon('image')}</span>
          <span class="be-btn start-import-btn" aria-hidden="true">${t('Choose an image…')}</span>
          <span class="start-import-drophint">${t('or drag & drop it here')}</span>
        </label>
        <p class="ds-src-stage-note">${t('The colours it is actually painted with land in the tray. Add the ones you want.')}</p>
      </section>
      <section class="ds-src-stage" data-ds-stage="pdf" hidden>
        <button type="button" class="be-btn be-btn--sm ds-src-back" data-ds-src-back>${t('All sources')}</button>
        <label class="start-import-drop ds-src-drop" data-ds-pdf-drop>
          <input type="file" class="ds-src-pdffile visually-hidden" accept="application/pdf,.pdf,.ai" aria-label="${escape(t('Choose a PDF'))}">
          <span class="ds-src-drop-ic" aria-hidden="true">${icon('document')}</span>
          <span class="be-btn start-import-btn" aria-hidden="true">${t('Choose a PDF…')}</span>
          <span class="start-import-drophint">${t('or drag & drop it here')}</span>
        </label>
        <p class="ds-src-stage-note">${t('Colours and typefaces land in the tray. Marks wait until you send them to Logos.')}</p>
        <!-- tabindex="-1": the scan's answer is a status message with controls in
             it, so it takes focus when it appears rather than being read whole. -->
        <div class="ds-src-pdf-result" data-ds-pdf-result tabindex="-1" hidden></div>
      </section>
      ${
        siteReady
          ? `
      <!-- The website stage exists only where a transport does (plan 97 section 9): it
           is not rendered-and-disabled, it is not rendered at all. The button is
           the consent, and the line above it names the host and the reader. -->
      <section class="ds-src-stage" data-ds-stage="url" hidden>
        <button type="button" class="be-btn be-btn--sm ds-src-back" data-ds-src-back>${t('All sources')}</button>
        <div class="ds-src-url">
          <label class="field-label" for="ds-src-url-input">${t('Web address')}</label>
          <div class="ds-src-url-row">
            <input class="field-input ds-src-urlfield" id="ds-src-url-input" type="url" inputmode="url"
              autocomplete="off" spellcheck="false" placeholder="example.com"
              maxlength="${SITE_MAX_URL_CHARS}" aria-describedby="ds-src-url-consent ds-src-url-error">
            <button type="button" class="be-cta ds-src-url-go" data-ds-site-go>${t('Read the page')}</button>
          </div>
          <p class="ds-src-url-consent" id="ds-src-url-consent" data-ds-site-consent>${t(
            'Nothing is read until you press the button.'
          )}</p>
          <!-- A refusal stays HERE, named by the field's aria-describedby, so it
               can be re-read after the one polite announcement has passed. The
               field also takes aria-invalid; see siteFieldError. -->
          <p class="ds-src-note is-error" id="ds-src-url-error" data-ds-site-error hidden></p>
        </div>
        <p class="ds-src-stage-note">${t('One page, and only the one you name. No link on it is followed. Colours and type land in the tray; marks wait until you send them to Logos.')}</p>
        <!-- tabindex="-1": same status-message-with-controls as the PDF card. -->
        <div class="ds-src-site-result" data-ds-site-result tabindex="-1" hidden></div>
      </section>`
          : ''
      }
      <p class="ds-src-note" data-ds-source-note aria-live="polite"></p>`,
      {
        className: 'modal start-import-modal',
        ariaLabel: escape(t('Add from…')),
        onClose: () => {
          importModal = null;
          importHome.appendChild(importPanel); // back to the holder, still wired
          importBtn?.classList.remove('is-open');
        },
      }
    );
    const modalEl = importModal.el;
    modalEl.querySelector<HTMLElement>('[data-import-mount]')!.appendChild(importPanel);
    modalEl.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      const src = el.closest<HTMLElement>('[data-ds-source]')?.dataset.dsSource;
      if (src) {
        chooseSource(src as StartSource);
        playSfx('click');
        return;
      }
      if (el.closest('[data-ds-src-close]')) {
        closeImport();
        playSfx('click');
        return;
      }
      if (el.closest('[data-ds-src-back]')) {
        showStage(null);
        playSfx('click');
        return;
      }
      // The PDF result card's two presses. Delegated for the same reason the
      // design-file card's are: the card is rebuilt by every scan.
      const fontBtn = el.closest<HTMLButtonElement>('[data-ds-pdf-font]');
      if (fontBtn) {
        void addPdfFont(Number(fontBtn.dataset.dsPdfFont), fontBtn);
        return;
      }
      if (el.closest('[data-ds-pdf-logos]')) {
        sendPdfMarksToLogos();
        return;
      }
      // The website stage's three presses. The fetch button is the consent, so
      // it is the ONLY thing on this view that starts a read.
      const goBtn = el.closest<HTMLButtonElement>('[data-ds-site-go]');
      if (goBtn) {
        void scanSite(modalEl.querySelector<HTMLInputElement>('.ds-src-urlfield'), goBtn);
        return;
      }
      if (el.closest('[data-ds-site-logos]')) {
        sendSiteMarksToLogos();
        return;
      }
      const nameBtn = el.closest<HTMLButtonElement>('[data-ds-site-name]');
      if (nameBtn) void useSiteName(nameBtn);
    });
    const imgInput = modalEl.querySelector<HTMLInputElement>('.ds-src-imgfile');
    imgInput?.addEventListener('change', async () => {
      const file = imgInput.files?.[0];
      imgInput.value = ''; // so re-picking the same file re-fires
      if (file) await scanImageFile(file, srcNote);
    });
    const imgDrop = modalEl.querySelector<HTMLElement>('[data-ds-image-drop]');
    imgDrop?.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      imgDrop.classList.add('is-dragover');
    });
    imgDrop?.addEventListener('dragleave', (e) => {
      if (e.relatedTarget && imgDrop.contains(e.relatedTarget as Node)) return;
      imgDrop.classList.remove('is-dragover');
    });
    imgDrop?.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      imgDrop.classList.remove('is-dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) void scanImageFile(file, srcNote);
    });
    // The PDF stage's own mouth, wired exactly like the image stage's: a label
    // over a hidden input for the click, and the same three drag listeners
    // (stopPropagation so the shell's drag-anywhere doesn't handle it twice).
    const pdfInput = modalEl.querySelector<HTMLInputElement>('.ds-src-pdffile');
    pdfInput?.addEventListener('change', async () => {
      const file = pdfInput.files?.[0];
      pdfInput.value = ''; // so re-picking the same file re-fires
      if (file) await scanPdfFile(file, srcNote);
    });
    const pdfDrop = modalEl.querySelector<HTMLElement>('[data-ds-pdf-drop]');
    pdfDrop?.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      pdfDrop.classList.add('is-dragover');
    });
    pdfDrop?.addEventListener('dragleave', (e) => {
      if (e.relatedTarget && pdfDrop.contains(e.relatedTarget as Node)) return;
      pdfDrop.classList.remove('is-dragover');
    });
    pdfDrop?.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      pdfDrop.classList.remove('is-dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) void scanPdfFile(file, srcNote);
    });
    // The website stage's field. Its two jobs are to keep the consent notice
    // accurate while the address is typed, and to make Return do what the button does -
    // it is a single field beside a single action, and few users reach for the
    // mouse after typing an address.
    const urlField = modalEl.querySelector<HTMLInputElement>('.ds-src-urlfield');
    if (urlField) {
      const goEl = modalEl.querySelector<HTMLButtonElement>('[data-ds-site-go]');
      const consentEl = modalEl.querySelector<HTMLElement>('[data-ds-site-consent]');
      const syncConsent = (): void => {
        // The address is parsed, never guessed at: until it resolves to a host
        // there is no host to name, and the button says so rather than
        // promising to read something nobody has described yet.
        const check = normalizeSiteUrl(urlField.value);
        const named = check.ok ? check.siteHost : '';
        if (goEl && goEl.getAttribute('aria-disabled') !== 'true') {
          goEl.textContent = named ? t('Read {host}', { host: named }) : t('Read the page');
        }
        if (consentEl) {
          // WHO reads it is half the fact; the other half is AS WHOM. The
          // extension opens the page in the browser the person is signed into,
          // so a logged-in dashboard comes back rendered with their name in it;
          // the native fetch builds a client with no cookie store, so it gets
          // the logged-out page. Same button, materially different act, and the
          // sentence somebody consents to has to carry the difference.
          consentEl.textContent = !named
            ? t('Nothing is read until you press the button.')
            : siteTransport?.kind === 'extension'
              ? t('The extension reads {host} in a background tab, signed in as you.', {
                  host: named,
                })
              : t('The app fetches {host} directly, signed in to nothing.', { host: named });
        }
      };
      urlField.addEventListener('input', () => {
        clearSiteFieldError();
        syncConsent();
      });
      urlField.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return; // Escape belongs to the dialog, untouched
        e.preventDefault();
        void scanSite(urlField, goEl);
      });
      // `?source=url&u=` - a PREFILL and nothing else. It is consumed here, once,
      // so a remount cannot re-fill a field somebody deliberately cleared, and no
      // code path turns it into a press.
      if (urlPrefill) {
        urlField.value = urlPrefill;
        urlPrefill = '';
      }
      syncConsent();
    }
    importBtn?.classList.add('is-open');
    showStage(source);
  }
  const closeImport = (): void => importModal?.close();

  importBtn?.addEventListener('click', () => {
    openImport();
    playSfx('click');
  });
  // A file the FRONT DOOR handed over: the drop chooser's "Use as the design
  // system" (lib/drop-router.ts) stashes the dropped file and routes here, so the
  // studio opens on that file instead of asking for it a second time. One-shot
  // and cleared on read, like every other stash that router arms, and consumed on
  // mount like every other read-only arrival flag. Routed by what it IS, so the
  // PDF chooser's door and the token document's door both land where they should
  // - and the `?source=` in the URL is only the fallback for a stash that has
  // already been spent (a remount).
  const handedOver = takePendingDesignSystemFile();
  // A link can still arrive with the importer open (`#/start?import`), which is how
  // an "add your design system" entry point elsewhere hands off. `?source=<kind>`
  // opens it on that source and is consumed here - selectRoom's replaceState
  // already dropped both from the URL. `?import=0` is the historic form for
  // "leave it shut" and stays a no-op against today's default.
  if (handedOver) void routeDroppedFile(handedOver);
  else if (importOpen) openImport(route.source);

  // Dragging a file anywhere over the studio opens the importer, so the drop has
  // somewhere to land - a modal you must open first would otherwise take away the
  // drag & drop the card advertises. A drop that never reached the card is routed
  // by what it IS (see routeDroppedFile), so an image dragged onto the page is a
  // colour scan rather than a failed token parse.
  shell.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    // A drag reports its items' TYPE (never their data), which is enough to open
    // on the stage the drop is about to need instead of flashing the wrong one.
    const dragged = e.dataTransfer.items?.[0]?.type ?? '';
    const stage: StartSource =
      dragged === 'application/pdf'
        ? 'pdf'
        : dragged.startsWith('image/') && dragged !== 'image/svg+xml'
          ? 'image'
          : 'file';
    if (!importModal) openImport(stage);
  });
  shell.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    e.preventDefault();
    void routeDroppedFile(file);
  });

  /** What a dropped file IS decides who handles it. One router for the shell's
   *  drag-anywhere and the card's own drop, so both answer the same. */
  async function routeDroppedFile(file: File): Promise<void> {
    if (PDF_NAME.test(file.name) || file.type === 'application/pdf') {
      openImport('pdf');
      await scanPdfFile(file, srcNote);
      return;
    }
    const isSvg = /\.svg$/i.test(file.name) || file.type === 'image/svg+xml';
    if (!isSvg && (IMAGE_NAME.test(file.name) || file.type.startsWith('image/'))) {
      openImport('image');
      await scanImageFile(file, srcNote);
      return;
    }
    if (FONT_NAME.test(file.name)) {
      // No silent install: the Type room takes the file, and this says so.
      showNote(tRaw('Open Type to install {name}', { name: file.name }));
      chooseSource('font');
      return;
    }
    openImport('file');
    await handleImportFile(file);
  }

  // ── Install (the JSON-import path funnels here) ──────────────────────────────
  // An install keeps the user IN the studio: the editor reloads around the new
  // tokens so the palette, fonts and logos rooms show what just landed, and the
  // Colours room opens on it.
  let installing = false;
  async function install(
    doc: Record<string, unknown>,
    label: string,
    btn: HTMLButtonElement
  ): Promise<void> {
    if (installing) return;
    installing = true;
    btn.disabled = true;
    const prevLabel = btn.textContent;
    btn.textContent = t('Installing…');
    try {
      await checkpointBeforeInstall();
      // A doc with no font group inherits the fonts already installed here, so an
      // import never silently undoes a chosen face.
      const withFonts = await carryUserFontTokens(host as unknown as UserFontsHost, doc);
      await installUserTokens(host, withFonts, { label });
      void applyChromeBrandVars(host); // bust() cleared caches; nothing repaints chrome by itself
      await editor?.reload();
      await refreshHead(); // the head moved - the tokens export follows it
      markWelcomeDismissed();
      installing = false;
      // The user may have navigated away while the install ran - the tokens
      // landed either way, but only a still-mounted view touches its own DOM
      // (or the URL: selectRoom replaceStates, which would rewrite the NEW view's).
      if (!shell.isConnected) return;
      closeImport();
      importResult.hidden = true;
      btn.disabled = false;
      btn.textContent = prevLabel;
      selectRoom('color');
      announce(tRaw('{label} installed - the studio now shows it', { label }));
      playSfx('saveProfile');
    } catch (err) {
      installing = false;
      btn.disabled = false;
      btn.textContent = prevLabel;
      showImportError(
        tRaw('Couldn’t install the brand: {error}', {
          error: String((err as { message?: unknown })?.message ?? err),
        })
      );
    }
  }

  // ── Import path - a raw tokens JSON (W3C DTCG / Tokens Studio) or a .zip pack ─
  // `openImport()` reparents this panel into a body-mounted dialog. A routed
  // arrival such as Profile -> "Load .lolly or another file" opens that dialog
  // before the wiring below runs, so `viewEl.querySelector(...)` is already the
  // wrong owner at this point. Keep every file-stage lookup rooted in the stable
  // panel reference: it survives both opening and closing the modal.
  const importFile = importPanel.querySelector<HTMLInputElement>('.start-import-file')!;
  let importedDoc: Record<string, unknown> | null = null;
  // The token-less Penpot path's census, held between the proposal card render
  // and its "Make this the look" click (same lifecycle as importedDoc).
  let pendingUsage: PenpotUsage | null = null;
  // The semantic mapping review's proposal and the primary chosen in the card -
  // same lifecycle again, cleared at the top of every handleImportFile.
  let pendingRoles: TokenRoleProposal | null = null;
  let roleChoice: string | null = null;
  // The card's pool of colour tokens, same lifecycle again. The ranking, the
  // chooser's cap and what follows a pick are all pure and live with the rest of
  // the mapping model in lib/design-system/sources/file.ts; this view holds the
  // state and paints it.
  let pendingTokens: ColorTokenRow[] = [];
  /** Surface and text for the primary chosen right now (sources/file.ts owns the
   *  rule; this binds it to the card's held state). */
  const followsFor = (primaryPath: string): Record<'surface' | 'text', RoleFollow> =>
    followRoles(primaryPath, pendingTokens, pendingRoles);
  // The SVG path's scanned colours, so "Keep these for later" can hand the same
  // list to the tray that the checkbox grid is showing.
  let pendingSvgColors: string[] = [];
  let importedLabel = t('My brand');

  // Shared "N sets · N themes · N tokens, N colours" blurb - every doc-shaped
  // import path (JSON tokens, Penpot tokens) shows the same stats before the
  // user commits.
  function statLineFor(doc: Record<string, unknown>): string {
    try {
      const s = summarizeTokensDoc(doc);
      return [
        s.sets.length
          ? t(s.sets.length === 1 ? '{n} set' : '{n} sets', { n: s.sets.length })
          : null,
        s.themes.length
          ? t(s.themes.length === 1 ? '{n} theme' : '{n} themes', { n: s.themes.length })
          : null,
        t(s.tokenCount === 1 ? '{n} token' : '{n} tokens', { n: s.tokenCount }),
        t(s.colorCount === 1 ? '{n} colour' : '{n} colours', { n: s.colorCount }),
      ]
        .filter(Boolean)
        .join(' · ');
    } catch {
      return '';
    } // stats are decorative - the install button still stands
  }

  /** Why a file could not be routed, in this view's own words. The router reports
   *  machine reasons precisely so the copy lives here (lib/design-system/sources/file.ts). */
  function refusalText(
    route: Extract<DesignFileRoute, { kind: 'refused' }>,
    filename: string
  ): string {
    switch (route.reason) {
      case 'too-large':
        return tRaw('{filename} is too large (max {n} MB).', {
          filename,
          n: Math.round((route.limit ?? 0) / (1024 * 1024)),
        });
      case 'unreadable-zip':
        // The bomb guard's own sentence is user-facing; fflate's ("invalid zip
        // data") is not, so it rides as the reason rather than standing alone.
        return route.detail
          ? tRaw('{filename} could not be unzipped: {reason}', { filename, reason: route.detail })
          : tRaw('{filename} could not be unzipped.', { filename });
      case 'unknown-zip':
        return tRaw(
          '{filename} isn’t a design system pack, a Penpot export or a zip of token set files.',
          { filename }
        );
      case 'not-json':
        return tRaw('Couldn’t read {filename} - is it valid JSON?', { filename });
      default:
        return tRaw('No tokens found: {reason}.', {
          reason: route.detail ?? t('unrecognised document'),
        });
    }
  }

  /** What produced a document, as a phrase rather than an id. The JSON path used
   *  to print the raw extraction source ('dtcg'), which said nothing to anyone who
   *  had not read the engine. */
  const SOURCE_LABEL: Record<TokensExtraction['source'], () => string> = {
    dtcg: () => t('design tokens'),
    'tokens-studio': () => t('tokens studio'),
    'token-set-files': () => t('token set files'),
    'penpot-project': () => t('penpot tokens'),
  };

  // extractSvgColors can return a bare named colour ("rebeccapurple") verbatim
  // - deriveBrandTokens's parser only understands hex/rgb()/hsl()/oklch()/lch(),
  // NOT bare names, and throws on anything else. The browser itself is the one
  // dependency-free place that resolves every CSS colour name it recognises
  // (not just a hand-copied subset), so ask it via a detached element rather
  // than hand-rolling a second named-colour table here.
  function toHexForDerive(value: string): string | null {
    if (value.startsWith('#')) return value;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;left:-9999px;top:-9999px;';
    probe.style.color = value;
    if (!probe.style.color) return null; // the browser didn't recognise it
    document.body.appendChild(probe);
    const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(probe).color);
    probe.remove();
    if (!rgb) return null;
    const hex = (n: string): string => Number(n).toString(16).padStart(2, '0');
    return `#${hex(rgb[1]!)}${hex(rgb[2]!)}${hex(rgb[3]!)}`;
  }

  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    importFile.value = ''; // so re-picking the same file re-fires change
    if (file) await handleImportFile(file);
  });

  // Drag & drop lands on the same routing as the picker - the card is one
  // control with two mouths.
  const dropEl = importPanel.querySelector<HTMLElement>('[data-start-import-drop]')!;
  dropEl.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    dropEl.classList.add('is-dragover');
  });
  dropEl.addEventListener('dragleave', (e) => {
    if (e.relatedTarget && dropEl.contains(e.relatedTarget as Node)) return;
    dropEl.classList.remove('is-dragover');
  });
  dropEl.addEventListener('drop', (e) => {
    e.preventDefault();
    // The shell's own drag-anywhere drop listener is an ANCESTOR of this card -
    // without this the same file would be handled twice.
    e.stopPropagation();
    dropEl.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    // The SAME router the drag-anywhere drop uses. The card advertises design
    // files, but a photo or a font lands on it constantly (it is the biggest
    // drop target on the page), and parsing one as JSON to refuse it with "is it
    // valid JSON?" is a worse answer than the image scan or the Type hand-off
    // the identical file gets one pixel outside this card.
    if (file) void routeDroppedFile(file);
  });

  /**
   * One picked/dropped design file, routed by what it turns out to BE.
   *
   * The sniffing, the size caps and the three zip shapes live in
   * lib/design-system/sources/file.ts, which is pure and covered; this function
   * owns the copy, the cards and the install - the split plan 97 section 8 asks for.
   * The size cap is checked from `File.size` first so a mispicked multi-GB file
   * is refused before a byte of it is read (the router re-checks what it is
   * handed, because a cap enforced at one of two call sites will be skipped).
   */
  async function handleImportFile(file: File): Promise<void> {
    importedDoc = null;
    pendingUsage = null;
    pendingRoles = null;
    roleChoice = null;
    pendingTokens = [];
    pendingSvgColors = [];

    // `.lolly` is a container family, not a design-system synonym. Hand it to
    // the manifest-first intake even here: this context recommends "Add its
    // design system", while a shared session still retains its honest "Open
    // shared design" route. Close this modal first so the preflight is the one
    // active dialog rather than a second sheet stacked on top of it.
    if (/\.lolly$/i.test(file.name) || file.type === 'application/vnd.lolly+zip') {
      closeImport();
      await openLollyFile(file, host as unknown as Parameters<typeof openLollyFile>[1], {
        preferred: 'design-system',
      });
      return;
    }

    const limit = designFileLimit(file.name, file.type);
    if (file.size > limit) {
      showImportError(
        tRaw('{filename} is too large (max {n} MB).', {
          filename: file.name,
          n: Math.round(limit / (1024 * 1024)),
        })
      );
      return;
    }
    let fileRoute: DesignFileRoute;
    try {
      fileRoute = await routeDesignFile(file.name, new Uint8Array(await file.arrayBuffer()), {
        type: file.type,
      });
    } catch (err) {
      showImportError(String((err as { message?: unknown })?.message ?? err));
      return;
    }

    if (fileRoute.kind === 'refused') {
      showImportError(refusalText(fileRoute, file.name));
      return;
    }

    // SVG has no formal-token concept - every colour it uses is "not a token",
    // so scan for what's actually there and let the user pick which to keep
    // (see the checkbox review below) rather than treating every incidental
    // fill as part of the design system.
    if (fileRoute.kind === 'svg') {
      let svgColors: string[] = [];
      try {
        svgColors = extractSvgColors(await file.text());
      } catch {
        showImportError(tRaw('Couldn’t read {filename} as SVG.', { filename: file.name }));
        return;
      }
      if (!svgColors.length) {
        showImportError(tRaw('No colours found in {filename}.', { filename: file.name }));
        return;
      }
      importedLabel = fileRoute.label || t('My brand');
      pendingSvgColors = svgColors;
      showImportResult(
        `
        <p class="start-import-name">${escape(file.name)}<span class="start-import-source">${t('colours in use')}</span></p>
        <p class="start-import-warn">${t(
          svgColors.length === 1
            ? 'Found {n} colour - none are linked to a design token, so review and drop any you don’t want. The first one kept becomes your main brand colour.'
            : 'Found {n} colours - none are linked to a design token, so review and drop any you don’t want. The first one kept becomes your main brand colour.',
          { n: svgColors.length }
        )}</p>
        <div class="start-color-actions">
          <button type="button" class="be-btn be-btn--sm" data-colors-all>${t('Select all')}</button>
          <button type="button" class="be-btn be-btn--sm" data-colors-none>${t('Select none')}</button>
        </div>
        <ul class="start-color-grid" role="list">
          ${svgColors
            .map(
              (hex, i) => `
            <li class="start-color-chip">
              <label>
                <input type="checkbox" data-color-idx="${i}" checked>
                <span class="start-color-swatch" style="background:${escape(hex)}" aria-hidden="true"></span>
                <span class="start-color-hex">${escape(hex)}</span>
              </label>
            </li>`
            )
            .join('')}
        </ul>
        <div class="start-color-actions">
          <button type="button" class="be-cta start-cta--import" data-install-colors disabled>${t('Use these colours')}</button>
          <button type="button" class="be-btn be-btn--sm" data-colors-tray>${t('Keep these for later')}</button>
        </div>`,
        {
          say: tRaw(
            svgColors.length === 1
              ? '{n} colour found in {filename}. Review the selection below.'
              : '{n} colours found in {filename}. Review the selection below.',
            { n: svgColors.length, filename: file.name }
          ),
        }
      );
      // The colour-review path builds its doc lazily from whichever boxes are
      // still checked at click time (see data-install-colors below) rather
      // than from importedDoc/data-install-import.
      return;
    }

    // A Lolly design-system PACK: tokens + fonts + a theme preference, installed
    // in one step - no preview leg, because the pack carries its own integrity
    // map and the importer verifies it (brand-transfer.ts).
    if (fileRoute.kind === 'pack') {
      if (!editor) {
        showImportError(t('The brand editor didn’t open - reload the page and try again.'));
        return;
      }
      showImportResult(
        `<p class="start-import-stats">${t('Loading {filename}…', { filename: file.name })}</p>`,
        { say: tRaw('Loading {filename}…', { filename: file.name }) }
      );
      try {
        await checkpointBeforeInstall();
        // routeDesignFile already inflated this bounded archive. Hand those
        // exact parts to the integrity-verifying importer instead of reading
        // and inflating the File a second time.
        await editor.importPack(fileRoute.files);
        // The pack carries its own theme preference (prefs.json → localStorage);
        // apply it, same as the old wizard's pack path did.
        applyTheme(localStorage.getItem('theme') || 'light');
        markWelcomeDismissed();
        void refreshHead();
        if (!shell.isConnected) return;
        closeImport();
        importResult.hidden = true;
        selectRoom('color');
        playSfx('saveProfile');
      } catch (err) {
        showImportError(String((err as { message?: unknown })?.message ?? err));
      }
      return;
    }

    // A Penpot project export: its FORMAL design tokens when it declares any -
    // Penpot shape/layer fills that aren't tied to a token are out of scope here,
    // the same "prefer tokens" stance as the SVG path's opposite case - and the
    // look it actually paints with when it declares none.
    if (fileRoute.kind === 'penpot') {
      const files = fileRoute.files;
      const { doc, warnings } = extractPenpotProject(files);
      if (!doc) {
        // No formal tokens - the common case. Scan what the file actually
        // USES (every paint source, gradients, fonts) and propose the look
        // as brand roles instead of dead-ending.
        const usage = scanPenpotUsage(files);
        const roles = proposeBrandRoles(usage);
        if (!roles) {
          showImportError(
            tRaw(
              warnings[0]
                ? 'No design tokens found in {filename} - {warning}. Try exporting an SVG instead so we can read its colours.'
                : 'No design tokens found in {filename}. Try exporting an SVG instead so we can read its colours.',
              { filename: file.name, warning: warnings[0] ?? '' }
            )
          );
          return;
        }
        pendingUsage = usage;
        importedLabel = fileRoute.label || t('My brand');
        const fonts = proposeFonts(usage);
        const gradN = usage.gradients.length;
        const statBits = [
          t(usage.colors.length === 1 ? '{n} colour' : '{n} colours', { n: usage.colors.length }),
          gradN ? t(gradN === 1 ? '{n} gradient' : '{n} gradients', { n: gradN }) : null,
          usage.fonts.length
            ? t(usage.fonts.length === 1 ? '{n} font' : '{n} fonts', { n: usage.fonts.length })
            : null,
        ]
          .filter(Boolean)
          .join(' · ');
        const roleChips: Array<[string, string]> = [
          [t('Primary'), roles.primary],
          ...(roles.secondary ? [[t('Secondary'), roles.secondary] as [string, string]] : []),
          [t('Surface'), roles.surface],
          [t('Text'), roles.text],
        ];
        const fontLines = [
          fonts.google.length
            ? `<p class="start-import-stats">${escape(tRaw('Fonts: {list}', { list: fonts.google.join(', ') }))}</p>`
            : '',
          fonts.missing.length
            ? `<p class="start-import-warn">${escape(
                tRaw(
                  fonts.missing.length === 1
                    ? '{list} has no downloadable source, so it stays as a name only.'
                    : '{list} have no downloadable source, so they stay as names only.',
                  { list: fonts.missing.join(', ') }
                )
              )}</p>`
            : '',
        ].join('');
        showImportResult(
          `
          <p class="start-import-name">${escape(file.name)}<span class="start-import-source">${t('look in use')}</span></p>
          ${statBits ? `<p class="start-import-stats">${escape(statBits)}</p>` : ''}
          <p class="start-import-warn">${t('This file declares no design tokens, so this is the look it actually uses.')}</p>
          <ul class="start-color-grid start-look-roles" role="list">
            ${roleChips
              .map(
                ([label, hex]) => `
              <li class="start-color-chip">
                <span class="start-color-swatch" style="background:${escape(hex)}" aria-hidden="true"></span>
                <span class="start-color-hex">${escape(hex)}</span>
                <span class="start-color-role">${escape(label)}</span>
              </li>`
              )
              .join('')}
          </ul>
          ${
            roles.extras.length
              ? `
            <p class="start-import-stats">${t('Keep any of the other colours as swatches:')}</p>
            <ul class="start-color-grid" role="list">
              ${roles.extras
                .map(
                  (hex, i) => `
                <li class="start-color-chip">
                  <label>
                    <input type="checkbox" data-color-idx="${i}" checked>
                    <span class="start-color-swatch" style="background:${escape(hex)}" aria-hidden="true"></span>
                    <span class="start-color-hex">${escape(hex)}</span>
                  </label>
                </li>`
                )
                .join('')}
            </ul>`
              : ''
          }
          ${fontLines}
          ${
            gradN
              ? `<p class="start-import-stats">${escape(
                  t(
                    gradN === 1
                      ? 'Its gradient becomes a brand token.'
                      : 'The top gradients become brand tokens.'
                  )
                )}</p>`
              : ''
          }
          <button type="button" class="be-cta start-cta--import" data-install-look>${t('Make this look your brand')}</button>`,
          { say: cardSay(file.name, statBits) }
        );
        return;
      }
      // The file declares tokens, so those ARE the design system - but a doc
      // alone never says which token is the primary. Read how the designer
      // applied them (and, for an older export that carries no applied
      // references, what the file paints) so the install can also write the
      // semantic roles as aliases to their own tokens. No usable colour tokens
      // → the doc installs exactly as it does today.
      importedLabel = fileRoute.label || t('My brand');
      const appliedTokens = scanPenpotAppliedTokens(files);
      const roles = proposeRolesFromTokens(doc, appliedTokens, scanPenpotUsage(files));
      importedDoc = roles ? withRoleAliases(doc, roles.refs) : doc;
      const statLine = statLineFor(doc);
      const tokenFonts = roles ? proposeFontsFromTokens(doc, appliedTokens) : null;
      const roleChips: Array<[string, string, string | undefined]> = roles
        ? [
            [t('Primary'), roles.primary, roles.refs.primary],
            ...(roles.secondary
              ? [
                  [t('Secondary'), roles.secondary, roles.refs.secondary] as [
                    string,
                    string,
                    string | undefined,
                  ],
                ]
              : []),
            [t('Surface'), roles.surface, roles.refs.surface],
            [t('Text'), roles.text, roles.refs.text],
          ]
        : [];
      showImportResult(
        `
        <p class="start-import-name">${escape(file.name)}<span class="start-import-source">${t('penpot tokens')}</span></p>
        ${statLine ? `<p class="start-import-stats">${escape(statLine)}</p>` : ''}
        ${warnings.length ? `<p class="start-import-warn">${escape(warnings.join(' · '))}</p>` : ''}
        ${
          roles
            ? `
          <p class="start-import-stats">${t('These are the tokens the file declares. Roles below follow how the designer applied them.')}</p>
          <ul class="start-color-grid start-look-roles" role="list">
            ${roleChips
              .map(
                ([label, hex, ref]) => `
              <li class="start-color-chip">
                <span class="start-color-swatch" style="background:${escape(hex)}" aria-hidden="true"></span>
                <span class="start-color-hex">${escape(ref ?? hex)}</span>
                <span class="start-color-role">${escape(label)}</span>
              </li>`
              )
              .join('')}
          </ul>`
            : ''
        }
        ${tokenFonts?.missing.length ? `<p class="start-import-stats">${escape(tRaw('Type: {list}', { list: tokenFonts.missing.slice(0, 4).join(', ') }))}</p>` : ''}
        <button type="button" class="be-cta start-cta--import" data-install-import>${t('Install these tokens')}</button>`,
        { say: cardSay(file.name, statLine) }
      );
      return;
    }

    // A token DOCUMENT: a DTCG/Tokens-Studio JSON, or a zip of loose token-set
    // files (the shape assembleTokenSetFiles has always read for the CLI and the
    // web could never open - the router assembles it, so both paths land here).
    const { doc, warnings, source } = fileRoute.extraction;
    if (!doc) {
      // the router only returns `tokens` with a doc; belt and braces
      showImportError(
        tRaw('No tokens found: {reason}.', { reason: warnings[0] ?? t('unrecognised document') })
      );
      return;
    }
    importedDoc = doc;
    importedLabel = fileRoute.label || t('My brand');
    const statLine = statLineFor(doc);
    // Built before the call, not inside it: `mappingReviewHtml` is what decides
    // whether there is a question on this card (it sets `pendingRoles`), and the
    // announcement has to carry that question - it is the one thing the card
    // asks for and the only reason the install button says something different.
    const html = `
      <p class="start-import-name">${escape(file.name)}<span class="start-import-source">${escape(SOURCE_LABEL[source]())}</span></p>
      ${statLine ? `<p class="start-import-stats">${escape(statLine)}</p>` : ''}
      ${warnings.length ? `<p class="start-import-warn">${escape(warnings.join(' · '))}</p>` : ''}
      ${mappingReviewHtml(doc)}
      <div class="start-color-actions">
        <button type="button" class="be-cta start-cta--import" data-install-import>${
          pendingRoles ? t('Install with these roles') : t('Install these tokens')
        }</button>
        ${pendingRoles ? `<button type="button" class="be-btn be-btn--sm" data-install-plain>${t('Install without roles')}</button>` : ''}
        <button type="button" class="be-btn be-btn--sm" data-tokens-tray>${t('Review first')}</button>
      </div>`;
    showImportResult(html, {
      say: cardSay(file.name, statLine, pendingRoles ? t('Which one is the primary?') : ''),
    });
  }

  /** What a result card says out loud: the file, what was found in it, and the
   *  one question it asks, if it asks one. The card itself carries the detail -
   *  focus lands there, so this is the headline and not a transcript. */
  function cardSay(filename: string, statLine: string, question = ''): string {
    const head = statLine ? tRaw('{filename}: {stats}', { filename, stats: statLine }) : filename;
    return question ? `${head} ${question}` : head;
  }

  /**
   * The semantic mapping review (plan 97 section 8) - the card that stops an import
   * landing a full palette with every `--brand-*` var still dark.
   *
   * It renders only for the case it is about: a document that resolves colour
   * tokens and NONE of `color.semantic.{primary,surface,text}`. A doc that
   * already carries roles, or carries no colours at all, never sees it and
   * installs byte-identically to before. One decision, not four: which token is
   * the primary; surface and text FOLLOW it and are shown read-only, because a
   * card asking four questions is a form.
   *
   * "Follow" is literal - see `followsFor`. They are recomputed on every pick
   * and the read-only pair repaints, because the alternative is a card that
   * promises a consequence and installs a different one.
   *
   * Returns markup for the existing result sink - nothing here is a new one.
   */
  function mappingReviewHtml(doc: Record<string, unknown>): string {
    if (!docNeedsMappingReview(doc)) return '';
    // proposeRolesFromTokens with no census at all is the "no weights anywhere"
    // branch, and it is the only proposer that returns the declared token PATHS
    // withRoleAliases needs to write an alias rather than a literal.
    const proposal = proposeRolesFromTokens(doc, [], null);
    if (!proposal?.refs.primary) return '';
    pendingRoles = proposal;
    roleChoice = proposal.refs.primary;
    pendingTokens = colorTokenRows(doc);
    const choices = chooserRows(pendingTokens, roleChoice);
    const follows = followsFor(roleChoice);
    return `
      <div class="ds-roles-card">
        <p class="ds-roles-q">${t('Which one is the primary?')}</p>
        <p class="start-import-warn">${t('This document declares colours but no roles, so nothing would pick up its main colour without one.')}</p>
        <ul class="ds-roles-choices" role="list">
          ${choices
            .map(
              (c) => `
            <li>
              <button type="button" class="ds-roles-chip" data-role-pick="${escape(c.path)}"
                aria-pressed="${c.path === roleChoice ? 'true' : 'false'}">
                <span class="start-color-swatch" style="background:${escape(c.hex)}" aria-hidden="true"></span>
                <span class="start-color-hex">${escape(c.path)}</span>
              </button>
            </li>`
            )
            .join('')}
        </ul>
        <p class="start-import-stats">${t('Surface and text follow from it.')}</p>
        <ul class="start-color-grid start-look-roles" role="list">
          ${(['surface', 'text'] as const)
            .map(
              (role) => `
            <li class="start-color-chip" data-ds-follow="${role}">
              <span class="start-color-swatch" style="background:${escape(follows[role].hex)}" aria-hidden="true"></span>
              <span class="start-color-hex">${escape(follows[role].ref ?? follows[role].hex)}</span>
              <span class="start-color-role">${escape(role === 'surface' ? t('Surface') : t('Text'))}</span>
            </li>`
            )
            .join('')}
        </ul>
      </div>`;
  }

  // Colour-review checkboxes (the SVG path): select all/none, enable "Use
  // these colours" only while at least one is checked, and build the doc from
  // whatever's checked at click time.
  // Both actions on that card act on the SELECTION, so both follow it.
  const syncColorActions = (anyChecked: boolean): void => {
    const installBtn = importResult.querySelector<HTMLButtonElement>('[data-install-colors]');
    const trayBtn = importResult.querySelector<HTMLButtonElement>('[data-colors-tray]');
    if (installBtn) installBtn.disabled = !anyChecked;
    if (trayBtn) trayBtn.disabled = !anyChecked;
  };
  importResult.addEventListener('input', (e) => {
    if (!(e.target as HTMLElement).matches('[data-color-idx]')) return;
    syncColorActions(!!importResult.querySelector('[data-color-idx]:checked'));
  });
  importResult.addEventListener('click', (e) => {
    const all = (e.target as HTMLElement).closest('[data-colors-all]');
    const none = (e.target as HTMLElement).closest('[data-colors-none]');
    if (!all && !none) return;
    importResult.querySelectorAll<HTMLInputElement>('[data-color-idx]').forEach((cb) => {
      cb.checked = !!all;
    });
    syncColorActions(!!all);
  });

  // Delegated: the install button is re-created with every result render.
  importResult.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // The mapping card's chooser: one decision, so picking a chip moves the
    // pressed state and repaints what the card says follows from it. Nothing
    // installs until the button below is pressed. Repainted in place rather than
    // re-rendered - two swatches and two labels, and the card has no second sink.
    const pick = target.closest<HTMLElement>('[data-role-pick]')?.dataset.rolePick;
    if (pick) {
      roleChoice = pick;
      importResult.querySelectorAll<HTMLElement>('[data-role-pick]').forEach((chip) => {
        chip.setAttribute('aria-pressed', String(chip.dataset.rolePick === pick));
      });
      const follows = followsFor(pick);
      for (const role of ['surface', 'text'] as const) {
        const li = importResult.querySelector<HTMLElement>(`[data-ds-follow="${role}"]`);
        const sw = li?.querySelector<HTMLElement>('.start-color-swatch');
        const label = li?.querySelector<HTMLElement>('.start-color-hex');
        if (sw) sw.style.background = follows[role].hex;
        if (label) label.textContent = follows[role].ref ?? follows[role].hex;
      }
      return;
    }

    const importBtnEl = target.closest<HTMLButtonElement>('[data-install-import]');
    if (importBtnEl && importedDoc) {
      // With a proposal on the card, the chosen roles are folded into the doc
      // that installs - ONE install, aliases not literals, so editing the token
      // later still moves the role with it. Surface and text come from the SAME
      // followsFor the card painted, so what installs is what it showed; a
      // secondary that collides with the chosen primary is dropped rather than
      // written as a second alias to one token.
      const follows = roleChoice ? followsFor(roleChoice) : null;
      const doc =
        pendingRoles && roleChoice && follows
          ? applyMappingChoice(importedDoc, {
              primary: roleChoice,
              secondary:
                pendingRoles.refs.secondary === roleChoice
                  ? undefined
                  : pendingRoles.refs.secondary,
              surface: follows.surface.ref,
              text: follows.text.ref,
            })
          : importedDoc;
      void install(doc, importedLabel, importBtnEl);
      return;
    }

    // Skip is EXACTLY today's behaviour: the raw document installs, no roles
    // written, nothing else different.
    const plainBtn = target.closest<HTMLButtonElement>('[data-install-plain]');
    if (plainBtn && importedDoc) {
      void install(importedDoc, importedLabel, plainBtn);
      return;
    }

    // "Review first" (plan 97 section 8): the document decomposes into candidates
    // instead of installing, so it can be shopped one at a time. Nothing is
    // written by pressing it.
    if (target.closest('[data-tokens-tray]') && importedDoc) {
      void (async () => {
        // The rail note, not the dialog's: the modal closes on the way out, and a
        // message that leaves with it was never read.
        await keepInTray(censusFromTokensDoc(importedDoc, importedLabel), showNote);
        closeImport();
      })();
      return;
    }

    // The SVG path's second door: keep the scanned colours as candidates rather
    // than deriving a whole design system from them right now.
    if (target.closest('[data-colors-tray]') && pendingSvgColors.length) {
      const kept: string[] = [];
      importResult.querySelectorAll<HTMLElement>('.start-color-chip').forEach((li) => {
        const cb = li.querySelector<HTMLInputElement>('[data-color-idx]');
        const hex = li.querySelector<HTMLElement>('.start-color-hex')?.textContent;
        if (cb?.checked && hex) kept.push(hex);
      });
      if (!kept.length) return; // the button follows the selection (syncColorActions)
      void (async () => {
        await keepInTray(censusFromSvgColors(kept, importedLabel), showNote);
        closeImport();
      })();
      return;
    }

    const colorsBtn = target.closest<HTMLButtonElement>('[data-install-colors]');
    if (!colorsBtn) return;
    const swatches = importResult.querySelectorAll<HTMLElement>('.start-color-chip');
    const kept: string[] = [];
    swatches.forEach((li) => {
      const cb = li.querySelector<HTMLInputElement>('[data-color-idx]');
      const raw = li.querySelector<HTMLElement>('.start-color-hex')?.textContent;
      const hex = raw && toHexForDerive(raw);
      if (cb?.checked && hex) kept.push(hex);
    });
    if (!kept.length) {
      showImportError(t('None of the kept colours could be used - try a different selection.'));
      return;
    }
    const doc = deriveBrandTokens({ primary: kept[0]!, name: importedLabel });
    kept
      .slice(1)
      .forEach((hex, i) => addSwatch(doc, 'custom', t('Extracted {n}', { n: i + 2 }), hex));
    void install(doc, importedLabel, colorsBtn);
  });

  // Delegated: the usage-proposal CTA (the token-less Penpot path). Google
  // faces are fetched FIRST so the doc's font roles resolve on-device - but a
  // failed fetch is non-fatal, offline the tokens still name the family.
  importResult.addEventListener('click', async (e) => {
    const lookBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-install-look]');
    if (!lookBtn || !pendingUsage || lookBtn.disabled) return;
    const keepExtras: string[] = [];
    importResult.querySelectorAll<HTMLElement>('.start-color-chip').forEach((li) => {
      const cb = li.querySelector<HTMLInputElement>('[data-color-idx]');
      const hex = li.querySelector<HTMLElement>('.start-color-hex')?.textContent;
      if (cb?.checked && hex) keepExtras.push(hex);
    });
    lookBtn.disabled = true;
    const fonts = proposeFonts(pendingUsage);
    let landed = false;
    for (const family of fonts.google) {
      try {
        await installGoogleFont(host as unknown as UserFontsHost, family, { neverPrimary: true });
        landed = true;
      } catch {
        /* offline or blocked - the font token still points at the family */
      }
    }
    if (landed) bustFontRegistry();
    lookBtn.disabled = false;
    const { doc } = buildBrandDocFromUsage(pendingUsage, importedLabel, { keepExtras });
    void install(doc, importedLabel, lookBtn);
  });

  // ── Escape returns to the view the user came from - same target as the back
  //    pill (colour-popover Escapes stopPropagation at the field, so they never
  //    reach this) ──────────────────────────────────────────────────────────────
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || installing) return; // no Esc-teardown mid-install
    // The import dialog owns the key while it's open: the native <dialog> handles
    // Escape itself (its `cancel` event), but the keydown still bubbles up here -
    // without this guard one press would close the dialog AND leave the studio.
    if (importModal) return;
    // The Esc stack: floating popovers first (they close themselves and
    // stopImmediatePropagation before this handler - the query is a
    // belt-and-braces guard so the sheet never folds under a popover that
    // somehow let the key through), then an expanded palette sheet folds to
    // peek, then back to where the user came from.
    const popoverOpen = !!editorMount.querySelector(
      '[data-be-editor]:not([hidden]), [data-grad-pop]:not([hidden]), .color-picker-field:not(.color-field--inline) .color-popover:not([hidden])'
    );
    // The tray sits above the palette sheet in the stack, so it answers first:
    // on a phone it folds to peek, on a dock width it closes (it reports which
    // by returning true either way).
    if (!popoverOpen && trayUi?.collapse()) {
      e.preventDefault();
      syncTrayToggle();
      return;
    }
    if (!popoverOpen && paletteSheet?.collapse()) {
      e.preventDefault();
      return;
    }
    // An open compat disclosure in the Versions panel folds before the studio is
    // left. Esc only ever CANCELS here: no publish, activate or restore is ever
    // one keypress away, and the panel has no modal for it to dismiss.
    if (!popoverOpen && !versionsPanel.hidden && versions?.collapse()) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    navigateTo(backHref);
  };
  document.addEventListener('keydown', onKey);
  (viewEl as ViewElement)._cleanup = () => {
    document.removeEventListener('keydown', onKey);
    // A dialog outlives the view it was opened from (it's body-mounted), so leaving
    // the studio must take it with it.
    closeImport();
    unsubTray?.();
    unsubTray = null;
    unsubBeat?.();
    unsubBeat = null;
    trayUi?.teardown();
    trayUi = null;
    overview?.teardown();
    overview = null;
    versions?.teardown();
    versions = null;
    paletteSheet?.teardown();
    paletteSheet = null;
    editor?.teardown();
  };
}

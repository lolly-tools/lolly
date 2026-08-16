// SPDX-License-Identifier: MPL-2.0
/**
 * URL mode.
 *
 * Every tool's input state must be expressible as URL params. This module
 * handles the round-trip.
 *
 *   tooldomain.com/qr-codes/?url=https://example.com&theme=dark&format=png&export
 *
 * The CLI shell uses the SAME conversion - CLI is just URL mode under a
 * different transport. This guarantees CLI and GUI never drift.
 *
 * Reserved param names (not used as inputs):
 *   - `format` - output format (png/svg/pdf/...) used by export and copy
 *   - `export` - presence flag: trigger an immediate download on load
 *   - `copy` - presence flag: arm copy-to-clipboard on first interaction
 *   - `full` - presence flag: open in fullscreen (sidebar collapsed)
 *   - `options` - presence flag: open with the export-settings panel expanded
 *                  (web shell only; ignored by CLI). `full` wins if both are set.
 *   - `slot` - saved state slot to load
 *   - `template` - id of a manifest `templates[]` entry to direct-seed the tool
 *                  from on a fresh open, SKIPPING the "New from template" chooser
 *                  (for retired-id launchers, e.g. `?template=carousel`). The
 *                  entry's `values` are read in-process by the shell (never packed
 *                  into the URL). Unknown/absent id falls through to the normal
 *                  fresh-open flow. Web shell only; ignored by the CLI.
 *   - `output` - output filename (CLI only)
 *   - `filename` - download filename (web shell)
 *   - `_v` - tool version pinning (optional)
 *   - `width`/`w`, `height`/`h` - output dimensions (value in `unit`, default px)
 *   - `unit` - physical unit for width/height: px (default), mm, cm, in, pt
 *   - `dpi` - raster resolution for physical units (default 300; px → 96)
 *   - `profile` - colour profile: raster ICC ('srgb'/'none') or, for pdf-cmyk,
 *                  the press condition ('fogra39', 'swop', 'gracol', …)
 *   - `password` - open-password for the STANDARD (40-bit RC4) `pdf` lock only (a
 *                  basic lock, not strong encryption). Intentionally clear-text in
 *                  the URL - it exists so links can pre-set a password for quick,
 *                  short-lived transactional use; do not use it for confidential
 *                  material. The Strong (AES-256) tier is deliberately NOT a URL
 *                  param: its password is typed at export/open and never serialized.
 *   - `bleed` - bleed amount (dimension string, e.g. `3mm`) for the print
 *                  formats (`pdf`/`pdf-cmyk`/`cmyk-tiff`); ignored otherwise.
 *   - `marks` - print marks for the print formats: a CSV of `crop`, `reg`,
 *                  `bleed`, `bars`, `prov` drawn in the page/image margin.
 *   - `c2pa` - Content Credentials for stampable formats. `c2pa=7|30|90|365`
 *                  turns the credential on with that ephemeral-certificate
 *                  lifetime in days; `c2pa=1` (or empty) turns it on at the
 *                  default (30); `c2pa=off`/`0` forces it off, overriding a
 *                  tool's `render.c2pa` default. With an enrolled identity the
 *                  certificate window was fixed at enrolment and the lifetime
 *                  value is ignored.
 *   - `imprint` - Lolly pixel watermark for raster exports (`png`/`jpg`/`webp`/
 *                  `avif`/`tiff`). On by default, like `c2pa` - an imperceptible,
 *                  on-device DCT spread-spectrum mark that survives metadata
 *                  stripping and recompression (see engine/src/pixel-watermark.ts)
 *                  is embedded unless explicitly disabled. `imprint=0`/`off` turns
 *                  it off; absent/`1`/`on`/empty leaves it on. A durable provenance
 *                  signal COMPLEMENTING the C2PA credential, not a hardened one
 *                  (security-through-obscurity; the key is public).
 *   - `durable` - OPT-IN durable Content Credential for raster exports: a neural
 *                  TrustMark-format watermark carrying Lolly's identifier, so the
 *                  "made with Lolly" link survives a metadata strip and a
 *                  TrustMark-aware tool can recover it. Off by default (heavy
 *                  neural encode + a fetched model); `durable=1`/`on` turns it on.
 *                  See plans/28-durable-content-credentials.md.
 *   - `hdr` - OPT-IN HDR raster export for HDR-capable rasters (`png`/`jpg`).
 *                  `hdr=1`/`on`/`pq` encodes the output in Rec.2100 PQ (BT.2020 +
 *                  SMPTE ST 2084) with the brand's primary colours boosted toward
 *                  peak luminance, so white text and brand colours glow on HDR
 *                  displays while dark areas stay dark (see engine/src/hdr.ts). Off
 *                  by default; SDR otherwise.
 *   - `depth` - REQUESTED bits per channel for the export: `8`, `16`, `float`
 *                  or `auto` (the default). A *request*, never a promise: the
 *                  governing rule is DEPTH FOLLOWS PROVENANCE - a consumer emits
 *                  deep bits only where the pipeline actually produced them, so a
 *                  16-bit container over an 8-bit canvas render is padding and must
 *                  not be written. `auto` means "the deepest the provenance chain
 *                  supports", mirroring the gamut rule in docs/color-spaces.md.
 *                  Junk (`depth=32`, `depth=deep`, empty) degrades to `auto`
 *                  rather than erroring - same total-function discipline as
 *                  `cuts`/`unit`. See plans/61-deeprichpixels.md section 10.
 *   - `cuts` - CONTACT SHEET for a still export (`png`/`jpg`/`webp`/`svg`/`pdf`)
 *                  of a TIMED composition (a stage carrying `data-sequence`).
 *                  An integer, default `1`. `cuts=1` renders the frame at the
 *                  playhead - the WYSIWYG contract, byte-identical to no param at
 *                  all. `cuts=N` (N > 1) samples N stills at equal intervals across
 *                  the sequence: raster/SVG come back as N zipped files
 *                  (`<filename>-01.png` …), `pdf` as ONE document of N pages.
 *                  Sampling is MIDPOINT, not endpoint: `t_i = duration * (i + 0.5) / N`.
 *                  Endpoint sampling (`i/(N-1)`) would put frame 0 at t=0, where an
 *                  `enter` transition is still at alpha 0 (a blank card), and the last
 *                  frame at t=duration, where every clip has ended - so a 6-up sheet
 *                  would waste two frames on blanks. Midpoint puts every sample inside
 *                  a live span. Clamped to 1…64 (CUTS_MAX): a contact sheet is for
 *                  human review, and 64 is already an 8×8 wall - past that the sheet
 *                  is unreadable and the render/zip cost stops being worth it. Any
 *                  junk value (non-numeric, 0, negative, NaN, Infinity, 1e9) falls
 *                  back to 1 rather than erroring. Ignored for non-still formats and
 *                  for stages with no sequence. See plans/51-fable-timeline-editing.md section 4.6.
 *   - `lang` - UI/content language as a canonical short code (the full set
 *                  is engine/src/lang.ts's LANGS). Informal
 *                  aliases (`cn`, `jp`) are accepted on parse and normalized to
 *                  the canonical code; unrecognized values parse as null (falls
 *                  back to the profile/localStorage/browser-default chain). A
 *                  `lang` on a shared URL applies for that session only - it is
 *                  never written back to the recipient's saved profile.
 *   - `designv` - the DESIGN-SYSTEM VERSION this render resolves against: a
 *                  published version's slug, or `latest` for the edit head
 *                  (plans/97 section 6a). The top rung of the resolution ladder - it beats
 *                  a tool's `designVersion` manifest pin and the active version,
 *                  and a slug naming nothing this device holds falls through to the
 *                  next rung rather than failing the render. The author's testing
 *                  lever ("check against `latest`, fix, then publish"), which is why
 *                  serializeUrlState never writes it: a share link must not pin its
 *                  recipient to a version of a system that isn't theirs.
 *   - `present` - presence flag (web shell only): open a frame document's frames as
 *                  a fullscreen click-advanced DECK (design presentation mode,
 *                  plan 112). A frame doc opens the presenter; a non-frame TIMED doc
 *                  mounts normally and starts its sequence transport. The CLI
 *                  documents it as a no-op (CLI is URL mode under a different
 *                  transport, and there is no fullscreen to present into).
 *   - `s` - the STATE ADDRESS of a deck: `s=2` is the 1-based position in
 *                  presentation order, anything else (`s=slide1`, a ULID) is a frame
 *                  id, and an `.N` suffix (`s=2.3`) names a build step. With
 *                  `present` it deep-links that slide; without it the editor centres
 *                  that frame on mount. Read raw by the shell (the `template`
 *                  pattern) - its still-export meaning (`?s=2&format=png` = the one
 *                  slide) lives in the export fan-out, not in the typed UrlState.
 *                  (The signage flag `loop` is NOT reserved - see the RESERVED set
 *                  below for why - but travels alongside these as `?present&loop`.)
 *   - `z` - a PACKED whole-state token (raw DEFLATE + base64url) that carries
 *                  the entire query for complex tools whose readable form would blow
 *                  past practical URL limits. Expanded back into a plain query by
 *                  `expandQuery` (url-pack.js) at the load boundary, BEFORE this
 *                  parser runs, so parseUrlState never sees a live `z`. Listed here
 *                  only so a stray one is never mistaken for a tool input.
 *   - `zx` - an ENCRYPTED whole-state token: the same packed state, AES-256-GCM
 *                  encrypted under a password-derived key (PBKDF2). The password never
 *                  travels - the recipient types it, and the interactive load boundary
 *                  decrypts client-side (no server). Not expanded by `expandQuery`
 *                  (the headless embed path can't prompt), so parseUrlState only ever
 *                  ignores it. Listed here so a stray one is never a tool input.
 *
 * NOTE: this list, the RESERVED set below, and docs/url-mode.md must stay in
 * sync - tests/engine.test.js asserts the RESERVED set against an inline copy.
 *
 * Compact URL encoding (opt-in per tool via tool.json):
 *   - Inputs can declare a short `urlKey` alias (e.g. "textColor" → "tc")
 *   - Block fields can declare a short `urlKey` too
 *   - Color params are stored without the leading `#` (6-char hex)
 *   - Block arrays use a compact tilde-delimited format instead of JSON:
 *       label,value,color~label2,value2,color2~...
 *     Values are encodeURIComponent'd; colors omit the `#` prefix.
 *   - Table inputs are ALWAYS one compact param (not opt-in): the header row
 *     then one tilde segment per data row, cells comma-separated and
 *     encodeURIComponent'd (see encodeTableCompact). JSON accepted on parse.
 *   - Default values are omitted from the URL entirely
 *   Both old long-form and new short-form URLs are accepted on parse.
 *
 * Vector inputs: each field is its own flat param "<inputId>.<fieldId>", e.g.
 *   ?transform.zoom=200&transform.x=30&transform.y=70
 * (one readable value per param; no single-param form).
 */

import { isUnit } from './units.ts';
import type { Unit } from './units.ts';
import { isTokenValue, isAlias } from './tokens.ts';
import { isToolUrl } from './tool-url.ts';
import { assetIdForUrl, blocksForUrl } from './bake.ts';
import { normalizeLang } from './lang.ts';
import type { Lang } from './lang.ts';
import { normalizeTableValue } from './inputs.ts';
import type { BlockFieldSpec, InputManifest, InputSpec, InputValue, TableValue } from './inputs.ts';
import type { PrintMarksFlags } from './print-marks.ts';
import type { AssetRef } from './bridge/host-v1.ts';

/** Content Credentials toggle parsed from the `c2pa` param. */
export interface C2paSetting {
  on: boolean;
  days: number | null;
}

/** HDR export tuning (the `hdr` param's optional compact form). `reach`, `lift`,
 *  `richness` are 0–100 author dials; `peakNits` is the white/peak ceiling. See
 *  hdr.ts for how a shell maps reach→knee, lift→boostFloor, richness→richness. */
export interface HdrSettings {
  /** White/peak luminance ceiling, nits (how bright the brightest get). */
  peakNits: number;
  /** 0–100: how far DOWN the lightness range the glow reaches (higher = more colours glow). */
  reach: number;
  /** 0–100: how much dark colours are lifted (0 = darks stay dark for contrast). */
  lift: number;
  /** 0–100: colour-richness/saturation focus of the boost. */
  richness: number;
}

/** Default HDR dials - match the engine's hdrBoostToPQ defaults (knee 0.32–0.55,
 *  boostFloor 0, richness 0.4, peak 1000). `hdr=1` selects these. */
export const HDR_DEFAULTS: HdrSettings = { peakNits: 1000, reach: 45, lift: 0, richness: 40 };

/** Requested export bit depth (the `depth` param). `8`/`16` are bits per channel,
 *  `'float'` is floating-point samples (EXR/`.hdr`/float TIFF), `'auto'` (the
 *  default) means "the deepest the provenance chain supports".
 *
 *  A REQUEST, not a promise. Consumers apply the depth-follows-provenance rule
 *  from plans/61-deeprichpixels.md section 10: never emit bits the pipeline did not
 *  produce - a 16-bit file made from an 8-bit render is padding. */
export type DepthSetting = 8 | 16 | 'float' | 'auto';

/** Accepted `depth` values, in the spelling the param takes. A Map, not an object
 *  literal - a plain-object whitelist answers truthily for inherited keys
 *  (`WHITELIST['constructor']`), and this one is indexed by untrusted URL text. */
const DEPTH_VALUES = new Map<string, DepthSetting>([['8', 8], ['16', 16], ['float', 'float'], ['auto', 'auto']]);

/** Parsed URL state: input values plus the reserved export/render controls. */
export interface UrlState {
  values: Record<string, InputValue>;
  format: string | null;
  export: boolean;
  copy: boolean;
  slot: string | null;
  filename: string | null;
  version: string | null;
  width: number | null;
  height: number | null;
  unit: Unit | null;
  dpi: number | null;
  profile: string | null;
  password: string | null;
  bleed: string | null;
  marks: PrintMarksFlags | null;
  c2pa: C2paSetting | null;
  /** Pixel-watermark setting (the `imprint` param). null ⇒ absent - caller
   *  applies the default-on behaviour; false ⇒ explicit `imprint=0` opt-out;
   *  true ⇒ explicit opt-in (redundant with the default, kept for back-compat
   *  with existing `imprint=1`/`on` links). */
  imprint: boolean | null;
  /** Durable Content Credential toggle (the `durable` param) - an opt-in neural
   *  TrustMark-format watermark carrying Lolly's id (raster only). Off by default,
   *  so unlike `imprint` there is no null/absent distinction: true only for an
   *  explicit `durable=1`/`on`. See the header + plans/28-durable-content-credentials.md. */
  durable: boolean;
  /** Generator-metadata toggle (the `meta` param), default-on like `imprint`: whether a
   *  generated export carries its source-attribution generator field (EPS %%Creator, DXF
   *  999 comment, EXR/Radiance software, PDF Producer). `null` ⇒ absent (default on);
   *  `false` ⇒ explicit `meta=off` (a metadata-stripped export). Not about the user's own
   *  files - those go through the transform path, which never adds metadata. */
  metadata: boolean | null;
  /** OPT-IN HDR raster export (the `hdr` param). An HdrSettings object ⇒ Rec.2100
   *  PQ encoding with brand-colour luminance boost (raster only), carrying the
   *  author's tuning dials; null ⇒ absent/off ⇒ SDR. `hdr=1` ⇒ HDR_DEFAULTS. */
  hdr: HdrSettings | null;
  /** REQUESTED export bit depth (the `depth` param). Always one of 8 / 16 /
   *  'float' / 'auto'; absent or unrecognized ⇒ 'auto' (the default), so there is
   *  no null case to handle. Consumers must apply depth-follows-provenance - see
   *  DepthSetting and the header. */
  depth: DepthSetting;
  /** Contact-sheet frame count for a still export of a timed composition (the
   *  `cuts` param). Always a whole number in 1…CUTS_MAX; 1 (the default) means the
   *  single playhead frame - the WYSIWYG contract. See the header for the midpoint
   *  sampling rule. */
  cuts: number;
  /** UI/content language (the `lang` param), alias-normalized. null ⇒ absent or
   *  unrecognized - caller falls back to profile/localStorage/browser default. */
  lang: Lang | null;
  /** Design-system version override (the `designv` param): a published version's
   *  slug, `latest` for the edit head, or null when absent. Carried verbatim - the
   *  ladder in engine/src/design-version.ts decides what it resolves to, since only
   *  the caller knows which versions this device holds. See the header. */
  designVersion: string | null;
}

/** The slice of an input model item serializeUrlState reads. */
export interface UrlSerializableInput {
  id: string;
  type: string;
  value?: InputValue;
  required?: boolean;
  fields?: BlockFieldSpec[];
}

/** Reserved-control overrides folded into a serialised URL. */
export interface SerializeUrlOpts {
  format?: string | null;
  export?: boolean;
  slot?: string | null;
  width?: number | null;
  height?: number | null;
  unit?: string | null;
  dpi?: number | null;
  profile?: string | null;
  password?: string | null;
  bleed?: string | null;
  /** CSV of mark names, as documented for the `marks` param. */
  marks?: string | null;
  /** false = force off; truthy = on (lifetime from c2paDays, else default). */
  c2pa?: boolean;
  c2paDays?: number | null;
  /** Lolly pixel watermark for raster exports. On by default like `c2pa` -
   *  false ⇒ explicit opt-out, written as `imprint=0`; true/undefined ⇒ the
   *  default, so the param is omitted (nothing to override). */
  imprint?: boolean;
  /** Generator-metadata toggle (the `meta` param). Default-on like `imprint`:
   *  false ⇒ `meta=off` (strip the source field); true/undefined ⇒ omitted. */
  metadata?: boolean;
  /** Durable Content Credential (the `durable` param). Opt-in, off by default -
   *  serialised as `durable=1` only when true; omitted otherwise. */
  durable?: boolean;
  /** HDR raster export (the `hdr` param). Truthy serialised as `hdr=1`; omitted
   *  otherwise - opt-in, off by default. */
  hdr?: string | null;
  /** Requested export bit depth (the `depth` param). Written only for a real
   *  request - 'auto' (the default) and anything unrecognized write nothing, so a
   *  plain link stays clean. */
  depth?: DepthSetting | string | number | null;
  /** Contact-sheet frame count (the `cuts` param). Clamped like the parser; only
   *  a value > 1 writes the param - 1 is the default and would be link noise. */
  cuts?: number | null;
  /** UI/content language to stamp on a share link (see `lang` in the header
   *  comment). Omitted for English - the implicit default. */
  lang?: string | null;
}

// Param names that are NOT tool inputs (export/render controls). Exported so the
// engine contract test can assert it stays in lock-step with the documented list
// (the header comment above + docs/url-mode.md) and nothing drifts silently.
export const RESERVED = new Set(['format', 'export', 'copy', 'slot', 'output', 'filename', '_v', 'width', 'height', 'w', 'h', 'unit', 'dpi', 'profile', 'password', 'bleed', 'marks', 'c2pa', 'imprint', 'durable', 'meta', 'hdr', 'depth', 'cuts', 'lang', 'designv', 'full', 'options', 'nostage', 'template', 'present', 's', 'z', 'zx']);
// NOTE on the presentation-mode kiosk flag `loop` (plan 112): it is deliberately
// NOT in this set. `loop` is a live *input* id in several tools (slides, deck-builder,
// 3d, digi-ad, lottie-digi-ad - a GIF-playback / animation control), so reserving it
// would strip their `?loop=…` value on parse. The presenter reads `loop` as a raw
// presence flag only in design, which has no `loop` input, so there is no
// ambiguity there; the shell keeps it through shrinkUrl via RESERVED_KEEP instead.
// If design ever gains a `loop` input, rename the signage flag (e.g. `kiosk`).

// Parse the `marks` param (csv: crop,reg,bleed,bars,prov) into a print-mark
// toggle map. Returns null when absent so callers fall back to their own defaults.
function parseMarks(raw: string | null): PrintMarksFlags | null {
  if (raw == null) return null;
  const set = new Set(String(raw).split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  return {
    crop:         set.has('crop'),
    registration: set.has('reg') || set.has('registration'),
    bleed:        set.has('bleed'),
    colorBars:    set.has('bars') || set.has('colorbars'),
    provenance:   set.has('prov') || set.has('provenance'),
  };
}

// Parse the `c2pa` param. Returns null when absent so callers fall back to the
// tool's render.c2pa default; else { on, days } where days is a valid lifetime
// pick (7/30/90/365) or null for "on at the default".
function parseC2pa(raw: string | null): C2paSetting | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'off' || v === '0' || v === 'false' || v === 'no') return { on: false, days: null };
  const n = Number(v);
  return { on: true, days: [7, 30, 90, 365].includes(n) ? n : null };
}

// Parse the `imprint` param (pixel-watermark opt-in/out). null when absent -
// the caller applies the default-on behaviour; false for an explicit
// `imprint=0`/`off`; true for on. Empty value (`?imprint`) reads as on.
function parseImprint(raw: string | null): boolean | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'off' || v === '0' || v === 'false' || v === 'no') return false;
  return true;
}

// The `meta` param - default-on like `imprint`: absent ⇒ null (keep generator metadata),
// an explicit opt-out (`meta=off`/`0`/`false`/`no`) ⇒ false (strip the source field).
function parseMeta(raw: string | null): boolean | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'off' || v === '0' || v === 'false' || v === 'no') return false;
  return true;
}

// Parse the opt-in `durable` param (durable TrustMark credential). Off unless the
// value is affirmative - `durable=1`/`on`/empty ⇒ true; absent/`0`/`off` ⇒ false.
function parseDurable(raw: string | null): boolean {
  if (raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return !(v === 'off' || v === '0' || v === 'false' || v === 'no');
}

// Parse the opt-in `hdr` param (HDR raster export). Off unless affirmative.
// `hdr=1`/`on`/`pq`/empty ⇒ HDR_DEFAULTS; `hdr=0`/`off`/absent ⇒ null (SDR).
// Tuned form: `hdr=<peakNits>-<reach>-<lift>-<richness>` (e.g. `1600-60-0-50`),
// each an integer; missing/invalid fields fall back to the default dial.
function parseHdr(raw: string | null): HdrSettings | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'off' || v === '0' || v === 'false' || v === 'no') return null;
  if (v === '' || v === '1' || v === 'on' || v === 'pq' || v === 'true') return { ...HDR_DEFAULTS };
  const p = v.split('-').map(Number);
  const dial = (n: number | undefined, lo: number, hi: number, def: number): number =>
    n != null && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def;
  return {
    peakNits: dial(p[0], 100, 10000, HDR_DEFAULTS.peakNits),
    reach:    dial(p[1], 0, 100, HDR_DEFAULTS.reach),
    lift:     dial(p[2], 0, 100, HDR_DEFAULTS.lift),
    richness: dial(p[3], 0, 100, HDR_DEFAULTS.richness),
  };
}

// Parse the `depth` param (requested bits per channel for the export). Total
// function over user input, like parseCuts: absent, empty, or anything outside
// 8/16/float/auto - '32', 'deep', 'constructor', 'NaN' - degrades to 'auto', the
// default, rather than throwing or inventing a depth. Deliberately silent (the
// engine has no logger and every other reserved param degrades quietly); the
// contract is that 'auto' always renders, at whatever depth provenance allows.
function parseDepth(raw: string | null): DepthSetting {
  if (raw == null) return 'auto';
  return DEPTH_VALUES.get(String(raw).trim().toLowerCase()) ?? 'auto';
}

/** Serialise HDR dials to the compact `hdr` value: `1` when all-default (a clean
 *  link), else `<peakNits>-<reach>-<lift>-<richness>`. */
export function serializeHdr(s: HdrSettings): string {
  const d = HDR_DEFAULTS;
  if (s.peakNits === d.peakNits && s.reach === d.reach && s.lift === d.lift && s.richness === d.richness) return '1';
  return `${s.peakNits}-${s.reach}-${s.lift}-${s.richness}`;
}

/** Ceiling for `cuts`. A contact sheet exists to be *looked at* - 64 is already an
 *  8×8 wall of thumbnails, past which a reviewer reads nothing and the cost (64
 *  full renders, 64 zip members or PDF pages) stops paying for itself. Also a cheap
 *  guard: a hostile `?cuts=1e9` link can never ask a shell for a billion renders. */
export const CUTS_MAX = 64;

/** Sample time for cut `i` of `n`, in the same units as `durationMs`. MIDPOINT
 *  sampling - `duration * (i + 0.5) / n` - never endpoint. At t=0 an `enter`
 *  transition is still at alpha 0 (a blank card) and at t=duration every clip has
 *  ended, so endpoint sampling would spend two of six frames on blanks; the midpoint
 *  of each equal slice always lands inside a live span. */
export function cutTime(durationMs: number, i: number, n: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || !(n >= 1)) return 0;
  return durationMs * (i + 0.5) / n;
}

// Parse the `cuts` param (contact-sheet frame count for a still export). Total
// function over user input: anything that isn't a finite number ≥ 1 - empty,
// non-numeric, 0, negative, NaN, Infinity, '1.5' → 1 (a fractional value truncates)
// - degrades to 1, the playhead-frame default. Above CUTS_MAX it clamps rather than
// falling back, because "too many" is a legible intent, not junk. Never throws.
function parseCuts(raw: string | null): number {
  if (raw == null) return 1;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n)) return 1;
  const i = Math.trunc(n);
  if (i < 1) return 1;
  return Math.min(i, CUTS_MAX);
}

/**
 * Parse URL params into an input-state object the runtime can apply.
 * Returns { values, format, export, copy, slot, version, width, height }.
 *
 * Accepts both legacy long-form param names and short urlKey aliases.
 * Accepts both JSON and compact tilde-delimited block arrays.
 */
export function parseUrlState(searchParams: string | URLSearchParams, manifest: InputManifest): UrlState {
  const params = new URLSearchParams(searchParams);
  const values: Record<string, InputValue> = {};

  // Build lookup keyed by both id and urlKey so either form works in URLs.
  const inputsByKey: Record<string, InputSpec> = {};
  // Vector sub-fields are flat params named "<inputId>.<fieldId>" (e.g.
  // transform.zoom=200) - legible and one value per param.
  const vectorFieldByKey: Record<string, { input: InputSpec; field: BlockFieldSpec }> = {};
  for (const i of manifest.inputs ?? []) {
    inputsByKey[i.id] = i;
    if (i.urlKey) inputsByKey[i.urlKey] = i;
    if (i.type === 'vector') {
      for (const f of i.fields ?? []) vectorFieldByKey[`${i.id}.${f.id}`] = { input: i, field: f };
    }
  }

  for (const [key, raw] of params.entries()) {
    if (RESERVED.has(key)) continue;
    const vec = vectorFieldByKey[key];
    if (vec) {
      const n = Number(raw);
      if (raw !== '' && !Number.isNaN(n)) ((values[vec.input.id] ??= {}) as Record<string, number>)[vec.field.id] = n;
      continue;
    }
    const input = inputsByKey[key];
    if (!input) continue;
    // A `multiple` file input collects every repeated occurrence (CLI transport:
    // --source=a.pdf --source=b.mp4) into an array of unresolved path refs; the
    // CLI loads each one's bytes before createRuntime.
    if (input.type === 'file' && input.multiple) {
      const ref = coerceFromString(input, raw);
      if (ref) ((values[input.id] ??= []) as InputValue[]).push(ref);
      continue;
    }
    values[input.id] = coerceFromString(input, raw);
  }

  const rawW = params.get('width') ?? params.get('w');
  const rawH = params.get('height') ?? params.get('h');
  const rawUnit = (params.get('unit') || '').toLowerCase();
  const rawDpi = params.get('dpi');

  return {
    values,
    format:   params.get('format') || null,
    export:   params.has('export'),
    copy:     params.has('copy'),
    slot:     params.get('slot') || null,
    filename: params.get('filename') || null,
    version:  params.get('_v') || null,
    width:    rawW != null ? (Number(rawW) || null) : null,
    height:   rawH != null ? (Number(rawH) || null) : null,
    // Physical unit for width/height (default px) and the raster DPI for it.
    unit:     isUnit(rawUnit) ? rawUnit : null,
    dpi:      rawDpi != null ? (Number(rawDpi) || null) : null,
    // Colour profile / CMYK press condition for the export (see color.js).
    profile:  params.get('profile') || null,
    // Open-password for the standard `pdf` export (basic lock; clear-text by design).
    password: params.get('password') || null,
    // Print prep for pdf / pdf-cmyk: bleed amount (dimension string) and which
    // crop / registration / bleed / colour-bar marks to draw (see print-marks.js).
    bleed:    params.get('bleed') || null,
    marks:    parseMarks(params.get('marks')),
    // Content Credentials on/off + ephemeral-cert lifetime (see header).
    c2pa:     parseC2pa(params.get('c2pa')),
    // Pixel-watermark opt-in for raster exports (see header).
    imprint:  parseImprint(params.get('imprint')),
    metadata: parseMeta(params.get('meta')),
    // Opt-in durable Content Credential for raster exports (see header).
    durable:  parseDurable(params.get('durable')),
    // Opt-in HDR raster export (see header). null ⇒ SDR.
    hdr:      parseHdr(params.get('hdr')),
    // Requested export bit depth (see header). Always 8/16/'float'/'auto'; junk
    // and absence both read as 'auto'. Depth follows provenance at the consumer.
    depth:    parseDepth(params.get('depth')),
    // Contact-sheet frame count for a still export of a timed composition (see
    // header). Always 1…CUTS_MAX; 1 ⇒ the single playhead frame.
    cuts:     parseCuts(params.get('cuts')),
    // UI/content language, alias-normalized (see header). null ⇒ absent/unrecognized.
    lang:     normalizeLang(params.get('lang')),
    // Design-system version override (see header). Verbatim, never validated here:
    // whether a slug names a real version is a question about the device's ledger.
    designVersion: params.get('designv') || null,
  };
}

/**
 * Build a URL-encoded param string from current input values.
 * AssetRef values are serialised by id so the URL stays short and shareable.
 */
export function serializeUrlState(model: UrlSerializableInput[], opts: SerializeUrlOpts = {}): string {
  const params = new URLSearchParams();
  for (const input of model) {
    if (input.value === null || input.value === undefined) continue;
    // A picked file is binary user content - it has no shareable URL form (its
    // bytes live only in memory on this device). Never serialise it.
    if (input.type === 'file') continue;
    if (input.type === 'vector') {
      // One flat param per field: "<inputId>.<fieldId>=<value>".
      const v = input.value;
      if (v && typeof v === 'object') {
        const vo = v as Record<string, InputValue | undefined>;
        for (const f of input.fields ?? []) {
          if (vo[f.id] !== undefined && vo[f.id] !== null) params.set(`${input.id}.${f.id}`, String(vo[f.id]));
        }
      }
      continue;
    }
    if (input.value === '' && !input.required) continue;
    // An empty grid (no headings, no rows) is the blank state - omit it.
    if (input.type === 'table') {
      const t = normalizeTableValue(input.value);
      if (!t || (!t.columns.length && !t.rows.length)) continue;
    }
    params.set(input.id, coerceToString(input, input.value));
  }
  if (opts.format) params.set('format', opts.format);
  if (opts.export) params.set('export', '');
  if (opts.slot)   params.set('slot',   opts.slot);
  if (opts.width)  params.set('w', String(opts.width));
  if (opts.height) params.set('h', String(opts.height));
  if (opts.unit && opts.unit !== 'px') params.set('unit', opts.unit);
  if (opts.dpi)    params.set('dpi', String(opts.dpi));
  if (opts.profile) params.set('profile', opts.profile);
  if (opts.password) params.set('password', opts.password);
  if (opts.bleed) params.set('bleed', opts.bleed);
  if (opts.marks) params.set('marks', opts.marks);
  if (opts.c2pa === false) params.set('c2pa', 'off');
  else if (opts.c2pa) params.set('c2pa', [7, 30, 90, 365].includes(Number(opts.c2paDays)) ? String(opts.c2paDays) : '1');
  // Default-on, like c2pa: only an explicit opt-out needs a param - writing
  // `imprint=1` for the default state would just be noise on every link.
  if (opts.imprint === false) params.set('imprint', '0');
  // Default-on like imprint: only an explicit strip writes the param.
  if (opts.metadata === false) params.set('meta', 'off');
  // Opt-in, off by default: only an explicit request writes the param.
  if (opts.durable) params.set('durable', '1');
  if (opts.hdr) params.set('hdr', '1');
  // Only a real depth request writes the param: 'auto' is the default and junk is
  // not worth round-tripping, so both leave the link clean (the parser reads either
  // back as 'auto' anyway).
  {
    const d = opts.depth == null ? 'auto' : parseDepth(String(opts.depth));
    if (d !== 'auto') params.set('depth', String(d));
  }
  // Default (1 = the playhead frame) writes nothing; anything else goes through the
  // same clamp as the parser so a serialised link can't carry a value parse rejects.
  if (opts.cuts != null && parseCuts(String(opts.cuts)) > 1) params.set('cuts', String(parseCuts(String(opts.cuts))));
  if (opts.lang && opts.lang !== 'en') params.set('lang', opts.lang);
  return params.toString();
}

function coerceFromString(input: InputSpec, raw: string): InputValue {
  switch (input.type) {
    case 'number':
      return Number(raw);
    case 'boolean':
      return raw === '1' || raw === 'true';
    case 'color':
      // A `{token.path}` alias is a token-backed colour; keep it as an unresolved
      // token value for the runtime to resolve (mirrors the asset _unresolved path).
      if (isAlias(raw)) return { ref: raw, _unresolved: true };
      // Colors are stored without # for compactness; restore it here.
      if (raw.length === 6 && /^[0-9a-fA-F]{6}$/.test(raw)) return '#' + raw;
      return raw;
    case 'asset':
      // Lightweight ref. The runtime resolves it before hydration. A Lolly tool
      // URL (a share link the user dropped into the picker) is a 'remote' asset
      // the runtime re-renders via host.compose.renderUrl; a plain id is a
      // 'library' asset resolved via host.assets.get.
      return { source: isToolUrl(raw) ? 'remote' : 'library', id: raw, _unresolved: true };
    case 'file':
      // Files can't ride in a URL as bytes. In CLI transport a file param is a
      // filesystem path (--photo=./pic.jpg); the CLI loads its bytes into a
      // FileRef before createRuntime. In the web shell this unresolved ref carries
      // no bytes, so the runtime treats it as blank (resolveInitialValue).
      return raw ? { __file: true, path: raw, _unresolved: true } : null;
    case 'blocks':
      // Accept legacy JSON format and compact tilde-delimited format.
      if (raw.startsWith('[')) {
        try { return JSON.parse(raw) as InputValue; } catch { return []; }
      }
      return decodeBlocksCompact(raw, input.fields ?? []);
    case 'table':
      // Accept JSON ({columns, rows}) and the compact tilde-delimited form
      // (header row first). Either way the grid is normalized on entry.
      if (raw.startsWith('{')) {
        try { return normalizeTableValue(JSON.parse(raw)) ?? { columns: [], rows: [] }; }
        catch { return { columns: [], rows: [] }; }
      }
      return decodeTableCompact(raw);
    // NOTE: 'vector' has no single-param form - each field is its own flat param
    // ("<inputId>.<fieldId>"), handled in parseUrlState.
    default:
      return raw;
  }
}

function coerceToString(input: UrlSerializableInput, value: InputValue): string {
  if (input.type === 'boolean') return value ? '1' : '0';
  if (input.type === 'asset' && value && typeof value === 'object') {
    const ref = value as AssetRef;
    // A baked ref's data: URL can't ride in a link; serialize its provenance
    // (the canonical embed URL) so the recipient degrades to a live re-render.
    // No provenance → the 'baked/…' id itself, which degrades to a graceful drop.
    return assetIdForUrl(ref);
  }
  // A token-backed colour serialises to its reference ('{color.brand.jungle}'),
  // so a shared link re-resolves against the destination's tokens (canonical).
  if (input.type === 'color' && isTokenValue(value)) return value.ref;
  // Baked refs in block sub-fields get the same degradation as top-level assets
  // (blocksForUrl) - otherwise a frozen block image would inline its whole
  // data: URL into the query and blow every link-length ceiling.
  if (input.type === 'blocks') return JSON.stringify(blocksForUrl(value) ?? []);
  if (input.type === 'table') return encodeTableCompact(normalizeTableValue(value));
  // 'vector' is serialised per-field in serializeUrlState, not here.
  return String(value);
}

/**
 * Decode a compact tilde-delimited block string into an array of row objects.
 * Format: "v1a,v1b,v1c~v2a,v2b,v2c~..."
 * Field values are decodeURIComponent'd. Color fields get their # restored.
 */
function decodeBlocksCompact(str: string, fields: BlockFieldSpec[]): InputValue[] {
  if (!str || !fields.length) return [];
  return str.split('~').filter(Boolean).map(item => {
    // Cap to exactly fields.length parts: the encoder percent-encodes ',' and '~'
    // inside values, so any *raw* comma is a hand-edited URL. Folding the overflow
    // back into the last field contains the damage - a stray comma can only ever
    // corrupt the final field instead of shifting every field after it.
    const parts = splitToFields(item, fields.length);
    const obj: { [key: string]: InputValue | undefined } = {};
    fields.forEach((f, i) => {
      const part = parts[i] ?? '';
      // A lone '%' (or other malformed escape) in a hand-edited URL makes
      // decodeURIComponent throw URIError, which would abort the whole tool
      // load. Degrade gracefully: fall back to the raw part for that field.
      let raw: string;
      try {
        raw = decodeURIComponent(part);
      } catch {
        raw = part;
      }
      if (f.type === 'asset') {
        // Lightweight ref by id; the runtime resolves it before hydration
        // (resolveAssetRefs descends into block asset fields). A tool URL is a
        // 'remote' compose-rendered ref; a plain id is a 'library' asset. Empty
        // → no image.
        obj[f.id] = raw ? { source: isToolUrl(raw) ? 'remote' : 'library', id: raw, _unresolved: true } : null;
      } else if (f.type === 'color' && raw && !raw.startsWith('#')) {
        obj[f.id] = '#' + raw;
      } else {
        obj[f.id] = raw;
      }
    });
    return obj;
  });
}

/**
 * Encode a table value into the single-param compact form:
 *   "Col1,Col2,Col3~r1c1,r1c2,r1c3~r2c1,..."
 * - the header row first, then one tilde-delimited segment per data row. Every
 * cell is encodeURIComponent'd, so commas/tildes/newlines INSIDE a cell become
 * %-escapes and never collide with the separators. Unlike the blocks compact
 * form (which the web shell pushes into share links raw for readability), a
 * table param must always travel through one more layer of URL encoding
 * (URLSearchParams / encodeURIComponent) so cell escapes survive the one
 * decode the load boundary performs - prose cells make separator characters
 * far too common to bail to JSON instead.
 */
export function encodeTableCompact(t: TableValue | null): string {
  if (!t) return '';
  // '~' is unreserved, so encodeURIComponent leaves it RAW - escape it by hand
  // or a tilde inside a cell splits the row segments on decode.
  const cell = (c: string): string => encodeURIComponent(c).replace(/~/g, '%7E');
  const row = (r: string[]): string => r.map(cell).join(',');
  return [row(t.columns), ...t.rows.map(row)].join('~');
}

/**
 * Decode the compact table form back into a normalized {@link TableValue}.
 * The first tilde segment is the header row; each remaining segment is one data
 * row, capped to the header's column count (overflow from a hand-edited raw
 * comma folds into the last cell, mirroring decodeBlocksCompact). A malformed
 * %-escape in a cell degrades to the raw text rather than aborting the load.
 */
export function decodeTableCompact(str: string): TableValue {
  if (!str) return { columns: [], rows: [] };
  const dec = (part: string): string => {
    try { return decodeURIComponent(part); } catch { return part; }
  };
  const segments = str.split('~');
  const columns = (segments[0] ?? '').split(',').map(dec);
  const rows = segments.slice(1).filter(Boolean).map(seg =>
    splitToFields(seg, columns.length).map(dec));
  return normalizeTableValue({ columns, rows }) ?? { columns: [], rows: [] };
}

// Split into at most `count` comma-separated parts, joining any overflow back into
// the final part (so a raw, un-encoded comma can't shift the field alignment past
// the schema). Unlike String.split(s, limit), the tail is preserved, not dropped.
function splitToFields(str: string, count: number): string[] {
  const parts = str.split(',');
  if (parts.length <= count) return parts;
  return [...parts.slice(0, count - 1), parts.slice(count - 1).join(',')];
}

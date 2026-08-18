// SPDX-License-Identifier: MPL-2.0
/**
 * Preflight: pre-export findings over a plain job description. No DOM, no
 * brand knowledge, no I/O.
 *
 * The split is the one `print-marks.ts` already uses: **the engine owns the
 * RULES, each shell collects the FACTS from its own platform.** A shell builds a
 * `PreflightJob` from whatever it can see (the manifest, the input model, the
 * resolved export settings, the brand palette it got back from
 * `host.tokens.colors()`, and, only if it has a mounted node, a few DOM facts),
 * hands it to {@link preflight}, and renders the `Finding[]` that comes back.
 * The web panel, `lolly preflight --json` and a batch zip manifest therefore emit
 * byte-identical findings, because there is exactly one implementation of every
 * rule.
 *
 * Three properties this module holds to, in order of importance:
 *
 * 1. **It never invents a number.** Anything that needs a mounted node, a
 *    completed render, or a mechanism that does not exist is reported as a NAMED
 *    GAP: a `Finding` with `needs` set, `severity: 'info'`, and no `count`. A gap
 *    is in the report, not missing from it, because an omitted gap is
 *    indistinguishable from "no problem here".
 * 2. **It is total.** `preflight()` never throws, on any input, including a
 *    hand-built job with wrong types. Every check runs inside a guard; a
 *    malformed member drops its own check, never the report. This mirrors
 *    `readSpotColor`'s tolerance in `tokens.ts`.
 * 3. **It counts; it does not cost.** There is no currency, no rate and no
 *    monetary concept anywhere in this module, and none may be added.
 *    See `plans/65-preflight-and-cost.md` section 6 and section 8.
 *
 * The finding/count vocabulary lives in `@lolly-tools/core` (`preflight.ts`
 * there), beside the manifest contract, so a consumer can read a serialised
 * report without depending on the engine. It is NOT on the `HostV1` bridge:
 * tools do not receive findings and do not contribute checks.
 */

import type {
  Bound, Count, Evidence, Fact, Finding, FindingId, PreflightReport,
  QuantityKind, QuantityUnit, ReportedDimension, ReportedJob, ReportedSettings,
  ReportedSize, Severity, UnknownReason,
} from '@lolly-tools/core';
import { KNOWN_FINISH_KINDS, SEVERITY_RANK } from '@lolly-tools/core';
import type { SpotColor } from '@lolly-tools/core';
import type { InputSpec, InputValue } from './inputs.ts';
import { normalizeTableValue } from './inputs.ts';
import type { PrintMarksFlags } from './print-marks.ts';
import { computePrintGeometry } from './print-marks.ts';
import type { Dimension } from './units.ts';
import { isPhysical, toCssPx, toInches, toPixels, toPoints } from './units.ts';
import { rgbToCmyk, cmykCondition, DEFAULT_CMYK_CONDITION } from './color.ts';
import { ENGINE_VERSION } from './version.ts';

/** Re-exported so a shell can import the whole preflight vocabulary from one
 *  place (`@lolly/engine`) without also depending on the tool-author SDK. */
export type {
  Bound, Count, Evidence, Fact, Finding, FindingId, PreflightReport,
  QuantityKind, QuantityUnit, ReportedDimension, ReportedJob, ReportedSettings,
  ReportedSize, Severity, UnknownReason,
};

// ─── Format tables ──────────────────────────────────────────────────────────
//
// These existed only as shell-local literals in `shells/web/src/views/tool-actions.ts`
// and `shells/web/src/bridge/sequence-cuts.ts`, and so were unreachable from the
// CLI. They live here now because a check and the UI that offers the setting must
// agree by construction, and both shell-local copies have been REPLACED by imports
// of these sets. `isPrintFmt`/`isCmykFmt` in `tool-actions.ts` and `CUTS_FORMATS`
// in `sequence-cuts.ts` now read from here. Two copies is how "the panel hides the
// bleed card but the URL still carries bleed" happens, so do not reintroduce one.

/** Formats to which bleed and print marks apply. (`isPrintFmt`.) The vector
 *  formats svg/eps/eps-cmyk gained per-page marks + a colour bar drawn from the same
 *  computePrintGeometry as the PDF path. */
export const PRINT_MARK_FORMATS: ReadonlySet<string> = new Set(['pdf', 'pdf-cmyk', 'cmyk-tiff', 'svg', 'eps', 'eps-cmyk']);

/** Formats that build a process (CMYK) separation. */
export const SEPARATING_FORMATS: ReadonlySet<string> = new Set(['pdf-cmyk', 'cmyk-tiff', 'eps-cmyk']);

/**
 * Of the separating formats, the only one that emits a real `/Separation`
 * colourspace object. `cmyk-tiff` and `eps-cmyk` substitute a spot's CMYK
 * equivalent instead, so a spot (or a finish) has nowhere to go in them.
 */
export const SPOT_PLATE_FORMATS: ReadonlySet<string> = new Set(['pdf-cmyk']);

/** HDR (Rec.2100 PQ) raster formats. WebP is excluded: no working HDR decode. */
export const HDR_FORMATS: ReadonlySet<string> = new Set(['png', 'jpg', 'jpeg', 'avif', 'tiff']);

/** Durable (neural watermark) credential carriers. Raster only. */
export const DURABLE_FORMATS: ReadonlySet<string> = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff']);

/** Still formats a contact sheet (`cuts`) is defined for. */
export const CUTS_FORMATS: ReadonlySet<string> = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg', 'pdf']);

/** Real-time motion clip formats. */
export const MOTION_FORMATS: ReadonlySet<string> = new Set(['webm', 'mp4', 'gif', 'apng']);

/**
 * Formats that actually produce a raster. A pixel count is a fact about these
 * and about nothing else: a `pdf-cmyk` page holds vector operators, an `svg` holds
 * geometry, and `csv`/`md`/`ics`/`html` hold text. Reporting "2480 x 3508 pixels"
 * for any of them asserts a resolution the output does not have.
 */
export const RASTER_FORMATS: ReadonlySet<string> = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'cmyk-tiff', 'gif', 'apng', 'exr', 'hdr',
]);

/**
 * The deep (float) pixel formats.
 *
 * These are admitted for ANY tool by the render path. `shells/cli/src/run.ts`
 * exempts them from the offered-formats gate, because `plans/61-deeprichpixels.md`
 * section 10 rules out per-tool depth declarations, so preflight must exempt them too.
 * Refusing a job that renders fine is the one failure that makes a CI gate built
 * on `lolly preflight` worse than none.
 */
export const DEPTH_FORMATS: ReadonlySet<string> = new Set(['exr', 'hdr']);

/**
 * Formats that have a page concept at all. Used only to keep the "Lolly cannot
 * count this tool's pages" gap relevant: emitting it on a PNG export would be
 * noise, and noise is how a real gap gets skipped.
 */
export const PAGED_FORMATS: ReadonlySet<string> = new Set(['pdf', 'pdf-cmyk', 'pptx']);

/**
 * The canonical `FinishKind` spellings.
 *
 * `FinishKind` is an OPEN union on purpose (a brand may declare a house process
 * with no type or engine release), so this set drives an INFORMATIONAL finding
 * only. An unrecognised finish is never a rejection and never a reason to drop
 * the surrounding ink.
 *
 * Built from `KNOWN_FINISH_KINDS` in the contract rather than hand-copied: a
 * literal restatement would silently report a newly-blessed spelling as
 * unrecognised the day the union gains a member.
 */
export const KNOWN_FINISHES: ReadonlySet<string> = new Set<string>(KNOWN_FINISH_KINDS);

// ─── The job description ────────────────────────────────────────────────────

/** Which shell collected the job description. Reported in evidence only. */
export type PreflightSource = 'web' | 'cli' | 'tui' | 'tauri' | 'mcp' | 'test';

/**
 * The manifest slice preflight reads: a narrowed structural type, so preflight
 * never depends on the whole `ToolManifest` and cannot drift into brand or DOM
 * knowledge.
 */
export interface PreflightManifest {
  readonly id?: string;
  /** `'experimental'` forces a watermark on every export. */
  readonly status?: string;
  readonly render?: {
    /**
     * BARE PIXELS, always. The manifest schema declares `width`/`height` as
     * integers and has no `unit` member at all, so a manifest size can never be
     * a physical trim size. Reading it as one would manufacture "A4-ish" out of
     * a number nobody declared.
     */
    readonly width?: number;
    readonly height?: number;
    readonly formats?: readonly string[];
    readonly export?: boolean;
    readonly paginate?: { readonly source?: string };
    readonly pages?: {
      readonly count?: string;
      readonly width?: string;
      readonly height?: string;
      readonly min?: number;
      readonly max?: number;
    };
    readonly video?: { readonly wait?: number; readonly duration?: number };
    readonly aspectWarning?: { readonly min?: number; readonly max?: number; readonly message?: string };
  };
  readonly inputs?: readonly InputSpec[];
}

/** One live input: the declared spec plus its current value. */
export interface PreflightInput extends InputSpec {
  readonly value: InputValue;
}

/**
 * Whether hooks have run.
 *
 * `render.paginate` must be read off the POST-`onInit` model: a hook can patch
 * the source table before `getHydrated()`. When the collector only has the
 * declared model, the page count is reported as a `'ceiling'` rather than
 * silently as fact.
 */
export type ModelPhase = 'declared' | 'post-init';

/**
 * Where a size came from.
 *
 * `'manifest'` is pixels BY CONSTRUCTION and can never yield a physical trim.
 * `'size-select'` requires the chosen option to have spelled a unit out: the web
 * shell's export-size driver defaults a unit-less option to `'mm'`, which turns a
 * `1200 x 900` px option into 1.2 x 0.9 metres. Any area taken from a size select
 * without checking the option's raw `unit` field is off by roughly 12x.
 */
export type SizeSource = 'url' | 'row' | 'size-select' | 'manifest';

export interface PreflightSize {
  readonly width: Dimension;
  readonly height: Dimension;
  readonly dpi: number;
  readonly declaredBy: SizeSource;
  /**
   * True only when the SOURCE spelled a unit out. A `false` here alongside a
   * non-px `Dimension` is a bug in the collector, and preflight refuses to derive
   * an area from it rather than trusting the fabricated unit.
   */
  readonly unitDeclared: boolean;
}

export interface PreflightSettings {
  /** The RESOLVED format (`row.format || runFormat`). The shell owns the
   *  two-level fallback; the engine never sees it. */
  readonly format: string;
  readonly size: PreflightSize;
  /** Fact-wrapped: a batch-snapshot row carries none of these, and must report
   *  `{ known: false, why: 'not-carried' }` rather than `0`/`false`. `value: null`
   *  means "explicitly none". */
  readonly bleed: Fact<Dimension | null>;
  readonly marks: Fact<PrintMarksFlags | null>;
  /** The reserved `profile` URL param, i.e. the PRESS CONDITION. Not the CLI's
   *  `--profile` (a user-profile JSON file). Do not conflate the two. */
  readonly pressProfile: Fact<string | null>;
  /** Already clamped to 1..CUTS_MAX by `parseCuts`. */
  readonly cuts?: number;
  /** Presence only. The value never reaches the engine. */
  readonly password?: boolean;
  readonly c2pa?: Fact<boolean>;
  readonly imprint?: Fact<boolean>;
  readonly durable?: boolean;
  readonly hdr?: boolean;
  readonly filename?: string;
}

/**
 * One resolved brand swatch: structurally the subset of a token colour that
 * preflight reads.
 *
 * `spot.name` and `spot.finish` are OPAQUE STRINGS here. The engine never learns
 * what "foil" means; the offered finish set is brand data.
 */
export interface PreflightSwatch {
  readonly path?: string;
  readonly name?: string;
  readonly spot: SpotColor | null;
  /** The swatch's process build (0–100 per channel C,M,Y,K) from a DTCG
   *  `$extensions` cmyk lock, when the brand set one. Drives the TAC measurement;
   *  an explicit lock wins over the hex, exactly like buildCmykPaletteMap. */
  readonly cmyk?: readonly number[];
  /** The swatch's own colour (`#rrggbb`), the fallback the naive rgbToCmyk reads
   *  for TAC when no cmyk lock is present. Finish swatches are excluded by the
   *  check (their real build is 100% K), not by omitting data. */
  readonly hex?: string;
}

/**
 * DOM facts, supplied only by a shell that has a mounted node. Headless callers
 * pass `{ known: false, why: 'needs-mount' }`. This is the ONLY channel through
 * which a DOM truth reaches the engine, and it is plain data.
 */
/** One raster `<img>` placed in the artwork, measured off the mounted DOM: its
 *  intrinsic pixel size and its rendered CSS box. Feeds the per-image effective-DPI
 *  check (checkImageEffectiveDpi). */
export interface ImageFact {
  readonly label: string;
  readonly naturalW: number;
  readonly naturalH: number;
  readonly boxCssW: number;
  readonly boxCssH: number;
}

export interface StageFacts {
  /** `isSequenceStage(node)`: the node is (or contains) a timed composition. */
  readonly isSequence: boolean;
  /** Timeline length from `[data-seq-ms]`, or null when there is none. */
  readonly durationMs?: number | null;
  /** `[data-pdf-page]` box count, or null when the stage has none. */
  readonly pageBoxes?: number | null;
  /** Measured CSS-px width of the stage node, taken to span the physical trim
   *  width: the px→physical scale for per-image effective DPI. */
  readonly canvasCssW?: number | null;
  /** Every raster `<img>` in the artwork, with its natural size + rendered box.
   *  SVG inline `<image>` and CSS background-images are deliberately NOT collected
   *  (no cheap natural size), a known blind spot. */
  readonly rasterImages?: readonly ImageFact[] | null;
}

export interface PreflightJob {
  readonly source?: PreflightSource;
  readonly manifest: PreflightManifest;
  readonly model?: readonly PreflightInput[];
  readonly modelPhase?: ModelPhase;
  /**
   * The RAW initial map, before `buildInputModel` resolved it, when the collector
   * has it. Required by `input.vector-clamped` and by nothing else; that check is
   * simply NOT EMITTED when this is absent. A check that silently degrades into a
   * guess is worse than an absent check.
   */
  readonly rawInitial?: Readonly<Record<string, unknown>>;
  readonly settings: PreflightSettings;
  readonly palette: Fact<readonly PreflightSwatch[]>;
  readonly stage: Fact<StageFacts>;
  readonly rowIndex?: number;
}

// ─── Small total helpers ────────────────────────────────────────────────────

const lower = (v: unknown): string => (typeof v === 'string' ? v.toLowerCase() : '');
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (n: number, lo: number, hi: number): number => (n < lo ? lo : n > hi ? hi : n);

/** Format a number for a message: no trailing noise, at most 2 decimals. */
const num = (n: number): string => {
  if (!Number.isFinite(n)) return '?';
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
};

/** A human label for an input, falling back to its id. */
const labelOf = (i: { id?: string; label?: string }): string =>
  (typeof i.label === 'string' && i.label) || (typeof i.id === 'string' && i.id) || 'An input';

/** A `Dimension` guard that tolerates a hand-built job. */
const isDim = (d: unknown): d is Dimension =>
  !!d && typeof d === 'object' && isFiniteNum((d as Dimension).value) &&
  typeof (d as Dimension).unit === 'string';

/** Square points to square metres (1pt = 0.0254/72 m). */
const PT_TO_M = 0.0254 / 72;
const pt2ToM2 = (w: number, h: number): number => w * PT_TO_M * (h * PT_TO_M);

// ─── The evaluator ──────────────────────────────────────────────────────────

interface Ctx {
  readonly job: PreflightJob;
  readonly fmt: string;
  readonly out: Finding[];
  add(f: Finding): void;
}

/**
 * Run one check. A check that throws (a malformed job member, a hostile value)
 * drops itself and nothing else: the report is still produced, still ordered,
 * still honest about everything the other checks could see.
 */
const guard = (fn: () => void): void => {
  try { fn(); } catch { /* a broken check drops itself, never the report */ }
};

/**
 * Pre-export findings for one job.
 *
 * Pure, synchronous, DOM-free and TOTAL: it never throws, for any input.
 * Findings come back severity-ordered (errors, then warnings, then info) and
 * stable within a severity, so two runs over the same job are byte-identical.
 */
export function preflight(job: PreflightJob): PreflightReport {
  const out: Finding[] = [];
  const rowIndex = isFiniteNum(job?.rowIndex) ? job.rowIndex : undefined;

  const ctx: Ctx = {
    job,
    fmt: lower(job?.settings?.format),
    out,
    add(f: Finding) {
      // Enforce the gap invariant here rather than trusting 40 call sites: a
      // finding with `needs` is info-severity and carries no count, always.
      const fixed: Finding = f.needs
        ? { ...f, severity: 'info', count: undefined, needs: f.needs }
        : f;
      out.push(rowIndex === undefined ? fixed : { ...fixed, rowIndex });
    },
  };

  for (const check of CHECKS) guard(() => check(ctx));

  const findings = out
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (SEVERITY_RANK[a.f.severity] - SEVERITY_RANK[b.f.severity]) || (a.i - b.i))
    .map(({ f }) => f);

  // Deduplicate counts by (kind, box, basis). The same quantity reported twice
  // is one quantity, and a consumer summing the list must not double it.
  const seen = new Set<string>();
  const counts: Count[] = [];
  for (const f of findings) {
    if (!f.count) continue;
    const key = `${f.count.kind}|${f.count.box ?? ''}|${f.count.basis}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts.push(f.count);
  }

  return {
    $format: 'lolly-preflight',
    formatVersion: 1,
    engine: ENGINE_VERSION,
    job: safeReportedJob(job, ctx.fmt, rowIndex),
    findings,
    counts,
    gaps: findings.filter(f => !!f.needs),
  };
}

/**
 * The collection context, echoed into the artifact.
 *
 * A `preflight.json` from a headless CI run and one from a mounted web session
 * used to be structurally identical, so a reader could not tell that a
 * clean-looking report was taken with an unresolved palette, an un-run `onInit`
 * and no stage. Everything that QUALIFIES a verdict now travels with it.
 * Total, like every other member: a hand-built job with wrong types degrades to
 * defaults rather than throwing.
 */
function safeReportedJob(job: PreflightJob, fmt: string, rowIndex: number | undefined): ReportedJob {
  try { return reportedJob(job, fmt, rowIndex); } catch {
    return {
      toolId: '', format: fmt, ...(rowIndex === undefined ? {} : { rowIndex }),
      stageMounted: false, paletteResolved: false,
      settings: {
        format: fmt,
        size: { width: { value: 0, unit: 'px' }, height: { value: 0, unit: 'px' }, dpi: 0, declaredBy: 'manifest', unitDeclared: false },
        bleed: { known: false, why: 'not-set' },
        marks: { known: false, why: 'not-set' },
        pressProfile: { known: false, why: 'not-set' },
      },
    };
  }
}

function reportedJob(job: PreflightJob, fmt: string, rowIndex: number | undefined): ReportedJob {
  const dim = (d: unknown): ReportedDimension =>
    (isDim(d) ? { value: d.value, unit: d.unit } : { value: 0, unit: 'px' });
  const s = job?.settings;
  const size: ReportedSize = {
    width: dim(s?.size?.width),
    height: dim(s?.size?.height),
    dpi: isFiniteNum(s?.size?.dpi) ? s.size.dpi : 0,
    declaredBy: typeof s?.size?.declaredBy === 'string' ? s.size.declaredBy : 'manifest',
    unitDeclared: s?.size?.unitDeclared === true,
  };
  const bleed: Fact<ReportedDimension | null> = s?.bleed?.known === true
    ? { known: true, value: isDim(s.bleed.value) ? dim(s.bleed.value) : null }
    : { known: false, why: s?.bleed?.known === false ? s.bleed.why : 'not-set' };
  const marks: Fact<Readonly<Record<string, boolean | undefined>> | null> = s?.marks?.known === true
    ? { known: true, value: (s.marks.value ?? null) as Readonly<Record<string, boolean>> | null }
    : { known: false, why: s?.marks?.known === false ? s.marks.why : 'not-set' };
  const pressProfile: Fact<string | null> = s?.pressProfile?.known === true
    ? { known: true, value: typeof s.pressProfile.value === 'string' ? s.pressProfile.value : null }
    : { known: false, why: s?.pressProfile?.known === false ? s.pressProfile.why : 'not-set' };
  const settings: ReportedSettings = { format: fmt, size, bleed, marks, pressProfile };
  return {
    toolId: (typeof job?.manifest?.id === 'string' && job.manifest.id) || '',
    format: fmt,
    ...(rowIndex === undefined ? {} : { rowIndex }),
    ...(typeof job?.source === 'string' ? { source: job.source } : {}),
    ...(typeof job?.modelPhase === 'string' ? { modelPhase: job.modelPhase } : {}),
    stageMounted: job?.stage?.known === true,
    paletteResolved: job?.palette?.known === true,
    settings,
  };
}

type Check = (c: Ctx) => void;

// ─── Checks: print finishes (the correctness fix) ───────────────────────────

/** Every swatch that carries a spot lock, tolerant of a malformed palette. */
const spotSwatches = (c: Ctx): { name: string; spot: SpotColor; path: string }[] => {
  const p = c.job?.palette;
  if (!p || p.known !== true || !Array.isArray(p.value)) return [];
  const out: { name: string; spot: SpotColor; path: string }[] = [];
  for (const s of p.value) {
    const spot = s?.spot;
    if (!spot || typeof spot !== 'object' || typeof spot.name !== 'string' || !spot.name) continue;
    out.push({
      name: typeof s.name === 'string' && s.name ? s.name : spot.name,
      spot,
      path: typeof s.path === 'string' ? s.path : '',
    });
  }
  return out;
};

const finishSpots = (c: Ctx): { name: string; spot: SpotColor; path: string; finish: string }[] =>
  spotSwatches(c)
    .filter(s => typeof s.spot.finish === 'string' && s.spot.finish !== '')
    .map(s => ({ ...s, finish: s.spot.finish as string }));

// ─── Total ink coverage (TAC) ───────────────────────────────────────────────
//
// A brand SOLID's ink coverage is knowable: its CMYK build is data. A photo's or
// gradient's is not without rendering the separation, so refuse.ink-coverage stays
// (rescoped to 'needs-render') for that. We report the heaviest brand solid, clearly
// scoped, against the chosen condition's limit. Never as the whole file's number.

/** `#rgb`/`#rrggbb` → 0–1 triple, or null. */
const hexRgb01 = (hex: unknown): [number, number, number] | null => {
  if (typeof hex !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** A brand solid's CMYK build (0–100 per channel) + its total area coverage (0–400),
 *  or null for a finish swatch or one with no usable colour. An explicit DTCG cmyk
 *  lock wins over the hex, exactly like buildCmykPaletteMap. */
const swatchTac = (s: PreflightSwatch): { cmyk: [number, number, number, number]; tac: number; name: string } | null => {
  if (s?.spot?.finish) return null;                                   // a finish is a 100% K mask, not a solid to weigh
  let cmyk: [number, number, number, number] | null = null;
  if (Array.isArray(s?.cmyk) && s.cmyk.length === 4 && s.cmyk.every(isFiniteNum)) {
    cmyk = [s.cmyk[0]!, s.cmyk[1]!, s.cmyk[2]!, s.cmyk[3]!];          // DTCG lock, already 0–100
  } else {
    const rgb = hexRgb01(s?.hex);
    if (rgb) { const [cc, mm, yy, kk] = rgbToCmyk(rgb[0], rgb[1], rgb[2]); cmyk = [cc * 100, mm * 100, yy * 100, kk * 100]; }
  }
  if (!cmyk) return null;
  return { cmyk, tac: Math.round(cmyk[0] + cmyk[1] + cmyk[2] + cmyk[3]), name: (typeof s.name === 'string' && s.name) || 'a brand colour' };
};

/** The chosen press condition's TAC limit (default fogra39 / 330%). */
const tacLimitFor = (c: Ctx): { name: string; limit: number } => {
  const p = c.job?.settings?.pressProfile;
  const name = p?.known === true && typeof p.value === 'string' && p.value ? p.value : DEFAULT_CMYK_CONDITION;
  return { name, limit: cmykCondition(name).tac };
};

/**
 * A declared finish emitted as its own named plate, with no overprint.
 *
 * THE MESSAGES HERE DESCRIBE THE SHIPPED EXPORT PATH, not the one it replaced.
 * `buildCmykPaletteMap` now routes every swatch carrying `spot.finish` to
 * `FINISH_MASK_CMYK` = 100% K, so the `/Separation <name> /DeviceCMYK` tint
 * transform no longer resolves to the swatch's gold-ish build: a RIP that honours
 * the named plate is unaffected, and one that flattens spots paints an
 * unmistakable black mask instead of a plausible metallic.
 *
 * The finish plate now OVERPRINTS (substitutePdfRgb selects an overprint graphics
 * state for it in the pdf-cmyk path), so it sits ON the process artwork instead of
 * cutting a hole in it. What remains is a HANDOFF question, not a defect: a printer
 * may want the finish supplied as its own artwork/plate rather than as an
 * overprinting named separation, so this is now an informational heads-up, not an
 * error.
 */
const checkFinishSeparatesAsInk: Check = c => {
  if (!SPOT_PLATE_FORMATS.has(c.fmt)) return;
  for (const s of finishSpots(c)) {
    c.add({
      id: 'print.finish-separates-as-ink',
      severity: 'info',
      message: `${s.name} is a ${s.finish} finish. Lolly writes it as its own overprinting named plate, with a 100% black process fallback if a RIP flattens it. Confirm with your printer how they want the finish supplied (its own overprinting plate, or separate finish artwork).`,
      evidence: { spotName: s.spot.name, swatch: s.name, finish: s.finish, tokenPath: s.path, format: c.fmt, overprint: true },
    });
  }
};

/**
 * A declared finish written into a format that has no separation plates.
 *
 * `cmyk-tiff` and `eps-cmyk` have no `/Separation` object at all, so the finish
 * lands in the process build. It is no longer a plausible metallic there (the
 * mask applies to every CMYK sink), but a solid black rectangle is not a finish
 * either, and nothing in the file says which plate it was meant to be.
 */
const checkFinishFlattened: Check = c => {
  if (!SEPARATING_FORMATS.has(c.fmt) || SPOT_PLATE_FORMATS.has(c.fmt)) return;
  for (const s of finishSpots(c)) {
    c.add({
      id: 'print.finish-flattened-into-process',
      severity: 'error',
      message: `${s.name} is a ${s.finish} finish, and ${c.fmt} has no separation plates. It is written into the process build as solid black, so it is a mask rather than a finish, and it is not overprinted. Supply the finish as its own artwork.`,
      evidence: { spotName: s.spot.name, swatch: s.name, finish: s.finish, tokenPath: s.path, format: c.fmt, overprint: false },
    });
  }
};

/** An unrecognised finish spelling. Reported, never dropped: the union is open. */
const checkFinishUnknownKind: Check = c => {
  for (const s of finishSpots(c)) {
    if (KNOWN_FINISHES.has(s.finish)) continue;
    c.add({
      id: 'print.finish-unknown-kind',
      severity: 'info',
      message: `${s.name} declares the finish "${s.finish}", which Lolly does not recognise. The ink is kept; nothing is discarded.`,
      evidence: { spotName: s.spot.name, finish: s.finish, tokenPath: s.path },
    });
  }
};

// ─── Checks: settings coherence ─────────────────────────────────────────────

const checkFormatOffered: Check = c => {
  // The deep float formats are admitted for ANY tool by the render path, so a
  // manifest that does not list them is not evidence the job is wrong. Mirrors
  // `shells/cli/src/run.ts`'s exemption exactly.
  if (DEPTH_FORMATS.has(c.fmt)) return;
  const offered = c.job?.manifest?.render?.formats;
  if (!Array.isArray(offered) || offered.length === 0 || !c.fmt) return;
  const list = offered.map(lower).filter(Boolean);
  if (list.includes(c.fmt)) return;
  c.add({
    id: 'settings.format-not-offered',
    severity: 'error',
    message: `This tool does not offer ${c.fmt}. It offers: ${list.join(', ')}.`,
    evidence: { format: c.fmt, offered: list.join(',') },
  });
};

const bleedIsSet = (c: Ctx): boolean => {
  const b = c.job?.settings?.bleed;
  return b?.known === true && isDim(b.value) && b.value.value > 0;
};

const marksAreSet = (c: Ctx): boolean => {
  const m = c.job?.settings?.marks;
  if (m?.known !== true || !m.value || typeof m.value !== 'object') return false;
  return Object.values(m.value).some(v => v === true);
};

const checkPrintMarksOnNonPrintFormat: Check = c => {
  if (PRINT_MARK_FORMATS.has(c.fmt)) return;
  if (!bleedIsSet(c) && !marksAreSet(c)) return;
  c.add({
    id: 'settings.print-marks-on-non-print-format',
    severity: 'warn',
    message: `Bleed and print marks are set, but ${c.fmt || 'this format'} ignores them. Only PDF, Print PDF, Print TIFF, SVG and EPS carry them.`,
    evidence: { format: c.fmt, bleedSet: bleedIsSet(c), marksSet: marksAreSet(c) },
  });
};

const checkPressProfileOnNonSeparatingFormat: Check = c => {
  const p = c.job?.settings?.pressProfile;
  if (p?.known !== true) return;
  const v = p.value;
  if (typeof v !== 'string' || v === '' || v === 'none') return;
  if (SEPARATING_FORMATS.has(c.fmt)) return;
  c.add({
    id: 'settings.press-profile-on-non-separating-format',
    severity: 'warn',
    message: `A press condition (${v}) is set, but ${c.fmt || 'this format'} has no separation to apply it to.`,
    evidence: { pressProfile: v, format: c.fmt },
  });
};

const checkHdrFormat: Check = c => {
  if (c.job?.settings?.hdr !== true || HDR_FORMATS.has(c.fmt)) return;
  c.add({
    id: 'settings.hdr-on-unsupported-format',
    severity: 'warn',
    message: `HDR is on, but ${c.fmt || 'this format'} cannot carry it.`,
    evidence: { format: c.fmt },
  });
};

const checkDurableFormat: Check = c => {
  if (c.job?.settings?.durable !== true || DURABLE_FORMATS.has(c.fmt)) return;
  c.add({
    id: 'settings.durable-on-unsupported-format',
    severity: 'warn',
    message: `A durable credential is requested, but ${c.fmt || 'this format'} cannot carry one.`,
    evidence: { format: c.fmt },
  });
};

/** The tool's own aspect guard, evaluated against the resolved output size. */
const checkAspectGuard: Check = c => {
  const aw = c.job?.manifest?.render?.aspectWarning;
  if (!aw) return;
  const { width, height } = c.job.settings.size;
  if (!isDim(width) || !isDim(height) || toCssPx(height) <= 0) return;
  const ratio = toCssPx(width) / toCssPx(height);
  const under = isFiniteNum(aw.min) && ratio < aw.min;
  const over = isFiniteNum(aw.max) && ratio > aw.max;
  if (!under && !over) return;
  c.add({
    id: 'settings.aspect-guard',
    severity: 'warn',
    message: (typeof aw.message === 'string' && aw.message) || 'This size may not suit this tool.',
    evidence: {
      ratio: Math.round(ratio * 1000) / 1000,
      min: isFiniteNum(aw.min) ? aw.min : null,
      max: isFiniteNum(aw.max) ? aw.max : null,
    },
  });
};

// ─── Checks: declared input coherence ───────────────────────────────────────
//
// These matter because `resolveInitialValue` short-circuits on `id in initial`,
// so a URL param, a CSV cell or a restored session value BYPASSES `constrain`
// entirely. `constrain` only runs from `updateInput`. A render can therefore
// hold a value the interface would refuse, and be unreproducible from the UI.

const model = (c: Ctx): readonly PreflightInput[] =>
  Array.isArray(c.job?.model) ? c.job.model : [];

const isBlank = (v: InputValue): boolean =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

const checkRequiredBlank: Check = c => {
  for (const i of model(c)) {
    if (i?.required !== true || !isBlank(i.value)) continue;
    c.add({
      id: 'input.required-blank',
      severity: 'warn',
      message: `${labelOf(i)} is marked required and is empty.`,
      inputId: i.id,
      evidence: { inputId: i.id, type: i.type },
    });
  }
};

const checkNumberRange: Check = c => {
  for (const i of model(c)) {
    if (i?.type !== 'number' || !isFiniteNum(i.value)) continue;
    const hasMin = isFiniteNum(i.min), hasMax = isFiniteNum(i.max);
    if (!hasMin && !hasMax) continue;
    const lo = hasMin ? (i.min as number) : -Infinity;
    const hi = hasMax ? (i.max as number) : Infinity;
    if (i.value >= lo && i.value <= hi) continue;
    const clamped = clamp(i.value, lo, hi);
    c.add({
      id: 'input.number-out-of-range',
      severity: 'warn',
      message: `${labelOf(i)} is ${num(i.value)}, outside its declared range ${hasMin ? num(lo) : 'any'} to ${hasMax ? num(hi) : 'any'}. The control will snap it to ${num(clamped)} the moment it is touched, so this render cannot be reproduced from the interface.`,
      inputId: i.id,
      evidence: {
        inputId: i.id, value: i.value, clamped,
        min: hasMin ? lo : null, max: hasMax ? hi : null,
      },
    });
  }
};

const checkTextMaxLength: Check = c => {
  for (const i of model(c)) {
    if (i?.type !== 'text' && i?.type !== 'longtext') continue;
    if (!isFiniteNum(i.maxLength) || typeof i.value !== 'string') continue;
    if (i.value.length <= i.maxLength) continue;
    c.add({
      id: 'input.text-over-maxlength',
      severity: 'warn',
      message: `${labelOf(i)} is ${i.value.length} characters; the declared limit is ${i.maxLength}. Editing the field will cut it to ${i.maxLength}.`,
      inputId: i.id,
      evidence: { inputId: i.id, length: i.value.length, maxLength: i.maxLength },
    });
  }
};

const checkSelectValue: Check = c => {
  for (const i of model(c)) {
    if (i?.type !== 'select' || !Array.isArray(i.options) || i.options.length === 0) continue;
    // `brandFonts` selects are extended at runtime by the shell with the user's
    // installed families, so the manifest option list is not the whole truth.
    if (i.brandFonts === true) continue;
    if (typeof i.value !== 'string' || i.value === '') continue;  // blank is check 5's business
    if (i.options.some(o => o?.value === i.value)) continue;
    c.add({
      id: 'input.select-value-unknown',
      severity: 'warn',
      message: `${labelOf(i)} is set to "${i.value}", which is not one of its options.`,
      inputId: i.id,
      evidence: {
        inputId: i.id, value: i.value,
        options: i.options.map(o => String(o?.value ?? '')).join(','),
      },
    });
  }
};

/**
 * A vector field that was silently clamped on load.
 *
 * `resolveVectorValue` is the ONE initial-value path that does clamp, which is
 * why this is the only silent-clamp check and why it needs the raw pre-resolution
 * map. Without `rawInitial` the check is not emitted at all: comparing a resolved
 * value against itself would report nothing and look like a pass.
 */
const checkVectorClamped: Check = c => {
  const raw = c.job?.rawInitial;
  if (!raw || typeof raw !== 'object') return;
  for (const i of model(c)) {
    if (i?.type !== 'vector' || !Array.isArray(i.fields)) continue;
    const given = (raw as Record<string, unknown>)[i.id];
    if (!given || typeof given !== 'object' || Array.isArray(given)) continue;
    for (const f of i.fields) {
      if (!f || typeof f.id !== 'string') continue;
      const rawV = (given as Record<string, unknown>)[f.id];
      if (!isFiniteNum(rawV)) continue;
      const hasMin = isFiniteNum(f.min), hasMax = isFiniteNum(f.max);
      if (!hasMin && !hasMax) continue;
      const clamped = clamp(rawV, hasMin ? (f.min as number) : -Infinity, hasMax ? (f.max as number) : Infinity);
      if (clamped === rawV) continue;
      c.add({
        id: 'input.vector-clamped',
        severity: 'warn',
        message: `${labelOf(i)}.${f.id} was given as ${num(rawV)} and was silently clamped to ${num(clamped)}.`,
        inputId: i.id,
        evidence: { inputId: i.id, field: f.id, raw: rawV, clamped },
      });
    }
  }
};

// ─── Checks: print geometry ─────────────────────────────────────────────────

/**
 * Zero bleed on a job that is going to a press.
 *
 * Gated on PRINT INTENT, not on the format alone. `pdf` is in
 * `PRINT_MARK_FORMATS` because bleed APPLIES to it, but a plain PDF at a pixel
 * size is a screen document and the overwhelmingly common case: warning on every
 * one of them would fire on the default export of six shipping tools, teach the
 * reader to dismiss the card, and make `--strict` exit 1 the normal state in CI.
 * Intent is one of three things the user actually did: chose a separating format,
 * turned marks on, or declared a physical trim.
 */
const checkNoBleed: Check = c => {
  if (!PRINT_MARK_FORMATS.has(c.fmt)) return;
  if (!SEPARATING_FORMATS.has(c.fmt) && !marksAreSet(c) && !physicalTrim(c)) return;
  const b = c.job?.settings?.bleed;
  if (b?.known !== true) return;
  const zero = b.value === null || (isDim(b.value) && b.value.value === 0);
  if (!zero) return;
  c.add({
    id: 'print.no-bleed',
    severity: 'warn',
    message: 'This is a print format and bleed is set to zero. Artwork that runs to the edge will show a white sliver after trimming.',
    evidence: { format: c.fmt },
  });
};

const checkBleedUnknown: Check = c => {
  if (!PRINT_MARK_FORMATS.has(c.fmt)) return;
  const b = c.job?.settings?.bleed;
  if (!b || b.known !== false) return;
  c.add({
    id: 'print.bleed-unknown',
    severity: 'info',
    needs: b.why,
    message: 'Lolly cannot see the bleed setting for this job, so it is not reporting one. Zero has not been assumed.',
    evidence: { format: c.fmt, why: b.why },
  });
};

/**
 * True when both dimensions are physical, POSITIVE, and the source spelled the
 * unit out.
 *
 * The `> 0` is not defensive tidiness. A collector that has one dimension and not
 * the other has to put SOMETHING in the missing slot, and a zero there used to
 * sail straight through into `computePrintGeometry`, producing three
 * `bound: 'exact'` counts of 0 m². An invented number is exactly what this module
 * promises not to produce, and a confident zero is the worst kind: a later rate
 * line would multiply it and report a free press run.
 */
const physicalTrim = (c: Ctx): { w: Dimension; h: Dimension } | null => {
  const s = c.job?.settings?.size;
  if (!s || s.unitDeclared !== true) return null;
  if (!isDim(s.width) || !isDim(s.height)) return null;
  if (!(s.width.value > 0) || !(s.height.value > 0)) return null;
  if (!isPhysical(s.width) || !isPhysical(s.height)) return null;
  return { w: s.width, h: s.height };
};

// ─── Effective resolution at print size ──────────────────────────────────────
//
// The number a press operator actually asks for: DPI (PPI) at the FINISHED size,
// not a bare pixel count. Two questions with two honest answers:
//  • The whole page's output DPI is `settings.size.dpi` exactly, by construction
//    (the raster is rendered at toPixels(dim, dpi)). Measurable, needs nothing.
//  • A single placed image's effective DPI (the "logo is 96 DPI here" case) needs
//    the mounted DOM: the image's intrinsic pixels vs. how big it prints. When the
//    stage is absent (headless) we say so (checkImageDpiNeedsStage), never guess.
//
// Thresholds vary by INTENT, derived from the trim's long edge, not a new control:
// offset/sheet-fed wants 300 (250-300 acceptable, <150 a hard fault); large-format
// viewed at distance tolerates 72-150, so it only warns below 72.
const LARGE_FORMAT_LONG_EDGE_IN = 24;   // ≥ 24" (610 mm) long edge ⇒ large-format intent
const OFFSET_MIN_DPI = 250;
const OFFSET_HARD_DPI = 150;
const LARGE_FORMAT_MIN_DPI = 72;

/** Classify print intent by physical size and return the DPI floor + hard floor. */
function dpiIntent(trim: { w: Dimension; h: Dimension }): {
  intent: 'offset' | 'large-format'; floor: number; hard: number; longEdgeIn: number; longEdge: Dimension;
} {
  const wi = toInches(trim.w), hi = toInches(trim.h);
  const longEdge = wi >= hi ? trim.w : trim.h;
  const longEdgeIn = Math.max(wi, hi);
  const intent = longEdgeIn >= LARGE_FORMAT_LONG_EDGE_IN ? 'large-format' : 'offset';
  const floor = intent === 'offset' ? OFFSET_MIN_DPI : LARGE_FORMAT_MIN_DPI;
  const hard = intent === 'offset' ? OFFSET_HARD_DPI : 50;
  return { intent, floor, hard, longEdgeIn, longEdge };
}

const round0 = (n: number): number => Math.round(n);

/** The whole page renders below the resolution its trim size wants. */
const checkEffectiveDpi: Check = c => {
  if (!RASTER_FORMATS.has(c.fmt)) return;              // DPI is a fact only where pixels are
  const trim = physicalTrim(c);
  if (!trim) return;
  const dpi = c.job?.settings?.size?.dpi;
  if (!isFiniteNum(dpi) || dpi <= 0) return;
  const { intent, floor, hard, longEdge } = dpiIntent(trim);
  if (dpi >= floor) return;                            // acceptable → no finding
  const L = num(longEdge.value), U = longEdge.unit;
  const message = intent === 'offset'
    ? (dpi < hard
        ? `This page is ${dpi} DPI at ${L} ${U}, below the 150 DPI floor for offset. It will look visibly soft.`
        : `This page is ${dpi} DPI at ${L} ${U}. Offset presses want 250 to 300 DPI, so this will look soft.`)
    : `This page is ${dpi} DPI at ${L} ${U}. Large-format print tolerates 72 to 150 DPI at viewing distance; below 72 it softens even at distance.`;
  c.add({ id: 'print.effective-dpi', severity: 'warn', message,
    evidence: { dpi, intent, floor, longEdge: Math.round(dpiIntent(trim).longEdgeIn * 100) / 100, unit: U, format: c.fmt } });
};

/** A placed raster image whose effective resolution at its placed size is too low. */
const checkImageEffectiveDpi: Check = c => {
  if (!RASTER_FORMATS.has(c.fmt) && !PRINT_MARK_FORMATS.has(c.fmt)) return;   // rasters embedded in a PDF matter too
  const trim = physicalTrim(c);
  if (!trim) return;
  const st = c.job?.stage;
  if (st?.known !== true) return;
  const imgs = st.value.rasterImages;
  const cw = st.value.canvasCssW;
  if (!Array.isArray(imgs) || !isFiniteNum(cw) || !(cw > 0)) return;
  if ((st.value.pageBoxes ?? 1) > 1) return;           // one canvasCssW can't map many pages → withhold
  const trimWin = toInches(trim.w), trimHin = toInches(trim.h);
  if (!(trimWin > 0) || !(trimHin > 0)) return;
  const ch = cw * (trimHin / trimWin);                 // implied canvas CSS height under the page aspect
  const { intent, floor } = dpiIntent(trim);
  for (const im of imgs) {
    if (!(im.naturalW > 0) || !(im.naturalH > 0) || !(im.boxCssW > 0) || !(im.boxCssH > 0)) continue;
    const physWin = (im.boxCssW / cw) * trimWin;
    const physHin = (im.boxCssH / ch) * trimHin;
    if (!(physWin > 0) || !(physHin > 0)) continue;
    const eff = round0(Math.min(im.naturalW / physWin, im.naturalH / physHin));   // constraining axis, conservative
    if (eff >= floor) continue;
    const physMm = round0(physWin * 25.4);
    c.add({ id: 'print.image-effective-dpi', severity: 'warn',
      message: `${im.label} is ${eff} DPI at its placed size (${physMm} mm wide). ${intent === 'offset' ? 'Offset print wants at least 250 DPI' : 'Large-format wants at least 72 DPI'}, so it will look soft. Replace it with a higher-resolution file.`,
      evidence: { label: im.label, effectiveDpi: eff, placedMm: physMm, naturalW: im.naturalW, intent, floor, format: c.fmt } });
  }
};

/** Headless: the placed-image resolution concept exists but can't be measured. */
const checkImageDpiNeedsStage: Check = c => {
  if (!RASTER_FORMATS.has(c.fmt) && !PRINT_MARK_FORMATS.has(c.fmt)) return;
  if (!physicalTrim(c)) return;
  if (c.job?.stage?.known !== false) return;           // only when there is NO mounted node
  c.add({ id: 'print.image-dpi-needs-stage', severity: 'info', needs: 'needs-mount',
    message: 'Lolly cannot check the resolution of images placed in the artwork without the artwork on screen.',
    evidence: { format: c.fmt } });
};

/** Exactly one of the two dimensions was declared: a named gap, never a zero. */
const checkTrimPartial: Check = c => {
  if (!PRINT_MARK_FORMATS.has(c.fmt)) return;
  const s = c.job?.settings?.size;
  if (!s || s.unitDeclared !== true) return;
  if (!isDim(s.width) || !isDim(s.height)) return;
  const wOk = s.width.value > 0, hOk = s.height.value > 0;
  if (wOk === hOk) return;
  const set = wOk ? s.width : s.height;
  c.add({
    id: 'print.trim-partially-declared',
    severity: 'info',
    needs: 'not-set',
    message: `Only the ${wOk ? 'width' : 'height'} was set (${num(set.value)} ${set.unit}). The other follows the artwork's aspect, which Lolly cannot read without the artwork on screen, so no trim size and no print area are being reported.`,
    evidence: { declared: wOk ? 'width' : 'height', value: set.value, unit: set.unit, format: c.fmt },
  });
};

const checkTrimNotPhysical: Check = c => {
  if (!PRINT_MARK_FORMATS.has(c.fmt)) return;
  // svg/eps/eps-cmyk are dual-use (screen + print), so a plain px-size export of one is
  // a screen graphic, not a print job missing its trim. Reporting "no physical page
  // size" on every such row is batch noise (plans section 6). Only speak up for them once
  // there is PRINT INTENT (marks/bleed turned on). The dedicated print formats
  // (pdf/pdf-cmyk/cmyk-tiff) are unchanged: px on those should always be flagged.
  if ((c.fmt === 'svg' || c.fmt === 'eps' || c.fmt === 'eps-cmyk') && !marksAreSet(c)) return;
  if (physicalTrim(c)) return;
  const s = c.job.settings.size;
  if (!isDim(s?.width) || !isDim(s?.height)) return;
  // A half-declared size is `print.trim-partially-declared`'s business; reporting
  // "2480 x 0 pixels" here would be the same fabricated zero in a different unit.
  if (!(s.width.value > 0) || !(s.height.value > 0)) return;
  const dpi = isFiniteNum(s.dpi) ? s.dpi : 300;
  const w = toPixels(s.width, dpi), h = toPixels(s.height, dpi);
  // No `count` here on purpose: a finding with `needs` must not carry one, and
  // `count.raster-pixels` already reports the pixel count with its own basis.
  c.add({
    id: 'print.trim-not-physical',
    severity: 'info',
    needs: 'not-set',
    message: `The page is ${w} x ${h} pixels. No physical page size was declared, so Lolly is reporting pixels and no print area.`,
    evidence: { widthPx: w, heightPx: h, declaredBy: s.declaredBy ?? null, unitDeclared: s.unitDeclared === true },
  });
};

/**
 * Trim, bleed and media boxes, from the same pure function the export bridges
 * draw from. Every area names its box: trim, bleed and media differ by 5–10%,
 * and an area applied to the wrong box is a silent error nobody spots.
 */
const checkPrintGeometry: Check = c => {
  if (!PRINT_MARK_FORMATS.has(c.fmt)) return;
  const trim = physicalTrim(c);
  if (!trim) return;
  const b = c.job.settings.bleed, m = c.job.settings.marks;
  if (b?.known !== true || m?.known !== true) return;
  const bleedPt = isDim(b.value) ? toPoints(b.value) : 0;
  const geo = computePrintGeometry({
    trimWpt: toPoints(trim.w),
    trimHpt: toPoints(trim.h),
    bleedPt,
    marks: (m.value ?? {}) as PrintMarksFlags,
  });
  const unit = trim.w.unit === trim.h.unit ? trim.w.unit : 'pt';
  const wLbl = unit === trim.w.unit ? num(trim.w.value) : num(toPoints(trim.w));
  const hLbl = unit === trim.h.unit ? num(trim.h.value) : num(toPoints(trim.h));
  const bleedLbl = isDim(b.value) ? `${num(b.value.value)} ${b.value.unit}` : 'none';

  const area = (box: 'trim' | 'bleed' | 'media', w: number, h: number): Count => ({
    kind: 'area',
    value: pt2ToM2(w, h),
    unit: 'm2-sheet',
    box,
    bound: 'exact',
    basis: 'print-marks.computePrintGeometry',
  });

  c.add({
    id: 'print.geometry',
    severity: 'info',
    message: `Trim ${wLbl} x ${hLbl} ${unit}. Bleed ${bleedLbl}. Media box ${num(geo.page.w)} x ${num(geo.page.h)} points.`,
    evidence: {
      trimWpt: Math.round(geo.boxes.trim.w * 100) / 100,
      trimHpt: Math.round(geo.boxes.trim.h * 100) / 100,
      bleedPt: Math.round(bleedPt * 100) / 100,
      mediaWpt: Math.round(geo.page.w * 100) / 100,
      mediaHpt: Math.round(geo.page.h * 100) / 100,
    },
    count: area('trim', geo.boxes.trim.w, geo.boxes.trim.h),
  });
  // The bleed and media areas ride their own findings so each carries exactly one
  // count and the box is never ambiguous.
  c.add({
    id: 'print.geometry',
    severity: 'info',
    message: `Bleed box ${num(geo.boxes.bleed.w)} x ${num(geo.boxes.bleed.h)} points.`,
    count: area('bleed', geo.boxes.bleed.w, geo.boxes.bleed.h),
  });
  c.add({
    id: 'print.geometry',
    severity: 'info',
    message: `Media box ${num(geo.boxes.media.w)} x ${num(geo.boxes.media.h)} points, the whole sheet through the press.`,
    count: area('media', geo.boxes.media.w, geo.boxes.media.h),
  });
};

// ─── Checks: counts ─────────────────────────────────────────────────────────

const checkPagesPaginate: Check = c => {
  const src = c.job?.manifest?.render?.paginate?.source;
  if (typeof src !== 'string' || !src) return;
  const input = model(c).find(i => i?.id === src);
  if (!input) return;
  const table = normalizeTableValue(input.value);
  if (!table) return;
  const n = Math.max(1, table.rows.length);
  // A hook can patch the source table before the canvas paginates, so a declared
  // (pre-onInit) model can only bound the page count, not state it.
  const bound: Bound = c.job.modelPhase === 'post-init' ? 'exact' : 'ceiling';
  c.add({
    id: 'count.pages.paginate',
    severity: 'info',
    message: `${n} ${n === 1 ? 'page' : 'pages'}, one per row of ${labelOf(input)}.`,
    evidence: { source: src, rows: table.rows.length, modelPhase: c.job.modelPhase ?? null },
    count: { kind: 'pages', value: n, unit: 'page', bound, basis: 'manifest.render.paginate' },
  });
};

const checkPagesPages: Check = c => {
  const pages = c.job?.manifest?.render?.pages;
  const id = pages?.count;
  if (typeof id !== 'string' || !id) return;
  const input = model(c).find(i => i?.id === id);
  if (!input || !isFiniteNum(input.value)) return;
  // The schema declares the clamp and the canvas applies it, so the typed value
  // is not the page count.
  const lo = isFiniteNum(pages.min) ? (pages.min as number) : 1;
  const hi = isFiniteNum(pages.max) ? (pages.max as number) : 6;
  const n = Math.round(clamp(input.value, lo, hi));
  c.add({
    id: 'count.pages.pages',
    severity: 'info',
    message: `${n} ${n === 1 ? 'page' : 'pages'}.`,
    evidence: { source: id, typed: input.value, min: lo, max: hi },
    count: { kind: 'pages', value: n, unit: 'page', bound: 'exact', basis: 'manifest.render.pages' },
  });
};

/**
 * The page count a MOUNTED stage already knows.
 *
 * `[data-pdf-page]` boxes are what the export path itself counts, and the web
 * collector was already measuring them, into a field no check read. A shell that
 * has the answer in hand and reports neither the answer nor a gap is worse than a
 * headless one that reports the gap.
 */
const checkPagesFromStage: Check = c => {
  if (!PAGED_FORMATS.has(c.fmt)) return;
  const r = c.job?.manifest?.render;
  if (r?.paginate?.source || r?.pages?.count) return;   // a declared count is better evidence
  const st = c.job?.stage;
  if (st?.known !== true) return;
  const n = st.value?.pageBoxes;
  if (!isFiniteNum(n) || n <= 0) return;
  c.add({
    id: 'count.pages.stage',
    severity: 'info',
    message: `${Math.floor(n)} ${n === 1 ? 'page' : 'pages'}, counted on the artwork as it stands.`,
    evidence: { format: c.fmt, pageBoxes: Math.floor(n) },
    count: { kind: 'pages', value: Math.floor(n), unit: 'page', bound: 'exact', basis: 'stage.pageBoxes' },
  });
};

const checkPagesUnknown: Check = c => {
  if (!PAGED_FORMATS.has(c.fmt)) return;
  const r = c.job?.manifest?.render;
  if (r?.paginate?.source || r?.pages?.count) return;
  // Narrowed from "the stage is known" to "the stage ANSWERED": a mounted stage
  // with no page boxes has told us nothing about pages, and suppressing the gap
  // on it made the web report neither a count nor a refusal.
  const st = c.job?.stage;
  if (st?.known === true && isFiniteNum(st.value?.pageBoxes) && (st.value.pageBoxes as number) > 0) return;
  c.add({
    id: 'count.pages.unknown',
    severity: 'info',
    needs: st?.known === true ? 'not-set' : 'needs-mount',
    message: st?.known === true
      ? "This tool declares no page count and the artwork on screen carries no page boxes, so Lolly is not reporting a page count."
      : "Lolly cannot count this tool's pages without the artwork on screen.",
    evidence: { format: c.fmt },
  });
};

/**
 * The timeline length a mounted stage already knows (`[data-seq-ms]`).
 *
 * The collectors were filling `stage.durationMs` and no check read it. A
 * collected-but-unread fact is a standing invitation to exactly the bug above,
 * so it either gets a check or it leaves the interface.
 */
const checkSequenceDuration: Check = c => {
  // Gated exactly as `refuse.sequence-duration` is, so the two are the answer and
  // the refusal to the same question: a timeline length is not about the output of
  // a still export nobody asked to cut.
  if (!MOTION_FORMATS.has(c.fmt) && cutsOf(c) === 0) return;
  const st = c.job?.stage;
  if (st?.known !== true) return;
  const ms = st.value?.durationMs;
  if (!isFiniteNum(ms) || ms <= 0) return;
  const s = Math.round((ms / 1000) * 100) / 100;
  c.add({
    id: 'count.sequence-duration',
    severity: 'info',
    message: `The timeline on screen is ${num(s)} seconds long.`,
    evidence: { durationMs: Math.round(ms), format: c.fmt },
    count: { kind: 'seconds', value: s, unit: 's', bound: 'exact', basis: 'stage.durationMs' },
  });
};

/**
 * The output pixel count, for formats that actually have pixels.
 *
 * Gated on {@link RASTER_FORMATS}: a `pdf-cmyk` page holds vector operators and an
 * `svg` holds geometry, so "2480 x 3508 pixels, bound: exact" beside them asserts
 * a resolution the file does not have, and a consumer indexing `report.counts` by
 * `kind: 'pixels'` gets a number the job never produces. The DPI clause is dropped
 * for a px size because `toPixels` does not apply DPI to px at all.
 */
const checkRasterPixels: Check = c => {
  if (!RASTER_FORMATS.has(c.fmt)) return;
  const s = c.job?.settings?.size;
  if (!isDim(s?.width) || !isDim(s?.height)) return;
  const px = s.width.unit === 'px' && s.height.unit === 'px';
  const dpi = isFiniteNum(s.dpi) ? s.dpi : 96;
  const w = toPixels(s.width, dpi), h = toPixels(s.height, dpi);
  if (!(w > 0) || !(h > 0)) return;
  c.add({
    id: 'count.raster-pixels',
    severity: 'info',
    message: px ? `${w} x ${h} pixels.` : `${w} x ${h} pixels at ${num(dpi)} DPI.`,
    evidence: { width: w, height: h, dpi: px ? null : dpi },
    count: { kind: 'pixels', value: w * h, unit: 'px', bound: 'exact', basis: 'units.toPixels' },
  });
};

const checkVideoDurationDeclared: Check = c => {
  if (!MOTION_FORMATS.has(c.fmt)) return;
  const d = c.job?.manifest?.render?.video?.duration;
  if (!isFiniteNum(d) || d <= 0) return;
  c.add({
    id: 'count.video-duration-declared',
    severity: 'info',
    message: `The tool declares a ${num(d)} second clip. The clip Lolly actually captures is measured after it runs.`,
    evidence: { declaredSeconds: d, format: c.fmt },
    count: { kind: 'seconds', value: d, unit: 's', bound: 'ceiling', basis: 'manifest.render.video' },
  });
};

// ─── Checks: plates ─────────────────────────────────────────────────────────

const checkProcessPlates: Check = c => {
  if (!SEPARATING_FORMATS.has(c.fmt)) return;
  c.add({
    id: 'plates.process',
    severity: 'info',
    message: '4 process plates. Whether all four carry ink cannot be known before the file is written.',
    evidence: { format: c.fmt },
    count: { kind: 'processPlates', value: 4, unit: 'plate', bound: 'ceiling', basis: 'format' },
  });
};

const checkSpotCeiling: Check = c => {
  if (!SEPARATING_FORMATS.has(c.fmt)) return;
  if (c.job?.palette?.known !== true) return;
  const names = new Set(spotSwatches(c).filter(s => !s.spot.finish).map(s => s.spot.name));
  if (names.size === 0) return;
  c.add({
    id: 'plates.spot-ceiling',
    severity: 'info',
    message: `Up to ${names.size} spot ${names.size === 1 ? 'plate' : 'plates'}.`,
    evidence: { spots: [...names].join(', '), format: c.fmt },
    count: { kind: 'spotPlates', value: names.size, unit: 'plate', bound: 'ceiling', basis: 'palette.spot' },
  });
};

const checkFinishCeiling: Check = c => {
  if (!SEPARATING_FORMATS.has(c.fmt)) return;
  if (c.job?.palette?.known !== true) return;
  const names = [...new Set(finishSpots(c).map(s => s.spot.name))];
  if (names.length === 0) return;
  c.add({
    id: 'plates.finish-ceiling',
    severity: 'info',
    message: `Up to ${names.length} finish ${names.length === 1 ? 'plate' : 'plates'}: ${names.join(', ')}.`,
    evidence: { finishes: names.join(', '), format: c.fmt },
    count: { kind: 'finishPlates', value: names.length, unit: 'plate', bound: 'ceiling', basis: 'palette.spot.finish' },
  });
};

/**
 * The honest answer for every brand in the tree today: no brand declares a spot,
 * so the correct output is this sentence, not the number 0. "0 spot plates" reads
 * as a measurement of the artwork; it is a property of the brand.
 */
const checkNoSpotsDeclared: Check = c => {
  if (!SEPARATING_FORMATS.has(c.fmt)) return;
  if (c.job?.palette?.known !== true) return;
  if (spotSwatches(c).length > 0) return;
  c.add({
    id: 'plates.no-spots-declared',
    severity: 'info',
    needs: 'not-set',
    message: 'This brand declares no spot inks, so there are no spot plates to count.',
    evidence: { format: c.fmt },
  });
};

/** The heaviest brand solid's total ink coverage, scoped to brand fills and
 *  measured against the chosen press condition's limit. NOT the whole render: the
 *  rendered-content gap stays as refuse.ink-coverage (needs-render). */
const checkInkCoverage: Check = c => {
  if (!SEPARATING_FORMATS.has(c.fmt)) return;
  if (c.job?.palette?.known !== true) return;
  const pal = c.job.palette.value;
  if (!Array.isArray(pal)) return;
  const weighed = pal.map(swatchTac).filter((x): x is NonNullable<typeof x> => x !== null);
  if (weighed.length === 0) return;
  const heaviest = weighed.reduce((a, b) => (b.tac > a.tac ? b : a));
  const { name, limit } = tacLimitFor(c);
  const cond = name.toUpperCase();
  c.add({
    id: 'count.ink-coverage-palette',
    severity: 'info',
    message: `The heaviest brand solid, ${heaviest.name}, is ${heaviest.tac}% total ink under ${cond} (limit ${limit}%). This is the brand's solid fills only, and a photograph or gradient can lay down more.`,
    evidence: { swatch: heaviest.name, tac: heaviest.tac, limit, condition: name, format: c.fmt },
    count: { kind: 'inkCoverage', value: heaviest.tac, unit: 'pct', bound: 'exact', basis: 'palette.tac' },
  });
  if (heaviest.tac > limit) {
    c.add({
      id: 'print.ink-over-tac',
      severity: 'warn',
      message: `${heaviest.name} is ${heaviest.tac}% total ink, over the ${limit}% limit for ${cond}. On press it can fail to dry, set off onto the next sheet, or crack on the fold. Lighten the darkest build, or ask the printer for their ink limit.`,
      evidence: { swatch: heaviest.name, tac: heaviest.tac, limit, over: heaviest.tac - limit, condition: name, format: c.fmt },
    });
  }
};

/** A brand black built RICH (heavy K plus real CMY): deep, but it mis-registers on
 *  fine text and thin rules, which want 100% K only. */
const checkRichBlack: Check = c => {
  if (!SEPARATING_FORMATS.has(c.fmt)) return;
  if (c.job?.palette?.known !== true) return;
  const pal = c.job.palette.value;
  if (!Array.isArray(pal)) return;
  for (const s of pal) {
    const w = swatchTac(s);
    if (!w) continue;
    const [cc, mm, yy, kk] = w.cmyk;
    if (kk >= 85 && (cc + mm + yy) >= 50) {
      c.add({
        id: 'print.rich-black',
        severity: 'info',
        message: `${w.name} is a rich black (${Math.round(kk)}% K plus ${Math.round(cc)}/${Math.round(mm)}/${Math.round(yy)} CMY). Rich black gives deep solids but mis-registers on small text and thin rules, so keep those 100% K only.`,
        evidence: { swatch: w.name, k: Math.round(kk), c: Math.round(cc), m: Math.round(mm), y: Math.round(yy), format: c.fmt },
      });
    }
  }
};

/**
 * The palette did not resolve, so the ceiling is WITHHELD.
 *
 * The web shell's `livePalette` falls back to the neutral starter palette when
 * `host.tokens.colors()` throws OR returns nothing, and the return type carries no
 * provenance, so a count taken from it can be measuring starter swatches while the
 * UI says "your brand". A collector must map both of those to
 * `{ known: false, why: 'not-resolved' }` rather than passing the fallback through.
 */
const checkPaletteUnresolved: Check = c => {
  if (!SEPARATING_FORMATS.has(c.fmt)) return;
  const p = c.job?.palette;
  if (!p || p.known !== false) return;
  c.add({
    id: 'plates.palette-unresolved',
    severity: 'info',
    needs: p.why,
    message: 'No brand palette resolved, so plate count is unavailable.',
    evidence: { format: c.fmt, why: p.why },
  });
};

// ─── Checks: cuts (a three-way conjunction, only one term of it static) ─────
//
// `cuts` multiplies the output only when the format is a still contact-sheet
// format AND the mounted node is a timed stage. Nothing in `tool.json` declares
// `[data-sequence]`, so headless it multiplies nothing knowable, and a 50-row CSV
// carrying `cuts=12` is 50 outputs rather than 600.

const cutsOf = (c: Ctx): number => {
  const n = c.job?.settings?.cuts;
  return isFiniteNum(n) && n > 1 ? Math.floor(n) : 0;
};

const checkCutsNeedsStage: Check = c => {
  const n = cutsOf(c);
  if (!n || c.job?.stage?.known !== false) return;
  c.add({
    id: 'count.cuts-needs-stage',
    severity: 'info',
    needs: 'needs-mount',
    message: `cuts=${n} is set. It multiplies the output only on a timed composition, which Lolly cannot tell without the artwork on screen. Counted as one file.`,
    evidence: { cuts: n, format: c.fmt },
  });
};

const checkCutsInert: Check = c => {
  const n = cutsOf(c);
  const st = c.job?.stage;
  if (!n || st?.known !== true) return;
  const seq = st.value?.isSequence === true;
  const fmtOk = CUTS_FORMATS.has(c.fmt);
  if (seq && fmtOk) return;
  const reason = !seq
    ? 'this tool is not a timed composition'
    : `${c.fmt || 'this format'} has no contact sheet`;
  c.add({
    id: 'count.cuts-inert',
    severity: 'info',
    message: `cuts=${n} is set but does nothing here: ${reason}. One file will come out.`,
    evidence: { cuts: n, format: c.fmt, isSequence: seq },
    count: { kind: 'outputFiles', value: 1, unit: 'file', bound: 'exact', basis: 'settings.cuts' },
  });
};

/**
 * A contact sheet actually applies.
 *
 * The DELIVERY is one file either way: the raster/SVG path zips N members, the
 * PDF path writes one N-page document. So `outputFiles` is 1, and for PDF the
 * quantity that is really N is `pages`. Emitting `outputFiles: N` made a
 * consumer summing a batch double-count downloads, and named the wrong kind for
 * PDF while `'pages'` was sitting in the vocabulary.
 */
const checkCutsApplies: Check = c => {
  const n = cutsOf(c);
  const st = c.job?.stage;
  if (!n || st?.known !== true || st.value?.isSequence !== true || !CUTS_FORMATS.has(c.fmt)) return;
  const pdf = c.fmt === 'pdf';
  c.add({
    id: 'count.cuts-applies',
    severity: 'info',
    message: `A contact sheet of ${n} frames, delivered as one ${pdf ? 'PDF' : 'ZIP'}.`,
    evidence: { cuts: n, format: c.fmt, delivery: pdf ? 'pdf' : 'zip' },
    count: { kind: 'outputFiles', value: 1, unit: 'file', bound: 'exact', basis: 'settings.cuts' },
  });
  if (pdf) {
    c.add({
      id: 'count.cuts-applies',
      severity: 'info',
      message: `${n} pages, one per frame.`,
      evidence: { cuts: n, format: c.fmt },
      count: { kind: 'pages', value: n, unit: 'page', bound: 'exact', basis: 'settings.cuts' },
    });
  }
};

// ─── Checks: export behaviour ───────────────────────────────────────────────

const checkExperimentalWatermark: Check = c => {
  if (c.job?.manifest?.status !== 'experimental') return;
  c.add({
    id: 'export.experimental-watermark',
    severity: 'info',
    message: 'This tool is experimental, so every export carries a watermark.',
    evidence: { status: 'experimental' },
  });
};

// ─── Named refusals ─────────────────────────────────────────────────────────
//
// Each is a `Finding` with `needs` set and NO count. They are refusals IN the
// report, not omissions FROM it. Every one is gated to the jobs where the
// question is actually asked: a report padded with irrelevant refusals is noise,
// and noise is how a real gap gets skipped.

const refusal = (id: FindingId, needs: UnknownReason, message: string, evidence?: Evidence): Finding =>
  ({ id, severity: 'info', needs, message, ...(evidence ? { evidence } : {}) });

const checkRefusals: Check = c => {
  const separating = SEPARATING_FORMATS.has(c.fmt);
  const motion = MOTION_FORMATS.has(c.fmt);

  if (separating) {
    c.add(refusal('refuse.ink-coverage', 'needs-render',
      'Total ink coverage across the whole artwork (photographs, gradients and filters) is only known once the separation is rendered. The heaviest brand solid is reported separately, and a photo can lay down more.'));
    c.add(refusal('refuse.exact-separation', 'needs-render',
      'The exact set of plates is only known once the file is written. Ink substitution is an exact colour match against brand swatches; everything else falls through to process, and images inside a CMYK PDF are not converted at all.'));
  }

  if (finishSpots(c).length > 0) {
    c.add(refusal('refuse.finish-covered-area', 'not-computable',
      'Lolly cannot measure the area a finish covers. The only area it can supply is the whole sheet through the press, not the varnished part of it.'));
  }

  c.add(refusal('refuse.output-file-size', 'not-computable',
    'Lolly cannot predict the output file size.'));

  if (motion) {
    c.add(refusal('refuse.render-time', 'not-computable',
      'Lolly cannot predict how long a render will take. Motion capture runs in real time.'));
    c.add(refusal('refuse.video-frames', 'needs-render',
      'Frame count and the frame rate actually used are decided while the export runs.'));
  }

  if (c.job?.stage?.known === false && (motion || cutsOf(c) > 0)) {
    c.add(refusal('refuse.sequence-duration', 'needs-mount',
      'Lolly cannot read the timeline length without the artwork on screen.'));
  }

  // Distinct from `print.trim-not-physical`: that one reports the pixels it CAN
  // see. This one fires when no size was declared anywhere, and says why the
  // tool's pixel canvas is not being converted into millimetres. As with
  // trim-not-physical, the dual-use vector formats (svg/eps/eps-cmyk) only speak up
  // with print intent, so a plain screen-size SVG export isn't refused per row.
  const svgLike = c.fmt === 'svg' || c.fmt === 'eps' || c.fmt === 'eps-cmyk';
  if (PRINT_MARK_FORMATS.has(c.fmt) && c.job?.settings?.size?.declaredBy === 'manifest'
      && (!svgLike || marksAreSet(c))) {
    c.add(refusal('refuse.trim-when-unset', 'not-set',
      'No page size was set, so the trim size is whatever the artwork measures on screen. Lolly is not converting the tool\'s pixel canvas into millimetres.'));
  }
};

// ─── Registry ───────────────────────────────────────────────────────────────

/** Every check, in emission order. Severity ordering happens afterwards. */
const CHECKS: readonly Check[] = [
  // errors
  checkFinishSeparatesAsInk,
  checkFinishFlattened,
  checkFormatOffered,
  // warnings
  checkRequiredBlank,
  checkNumberRange,
  checkTextMaxLength,
  checkSelectValue,
  checkVectorClamped,
  checkPrintMarksOnNonPrintFormat,
  checkPressProfileOnNonSeparatingFormat,
  checkHdrFormat,
  checkDurableFormat,
  checkAspectGuard,
  checkNoBleed,
  checkEffectiveDpi,
  checkImageEffectiveDpi,
  // info: geometry & counts
  checkFinishUnknownKind,
  checkBleedUnknown,
  checkTrimPartial,
  checkImageDpiNeedsStage,
  checkTrimNotPhysical,
  checkPrintGeometry,
  checkPagesPaginate,
  checkPagesPages,
  checkPagesFromStage,
  checkPagesUnknown,
  checkRasterPixels,
  checkSequenceDuration,
  checkVideoDurationDeclared,
  checkProcessPlates,
  checkSpotCeiling,
  checkFinishCeiling,
  checkNoSpotsDeclared,
  checkInkCoverage,
  checkRichBlack,
  checkPaletteUnresolved,
  checkCutsNeedsStage,
  checkCutsInert,
  checkCutsApplies,
  checkExperimentalWatermark,
  // named refusals, last
  checkRefusals,
];

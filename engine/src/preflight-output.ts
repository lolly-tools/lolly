// SPDX-License-Identifier: MPL-2.0
/**
 * The export report: each requested property beside the value read from the
 * finished file.
 *
 * `preflight.ts` states what a job's settings will produce before anything
 * renders. This module runs after the export: `output-facts.ts` reads the
 * output bytes, and the checks here compare those facts with the request. The
 * result is an `ExportReport` (`@lolly-tools/core`), bound by SHA-256 to the
 * exact bytes it describes.
 *
 * The same honesty rules as preflight apply:
 *
 * 1. **Measured values come from the bytes.** A request is never echoed back
 *    as an actual value. When the file cannot answer, the check is
 *    `unchecked` and a gap finding records why.
 * 2. **Nothing requested, nothing compared.** A manifest default is not a
 *    request, so its property is `reported`, never `match`.
 * 3. **Separate statements stay separate.** A credential that is present is
 *    not a verified credential, and an alpha channel is not a transparent
 *    pixel. The report carries those sentences on every run.
 * 4. **Total.** `compareExport` never throws; a check that fails to complete
 *    leaves a `check.incomplete` gap, exactly as in preflight.
 */

import type {
  ExportCheck, ExportReport, ExportValue, Fact, Finding, UnknownReason,
} from '@lolly-tools/core';
import { SEVERITY_RANK } from '@lolly-tools/core';
import type { Dimension } from './units.ts';
import { toPixels, toPoints } from './units.ts';
import type { PrintMarksFlags } from './print-marks.ts';
import { computePrintGeometry } from './print-marks.ts';
import { acceptedFormats, SNIFFED_FORMAT_LABEL } from './format-sniff.ts';
import { inspectOutput, type OutputFacts } from './output-facts.ts';
import type { PreflightJob } from './preflight.ts';
import { CUTS_FORMATS, HDR_FORMATS, MOTION_FORMATS, RASTER_FORMATS, SEPARATING_FORMATS } from './preflight.ts';
import { sha256Hex } from './bytes.ts';
import { ENGINE_VERSION } from './version.ts';

export type { ExportCheck, ExportReport, ExportValue } from '@lolly-tools/core';

/**
 * What an export was asked to produce, as far as the shell knows.
 *
 * Every member except `format` is optional and absent means "not requested".
 * A shell leaves out anything it did not genuinely ask for: a size that came
 * from the manifest, a duration the stage chose, a credential nobody set.
 */
export interface ExportRequest {
  /** The requested format id (`png`, `pdf-cmyk`, `mp4`, ...). */
  readonly format: string;
  /** The requested size, in the unit the request used. */
  readonly size?: { readonly width: Dimension; readonly height: Dimension; readonly dpi: number };
  readonly bleed?: Dimension | null;
  readonly marks?: PrintMarksFlags | null;
  /** The exact page count expected. */
  readonly pages?: number;
  /** The clip length expected, in milliseconds. */
  readonly durationMs?: number;
  readonly alpha?: 'transparent' | 'opaque';
  /** True when Content Credentials were asked for, false when they were turned off. */
  readonly credential?: boolean;
  /** A password was set. The value itself never reaches the engine. */
  readonly password?: boolean;
  readonly hdr?: boolean;
  /** A destination's byte limit. */
  readonly maxBytes?: number;
  /** The shell bundled several files into one ZIP: a contact sheet, a page fan-out or sidecars. */
  readonly archive?: boolean;
  /** The stage holds this many boards, so a requested size describes one board, not the file. */
  readonly boards?: number;
}

/** Formats whose size is a page in points rather than a pixel count. */
const PAGE_FORMATS: ReadonlySet<string> = new Set(['pdf', 'pdf-cmyk', 'eps', 'eps-cmyk']);
/** Video containers. Their durations come from the container's own timing. */
const VIDEO_FORMATS: ReadonlySet<string> = new Set(['mp4', 'webm']);
/** Formats compared by pixel count: every raster plus video. */
const PIXEL_FORMATS: ReadonlySet<string> = new Set([...RASTER_FORMATS, ...VIDEO_FORMATS, 'webp-anim']);
/** Formats Lolly encrypts when a password is set. */
const ENCRYPTABLE_FORMATS: ReadonlySet<string> = new Set(['pdf', 'pdf-cmyk', 'zip']);
/** Containers that can record a resolution. Elsewhere only the pixel count travels. */
const DPI_CONTAINERS: ReadonlySet<string> = new Set(['png', 'apng', 'jpg', 'tiff']);
/** The fixed sentences every report carries. */
export const EXPORT_REPORT_STATEMENTS: readonly string[] = [
  'Every measured value in this report was read from the file identified by output.sha256. A copy that differs by one byte needs a new report.',
  'A Content Credentials manifest that is present has not been verified here. Its presence, the integrity of its signature and the truth of what it records are separate questions.',
  'An alpha channel means the file can hold transparency. It does not show that any pixel is transparent.',
  'A value this report could not read is listed as a gap. A gap is not a pass.',
];

const isDim = (d: unknown): d is Dimension =>
  !!d && typeof d === 'object' && typeof (d as Dimension).value === 'number' && Number.isFinite((d as Dimension).value)
  && (d as Dimension).value > 0 && typeof (d as Dimension).unit === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * The request a preflight job describes, plus anything the shell adds.
 *
 * Only what the job genuinely requested carries over: a size declared by the
 * manifest is left out, and so is a size whose unit the source never stated.
 * `extra` wins over the job, so a shell can add a duration or an alpha choice,
 * or remove a member by passing it as `undefined`.
 */
export function exportRequestFromJob(job: PreflightJob, extra: Partial<ExportRequest> = {}): ExportRequest {
  const s = job?.settings;
  const format = typeof s?.format === 'string' ? s.format.toLowerCase() : '';
  const size = s?.size;
  const sized = !!size && size.declaredBy !== 'manifest' && isDim(size.width) && isDim(size.height)
    && (size.width.unit === 'px' || size.unitDeclared === true) && isNum(size.dpi) && size.dpi > 0;
  const stage = job?.stage?.known === true ? job.stage.value : null;
  const boards = stage && isNum(stage.pageBoxes) && stage.pageBoxes > 1 ? stage.pageBoxes : undefined;
  const sequenceMs = stage?.isSequence && isNum(stage.durationMs) && stage.durationMs > 0 ? stage.durationMs : undefined;
  const fromJob: ExportRequest = {
    format,
    ...(sized ? { size: { width: size.width, height: size.height, dpi: size.dpi } } : {}),
    ...(s?.bleed?.known === true ? { bleed: isDim(s.bleed.value) ? s.bleed.value : null } : {}),
    ...(s?.marks?.known === true ? { marks: s.marks.value ?? null } : {}),
    ...(s?.c2pa?.known === true ? { credential: s.c2pa.value === true } : {}),
    ...(s?.password === true ? { password: true } : {}),
    ...(s?.hdr === true ? { hdr: true } : {}),
    ...(MOTION_FORMATS.has(format) && sequenceMs !== undefined ? { durationMs: sequenceMs } : {}),
    ...(isNum(s?.cuts) && s.cuts > 1 && stage?.isSequence && CUTS_FORMATS.has(format) ? { archive: true } : {}),
    ...(boards !== undefined ? { boards } : {}),
  };
  return { ...fromJob, ...extra, format: typeof extra.format === 'string' ? extra.format.toLowerCase() : format };
}

// ─── The comparison ─────────────────────────────────────────────────────────

interface Ctx {
  readonly req: ExportRequest;
  readonly fmt: string;
  readonly facts: OutputFacts;
  readonly checks: ExportCheck[];
  readonly findings: Finding[];
}

const known = <T extends ExportValue>(value: T): Fact<ExportValue> => ({ known: true, value });
const notSet: Fact<ExportValue> = { known: false, why: 'not-set' };
const asValue = <T extends ExportValue>(f: Fact<T>): Fact<ExportValue> => f;

/** Format a number for a message: at most two decimals, no trailing noise. */
const num = (n: number): string => String(Math.round(n * 100) / 100);
const seconds = (ms: number): string => `${num(ms / 1000)} s`;
const LABEL: Readonly<Record<string, string>> = {
  format: 'container format', bytes: 'file size', width: 'pixel width', height: 'pixel height',
  'page-width': 'page width', 'page-height': 'page height', pages: 'page count', dpi: 'resolution',
  duration: 'duration', frames: 'frame count', alpha: 'alpha channel', colour: 'colour model',
  hdr: 'HDR signalling', credential: 'Content Credentials manifest', encryption: 'encryption',
};

/**
 * Push one check, and the gap finding when something was requested and the
 * bytes could not answer.
 */
function check(c: Ctx, row: ExportCheck): void {
  c.checks.push(row);
  if (row.state !== 'unchecked' || !row.requested.known) return;
  const why: UnknownReason = row.actual.known ? 'not-computable' : row.actual.why;
  const label = LABEL[row.property] ?? row.property;
  c.findings.push({
    id: 'output.unverified', severity: 'info', needs: why,
    message: why === 'not-computable'
      ? `This file does not record its ${label}, so the request was not compared.`
      : `The ${label} could not be read from the file, so the request was not compared.`,
    evidence: { property: row.property, basis: row.basis },
  });
}

/** Whether a row is worth listing: something was requested, or the bytes said something. */
const listable = (requested: Fact<ExportValue>, actual: Fact<unknown>): boolean =>
  requested.known || actual.known || actual.why !== 'not-computable';

type Check = (c: Ctx) => void;

const checkFormat: Check = c => {
  const want = c.req.archive ? ['zip' as const] : acceptedFormats(c.fmt);
  const got = c.facts.container;
  const requested = known(c.req.archive ? 'zip' : c.fmt);
  const actual: Fact<ExportValue> = got ? known(got) : { known: false, why: 'not-computable' };
  if (!want || !got) {
    c.checks.push({ property: 'format', requested, actual, state: 'unchecked', basis: 'signature' });
    c.findings.push({
      id: 'output.unverified', severity: 'info', needs: 'not-computable',
      message: !want
        ? `The ${c.fmt || 'requested'} format has no byte signature to compare, so the container was not checked.`
        : 'The file matches no known byte signature, so the container was not checked.',
      evidence: { property: 'format', requested: c.req.archive ? 'zip' : c.fmt },
    });
    return;
  }
  const ok = (want as readonly string[]).includes(got);
  check(c, { property: 'format', requested, actual, state: ok ? 'match' : 'differs', basis: 'signature' });
  if (!ok) {
    c.findings.push({
      id: 'output.format-differs', severity: 'warn',
      message: `The file is ${SNIFFED_FORMAT_LABEL[got]}, not the ${c.req.archive ? 'ZIP' : c.fmt} that was requested.`,
      evidence: { requested: c.req.archive ? 'zip' : c.fmt, actual: got },
    });
  }
};

const checkBytes: Check = c => {
  const max = isNum(c.req.maxBytes) && c.req.maxBytes > 0 ? c.req.maxBytes : undefined;
  const size = c.facts.bytes;
  const state = max === undefined ? 'reported' : size <= max ? 'match' : 'differs';
  check(c, { property: 'bytes', requested: max === undefined ? notSet : known(max), actual: known(size), state, basis: 'byte-length' });
  if (state === 'differs') {
    c.findings.push({
      id: 'output.over-byte-budget', severity: 'error',
      message: `The file is ${size} bytes, over the ${max} byte limit.`,
      evidence: { bytes: size, maxBytes: max! },
    });
  }
};

/** One size pair, compared with a tolerance, and its single finding when either side differs. */
function sizePair(c: Ctx, props: readonly [string, string], expected: [number, number] | null, actual: [Fact<number>, Fact<number>], basis: string, tolerance: number, describe: (a: [number, number], e: [number, number]) => string, id: string, skip?: string): void {
  let differs = false;
  for (let i = 0; i < 2; i++) {
    const want = expected?.[i];
    const got = actual[i]!;
    const requested = want === undefined ? notSet : known(Math.round(want * 100) / 100);
    if (!listable(requested, got)) continue;
    if (skip && want !== undefined) {
      // Not compared on purpose; the one explanatory gap follows the loop.
      c.checks.push({ property: props[i]!, requested, actual: asValue(got), state: 'unchecked', basis });
      continue;
    }
    const state = want === undefined ? 'reported' : !got.known ? 'unchecked' : Math.abs(got.value - want) <= tolerance ? 'match' : 'differs';
    if (state === 'differs') differs = true;
    check(c, { property: props[i]!, requested, actual: asValue(got), state, basis, ...(want === undefined ? {} : { tolerance }) });
  }
  if (skip && expected) {
    c.findings.push({ id: 'output.unverified', severity: 'info', needs: 'not-computable', message: skip, evidence: { property: props[0] } });
  }
  if (differs && expected && actual[0].known && actual[1].known) {
    c.findings.push({
      id, severity: 'warn', message: describe([actual[0].value, actual[1].value], expected),
      evidence: { actualWidth: actual[0].value, actualHeight: actual[1].value, expectedWidth: Math.round(expected[0] * 100) / 100, expectedHeight: Math.round(expected[1] * 100) / 100, basis },
    });
  }
}

const checkSize: Check = c => {
  const { req, fmt, facts } = c;
  const size = req.size;
  const skip = req.archive
    ? 'The file is a ZIP of several outputs, so the requested size was not compared with it.'
    : isNum(req.boards) && req.boards > 1
      ? 'The requested size describes one board and this export holds several, so it was not compared.'
      : undefined;
  const physicalRequest = !!size && size.width.unit !== 'px';
  const pixels: [number, number] | null = size && PIXEL_FORMATS.has(fmt)
    ? [toPixels(size.width, size.dpi), toPixels(size.height, size.dpi)]
    : size && fmt === 'svg' && !physicalRequest ? [size.width.value, size.height.value] : null;
  if (PIXEL_FORMATS.has(fmt) || fmt === 'svg' || facts.width.known) {
    sizePair(c, ['width', 'height'], pixels, [facts.width, facts.height], facts.basis.width ?? 'pixel-size', 1,
      (a, e) => `The file is ${num(a[0])} x ${num(a[1])} pixels; ${num(e[0])} x ${num(e[1])} was requested.`,
      'output.size-differs', pixels ? skip : undefined);
  }
  const pageWanted = !!size && (PAGE_FORMATS.has(fmt) || (fmt === 'svg' && physicalRequest));
  if (!pageWanted && !facts.page.known) return;
  let expected: [number, number] | null = null;
  if (pageWanted && size) {
    const trimW = toPoints(size.width), trimH = toPoints(size.height);
    expected = [trimW, trimH];
    const bleedPt = isDim(req.bleed) ? toPoints(req.bleed) : 0;
    const marks = req.marks ?? {};
    const anyMark = Object.values(marks).some(Boolean);
    if (facts.page.known && facts.page.value.box !== 'TrimBox' && fmt !== 'svg' && (bleedPt > 0 || anyMark)) {
      const geo = computePrintGeometry({ trimWpt: trimW, trimHpt: trimH, bleedPt, marks });
      expected = [geo.page.w, geo.page.h];
    }
  }
  const page = facts.page;
  const pw: Fact<number> = page.known ? { known: true, value: page.value.width } : page;
  const ph: Fact<number> = page.known ? { known: true, value: page.value.height } : page;
  const unit = size && size.width.unit !== 'px' ? size.width.unit : 'pt';
  const inUnit = (pt: number): string => unit === 'mm' ? num((pt / 72) * 25.4) : unit === 'cm' ? num((pt / 72) * 2.54) : unit === 'in' ? num(pt / 72) : num(pt);
  const unitLabel = unit === 'mm' || unit === 'cm' || unit === 'in' ? unit : 'pt';
  sizePair(c, ['page-width', 'page-height'], expected, [pw, ph], facts.basis.page ?? 'page-box', 1,
    (a, e) => `The page is ${inUnit(a[0])} x ${inUnit(a[1])} ${unitLabel}; ${inUnit(e[0])} x ${inUnit(e[1])} ${unitLabel} was requested.`,
    'output.page-size-differs', expected ? skip : undefined);
  if (page.known && !page.value.uniform) {
    c.findings.push({
      id: 'output.page-size-differs', severity: 'info',
      message: 'Pages in this file have different sizes. The size compared is the first page.',
      evidence: { box: page.value.box },
    });
  }
};

const checkPages: Check = c => {
  const want = isNum(c.req.pages) && c.req.pages > 0 ? c.req.pages : undefined;
  const got = c.facts.pages;
  const requested = want === undefined ? notSet : known(want);
  if (!listable(requested, got)) return;
  const state = want === undefined ? 'reported' : !got.known ? 'unchecked' : got.value === want ? 'match' : 'differs';
  check(c, { property: 'pages', requested, actual: asValue(got), state, basis: c.facts.basis.pages ?? 'pages' });
  if (state === 'differs' && got.known) {
    c.findings.push({ id: 'output.pages-differ', severity: 'warn', message: `The file has ${got.value} page${got.value === 1 ? '' : 's'}; ${want} ${want === 1 ? 'was' : 'were'} expected.`, evidence: { actual: got.value, expected: want! } });
  }
};

const checkDpi: Check = c => {
  const { req, facts, fmt } = c;
  const want = req.size && req.size.width.unit !== 'px' && PIXEL_FORMATS.has(fmt) && !VIDEO_FORMATS.has(fmt) && !req.archive ? req.size.dpi : undefined;
  const got = facts.dpi;
  const requested = want === undefined ? notSet : known(want);
  if (!listable(requested, got)) return;
  const canRecord = !!facts.container && DPI_CONTAINERS.has(facts.container);
  if (want !== undefined && !got.known && got.why === 'not-set' && canRecord) {
    check(c, { property: 'dpi', requested, actual: asValue(got), state: 'differs', basis: facts.basis.dpi ?? 'resolution' });
    c.findings.push({ id: 'output.dpi-missing', severity: 'warn', message: `The file records no resolution, so other applications will assume one instead of ${want} DPI and place it at a different physical size.`, evidence: { expected: want } });
    return;
  }
  const state = want === undefined ? 'reported' : !got.known ? 'unchecked' : Math.abs(got.value - want) <= 0.5 ? 'match' : 'differs';
  check(c, { property: 'dpi', requested, actual: asValue(got), state, basis: facts.basis.dpi ?? 'resolution', ...(want === undefined ? {} : { tolerance: 0.5 }) });
  if (state === 'differs' && got.known) {
    c.findings.push({ id: 'output.dpi-differs', severity: 'warn', message: `The file records ${num(got.value)} DPI; ${want} was requested, so it will be placed at a different physical size.`, evidence: { actual: got.value, expected: want! } });
  }
};

const checkTiming: Check = c => {
  const { req, facts, fmt } = c;
  // A length applies to a format that carries timing; a still has none to compare.
  const timed = MOTION_FORMATS.has(fmt) || fmt === 'webp-anim';
  const want = timed && isNum(req.durationMs) && req.durationMs > 0 && !req.archive ? req.durationMs : undefined;
  const got = facts.durationMs;
  const requested = want === undefined ? notSet : known(want);
  if (listable(requested, got)) {
    const tolerance = want === undefined ? 0 : VIDEO_FORMATS.has(fmt) ? Math.max(120, want * 0.02) : Math.max(250, want * 0.1);
    const state = want === undefined ? 'reported' : !got.known ? 'unchecked' : Math.abs(got.value - want) <= tolerance ? 'match' : 'differs';
    check(c, { property: 'duration', requested, actual: asValue(got), state, basis: facts.basis.durationMs ?? 'timing', ...(want === undefined ? {} : { tolerance: Math.round(tolerance) }) });
    if (state === 'differs' && got.known) {
      c.findings.push({ id: 'output.duration-differs', severity: 'warn', message: `The file runs ${seconds(got.value)}; ${seconds(want!)} was requested.`, evidence: { actualMs: got.value, expectedMs: want! } });
    }
  }
  const frames = facts.frames;
  const animated = want !== undefined;
  const fr = animated ? known('animated') : notSet;
  if (!listable(fr, frames)) return;
  const state = !animated ? 'reported' : !frames.known ? 'unchecked' : frames.value > 1 ? 'match' : 'differs';
  check(c, { property: 'frames', requested: fr, actual: asValue(frames), state, basis: facts.basis.frames ?? 'frames' });
  if (state === 'differs') {
    c.findings.push({ id: 'output.animation-flattened', severity: 'warn', message: `The file holds a single frame; a ${seconds(want!)} animation was requested.`, evidence: { expectedMs: want! } });
  }
};

const checkAlpha: Check = c => {
  const want = c.req.alpha === 'transparent' || c.req.alpha === 'opaque' ? c.req.alpha : undefined;
  const got = c.facts.alpha;
  const requested = want === undefined ? notSet : known(want === 'transparent');
  if (!listable(requested, got)) return;
  // An alpha channel in an opaque request is not a difference: the channel can be fully opaque.
  const state = want === undefined ? 'reported' : !got.known ? 'unchecked' : want === 'opaque' || got.value ? 'match' : 'differs';
  check(c, { property: 'alpha', requested, actual: asValue(got), state, basis: c.facts.basis.alpha ?? 'alpha' });
  if (state === 'differs') {
    c.findings.push({ id: 'output.alpha-lost', severity: 'warn', message: 'The file has no alpha channel, so the transparent background was filled.', evidence: { container: c.facts.container } });
  }
};

const checkColour: Check = c => {
  const want = SEPARATING_FORMATS.has(c.fmt) ? 'cmyk' : undefined;
  const got = c.facts.colour;
  const requested = want === undefined ? notSet : known(want);
  if (!listable(requested, got)) return;
  const state = want === undefined ? 'reported' : !got.known ? 'unchecked' : got.value === 'cmyk' || got.value === 'gray' ? 'match' : 'differs';
  check(c, { property: 'colour', requested, actual: asValue(got), state, basis: c.facts.basis.colour ?? 'colour' });
  if (state !== 'differs' || !got.known) return;
  c.findings.push(got.value === 'mixed'
    ? { id: 'output.colour-model-differs', severity: 'warn', message: 'The file mixes RGB and CMYK colour; a CMYK separation was requested. A RIP converts the RGB parts with its own settings.', evidence: { actual: got.value } }
    : { id: 'output.colour-model-differs', severity: 'error', message: `The file is ${got.value === 'rgb' ? 'RGB' : got.value}; a CMYK separation was requested.`, evidence: { actual: got.value } });
};

const checkIcc: Check = c => {
  if (!listable(notSet, c.facts.icc)) return;
  check(c, { property: 'icc', requested: notSet, actual: asValue(c.facts.icc), state: 'reported', basis: c.facts.basis.icc ?? 'icc' });
};

const checkHdr: Check = c => {
  const capable = HDR_FORMATS.has(c.fmt) || VIDEO_FORMATS.has(c.fmt);
  const want = c.req.hdr === true && capable ? true : undefined;
  const got = c.facts.hdr;
  const requested = want === undefined ? notSet : known(true);
  if (!listable(requested, got)) return;
  const state = want === undefined ? 'reported' : !got.known ? 'unchecked' : got.value ? 'match' : 'differs';
  check(c, { property: 'hdr', requested, actual: asValue(got), state, basis: c.facts.basis.hdr ?? 'hdr' });
  if (state === 'differs') {
    c.findings.push({ id: 'output.hdr-not-signalled', severity: 'warn', message: 'The file does not signal HDR, so viewers will show it as standard dynamic range.', evidence: { container: c.facts.container } });
  }
};

const checkMetadata: Check = c => {
  if (!listable(notSet, c.facts.metadata)) return;
  check(c, { property: 'metadata', requested: notSet, actual: asValue(c.facts.metadata), state: 'reported', basis: c.facts.basis.metadata ?? 'metadata' });
};

const checkCredential: Check = c => {
  const want = typeof c.req.credential === 'boolean' ? c.req.credential : undefined;
  const got = c.facts.credential;
  const requested = want === undefined ? notSet : known(want);
  if (!listable(requested, got)) return;
  const state = want === undefined ? 'reported' : !got.known ? 'unchecked' : got.value === want ? 'match' : 'differs';
  check(c, { property: 'credential', requested, actual: asValue(got), state, basis: c.facts.basis.credential ?? 'c2pa-store' });
  if (state !== 'differs') return;
  c.findings.push(want
    ? { id: 'output.credential-missing', severity: 'warn', message: 'No Content Credentials manifest was found in the file, although one was requested.', evidence: { container: c.facts.container } }
    : { id: 'output.credential-present', severity: 'info', message: 'The file carries a Content Credentials manifest although none was requested. The tool may have signed its own output.', evidence: { container: c.facts.container } });
};

const checkEncryption: Check = c => {
  // A password applies only where Lolly writes one: PDF and ZIP. Elsewhere it was never part of the export.
  const want = c.req.password === true && ENCRYPTABLE_FORMATS.has(c.fmt) ? true : undefined;
  const got = c.facts.encrypted;
  const requested = want === undefined ? notSet : known(true);
  if (!listable(requested, got)) return;
  const state = want === undefined ? 'reported' : !got.known ? 'unchecked' : got.value ? 'match' : 'differs';
  check(c, { property: 'encryption', requested, actual: asValue(got), state, basis: c.facts.basis.encrypted ?? 'encryption' });
  if (state === 'differs') {
    c.findings.push({ id: 'output.encryption-missing', severity: 'error', message: 'The file is not encrypted, although a password was set. Anyone who receives it can open it.', evidence: { container: c.facts.container } });
  }
};

const checkFonts: Check = c => {
  const { fonts, liveText, fontFaces } = c.facts;
  if (fonts.known) {
    const { declared, embedded, standard } = fonts.value;
    const missing = Math.max(0, declared - embedded);
    check(c, { property: 'fonts', requested: notSet, actual: known(missing), state: 'reported', basis: c.facts.basis.fonts ?? 'fonts' });
    const other = Math.max(0, missing - standard);
    if (other > 0) {
      c.findings.push({ id: 'output.fonts-not-embedded', severity: 'warn', message: `${other} font${other === 1 ? ' is' : 's are'} not embedded, so a viewer substitutes its own.`, evidence: { declared, embedded, standard } });
    } else if (standard > 0) {
      const pdfx = SEPARATING_FORMATS.has(c.fmt);
      c.findings.push({
        id: 'output.fonts-not-embedded', severity: pdfx ? 'warn' : 'info',
        message: pdfx
          ? `${standard} standard font${standard === 1 ? ' is' : 's are'} not embedded. PDF/X requires every font to be embedded.`
          : `${standard} standard font${standard === 1 ? ' is' : 's are'} not embedded. PDF viewers supply these faces.`,
        evidence: { declared, embedded, standard },
      });
    }
  }
  if (liveText.known) {
    check(c, { property: 'live-text', requested: notSet, actual: known(liveText.value), state: 'reported', basis: c.facts.basis.liveText ?? 'live-text' });
    if (liveText.value > 0) {
      const faces = fontFaces.known ? fontFaces.value : 0;
      c.findings.push({
        id: 'output.live-text', severity: 'info',
        message: faces > 0
          ? `${liveText.value} text element${liveText.value === 1 ? '' : 's'} stay live text. The file carries ${faces} font face rule${faces === 1 ? '' : 's'}; a viewer that does not load them draws another face.`
          : `${liveText.value} text element${liveText.value === 1 ? '' : 's'} stay live text, so a viewer without the font draws another face.`,
        evidence: { liveText: liveText.value, fontFaces: faces },
      });
    }
  }
};

const checkNature: Check = c => {
  if (!listable(notSet, c.facts.nature)) return;
  check(c, { property: 'nature', requested: notSet, actual: asValue(c.facts.nature), state: 'reported', basis: c.facts.basis.nature ?? 'nature' });
};

const CHECKS: readonly (readonly [string, Check])[] = [
  ['format', checkFormat], ['bytes', checkBytes], ['size', checkSize], ['pages', checkPages],
  ['dpi', checkDpi], ['timing', checkTiming], ['nature', checkNature], ['alpha', checkAlpha],
  ['colour', checkColour], ['icc', checkIcc], ['hdr', checkHdr], ['metadata', checkMetadata],
  ['credential', checkCredential], ['encryption', checkEncryption], ['fonts', checkFonts],
];

/**
 * Compare a request with facts already read from the output.
 *
 * Pure, synchronous and total. Findings come back severity-ordered and stable
 * within a severity; a check that throws is replaced by a `check.incomplete` gap.
 */
export function compareExport(request: ExportRequest, facts: OutputFacts): { checks: ExportCheck[]; findings: Finding[] } {
  const req: ExportRequest = request && typeof request === 'object' ? request : { format: '' };
  const c: Ctx = { req, fmt: typeof req.format === 'string' ? req.format.toLowerCase() : '', facts, checks: [], findings: [] };
  for (const [id, run] of CHECKS) {
    const checksAt = c.checks.length, findingsAt = c.findings.length;
    try { run(c); } catch {
      c.checks.length = checksAt; c.findings.length = findingsAt;
      c.findings.push({ id: 'check.incomplete', severity: 'info', needs: 'not-resolved', message: `The ${id} check could not complete.`, evidence: { check: id } });
    }
  }
  const findings = c.findings
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (SEVERITY_RANK[a.f.severity] - SEVERITY_RANK[b.f.severity]) || (a.i - b.i))
    .map(({ f }) => f);
  return { checks: c.checks, findings };
}

/** The request as plain values, for the report's `requested` echo. */
function echo(req: ExportRequest): Record<string, ExportValue> {
  const out: Record<string, ExportValue> = { format: typeof req.format === 'string' ? req.format.toLowerCase() : '' };
  if (req.size && isDim(req.size.width) && isDim(req.size.height)) {
    out.width = req.size.width.value; out.height = req.size.height.value;
    out.unit = req.size.width.unit; out.dpi = isNum(req.size.dpi) ? req.size.dpi : null;
  }
  if (req.bleed !== undefined) out.bleed = isDim(req.bleed) ? `${req.bleed.value}${req.bleed.unit}` : null;
  if (req.marks !== undefined) out.marks = req.marks ? Object.entries(req.marks).filter(([, on]) => on).map(([k]) => k).sort().join(',') : null;
  for (const key of ['pages', 'durationMs', 'maxBytes', 'boards'] as const) if (isNum(req[key])) out[key] = req[key]!;
  for (const key of ['credential', 'password', 'hdr', 'archive'] as const) if (typeof req[key] === 'boolean') out[key] = req[key]!;
  if (req.alpha === 'transparent' || req.alpha === 'opaque') out.alpha = req.alpha;
  return out;
}

/**
 * Read the output bytes and compare them with the request.
 *
 * The report's `output.sha256` is computed over the same bytes the facts were
 * read from, so the report describes exactly one file.
 */
export async function verifyExport(request: ExportRequest, bytes: Uint8Array): Promise<ExportReport> {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
  const facts = inspectOutput(input);
  const { checks, findings } = compareExport(request, facts);
  return {
    $format: 'lolly-export-report',
    formatVersion: 1,
    engine: ENGINE_VERSION,
    output: { sha256: await sha256Hex(input), bytes: input.length, container: facts.container },
    requested: echo(request && typeof request === 'object' ? request : { format: '' }),
    checks,
    findings,
    gaps: findings.filter(f => !!f.needs),
    statements: EXPORT_REPORT_STATEMENTS,
  };
}

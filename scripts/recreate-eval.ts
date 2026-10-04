#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Grade a deck an agent rebuilt on brand (plan 291 W10), against a case of
 * `skills/lolly/evals/recreate.json`.
 *
 * Run as: pnpm run eval:recreate -- <output-dir> [--case=<id>] [--eval=<recreate.json>] [--source=<deck>] [--edits=<edits.json>] [--file=<tokens.json>] [--profile=<name>] [--browser=auto|off|require] [--acceptance] [--label=<run label>] [--out=<score.json>] [--json]
 *      or: node scripts/recreate-eval.ts <output-dir> [same flags]
 *
 * The output folder holds what the agent delivered: a `.lolly` and a `.pptx` per
 * theme, named with the theme as a word of the file name (`harbour-light.lolly`,
 * `Harbour dark.pptx`), and optionally `edits.json`, the strings it changed or dropped
 * on purpose (`[{ source, result?, reason }]`, the shape `lolly check --edits` reads).
 * A `delivery.json` beside them (`{ "files": { "<name>": "<theme>" } }`) gives the
 * themes when the file names do not. One `.lolly` made for every theme (plan 291 M4)
 * is listed with its themes (`"harbour.lolly": ["light", "dark"]`) and is scored, and
 * checked, once per theme.
 *
 * The source deck is read once with `readContentInventory` (what `lolly read` runs),
 * and every delivered file goes through `checkFile` (what `lolly check` runs) against
 * that inventory, the declared edits and the case's design system. Each `.lolly` is
 * then read back in Node (a saved Design session, its rows, its label, and every
 * carried picture hashing to its ref), and reopened through the web shell's `#/open`
 * route when a browser and a web shell are on this machine; when they are not, the
 * reopen is reported as not run, which passes unless `--browser=require`.
 *
 * Gates (decision E13): no check error in any file; no missing source string or
 * speaker note once the declared edits are excepted; every file has the source's
 * slide count; every theme of the case delivered in every format; every `.lolly`
 * reads back and reopens; and a well-formed edits.json when one is given. Verify
 * findings, draft house-rule findings, colour review, undeclared edits, the notes'
 * line structure, the frame grounds against the theme and any scaffolding scripts
 * left in the folder are reported. --acceptance also gates on zero Verify and
 * house-rule findings, painted and reopened themes, unchanged note line structure
 * and theme grounds, accounted edits, no scaffolding, and one shared document.
 *
 * The case's design system is resolved explicitly (`--file`, else the case's
 * `designSystem`), never through the CLI's terminal-system ladder, and recorded in
 * the score. A profile whose pack is not on this machine ends the run with exit 2.
 * The score JSON goes to stdout with `--json` and to `--out=<file>` when given; the
 * one-paragraph summary goes to stdout otherwise. Nothing is written into the tree
 * unless `--out` points there. Exit 0 when every gate passes, 1 when one does not,
 * 2 on a usage error (an eval case the scorer cannot hold to its `pass`, or a folder,
 * source deck, design system or `--out` path it cannot use), and 3 when the scorer
 * itself could not finish or could not write the score. A case gates only on the
 * gates its `pass` names, each at the one threshold the scorer supports.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeZipMember, readZipMembers, type ZipRawMember } from '../engine/src/zip.ts';
import { createTokenSet } from '../engine/src/tokens.ts';

import { boxesInTheme, checkFile, parseFidelityEdits } from '../packages/node-shell/src/check.ts';
import { readContentInventory } from '../packages/node-shell/src/content-inventory.ts';
import { readPptxBrand, type PptxSlideGround } from '../packages/node-shell/src/check-pptx-brand.ts';
import { readBriefCatalogFor, readProfileBriefCatalog, readProfileTokenDocument } from '../packages/node-shell/src/design-brief.ts';
import { readLollyFile } from '../packages/node-shell/src/lolly-file.ts';
import type { DesignBriefCatalogV1 } from '../engine/src/design-brief.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';
import { withSlideLayoutComponents } from '../engine/src/slide-layout-components.ts';
import { darkVariantOf } from '../engine/src/slide-structures.ts';
import type { ArchetypeV1, SlideMasterV1 } from '../packages/core/src/slide-master-v1.ts';
import type { CheckFidelityEditV1, CheckReportV1, ContentInventoryV1 } from '../packages/core/src/index.ts';

// ─── the case ────────────────────────────────────────────────────────────────

const REPO = fileURLToPath(new URL('../', import.meta.url));
/** The eval file this script grades against by default. */
export const RECREATE_EVAL_FILE = path.join(REPO, 'skills', 'lolly', 'evals', 'recreate.json');
export const RECREATE_DEFAULT_CASE = 'recreate-synthetic';
/** The keys a case's `pass` may hold: each is one gate this scorer computes. */
export const RECREATE_BASE_PASS_KEYS = ['checkErrors', 'missingStrings', 'missingNotes', 'slides', 'themes', 'reopens', 'edits'] as const;
/** Acceptance requires the painted document, with no unresolved quality or fidelity findings. */
export const RECREATE_ACCEPTANCE_KEYS = ['verifyFindings', 'houseRuleFindings', 'clippedText', 'rendered', 'themeGrounds', 'noteLines', 'fidelityEdits', 'noScaffolding', 'oneDocument'] as const;
export const RECREATE_PASS_KEYS = [...RECREATE_BASE_PASS_KEYS, ...RECREATE_ACCEPTANCE_KEYS] as const;
export type RecreatePassKeyV1 = (typeof RECREATE_PASS_KEYS)[number];
/**
 * The one value each gate takes in a case's `pass`: the threshold the scorer holds the
 * delivery to (decision E13). A case may leave a gate out, and then the gate is not
 * scored; any other value is refused, so a case never reads as stricter or looser than
 * the scorer is. `themes` is the case's own `themes` list.
 */
export const RECREATE_PASS_VALUES: Readonly<Record<Exclude<RecreatePassKeyV1, 'themes'>, number | string | boolean>> = {
  checkErrors: 0, missingStrings: 0, missingNotes: 0, slides: 'source', reopens: true, edits: 'valid',
  verifyFindings: 0, houseRuleFindings: 0, clippedText: 0, rendered: true, themeGrounds: 0, noteLines: 0, fidelityEdits: 0, noScaffolding: true, oneDocument: true,
};
/** The keys a case's `report` may hold: each is a measure in the score's `reported`. */
export const RECREATE_REPORT_KEYS = ['verifyFindings', 'sourceVerifyFindings', 'houseRuleFindings', 'clippedText', 'brandColorReview', 'undeclaredEdits', 'unmatchedEdits', 'notesLinesMerged', 'notesLinesSplit', 'themeGroundMismatches', 'themeGroundsExempt', 'pptxTier', 'renderStates', 'scaffolding', 'undelivered', 'unthemed'] as const;
export const RECREATE_FORMATS = ['lolly', 'pptx'] as const;
export type RecreateFormatV1 = (typeof RECREATE_FORMATS)[number];

export interface RecreateCaseV1 {
  id: string;
  prompt: string;
  /** A path relative to the eval file, or the environment variable that holds the deck's path. */
  source: string | { env: string };
  designSystem?: { file?: string; profile?: string };
  env?: Record<string, string>;
  themes: string[];
  deliver: { formats: RecreateFormatV1[]; names?: string; edits?: string };
  pass: Partial<Record<RecreatePassKeyV1, unknown>>;
  report?: string[];
  requires?: string[];
  checks: string[];
}

export interface RecreateEvalFileV1 {
  version: number;
  purpose: string;
  cases: RecreateCaseV1[];
  rubric: { measured: string[]; reviewed: string[]; report: string };
}

export class RecreateUsageError extends Error {}

/**
 * The gates a case scores, in the scorer's order. Throws RecreateUsageError for a `pass`
 * key the scorer does not compute, a threshold other than the one it holds, or a
 * `report` name that is not a reported measure.
 */
export function recreateCaseGates(evalCase: RecreateCaseV1, where = `case "${evalCase.id}"`): RecreatePassKeyV1[] {
  const pass = evalCase.pass && typeof evalCase.pass === 'object' && !Array.isArray(evalCase.pass) ? evalCase.pass as Record<string, unknown> : null;
  if (!pass) throw new RecreateUsageError(`${where} has no "pass" object naming its gates.`);
  const problems: string[] = [];
  for (const [key, value] of Object.entries(pass)) {
    if (!(RECREATE_PASS_KEYS as readonly string[]).includes(key)) {
      problems.push(`pass.${key} is not a gate the scorer computes (${RECREATE_PASS_KEYS.join(', ')})`);
    } else if (key === 'themes') {
      const same = Array.isArray(value) && Array.isArray(evalCase.themes) && value.length === evalCase.themes.length
        && [...value].map(String).sort().join('\n') === [...evalCase.themes].sort().join('\n');
      if (!same) problems.push(`pass.themes is ${JSON.stringify(value)}; the scorer gates on the case's themes, ${JSON.stringify(evalCase.themes)}`);
    } else {
      const want = RECREATE_PASS_VALUES[key as Exclude<RecreatePassKeyV1, 'themes'>];
      if (value !== want) problems.push(`pass.${key} is ${JSON.stringify(value)}; the scorer gates on ${JSON.stringify(want)} only`);
    }
  }
  for (const key of evalCase.report ?? []) {
    if (!(RECREATE_REPORT_KEYS as readonly string[]).includes(key)) problems.push(`report "${key}" is not a measure the score reports (${RECREATE_REPORT_KEYS.join(', ')})`);
  }
  if (problems.length) throw new RecreateUsageError(`${where}: ${problems.join('; ')}.`);
  return RECREATE_PASS_KEYS.filter((key) => key in pass);
}

/** Read the eval file and one case of it, with its paths resolved against the eval file and its gates checked. */
export function loadRecreateCase(evalFile: string = RECREATE_EVAL_FILE, id: string = RECREATE_DEFAULT_CASE): { evalCase: RecreateCaseV1; source: string | null; designSystem: { file?: string; profile?: string }; gates: RecreatePassKeyV1[] } {
  let parsed: RecreateEvalFileV1;
  try {
    parsed = JSON.parse(readFileSync(evalFile, 'utf8')) as RecreateEvalFileV1;
  } catch (err) {
    throw new RecreateUsageError(`${evalFile} is not a readable eval file: ${(err as Error).message}`);
  }
  const evalCase = parsed.cases?.find((c) => c.id === id);
  if (!evalCase) throw new RecreateUsageError(`${evalFile} has no case "${id}"; its cases are ${(parsed.cases ?? []).map((c) => c.id).join(', ')}.`);
  const gates = recreateCaseGates(evalCase, `${evalFile} case "${id}"`);
  const base = path.dirname(evalFile);
  const source = typeof evalCase.source === 'string'
    ? path.resolve(base, evalCase.source)
    : (process.env[evalCase.source.env] ?? '').trim() || null;
  const designSystem = evalCase.designSystem?.file
    ? { file: path.resolve(base, evalCase.designSystem.file) }
    : { ...(evalCase.designSystem?.profile ? { profile: evalCase.designSystem.profile } : {}) };
  return { evalCase, source, designSystem, gates };
}

// ─── the score ───────────────────────────────────────────────────────────────

export type RecreateReopenStateV1 = 'passed' | 'failed' | 'not run';

export interface RecreateFileScoreV1 {
  name: string;
  format: RecreateFormatV1;
  theme: string | null;
  /** Set when the file could not be checked at all. */
  error?: string;
  outcome?: CheckReportV1['outcome'];
  summary?: CheckReportV1['summary'];
  families?: Record<string, string>;
  familyReasons?: Record<string, string>;
  /** The check families that failed to run on this file, with the reason each gave. */
  failedFamilies?: Record<string, string>;
  slides?: { source: number; result: number };
  /** Source strings with no match, after the declared edits are excepted. */
  missingStrings: string[];
  missingNotes: number;
  /** Source strings carried in edited form that no declared edit names. */
  undeclaredEdits: Array<{ source: string; result: string }>;
  unmatchedEdits: number;
  /** Findings by code, for the Verify family and for house rules. */
  verify: Record<string, number>;
  houseRules: Record<string, number>;
  clippedText: number;
  brandColorReview: number;
  /**
   * Source notes the file keeps exactly, paragraph for paragraph and line for line
   * (`kept`), and by slide number those whose lines were run together (`merged`) or
   * whose paragraphs changed with every line kept (`split`: a line break or an empty
   * line inside a paragraph that came back as a paragraph break). A `.lolly` note is
   * read as the PPTX writer reads it (`notesParagraphsOfText`).
   */
  notesLines?: { slides: number; kept: number; merged: number[]; split?: number[] };
  /**
   * Frames whose ground disagrees with the file's theme (a dark frame in a light file).
   * `exempt` lists the frames left out of the count: the master's archetype has no form for
   * the theme (`archetype`), or a picture under the content covers the frame (`photo`).
   */
  themeGrounds?: { frames: number; mismatched: string[]; exempt: Array<{ frame: string; why: 'archetype' | 'photo' }> };
  /** A `.pptx` file's structure: its tier, the slide layouts its slides use and the placeholders on each slide. */
  pptx?: RecreatePptxStructureV1;
  readback?: { ok: boolean; problems: string[]; label: string | null; layers: number; media: number };
  reopen?: { state: RecreateReopenStateV1; reason?: string };
}

/**
 * What the `.pptx` is built from. Tier `A` uses more than one slide layout or binds
 * text to placeholders (what an export of master-bound slides writes); tier `B` is
 * every slide on one blank layout with free text boxes.
 */
export interface RecreatePptxStructureV1 {
  tier: 'A' | 'B';
  /** The distinct slide layouts the slides use. */
  layouts: number;
  /** `<p:ph>` placeholders on each slide, in presentation order. */
  placeholders: number[];
}

export interface RecreateGateV1 {
  id: RecreatePassKeyV1;
  pass: boolean;
  detail: string;
}

export interface RecreateScoreV1 {
  format: 'lolly-recreate-score';
  version: 1;
  case: string;
  label?: string;
  folder: string;
  source: { name: string; sha256: string; slides: number; notes: number };
  designSystem: { origin: 'file' | 'profile'; file?: string; profile?: string; tokensAsset?: string } | null;
  edits: { file: string | null; count: number; problems: string[] };
  themes: string[];
  formats: RecreateFormatV1[];
  files: RecreateFileScoreV1[];
  /** The source deck checked against itself: the zero point of the reported counts. */
  sourceBaseline: { summary: CheckReportV1['summary']; verify: Record<string, number> } | null;
  gates: RecreateGateV1[];
  reported: {
    verifyFindings: number;
    /** Verify findings on the source deck checked against itself, the zero point of `verifyFindings`; null when that check failed. */
    sourceVerifyFindings: number | null;
    houseRuleFindings: number;
    clippedText: number;
    brandColorReview: number;
    undeclaredEdits: number;
    unmatchedEdits: number;
    notesLinesMerged: number;
    /** Slides, summed over the `.pptx` files, whose `a:br` line breaks came back as paragraphs. */
    notesLinesSplit: number;
    themeGroundMismatches: number;
    /** Frames left out of the mismatch count, by `themeGrounds.exempt`. */
    themeGroundsExempt: number;
    /** The tier of each delivered `.pptx`, by file name. */
    pptxTier: Record<string, 'A' | 'B'>;
    renderStates: Record<string, number>;
    scaffolding: string[];
    undelivered: string[];
    unthemed: string[];
  };
  pass: boolean;
  summary: string;
}

export interface ScoreRecreationOptionsV1 {
  /** The folder the agent delivered. */
  dir: string;
  /** The source deck: a path, or its bytes and name. */
  source: string | { bytes: Uint8Array; name: string };
  /** The edits file; default `<dir>/edits.json` when it exists. Null reads none. */
  edits?: string | null;
  /** The design system: a token file, or a content profile. Neither leaves brand unchecked. */
  designSystem?: { file?: string; profile?: string };
  themes?: string[];
  formats?: RecreateFormatV1[];
  /** `auto` (default) uses a browser tier when one is here; `off` skips it; `require` fails a reopen that cannot run. */
  browser?: 'auto' | 'off' | 'require';
  caseId?: string;
  label?: string;
  /** Reopen a `.lolly` in the web shell. Default: `openLollyViaWebShell`, when a browser and a web shell are here. */
  reopen?: (bytes: Uint8Array, name: string, label: string | null) => Promise<{ state: RecreateReopenStateV1; reason?: string }>;
  /** The gates to score: the keys of the case's `pass`. Default: the base gates. */
  gates?: readonly RecreatePassKeyV1[];
  /** Require every base and acceptance gate, even when a case omits them. */
  acceptance?: boolean;
}

const SCAFFOLDING = /\.(py|js|mjs|cjs|ts|sh)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git']);
const MEDIA_REF_PREFIX = 'user/media/';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const bump = (tally: Record<string, number>, key: string): void => { tally[key] = (tally[key] ?? 0) + 1; };

/** The theme a delivered file is in: the delivery manifest's word for it, else a word of its name. */
function themeOf(name: string, themes: readonly string[], manifest: Record<string, string | string[]>): string | null {
  const declared = manifest[name];
  if (typeof declared === 'string') return declared;
  const words = name.toLowerCase().replace(/\.[^.]+$/, '').split(/[^a-z0-9]+/);
  const hits = themes.filter((theme) => words.includes(theme.toLowerCase()));
  return hits.length === 1 ? hits[0]! : null;
}

/**
 * The themes a delivered file is scored in. One document made for every theme (plan 291
 * M4) is declared with a list in the delivery manifest (`"harbour.lolly": ["light",
 * "dark"]`) and is scored once per theme, checked in each; any other file is in the one
 * theme `themeOf` reads.
 */
export function themesOfDelivered(name: string, themes: readonly string[], manifest: Record<string, string | string[]>): Array<string | null> {
  const declared = manifest[name];
  if (Array.isArray(declared)) {
    const listed = [...new Set(declared.filter((t): t is string => typeof t === 'string' && t.length > 0))];
    if (listed.length) return listed;
  }
  return [themeOf(name, themes, manifest)];
}

function scaffoldingUnder(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(dir, rel)).sort()) {
    if (SKIP_DIRS.has(entry)) continue;
    const relPath = rel ? `${rel}/${entry}` : entry;
    const full = path.join(dir, relPath);
    if (statSync(full).isDirectory()) out.push(...scaffoldingUnder(dir, relPath));
    else if (SCAFFOLDING.test(entry)) out.push(relPath);
  }
  return out;
}

/** Relative luminance of a `#rgb` or `#rrggbb` colour, or null for anything else. */
function luminance(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const hex = m[1]!.length === 3 ? m[1]!.split('').map((c) => c + c).join('') : m[1]!;
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

type NoteParagraphs = ReadonlyArray<{ lines: readonly string[] }>;

/** One notes line in a comparable form: white space (a no-break space too) collapsed and trimmed. */
const noteLine = (line: string): string => line.replace(/\s+/g, ' ').trim();

/**
 * A Design artboard's notes text as paragraphs, the way the PPTX notes writer reads it
 * (plan 291 M4): a blank line between paragraphs, a newline for a line break inside
 * one, and a line of no-break spaces (U+00A0) for an empty line inside one.
 */
export function notesParagraphsOfText(text: string): Array<{ lines: string[] }> {
  const paras: Array<{ lines: string[] }> = [{ lines: [] }];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const empty = /^[ \t]*$/.test(line);
    if (empty) {
      if (paras[paras.length - 1]!.lines.length) paras.push({ lines: [] });
    } else paras[paras.length - 1]!.lines.push(/^[\u00a0 \t]*$/.test(line) ? '' : line);
  }
  return paras.filter((p) => p.lines.length);
}

/**
 * Source slides whose notes the delivered notes keep exactly, paragraph for paragraph
 * and line for line (an empty line inside a paragraph included), by slide in deck
 * order. A note whose words come back in other lines is `merged`; one whose lines are
 * all there in other paragraphs is `split` when it has more paragraphs or the same
 * number (a blank line inside a paragraph lost or turned into a paragraph break), and
 * `merged` when it has fewer.
 */
export function notesLinesOf(source: ContentInventoryV1, delivered: Array<NoteParagraphs | null>): { slides: number; kept: number; merged: number[]; split: number[] } {
  let slides = 0;
  let kept = 0;
  const merged: number[] = [];
  const split: number[] = [];
  const exact = (paras: NoteParagraphs): string[][] => paras.map((p) => p.lines.map(noteLine)).filter((lines) => lines.some(Boolean));
  const words = (paras: string[][]): string[] => paras.flat().filter(Boolean);
  source.slides.forEach((slide, i) => {
    if (!slide.notes) return;
    slides += 1;
    const want = exact(slide.notes.paragraphs);
    const got = exact(delivered[i] ?? []);
    const a = words(want);
    const b = words(got);
    if (a.length !== b.length || a.some((line, k) => line !== b[k])) merged.push(slide.number);
    else if (want.length === got.length && want.every((p, k) => p.length === got[k]!.length && p.every((line, j) => line === got[k]![j]))) kept += 1;
    else if (got.length < want.length) merged.push(slide.number);
    else split.push(slide.number);
  });
  return { slides, kept, merged, split };
}

/** Frames of a Design row list in deck order (order, then x, then id), as fidelity reads them. */
function framesInOrder(boxes: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(boxes)) return [];
  const frames = boxes.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && (row as { kind?: unknown }).kind === 'frame');
  return frames.sort((a, b) => (Number(a.order ?? 0) - Number(b.order ?? 0)) || (Number(a.x ?? 0) - Number(b.x ?? 0)) || String(a.id).localeCompare(String(b.id)));
}

/**
 * Source slides (by number) where a line break inside a notes paragraph came back as
 * a paragraph of its own: the paragraph's lines are no longer together in any
 * delivered paragraph, and each one is a delivered paragraph by itself. Slides pair by
 * position, as `notesLinesOf` pairs them. Lines that were run together are a merge,
 * which `notesLinesOf` reports, and never count here.
 */
export function notesLinesSplitOf(source: ContentInventoryV1, delivered: ContentInventoryV1): number[] {
  const norm = (line: string): string => line.replace(/\s+/g, ' ').trim();
  const split: number[] = [];
  source.slides.forEach((slide, i) => {
    const got = delivered.slides[i]?.notes;
    if (!slide.notes || !got) return;
    const paras = got.paragraphs.map((p) => p.lines.map(norm).filter(Boolean)).filter((lines) => lines.length);
    const singles = new Set(paras.filter((lines) => lines.length === 1).map((lines) => lines[0]!));
    const holds = (para: string[], lines: string[]): boolean => {
      for (let k = 0; k + lines.length <= para.length; k += 1) if (lines.every((line, j) => para[k + j] === line)) return true;
      return false;
    };
    const broken = slide.notes.paragraphs.some((p) => {
      const lines = p.lines.map(norm).filter(Boolean);
      return lines.length > 1 && !paras.some((para) => holds(para, lines)) && lines.every((line) => singles.has(line));
    });
    if (broken) split.push(slide.number);
  });
  return split;
}

/** A part's relationships by id, their targets resolved to package paths; external targets are left out. */
function relationshipsOf(read: (name: string) => Uint8Array | undefined, part: string): Map<string, { type: string; target: string }> {
  const dir = path.posix.dirname(part);
  const bytes = read(`${dir === '.' ? '' : `${dir}/`}_rels/${path.posix.basename(part)}.rels`);
  const out = new Map<string, { type: string; target: string }>();
  if (!bytes) return out;
  for (const m of new TextDecoder().decode(bytes).matchAll(/<(?:\w+:)?Relationship\b([^>]*)>/g)) {
    const attr = (name: string): string | undefined => new RegExp(`\\b${name}="([^"]*)"`).exec(m[1]!)?.[1];
    const id = attr('Id');
    const target = attr('Target');
    if (!id || !target || attr('TargetMode') === 'External') continue;
    const resolved = target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(dir, target));
    out.set(id, { type: attr('Type') ?? '', target: resolved });
  }
  return out;
}

/** Largest XML part `pptxStructureOf` inflates; a larger one is read as absent. */
const PPTX_STRUCTURE_MAX_PART_BYTES = 16 * 1024 * 1024;

/**
 * The tier, slide layouts and placeholders of a `.pptx`, in presentation order; null for
 * bytes that are not one. The package is read with the engine's capped zip reader, so an
 * archive past its budgets reads as null, and only the presentation, slide and
 * relationship parts are inflated, each at most `PPTX_STRUCTURE_MAX_PART_BYTES`: a media
 * entry that expands too far is never inflated at all.
 */
export function pptxStructureOf(bytes: Uint8Array): RecreatePptxStructureV1 | null {
  let members: Map<string, ZipRawMember>;
  try { members = new Map(readZipMembers(bytes).map((m) => [m.name, m])); } catch { return null; }
  const inflated = new Map<string, Uint8Array | null>();
  const part = (name: string): Uint8Array | undefined => {
    if (!inflated.has(name)) {
      const member = members.get(name);
      let out: Uint8Array | null = null;
      if (member && member.size <= PPTX_STRUCTURE_MAX_PART_BYTES) {
        try { out = decodeZipMember(member); } catch { out = null; }
      }
      inflated.set(name, out);
    }
    return inflated.get(name) ?? undefined;
  };
  const decode = (name: string): string | null => { const b = part(name); return b ? new TextDecoder().decode(b) : null; };
  const presentation = decode('ppt/presentation.xml');
  if (presentation === null) return null;
  const rels = relationshipsOf(part, 'ppt/presentation.xml');
  let slides = [...presentation.matchAll(/<(?:\w+:)?sldId\b[^>]*?\br:id="([^"]+)"/g)]
    .map((m) => rels.get(m[1]!)?.target)
    .filter((target): target is string => !!target && !!part(target));
  if (!slides.length) {
    const num = (name: string): number => Number(/(\d+)\.xml$/.exec(name)?.[1] ?? 0);
    slides = [...members.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => num(a) - num(b));
  }
  const layouts = new Set<string>();
  const placeholders = slides.map((slide) => {
    for (const rel of relationshipsOf(part, slide).values()) if (rel.type.endsWith('/slideLayout')) layouts.add(rel.target);
    return (decode(slide)?.match(/<p:ph[\s/>]/g) ?? []).length;
  });
  return { tier: layouts.size > 1 || placeholders.some((n) => n > 0) ? 'A' : 'B', layouts: layouts.size, placeholders };
}

/**
 * The name of each slide's layout in a `.pptx`, in presentation order (null where a slide
 * names none), so a delivered deck's slides can be held to their master archetype the way
 * the `.lolly` frames are. Null for a file that is not a readable presentation.
 */
export function pptxSlideLayoutNames(bytes: Uint8Array): Array<string | null> | null {
  let members: Map<string, ZipRawMember>;
  try { members = new Map(readZipMembers(bytes).map((m) => [m.name, m])); } catch { return null; }
  const part = (name: string): Uint8Array | undefined => {
    const member = members.get(name);
    if (!member || member.size > PPTX_STRUCTURE_MAX_PART_BYTES) return undefined;
    try { return decodeZipMember(member); } catch { return undefined; }
  };
  const decode = (name: string): string | null => { const b = part(name); return b ? new TextDecoder().decode(b) : null; };
  const presentation = decode('ppt/presentation.xml');
  if (presentation === null) return null;
  const rels = relationshipsOf(part, 'ppt/presentation.xml');
  const slides = [...presentation.matchAll(/<(?:\w+:)?sldId\b[^>]*?\br:id="([^"]+)"/g)]
    .map((m) => rels.get(m[1]!)?.target)
    .filter((target): target is string => !!target && members.has(target));
  return slides.map((slide) => {
    const layout = [...relationshipsOf(part, slide).values()].find((rel) => rel.type.endsWith('/slideLayout'))?.target;
    const xml = layout ? decode(layout) : null;
    const name = xml ? /<(?:\w+:)?cSld\b[^>]*?\bname="([^"]*)"/.exec(xml)?.[1] : undefined;
    return name ? name.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'") : null;
  });
}

/** Is an archetype's own ground dark: its statement first, else its literal colour; null when neither says. */
function archetypeGroundIsDark(archetype: ArchetypeV1): boolean | null {
  if (typeof archetype.background?.dark === 'boolean') return archetype.background.dark;
  const l = luminance(archetype.background?.hex);
  return l === null ? null : l < 0.2;
}

/** Does the frame's master archetype lack a form for the theme: a dark archetype nothing pairs with a light one, or a light one with no dark twin. */
function archetypeLacksTheme(frame: Record<string, unknown>, theme: 'light' | 'dark', masterFor: (id: string) => SlideMasterV1 | null): boolean {
  const id = typeof frame.archetype === 'string' ? frame.archetype : null;
  const base = typeof frame.master === 'string' ? masterFor(frame.master) : null;
  if (!id || !base) return false;
  let master: SlideMasterV1;
  try { master = withSlideLayoutComponents(base, [...new Set([id, id.replace(/-dark$/, '')])]); } catch { return false; }
  const archetype = master.archetypes.find((a) => a.id === id);
  const dark = archetype ? archetypeGroundIsDark(archetype) : null;
  if (!archetype || dark === null) return false;
  if (theme === 'light') return dark && !archetype.variantOf && !master.archetypes.some((a) => a.variants?.dark === archetype.id);
  return !dark && !darkVariantOf(master, archetype.id);
}

/** Does a picture (any image row but furniture) cover at least 90% of the frame. */
function frameUnderPhoto(frame: Record<string, unknown>, rows: Array<Record<string, unknown>>): boolean {
  const [fx, fy, fw, fh] = [frame.x, frame.y, frame.w, frame.h].map((v) => Number(v ?? 0)) as [number, number, number, number];
  if (!(fw > 0 && fh > 0)) return false;
  return rows.some((row) => {
    if (row.kind !== 'image' || row.frame !== frame.id || row.furniture) return false;
    const [x, y, w, h] = [row.x, row.y, row.w, row.h].map((v) => Number(v ?? 0)) as [number, number, number, number];
    const ix = Math.max(0, Math.min(x + w, fx + fw) - Math.max(x, fx));
    const iy = Math.max(0, Math.min(y + h, fy + fh) - Math.max(y, fy));
    return (ix * iy) / (fw * fh) >= 0.9;
  });
}

/**
 * A frame's ground: the frame's own `bg`, or the fill of an opaque box that covers it
 * edge to edge as its first layer, the `under` ground row recreate.md asks for
 * (`"bg": "{color.semantic.surface}"`), since a compose slide takes no `bg` of its own.
 */
function groundOf(frame: Record<string, unknown>, rows: Array<Record<string, unknown>>): unknown {
  const first = rows.find((row) => row.frame === frame.id);
  if (!first || (first.kind !== 'box' && first.kind !== undefined) || first.furniture || first.hidden === true) return frame.bg;
  if (typeof first.grad === 'string' && first.grad.trim()) return frame.bg;
  const opacity = first.opacity === undefined || first.opacity === null || first.opacity === '' ? 100 : Number(first.opacity);
  if (!(opacity >= 100)) return frame.bg;
  if (typeof first.bg !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(first.bg.trim())) return frame.bg;
  const [fx, fy, fw, fh] = [frame.x, frame.y, frame.w, frame.h].map((v) => Number(v ?? 0)) as [number, number, number, number];
  const [x, y, w, h] = [first.x, first.y, first.w, first.h].map((v) => Number(v ?? 0)) as [number, number, number, number];
  if (!(fw > 0 && fh > 0)) return frame.bg;
  const ix = Math.max(0, Math.min(x + w, fx + fw) - Math.max(x, fx));
  const iy = Math.max(0, Math.min(y + h, fy + fh) - Math.max(y, fy));
  return (ix * iy) / (fw * fh) >= 0.99 ? first.bg : frame.bg;
}

/**
 * Frames whose ground disagrees with the theme: a dark ground (luminance under 0.2) in
 * a light file, a light one (over 0.5) in a dark file. The ground is the frame's own
 * `bg`, or an opaque box covering it as its first layer (`groundOf`). A frame drawn
 * from a master archetype that has no form for the theme (a title or closing slide that
 * is dark by design, a light statement slide with no dark twin) or under a picture
 * covering 90% of it or more is exempt, and listed with the reason.
 */
export function themeGroundsOf(boxes: unknown, theme: 'light' | 'dark', masterFor: (id: string) => SlideMasterV1 | null): NonNullable<RecreateFileScoreV1['themeGrounds']> {
  const rows = Array.isArray(boxes) ? boxes.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [];
  const frames = framesInOrder(rows);
  const mismatched: string[] = [];
  const exempt: Array<{ frame: string; why: 'archetype' | 'photo' }> = [];
  for (const frame of frames) {
    const l = luminance(groundOf(frame, rows));
    if (l === null || !(theme === 'dark' ? l > 0.5 : l < 0.2)) continue;
    const id = String(frame.id);
    if (archetypeLacksTheme(frame, theme, masterFor)) exempt.push({ frame: id, why: 'archetype' });
    else if (frameUnderPhoto(frame, rows)) exempt.push({ frame: id, why: 'photo' });
    else mismatched.push(id);
  }
  return { frames: frames.length, mismatched, exempt };
}

/**
 * The ground rule of themeGroundsOf, read from a delivered .pptx's own slides: a dark
 * ground in a light file or a light one in a dark file. A slide under a picture is exempt
 * (`photo`), and so is one drawn in the theme's own primary or secondary colour, the
 * ground a title or section slide takes (`archetype`).
 */
export function pptxThemeGroundsOf(
  grounds: readonly PptxSlideGround[],
  theme: 'light' | 'dark',
  doc: unknown,
  bound?: { frameOf: (slide: number) => Record<string, unknown> | null; masterFor: (id: string) => SlideMasterV1 | null },
): NonNullable<RecreateFileScoreV1['themeGrounds']> {
  const set = createTokenSet(doc, { theme });
  const accents = ['color.semantic.primary', 'color.semantic.secondary']
    .map((p) => set.resolve(p))
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.toLowerCase());
  const mismatched: string[] = [];
  const exempt: Array<{ frame: string; why: 'archetype' | 'photo' }> = [];
  for (const ground of grounds) {
    const frame = `slide-${ground.slide}`;
    if ('photo' in ground) {
      exempt.push({ frame, why: 'photo' });
      continue;
    }
    if (!('hex' in ground)) continue;
    const l = luminance(ground.hex);
    if (l === null || !(theme === 'dark' ? l > 0.5 : l < 0.2)) continue;
    // A slide on a master layout is held to its archetype, the rule the `.lolly` frames
    // are held to (plan 291 M4), so one document scores the same in both formats.
    const bind = bound?.frameOf(ground.slide) ?? null;
    if (bind && bound) {
      if (archetypeLacksTheme(bind, theme, bound.masterFor)) exempt.push({ frame, why: 'archetype' });
      else mismatched.push(frame);
    } else if (accents.includes(ground.hex.toLowerCase())) exempt.push({ frame, why: 'archetype' });
    else mismatched.push(frame);
  }
  return { frames: grounds.length, mismatched, exempt };
}

/** Read a `.lolly` back in Node and hold it to what a delivered Design session must be. */
export function readBackDesignSession(bytes: Uint8Array): NonNullable<RecreateFileScoreV1['readback']> & { boxes: unknown[] } {
  const problems: string[] = [];
  let contents: ReturnType<typeof readLollyFile>;
  try {
    contents = readLollyFile(bytes);
  } catch (err) {
    return { ok: false, problems: [`it does not read as a .lolly: ${(err as Error).message}`], label: null, layers: 0, media: 0, boxes: [] };
  }
  if (contents.manifest.kind !== 'session') problems.push(`its kind is ${String(contents.manifest.kind)}, not session`);
  if (contents.manifest.tool?.id !== 'design') problems.push(`its tool is ${String(contents.manifest.tool?.id)}, not design`);
  const boxes = Array.isArray(contents.session.boxes) ? contents.session.boxes as unknown[] : [];
  if (!boxes.length) problems.push('it holds no rows');
  const label = typeof contents.session.__label === 'string' && contents.session.__label.trim() ? contents.session.__label : null;
  if (!label) problems.push('it has no label');
  let media = 0;
  for (const asset of contents.manifest.assets ?? []) {
    if (typeof asset.id !== 'string' || !asset.id.startsWith(MEDIA_REF_PREFIX) || typeof asset.path !== 'string') continue;
    const part = contents.files.get(asset.path);
    if (!part) problems.push(`${asset.id} is not carried`);
    else if (`${MEDIA_REF_PREFIX}${sha256(part)}` !== asset.id) problems.push(`${asset.id} does not hash to its ref`);
    else media += 1;
  }
  return { ok: problems.length === 0, problems, label, layers: boxes.length, media, boxes };
}

/**
 * Does a built web shell carry the `#/open` route: true when its `_app` folder holds the
 * route's own chunk (`main.ts` imports `lib/open-route.ts` lazily, so a build has an
 * `open-route-<hash>.js` exactly when it has the route), false when the folder is there
 * without it, null when the build has no `_app` folder to look in.
 */
export function webShellHasOpenRoute(dist: string): boolean | null {
  let names: string[];
  try { names = readdirSync(path.join(dist, '_app')); } catch { return null; }
  return names.some((name) => /^open-route-[\w-]+\.js$/.test(name));
}

/** The default reopen: `#/open` in the web shell, when a browser and a web shell are on this machine. */
async function reopenViaWebShell(bytes: Uint8Array, name: string, label: string | null): Promise<{ state: RecreateReopenStateV1; reason?: string }> {
  const { browserInstalled } = await import('../packages/node-shell/src/browsers.ts');
  const dist = process.env.LOLLY_WEB_DIST || path.join(REPO, 'shells', 'web', 'dist');
  if (!browserInstalled()) return { state: 'not run', reason: 'no browser is installed here (pnpm run browsers:install)' };
  if (!process.env.LOLLY_WEB_BASE && !existsSync(path.join(dist, 'index.html'))) {
    return { state: 'not run', reason: 'no web shell: build one (pnpm run build:web) or set LOLLY_WEB_BASE' };
  }
  if (!process.env.LOLLY_WEB_BASE && webShellHasOpenRoute(dist) === false) {
    return { state: 'not run', reason: `the built web shell at ${dist} predates the #/open route: rebuild it (pnpm run build:web) or set LOLLY_WEB_BASE to a dev server` };
  }
  const { openLollyViaWebShell, openRouteRefusal } = await import('../packages/node-shell/src/webshell-render.ts');
  const refusal = openRouteRefusal(bytes);
  if (refusal) return { state: 'failed', reason: `${name} ${refusal}` };
  try {
    const opened = await openLollyViaWebShell(bytes, { name, timeoutMs: 60_000 });
    try {
      if (opened.toolId !== 'design') return { state: 'failed', reason: `it opened in ${opened.toolId}, not design` };
      const shown = await opened.page.locator('[data-action="filename"]').first()
        .evaluate((el) => (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder);
      if (label && shown !== label) return { state: 'failed', reason: `the app shows "${shown}", not the label "${label}"` };
      return { state: 'passed' };
    } finally {
      await opened.close();
    }
  } catch (err) {
    const first = (err as Error).message.split('\n')[0] ?? 'the reopen failed';
    // A web build older than the #/open route never leaves the route, so the wait times out.
    const reason = /timeout/i.test(first) && !process.env.LOLLY_WEB_BASE
      ? `${first} The built web shell may predate the #/open route: rebuild it (pnpm run build:web) or set LOLLY_WEB_BASE to a dev server.`
      : first;
    return { state: 'failed', reason };
  }
}

/** Is a parsed `--file` a design token document: an object whose tokens resolve to at least one colour. */
export function isDesignSystemDocument(doc: unknown): boolean {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return false;
  try { return createTokenSet(doc).colors().length > 0; } catch { return false; }
}

function countFindings(report: CheckReportV1): Pick<RecreateFileScoreV1, 'verify' | 'houseRules' | 'clippedText' | 'brandColorReview'> {
  const verify: Record<string, number> = {};
  const houseRules: Record<string, number> = {};
  let brandColorReview = 0;
  let clippedText = 0;
  for (const finding of report.findings) {
    if (finding.code.startsWith('verify.')) bump(verify, finding.code);
    else if (finding.code.startsWith('brand.rule.')) bump(houseRules, finding.code);
    else if (finding.code === 'design.text.overflow') clippedText += 1;
    else if (finding.code === 'brand.color.review') brandColorReview += 1;
  }
  return { verify, houseRules, clippedText, brandColorReview };
}

function fidelityOf(report: CheckReportV1): Pick<RecreateFileScoreV1, 'slides' | 'missingStrings' | 'missingNotes' | 'undeclaredEdits' | 'unmatchedEdits'> {
  const fidelity = report.fidelity;
  const excepted = new Set((fidelity?.excepted ?? []).map((e) => e.source));
  return {
    ...(fidelity ? { slides: fidelity.slides } : {}),
    missingStrings: fidelity?.missingStrings ?? [],
    missingNotes: fidelity?.notes.missing ?? 0,
    undeclaredEdits: (fidelity?.editedStrings ?? []).filter((e) => !excepted.has(e.source)),
    unmatchedEdits: report.findings.filter((f) => f.code === 'fidelity.edit.unmatched').length,
  };
}

const sum = (files: RecreateFileScoreV1[], pick: (f: RecreateFileScoreV1) => number): number => files.reduce((n, f) => n + pick(f), 0);
const total = (tally: Record<string, number>): number => Object.values(tally).reduce((n, v) => n + v, 0);

/** Grade one delivered folder. Throws RecreateUsageError for a folder, deck, design system or edits file that cannot be read. */
export async function scoreRecreation(opts: ScoreRecreationOptionsV1): Promise<RecreateScoreV1> {
  const dir = path.resolve(opts.dir);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new RecreateUsageError(`${dir} is not a directory`);
  const themes = opts.themes ?? ['light', 'dark'];
  const formats = opts.formats ?? [...RECREATE_FORMATS];
  const browser = opts.browser ?? 'auto';

  // The source, read once.
  const sourceInput = typeof opts.source === 'string'
    ? (() => {
      const file = opts.source;
      if (!existsSync(file)) throw new RecreateUsageError(`the source deck ${file} is not on this machine`);
      if (!statSync(file).isFile()) throw new RecreateUsageError(`the source deck ${file} is not a file`);
      try {
        return { bytes: new Uint8Array(readFileSync(file)), name: path.basename(file) };
      } catch (err) {
        throw new RecreateUsageError(`the source deck ${file} cannot be read: ${(err as Error).message}`);
      }
    })()
    : opts.source;
  let inventory: ContentInventoryV1;
  try {
    ({ inventory } = await readContentInventory({ bytes: sourceInput.bytes, name: sourceInput.name }));
  } catch (err) {
    throw new RecreateUsageError(`the source deck ${sourceInput.name} cannot be read as a deck: ${(err as Error).message}`);
  }

  // The design system, resolved explicitly.
  let designSystem: RecreateScoreV1['designSystem'] = null;
  let check: { doc: unknown; origin: 'file' | 'profile'; profile?: string; tokensAsset?: string } | null = null;
  let catalog: DesignBriefCatalogV1 | null = null;
  if (opts.designSystem?.file) {
    let doc: unknown;
    try { doc = JSON.parse(readFileSync(opts.designSystem.file, 'utf8')); } catch (err) {
      throw new RecreateUsageError(`the design system ${opts.designSystem.file} is not readable JSON: ${(err as Error).message}`);
    }
    // A JSON file that is not a token document would check brand against nothing and still be recorded as the system.
    if (!isDesignSystemDocument(doc)) {
      throw new RecreateUsageError(`the design system ${opts.designSystem.file} is not a design token document: it needs an object with at least one colour token ($type "color"), as tests/fixtures/recreate/tokens.json has`);
    }
    check = { doc, origin: 'file' };
    catalog = readBriefCatalogFor('file', doc);
    designSystem = { origin: 'file', file: path.relative(REPO, opts.designSystem.file) || opts.designSystem.file };
  } else if (opts.designSystem?.profile) {
    const profile = opts.designSystem.profile;
    const own = readProfileTokenDocument({ profile });
    if (!own) throw new RecreateUsageError(`the ${profile} content profile has no design system on this machine`);
    check = { doc: own.doc, origin: 'profile', profile: own.profile, tokensAsset: own.tokensAsset };
    catalog = readProfileBriefCatalog({ profile });
    designSystem = { origin: 'profile', profile: own.profile, tokensAsset: own.tokensAsset };
  }
  // The masters a frame's `master` binding can name: the design system's own, else the neutral one.
  const neutral = neutralSlideMaster();
  const masterFor = (id: string): SlideMasterV1 | null => (catalog?.master?.id === id ? catalog.master : neutral.id === id ? neutral : null);
  const themeNames = (() => {
    const declared = (check?.doc as { $themes?: Array<{ name?: unknown }> } | undefined)?.$themes;
    return Array.isArray(declared) ? declared.map((t) => t?.name).filter((n): n is string => typeof n === 'string') : [];
  })();

  // The declared edits.
  const editsPath = opts.edits === undefined ? (existsSync(path.join(dir, 'edits.json')) ? path.join(dir, 'edits.json') : null) : opts.edits;
  let edits: CheckFidelityEditV1[] = [];
  const editProblems: string[] = [];
  if (editsPath) {
    let raw: unknown;
    try { raw = JSON.parse(readFileSync(editsPath, 'utf8')); } catch (err) {
      raw = undefined;
      editProblems.push(`${path.basename(editsPath)} is not readable JSON: ${(err as Error).message}`);
    }
    if (raw !== undefined) {
      const parsed = parseFidelityEdits(raw);
      edits = parsed.edits;
      editProblems.push(...parsed.problems);
    }
  }

  // The delivered files.
  let manifest: Record<string, string | string[]> = {};
  const manifestPath = path.join(dir, 'delivery.json');
  if (existsSync(manifestPath)) {
    try {
      const files = (JSON.parse(readFileSync(manifestPath, 'utf8')) as { files?: unknown }).files;
      if (files && typeof files === 'object') manifest = files as Record<string, string | string[]>;
    } catch { manifest = {}; }
  }
  const names = readdirSync(dir).filter((name) => !name.startsWith('~$') && /\.(lolly|pptx)$/i.test(name) && statSync(path.join(dir, name)).isFile()).sort();

  const files: RecreateFileScoreV1[] = [];
  let closeBrowserTier = false;
  try {
    // A file made for several themes reopens once; each theme's entry carries that answer.
    const reopened = new Map<string, NonNullable<RecreateFileScoreV1['reopen']>>();
    for (const name of names) for (const theme of themesOfDelivered(name, themes, manifest)) {
      const format = name.toLowerCase().endsWith('.lolly') ? 'lolly' : 'pptx';
      const bytes = new Uint8Array(readFileSync(path.join(dir, name)));
      const base: RecreateFileScoreV1 = { name, format, theme, missingStrings: [], missingNotes: 0, undeclaredEdits: [], unmatchedEdits: 0, verify: {}, houseRules: {}, clippedText: 0, brandColorReview: 0 };
      let report: CheckReportV1;
      try {
        report = await checkFile(bytes, name, {
          ...(check && format === 'lolly' ? { designSystem: check, catalog } : {}),
          // A .pptx is held to the design system too: its painted colours and grounds (plan 291 M4).
          ...(check && format === 'pptx' ? { designSystem: check } : {}),
          ...(theme && themeNames.includes(theme) ? { theme } : {}),
          source: inventory,
          ...(edits.length ? { edits } : {}),
          browser: browser === 'require' ? 'auto' : browser,
        });
      } catch (err) {
        files.push({ ...base, error: (err as Error).message });
        continue;
      }
      const score: RecreateFileScoreV1 = {
        ...base,
        outcome: report.outcome,
        summary: report.summary,
        families: Object.fromEntries(Object.entries(report.families).map(([family, state]) => [family, state.state])),
        familyReasons: Object.fromEntries(Object.entries(report.families).flatMap(([family, state]) => state.reason ? [[family, state.reason]] : [])),
        ...(() => {
          const failed = Object.entries(report.families).filter(([, state]) => state.state === 'failed');
          return failed.length ? { failedFamilies: Object.fromEntries(failed.map(([family, state]) => [family, state.reason ?? 'no reason given'])) } : {};
        })(),
        ...fidelityOf(report),
        ...countFindings(report),
      };
      if (format === 'lolly') {
        const readback = readBackDesignSession(bytes);
        const frames = framesInOrder(readback.boxes);
        score.readback = { ok: readback.ok, problems: readback.problems, label: readback.label, layers: readback.layers, media: readback.media };
        score.notesLines = notesLinesOf(inventory, frames.map((frame) => (typeof frame.notes === 'string' ? notesParagraphsOfText(frame.notes) : null)));
        // Linked colours resolve in the file's theme first, so one document made for every theme is judged in each.
        const grounds = check && theme && themeNames.includes(theme) ? boxesInTheme(readback.boxes, check.doc, theme) : readback.boxes;
        if (theme === 'light' || theme === 'dark') score.themeGrounds = themeGroundsOf(grounds, theme, masterFor);
        if (browser === 'off') score.reopen = { state: 'not run', reason: 'the browser tier was turned off for this run' };
        else if (!readback.ok) score.reopen = { state: 'failed', reason: 'it did not read back in Node' };
        else if (reopened.has(name)) score.reopen = reopened.get(name)!;
        else {
          closeBrowserTier = !opts.reopen;
          score.reopen = await (opts.reopen ?? reopenViaWebShell)(bytes, name, readback.label);
          if (browser === 'require' && score.reopen.state === 'not run') score.reopen = { state: 'failed', reason: score.reopen.reason ?? 'the reopen could not run' };
          reopened.set(name, score.reopen);
        }
      } else {
        const structure = pptxStructureOf(bytes);
        if (structure) score.pptx = structure;
        // The delivered file's own grounds, so a deck exported in the wrong palette shows here.
        if ((theme === 'light' || theme === 'dark') && check) {
          try {
            const layoutNames = pptxSlideLayoutNames(bytes) ?? [];
            const masters = [catalog?.master, neutral].filter((m): m is SlideMasterV1 => !!m);
            const frameOf = (slide: number): Record<string, unknown> | null => {
              const name = layoutNames[slide - 1];
              if (!name) return null;
              for (const m of masters) {
                const hit = m.archetypes.find((a) => a.name === name);
                if (hit) return { master: m.id, archetype: hit.id };
              }
              return null;
            };
            score.themeGrounds = pptxThemeGroundsOf((await readPptxBrand(bytes)).grounds, theme, check.doc, { frameOf, masterFor });
          } catch {
            // checkFile already read it; a second read that fails leaves the measure out.
          }
        }
        try {
          const read = await readContentInventory({ bytes, name });
          score.notesLines = notesLinesOf(inventory, read.inventory.slides.map((slide) => slide.notes?.paragraphs ?? null));
        } catch {
          // checkFile already read it; a second read that fails leaves the measure out.
        }
      }
      files.push(score);
    }
  } finally {
    if (closeBrowserTier) {
      const { closeWebShell } = await import('../packages/node-shell/src/webshell-render.ts');
      const { closeBrowser } = await import('../packages/node-shell/src/browsers.ts');
      await closeWebShell();
      await closeBrowser();
    }
  }

  // The source's own score: the zero point of the reported counts.
  let sourceBaseline: RecreateScoreV1['sourceBaseline'] = null;
  try {
    const own = await checkFile(sourceInput.bytes, sourceInput.name, { source: inventory, browser: 'off' });
    sourceBaseline = { summary: own.summary, verify: countFindings(own).verify };
  } catch {
    sourceBaseline = null;
  }

  // Gates.
  const undelivered: string[] = [];
  for (const theme of themes) for (const format of formats) {
    if (!files.some((f) => f.theme === theme && f.format === format)) undelivered.push(`${theme} .${format}`);
  }
  const unthemed = files.filter((f) => !f.theme).map((f) => f.name);
  const sourceSlides = inventory.slides.length;
  const errored = files.filter((f) => f.error);
  // A file whose check could not finish has no error count to trust: it fails the gate, naming the families.
  const unfinished = files.filter((f) => f.failedFamilies);
  const checkErrors = sum(files, (f) => f.summary?.error ?? 0);
  const missingStrings = [...new Set(files.flatMap((f) => f.missingStrings))];
  const missingNotes = sum(files, (f) => f.missingNotes);
  const wrongCount = files.filter((f) => !f.error && f.slides?.result !== sourceSlides);
  const lollies = files.filter((f) => f.format === 'lolly');
  const notReopened = lollies.filter((f) => !f.readback?.ok || f.reopen?.state === 'failed');
  const allGates: RecreateGateV1[] = [
    {
      id: 'checkErrors', pass: checkErrors === 0 && errored.length === 0 && unfinished.length === 0 && files.length > 0,
      detail: files.length === 0 ? 'no .lolly or .pptx was delivered'
        : errored.length || unfinished.length ? [
          ...errored.map((f) => `${f.name}: ${f.error}`),
          ...unfinished.map((f) => `${f.name}: the ${Object.keys(f.failedFamilies!).join(' and ')} check${Object.keys(f.failedFamilies!).length === 1 ? '' : 's'} failed to run (${[...new Set(Object.values(f.failedFamilies!))].join('; ')})`),
        ].join('; ')
        : `${checkErrors} check error${checkErrors === 1 ? '' : 's'} across ${files.length} file${files.length === 1 ? '' : 's'}`,
    },
    { id: 'missingStrings', pass: missingStrings.length === 0 && files.length > 0, detail: missingStrings.length ? `missing and not declared: ${missingStrings.map((s) => `“${s.length > 60 ? `${s.slice(0, 59)}…` : s}”`).join(', ')}` : 'every source string is carried or declared' },
    { id: 'missingNotes', pass: missingNotes === 0 && files.length > 0, detail: missingNotes ? `${missingNotes} slide note${missingNotes === 1 ? '' : 's'} missing across the files` : 'every speaker note is carried' },
    { id: 'slides', pass: wrongCount.length === 0 && files.length > 0, detail: wrongCount.length ? wrongCount.map((f) => `${f.name} has ${f.slides?.result ?? 'no'} slides of ${sourceSlides}`).join('; ') : `every file has the source's ${sourceSlides} slides` },
    { id: 'themes', pass: undelivered.length === 0, detail: undelivered.length ? `not delivered: ${undelivered.join(', ')}` : `${themes.join(' and ')} delivered as ${formats.map((f) => `.${f}`).join(' and ')}` },
    {
      id: 'reopens', pass: lollies.length > 0 && notReopened.length === 0,
      detail: lollies.length === 0 ? 'no .lolly was delivered'
        : notReopened.length ? notReopened.map((f) => `${f.name}: ${f.readback?.ok ? f.reopen?.reason ?? 'the reopen failed' : f.readback?.problems.join(', ') ?? f.error ?? 'it did not read back'}`).join('; ')
        : `every .lolly reads back${lollies.every((f) => f.reopen?.state === 'passed') ? ' and reopens through #/open' : `; the #/open reopen did not run (${lollies.find((f) => f.reopen?.state === 'not run')?.reopen?.reason ?? 'not run'})`}`,
    },
    { id: 'edits', pass: editProblems.length === 0, detail: editProblems.length ? editProblems.join('; ') : editsPath ? `${edits.length} declared edit${edits.length === 1 ? '' : 's'}` : 'no edits.json' },
  ];
  const renderStates: Record<string, number> = {};
  for (const f of files) if (f.families?.render) bump(renderStates, f.families.render);
  const reported: RecreateScoreV1['reported'] = {
    verifyFindings: sum(files, (f) => total(f.verify)),
    sourceVerifyFindings: sourceBaseline ? total(sourceBaseline.verify) : null,
    houseRuleFindings: sum(files, (f) => total(f.houseRules)),
    clippedText: sum(files, (f) => f.clippedText),
    brandColorReview: sum(files, (f) => f.brandColorReview),
    undeclaredEdits: sum(files, (f) => f.undeclaredEdits.length),
    unmatchedEdits: sum(files, (f) => f.unmatchedEdits),
    notesLinesMerged: sum(files, (f) => f.notesLines?.merged.length ?? 0),
    notesLinesSplit: sum(files, (f) => f.notesLines?.split?.length ?? 0),
    themeGroundMismatches: sum(files, (f) => f.themeGrounds?.mismatched.length ?? 0),
    themeGroundsExempt: sum(files, (f) => f.themeGrounds?.exempt.length ?? 0),
    pptxTier: Object.fromEntries(files.flatMap((f) => (f.pptx ? [[f.name, f.pptx.tier] as const] : []))),
    renderStates,
    scaffolding: scaffoldingUnder(dir),
    undelivered,
    unthemed,
  };
  const notPainted = lollies.filter((f) => f.families?.render !== 'ran' || f.reopen?.state !== 'passed');
  const noteChanges = reported.notesLinesMerged + reported.notesLinesSplit;
  const fidelityEdits = reported.undeclaredEdits + reported.unmatchedEdits;
  const oneDocument = lollies.length === themes.length && new Set(lollies.map((f) => f.name)).size === 1
    && themes.every((theme) => lollies.some((f) => f.theme === theme));
  allGates.push(
    { id: 'verifyFindings', pass: files.length > 0 && files.every(f => f.families?.verify === 'ran') && reported.verifyFindings === 0, detail: `${reported.verifyFindings} Verify findings; ${files.filter(f => f.families?.verify !== 'ran').length} files without a Verify check` },
    { id: 'houseRuleFindings', pass: files.length > 0 && files.every(f => f.families?.brand === 'ran') && reported.houseRuleFindings === 0, detail: `${reported.houseRuleFindings} house-rule findings; ${files.filter(f => f.families?.brand !== 'ran').length} files without a brand check` },
    { id: 'clippedText', pass: files.length > 0 && reported.clippedText === 0, detail: `${reported.clippedText} clipped text layers` },
    { id: 'rendered', pass: lollies.length > 0 && notPainted.length === 0, detail: notPainted.length ? notPainted.map((f) => `${f.name} (${f.theme}): render ${f.families?.render ?? 'not run'}, reopen ${f.reopen?.state ?? 'not run'}${f.familyReasons?.render ? `; ${f.familyReasons.render}` : ''}`).join('; ') : 'every document theme was painted and reopened' },
    { id: 'themeGrounds', pass: files.length > 0 && reported.themeGroundMismatches === 0, detail: `${reported.themeGroundMismatches} theme-ground mismatches` },
    { id: 'noteLines', pass: files.length > 0 && noteChanges === 0, detail: `${noteChanges} changed note paragraphs or line breaks` },
    { id: 'fidelityEdits', pass: files.length > 0 && fidelityEdits === 0, detail: `${fidelityEdits} undeclared or unmatched edits` },
    { id: 'noScaffolding', pass: reported.scaffolding.length === 0, detail: reported.scaffolding.length ? reported.scaffolding.join(', ') : 'no scaffolding in the delivery' },
    { id: 'oneDocument', pass: oneDocument, detail: oneDocument ? 'one document serves every theme' : 'deliver one .lolly listed with every theme in delivery.json' },
  );
  const wanted = new Set<RecreatePassKeyV1>(opts.gates ?? RECREATE_BASE_PASS_KEYS);
  if (opts.acceptance) for (const key of RECREATE_PASS_KEYS) wanted.add(key);
  const gates = allGates.filter((g) => wanted.has(g.id));
  const pass = gates.every((g) => g.pass);
  const score: RecreateScoreV1 = {
    format: 'lolly-recreate-score',
    version: 1,
    case: opts.caseId ?? RECREATE_DEFAULT_CASE,
    ...(opts.label ? { label: opts.label } : {}),
    folder: dir,
    source: { name: sourceInput.name, sha256: inventory.source.sha256, slides: sourceSlides, notes: inventory.slides.filter((s) => s.notes).length },
    designSystem,
    edits: { file: editsPath ? path.basename(editsPath) : null, count: edits.length, problems: editProblems },
    themes,
    formats,
    files,
    sourceBaseline,
    gates,
    reported,
    pass,
    summary: '',
  };
  score.summary = summariseRecreation(score);
  return score;
}

/** One paragraph a person reads first: the verdict, the failed gates, and what was reported. */
export function summariseRecreation(score: RecreateScoreV1): string {
  const failed = score.gates.filter((g) => !g.pass);
  const verdict = failed.length === 0
    ? `All ${score.gates.length} gates pass for ${score.files.length} delivered file${score.files.length === 1 ? '' : 's'} against ${score.source.name} (${score.source.slides} slides).`
    : `${failed.length} of ${score.gates.length} gates fail for ${score.files.length} delivered file${score.files.length === 1 ? '' : 's'} against ${score.source.name}: ${failed.map((g) => `${g.id} (${g.detail})`).join('; ')}.`;
  const r = score.reported;
  const reported = `Reported measures: ${r.verifyFindings} Verify finding${r.verifyFindings === 1 ? '' : 's'} (the source itself has ${r.sourceVerifyFindings ?? 'an unknown number of'}), ${r.houseRuleFindings} house-rule finding${r.houseRuleFindings === 1 ? '' : 's'}, ${r.clippedText} clipped text layer${r.clippedText === 1 ? '' : 's'}, ${r.brandColorReview} colour${r.brandColorReview === 1 ? '' : 's'} to review, ${r.undeclaredEdits} undeclared edit${r.undeclaredEdits === 1 ? '' : 's'}, ${r.notesLinesMerged} note${r.notesLinesMerged === 1 ? '' : 's'} whose line breaks were merged, ${r.notesLinesSplit} note${r.notesLinesSplit === 1 ? '' : 's'} whose line breaks came back as paragraphs and ${r.themeGroundMismatches} frame${r.themeGroundMismatches === 1 ? '' : 's'} whose ground disagrees with its theme${r.themeGroundsExempt ? ` (${r.themeGroundsExempt} more exempt: the master has no form of that slide for the theme, or a photo covers it)` : ''}.`;
  const tiers = (['A', 'B'] as const).map((tier) => {
    const names = Object.keys(r.pptxTier ?? {}).filter((name) => r.pptxTier[name] === tier);
    if (!names.length) return '';
    const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return `${list} ${names.length === 1 ? 'is' : 'are'} Tier ${tier} (${tier === 'A' ? 'slide layouts and placeholders' : 'one blank layout, no placeholders'}).`;
  }).filter(Boolean).join(' ');
  const extra = [
    tiers,
    r.scaffolding.length ? `Scaffolding left in the folder: ${r.scaffolding.join(', ')}.` : '',
    r.unthemed.length ? `No theme read from: ${r.unthemed.join(', ')}.` : '',
    score.designSystem ? '' : 'No design system was given, so brand was not checked.',
  ].filter(Boolean).join(' ');
  return [verdict, reported, extra].filter(Boolean).join(' ');
}

// ─── the command ─────────────────────────────────────────────────────────────

const USAGE = 'Usage: node scripts/recreate-eval.ts <output-dir> [--case=<id>] [--eval=<recreate.json>] [--source=<deck>] [--edits=<edits.json>] [--file=<tokens.json>] [--profile=<name>] [--browser=auto|off|require] [--acceptance] [--label=<run label>] [--out=<score.json>] [--json]';
const VALUE_FLAGS = new Set(['case', 'eval', 'source', 'edits', 'file', 'profile', 'browser', 'label', 'out']);
/** The exit code when the scorer itself could not finish (an unexpected fault, or a score it could not write). */
export const RECREATE_EXIT_UNFINISHED = 3;

async function main(argv: string[]): Promise<number> {
  const flags = new Map<string, string>();
  let json = false;
  let acceptance = false;
  const positional: string[] = [];
  for (const arg of argv) {
    if (arg === '--json') { json = true; continue; }
    if (arg === '--acceptance') { acceptance = true; continue; }
    const m = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (m && VALUE_FLAGS.has(m[1]!)) { flags.set(m[1]!, m[2]!); continue; }
    if (arg.startsWith('-')) { process.stderr.write(`recreate-eval: ${arg} is not an option. ${USAGE}\n`); return 2; }
    positional.push(arg);
  }
  if (positional.length !== 1) { process.stderr.write(`${USAGE}\n`); return 2; }
  const browser = flags.get('browser') ?? 'auto';
  if (browser !== 'auto' && browser !== 'off' && browser !== 'require') { process.stderr.write(`recreate-eval: --browser takes auto, off or require. ${USAGE}\n`); return 2; }
  const home = process.env.HOME ?? '';
  const expand = (value: string): string => path.resolve(value.startsWith('~/') ? path.join(home, value.slice(2)) : value);
  try {
    const caseId = flags.get('case') ?? RECREATE_DEFAULT_CASE;
    const { evalCase, source: caseSource, designSystem: caseSystem, gates } = loadRecreateCase(flags.has('eval') ? expand(flags.get('eval')!) : RECREATE_EVAL_FILE, caseId);
    const source = flags.has('source') ? expand(flags.get('source')!) : caseSource;
    if (!source) {
      const env = typeof evalCase.source === 'object' ? evalCase.source.env : '';
      process.stderr.write(`recreate-eval: the case's source deck is not on this machine (set ${env} or pass --source)\n`);
      return 2;
    }
    const designSystem = flags.has('file') ? { file: expand(flags.get('file')!) }
      : flags.has('profile') ? { profile: flags.get('profile')! }
      : caseSystem;
    // Refuse an --out the score cannot be written to before grading, not after.
    const out = flags.has('out') ? expand(flags.get('out')!) : null;
    if (out) {
      const parent = path.dirname(out);
      if (!existsSync(parent) || !statSync(parent).isDirectory()) throw new RecreateUsageError(`--out names ${out}, but its folder ${parent} does not exist`);
      if (existsSync(out) && statSync(out).isDirectory()) throw new RecreateUsageError(`--out names ${out}, which is a folder; give a file name`);
    }
    const want = evalCase.env?.LOLLY_PROFILE;
    if (want && process.env.LOLLY_PROFILE !== want) {
      process.stderr.write(`recreate-eval: note: the case runs under LOLLY_PROFILE=${want}; this run has ${process.env.LOLLY_PROFILE ?? 'the sticky profile'}.\n`);
    }
    const score = await scoreRecreation({
      dir: expand(positional[0]!),
      source,
      ...(flags.has('edits') ? { edits: expand(flags.get('edits')!) } : {}),
      designSystem,
      themes: evalCase.themes,
      formats: evalCase.deliver.formats,
      browser,
      caseId,
      gates,
      acceptance,
      ...(flags.has('label') ? { label: flags.get('label')! } : {}),
    });
    const record = { ...score, run: runFacts() };
    let unwritten: string | null = null;
    if (out) {
      try { writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`); } catch (err) { unwritten = (err as Error).message; }
    }
    process.stdout.write(json ? `${JSON.stringify(record, null, 2)}\n` : `${score.summary}\n`);
    if (unwritten !== null) {
      process.stderr.write(`recreate-eval: the score was not written to ${out}: ${unwritten}\n`);
      return RECREATE_EXIT_UNFINISHED;
    }
    return score.pass ? 0 : 1;
  } catch (err) {
    if (err instanceof RecreateUsageError) { process.stderr.write(`recreate-eval: ${err.message}\n`); return 2; }
    // Exit 1 is kept for a failed gate; a fault in the scorer itself gets its own code.
    process.stderr.write(`recreate-eval: the scorer could not finish, so nothing was graded: ${(err as Error)?.stack ?? String(err)}\n`);
    return RECREATE_EXIT_UNFINISHED;
  }
}

/** Where the run happened: engine version, commit and how many paths were uncommitted. Best effort. */
function runFacts(): { engine?: string; commit?: string; dirty?: number } {
  const out: { engine?: string; commit?: string; dirty?: number } = {};
  try { out.engine = (JSON.parse(readFileSync(path.join(REPO, 'engine', 'package.json'), 'utf8')) as { version?: string }).version; } catch { /* left out */ }
  try {
    out.commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
    out.dirty = execFileSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean).length;
  } catch { /* not a checkout */ }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}

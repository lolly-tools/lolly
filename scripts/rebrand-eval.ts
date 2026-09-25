#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Run the rebrand pipeline over a directory of decks and print what it read.
 *
 * Run as: pnpm run eval:rebrand -- <dir> [--json] [--labels=<dir>] [--structures=<dir>] [--profile=<name>]
 *      or: node scripts/rebrand-eval.ts <dir> [--json] [--labels=<dir>] [--structures=<dir>] [--profile=<name>]
 *
 * The same five stages tests/rebrand-pipeline.test.ts pins, over decks that never
 * enter the repo: read the pptx into a `SourceDeckV1`, take the census, run the
 * first pass against the neutral lolly-start master, compile the plan with
 * nothing unreviewed applied, and draw every frame. The harness is imported from
 * tests/helpers/rebrand-pipeline.ts, the one the suite runs. Its stages are
 * `planDeck` and `compileDeck` from `@lolly-tools/node-shell/rebrand` and its
 * design system is `resolveProfileDesignSystem` on the lolly-start profile, the
 * calls `lolly rebrand` makes there, so a number printed here is a number of the
 * pipeline that is pinned there and that the CLI runs. Nothing is written into
 * the tree and no input file is opened for writing; the whole report goes to
 * stdout.
 *
 * Three tables come out: one row per deck for the counts, one class census across
 * the decks, and the dispositions the compile reached. That is the reading the
 * next milestones tune the census thresholds against. With `--json` the same
 * numbers go to stdout as one array instead, for a diff between two runs.
 *
 * The deck row also compiles the plan a second time with every proposal applied,
 * what Accept all hands the compile: `trayAll` is that tray and `noRole` the part
 * of it that waits because no archetype has a role for it, so a census change that
 * keeps more shapes shows its cost here rather than only as a class gain.
 * `coloursNo` is the plan's own unresolved colour count.
 *
 * `--profile=<name>` plans and compiles against that content profile's design
 * system, resolved by the same `resolveProfileDesignSystem` call `lolly rebrand`
 * makes with `LOLLY_PROFILE` set, so the numbers are the ones the CLI would
 * reach there. A profile whose packs are not on this machine (the SUSE pack on
 * a public clone) ends the run with exit code 2 rather than falling back to the
 * starter system, because a table measured against another design system would
 * be read as this one's.
 *
 * `--labels=<dir>` reads a hand-labelled census for each deck,
 * `<dir>/<deck name without extension>.labels.json` in the format of
 * `tests/fixtures/rebrand/*.labels.json`, and prints precision and recall per
 * class. A label names an object either by the reader's own id (the private
 * corpus labels do) or, for the synthetic fixtures whose ids name a `p:cNvPr`,
 * by its box through `labelForObject`, the join the suite uses. Objects with no
 * label are left out of the counts and reported as a number. A picture labelled
 * photo, screenshot, chart or diagram that the census held as unknown because
 * its text was never read is counted apart as well: plan 274 section 3.2 says
 * text not read is not evidence of a photo, so that miss is the honest answer
 * until a shell runs text recognition, and hiding it inside recall would make a
 * rule that guesses look better than one that waits.
 *
 * `--structures=<dir>` reads a per-slide structure label for each deck,
 * `<dir>/<deck name without extension>.structures.json` (`{ slides: [{ slide,
 * structure, accept?, note? }] }`: the layout library id a person names for the
 * slide, and any others that serve it as well), and scores the layout read of plan
 * 275 section 3 against them: per band (clear, likely, none, and slides the
 * matcher named nothing on), how many reads name the labelled structure or one it
 * accepts. A clear read whose archetype has fewer cells than the read needs is
 * counted apart as a slot-capacity breach (Numbered list, which continues by design,
 * aside). The compile is the measure that cannot be
 * miscounted, so a clear read the compile poured past its layout onto a continuation
 * slide (`layout.poured-to-continuation`) is counted and listed too, and every first-pass two-column pick is
 * checked against its label. With this flag PDF decks are read too, since the
 * flattened-page reads live there. The wrong reads are listed by deck and slide.
 *
 * A deck that throws is one row saying so, never the end of the run; the exit
 * code is 1 when at least one deck failed.
 */

import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { planSummary, reviewQueue } from '../engine/src/rebrand-review.ts';
import { capacityFits } from '../engine/src/rebrand-structure.ts';
import { compileDeck } from '../packages/node-shell/src/rebrand/index.ts';
import type { RebrandDesignSystemV1 } from '../engine/src/rebrand-design-system.ts';
import type { DeckCensusV1, RebrandReportV1, RenovationPlanV1, SourceDeckV1 } from '../packages/core/src/index.ts';
import type { RebrandFixtureLabelsV1 } from '../tests/helpers/rebrand-fixtures.ts';
import {
  STARTER_DESIGN_SYSTEM,
  labelForObject,
  planRows,
  profileDesignSystem,
  runRebrandPipeline,
  sourceObjects,
  warningCount,
} from '../tests/helpers/rebrand-pipeline.ts';

// ─── labels ──────────────────────────────────────────────────────────────────

/** Classes a picture can truly be that a census may only reach once text in it was read. */
const READ_DEPENDENT = new Set(['photo', 'screenshot', 'chart', 'diagram']);

/** Counts for one class: labelled, predicted, and both. */
interface ClassScore {
  labelled: number;
  predicted: number;
  hit: number;
}

interface LabelScore {
  /** Objects the labels named and the reader surfaced. */
  labelled: number;
  /** Source objects with no label. */
  unlabelled: number;
  /** Labelled objects the labels list as unsure, left out of every count. */
  unsure: number;
  /** Labelled pictures held as unknown because their text was not read. */
  heldUnread: number;
  classes: Record<string, ClassScore>;
  /** Label to prediction, for the misses only, as `label>predicted`: count. */
  confusions: Record<string, number>;
}

function readLabelsFor(dir: string | undefined, deckFile: string): RebrandFixtureLabelsV1 | null {
  if (!dir) return null;
  const base = path.basename(deckFile).replace(/\.(pptx|pdf)$/i, '');
  const file = path.join(dir, `${base}.labels.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as RebrandFixtureLabelsV1;
}

function scoreLabels(labels: RebrandFixtureLabelsV1, deck: SourceDeckV1, census: DeckCensusV1): LabelScore {
  const byId = new Map<string, string>();
  for (const slide of labels.slides) for (const label of slide.objects) byId.set(label.id, label.class);
  for (const label of labels.inherited) byId.set(label.id, label.class);
  const predicted = new Map(census.objects.map((row) => [row.id, row]));
  const unsure = new Set(labels.unsure ?? []);
  const score: LabelScore = { labelled: 0, unlabelled: 0, unsure: 0, heldUnread: 0, classes: {}, confusions: {} };
  const bump = (klass: string, key: keyof ClassScore): void => {
    const entry = score.classes[klass] ?? { labelled: 0, predicted: 0, hit: 0 };
    entry[key] += 1;
    score.classes[klass] = entry;
  };
  for (const slide of deck.slides) {
    for (const object of slide.objects) {
      let want = byId.get(object.id);
      if (want === undefined) {
        try {
          want = labelForObject(labels, slide.id, object)?.class;
        } catch {
          want = undefined;
        }
      }
      const row = predicted.get(object.id);
      if (want === undefined || !row) {
        score.unlabelled += 1;
        continue;
      }
      if (unsure.has(object.id)) {
        score.unsure += 1;
        continue;
      }
      const got = row.hypothesis.class;
      score.labelled += 1;
      bump(want, 'labelled');
      bump(got, 'predicted');
      if (want === got) {
        bump(want, 'hit');
        continue;
      }
      const unread = row.hypothesis.evidence.some((one) => one.signal === 'ocr-state' && one.value !== 'text-found' && one.value !== 'no-text-found');
      if (got === 'unknown' && READ_DEPENDENT.has(want) && unread) score.heldUnread += 1;
      const key = `${want}>${got}`;
      score.confusions[key] = (score.confusions[key] ?? 0) + 1;
    }
  }
  return score;
}

function mergeScores(scores: LabelScore[]): LabelScore {
  const out: LabelScore = { labelled: 0, unlabelled: 0, unsure: 0, heldUnread: 0, classes: {}, confusions: {} };
  for (const one of scores) {
    out.labelled += one.labelled;
    out.unlabelled += one.unlabelled;
    out.unsure += one.unsure;
    out.heldUnread += one.heldUnread;
    for (const [klass, entry] of Object.entries(one.classes)) {
      const into = out.classes[klass] ?? { labelled: 0, predicted: 0, hit: 0 };
      into.labelled += entry.labelled;
      into.predicted += entry.predicted;
      into.hit += entry.hit;
      out.classes[klass] = into;
    }
    for (const [key, n] of Object.entries(one.confusions)) out.confusions[key] = (out.confusions[key] ?? 0) + n;
  }
  return out;
}

const ratio = (hit: number, of: number): string => (of === 0 ? '-' : (hit / of).toFixed(2));

// ─── one deck ────────────────────────────────────────────────────────────────

interface DeckReport {
  name: string;
  ok: boolean;
  error?: string;
  slides: number;
  objects: number;
  frames: number;
  continuation: number;
  tray: number;
  previewBytes: number;
  groups: number;
  unverifiedGroupMembers: number;
  /** Colour uses the plan could not answer (a reason, or no target). */
  planUnresolvedColours: number;
  /** The compile report's own count, which records only those. */
  unresolvedColours: number;
  assignedColours: number;
  /**
   * The tray after every proposal is applied (Accept all), the case a person who
   * takes the suggestions sees, and how many of those wait for want of a role in
   * the master. The default run leaves proposals unapplied, so its tray hides this.
   */
  trayAccepted: number;
  trayAcceptedNoRole: number;
  fontsSubstituted: number;
  warnings: number;
  ms: number;
  /** Items the review queue shows, and how many of them sit in the needs-attention section. */
  queueItems: number;
  attentionItems: number;
  /** Rows a person is asked to look at, the footer's count. */
  attentionRows: number;
  classes: Record<string, number>;
  dispositions: Record<string, number>;
  labels?: LabelScore;
  structures?: StructureScore;
}

interface EvalOptions {
  system?: RebrandDesignSystemV1;
  labelsDir?: string;
  structuresDir?: string;
}

// ─── structure labels (plan 275 section 3.5) ─────────────────────────────────

/** One slide's structure label: the library id a person names, and others that serve as well. */
interface StructureLabel {
  slide: number;
  structure: string;
  accept?: string[];
  note?: string;
}

/** The band of a slide's read, or `unnamed` when the matcher named no structure. */
type StructureBand = 'clear' | 'likely' | 'none' | 'unnamed';
const STRUCTURE_BANDS: readonly StructureBand[] = ['clear', 'likely', 'none', 'unnamed'];

/** Structures the matcher leaves unnamed on purpose (a heading, plain text, an empty slide, a diagram). */
const UNNAMED_STRUCTURES: ReadonlySet<string> = new Set([
  'title-body', 'title-only', 'section', 'section-description', 'cover-title', 'cover-title-image', 'empty',
  'closing-thanks', 'closing-contact', 'agenda', 'statement', 'diagram', 'title-subtitle-body', 'kicker-title-body',
]);

/** Structures a two-column layout serves. */
const TWO_COLUMN_TRUTH: ReadonlySet<string> = new Set(['text-two-column', 'columns-2', 'comparison']);

interface StructureRow {
  slide: number;
  band: StructureBand;
  /** The structure read, or '-' when none was named. */
  read: string;
  layout: string;
  label?: string;
  right?: boolean;
  /** A clear read whose archetype has fewer cells than the read needs. */
  overCapacity: boolean;
  /** A clear read the compile poured past its layout onto a continuation slide: its report entry's message. */
  continued?: string;
}

interface StructureScore {
  rows: StructureRow[];
  unlabelled: number;
}

function readStructureLabels(dir: string | undefined, deckFile: string): StructureLabel[] | null {
  if (!dir) return null;
  const base = path.basename(deckFile).replace(/\.(pptx|pdf)$/i, '');
  const file = path.join(dir, `${base}.structures.json`);
  if (!existsSync(file)) return null;
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { slides?: StructureLabel[] };
  return Array.isArray(parsed.slides) ? parsed.slides : null;
}

function scoreStructures(labels: StructureLabel[] | null, deck: SourceDeckV1, plan: RenovationPlanV1, report: RebrandReportV1): StructureScore {
  const byNumber = new Map((labels ?? []).map((label) => [label.slide, label]));
  const poured = new Map<string, string>();
  for (const entry of report.entries) {
    if (entry.code === 'layout.poured-to-continuation' && entry.slideId) poured.set(entry.slideId, entry.message);
  }
  const planOf = new Map(plan.slides.map((slide) => [slide.id, slide]));
  const rows: StructureRow[] = [];
  let unlabelled = 0;
  deck.slides.forEach((slide, i) => {
    const planned = planOf.get(slide.id);
    if (!planned) return;
    const match = planned.layoutMatch;
    const band: StructureBand = match ? match.band : 'unnamed';
    const reason = planned.layoutReasons?.[0]?.params ?? {};
    const capacity = typeof reason.capacity === 'number' ? reason.capacity : undefined;
    const needs = typeof reason.needs === 'number' ? reason.needs : undefined;
    const row: StructureRow = {
      slide: i + 1,
      band,
      read: match?.structure ?? '-',
      layout: planned.layout,
      overCapacity: band === 'clear' && capacity !== undefined && needs !== undefined && !capacityFits(match?.structure ?? '', capacity, needs),
    };
    const continued = band === 'clear' ? poured.get(slide.id) : undefined;
    if (continued !== undefined) row.continued = continued;
    const label = byNumber.get(i + 1);
    if (label) {
      const ok = new Set([label.structure, ...(label.accept ?? [])]);
      row.label = label.structure;
      row.right = match ? ok.has(match.structure) : [...ok].some((id) => UNNAMED_STRUCTURES.has(id));
    } else {
      unlabelled += 1;
    }
    rows.push(row);
  });
  return { rows, unlabelled };
}

function printStructureScores(reports: DeckReport[]): void {
  const scored = reports.filter((report) => report.structures?.rows.some((row) => row.label !== undefined));
  if (scored.length === 0) return;
  const counts = new Map<StructureBand, { slides: number; labelled: number; right: number }>();
  for (const band of STRUCTURE_BANDS) counts.set(band, { slides: 0, labelled: 0, right: 0 });
  let overCapacity = 0;
  const continued: string[] = [];
  let twoColumn = 0;
  let twoColumnWrong = 0;
  const wrong: string[] = [];
  for (const report of scored) {
    for (const row of report.structures?.rows ?? []) {
      const entry = counts.get(row.band) as { slides: number; labelled: number; right: number };
      entry.slides += 1;
      if (row.overCapacity) overCapacity += 1;
      if (row.continued !== undefined) continued.push(`${report.name} s${row.slide}: read ${row.read}; ${row.continued}`);
      if (row.layout === 'two-column') {
        twoColumn += 1;
        if (row.label !== undefined && !TWO_COLUMN_TRUTH.has(row.label)) twoColumnWrong += 1;
      }
      if (row.label === undefined) continue;
      entry.labelled += 1;
      if (row.right) entry.right += 1;
      else if (row.band !== 'unnamed') wrong.push(`${row.band} ${report.name} s${row.slide}: read ${row.read}, labelled ${row.label}`);
    }
  }
  process.stdout.write('structure reads against the labels (plan 275 section 3.5)\n');
  process.stdout.write(`${table(
    ['band', 'slides', 'labelled', 'right', 'wrong', 'precision'],
    STRUCTURE_BANDS.map((band) => {
      const entry = counts.get(band) as { slides: number; labelled: number; right: number };
      return [band, String(entry.slides), String(entry.labelled), String(entry.right), String(entry.labelled - entry.right), ratio(entry.right, entry.labelled)];
    }),
  )}\n`);
  process.stdout.write(`clear reads over their slot capacity: ${overCapacity}\n`);
  process.stdout.write(`clear reads the compile poured onto a continuation slide: ${continued.length}\n`);
  if (continued.length > 0) process.stdout.write(`${continued.map((line) => `  ${line}`).join('\n')}\n`);
  process.stdout.write(`two-column layouts the first pass set: ${twoColumn}, of which ${twoColumnWrong} are not two columns by their label\n`);
  if (wrong.length > 0) process.stdout.write(`wrong reads:\n${wrong.map((line) => `  ${line}`).join('\n')}\n`);
  process.stdout.write('\n');
}

async function evaluateDeck(name: string, file: string, options: EvalOptions = {}): Promise<DeckReport> {
  const started = Date.now();
  const empty = {
    name, slides: 0, objects: 0, frames: 0, continuation: 0, tray: 0, previewBytes: 0, groups: 0,
    unverifiedGroupMembers: 0, planUnresolvedColours: 0, unresolvedColours: 0, assignedColours: 0,
    trayAccepted: 0, trayAcceptedNoRole: 0, fontsSubstituted: 0,
    warnings: 0, queueItems: 0, attentionItems: 0, attentionRows: 0, classes: {}, dispositions: {},
  };
  try {
    const run = await runRebrandPipeline(name, new Uint8Array(readFileSync(file)), options.system ? { system: options.system } : {});
    const { deck, census, plan, compiled, previews } = run;

    const classes: Record<string, number> = {};
    for (const row of planRows(plan)) classes[row.class] = (classes[row.class] ?? 0) + 1;
    const dispositions: Record<string, number> = {};
    for (const [key, value] of Object.entries(compiled.report.counts.objects)) {
      if (typeof value === 'number') dispositions[key] = value;
    }
    const queue = reviewQueue(plan, census, deck);
    const summary = planSummary(plan, deck, census);
    const labels = readLabelsFor(options.labelsDir, file);
    // The same plan compiled with every proposal applied, what Accept all hands the compile.
    const accepted = await compileDeck({
      source: deck,
      census,
      plan,
      system: options.system ?? STARTER_DESIGN_SYSTEM,
      applyUnreviewed: true,
      applyNeedsAttention: true,
    });
    const trayReasons = new Map<string, string>();
    for (const entry of accepted.compiled.report.entries) {
      if (entry.code === 'object.surplus-tray' && entry.objectId) trayReasons.set(entry.objectId, entry.reason ?? '');
    }
    const report: DeckReport = {
      ...empty,
      ok: true,
      slides: deck.slides.length,
      objects: sourceObjects(deck).length,
      frames: compiled.frames.length,
      continuation: compiled.frames.filter((frame) => frame.continuation).length,
      tray: compiled.tray.length,
      previewBytes: previews.reduce((sum, svg) => sum + svg.length, 0),
      groups: census.groups.length,
      unverifiedGroupMembers: census.groups.reduce((sum, group) => sum + (group.unverified?.length ?? 0), 0),
      planUnresolvedColours: plan.colors.filter((row) => row.unresolved !== undefined || (!row.to && !row.toPath)).length,
      unresolvedColours: compiled.report.counts.coloursUnresolved,
      trayAccepted: accepted.compiled.tray.length,
      trayAcceptedNoRole: [...trayReasons.values()].filter((reason) => reason === 'no-role-in-master').length,
      assignedColours: compiled.report.counts.coloursAssigned,
      fontsSubstituted: compiled.report.counts.fontsSubstituted,
      warnings: warningCount(deck),
      ms: run.ms,
      queueItems: queue.length,
      attentionItems: queue.filter((item) => item.section === 'attention').length,
      attentionRows: summary.review.attention,
      classes,
      dispositions,
    };
    if (labels) report.labels = scoreLabels(labels, deck, census);
    if (options.structuresDir) report.structures = scoreStructures(readStructureLabels(options.structuresDir, file), deck, plan, compiled.report);
    return report;
  } catch (error) {
    return {
      ...empty,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    };
  }
}

// ─── tables ──────────────────────────────────────────────────────────────────

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((head, index) =>
    Math.max(head.length, ...rows.map((row) => (row[index] ?? '').length)));
  const line = (cells: string[]): string =>
    cells.map((cell, index) => (index === 0 ? cell.padEnd(widths[index] ?? 0) : cell.padStart(widths[index] ?? 0)))
      .join('  ').trimEnd();
  return [line(headers), line(widths.map((width) => '-'.repeat(width))), ...rows.map(line)].join('\n');
}

function printTables(reports: DeckReport[]): void {
  const num = (value: number): string => String(value);
  process.stdout.write(`${table(
    ['deck', 'slides', 'objects', 'frames', 'cont', 'tray', 'trayAll', 'noRole', 'queue', 'attnItems', 'attnRows', 'groups', 'unverif', 'coloursOk', 'coloursNo', 'fonts', 'warn', 'svgKB', 'ms'],
    reports.map((report) => report.ok
      ? [
        report.name, num(report.slides), num(report.objects), num(report.frames), num(report.continuation),
        num(report.tray), num(report.trayAccepted), num(report.trayAcceptedNoRole),
        num(report.queueItems), num(report.attentionItems), num(report.attentionRows),
        num(report.groups), num(report.unverifiedGroupMembers), num(report.assignedColours),
        num(report.planUnresolvedColours), num(report.fontsSubstituted), num(report.warnings),
        num(Math.round(report.previewBytes / 1024)), num(report.ms),
      ]
      : [report.name, 'failed', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', num(report.ms)]),
  )}\n\n`);

  const classNames = [...new Set(reports.flatMap((report) => Object.keys(report.classes)))].sort();
  if (classNames.length > 0) {
    process.stdout.write(`${table(
      ['deck', ...classNames],
      reports.filter((report) => report.ok)
        .map((report) => [report.name, ...classNames.map((name) => num(report.classes[name] ?? 0))]),
    )}\n\n`);
  }

  const dispositionNames = [...new Set(reports.flatMap((report) => Object.keys(report.dispositions)))].sort();
  if (dispositionNames.length > 0) {
    process.stdout.write(`${table(
      ['deck', ...dispositionNames],
      reports.filter((report) => report.ok)
        .map((report) => [report.name, ...dispositionNames.map((name) => num(report.dispositions[name] ?? 0))]),
    )}\n\n`);
  }

  const labelled = reports.filter((report) => report.labels);
  for (const report of labelled) printLabelScore(report.name, report.labels as LabelScore);
  if (labelled.length > 1) printLabelScore('all labelled decks', mergeScores(labelled.map((report) => report.labels as LabelScore)));

  printStructureScores(reports);

  for (const report of reports) {
    if (!report.ok) process.stdout.write(`${report.name}: ${report.error ?? 'failed'}\n`);
  }
}

function printLabelScore(name: string, score: LabelScore): void {
  const names = Object.keys(score.classes).sort();
  process.stdout.write(`${name}: ${score.labelled} labelled objects, ${score.unlabelled} without a label, ${score.unsure} the labels are unsure of (left out), ${score.heldUnread} pictures held as unknown until their text is read\n`);
  process.stdout.write(`${table(
    ['class', 'labelled', 'predicted', 'hit', 'precision', 'recall'],
    names.map((klass) => {
      const entry = score.classes[klass] as ClassScore;
      return [klass, String(entry.labelled), String(entry.predicted), String(entry.hit), ratio(entry.hit, entry.predicted), ratio(entry.hit, entry.labelled)];
    }),
  )}\n`);
  const misses = Object.entries(score.confusions).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 12);
  if (misses.length > 0) process.stdout.write(`misses (label>census): ${misses.map(([key, n]) => `${key} ${n}`).join(', ')}\n`);
  process.stdout.write('\n');
}

// ─── the run ─────────────────────────────────────────────────────────────────

/**
 * Every pptx under a directory, sorted, lock files and hidden entries left out.
 *
 * Symbolic links are left out too, directories and files alike: a corpus folder of
 * shared material commonly holds a link back to one of its own ancestors, and a
 * walk that followed it would never finish.
 */
function decksUnder(dir: string, withPdf = false): string[] {
  const out: string[] = [];
  const visit = (absDir: string): void => {
    let entries: string[];
    try { entries = readdirSync(absDir); } catch { return; }
    for (const entry of entries.sort()) {
      if (entry.startsWith('.') || entry.startsWith('~$')) continue;
      const abs = path.join(absDir, entry);
      let stat: ReturnType<typeof lstatSync> | undefined;
      try { stat = lstatSync(abs); } catch { continue; }
      if (!stat || stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) visit(abs);
      else if (stat.isFile() && (path.extname(entry).toLowerCase() === '.pptx' || (withPdf && path.extname(entry).toLowerCase() === '.pdf'))) out.push(abs);
    }
  };
  visit(dir);
  return out;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const dirArg = args.find((arg) => !arg.startsWith('--'));
  const flagValue = (flag: string): string | undefined => args.find((arg) => arg.startsWith(`--${flag}=`))?.slice(flag.length + 3);
  if (!dirArg) {
    process.stderr.write('Usage: node scripts/rebrand-eval.ts <dir> [--json] [--labels=<dir>] [--structures=<dir>] [--profile=<name>]\n');
    return 2;
  }
  const home = process.env.HOME ?? '';
  const expand = (value: string): string => path.resolve(value.startsWith('~/') ? path.join(home, value.slice(2)) : value);
  const dir = expand(dirArg);
  const options: EvalOptions = {};
  const labelsArg = flagValue('labels');
  if (labelsArg) options.labelsDir = expand(labelsArg);
  const structuresArg = flagValue('structures');
  if (structuresArg) options.structuresDir = expand(structuresArg);
  const profile = flagValue('profile');
  if (profile) {
    const system = await profileDesignSystem(profile);
    if (!system) {
      process.stderr.write(`the ${profile} content profile does not resolve on this machine\n`);
      return 2;
    }
    options.system = system;
  }
  let isDir = false;
  try { isDir = statSync(dir).isDirectory(); } catch { isDir = false; }
  if (!isDir) {
    process.stderr.write(`${dir} is not a directory\n`);
    return 2;
  }

  const files = decksUnder(dir, options.structuresDir !== undefined);
  if (files.length === 0) {
    process.stderr.write(`no deck under ${dir}\n`);
    return 2;
  }

  const reports: DeckReport[] = [];
  for (const file of files) reports.push(await evaluateDeck(path.relative(dir, file), file, options));

  if (asJson) process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
  else printTables(reports);

  return reports.every((report) => report.ok) ? 0 : 1;
}

process.exitCode = await main();

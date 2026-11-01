// SPDX-License-Identifier: MPL-2.0
/**
 * The PDF accessibility report: which of 32 checks a PDF passes, fails, does not meet
 * or leaves to a person, in Lolly's words.
 *
 * The engine stays free of WebAssembly. A shell reads the file with the committed
 * `pdf-a11y` module (`packages/node-shell/wasm/pdf-a11y`) and hands this module the raw
 * answer; everything here is pure and total. `verifyExport` takes the same reader as an
 * option, so the export report can carry the checks beside the other readbacks.
 *
 * Honesty rules, the same family as preflight:
 *
 * 1. **Checks, not a verdict.** The report counts what passed and what failed. It never
 *    says a file meets a standard, and every report carries the statements below.
 * 2. **A pass needs something to look at.** A table check in a file with no tables did not
 *    check anything, so it reads "not applicable", never "pass".
 * 3. **A person still decides.** Six checks (reading order, colour contrast, flicker,
 *    scripts, timed responses, repeated links) cannot be judged by a program. They are
 *    listed as needing a person, not skipped and not passed.
 * 4. **The module's sentences describe the file.** The wording of each check is Lolly's.
 */

import type {
  PdfAccessibilityOutcome, PdfAccessibilityReport, PdfAccessibilityRow, PdfAccessibilityRuleResult, PdfAccessibilitySummary,
} from '@lolly-tools/core/host-v1';

export type { PdfAccessibilityOutcome, PdfAccessibilityReport, PdfAccessibilityRow, PdfAccessibilitySummary } from '@lolly-tools/core/host-v1';

/**
 * Reads a PDF and returns the module's raw answer, or undefined when the shell has no
 * reader. It may throw: the caller turns that into a named gap.
 */
export type PdfAccessibilityReader = (bytes: Uint8Array) => Promise<PdfAccessibilityReport | undefined> | PdfAccessibilityReport | undefined;

/** The sentences that qualify every PDF accessibility report. */
export const PDF_ACCESSIBILITY_STATEMENTS: readonly string[] = [
  'These checks list what a program could read from the file. They are not a PDF/UA conformance test, and passing them does not show that people who use assistive technology can use the document.',
  'A person still needs to check the file: read it with a screen reader, tab through it and judge its reading order, colour contrast and wording.',
  'A check marked not applicable found nothing of its kind to look at, so it says nothing about the file.',
];

interface RuleWords {
  readonly name: string;
  /** What the check looks for, in one plain sentence. */
  readonly description: string;
}

/** Lolly's own wording for the 32 checks, keyed by the module's stable ids. */
export const PDF_ACCESSIBILITY_RULES: Readonly<Record<string, RuleWords>> = {
  'permission-flag': { name: 'Text access allowed', description: 'The file\'s security settings allow screen readers to read its text.' },
  'image-only': { name: 'Has real text', description: 'At least one page has text that can be read, and the file is not only pictures of pages.' },
  'tagged-pdf': { name: 'Has tags', description: 'The file has a tag structure and is marked as tagged, which tells software how the content fits together.' },
  'logical-reading-order': { name: 'Reading order', description: 'The tags follow the order a person would read the pages in. Only a person can judge this.' },
  'primary-language': { name: 'Document language', description: 'The file names the language it is written in, so a screen reader picks the right voice.' },
  'title': { name: 'Document title', description: 'The file has a title, and the window shows it instead of the file name.' },
  'bookmarks': { name: 'Bookmarks in long files', description: 'A file of more than 20 pages has bookmarks to move around by.' },
  'color-contrast': { name: 'Colour contrast', description: 'Text stands out from its background. This check does not measure contrast, so a person has to look.' },
  'tagged-content': { name: 'Content is tagged', description: 'Everything drawn on the pages is tagged as content or marked as decoration.' },
  'tagged-annotations': { name: 'Links and notes are tagged', description: 'Links and other annotations are part of the tag structure.' },
  'tab-order': { name: 'Tab order follows tags', description: 'On pages with links or fields, the Tab key moves in the order of the tags.' },
  'character-encoding': { name: 'Text maps to characters', description: 'Every font says which characters its glyphs stand for, so copied or spoken text is right.' },
  'tagged-multimedia': { name: 'Media is tagged', description: 'Sound, video and 3D content are part of the tag structure.' },
  'screen-flicker': { name: 'No flashing', description: 'Nothing on the page flashes fast enough to cause harm. Only a person can judge this.' },
  'scripts': { name: 'Scripts', description: 'Scripts in the file do not get in the way of assistive technology. Only a person can judge this.' },
  'timed-responses': { name: 'No time limits', description: 'The file does not demand an answer within a time limit. Only a person can judge this.' },
  'navigation-links': { name: 'Links are not repetitive', description: 'Links that repeat on many pages are not a burden to skip. Only a person can judge this.' },
  'tagged-form-fields': { name: 'Fields are tagged', description: 'Every form field is part of the tag structure.' },
  'field-descriptions': { name: 'Fields have descriptions', description: 'Every form field has a description (a tooltip) that says what to enter.' },
  'figures-alt-text': { name: 'Figures have alternate text', description: 'Every figure has alternate text, so someone who cannot see it knows what it shows.' },
  'nested-alt-text': { name: 'Alternate text is not nested', description: 'Alternate text is not inside another element\'s alternate text, where it would never be read.' },
  'alt-text-associated': { name: 'Alternate text has content', description: 'Alternate text belongs to an element that has content on a page.' },
  'alt-text-hides-annotation': { name: 'Alternate text does not hide links', description: 'Alternate text does not cover up a link or note inside the same element.' },
  'other-elements-alt-text': { name: 'Other elements have alternate text', description: 'Formulas and other elements that need alternate text have it.' },
  'table-rows': { name: 'Table rows', description: 'Every table row sits inside a table or one of its sections.' },
  'table-cells': { name: 'Table cells', description: 'Every table cell sits inside a table row.' },
  'table-headers': { name: 'Table headers', description: 'Every table has header cells.' },
  'table-regularity': { name: 'Table shape', description: 'Every row of a table has the same number of columns, counting cells that span.' },
  'table-summary': { name: 'Table summary', description: 'Every table has a summary that says what it holds.' },
  'list-items': { name: 'List items', description: 'Every list item sits inside a list.' },
  'lbl-lbody': { name: 'List labels and bodies', description: 'Every list label and list body sits inside a list item.' },
  'heading-nesting': { name: 'Heading levels', description: 'Headings do not skip levels, such as a level 1 followed by a level 3.' },
};

/** The ids of the 32 checks, in the order the module reports them. */
export const PDF_ACCESSIBILITY_RULE_IDS: readonly string[] = Object.keys(PDF_ACCESSIBILITY_RULES);

const NOTE_CAP = 6;

/** The outcome a person reads for one raw result. */
export function pdfAccessibilityOutcome(rule: PdfAccessibilityRuleResult): PdfAccessibilityOutcome {
  if (rule.manual || rule.status === 'manual') return 'needs-person';
  if (rule.status === 'failed') return 'fail';
  if (rule.status === 'passed' && rule.applies) return 'pass';
  return 'not-applicable';
}

const PAGES_SHOWN = 8;

function pageList(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const shown = sorted.slice(0, PAGES_SHOWN).join(', ');
  const rest = sorted.length - PAGES_SHOWN;
  const label = sorted.length === 1 ? 'Page' : 'Pages';
  return `${label} ${shown}${rest > 0 ? ` and ${rest} more` : ''}`;
}

/** Where in the file a failed check found its problems. */
function whereOf(rule: PdfAccessibilityRuleResult, outcome: PdfAccessibilityOutcome): string {
  if (outcome !== 'fail') return outcome === 'needs-person' ? 'Whole file' : outcome === 'not-applicable' ? 'Nothing to check' : 'Whole file';
  const pages = rule.findings.flatMap(f => (typeof f.page === 'number' ? [f.page] : []));
  const elements = rule.findings.filter(f => f.object).length;
  const parts: string[] = [];
  if (pages.length) parts.push(pageList(pages));
  if (elements) parts.push(`${elements} tag${elements === 1 ? '' : 's'} (structure element${elements === 1 ? '' : 's'})`);
  return parts.length ? parts.join('; ') : 'Whole file';
}

/** Count of findings the module truncated into its own "... and n more" line. */
const MORE_LINE = /^… and (\d+) more$/;

/** Rows in rule order for a raw report. Unknown rule ids are kept, in the module's words, after the known ones. */
export function pdfAccessibilityRows(report: PdfAccessibilityReport): PdfAccessibilityRow[] {
  const rows = report.rules.map((rule): PdfAccessibilityRow => {
    const outcome = pdfAccessibilityOutcome(rule);
    const words = PDF_ACCESSIBILITY_RULES[rule.id];
    const messages: string[] = [];
    let more = 0;
    for (const f of rule.findings) {
      const m = MORE_LINE.exec(f.message);
      if (m) { more += Number(m[1]); continue; }
      messages.push(f.message);
    }
    const notes = outcome === 'fail' ? messages.slice(0, NOTE_CAP) : [];
    if (outcome === 'fail') more += Math.max(0, messages.length - NOTE_CAP);
    return {
      id: rule.id,
      category: rule.category,
      name: words?.name ?? rule.id,
      description: words?.description ?? 'A check this version of Lolly has no wording for.',
      outcome,
      where: whereOf(rule, outcome),
      notes,
      more,
    };
  });
  return rows;
}

/** The counts of each outcome. */
export function pdfAccessibilityCounts(rows: readonly PdfAccessibilityRow[]): Record<PdfAccessibilityOutcome, number> {
  const counts: Record<PdfAccessibilityOutcome, number> = { pass: 0, fail: 0, 'not-applicable': 0, 'needs-person': 0 };
  for (const row of rows) counts[row.outcome]++;
  return counts;
}

/** One sentence of counts, with no verdict. */
export function pdfAccessibilityHeadline(counts: Record<PdfAccessibilityOutcome, number>): string {
  const total = counts.pass + counts.fail + counts['not-applicable'] + counts['needs-person'];
  return `${counts.pass} of ${total} checks passed, ${counts.fail} failed, ${counts['not-applicable']} did not apply and ${counts['needs-person']} need a person. A person still needs to check the file.`;
}

/** The whole report Lolly shows and writes. Total: a malformed report gives an empty one, never a pass. */
export function summarisePdfAccessibility(report: PdfAccessibilityReport): PdfAccessibilitySummary {
  const rows = Array.isArray(report?.rules) ? pdfAccessibilityRows(report) : [];
  return {
    $format: 'lolly-pdf-accessibility',
    formatVersion: 1,
    pages: Number.isFinite(report?.pages) ? report.pages : 0,
    counts: pdfAccessibilityCounts(rows),
    rows,
    statements: [...PDF_ACCESSIBILITY_STATEMENTS],
  };
}

const OUTCOME_LABEL: Readonly<Record<PdfAccessibilityOutcome, string>> = {
  pass: 'Passed', fail: 'Failed', 'not-applicable': 'Not applicable', 'needs-person': 'Needs a person',
};

/** The outcome in words. */
export const pdfAccessibilityOutcomeLabel = (outcome: PdfAccessibilityOutcome): string => OUTCOME_LABEL[outcome];

/** The report as plain text, for the terminal and for a text attachment. */
export function pdfAccessibilityText(summary: PdfAccessibilitySummary): string {
  const lines: string[] = [`PDF checks (${summary.pages} page${summary.pages === 1 ? '' : 's'})`, pdfAccessibilityHeadline(summary.counts), ''];
  for (const row of summary.rows) {
    lines.push(`${OUTCOME_LABEL[row.outcome].padEnd(14)} ${row.id}  ${row.name}: ${row.description}`);
    if (row.outcome === 'fail') {
      lines.push(`${' '.repeat(15)}Where: ${row.where}`);
      for (const note of row.notes) lines.push(`${' '.repeat(15)}- ${note}`);
      if (row.more > 0) lines.push(`${' '.repeat(15)}- and ${row.more} more`);
    }
  }
  lines.push('', ...summary.statements);
  return lines.join('\n') + '\n';
}

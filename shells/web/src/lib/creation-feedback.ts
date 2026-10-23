// SPDX-License-Identifier: MPL-2.0
/**
 * Creation feedback in the web shell: the engine's `creationFeedback` report read off
 * the open Design document, and turned into rows for the export panel's "Before you
 * export" card.
 *
 * The report informs and never blocks. Nothing here disables Download, and there is
 * no list of ignored findings or exceptions: a house-rule finding is a warning that
 * says which layer it is about, and the writing line shows the band, the score inside the engine's
 * own summary sentence and a link that opens the text in Verify. The same report
 * reaches in-browser agents through the site tools (`site-tools-discovery.ts`).
 */
import { creationFeedback, designVisibleText, type CreationFeedbackReportV1 } from '@lolly/engine';
import type { TokensSnapshot } from '@lolly-tools/core/host-v1';
import { t, tRaw } from '../i18n.ts';
import type { PreflightRow } from '../views/export-preflight.ts';
import { setPendingVerify } from './verify-handoff.ts';

/** What the report is read from: the mounted tool's input model and its design system. */
export interface CreationFeedbackSource {
  model(): ReadonlyArray<{ id: string; value?: unknown }>;
  snapshot?(): Promise<TokensSnapshot | undefined> | TokensSnapshot | undefined;
}

export interface CreationFeedbackRead {
  report: CreationFeedbackReportV1;
  /** The scored text, layer by layer, for the Verify handoff. */
  text: string;
  /** Each layer's display name, by id: its `name`, else its id. */
  names: ReadonlyMap<string, string>;
}

const inputValue = (model: ReturnType<CreationFeedbackSource['model']>, id: string): unknown => model.find((item) => item.id === id)?.value;

/** Read the report for the document the source holds. A design system that cannot be read leaves the house rules unchecked. */
export async function readCreationFeedback(source: CreationFeedbackSource): Promise<CreationFeedbackRead> {
  const model = source.model();
  const boxes = inputValue(model, 'boxes');
  const textDocument = inputValue(model, 'textDocument');
  const background = inputValue(model, 'background');
  let snapshot: TokensSnapshot | undefined;
  try { snapshot = await source.snapshot?.(); } catch { snapshot = undefined; }
  const doc = snapshot?.document;
  const opts = {
    ...(textDocument !== undefined ? { textDocument } : {}),
    ...(background !== undefined ? { background } : {}),
    ...(snapshot?.selection?.theme ? { theme: snapshot.selection.theme } : {}),
  };
  const report = creationFeedback(boxes, undefined, doc ?? null, opts);
  const names = new Map<string, string>();
  for (const row of Array.isArray(boxes) ? boxes : []) {
    if (!row || typeof row !== 'object') continue;
    const { id, name } = row as { id?: unknown; name?: unknown };
    if (typeof id === 'string' && id) names.set(id, typeof name === 'string' && name.trim() ? name.trim() : id);
  }
  return { report, text: designVisibleText(boxes, opts).text, names };
}

/** House-rule finding rows shown before the rest are summarised in one line. */
const FINDING_ROWS = 40;
/** Flagged phrases listed under the writing line. */
const PHRASE_ROWS = 3;

/** The band in the Verify view's own word, so the two surfaces agree. */
function bandLabel(band: CreationFeedbackReportV1['writing']['band']): string {
  // Static t() so the extractor sees every key.
  const labels = { none: t('None'), weak: t('Weak'), notable: t('Notable'), strong: t('Strong') };
  return labels[band];
}

/** Hand the scored text to Verify, which reads it on mount as if it had been pasted. */
export function handTextToVerify(text: string): void {
  setPendingVerify({
    files: [new File([text], 'design-text.txt', { type: 'text/plain' })],
    note: t('This is the visible text of the Design document, layer by layer. Hidden layers are left out.'),
  });
}

/**
 * The card rows for one report: a house-rules line, one warning per finding with its
 * layer named, the writing line and a note for hidden layers. Pure apart from the
 * Verify handoff the link prepares.
 */
export function creationFeedbackRows(read: CreationFeedbackRead, opts: { openVerify?: (text: string) => void } = {}): PreflightRow[] {
  const { report, text, names } = read;
  const layer = (id: string): string => names.get(id) ?? id;
  const rows: PreflightRow[] = [];
  const rules = report.houseRules;
  if (rules.state === 'no-rules') {
    rows.push({ id: 'house-rules.none', tone: 'gap', text: t('This design system states no house rules for Design, so none were checked.') });
  } else if (rules.state === 'checked') {
    rows.push({
      id: 'house-rules.checked',
      tone: 'note',
      text: rules.findings.length
        ? tRaw('House rules checked ({n}). Every finding below says which layer it is about.', { n: String(rules.checked) })
        : tRaw('House rules checked ({n}): nothing to note.', { n: String(rules.checked) }),
    });
    for (const [i, f] of rules.findings.slice(0, FINDING_ROWS).entries()) {
      rows.push({ id: `house-rule.${i}.${f.ruleId}`, tone: 'warn', text: tRaw('“{layer}”: {message}', { layer: layer(f.layerId), message: f.message }) });
    }
    if (rules.findings.length > FINDING_ROWS) rows.push({ id: 'house-rules.limit', tone: 'gap', text: t('Some items are not shown. Review the rest after these items.') });
    if (rules.unknown.length) rows.push({ id: 'house-rules.unknown', tone: 'gap', text: tRaw('Not checked in this build: {rules}.', { rules: rules.unknown.join(', ') }) });
  }

  const w = report.writing;
  if (w.state === 'scored') {
    const details = w.band === 'none' ? [] : w.phrases.slice(0, PHRASE_ROWS).map((p) => tRaw('“{phrase}” in “{layer}”', { phrase: p.text, layer: layer(p.layerId) }));
    if (w.partial) details.push(t('Only the first 65,536 characters were scored.'));
    const open = opts.openVerify ?? handTextToVerify;
    rows.push({
      id: 'writing.score',
      tone: w.band === 'strong' ? 'warn' : 'note',
      text: tRaw('Writing signal: {band}. {summary}', { band: bandLabel(w.band), summary: w.summary }),
      ...(details.length ? { details } : {}),
      link: { label: t('Open the text in Verify'), href: '#/verify', prepare: () => open(text) },
    });
  }
  if (report.hidden.layers) rows.push({ id: 'creation.hidden', tone: 'gap', text: tRaw('Hidden layers with text left out of these checks: {n}.', { n: String(report.hidden.layers) }) });
  return rows;
}

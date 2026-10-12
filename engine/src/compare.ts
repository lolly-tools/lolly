// SPDX-License-Identifier: MPL-2.0
/** Shared bounded comparison of supplied immutable content snapshots. */
import type { CompareAPI, ComparisonRequest, ComparisonResult, ComparisonSource } from '@lolly-tools/core/host-v1';
import { comparisonBudget, COMPARE_MAX_TEXT } from './compare-budget.ts';
import { compareStructure } from './compare-structure.ts';
import { compareText } from './compare-text.ts';
import { compareVisualSources } from './compare-visual.ts';
import { compareTables } from './compare-tables.ts';
import { compareDocumentUnits } from './compare-document.ts';
import { readComparisonYaml } from './compare-yaml.ts';
export { compareStructure } from './compare-structure.ts';
export { comparisonBudget } from './compare-budget.ts';

function normalizeYaml(source: ComparisonSource, signal?: AbortSignal): ComparisonSource {
  if (source.content.kind !== 'yaml') return source;
  if (source.fidelity?.level === 'unavailable') return { ...source, content: { kind: 'structure', value: null } };
  const read = readComparisonYaml(source.content.text, signal);
  return { ...source, content: { kind: 'structure', value: read.ok ? read.value : null }, fidelity: {
    level: read.ok ? source.fidelity?.level ?? 'complete' : 'unavailable',
    limitations: [...source.fidelity?.limitations ?? [], read.ok
      ? 'YAML data values are compared. Comments, key order, quoting and formatting are outside this comparison.' : read.limitation],
  } };
}

/** No storage, rendering or logging; YAML reading is bounded within this job. */
export function compareSources(request: ComparisonRequest, signal?: AbortSignal): ComparisonResult {
  signal?.throwIfAborted();
  if (request.version !== 1) throw new Error('Unsupported comparison version.');
  const options = { ...request.options };
  const applicable = options.mode === undefined || options.mode === 'structure';
  const before = applicable ? normalizeYaml(request.before, signal) : request.before;
  const after = applicable ? normalizeYaml(request.after, signal) : request.after;
  const budget = comparisonBudget(options, signal);
  const mode = options.mode ?? (before.content.kind === after.content.kind && before.content.kind !== 'yaml' ? before.content.kind : 'text');
  let alignment: ComparisonResult['alignment'] = mode === 'text' ? options.granularity ?? 'line'
    : mode === 'table' ? 'table-position' : mode === 'document' ? 'document-position'
      : options.arrayAlignment === 'id' ? 'stable-id' : 'object-keys-ordered-arrays';
  let byteEquality: ComparisonResult['byteEquality'] = 'unknown';
  if (before.bytes && after.bytes) {
    if (before.bytes.length > COMPARE_MAX_TEXT || after.bytes.length > COMPARE_MAX_TEXT) budget.limitations.add('Byte equality was not checked above 2 MiB.');
    else byteEquality = before.bytes.length === after.bytes.length && before.bytes.every((value, i) => value === after.bytes![i]) ? 'equal' : 'different';
  }
  for (const source of [before, after]) {
    for (const limit of source.fidelity?.limitations ?? []) budget.limitations.add(limit);
    if (source.fidelity && source.fidelity.level !== 'complete') budget.limit('A source is incomplete or unavailable. Equality cannot be established.');
  }
  if ([before, after].some(source => source.fidelity?.level === 'unavailable')) {
    // An unavailable old version is not replaced with current content.
  } else if (mode === 'text' && before.content.kind === 'text' && after.content.kind === 'text') {
    compareText(before.content.text, after.content.text, options, budget);
  } else if (mode === 'structure' && before.content.kind === 'structure' && after.content.kind === 'structure') {
    compareStructure(before.content.value, after.content.value, options, budget);
  } else if (mode === 'table' && before.content.kind === 'table' && after.content.kind === 'table') {
    alignment = compareTables(before.content.tables, after.content.tables, options, budget);
  } else if (mode === 'document' && before.content.kind === 'document' && after.content.kind === 'document') {
    alignment = compareDocumentUnits(before.content.units, after.content.units, options, budget);
  } else budget.limit('The selected mode does not match both sources.');
  const different = budget.summary.total > 0;
  return { version: 1, before: { ...before.identity }, after: { ...after.identity }, mode, options,
    equality: different ? 'different' : budget.partial ? 'undetermined' : byteEquality === 'equal' ? 'identical-bytes' : 'equivalent-content',
    byteEquality, appearance: 'not-compared', completeness: budget.partial ? 'partial' : 'complete',
    alignment,
    summary: budget.summary, changes: budget.changes, detailsTruncated: budget.detailsTruncated, limitations: [...budget.limitations] };
}
export function createCompareAPI(): CompareAPI {
  return { async run(request, options) { return compareSources(request, options?.signal); }, async visual(request, options) { return compareVisualSources(request, options?.signal); } };
}

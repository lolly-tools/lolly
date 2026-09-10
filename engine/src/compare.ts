// SPDX-License-Identifier: MPL-2.0
/** Shared bounded comparison results for supplied immutable text or structure snapshots. */
import type { CompareAPI, ComparisonRequest, ComparisonResult } from '@lolly-tools/core/host-v1';
import { comparisonBudget, COMPARE_MAX_TEXT } from './compare-budget.ts';
import { compareStructure } from './compare-structure.ts';
import { compareText } from './compare-text.ts';
import { compareVisualSources } from './compare-visual.ts';
export { compareStructure } from './compare-structure.ts';
export { comparisonBudget } from './compare-budget.ts';

/** No storage, parsing, rendering or logging; providers supply immutable snapshots. */
export function compareSources(request: ComparisonRequest, signal?: AbortSignal): ComparisonResult {
  signal?.throwIfAborted();
  if (request.version !== 1) throw new Error('Unsupported comparison version.');
  const { before, after } = request, options = { ...request.options };
  const budget = comparisonBudget(options, signal);
  const mode = options.mode ?? (before.content.kind === 'structure' && after.content.kind === 'structure' ? 'structure' : 'text');
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
  } else budget.limit('The selected mode does not match both sources.');
  const different = budget.summary.total > 0;
  return { version: 1, before: { ...before.identity }, after: { ...after.identity }, mode, options,
    equality: different ? 'different' : budget.partial ? 'undetermined' : byteEquality === 'equal' ? 'identical-bytes' : 'equivalent-content',
    byteEquality, appearance: 'not-compared', completeness: budget.partial ? 'partial' : 'complete',
    alignment: mode === 'text' ? options.granularity ?? 'line' : options.arrayAlignment === 'id' ? 'stable-id' : 'object-keys-ordered-arrays',
    summary: budget.summary, changes: budget.changes, detailsTruncated: budget.detailsTruncated, limitations: [...budget.limitations] };
}
export function createCompareAPI(): CompareAPI {
  return { async run(request, options) { return compareSources(request, options?.signal); }, async visual(request, options) { return compareVisualSources(request, options?.signal); } };
}

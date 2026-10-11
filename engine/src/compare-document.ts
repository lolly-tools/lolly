// SPDX-License-Identifier: MPL-2.0
/** Extracted units retain their original locations and disclose ambiguous matching. */
import type { ComparisonDocumentUnit, ComparisonLocation, ComparisonOptions } from '@lolly-tools/core/host-v1';
import { comparisonValue, COMPARE_MAX_TEXT, type ComparisonBudget } from './compare-budget.ts';
import { compareText } from './compare-text.ts';
import { keyedComparisonPairs, positionalComparisonPairs, stationaryComparisonIndices, uniqueComparisonKeys, type ComparisonPair } from './compare-alignment.ts';

function withinLimits(units: readonly ComparisonDocumentUnit[], budget: ComparisonBudget): boolean {
  if (units.length > 20_000) { budget.limit('Document content exceeds the 20,000-unit comparison limit.'); return false; }
  let chars = 0;
  for (const unit of units) {
    if (!budget.spend()) return false;
    if (typeof unit.text !== 'string' || unit.id !== undefined && (typeof unit.id !== 'string' || unit.id.length > 1024) || unit.label !== undefined && (typeof unit.label !== 'string' || unit.label.length > 1024)) { budget.limit('Document units need bounded text labels and IDs.'); return false; }
    chars += unit.text.length + (unit.id?.length ?? 0) + (unit.label?.length ?? 0);
    if (chars > COMPARE_MAX_TEXT) { budget.limit('Document text exceeds the 2 MiB comparison limit.'); return false; }
  }
  return true;
}
function normalText(text: string, options: ComparisonOptions): string {
  let key = options.whitespace === 'ignore' ? text.replace(/\s+/g, ' ').trim() : text;
  if (options.ignoreCase) key = key.toLowerCase();
  return key;
}
function textPairs(before: readonly ComparisonDocumentUnit[], after: readonly ComparisonDocumentUnit[], options: ComparisonOptions, budget: ComparisonBudget): ComparisonPair[] {
  const index = (units: readonly ComparisonDocumentUnit[]): Map<string, number[]> => {
    const result = new Map<string, number[]>();
    units.forEach((unit, i) => { const key = normalText(unit.text, options); const group = result.get(key); if (group) group.push(i); else result.set(key, [i]); });
    return result;
  };
  const left = index(before), right = index(after), matchedLeft = new Set<number>(), matchedRight = new Set<number>(), pairs: ComparisonPair[] = [];
  let ambiguous = false;
  for (const [key, indices] of left) {
    const other = right.get(key);
    if (!key || indices.length > 1 || (other?.length ?? 0) > 1) { ambiguous = true; continue; }
    if (other?.length !== 1) continue;
    const a = indices[0]!, b = other[0]!;
    pairs.push({ before: a, after: b }); matchedLeft.add(a); matchedRight.add(b);
  }
  if ([...right].some(([key, indices]) => !key || indices.length > 1)) ambiguous = true;
  pairs.sort((a, b) => a.before! - b.before!);
  const stationary = stationaryComparisonIndices(pairs);
  for (const pair of pairs) if (!stationary.has(pair.before!)) pair.moved = true;
  // Unknown edited units are paired by their remaining order. Exact anchors are
  // never presented as proof that an edited or duplicate unit has a stable ID.
  const a = before.map((_, i) => i).filter(i => !matchedLeft.has(i)), b = after.map((_, i) => i).filter(i => !matchedRight.has(i));
  for (let i = 0; i < Math.max(a.length, b.length); i++) pairs.push({ before: a[i], after: b[i] });
  if (a.length || b.length) budget.limitations.add('Units without unique exact-text anchors were paired in remaining order. Edited units have no reliable move identity.');
  if (ambiguous) budget.limitations.add('Blank or repeated unit text is ambiguous and was not matched as a unique text anchor.');
  budget.limitations.add('Text alignment uses exact extracted content; it does not establish a stable page, slide or block identity.');
  return pairs.sort((a, b) => (a.before ?? before.length + a.after!) - (b.before ?? before.length + b.after!));
}
const location = (unit: ComparisonDocumentUnit, index: number): ComparisonLocation => ({ path: [unit.label || 'Unit', index], ...unit.location });
function add(budget: ComparisonBudget, kind: 'added' | 'removed' | 'moved', before: ComparisonDocumentUnit | undefined, after: ComparisonDocumentUnit | undefined, left?: ComparisonLocation, right?: ComparisonLocation): void {
  const a = comparisonValue(before?.text), b = comparisonValue(after?.text);
  budget.add({ kind, ...(left ? { before: left, beforeValue: a.text } : {}), ...(right ? { after: right, afterValue: b.text } : {}), valueTruncated: a.truncated || b.truncated });
}
export function compareDocumentUnits(before: readonly ComparisonDocumentUnit[], after: readonly ComparisonDocumentUnit[], options: ComparisonOptions, budget: ComparisonBudget): 'document-id' | 'document-text' | 'document-position' {
  if (!withinLimits(before, budget) || !withinLimits(after, budget)) return 'document-position';
  let alignment = options.documentAlignment ?? 'text';
  let pairs: ComparisonPair[];
  if (alignment === 'id') {
    const left = uniqueComparisonKeys(before.map(unit => unit.id ?? '')), right = uniqueComparisonKeys(after.map(unit => unit.id ?? ''));
    if (left && right) pairs = keyedComparisonPairs(left, right);
    else { alignment = 'position'; pairs = positionalComparisonPairs(before.length, after.length); budget.limitations.add('Missing or duplicate unit IDs were compared by position. No reliable ID match was invented.'); }
  } else if (alignment === 'text') pairs = textPairs(before, after, options, budget);
  else pairs = positionalComparisonPairs(before.length, after.length);
  if (alignment === 'position') budget.limitations.add('Document units were compared by position. Insertions can shift later units.');
  for (const pair of pairs) {
    if (!budget.spend()) break;
    const a = pair.before === undefined ? undefined : before[pair.before], b = pair.after === undefined ? undefined : after[pair.after];
    const left = a ? location(a, pair.before!) : undefined, right = b ? location(b, pair.after!) : undefined;
    if (!a || !b) { add(budget, a ? 'removed' : 'added', a, b, left, right); continue; }
    if (pair.moved) add(budget, 'moved', a, b, left, right);
    compareText(a.text, b.text, options, { ...budget, add(change) {
      budget.add({ ...change, ...(change.before ? { before: { ...change.before, ...left, path: [...left!.path, ...change.before.path] } } : {}), ...(change.after ? { after: { ...change.after, ...right, path: [...right!.path, ...change.after.path] } } : {}) });
    } });
  }
  return `document-${alignment}`;
}

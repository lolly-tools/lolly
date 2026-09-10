// SPDX-License-Identifier: MPL-2.0
import { compareStructure } from '../../../../engine/src/compare-structure.ts';
import { comparisonBudget } from '../../../../engine/src/compare-budget.ts';
/** Compatibility summary: bounded paths, no retained source values. */
export function revisionDifference(before: unknown, after: unknown): { paths: string[]; changed: number; truncated: boolean } {
  const options = { ignoreRootMetadata: true, maxChanges: 50, maxWork: 20_000 };
  const budget = comparisonBudget(options); compareStructure(before, after, options, budget);
  return { paths: budget.changes.map(change => (change.before ?? change.after)!.path.map(String).join('.') || 'Document'),
    changed: budget.summary.total, truncated: budget.partial || budget.detailsTruncated };
}

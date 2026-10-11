// SPDX-License-Identifier: MPL-2.0
/** Unique-key matching keeps the longest common order instead of moving every later item. */
export interface ComparisonPair { before?: number; after?: number; moved?: boolean }
export function uniqueComparisonKeys(keys: readonly string[]): Map<string, number> | undefined {
  const index = new Map<string, number>();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    if (!key || index.has(key)) return undefined;
    index.set(key, i);
  }
  return index;
}
export function stationaryComparisonIndices(pairs: readonly ComparisonPair[]): Set<number> {
  const common = pairs.filter((pair): pair is ComparisonPair & { before: number; after: number } => pair.before !== undefined && pair.after !== undefined);
  const tails: number[] = [], prior = new Int32Array(common.length).fill(-1);
  for (let i = 0; i < common.length; i++) {
    let low = 0, high = tails.length;
    while (low < high) { const middle = (low + high) >>> 1; if (common[tails[middle]!]!.after < common[i]!.after) low = middle + 1; else high = middle; }
    if (low) prior[i] = tails[low - 1]!;
    tails[low] = i;
  }
  const stable = new Set<number>();
  for (let i = tails.at(-1) ?? -1; i >= 0; i = prior[i]!) stable.add(common[i]!.before);
  return stable;
}
export function keyedComparisonPairs(before: Map<string, number>, after: Map<string, number>): ComparisonPair[] {
  const pairs: ComparisonPair[] = [];
  for (const [key, index] of before) pairs.push({ before: index, after: after.get(key) });
  const stable = stationaryComparisonIndices(pairs);
  for (const pair of pairs) if (pair.after !== undefined && pair.before !== undefined && !stable.has(pair.before)) pair.moved = true;
  for (const [key, index] of after) if (!before.has(key)) pairs.push({ after: index });
  return pairs;
}
export function positionalComparisonPairs(before: number, after: number): ComparisonPair[] {
  return Array.from({ length: Math.max(before, after) }, (_, index) => ({ before: index < before ? index : undefined, after: index < after ? index : undefined }));
}

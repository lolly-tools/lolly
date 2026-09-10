// SPDX-License-Identifier: MPL-2.0
/** Structured field comparison with ordered arrays and optional stable-ID moves. */
import type { ComparisonLocation, ComparisonOptions } from '@lolly-tools/core/host-v1';
import { comparisonValue, type ComparisonBudget } from './compare-budget.ts';
type Path = ComparisonLocation['path'];
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** Keep the longest common order. Inserting a row does not move every later row. */
function stationaryIds(before: Map<string, number>, after: Map<string, number>): Set<string> {
  const common = [...before.keys()].filter(id => after.has(id));
  const tails: number[] = [], prior = new Int32Array(common.length).fill(-1);
  for (let i = 0; i < common.length; i++) {
    const at = after.get(common[i]!)!;
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (after.get(common[tails[mid]!]!)! < at) lo = mid + 1; else hi = mid; }
    if (lo) prior[i] = tails[lo - 1]!;
    tails[lo] = i;
  }
  const stable = new Set<string>();
  for (let i = tails.at(-1) ?? -1; i >= 0; i = prior[i]!) stable.add(common[i]!);
  return stable;
}

/** Iterative, ordered-array traversal. Cycles/non-data values are explicitly partial. */
export function compareStructure(before: unknown, after: unknown, options: ComparisonOptions, budget: ComparisonBudget): void {
  const queue = [{ a: before, b: after, left: [] as Path, right: [] as Path }];
  const seenA = new WeakSet<object>(), seenB = new WeakSet<object>();
  const change = (kind: 'added' | 'removed' | 'changed' | 'moved', a: unknown, b: unknown, left: Path, right: Path): void => {
    const av = comparisonValue(a), bv = comparisonValue(b);
    budget.add({ kind, ...(kind !== 'added' ? { before: { path: left }, beforeValue: av.text } : {}),
      ...(kind !== 'removed' ? { after: { path: right }, afterValue: bv.text } : {}), valueTruncated: av.truncated || bv.truncated });
  };
  while (queue.length) {
    if (!budget.spend()) break;
    const { a, b, left, right } = queue.pop()!;
    if (a === b && (a === null || typeof a !== 'object')) continue;
    const arrays = Array.isArray(a) && Array.isArray(b);
    if (arrays || (record(a) && record(b))) {
      if (seenA.has(a) || seenB.has(b)) { budget.limit('Repeated or cyclic object references were not compared.'); continue; }
      seenA.add(a); seenB.add(b);
      if (left.length > 100 || right.length > 100) { budget.limit('Nested data beyond 100 levels was not compared.'); continue; }
      const ak = Object.keys(a), bk = Object.keys(b);
      if (arrays && (ak.length !== a.length || bk.length !== b.length)) { budget.limit('Sparse arrays or arrays with extra properties are not supported.'); continue; }
      if (ak.length + bk.length + queue.length > 40_000) { budget.limit('An object or array exceeds the 20,000-item comparison limit.'); continue; }
      if (arrays && options.arrayAlignment === 'id') {
        const ids = (items: unknown[]): Map<string, number> | null => {
          const map = new Map<string, number>();
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!record(item) || typeof item.id !== 'string' || map.has(item.id)) return null;
            map.set(item.id, i);
          }
          return map;
        };
        const am = ids(a), bm = ids(b);
        if (am && bm) {
          const stable = stationaryIds(am, bm);
          for (const [id, i] of am) {
            const j = bm.get(id);
            if (j === undefined) change('removed', a[i], undefined, [...left, i], right);
            else {
              if (!stable.has(id)) change('moved', a[i], b[j], [...left, i], [...right, j]);
              queue.push({ a: a[i], b: b[j], left: [...left, i], right: [...right, j] });
            }
          }
          for (const [id, j] of bm) if (!am.has(id)) change('added', undefined, b[j], left, [...right, j]);
          continue;
        }
        budget.limitations.add('An array has missing or duplicate IDs; it was compared by position.');
      }
      const ar = a as Record<string, unknown>, br = b as Record<string, unknown>;
      const keys = [...new Set([...ak, ...bk])];
      for (const key of keys.reverse()) {
        if (!left.length && options.ignoreRootMetadata && key.startsWith('__')) continue;
        const segment = arrays && /^\d+$/.test(key) ? Number(key) : key;
        const lp = [...left, segment], rp = [...right, segment];
        if (!Object.hasOwn(ar, key)) change('added', undefined, br[key], lp, rp);
        else if (!Object.hasOwn(br, key)) change('removed', ar[key], undefined, lp, rp);
        else queue.push({ a: ar[key], b: br[key], left: lp, right: rp });
      }
    } else {
      if ([a, b].some(v => typeof v === 'function' || typeof v === 'symbol' || (v && typeof v === 'object' && !Array.isArray(v) && !record(v)))) {
        budget.limit('Only plain structured data is supported.'); continue;
      }
      change('changed', a, b, left, right);
    }
  }
}

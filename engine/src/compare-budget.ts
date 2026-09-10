// SPDX-License-Identifier: MPL-2.0
/** Work and output limits shared by comparison algorithms. */
import type { ComparisonChange, ComparisonOptions, ComparisonResult } from '@lolly-tools/core/host-v1';
export const COMPARE_MAX_TEXT = 2 * 1024 * 1024;
export interface ComparisonBudget {
  changes: ComparisonChange[];
  summary: ComparisonResult['summary'];
  limitations: Set<string>;
  partial: boolean;
  detailsTruncated: boolean;
  spend(count?: number): boolean;
  add(change: ComparisonChange): void;
  limit(message: string): void;
}
export function comparisonBudget(options: ComparisonOptions, signal?: AbortSignal): ComparisonBudget {
  let work = 0;
  const bounded = (value: number | undefined, fallback: number, max: number): number => Number.isFinite(value) ? Math.max(1, Math.min(max, Math.floor(value!))) : fallback;
  const maxWork = bounded(options.maxWork, 1_000_000, 2_000_000);
  const maxChanges = bounded(options.maxChanges, 200, 1000);
  const budget: ComparisonBudget = {
    changes: [], summary: { added: 0, removed: 0, changed: 0, moved: 0, total: 0 },
    limitations: new Set(), partial: false, detailsTruncated: false,
    spend(count = 1) {
      signal?.throwIfAborted();
      work += count;
      if (work <= maxWork) return true;
      budget.limit('The comparison work limit was reached. Unchecked content may differ.'); return false;
    },
    add(change) {
      budget.summary[change.kind]++; budget.summary.total++;
      if (budget.changes.length < maxChanges) budget.changes.push(change);
      else budget.detailsTruncated = true;
    },
    limit(message) { budget.partial = true; budget.limitations.add(message); },
  };
  return budget;
}
/** Values are bounded display excerpts, never live source objects. */
export function comparisonValue(value: unknown): { text: string; truncated: boolean } {
  let text: string;
  if (typeof value === 'string') text = value;
  else if (value === null || typeof value === 'boolean' || typeof value === 'number') text = String(value);
  else if (value && typeof value === 'object') return structuredExcerpt(value);
  else text = `[${typeof value}]`;
  return { text: text.slice(0, 2000), truncated: text.length > 2000 };
}

function structuredExcerpt(value: object): { text: string; truncated: boolean } {
  let text = '', truncated = false, nodes = 0;
  const seen = new WeakSet<object>();
  const append = (part: string): void => { if (text.length + part.length > 2000) truncated = true; text += part.slice(0, Math.max(0, 2000 - text.length)); };
  const visit = (value: unknown, depth: number): void => {
    if (text.length >= 2000 || ++nodes > 100 || depth > 8) { truncated = true; return; }
    if (typeof value === 'string') { if (value.length > 2000) truncated = true; append(JSON.stringify(value.slice(0, 2000))); return; }
    if (value === null || typeof value !== 'object') { append(String(value)); return; }
    if (seen.has(value)) { truncated = true; append('[repeated reference]'); return; }
    seen.add(value);
    const array = Array.isArray(value); append(array ? '[' : '{');
    let count = 0;
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      if (count >= 20 || text.length >= 2000 || nodes >= 100) { truncated = true; break; }
      if (count++) append(', ');
      if (!array) append(`${JSON.stringify(key.slice(0, 2000))}: `);
      visit((value as Record<string, unknown>)[key], depth + 1);
    }
    append(array ? ']' : '}');
  };
  visit(value, 0); return { text, truncated };
}

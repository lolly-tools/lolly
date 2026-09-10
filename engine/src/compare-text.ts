// SPDX-License-Identifier: MPL-2.0
/** Bounded line and word alignment with original source locations. */
import type { ComparisonLocation, ComparisonOptions } from '@lolly-tools/core/host-v1';
import { COMPARE_MAX_TEXT, comparisonValue, type ComparisonBudget } from './compare-budget.ts';
interface Token { text: string; key: string; line: number; offset: number }
function tokens(text: string, options: ComparisonOptions): Token[] | null {
  let line = 1, offset = 0;
  const out: Token[] = [];
  const pattern = options.granularity === 'word' ? /\s+|[^\s]+/gu : /[^\n]*\n|[^\n]+$/g;
  for (const match of text.matchAll(pattern)) {
    const text = match[0];
    let key = options.whitespace === 'ignore' ? text.replace(/\s+/g, ' ').trim() : text;
    if (options.ignoreCase) key = key.toLowerCase();
    const token = { text, key, line, offset };
    offset += text.length; line += (text.match(/\n/g) ?? []).length;
    if (options.whitespace !== 'ignore' || token.key !== '') out.push(token);
    if (out.length > 20_000) return null;
  }
  return out;
}
/** Bounded LCS after stripping equal edges; no quadratic allocation for large inputs. */
export function compareText(before: string, after: string, options: ComparisonOptions, budget: ComparisonBudget): void {
  if (before.length > COMPARE_MAX_TEXT || after.length > COMPARE_MAX_TEXT) { budget.limit('Text exceeds the 2 MiB comparison limit.'); return; }
  if (before === after) return;
  const a = tokens(before, options), b = tokens(after, options);
  if (!a || !b) { budget.limit('Text exceeds the 20,000-token comparison limit.'); return; }
  let start = 0, ae = a.length, be = b.length;
  while (start < ae && start < be && a[start]!.key === b[start]!.key) start++;
  while (ae > start && be > start && a[ae - 1]!.key === b[be - 1]!.key) { ae--; be--; }
  const n = ae - start, m = be - start;
  if (!n && !m) return;
  if (!budget.spend((n + 1) * (m + 1))) return;
  const cols = m + 1, dp = new Uint32Array((n + 1) * cols);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i * cols + j] = a[start + i]!.key === b[start + j]!.key ? 1 + dp[(i + 1) * cols + j + 1]! : Math.max(dp[(i + 1) * cols + j]!, dp[i * cols + j + 1]!);
  let i = 0, j = 0;
  const location = (token: Token): ComparisonLocation => ({ path: [], line: token.line, offset: token.offset });
  while (i < n || j < m) {
    if (i < n && j < m && a[start + i]!.key === b[start + j]!.key) { i++; j++; continue; }
    const left: Token[] = [], right: Token[] = [];
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i]!.key === b[start + j]!.key) break;
      if (j < m && (i === n || dp[i * cols + j + 1]! > dp[(i + 1) * cols + j]!)) right.push(b[start + j++]!);
      else left.push(a[start + i++]!);
    }
    const av = comparisonValue(left.map(t => t.text).join('')), bv = comparisonValue(right.map(t => t.text).join(''));
    budget.add({ kind: !left.length ? 'added' : !right.length ? 'removed' : 'changed',
      ...(left.length ? { before: location(left[0]!), beforeValue: av.text } : {}),
      ...(right.length ? { after: location(right[0]!), afterValue: bv.text } : {}), valueTruncated: av.truncated || bv.truncated });
  }
}

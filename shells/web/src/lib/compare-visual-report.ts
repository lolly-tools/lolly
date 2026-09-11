// SPDX-License-Identifier: MPL-2.0
import type { VisualComparisonResult } from '@lolly-tools/core/host-v1';
/** Reports never contain source pixels, masks, or bytes. Names require explicit opt-in. */
export function visualComparisonReport(result: VisualComparisonResult, includeNames = false): string {
  const { version, mode, options, byteEquality, appearance, completeness, summary } = result;
  return JSON.stringify({ version, mode, options, byteEquality, appearance, completeness, summary,
    ...(includeNames ? { before: result.before, after: result.after, pages: result.pages.map(({ mask: _mask, ...page }) => page) } : {}) }, null, 2);
}

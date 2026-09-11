// SPDX-License-Identifier: MPL-2.0
import type { ComparisonResult } from '@lolly-tools/core/host-v1';
/** Default reports omit names, paths, values and provider-supplied explanations. */
export function comparisonReport(result: ComparisonResult, includeContent = false): string {
  return JSON.stringify(includeContent ? result : {
    version: result.version, mode: result.mode, equality: result.equality,
    byteEquality: result.byteEquality, appearance: result.appearance,
    completeness: result.completeness, summary: result.summary,
    detailsTruncated: result.detailsTruncated,
  }, null, 2);
}

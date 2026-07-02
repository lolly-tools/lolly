// SPDX-License-Identifier: MPL-2.0
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export function escape(s: unknown): string {
  // `?? c` is unreachable (the regex only matches mapped chars) but keeps the
  // lookup total under noUncheckedIndexedAccess without a cast.
  return String(s ?? '').replace(/[&<>"']/g, c => HTML_ESCAPES[c] ?? c);
}

// SPDX-License-Identifier: MPL-2.0
/**
 * The one XML text/attribute escaper for the document writers (EPUB, ODT, AppStream). The
 * five entities XML 1.0 names, nothing else: writers that also strip control characters
 * (SCORM, the Markdown docs) keep their own stricter variant on purpose.
 */

/** `s` with `& < > " '` replaced by their XML entities. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

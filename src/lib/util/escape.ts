// SPDX-License-Identifier: MPL-2.0
/**
 * The web shell's escapers - one implementation per semantics.
 *
 * Three different jobs used to travel under the same short name (`esc`) in a
 * dozen files: HTML escaping, `CSS.escape` for a selector, and regular-expression
 * quoting. They are not interchangeable, and the HTML copies had drifted to three
 * different character classes (`&<>`, `&<>"`, `&<>"'`), so whether a value was
 * safe in a single-quoted attribute depended on which file you happened to be in.
 *
 * This module is a leaf: it imports nothing, so anything may import it.
 * `utils.ts` re-exports {@link escapeHtml} as `escape`, the name most of the
 * shell already calls.
 */

const HTML_ENTITY: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * HTML escape for text nodes AND attribute values - all five characters, the
 * single quote included, so a value is safe in `attr='…'` as well as `attr="…"`.
 * There is no separate `escapeAttr`: the attribute case is the strict one, and
 * escaping the quotes costs a text node nothing (a browser renders `&#39;` as
 * `'`). Nullish becomes the empty string rather than "null".
 */
export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ENTITY[c]!);
}

/**
 * Quote every regular-expression metacharacter, so a user string matches as a
 * literal inside `new RegExp(...)`.
 */
export function escapeRegex(s: unknown): string {
  return String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `CSS.escape` for an id or attribute value going into a selector, with the
 * fallback the local copies carried: jsdom (the test host for every view that
 * builds a selector) has no `CSS.escape`, so quote the two characters that can
 * end an `[attr="…"]` value there instead of passing the string through raw.
 */
export function cssEscape(s: unknown): string {
  const str = String(s ?? '');
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(str)
    : str.replace(/["\\]/g, '\\$&');
}

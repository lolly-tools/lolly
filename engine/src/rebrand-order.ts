// SPDX-License-Identifier: MPL-2.0
/**
 * One string order for the census, the plan, the colour solve and the compile.
 *
 * `String.prototype.localeCompare` reads the host's ICU data and its default
 * locale, so two machines can order the same ids differently: a use id such as
 * `ppt/slides/slide10.xml.2:text` holds punctuation and digits, which collation
 * weighs apart from their code units, and some locales tailor letters as well.
 * Where an order decides an answer (the search order of the colour solve, a tie
 * between two archetypes or two classes) a different order is a different plan
 * for the same bytes. Every sort in these modules uses this comparator instead.
 *
 * Pure: a comparison of UTF-16 code units, the same on every host.
 */

/** Order two strings by UTF-16 code unit, never by the host's collation. */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

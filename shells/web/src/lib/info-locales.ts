// SPDX-License-Identifier: MPL-2.0
/**
 * Which /info locale trees a build ships.
 *
 * `LOLLY_INFO_LOCALES` is a comma-separated list of locale codes, read by the docs
 * build (docs/build.ts) and passed to this shell by Vite's `define` as
 * `import.meta.env.VITE_INFO_LOCALES`. Unset or empty means every locale, which is
 * what lolly.tools and every other build ship. English is the root tree at /info/
 * and is always built, whether or not the list includes English.
 *
 * An instance that ships fewer locales (lolly.ing ships English only) links every
 * other locale to the public project site, `https://lolly.tools/info/<lang>/...`,
 * which carries all of them, rather than to a page this build does not have.
 * Pure: no DOM, so the docs build imports it as well.
 */
import { LANGS } from '../../../../engine/src/lang.ts';
import type { Lang } from '../../../../engine/src/lang.ts';

/** The public project site, which carries every /info locale. */
export const INFO_PUBLIC_ORIGIN = 'https://lolly.tools';

/**
 * The locales a build ships, from a `LOLLY_INFO_LOCALES` value, or null for every
 * locale. English always comes first. An unknown code is an error, so a typo cannot
 * silently drop a language from a build.
 */
export function parseInfoLocales(raw: string | null | undefined): readonly Lang[] | null {
  const codes = String(raw ?? '').split(',').map((code) => code.trim()).filter(Boolean);
  if (!codes.length) return null;
  const unknown = codes.filter((code) => !(LANGS as readonly string[]).includes(code));
  if (unknown.length) throw new Error(`LOLLY_INFO_LOCALES names unknown locales: ${unknown.join(', ')} (expected codes from engine/src/lang.ts LANGS)`);
  return LANGS.filter((lang) => lang === 'en' || codes.includes(lang));
}

/** This build's locales, or null for every locale. */
function builtLocales(): readonly Lang[] | null {
  try {
    // Cast, not a global type: the docs build typechecks this module without Vite's
    // ImportMeta. The expression stays `import.meta.env.VITE_INFO_LOCALES` for the define.
    return parseInfoLocales((import.meta as unknown as { env?: { VITE_INFO_LOCALES?: string } }).env?.VITE_INFO_LOCALES);
  } catch {
    // The docs build refuses an unknown code before Vite runs, so this only guards a
    // hand-made build: it keeps the shell's links local, as with no list at all.
    return null;
  }
}
const BUILT = builtLocales();

/** Does this build ship the /info pages for `lang`? */
export function infoLocaleBuilt(lang: Lang, built: readonly Lang[] | null = BUILT): boolean {
  return lang === 'en' || !built || built.includes(lang);
}

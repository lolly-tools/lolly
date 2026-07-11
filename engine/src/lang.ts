// SPDX-License-Identifier: MPL-2.0
/**
 * Supported UI/content languages, shared by the `lang` reserved URL param
 * (url-mode.ts), `Profile.lang`, tool-manifest i18n sidecars, and every shell's
 * language picker. Canonical codes are short BCP-47 primary tags; a few informal
 * aliases people actually type (country codes `cn`/`jp`) are accepted on parse
 * and normalized to the canonical tag before anything is stored or serialized —
 * profile, URLs, and sidecar filenames only ever contain canonical codes.
 *
 * `htmlLang` is the exact value for the `<html lang>` attribute — not always
 * identical to the code itself (Simplified Chinese needs the `Hans` script
 * subtag for correct Han-unification glyph selection across fallback fonts).
 */

export const LANGS = ['en', 'es', 'de', 'fr', 'zh', 'ja', 'vi'] as const;
export type Lang = (typeof LANGS)[number];

export interface LangMeta {
  code: Lang;
  /** Value for <html lang>. */
  htmlLang: string;
  /** Name in the language itself, for picker UI. */
  nativeName: string;
  /** English name, for glossary/tooling output. */
  englishName: string;
}

export const LANG_META: Record<Lang, LangMeta> = {
  en: { code: 'en', htmlLang: 'en', nativeName: 'English', englishName: 'English' },
  es: { code: 'es', htmlLang: 'es', nativeName: 'Español', englishName: 'Spanish' },
  de: { code: 'de', htmlLang: 'de', nativeName: 'Deutsch', englishName: 'German' },
  fr: { code: 'fr', htmlLang: 'fr', nativeName: 'Français', englishName: 'French' },
  zh: { code: 'zh', htmlLang: 'zh-Hans', nativeName: '简体中文', englishName: 'Simplified Chinese' },
  ja: { code: 'ja', htmlLang: 'ja', nativeName: '日本語', englishName: 'Japanese' },
  vi: { code: 'vi', htmlLang: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese' },
};

// Informal aliases accepted on parse (country codes people actually type).
// Always normalized away — never written to storage/URLs/filenames.
const ALIASES: Record<string, Lang> = {
  cn: 'zh',
  'zh-cn': 'zh',
  'zh-hans': 'zh',
  'zh-hans-cn': 'zh',
  jp: 'ja',
};

export function isLang(v: string): v is Lang {
  return (LANGS as readonly string[]).includes(v);
}

/** Normalize a raw lang tag/alias to a canonical code, or null if unrecognized. */
export function normalizeLang(raw: string | null | undefined): Lang | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (isLang(v)) return v;
  return ALIASES[v] ?? null;
}

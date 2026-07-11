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
 *
 * `dir` marks right-to-left scripts ('rtl' — Arabic; absent means ltr). Every
 * consumer that stamps `<html lang>` must stamp `dir` from the same entry, or
 * RTL text renders with LTR bidi context (wrong punctuation sides, wrong
 * alignment) even when the translation itself is correct.
 */

export const LANGS = ['en', 'es', 'de', 'fr', 'zh', 'ja', 'vi', 'pt', 'zh-hant', 'cs', 'nl', 'tl', 'sv', 'ms', 'ro', 'ar', 'it', 'no', 'ko'] as const;
export type Lang = (typeof LANGS)[number];

export interface LangMeta {
  code: Lang;
  /** Value for <html lang>. */
  htmlLang: string;
  /** Name in the language itself, for picker UI. */
  nativeName: string;
  /** English name, for glossary/tooling output. */
  englishName: string;
  /** Script direction — set ('rtl') only for right-to-left languages; absent ⇒ ltr. */
  dir?: 'rtl';
}

export const LANG_META: Record<Lang, LangMeta> = {
  en: { code: 'en', htmlLang: 'en', nativeName: 'English', englishName: 'English' },
  es: { code: 'es', htmlLang: 'es', nativeName: 'Español', englishName: 'Spanish' },
  de: { code: 'de', htmlLang: 'de', nativeName: 'Deutsch', englishName: 'German' },
  fr: { code: 'fr', htmlLang: 'fr', nativeName: 'Français', englishName: 'French' },
  zh: { code: 'zh', htmlLang: 'zh-Hans', nativeName: '简体中文', englishName: 'Simplified Chinese' },
  ja: { code: 'ja', htmlLang: 'ja', nativeName: '日本語', englishName: 'Japanese' },
  vi: { code: 'vi', htmlLang: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese' },
  pt: { code: 'pt', htmlLang: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)' },
  'zh-hant': { code: 'zh-hant', htmlLang: 'zh-Hant', nativeName: '繁體中文', englishName: 'Traditional Chinese' },
  cs: { code: 'cs', htmlLang: 'cs', nativeName: 'Čeština', englishName: 'Czech' },
  nl: { code: 'nl', htmlLang: 'nl', nativeName: 'Nederlands', englishName: 'Dutch' },
  tl: { code: 'tl', htmlLang: 'tl', nativeName: 'Tagalog', englishName: 'Tagalog' },
  sv: { code: 'sv', htmlLang: 'sv', nativeName: 'Svenska', englishName: 'Swedish' },
  ms: { code: 'ms', htmlLang: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay' },
  ro: { code: 'ro', htmlLang: 'ro', nativeName: 'Română', englishName: 'Romanian' },
  ar: { code: 'ar', htmlLang: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  it: { code: 'it', htmlLang: 'it', nativeName: 'Italiano', englishName: 'Italian' },
  no: { code: 'no', htmlLang: 'no', nativeName: 'Norsk', englishName: 'Norwegian' },
  ko: { code: 'ko', htmlLang: 'ko', nativeName: '한국어', englishName: 'Korean' },
};

// Informal aliases accepted on parse (country codes people actually type).
// Always normalized away — never written to storage/URLs/filenames.
const ALIASES: Record<string, Lang> = {
  cn: 'zh',
  'zh-cn': 'zh',
  'zh-hans': 'zh',
  'zh-hans-cn': 'zh',
  jp: 'ja',
  br: 'pt',
  'pt-br': 'pt',
  pt_br: 'pt',
  tw: 'zh-hant',
  hk: 'zh-hant',
  'zh-tw': 'zh-hant',
  'zh-hk': 'zh-hant',
  'zh-hant-tw': 'zh-hant',
  hant: 'zh-hant',
  my: 'ms', // Malaysia's country code, commonly typed for "Malaysian"
  fil: 'tl', // Filipino — the modern standardized register of Tagalog
  // Regioned Arabic tags (browser navigator.language values people paste into
  // ?lang=) — all one MSA UI register here, so they collapse to the base tag.
  'ar-sa': 'ar',
  'ar-eg': 'ar',
  'ar-ae': 'ar',
  nb: 'no', // Bokmål — the specific written standard this UI register actually uses
  nn: 'no', // Nynorsk — not a distinct UI translation, collapses to the same Norwegian tag
  kr: 'ko', // South Korea's country code, commonly typed for "Korean"
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

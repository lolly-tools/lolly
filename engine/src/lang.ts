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

export const LANGS = ['en', 'zh', 'es', 'hi', 'bn', 'ur', 'ar', 'fr', 'pt', 'de', 'ja', 'it', 'vi', 'tl', 'ko', 'id', 'ms', 'nl', 'ro', 'sv', 'cs', 'no', 'zh-hant', 'bg', 'tr', 'uk', 'pl'] as const;
export type Lang = (typeof LANGS)[number];

export interface LangMeta {
  code: Lang;
  /** Value for <html lang>. */
  htmlLang: string;
  /** Name in the language itself, for picker UI. */
  nativeName: string;
  /** English name, for glossary/tooling output. */
  englishName: string;
  /**
   * Approximate total speakers (native + second-language), in millions.
   * Picker-sort data for the language menus' most-spoken-first ordering — not a census.
   */
  speakers: number;
  /** Script direction — set ('rtl') only for right-to-left languages; absent ⇒ ltr. */
  dir?: 'rtl';
  /**
   * 1–3 ISO 3166-1 alpha-2 country codes whose flags stand for this language,
   * most-representative first (English → gb, us, au). Picker UIs render them with
   * flagEmoji(); they're decorative garnish beside the nativeName, which stays the
   * accessible label. Absent on entries that predate the field ⇒ render none.
   */
  flags?: readonly string[];
}

/**
 * ISO 3166-1 alpha-2 country code → its flag emoji (a regional-indicator pair).
 * Pure and DOM-free: 'us' → 🇺🇸. Returns '' for anything that isn't two ASCII
 * letters, so a bad code degrades to no flag rather than mojibake. Note flag
 * emoji have no glyphs on some platforms (Windows) — callers wanting a guaranteed
 * render must supply their own images; here they're a progressive garnish.
 */
export function flagEmoji(cc: string): string {
  const s = String(cc ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(s)) return '';
  if (s === 'AU') return '🐨';
  const RI = 0x1f1e6; // 🇦 — regional indicator symbol letter A
  const A = 'A'.charCodeAt(0);
  return String.fromCodePoint(RI + s.charCodeAt(0) - A, RI + s.charCodeAt(1) - A);
}

export const LANG_META: Record<Lang, LangMeta> = {
  en: { code: 'en', htmlLang: 'en', nativeName: 'English', englishName: 'English', speakers: 1500, flags: ['gb', 'us', 'au'] },
  es: { code: 'es', htmlLang: 'es', nativeName: 'Español', englishName: 'Spanish', speakers: 560, flags: ['es', 'mx', 'ar'] },
  de: { code: 'de', htmlLang: 'de', nativeName: 'Deutsch', englishName: 'German', speakers: 135, flags: ['de', 'at', 'ch'] },
  fr: { code: 'fr', htmlLang: 'fr', nativeName: 'Français', englishName: 'French', speakers: 310, flags: ['fr', 'ca', 'be'] },
  zh: { code: 'zh', htmlLang: 'zh-Hans', nativeName: '简体中文', englishName: 'Simplified Chinese', speakers: 1140, flags: ['cn', 'sg'] },
  ja: { code: 'ja', htmlLang: 'ja', nativeName: '日本語', englishName: 'Japanese', speakers: 125, flags: ['jp'] },
  vi: { code: 'vi', htmlLang: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', speakers: 86, flags: ['vn'] },
  pt: { code: 'pt', htmlLang: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', speakers: 260, flags: ['br', 'pt'] },
  'zh-hant': { code: 'zh-hant', htmlLang: 'zh-Hant', nativeName: '繁體中文', englishName: 'Traditional Chinese', speakers: 32, flags: ['tw', 'hk'] },
  cs: { code: 'cs', htmlLang: 'cs', nativeName: 'Čeština', englishName: 'Czech', speakers: 13, flags: ['cz'] },
  nl: { code: 'nl', htmlLang: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', speakers: 30, flags: ['nl', 'be'] },
  tl: { code: 'tl', htmlLang: 'tl', nativeName: 'Tagalog', englishName: 'Tagalog', speakers: 83, flags: ['ph'] },
  sv: { code: 'sv', htmlLang: 'sv', nativeName: 'Svenska', englishName: 'Swedish', speakers: 13, flags: ['se'] },
  ms: { code: 'ms', htmlLang: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay', speakers: 80, flags: ['my', 'sg', 'bn'] },
  ro: { code: 'ro', htmlLang: 'ro', nativeName: 'Română', englishName: 'Romanian', speakers: 25, flags: ['ro', 'md'] },
  hi: { code: 'hi', htmlLang: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', speakers: 610, flags: ['in'] },
  bn: { code: 'bn', htmlLang: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', speakers: 280, flags: ['bd', 'in'] },
  ur: { code: 'ur', htmlLang: 'ur', nativeName: 'اردو', englishName: 'Urdu', dir: 'rtl', speakers: 230, flags: ['pk', 'in'] },
  id: { code: 'id', htmlLang: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', speakers: 200, flags: ['id'] },
  ar: { code: 'ar', htmlLang: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', speakers: 380, flags: ['sa', 'eg', 'ae'] },
  bg: { code: 'bg', htmlLang: 'bg', nativeName: 'Български', englishName: 'Bulgarian', speakers: 8, flags: ['bg'] },
  tr: { code: 'tr', htmlLang: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', speakers: 90, flags: ['tr', 'cy'] },
  uk: { code: 'uk', htmlLang: 'uk', nativeName: 'Українська', englishName: 'Ukrainian', speakers: 40, flags: ['ua'] },
  pl: { code: 'pl', htmlLang: 'pl', nativeName: 'Polski', englishName: 'Polish', speakers: 45, flags: ['pl'] },
  it: { code: 'it', htmlLang: 'it', nativeName: 'Italiano', englishName: 'Italian', speakers: 68, flags: ['it', 'ch'] },
  no: { code: 'no', htmlLang: 'no', nativeName: 'Norsk', englishName: 'Norwegian', speakers: 5, flags: ['no'] },
  ko: { code: 'ko', htmlLang: 'ko', nativeName: '한국어', englishName: 'Korean', speakers: 82, flags: ['kr'] },
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
  'hi-in': 'hi', // regioned Hindi tag (navigator.language) — one standard-Hindi register here
  // Regioned Bengali tags — one standard-Bengali (cholito) register covers both.
  'bn-bd': 'bn',
  'bn-in': 'bn',
  // Regioned Urdu tags — one Modern Standard Urdu register covers both.
  'ur-pk': 'ur',
  'ur-in': 'ur',
  // Indonesian: `in` is the DEPRECATED ISO 639-1 code (pre-1989) that Android's
  // Java locale layer still emits (navigator.language 'in'/'in-ID' in WebViews).
  // It reads like India's country code, but India has no single language, so the
  // standards-based reading wins.
  in: 'id',
  'in-id': 'id',
  'id-id': 'id',

  // Regioned Turkish tags (navigator.language) — one standard-Turkish register
  // covers both Türkiye and Cyprus.
  'tr-tr': 'tr',
  'tr-cy': 'tr',
  'uk-ua': 'uk', // regioned Ukrainian tag (navigator.language)
  ua: 'uk', // Ukraine's country code, commonly typed for "Ukrainian" (no ISO 639 collision)
  'pl-pl': 'pl', // regioned Polish tag (navigator.language)
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

/** Ordering for the language pickers: 'speakers' (most-spoken first, default) or 'az'. */
export type LangSort = 'speakers' | 'az';

/**
 * The shared picker ordering used by every language menu (web shell lang-fab +
 * the /info site nav) — 'speakers' (descending `speakers`, most-spoken first)
 * is the default; ties keep LANGS order (Array.prototype.sort is stable). 'az'
 * sorts ascending by nativeName.
 */
export function sortedLangs(order: LangSort = 'speakers'): Lang[] {
  const langs = [...LANGS];
  if (order === 'az') {
    return langs.sort((a, b) => LANG_META[a].nativeName.localeCompare(LANG_META[b].nativeName, 'en'));
  }
  return langs.sort((a, b) => LANG_META[b].speakers - LANG_META[a].speakers);
}

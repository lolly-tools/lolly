// SPDX-License-Identifier: MPL-2.0
// === lolly:shared certificate-i18n - canonical source; edit here and run pnpm run sync:shared ===
// The words the Certificate prints, by language. Keys are the English source text;
// a language or a string missing from the table prints in English, and the hook
// then formats the date in English too, so a sheet is never half translated.
// The English list, with context for translators, is CT_PRINTED below; translations
// are added here by a reviewed translation pass, never by machine at render time.
var CT_TEXT = {};
var CT_PRINTED = [
  'Certificate of Completion',
  'Certificate of Achievement',
  'Certificate of Award',
  'Certificate of Appreciation',
  'This is to certify that',
  'has successfully completed',
  'is recognised for achievement in',
  'is hereby awarded',
  'in appreciation of',
  'Date',
  'Play motion',
  'This certificate could not be laid out. Check the sheet size and the colours.'
];
// Right-to-left languages among the ones Lolly ships (engine/src/lang.ts).
var CT_RTL = { ar: 1, ur: 1 };
// The value for Intl and the `lang` attribute, where it differs from the code.
var CT_LOCALE = { en: 'en-GB', zh: 'zh-Hans', 'zh-hant': 'zh-Hant', pt: 'pt-BR' };
function ctLangOf(code) {
  var c = String(code || '').trim().toLowerCase().replace(/_/g, '-');
  if (c === 'zh-hans' || c === 'zh-cn' || c === 'cn') return 'zh';
  if (c === 'zh-tw' || c === 'zh-hk' || c === 'tw' || c === 'hk') return 'zh-hant';
  if (c === 'pt-br' || c === 'br') return 'pt';
  if (c === 'jp') return 'ja';
  return c;
}
// The language the sheet is printed in: the requested one when the table has it,
// English otherwise.
function ctPrintLang(code) {
  var c = ctLangOf(code);
  return c && c !== 'en' && Object.prototype.hasOwnProperty.call(CT_TEXT, c) ? c : 'en';
}
function ctText(text, lang) {
  var table = Object.prototype.hasOwnProperty.call(CT_TEXT, lang) ? CT_TEXT[lang] : null;
  return table && Object.prototype.hasOwnProperty.call(table, text) && table[text] ? table[text] : text;
}
// === /lolly:shared certificate-i18n ===

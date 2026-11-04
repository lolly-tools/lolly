// SPDX-License-Identifier: MPL-2.0
/**
 * LOLLY_INFO_LOCALES in the docs build and the web build.
 *
 * docs/build.ts builds the whole site when it is imported, so these checks read its
 * source, as other docs-build tests do. The behaviour behind them (an English-only
 * build writes /info and no locale tree, links every other locale at lolly.tools and
 * lists only its own pages in the sitemap) is the lolly.ing preview build, measured in
 * the change that added the knob. The parser and the shell's links are tested for
 * behaviour in shells/web/src/lib/info-locales.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const build = readFileSync(new URL('../docs/build.ts', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../shells/web/vite.config.js', import.meta.url), 'utf8');

test('the docs build reads the list with the shell\'s own parser, every locale by default', () => {
  assert.match(build, /import \{ parseInfoLocales \} from '\.\.\/shells\/web\/src\/lib\/info-locales\.ts';/);
  assert.match(build, /const BUILT_LANGS: readonly Lang\[\] = parseInfoLocales\(process\.env\.LOLLY_INFO_LOCALES\) \?\? LANGS;/);
  assert.match(build, /const SITE_URL = 'https:\/\/lolly\.tools';/);
});

test('pages, search indexes and redirect stubs are written for built locales only', () => {
  assert.match(build, /for \(const lang of BUILT_LANGS\) \{\n\s+activeCatalog = loadSiteCatalog\(lang\);/);
  assert.match(build, /for \(const lang of BUILT_LANGS\) for \(const original of stubs\) \{/);
  assert.doesNotMatch(build, /for \(const lang of LANGS\) \{\n\s+activeCatalog/);
  // A tree an earlier full build left in the output directory does not ship.
  assert.match(build, /if \(lang !== 'en' && !BUILT_LANGS\.includes\(lang\)\) rmSync\(resolve\(outDir, lang\), \{ recursive: true, force: true \}\);/);
});

test('the language switcher links a locale this build leaves out at lolly.tools', () => {
  assert.match(build, /function localeLink\(lang: Lang, slug: string\): string \{\n\s+return BUILT_LANGS\.includes\(lang\) \? localeHref\(lang, slug\) : `\$\{SITE_URL\}\$\{localeHref\(lang, slug\)\}`;/);
  assert.match(build, /class="lang-menu-item" data-lang="\$\{l\}" data-href="\$\{esc\(localeLink\(l, slug\)\)\}"/);
});

test('hreflang alternates name every locale at lolly.tools; the sitemap lists only built pages', () => {
  assert.match(build, /const alternates = LANGS\.map\(l =>\n\s+`<link rel="alternate" hreflang="\$\{LANG_META\[l\]\.htmlLang\}" href="\$\{esc\(`\$\{SITE_URL\}\$\{localeHref\(l, page\.slug\)\}`\)\}">`/);
  assert.match(build, /return BUILT_LANGS\.map\(lang => ` {2}<url>\\n {4}<loc>\$\{esc\(`\$\{SITE_URL\}\$\{localeHref\(lang, slug\)\}`\)\}<\/loc>/);
  assert.match(build, /<xhtml:link rel="alternate" hreflang="\$\{LANG_META\[l\]\.htmlLang\}" href="\$\{esc\(`\$\{SITE_URL\}\$\{localeHref\(l, slug\)\}`\)\}"\/>/);
});

test('the web build hands the same list to the shell as a build-time constant', () => {
  // Defined only when set, so a build without the list keeps its chunks as they were.
  assert.match(vite, /\.\.\.\(process\.env\.LOLLY_INFO_LOCALES \? \{ 'import\.meta\.env\.VITE_INFO_LOCALES': JSON\.stringify\(process\.env\.LOLLY_INFO_LOCALES\) \} : \{\}\),/);
});

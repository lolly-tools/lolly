// SPDX-License-Identifier: MPL-2.0
/**
 * LOLLY_INFO_LOCALES: which /info locale trees a build ships, and where the shell's
 * docs links go for a locale the build leaves out (lib/info-locales.ts).
 *
 * The list reaches the shell as import.meta.env.VITE_INFO_LOCALES through Vite's
 * define, so the shell cases bundle i18n.ts and the docs index with esbuild under
 * the same define, once as an English-only build (lolly.ing) and once with no list
 * (lolly.tools and every other build).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { INFO_PUBLIC_ORIGIN, infoLocaleBuilt, parseInfoLocales } from './info-locales.ts';

test('no list means every locale; a list always keeps English first, in LANGS order', () => {
  for (const unset of [undefined, null, '', ' , ']) assert.equal(parseInfoLocales(unset), null);
  assert.deepEqual(parseInfoLocales('en'), ['en']);
  assert.deepEqual(parseInfoLocales('de'), ['en', 'de']);
  assert.deepEqual(parseInfoLocales(' fr , de,en '), ['en', 'fr', 'de']);
});

test('an unknown code is refused, so a typo cannot drop a language silently', () => {
  assert.throws(() => parseInfoLocales('en,german'), /unknown locales: german/);
  assert.throws(() => parseInfoLocales('EN'), /unknown locales: EN/);
});

test('a locale is built when there is no list, when it is listed, and English always', () => {
  assert.equal(infoLocaleBuilt('de', null), true);
  assert.equal(infoLocaleBuilt('de', ['en']), false);
  assert.equal(infoLocaleBuilt('en', ['en']), true);
  assert.equal(infoLocaleBuilt('de', ['en', 'de']), true);
  assert.equal(INFO_PUBLIC_ORIGIN, 'https://lolly.tools');
});

/** The shell's docs link helpers, bundled the way Vite builds them with `env` as import.meta.env. */
async function shellLinks(env: Record<string, string>): Promise<{
  docsHref: (slug: string, lang: string) => string;
  docsInfoHref: (slug: string, lang: string) => string;
  docsBase: (lang: string) => string;
}> {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-info-locales-'));
  try {
    const out = await build({
      stdin: {
        contents: "export { docsHref, docsInfoHref } from './i18n.ts'; export { docsBase } from './lib/search/docs-index.ts';",
        resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'ts',
      },
      bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
      // The locale catalogs are dynamic imports the link helpers never reach.
      external: ['*.json'],
      define: { 'import.meta.env': JSON.stringify(env) },
    });
    const file = join(dir, 'links.mjs');
    writeFileSync(file, out.outputFiles[0]!.text);
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('an English-only build links other locales to lolly.tools and reads its own English pages', async () => {
  const { docsHref, docsInfoHref, docsBase } = await shellLinks({ VITE_INFO_LOCALES: 'en' });
  // The help or share link: the page in German, on the site that serves German pages.
  assert.equal(docsHref('start/quickstart', 'de'), 'https://lolly.tools/info/de/start/quickstart.html');
  assert.equal(docsHref('index', 'ja'), 'https://lolly.tools/info/ja/index.html');
  assert.equal(docsHref('start/quickstart', 'en'), '/info/start/quickstart.html');
  // What the in-app reader fetches and the search reads: pages this build serves.
  assert.equal(docsInfoHref('start/quickstart', 'de'), '/info/start/quickstart.html');
  assert.equal(docsBase('de'), '/info');
  assert.equal(docsBase('en'), '/info');
});

test('with no list every link stays local, as on lolly.tools', async () => {
  const { docsHref, docsInfoHref, docsBase } = await shellLinks({});
  assert.equal(docsHref('start/quickstart', 'de'), '/info/de/start/quickstart.html');
  assert.equal(docsInfoHref('start/quickstart', 'de'), '/info/de/start/quickstart.html');
  assert.equal(docsBase('de'), '/info/de');
  const listed = await shellLinks({ VITE_INFO_LOCALES: 'en,de' });
  assert.equal(listed.docsHref('index', 'de'), '/info/de/index.html');
  assert.equal(listed.docsHref('index', 'fr'), 'https://lolly.tools/info/fr/index.html');
});

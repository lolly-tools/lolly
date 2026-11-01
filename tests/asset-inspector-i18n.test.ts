// SPDX-License-Identifier: MPL-2.0
/**
 * The asset inspector's copy reaches the translation corpus.
 *
 * The spa corpus is built by scanning the web shell for literal `t('…')` and
 * `tRaw('…')` sources (scripts/translate.ts extractSpaKeys), plus the hand-listed
 * scripts/i18n/extra-keys.spa.json. A string that reaches t() through a variable is
 * invisible to that scan: it is never translated, and nothing fails. That is how the
 * inspector's section titles ("Origins & credentials", "Text analysis", "Checks" and
 * the rest) read English in every language, because the dock's `wrap()` called
 * t(label) with a variable.
 *
 * These checks read the source, as collab-i18n.test.ts does for the Share dialog,
 * because the scan reads the source too: a title is translatable exactly when the
 * scan can see the title.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSpaKeys } from '../scripts/translate.ts';
import { LIB_GROUPS } from '../shells/web/src/lib/asset-category.ts';
import { GAMUT_BLURB, GAMUT_TITLE, PLANE_TITLE, PLANE_WHY } from '../shells/web/src/lib/colour-words.ts';
import { APCA_BANDS, APCA_SRGB_ONLY } from '../engine/src/color-tools.ts';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', 'shells', 'web', 'src');
const read = (rel: string): string => readFileSync(join(WEB, rel), 'utf8');
const corpus = new Set(extractSpaKeys());

/** The text of each top-level argument of every `name(` call in `src`. */
function callArgs(src: string, name: string): string[][] {
  const calls: string[][] = [];
  const re = new RegExp(`(?<![\\w$.])${name}\\(`, 'g');
  for (const match of src.matchAll(re)) {
    const args: string[] = [];
    let depth = 0, quote = '', start = match.index + match[0].length, i = start;
    for (; i < src.length; i++) {
      const c = src[i]!;
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
      if (c === '\'' || c === '"' || c === '`') quote = c;
      else if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) { if (!depth) break; depth--; }
      else if (c === ',' && !depth) { args.push(src.slice(start, i).trim()); start = i + 1; }
    }
    args.push(src.slice(start, i).trim());
    calls.push(args);
  }
  return calls;
}

const LITERAL_T = /^t\('((?:[^'\\]|\\.)*)'\)$/;

test('every section title the inspector dock wraps is a literal t() the string scan collects', () => {
  const src = read('components/asset-inspector-dock.ts');
  const calls = callArgs(src, 'wrap').filter(args => args.length >= 3);
  const titles: string[] = [];
  const dynamic: string[] = [];
  for (const [, title] of calls) {
    const literal = LITERAL_T.exec(title ?? '');
    if (literal) titles.push(literal[1]!);
    // The one variable title is a shared-asset heading the sheet already wrote with t().
    else if (title !== 'label') dynamic.push(title ?? '');
  }
  assert.deepEqual(dynamic, [], 'a dock section title is no longer a literal t() call, so the string scan cannot see it');
  for (const expected of ['Origins & credentials', 'Details', 'Files', 'Used in', 'Text analysis', 'Audio settings', 'Appearance', 'Checks']) {
    assert.ok(titles.includes(expected), `the dock no longer wraps a section titled ${JSON.stringify(expected)} with a literal t() call`);
  }
  const missing = titles.filter(title => !corpus.has(title));
  assert.deepEqual(missing, [], 'a dock title the string scan does not collect');
  // And wrap() must not translate again: a title passed through t() a second time
  // would be looked up by its translation, which no catalog holds.
  assert.doesNotMatch(src, /summary\.textContent\s*=\s*t\(/, 'wrap() translates its title a second time');
});

test('no inspector sheet passes text to t() through a variable', () => {
  // Each allowed site reads a table whose every value the next test checks.
  const allowed = [
    't(categoryLabel(', 't(PLANE_TITLE[', 't(PLANE_WHY[', 't(GAMUT_TITLE[', 't(GAMUT_BLURB[', 't(apca.label)', 't(APCA_SRGB_ONLY)',
  ];
  const files = [
    'components/asset-inspector-dock.ts', 'components/asset-viewer-details.ts', 'views/assets/details-sheet.ts',
    'views/assets/details-rondo.ts', 'views/assets/shared-metadata.ts', 'views/assets/source-history.ts', 'views/assets/swatch-details.ts',
  ];
  const found: string[] = [];
  for (const rel of files) {
    const src = read(rel);
    for (const match of src.matchAll(/(?<![\w$.])t(?:Raw)?\(\s*(?!['"])/g)) {
      const site = src.slice(match.index, match.index + 40);
      if (!allowed.some(prefix => site.startsWith(prefix))) found.push(`${rel}: ${site.split('\n')[0]}`);
    }
  }
  assert.deepEqual(found, [], 'text reaches t() through a variable, so the string scan never collects it');
});

test('every table the inspector translates through a variable is listed for the corpus', () => {
  const values = [
    ...LIB_GROUPS.map(group => group.label),
    ...Object.values(PLANE_TITLE), ...Object.values(PLANE_WHY), ...Object.values(GAMUT_TITLE), ...Object.values(GAMUT_BLURB),
    ...APCA_BANDS.map(band => band.label), APCA_SRGB_ONLY,
  ];
  assert.ok(values.length > 30, 'the tables the inspector translates shrank or moved');
  const missing = values.filter(value => !corpus.has(value));
  assert.deepEqual(missing, [], 'a table value the inspector passes to t() that neither the scan nor extra-keys.spa.json carries');
});

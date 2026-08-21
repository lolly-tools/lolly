// SPDX-License-Identifier: MPL-2.0
/**
 * The `collab` translation corpus - the extractor that decides which strings the private
 * collab surface ever gets translated at all.
 *
 * Run with: npm test
 *
 * WHY THIS EXISTS. The eight modules behind the `private-collab` flag keep their copy in an
 * exported `STRINGS` map and render it as `tRaw(STRINGS.x)`. `extractSpaKeys` only sees a
 * quote immediately after `t(`, so NONE of that copy is scannable - which is how
 * `collab-pill.ts` and `collab-focus.ts` came to hold inline `tRaw('…')` literals that
 * read as translated and were English in all 26 languages, with nothing reporting it.
 * The corpus closes that by SLICING each map out of its source and evaluating it, the
 * same mechanism the `site` corpus uses on docs/build.ts.
 *
 * That mechanism has one failure mode worth pinning: it is name-based. Rename the map,
 * move it, or turn it into anything that is not a plain data literal, and the extraction
 * either throws or quietly returns a shorter list. A THROW is the acceptable outcome and
 * is what the corpus is written for; a shorter list is not, and the equality assertion
 * below is what turns a silent shrink into a red test.
 *
 * Importing scripts/translate.ts is safe: its `main()` is guarded on `process.argv[1]`
 * matching its own URL, which the test runner never satisfies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { extractCollabKeys, sliceDataLiteral } from '../scripts/translate.ts';

const ROOT = join(import.meta.dirname, '..');
const WEB_SRC = join(ROOT, 'shells', 'web', 'src');
const COLLAB_LOCALES = join(WEB_SRC, 'locales', 'collab');

/** The same eight files COLLAB_SOURCES names, restated here so a source silently dropped
 *  from that list fails rather than shrinking the corpus. */
const MODULES = [
  'components/collab-ceremony.ts',
  'collab/join-route.ts',
  'components/beam-toast.ts',
  'lib/beam-pack.ts',
  'components/collab-pill.ts',
  'components/collab-focus.ts',
  'org/collab-work-opener.ts',
  'lib/beam-sink.ts',
];

function leaves(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) leaves(v, out);
  return out;
}

/** Read one module's STRINGS map the way the corpus does - independently, so this test
 *  is a second opinion rather than a re-run of the same call. */
function mapOf(rel: string): Record<string, unknown> {
  const src = readFileSync(join(WEB_SRC, rel), 'utf8');
  const literal = sliceDataLiteral(src, /\bexport\s+const\s+STRINGS\s*(?::[^=]*)?=/, 'STRINGS', rel);
  return new Function(`return (${literal});`)() as Record<string, unknown>;
}

test('every collab module still exports a sliceable STRINGS map', () => {
  for (const rel of MODULES) {
    assert.ok(existsSync(join(WEB_SRC, rel)), `${rel} is missing - its copy would ship untranslated`);
    const strings = leaves(mapOf(rel));
    assert.ok(strings.length > 0, `${rel}: STRINGS sliced empty`);
    for (const s of strings) assert.ok(s.trim() !== '', `${rel}: an empty string is not copy`);
  }
});

test('the corpus extracts every string from all eight maps, and nothing else', () => {
  const expected = [...new Set(MODULES.flatMap((rel) => leaves(mapOf(rel))))];
  const actual = extractCollabKeys();
  assert.deepEqual(actual, expected, 'extractCollabKeys drifted from the maps it is supposed to read');
  assert.ok(actual.length > 150, `only ${actual.length} keys - a map was dropped from COLLAB_SOURCES`);
});

test('the extractor throws loudly when a map is renamed, rather than shrinking silently', () => {
  // The whole design rests on a rename being LOUD (the site corpus's own rule). Proven
  // against the real slicer, on a copy of a real file with its declaration renamed.
  const src = readFileSync(join(WEB_SRC, 'components/collab-focus.ts'), 'utf8')
    .replace('export const STRINGS =', 'export const COPY =');
  assert.throws(
    () => sliceDataLiteral(src, /\bexport\s+const\s+STRINGS\s*(?::[^=]*)?=/, 'STRINGS', 'components/collab-focus.ts'),
    /no `STRINGS` declaration in components\/collab-focus\.ts/,
  );
});

test('the shipped collab catalogs carry exactly the corpus key set', () => {
  // The catalogs are what the app loads; the corpus is what a translation run fills. A
  // difference either way is a string shipping English in 26 languages (missing) or 26
  // files paying for a string nothing renders (orphan).
  const keys = new Set(extractCollabKeys());
  const files = readdirSync(COLLAB_LOCALES).filter((f) => f.endsWith('.json'));
  assert.equal(files.length, 26, `${files.length} collab catalogs, expected 26 (engine/src/lang.ts LANGS minus 'en')`);
  for (const file of files) {
    const cat = JSON.parse(readFileSync(join(COLLAB_LOCALES, file), 'utf8')) as Record<string, string>;
    const catKeys = new Set(Object.keys(cat));
    const missing = [...keys].filter((k) => !catKeys.has(k));
    const orphan = [...catKeys].filter((k) => !keys.has(k));
    assert.deepEqual(missing.slice(0, 5), [], `${file}: ${missing.length} key(s) missing`);
    assert.deepEqual(orphan.slice(0, 5), [], `${file}: ${orphan.length} orphaned key(s)`);
  }
});

/**
 * Strings that legitimately live in BOTH the boot catalog and this namespace, each with
 * its reason. Overlap is not free - it is translated twice, by two prompts with two
 * different register briefs - so it has to be deliberate.
 *
 * On a collision `i18n.ts` merges chrome OVER the namespace (`{...namespace, ...catalog}`),
 * so the boot translation is the one that renders in both places. That is the right way
 * round here: it means the feature's own name reads identically on the profile row, in
 * the Share dialog and on the ceremony dialog, which is what a name is for.
 */
const SHARED_WITH_BOOT: readonly string[] = [
  // The feature's NAME. Boot: the Feature-flags row label and the Share-dialog heading.
  // Namespace: the ceremony dialog's own accessible name (STRINGS.dialogLabel).
  'Private collab',
];

test('every string in both the boot catalog and the collab namespace is a declared overlap', () => {
  const collab = new Set(extractCollabKeys());
  const extra = JSON.parse(
    readFileSync(join(ROOT, 'scripts', 'i18n', 'extra-keys.spa.json'), 'utf8'),
  ) as string[];
  const both = extra.filter((k) => collab.has(k));
  const undeclared = both.filter((k) => !SHARED_WITH_BOOT.includes(k));
  assert.deepEqual(
    undeclared,
    [],
    'listed in extra-keys.spa.json AND in the collab namespace. Either it is chrome (drop it '
    + `from the namespace's map) or it is not (drop it from extra-keys), or declare why both:\n${undeclared.join('\n')}`,
  );
  // Non-vacuity: the declared overlap must still BE an overlap, or the note above is
  // describing a state that no longer exists.
  for (const shared of SHARED_WITH_BOOT) {
    assert.ok(both.includes(shared), `${JSON.stringify(shared)} is declared as shared but is no longer in both`);
  }
});

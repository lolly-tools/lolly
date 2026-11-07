// SPDX-License-Identifier: MPL-2.0
/**
 * Docs search ranking (plan 354 D4): one ranking over one index, for the app's spotlight
 * and the /info search, in which a page comes ahead of its sections.
 *
 * Run directly:  node --test shells/web/src/lib/search/docs-rank.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';
import { TITLE_WEIGHT, prepareRecords, rankDocs, tokenize, type DocsRecord } from './docs-rank.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../../..');

// The shape "export svg" met in the real index: the Export page's intro never says SVG
// (the snippet is short), the word sits in one of its sections, and sections on other
// pages name both words in their headings or text.
const RECORDS: DocsRecord[] = [
  { p: 'create/create-a-tool', t: 'Share a design with rules', h: 'Export', a: 'export', x: 'Export the design as SVG or PNG.' },
  { p: 'create/darkroom', t: 'Lolly Darkroom', h: 'Export', a: 'export', x: 'Save the photo as SVG.' },
  { p: 'create/exporting', t: 'Export a file', h: '', a: '', x: 'Export a file You have made something and it needs to leave Lolly: a PNG for' },
  { p: 'create/exporting', t: 'Export a file', h: 'Pick a format', a: 'pick-a-format', x: 'An SVG stays sharp at any size.' },
  { p: 'create/exporting', t: 'Export a file', h: 'Size and print units', a: 'size-and-print-units', x: 'Exports use the native pixel size.' },
  { p: 'formats/svg', t: 'SVG file format', h: '', a: '', x: 'Scalable vector graphics.' },
  { p: 'formats/svg', t: 'SVG file format', h: 'Make one', a: 'make-one', x: 'Export from any tool.' },
];

const rank = (query: string) => rankDocs(prepareRecords(RECORDS), tokenize(query));

test('pages lead: "export svg" opens with the pages, though neither intro holds both words', () => {
  const top = rank('export svg').slice(0, 2).map((r) => `${r.rec.p}|${r.rec.h}`);
  assert.deepEqual(top.sort(), ['create/exporting|', 'formats/svg|']);
});

test('a section named by the query still beats a page that only holds the words', () => {
  const [first] = rank('print units');
  assert.equal(first?.rec.h, 'Size and print units');
});

test('a page that matches only through its contents ranks below the sections that say it', () => {
  const hits = rank('pick format');
  assert.equal(hits[0]?.rec.h, 'Pick a format');
  assert.ok(hits.some((r) => r.rec.p === 'create/exporting' && !r.rec.h), 'the page itself still answers');
});

test('Ask keeps its own field ladder: a page record\'s fields are the record alone', () => {
  const page = prepareRecords(RECORDS).find((r) => r.rec.p === 'formats/svg' && !r.rec.h)!;
  assert.equal(page.fields.length, 3);
  assert.equal(page.fields[1]!.weight, TITLE_WEIGHT);
});

test('the /info bundle ranks the same, with no DOM, fetch or locale', () => {
  const out = buildSync({
    entryPoints: [resolve(here, 'docs-rank.ts')],
    bundle: true, write: false, format: 'iife', globalName: 'LollyDocsRank',
    platform: 'browser', target: 'es2019', logLevel: 'silent',
  });
  const sandbox: Record<string, unknown> = {};
  runInNewContext(`${out.outputFiles[0]!.text};this.LollyDocsRank=LollyDocsRank;`, sandbox);
  const lib = sandbox.LollyDocsRank as typeof import('./docs-rank.ts');
  const bundled = lib.rankDocs(lib.prepareRecords(RECORDS), lib.tokenize('export svg'));
  // Through JSON: the bundle's arrays belong to the sandbox's realm.
  assert.deepEqual(
    JSON.parse(JSON.stringify(bundled.map((r) => [r.rec.p, r.rec.h, r.score]))),
    rank('export svg').map((r) => [r.rec.p, r.rec.h, r.score]),
  );
  const build = readFileSync(resolve(repoRoot, 'docs/build.ts'), 'utf8');
  assert.match(build, /lib\/search\/docs-rank\.ts/, 'docs/build.ts bundles this module');
  assert.match(build, /LollyDocsRank\.rankDocs\(/, 'the /info search ranks through it');
  assert.doesNotMatch(build, /function score\(r,terms\)/, 'no second scorer in the /info script');
});

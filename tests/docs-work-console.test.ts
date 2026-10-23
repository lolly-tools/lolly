// SPDX-License-Identifier: MPL-2.0
/**
 * The Work bundle is plain Markdown the Lolly Work console can show.
 *
 * The console renders its packaged guides with a small DOM-building renderer (lolly-work
 * console/app.js, mdToNodes) that knows no `:::` fence, no provenance pill and no HTML
 * comment, so each would reach an operator as literal text. buildWorkBundle (the function
 * lolly-work's scripts/sync-docs-bundle.ts imports) lowers every guide through
 * lowerForConsole in docs/work-console.ts. These tests pin each lowering on synthetic input,
 * then check the real bundle carries none of the syntax the console cannot read.
 *
 * Run directly: node --test tests/docs-work-console.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lowerForConsole, splitFirstSentence } from '../docs/work-console.ts';
import type { VersionFacts } from '../docs/version-tokens.ts';
import { buildWorkBundle } from '../scripts/export-work-docs.ts';

const facts: VersionFacts = { work: { version: '9.8.7', chart: '0.6.5' }, downloads: { macos: '4.3.2' } };
const FIGURES: Record<string, string> = { 'known-figure': 'https://lolly.tools/info/figures/known-figure.html' };
const lower = (md: string) => lowerForConsole(md, { facts, figureUrl: id => FIGURES[id] ?? null, where: 'test.md' });

test('a note, warning or check keeps its kind word in a bold title above the body', () => {
  assert.equal(lower('::: note Before you start\nYou need an admin account.\n:::'), '**Note: Before you start**\n\nYou need an admin account.');
  assert.equal(lower('::: warning This deletes data\nThere is no undo.\n:::'), '**Warning: This deletes data**\n\nThere is no undo.');
  assert.equal(lower('::: check It worked\nThe page shows Ready.\n:::'), '**Check: It worked**\n\nThe page shows Ready.');
});

test('a disclosure becomes a bold title over its body, with nothing to open', () => {
  const out = lower('Intro.\n\n::: details When the command refuses\n- `broken`: a link is broken.\n- `stripped`: a row has no MAC.\n:::\n\nAfter.');
  assert.equal(out, 'Intro.\n\n**When the command refuses**\n\n- `broken`: a link is broken.\n- `stripped`: a row has no MAC.\n\nAfter.');
});

test('a figure becomes a link titled from its caption, then the rest of the caption', () => {
  const out = lower('::: figure known-figure\nThe hash chain, link by link. Each part catches a different edit.\n:::');
  assert.equal(out, '[Figure: The hash chain, link by link](https://lolly.tools/info/figures/known-figure.html)\n\nEach part catches a different edit.');
  // A one-sentence caption is all title; a full stop inside a link does not end the sentence.
  assert.equal(lower('::: figure known-figure\nSee [the v1.2 notes](https://example.com/a.b) for more.\n:::'),
    '[Figure: See the v1.2 notes for more](https://lolly.tools/info/figures/known-figure.html)');
  // No caption still gives the reader a way to the figure.
  assert.equal(lower('::: figure known-figure\n:::'), '[Figure: Open the figure](https://lolly.tools/info/figures/known-figure.html)');
});

test('a figure the bank does not hold keeps its caption and links nowhere', () => {
  // The site renders nothing for an unknown id, so the console keeps only the prose.
  assert.equal(lower('::: figure not-banked\nA caption that still reads as a sentence.\n:::'), 'A caption that still reads as a sentence.');
});

test('cols, timeline, showcase and unknown fences keep their body and lose the fence lines', () => {
  assert.equal(lower('::: cols\n## Before\nOld way.\n## After\nNew way.\n:::'), '## Before\nOld way.\n## After\nNew way.');
  assert.equal(lower('::: timeline\n- **One** first.\n- **Two** second.\n:::'), '- **One** first.\n- **Two** second.');
  assert.equal(lower('::: showcase\n![A shot](../shots/x.svg)\n:::'), '![A shot](../shots/x.svg)');
  assert.equal(lower('::: someday\nBody text.\n:::'), 'Body text.');
});

test('nested fences lower from the inside out', () => {
  const out = lower('::: cols\n## Left\n::: note Inside\nA note in a column.\n:::\n## Right\nPlain.\n:::');
  assert.equal(out, '## Left\n\n**Note: Inside**\n\nA note in a column.\n\n## Right\nPlain.');
  assert.ok(!out.split('\n').some(line => line.trim().startsWith(':::')));
});

test('a lowered block gets blank lines around it, so the console never joins it to a paragraph', () => {
  assert.equal(lower('Text above.\n::: note Title\nBody.\n:::\nText below.'), 'Text above.\n\n**Note: Title**\n\nBody.\n\nText below.');
});

test('code blocks pass through untouched, apart from version tokens', () => {
  const code = '```md\n::: note Example\n%entity{Lolly} <!-- kept -->\n:::\n```';
  assert.equal(lower(code), code);
  assert.equal(lower('```sh\nhelm install lolly-work --version %work{chart}\n```'), '```sh\nhelm install lolly-work --version 0.6.5\n```');
});

test('version tokens become versions, and an unknown token stops the bundle', () => {
  assert.equal(lower('Work %work{version} ships chart %work{chart}; the Mac app is %download{macos}.'), 'Work 9.8.7 ships chart 0.6.5; the Mac app is 4.3.2.');
  assert.throws(() => lower('%work{nightly}'), /test\.md: unknown version token %work\{nightly\}/);
  assert.throws(() => lower('%download{macOS}'), /unknown version token %download\{macOS\}/);
});

test('pills unwrap to their words, and comments and content tokens go', () => {
  assert.equal(lower('Signed by %entity{Lolly} as %sig{Delivered by Lolly}.'), 'Signed by Lolly as Delivered by Lolly.');
  assert.equal(lower('Before.\n<!-- SHOT NOTE: capture at 1280\n     wide -->\nAfter.'), 'Before.\nAfter.');
  assert.equal(lower('- <!--i:hash--> **Record the head** first.'), '- **Record the head** first.');
  assert.equal(lower('Deploy with <!--l:helm--> Helm.'), 'Deploy with Helm.');
  assert.equal(lower('<!--lb:kubernetes helm-->\nText.'), 'Text.');
});

test('splitFirstSentence ignores stops inside code, links and brackets', () => {
  assert.deepEqual(splitFirstSentence('Run `a.b` now. Then wait.'), { first: 'Run `a.b` now.', rest: 'Then wait.' });
  assert.deepEqual(splitFirstSentence('One (e.g. two) three'), { first: 'One (e.g. two) three', rest: '' });
});

test('the real bundle carries no fence, pill, comment or version token outside code', () => {
  const bundle = buildWorkBundle();
  const leaks: string[] = [];
  for (const [path, bytes] of Object.entries(bundle.files)) {
    if (!path.endsWith('.md')) continue;
    let inCode = false;
    bytes.toString('utf8').split('\n').forEach((line, i) => {
      if (/^\s*(```|~~~)/.test(line)) { inCode = !inCode; return; }
      if (/%(?:work|download)\{/.test(line)) leaks.push(`${path}:${i + 1} version token`);
      if (inCode) return;
      if (line.trim().startsWith(':::')) leaks.push(`${path}:${i + 1} fence`);
      if (/%(?:entity|sig|act|file|detail)\{/.test(line)) leaks.push(`${path}:${i + 1} pill`);
      if (line.includes('<!--')) leaks.push(`${path}:${i + 1} comment`);
    });
  }
  assert.deepEqual(leaks, [], 'the console would show these as literal text');
});

// SPDX-License-Identifier: MPL-2.0
/**
 * The docs translation corpus - segmentation fidelity and structural validation.
 *
 * Run with: npm test
 *
 * WHY THIS EXISTS. `runDocsCorpus` translates a markdown page block by block and
 * then reassembles it. If `splitDocBlocks` is not perfectly lossless, every
 * translated page silently ships corrupted markdown - a torn code fence, a lost
 * blank line collapsing two paragraphs into one - in 26 languages that nobody on
 * the team reads. The round-trip property below is therefore the required
 * assertion of the whole corpus, and it is asserted against the REAL pages the
 * corpus is configured to translate, not a synthetic fixture.
 *
 * The validator tests matter for the same reason from the other end: they are
 * what stops a model's output from being written to disk. A translated link
 * target is a 404 or a broken screenshot recipe, and it is invisible in review
 * of a language you cannot read - so `validateDocBlock` must reject it, and this
 * file proves the rejections are real rather than vacuous.
 *
 * Importing scripts/translate.ts is safe: its `main()` is guarded on
 * `process.argv[1]` matching its own URL, which the test runner never satisfies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { splitDocBlocks, validateDocBlock, DOCS_PAGES } from '../scripts/translate.ts';

const ROOT = join(import.meta.dirname, '..');

// ─── segmentation is lossless ────────────────────────────────────────────────

test('every configured docs page round-trips byte-for-byte through splitDocBlocks', () => {
  assert.ok(DOCS_PAGES.length > 0, 'DOCS_PAGES should not be empty');
  for (const page of DOCS_PAGES) {
    const path = join(ROOT, 'docs', page.src);
    assert.ok(existsSync(path), `DOCS_PAGES names ${page.src}, which does not exist`);
    const md = readFileSync(path, 'utf8');
    const rejoined = splitDocBlocks(md).map(b => b.text).join('\n');
    assert.equal(rejoined, md, `${page.src}: reassembly is lossy — translated pages would be corrupt`);
  }
});

test('every configured page yields at least one translatable block', () => {
  // A page that segments into nothing translatable would be silently written
  // out as pure English while counting as "fully translated".
  for (const page of DOCS_PAGES) {
    const blocks = splitDocBlocks(readFileSync(join(ROOT, 'docs', page.src), 'utf8'));
    const translatable = blocks.filter(b => b.translatable && b.text.trim()).length;
    assert.ok(translatable > 0, `${page.src}: no translatable blocks found`);
  }
});

test('fenced code is never marked translatable, even containing blank lines', () => {
  const md = [
    'Intro paragraph.',
    '',
    '```bash',
    'grep -rn foo \\',
    '',
    '  bar baz',
    '```',
    '',
    'Trailing paragraph.',
  ].join('\n');
  const blocks = splitDocBlocks(md);
  assert.equal(blocks.map(b => b.text).join('\n'), md, 'round-trip');
  const fence = blocks.find(b => b.text.includes('grep'));
  assert.ok(fence, 'the fence should be one block');
  assert.equal(fence.translatable, false, 'a code fence must never be sent for translation');
  // The blank line INSIDE the fence must not have split it.
  assert.ok(fence.text.includes('\n\n  bar baz'), 'the fence kept its internal blank line');
});

test('an unterminated fence stays opaque rather than leaking as prose', () => {
  const md = ['Text.', '', '```js', 'const x = 1;'].join('\n');
  const blocks = splitDocBlocks(md);
  assert.equal(blocks.map(b => b.text).join('\n'), md, 'round-trip');
  const last = blocks[blocks.length - 1]!;
  assert.ok(last.text.includes('const x'), 'the open fence is the final block');
  assert.equal(last.translatable, false);
});

test('HTML comment blocks are opaque; prose and tables are translatable', () => {
  const md = ['<!-- a build note -->', '', '| A | B |', '|---|---|', '| 1 | 2 |', '', 'Prose.'].join('\n');
  const blocks = splitDocBlocks(md).filter(b => b.text.trim());
  const comment = blocks.find(b => b.text.startsWith('<!--'))!;
  const table = blocks.find(b => b.text.startsWith('|'))!;
  const prose = blocks.find(b => b.text === 'Prose.')!;
  assert.equal(comment.translatable, false, 'HTML comments are machinery');
  assert.equal(table.translatable, true, 'tables carry prose — the privacy policy legal-basis table is one');
  assert.equal(prose.translatable, true);
});

// ─── structural validation rejects what review cannot catch ──────────────────

test('a changed markdown link target is rejected', () => {
  const src = 'See the [privacy policy](/info/privacy.html) for details.';
  assert.equal(validateDocBlock(src, 'Siehe die [Datenschutzerklärung](/info/privacy.html) für Details.'), null,
    'translating only the link TEXT is fine');
  const err = validateDocBlock(src, 'Siehe die [Datenschutzerklärung](/info/datenschutz.html) für Details.');
  assert.match(String(err), /link target changed/, 'a localised href is a 404 — must be refused');
});

test('a mangled url-shot screenshot recipe is rejected', () => {
  // These long recipe query strings are full of English selectors and filenames;
  // a model "tidying" one silently breaks the screenshot on that locale's page.
  const src = '![The export panel](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&filename=cc-pdf-lock)';
  assert.equal(validateDocBlock(src, '![Das Export-Panel](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&filename=cc-pdf-lock)'), null,
    'alt text may be translated');
  const err = validateDocBlock(src, '![Das Export-Panel](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&filename=cc-pdf-schloss)');
  assert.match(String(err), /link target changed/);
});

test('a changed heading level is rejected', () => {
  assert.equal(validateDocBlock('## Your rights', '## Ihre Rechte'), null);
  assert.match(String(validateDocBlock('## Your rights', '### Ihre Rechte')), /heading level changed/);
  assert.match(String(validateDocBlock('## Your rights', 'Ihre Rechte')), /heading level changed/);
});

test('a table that loses a row or a column is rejected', () => {
  const src = ['| Processing | Basis |', '|---|---|', '| Logs | Art. 6(1)(f) |', '| Email | Art. 6(1)(b) |'].join('\n');
  const good = ['| Verarbeitung | Grundlage |', '|---|---|', '| Protokolle | Art. 6(1)(f) |', '| E-Mail | Art. 6(1)(b) |'].join('\n');
  assert.equal(validateDocBlock(src, good), null);
  const dropped = ['| Verarbeitung | Grundlage |', '|---|---|', '| Protokolle | Art. 6(1)(f) |'].join('\n');
  assert.match(String(validateDocBlock(src, dropped)), /table shape changed/, 'a dropped legal-basis row must be refused');
  const merged = ['| Verarbeitung | Grundlage | Extra |', '|---|---|---|', '| Protokolle | Art. 6(1)(f) | x |', '| E-Mail | Art. 6(1)(b) | y |'].join('\n');
  assert.match(String(validateDocBlock(src, merged)), /table shape changed/);
});

test('an invented code fence is rejected', () => {
  const src = 'Run the validator before shipping.';
  assert.match(String(validateDocBlock(src, 'Führen Sie den Validator aus.\n\n```\nnpm test\n```')),
    /introduced a code fence/);
});

test('--check is read-only: it never writes or deletes a translation file', async () => {
  // Regression guard. The first cut of runDocsCorpus deleted every page it
  // considered incomplete - including in --check mode, which is the CI guard and
  // is documented as "no API calls". Running it against a repo with existing
  // translations destroyed them. A check that mutates the thing it audits is a
  // data-loss bug, so this asserts the invariant directly by running the real
  // check pass and diffing the tree.
  const { execFileSync } = await import('node:child_process');
  const before = execFileSync('git', ['status', '--porcelain', 'i18n'],
    { cwd: join(ROOT, 'docs'), encoding: 'utf8' });
  // A non-zero exit is the CORRECT outcome while pages are untranslated (that is
  // the CI guard doing its job), so the exit code is deliberately ignored here - 
  // this test is only about whether the run touched the tree.
  try {
    execFileSync('npm', ['run', 'translate', '--silent', '--', '--corpus', 'docs', '--lang', 'de', '--check'],
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch { /* expected: exit 1 on stale/missing */ }
  const after = execFileSync('git', ['status', '--porcelain', 'i18n'],
    { cwd: join(ROOT, 'docs'), encoding: 'utf8' });
  assert.equal(after, before, '--check modified docs/i18n — it must be read-only');
});

test('the validator is not vacuous — a faithful translation passes', () => {
  const src = [
    '## Legal bases, retention and recipients',
    '',
  ].join('\n');
  assert.equal(validateDocBlock('## Legal bases', '## Rechtsgrundlagen'), null);
  assert.equal(validateDocBlock('A plain paragraph with `code` and **bold**.', 'Ein Absatz mit `code` und **fett**.'), null);
  assert.ok(src.length > 0);
});

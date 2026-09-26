// SPDX-License-Identifier: MPL-2.0
/**
 * Print editions: a docs page may name a PDF (`pdf:` on its pages entry in
 * docs/build.ts), laid out in Design and kept in docs/editions/. The build copies it
 * to /info/editions/ and links it beside the Listen pill on the English page.
 *
 * What must hold:
 *  1. Every named edition exists, is a PDF, and still carries the Content Credential
 *     its export wrote. Rewriting the file after export (to retitle or shrink it)
 *     would break that credential, so the file is replaced by a fresh export instead.
 *  2. docs/editions/ holds nothing a page does not name, so an unlinked PDF does not
 *     sit in the repository by mistake.
 *  3. Once /info is built, the English page links its edition and the offline docs
 *     manifest leaves editions out (they are megabytes each, and the reader offline
 *     already has the page).
 *
 * Run directly: node --test tests/docs-editions.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const source = readFileSync(join(root, 'docs/build.ts'), 'utf8');
const editionsDir = join(root, 'docs/editions');
const infoDir = join(root, 'shells/web/public/info');

const named = source.split('\n')
  .filter((l) => /^\s*\{ slug: '/.test(l) && /\bpdf: '/.test(l))
  .map((l) => ({
    slug: /slug: '([^']+)'/.exec(l)![1]!,
    pathway: /pathway: '([^']+)'/.exec(l)?.[1],
    pdf: /\bpdf: '([^']+)'/.exec(l)![1]!,
  }));

test('at least one page names a print edition', () => {
  assert.ok(named.length > 0, 'no pages entry carries pdf:');
});

test('every named edition is a PDF that still carries its Content Credential', () => {
  for (const e of named) {
    const file = join(editionsDir, e.pdf);
    assert.ok(existsSync(file), `${e.slug}: docs/editions/${e.pdf} is missing`);
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-', `${e.pdf} is not a PDF`);
    assert.ok(bytes.includes('/AFRelationship /C2PA_Manifest'), `${e.pdf} lost the C2PA manifest its export embedded`);
  }
});

test('docs/editions holds only files a page names', () => {
  const want = new Set(named.map((e) => e.pdf));
  for (const f of readdirSync(editionsDir)) {
    if (f.startsWith('.')) continue;
    assert.ok(want.has(f), `docs/editions/${f} is not named by any page`);
  }
});

test('the built English page links its edition beside Listen', (t) => {
  for (const e of named) {
    const page = join(infoDir, e.pathway ?? '', `${e.slug}.html`);
    if (!existsSync(page)) { t.skip('no built /info on disk - run `pnpm run build:info`'); return; }
    const html = readFileSync(page, 'utf8');
    const bar = /<div class="listen-bar[^"]*">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '';
    assert.ok(bar.includes(`href="/info/editions/${e.pdf}"`), `${e.slug}: the listen bar does not link its edition`);
    assert.ok(bar.includes('class="docs-listen"'), `${e.slug}: the Listen pill left the bar`);
    assert.ok(existsSync(join(infoDir, 'editions', e.pdf)), `${e.pdf} was not copied to /info/editions/`);
  }
});

test('the offline docs manifest leaves print editions out', (t) => {
  const manifest = join(infoDir, 'manifest.json');
  if (!existsSync(manifest)) { t.skip('no built /info on disk - run `pnpm run build:info`'); return; }
  assert.ok(!readFileSync(manifest, 'utf8').includes('/info/editions/'), 'an edition is in the offline docs download');
});

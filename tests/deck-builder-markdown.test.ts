/**
 * deck-builder full-markdown contract tests.
 *
 * Run with: node --test "tests/deck-builder-markdown.test.ts"  (or via npm test)
 * No test framework — node:test built-in.
 *
 * Loads the REAL community tool from disk and drives it through the engine, so these
 * guard the tool's actual markdown render. The hook extends the old subset
 * (headings / bold / italic / flat bullets / paragraphs) with pipe TABLES, ORDERED
 * and NESTED lists, LINKS, and inline CODE — every piece of user text escaped BEFORE
 * any tag is added, so a `javascript:` URL or an `<img onerror>` in a cell is inert.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';

const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools');
const fetchFile = (path: string) => readFile(join(TOOLS_DIR, path), 'utf8');

const SKIP = !existsSync(join(TOOLS_DIR, 'deck-builder/tool.json'))
  && 'deck-builder tool view not built (run npm run profile)';

const tool: any = SKIP ? null : await loadTool('deck-builder', fetchFile);

function makeHost() {
  return {
    version: '1',
    profile: { get: async () => ({}) },
    assets: { get: async (id: string) => ({ id, url: 'asset:' + id }) },
    log: () => {},
  } as any;
}

async function mount(deck: unknown) {
  const rt = await createRuntime(tool, makeHost(), { deck: deck as never });
  return { rt, html: rt.getHydrated() as string };
}

// A layout slide whose body exercises every new block: pipe table (with per-column
// alignment + a hostile cell), an ordered list, a 3-level nested bullet list, and a
// paragraph with a safe link, a `javascript:` link, and inline code. The FIRST
// heading is lifted out as the slide title, so the table/lists/paragraph are body.
const CONTENT = [
  '# Markdown deck',
  '',
  '| Feature | Status |',
  '| :--- | ---: |',
  '| Tables | done |',
  '| <img src=x onerror=alert(1)> | ok |',
  '',
  '1. First',
  '2. Second',
  '',
  '- Top',
  '  - Nested one',
  '    - Deeper two',
  '- Second top',
  '',
  'See [our site](https://example.com) and [danger](javascript:alert(1)) plus `inline code`.',
].join('\n');

test('layout body: pipe table with per-column alignment + escaped cells', { skip: SKIP }, async () => {
  const { rt, html } = await mount([{ content: CONTENT }]);
  assert.deepEqual(rt.hookErrors, [], 'no hook errors');

  // The first heading is the title, NOT a table.
  assert.match(html, /class="sl-title">Markdown deck</);

  // A real <table>, with the separator row driving text-align per column.
  assert.match(html, /<table class="sl-table"><thead>/);
  assert.match(html, /<th style="text-align:left">Feature<\/th>/);
  assert.match(html, /<th style="text-align:right">Status<\/th>/);
  assert.match(html, /<td style="text-align:left">Tables<\/td><td style="text-align:right">done<\/td>/);
});

test('SECURITY: an <img onerror> in a cell is escaped, never a live tag', { skip: SKIP }, async () => {
  const { html } = await mount([{ content: CONTENT }]);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/, 'the cell is escaped text');
  assert.doesNotMatch(html, /<img src=x onerror/, 'no executable <img> reaches the output');
});

test('layout body: ordered list → <ol class="sl-ol">', { skip: SKIP }, async () => {
  const { html } = await mount([{ content: CONTENT }]);
  assert.match(html, /<ol class="sl-ol"><li>First<\/li><li>Second<\/li><\/ol>/);
});

test('layout body: 3-level nested bullet list (nested <ul> inside <li>)', { skip: SKIP }, async () => {
  const { html } = await mount([{ content: CONTENT }]);
  assert.match(
    html,
    /<ul class="sl-ul"><li>Top<ul class="sl-ul"><li>Nested one<ul class="sl-ul"><li>Deeper two<\/li><\/ul><\/li><\/ul><\/li><li>Second top<\/li><\/ul>/,
  );
});

test('inline: safe link keeps its href; inline code becomes <code>', { skip: SKIP }, async () => {
  const { html } = await mount([{ content: CONTENT }]);
  assert.match(html, /<a href="https:\/\/example\.com">our site<\/a>/);
  assert.match(html, /<code>inline code<\/code>/);
});

test('SECURITY: a javascript: link produces NO href (text only)', { skip: SKIP }, async () => {
  const { html } = await mount([{ content: CONTENT }]);
  assert.doesNotMatch(html, /javascript:/, 'the dangerous scheme is dropped entirely');
  assert.doesNotMatch(html, /href="javascript/, 'no javascript: href is emitted');
  assert.match(html, /and danger/, 'the link text still renders (as plain text)');
});

// The freeform box path shares the SAME parser, so tables/ordered/nested/links must
// also work there — with the box's bare-tag class map (no sl-* classes).
test('freeform box: same parser renders bare-tag table + ordered list + link', { skip: SKIP }, async () => {
  const boxes = [{
    kind: 'text', x: 100, y: 100, w: 900, h: 700,
    text: [
      '## Box',
      '',
      '| A | B |',
      '| :-: | --- |',
      '| 1 | 2 |',
      '',
      '1) one',
      '2) two',
      '',
      'Visit [site](https://ok.test) or `code`.',
    ].join('\n'),
  }];
  const { rt, html } = await mount([{ mode: 'freeform', boxes }]);
  assert.deepEqual(rt.hookErrors, []);
  assert.match(html, /<table><thead><tr><th style="text-align:center">A<\/th><th>B<\/th>/, 'bare table, centered col');
  assert.match(html, /<ol><li>one<\/li><li>two<\/li><\/ol>/, 'bare ordered list');
  assert.match(html, /<a href="https:\/\/ok\.test">site<\/a>/, 'sanitized link');
  assert.match(html, /<code>code<\/code>/, 'inline code');
});

// Ragged indentation and mixed markers must never throw (robustness invariant).
test('ragged indentation renders without throwing', { skip: SKIP }, async () => {
  const content = [
    '# T',
    '',
    '- a',
    '      - jumped two levels',
    '   - back up ragged',
    '- b',
  ].join('\n');
  const { rt, html } = await mount([{ content }]);
  assert.deepEqual(rt.hookErrors, [], 'no hook errors on ragged indent');
  assert.match(html, /<ul class="sl-ul">/);
});

// A bare `---` (a Marp slide rule / HR) must NOT be mistaken for a table separator.
test('a line of dashes is not treated as a table separator', { skip: SKIP }, async () => {
  const { rt, html } = await mount([{ content: '# T\n\nintro\n\n---\n\nmore' }]);
  assert.deepEqual(rt.hookErrors, []);
  assert.doesNotMatch(html, /<table/, 'no phantom table from a bare --- rule');
});

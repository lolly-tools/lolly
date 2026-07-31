// SPDX-License-Identifier: MPL-2.0
/**
 * The provenance-pill markup (`%entity{…}` / `%sig{…}` / `%act{…}` / `%file{…}` /
 * `%detail{…}`) and the BUILT pages that carry it.
 *
 * Two distinct failures put raw `%file{Gemini_Generated_Image….png}` in front of
 * a reader on 2026-07-31, and neither announced itself:
 *
 *  1. A typo'd or unclosed marker degrades to literal text. Markdown has no
 *     schema, so `%entty{Lolly}` renders as the characters `%entty{Lolly}`.
 *  2. `shells/web/public/info/` is COMMITTED, so an artifact built before the
 *     renderer existed shipped and served — the source was correct the whole
 *     time. Rebuilding fixed it, which is exactly what makes it easy to miss:
 *     nothing in the source tree looks wrong.
 *
 * So this checks both ends — the markers authors write, and the HTML that
 * actually ships. Failure (2) means: run `npm run build:info` and commit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO = new URL('..', import.meta.url).pathname;
const DOCS = join(REPO, 'docs');
const BUILT = join(REPO, 'shells/web/public/info');

/** The kinds inline() in docs/build.ts knows how to render. */
const KINDS = ['entity', 'sig', 'act', 'file', 'detail'];

const mdFiles = readdirSync(DOCS).filter((f) => f.endsWith('.md'));

test('every provenance marker in docs/*.md uses a supported kind', () => {
  const bad: string[] = [];
  for (const f of mdFiles) {
    const src = readFileSync(join(DOCS, f), 'utf-8');
    // Any `%word{` that isn't a known kind — the shape an author typo takes.
    for (const m of src.matchAll(/%([a-zA-Z][a-zA-Z0-9_-]*)\{/g)) {
      if (!KINDS.includes(m[1]!)) bad.push(`${f}: %${m[1]}{`);
    }
  }
  assert.deepEqual(bad, [], 'unknown pill kind — it would render as literal text');
});

test('every provenance marker in docs/*.md closes its brace', () => {
  const unbalanced: string[] = [];
  for (const f of mdFiles) {
    const src = readFileSync(join(DOCS, f), 'utf-8');
    for (const line of src.split('\n')) {
      const opens = [...line.matchAll(new RegExp(`%(${KINDS.join('|')})\\{`, 'g'))].length;
      if (!opens) continue;
      // Braces are only used by these markers in prose, so a line that opens N
      // pills must close at least N — an unclosed one swallows the rest of the line.
      const closes = (line.match(/\}/g) ?? []).length;
      if (closes < opens) unbalanced.push(`${f}: ${line.trim().slice(0, 60)}…`);
    }
  }
  assert.deepEqual(unbalanced, [], 'a marker is missing its closing brace');
});

// ── The shipped artifact ─────────────────────────────────────────────────────
// shells/web/public/info/ is committed, so these assert what READERS get, not
// what the source could produce. A failure here means the build output on disk
// is older than docs/ — rebuild with `npm run build:info`.

const builtPages = existsSync(BUILT)
  ? readdirSync(BUILT).filter((f) => f.endsWith('.html'))
  : [];

test('no built page ships an unrendered provenance marker', { skip: builtPages.length ? false : 'no built /info on disk' }, () => {
  const leaked: string[] = [];
  for (const f of builtPages) {
    const html = readFileSync(join(BUILT, f), 'utf-8');
    const m = new RegExp(`%(${KINDS.join('|')})\\{`).exec(html);
    if (m) leaked.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(leaked, [], 'stale or unrendered markup shipped — run `npm run build:info`');
});

test('a page whose source uses pills ships them as rendered spans', { skip: builtPages.length ? false : 'no built /info on disk' }, () => {
  // Pairs the source with its artifact, so "the build silently stopped emitting
  // pills" fails as loudly as "a marker leaked".
  for (const f of mdFiles) {
    const src = readFileSync(join(DOCS, f), 'utf-8');
    if (!new RegExp(`%(${KINDS.join('|')})\\{`).test(src)) continue;
    const built = join(BUILT, f.replace(/\.md$/, '.html'));
    if (!existsSync(built)) continue;
    assert.match(readFileSync(built, 'utf-8'), /class="prov-pill prov-/,
      `${f} authors provenance pills but its built page has none — stale artifact?`);
  }
});

test('the markdown twin unwraps markers instead of shipping them', { skip: builtPages.length ? false : 'no built /info on disk' }, () => {
  // The twin is what an agent reads (llms.txt). It has no CSS, so a marker there
  // is pure noise wrapped around the words that carry the meaning.
  for (const f of mdFiles) {
    const src = readFileSync(join(DOCS, f), 'utf-8');
    if (!new RegExp(`%(${KINDS.join('|')})\\{`).test(src)) continue;
    const twin = join(BUILT, f);
    if (!existsSync(twin)) continue;
    const text = readFileSync(twin, 'utf-8');
    assert.doesNotMatch(text, new RegExp(`%(${KINDS.join('|')})\\{`), `${f}'s twin ships raw markers`);
    // The words inside the markers must survive the unwrap.
    const inner = /%entity\{([^{}]+)\}/.exec(src)?.[1];
    if (inner) assert.ok(text.includes(inner), `${f}'s twin lost the text inside a marker`);
  }
});

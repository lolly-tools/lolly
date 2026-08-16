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
 *     renderer existed shipped and served - the source was correct the whole
 *     time. Rebuilding fixed it, which is exactly what makes it easy to miss:
 *     nothing in the source tree looks wrong.
 *
 * So this checks both ends - the markers authors write, and the HTML that
 * actually ships. Failure (2) means: run `npm run build:info` and commit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { extractC2paStore } from '../engine/src/c2pa-extract.ts';

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
    // Any `%word{` that isn't a known kind - the shape an author typo takes.
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
      // pills must close at least N - an unclosed one swallows the rest of the line.
      const closes = (line.match(/\}/g) ?? []).length;
      if (closes < opens) unbalanced.push(`${f}: ${line.trim().slice(0, 60)}…`);
    }
  }
  assert.deepEqual(unbalanced, [], 'a marker is missing its closing brace');
});

// ── The shipped artifact ─────────────────────────────────────────────────────
// shells/web/public/info/ is committed, so these assert what READERS get, not
// what the source could produce. A failure here means the build output on disk
// is older than docs/ - rebuild with `npm run build:info`.

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

// ── The bytes behind the claim ───────────────────────────────────────────────
// A `%sig{}` pill is a statement ABOUT A FILE, and the two checks above only read
// the prose. docs/beatrice-warde.md ended the Warde narration's pill with "signed
// by Lolly" from the day it shipped while the .opus itself carried no C2PA store
// at all - the sentence was true of the page and false of the file, and every test
// here passed. Its sibling mp4 on the same page had been signed all along, so
// nothing looked odd either.
//
// So: whatever a signed pill names AND the page actually serves must carry a
// credential a reader can extract. A name that appears ONLY inside `%file{}` is an
// upstream source that ships nowhere (`iykyk.png`, a `Gemini_Generated_Image_*`) -
// the pill records where the bytes came from, and there is no file here to check.

/** Every non-page file under the built /info tree, indexed by basename. */
function indexBuiltMedia(dir: string, into = new Map<string, string>()): Map<string, string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) indexBuiltMedia(path, into);
    else if (!/\.(html|md|json|txt|js|css)$/.test(name) && !into.has(name)) into.set(name, path);
  }
  return into;
}

const builtMedia = existsSync(BUILT) ? indexBuiltMedia(BUILT) : new Map<string, string>();

test('every file a signed pill names and the page serves carries a Content Credential',
  { skip: builtMedia.size ? false : 'no built /info on disk' }, () => {
  const unsigned: string[] = [];
  const missing: string[] = [];
  for (const f of mdFiles) {
    const src = readFileSync(join(DOCS, f), 'utf-8');
    // "Served by the page" = named somewhere OTHER than inside a %file{} marker,
    // i.e. in an <audio>/<video> src, an image path or a /info/ link.
    const outsidePills = src.replace(/%file\{[^{}]*\}/g, '');
    for (const [i, line] of src.split('\n').entries()) {
      if (!line.includes('%sig{')) continue;
      for (const m of line.matchAll(/%file\{([^{}]+)\}/g)) {
        const name = m[1]!.trim();
        if (!outsidePills.includes(name)) continue;   // upstream source, not shipped
        const path = builtMedia.get(name);
        if (!path) { missing.push(`${f}:${i + 1} ${name}`); continue; }
        if (!extractC2paStore(new Uint8Array(readFileSync(path)))) unsigned.push(`${f}:${i + 1} ${name}`);
      }
    }
  }
  assert.deepEqual(missing, [], 'a signed pill names a file the built /info does not ship');
  assert.deepEqual(unsigned, [], 'a pill says the file is signed but the file carries no C2PA store');
});

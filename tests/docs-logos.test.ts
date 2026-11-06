// SPDX-License-Identifier: MPL-2.0
/**
 * Technology marks on the docs pages - the `<!--l:key-->` marker (docs/build.ts,
 * docs/logos.ts) - and the page's contents (rail and floating button) that ride on the same build.
 *
 * Checked at BOTH ends, for the reason tests/docs-provenance-pills.test.ts spells
 * out: the source and the artifact fail independently. A marker can be correct in
 * the .md and still ship as literal text from an /info built before the renderer
 * existed, and nothing in the source tree looks wrong when that happens. If the
 * built assertions here fail and the source ones pass, the answer is always
 * `pnpm run build:info` (the built HTML is gitignored in shells/web, so it is only
 * ever as fresh as the last build on this machine - hence the skip guard below).
 *
 * A marker is an HTML comment, which means a typo'd key is INVISIBLE rather than
 * loud - it renders as nothing at all (docLogo warns at build and emits ''). So the
 * source end has to be the loud one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { DOC_LOGOS } from '../docs/logos.ts';

const REPO = new URL('..', import.meta.url).pathname;
const DOCS = join(REPO, 'docs');
const BUILT = join(REPO, 'shells/web/public/info');

/** Resolve published pages before their redirect stubs: the old flat URL, and the old
 *  door of a page that moved to another pathway (build-kubernetes went from build to operate). */
const isStub = (path: string): boolean => path.endsWith('.html') && /<meta http-equiv="refresh"/i.test(readFileSync(path, 'utf-8'));
function builtPage(slug: string, ext = 'html', lang = ''): string {
  const root = join(BUILT,lang);
  return ['start','create','build','operate','trust',''].map(door => join(root,door,`${slug}.${ext}`)).find(path => existsSync(path) && !isStub(path)) || join(root,`${slug}.${ext}`);
}

/** The exact marker shapes docs/build.ts matches (post-esc) and strips from twins:
 *  the inline one, and the whole-line block that opens a major section. */
const MARKER = /<!--l:([a-z0-9-]+)-->/g;
const BLOCK = /<!--lb:([a-z0-9 -]+)-->/g;

/** docs/*.md plus any translated sidecar - a marker mangled in translation is a
 *  marker that ships as nothing on that locale's page. */
function sourceMarkdown(): Array<{ name: string; src: string }> {
  const files = readdirSync(DOCS)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: f, src: readFileSync(join(DOCS, f), 'utf-8') }));
  const i18n = join(DOCS, 'i18n');
  if (existsSync(i18n)) {
    for (const lang of readdirSync(i18n)) {
      const dir = join(i18n, lang);
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
        files.push({ name: `i18n/${lang}/${f}`, src: readFileSync(join(dir, f), 'utf-8') });
      }
    }
  }
  return files;
}

// ─── the markers authors write ───────────────────────────────────────────────

test('every <!--l:key--> marker in the docs names a mark that exists', () => {
  const unknown: string[] = [];
  let seen = 0;
  for (const { name, src } of sourceMarkdown()) {
    for (const m of src.matchAll(MARKER)) {
      seen++;
      if (!(m[1]! in DOC_LOGOS)) unknown.push(`${name}: ${m[0]}`);
    }
  }
  assert.ok(seen > 0, 'no logo markers anywhere - the feature has been silently removed');
  assert.deepEqual(unknown, [], 'unknown mark key - it renders as nothing at all');
});

test('a near-miss marker shape is caught rather than shipped blank', () => {
  // `<!--l:Helm-->`, `<!--l: helm-->`, `<!--l:helm -->` all fail MARKER and are then
  // eaten by stripAuthoringComments as an ordinary authoring comment - the mark just
  // never appears, with nothing to notice. Name them here instead.
  const malformed: string[] = [];
  for (const { name, src } of sourceMarkdown()) {
    for (const m of src.matchAll(/<!--\s*l\s*:[^>]*-->/g)) {
      if (!/^<!--l:[a-z0-9-]+-->$/.test(m[0])) malformed.push(`${name}: ${m[0]}`);
    }
  }
  assert.deepEqual(malformed, [], 'malformed logo marker - build.ts will not render it');
});

// ─── the marks themselves ────────────────────────────────────────────────────

test('every DOC_LOGOS entry is a CSS-colorable, self-sizing, inert glyph', () => {
  const bad: string[] = [];
  for (const [key, svg] of Object.entries(DOC_LOGOS)) {
    // The key must be reachable by the marker grammar, or the mark is dead weight.
    if (!/^[a-z0-9-]+$/.test(key)) bad.push(`${key}: key is unreachable by <!--l:…-->`);
    // currentColor is the whole point: one asset, both themes, colourable by CSS.
    if (!/\bfill="currentColor"/.test(svg)) bad.push(`${key}: root is not fill="currentColor"`);
    if (!/\bviewBox="0 0 24 24"/.test(svg)) bad.push(`${key}: no 24×24 viewBox`);
    // CSS sizes these (.doc-logo). An intrinsic width/height would out-rank the em
    // sizing on the wrapper and pin the mark to 24px everywhere.
    if (/\b(width|height)=/.test(svg)) bad.push(`${key}: carries a width/height attribute`);
    // Decorative - the word beside it is the accessible name.
    if (!/\baria-hidden="true"/.test(svg)) bad.push(`${key}: not aria-hidden`);
    // These are inlined verbatim into every page that names them.
    if (/<script|\son[a-z]+=|javascript:/i.test(svg)) bad.push(`${key}: carries script`);
    if (/<(image|foreignObject|use)\b/i.test(svg)) bad.push(`${key}: pulls in external content`);
  }
  assert.deepEqual(bad, [], 'a technology mark is not shippable as inline markup');
});

// ─── the HTML that actually ships ────────────────────────────────────────────

/** A built page minus its inline <style> - the CSS carries a comment that documents
 *  the marker syntax, and that is prose about the feature, not an unrendered marker. */
function bodyOf(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, ' ');
}

// The built site is gitignored in shells/web, so a fresh clone has none of it until
// `pnpm run build:info` runs. Skip rather than fail there - same contract as
// tests/docs-provenance-pills.test.ts. When the artifact IS present it is asserted in
// full, which is what catches an /info older than docs/.
// The shared chrome CSS/JS ship as fingerprinted files linked per page (plan 131 B.1),
// not inline. Resolve the file a page links and read it from the build.
const linked = (html: string, ext: 'css' | 'js'): string => {
  // The first script sets the theme before paint; feature scripts use the deferred bundle.
  const m = ext === 'js'
    ? /<script\b(?=[^>]*\bdefer\b)[^>]*\bsrc="\/info\/(docs\.[A-Za-z0-9_-]{16}\.js)"[^>]*>/.exec(html)
    : /\/info\/(docs\.[A-Za-z0-9_-]{16}\.css)/.exec(html);
  if (!m) throw new Error(`page links no docs.<hash>.${ext}`);
  return readFileSync(join(BUILT, m[1]!), 'utf-8');
};

// Skip when /info is unbuilt OR mid-rebuild: page + both fingerprinted chrome files
// must be present (a concurrent build can momentarily leave a page pointing at a file
// its own next write has not laid down yet).
const built = (() => {
  if (!existsSync(builtPage('build-kubernetes'))) return 'no built /info on disk - run `pnpm run build:info`';
  const g = readFileSync(builtPage('build-kubernetes'), 'utf-8');
  try { linked(g, 'css'); linked(g, 'js'); }
  catch { return 'built /info is mid-rebuild (linked chrome file absent) - rerun `pnpm run build:info`'; }
  return false;
})();

test('the built pages render their markers as .doc-logo spans, with none left over', { skip: built }, () => {
  let pagesChecked = 0;
  for (const { name, src } of sourceMarkdown()) {
    if (name.includes('/')) continue; // English pages carry the built HTML twin
    const markers = [...src.matchAll(MARKER)];
    if (!markers.length) continue;
    const page = builtPage(name.replace(/\.md$/, ''));
    if (!existsSync(page)) continue; // a doc that is not a published page
    pagesChecked++;
    const body = bodyOf(readFileSync(page, 'utf-8'));
    const spans = [...body.matchAll(/<span class="doc-logo" data-logo="([a-z0-9-]+)">/g)];
    assert.equal(
      spans.length, markers.length,
      `${name}: ${markers.length} markers in source but ${spans.length} rendered marks in ${page}`,
    );
    assert.deepEqual(
      spans.map((s) => s[1]), markers.map((m) => m[1]),
      `${name}: rendered marks are not the ones the source asks for, in order`,
    );
    assert.ok(!/<!--l:/.test(body), `${name}: an unrendered marker ships as an HTML comment`);
    assert.ok(!/&lt;!--l:/.test(body), `${name}: a marker ships as VISIBLE text`);
  }
  assert.ok(pagesChecked > 0, 'no built page carries a marker - is /info stale?');
});

test('every <!--lb:…--> block names marks that exist, and sits on a line of its own', () => {
  const bad: string[] = [];
  let seen = 0;
  for (const { name, src } of sourceMarkdown()) {
    for (const line of src.split('\n')) {
      for (const m of line.matchAll(BLOCK)) {
        seen++;
        // mdToHtml only takes the block form when the marker IS the line; anything
        // else falls through to the inline pass, which does not match `lb:` at all - 
        // so the marks would silently vanish.
        if (line.trim() !== m[0]) bad.push(`${name}: block marker shares its line: ${line.trim().slice(0, 60)}`);
        for (const key of m[1]!.trim().split(/\s+/)) {
          if (!(key in DOC_LOGOS)) bad.push(`${name}: unknown mark "${key}" in ${m[0]}`);
        }
      }
    }
  }
  assert.ok(seen > 0, 'no block markers anywhere - the feature has been silently removed');
  assert.deepEqual(bad, [], 'a block marker would render as nothing');
});

test('no heading in the built docs carries a technology mark', { skip: built }, () => {
  // The policy, enforced where it can actually be checked: marks belong in prose,
  // in a table cell, or in a block ABOVE a section - never inside the heading whose
  // words a reader scans to navigate by. (Style stripped first: the stylesheet's own
  // comments talk about h1s and markers, and that is documentation, not markup.)
  const offenders: string[] = [];
  for (const {name:f} of sourceMarkdown().filter(({name}) => !name.includes('/'))) {
    const path = builtPage(f.replace(/\.md$/, '')); if (!existsSync(path)) continue;
    const body = bodyOf(readFileSync(path, 'utf-8'));
    for (const h of body.matchAll(/<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/g)) {
      if (/class="doc-logo"|class="doc-logo-mark"/.test(h[0])) offenders.push(`${f}: ${h[0].slice(0, 70)}…`);
    }
  }
  assert.deepEqual(offenders, [], 'a mark is sitting inside a heading');
});

test('the build guide ships the Kubernetes block, decorative and unannounced', { skip: built }, () => {
  const body = ['build-guide','build-desktop','build-mobile','build-kubernetes'].map(slug => bodyOf(readFileSync(builtPage(slug),'utf-8'))).join('\n');
  const block = /<div class="doc-logo-block" aria-hidden="true">([\s\S]*?)<\/div>/.exec(body);
  assert.ok(block, 'the <!--lb:kubernetes helm--> block did not render (or lost aria-hidden)');
  const keys = [...block[1]!.matchAll(/class="doc-logo-mark" data-logo="([a-z0-9-]+)"/g)].map(m => m[1]);
  assert.deepEqual(keys, ['kubernetes', 'helm'], 'the block does not carry the two marks its section is about');
  // The heading it introduces still owns its own line - and its own anchor.
  assert.match(body, /<h2 id="use-the-published-images">Use the published images<\/h2>/);
  assert.ok(!/<!--lb:/.test(body), 'an unrendered block marker ships as an HTML comment');
  assert.ok(!/&lt;!--lb:/.test(body), 'a block marker ships as VISIBLE text');
});

test('the built build-guide carries the marks it is the flagship for', { skip: built }, () => {
  const body = ['build-guide','build-desktop','build-mobile','build-kubernetes'].map(slug => bodyOf(readFileSync(builtPage(slug),'utf-8'))).join('\n');
  for (const key of ['helm', 'kubernetes', 'k3s', 'nginx', 'suse', 'rust', 'node']) {
    assert.match(body, new RegExp(`data-logo="${key}"`), `build-guide.html lost the ${key} mark`);
  }
  // The mark inside the Kubernetes h2 must not have leaked into the heading's id - 
  // that id is a published anchor (the page's contents, search results, deep links).
  assert.match(body, /<h2 id="use-the-published-images"/);
});

test('the markdown twin carries no logo markers', { skip: built }, () => {
  const twin = ['build-guide','build-kubernetes'].map(slug => readFileSync(builtPage(slug,'md'),'utf-8')).join('\n');
  assert.ok(!/<!--l:/.test(twin), 'the agent-readable twin ships marker noise');
  assert.ok(!/<!--lb:/.test(twin), 'the twin ships a block marker');
  // …and the prose the marker sat in survives it.
  assert.match(twin, /Node\.js/);
  assert.match(twin, /k3s/);
});

// ─── the page's contents (rail + page bar) ───────────────────────────────────

test('a page with sections gets the contents rail, and every docs page gets the page bar', { skip: built }, () => {
  const long = readFileSync(builtPage('host-api'), 'utf-8');
  assert.match(long, /<div class="docs-wrap docs-wrap--rail">/, 'host-api has sections but no rail column');
  assert.match(long, /<div class="docs-onpage"><nav class="docs-toc" aria-label="On this page">/);
  assert.match(long, /<div class="doc-pagebar" data-doc-contents><button type="button" class="doc-contents-btn doc-pagebar-btn" aria-expanded="false" aria-controls="docContentsPanel">/);
  assert.match(long, /<div class="doc-contents-panel" id="docContentsPanel" hidden>/);
  assert.match(long, /href="#rules-of-the-contract" data-contents-target="rules-of-the-contract"/, 'the contents do not list the page h2 anchors');
  // The bar comes before the band, at the top of the page, not floating at the bottom.
  assert.ok(long.indexOf('class="doc-pagebar"') < long.indexOf('class="docs-masthead"'), 'the bar is not above the band');
  assert.ok(!/class="doc-contents"[ >]|doc-jump/.test(long), 'a floating contents control came back');
  // Where the bar is, the phone menu keeps only the site's own controls.
  const menu = /<div class="site-sheet">[\s\S]*?<\/details>/.exec(long)?.[0] ?? '';
  assert.ok(!/site-sheet-sections|docs-compact-nav/.test(menu), 'the menu still repeats the sections and pages the bar holds');
  // trust.html is short, but it has sections: short pages get their contents too.
  assert.match(readFileSync(builtPage('trust'), 'utf-8'), /docs-wrap--rail/, 'a short page with sections lost its rail');
});

test('the contents ship on locale pages too', { skip: built }, () => {
  const de = builtPage('host-api','html','de');
  if (!existsSync(de)) return; // a checkout with no locale build
  const html = readFileSync(de, 'utf-8');
  assert.match(html, /data-doc-contents/);
  const marks = readFileSync(builtPage('build-kubernetes','html','de'),'utf-8');
  assert.match(marks, /<span class="doc-logo"/, 'the marks do not survive the locale build');
});

test('the contents rail takes over from the page bar at 1100px', { skip: built }, () => {
  const css = linked(readFileSync(builtPage('build-kubernetes'), 'utf-8'), 'css');
  assert.ok(css.length > 1000, 'the linked stylesheet is missing or empty');
  assert.match(css, /\.docs-onpage\{display:none\}/, 'the rail shows at every width');
  assert.match(css, /@media\(min-width:1100px\)\{\s*\.doc-pagebar\{display:none\}/, 'the bar stays beside the rail');
});

test('the contents script closes on Escape, returns focus and leaves the move to the browser', { skip: built }, () => {
  const html = readFileSync(builtPage('build-kubernetes'), 'utf-8');
  // The contents script rides the shared bundle (plan 131 B.1); each script is its own
  // IIFE joined by `\n;\n`, so pull out the one that wires the contents.
  const script = linked(html, 'js').split('\n;\n').find((seg) => seg.includes('LollyDocsContents.enhanceDocsContents'));
  assert.ok(script, 'the contents ship without their script');
  assert.match(script, /Escape/, 'Esc does not close the panel (house rule)');
  assert.match(script, /\.focus\(/, 'Esc does not return focus to the button (house rule)');
  // On /info no `jump` is passed, so a row is a plain anchor and the browser does the move.
  assert.ok(!/jump:/.test(script.slice(script.lastIndexOf('LollyDocsContents.enhanceDocsContents'))), 'the /info call hands rows to a jump handler');
});

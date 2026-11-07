// SPDX-License-Identifier: MPL-2.0
/**
 * The article masthead - the chip field behind every /info page's h1 (plans/105) - 
 * and the shared field engine it borrows from the landing hero.
 *
 * Three things here can break silently, which is why they are pinned:
 *
 *  1. THE H1's IDENTITY. The band is built by moving the page's own <h1> into it.
 *     Rebuilding the heading instead of moving it would renumber every deep link,
 *     every search-index anchor and every bookmark into the page, and the page would
 *     still look perfect.
 *  2. THE FORMAT LIST. The chips used to be a hand-written array with a comment
 *     asking someone to keep it in step with the docs. Nobody did: it sat at 27
 *     formats while the platform passed 40. It is now generated from
 *     docs/site/formats-catalog.json, and this file fails if a literal list returns.
 *  3. THE MANNERS. Reduced motion, off-screen pause, hidden tab, and a burst that
 *     yields to links and to text selection. All of them are invisible when they
 *     regress - the page just quietly animates at someone who asked it not to.
 *
 * Built-artifact assertions skip when /info has not been built (it is gitignored in
 * shells/web), exactly as tests/docs-logos.test.ts does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO = new URL('..', import.meta.url).pathname;
const BUILT = join(REPO, 'shells/web/public/info');
const CATALOG = join(REPO, 'docs/site/formats-catalog.json');

// Door pages live under /info/<door>/<slug>.html (plans/177 P1) and the flat
// /info/<slug>.html is a redirect stub, so a page is read from its door copy first,
// behind a locale prefix too. The landing (index.html) has no door and stays flat.
const DOORS = ['start', 'create', 'build', 'manage', 'operate', 'trust'];
const builtFile = (rel: string): string => {
  const m = /^(?:([a-z]{2}(?:-[a-z]+)?)\/)?([^/]+)$/.exec(rel);
  if (m && m[2] !== 'index.html') for (const door of DOORS) {
    const path = join(BUILT, m[1] ?? '', door, m[2]!);
    if (existsSync(path)) return path;
  }
  return join(BUILT, rel);
};
const page = (f: string) => readFileSync(builtFile(f), 'utf-8');

/** The shared chrome CSS/JS ship as fingerprinted files linked per page (plan 131 B.1),
 *  not inline. Resolve the file a page links and read it from the build. */
const linked = (html: string, ext: 'css' | 'js'): string => {
  // The first script sets the theme before paint; feature scripts use the deferred bundle.
  const m = ext === 'js'
    ? /<script\b(?=[^>]*\bdefer\b)[^>]*\bsrc="\/info\/(docs\.[A-Za-z0-9_-]{16}\.js)"[^>]*>/.exec(html)
    : /\/info\/(docs\.[A-Za-z0-9_-]{16}\.css)/.exec(html);
  if (!m) throw new Error(`page links no docs.<hash>.${ext}`);
  return readFileSync(join(BUILT, m[1]!), 'utf-8');
};

// Built-artifact assertions skip when /info is unbuilt OR mid-rebuild: the page and both
// fingerprinted chrome files must be present (a concurrent build can momentarily leave a
// page pointing at a file its own next write has not laid down yet).
const built = (() => {
  if (!existsSync(builtFile('build-guide.html'))) return 'no built /info on disk - run `pnpm run build:info`';
  try { linked(page('build-guide.html'), 'css'); linked(page('build-guide.html'), 'js'); }
  catch { return 'built /info is mid-rebuild (linked chrome file absent) - rerun `pnpm run build:info`'; }
  return false;
})();

/** CSS is external now, so a page IS its own body; kept so call sites read unchanged. */
const bodyOf = (html: string) => html;
/** The shared JS bundle a page links. */
const bundleOf = (html: string) => linked(html, 'js');
/** The shared stylesheet a page links. */
const styleOf = (html: string) => linked(html, 'css');

/** ONE former inline script, by something only it contains. The bundle joins each script
 *  (each still its own IIFE) with `\n;\n`, so split on that to keep per-script isolation -
 *  an assertion that one script does NOT contain another's marker still holds. */
function scriptWith(html: string, needle: string): string {
  const hit = bundleOf(html).split('\n;\n').find(seg => seg.includes(needle));
  assert.ok(hit, `no bundled script contains ${needle}`);
  return hit;
}

// ─── the band ────────────────────────────────────────────────────────────────

test('every article page opens with the masthead band, and the landing does not', { skip: built }, () => {
  // A long page and a short one: the band is the DEFAULT, not a length threshold
  // of any kind. If it ever grows one, this fails on trust.html first.
  for (const f of ['build-guide.html', 'trust.html']) {
    const body = bodyOf(page(f));
    assert.match(body, /<div class="docs-masthead">/, `${f} has no masthead band`);
    // Words only: the chip field left article pages on 2026-11-06 (the landing keeps its own).
    assert.ok(!/docs-mast-canvas|<canvas/.test(body.slice(body.indexOf('<div class="docs-masthead">'), body.indexOf('<div class="docs-wrap'))), `${f}: the band grew a canvas again`);
    // Full bleed: the band is a sibling of .docs-wrap, so the rail sits under it.
    const bandAt = body.indexOf('<div class="docs-masthead">');
    const wrapAt = body.indexOf('<div class="docs-wrap');
    assert.ok(bandAt >= 0 && wrapAt > bandAt, `${f}: the band is not above .docs-wrap`);
    // Exactly one h1, and it is inside the band, in the title row (plan 277 step 3c).
    const h1s = [...body.matchAll(/<h1[\s>]/g)];
    assert.equal(h1s.length, 1, `${f}: expected exactly one h1`);
    // The section label (plan 354 D3, when the page sits in its section's rail), then the
    // title row. The sections left the band for the site bar (plan 354 D7).
    assert.match(body, /<div class="docs-mast-inner">(?:<p class="docs-eyebrow">[\s\S]*?<\/p>)?<div class="mast-title"><h1[^>]*>/,
      `${f}: the h1 was not hoisted into the band's title row`);
    const band = body.slice(bandAt, wrapAt);
    assert.ok(!band.includes('<nav class="docs-pathways"'), `${f}: the band carries the sections again; they live in the bar`);
  }
  const landing = bodyOf(page('index.html'));
  assert.ok(!/docs-masthead/.test(landing), 'the landing page grew an article masthead (it has its own hero)');
  assert.match(landing, /id="heroCanvas"/, 'the landing lost its hero canvas');
});

test('every docs page carries the sections once, in the bar; the landing carries them in its page', { skip: built }, () => {
  // Plan 354 D7: the six sections sit in the site bar's middle, where the app keeps its
  // view tabs, on every docs page: an article, a format page, a specification chapter
  // and the immersive Tenets page. The landing's bar has no tabs; its strip stays in
  // the page under the hero. The phone reaches the sections through the page bar's
  // sheet on a docs page, and through the menu where there is no page bar.
  const pages = ['create/exporting.html', 'formats/png/index.html', 'spec/document-model/conformance.html', 'trust/tenets.html', 'index.html'];
  for (const rel of pages) {
    const file = join(BUILT, rel);
    if (!existsSync(file)) continue; // a page family a trimmed build left out
    const body = bodyOf(readFileSync(file, 'utf-8'));
    const navs = body.match(/<nav class="docs-pathways"/g) ?? [];
    assert.equal(navs.length, 1, `${rel}: expected exactly one pathways strip, found ${navs.length}`);
    const header = /<header class="site-bar[\s\S]*?<\/header>/.exec(body)?.[0] ?? '';
    if (rel === 'index.html') {
      assert.ok(!header.includes('<nav class="docs-pathways"'), 'the landing\'s bar has no tabs; the strip sits under the hero');
      assert.match(body, /<div class="docs-strip-band[^"]*"><div class="docs-mast-inner"><nav class="docs-pathways"/, 'the landing lost its strip band');
    } else {
      assert.match(header, /<div class="site-tabs"><nav class="docs-pathways" aria-label="[^"]+">/, `${rel}: the sections are not in the bar's tab slot`);
      assert.match(header, /<a class="docs-pathway active" href="[^"]+" aria-current="(?:page|true)">/, `${rel}: the bar does not mark the current section`);
    }
    const hasBar = /<div class="doc-pagebar" data-doc-contents>/.test(body);
    if (hasBar) assert.match(body, /<nav class="doc-sheet-sections" aria-label="[^"]+">/, `${rel}: the page bar's sheet lost the sections`);
    else assert.match(header, /<div class="site-sheet-sections" role="group" aria-label="[^"]+">/, `${rel}: the phone menu no longer opens with the sections`);
  }
});

test('hoisting the h1 into the band does not move its anchor', { skip: built }, () => {
  // The ids these pages had before the band existed. Not derived from the same
  // helper the build uses - that would agree with itself no matter what it did.
  const expected: Record<string, string> = {
    'build-guide.html': 'build-guide',
    'trust.html': 'trust',
    'url-mode.html': 'url-mode',
  };
  for (const [f, id] of Object.entries(expected)) {
    const body = bodyOf(page(f));
    assert.match(body, new RegExp(`<h1 id="${id}"`), `${f}: the page h1's anchor changed to something else`);
  }
});

test('the band ships no provenance line - it is shell decoration, not a signed asset', { skip: built }, () => {
  // The whole band, up to the rail and article under it: it holds the strip and the
  // title row with Listen now, so a match that stopped at its first closing pair of
  // divs would inspect only part of the band.
  const band = /<div class="docs-masthead">[\s\S]*?(?=<div class="docs-wrap)/.exec(bodyOf(page('build-guide.html')));
  assert.ok(band, 'no band found');
  assert.ok(!/shot-cred|asset-cred|prov-pill/.test(band[0]), 'the masthead claims a credential it does not have');
});

test('the locale pages get the band too', { skip: built }, () => {
  const de = builtFile('de/build-guide.html');
  if (!existsSync(de)) return;
  const body = bodyOf(readFileSync(de, 'utf-8'));
  assert.match(body, /<div class="docs-masthead">/);
  assert.match(body, /<h1 id="build-guide"/, 'the locale build renamed the heading anchor');
});

// ─── the chip list ───────────────────────────────────────────────────────────

/** The `var exts=[…]` array as it actually ships, parsed back into strings. */
function shippedExts(html: string): string[] {
  const m = /var exts=(\[[^\]]*\])/.exec(bundleOf(html));
  assert.ok(m, 'no chip list in the shipped script');
  return JSON.parse(m[1]!.replace(/'/g, '"'));
}

test('the chip list is generated from the formats catalog, not hand-written', { skip: built }, () => {
  const exts = shippedExts(page('index.html'));
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf-8')) as { formats: Array<{ token: string; dir: string }> };
  const exportable = catalog.formats.filter(f => f.dir !== 'in');
  // Newer formats the old 27-entry hand list never had. If someone replaces the
  // generator with a literal again, these are the first things to go missing.
  for (const ext of ['.EXR', '.DOCX', '.WOFF', '.PSD', '.SRT', '.ODT', '.SVGZ', '.FLAC', '.AAC', '.RPM']) {
    assert.ok(exts.includes(ext), `the chips lost ${ext} - is the list hand-written again?`);
  }
  // Every chip must trace back to an exportable catalog entry, so a surviving literal
  // naming a format the catalog does not write fails here. (This used to pin .OGG as
  // a hand-list leftover; OGG is written now, by a Design sequence and Download as.)
  const tokens = new Set(exportable.map(f => `.${f.token.toUpperCase()}`));
  for (const ext of exts) assert.ok(tokens.has(ext), `${ext} is not an exportable format in the catalog`);
  // Import-only formats are never written, so they are never chips.
  const inOnly = catalog.formats.filter(f => f.dir === 'in').map(f => `.${f.token.toUpperCase()}`);
  for (const ext of inOnly) {
    if (tokens.has(ext)) continue; // also exportable under another entry
    assert.ok(!exts.includes(ext), `${ext} is import-only and should not be a chip`);
  }
  assert.ok(exts.length >= 40, `only ${exts.length} chips - the catalog says ${exportable.length} formats are exportable`);
});

test('every page ships the one generated list the landing draws from', { skip: built }, () => {
  assert.deepEqual(shippedExts(page('build-guide.html')), shippedExts(page('index.html')));
  // The ×2 weighting of the headline formats survives the change.
  assert.match(bundleOf(page('index.html')), /extPool=exts\.concat\(\['\.PDF','\.SVG','\.PNG','\.MP4','\.PPTX'\]\)/);
});

// ─── the manners ─────────────────────────────────────────────────────────────

test('the landing hero keeps its plain, unguarded chip field', { skip: built }, () => {
  const engine = bundleOf(page('build-guide.html'));
  const landing = scriptWith(page('index.html'), "getElementById('heroCanvas')");
  assert.match(engine, /document\.addEventListener\('pointerdown',burstAt\)/, 'the shared field lost its immediate burst path');
  assert.match(landing, /__lollyChipField\(canvas,\{burst:true\}\)/, 'the landing hero no longer runs the plain, unguarded field');
  assert.ok(!/\{[^{}]*burstGuard:true/.test(landing), 'the landing hero picked up the docs guards');
});

// ─── banked art (plans/105 section 6) ───────────────────────────────────────────────
//
// The MASTHEADS table overrides the default chip band per page with a signed
// artifact from docs/mastheads/. It ships EMPTY, so what these guard is the
// default staying the default - and the credential machinery the art will carry
// being present and honest before any art exists to carry it.

test('with nothing mapped, every page gets the plain band - words, no field', { skip: built }, () => {
  for (const f of ['build-guide.html', 'trust.html', 'exporting.html']) {
    const body = bodyOf(page(f));
    assert.match(body, /<div class="docs-masthead"><div class="docs-mast-inner">/, `${f} lost its plain band`);
    assert.ok(!/docs-mast-canvas/.test(body), `${f} carries the chip field again`);
    assert.ok(!/docs-masthead--art|docs-mast-art/.test(body),
      `${f} renders banked art - the MASTHEADS table is supposed to be empty (and the art signed)`);
  }
});

test('a banked masthead replaces the plain band, not joins it', { skip: built }, () => {
  // Art plus a second band behind one h1 is not a design, it is a bug that only shows
  // up on the one page that has art. The band's builder returns the art instead.
  const src = readFileSync(join(REPO, 'docs/build.ts'), 'utf-8');
  assert.match(src, /const art = mastheadArt\(slug, heading\);\s*\n\s*if \(art\) return \{ band: art, rest, canvas: false \};/,
    'docs/build.ts no longer picks banked art INSTEAD of the default band');
});

test('the credential line offers Copy signed source, and says what happened', { skip: built }, () => {
  // The action ships on every page (one shared script), so it is checkable here even
  // though no artifact is banked yet: the buttons appear when art does.
  const js = scriptWith(page('build-guide.html'), 'shot-cred-copy');
  assert.match(js, /fetch\(src,\{credentials:'same-origin'\}\)/, 'the copy action must read the SERVED file');
  assert.match(js, /navigator\.clipboard/, 'the copy action does not reach the clipboard');
  assert.match(js, /data-copied/, 'a copy that succeeds says nothing');
  assert.match(js, /data-copy-failed/, 'a copy that fails would silently look like a copy that worked');
  // The feedback words are DATA on the button, so a locale page speaks its own
  // language while every page runs identical script bytes.
  assert.match(js, /getAttribute\('data-copied'\)/);
  // Escape still closes the line and returns focus to its trigger - the copy button
  // lives inside that line, so a reader who tabbed to it must not be stranded.
  assert.match(js, /if\(e\.key!=='Escape'\)return;/);
  assert.match(js, /b\.focus\(\);/);
});

test('no screenshot is offered a clipboard copy of its pixels', { skip: built }, () => {
  // Copy is source-text only (the banked SVG/HTML art). An action that fails on 150
  // of 155 credential lines is not an action.
  for (const f of ['build-guide.html', 'exporting.html']) {
    assert.ok(!/shot-cred-copy" data-copy-src="\/info\/shots\//.test(bodyOf(page(f))),
      `${f} offers "Copy signed source" on a screenshot`);
  }
});

test('the landing canvas never takes a pointer event, and the band scrims neither', { skip: built }, () => {
  const css = styleOf(page('build-guide.html'));
  assert.match(css, /#heroCanvas\{[^}]*pointer-events:none/);
  // The scrims sit above the canvas and below the heading, and neither eats clicks.
  assert.match(css, /\.docs-masthead::before\{[^}]*pointer-events:none/);
  assert.match(css, /\.docs-masthead::after\{[^}]*pointer-events:none/);
});

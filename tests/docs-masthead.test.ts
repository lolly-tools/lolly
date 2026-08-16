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

const built = existsSync(join(BUILT, 'build-guide.html'))
  ? false
  : 'no built /info on disk - run `npm run build:info`';

const page = (f: string) => readFileSync(join(BUILT, f), 'utf-8');
/** A page minus its inline stylesheet - the CSS discusses the band in comments. */
const bodyOf = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, ' ');

/** ONE inline script, by something only it contains. Split rather than a lazy regex
 *  across the page: `<script>…?needle` happily starts at the theme-init script at the
 *  top of <head> and swallows every tag in between, which makes every assertion below
 *  pass for the wrong reason. */
function scriptWith(html: string, needle: string): string {
  const hit = bodyOf(html).split('<script>').find(part => {
    const end = part.indexOf('</script>');
    return end >= 0 && part.slice(0, end).includes(needle);
  });
  assert.ok(hit, `no inline script contains ${needle}`);
  return hit.slice(0, hit.indexOf('</script>'));
}

// ─── the band ────────────────────────────────────────────────────────────────

test('every article page opens with the masthead band, and the landing does not', { skip: built }, () => {
  // A long page and a short one: the band is the DEFAULT, not a length threshold
  // like the jump nav's. If it ever grows one, this fails on trust.html first.
  for (const f of ['build-guide.html', 'trust.html']) {
    const body = bodyOf(page(f));
    assert.match(body, /<div class="docs-masthead">/, `${f} has no masthead band`);
    assert.match(body, /<canvas class="docs-mast-canvas" aria-hidden="true"><\/canvas>/, `${f}: the canvas is not decorative-only`);
    // Full bleed: the band is a sibling of .docs-wrap, so the rail sits under it.
    const bandAt = body.indexOf('<div class="docs-masthead">');
    const wrapAt = body.indexOf('<div class="docs-wrap">');
    assert.ok(bandAt >= 0 && wrapAt > bandAt, `${f}: the band is not above .docs-wrap`);
    // Exactly one h1, and it is inside the band.
    const h1s = [...body.matchAll(/<h1[\s>]/g)];
    assert.equal(h1s.length, 1, `${f}: expected exactly one h1`);
    assert.match(body, /<div class="docs-mast-inner"><h1[^>]*>/, `${f}: the h1 was not hoisted into the band`);
  }
  const landing = bodyOf(page('index.html'));
  assert.ok(!/docs-masthead/.test(landing), 'the landing page grew an article masthead (it has its own hero)');
  assert.match(landing, /id="heroCanvas"/, 'the landing lost its hero canvas');
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

test('the band ships no provenance line — it is shell decoration, not a signed asset', { skip: built }, () => {
  const band = /<div class="docs-masthead">[\s\S]*?<\/div>\s*<\/div>/.exec(bodyOf(page('build-guide.html')));
  assert.ok(band, 'no band found');
  assert.ok(!/shot-cred|asset-cred|prov-pill/.test(band[0]), 'the masthead claims a credential it does not have');
});

test('the locale pages get the band too', { skip: built }, () => {
  const de = join(BUILT, 'de/build-guide.html');
  if (!existsSync(de)) return;
  const body = bodyOf(readFileSync(de, 'utf-8'));
  assert.match(body, /<div class="docs-masthead">/);
  assert.match(body, /<h1 id="build-guide"/, 'the locale build renamed the heading anchor');
});

// ─── the chip list ───────────────────────────────────────────────────────────

/** The `var exts=[…]` array as it actually ships, parsed back into strings. */
function shippedExts(html: string): string[] {
  const m = /var exts=(\[[^\]]*\])/.exec(bodyOf(html));
  assert.ok(m, 'no chip list in the shipped script');
  return JSON.parse(m[1]!.replace(/'/g, '"'));
}

test('the chip list is generated from the formats catalog, not hand-written', { skip: built }, () => {
  const exts = shippedExts(page('index.html'));
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf-8')) as { formats: Array<{ token: string; dir: string }> };
  const exportable = catalog.formats.filter(f => f.dir !== 'in');
  // Newer formats the old 27-entry hand list never had. If someone replaces the
  // generator with a literal again, these are the first things to go missing.
  for (const ext of ['.EXR', '.DOCX', '.WOFF', '.PSD', '.EPUB', '.ODT', '.SVGZ']) {
    assert.ok(exts.includes(ext), `the chips lost ${ext} — is the list hand-written again?`);
  }
  // …and one that was in the hand list but is NOT in the catalog: its presence would
  // mean the literal survived somewhere.
  assert.ok(!exts.includes('.OGG'), '.OGG is a leftover from the retired hand list');
  // Every chip must trace back to an exportable catalog entry.
  const tokens = new Set(exportable.map(f => `.${f.token.toUpperCase()}`));
  for (const ext of exts) assert.ok(tokens.has(ext), `${ext} is not an exportable format in the catalog`);
  // Import-only formats are never written, so they are never chips.
  const inOnly = catalog.formats.filter(f => f.dir === 'in').map(f => `.${f.token.toUpperCase()}`);
  for (const ext of inOnly) {
    if (tokens.has(ext)) continue; // also exportable under another entry
    assert.ok(!exts.includes(ext), `${ext} is import-only and should not be a chip`);
  }
  assert.ok(exts.length >= 40, `only ${exts.length} chips — the catalog says ${exportable.length} formats are exportable`);
});

test('the landing and the masthead draw from the same generated list', { skip: built }, () => {
  assert.deepEqual(shippedExts(page('build-guide.html')), shippedExts(page('index.html')));
  // The ×2 weighting of the headline formats survives the change.
  assert.match(bodyOf(page('index.html')), /extPool=exts\.concat\(\['\.PDF','\.SVG','\.PNG','\.MP4','\.PPTX'\]\)/);
});

// ─── the manners ─────────────────────────────────────────────────────────────

test('the masthead script honours reduced motion, off-screen and hidden tabs', { skip: built }, () => {
  const js = scriptWith(page('build-guide.html'), 'docs-mast-canvas');
  // The instance's own options…
  assert.match(js, /pause:true/, 'the masthead animates off screen');
  assert.match(js, /reduceMotion:true/, 'the masthead ignores prefers-reduced-motion');
  // …and the engine behaviour those options select.
  assert.match(js, /prefers-reduced-motion:reduce/);
  assert.match(js, /function paintOnce\(\)/, 'there is no static-frame path for reduced motion');
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /document\.hidden/);
  // Theme: the palette is read from the page's tokens and re-baked on a flip.
  assert.match(js, /MutationObserver/, 'a theme toggle would leave the chips in the old palette');
  assert.match(js, /prefers-color-scheme:dark/, 'an OS theme change would leave the chips in the old palette');
  assert.match(js, /getPropertyValue/, 'the docs palette is not derived from the docs tokens');
});

test('the masthead burst yields to links, buttons and text selection', { skip: built }, () => {
  const js = scriptWith(page('build-guide.html'), 'docs-mast-canvas');
  assert.match(js, /burst:true/, 'the masthead lost its click burst');
  assert.match(js, /burstGuard:true/, 'the masthead bursts without the prose-page guards');
  assert.match(js, /closest\('a,button,input,select,textarea,label,summary/, 'a control in the band would be hijacked by the burst');
  assert.match(js, /isCollapsed/, 'selecting text in the band would fire a burst');
  assert.match(js, /if\(still\)return;/, 'a static (reduced-motion) band still bursts when clicked');
  // The landing keeps the immediate, unguarded version it always had.
  const landing = scriptWith(page('index.html'), "getElementById('heroCanvas')");
  assert.match(landing, /document\.addEventListener\('pointerdown',burstAt\)/, 'the landing hero lost its immediate burst');
  // The engine SOURCE mentions every option (it implements them), so the landing is
  // judged on the options it actually passes - that call is the whole difference
  // between the two instances.
  assert.match(landing, /__lollyChipField\(canvas,\{burst:true\}\)/, 'the landing hero no longer runs the plain, unguarded field');
  assert.ok(!/\{[^{}]*burstGuard:true/.test(landing), 'the landing hero picked up the docs guards');
  assert.ok(!/\{[^{}]*(pause:true|reduceMotion:true)/.test(landing), 'the landing hero picked up the docs pausing');
});

// ─── banked art (plans/105 section 6) ───────────────────────────────────────────────
//
// The MASTHEADS table overrides the default chip band per page with a signed
// artifact from docs/mastheads/. It ships EMPTY, so what these guard is the
// default staying the default - and the credential machinery the art will carry
// being present and honest before any art exists to carry it.

test('with nothing mapped, every page still gets the default field — not a blank band', { skip: built }, () => {
  for (const f of ['build-guide.html', 'trust.html', 'exporting.html']) {
    const body = bodyOf(page(f));
    assert.match(body, /<canvas class="docs-mast-canvas"/, `${f} lost the default chip field`);
    assert.ok(!/docs-masthead--art|docs-mast-art/.test(body),
      `${f} renders banked art — the MASTHEADS table is supposed to be empty (and the art signed)`);
  }
});

test('a banked masthead would replace the canvas, not join it', { skip: built }, () => {
  // Two fields behind one h1 is not a design, it is a bug that only shows up on the
  // one page that has art. The band's builder chooses; the chip script rides on that
  // same choice, so a page with art also ships no chip engine.
  const src = readFileSync(join(REPO, 'docs/build.ts'), 'utf-8');
  assert.match(src, /const art = mastheadArt\(slug, m\[0\]\);\s*\n\s*if \(art\) return \{ band: art, rest, canvas: false \};/,
    'docs/build.ts no longer picks banked art INSTEAD of the default band');
  assert.match(src, /\$\{mast\?\.canvas \? DOCS_MASTHEAD_SCRIPT : ''\}/,
    'the chip-field script would ship on a page whose band has no canvas to paint');
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

test('the canvas never takes a pointer event, in either instance', { skip: built }, () => {
  const css = /<style>([\s\S]*?)<\/style>/.exec(page('build-guide.html'))![1]!;
  assert.match(css, /\.docs-mast-canvas\{[^}]*pointer-events:none/);
  assert.match(css, /#heroCanvas\{[^}]*pointer-events:none/);
  // The scrims sit above the canvas and below the heading, and neither eats clicks.
  assert.match(css, /\.docs-masthead::before\{[^}]*pointer-events:none/);
  assert.match(css, /\.docs-masthead::after\{[^}]*pointer-events:none/);
});

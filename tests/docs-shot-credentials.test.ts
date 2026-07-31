// SPDX-License-Identifier: MPL-2.0
/**
 * Screenshot motion + credential contracts (docs/build.ts, docs/shot-provenance.ts).
 *
 * Two of these guard failure modes that are INVISIBLE in a build log and total in
 * effect — every screenshot on the site disappears, and the build still says "✓":
 *
 *  1. `.shot` is width:fit-content, so a `loading="lazy"` image with no declared
 *     size lays the wrapper out 0×0. A zero-area box never approaches the viewport,
 *     so the image never loads, so the box never gains size. The settle observer
 *     never fires and all 155 shots sit at opacity 0 for ever. Declared width/height
 *     attributes are what break the deadlock.
 *  2. The hidden start state is `.shots-motion .shot` (0,2,0). Anything that undoes
 *     it must carry the same qualifier — a bare `.shot--in` is (0,1,0) and LOSES,
 *     which again leaves every screenshot invisible. This exact bug was written and
 *     caught once already.
 *
 * The rest guard the provenance claims. A credential line that points at the wrong
 * file, or an inlined copy that carries a manifest its bytes no longer match, is
 * worse than no credential: the first misattributes, the second manufactures a
 * FALSE NEGATIVE on a genuine Lolly asset.
 *
 * Run directly: node --test tests/docs-shot-credentials.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readShotProvenance } from '../docs/shot-provenance.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const BUILD_TS = readFileSync(join(ROOT, 'docs/build.ts'), 'utf8');
const SHOTS_DIR = join(ROOT, 'docs/shots');

/**
 * One function's source, from its declaration to the next top-level one. Slicing
 * between two NAMED functions silently yields '' whenever they are reordered in the
 * file — which it did, and an empty haystack makes every `doesNotMatch` assertion
 * pass while proving nothing.
 */
function fnSource(name: string): string {
  const start = BUILD_TS.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `docs/build.ts no longer declares ${name}()`);
  const next = BUILD_TS.slice(start + 1).search(/\n(?:function |const [A-Z])/);
  const body = BUILD_TS.slice(start, next < 0 ? undefined : start + 1 + next);
  assert.ok(body.length > 100, `${name}() source looks empty — the slice is wrong`);
  return body;
}

// ── The two invisible-screenshot tripwires ───────────────────────────────────

test('every shot img is emitted with width/height, or the lazy-load deadlock returns', () => {
  // Asserted as a PROPERTY of the wrapper rewrite, not as literal markup: the exact
  // tag has already been reshaped once (a dual light/dark pair, an opt-in sweep
  // class), and a test that pins the string fails on every honest refactor while
  // saying nothing about the thing that matters. What matters is that no <img> for a
  // shot is ever emitted without measured dimensions.
  const start = BUILD_TS.indexOf('A screenshot gets a wrapper');
  assert.ok(start > 0, 'the shot wrapper rewrite is gone — has inline() been restructured?');
  const region = BUILD_TS.slice(start, BUILD_TS.indexOf('External links (absolute http/https)', start));
  // Only real emissions. The region also contains the word "<img>" in prose comments
  // and the SEARCH pattern the rewrite matches against (a regex literal, not output);
  // an emission is the one that interpolates, so require a `${`.
  const imgs = [...region.matchAll(/<img\b[^>]*?>/g)].filter((m) => m[0].includes('src="${'));
  assert.ok(imgs.length >= 1, 'expected at least one <img> emission in the wrapper rewrite');
  for (const m of imgs) {
    assert.match(m[0]!, /\$\{d?dims\}/,
      `this shot <img> is emitted without measured dimensions:\n  ${m[0]}\n`
      + 'A lazy image with no width/height inside a width:fit-content wrapper lays out '
      + '0x0, never loads, and never settles — every screenshot on the site goes invisible.');
  }
  // And the dimensions must come from the file, per image (a twin is a different file).
  assert.match(region, /size = shotSize\(/);
  assert.equal((region.match(/shotSize\(/g) ?? []).length, imgs.length,
    'each emitted <img> needs its OWN shotSize() call — reusing one file\'s dims for another '
    + 'reserves the wrong box and can reintroduce the deadlock for the odd one out');
});

test('every rule that undoes the hidden start state is qualified by .shots-motion', () => {
  // Collect the selectors of rules that restore visibility, and prove none of them
  // is a bare `.shot--in` that would lose to `.shots-motion .shot`.
  const restores = [...BUILD_TS.matchAll(/^\s*(\.[^{\n]*\.shot--in[^{\n]*)\{([^}]*)\}/gm)];
  assert.ok(restores.length >= 2, 'expected the .shot--in rules to be present');
  for (const [, selector] of restores) {
    assert.match(selector!, /\.shots-motion\b/,
      `"${selector!.trim()}" undoes the start state but is not qualified by .shots-motion, `
      + 'so it loses on specificity and every screenshot stays invisible');
  }
});

test('the hidden start state is armed pre-paint and gated, so no-JS shows plain images', () => {
  assert.match(BUILD_TS, /classList\.add\('shots-motion'\)/, 'the pre-paint init script must add the gate');
  // The gate has to be in <head> (with the theme flag), not at end of body, or a long
  // page paints the shots once and blinks them out to animate them back in.
  const head = BUILD_TS.slice(BUILD_TS.indexOf('${THEME_INIT_SCRIPT}'), BUILD_TS.indexOf('<style>${CSS}</style>'));
  assert.match(head, /SHOT_MOTION_INIT/, 'SHOT_MOTION_INIT belongs in <head>, beside THEME_INIT_SCRIPT');
  // Every declaration that hides the WRAPPER must sit behind the gate. Scoped to the
  // wrapper selector itself (`.shot` / `.shot--hero`, not `.shot-cred*`, which is the
  // credential line and is *meant* to start at opacity 0).
  for (const [, sel] of BUILD_TS.matchAll(/^\s*([^{\n]*\.shot(?:--[a-z]+)?(?![-\w])[^{\n]*)\{[^}]*opacity:0[^}]*\}/gm)) {
    assert.match(sel!, /\.shots-motion\b/,
      `"${sel!.trim()}" hides a shot without the .shots-motion gate — with no JS it can never come back`);
  }
});

// ── Provenance ───────────────────────────────────────────────────────────────

test('every committed shot carries a readable, signed credential', () => {
  const shots = readdirSync(SHOTS_DIR).filter((f) => /\.(svg|png|jpg)$/.test(f));
  assert.ok(shots.length > 100, `expected the shot corpus, found ${shots.length}`);
  const unsigned: string[] = [];
  for (const f of shots) {
    const p = readShotProvenance(join(SHOTS_DIR, f));
    if (!p?.signer || !p.generator || !p.when) unsigned.push(f);
  }
  // A shot with no credential still renders — it just gets no line. That is the
  // correct behaviour, and this test is the alarm that says it happened, because a
  // silently uncredentialed baseline is how the whole claim quietly stops being true.
  assert.deepEqual(unsigned, [], 'these baselines have no readable credential — re-run the shots pipeline');
});

test('the credential line reports the signer the file actually names', () => {
  // Not a hardcoded string anywhere in the builder: the line must come from the
  // manifest. Spot-check that the reader returns Lolly's own signer for a real file.
  const sample = readdirSync(SHOTS_DIR).find((f) => f.endsWith('.svg'))!;
  const p = readShotProvenance(join(SHOTS_DIR, sample));
  assert.equal(p?.signer, 'Lolly');
  assert.match(p!.generator!, /^Lolly \d+\.\d+\.\d+$/);
  assert.equal(p?.tool, 'URL Screenshot');
  assert.equal(p?.surface, 'docs');
  // The builder must not carry a literal signer/date it could state without reading.
  const credFn = fnSource('shotCredential');
  assert.doesNotMatch(credFn, /'Lolly'/, 'shotCredential must not hardcode a signer — read it from the manifest');
});

test('verify and download links point at the served file, same-origin', () => {
  const credFn = fnSource('shotCredential');
  // The verify view (shells/web/src/views/valid.ts) accepts ?src= ONLY when it starts
  // with a single slash — it must never be able to make a reader's browser fetch a
  // third-party host. So the link is built from the /info/shots/ path, encoded.
  assert.match(credFn, /const src = `\/info\/shots\/\$\{file\}`/);
  assert.match(credFn, /href="\/#\/verify\?src=\$\{encodeURIComponent\(src\)\}"/);
  assert.match(credFn, /href="\$\{src\}" download/);
});

test('an AI declaration is never hidden behind the hover', () => {
  const credFn = fnSource('shotCredential');
  // It must reach the always-available accessible label, not only the revealed line.
  const label = /const label = \[([^\]]*)\]/.exec(credFn);
  assert.ok(label, 'the trigger must build an aria-label');
  assert.match(label[1]!, /p\.ai/, 'the AI declaration must be in the trigger label, not only the hover line');
  assert.match(BUILD_TS, /\.shot-cred--ai \.shot-cred-btn\{opacity:1/, 'an AI-declaring shot must show a full-opacity glyph');
});

test('the showcase strips the manifest it inlines, and keeps the file it points at', () => {
  // Inlining removes the FILE from the page. A C2PA hash binding covers file bytes,
  // so an inline copy that still carried its manifest would fail validation if saved
  // — a false negative on a real Lolly asset. The manifest is stripped from the DOM
  // copy and the credential line points at the untouched file instead.
  const script = BUILD_TS.slice(BUILD_TS.indexOf('const SHOWCASE_SCRIPT'), BUILD_TS.indexOf('const SCROLL_REVEAL_SCRIPT'));
  // Substring, not a regex: the strip lives inside a template literal, so its source
  // text is double-escaped and matching it with a pattern is needlessly brittle.
  // The closing tag's slash is escaped inside the regex inside the template literal,
  // so match on the strip statement's opening instead of trying to spell both tags.
  assert.ok(script.includes('text=text.replace(/<metadata>'),
    'the fetched SVG must have its <metadata> stripped before injection');
  assert.ok(script.includes("'id=\"sc-$1\"'"), 'inlined ids must be namespaced — an inline SVG shares the page id space');
  // The block still emits an <img> of the real file (the no-JS fallback AND the thing
  // the credential is about).
  const fn = fnSource('buildShowcase');
  assert.match(fn, /class="showcase-fallback"/);
  assert.match(fn, /shotCredential\(file\)/, 'the showcase must carry the same credential line as any other shot');
});

test('a showcase recipe names a captured vector baseline', () => {
  // ::: showcase inlines live SVG, so a raster or missing baseline must fail the
  // build loudly rather than ship a still image where a camera move was intended.
  const pages = readdirSync(join(ROOT, 'docs')).filter((f) => f.endsWith('.md'));
  let found = 0;
  for (const page of pages) {
    const md = readFileSync(join(ROOT, 'docs', page), 'utf8');
    for (const block of md.matchAll(/^::: showcase\s*$([\s\S]*?)^:::\s*$/gm)) {
      const recipe = /!\[[^\]]*\]\((\/t\/url-shot\?[^)\s]+)\)/.exec(block[1]!);
      assert.ok(recipe, `${page}: a ::: showcase block must wrap a url-shot recipe line`);
      const q = new URLSearchParams(recipe[1]!.slice(recipe[1]!.indexOf('?') + 1));
      const slug = q.get('filename');
      assert.ok(slug, `${page}: the showcase recipe needs a filename=`);
      assert.equal((q.get('format') || 'svg').toLowerCase(), 'svg',
        `${page}: ${slug} is a raster — only a vector shot can be inlined and zoomed`);
      assert.ok(existsSync(join(SHOTS_DIR, `${slug}.svg`)), `${page}: docs/shots/${slug}.svg is not captured`);
      // The camera lerps a viewBox; without one there is nothing to animate.
      assert.match(readFileSync(join(SHOTS_DIR, `${slug}.svg`), 'utf8').slice(0, 2048), /viewBox="/,
        `${page}: ${slug}.svg has no viewBox`);
      found++;
    }
  }
  assert.ok(found >= 1, 'expected at least one ::: showcase block (docs/exporting.md)');
});

// ── Search placement ─────────────────────────────────────────────────────────

test('the docs search field is in the topbar, once, and not on the landing page', () => {
  assert.match(BUILD_TS, /\$\{isLanding \? '' : searchBox\(lang\)\}/,
    'the nav must mount searchBox for docs pages only — there is no index behind the landing page');
  // Exactly one input: two copies would duplicate the id the combobox wiring uses.
  const inputs = [...BUILD_TS.matchAll(/id="docs-search"/g)];
  assert.equal(inputs.length, 1, 'there must be exactly one #docs-search input');
  const sidebar = fnSource('buildSidebar');
  assert.doesNotMatch(sidebar, /docs-search/, 'the sidebar must no longer carry the search box');
});

test('a search hit declares its own layout axis', () => {
  // It used to be a block that had to out-specify `.docs-sidebar a{display:flex}`;
  // when that fight was lost the three spans became a ROW of one-word columns.
  // Declaring the axis means no ancestor rule can decide it later.
  const hit = /\.docs-search-hit\{([^}]*)\}/.exec(BUILD_TS);
  assert.ok(hit, 'expected a .docs-search-hit rule');
  assert.match(hit[1]!, /flex-direction:column/, 'a hit must declare flex-direction:column');
});

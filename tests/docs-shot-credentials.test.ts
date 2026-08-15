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
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readShotProvenance } from '../docs/shot-provenance.ts';
import { readShotAnatomy } from '../docs/shot-anatomy.ts';
import { renderCredential } from '../packages/docs-render/src/index.ts';
import type { CredentialFacts, DocsRenderContext, CredentialRenderOpts } from '../packages/docs-render/src/index.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const BUILD_TS = readFileSync(join(ROOT, 'docs/build.ts'), 'utf8');
// inline() and buildShowcase() now live in the shared renderer package (M0b); the two
// source-scanning tests below read it there instead of build.ts.
const RENDER_TS = readFileSync(join(ROOT, 'packages/docs-render/src/render.ts'), 'utf8');
const SHOTS_DIR = join(ROOT, 'docs/shots');

// The credential line's HTML assembly moved to @lolly-tools/docs-render's renderCredential
// (docs/build.ts's shotCredential is now a thin adapter that feeds it facts). These provenance
// tests now assert on the renderer's OUTPUT with synthetic facts — behaviour, not source text.
let credSeq = 0;
const stubCtx: Pick<DocsRenderContext, 't' | 'htmlLang' | 'nextCredId' | 'docIcon'> = {
  t: (s) => s,
  htmlLang: 'en',
  nextCredId: () => `shot-cred-${++credSeq}`,
  docIcon: (k) => `<svg data-icon="${k}"></svg>`,
};
function renderCred(factsOverrides: Partial<CredentialFacts> = {}, opts: Partial<CredentialRenderOpts> = {}): string {
  const facts: CredentialFacts = {
    signer: 'Lolly', generator: 'Lolly 1.90.0', when: '2026-08-14T09:00:00Z',
    dimensions: '1440 × 1200 px', ai: undefined, model: null, oversight: null,
    anat: { kind: 'vector', paths: 134, nodes: 4200, groups: 12, images: 2, elements: 400, bytes: 41_000 },
    recipe: { width: 1440, height: 1200, dpi: 192, walker: true },
    src: '/info/shots/gallery.svg', canCopySource: false,
    ...factsOverrides,
  };
  return renderCredential(facts, { file: 'gallery.svg', extraClass: '', fromPresent: false, ...opts }, stubCtx);
}

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
  const start = RENDER_TS.indexOf('A screenshot gets a wrapper');
  assert.ok(start > 0, 'the shot wrapper rewrite is gone — has inline() been restructured?');
  const region = RENDER_TS.slice(start, RENDER_TS.indexOf('External links (absolute http/https)', start));
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
  assert.match(region, /size = ctx\.shotSize\(/);
  assert.equal((region.match(/ctx\.shotSize\(/g) ?? []).length, imgs.length,
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
  // The renderer must not carry a literal signer — it comes from the facts. Render with a
  // distinctive signer and find it verbatim; render with none and get no signer pill.
  assert.match(renderCred({ signer: 'Signer-From-Manifest-XYZ' }), /Signer-From-Manifest-XYZ/,
    'the signer pill must come from the facts, not a literal in the renderer');
  assert.doesNotMatch(renderCred({ signer: null }), /prov-sig/, 'no signer in the facts → no signer pill');
});

test('verify and download links point at the served file, same-origin', () => {
  // The verify view (shells/web/src/views/valid.ts) accepts ?src= ONLY when it starts with
  // a single slash — it must never make a reader's browser fetch a third-party host. A shot's
  // src is its /info/shots/ path; a page asset passes its own /info/ URL. Both stay relative.
  const html = renderCred({ src: '/info/shots/gallery.svg' });
  assert.match(html, /href="\/#\/verify\?src=%2Finfo%2Fshots%2Fgallery\.svg"/,
    'the verify link must encode the domain-relative served src');
  assert.match(html, /href="\/info\/shots\/gallery\.svg" download/, 'the download link points at the served file');
  // A page asset's own /info/ src flows through unchanged and stays same-origin.
  const asset = renderCred({ src: '/info/the-flood.webp' }, { file: 'the-flood.webp', fromPresent: true });
  assert.match(asset, /href="\/#\/verify\?src=%2Finfo%2Fthe-flood\.webp"/, 'a page asset stays domain-relative');
  assert.doesNotMatch(asset, /verify\?src=https?/, 'no credential may point verify at a third-party host');
  // And the build.ts adapter that feeds these facts reads a page asset from the BUILT site,
  // so the credential describes the served bytes (the src derivation is covered byte-for-byte
  // by the build gate; this pins the read path the adapter uses).
  assert.match(BUILD_TS, /path = art \? resolve\(__dirname, rel\) : resolve\(outDir, rel\)/,
    'docCtx.credential reads a page asset from outDir (the served bytes)');
});

test('an AI declaration is never hidden behind the hover', () => {
  // It must reach the always-available accessible label, not only the revealed line.
  const html = renderCred({ ai: 'generated' });
  const label = /aria-label="([^"]*)"/.exec(html);
  assert.ok(label, 'the trigger must build an aria-label');
  assert.match(label[1]!, /AI generated/, 'the AI declaration must be in the trigger label, not only the hover line');
  // …and it flags the wrapper so the glyph can be promoted (styled via .shot-cred--ai below).
  assert.match(html, /class="shot-cred shot-cred--ai/, 'an AI-declaring credential marks itself for the louder glyph');
  // Promoted by CONTRAST, not by opacity. The glyph no longer rests at partial opacity
  // (that faded its strokes into the screenshot behind it), so "louder" now means a
  // filled puck and a ring rather than opacity:1 — which would be a no-op today and a
  // test that passed while proving nothing.
  const ai = /\.shot-cred--ai \.shot-cred-btn\{([^}]*)\}/.exec(BUILD_TS);
  assert.ok(ai, 'an AI-declaring shot must style its glyph distinctly');
  assert.match(ai[1]!, /background:/, 'the AI glyph must be filled, not merely un-faded');
  assert.doesNotMatch(ai[1]!, /opacity:1(?![\d.])/,
    'opacity:1 is inert now that the glyph never rests faded — promote it with colour instead');
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
  // the credential is about). buildShowcase moved to the shared renderer (M0b).
  const fnStart = RENDER_TS.indexOf('function buildShowcase(');
  assert.ok(fnStart > 0, 'packages/docs-render no longer declares buildShowcase()');
  const fn = RENDER_TS.slice(fnStart, RENDER_TS.indexOf('function buildFigure(', fnStart));
  assert.match(fn, /class="showcase-fallback"/);
  assert.match(fn, /renderCredential\(ctx\.credential\(show\.file\)/,
    'the showcase must carry the same credential line as any other shot');
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

// ── Anatomy (docs/shot-anatomy.ts) ───────────────────────────────────────────

test('the anatomy reader counts a real vector shot and never throws on a bad one', () => {
  const sample = readdirSync(SHOTS_DIR).find((f) => f.endsWith('.svg'))!;
  const a = readShotAnatomy(join(SHOTS_DIR, sample));
  assert.equal(a?.kind, 'vector');
  assert.ok(a!.elements > 1, `${sample} counted ${a!.elements} elements — the tag scan is broken`);
  assert.ok(a!.bytes > 0);
  assert.ok(a!.paths <= a!.elements, 'paths are elements; the counts cannot disagree that way');
  // Nothing here may be the reason a build fails: the credential is a garnish on a
  // page, and a missing or unreadable file is a fact to omit, not an exception.
  assert.equal(readShotAnatomy(join(SHOTS_DIR, 'no-such-shot.svg')), null);
  assert.equal(readShotAnatomy(SHOTS_DIR), null);
  const png = readdirSync(SHOTS_DIR).find((f) => f.endsWith('.png'));
  if (png) {
    const r = readShotAnatomy(join(SHOTS_DIR, png));
    // A raster must not report zero paths as if it had been measured for them.
    assert.equal(r?.kind, 'raster');
    assert.ok(r!.bytes > 0);
  }
});

test('the anatomy row lives inside the expanded line, and only when there is something to say', () => {
  // Inside .shot-cred-line — NOT between the button and the line. The reveal is
  // `.shot-cred-btn:hover + .shot-cred-line`, an adjacency, so anything emitted
  // between those two siblings stops every credential opening on hover.
  const html = renderCred();
  const line = /<span class="shot-cred-line"[^>]*>([\s\S]*)<\/span><\/span>$/.exec(html);
  assert.ok(line, 'the credential must still emit its .shot-cred-line');
  assert.match(line[1]!, /shot-cred-row shot-cred-anat/, 'the anatomy row belongs inside the line');
  // A shot whose file cannot be read for anatomy gets the line it had before — no anat row.
  assert.doesNotMatch(renderCred({ anat: null }), /shot-cred-anat/, 'no anatomy facts → no anatomy row');
  // The row is a second ROW, so the line stacks; a row that still declared nowrap on
  // the line itself would put the anatomy facts back on the end of the first one.
  const lineCss = /\n\.shot-cred-line\{([^}]*)\}/.exec(BUILD_TS);
  assert.ok(lineCss, 'expected the .shot-cred-line rule');
  assert.match(lineCss[1]!, /flex-direction:column/);
  assert.match(BUILD_TS, /\.shot-cred-row\{[^}]*flex-wrap:nowrap/,
    'each row keeps nowrap — the one-row rule was about wrapping, not about stacking');
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

test('nodes count anchor vertices per command, excluding control handles and Z', () => {
  const dir = mkdtempSync(join(tmpdir(), 'anat-nodes-'));
  try {
    // M(1) + two implicit L via one L command with 4 numbers(2) + C's single anchor(1)
    // + Z(0) = 4 nodes. A cubic contributes ONE node, never three: the handles are not
    // vertices. H/V take a single coordinate; the arc's radii and flags are not points.
    const f = join(dir, 'geo.svg');
    writeFileSync(f, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">'
      + '<path d="M0 0 L1 1 2 2 C3 3 4 4 5 5 Z"/>'                       // 1 + 2 + 1 = 4
      + '<path d="M0 0 H5 V5 A2 2 0 0 1 4 4"/>'                          // 1 + 1 + 1 + 1 = 4
      + '<polygon points="0,0 1,1 2,2"/>'                                // 3
      + '</svg>');
    const a = readShotAnatomy(f)!;
    assert.equal(a.nodes, 11, `M/L×2/C/Z + M/H/V/A + 3 poly = 11, got ${a.nodes}`);

    // `d=` inside `id="…"` must never be read as path data.
    const g = join(dir, 'idtrap.svg');
    writeFileSync(g, '<svg xmlns="http://www.w3.org/2000/svg" id="d-shaped" width="4" height="4">'
      + '<rect id="mid" width="4" height="4"/></svg>');
    assert.equal(readShotAnatomy(g)!.nodes, 0, 'no <path d>, so no nodes — id="…" is not path data');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an SVG that is only a wrapped bitmap is called a raster, not "0 paths" vector', () => {
  // The extension is not proof of vector. An .svg whose only drawing is one or more
  // embedded <image> and no <path> geometry is a bitmap in an SVG wrapper (a locale
  // shot embedding a JPEG); calling it vector and printing "0 paths" is the exact
  // dishonesty shot-anatomy exists to avoid. Written to a temp file so the test owns
  // its fixtures rather than depending on which shot happens to be shaped this way.
  const dir = mkdtempSync(join(tmpdir(), 'anat-'));
  try {
    const wrapper = join(dir, 'wrap.svg');
    writeFileSync(wrapper, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">'
      + '<image href="data:image/png;base64,AAAA" width="10" height="10"/></svg>');
    const w = readShotAnatomy(wrapper)!;
    assert.equal(w.kind, 'raster', 'no <path> + an <image> is a raster, whatever the extension');
    assert.equal(w.paths, 0);
    assert.equal(w.images, 1);

    // An SVG with real geometry AND an embedded bitmap stays vector, and the image is
    // counted so the credential can say "134 paths, 2 images" rather than hide them.
    const mixed = join(dir, 'mixed.svg');
    writeFileSync(mixed, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">'
      + '<path d="M0 0h10"/><image href="x" width="4" height="4"/></svg>');
    const m = readShotAnatomy(mixed)!;
    assert.equal(m.kind, 'vector');
    assert.equal(m.paths, 1);
    assert.equal(m.images, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the anatomy ROW never prints a zero count, and the dimension pill is not in it', () => {
  // A zero count never renders: "0 paths" would unmake the vector claim the pill makes.
  // With paths=0 and groups=0 the row falls back to the element count instead of a blank.
  const zeros = renderCred({ anat: { kind: 'vector', paths: 0, nodes: 0, groups: 0, images: 0, elements: 5, bytes: 2000 } });
  assert.doesNotMatch(zeros, /0 paths|0 groups|0 images|0 nodes/, 'a zero count must never render as a pill');
  assert.match(zeros, /5 elements/, 'a geometry-free vector still states its element count');
  // The recipe's capture viewport describes the REQUEST, not the file, and disagrees with the
  // shipped artwork on most shots — so it must not sit in the row of checkable file facts. It
  // belongs in the accessible label only.
  const html = renderCred();
  const anatRow = /<span class="shot-cred-row shot-cred-anat">(.*)<\/span><\/span><\/span>$/s.exec(html)?.[1] ?? '';
  assert.ok(anatRow.length > 0, 'expected a visible anatomy row for a real vector shot');
  assert.doesNotMatch(anatRow, /dpi|× 1/, 'the capture viewport must not be a visible fact pill');
  const label = /aria-label="([^"]*)"/.exec(html)?.[1] ?? '';
  assert.match(label, /@ 192 dpi/, 'the capture viewport (with dpi) belongs in the accessible label');
});

test('the credential glyph is bottom-anchored so the second row cannot move it', () => {
  // .shot-cred-line is opacity-0, never display:none, so it keeps its box in the flex
  // layout at rest. Centring the container against that box would shift the glyph
  // upward the moment a second row made the line taller. flex-end pins the glyph to
  // its corner regardless of the line's height.
  const cred = /\n\.shot-cred\{([^}]*)\}/.exec(BUILD_TS);
  assert.ok(cred, 'expected the .shot-cred rule');
  assert.match(cred[1]!, /align-items:flex-end/,
    'the credential container must bottom-align, not centre, or the anatomy row moves the resting glyph');
  assert.doesNotMatch(cred[1]!, /align-items:center/);
});

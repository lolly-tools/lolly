// SPDX-License-Identifier: MPL-2.0
/**
 * Banked docs art: the `MASTHEADS` override, the `::: figure <id>` fence, and the
 * credential line they both carry (plans/105 §6, docs/docs-art.ts + docs/build.ts).
 *
 * NO ART SHIPS YET — the bank directories are Andy's to fill (plan §11), and the
 * `MASTHEADS` table ships empty. So every behavioural test here builds its own
 * artifact: a tiny SVG, signed through the SAME writer the sign script uses
 * (embedC2pa + buildExportC2paOpts, surface 'docs', with a §18.28 ai-disclosure),
 * dropped into a temp bank, and read back through the real modules. That is the
 * whole point — the fixture is a real credentialed file, not a stub, so the
 * assertions below are about bytes rather than about strings we wrote twice.
 *
 * The three things that must never regress:
 *
 *  1. THE MANIFEST LEAVES THE INLINED COPY. A C2PA hash binding covers file bytes.
 *     An inlined copy that kept its manifest would fail validation the moment
 *     anyone saved it out of devtools — a FALSE NEGATIVE on a genuine Lolly asset,
 *     which is worse than no credential at all.
 *  2. THE SERVED FILE IS UNTOUCHED, and the credential line points at THAT file.
 *     Presentation copy ≠ verification copy: the page shows one, the credential
 *     describes the other, and they are two views of a single artifact.
 *  3. THE ID SPACE. An inlined SVG joins the page's id space; two artifacts with a
 *     `clip` id would silently render each other's drawings.
 *
 * Run directly: node --test tests/docs-figures.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { embedC2pa } from '../engine/src/c2pa.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { buildExportC2paOpts } from '../packages/node-shell/src/c2pa-opts.ts';
import {
  resolveDocsArt, inlineDocsArt, stripArtForInline, mastheadArtBand,
} from '../docs/docs-art.ts';
import { readShotProvenance } from '../docs/shot-provenance.ts';
// parseFigureFence + figureBlock moved to the shared renderer package (M0b).
import { unwrapFigureFences, parseFigureFence, figureBlock } from '../packages/docs-render/src/index.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const BUILD_TS = readFileSync(join(ROOT, 'docs/build.ts'), 'utf8');
// The body renderer (inline/mdToHtml/buildFigure) now lives here; some assertions that used
// to slice it out of build.ts now read the package source instead.
const RENDER_TS = readFileSync(join(ROOT, 'packages/docs-render/src/render.ts'), 'utf8');

const MODEL_NAME = 'Claude Fable 5';

/**
 * A minimal masthead-shaped artifact: a viewBox, one defs id, one `url(#…)` paint
 * reference and one `href="#…"` — the three references the namespacing rewrites,
 * so a regression in any of them is visible in one fixture.
 */
const ART_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40">
  <defs><linearGradient id="grad"><stop offset="0" stop-color="currentColor"/></linearGradient></defs>
  <rect id="plate" width="120" height="40" fill="url(#grad)"/>
  <use href="#plate" opacity="0.2"/>
</svg>
`;

/** Sign bytes the way scripts/sign-docs-art.ts signs a banked artifact. */
async function signArt(svg: string): Promise<Uint8Array> {
  return await embedC2pa(new TextEncoder().encode(svg), 'svg', buildExportC2paOpts({
    surface: 'docs',
    manifest: { id: 'docs-art', name: 'Docs art' },
    model: [] as unknown as Parameters<typeof buildExportC2paOpts>[0]['model'],
    format: 'svg',
    days: 365,
    // §18.28.3's own pairing: trainedAlgorithmicMedia + prompt_guided is "AI
    // generation guided by human prompts", which is exactly how this bank works.
    actions: [{ action: 'c2pa.created', digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia' }],
    aiDisclosure: { modelName: MODEL_NAME, oversight: 'prompt_guided' },
  }));
}

/** A temp docs dir with `mastheads/` + `figures/` holding one signed artifact each. */
async function bank(): Promise<{ dir: string; bytes: Uint8Array; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-docs-art-'));
  const bytes = await signArt(ART_SVG);
  for (const b of ['mastheads', 'figures']) {
    mkdirSync(join(dir, b), { recursive: true });
    writeFileSync(join(dir, b, b === 'mastheads' ? 'trust-hero.svg' : 'trust-chain.svg'), bytes);
  }
  return { dir, bytes, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// ── The strip: presentation copy ≠ verification copy ─────────────────────────

test('the inlined copy carries no manifest, and the served file still verifies', async () => {
  const { dir, bytes, cleanup } = await bank();
  try {
    const art = resolveDocsArt('mastheads', 'trust-hero', { dir })!;
    assert.ok(art, 'the banked artifact did not resolve');
    const inlined = inlineDocsArt(art);
    assert.ok('html' in inlined, `inline refused: ${'error' in inlined ? inlined.error : ''}`);

    // The FILE says it is signed…
    const onDisk = readFileSync(art.path, 'utf8');
    assert.match(onDisk, /<c2pa:manifest>/, 'the fixture is not actually signed');
    // …and the page copy says nothing of the kind. Asserted on the SHAPES a carrier
    // can take, not on the one this fixture happens to use.
    assert.doesNotMatch(inlined.html, /<metadata/i, 'the inlined copy kept the SVG manifest carrier');
    assert.doesNotMatch(inlined.html, /c2pa:manifest|-----BEGIN C2PA MANIFEST-----/,
      'the inlined copy kept a C2PA manifest — a saved copy of it would fail validation');
    assert.doesNotMatch(inlined.html, /<\?xml/, 'the XML prolog has no business inside an HTML document');

    // The served bytes are the record, and they are untouched by any of this.
    const report = await verifyC2pa(bytes);
    assert.equal(report.state, 'valid', 'the signed fixture does not verify — the fixture, or the writer, is broken');
    assert.equal(report.aiDisclosure?.modelName, MODEL_NAME, 'the engine reader disagrees with the docs reader about the model');
    assert.equal(readFileSync(art.path, 'utf8'), onDisk, 'inlining rewrote the banked file');
  } finally { cleanup(); }
});

test('every id the artifact defines is namespaced, references included', async () => {
  const { dir, cleanup } = await bank();
  try {
    const art = resolveDocsArt('figures', 'trust-chain', { dir })!;
    const inlined = inlineDocsArt(art) as { html: string };
    assert.match(inlined.html, /id="fig-trust-chain-grad"/, 'a defs id was left in the page id space');
    assert.match(inlined.html, /id="fig-trust-chain-plate"/);
    assert.match(inlined.html, /url\(#fig-trust-chain-grad\)/, 'a paint reference points at the un-namespaced id');
    assert.match(inlined.html, /href="#fig-trust-chain-plate"/, 'an href reference points at the un-namespaced id');
    // Nothing bare survives: an un-rewritten reference resolves to whatever else on
    // the page happens to own that id, which renders wrong rather than not at all.
    assert.doesNotMatch(inlined.html, /url\(#(?!fig-)/);
    assert.doesNotMatch(inlined.html, /\bid="(?!fig-)/);
    // The two banks namespace differently, so one page may carry both.
    const mast = inlineDocsArt(resolveDocsArt('mastheads', 'trust-hero', { dir })!) as { html: string };
    assert.match(mast.html, /id="mast-trust-hero-grad"/);
  } finally { cleanup(); }
});

test('a carrier the strip does not recognise REFUSES the inline rather than shipping it', () => {
  // The failure mode this guards is silent: a manifest shape neither rule catches
  // would ride onto the page and break its own credential wherever it was saved.
  // Refusing costs a page its art; shipping costs the credential its meaning.
  assert.throws(() => stripArtForInline('<svg><script type="application/c2pa">AAAA</script></svg>', 'x-'),
    /survived the strip/);
  // …and the ordinary shapes do not throw.
  assert.doesNotThrow(() => stripArtForInline('<svg viewBox="0 0 1 1"></svg>', 'x-'));
});

test('the armour profile is stripped whole-line, so an HTML fragment inlines clean', () => {
  const fragment = '<div class="art"><span id="a"></span></div>\n'
    + '<!-- -----BEGIN C2PA MANIFEST----- data:application/c2pa;base64,AAAA -----END C2PA MANIFEST----- -->\n';
  const out = stripArtForInline(fragment, 'fig-x-');
  assert.doesNotMatch(out, /C2PA MANIFEST/);
  assert.doesNotMatch(out, /<!--\s*-->/, 'the comment host was left behind as an empty comment');
  assert.match(out, /id="fig-x-a"/);
});

// ── Resolution: the same-file rule ───────────────────────────────────────────

test('a locale variant is resolved as its own artifact, path and URL together', async () => {
  const { dir, bytes, cleanup } = await bank();
  try {
    writeFileSync(join(dir, 'mastheads', 'trust-hero.de.svg'), bytes);
    const de = resolveDocsArt('mastheads', 'trust-hero', { dir, lang: 'de' })!;
    assert.equal(de.file, 'trust-hero.de.svg');
    assert.equal(de.src, '/info/mastheads/trust-hero.de.svg');
    assert.ok(de.path.endsWith('/mastheads/trust-hero.de.svg'),
      'the credential would be read from a different file than the one inlined');
    // A locale with no variant falls back to the base artifact — English fallback,
    // never a 404 and never a mixed pair.
    assert.equal(resolveDocsArt('mastheads', 'trust-hero', { dir, lang: 'fr' })!.file, 'trust-hero.svg');
    assert.equal(resolveDocsArt('mastheads', 'trust-hero', { dir, lang: 'en' })!.file, 'trust-hero.svg');
  } finally { cleanup(); }
});

test('an unknown id resolves to nothing, and an id is never a path', async () => {
  const { dir, cleanup } = await bank();
  try {
    assert.equal(resolveDocsArt('figures', 'not-banked', { dir }), null);
    // A bank lookup must not be able to walk out of its directory: the id is a
    // filename component, and anything that is not a plain slug is refused before
    // it reaches the filesystem.
    for (const bad of ['../mastheads/trust-hero', '/etc/passwd', 'a/b', 'Trust-Hero', '.hidden']) {
      assert.equal(resolveDocsArt('figures', bad, { dir }), null, `${bad} was accepted as an id`);
    }
  } finally { cleanup(); }
});

// ── The credential facts (docs/shot-provenance.ts) ───────────────────────────

test('the model pill reads the §18.28 disclosure out of the file itself', async () => {
  const { dir, cleanup } = await bank();
  try {
    const art = resolveDocsArt('mastheads', 'trust-hero', { dir })!;
    const p = readShotProvenance(art.path)!;
    assert.ok(p, 'the signed artifact reported no provenance at all');
    assert.equal(p.model, MODEL_NAME, 'the model name did not survive the round trip');
    assert.equal(p.oversight, 'prompt_guided', 'the human-oversight level was dropped');
    // The disclosure and the action are separate claims and both must land: one says
    // WHICH model, the other says a model was involved at all.
    assert.equal(p.ai, 'generated');
    assert.equal(p.surface, 'docs');
  } finally { cleanup(); }
});

test('a file with no disclosure reports no model — nothing is inferred', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-docs-art-'));
  try {
    mkdirSync(join(dir, 'figures'), { recursive: true });
    const plain = await embedC2pa(new TextEncoder().encode(ART_SVG), 'svg', buildExportC2paOpts({
      surface: 'docs',
      manifest: { id: 'docs-art', name: 'Docs art' },
      model: [] as unknown as Parameters<typeof buildExportC2paOpts>[0]['model'],
      format: 'svg',
    }));
    writeFileSync(join(dir, 'figures', 'hand-drawn.svg'), plain);
    const p = readShotProvenance(resolveDocsArt('figures', 'hand-drawn', { dir })!.path)!;
    assert.equal(p.model, null, 'a model was invented for a file that discloses none');
    assert.equal(p.oversight, null);
    assert.equal(p.ai, undefined, 'a hand-authored artifact must not be labelled AI');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── Composition ──────────────────────────────────────────────────────────────

test('the fence parses only its own label, and the id line is the whole label', () => {
  assert.equal(parseFigureFence('figure trust-chain'), 'trust-chain');
  assert.equal(parseFigureFence('  figure trust-chain  '), 'trust-chain');
  for (const other of ['figure', 'figures trust-chain', 'cols', 'showcase', 'timeline', 'figure a b']) {
    assert.equal(parseFigureFence(other), null, `${other} was parsed as a figure fence`);
  }
});

test('the masthead band keeps the h1 and hides the art from the accessibility tree', () => {
  const band = mastheadArtBand({ art: '<svg/>', heading: '<h1 id="trust">Trust</h1>', credential: '<span class="shot-cred"></span>' });
  assert.match(band, /<div class="docs-masthead docs-masthead--art">/);
  assert.match(band, /<div class="docs-mast-art" aria-hidden="true"><svg\/><\/div>/,
    'the art is decorative — the h1 is the page name, even when the artwork carries words');
  // The heading is passed through VERBATIM: its id is a published anchor (deep links,
  // the search index, bookmarks), and rebuilding it would rename every one of them.
  assert.match(band, /<div class="docs-mast-inner"><h1 id="trust">Trust<\/h1><\/div>/);
  assert.ok(band.indexOf('docs-mast-art') < band.indexOf('docs-mast-inner'), 'the art must paint behind the heading');
});

test('a figure is content: art, then a caption carrying the prose and the credential', () => {
  const fig = figureBlock({ art: '<svg/>', caption: '<p>How the chain nests.</p>', credential: '<span class="shot-cred"></span>', src: '/info/figures/x.svg' });
  assert.match(fig, /^<figure class="docs-figure" data-art="\/info\/figures\/x\.svg">/);
  assert.match(fig, /<figcaption><p>How the chain nests\.<\/p><span class="shot-cred">/);
  // No aria-hidden anywhere: a figure is part of the argument, not decoration.
  assert.doesNotMatch(fig, /aria-hidden/);
  // Nothing to say → no empty caption element promising a caption.
  assert.doesNotMatch(figureBlock({ art: '<svg/>', caption: '', credential: '', src: '/x' }), /figcaption/);
});

// ── End to end, against the real sign pipeline ───────────────────────────────

test('a bank signed by scripts/sign-docs-art.ts inlines clean, in both carriers', async (t) => {
  // The fixtures and the signer are B1's (tests/fixtures/docs-art/, plan §6 step 3);
  // the inline and the credential read are this lane's. Running them together is the
  // only place the SVG <metadata> carrier and the Lolly fragment ARMOUR carrier are
  // both proved to leave the page copy — the hand-rolled fixture above only covers
  // the first.
  const fixtures = join(ROOT, 'tests/fixtures/docs-art/ok');
  if (!existsSync(fixtures)) return;
  const { signDocsArt } = await import('../scripts/sign-docs-art.ts');
  const dir = mkdtempSync(join(tmpdir(), 'lolly-docs-art-e2e-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const b of ['mastheads', 'figures']) {
    mkdirSync(join(dir, b), { recursive: true });
    for (const f of readdirSync(join(fixtures, b))) copyFileSync(join(fixtures, b, f), join(dir, b, f));
  }
  await signDocsArt({ docsDir: dir, log: () => {} });

  for (const [b, id] of [['mastheads', 'test-band'], ['mastheads', 'test-fragment'], ['figures', 'test-page-chart']] as const) {
    const art = resolveDocsArt(b, id, { dir })!;
    assert.ok(art, `${b}/${id} did not resolve after signing`);
    const signed = readFileSync(art.path, 'utf8');
    assert.ok(/<c2pa:manifest>|BEGIN C2PA MANIFEST/.test(signed), `${id} was not signed by the pipeline`);
    const inlined = inlineDocsArt(art);
    assert.ok('html' in inlined, `${id} refused the inline: ${'error' in inlined ? inlined.error : ''}`);
    assert.doesNotMatch(inlined.html, /c2pa:manifest|C2PA MANIFEST|<metadata/i,
      `${id} carried its manifest onto the page`);
    // The armour is a whole comment line; removing it must not leave an orphan
    // comment host behind in the markup.
    assert.doesNotMatch(inlined.html, /<!--\s*-->/, `${id} left an empty comment where its armour was`);
    // The credential is readable from the same file, and names the model its meta
    // declared — the pill the band and the figcaption render.
    const p = readShotProvenance(art.path)!;
    assert.equal(p.model, 'Claude Opus 5', `${id} lost its model disclosure`);
    assert.ok(p.oversight, `${id} lost its human-oversight level`);
    assert.equal(p.ai, 'generated');
  }

  // A fragment's script survives the strip intact: it finds its own nodes relative to
  // document.currentScript, which is the convention that makes id namespacing safe.
  const frag = inlineDocsArt(resolveDocsArt('mastheads', 'test-fragment', { dir })!) as { html: string };
  assert.match(frag.html, /document\.currentScript/, 'the fragment lost the script it ships with');
  assert.match(frag.html, /prefers-reduced-motion/, 'the fragment lost its motion guard');
});

// ── The wiring in docs/build.ts ──────────────────────────────────────────────

test('the MASTHEADS table ships empty, and every entry it ever gains is banked', () => {
  const m = /const MASTHEADS: Record<string, string> = \{([\s\S]*?)\};/.exec(BUILD_TS);
  assert.ok(m, 'docs/build.ts no longer declares the MASTHEADS table');
  const entries = [...m[1]!.matchAll(/'([a-z0-9-]+)'\s*:\s*'([a-z0-9-]+)'/g)];
  // Empty today (plan §11: art is Andy's, never a subagent's). When it stops being
  // empty, each id must exist in the bank — a mapping with no file only warns at
  // build time, and a warning in a 27-locale log is a thing nobody sees.
  for (const [, slug, id] of entries) {
    const svg = join(ROOT, 'docs/mastheads', `${id}.svg`);
    const html = join(ROOT, 'docs/mastheads', `${id}.html`);
    assert.ok(existsSync(svg) || existsSync(html), `MASTHEADS['${slug}'] = '${id}' has no artifact in docs/mastheads/`);
  }
});

test('the build inlines through the shared fn and credits the file it inlined', () => {
  // The masthead band stays in build.ts (page-shell); it resolves through docs-art.ts and
  // credits art.file/art.src — the same-file rule (never the id resolved twice).
  const mastStart = BUILD_TS.indexOf('function mastheadArt(');
  assert.ok(mastStart > 0, 'docs/build.ts no longer declares mastheadArt()');
  const mast = BUILD_TS.slice(mastStart, BUILD_TS.indexOf('\nfunction ', mastStart + 1));
  assert.match(mast, /resolveDocsArt\(/, 'mastheadArt does not resolve through docs-art.ts');
  assert.match(mast, /inlineDocsArt\(art\)/, 'mastheadArt strips the artifact some other way');
  assert.match(mast, /path: art\.path, src: art\.src/, 'mastheadArt credits a file other than the one it inlined');
  assert.match(mast, /console\.warn/, 'mastheadArt fails silently on a missing artifact');
  // The figure builder moved into the shared renderer: it resolves through ctx.art (one
  // resolve, same file) and credits art.file with art.src — the same-file rule, preserved.
  const figStart = RENDER_TS.indexOf('function buildFigure(');
  assert.ok(figStart > 0, 'packages/docs-render no longer declares buildFigure()');
  const fig = RENDER_TS.slice(figStart, RENDER_TS.indexOf('export function mdToHtml', figStart));
  assert.match(fig, /ctx\.art\('figures', id\)/, 'buildFigure does not resolve through ctx.art');
  assert.match(fig, /ctx\.credential\(art\.file, \{ assetSrc: art\.src, art: true \}\)/,
    'buildFigure credits a file other than the one it inlined');
  assert.match(fig, /console\.warn/, 'buildFigure fails silently on a missing artifact');
  // …and mdToHtml still dispatches the ::: figure fence to it.
  assert.match(RENDER_TS, /\} else if \(parseFigureFence\(label\)\) \{/, 'mdToHtml no longer dispatches ::: figure');
  assert.match(BUILD_TS, /const mast = isLanding \? null : docsMasthead\(content, page\.slug\);/,
    'the masthead band no longer knows which page it is building, so MASTHEADS can never apply');
});

test('the runtime showcase and the build-time strip still agree on the rules', () => {
  // docs-art.ts's strip was promoted FROM this script (plan §6). The showcase keeps
  // its own copy because it runs in the browser, so the two can drift — and a drift
  // means the site strips a manifest one way on one block and another way on the
  // next. Both directions are pinned: the rules exist in the script, and the shared
  // fn genuinely performs them.
  const script = BUILD_TS.slice(BUILD_TS.indexOf('const SHOWCASE_SCRIPT'), BUILD_TS.indexOf('const SHOT_CRED_SCRIPT'));
  assert.ok(script.includes('text=text.replace(/<metadata>'), 'the showcase no longer strips the manifest');
  assert.ok(script.includes("'id=\"sc-$1\"'"), 'the showcase no longer namespaces inlined ids');
  const out = stripArtForInline('<?xml version="1.0"?><svg><metadata><c2pa:manifest>x</c2pa:manifest></metadata><rect id="a" fill="url(#a)"/></svg>', 'p-');
  assert.doesNotMatch(out, /metadata|<\?xml/);
  assert.match(out, /id="p-a"[^>]*fill="url\(#p-a\)"/);
});

test('the banked art is served, and only the art — the meta sidecar stays home', () => {
  const step = BUILD_TS.slice(BUILD_TS.indexOf("for (const bank of ['mastheads', 'figures'])"), BUILD_TS.indexOf('// Docs narration'));
  assert.ok(step.length > 100, 'docs/build.ts no longer copies the banked art into the site');
  assert.match(step, /\\\.\(svg\|html\)\$/, 'the copy step no longer filters to svg/html');
  assert.ok(!/meta\.json/.test(step.replace(/\/\/[^\n]*/g, '')),
    'the bank metadata sidecar must not be published — it is sign-time input');
  assert.match(step, /rmSync\(/, 'a withdrawn artifact would be served stale from the output dir');
  // The served copy is the file the credential describes. Anything that rewrote it on
  // the way out (minify, re-serialize, "just" a trailing newline) would break the hard
  // binding on the very file the page invites the reader to check.
  assert.match(step, /copyFileSync\(/, 'the banked art must be copied verbatim, never re-emitted');
});

test('the served bank is byte-identical to the bank', () => {
  // The whole promise of "Check it yourself" is that these two are the same bytes.
  const built = join(ROOT, 'shells/web/public/info');
  if (!existsSync(join(built, 'build-guide.html'))) return;   // no built /info on disk
  for (const b of ['mastheads', 'figures']) {
    const src = join(ROOT, 'docs', b);
    if (!existsSync(src)) continue;
    for (const f of readdirSync(src).filter(n => /\.(svg|html)$/.test(n))) {
      const out = join(built, b, f);
      assert.ok(existsSync(out), `/info/${b}/${f} was not published`);
      assert.deepEqual(readFileSync(out), readFileSync(join(src, f)), `/info/${b}/${f} differs from the signed bank file`);
    }
    // The sidecar is sign-time input and names a model; it is not part of the site.
    for (const f of readdirSync(src).filter(n => n.endsWith('.meta.json'))) {
      assert.ok(!existsSync(join(built, b, f)), `/info/${b}/${f} was published — the meta sidecar is not for the site`);
    }
  }
});

test('a figure degrades to its caption in the markdown twin', () => {
  // The unwrap now lives in @lolly-tools/docs-render (shared with the in-app docs
  // view), so test the real function behaviourally instead of string-slicing build.ts:
  // a `::: figure <id>` fence collapses to its caption prose, dropping the id.
  const twin = unwrapFigureFences('::: figure trust-chain\nThe caption reads as a sentence.\n:::\n');
  assert.equal(twin.trim(), 'The caption reads as a sentence.',
    'the twin no longer unwraps figure fences to their caption');
  // Applied, not merely defined: the twin pipeline in build.ts still runs the unwrap.
  assert.match(BUILD_TS, /unwrapFigureFences\(unwrapProvenanceMarkers\(/,
    'the twin pipeline does not run the figure unwrap');
});

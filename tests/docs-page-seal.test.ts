// SPDX-License-Identifier: MPL-2.0
/**
 * Page seals - the /info pages' own Content Credentials (plans/105 section 7, M5).
 *
 * Each English page carries one `<link rel="c2pa-manifest">` and is bound by an
 * external Manifest Store beside it (C2PA 2.4 section A.7.1.2 + section 11.4). Four things here
 * break silently, which is why each is pinned:
 *
 *  1. THE ORDERING. section A.7.1.3 hashes the WHOLE document, so the link must be in
 *     the bytes that were hashed and signing must be the last build step. Get it
 *     wrong and every page reports "this document was modified" - while looking
 *     perfect.
 *  2. THE CHURN RULE. Signatures differ on every signing (ECDSA nonce + a fresh
 *     timestamp), so a build that re-signs unconditionally rewrites 53 binary
 *     files for nothing. The guard here is the same question a second build asks:
 *     with the site as it stands, would anything be written? (Answer: no.)
 *  3. THE COMPONENT SET. A page's seal names the screenshots and banked art it
 *     references, as `c2pa.ingredient.v3` entries. A re-captured screenshot is
 *     re-signed under a new manifest label, so a page whose own bytes never moved
 *     can end up describing components that no longer exist - that must re-seal.
 *  4. ENGLISH ONLY, this wave. A locale page must carry NO seal link: linking a
 *     sidecar that does not exist is a failed check, and linking the English one
 *     is a hash mismatch.
 *
 * Built-artifact assertions skip when /info has not been built, exactly as
 * tests/docs-masthead.test.ts and tests/docs-logos.test.ts do. The hermetic half
 * (a temp site with one page and one real signed component) always runs, so the
 * churn rule and the drift rule are proved on every machine.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectPageIngredients, discoverSealTargets, pageComponentRefs, pageSealHref, pageSealLink,
  recordedComponentLabels, sealPages,
} from '../docs/page-seal.ts';
import { embedC2pa } from '../engine/src/c2pa-containers.ts';
import { prepareC2paIngredient } from '../engine/src/c2pa-extract.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { C2PA_CHECK } from '../engine/src/c2pa-verdict.ts';

const REPO = new URL('..', import.meta.url).pathname;
const BUILT = join(REPO, 'shells/web/public/info');

/** Skip reason, or false to run. Same shape the other docs suites use. */
const built = !existsSync(join(BUILT, 'exporting.html'))
  ? 'no built /info on disk - run `npm run build:info`'
  : !readFileSync(join(BUILT, 'exporting.html'), 'utf-8').includes('rel="c2pa-manifest"')
    ? 'built /info predates page seals - run `npm run build:info`'
    : false;

const bytesOf = (p: string): Uint8Array => new Uint8Array(readFileSync(p));

// ── The link element (section A.7.1.2) ──────────────────────────────────────────────

test('the seal link is the spec\'s external form, and the href is the sidecar beside the page', () => {
  const link = pageSealLink('exporting');
  // section A.7.1.2: "a link element with an attribute of rel="c2pa-manifest"… shall be
  // used to reference an external C2PA Manifest Store via its href attribute. The
  // type="application/c2pa" attribute should be included but is not required."
  assert.match(link, /^<link rel="c2pa-manifest" href="\/info\/exporting\.c2pa" type="application\/c2pa">$/);
  assert.equal(pageSealHref('exporting'), '/info/exporting.c2pa');
  // The href is a root-relative reference, not an absolute URL: the pages are
  // served from lolly.tools AND from a local dev server AND out of the offline
  // cache, and an absolute origin would be wrong in two of the three.
  assert.ok(!/https?:/.test(link));
});

test('every English page carries exactly one seal link, in <head>, pointing at its own slug', { skip: built }, () => {
  const pages = readdirSync(BUILT).filter((f) => f.endsWith('.html'));
  let sealed = 0;
  for (const file of pages) {
    const html = readFileSync(join(BUILT, file), 'utf-8');
    const hits = [...html.matchAll(/<link rel="c2pa-manifest"[^>]*>/g)];
    if (!hits.length) continue;    // redirect stubs are not sealed
    sealed++;
    // section A.7.1: "There shall be at most one C2PA Manifest Store association per
    // HTML document" - and the inlined banked art must never smuggle in a second.
    assert.equal(hits.length, 1, `${file} declares ${hits.length} C2PA manifest associations`);
    assert.ok(!/<script[^>]+type="application\/c2pa"/.test(html), `${file} carries an inline manifest as well as a link`);
    const slug = file.slice(0, -'.html'.length);
    assert.ok(hits[0]![0].includes(`href="${pageSealHref(slug)}"`), `${file} links a sidecar that is not its own`);
    const headEnd = html.indexOf('</head>');
    assert.ok(html.indexOf(hits[0]![0]) < headEnd, `${file}: the seal link is outside <head> (section A.7.1.1)`);
  }
  assert.ok(sealed > 40, `only ${sealed} pages carry a seal link`);
});

test('locale pages carry no seal link at all', { skip: built }, () => {
  // Deliberate, and the reason is honesty rather than scope: a locale page
  // pointing at a sidecar that does not exist reports "references an external
  // manifest… could not be checked" - a FAILURE row - and pointing it at the
  // English store would report a hash mismatch, i.e. "modified".
  const locales = readdirSync(BUILT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^[a-z]{2}(-[A-Za-z]+)?$/.test(e.name))
    .map((e) => e.name);
  assert.ok(locales.length > 20, 'expected the localized site on disk');
  for (const lang of locales) {
    for (const file of readdirSync(join(BUILT, lang)).filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(join(BUILT, lang, file), 'utf-8');
      assert.ok(!html.includes('c2pa-manifest'), `/${lang}/${file} carries a seal link`);
    }
  }
});

// ── The binding (section A.7.1.3) ───────────────────────────────────────────────────

test('a built page verifies against its sidecar, and one changed byte breaks it', { skip: built }, async () => {
  const page = bytesOf(join(BUILT, 'exporting.html'));
  const store = bytesOf(join(BUILT, 'exporting.c2pa'));
  const report = await verifyC2pa(page, { externalManifest: store });
  assert.equal(report.state, 'valid');
  assert.equal(report.format, 'html');
  assert.equal(report.madeWithLolly, true);
  assert.equal(report.textBinding?.kind, 'html');
  assert.equal(report.textBinding?.manifestUrl, '/info/exporting.c2pa');
  assert.equal(report.textBinding?.externalManifestUsed, true);
  assert.equal(report.specVersion, '2.4.0');
  assert.equal(report.environment?.artifact, 'docs-page');
  // Ephemeral self-signed key: untrusted is the honest verdict, and the ONLY
  // failed check. Anything else here is a real regression.
  assert.deepEqual(report.checks.filter((c) => !c.ok).map((c) => c.code), [C2PA_CHECK.signingCredentialUntrusted]);
  // section A.7.1.3: the hash covers the entire document, so a byte in the BODY - far
  // from the link element - has to break it.
  const tampered = new Uint8Array(page);
  tampered[page.length - 60] = (tampered[page.length - 60] ?? 0) ^ 0x01;
  const bad = await verifyC2pa(tampered, { externalManifest: store });
  assert.equal(bad.state, 'invalid');
  assert.ok(bad.checks.some((c) => c.code === C2PA_CHECK.assertionDataHashMismatch && !c.ok));
});

test('a page read WITHOUT its sidecar says the credential is elsewhere, never "no credential"', { skip: built }, async () => {
  // The M2 precondition: /verify must be able to tell a reader where to look,
  // rather than reporting an unsigned document (plan section 7).
  const report = await verifyC2pa(bytesOf(join(BUILT, 'exporting.html')));
  assert.equal(report.found, true);
  assert.match(report.reason ?? '', /references an external C2PA manifest at \/info\/exporting\.c2pa/);
  assert.ok(report.checks.some((c) => c.code === C2PA_CHECK.manifestInaccessible && !c.ok));
});

test('the seal names the page\'s signed components as ingredients', { skip: built }, () => {
  // A page with screenshots: its store must record exactly the manifests of the
  // files the page references, so the verifier's chain walk reaches them.
  const html = readFileSync(join(BUILT, 'exporting.html'), 'utf-8');
  const expected = collectPageIngredients(html, BUILT).map((i) => i.activeLabel);
  assert.ok(expected.length > 3, 'expected a page with several credentialed screenshots');
  const recorded = recordedComponentLabels(bytesOf(join(BUILT, 'exporting.c2pa')));
  assert.deepEqual([...(recorded ?? [])].sort(), [...expected].sort());
});

// ── The churn rule ───────────────────────────────────────────────────────────

test('a second build over an unchanged site writes no sidecar (the churn guard)', { skip: built }, async () => {
  // This is the double-build proof, asked of the real site without building it
  // twice: `check` runs the exact decision a build makes, per page, and reports
  // what it WOULD write. Anything in `wouldSign` is a sidecar the next build
  // rewrites for no reason - which is how 53 binary files start churning.
  const lines: string[] = [];
  const run = await sealPages({
    outDir: BUILT,
    targets: discoverSealTargets(BUILT),
    check: true,
    log: (l) => lines.push(l),
    warn: (l) => lines.push(l),
  });
  assert.deepEqual(run.wouldSign, [], `these pages would be re-signed by an unchanged rebuild: ${run.wouldSign.join(', ')}`);
  assert.deepEqual(run.failed, [], `seal failures: ${JSON.stringify(run.failed)}`);
  assert.deepEqual(run.signed, []);
  assert.ok(run.kept.length > 40, `only ${run.kept.length} pages hold a current seal`);
});

test('no sidecar is left behind by a page that no longer exists', { skip: built }, () => {
  const orphans = readdirSync(BUILT)
    .filter((f) => f.endsWith('.c2pa'))
    .filter((f) => !existsSync(join(BUILT, `${f.slice(0, -'.c2pa'.length)}.html`)));
  assert.deepEqual(orphans, []);
});

// ── Component references ─────────────────────────────────────────────────────

test('component refs come from attributes only - never from CSS or prose', () => {
  const html = [
    '<style>.docs-content img[src*="/info/shots/"]{border:0}</style>',
    '<p>The recipe writes /info/shots/not-referenced.svg into the bank.</p>',
    '<img src="/info/shots/a.svg" data-shot="/info/shots/a.svg" data-shot-dark="/info/shots/a.dark.svg">',
    '<a href="/info/shots/a.svg">get</a>',
    '<button data-copy-src="/info/mastheads/hero.svg"></button>',
    '<figure data-art="/info/figures/trust-chain.svg"><a href="/info/figures/trust-chain.svg">x</a></figure>',
  ].join('\n');
  assert.deepEqual(pageComponentRefs(html), [
    '/info/shots/a.svg',
    '/info/shots/a.dark.svg',
    '/info/mastheads/hero.svg',
    '/info/figures/trust-chain.svg',
  ]);
});

// ── The full cycle, hermetically ─────────────────────────────────────────────

const enc = new TextEncoder();
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

/** A miniature /info: one page, one signed component, one unsigned one. */
async function miniSite(): Promise<{ dir: string; page: string; write: (html: string) => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-page-seal-'));
  mkdirSync(join(dir, 'shots'), { recursive: true });
  writeFileSync(join(dir, 'shots', 'signed.svg'), await embedC2pa(enc.encode(SVG), 'svg', { title: 'A screenshot' }));
  writeFileSync(join(dir, 'shots', 'plain.svg'), SVG, 'utf-8');
  const page = join(dir, 'demo.html');
  const write = (html: string): void => writeFileSync(page, html, 'utf-8');
  write(pageHtml('body one'));
  return { dir, page, write };
}

const pageHtml = (body: string, extra = ''): string =>
  `<!doctype html>\n<html lang="en">\n<head>\n<title>Demo</title>\n${pageSealLink('demo')}\n</head>\n`
  + `<body><img src="/info/shots/signed.svg"><img src="/info/shots/plain.svg">${extra}<p>${body}</p></body>\n</html>\n`;

const targets = (dir: string) => [{ slug: 'demo', path: join(dir, 'demo.html'), title: 'Demo', source: 'docs/demo.md' }];
const quiet = { log: () => {}, warn: () => {} };

test('sign → verify → re-run: the second pass keeps the sidecar byte-identical', async (t) => {
  const { dir, page } = await miniSite();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sidecar = join(dir, 'demo.c2pa');

  const first = await sealPages({ outDir: dir, targets: targets(dir), ...quiet });
  assert.deepEqual(first.signed, ['demo']);
  assert.ok(existsSync(sidecar));

  const report = await verifyC2pa(bytesOf(page), { externalManifest: bytesOf(sidecar) });
  assert.equal(report.state, 'valid');
  // The signed component travels in; the unsigned one is not claimed (there is
  // nothing to claim - an ingredient with no manifest would be an assertion
  // about a file we cannot show anyone).
  assert.deepEqual(recordedComponentLabels(bytesOf(sidecar)), [prepareC2paIngredient(bytesOf(join(dir, 'shots', 'signed.svg')))!.activeLabel]);
  assert.equal(report.history?.some((s) => s.action === 'c2pa.opened'), true);

  const before = readFileSync(sidecar);
  const second = await sealPages({ outDir: dir, targets: targets(dir), ...quiet });
  assert.deepEqual(second.signed, []);
  assert.deepEqual(second.kept, ['demo']);
  assert.deepEqual(readFileSync(sidecar), before, 'an unchanged page re-signed itself');
});

test('an edited page is re-sealed; an edited COMPONENT re-seals it too', async (t) => {
  const { dir, page, write } = await miniSite();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sidecar = join(dir, 'demo.c2pa');
  await sealPages({ outDir: dir, targets: targets(dir), ...quiet });
  const first = readFileSync(sidecar);

  write(pageHtml('body two'));
  const edited = await sealPages({ outDir: dir, targets: targets(dir), ...quiet });
  assert.deepEqual(edited.signed, ['demo']);
  assert.notDeepEqual(readFileSync(sidecar), first);
  assert.equal((await verifyC2pa(bytesOf(page), { externalManifest: bytesOf(sidecar) })).state, 'valid');

  // The half a page hash cannot see: the page is untouched, but the screenshot
  // it names was re-captured and re-signed, so the seal's ingredient list is
  // describing a manifest nobody serves any more.
  const pageBytes = readFileSync(page);
  const sealBytes = readFileSync(sidecar);
  writeFileSync(join(dir, 'shots', 'signed.svg'), await embedC2pa(enc.encode(SVG), 'svg', { title: 'A screenshot' }));
  const drifted = await sealPages({ outDir: dir, targets: targets(dir), ...quiet });
  assert.deepEqual(drifted.signed, ['demo'], 'a re-signed component left the page seal stale');
  assert.deepEqual(readFileSync(page), pageBytes, 'the page itself must not be rewritten');
  assert.notDeepEqual(readFileSync(sidecar), sealBytes);
  assert.deepEqual(recordedComponentLabels(bytesOf(sidecar)), [prepareC2paIngredient(bytesOf(join(dir, 'shots', 'signed.svg')))!.activeLabel]);
});

test('check mode decides exactly what a real run would do, and writes nothing', async (t) => {
  const { dir, write } = await miniSite();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dry = await sealPages({ outDir: dir, targets: targets(dir), check: true, ...quiet });
  assert.deepEqual(dry.wouldSign, ['demo']);
  assert.equal(existsSync(join(dir, 'demo.c2pa')), false, 'check mode wrote a sidecar');

  await sealPages({ outDir: dir, targets: targets(dir), ...quiet });
  assert.deepEqual((await sealPages({ outDir: dir, targets: targets(dir), check: true, ...quiet })).wouldSign, []);
  write(pageHtml('changed'));
  assert.deepEqual((await sealPages({ outDir: dir, targets: targets(dir), check: true, ...quiet })).wouldSign, ['demo']);
});

test('a page that does not reference its sidecar is never signed', async (t) => {
  const { dir, write } = await miniSite();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // section A.7.1.3's ordering rule as a check: a store written beside a page that does
  // not point at it is a credential nobody can find from the asset, and a link
  // added after the hash would bind bytes that no longer exist.
  write('<!doctype html>\n<html lang="en"><head><title>Demo</title></head><body><p>no seal link</p></body></html>\n');
  const run = await sealPages({ outDir: dir, targets: targets(dir), ...quiet });
  assert.deepEqual(run.signed, []);
  assert.equal(run.failed.length, 1);
  assert.match(run.failed[0]!.reason, /carries no <link rel="c2pa-manifest"/);
  assert.equal(existsSync(join(dir, 'demo.c2pa')), false);
});

test('a sidecar whose page is gone is removed, and only in a real run', async (t) => {
  const { dir } = await miniSite();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await sealPages({ outDir: dir, targets: targets(dir), ...quiet });
  writeFileSync(join(dir, 'retired.c2pa'), new Uint8Array([1, 2, 3]));

  const dry = await sealPages({ outDir: dir, targets: targets(dir), check: true, ...quiet });
  assert.deepEqual(dry.removed, ['retired.c2pa']);
  assert.ok(existsSync(join(dir, 'retired.c2pa')), 'check mode deleted a file');

  const real = await sealPages({ outDir: dir, targets: targets(dir), ...quiet });
  assert.deepEqual(real.removed, ['retired.c2pa']);
  assert.equal(existsSync(join(dir, 'retired.c2pa')), false);
  assert.ok(existsSync(join(dir, 'demo.c2pa')), 'a live page lost its seal');
});

test('a corrupt sidecar is replaced rather than trusted', async (t) => {
  const { dir, page } = await miniSite();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await sealPages({ outDir: dir, targets: targets(dir), ...quiet });
  writeFileSync(join(dir, 'demo.c2pa'), new Uint8Array([0, 0, 0, 8, 0x6a, 0x75, 0x6d, 0x62]));
  const run = await sealPages({ outDir: dir, targets: targets(dir), ...quiet });
  assert.deepEqual(run.signed, ['demo']);
  assert.equal((await verifyC2pa(bytesOf(page), { externalManifest: bytesOf(join(dir, 'demo.c2pa')) })).state, 'valid');
});

test('discoverSealTargets finds the pages that claim a seal, and no others', async (t) => {
  const { dir } = await miniSite();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'stub.html'), '<!doctype html><html><head><meta http-equiv="refresh" content="0; url=/info/demo.html"></head><body></body></html>', 'utf-8');
  // A page linking someone ELSE's sidecar is not a sealed page: the slug and the
  // href have to agree, or the build would sign bytes into a file the page never
  // points at.
  writeFileSync(join(dir, 'wrong.html'), `<!doctype html><html><head>${pageSealLink('demo')}</head><body></body></html>`, 'utf-8');
  assert.deepEqual(discoverSealTargets(dir).map((t2) => t2.slug), ['demo']);
});

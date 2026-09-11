// SPDX-License-Identifier: MPL-2.0
/**
 * In-app documentation reader (views/docs.ts) - the fragment-rehost mount path.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/docs.test.ts
 *
 * docs.ts imports a CSS module (../styles/parts/docs.css), so the run MUST use the
 * --import ./tests/css-stub.mjs hook or Node throws ERR_UNKNOWN_FILE_EXTENSION.
 *
 * What is covered: the reader fetches the built /info page, extracts its .docs-content,
 * rehosts the children into a fresh <article> inside [data-content], strips script +
 * .listen-bar while keeping <style>, rewrites internal doc links toward #/docs, fills the
 * pathways / sidebar / sitemap / TOC nav slots, honours a ?h= deep link, and renders a
 * .docs-status message on a 404 or a fetch throw.
 *
 * Plus LANDING MODE (plans/123): slug 'index' fetches the real /info/index.html instead of
 * the old quickstart alias, rehosts its `.docs-landing` body, drops the rails, hydrates the
 * audience tabs without touching location.hash, opens a deep-linked FAQ <details>, points
 * the app links back into this SPA, and injects the scoped band stylesheet once.
 *
 * routeLang is always passed as 'de' (a non-English locale) so the English-only narration
 * block in mountDocs is skipped - that block reaches into the app-global audio dock, which
 * is out of scope for a hermetic reader test. With lang 'de' the fetch URL becomes
 * /info/de/<slug>.html, which the URL assertions check.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';

// jsdom's CSS parser predates @scope, so appending the landing stylesheet raises a
// "Could not parse CSS stylesheet" jsdomError that dumps the whole sheet into the test
// log. Nothing here reads computed style (jsdom applies no layout anyway), so that one
// error is swallowed and every other page error still prints.
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (err: Error) => {
  if (!/Could not parse CSS stylesheet/.test(err.message)) process.stderr.write(`[jsdom] ${err.message}\n`);
});

// jsdom globals pinned onto globalThis BEFORE the dynamic import of the module under test -
// docs.ts and its import graph expect a browser realm (DOMParser, CSS.escape, localStorage).
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://lolly.tools/#/docs/quickstart',
  pretendToBeVisual: true,
  virtualConsole,
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
// jsdom does not ship window.CSS, so provide the one member docs.ts uses (CSS.escape in
// scrollToHeading). A minimal identifier escaper is enough for the plain heading ids here.
globalThis.CSS = (dom.window as unknown as { CSS?: typeof CSS }).CSS ?? ({
  escape: (s: string) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
} as unknown as typeof CSS);
globalThis.localStorage = dom.window.localStorage; // currentTheme() reads localStorage
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;

const { mountDocs } = await import('./docs.ts');

// A minimal host - the reader only touches host.profile when the theme toggle is clicked,
// which no test does, so a get/set pair of no-ops is enough.
const host = {
  profile: { get: async () => ({}), set: async () => {} },
} as unknown as Parameters<typeof mountDocs>[1];

// A full /info page: a .docs-content main with headings, a script + .listen-bar + style to
// exercise sanitisation, and internal doc links to exercise link rewriting - plus the nav
// landmarks (pathways / sidebar / sitemap) that live OUTSIDE .docs-content.
const PAGE_HTML = `<!doctype html><html><head><title>Quickstart - Lolly</title></head>
<body>
  <nav class="nav-group">
    <a href="/info/for-creators.html">For Creators</a>
    <a class="active" href="/info/for-builders.html">For Builders</a>
  </nav>
  <aside class="docs-sidebar">
    <a href="/info/quickstart.html">Quickstart</a>
    <a href="/info/reference.html">Reference</a>
  </aside>
  <main class="docs-content page-quickstart">
    <h1 id="top">Quickstart</h1>
    <p>Intro paragraph with an <a href="/info/quickstart.html">internal link</a> and a
      deeper <a href="/info/reference.html#config">anchored link</a>.</p>
    <style>.cmp-fig{--cmp-a:1}</style>
    <div class="listen-bar">Listen player that must be stripped</div>
    <script>window.__docsShouldNeverRun = true;</script>
    <h2 id="one">Section One</h2>
    <p>Body one.</p>
    <h2 id="two">Section Two</h2>
    <p>Body two.</p>
    <h2 id="some-id">Deep Section</h2>
    <p>Body deep.</p>
  </main>
  <footer class="footer-sitemap">
    <a href="/info/quickstart.html">Quickstart</a>
  </footer>
</body></html>`;

/**
 * The built LANDING page, shaped like the real /info/de/index.html: a `.docs-landing`
 * <main> (never a `.docs-content`), the site-sentence <title>, the floating listen bar,
 * the app links in both built forms (`/?lang=de` for the app root, `/?lang=de#/tool/…`
 * for a seeded tool), the sticky quicknav, the audience jump pills over stacked
 * always-open cards (plan 123 D1), and an FAQ <details>. It ships no `.docs-sidebar`,
 * exactly as the real landing does.
 *
 * Two headings carry ids the real landing does not stamp: with them the "no TOC in
 * landing mode" assertion has teeth (the same two headings fill the TOC on a doc page).
 */
const LANDING_HTML = `<!doctype html><html>
<head><title>Lolly Tools</title></head>
<body>
  <nav class="nav-group">
    <a href="/info/creators.html">For Creators</a>
    <a href="/info/builders.html">For Builders</a>
  </nav>
  <main class="docs-landing page-index"><style>.listen-bar{display:flex}</style>
    <div class="listen-bar listen-bar-float"><button class="docs-listen">Listen</button></div>
    <section class="hero reveal">
      <a href="/?lang=de" class="hero-logo-link" aria-label="Open Lolly"><img src="/info/icon.svg" alt=""></a>
      <a href="/?lang=de" class="btn btn-primary">Launch App</a>
      <a href="/info/quickstart.html" class="btn">Read the quickstart</a>
    </section>
    <nav class="quicknav" aria-label="On this page">
      <div class="quicknav-inner"><a href="#make">Make something</a><a href="#faq">FAQ</a></div>
    </nav>
    <section class="make-section" id="make">
      <h2 id="make-heading">Make something, right now</h2>
      <a class="make-card" href="/?lang=de#/tool/qr-code?url=https%3A%2F%2Flolly.tools&amp;color=%231a1a2e">QR code</a>
      <a class="make-card" href="/#/u">All the utilities</a>
    </section>
    <section class="audience-section">
      <h2 id="audience-heading">Who is it for?</h2>
      <input class="aud-radio" type="radio" name="audience" id="aud-anyone" checked>
      <input class="aud-radio" type="radio" name="audience" id="aud-press">
      <div class="audience-tabs">
        <label class="audience-tab" for="aud-anyone">Anyone</label>
        <label class="audience-tab" for="aud-press">Press</label>
      </div>
      <div class="audience-panels">
        <div class="audience-card" id="anyone">Everyday jobs.</div>
        <div class="audience-card" id="press">Press kits.</div>
      </div>
      <div class="machines-band">
        <div class="machine-card machine-card--agents" id="ai">Always open, never radio-gated.</div>
      </div>
    </section>
    <section class="faq-section" id="faq">
      <details class="faq-item" id="faq-opt-in"><summary>What happens when I opt in?</summary>
        <div class="faq-a">Nothing leaves the device.</div>
      </details>
    </section>
  </main>
  <footer><div class="footer-sitemap"><a href="/info/index.html">What?</a></div></footer>
</body></html>`;

/** A fresh, DOCUMENT-CONNECTED mount element. mountDocs bails after fetch when the view is
 *  not connected (viewEl.isConnected), so every mount target must be appended to the body. */
function freshView(): HTMLElement {
  const el = document.createElement('main');
  el.id = 'view';
  document.body.appendChild(el);
  return el;
}

let fetchUrls: string[] = [];

/** Stub fetch to serve PAGE_HTML for every request. All URLs are recorded (mountDocs fetches
 *  the page; the fire-and-forget Try-it hydration fetches a manifest), so assertions check
 *  membership rather than the single last URL. `json` returns {} so the manifest hydration is
 *  a clean no-op. */
function stubOkFetch(html = PAGE_HTML): void {
  fetchUrls = [];
  globalThis.fetch = (async (u: unknown) => {
    fetchUrls.push(String(u));
    return { ok: true, text: async () => html, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

test('mounts the .docs-content fragment into a fresh article inside [data-content]', async () => {
  stubOkFetch();
  const view = freshView();

  await mountDocs(view, host, 'quickstart', 'de', '');

  // Non-English route => the localized fetch URL.
  assert.ok(
    fetchUrls.includes('/info/de/quickstart.html'),
    `fetched the de-localized page (saw ${JSON.stringify(fetchUrls)})`,
  );

  const article = view.querySelector('[data-content] article.docs-content');
  assert.ok(article, 'a fresh <article class="docs-content ..."> is mounted in the content column');
  // The rehosted class list is kept from the imported fragment.
  assert.ok(article!.classList.contains('page-quickstart'), 'the page-<slug> class rides across');
  // The fragment content came with it.
  assert.ok(article!.querySelector('#one'), 'a heading from the fragment is present');
  assert.ok(article!.textContent?.includes('Body one.'), 'fragment prose is present');
  // No second <main> landmark was introduced (the fragment main became an article).
  assert.equal(article!.querySelector('main'), null, 'the fragment main is rehosted, not nested');

  view.remove();
});

test('strips script and .listen-bar from the fragment but keeps <style>', async () => {
  stubOkFetch();
  const view = freshView();

  await mountDocs(view, host, 'quickstart', 'de', '');

  const article = view.querySelector('[data-content] article.docs-content')!;
  assert.equal(article.querySelector('script'), null, 'fetched scripts are removed');
  assert.equal(article.querySelector('.listen-bar'), null, 'the listen bar is removed');
  assert.ok(article.querySelector('style'), 'an inner <style> block survives (figure-local tokens)');

  view.remove();
});

test('rewrites internal /info doc links toward the in-app #/docs reader', async () => {
  stubOkFetch();
  const view = freshView();

  await mountDocs(view, host, 'quickstart', 'de', '');

  const article = view.querySelector('[data-content] article.docs-content')!;
  // /info/quickstart.html -> #/docs/quickstart (rewriteDocLinks + toReaderHref).
  assert.ok(
    article.querySelector('a[href="#/docs/quickstart"]'),
    'a plain internal doc link is rewritten to the reader route',
  );
  // /info/reference.html#config -> #/docs/reference?h=config (the anchor rides as ?h=).
  assert.ok(
    article.querySelector('a[href="#/docs/reference?h=config"]'),
    'an anchored internal doc link carries its anchor as ?h=',
  );

  view.remove();
});

test('fills the pathways, sidebar, sitemap and TOC nav slots', async () => {
  stubOkFetch();
  const view = freshView();

  await mountDocs(view, host, 'quickstart', 'de', '');

  const pathways = view.querySelector<HTMLElement>('[data-pathways]')!;
  assert.equal(pathways.hidden, false, 'the pathways slot is shown once filled');
  assert.ok(pathways.querySelector('.docs-pathways'), 'the pathways bar was built from .nav-group');

  const sidebar = view.querySelector<HTMLElement>('[data-sidebar]')!;
  assert.equal(sidebar.hidden, false, 'the sidebar slot is shown once filled');
  assert.ok(sidebar.querySelector('.docs-sidebar'), 'the docs sidebar rail was adopted');

  const sitemap = view.querySelector<HTMLElement>('[data-sitemap]')!;
  assert.equal(sitemap.hidden, false, 'the sitemap slot is shown once filled');
  assert.ok(sitemap.querySelector('.footer-sitemap'), 'the footer sitemap was adopted');

  // The TOC is DERIVED from the rehosted content's h2[id] set (three sections here).
  const toc = view.querySelector<HTMLElement>('[data-toc]')!;
  assert.equal(toc.hidden, false, 'the TOC slot is shown once the content has >= 2 h2 sections');
  const tocLinks = toc.querySelectorAll('.docs-toc a[data-toc-target]');
  assert.equal(tocLinks.length, 3, 'one TOC entry per stamped h2 heading');

  view.remove();
});

test('the pathway strip carries the AI-scan donut linking to verify for this page', async () => {
  stubOkFetch();
  const view = freshView();

  await mountDocs(view, host, 'quickstart', 'de', '');

  // Queried by class, href read via getAttribute: nwsapi cannot match an attribute
  // selector whose quoted value carries the '%' of an encoded path.
  const donut = view.querySelector<HTMLAnchorElement>('.docs-pathways a.docs-tsig-donut');
  assert.ok(donut, 'the donut sits inside the pathway strip');
  assert.equal(
    donut!.getAttribute('href'),
    `#/verify?src=${encodeURIComponent('/info/de/quickstart.html')}&check=1`,
    'pressing it opens the verify report for the exact served page, credential auto-checked',
  );
  const svg = donut!.querySelector('svg[data-band]');
  assert.ok(svg, 'the ring carries the analyser band for the CSS colour');
  const score = Number(donut!.querySelector('.docs-tsig-num')?.textContent);
  assert.ok(Number.isInteger(score) && score >= 0 && score <= 100, 'the score inside the ring is a 0-100 integer');
  assert.ok(/Signal score/.test(donut!.getAttribute('aria-label') || ''), 'the link names the score for readers');
  assert.equal(
    donut!.getAttribute('data-tip'),
    donut!.getAttribute('aria-label'),
    'the styled tooltip carries the same text as the aria-label (tooltip.css contract)',
  );

  view.remove();
});

test('a ?h=<id> deep link mounts cleanly when the heading exists', async () => {
  stubOkFetch();
  const view = freshView();

  // scrollIntoView has no layout in jsdom and is wrapped in try/catch; the mount must not throw.
  await mountDocs(view, host, 'quickstart', 'de', 'h=some-id');

  const article = view.querySelector('[data-content] article.docs-content');
  assert.ok(article, 'the page still mounts with a deep-link heading param');
  assert.ok(article!.querySelector('#some-id'), 'the deep-link target heading is present in the DOM');

  view.remove();
});

// ── Landing mode (#/docs/index, plans/123) ───────────────────────────────────

test('slug index fetches the real landing page, not the old quickstart alias', async () => {
  stubOkFetch(LANDING_HTML);
  const view = freshView();

  await mountDocs(view, host, 'index', 'de', '');

  assert.ok(fetchUrls.includes('/info/de/index.html'), `fetched the landing (saw ${JSON.stringify(fetchUrls)})`);
  assert.ok(
    !fetchUrls.some((u) => u.includes('quickstart')),
    'the index -> quickstart alias is gone',
  );

  const article = view.querySelector<HTMLElement>('[data-content] article.docs-landing');
  assert.ok(article, 'the .docs-landing body is rehosted into an <article>');
  assert.ok(article!.classList.contains('page-index'), 'the page-index class rides across');
  assert.equal(article!.classList.contains('docs-content'), false, 'the landing is NOT a .docs-content');
  assert.ok(article!.querySelector('.hero'), 'the hero band came with it');
  assert.equal(article!.querySelector('script'), null, 'fetched scripts are still stripped');
  assert.equal(article!.querySelector('.listen-bar'), null, 'the listen bar is still stripped');

  const reader = view.querySelector<HTMLElement>('[data-reader]')!;
  assert.ok(reader.classList.contains('docs-reader--landing'), 'the reader carries the landing modifier');

  // The landing <title> is the site sentence; the reader keeps its own tab title.
  assert.ok(/Documentation/.test(document.title), `kept the reader title (saw ${document.title})`);
  assert.ok(!/stay the same/.test(document.title), 'did not adopt the marketing sentence as the tab title');

  view.remove();
});

test('landing mode drops the sidebar and TOC rails but keeps pathways + sitemap', async () => {
  stubOkFetch(LANDING_HTML);
  const view = freshView();

  await mountDocs(view, host, 'index', 'de', '');

  // The landing ships no .docs-sidebar, so the slot has nothing to fill.
  assert.equal(view.querySelector<HTMLElement>('[data-sidebar]')!.hidden, true, 'the sidebar slot stays hidden');
  // Two stamped h2 ids are present: on a doc page they would build a TOC.
  assert.equal(view.querySelector<HTMLElement>('[data-toc]')!.hidden, true, 'no TOC is derived in landing mode');
  assert.equal(view.querySelector('[data-toc] .docs-toc'), null, 'the TOC slot is empty, not merely hidden');

  const pathways = view.querySelector<HTMLElement>('[data-pathways]')!;
  assert.equal(pathways.hidden, false, 'the pathways bar still fills from .nav-group');
  const sitemap = view.querySelector<HTMLElement>('[data-sitemap]')!;
  assert.equal(sitemap.hidden, false, 'the footer sitemap still fills');
  assert.ok(
    sitemap.querySelector('a[href="#/docs/index"]'),
    'the sitemap "What?" link now routes to the in-app landing rather than the app root',
  );

  view.remove();
});

test('landing app links are rewritten to in-SPA routes (Launch App opens the tools gallery, #/)', async () => {
  stubOkFetch(LANDING_HTML);
  const view = freshView();

  await mountDocs(view, host, 'index', 'de', '');

  const article = view.querySelector<HTMLElement>('[data-content] article.docs-landing')!;
  assert.equal(
    article.querySelectorAll('a[href="#/"]').length, 2,
    'both app-root links (hero mark + Launch App CTA) point at the tools gallery, the main view - not the dashboard (Andy, 2026-09-03)',
  );
  assert.equal(article.querySelector('a[href^="/?lang=de"]'), null, 'no locale-root link survives');
  // Read the seeded links by class: nwsapi (jsdom's selector engine) does not match an
  // attribute selector whose quoted value carries the '?'/'%'/'&' of a real tool link.
  const seeded = article.querySelectorAll<HTMLAnchorElement>('.make-card');
  assert.equal(
    seeded[0]!.getAttribute('href'),
    '#/tool/qr-code?url=https%3A%2F%2Flolly.tools&color=%231a1a2e',
    'a seeded tool link keeps its params and stays in the SPA',
  );
  assert.equal(seeded[1]!.getAttribute('href'), '#/u', 'a bare app route drops the leading slash');
  // The doc links on the landing keep going through the reader rewriter.
  assert.ok(article.querySelector('a[href="#/docs/quickstart"]'), 'internal doc links still route to the reader');

  view.remove();
});

test('the audience tabs are CSS-only radios: a pill click checks its radio, never the route', async () => {
  stubOkFetch(LANDING_HTML);
  const view = freshView();

  await mountDocs(view, host, 'index', 'de', '');

  // Plan 123 D1 final form: hidden radio siblings + <label> pills; visibility is the
  // stylesheet's `:checked ~ .audience-panels` pairing, so the rehosted fragment needs
  // no hydration at all - the markup below is what must survive the rehost intact.
  const article = view.querySelector<HTMLElement>('[data-content] article.docs-landing')!;
  const radios = article.querySelectorAll<HTMLInputElement>('input.aud-radio');
  const pills = article.querySelectorAll<HTMLLabelElement>('label.audience-tab');
  assert.equal(radios.length, 2, 'the radio group survives the rehost');
  assert.equal(radios[0]!.checked, true, 'the first tab opens checked');
  assert.equal(pills[1]!.htmlFor, radios[1]!.id, 'each pill labels its radio');
  assert.equal(article.querySelector('[aria-selected]'), null, 'no scripted tab state anywhere');

  const hashBefore = window.location.hash;
  pills[1]!.click();
  assert.equal(radios[1]!.checked, true, 'a pill click checks its radio (native label activation)');
  assert.equal(radios[0]!.checked, false, 'the radio group is exclusive');
  assert.equal(window.location.hash, hashBefore, 'a pill click never writes location.hash (that IS the route)');

  view.remove();
});

test('a ?h= FAQ id opens the <details> before the scroll', async () => {
  stubOkFetch(LANDING_HTML);
  const view = freshView();
  await mountDocs(view, host, 'index', 'de', 'h=faq-opt-in');

  const article = view.querySelector<HTMLElement>('[data-content] article.docs-landing')!;
  const faq = article.querySelector<HTMLDetailsElement>('#faq-opt-in')!;
  assert.equal(faq.open, true, 'a deep-linked FAQ item is opened before the scroll');

  view.remove();
});

test('the scoped landing stylesheet is injected exactly once, with the reveal neutralizer', async () => {
  stubOkFetch(LANDING_HTML);
  const view = freshView();
  await mountDocs(view, host, 'index', 'de', '');
  view.remove();

  const view2 = freshView();
  stubOkFetch(LANDING_HTML);
  await mountDocs(view2, host, 'index', 'de', '');
  view2.remove();

  const tags = document.head.querySelectorAll('style[data-docs-landing]');
  assert.equal(tags.length, 1, 'the <style> is a module singleton across mounts');
  const css = tags[0]!.textContent || '';
  assert.ok(css.includes('@scope (.docs-landing)'), 'the band CSS is wrapped in @scope so it cannot reach the shell');
  assert.ok(
    /\.docs-reader--landing \.reveal[\s\S]*opacity: 1/.test(css),
    'the scroll-reveal neutralizer is present (the observer script is stripped, so bands would be invisible)',
  );
  assert.ok(css.includes('.docs-reader--landing .quicknav'), 'the in-fragment quicknav is hidden in landing mode');
});

test('a non-ok response renders a .docs-status message and mounts no article', async () => {
  fetchUrls = [];
  globalThis.fetch = (async (u: unknown) => {
    fetchUrls.push(String(u));
    return { ok: false, text: async () => '', json: async () => ({}) };
  }) as unknown as typeof fetch;
  const view = freshView();

  await mountDocs(view, host, 'missing-page', 'de', '');

  assert.ok(view.querySelector('.docs-status'), 'a not-found status message is shown');
  assert.equal(view.querySelector('article.docs-content'), null, 'no fragment article is mounted');

  view.remove();
});

test('a fetch throw renders the connection-error .docs-status message', async () => {
  fetchUrls = [];
  globalThis.fetch = (async (u: unknown) => {
    fetchUrls.push(String(u));
    throw new Error('net down');
  }) as unknown as typeof fetch;
  const view = freshView();

  await mountDocs(view, host, 'quickstart', 'de', '');

  const status = view.querySelector('.docs-status');
  assert.ok(status, 'a connection-error status message is shown');
  assert.ok(
    /connection|Could not load/i.test(status!.textContent || ''),
    'the message names the connection failure',
  );
  assert.equal(view.querySelector('article.docs-content'), null, 'no fragment article is mounted');

  view.remove();
});

// ── Hero CTA ink (2026-09-03) ────────────────────────────────────────────────
import { inkFor, fitHeroCtaInk } from '../lib/docs-landing.ts';

test('the hero primary button takes the ink that reads on its painted fill', () => {
  // Bright fills take black, dark fills take white; the crossover is where the two
  // WCAG ratios are equal, so the chosen ink is always the better of the two.
  assert.equal(inkFor('rgb(48, 186, 120)'), '#000', 'SUSE green: black (8.6:1 vs 2.4:1)');
  assert.equal(inkFor('rgb(228, 46, 255)'), '#000', 'a bright magenta: black');
  assert.equal(inkFor('rgb(26, 26, 26)'), '#fff', 'the starter\'s ink: white');
  assert.equal(inkFor('rgb(12, 50, 44)'), '#fff', 'SUSE Pine: white');
  assert.equal(inkFor('rgba(0, 0, 0, 0)'), null, 'a transparent fill is not a fill');
  assert.equal(inkFor(''), null, 'jsdom\'s empty computed style leaves the stylesheet fallback');
  assert.equal(inkFor('oklch(67% 0.3 322)'), null, 'an unparsed syntax is left alone rather than guessed');

  const root = document.createElement('div');
  root.innerHTML = '<div class="hero-cta"><a class="btn btn-primary" href="#/">Launch App</a></div>';
  document.body.appendChild(root);
  const btn = root.querySelector<HTMLElement>('.btn-primary')!;
  const realGcs = globalThis.getComputedStyle;
  try {
    (globalThis as { getComputedStyle: typeof getComputedStyle }).getComputedStyle = ((el: Element) =>
      el === btn ? ({ backgroundColor: 'rgb(26, 26, 26)' } as CSSStyleDeclaration) : realGcs(el)) as typeof getComputedStyle;
    fitHeroCtaInk(root);
    assert.equal(btn.style.getPropertyValue('--hero-cta-ink'), '#fff', 'a dark brand fill gets a white label');
  } finally {
    (globalThis as { getComputedStyle: typeof getComputedStyle }).getComputedStyle = realGcs;
    root.remove();
  }
});

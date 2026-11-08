// SPDX-License-Identifier: MPL-2.0
/**
 * In-app documentation reader (#/docs/<slug>) - plan "this-is-a-very-sparkling-eich".
 * The page narration it offered (Listen) was removed on 2026-10-08.
 *
 * This brings the /info docs INTO the app so they render inside #view and inherit the
 * ACTIVE brand's design tokens (unlike the published static site, which is neutral for
 * anonymous/SEO). It is a routed utility view like #/ask or the Colour Lab: the shared
 * back pill, a home + theme cluster, and its own scroll.
 *
 * CONTENT SOURCE - "fragment rehost" (the plan's recommended path). Rather than
 * client-rendering markdown (which would need localized `.md` twins the build doesn't
 * yet emit), it fetches the built per-locale page `/info/<lang>/<slug>.html` (English is
 * unprefixed, `/info/<slug>.html` - exactly docsHref/docsInfoHref), extracts the tested
 * `.docs-content` fragment with DOMParser (or `.docs-landing` on the front door, see
 * LANDING MODE below and lib/docs-landing.ts), and injects it into #view. That reuses the
 * exact static-build output, works for all 27 locales for free, shows the committed
 * neutral signed screenshots as <img>, and picks up the active brand purely via CSS
 * (styles/parts/docs.css's scoped legacy-var bridge → the app's brand-reactive slots).
 *
 * Deliberately NOT carried across from the fetched page:
 *   - <script> nodes (never execute a fetched page's scripts). A figure's own scoped
 *     <style> is kept (see the sanitise step below); the reader's styling lives in docs.css.
 *   - the `.docs-edition-bar` (the print edition's PDF link, a static-site download),
 *     and `.listen-bar`, its old name on /info pages cached before 2026-10-08.
 *   - the masthead / nav / sidebar / footer (all live OUTSIDE `.docs-content`, so the
 *     fragment naturally excludes them). Theme/brand-reactive mastheads are M3.
 *
 * LANDING MODE (#/docs/index, plans/123). The /info front door is a docs page like any
 * other now: `slug === 'index'` fetches /info/index.html, rehosts its `.docs-landing`
 * body, and adds `docs-reader--landing` to the reader shell (one full-width column, no
 * sidebar, no table of contents). What the landing needs beyond a plain rehost - the
 * scoped band stylesheet, the scroll-reveal neutralizer, the in-SPA link rewrites -
 * lives in lib/docs-landing.ts. This view used to alias 'index' to the Quickstart
 * page, because the landing shipped no rehostable fragment.
 */
// The chrome both readers share (the round top-row button, the pathways strip, the
// compact navigation lists), ahead of docs.css so the reader's own placement wins.
import { updateRouteParams } from '../lib/url-state.ts';
import '../styles/parts/docs-chrome.css';
import '../styles/parts/docs.css';
import '../styles/parts/docs-components.css';
import { escape, safeHref } from '../utils.ts';
import { t, tRaw, currentLang, normalizeLang, docsHref, docsInfoHref, type Lang } from '../i18n.ts';
import { armViewEnter } from '../view-enter.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { docsOrigin, type PrevView } from '../lib/back-nav.ts';
import { enhanceDocsContents } from '../lib/docs-contents.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { contentsRailHtml, pageBarHtml, hasContents, type ContentsHeading } from '../../../../packages/docs-render/src/contents.ts';
import { viewTopbarHtml, mountViewTopbar } from '../components/view-topbar.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { hydrateDocsTryIt } from '../lib/docs-tryit.ts';
import { icon } from '../lib/icons.ts';
import { createScope } from '../lib/dispose.ts';
import { enhanceDocsReading } from '../lib/docs-enhance.ts';
import { enhanceDocsLightbox, LIGHTBOX_ICON_NAMES, type DocsLightboxIcons, type DocsLightboxLabels } from '../lib/docs-lightbox.ts';
import { registerOverlay } from '../lib/overlay-back.ts';
import { enhancePathwaysStrip, revealCurrentPage } from '../lib/docs-strip.ts';
import { docsClipboardWriter, docsCopyLabels } from '../lib/docs-clipboard.ts';
import { enhanceDocsFormats } from '../lib/docs-formats.ts';
import { ensureLandingStyles, adaptLandingLinks, hydrateLandingCycle, hydrateLandingCovers, hydrateLandingAgentCopy, fitHeroCtaInk } from '../lib/docs-landing.ts';
import {
  rewriteDocLinks,
  extractSidebar,
  extractSitemap,
  extractContactFooter,
  extractPathways,
} from '../lib/docs-nav.ts';
// The fetch, stub-follow, fragment lookup, rehost and heading scroll are shared
// with the specification browser (#/document-model) - see lib/docs-rehost.ts.
import { fetchDocHtml, findDocFragment, rehostFragment, scrollToHeading } from '../lib/docs-rehost.ts';
import { analyzeTextSignals } from '../../../../engine/src/text-signals.ts';
import { extractHtmlText } from './doc-read.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

/** The reader drives the theme toggle + home fab; HostV1 covers both. */
type DocsHost = HostV1;

/** The chrome + navigation shell the fragment (or a status message) drops into.
 *  `inner` seeds the content column; the pathways / sidebar / TOC / sitemap slots
 *  start empty + hidden and are filled from the fetched page once it parses (each a
 *  graceful no-op if that page lacks the landmark). The scaffold is fixed class markup
 *  + component HTML + t() labels only - no free/user text reaches this sink.
 *
 *  `origin` is the app view these docs were opened from (lib/back-nav.ts docsOrigin):
 *  the back pill shows that view's name and returns there, however many pages were
 *  read in between.
 *  The top row is the app's own (plan 354): the four tabs, so Tools is one press away,
 *  and the avatar menu with theme, language, Home and Settings. None of the tabs is
 *  current, because reading the docs is none of them.
 *  The ground is the quiet band the top row sits on once the page has moved, so the
 *  text never runs under the pills (docs.css .docs-top-ground). */
function shellHtml(inner: string, origin: PrevView | null, firstname?: string): string {
  return `
    ${backHomeHtml(origin ? { href: origin.href, label: origin.label } : {})}
    <div class="docs-top-ground" aria-hidden="true"></div>
    ${viewTopbarHtml({ active: null, profile: { firstname } })}
    <div class="docs-reader" data-reader>
      <div class="docs-pathways-slot" data-pathways hidden></div>
      <div class="docs-reader-grid">
        <div class="docs-sidebar-slot" data-sidebar hidden></div>
        <div class="docs-content-col" data-content>${inner}</div>
        <div class="docs-toc-slot" data-toc hidden></div>
      </div>
      <div class="docs-sitemap-slot" data-sitemap hidden></div>
      <div class="docs-contact-slot" data-contact hidden></div>
    </div>`;
}

export async function mountDocs(
  viewEl: HTMLElement,
  host: DocsHost,
  slug: string,
  routeLang: string | null,
  params: string,
): Promise<void> {
  // Explicit route lang (#/docs/<lang>/<slug>) beats a ?lang= override beats the app's
  // current locale - the fetched page must match whatever language the app is showing.
  const lang: Lang =
    normalizeLang(routeLang) ?? normalizeLang(new URLSearchParams(params).get('lang')) ?? currentLang();

  // Deep link: a spotlight/Ask result, a rewritten in-page anchor, or a doc link whose
  // '#heading' was carried across as ?h= (a second '#' cannot ride a hash route).
  const deepLink = new URLSearchParams(params).get('h');

  // LANDING MODE (plans/123): #/docs/index is the front door, not a doc page. The built
  // /info landing marks its body `.docs-landing` rather than `.docs-content`, and the
  // reader answers with its own modifier class - one full-width column, no sidebar, no
  // table of contents, plus the band CSS and tab hydration lib/docs-landing.ts owns.
  const isLanding = slug === 'index';

  document.title = tRaw('{name} - Lolly', { name: t('Documentation') });

  // Paint the chrome + a pending state immediately, then swap in the body once fetched.
  // The profile is a quick local read, taken first so the avatar pill opens with its
  // name, as in the gallery.
  const origin = docsOrigin();
  const profile = await host.profile.get().catch(() => null);
  viewEl.innerHTML = shellHtml(`<p class="docs-status">${t('Loading…')}</p>`, origin, profile?.firstname);
  mountBackPill(viewEl);
  mountHomeFab(viewEl);
  mountViewTopbar(viewEl, host, { headshotId: profile?.headshot?.id });
  // One scope owns everything this mount sets up, and the view's cleanup disposes it at
  // once, even while the fetch is still in flight. #view persists across routes, so a
  // mount that loses that race checks scope.disposed after each await and stops before
  // it can write into the next view.
  const scope = createScope();
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => scope.dispose();
  if (isLanding) {
    // Both before the fetch, so the loading state already sits in the landing's own
    // single-column shell and the band CSS is parsed by the time the fragment lands.
    viewEl.querySelector('[data-reader]')?.classList.add('docs-reader--landing');
    ensureLandingStyles();
  } else {
    // Full-width reading toggle (Andy, 2026-08-17): the 52rem-based measure is right
    // for prose and wrong for the big reference tables (threat-model, the credentials
    // engineering matrix). Device-local for now - the same first home the gallery's
    // hide-previews toggle had before it earned a profile field; migrate it the same
    // way if it sticks. The landing gets no toggle: it is already full-bleed.
    const WIDE_KEY = 'lolly-docs-wide';
    const readerEl = viewEl.querySelector<HTMLElement>('[data-reader]');
    const wideBtn = document.createElement('button');
    wideBtn.type = 'button';
    // In the top row's cluster, in its own button shape (the gallery's view-options
    // button). Hidden at phone widths (docs.css): the reader is already full-bleed there.
    wideBtn.className = 'filter-fab docs-wide-fab';
    wideBtn.setAttribute('aria-label', t('Use the full window width'));
    wideBtn.title = t('Use the full window width');
    wideBtn.innerHTML = icon('full-width');
    const applyWide = (on: boolean): void => {
      readerEl?.classList.toggle('docs-reader--wide', on);
      wideBtn.setAttribute('aria-pressed', String(on));
    };
    applyWide(localStorage.getItem(WIDE_KEY) === '1');
    wideBtn.addEventListener('click', () => {
      const on = !readerEl?.classList.contains('docs-reader--wide');
      applyWide(on);
      try { localStorage.setItem(WIDE_KEY, on ? '1' : '0'); } catch { /* private mode */ }
    });
    viewEl.querySelector('.gallery-topright')?.prepend(wideBtn);
  }

  const contentEl = viewEl.querySelector<HTMLElement>('[data-content]')!;
  const url = docsInfoHref(slug, lang);

  const showStatus = (message: string, extra = ''): void => {
    contentEl.innerHTML = `<p class="docs-status">${escape(message)}${extra}</p>`;
  };
  // The static-page escape hatch every failure branch below appends: the page in the
  // reader's language, which is the first-party /info/ path above, or the same page on
  // lolly.tools when this build leaves that language out (route-constrained slug either
  // way). The gate keeps the scheme to https or a path if the construction ever changes.
  const staticPage = docsHref(slug, lang);
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in the guard above
  const openDocsLink = safeHref(staticPage) ? ` <a href="${escape(staticPage)}" target="_blank" rel="noopener">${t('Open the docs')}</a>` : '';

  // A build may ship English-only docs - the mobile app prunes the locale page
  // trees from its embed for size (shells/tauri-mobile build:frontend). The
  // English page is the fallback rather than a dead end; the reader chrome stays
  // localized, matching the shots pipeline's English-fallback rule. A flat
  // pre-177 URL serves a meta-refresh stub pointing at the page's doored home,
  // which fetchDocHtml follows once, in place, so old in-app links and bookmarked
  // #/docs routes keep resolving.
  const fetched = await fetchDocHtml({
    urls: [url, docsInfoHref(slug, 'en')],
    fetch: (input, init) => fetch(input, init),
    alive: () => !scope.disposed,
  });
  if (!fetched.ok) {
    // An unmounted view says nothing; a 404 and a dead connection each get their
    // own message, plus the static page as an escape hatch.
    if (fetched.reason === 'abandoned') return;
    showStatus(
      fetched.reason === 'missing'
        ? t('That documentation page could not be found.')
        : t('Could not load the documentation. Check your connection and try again.'),
      openDocsLink,
    );
    return;
  }
  const html = fetched.html;
  if (scope.disposed) return;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Two extraction markers: `.docs-content` on every doc page, `.docs-landing` on the
  // front door. The landing is kept out of `.docs-content` on purpose (see
  // lib/docs-landing.ts); everything below treats the two the same way.
  const fragment = findDocFragment(doc);
  // An immersive page (What we stand for) is built in the landing's shape - full-bleed
  // bands, no rail - and marks its <main> `.docs-landing.docs-immersive`. It is not the
  // front door, so it keeps its own title and link handling, but it takes the landing
  // shell: one full-width column, no table of contents, the scoped band stylesheet.
  const isImmersive = !!fragment?.classList.contains('docs-immersive');
  if (isImmersive) {
    viewEl.querySelector('[data-reader]')?.classList.add('docs-reader--landing');
    ensureLandingStyles();
  }
  if (!fragment) {
    showStatus(
      t('That documentation page could not be displayed.'),
      openDocsLink,
    );
    return;
  }

  // Title from the fetched page (falls back to the slug) - for the tab and history entry.
  // The landing keeps the reader's own "Documentation" title: its <title> is the bare
  // site name, which the suffix strip cannot shorten and which says nothing useful
  // in a tab strip.
  const pageTitle = (doc.querySelector('title')?.textContent || '').replace(/\s*[--]\s*Lolly\s*$/, '').trim();
  if (pageTitle && !isLanding) document.title = tRaw('{name} - Lolly', { name: pageTitle });

  // The formats page's detail-dialog data rides in an inert `<script type=
  // "application/json">`, which the rehost below strips with every other script -
  // so read it out FIRST and hand it to the enhancer after mount (the reader's
  // "no fetched scripts survive" invariant stays intact). Null on any other page.
  const fmtCatalogRaw = fragment.querySelector('#fmt-catalog-data')?.textContent ?? null;

  // Sanitise: never run a fetched page's scripts, and drop the print-edition bar (a
  // static-site download). KEEP <style>: the only style nodes inside `.docs-content` are a figure's
  // OWN scoped block (e.g. `.cmp-fig` for the comparison matrix) - the page-global CSS lives
  // in <head>, which we never extract. Those blocks also DEFINE the figure's local tokens
  // (`--cmp-*`), so stripping them left figures unstyled and their headings mashed. This is
  // our own trusted, brand-scoped build output, not arbitrary fetched markup.
  //
  // Then adopt the fragment into this document and mount it. `.docs-content` is a <main>
  // in the built page, but #view is ALREADY <main id="view"> - a nested/second <main> is
  // an invalid, duplicate landmark - so rehostFragment puts its guts in an <article>
  // (valid inside <main>, and the right role for a doc page), keeping the
  // `docs-content page-<slug>` classes so docs.css applies. Internal doc links are
  // rewritten to the in-app reader first, so navigation stays in the SPA.
  // `.docs-strip-band` is the pathways strip a band-less page (the landing, an immersive
  // page) carries in its body; the reader shows that strip in its own slot instead. The
  // strip is adopted first, because the rehost removes the band from the parsed page.
  // `.listen-bar` is the print edition's bar under its old name: /info pages the service
  // worker cached before 2026-10-08 still use it, so their PDF chip must go as well.
  const pathwaysStrip = extractPathways(doc);
  const node = rehostFragment(fragment, { strip: 'script, .docs-edition-bar, .listen-bar, .docs-strip-band', rewriteLinks: rewriteDocLinks });

  // THE PAGE TITLE. `docsMasthead` (docs/build.ts) lifts each page's <h1> out of the
  // article and into a full-width band that is a SIBLING of `.docs-wrap` - so it sits
  // outside `.docs-content`, and this reader, which extracts `.docs-content` and
  // nothing else, opened every page on its first paragraph with no title on it. The
  // static page has one; the in-app page should read the same.
  //
  // Taken from the built band rather than from <title>, so it is the same words, the
  // same markup and the same locale the static page shows. `.docs-masthead` is the
  // default chip-canvas band and a banked masthead uses its own wrapper, so the h1 is
  // found by walking the page for one OUTSIDE the fragment. The landing and immersive
  // pages keep their own designed opening and are skipped.
  if (!isLanding && !isImmersive && !node.querySelector('h1')) {
    const bandTitle = [...doc.querySelectorAll('h1')].find((h) => !fragment.contains(h));
    if (bandTitle) {
      const h1 = document.importNode(bandTitle, true) as HTMLElement;
      // The band's own decoration (canvas, credential line) stays behind; this is the
      // heading alone, styled by docs.css like any other h1 in the article.
      h1.classList.add('docs-page-title');
      node.prepend(h1);
      // The section label the built band carries over its title (docs/build.ts
      // pageWayfinding), from the same place: the reader shows the section as /info does.
      const eyebrow = [...doc.querySelectorAll('.docs-eyebrow')].find((e) => !fragment.contains(e));
      if (eyebrow) node.prepend(document.importNode(eyebrow, true));
    }
  }

  // Copy on code blocks and its feedback (lib/docs-enhance.ts), bound before the article
  // is shown and released with the view. The writer confirms only a real clipboard write.
  scope.add(enhanceDocsReading(node, { writeText: docsClipboardWriter(host), labels: docsCopyLabels(), copyIcon: icon('clipboard') }));

  // The app's "Skip to content" moves focus here, past the top row, the sections and the rail.
  node.setAttribute('data-skip-target', '');
  contentEl.replaceChildren(node);

  // The picture viewer (lib/docs-lightbox.ts, the module /info runs too), bound once the
  // article is in the document so each picture's on-screen twin can be read. System Back
  // closes it through the shell's one overlay stack, like every dialog in the app.
  scope.add(enhanceDocsLightbox(node, {
    labels: docsLightboxLabels(),
    icons: Object.fromEntries(Object.entries(LIGHTBOX_ICON_NAMES).map(([k, name]) => [k, icon(name)])) as unknown as DocsLightboxIcons,
    back: (dismiss) => {
      const entry = registerOverlay({
        nav: () => { entry.disown(); dismiss(); },
        pop: () => { entry.disown(); dismiss(); },
      });
      return () => entry.release();
    },
  }));

  // Scrolling a heading into view within #view is lib/docs-rehost.ts's
  // scrollToHeading: it opens every closed <details> above the target first (the
  // landing's FAQ is a list of `details.faq-item`, and the static page runs its own
  // opener script for the same reason) and answers whether the heading is there, so a
  // click handler can preventDefault only when it will act.
  //
  // In-page anchors (`#heading-id`) must NOT set location.hash - that IS the SPA route,
  // so a bare `#foo` would navigate away. Intercept plain clicks and scroll within #view.
  const onAnchorClick = (e: MouseEvent): void => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    const raw = a.getAttribute('href') || '';
    if (!raw.startsWith('#') || raw.startsWith('#/')) return; // leave real routes alone
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
    if (!scrollToHeading(node, decodeURIComponent(raw.slice(1)), 'smooth')) return;
    e.preventDefault();
    updateRouteParams({ h: decodeURIComponent(raw.slice(1)) });
  };
  scope.listen(node, 'click', onAnchorClick as EventListener);

  // A section link to the page already open (from search or Ask) changes only the query,
  // and the router keeps a reader mounted for the same page, so scroll to the section here.
  const currentHash = (): string => globalThis.location?.hash ?? '';
  const mountedPath = currentHash().split('?')[0];
  scope.listen(window, 'hashchange', () => {
    const [path, query = ''] = currentHash().split('?');
    if (path !== mountedPath) return;
    const h = new URLSearchParams(query).get('h');
    if (h) scrollToHeading(node, h, 'smooth');
  });

  // ── Navigation: cross-doc (pathways / sidebar / footer sitemap) + in-page (TOC) ──
  // The fetched page's real nav lives OUTSIDE .docs-content, so the reader used to throw
  // it away and strand you on one page. Pull each landmark out of `doc` and fill its slot
  // (links already rewritten to #/docs/… by the extractors); the TOC is DERIVED from the
  // rehosted content's stamped heading ids. Every fill is a graceful no-op when absent.
  const fillSlot = (sel: string, el: HTMLElement | null): void => {
    if (!el) return;
    const slot = viewEl.querySelector<HTMLElement>(sel);
    if (!slot) return;
    slot.replaceChildren(el);
    slot.hidden = false;
  };
  fillSlot('[data-pathways]', pathwaysStrip);
  // The fetched page's own language and direction for everything rehosted from it (the
  // strip, the rails, the article): #/docs/ar/… reads right to left even when the app's
  // own language does not.
  const readerEl = viewEl.querySelector<HTMLElement>('[data-reader]');
  const fetchedDir = doc.documentElement.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
  readerEl?.setAttribute('dir', fetchedDir);
  const fetchedLang = doc.documentElement.getAttribute('lang');
  if (fetchedLang) readerEl?.setAttribute('lang', fetchedLang);
  // On a phone the strip keeps one line and scrolls, as on /info: fade the edges
  // with tabs beyond them and bring the current section into view (lib/docs-strip.ts).
  const strip = viewEl.querySelector<HTMLElement>('.docs-pathways');
  if (strip) scope.add(enhancePathwaysStrip(strip));

  // Check this page (Andy, 2026-08-21; moved 2026-11-06): the page's own text-signal
  // score, pressing through to the full verify report for this served page (its C2PA
  // seal and the text-signal panel). It used to sit at the end of the section strip on
  // every page, an unlabelled number above the article; it now closes the article as a
  // labelled line. extractHtmlText is the SAME extraction verify runs on an HTML file
  // (raw markup detects as docKind 'code' and gates every prose tell off), fed the same
  // fetched bytes, so this number and the report's hero gauge agree.
  {
    const scan = analyzeTextSignals(extractHtmlText(html), { source: 'digital' });
    const n = Math.max(0, Math.min(100, Math.round(scan.score)));
    const circ = 2 * Math.PI * 26;
    const check = document.createElement('a');
    check.className = 'docs-page-check';
    // `check=1`: the press IS the ask, so verify resolves the page's same-origin
    // credential reference without a second "Fetch and check" click.
    check.setAttribute('href', `#/verify?src=${encodeURIComponent(url)}&check=1`);
    // Numeric-only interpolation (score + the analyser's closed band union) plus two
    // t() labels set as text below - no free text reaches innerHTML.
    check.innerHTML =
      `<svg viewBox="0 0 64 64" data-band="${escape(scan.band)}" aria-hidden="true">`
      + '<circle class="docs-tsig-track" cx="32" cy="32" r="26"/>'
      + `<circle class="docs-tsig-fill" cx="32" cy="32" r="26" stroke-dasharray="${((n / 100) * circ).toFixed(2)} ${circ.toFixed(2)}"/>`
      + `<text class="docs-tsig-num" x="32" y="40">${n}</text>`
      + '</svg><span class="docs-page-check-label"></span><span class="docs-page-check-score"></span>';
    check.querySelector('.docs-page-check-label')!.textContent = t('Check this page');
    check.querySelector('.docs-page-check-score')!.textContent = tRaw('Signal score {n} of 100', { n });
    contentEl.append(check);
  }
  fillSlot('[data-sidebar]', extractSidebar(doc));
  // The rail scrolls on its own (docs.css), so its current page is brought into view there.
  const sideSlot = viewEl.querySelector<HTMLElement>('[data-sidebar]');
  if (sideSlot && !sideSlot.hidden) requestAnimationFrame(() => revealCurrentPage(sideSlot));
  fillSlot('[data-sitemap]', extractSitemap(doc));
  // The founded-by-SUSE badge + "Questions? Contact fitzy@suse.com" line from the built
  // page's footer - the sitemap already rode up in its own slot just above; this brings
  // the rest of that footer with it so the reader isn't missing the site's contact.
  fillSlot('[data-contact]', extractContactFooter(doc));

  // ── The page's contents and the page bar (packages/docs-render contents.ts) ──────
  // The same two forms /info has: the rail beside the article from 1100px, and below
  // that the page bar ("Create v Export a file"), whose one sheet holds the sections,
  // this page's headings and this section's pages (docs.css decides which shows). Both
  // mark the section being read (lib/docs-contents.ts). The landing and an immersive
  // page are bands rather than sections, and the landing's own quicknav already jumps
  // between them, so they get neither.
  const headings: ContentsHeading[] = (isLanding || isImmersive) ? [] : [...node.querySelectorAll<HTMLElement>('h2[id], h3[id]')]
    .map((h) => ({ id: h.id, text: (h.textContent || '').replace(/\s+/g, ' ').trim(), level: h.tagName === 'H3' ? 3 as const : 2 as const }))
    .filter((h) => h.text);
  if (!isLanding && !isImmersive) {
    const labels = { title: t('On this page') };
    if (hasContents(headings)) {
      const tocSlot = viewEl.querySelector<HTMLElement>('[data-toc]');
      // The builder escapes every heading text and id; the label is a t() string.
      if (tocSlot) { tocSlot.innerHTML = contentsRailHtml(headings, labels); tocSlot.hidden = false; }
    }
    // The sections and the section's pages are copies of our own build's strip and rail:
    // their links are already rewritten to #/docs/... and the current ones marked.
    const stripLinks = [...viewEl.querySelectorAll<HTMLAnchorElement>('[data-pathways] .docs-pathway')];
    const sectionName = viewEl.querySelector('[data-pathways] .docs-pathway.active')?.textContent?.trim() || t('Docs');
    const pageTitle = node.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const holder = document.createElement('div');
    holder.innerHTML = pageBarHtml({
      section: sectionName,
      page: pageTitle,
      headings,
      labels: { ...labels, sections: t('Documentation sections') },
      sectionsHtml: '',
      pages: null,
      chevron: icon('chevronRight'),
    });
    const bar = holder.firstElementChild as HTMLElement | null;
    if (bar) {
      bar.querySelector('.doc-sheet-sections')?.append(...stripLinks.map((a) => a.cloneNode(true)));
      const rail = viewEl.querySelector<HTMLElement>('[data-sidebar] > .docs-sidebar');
      if (rail) {
        const copy = rail.cloneNode(true) as HTMLElement;
        const title = copy.querySelector('.sidebar-pathway')?.textContent?.trim() || t('Documentation');
        copy.querySelector('.sidebar-pathway')?.remove();
        const list = document.createElement('div');
        list.className = 'docs-compact-list';
        list.append(...Array.from(copy.childNodes));
        const group = document.createElement('nav');
        group.className = 'doc-sheet-group';
        group.setAttribute('aria-label', title);
        const head = document.createElement('p');
        head.className = 'doc-contents-title';
        head.setAttribute('aria-hidden', 'true');
        head.textContent = title;
        group.append(head, list);
        bar.querySelector('.doc-contents-panel')?.append(group);
      }
      viewEl.querySelector('[data-reader] > .docs-reader-grid')?.before(bar);
    }
    // A row scrolls this view: in the app the address is the route, so a bare #id must
    // stay out of the address. The heading takes focus, so keyboard and screen-reader users arrive
    // where they asked to go, and ?h= records the section like any other section link.
    const jump = (id: string): boolean => {
      const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
      if (!id) { window.scrollTo({ top: 0, behavior }); return true; }
      const heading = node.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (!heading || !scrollToHeading(node, id, behavior)) return false;
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      updateRouteParams({ h: id });
      return true;
    };
    // The reading line sits a quarter of the way down, under the top row and the bar.
    scope.add(enhanceDocsContents({ article: node, root: viewEl, jump, readingLine: () => Math.round(window.innerHeight * 0.25) }));
  }

  // ── M3: interactive "Try it" embeds (progressive enhancement) ─────────────────
  // ADDITIVE: turn the static, C2PA-signed tool screenshots into live affordances under
  // the ACTIVE brand. Each shot whose capture recipe is a live TOOL render (recovered
  // from /info/docs-render-manifest.json, keyed by shot slug) gets a keyboard-accessible
  // "Try it" overlay that opens the tool in-app, plus an opt-in in-place live embed. The
  // signed <img> stays as the baseline; non-tool (view/gallery) shots and a missing
  // manifest are silent no-ops. Fire-and-forget - it fetches the manifest and never
  // throws. See lib/docs-tryit.ts.
  void hydrateDocsTryIt(node);

  // Formats page: re-wire the three-zone table's chips to the detail dialog the
  // static site opens on click (lib/docs-formats.ts). No-op on every other page.
  enhanceDocsFormats(node, fmtCatalogRaw);

  // Landing mode: adapt the front door's outward app links to in-SPA routes
  // (lib/docs-landing.ts). The audience strip needs no hydration since plan 123 D1 -
  // its pills are plain #id jump links the anchor handler above already intercepts,
  // and every card is open on both surfaces.
  if (isLanding) { adaptLandingLinks(node); hydrateLandingCycle(node); hydrateLandingCovers(node); hydrateLandingAgentCopy(node); fitHeroCtaInk(node); }

  // Scroll to a deep-linked section once the page is in place.
  if (deepLink && scrollToHeading(node, deepLink, 'auto')) viewEl.dataset.deepScrolled = '';

  // ── Reading posture ──────────────────────────────────────────────────────────
  // Once the page has moved, the top row sits on a quiet ground so the text never runs
  // under the pills ([data-scrolled], docs.css). On a phone the app's bottom bar steps
  // away while the reader reads down and comes back on any scroll up and at the end of
  // the page (html[data-docs-bar="tucked"]; docs.css gates it to phone widths and holds
  // it still under Reduce motion). Both attributes leave with the view.
  const root = document.documentElement;
  root.setAttribute('data-docs-reading', '');
  scope.add(() => { root.removeAttribute('data-docs-reading'); root.removeAttribute('data-docs-bar'); });
  let lastY = window.scrollY;
  const posture = (): void => {
    const y = window.scrollY;
    viewEl.toggleAttribute('data-scrolled', y > 4);
    const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 48;
    if (y < 80 || atEnd) root.removeAttribute('data-docs-bar');
    else if (y > lastY + 6) root.setAttribute('data-docs-bar', 'tucked');
    else if (y < lastY - 6) root.removeAttribute('data-docs-bar');
    lastY = y;
  };
  scope.listen(window, 'scroll', posture, { passive: true });
  posture();

  armViewEnter(viewEl, '.docs-content, .docs-landing');
}

/** The picture viewer's words in the reader's language. Raw, because each one is set as
 *  an attribute or as text, never as markup. */
function docsLightboxLabels(): DocsLightboxLabels {
  return {
    enlarge: (alt) => (alt ? tRaw('Enlarge: {alt}', { alt }) : tRaw('Enlarge picture')),
    viewer: tRaw('Picture viewer'),
    close: tRaw('Close'),
    zoomIn: tRaw('Zoom in'),
    zoomOut: tRaw('Zoom out'),
    fit: tRaw('Fit to screen'),
    previous: tRaw('Previous picture'),
    next: tRaw('Next picture'),
    position: (n, total) => tRaw('{n} of {total}', { n: localNumber(n), total: localNumber(total) }),
  };
}

function localNumber(n: number): string {
  try { return n.toLocaleString(currentLang()); } catch { return String(n); }
}

// SPDX-License-Identifier: MPL-2.0
/**
 * In-app documentation reader (#/docs/<slug>) - plan "this-is-a-very-sparkling-eich"
 * Page narration opens from Listen in the shared audio dock.
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
 *   - <script> and <style> nodes (never execute a fetched page's scripts; the only inner
 *     <style> today is the Listen-bar's, and stripping all of them keeps a page's CSS
 *     from leaking into the shell). The reader's own styling lives in docs.css.
 *   - the `.listen-bar` (the reader mounts its own Listen button).
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
import '../styles/parts/docs-chrome.css';
import '../styles/parts/docs.css';
import '../styles/parts/docs-components.css';
import { escape, safeHref } from '../utils.ts';
import { t, tRaw, currentLang, normalizeLang, docsInfoHref, LANG_ICON_SVG, type Lang } from '../i18n.ts';
import { armViewEnter } from '../view-enter.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { createThemeToggle } from '../components/theme-toggle.ts';
import { attachLangMenu } from '../components/lang-menu.ts';
import { attachProfileMenu } from '../components/profile-menu.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { registerNarrationSource, unregisterNarrationSource, showAudioDock, audioDockController, isAudioDockVisible } from '../lib/audio-dock-singleton.ts';
import { createDocsNarrationHost, type DocsNarrationHandle } from '../lib/docs-narration-host.ts';
// The device-voice fallback is the dependency-free docs/player module (audio-dock types
// only), shared with the static /info site so both readers speak every page identically.
import { createDocsTtsHost, type DocsTtsHost } from '../../../../docs/player/tts-host.ts';
import { hydrateDocsTryIt } from '../lib/docs-tryit.ts';
import { icon } from '../lib/icons.ts';
import { createScope } from '../lib/dispose.ts';
import { enhanceDocsReading } from '../lib/docs-enhance.ts';
import { enhancePathwaysStrip } from '../lib/docs-strip.ts';
import { docsClipboardWriter, docsCopyLabels } from '../lib/docs-clipboard.ts';
import { enhanceDocsFormats } from '../lib/docs-formats.ts';
import { ensureLandingStyles, adaptLandingLinks, hydrateLandingCycle, hydrateLandingCovers, hydrateLandingAgentCopy, fitHeroCtaInk } from '../lib/docs-landing.ts';
import {
  rewriteDocLinks,
  extractSidebar,
  extractSitemap,
  extractContactFooter,
  extractPathways,
  buildToc,
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
 *  + component HTML + t() labels only - no free/user text reaches this sink. */
function shellHtml(inner: string): string {
  return `
    ${backHomeHtml()}
    <div class="docs-topright" data-topright>
      <a href="#/settings" class="docs-top-btn docs-profile-link" aria-label="${escape(t('Open settings'))}" title="${escape(t('Settings'))}">${icon('user')}</a>
    </div>
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
  viewEl.innerHTML = shellHtml(`<p class="docs-status">${t('Loading…')}</p>`);
  mountBackPill(viewEl);
  mountHomeFab(viewEl);
  // One scope owns everything this mount sets up, and the view's cleanup disposes it at
  // once, even while the fetch or the narration lookup is still in flight. #view persists
  // across routes, so a mount that loses that race checks scope.disposed after each await
  // and stops before it can write into, or unregister audio from, the next view.
  const scope = createScope();
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => scope.dispose();
  // On mobile the profile pill becomes the consolidated menu (theme / Home /
  // Language / settings) - the same stable anchor the gallery topbar has - and
  // the standalone language button + home FAB hide (docs.css / overrides.css).
  // Desktop is untouched: the pill stays a plain link to #/settings.
  const detachProfileMenu = attachProfileMenu(viewEl.querySelector<HTMLElement>('.docs-profile-link'), host);
  scope.add(detachProfileMenu);
  viewEl.querySelector('[data-topright]')?.prepend(createThemeToggle(host, { className: 'docs-top-btn' }));
  // Language switcher, styled as a docs top pill (not the bare .lang-fab icon) so it
  // matches the theme/home/wide cluster it sits in. attachLangMenu takes the element
  // directly, so the trigger needs no .lang-fab class - just the popover ARIA hooks.
  // --lang: hidden at phone widths (docs.css) - Language lives in the profile menu there.
  const langBtn = document.createElement('button');
  langBtn.type = 'button';
  langBtn.className = 'docs-top-btn docs-top-btn--lang';
  langBtn.setAttribute('aria-label', t('Language'));
  langBtn.title = t('Language');
  langBtn.setAttribute('aria-haspopup', 'menu');
  langBtn.setAttribute('aria-expanded', 'false');
  langBtn.innerHTML = LANG_ICON_SVG;
  viewEl.querySelector('[data-topright]')?.prepend(langBtn);
  const detachLangMenu = attachLangMenu(langBtn, host);
  scope.add(detachLangMenu);
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
    // --wide: hidden at phone widths (docs.css) - the reader is already full-bleed
    // there, so the toggle is a dead control that only crowds the chrome row.
    wideBtn.className = 'docs-top-btn docs-top-btn--wide';
    wideBtn.setAttribute('aria-label', t('Use the full window width'));
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
    viewEl.querySelector('[data-topright]')?.prepend(wideBtn);
  }

  const contentEl = viewEl.querySelector<HTMLElement>('[data-content]')!;
  const url = docsInfoHref(slug, lang);

  const showStatus = (message: string, extra = ''): void => {
    contentEl.innerHTML = `<p class="docs-status">${escape(message)}${extra}</p>`;
  };
  // The static-page escape hatch every failure branch below appends. `url` is the
  // first-party /info/ path built above (route-constrained slug), and the gate keeps
  // that true if the construction ever changes.
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in the guard above
  const openDocsLink = safeHref(url) ? ` <a href="${escape(url)}" target="_blank" rel="noopener">${t('Open the docs')}</a>` : '';

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

  // Sanitise: never run a fetched page's scripts, and drop the Listen bar (the dock owns
  // narration now). KEEP <style>: the only style nodes inside `.docs-content` are a figure's
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
  const pathwaysStrip = extractPathways(doc);
  const node = rehostFragment(fragment, { strip: 'script, .listen-bar, .docs-strip-band', rewriteLinks: rewriteDocLinks });

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
    }
  }

  // Copy on code blocks and its feedback (lib/docs-enhance.ts), bound before the article
  // is shown and released with the view. The writer confirms only a real clipboard write.
  scope.add(enhanceDocsReading(node, { writeText: docsClipboardWriter(host), labels: docsCopyLabels(), copyIcon: icon('clipboard') }));

  contentEl.replaceChildren(node);

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
  // The strip's prepended "Welcome" tab is the landing itself - active only there
  // (the per-page .active marks ride across from the fetched nav for the rest).
  if (isLanding) viewEl.querySelector('.docs-pathway-home')?.classList.add('active');
  // AI-scan donut (Andy, 2026-08-21): the page's own text-signal score at the right
  // end of the strip, pressing through to the full verify report for this served
  // page (its C2PA seal + the text-signal panel). extractHtmlText is the SAME
  // extraction verify runs on an HTML file (raw markup detects as docKind 'code'
  // and gates every prose tell off), fed the same fetched bytes - so this number
  // and the report's hero gauge agree.
  const strip = viewEl.querySelector<HTMLElement>('.docs-pathways');
  if (strip) {
    const scan = analyzeTextSignals(extractHtmlText(html), { source: 'digital' });
    const n = Math.max(0, Math.min(100, Math.round(scan.score)));
    const circ = 2 * Math.PI * 26;
    const donut = document.createElement('a');
    donut.className = 'docs-tsig-donut';
    // `check=1`: the press IS the ask, so verify resolves the page's same-origin
    // credential reference without a second "Fetch and check" click.
    donut.setAttribute('href', `#/verify?src=${encodeURIComponent(url)}&check=1`);
    // The shared [data-tip] tooltip (parts/tooltip.css), same text on aria-label
    // per its contract - the bubble is presentation only, never read.
    const label = `${tRaw('Signal score {n} of 100', { n })} · ${t('Open the verify report for this page')}`;
    donut.setAttribute('aria-label', label);
    donut.setAttribute('data-tip', label);
    // Numeric-only interpolation (score + the analyser's closed band union) - no free text.
    donut.innerHTML =
      `<svg viewBox="0 0 64 64" data-band="${escape(scan.band)}" aria-hidden="true">`
      + '<circle class="docs-tsig-track" cx="32" cy="32" r="26"/>'
      + `<circle class="docs-tsig-fill" cx="32" cy="32" r="26" stroke-dasharray="${((n / 100) * circ).toFixed(2)} ${circ.toFixed(2)}"/>`
      + `<text class="docs-tsig-num" x="32" y="40">${n}</text>`
      + '</svg>';
    strip.appendChild(donut);
    // On a phone the strip keeps one line and scrolls, as on /info: fade the edges
    // with tabs beyond them and bring the current section into view (lib/docs-strip.ts).
    scope.add(enhancePathwaysStrip(strip));
  }
  fillSlot('[data-sidebar]', extractSidebar(doc));
  fillSlot('[data-sitemap]', extractSitemap(doc));
  // The founded-by-SUSE badge + "Questions? Contact fitzy@suse.com" line from the built
  // page's footer - the sitemap already rode up in its own slot just above; this brings
  // the rest of that footer with it so the reader isn't missing the site's contact.
  fillSlot('[data-contact]', extractContactFooter(doc));
  // The landing gets no table of contents: its own sticky quicknav already jumps between
  // bands (hidden in landing mode), and the bands are sections of a front door rather
  // than headings of an article. Its pathways + sitemap slots fill as on any page; it
  // ships no `.docs-sidebar`, so that slot stays hidden on its own.
  const onTocClick = (e: MouseEvent): void => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-toc-target]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
    const id = a.dataset.tocTarget || '';
    const compactGroup = a.closest<HTMLDetailsElement>('.docs-compact-group');
    if (!compactGroup) {
      if (scrollToHeading(node, id, 'smooth')) e.preventDefault();
      return;
    }
    // A compact list (phone and tablet) sits above the article, so it folds away BEFORE
    // the scroll starts: collapsing it mid-scroll pulled the page up under the reader and
    // left the heading far above the screen. Then the heading takes focus, so keyboard
    // and screen-reader users arrive where they asked to go.
    const heading = id ? node.querySelector<HTMLElement>(`#${CSS.escape(id)}`) : null;
    if (!heading) return;
    e.preventDefault();
    compactGroup.open = false;
    requestAnimationFrame(() => {
      scrollToHeading(node, id, 'smooth');
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    });
  };
  const toc = (isLanding || isImmersive) ? null : buildToc(node);
  let stopSpy: (() => void) | null = null;
  if (toc) {
    const tocSlot = viewEl.querySelector<HTMLElement>('[data-toc]');
    if (tocSlot) {
      tocSlot.replaceChildren(toc.el);
      tocSlot.hidden = false;
      // TOC links (`#<id>` + data-toc-target) scroll within the reader, never the route.
      toc.el.addEventListener('click', onTocClick);
      // Scroll-spy (Andy, 2026-08-17): the sticky rail alone just parks the list - the
      // TOC should FOLLOW the reading position. The current section is the last heading
      // above the reading line (120px under the top edge); cheap enough to run on the
      // scroll event directly, and the listener dies with the view.
      const links = new Map(
        toc.headings.map((h) => [h.id, toc.el.querySelector<HTMLAnchorElement>(`a[data-toc-target="${CSS.escape(h.id)}"]`)]),
      );
      const spy = (): void => {
        let current: HTMLElement | null = null;
        for (const h of toc.headings) {
          if (h.getBoundingClientRect().top <= 120) current = h;
          else break;
        }
        links.forEach((a, id) => a?.classList.toggle('active', id === (current ?? toc.headings[0])?.id));
      };
      // The document is the real scroller (the view grows; see .docs-view in docs.css),
      // but listen on the view as well so a future height-constrained layout keeps the
      // spy without anyone remembering this line.
      viewEl.addEventListener('scroll', spy, { passive: true });
      window.addEventListener('scroll', spy, { passive: true });
      stopSpy = () => {
        viewEl.removeEventListener('scroll', spy);
        window.removeEventListener('scroll', spy);
      };
      spy();
    }
  }
  scope.add(() => stopSpy?.());

  // Phone and tablet: docs.css folds both rails away at 1024px and below, which left the
  // section's other pages unreachable and put "On this page" after the whole article.
  // The same two lists, as native disclosures above the article (hidden on wider screens,
  // where the rails show). Copies of what the slots already hold, so nothing new is fetched.
  const compact = compactNav(viewEl.querySelector<HTMLElement>('[data-sidebar] > .docs-sidebar'), toc?.el ?? null);
  if (compact) {
    compact.addEventListener('click', onTocClick);
    contentEl.before(compact);
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

  // Prepare narration without opening the floating player over the page. Produced
  // English audio takes priority; other pages use the device voice when available.
  // An existing music player keeps its current size and visibility.
  let narration: DocsNarrationHandle | null = null;
  let tts: DocsTtsHost | null = null;
  if (lang === 'en') {
    try {
      narration = await createDocsNarrationHost({ slug, contentRoot: node, title: pageTitle || slug, canSeekFromContent: isAudioDockVisible });
    } catch {
      narration = null;
    }
  }
  if (!narration && !scope.disposed) {
    try {
      tts = createDocsTtsHost({ slug, title: pageTitle || slug, contentRoot: node, canSeekFromContent: isAudioDockVisible });
    } catch {
      tts = null;
    }
  }
  if (scope.disposed) {
    // The reader unmounted while the track was resolving: never leave audio behind, and
    // never touch the shared dock, which may already hold the next page's narration.
    narration?.destroy();
    tts?.destroy();
    return;
  }
  const block = narration?.host ?? tts;
  if (block) {
    registerNarrationSource(block);
    const actions = document.createElement('div');
    actions.className = 'docs-listen-actions';
    const listen = document.createElement('button');
    listen.type = 'button';
    listen.className = 'btn docs-listen';
    listen.setAttribute('aria-controls', 'neuro-dock');
    listen.innerHTML = icon('play', { size: 16 });
    const label = document.createElement('span');
    label.textContent = t('Listen');
    listen.append(label);
    actions.append(listen);
    const heading = node.querySelector(':scope > h1');
    if (heading) heading.after(actions);
    else contentEl.prepend(actions);
    scope.listen(listen, 'click', () => {
      showAudioDock();
      const dock = audioDockController();
      if (dock?.getCollapse() === 'mini') dock.setCollapse('full');
      if (!block.isPlaying()) void block.togglePlay();
    });
  }

  // Resolve the heading after Listen has taken its place in the page, so inserting
  // the button cannot shift a deep-linked section below the reading position.
  if (deepLink && scrollToHeading(node, deepLink, 'auto')) viewEl.dataset.deepScrolled = '';

  armViewEnter(viewEl, '.docs-content, .docs-landing');

  scope.add(() => {
    // Order: detach the narration block from the shared window (the window stays if music
    // is still registered) before dropping the host (stops audio, removes the <audio> tap).
    unregisterNarrationSource();
    narration?.destroy();
    tts?.destroy();
  });
}

/** The phone and tablet navigation: the section's pages and this page's headings as two
 *  native disclosures, built from copies of the rail and the table of contents. */
function compactNav(sidebar: HTMLElement | null, toc: HTMLElement | null): HTMLElement | null {
  const groups: HTMLDetailsElement[] = [];
  const group = (title: string, glyph: Parameters<typeof icon>[0], body: HTMLElement): HTMLDetailsElement => {
    const d = document.createElement('details');
    d.className = 'doc-details docs-compact-group';
    // Fixed markup plus registry icons; the title goes in through textContent below.
    d.innerHTML = `<summary><span class="doc-details-glyph" aria-hidden="true">${icon(glyph)}</span>`
      + '<span class="doc-details-title"></span>'
      + `<span class="doc-details-chev" aria-hidden="true">${icon('chevronRight')}</span></summary><div class="doc-details-body"></div>`;
    d.querySelector('.doc-details-title')!.textContent = title;
    d.querySelector('.doc-details-body')!.append(body);
    return d;
  };
  if (sidebar) {
    const list = sidebar.cloneNode(true) as HTMLElement;
    const heading = list.querySelector('.sidebar-pathway');
    const title = heading?.textContent?.trim() || t('Documentation');
    heading?.remove();
    list.classList.add('docs-compact-list');
    groups.push(group(title, 'folder', list));
  }
  if (toc) {
    const list = toc.cloneNode(true) as HTMLElement;
    list.querySelector('.docs-toc-head')?.remove();
    list.classList.add('docs-compact-list');
    groups.push(group(t('On this page'), 'hash', list));
  }
  if (!groups.length) return null;
  const nav = document.createElement('div');
  nav.className = 'docs-compact-nav';
  nav.append(...groups);
  return nav;
}

// SPDX-License-Identifier: MPL-2.0
/**
 * In-app documentation reader (#/docs/<slug>) - plan "this-is-a-very-sparkling-eich"
 * M2, Phase 1 (reader only; no narration/Listen player - that is a later phase).
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
 *   - the `.listen-bar` (Phase 1 has no narration player).
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
import '../styles/parts/docs.css';
import { escape, safeHref } from '../utils.ts';
import { t, tRaw, currentLang, normalizeLang, docsInfoHref, LANG_ICON_SVG, type Lang } from '../i18n.ts';
import { armViewEnter } from '../view-enter.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { createThemeToggle } from '../components/theme-toggle.ts';
import { attachLangMenu } from '../components/lang-menu.ts';
import { attachProfileMenu } from '../components/profile-menu.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { registerNarrationSource, unregisterNarrationSource } from '../lib/audio-dock-singleton.ts';
import { createDocsNarrationHost, type DocsNarrationHandle } from '../lib/docs-narration-host.ts';
// The device-voice fallback is the dependency-free docs/player module (audio-dock types
// only), shared with the static /info site so both readers speak every page identically.
import { createDocsTtsHost, type DocsTtsHost } from '../../../../docs/player/tts-host.ts';
import { hydrateDocsTryIt } from '../lib/docs-tryit.ts';
import { icon } from '../lib/icons.ts';
import { enhanceDocsFormats } from '../lib/docs-formats.ts';
import { ensureLandingStyles, adaptLandingLinks, hydrateLandingCycle, hydrateLandingCovers, fitHeroCtaInk } from '../lib/docs-landing.ts';
import {
  rewriteDocLinks,
  extractSidebar,
  extractSitemap,
  extractContactFooter,
  extractPathways,
  buildToc,
} from '../lib/docs-nav.ts';
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
      <a href="#/profile" class="docs-top-btn docs-profile-link" aria-label="${escape(t('Open your profile'))}" title="${escape(t('Profile'))}">${icon('user')}</a>
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
  // On mobile the profile pill becomes the consolidated menu (theme / Home /
  // Language / settings) - the same stable anchor the gallery topbar has - and
  // the standalone language button + home FAB hide (docs.css / overrides.css).
  // Desktop is untouched: the pill stays a plain link to #/profile.
  const detachProfileMenu = attachProfileMenu(viewEl.querySelector<HTMLElement>('.docs-profile-link'), host);
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

  let html: string;
  try {
    let res = await fetch(url, { credentials: 'same-origin' });
    if (!viewEl.isConnected) return;
    if (!res.ok && url !== docsInfoHref(slug, 'en')) {
      // A build may ship English-only docs - the mobile app prunes the locale
      // page trees from its embed for size (shells/tauri-mobile build:frontend).
      // Fall back to the English page rather than a dead end; the reader chrome
      // stays localized, matching the shots pipeline's English-fallback rule.
      res = await fetch(docsInfoHref(slug, 'en'), { credentials: 'same-origin' });
      if (!viewEl.isConnected) return;
    }
    if (!res.ok) {
      // 404 etc. - a real message, plus the static page as an escape hatch.
      showStatus(
        t('That documentation page could not be found.'),
        openDocsLink,
      );
      return;
    }
    html = await res.text();
    // A flat pre-177 URL now serves a tiny meta-refresh stub pointing at the
    // page's doored home (/info/<door>/<slug>.html). Follow it once, in place,
    // so old in-app links and bookmarked #/docs routes keep resolving.
    const stub = /<meta http-equiv="refresh" content="0; url=(\/info\/[\w/-]+\.html)">/.exec(html);
    if (stub) {
      const res2 = await fetch(stub[1]!, { credentials: 'same-origin' });
      if (!viewEl.isConnected) return;
      if (res2.ok) html = await res2.text();
    }
  } catch {
    if (!viewEl.isConnected) return;
    showStatus(
      t('Could not load the documentation. Check your connection and try again.'),
      openDocsLink,
    );
    return;
  }
  if (!viewEl.isConnected) return;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Two extraction markers: `.docs-content` on every doc page, `.docs-landing` on the
  // front door. The landing is kept out of `.docs-content` on purpose (see
  // lib/docs-landing.ts); everything below treats the two the same way.
  const fragment = doc.querySelector('.docs-content, .docs-landing');
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
  // "application/json">`, which the strip below removes with every other script -
  // so read it out FIRST and hand it to the enhancer after mount (the reader's
  // "no fetched scripts survive" invariant stays intact). Null on any other page.
  const fmtCatalogRaw = fragment.querySelector('#fmt-catalog-data')?.textContent ?? null;

  // Sanitise: never run a fetched page's scripts, and drop the Listen bar (the dock owns
  // narration now). KEEP <style>: the only style nodes inside `.docs-content` are a figure's
  // OWN scoped block (e.g. `.cmp-fig` for the comparison matrix) - the page-global CSS lives
  // in <head>, which we never extract. Those blocks also DEFINE the figure's local tokens
  // (`--cmp-*`), so stripping them left figures unstyled and their headings mashed. This is
  // our own trusted, brand-scoped build output, not arbitrary fetched markup.
  fragment.querySelectorAll('script, .listen-bar').forEach((el) => el.remove());

  // Rewrite internal doc links to the in-app reader so navigation stays in the SPA.
  rewriteDocLinks(fragment);

  // Adopt the fragment into this document and mount it. `.docs-content` is a <main> in the
  // built page, but #view is ALREADY <main id="view"> - a nested/second <main> is an
  // invalid, duplicate landmark - so rehost its guts in an <article> (valid inside <main>,
  // and the right role for a doc page), keeping the `docs-content page-<slug>` classes so
  // docs.css applies. importNode(true) deep-clones across the parsed document.
  const imported = document.importNode(fragment, true) as HTMLElement;
  const node = document.createElement('article');
  node.className = imported.className;
  node.replaceChildren(...Array.from(imported.childNodes));
  contentEl.replaceChildren(node);

  // Scroll a heading (by fragment id) into view within #view. Returns whether the
  // heading exists, so a click handler can preventDefault only when it will act.
  // A target inside a closed <details> is opened first, all the way up the chain: the
  // landing's FAQ is a list of `details.faq-item` (the static page runs its own opener
  // script for the same reason), and any doc page's disclosure block gets the same
  // treatment. Scrolling to a hidden answer would land on the summary and look broken.
  const scrollToHeading = (id: string, behavior: ScrollBehavior): boolean => {
    const target = id ? node.querySelector(`#${CSS.escape(id)}`) : null;
    if (!target) return false;
    for (
      let d = target.closest('details');
      d && node.contains(d);
      d = d.parentElement?.closest('details') ?? null
    ) {
      d.open = true;
    }
    try { target.scrollIntoView({ behavior, block: 'start' }); } catch { /* jsdom has no layout */ }
    return true;
  };

  // In-page anchors (`#heading-id`) must NOT set location.hash - that IS the SPA route,
  // so a bare `#foo` would navigate away. Intercept plain clicks and scroll within #view.
  const onAnchorClick = (e: MouseEvent): void => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    const raw = a.getAttribute('href') || '';
    if (!raw.startsWith('#') || raw.startsWith('#/')) return; // leave real routes alone
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
    if (!scrollToHeading(decodeURIComponent(raw.slice(1)), 'smooth')) return;
    e.preventDefault();
  };
  node.addEventListener('click', onAnchorClick as EventListener);

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
  fillSlot('[data-pathways]', extractPathways(doc));
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
  const toc = isLanding ? null : buildToc(node);
  let stopSpy: (() => void) | null = null;
  if (toc) {
    const tocSlot = viewEl.querySelector<HTMLElement>('[data-toc]');
    if (tocSlot) {
      tocSlot.replaceChildren(toc.el);
      tocSlot.hidden = false;
      // TOC links (`#<id>` + data-toc-target) scroll within the reader, never the route.
      toc.el.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-toc-target]');
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
        if (scrollToHeading(a.dataset.tocTarget || '', 'smooth')) e.preventDefault();
      });
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
  if (isLanding) { adaptLandingLinks(node); hydrateLandingCycle(node); hydrateLandingCovers(node); fitHeroCtaInk(node); }

  // Deep-link: a spotlight/Ask docs result routes here as #/docs/<slug>?h=<anchor>
  // (the section heading rides a ?h= query param, since a second '#' can't ride the
  // hash route). Scroll that heading into view now that the fragment is in the DOM -
  // a no-op when absent or the id isn't on the page.
  if (deepLink) scrollToHeading(deepLink, 'auto');

  // ── Narration "Listen" dock (unified audio-dock migration, Phase 2a) ──────────
  // ADDITIVE: the reader had no player. Content-gated - mounted ONLY when this slug
  // has committed narration audio in /info/audio-index.json, AND only on the English
  // reader page (all committed audio is English, and the follow-along block map is
  // re-derived from the English markdown twin). No track / non-English → no narration (the
  // "no dead affordance" rule). Registers into the app-global SINGLETON audio dock (shared
  // with the music player) as the narration BLOCK; unregistered on unmount.
  // Produced Kokoro audio wins where it exists (English only); every other page - all
  // locales, the reference pages - falls back to the reader's device voice (plan 131
  // B.3), so the Listen dock reaches every page here just as it does on /info.
  let narration: DocsNarrationHandle | null = null;
  let tts: DocsTtsHost | null = null;
  if (lang === 'en') {
    try {
      narration = await createDocsNarrationHost({ slug, contentRoot: node, title: pageTitle || slug });
    } catch {
      narration = null;
    }
  }
  if (!narration) {
    try {
      tts = createDocsTtsHost({ slug, title: pageTitle || slug, contentRoot: node });
    } catch {
      tts = null;
    }
  }
  const block = narration?.host ?? tts;
  if (block) {
    if (!viewEl.isConnected) {
      // The reader unmounted while the track was resolving - never leave audio behind.
      narration?.destroy();
      tts?.destroy();
      narration = null;
      tts = null;
    } else {
      // Either host is a valid DockNarrationPlayer (transport + narration adapter).
      registerNarrationSource(block);
    }
  }

  armViewEnter(viewEl, '.docs-content, .docs-landing');

  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    node.removeEventListener('click', onAnchorClick as EventListener);
    detachLangMenu();
    detachProfileMenu();
    stopSpy?.();
    // Order: detach the narration block from the shared window (the window stays if music
    // is still registered) before dropping the host (stops audio, removes the <audio> tap).
    unregisterNarrationSource();
    narration?.destroy();
    tts?.destroy();
  };
}

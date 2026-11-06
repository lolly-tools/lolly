// SPDX-License-Identifier: MPL-2.0
/**
 * In-app documentation reader - navigation extraction + derivation (#/docs).
 *
 * The reader (views/docs.ts) fetches a built /info/<lang>/<slug>.html page and
 * rehosts its `.docs-content` fragment into #view. That same fetched document ALSO
 * carries the site's real navigation - the top pathways bar, the docs sidebar rail,
 * and the footer sitemap - which the reader used to throw away, stranding the reader
 * on a single page with no way to reach any other doc. This module pulls those nodes
 * out of the parsed document, rewrites their `/info/*.html` links to the in-app reader
 * route. (The page's contents are derived by views/docs.ts with the shared builder in
 * packages/docs-render contents.ts.) Everything here is progressive: a piece the fetched
 * page happens not to have is a silent `null`, never an error.
 *
 * All DOM is built with real nodes (importNode / createElement + textContent) rather
 * than a raw-HTML sink, so the module adds nothing to the primitive-guards R10 ledger.
 */
import { t } from '../i18n.ts';

/**
 * Rewrite an in-fragment `/info/<lang>/<slug>.html` link (± `#anchor`, ± `?query`) to
 * the in-app reader route, so internal navigation stays in the SPA (music keeps
 * playing, no full page reload) rather than leaving to the static site.
 *
 *   - Any `<lang>` prefix is dropped - the reader already runs in the app's locale.
 *   - A trailing `#anchor` is CARRIED as `?h=<anchor>` (a second '#' can't ride a hash
 *     route; the reader reads `?h=` and scrolls that heading into view). This is the
 *     fix for the old gap where the anchor was silently discarded.
 *   - `index.html` is the LANDING, and since plans/123 the reader rehosts it like any
 *     other page (its `.docs-landing` fragment is the second extraction marker), so it
 *     maps to `#/docs/index` with everything else. It used to divert to the app front
 *     door `/#/`, because a landing mount rendered "could not be displayed".
 *
 * Returns null for a link this rule does not own (signed screenshots, downloads, app
 * `/#/…` links, external URLs) - the caller then leaves the href untouched.
 */
export function toReaderHref(href: string): string | null {
  const m = /^\/info\/((?:[a-z][a-z0-9-]*\/)*)([^/]+?)\.html(?:\?[^#]*)?(?:#(.*))?$/.exec(href);
  if (!m) return null;
  // Prefix segments are a locale (dropped - the reader runs in the app's own),
  // a door directory (kept - since plans/177 it is part of the page's slug:
  // /info/create/using.html ↔ #/docs/create/using), or both, in that order.
  const DOORS = new Set(['start', 'create', 'build', 'manage', 'operate', 'trust']);
  const segs = m[1] ? m[1].split('/').filter(Boolean) : [];
  const door = segs.length && DOORS.has(segs[segs.length - 1]!) ? segs[segs.length - 1]! : null;
  if ((door ? segs.length - 1 : segs.length) > 1) return null; // deeper than lang+door - not a doc page
  const slug = door ? `${door}/${m[2]}` : m[2];
  const anchor = m[3] ? m[3].trim() : '';
  return anchor ? `#/docs/${slug}?h=${encodeURIComponent(anchor)}` : `#/docs/${slug}`;
}

/**
 * Rewrite a link that points at the APP ITSELF to the equivalent in-SPA hash link. The
 * built pages link out to the deployed app absolutely, in two shapes:
 *
 *   /                          /?lang=de                 → the app root
 *   /#/tool/qr-code?url=…      /?lang=de#/tool/filter    → a route on the app root
 *
 * Followed as written, each is a full page load: the reader unmounts, the music stops,
 * and the locale is re-picked from the query. The route form keeps its own `#/…` (the
 * `?lang=` is redundant in-app, where the locale is already live), and the bare root
 * resolves to the tools gallery `#/` - the app's main view. It used to resolve to the
 * dashboard (plans/123 D3); Andy, 2026-09-03: "the launch app button on the landing
 * page should go to the main view not the dashboard".
 *
 * Returns null for everything else, including `/info/…` doc links (toReaderHref owns
 * those) and any absolute URL - so a caller can run both rewriters over one fragment.
 */
export function toAppHref(href: string): string | null {
  const m = /^\/(?:\?[^#]*)?(#\/.*)?$/.exec(href);
  if (!m) return null;
  return m[1] ?? '#/';
}

/** Rewrite every internal `/info` doc link inside `root` to the in-app reader route,
 *  in place. Non-doc links (external, downloads, app routes) are left as they are. */
export function rewriteDocLinks(root: ParentNode): void {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const reader = toReaderHref(a.getAttribute('href') || '');
    if (reader) a.setAttribute('href', reader);
  });
}

/** Deep-clone a node from the parsed /info document into THIS document and rewrite its
 *  internal doc links. Null-safe so a missing landmark is a graceful skip. */
function adopt(src: Element | null): HTMLElement | null {
  if (!src) return null;
  const el = document.importNode(src, true) as HTMLElement;
  rewriteDocLinks(el);
  return el;
}

/**
 * The docs SIDEBAR rail (cross-doc nav) - the fetched page's own `.docs-sidebar`,
 * which already marks the CURRENT page `.active` (we fetched that page's build, so its
 * rail is contextually correct for free) and carries the AI / inclusive-design landmark
 * chips. Links rewritten to `#/docs/…`.
 */
export function extractSidebar(doc: Document): HTMLElement | null {
  return adopt(doc.querySelector('.docs-sidebar'));
}

/** The footer SITEMAP - the whole docs index (`.footer-sitemap`), links rewritten. */
export function extractSitemap(doc: Document): HTMLElement | null {
  return adopt(doc.querySelector('.footer-sitemap'));
}

/**
 * The footer CONTACT block - everything in the built page's `<footer>` EXCEPT the
 * `.footer-sitemap` (the reader already shows that in its own sitemap slot): the
 * "Open Source · Privacy · Inclusive Design" line, the "Questions? Contact Andy
 * Fitzsimon - fitzy@suse.com" line, and the "Founded by SUSE" badge + its image.
 * Rebuilt into a fresh `<footer class="docs-contact-footer">` so docs.css can style
 * it (the built page's own footer CSS lives in <head>, which the reader never keeps);
 * internal `/info` links are rewritten to the in-app reader like everywhere else.
 */
export function extractContactFooter(doc: Document): HTMLElement | null {
  const src = doc.querySelector('footer');
  if (!src) return null;
  const parts = Array.from(src.children).filter((el) => !el.classList.contains('footer-sitemap'));
  if (!parts.length) return null;
  const footer = document.createElement('footer');
  footer.className = 'docs-contact-footer';
  for (const p of parts) footer.appendChild(document.importNode(p, true));
  rewriteDocLinks(footer);
  return footer;
}

/**
 * The PATHWAYS strip (the documentation sections: Start · Create · Automate · Manage
 * · Trust). Since plan 277 step 3c the built page carries the strip itself -
 * `nav.docs-pathways`, at the top of an article's masthead band, or in the phone menu on
 * a page with no band - so the reader adopts that very element, links rewritten like
 * the rail's: both readers show one strip, with the build's `.active` and
 * `aria-current`. A page built before then (an older cache, a pinned build) has only the
 * old top bar's `.nav-group` anchors, which are rebuilt into the same strip as before.
 */
export function extractPathways(doc: Document): HTMLElement | null {
  const built = adopt(doc.querySelector('nav.docs-pathways'));
  if (built) {
    built.setAttribute('aria-label', t('Documentation sections'));
    return built;
  }
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('.nav-group a[href]'));
  if (!anchors.length) return null;
  const bar = document.createElement('nav');
  bar.className = 'docs-pathways';
  bar.setAttribute('aria-label', t('Documentation sections'));
  // The sections only, as the built strip carries them since plan 354 D2: the docs front
  // door is the bottom bar's Docs button, not a tab.
  for (const src of anchors) {
    const a = document.createElement('a');
    a.className = 'docs-pathway';
    a.textContent = (src.textContent || '').trim();
    const rewritten = toReaderHref(src.getAttribute('href') || '');
    if (rewritten) {
      a.setAttribute('href', rewritten);
    } else {
      // A pathway that isn't an /info doc link (shouldn't happen) stays a real link
      // out rather than a dead in-app route.
      a.setAttribute('href', src.getAttribute('href') || '#');
      a.target = '_blank';
      a.rel = 'noopener';
    }
    if (src.classList.contains('active')) a.classList.add('active');
    bar.appendChild(a);
  }
  return bar;
}

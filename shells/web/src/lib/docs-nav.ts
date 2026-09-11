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
 * route, and (for the on-page table of contents) DERIVES a fresh nav from the rehosted
 * content's stamped heading ids. Everything here is progressive: a piece the fetched
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
  const DOORS = new Set(['start', 'create', 'build', 'operate', 'trust']);
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
 * The top PATHWAYS section switcher - the `.nav-group` anchors from the fetched page's
 * top bar (Quickstart · For Creators · For Builders · For Operators · Trust), rebuilt
 * into a compact bar. Rebuilt rather than cloned so the search box + language menu that
 * ride the same `<nav>` are dropped. The fetched page marks the active pathway, which
 * we carry across.
 */
export function extractPathways(doc: Document): HTMLElement | null {
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('.nav-group a[href]'));
  if (!anchors.length) return null;
  const bar = document.createElement('nav');
  bar.className = 'docs-pathways';
  bar.setAttribute('aria-label', t('Documentation sections'));
  // The front door itself, ahead of the pathway hubs (Andy, 2026-08-17): the strip
  // used to start at Quickstart with no way back to the docs home the footer "What?"
  // pill lands on. views/docs.ts marks it active when the reader IS on the landing.
  const home = document.createElement('a');
  home.className = 'docs-pathway docs-pathway-home';
  home.textContent = t('Welcome');
  home.setAttribute('href', '#/docs/index');
  bar.appendChild(home);
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

export interface DocsToc {
  /** The `<nav class="docs-toc">` element, ready to mount. */
  el: HTMLElement;
  /** The content headings the TOC links to, in document order - for scroll-spy. */
  headings: HTMLElement[];
}

/**
 * Derive an on-page table of contents from the rehosted content's stamped heading ids
 * (h2 / h3 - the build stamps both). Returns null when there are fewer than two h2
 * sections, since a single section is not a table of contents. Each link scroll-jumps
 * within the reader (the caller wires the click to `scrollToHeading`); the `data-toc-target`
 * carries the raw id so the caller need not re-parse the href.
 */
export function buildToc(content: ParentNode): DocsToc | null {
  const heads = Array.from(content.querySelectorAll<HTMLElement>('h2[id], h3[id]'));
  if (heads.filter((h) => h.tagName === 'H2').length < 2) return null;

  const nav = document.createElement('nav');
  nav.className = 'docs-toc';
  nav.setAttribute('aria-label', t('On this page'));

  const head = document.createElement('div');
  head.className = 'docs-toc-head';
  head.textContent = t('On this page');
  nav.appendChild(head);

  const list = document.createElement('ul');
  list.className = 'docs-toc-list';
  const headings: HTMLElement[] = [];
  for (const h of heads) {
    const id = h.id;
    if (!id) continue;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = h.tagName === 'H3' ? 'docs-toc-link is-h3' : 'docs-toc-link is-h2';
    a.setAttribute('href', `#${id}`);
    a.dataset.tocTarget = id;
    a.textContent = (h.textContent || '').trim();
    li.appendChild(a);
    list.appendChild(li);
    headings.push(h);
  }
  nav.appendChild(list);
  return { el: nav, headings };
}

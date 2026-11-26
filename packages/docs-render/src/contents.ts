// SPDX-License-Identifier: MPL-2.0
// The page's contents, as both readers show them: a rail beside the article on a wide
// screen, and the page bar with its one sheet everywhere narrower. Pure
// string assembly over a list of headings, so docs/build.ts writes the markup into the
// static page and the in-app reader (shells/web/src/views/docs.ts) writes the same
// markup from the article it has just rehosted. Behaviour (opening, closing, marking the
// section being read) is shells/web/src/lib/docs-contents.ts, bundled into /info and
// imported by the app. Styles: shells/web/src/styles/parts/docs-chrome.css.
//
// Every link is a plain `#id` fragment link carrying `data-contents-target`, so the
// static page needs no script to jump, and the app can take the click and scroll its
// own view instead of changing its hash route.
import { esc, escAttr } from './esc.ts';

export interface ContentsHeading {
  id: string;
  text: string;
  /** 2 for a section, 3 for a subsection. */
  level: 2 | 3;
}

export interface ContentsLabels {
  /** The list's name: "On this page". */
  title: string;
}

/** A rail or panel is worth showing from two sections up: one section is not a list. */
export function hasContents(headings: readonly ContentsHeading[]): boolean {
  return headings.filter((h) => h.level === 2).length >= 2;
}

function linksHtml(headings: readonly ContentsHeading[]): string {
  return headings.map((h) =>
    `<li><a class="docs-toc-link is-h${h.level}" href="#${escAttr(h.id)}" data-contents-target="${escAttr(h.id)}">${esc(h.text)}</a></li>`,
  ).join('');
}

/** The wide-screen rail: every section and subsection, sticky beside the article. */
export function contentsRailHtml(headings: readonly ContentsHeading[], labels: ContentsLabels): string {
  return `<nav class="docs-toc" aria-label="${escAttr(labels.title)}">`
    + `<p class="docs-toc-head" aria-hidden="true">${esc(labels.title)}</p>`
    + `<ul class="docs-toc-list">${linksHtml(headings)}</ul></nav>`;
}

export interface PageBarOpts {
  /** The section the page sits in, in the strip's own word ("Create"). */
  section: string;
  /** The page's own title, or '' on a section's own hub page. */
  page: string;
  /** This page's headings; the sheet lists the sections (level 2). */
  headings: readonly ContentsHeading[];
  labels: ContentsLabels & {
    /** The accessible name of the sections list: "Documentation sections". */
    sections: string;
  };
  /** Trusted markup: the documentation sections as links (the strip's own anchors). */
  sectionsHtml: string;
  /** Trusted markup: this section's pages, with the current one marked, and its title. */
  pages: { title: string; html: string } | null;
  /** Trusted SVG markup for the disclosure chevron. */
  chevron: string;
}

/**
 * The page bar: one line under the top row on a phone or a narrow window, reading
 * "Create v Export a file", that opens one sheet holding every way around the docs:
 * the sections, this page's headings (the one being read marked) and this section's
 * pages. It replaces the pathways strip and the rail where they do not fit, so the
 * article starts high and the ways around stay one press away at any scroll. The
 * button's words are its accessible name; the sheet is `hidden` until it opens.
 */
export function pageBarHtml(o: PageBarOpts): string {
  const sections = o.headings.filter((h) => h.level === 2);
  const page = o.page && o.page !== o.section
    ? `<span class="doc-pagebar-page">${esc(o.page)}</span>` : '';
  const onPage = sections.length >= 2
    ? `<nav class="doc-sheet-group" aria-label="${escAttr(o.labels.title)}"><p class="doc-contents-title" aria-hidden="true">${esc(o.labels.title)}</p>`
      + `<ul class="docs-toc-list">${linksHtml(sections)}</ul></nav>`
    : '';
  const pages = o.pages
    ? `<nav class="doc-sheet-group" aria-label="${escAttr(o.pages.title)}"><p class="doc-contents-title" aria-hidden="true">${esc(o.pages.title)}</p>${o.pages.html}</nav>`
    : '';
  return `<div class="doc-pagebar" data-doc-contents>`
    + `<button type="button" class="doc-contents-btn doc-pagebar-btn" aria-expanded="false" aria-controls="docContentsPanel">`
    + `<span class="doc-pagebar-section">${esc(o.section)}</span>`
    + `<span class="doc-pagebar-chev" aria-hidden="true">${o.chevron}</span>${page}</button>`
    + `<div class="doc-contents-panel" id="docContentsPanel" hidden>`
    + `<nav class="doc-sheet-sections" aria-label="${escAttr(o.labels.sections)}">${o.sectionsHtml}</nav>`
    + onPage + pages
    + `</div></div>`;
}

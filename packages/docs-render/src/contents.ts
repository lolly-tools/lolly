// SPDX-License-Identifier: MPL-2.0
// The page's contents, as both readers show them: a rail beside the article on a wide
// screen, and one floating "Contents" button with a panel everywhere narrower. Pure
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
  /** The floating button's visible word: "Contents". */
  button: string;
  /** The last row of the panel: "Back to top". */
  top: string;
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

export interface ContentsControlOpts {
  headings: readonly ContentsHeading[];
  labels: ContentsLabels;
  /** Trusted SVG markup for the button's glyph. */
  glyph: string;
  /** Trusted markup for a second group after the sections (the app's "pages in this
   *  section", which has no other home on a phone). Empty on /info. */
  extra?: string;
}

/**
 * The floating control: a labelled button and the panel it opens. Sections only (no
 * subsections), so the panel reads in one glance on a phone. The panel is `hidden`
 * until the button opens it; the button points at the panel through aria-controls.
 */
export function contentsControlHtml(o: ContentsControlOpts): string {
  const sections = o.headings.filter((h) => h.level === 2);
  return `<div class="doc-contents" data-doc-contents>`
    + `<button type="button" class="doc-contents-btn" aria-expanded="false" aria-controls="docContentsPanel">`
    + `<span class="doc-contents-glyph" aria-hidden="true">${o.glyph}</span><span>${esc(o.labels.button)}</span></button>`
    + `<div class="doc-contents-panel" id="docContentsPanel" hidden>`
    + `<nav aria-label="${escAttr(o.labels.title)}"><p class="doc-contents-title" aria-hidden="true">${esc(o.labels.title)}</p>`
    + `<ul class="docs-toc-list">${linksHtml(sections)}</ul></nav>`
    + (o.extra ?? '')
    + `<a class="doc-contents-top" href="#top" data-contents-target="">${esc(o.labels.top)}</a>`
    + `</div></div>`;
}

// SPDX-License-Identifier: MPL-2.0
/**
 * The specification browser (#/document-model, plan 276 section 1D).
 *
 * The Lolly document model is drafted as its own web document: the docs build
 * writes one page per chapter under `/info/spec/document-model/`, plus an
 * `index.json` listing the chapters and the headings inside each. This view is the
 * in-app way to read it - a chapter rail on the left, the chapter itself on the
 * right, under the running brand's tokens rather than the neutral static site.
 *
 * HASH ROUTES ONLY. `#/document-model` opens the contents, `#/document-model/<slug>`
 * opens one chapter, and `?h=<heading-id>` reaches a heading inside it. There is no
 * pretty path and no APP_PATH_WORDS entry, because a path word is permanent and a
 * draft should not mint one.
 *
 * CONTENT. A chapter is the built page's own `.docs-content` fragment, fetched and
 * rehosted through lib/docs-rehost.ts - the same steps the documentation reader
 * (views/docs.ts) takes, so neither view carries its own copy. The fragment keeps
 * its `docs-content` class, so styles/parts/docs.css supplies the prose typography
 * and this view's own sheet only has to place it.
 *
 * NO RAW-HTML SINK. Every node here is built with createElement and textContent. The
 * two shared helpers that return markup (the back-pill island and lib/icons.ts
 * glyphs) are turned into nodes by `markupNodes` below, which is the idiom
 * views/design-navigator.ts already uses for the same reason.
 */
import '../styles/parts/docs.css';
import '../styles/parts/panel.css';
import '../styles/parts/document-model.css';
import { t, tRaw } from '../i18n.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { icon, type IconName } from '../lib/icons.ts';
import { fetchDocHtml, findDocFragment, rehostFragment, scrollToHeading } from '../lib/docs-rehost.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

/** The view drives the theme cycle, which writes the chosen theme to the profile. */
type DocumentModelHost = HostV1;

/** Where the docs build writes the specification. It sits under `/info/`, so it
 *  needs no rewrite of its own and the dev server serves it as a static file. */
const SPEC_ROOT = '/info/spec/document-model';
const INDEX_URL = `${SPEC_ROOT}/index.json`;
/** The draft's front door on the docs site, for a reader the app cannot serve. */
const SUMMARY_URL = '/info/build/document-model.html';
const chapterUrl = (slug: string): string => `${SPEC_ROOT}/${slug}.html`;

/** How many passages the search lists from the open chapter: enough to find one,
 *  few enough that the rail stays a rail. */
const PASSAGE_HITS = 12;

/** How much of a matched passage the rail shows. */
const SNIPPET_CHARS = 110;

/** How far under the top edge the scroll-spy reads the current heading, matching
 *  the documentation reader's own line. */
const READING_LINE = 120;

export interface SpecHeading { id: string; text: string; level: number }
export interface SpecChapter { slug: string; title: string; headings: SpecHeading[] }
export interface SpecIndex { version: string; updatedAt: string; chapters: SpecChapter[] }

/**
 * Read `index.json` defensively. It is generated, but a half-written file, an
 * older shape or a server that answered with the SPA shell must reach the status
 * message rather than throw inside the mount. A row with no slug or title is
 * dropped; an empty result is treated as no index at all.
 */
export function readSpecIndex(value: unknown): SpecIndex | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { version?: unknown; updatedAt?: unknown; chapters?: unknown };
  if (!Array.isArray(raw.chapters)) return null;
  const chapters: SpecChapter[] = [];
  for (const entry of raw.chapters) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as { slug?: unknown; title?: unknown; headings?: unknown };
    if (typeof row.slug !== 'string' || !row.slug || typeof row.title !== 'string' || !row.title) continue;
    const headings: SpecHeading[] = [];
    if (Array.isArray(row.headings)) {
      for (const candidate of row.headings) {
        if (!candidate || typeof candidate !== 'object') continue;
        const head = candidate as { id?: unknown; text?: unknown; level?: unknown };
        if (typeof head.id !== 'string' || !head.id || typeof head.text !== 'string') continue;
        const level = typeof head.level === 'number' ? head.level : 2;
        if (level !== 2 && level !== 3) continue;
        headings.push({ id: head.id, text: head.text, level });
      }
    }
    chapters.push({ slug: row.slug, title: row.title, headings });
  }
  if (!chapters.length) return null;
  return {
    version: typeof raw.version === 'string' ? raw.version : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    chapters,
  };
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

/**
 * First-party component markup as real nodes. The shared helpers this view borrows
 * return strings, and parsing them keeps each one the single definition while this
 * module holds no raw-HTML sink - the same reasoning as views/design-navigator.ts's
 * `iconNode`. Nothing composed from data is ever passed in.
 */
function markupNodes(markup: string): Node[] {
  const parser = document.defaultView?.DOMParser ?? (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
  if (!markup || !parser) return [];
  const parsed = new parser().parseFromString(`<body>${markup}</body>`, 'text/html');
  return [...parsed.body.childNodes].map((node) => document.importNode(node, true));
}

/** One glyph as a node, or nothing when the parser or the name is absent. */
function glyphNode(name: IconName, size: number): Node | null {
  return markupNodes(icon(name, { size }))[0] ?? null;
}

/** Case folded, whitespace collapsed - the one normalisation the search uses. */
const fold = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * The part of a matched passage a reader should see: a window around the first
 * term, cut at a word where it can be.
 *
 * Not the paragraph's opening. A passage matches on a word that may be three
 * sentences in, and a snippet cut before it shows a row with nothing marked in
 * it, which tells the reader neither why the row is there nor what it says.
 */
function snippet(text: string, terms: readonly string[] = []): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= SNIPPET_CHARS) return clean;
  const lower = clean.toLowerCase();
  const hits = terms.map((term) => lower.indexOf(term)).filter((at) => at >= 0);
  const first = hits.length ? Math.min(...hits) : 0;
  // Open a third of the window before the match, so the word keeps context on
  // both sides, and start at a word boundary when one is close enough.
  let start = Math.max(0, first - Math.floor(SNIPPET_CHARS / 3));
  if (start > 0) {
    const space = clean.indexOf(' ', start);
    if (space >= 0 && space - start < 20) start = space + 1;
  }
  const end = Math.min(clean.length, start + SNIPPET_CHARS);
  const body = clean.slice(start, end);
  const space = body.lastIndexOf(' ');
  const trimmed = end < clean.length && space > SNIPPET_CHARS * 0.6 ? body.slice(0, space) : body;
  return `${start > 0 ? '…' : ''}${trimmed.trimEnd()}${end < clean.length ? '…' : ''}`;
}

/** The notice a draft page opens with. `kind` says what the reader is
 *  actually looking at: one chapter, or the whole specification on the contents
 *  page, which is no chapter at all. A chapter page fetched from the docs build
 *  carries its own notice, and the mount below keeps whichever one is there
 *  rather than printing two. */
function draftPill(kind: 'chapter' | 'specification'): HTMLElement {
  const pill = element('span', 'dm-pill', t('Draft'));
  // The pill says the one word; the sentence stays one hover or one screen-reader step away.
  const sentence = kind === 'chapter'
    ? t('This chapter is a draft for review, dated 2026-09-24.')
    : t('This specification is a draft for review, dated 2026-09-24.');
  pill.title = sentence;
  pill.setAttribute('aria-label', sentence);
  return pill;
}

/** The snippet of a matched passage with each term marked, so a row in the rail
 *  says why it matched. Built as nodes, never as markup. */
function snippetNodes(text: string, terms: string[]): Node[] {
  const clean = snippet(text, terms);
  const lower = clean.toLowerCase();
  const spans: Array<[number, number]> = [];
  for (const term of terms) {
    for (let at = lower.indexOf(term); at >= 0; at = lower.indexOf(term, at + term.length)) {
      spans.push([at, at + term.length]);
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: Node[] = [];
  let cursor = 0;
  for (const [start, end] of spans) {
    if (start < cursor) continue;
    if (start > cursor) out.push(document.createTextNode(clean.slice(cursor, start)));
    const mark = document.createElement('mark');
    mark.textContent = clean.slice(start, end);
    out.push(mark);
    cursor = end;
  }
  if (cursor < clean.length) out.push(document.createTextNode(clean.slice(cursor)));
  return out;
}

/** One chapter's row in the rail, with everything the search needs to filter it. */
interface RailRow {
  chapter: SpecChapter;
  section: HTMLElement;
  headings: HTMLElement;
  fold: HTMLButtonElement;
  links: Array<{ heading: SpecHeading; el: HTMLElement }>;
  haystack: string;
}

export async function mountDocumentModel(
  viewEl: HTMLElement,
  host: DocumentModelHost,
  slug: string | null,
  params: string,
): Promise<void> {
  const deepLink = new URLSearchParams(params).get('h');
  document.title = tRaw('{name} - Lolly', { name: t('Document model') });

  // ── Chrome: the shared back pill with its home escape, plus the theme cycle. A
  // long reading surface is where someone wants light, dark or brand to hand. ──
  const topRight = element('div', 'gallery-topright');
  const layout = element('div', 'dm-layout');
  const nav = element('aside', 'lp dm-nav');
  nav.setAttribute('aria-label', t('Chapters'));
  const content = element('div', 'dm-content');
  layout.append(nav, content);
  viewEl.replaceChildren(...markupNodes(backHomeHtml()), topRight, layout);
  mountBackPill(viewEl);
  mountThemeFab(topRight, host);

  const status = (message: string): void => {
    content.replaceChildren(element('p', 'dm-status', message));
  };
  /** The same message with the one route that still works: the page on the docs
   *  site, which is served as a plain file and needs nothing from this view. */
  const statusWithSource = (message: string, href: string): void => {
    const line = element('p', 'dm-status', message);
    const link = element('a', 'dm-status-link', t('Read it on the docs site'));
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    line.append(' ', link, '.');
    content.replaceChildren(line);
  };
  status(t('Loading…'));

  // ── The index. Read on every mount: it is a small static file behind the
  // service worker's cache, and picking a chapter re-mounts the view. ──
  let index: SpecIndex | null = null;
  try {
    const res = await fetch(INDEX_URL, { credentials: 'same-origin' });
    if (!viewEl.isConnected) return;
    if (res.ok) index = readSpecIndex(await res.json());
  } catch {
    index = null;
  }
  if (!viewEl.isConnected) return;
  if (!index) {
    // The reader is told what they can do; the build detail a developer needs
    // goes to the console, where it costs a reader nothing.
    console.warn(`[document-model] no ${INDEX_URL}: run pnpm run build:info to write the specification`);
    statusWithSource(t('This draft is not available in the app yet.'), SUMMARY_URL);
    return;
  }

  const chapters = index.chapters;
  const current = slug ? chapters.find((chapter) => chapter.slug === slug) ?? null : null;

  // ── The rail: a search field over a folding list of chapters and headings. ──
  const rows: RailRow[] = [];
  const search = document.createElement('input');
  const noMatch = element('p', 'dm-none', t('No chapter title or heading matches.'));
  const passageBand = element('div', 'lp-band dm-band-passages');
  const passageRows = element('div', 'lp-rows dm-passages');
  /** The mounted chapter, once it is there. The passage search reads it live. */
  let article: HTMLElement | null = null;

  const railHead = element('div', 'lp-head');
  railHead.append(element('strong', 'lp-head-name', t('Chapters')));

  const field = element('label', 'dm-search');
  const fieldGlyph = glyphNode('search', 16);
  if (fieldGlyph) {
    const box = element('span', 'dm-search-icon');
    box.setAttribute('aria-hidden', 'true');
    box.append(fieldGlyph);
    field.append(box);
  }
  // `type='text'`, like the shell's shared search box (components/footer-nav.ts):
  // the browser's own cancel control would double up with the clear button below.
  search.type = 'text';
  search.className = 'dm-search-input';
  search.autocomplete = 'off';
  search.spellcheck = false;
  // What it searches, and nothing more: chapter titles and headings across the
  // draft. Passages of the OPEN chapter are listed under their own band label.
  search.placeholder = t('Find a chapter or heading');
  search.setAttribute('aria-label', t('Search chapters and headings'));
  field.append(search);

  const clearSearch = element('button', 'dm-search-clear');
  clearSearch.type = 'button';
  clearSearch.hidden = true;
  clearSearch.setAttribute('aria-label', t('Clear search'));
  const clearGlyph = glyphNode('close', 14);
  if (clearGlyph) clearSearch.append(clearGlyph);
  field.append(clearSearch);

  const scroll = element('div', 'lp-scroll');
  // The band carries no label of its own: the rail's head above it already says
  // Chapters, and printing the word twice inside one panel is the repetition the
  // head was renamed to remove. The passage band below keeps its own label,
  // which is what tells the two lists apart.
  const chapterBand = element('div', 'lp-band dm-band-chapters');

  chapters.forEach((chapter, i) => {
    const section = element('section', 'lp-sec dm-sec');
    const head = element('div', 'lp-sec-head dm-head');
    head.append(element('span', 'dm-num', String(i + 1).padStart(2, '0')));

    const open = !!current && current.slug === chapter.slug;
    const link = element('a', 'lp-sec-name dm-chapter', chapter.title);
    link.href = `#/document-model/${chapter.slug}`;
    if (open) {
      link.setAttribute('aria-current', 'page');
      head.classList.add('dm-head--current');
    }
    head.append(link);

    const headings = element('div', 'lp-rows dm-headings');
    headings.id = `dm-headings-${chapter.slug}`;
    headings.hidden = !open;

    const foldBtn = element('button', 'dm-fold');
    foldBtn.type = 'button';
    foldBtn.setAttribute('aria-expanded', String(open));
    foldBtn.setAttribute('aria-controls', headings.id);
    foldBtn.setAttribute('aria-label', tRaw('Headings in {name}', { name: chapter.title }));
    foldBtn.disabled = chapter.headings.length === 0;
    foldBtn.append(element('i', 'lp-caret'));
    foldBtn.addEventListener('click', () => {
      const show = headings.hidden;
      headings.hidden = !show;
      foldBtn.setAttribute('aria-expanded', String(show));
    });
    head.append(foldBtn);

    const links: RailRow['links'] = [];
    for (const heading of chapter.headings) {
      const item = element('a', 'dm-heading', heading.text);
      item.href = `#/document-model/${chapter.slug}?h=${encodeURIComponent(heading.id)}`;
      item.dataset.dmLevel = String(heading.level);
      item.dataset.dmSlug = chapter.slug;
      item.dataset.dmHeading = heading.id;
      headings.append(item);
      links.push({ heading, el: item });
    }

    section.append(head, headings);
    chapterBand.append(section);
    rows.push({
      chapter,
      section,
      headings,
      fold: foldBtn,
      links,
      haystack: fold([chapter.title, ...chapter.headings.map((h) => h.text)].join(' ')),
    });
  });

  passageBand.hidden = true;
  passageBand.append(element('p', 'lp-band-label', t('In this chapter')), passageRows);
  noMatch.hidden = true;
  // The line sits ABOVE the chapter list, because what it explains is the list
  // underneath it: a search that matched no chapter leaves every chapter showing.
  scroll.append(noMatch, chapterBand, passageBand);
  nav.replaceChildren(railHead, field, scroll);

  /** Passages of the open chapter that carry every term, listed under the rail. */
  const searchPassages = (terms: string[]): number => {
    passageRows.replaceChildren();
    const chapterEl = article;
    if (!chapterEl || !terms.length) { passageBand.hidden = true; return 0; }
    const found: HTMLElement[] = [];
    for (const el of chapterEl.querySelectorAll<HTMLElement>('p, li, blockquote, td')) {
      if (el.closest('.dm-draft')) continue;
      const text = fold(el.textContent || '');
      if (!text || !terms.every((term) => text.includes(term))) continue;
      found.push(el);
      if (found.length >= PASSAGE_HITS) break;
    }
    passageBand.hidden = found.length === 0;
    for (const el of found) {
      const row = element('button', 'dm-passage');
      row.type = 'button';
      row.append(...snippetNodes(el.textContent || '', terms));
      row.addEventListener('click', () => {
        for (const previous of [...chapterEl.querySelectorAll('.dm-hit')]) previous.classList.remove('dm-hit');
        el.classList.add('dm-hit');
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* jsdom has no layout */ }
      });
      passageRows.append(row);
    }
    return found.length;
  };

  const runSearch = (): void => {
    const terms = fold(search.value).split(' ').filter(Boolean);
    let shown = 0;
    for (const row of rows) {
      const hit = terms.every((term) => row.haystack.includes(term));
      row.section.hidden = !hit;
      if (hit) shown++;
      if (terms.length) {
        // A chapter whose own title matches keeps all its headings, so the reader
        // sees what is in it; otherwise only the headings that match stay.
        const wholeChapter = terms.every((term) => fold(row.chapter.title).includes(term));
        let headingHits = 0;
        for (const link of row.links) {
          const on = wholeChapter || terms.every((term) => fold(link.heading.text).includes(term));
          link.el.hidden = !on;
          if (on) headingHits++;
        }
        row.headings.hidden = headingHits === 0;
        row.fold.setAttribute('aria-expanded', String(headingHits > 0));
      } else {
        for (const link of row.links) link.el.hidden = false;
        const open = !!current && row.chapter.slug === current.slug;
        row.headings.hidden = !open;
        row.fold.setAttribute('aria-expanded', String(open));
      }
    }
    searchPassages(terms);
    // The rail always navigates. A word that appears only in the prose matches no
    // chapter title and no heading, and hiding the list on that answer left the
    // reader in a chapter with no way to any other one. So when nothing in the
    // list matched, every chapter comes back and the line above says why it is
    // not a filtered list - whether or not passages matched underneath it.
    if (terms.length && shown === 0) {
      for (const row of rows) {
        row.section.hidden = false;
        for (const link of row.links) link.el.hidden = false;
        row.headings.hidden = true;
        row.fold.setAttribute('aria-expanded', 'false');
      }
    }
    noMatch.hidden = !terms.length || shown > 0;
    clearSearch.hidden = !search.value;
  };
  search.addEventListener('input', runSearch);
  clearSearch.addEventListener('click', () => {
    search.value = '';
    search.focus();
    runSearch();
  });

  if (slug && !current) {
    status(t('That chapter could not be found.'));
    return;
  }

  // ── The contents, for the bare route. A reader who has not picked a chapter
  // sees how the draft is laid out rather than landing in chapter one. ──
  if (!current) {
    const page = element('article', 'docs-content dm-contents');
    // The same name the docs site gives it, so the two surfaces are one document.
    const heading = element('h1', 'docs-page-title', t('Document model draft'));
    heading.append(' ', draftPill('specification'));
    page.append(heading);
    const list = element('ol', 'dm-toc');
    for (const chapter of chapters) {
      const row = element('li', 'dm-toc-row');
      const link = element('a', 'dm-toc-link', chapter.title);
      link.href = `#/document-model/${chapter.slug}`;
      row.append(link);
      if (chapter.headings.length) {
        // One word for one thing: the rail's fold button and index.json both
        // call these headings, so the contents does too.
        row.append(element('span', 'dm-toc-count', chapter.headings.length === 1
          ? t('1 heading')
          : tRaw('{n} headings', { n: chapter.headings.length })));
      }
      list.append(row);
    }
    page.append(list);
    content.replaceChildren(page);
    return;
  }

  // ── The chapter itself. ──
  const fetched = await fetchDocHtml({
    urls: [chapterUrl(current.slug)],
    fetch: (input, init) => fetch(input, init),
    alive: () => viewEl.isConnected,
  });
  if (!fetched.ok) {
    if (fetched.reason === 'abandoned') return;
    status(fetched.reason === 'missing'
      ? t('That chapter could not be found.')
      : t('Could not load the specification. Check your connection and try again.'));
    return;
  }

  const doc = new DOMParser().parseFromString(fetched.html, 'text/html');
  const fragment = findDocFragment(doc, '.docs-content');
  if (!fragment) {
    statusWithSource(t('That chapter could not be displayed.'), chapterUrl(current.slug));
    return;
  }
  // A fetched page's scripts never run in the shell. Its links are left as the
  // build wrote them: a chapter cites repository paths and the docs site, and
  // neither is a `/info/<slug>.html` doc page the reader's rewriter owns.
  //
  // The blockquote right under the built h1 IS the draft notice the markdown
  // wrote. It goes, and the view's own notice takes its place below, so a reader
  // meets one notice in one wording rather than two that disagree.
  article = rehostFragment(fragment, { strip: 'script, .listen-bar, :scope > h1 + blockquote' });
  if (!article.querySelector('h1')) {
    // The build lifts each page's h1 into a masthead band outside the fragment,
    // so the chapter would otherwise open on its first paragraph with no title.
    const banded = [...doc.querySelectorAll('h1')].find((h) => !fragment.contains(h));
    if (banded) {
      const h1 = document.importNode(banded, true) as HTMLElement;
      h1.classList.add('docs-page-title');
      article.prepend(h1);
    }
  }
  // In the title, after its words: the chapter names itself first, then carries the
  // Draft pill, the way every draft page in the app is marked.
  const title = article.querySelector('h1');
  // A notice the build wrote under the title gives way to the pill: the draft is said once.
  const carried = title ? title.nextElementSibling : article.firstElementChild;
  if (carried?.tagName === 'BLOCKQUOTE' && /draft/i.test(carried.textContent ?? '')) carried.remove();
  if (title) title.append(' ', draftPill('chapter')); else article.prepend(draftPill('chapter'));

  const at = chapters.findIndex((chapter) => chapter.slug === current.slug);
  const pager = element('nav', 'dm-pager');
  pager.setAttribute('aria-label', t('Previous and next chapter'));
  const step = (chapter: SpecChapter | undefined, kind: 'prev' | 'next'): void => {
    if (!chapter) { pager.append(element('span', 'dm-step dm-step--empty')); return; }
    const link = element('a', `dm-step dm-step--${kind}`);
    link.href = `#/document-model/${chapter.slug}`;
    const words = element('span', 'dm-step-words');
    words.append(
      element('span', 'dm-step-kind', kind === 'prev' ? t('Previous chapter') : t('Next chapter')),
      element('span', 'dm-step-name', chapter.title),
    );
    // The glyph cell this surface reserves everywhere else, doing the one job it
    // has here: saying which way the step goes.
    const arrow = glyphNode(kind === 'prev' ? 'chevronLeft' : 'chevronRight', 16);
    let cell: HTMLElement | null = null;
    if (arrow) {
      cell = element('span', 'dm-step-glyph');
      cell.setAttribute('aria-hidden', 'true');
      cell.append(arrow);
    }
    if (cell && kind === 'prev') link.append(cell);
    link.append(words);
    if (cell && kind === 'next') link.append(cell);
    pager.append(link);
  };
  step(chapters[at - 1], 'prev');
  step(chapters[at + 1], 'next');

  const source = element('p', 'dm-source');
  const sourceLink = element('a', 'dm-source-link', t('Open this chapter in a new tab'));
  sourceLink.href = chapterUrl(current.slug);
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener';
  const away = glyphNode('externalLink', 12);
  if (away) {
    const cell = element('span', 'dm-source-glyph');
    cell.setAttribute('aria-hidden', 'true');
    cell.append(away);
    sourceLink.append(cell);
  }
  source.append(sourceLink);

  content.replaceChildren(article, pager, source);

  /** Mark one heading of the open chapter in the RAIL. The scroll-spy calls this
   *  on its own, so reading past a heading never moves the landing marker below. */
  const markRail = (id: string): void => {
    for (const row of rows) {
      for (const link of row.links) {
        link.el.classList.toggle(
          'dm-heading--current',
          row.chapter.slug === current.slug && link.heading.id === id,
        );
      }
    }
  };

  /** Mark the heading that was asked for, in the chapter and in the rail. */
  const markHeading = (id: string): void => {
    const chapterEl = article;
    if (!chapterEl) return;
    for (const previous of [...chapterEl.querySelectorAll('.dm-target')]) previous.classList.remove('dm-target');
    chapterEl.querySelector(`#${CSS.escape(id)}`)?.classList.add('dm-target');
    markRail(id);
  };

  // Scroll-spy, the same mechanism the documentation reader already uses
  // (views/docs.ts): the current heading is the last one above the reading line,
  // so a long chapter keeps the rail pointing at where the reader is rather than
  // at whatever was clicked last. The address bar is left alone; only a click
  // writes a heading into it.
  const spyHeadings = [...article.querySelectorAll<HTMLElement>('h2[id], h3[id]')];
  if (spyHeadings.length) {
    const spy = (): void => {
      // The view owns no teardown hook, so the listener retires itself the first
      // time it runs after the view has left the document.
      if (!viewEl.isConnected) {
        viewEl.removeEventListener('scroll', spy);
        window.removeEventListener('scroll', spy);
        return;
      }
      let reading: HTMLElement | null = null;
      for (const heading of spyHeadings) {
        if (heading.getBoundingClientRect().top <= READING_LINE) reading = heading;
        else break;
      }
      if (reading) markRail(reading.id);
    };
    // The document scrolls this view, and the view itself is listened to as well
    // so a height-constrained layout would keep the spy without a second edit.
    viewEl.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('scroll', spy, { passive: true });
  }

  // An in-page anchor must not write location.hash: that IS the route. Take a
  // plain click and scroll inside the chapter instead.
  article.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const raw = link.getAttribute('href') || '';
    if (!raw.startsWith('#') || raw.startsWith('#/')) return;
    const click = event as MouseEvent;
    if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey || click.button > 0) return;
    if (!article || !scrollToHeading(article, decodeURIComponent(raw.slice(1)), 'smooth')) return;
    event.preventDefault();
  });

  // A heading of the OPEN chapter is one scroll away, and the route signature is
  // the slug, so the router would drop the navigation as a duplicate and nothing
  // would move. Take the click here, scroll, and put the heading in the address
  // bar without a history entry. A heading of another chapter is a plain link.
  nav.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-dm-heading]');
    if (!link || link.dataset.dmSlug !== current.slug || !article) return;
    const click = event as MouseEvent;
    if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey || click.button > 0) return;
    event.preventDefault();
    const id = link.dataset.dmHeading || '';
    scrollToHeading(article, id, 'smooth');
    markHeading(id);
    try { history.replaceState(history.state, '', link.getAttribute('href') || ''); } catch { /* no history here */ }
  });

  if (deepLink) {
    // The mark is applied now; the jump is applied again on the next frame,
    // because the router resets the scroll to the top after this mount resolves
    // whenever the route name changed, which is every fresh load of a pasted link.
    markHeading(deepLink);
    scrollToHeading(article, deepLink, 'auto');
    const again = (): void => {
      if (article && viewEl.isConnected) scrollToHeading(article, deepLink, 'auto');
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(again);
  }
}

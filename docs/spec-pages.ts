// SPDX-License-Identifier: MPL-2.0
/**
 * The document model specification as its own web document (plan 276, stage 1).
 *
 * The chapters live in `docs/spec/document-model/`, one markdown file each, named
 * `NN-<slug>.md` so filename order is reading order. They are NOT pathway pages:
 * they carry no `pages` entry, no sidebar rail, no footer column, no stub, no page
 * seal and no locale twin. They are one long document with its own front door, in
 * the style of the agent files beside `/info/llms.txt` - a pure builder here, wired
 * in `docs/build.ts` and pinned by `tests/docs-spec-pages.test.ts` without building
 * the site.
 *
 * Three kinds of output, all under `/info/spec/document-model/`:
 *
 *   <chapter-slug>.html   one page per chapter, the same site header, nav, footer
 *                         and theme every other page wears, in the standalone
 *                         content column the generated side-door pages use.
 *   index.json            the chapter list with each chapter's headings and their
 *                         ids - the file the in-app browser at `#/document-model`
 *                         reads to build its nav, and the one machine-readable
 *                         record of what the draft contains.
 *   document-model.md     the chapters concatenated in order, for an agent and for
 *                         anyone who wants the whole draft in one file.
 *
 * The builder takes `render` and `wrap` as callbacks rather than importing the
 * renderer and the page chrome itself: `docs/build.ts` owns the one
 * DocsRenderContext the whole site renders through and the one `wrapPage` every
 * page is wrapped in, so passing them in is what keeps these pages from becoming a
 * second way to render a docs page. The test passes its own pair.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Where the chapters are served, relative to the build's output dir (`/info/`). */
export const SPEC_BASE = 'spec/document-model';

/** Where the chapter sources live. */
export const SPEC_SRC_DIR = resolve(__dirname, 'spec', 'document-model');

/**
 * The draft's version string, carried in `index.json` so a reader (and the in-app
 * browser) can tell one build of the draft from another. It is a date because the
 * draft is dated: nothing here is normative, and a semantic version would imply a
 * promise the status chapter has not made yet.
 */
export const SPEC_VERSION = 'draft-2026-09-24';

/**
 * The date `index.json` reports as the draft's own. A wall clock would rewrite the
 * file on every build and make two builds of one tree differ, so the default is the
 * date the version carries; moving it is a deliberate edit, the same as moving the
 * draft's date in the chapters. A caller may pass its own.
 */
export const SPEC_UPDATED_AT = SPEC_VERSION.replace(/^draft-/, '');

/** The concatenated twin's filename, beside the chapters. */
export const SPEC_TWIN_FILE = 'document-model.md';

/** The machine-readable chapter list's filename, beside the chapters. */
export const SPEC_INDEX_FILE = 'index.json';

/** One chapter source, as read from disk. */
export interface SpecChapter {
  /** The source filename, e.g. `01-constitution.md`. */
  file: string;
  /** The served name, the filename without its numeric prefix or extension. */
  slug: string;
  /** The chapter title, taken from its H1. */
  title: string;
  /** One sentence for the share preview and the browser's chapter list. */
  description: string;
  /** The markdown source, verbatim. */
  md: string;
}

/** One heading inside a chapter, as the rendered page carries it. */
export interface SpecHeading {
  /** The id the rendered HTML stamped on the heading (`headingId` in docs-render). */
  id: string;
  /** The heading's text, tags and entities resolved. */
  text: string;
  /** 2, 3 or 4. The H1 is the chapter title and is not listed again here. */
  level: number;
}

/** One chapter's row in `index.json`. */
export interface SpecIndexChapter {
  slug: string;
  title: string;
  /** The source filename, so a reader can find the chapter in the repository. */
  file: string;
  headings: SpecHeading[];
}

/** The whole of `index.json`. */
export interface SpecIndex {
  version: string;
  updatedAt: string;
  chapters: SpecIndexChapter[];
}

/** What `wrap` is handed for one chapter. */
export interface SpecWrapPage {
  /** The chapter slug, without the `spec/document-model/` prefix. */
  slug: string;
  title: string;
  description: string;
  /**
   * The chapter's own navigation, which stands in for the pathway sidebar. A
   * reader inside a twelve-chapter document needs the chapters beside them, not
   * the forty links of the pathway they arrived through, and the specification is
   * not a page of that pathway. `aside` is the rail; `mobile` is the same list
   * inside the menu, for the widths where the rail is hidden.
   */
  rail: { aside: string; mobile: string };
}

export interface SpecPagesOpts {
  /** The chapter directory. Defaults to `docs/spec/document-model/`. */
  srcDir?: string;
  /** Markdown to HTML, through the site's one DocsRenderContext. */
  render: (md: string) => string;
  /** The rendered chapter in the standalone page chrome. */
  wrap: (page: SpecWrapPage, content: string) => string;
  /** Overrides `SPEC_VERSION`. */
  version?: string;
  /** Overrides `SPEC_UPDATED_AT`. */
  updatedAt?: string;
}

/** `01-constitution.md` becomes `constitution`. */
export function chapterSlug(file: string): string {
  return file.replace(/\.md$/, '').replace(/^\d+[-_]/, '');
}

/** A chapter's title is its H1. Without one, the slug stands in rather than nothing. */
export function chapterTitle(md: string, slug: string): string {
  const h1 = /^#\s+(.+?)\s*$/m.exec(md);
  if (!h1) return slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return h1[1]!.trim();
}

/**
 * One sentence about the chapter, for the share preview and the browser's list.
 * The first ordinary paragraph after the H1 and the draft notice: the notice is the
 * same on every chapter, so a preview built from it would say the same thing twelve
 * times and nothing about the chapter.
 */
export function chapterDescription(md: string, title: string): string {
  const body = md.replace(/^#\s+.*$/m, '');
  for (const para of body.split(/\n\s*\n/)) {
    const text = para.trim();
    if (!text || text.startsWith('>') || text.startsWith('#') || text.startsWith('|')) continue;
    if (text.startsWith('!') || text.startsWith('-') || text.startsWith('```')) continue;
    const flat = text.replace(/\s*\n\s*/g, ' ').replace(/[*_`]/g, '');
    const sentence = /^(.+?[.!?])(\s|$)/.exec(flat)?.[1] ?? flat;
    return sentence.length > 300 ? `${sentence.slice(0, 297).trimEnd()}...` : sentence;
  }
  return `${title} - a chapter of the Lolly document model draft.`;
}

/** The chapters on disk, in filename order. An absent directory reads as none. */
export function readSpecChapters(srcDir: string = SPEC_SRC_DIR): SpecChapter[] {
  if (!existsSync(srcDir)) return [];
  return readdirSync(srcDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const md = readFileSync(resolve(srcDir, file), 'utf-8');
      const slug = chapterSlug(file);
      const title = chapterTitle(md, slug);
      return { file, slug, title, description: chapterDescription(md, title), md };
    });
}

/** Tags out, the handful of entities the renderer emits back to their characters. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The headings of one rendered chapter, in document order. Read back out of the
 * HTML rather than off the markdown so the ids are exactly the ones the page
 * carries - a deep link from the browser has to reach the heading, and `headingId`
 * in docs-render is the only thing that decides what an id is.
 */
export function headingsOf(html: string): SpecHeading[] {
  const out: SpecHeading[] = [];
  for (const m of html.matchAll(/<h([2-4]) id="([^"]*)">([\s\S]*?)<\/h\1>/g)) {
    out.push({ id: m[2]!, text: plainText(m[3]!), level: Number(m[1]) });
  }
  return out;
}

/** A chapter's number in reading order, from its source filename (`01-...` reads `01`). */
export function chapterNumber(file: string): string {
  return /^(\d+)/.exec(file)?.[1] ?? '';
}

/** Where one chapter is served. */
export function chapterHref(slug: string): string {
  return `/info/${SPEC_BASE}/${slug}.html`;
}

/**
 * The draft's front door: the summary page in the docs site's Architecture group.
 * It is the chapters' parent, so it is what the rail's home link points at rather
 * than the site root - a reader who leaves a chapter upward should arrive at the
 * document the chapter belongs to.
 */
export const SPEC_HOME_HREF = '/info/build/document-model.html';

/** The label on that home link, and the mobile menu's heading for the chapter list. */
export const SPEC_HOME_LABEL = 'Document model draft';

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One chapter, rendered, with the headings its own HTML carries. */
export interface RenderedChapter {
  chapter: SpecChapter;
  content: string;
  headings: SpecHeading[];
}

/**
 * The rail one chapter page carries: every chapter in reading order, the current
 * one marked, and under it that chapter's own headings.
 *
 * It wears the site's own sidebar classes rather than a set of its own, so it
 * inherits the rail's type, spacing, hover and dark theme from one stylesheet and
 * cannot drift from the rails beside it. The same shape the in-app browser at
 * `#/document-model` draws, so a reader who moves between the two surfaces finds
 * the document arranged the same way.
 *
 * Headings stop at level 3. Level 4 exists in three chapters and belongs to the
 * page's own reading, not to a list that has to stay scannable beside it.
 */
export function specRailHtml(rendered: RenderedChapter[], currentSlug: string): string {
  const rows = rendered.map(({ chapter, headings }) => {
    const current = chapter.slug === currentSlug;
    const link = `<a href="${chapterHref(chapter.slug)}"${current ? ' class="active" aria-current="page"' : ''}>`
      + `<span class="spec-n" aria-hidden="true">${escapeHtml(chapterNumber(chapter.file))}</span>`
      + `<span>${escapeHtml(chapter.title)}</span></a>`;
    if (!current) return link;
    const heads = headings
      .filter((h) => h.level <= 3)
      .map((h) => `<li><a href="#${escapeHtml(h.id)}"${h.level === 3 ? ' class="is-sub"' : ''}>${escapeHtml(h.text)}</a></li>`)
      .join('\n      ');
    return heads ? `${link}\n    <ol class="spec-heads">\n      ${heads}\n    </ol>` : link;
  }).join('\n    ');
  return `<aside class="docs-sidebar spec-rail">
    <a href="${SPEC_HOME_HREF}" class="sidebar-home">\u2190 ${SPEC_HOME_LABEL}</a>
    <div class="sidebar-pathway">Chapters</div>
    ${rows}
  </aside>`;
}

/**
 * The same chapter list inside the mobile menu, where the rail itself is hidden.
 * Headings are left out: the menu is reached from the top of the page, and a
 * hundred and thirty entries there would bury the twelve a reader came for.
 */
export function specMobileNavHtml(chapters: SpecChapter[], currentSlug: string): string {
  const links = chapters.map((c) =>
    `<a href="${chapterHref(c.slug)}"${c.slug === currentSlug ? ' class="active"' : ''}>${escapeHtml(c.title)}</a>`).join('');
  return `<div class="nav-mobile-page"><div class="nav-mobile-title">${SPEC_HOME_LABEL}</div>${links}</div>`;
}

/**
 * A cross-chapter link written as the source filename becomes the served page.
 * Authors write either form; `[records](02-records.md)` and `[records](records.html)`
 * must reach the same page, and only one of them exists on the site.
 */
function linkChapters(md: string, chapters: SpecChapter[]): string {
  const bySource = new Map(chapters.map((c) => [c.file, c.slug]));
  return md.replace(/\]\((?:\.\/)?([\w.-]+\.md)(#[\w-]*)?\)/g, (whole, file: string, hash = '') => {
    const slug = bySource.get(file);
    return slug ? `](${slug}.html${hash})` : whole;
  });
}

/**
 * Two corrections to the wrapped page, made here rather than in `docs/build.ts` so
 * the page chrome stays one function for every page on the site.
 *
 * `wrapPage` derives a page's own URL from its slug, and a slug with a slash in it
 * means a side door served as a directory (`/info/formats/svg/`). These chapters are
 * not served that way: they are plain `.html` files under one directory, so the
 * canonical link and the share URL have to name the file that exists.
 *
 * The locale `<link rel="alternate">` lines go with it. The draft is English only
 * this wave - nothing under `/info/<lang>/spec/` is built - and an hreflang pointing
 * at a page nobody wrote is a claim the site cannot keep. The language picker's own
 * per-locale links are collapsed onto the English page for the same reason: a reader
 * who picks another language stays on the chapter instead of reaching a 404, which
 * is as close to the site's usual fallback (English body, localized chrome) as an
 * untranslated document can get.
 */
function fixChapterUrls(html: string, slug: string): string {
  const served = `/info/${SPEC_BASE}/${slug}.html`;
  return html
    .replace(/^<link rel="alternate" hreflang="[^"]*" href="[^"]*\/info\/[a-z][\w-]*\/spec\/[^"]*">\n?/gm, '')
    .replace(new RegExp(`/info/(?:[a-z][a-z-]*/)?${SPEC_BASE}/${slug}/`, 'g'), served);
}

/**
 * Every file the specification publishes, keyed by its path under the build's
 * output dir (`/info/`). An empty chapter directory returns nothing at all rather
 * than an empty index: a draft with no chapters is a checkout that has not written
 * them, not a published document with nothing in it.
 */
export function buildSpecPages(o: SpecPagesOpts): Record<string, string> {
  const chapters = readSpecChapters(o.srcDir);
  if (!chapters.length) return {};

  const files: Record<string, string> = {};
  const index: SpecIndex = {
    version: o.version ?? SPEC_VERSION,
    updatedAt: o.updatedAt ?? SPEC_UPDATED_AT,
    chapters: [],
  };

  // Render every chapter before wrapping any of them. Each page's rail lists all
  // twelve and lists the current chapter's own headings, so the whole set has to
  // exist before the first page can be wrapped.
  const rendered: RenderedChapter[] = chapters.map((chapter) => {
    const content = o.render(linkChapters(chapter.md, chapters));
    return { chapter, content, headings: headingsOf(content) };
  });

  for (const { chapter, content, headings } of rendered) {
    const page: SpecWrapPage = {
      slug: chapter.slug,
      title: chapter.title,
      description: chapter.description,
      rail: {
        aside: specRailHtml(rendered, chapter.slug),
        mobile: specMobileNavHtml(chapters, chapter.slug),
      },
    };
    files[`${SPEC_BASE}/${chapter.slug}.html`] = fixChapterUrls(o.wrap(page, content), chapter.slug);
    index.chapters.push({
      slug: chapter.slug,
      title: chapter.title,
      file: chapter.file,
      headings,
    });
  }

  files[`${SPEC_BASE}/${SPEC_INDEX_FILE}`] = `${JSON.stringify(index, null, 2)}\n`;
  files[`${SPEC_BASE}/${SPEC_TWIN_FILE}`] = [
    `The Lolly document model, ${index.version}: every chapter of docs/spec/document-model/ in reading order.`,
    ...chapters.map((c) => linkChapters(c.md, chapters).trim()),
  ].join('\n\n') + '\n';

  return files;
}

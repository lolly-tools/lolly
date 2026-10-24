// SPDX-License-Identifier: MPL-2.0
/**
 * Links that name a Markdown source file, resolved to a URL a reader can open.
 *
 * A page is written as `create-a-tool.md` and served as /info/create/create-a-tool.html,
 * so a link to the source file (the form GitHub follows, used by the README and
 * the guides that render there too) opened the raw Markdown twin when the two pages
 * shared a directory and a 404 when they did not. `resolveSourceLink` maps such a link
 * to the published page, or to the file on GitHub when the site does not publish that
 * file.
 * `unpublishedLinks` names whatever is left over, so the build can refuse to publish
 * a page that still carries one.
 */
import { posix } from 'node:path';

/** The fields of a registry page (docs/manifest.json) that a link can resolve to. */
export interface LinkablePage {
  /** The source, relative to docs/: `create-a-tool.md`, `work/governance.md`, `../README.md`. */
  src: string;
  /** The published path under /info/, without `.html`: `create/create-a-tool`. */
  path: string;
}

export interface SourceLinkOptions {
  pages: readonly LinkablePage[];
  /** True when a repository-relative path is a file in this repository. */
  repoFile: (repoPath: string) => boolean;
  /** The GitHub blob root a repository file is linked under. */
  blobRoot?: string;
}

export const REPO_BLOB_ROOT = 'https://github.com/lolly-tools/lolly/blob/main';

/** Has a scheme (`https:`, `mailto:`), is rooted (`/info/...`) or is a same-page anchor. */
const NOT_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;

/** plans/ is gitignored, local to the maintainer's machine; a link into it always 404s. */
const PLANS = /(?:^|\/)plans\//;

/** A normalised repository path that stays inside the repository. */
const inRepo = (path: string): boolean => path !== '..' && !path.startsWith('../');

/** The repository path of a page source: `create-a-tool.md` → `docs/create-a-tool.md`. */
export function sourceRepoPath(src: string): string {
  return posix.normalize(posix.join('docs', src));
}

/**
 * Resolve a relative link to a `.md` file, written in the page whose registry source is
 * `fromSrc`, to the URL that serves the file. A locale page passes its English source,
 * because a translation keeps the English link targets. Returns null when the link is
 * not a relative `.md` link, or when it points at nothing this repository can serve, which
 * the build's link audit then reports.
 *
 * Resolution order: the target relative to the linking page's own directory (the way
 * GitHub follows a link), then the target read as a registry `src`, then as a repository
 * path. The first that matches a registered page wins, and the link becomes
 * /info/<path>.html with its #anchor kept. Otherwise a file that exists in the
 * repository, outside plans/, becomes its GitHub blob URL on main.
 */
export function resolveSourceLink(url: string, fromSrc: string, opts: SourceLinkOptions): string | null {
  if (NOT_RELATIVE.test(url)) return null;
  const boundary = url.search(/[?#]/);
  const target = boundary < 0 ? url : url.slice(0, boundary);
  const suffix = boundary < 0 ? '' : url.slice(boundary);
  if (!/\.md$/i.test(target)) return null;

  const fromDir = fromSrc ? posix.dirname(sourceRepoPath(fromSrc)) : 'docs';
  const relative = posix.normalize(posix.join(fromDir, target));
  const candidates = [relative, sourceRepoPath(target), posix.normalize(target)].filter(inRepo);

  const bySource = new Map<string, LinkablePage>();
  for (const page of opts.pages) if (page.src && !bySource.has(sourceRepoPath(page.src))) bySource.set(sourceRepoPath(page.src), page);
  for (const path of candidates) {
    const page = bySource.get(path);
    if (page) return `/info/${page.path}.html${suffix}`;
  }

  if (inRepo(relative) && !PLANS.test(relative) && opts.repoFile(relative)) {
    return `${opts.blobRoot ?? REPO_BLOB_ROOT}/${relative}${suffix}`;
  }
  return null;
}

/**
 * True for a link into a plans/ directory: a relative or rooted path on this site, or a
 * file on GitHub. Another site's /plans/ page (a pricing page, say) is not one.
 */
export function pointsIntoPlans(href: string): boolean {
  const path = href.replace(/[?#].*$/, '');
  const local = !/^[a-z][a-z0-9+.-]*:/i.test(path);
  return (local && PLANS.test(path)) || /^https?:\/\/(?:www\.)?github\.com\/.*\/plans\//i.test(path);
}

/**
 * The hrefs in a built page that a reader cannot follow: a relative link to a `.md`
 * file (the site serves pages as .html), or a link into plans/.
 */
export function unpublishedLinks(html: string): string[] {
  const found: string[] = [];
  for (const m of html.matchAll(/\shref="([^"]*)"/g)) {
    const href = m[1]!;
    const markdown = !NOT_RELATIVE.test(href) && /\.md$/i.test(href.replace(/[?#].*$/, ''));
    if (markdown || pointsIntoPlans(href)) found.push(href);
  }
  return found;
}

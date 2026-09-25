// SPDX-License-Identifier: MPL-2.0
/**
 * Fetching and rehosting a page the static /info build already wrote.
 *
 * Two views read those pages: the documentation reader (views/docs.ts) and the
 * specification browser (views/document-model.ts). Both do the same four steps,
 * and this module holds them as plain functions so neither copies the other:
 *
 *   1. fetch a page, trying an ordered list of URLs until one answers;
 *   2. follow the single meta-refresh stub a flat pre-177 URL still serves;
 *   3. find the `.docs-content` fragment inside the parsed page;
 *   4. rehost that fragment's children into a node this document owns, with the
 *      caller's own strip list and link rewriter applied first.
 *
 * Nothing here paints chrome, writes a status message or reads a global fetch:
 * the caller hands the fetch in and decides what each failure looks like. Every
 * node is made with createElement and importNode, so this module adds no raw-HTML
 * sink to the inventory primitive-guards.test.ts pins.
 */

/** Why a page did not arrive. `abandoned` means the view unmounted mid-fetch. */
export type DocFetchFailure = 'missing' | 'error' | 'abandoned';

export type DocFetchResult =
  | { ok: true; html: string; url: string }
  | { ok: false; reason: DocFetchFailure };

export interface DocFetchRequest {
  /** Page URLs in preference order. The first that answers wins; blanks and
   *  repeats are dropped, so a caller may pass a fallback that equals the first. */
  urls: readonly string[];
  /** The fetch to call. Pass a closure, not a bare `fetch` reference: a browser
   *  refuses a call whose `this` is not the window. */
  fetch: (input: string, init?: RequestInit) => Promise<{ ok: boolean; text: () => Promise<string> }>;
  /** Answered after each await. False abandons the load without a message. */
  alive?: () => boolean;
}

/** The meta refresh a flat pre-177 URL serves, pointing at the page's doored home. */
const REFRESH_STUB = /<meta http-equiv="refresh" content="0; url=(\/info\/[\w/-]+\.html)">/;

/** The two markers the build stamps on a page body: `.docs-content` on a doc
 *  page, `.docs-landing` on the front door and the immersive pages. */
export const DOC_FRAGMENT_SELECTOR = '.docs-content, .docs-landing';

/**
 * Fetch the first URL that answers, then follow one meta-refresh stub in place.
 * A page that redirects is read from its target; a stub whose target is missing
 * keeps the stub's own body, which is what the reader did before this moved here.
 */
export async function fetchDocHtml(req: DocFetchRequest): Promise<DocFetchResult> {
  const alive = req.alive ?? ((): boolean => true);
  const urls = [...new Set(req.urls.filter(Boolean))];
  try {
    for (const url of urls) {
      const res = await req.fetch(url, { credentials: 'same-origin' });
      if (!alive()) return { ok: false, reason: 'abandoned' };
      if (!res.ok) continue;
      let html = await res.text();
      const stub = REFRESH_STUB.exec(html);
      if (stub) {
        const followed = await req.fetch(stub[1]!, { credentials: 'same-origin' });
        if (!alive()) return { ok: false, reason: 'abandoned' };
        if (followed.ok) html = await followed.text();
      }
      return { ok: true, html, url };
    }
  } catch {
    return { ok: false, reason: alive() ? 'error' : 'abandoned' };
  }
  return { ok: false, reason: 'missing' };
}

/** The body fragment of a parsed /info page, or null when the page has none. */
export function findDocFragment(doc: Document, selector: string = DOC_FRAGMENT_SELECTOR): Element | null {
  return doc.querySelector(selector);
}

export interface RehostOpts {
  /** A selector whose matches are removed before the rehost. The reader passes
   *  `script, .listen-bar`: a fetched page's scripts must never run. */
  strip?: string;
  /** Runs on the fragment before it is imported, to point its links in-app. */
  rewriteLinks?: (root: ParentNode) => void;
  /** The element the children are rehosted into. `article` by default, because
   *  the built fragment is a `<main>` and #view is already the page's `<main>`. */
  tag?: string;
}

/**
 * Move a parsed page's fragment into this document. The fragment's own class
 * list rides across, so the same stylesheet rules apply to the rehosted copy.
 */
export function rehostFragment(fragment: Element, opts: RehostOpts = {}): HTMLElement {
  if (opts.strip) for (const el of [...fragment.querySelectorAll(opts.strip)]) el.remove();
  opts.rewriteLinks?.(fragment);
  const imported = document.importNode(fragment, true) as HTMLElement;
  const node = document.createElement(opts.tag ?? 'article');
  node.className = imported.className;
  node.replaceChildren(...Array.from(imported.childNodes));
  return node;
}

/**
 * Scroll one stamped heading of a rehosted fragment into view, opening every
 * closed `<details>` above it first: a target inside a shut disclosure would
 * otherwise land on the summary and read as broken. Returns whether the heading
 * is there, so a click handler can call preventDefault only when it will act.
 */
export function scrollToHeading(root: HTMLElement, id: string, behavior: ScrollBehavior): boolean {
  const target = id ? root.querySelector(`#${CSS.escape(id)}`) : null;
  if (!target) return false;
  for (
    let d = target.closest('details');
    d && root.contains(d);
    d = d.parentElement?.closest('details') ?? null
  ) {
    d.open = true;
  }
  try { target.scrollIntoView({ behavior, block: 'start' }); } catch { /* jsdom has no layout */ }
  return true;
}

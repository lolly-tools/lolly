// SPDX-License-Identifier: MPL-2.0
/**
 * A page's contents, for both readers: the rail beside the article on a wide screen and
 * the floating "Contents" button everywhere narrower (markup from packages/docs-render
 * contents.ts, styles in styles/parts/docs-chrome.css). The in-app reader imports this
 * module (views/docs.ts) and docs/build.ts bundles the same file into the /info page
 * script, so the two readers open, close and follow the page the same way.
 *
 * What it does:
 *   - marks the section being read in every list (`aria-current="location"`), and keeps
 *     that row in view inside a rail that scrolls on its own;
 *   - opens and closes the floating panel. Escape closes it and returns focus to the
 *     button; so does choosing a row. A press outside, or focus moving out, closes it
 *     without taking focus anywhere. Escape is only taken while the panel is open.
 *   - in the app only, hands a row's click to `jump`, which scrolls the reader's own
 *     view: there the address is the route, so a bare `#id` must not reach it.
 *
 * Every link is a real `#id` link, so on /info a row works with no script at all, and a
 * modified click (new tab, copy link) is always left to the browser.
 */

export interface DocsContentsOptions {
  /** The article the links point into. */
  article: ParentNode;
  /** The element holding the rail and the floating control (the page, or the reader). */
  root: ParentNode;
  /** In the app: scroll to the heading with this id ('' is the top of the page) and
   *  answer whether it did. On /info this is absent and the browser follows the link. */
  jump?: (id: string) => boolean;
  /** Where reading happens, in px from the top of the viewport. A heading at or above
   *  the reading line marks the section being read. */
  readingLine?: () => number;
}

/** Wire the page's contents lists and floating control. Returns the function that
 *  removes every listener it added. A page with no contents is a no-op. */
export function enhanceDocsContents(o: DocsContentsOptions): () => void {
  const doc = (o.root as Node).ownerDocument ?? (o.root as Document);
  const win = doc.defaultView;
  if (!win) return () => {};
  const links = Array.from(o.root.querySelectorAll<HTMLAnchorElement>('a[data-contents-target]'));
  const control = o.root.querySelector<HTMLElement>('[data-doc-contents]');
  if (!links.length && !control) return () => {};

  const off: Array<() => void> = [];
  const listen = (target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions): void => {
    target.addEventListener(type, fn, opts);
    off.push(() => target.removeEventListener(type, fn, opts));
  };

  // ── The section being read ────────────────────────────────────────────────────
  const ids = Array.from(new Set(links.map((a) => a.dataset.contentsTarget || '').filter(Boolean)));
  const headings = ids
    .map((id) => ({ id, el: findHeading(o.article, doc, id) }))
    .filter((h): h is { id: string; el: HTMLElement } => !!h.el);
  const lists = Array.from(new Set(links.map((a) => a.closest('ul') ?? a.parentElement).filter((l): l is HTMLElement => !!l)));
  const line = o.readingLine ?? (() => Math.round(win.innerHeight * 0.25));

  let frame = 0;
  const mark = (): void => {
    frame = 0;
    const y = line();
    // The last heading at or above the reading line, in document order.
    const above = new Set<string>();
    for (const h of headings) {
      if (h.el.getBoundingClientRect().top <= y) above.add(h.id);
      else break;
    }
    for (const list of lists) {
      const rows = Array.from(list.querySelectorAll<HTMLAnchorElement>('a[data-contents-target]'));
      let current: HTMLAnchorElement | null = null;
      for (const a of rows) if (above.has(a.dataset.contentsTarget || '')) current = a;
      for (const a of rows) {
        const on = a === current;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      }
      if (current) keepInView(current);
    }
  };
  const schedule = (): void => {
    if (!frame) frame = win.requestAnimationFrame(mark);
  };
  if (headings.length) {
    listen(win, 'scroll', schedule, { passive: true });
    listen(win, 'resize', schedule, { passive: true });
    off.push(() => { if (frame) win.cancelAnimationFrame(frame); });
    mark();
  }

  // ── A row's click ─────────────────────────────────────────────────────────────
  // In the app the reader scrolls its own view; on /info the browser follows the link.
  const onRow = (e: Event): void => {
    const me = e as MouseEvent;
    const a = (me.target as Element | null)?.closest?.('a[data-contents-target]') as HTMLAnchorElement | null;
    if (!a || me.defaultPrevented) return;
    if (me.metaKey || me.ctrlKey || me.shiftKey || me.altKey || me.button > 0) return;
    const inPanel = !!control && control.contains(a);
    if (inPanel) close(false);
    if (o.jump && o.jump(a.dataset.contentsTarget || '')) me.preventDefault();
  };
  listen(o.root, 'click', onRow);

  // ── The floating control ──────────────────────────────────────────────────────
  const btn = control?.querySelector<HTMLButtonElement>('.doc-contents-btn') ?? null;
  const panel = control?.querySelector<HTMLElement>('.doc-contents-panel') ?? null;
  const isOpen = (): boolean => !!panel && !panel.hidden;
  function open(): void {
    if (!btn || !panel) return;
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    mark();
    const first = panel.querySelector<HTMLAnchorElement>('a[aria-current]') ?? panel.querySelector<HTMLAnchorElement>('a');
    first?.focus({ preventScroll: true });
    // The current row may sit below the panel's fold.
    if (first) keepInView(first);
  }
  function close(focusButton: boolean): void {
    if (!btn || !panel || panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (focusButton) btn.focus({ preventScroll: true });
  }
  if (btn && panel && control) {
    listen(btn, 'click', () => (isOpen() ? close(true) : open()));
    // Escape is taken only while the panel is open, and stops there, so an outer layer
    // (the app's search bar, a dialog behind) does not also act on the same key.
    listen(doc, 'keydown', (e) => {
      const k = e as KeyboardEvent;
      if (k.key !== 'Escape' || !isOpen()) return;
      k.stopPropagation();
      close(true);
    }, { capture: true });
    listen(doc, 'pointerdown', (e) => {
      if (isOpen() && !control.contains(e.target as Node)) close(false);
    });
    listen(control, 'focusout', (e) => {
      const next = (e as FocusEvent).relatedTarget as Node | null;
      if (next && !control.contains(next)) close(false);
    });
  }

  return () => { for (const f of off.splice(0)) f(); };
}

/** The heading a row points at: inside the article first (the app rehosts the page into
 *  a view that holds other content too), then anywhere in the document. */
function findHeading(article: ParentNode, doc: Document, id: string): HTMLElement | null {
  const inArticle = Array.from(article.querySelectorAll<HTMLElement>('[id]')).find((el) => el.id === id);
  return inArticle ?? doc.getElementById(id);
}

/** Scroll a rail or panel (never the page) so the marked row stays visible. */
function keepInView(row: HTMLElement): void {
  let box: HTMLElement | null = row.parentElement;
  while (box) {
    const s = box.ownerDocument.defaultView?.getComputedStyle(box);
    if (s && /(auto|scroll)/.test(s.overflowY) && box.scrollHeight > box.clientHeight) break;
    box = box.parentElement;
  }
  if (!box || box === box.ownerDocument.body || box === box.ownerDocument.documentElement) return;
  const r = row.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  if (r.top < b.top + 8) box.scrollTop -= (b.top + 8) - r.top;
  else if (r.bottom > b.bottom - 8) box.scrollTop += r.bottom - (b.bottom - 8);
}

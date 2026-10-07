// SPDX-License-Identifier: MPL-2.0
/**
 * Grids that draw a page of tiles, not the whole list.
 *
 * A connected library can hold tens of thousands of assets, and a picker that
 * builds a card for every one of them on open (and again on every keystroke)
 * stalls the tab. This module keeps the list in memory and puts only the first
 * `pageSize` cards in the DOM. A "Show more" button follows the grid; when it
 * scrolls near view an IntersectionObserver presses it, so a scroll reads as one
 * continuous grid and a keyboard or a browser without the observer still has the
 * button. Further pages are appended in place: nothing already drawn is rebuilt,
 * so scroll position, focus and live thumbnails all survive.
 *
 * `defer()` does the same for a collapsed section: its body is a placeholder
 * until `expand()` is called, so a folded group costs nothing to build.
 */
import { escapeHtml } from './html.ts';

export interface LazyGridOptions<T> {
  /** Cards per page. */
  pageSize: number;
  /** One card's markup. */
  render(item: T): string;
  /** The grid element's class list. */
  gridClass: string;
  /** Called after cards were added to the DOM (a page appended or a deferred body built). */
  onAppend?(container: HTMLElement): void;
  /** The button's text for `shown` of `total` cards. */
  moreLabel(shown: number, total: number): string;
}

export interface LazyGrid<T> {
  /** A grid of the first page of `items`, followed by a Show more button while more remain. */
  grid(items: readonly T[]): string;
  /** A placeholder whose markup is built only when its section is expanded. */
  defer(build: () => string): string;
  /** Build any deferred body inside `section`; true when something was built. */
  expand(section: Element): boolean;
  /** Append the next page for one Show more button; returns how many cards were added. */
  more(button: Element): number;
  /** Start watching the Show more buttons inside `container` (call after each paint). */
  observe(container: HTMLElement): void;
  /** Forget pending lists and deferred bodies; call before replacing the container's markup. */
  reset(): void;
  /** Stop observing for good. */
  disconnect(): void;
}

function scrollParent(el: Element | null): Element | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return node;
  }
  return null;
}

export function createLazyGrid<T>(opts: LazyGridOptions<T>): LazyGrid<T> {
  const pages = new Map<string, { items: readonly T[]; shown: number }>();
  const deferred = new Map<string, () => string>();
  const wired = new WeakSet<HTMLElement>();
  let seq = 0;
  let observer: IntersectionObserver | null = null;
  let observerRoot: Element | null | undefined;

  const buttonHtml = (id: string, shown: number, total: number): string =>
    `<button type="button" class="btn btn--ghost btn--sm lazy-grid-more" data-lazy-more="${id}">${escapeHtml(opts.moreLabel(shown, total))}</button>`;

  const api: LazyGrid<T> = {
    grid(items) {
      const id = `g${++seq}`;
      const shown = Math.min(items.length, opts.pageSize);
      if (shown < items.length) pages.set(id, { items, shown });
      return `<div class="${opts.gridClass}" data-lazy-grid="${id}">${items.slice(0, shown).map(opts.render).join('')}</div>`
        + (shown < items.length ? buttonHtml(id, shown, items.length) : '');
    },
    defer(build) {
      const id = `d${++seq}`;
      deferred.set(id, build);
      return `<div data-lazy-deferred="${id}"></div>`;
    },
    expand(section) {
      let built = false;
      for (const holder of section.querySelectorAll<HTMLElement>('[data-lazy-deferred]')) {
        const build = deferred.get(holder.dataset.lazyDeferred ?? '');
        if (!build) continue;
        deferred.delete(holder.dataset.lazyDeferred!);
        holder.insertAdjacentHTML('beforebegin', build());
        holder.remove();
        built = true;
      }
      if (built) {
        api.observe(section as HTMLElement);
        opts.onAppend?.(section as HTMLElement);
      }
      return built;
    },
    more(button) {
      const id = (button as HTMLElement).dataset?.lazyMore ?? '';
      const page = pages.get(id);
      const grid = button.parentElement?.querySelector<HTMLElement>(`[data-lazy-grid="${id}"]`);
      if (!page || !grid) return 0;
      const next = page.items.slice(page.shown, page.shown + opts.pageSize);
      grid.insertAdjacentHTML('beforeend', next.map(opts.render).join(''));
      page.shown += next.length;
      if (page.shown >= page.items.length) {
        pages.delete(id);
        observer?.unobserve(button);
        button.remove();
      } else {
        button.textContent = opts.moreLabel(page.shown, page.items.length);
        // Re-observing reports the button's current state at once, so a tall
        // viewport that still shows it after this page asks for the next one.
        if (observer) { observer.unobserve(button); observer.observe(button); }
      }
      opts.onAppend?.(grid);
      return next.length;
    },
    observe(container) {
      if (!wired.has(container)) {
        wired.add(container);
        container.addEventListener('click', (event) => {
          const button = (event.target as Element | null)?.closest?.('[data-lazy-more]');
          if (!button || !container.contains(button)) return;
          event.preventDefault();
          api.more(button);
        });
      }
      const buttons = [...container.querySelectorAll<HTMLElement>('[data-lazy-more]')];
      if (!buttons.length || typeof IntersectionObserver === 'undefined') return;
      const root = scrollParent(buttons[0]!);
      if (!observer || observerRoot !== root) {
        observer?.disconnect();
        observerRoot = root;
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) if (entry.isIntersecting && entry.target.isConnected) api.more(entry.target);
        }, { root, rootMargin: '0px 0px 600px 0px' });
      }
      for (const button of buttons) observer.observe(button);
    },
    reset() {
      pages.clear();
      deferred.clear();
      observer?.disconnect();
      observer = null;
      observerRoot = undefined;
    },
    disconnect() {
      api.reset();
    },
  };
  return api;
}

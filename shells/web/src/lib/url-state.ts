// SPDX-License-Identifier: MPL-2.0
import { rememberOverlayUrlState, routeBase } from './overlay-back.ts';
/**
 * Address-bar state writes keep the mounted view and its history entry. Returns false
 * when the browser refused the write. WebKit and Firefox throw once a page calls
 * replaceState too often, and an address past the browser's limit can throw too. A
 * refused write leaves the address as it was, and never throws into the caller, so a
 * paint that ends with an address write still finishes.
 */
export function replaceRouteUrl(url: string, state: unknown = window.history.state): boolean {
  try {
    window.history.replaceState(state, '', url);
  } catch (error) {
    console.warn('[lolly] the browser refused an address write', error);
    return false;
  }
  rememberOverlayUrlState();
  window.dispatchEvent(new window.Event('lolly:url-state'));
  return true;
}

export function routeParams(href: string = window.location.href): URLSearchParams {
  const url = new URL(href);
  return new URLSearchParams(url.hash.startsWith('#/') ? url.hash.split('?').slice(1).join('?') : url.search);
}

export function mergeRouteParams(href: string, changes: Record<string, string | number | boolean | null>): string {
  const url = new URL(href);
  const params = routeParams(href);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, String(value));
  }
  const query = params.toString();
  if (url.hash.startsWith('#/')) url.hash = `${url.hash.split('?')[0]}${query ? `?${query}` : ''}`;
  else url.search = query;
  return url.href;
}

export function updateRouteParams(changes: Record<string, string | number | boolean | null>): void {
  replaceRouteUrl(mergeRouteParams(window.location.href, changes));
}

/** An address write that waits until its value stops changing. */
export interface SettledWrite {
  /** Note a change. The write runs once, the settle time after the last change. */
  schedule(): void;
  /** Run a waiting write now. */
  flush(): void;
  /** Drop a waiting write, so nothing is written. */
  cancel(): void;
  /** True while a write is waiting. */
  pending(): boolean;
}

/** A refused write is tried again after 1, 2, 4 and 8 seconds, which gives a rate limit
 *  time to pass, and then waits for the next change or flush. */
const RETRY_MS = 1000;
const RETRIES = 4;
const waiting = new Set<SettledWrite>();
let flushOnHide = false;

/**
 * Write the address once a burst of changes settles, not on every change. Each write
 * parses and rebuilds the whole address, which can hold the whole document, and wakes
 * every `lolly:url-state` listener. Browsers also refuse a page that writes too often.
 *
 * `write` builds the address from the latest state when it runs and returns false when
 * the browser refused the write. A write that belongs to a route the page has since left is
 * dropped. Anything that reads the address, or leaves the page, calls
 * {@link flushAddressWrites} first.
 */
export function settledWrite(write: () => boolean, settleMs: number): SettledWrite {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let route = '';
  let retries = 0;
  const stop = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    waiting.delete(writer);
  };
  const arm = (ms: number): void => {
    waiting.add(writer);
    timer = setTimeout(run, ms);
  };
  const run = (): void => {
    stop();
    if (routeBase(window.location.href) !== route) return;
    if (write()) { retries = 0; return; }
    if (retries < RETRIES) arm(RETRY_MS * 2 ** retries++);
  };
  const writer: SettledWrite = {
    schedule() {
      if (!waiting.has(writer)) route = routeBase(window.location.href);
      stop();
      retries = 0;
      listenForHide();
      arm(settleMs);
    },
    flush() { if (waiting.has(writer)) run(); },
    cancel: stop,
    pending: () => waiting.has(writer),
  };
  return writer;
}

/** Run every waiting address write now: before something reads the address, and when
 *  the page is hidden or left, so a reload or a copied address carries the latest state. */
export function flushAddressWrites(): void {
  for (const writer of [...waiting]) writer.flush();
}

function listenForHide(): void {
  if (flushOnHide) return;
  flushOnHide = true;
  window.addEventListener('pagehide', flushAddressWrites);
  window.document.addEventListener('visibilitychange', () => {
    if (window.document.visibilityState === 'hidden') flushAddressWrites();
  });
}

/** Restore disclosures before listening, without replaying preference writes. */
export function bindDisclosureUrl(root: HTMLElement, params: URLSearchParams = routeParams()): () => void {
  const details = [...root.querySelectorAll<HTMLDetailsElement>('details[id]')];
  if (params.has('_open')) {
    const open = new Set((params.get('_open') ?? '').split(','));
    for (const detail of details) detail.open = open.has(detail.id);
  }
  const states = new Map(details.map(detail => [detail, detail.open]));
  const sync = (event: Event): void => {
    const detail = event.target as HTMLDetailsElement;
    if (!root.isConnected || detail.open === states.get(detail)) return;
    states.set(detail, detail.open);
    updateRouteParams({ _open: details.filter(item => item.open).map(item => item.id).join(',') });
  };
  for (const detail of details) detail.addEventListener('toggle', sync);
  return () => { for (const detail of details) detail.removeEventListener('toggle', sync); };
}

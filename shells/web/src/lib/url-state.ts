// SPDX-License-Identifier: MPL-2.0
import { rememberOverlayUrlState } from './overlay-back.ts';
/** Address-bar state writes keep the mounted view and its history entry. */
export function replaceRouteUrl(url: string, state: unknown = window.history.state): void {
  window.history.replaceState(state, '', url);
  rememberOverlayUrlState();
  window.dispatchEvent(new window.Event('lolly:url-state'));
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

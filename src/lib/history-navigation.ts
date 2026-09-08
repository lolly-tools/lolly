// SPDX-License-Identifier: MPL-2.0
/** The router normally keeps a tool mounted when only its query changes. A
 * history selection intentionally opens a different creation in that tool. */
export function navigateHistoryHref(href: string): void {
  location.hash = href;
  // Let the router resolve canonical paths, aliases and hashes itself. Its
  // subsequent hashchange/popstate is deduplicated against this forced mount.
  window.dispatchEvent(new Event('lolly:remount'));
}
export function bindHistoryLink(link: HTMLAnchorElement): void {
  link.addEventListener('click', event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigateHistoryHref(link.hash);
  });
}

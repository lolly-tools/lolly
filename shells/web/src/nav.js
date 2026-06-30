// SPDX-License-Identifier: MPL-2.0
// Minimal client-navigation helper shared across the shell.
//
// A tool's canonical address-bar URL is the crawler-visible PATH form /t/<id> (so a
// copied link carries the per-tool OG preview — see scripts/build-tool-og.js). The
// router (main.js parseRoute) understands both that and the legacy #/tool/<id> hash;
// this helper keeps the one History-API write that leaves a tool in a single place.

// Programmatic SPA navigation: set the URL (new history entry) and tell the router to
// re-render. pushState alone fires no event, so dispatch the router's own. Needed for
// in-app links that leave a tool (→ gallery): the old hash-clearing trick
// (location.hash = '') is a no-op against a path URL, so it wouldn't route.
export function navigateTo(url) {
  history.pushState(null, '', url);
  window.dispatchEvent(new Event('lolly:navigate'));
}

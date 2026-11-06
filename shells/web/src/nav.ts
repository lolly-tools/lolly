// SPDX-License-Identifier: MPL-2.0
// Minimal client-navigation helper shared across the shell.
//
// A tool's canonical address-bar URL is the crawler-visible PATH form /t/<id> (so a
// copied link carries the per-tool OG preview - see scripts/build-tool-og.ts). The
// router (main.js parseRoute) understands both that and the legacy #/tool/<id> hash;
// this helper keeps the one History-API write that leaves a tool in a single place.

import { noteLeavingHref } from './lib/back-nav.ts';
import { afterOwnBack } from './lib/overlay-back.ts';
import { flushAddressWrites } from './lib/url-state.ts';

// Programmatic SPA navigation: set the URL (new history entry) and tell the router to
// re-render. pushState alone fires no event, so dispatch the router's own. Needed for
// in-app links that leave a tool (→ gallery): the old hash-clearing trick
// (location.hash = '') is a no-op against a path URL, so it wouldn't route.
// A dialog that has just closed may still be popping its own history entry; the new
// entry waits for that pop, or the pop would remove it (lib/overlay-back.ts afterOwnBack).
export function navigateTo(url: string): void {
  afterOwnBack(() => {
    flushAddressWrites(); // the entry being left keeps the latest state of its view
    noteLeavingHref(window.location.href); // pushState fires no event with an oldURL - capture it here
    history.pushState(null, '', url);
    window.dispatchEvent(new Event('lolly:navigate'));
  });
}

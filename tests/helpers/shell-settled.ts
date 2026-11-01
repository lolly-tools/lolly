// SPDX-License-Identifier: MPL-2.0
/**
 * Wait until the web shell has settled its WebGPU startup check and no route is still
 * waiting behind the loading card (plan 295).
 *
 * Network idleness is not that signal. The check runs alongside boot, and every route
 * that can run a tool waits for it under a modal loading card; on a software adapter
 * the check can take seconds with no network traffic at all, so `networkidle` can fire
 * first. A test that then injects markup, presses keys or scrolls is acting on a page
 * whose view has not mounted, behind a modal that makes everything else inert. Call
 * this after a `goto` or `reload` that waited for `networkidle`, and after opening a
 * tool route before a locator wait with the usual 30 s timeout: the shell's device
 * budget under automation is 30 s too, so that wait can run out while the view is still
 * about to mount.
 *
 * The wait itself is the render driver's (packages/node-shell/src/shell-startup.ts), so
 * the browser tests and the CLI's browser tier read the same signal with the same budget.
 */
import type { Page } from 'playwright-core';
import { SHELL_STARTUP_TIMEOUT_MS, waitForShellStartup } from '../../packages/node-shell/src/shell-startup.ts';

export async function shellSettled(page: Page, timeout = SHELL_STARTUP_TIMEOUT_MS): Promise<void> {
  await waitForShellStartup(page, timeout);
}

/** `#view` carries this from the start of a navigation until its view has mounted (ROUTE_MOUNTING_ATTR in shells/web/src/lib/capture-neutral.ts). */
const ROUTE_MOUNTING_ATTR = 'data-route-mounting';

/**
 * Open `url` and wait until the shell has mounted the view it names.
 *
 * A `goto` that changes only the hash is a navigation inside the page. Playwright
 * returns once the address has changed, and the shell mounts the incoming view after
 * that. Until the incoming view replaces it, the outgoing one stays on screen and takes
 * clicks, and the loading card waits 150 ms before it covers both
 * (VIEW_LOADING_DELAY_MS in shells/web/src/components/view-loading.ts), so
 * `shellSettled` alone can pass in that gap. A click in that gap goes to the view that
 * is about to be replaced, and a point read in it can hit the card. This waits for the
 * hash to arrive and for `#view` to lose ROUTE_MOUNTING_ATTR, then for `shellSettled`.
 * A `goto` to another document waits for the attribute and `shellSettled` the same way.
 */
export async function gotoSettled(page: Page, url: string, timeout = SHELL_STARTUP_TIMEOUT_MS): Promise<void> {
  const from = page.url();
  const inPage = from !== url && from.split('#')[0] === url.split('#')[0];
  if (inPage) {
    await page.evaluate(() => {
      const w = window as unknown as { __lollyHashArrived?: boolean };
      w.__lollyHashArrived = false;
      addEventListener('hashchange', () => { w.__lollyHashArrived = true; }, { once: true });
    });
  }
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(([waitForHash, attr]) => {
    const arrived = !waitForHash || (window as unknown as { __lollyHashArrived?: boolean }).__lollyHashArrived === true;
    const view = document.getElementById('view');
    return arrived && !!view && !view.hasAttribute(attr);
  }, [inPage, ROUTE_MOUNTING_ATTR] as const, { timeout, polling: 100 });
  await shellSettled(page, timeout);
}

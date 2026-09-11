// SPDX-License-Identifier: MPL-2.0
import { escapeHtml } from './lib/util/escape.ts';

/** The shell's HTML escape, under the name most of the tree already imports.
 *  The implementation lives in lib/util/escape.ts beside the CSS and regex
 *  escapers, so the three semantics sit together and none of them can drift. */
export function escape(s: unknown): string {
  return escapeHtml(s);
}

/** Only http(s)/mailto or a relative path/hash reach the DOM as a link - a
 *  javascript:/data: href from a compromised control plane is dropped, not rendered.
 *  The shell stays safe on its own, independent of the control plane's own guard.
 *  escape() is NOT scheme validation: a javascript: URL contains none of the five
 *  escaped characters, so any remote-sourced href must pass through here too. */
export function safeHref(href: string): boolean {
  // A leading `//` or `/\` is NOT the relative path this contract promises - the
  // browser reads it as protocol-relative and navigates off-origin (`//evil.test`
  // becomes https://evil.test), and `\` is normalised to `/` in the authority. So
  // reject those before the allow-list, or "a relative path" quietly means
  // "any host".
  if (/^[/\\][/\\]/.test(href)) return false;
  return /^(https?:\/\/|mailto:|\/|#)/i.test(href) && !/[<>]/.test(href);
}

/** Route-change signals the web shell fires (see main.ts) - any one dismisses/tears
 *  down a body-mounted overlay so it never outlives the view that spawned it. The
 *  single source of truth for lang-menu, profile-menu, welcome-dialog and body-popover. */
export const NAV_EVENTS = ['hashchange', 'popstate', 'lolly:navigate'] as const;

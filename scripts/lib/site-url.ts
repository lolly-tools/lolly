// SPDX-License-Identifier: MPL-2.0
/**
 * The public origin a build's link previews point at.
 *
 * Share cards need absolute URLs (og:url, og:image, twitter:image), and the
 * pages that carry them are built once and then served wherever the build is
 * hosted: the per-tool and per-view landing stubs (scripts/build-tool-og.ts,
 * scripts/build-view-og.ts), the docs pages (docs/build.ts) and the shell's
 * index.html (the sitePreview plugin in shells/web/vite.config.js).
 *
 * The default is lolly.tools. A private instance that serves its own shell
 * build (lolly.ing does, from a VM) sets LOLLY_SITE_URL to its origin, so a
 * link shared from that instance previews with that instance's cards and URLs
 * rather than lolly.tools'.
 *
 * Only the preview URLs follow the override. Canonical links, the sitemap and
 * llms.txt keep naming the public project site.
 */
export const DEFAULT_SITE_URL = 'https://lolly.tools';

/**
 * The preview origin for this build: LOLLY_SITE_URL when set, else lolly.tools.
 * Throws on anything that is not a bare origin, because a typo here would ship
 * share cards pointing nowhere, and a build failure is the cheaper place to find out.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = (env.LOLLY_SITE_URL ?? '').trim();
  if (!raw) return DEFAULT_SITE_URL;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`LOLLY_SITE_URL is not a URL: ${raw}`);
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) {
    throw new Error(`LOLLY_SITE_URL must use https (http is allowed for localhost only): ${raw}`);
  }
  if ((u.pathname !== '/' && u.pathname !== '') || u.search || u.hash || u.username || u.password) {
    throw new Error(`LOLLY_SITE_URL must be an origin, with no path, query, fragment or credentials: ${raw}`);
  }
  return u.origin;
}

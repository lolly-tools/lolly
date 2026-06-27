// SPDX-License-Identifier: MPL-2.0
/**
 * NetAPI — controlled fetch for tools that declared the 'network' capability.
 *
 * The host applies the tool's allowlist before calling through. Tools without
 * the capability don't get this API at all (it's omitted from the host object).
 */

export function createNetAPI({ allowlist = [] }) {
  return {
    async fetch(url, init) {
      const allowed = allowlist.some(pattern => matches(pattern, url));
      if (!allowed) {
        throw new Error(`Tool tried to fetch disallowed URL: ${url}`);
      }
      return fetch(url, init);
    },
  };
}

function matches(pattern, url) {
  // Simple prefix-match for now. Supports trailing wildcards: "https://api.example.com/*"
  if (pattern.endsWith('*')) {
    return url.startsWith(pattern.slice(0, -1));
  }
  return url === pattern;
}

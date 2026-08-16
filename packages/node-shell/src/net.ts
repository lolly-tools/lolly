// SPDX-License-Identifier: MPL-2.0
/**
 * NetAPI - controlled fetch for tools that declared the 'network' capability.
 *
 * The host applies the tool's allowlist before calling through. Tools without
 * the capability don't get this API at all (it's omitted from the host object).
 */

import type { NetAPI } from '@lolly-tools/core/host-v1';

// Hard cap on a fetched response body. An allowlisted host can still be wrong,
// compromised, or redirect to something huge. The tool buffers whatever it reads
// into memory, so the bridge bounds it: a lying or absent Content-Length is
// caught by the counting stream, not trusted from the header. This cap is far
// above any tile, API, or font payload a tool legitimately pulls.
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;

export function createNetAPI({ allowlist = [] }: { allowlist?: readonly string[] }): NetAPI {
  return {
    async fetch(url, init) {
      const allowed = allowlist.some(pattern => matches(pattern, url));
      if (!allowed) {
        throw new Error(`Tool tried to fetch disallowed URL: ${url}`);
      }
      return capResponse(await fetch(url, init), MAX_RESPONSE_BYTES);
    },
  };
}

// Wrap the body in a counting stream that errors past the cap, so the reader
// (tool) fails mid-stream instead of buffering an unbounded body. Declared
// Content-Length is only a fast-fail; the count is the enforcement.
function capResponse(res: Response, cap: number): Response {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > cap) {
    throw new Error(`net: response is ${declared} bytes — over the ${cap}-byte limit`);
  }
  if (!res.body || typeof TransformStream !== 'function') return res;
  let total = 0;
  const counted = res.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > cap) controller.error(new Error(`net: response exceeds the ${cap}-byte limit`));
      else controller.enqueue(chunk);
    },
  }));
  return new Response(counted, { status: res.status, statusText: res.statusText, headers: res.headers });
}

function matches(pattern: string, url: string): boolean {
  // Simple prefix match for now. Supports trailing wildcards: "https://api.example.com/*".
  // The prefix must end at a path separator. The manifest schema requires the "/*" form,
  // and this enforces the same boundary for hand-fed allowlists (CLI/TUI opts). So an
  // entry like "https://api.example.com*" can never match a lookalike host such as
  // "https://api.example.com.evil.io/".
  if (pattern.endsWith('*')) {
    let prefix = pattern.slice(0, -1);
    if (!prefix.endsWith('/')) prefix += '/';
    return url.startsWith(prefix);
  }
  return url === pattern;
}

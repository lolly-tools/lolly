// SPDX-License-Identifier: MPL-2.0
/**
 * packages/node-shell/src/page-walk-bundle.ts, in the form the MCP function loads.
 *
 * The real module builds the page-walk script with esbuild on first use. The
 * function has no esbuild where it runs, and a bare `import('esbuild')` left in the
 * bundle would have Vercel's tracer pack esbuild's native binary into a function
 * capped at 250 MB. scripts/build-mcp-fn.ts builds the script at bundle time,
 * defines it in as `__LOLLY_PAGE_WALK__` and resolves the module here instead.
 */
declare const __LOLLY_PAGE_WALK__: string;

export const PAGE_WALK_ENTRY = '';

export function pageWalkScript(): Promise<string> {
  return Promise.resolve(__LOLLY_PAGE_WALK__);
}

export async function buildPageWalkScript(): Promise<string> {
  return __LOLLY_PAGE_WALK__;
}

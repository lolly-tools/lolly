// SPDX-License-Identifier: MPL-2.0
import { matchRenderGetPath } from './render-get.ts';

/** Remove the matching rewrite capture that Vercel appends to the render URL. */
export function vercelRenderUrl(raw: string): string {
  const url = new URL(raw, 'http://internal');
  const match = matchRenderGetPath(url.pathname);
  if (!match) return raw;
  const file = `${match.toolId}.${match.ext}`;
  if (!url.searchParams.getAll('file').includes(file)) return raw;
  url.searchParams.delete('file', file);
  return `${url.pathname}${url.search}`;
}

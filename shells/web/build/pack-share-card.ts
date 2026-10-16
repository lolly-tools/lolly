// SPDX-License-Identifier: MPL-2.0
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Serve a pack's own default share card as the site's /og.png. A pack may ship one at
 * catalog/og/og.png (lolly-demo's is Opal's house card, from scripts/build-og-base.ts);
 * the build copies it over the shared public/og.png in `outDir`, the address that
 * index.html, the /info pages and the share stubs give crawlers. Run it after the
 * catalog is materialised into `outDir`. Returns whether a pack card was served; a pack
 * without one keeps the shared card.
 */
export function servePackShareCard(outDir: string): boolean {
  const card = resolve(outDir, 'catalog/og/og.png');
  if (!existsSync(card)) return false;
  copyFileSync(card, resolve(outDir, 'og.png'));
  return true;
}

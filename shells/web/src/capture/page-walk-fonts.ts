// SPDX-License-Identifier: MPL-2.0
/**
 * Stand-in for `bridge/font-registry.ts` inside the page-walk script.
 *
 * The real registry resolves a font stack to Lolly's own font files (brand
 * catalog, the person's uploaded fonts, the platform faces), which pulls in
 * IndexedDB, the design-system loader and the locale tables: about 4 MB the
 * captured page can never use. Inside a third-party page the walker runs without
 * a text shaper, so text stays `<text>` and nothing asks for a font file. The
 * page-walk build swaps the registry module for this one.
 */
import type { VectorFont } from '../bridge/font-registry.ts';

export async function resolveVectorFont(): Promise<VectorFont | null> {
  return null;
}

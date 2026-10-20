// SPDX-License-Identifier: MPL-2.0
/**
 * Stand-in for `bridge/font-registry.ts` inside the page-walk script.
 *
 * The real registry resolves a font stack to Lolly's own font files (brand
 * catalog, the person's uploaded fonts, the platform faces), which pulls in
 * IndexedDB, the design-system loader and the locale tables: about 4 MB the
 * captured page can never use. The page walk outlines text later, in the shell,
 * from the faces the page itself loaded. So this answers with a key that carries
 * the run's font stack and style instead of a file, and the walk's stand-in
 * text shaper (page-walk.ts) records the run under that key.
 */
import type { VectorFont } from '../bridge/font-registry.ts';

/** The url prefix of a deferred face: `lolly-font:` + the URI-encoded style key. */
export const FONT_KEY = 'lolly-font:';

/** What the shell needs to choose a face for a run, in the browser's computed values. */
export interface FontKey { family: string; weight: string; style: string; stretch: string }

export async function resolveVectorFont(style: { fontFamily?: string; fontWeight?: string; fontStyle?: string; fontStretch?: string }): Promise<VectorFont | null> {
  const key: FontKey = {
    family: style.fontFamily ?? '',
    weight: style.fontWeight ?? '400',
    style: style.fontStyle ?? 'normal',
    stretch: style.fontStretch ?? 'normal',
  };
  return { url: FONT_KEY + encodeURIComponent(JSON.stringify(key)) };
}

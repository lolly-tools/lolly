// SPDX-License-Identifier: MPL-2.0
/**
 * Stand-in for `bridge/font-fill.ts` inside the page-walk script.
 *
 * A captured page draws with the faces it loaded itself, and the shell outlines those
 * later from the keys page-walk-fonts.ts hands out. Lolly's fallback fonts are for a
 * design system's documents, never for a third-party page, so here a run resolves as it
 * did before they existed, and the injected script carries no HarfBuzz.
 */
export { resolveVectorFont as resolveExportFont } from '../bridge/font-registry.ts';

/** A captured page's runs never carry a fallback font. */
export function extendsChain(): boolean { return false; }

/** No live-page fallback fonts to wait for and no note to give. */
export function withFallbackFonts<T>(render: () => Promise<T>, _root?: Element | null): Promise<T> { return render(); }

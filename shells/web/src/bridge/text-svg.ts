// SPDX-License-Identifier: MPL-2.0
/**
 * Pure helpers for vectorising HTML text into SVG <path> via host.text.toPath.
 *
 * The implementation MOVED to packages/node-shell/src/text-svg.ts (plans/202
 * WP1.1). svg-ir.ts runs in the terminal shells as well as here, and it reads
 * three of these parsers, so they had to sit in the package both sides can
 * import - a shell must not reach across a submodule boundary to typecheck,
 * the same rule pdf-redact-core.ts and pptx.ts follow.
 *
 * This file stays as a stable re-export, so every web import site (export.ts,
 * font-registry.ts, views/outline-text.ts, views/glyph-split-mount.ts and
 * text-svg.test.ts) keeps working unchanged.
 */

export {
  textStrokeAttrs,
  suseWeightName, SUSE_FONT_DIR, suseFontFile, resolveSuseFontUrl,
  canVectoriseText, featureSettingsToHb, letterSpacingPx, textBaselineY,
} from '../../../../packages/node-shell/src/text-svg.ts';

export type { TextStrokeSlice, FontStyleSlice } from '../../../../packages/node-shell/src/text-svg.ts';

// Apply CSS text-transform to a display string. CSS transforms text only at paint
// time (textContent is unchanged), so the vector walkers - which read textContent
// - must apply it themselves or vector exports show the original case. upper/lower
// are 1:1 so they don't disturb per-line substring offsets; capitalize upcases the
// first letter of each whitespace-separated word (locale-default).
export function applyTextTransform(str: string, transform: string | null | undefined): string {
  switch (transform) {
    case 'uppercase': return str.toUpperCase();
    case 'lowercase': return str.toLowerCase();
    case 'capitalize': return str.replace(/(^|[\s ])([^\s ])/gu, (_, p, c) => p + c.toUpperCase());
    default: return str;
  }
}

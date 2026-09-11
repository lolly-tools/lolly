// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: pure helpers - canvas size, colour unwrapping, font stacks and import hints.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { brandFontFamilies } from '../../lib/register-user-fonts.ts';
import { t } from '../../i18n.ts';
import type { ColorFieldValue } from '../../components/color-field.ts';
import { FONT_STACK, WEIGHT_CHOICES } from './shared.ts';
import type { Canvas, ImportMode } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';
 // mirrors the Save icon's unsaved cue (see buildToolbar/actions)
// The artboard is resizable, so read its CURRENT declared size (not the mount-time
// nativeW/H) everywhere geometry depends on the canvas dimensions.
export const canvasWH = (fc: FcCtx): Canvas => { const { canvasEl, nativeH, nativeW } = fc; return ({
  w: parseInt(canvasEl.style.width, 10) || nativeW,
  h: parseInt(canvasEl.style.height, 10) || nativeH,
}); };
export const unwrapColor = (_fc: FcCtx, v: ColorFieldValue) =>
  v && typeof v === 'object' && 'value' in v ? v.value : v;
// Mono detection mirrors hooks.js weightOf (/mono/i on the wire value; the label
// covers manifests whose values don't self-describe). Mono cuts rarely ship a
// Black, so the weight menu and the font-change clamp cap mono at 800.
export const isMonoFont = (fc: FcCtx, font: any): boolean => {
  const { fontOptions } = fc;
  const v = String(font);
  return /mono/i.test(v) || fontOptions.some((o) => o.value === v && /mono/i.test(o.label));
};
export const maxWeightFor = (fc: FcCtx, font: any): number => (isMonoFont(fc, font) ? 800 : 900);
export const weightChoicesFor = (fc: FcCtx, font: any): Array<[string, string]> =>
  WEIGHT_CHOICES.filter(([v]) => +v <= maxWeightFor(fc, font));
// Live-preview stack: exact hooks.js stacks for the known wire values; other
// declared options derive one from the value (leading family + a generic tail);
// unknown/empty values preview as the manifest's default font, mirroring
// hooks.js fontFamily's fallback.
export const stackOf = (fc: FcCtx, s: string): string =>
  FONT_STACK[s] ||
  (isMonoFont(fc, s)
    ? `'${s}', ui-monospace, SFMono-Regular, monospace`
    : `'${s}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`);
export const fontStackFor = (fc: FcCtx, v: any): string => {
  const { defaultFont, fontOptions } = fc;
  const s = String(v ?? '');
  // Installed user-font families count too: hooks.js already paints any brand
  // font the kit carries, so the format-bar overlay must preview it rather
  // than coercing the preview to the default face.
  return s && (fontOptions.some((o) => o.value === s) || brandFontFamilies().includes(s))
    ? stackOf(fc, s)
    : stackOf(fc, defaultFont);
};
export const fontOptionsHtml = (fc: FcCtx, cur?: any): string =>
  { const { fontOptions } = fc; return fontOptions
    .map(
      (o) =>
        `<option value="${fc.keys.escapeHtml(o.value)}"${String(cur) === o.value ? ' selected' : ''}>${fc.keys.escapeHtml(o.label)}</option>`
    )
    .join(''); };
/** What each import mode does, in one line under the choice. */
export const importHint = (_fc: FcCtx, mode: ImportMode): string =>
  mode === 'scenes'
    ? t(
        'Every frame becomes its own scene on the timeline, ready for timing tweaks, music and voiceover.'
      )
    : mode === 'artboards'
      ? t(
          'Every page or slide becomes its own artboard, side by side, with its parts still editable.'
        )
      : t('One page replaces the board. A multi-page document asks which page.');
// A function, not a literal: TypeScript narrows `let m: ImportMode = cond ? 'a' : 'b'`
// to those two members, which makes the panel's third radio unreachable at the type
// level even though the user can pick it.
export const defaultImportMode = (fc: FcCtx): ImportMode => { const { importScenesMode } = fc; return (importScenesMode ? 'scenes' : 'board'); };
export function helpersOps(fc: FcCtx) {
  return {
    canvasWH: bindOp(fc, canvasWH),
    unwrapColor: bindOp(fc, unwrapColor),
    isMonoFont: bindOp(fc, isMonoFont),
    maxWeightFor: bindOp(fc, maxWeightFor),
    weightChoicesFor: bindOp(fc, weightChoicesFor),
    stackOf: bindOp(fc, stackOf),
    fontStackFor: bindOp(fc, fontStackFor),
    fontOptionsHtml: bindOp(fc, fontOptionsHtml),
    importHint: bindOp(fc, importHint),
    defaultImportMode: bindOp(fc, defaultImportMode),
  };
}

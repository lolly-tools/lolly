// SPDX-License-Identifier: MPL-2.0
/**
 * The shared shape for layered raster import: what psd.ts and xcf.ts both
 * decode into. Also holds the blend-mode bridge between the source formats
 * and the one blend set the platform actually renders: CSS `mix-blend-mode`.
 *
 * Why one module: a PSD layer and an XCF layer are the same kind of object - a
 * named RGBA bitmap at a document offset with opacity/visibility/blend. Every
 * consumer (the darkroom tool's layer rows, Design's boxes,
 * the picker's flatten path, psd-write.ts) should see one shape, no matter
 * which container the bytes came from. The blend tables live here, not in each
 * parser, because they target the SAME 16-value CSS set that Layout
 * Studio's / sequence-studio's `blend` selects already ship. The write-back
 * table must be the exact inverse of the lossless read rows.
 *
 * Mapping policy: every source mode maps to its nearest CSS mode. `blendLossy`
 * marks the approximate ones, and `blendRaw` keeps the source value (`'psd:mul '`,
 * `'xcf:30'`) so nothing is lost silently. An UNKNOWN mode never throws.
 * It reads as `normal` + lossy + a parser warning, because one exotic layer
 * mode must not block the whole document from loading.
 *
 * XCF mode numbers are pinned against GIMP's own devel-docs/xcf.txt (gimp-2-10
 * branch): 0-22 legacy, 23-27 LCH (XCF 9+), 28-61 default class (XCF 10+).
 * PSD keys are the 4-char blend signatures of the PSD spec ("Blend mode keys").
 *
 * Pure types + frozen tables; DOM-free, no deps (engine contract).
 */

/** The CSS `mix-blend-mode` vocabulary the platform renders and round-trips. */
export type CssBlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light'
  | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

/** One decoded layer, in document coordinates, bottom-to-top order. */
export interface RasterLayer {
  name: string;
  /** Layer bounds in document pixels (may extend outside the canvas). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** RGBA8, sRGB, un-premultiplied, length width*height*4 (empty for groups
   *  and for layers whose channel data was skipped/damaged). */
  pixels: Uint8Array;
  /** 0..1 (PSD opacity byte / XCF PROP_FLOAT_OPACITY). */
  opacity: number;
  blend: CssBlendMode;
  /** Provenance of the source mode, e.g. 'psd:mul ' or 'xcf:30'. */
  blendRaw: string;
  /** True when `blend` is an approximation of the source mode. */
  blendLossy: boolean;
  visible: boolean;
  /** PSD clipping flag (clip to the layer below); false for XCF. */
  clipped: boolean;
  /** True for a group container row (pixels empty). */
  isGroup: boolean;
  /** Indices (into the layers array) of ancestor groups, outermost first. */
  groupPath: number[];
}

/** A parsed layered document - the one shape both readers return. */
export interface LayeredRasterDoc {
  format: 'psd' | 'xcf';
  width: number;
  height: number;
  /** Source bit depth per channel (pixels are always delivered as 8-bit). */
  depth: 8 | 16 | 32;
  /** Source colour mode, for honest labelling ('rgb' | 'gray' | 'cmyk'). */
  colorMode: 'rgb' | 'gray' | 'cmyk';
  /** Bottom-to-top: layers[0] paints first, later entries on top. */
  layers: RasterLayer[];
  /** Flattened preview when the container carries one (PSD merged image data;
   *  XCF stores none). RGBA8 at document size. */
  composite?: { width: number; height: number; pixels: Uint8Array };
  /** Raw embedded ICC profile bytes (PSD resource 1039), parse with icc.ts. */
  icc?: Uint8Array;
  /** Mirror of every onWarn code emitted, for callers without a sink. */
  warnings: string[];
}

/**
 * Injected zlib inflater - the engine deliberately carries no inflate (see
 * deflate.ts's header); the shell that has the archive inflates (fflate's
 * `unzlibSync` on web, `node:zlib.inflateSync` in Node/CLI). Implementations
 * MUST honour `maxOut` as an output cap (both named backends accept an output
 * size/limit); the parsers additionally reject any result longer than
 * `maxOut`, so a decompression bomb is bounded twice.
 */
export type InflateFn = (bytes: Uint8Array, maxOut: number) => Uint8Array;

interface BlendMap { css: CssBlendMode; lossy: boolean }
const m = (css: CssBlendMode, lossy = false): BlendMap => ({ css, lossy });

/**
 * PSD 4-char blend signature → CSS. Keys are the spec's exact bytes (note the
 * trailing spaces). Lossy rows collapse Photoshop-only maths onto the nearest
 * CSS neighbour.
 */
export const PSD_BLEND_TO_CSS: Readonly<Record<string, BlendMap>> = Object.freeze({
  'pass': m('normal', true),      // group pass-through (CSS has no equivalent)
  'norm': m('normal'),
  'diss': m('normal', true),      // dissolve
  'dark': m('darken'),
  'mul ': m('multiply'),
  'idiv': m('color-burn'),
  'lbrn': m('color-burn', true),  // linear burn
  'dkCl': m('darken', true),      // darker color
  'lite': m('lighten'),
  'scrn': m('screen'),
  'div ': m('color-dodge'),
  'lddg': m('color-dodge', true), // linear dodge (add)
  'lgCl': m('lighten', true),     // lighter color
  'over': m('overlay'),
  'sLit': m('soft-light'),
  'hLit': m('hard-light'),
  'vLit': m('hard-light', true),  // vivid light
  'lLit': m('hard-light', true),  // linear light
  'pLit': m('hard-light', true),  // pin light
  'hMix': m('hard-light', true),  // hard mix
  'diff': m('difference'),
  'smud': m('exclusion'),
  'fsub': m('difference', true),  // subtract
  'fdiv': m('difference', true),  // divide
  'hue ': m('hue'),
  'sat ': m('saturation'),
  'colr': m('color'),
  'lum ': m('luminosity'),
});

/**
 * CSS → PSD blend key for write-back: the exact inverse of the sixteen
 * non-lossy read rows, so a round-trip through our own writer is stable.
 */
export const CSS_TO_PSD_BLEND: Readonly<Record<CssBlendMode, string>> = Object.freeze({
  'normal': 'norm',
  'multiply': 'mul ',
  'screen': 'scrn',
  'overlay': 'over',
  'darken': 'dark',
  'lighten': 'lite',
  'color-dodge': 'div ',
  'color-burn': 'idiv',
  'hard-light': 'hLit',
  'soft-light': 'sLit',
  'difference': 'diff',
  'exclusion': 'smud',
  'hue': 'hue ',
  'saturation': 'sat ',
  'color': 'colr',
  'luminosity': 'lum ',
});

/**
 * XCF PROP_MODE value → CSS, both mode generations in the one number space
 * (devel-docs/xcf.txt, gimp-2-10): 0-22 legacy, 23-27 LCH (XCF 9+), 28-61
 * default class (XCF 10+). Legacy 5 "overlay" is soft-light maths (GIMP's own
 * historical bug, kept for compatibility) - mapped accordingly.
 */
export const XCF_MODE_TO_CSS: Readonly<Record<number, BlendMap>> = Object.freeze({
  0: m('normal'),                  // Normal (legacy)
  1: m('normal', true),            // Dissolve
  2: m('normal', true),            // Behind (paint-only)
  3: m('multiply'),                // Multiply (legacy)
  4: m('screen'),                  // Screen (legacy)
  5: m('soft-light', true),        // "Overlay" (legacy - soft-light maths)
  6: m('difference'),              // Difference (legacy)
  7: m('color-dodge', true),       // Addition (legacy)
  8: m('difference', true),        // Subtract (legacy)
  9: m('darken'),                  // Darken only (legacy)
  10: m('lighten'),                // Lighten only (legacy)
  11: m('hue'),                    // HSV Hue (legacy)
  12: m('saturation'),             // HSV Saturation (legacy)
  13: m('color'),                  // HSL Color (legacy)
  14: m('luminosity', true),       // HSV Value (legacy)
  15: m('color-dodge', true),      // Divide (legacy)
  16: m('color-dodge'),            // Dodge (legacy)
  17: m('color-burn'),             // Burn (legacy)
  18: m('hard-light'),             // Hard light (legacy)
  19: m('soft-light'),             // Soft light (legacy)
  20: m('difference', true),       // Grain extract (legacy)
  21: m('normal', true),           // Grain merge (legacy)
  22: m('normal', true),           // Color erase (legacy)
  23: m('overlay'),                // Overlay (XCF 9+)
  24: m('hue', true),              // LCH Hue
  25: m('saturation', true),       // LCH Chroma
  26: m('color', true),            // LCH Color
  27: m('luminosity', true),       // LCH Lightness
  28: m('normal'),                 // Normal
  29: m('normal', true),           // Behind
  30: m('multiply'),               // Multiply
  31: m('screen'),                 // Screen
  32: m('difference'),             // Difference
  33: m('color-dodge', true),      // Addition
  34: m('difference', true),       // Subtract
  35: m('darken'),                 // Darken only
  36: m('lighten'),                // Lighten only
  37: m('hue'),                    // HSV Hue
  38: m('saturation'),             // HSV Saturation
  39: m('color'),                  // HSL Color
  40: m('luminosity', true),       // HSV Value
  41: m('color-dodge', true),      // Divide
  42: m('color-dodge'),            // Dodge
  43: m('color-burn'),             // Burn
  44: m('hard-light'),             // Hard light
  45: m('soft-light'),             // Soft light
  46: m('difference', true),       // Grain extract
  47: m('normal', true),           // Grain merge
  48: m('hard-light', true),       // Vivid light
  49: m('hard-light', true),       // Pin light
  50: m('hard-light', true),       // Linear light
  51: m('hard-light', true),       // Hard mix
  52: m('exclusion'),              // Exclusion
  53: m('color-burn', true),       // Linear burn
  54: m('darken', true),           // Luma darken only
  55: m('lighten', true),          // Luma lighten only
  56: m('luminosity', true),       // Luminance
  57: m('normal', true),           // Color erase
  58: m('normal', true),           // Erase
  59: m('normal', true),           // Merge
  60: m('normal', true),           // Split
  61: m('normal', true),           // Pass through (group)
});

/** Resolve a PSD blend key with the unknown→normal+lossy policy. */
export function psdBlendToCss(key: string): { css: CssBlendMode; lossy: boolean; known: boolean } {
  const hit = Object.hasOwn(PSD_BLEND_TO_CSS, key) ? PSD_BLEND_TO_CSS[key] : undefined;
  return hit ? { ...hit, known: true } : { css: 'normal', lossy: true, known: false };
}

/** Resolve an XCF mode number with the unknown→normal+lossy policy. */
export function xcfModeToCss(mode: number): { css: CssBlendMode; lossy: boolean; known: boolean } {
  const hit = Object.hasOwn(XCF_MODE_TO_CSS, mode) ? XCF_MODE_TO_CSS[mode] : undefined;
  return hit ? { ...hit, known: true } : { css: 'normal', lossy: true, known: false };
}

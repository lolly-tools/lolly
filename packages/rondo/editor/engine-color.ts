// SPDX-License-Identifier: MPL-2.0
/**
 * What the web shell's visualiser modules read from `@lolly/engine`
 * (shells/web/src/lib/viz-palette.ts, display-gamut.ts). The editor build
 * points that import here instead of at the whole engine barrel, so the frame
 * carries the colour maths and nothing else from the engine.
 */
export { hexToOklch, oklchToHex } from '../../../engine/src/brand-derive.ts';
export { rampOklab } from '../../../engine/src/color-tools.ts';
export type { EncodeSpace } from '../../../engine/src/gamut.ts';

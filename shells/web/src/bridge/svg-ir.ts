// SPDX-License-Identifier: MPL-2.0
/**
 * SVG DOM → EMF intermediate representation (IR).
 *
 * The walk MOVED to packages/node-shell/src/svg-ir.ts (plans/202 WP1.1). It is
 * DOM-light by design - attribute reads plus an optional computed style - and
 * `shells/cli` has driven EMF, EPS, DXF and WMF through it for as long as those
 * formats have existed, so it belongs in the package both shells can import
 * rather than behind a submodule boundary.
 *
 * One thing could not follow it: `font-registry.ts`, which reads IndexedDB and
 * `document.fonts` to find the sfnt an outlined run needs. The walk now takes a
 * resolver instead, and THIS file supplies the web one. So `svgDomToIr` here is
 * the same function with the registry already wired in - every existing caller
 * (export.ts, the Penpot PDF sink, svg-ir-transform.test.ts) keeps its
 * behaviour, and a caller that wants a different resolver can still pass one.
 */

import { svgDomToIr as walkSvgToIr } from '../../../../packages/node-shell/src/svg-ir.ts';
import type { SvgIrContext, VectorIrResult } from '../../../../packages/node-shell/src/svg-ir.ts';
import { resolveVectorFont } from './font-registry.ts';

export {
  parseColor, parseTransformList, decomposeAffine, parseSvgDropShadow,
} from '../../../../packages/node-shell/src/svg-ir.ts';

export type {
  Mat, SvgIrContext, SvgIrFont, SvgDropShadow, VectorIrResult,
} from '../../../../packages/node-shell/src/svg-ir.ts';

/**
 * Walk a rendered SVG into the vector IR, outlining text through the web
 * shell's font registry unless the caller names its own resolver.
 */
export function svgDomToIr(svgEl: Element, ctx: SvgIrContext = {}): Promise<VectorIrResult> {
  return walkSvgToIr(svgEl, { resolveFont: resolveVectorFont, ...ctx });
}

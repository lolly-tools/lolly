// SPDX-License-Identifier: MPL-2.0
/**
 * SVG DOM → EMF intermediate representation (IR).
 *
 * The walk MOVED to packages/node-shell/src/svg-ir.ts (plans/202 WP1.1). It is
 * DOM-light by design - attribute reads plus an optional computed style - and
 * `shells/cli` has driven EMF, EPS, DXF and WMF through it for as long as those
 * formats have existed, so it belongs in the package both shells can import
 * rather than inside one of them.
 *
 * One thing could not follow it: `font-registry.ts`, which reads IndexedDB and
 * `document.fonts` to find the sfnt an outlined run needs. The walk now takes a
 * resolver instead, and THIS file supplies the web one. So `svgDomToIr` here is
 * the same function with the registry already wired in - every existing caller
 * (export.ts, the Penpot PDF sink, svg-ir-transform.test.ts) keeps its
 * behaviour, and a caller that wants a different resolver can still pass one.
 */

import { svgDomToIr as walkSvgToIr } from '@lolly-tools/node-shell/svg-ir';
import type { SvgIrContext, VectorIrResult } from '@lolly-tools/node-shell/svg-ir';
import { resolveExportFont, noteFillUse } from './font-fill.ts';

export {
  parseColor, parseTransformList, decomposeAffine, parseSvgDropShadow,
} from '@lolly-tools/node-shell/svg-ir';

export type {
  Mat, SvgIrContext, SvgIrFont, SvgDropShadow, VectorIrResult,
} from '@lolly-tools/node-shell/svg-ir';

/**
 * Walk a rendered SVG into the vector IR, outlining text through the web
 * shell's font registry unless the caller names its own resolver.
 */
export function svgDomToIr(svgEl: Element, ctx: SvgIrContext = {}): Promise<VectorIrResult> {
  // These formats have no live-text answer for a run they cannot outline, so a run is counted as
  // drawn by its fallback fonts when they resolve: the export fails otherwise.
  const resolveFont = async (style: Parameters<typeof resolveExportFont>[0], text: string) => { const vf = await resolveExportFont(style, text); noteFillUse(vf); return vf; };
  return walkSvgToIr(svgEl, { resolveFont, readImage: readPageImage, ...ctx });
}

/** An `<image>`'s bytes through the page's own fetch: a catalog path or an allowed
 *  remote picture reads the way the page drew it, inside the browser's CSP. The Node
 *  shells pass no reader, so there only inline pictures are read. */
async function readPageImage(href: string): Promise<Blob | null> {
  return (await fetch(href)).blob();
}

// SPDX-License-Identifier: MPL-2.0
// host.lift (v1.123) - the web shell's implementation of LiftAPI. Fetch + sanitise an SVG
// named by URL, run the engine's `enumerateSvgLayers`, and hand back each layer as a
// standalone SVG document. See packages/core/src/host-v1.ts for the contract. Lazy-loaded
// via the bridge/index.ts facade, so DOMPurify + the enumerator only ship to a session
// that actually lifts.
//
// The enumeration is the ENGINE's, exactly as the Design tool's Lift and the CLI Tier-A
// path use it - the point of this primitive is to give that ONE canonical answer to a tool
// TEMPLATE, which cannot import the engine (it runs as an IIFE). The DEPTH maths that turns
// layers into a scene stays in the caller (the Flythrough tool stacks them in z).

import type { LiftResult } from '@lolly-tools/core/host-v1';
import { sanitizeSvgToString } from './svg-sanitize.ts';
import { enumerateSvgLayers } from '../../../../engine/src/svg-layers.ts';

export async function svg(source: string): Promise<LiftResult> {
  // Fetch the bytes, then run them through the shell's ONE untrusted-SVG path
  // (`sanitizeSvgToString` - DOMPurify, serialised from the sanitised node), the same
  // sanitiser `fetchAnimSvg` and the Design tool's Lift use. A fetch failure throws (the
  // caller should see it); a sanitise failure (`SvgSanitizeError`) likewise propagates.
  const res = await fetch(source);
  if (!res.ok) throw new Error(`lift: fetch ${res.status} for ${source}`);
  const raw = await res.text();
  if (!/<svg[\s>]/i.test(raw)) {
    // Not an SVG (a raster shot, or an empty/garbage fetch): nothing to lift. The caller
    // treats the shot as one plane. This is "nothing to lift", NOT an error - so no throw.
    return { layers: [], viewBox: null, warnings: [] };
  }
  const markup = await sanitizeSvgToString(raw);
  // Full-stage layers (`cropToInk: false` - the default is TRUE): every layer keeps the
  // SOURCE viewBox, content in place and transparent elsewhere, so the derived planes
  // overlay EXACTLY and the caller only stacks them in z - no per-layer placement. (Ink
  // cropping is the Design tool's plate-fidelity concern; here it would stretch each tiny
  // layer across the whole plane.)
  const { layers, warnings, viewBox } = enumerateSvgLayers(markup, { cropToInk: false });
  return {
    layers: layers.map((l) => ({ svg: l.markup, bbox: l.bbox, nodes: l.nodes })),
    viewBox,
    warnings,
  };
}
